"""الموافقات الرقمية (Consent) وخطة ما بعد العلاج — المرحلة 2α.

التزام بمبدأ الموافقة المسبقة المبنية على العلم (قانون 18-07):
- الموافقة قابلة للرجوع عنها في أي لحظة (revoke)؛
- معرفة نطاقها ومنحها وتاريخ انتهائها بدقة.
"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..audit import record
from ..deps import current_user, get_db, require_role
from ..models import CarePlan, Consent

router = APIRouter(prefix="/api", tags=["care-consent"])


# ---------- الموافقات ----------

TYPES = {
    "record": "اطلاع على الملف الطبي الموحد",
    "treatment": "العلاج والمتابعة العلاجية",
    "research": "المشاركة في البحث (بإخفاء الهوية)",
    "sharing": "مشاركة البيانات مع مؤسسات من النظام",
}


def _consent_ref() -> str:
    n = int((__import__("time").time() * 1000) % 1_000_000)
    return f"CN-{date.today().strftime('%Y%m%d')}-{n:06d}"


class ConsentIn(BaseModel):
    patient_name: str
    type: str = "record"
    grantor: str = ""
    granted_to: str = ""
    scope: str = ""
    expires_on: str = ""


def _ser(c: Consent) -> dict:
    return {
        "id": c.id, "ref": c.ref, "patient_name": c.patient_name, "type": c.type,
        "type_label": TYPES.get(c.type, c.type), "grantor": c.grantor,
        "granted_to": c.granted_to, "scope": c.scope, "signed": c.signed,
        "expires_on": c.expires_on, "revoked": c.revoked,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.post("/consents")
async def create_consent(body: ConsentIn, payload=Depends(current_user),
                         db: AsyncSession = Depends(get_db)):
    if body.type not in TYPES:
        raise HTTPException(status_code=422, detail=f"نوع موافقة غير معروف — القيم: {', '.join(TYPES)}")
    c = Consent(ref=_consent_ref(), patient_name=body.patient_name.strip(), type=body.type,
                grantor=body.grantor or payload.get("name", ""), granted_to=body.granted_to,
                scope=body.scope, expires_on=body.expires_on or "")
    db.add(c)
    await db.flush()
    await record(db, actor=payload.get("name", ""), action="create", entity="consent",
                 entity_id=c.id, detail=f"موافقة {c.ref} — {TYPES[c.type]} للمريض: {c.patient_name}")
    await db.commit()
    return _ser(c)


@router.get("/consents")
async def list_consents(patient: str = "", payload=Depends(current_user),
                        db: AsyncSession = Depends(get_db)):
    q = select(Consent).order_by(Consent.created_at.desc()).limit(300)
    if patient.strip():
        q = q.where(Consent.patient_name.ilike(f"%{patient.strip()}%"))
    res = await db.execute(q)
    return [_ser(c) for c in res.scalars().all()]


@router.post("/consents/{cid}/revoke")
async def revoke_consent(cid: int, payload=Depends(current_user),
                         db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Consent).where(Consent.id == cid))
    c = res.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="موافقة غير موجودة")
    if c.revoked:
        raise HTTPException(status_code=409, detail="الموافقة ملغاة مسبقاً")
    c.revoked = True
    await record(db, actor=payload.get("name", ""), action="update", entity="consent",
                 entity_id=c.id, detail=f"الرجوع عن موافقة {c.ref} ({TYPES.get(c.type, c.type)})")
    await db.commit()
    return _ser(c)


# ---------- خطة ما بعد العلاج ----------

class GoalIn(BaseModel):
    g: str
    done: bool = False


class PlanIn(BaseModel):
    patient_name: str
    title: str = ""
    summary: str = ""
    goals: list[GoalIn] = []
    schedule: list[dict] = []


def _ser_plan(p: CarePlan) -> dict:
    import json
    try:
        goals = json.loads(p.goals_json or "[]")
        schedule = json.loads(p.schedule_json or "[]")
    except Exception:
        goals, schedule = [], []
    return {
        "id": p.id, "patient_name": p.patient_name, "doctor_name": p.doctor_name,
        "title": p.title, "summary": p.summary, "goals": goals, "schedule": schedule,
        "active": p.active,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


@router.post("/careplans")
async def create_plan(body: PlanIn, payload=Depends(require_role("admin", "doctor", "nurse")),
                      db: AsyncSession = Depends(get_db)):
    import json
    p = CarePlan(patient_name=body.patient_name.strip(), doctor_name=payload.get("name", ""),
                 title=body.title or "خطة ما بعد العلاج", summary=body.summary,
                 goals_json=json.dumps([{"g": g.g, "done": g.done} for g in body.goals],
                                       ensure_ascii=False),
                 schedule_json=json.dumps(body.schedule, ensure_ascii=False))
    db.add(p)
    await db.flush()
    await record(db, actor=p.doctor_name, action="create", entity="careplan",
                 entity_id=p.id, detail=f"خطة ما بعد العلاج للمريض: {p.patient_name}")
    await db.commit()
    return _ser_plan(p)


class PlanPatch(BaseModel):
    done: bool | None = None
    active: bool | None = None


@router.post("/careplans/{pid}/goal/{idx}")
async def toggle_goal(pid: int, idx: int, body: PlanPatch,
                      payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    import json
    res = await db.execute(select(CarePlan).where(CarePlan.id == pid))
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="خطة غير موجودة")
    goals = json.loads(p.goals_json or "[]")
    if idx < 0 or idx >= len(goals):
        raise HTTPException(status_code=404, detail="هدف غير موجود")
    if body.done is not None:
        goals[idx]["done"] = body.done
    p.goals_json = json.dumps(goals, ensure_ascii=False)
    if body.active is not None:
        p.active = body.active
    await db.commit()
    return _ser_plan(p)


@router.get("/careplans")
async def list_plans(patient: str = "", payload=Depends(current_user),
                     db: AsyncSession = Depends(get_db)):
    q = select(CarePlan).order_by(CarePlan.created_at.desc()).limit(200)
    if patient.strip():
        q = q.where(CarePlan.patient_name.ilike(f"%{patient.strip()}%"))
    res = await db.execute(q)
    return [_ser_plan(p) for p in res.scalars().all()]