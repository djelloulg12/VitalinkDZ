from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..audit import record
from ..crypto import decrypt_text, encrypt_text
from ..deps import current_user, get_db, require_role
from ..models import Institution, InstitutionLink, Referral, User
from .notifications import push

router = APIRouter(prefix="/api/referrals", tags=["referrals"])


class ReferralIn(BaseModel):
    patient_name: str
    from_institution_id: Optional[int] = None
    to_institution_id: Optional[int] = None
    reason: str = ""
    medical_note: str = ""
    severity: str = "normal"     # normal | red (Red Alert)
    sla_hours: Optional[float] = None


class DecideIn(BaseModel):
    status: str  # accepted | rejected


class CompleteIn(BaseModel):
    outcome: str = ""   # نتيجة المعالجة/الخاتمة عند إغلاق الحلقة


async def _inst(db: AsyncSession, iid: int | None) -> dict | None:
    if not iid:
        return None
    res = await db.execute(select(Institution).where(Institution.id == iid))
    i = res.scalar_one_or_none()
    if not i:
        return None
    return {"id": i.id, "name": i.name, "type": i.type, "city": i.city, "wilaya_id": i.wilaya_id}


async def _serialize(db: AsyncSession, r: Referral) -> dict:
    return {
        "id": r.id, "patient_name": r.patient_name,
        "from": await _inst(db, r.from_institution_id),
        "to": await _inst(db, r.to_institution_id),
        "reason": r.reason, "medical_note": decrypt_text(r.medical_note), "status": r.status,
        "severity": r.severity,
        "sla_hours": r.sla_hours,
        "created_by": r.created_by,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "decided_at": r.decided_at.isoformat() if r.decided_at else None,
        "decided_by": r.decided_by,
        "outcome": r.outcome,
        "completed_at": r.completed_at.isoformat() if r.completed_at else None,
    }


async def _created_by_role(db: AsyncSession, r: Referral) -> str:
    """يعيد دور الجهة المُحيلة (لإشعارها بمسار الإحالة)."""
    if not r.created_by:
        return "nurse"
    u = (await db.execute(select(User).where(User.id == r.created_by))).scalar_one_or_none()
    return u.role if u else "nurse"


@router.get("")
async def list_referrals(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Referral).order_by(Referral.created_at.desc()))
    return [await _serialize(db, r) for r in res.scalars().all()]


@router.post("")
async def create_referral(
    body: ReferralIn,
    payload=Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    r = Referral(**body.model_dump(), status="pending", created_by=payload["uid"])
    r.medical_note = encrypt_text(r.medical_note)
    db.add(r)
    await db.flush()
    tag = " [RED ALERT]" if body.severity == "red" else ""
    await record(db, actor=payload.get("name", ""), action="create", entity="referral",
                 entity_id=r.id, detail=f"إنشاء إحالة إلكترونية للمريض: {r.patient_name}{tag}", new=r.patient_name)
    await db.commit()
    await db.refresh(r)
    # إشعار الفريق الطبي والإدارة بوصول إحالة جديدة
    await push(db, role="admin", icon="🔄", title=f"إحالة جديدة — {r.patient_name}",
               body=body.reason, entity="referral", entity_id=r.id, link="/admin/referrals")
    await push(db, role="doctor", icon="🔄", title=f"إحالة بانتظار القبول — {r.patient_name}",
               body=body.reason, entity="referral", entity_id=r.id, link="/admin/referrals")
    await db.commit()
    return await _serialize(db, r)


@router.post("/{referral_id}/decide")
async def decide_referral(
    referral_id: int,
    body: DecideIn,
    payload=Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.status not in ("accepted", "rejected"):
        raise HTTPException(status_code=422, detail="حالة غير صالحة")
    res = await db.execute(select(Referral).where(Referral.id == referral_id))
    r = res.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="غير موجود")
    r.status = body.status
    r.decided_at = datetime.now(timezone.utc)
    r.decided_by = payload.get("name", "")
    if r.created_at and r.decided_at:
        r.sla_hours = round((r.decided_at - r.created_at.replace(tzinfo=timezone.utc)).total_seconds() / 3600, 1)
    r.outcome = ""  # يُعاد تعيين النتيجة عند قرار جديد
    st = "قبول" if body.status == "accepted" else "رفض"
    await record(db, actor=r.decided_by, action="decide", entity="referral",
                 entity_id=r.id, detail=f"{st} إحالة المريض: {r.patient_name}",
                 old=f"status=pending", new=f"status={body.status}")
    await db.commit()
    await push(db, role="admin", icon="✅" if body.status == "accepted" else "⛔",
               title=f"{st} إحالة — {r.patient_name}",
               body=f"قرار الجهة المستقبِلة: {r.decided_by}", entity="referral",
               entity_id=r.id, link="/admin/referrals")
    await push(db, role=await _created_by_role(db, r), icon="📨",
               title=f"عُدّلت حالة إحالتك — {r.patient_name}",
               body=st, entity="referral", entity_id=r.id, link="/portal/doctor")
    await db.commit()
    await db.refresh(r)
    return await _serialize(db, r)


@router.post("/{referral_id}/complete")
async def complete_referral(
    referral_id: int,
    body: CompleteIn,
    payload=Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """إغلاق حلقة الإحالة: تسجيل النتيجة النهائية بعد تنفيذها (status → done)."""
    res = await db.execute(select(Referral).where(Referral.id == referral_id))
    r = res.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="غير موجود")
    if r.status != "accepted":
        raise HTTPException(status_code=422, detail="لا يمكن الإغلاق إلا لإحالة مقبولة — قم بقبولها أولاً")
    r.status = "done"
    r.outcome = body.outcome or r.outcome
    r.completed_at = datetime.now(timezone.utc)
    r.decided_by = payload.get("name", "")
    await record(db, actor=payload.get("name", ""), action="complete", entity="referral",
                 entity_id=r.id, detail=f"إغلاق حلقة الإحالة: {r.patient_name} — {r.outcome[:120]}",
                 old=f"status=accepted", new=f"status=done")
    await db.commit()
    await push(db, role="admin", icon="🎯", title=f"أُنجزت الإحالة — {r.patient_name}",
               body=r.outcome, entity="referral", entity_id=r.id, link="/admin/referrals")
    await push(db, role=await _created_by_role(db, r), icon="🎯",
               title=f"اكتملت إحالتك — {r.patient_name}",
               body=r.outcome, entity="referral", entity_id=r.id, link="/portal/doctor")
    await db.commit()
    await db.refresh(r)
    return await _serialize(db, r)


# ---------- ربط المؤسسات ----------

class LinkIn(BaseModel):
    institution_a_id: int
    institution_b_id: int


@router.get("/links")
async def list_links(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(InstitutionLink).order_by(InstitutionLink.id))
    out = []
    for lk in res.scalars().all():
        a, b = await _inst(db, lk.institution_a_id), await _inst(db, lk.institution_b_id)
        out.append({"id": lk.id, "a": a, "b": b, "active": lk.active,
                    "created_at": lk.created_at.isoformat() if lk.created_at else None})
    return out


@router.post("/links", dependencies=[Depends(require_role("admin"))])
async def create_link(body: LinkIn, payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    if body.institution_a_id == body.institution_b_id:
        raise HTTPException(status_code=422, detail="لا يمكن الربط مع المؤسسة نفسها")
    res = await db.execute(select(InstitutionLink).where(
        InstitutionLink.institution_a_id == body.institution_a_id,
        InstitutionLink.institution_b_id == body.institution_b_id,
    ))
    if res.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="الربط موجود مسبقاً")
    lk = InstitutionLink(institution_a_id=body.institution_a_id, institution_b_id=body.institution_b_id)
    db.add(lk)
    await db.flush()
    a, b = await _inst(db, body.institution_a_id), await _inst(db, body.institution_b_id)
    await record(db, actor=payload.get("name", "مدير"), action="link", entity="link",
                 entity_id=lk.id,
                 detail=f"ربط مؤسستين: {a['name']} ↔ {b['name']}",
                 old=f"{a['name']} → {b['name']}" if a and b else "")
    await db.commit()
    await db.refresh(lk)
    return {"id": lk.id, "a": a, "b": b, "active": True,
            "created_at": lk.created_at.isoformat() if lk.created_at else None}


@router.delete("/links/{link_id}", dependencies=[Depends(require_role("admin"))])
async def delete_link(link_id: int, payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(InstitutionLink).where(InstitutionLink.id == link_id))
    lk = res.scalar_one_or_none()
    if not lk:
        raise HTTPException(status_code=404, detail="غير موجود")
    a, b = await _inst(db, lk.institution_a_id), await _inst(db, lk.institution_b_id)
    await db.delete(lk)
    await record(db, actor=payload.get("name", "مدير"), action="link", entity="link",
                 entity_id=link_id, detail=f"فك ربط مؤسستين: {a['name'] if a else '?'} ↔ {b['name'] if b else '?'}")
    await db.commit()
    return {"ok": True}


# ---------- Red Alert وسلامة الاستجابة (SLA) ----------

@router.get("/red-alerts")
async def red_alerts(payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    """تنبيهات حمراء معلقة — إحالات طارئة بدون قرار خلال 6 ساعات تُعلَّم بانقضاء المهلة."""
    res = await db.execute(select(Referral).where(
        Referral.severity == "red", Referral.status == "pending").order_by(Referral.created_at.asc()))
    rows = []
    now = datetime.now(timezone.utc)
    for r in res.scalars().all():
        age_h = 0
        if r.created_at:
            created = r.created_at if getattr(r.created_at, "tzinfo", None) else r.created_at.replace(tzinfo=timezone.utc)
            age_h = round((now - created).total_seconds() / 3600, 1)
        rows.append({
            "id": r.id, "patient_name": r.patient_name, "reason": r.reason,
            "medical_note": decrypt_text(r.medical_note), "created_at": r.created_at.isoformat(),
            "age_hours": age_h, "breached": age_h > 6,
            "from": await _inst(db, r.from_institution_id),
            "to": await _inst(db, r.to_institution_id),
        })
    return {"count": len(rows), "items": rows}


@router.get("/sla")
async def sla_summary(payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    """ملخص التزام الاستجابة — المتوسط، التوزيع حسب الحالة، عدد ضمن المهلة المعلنة (24س/48س)."""
    res = await db.execute(select(Referral).where(Referral.sla_hours.is_not(None)))
    rows = res.scalars().all()
    avg = round(sum(r.sla_hours or 0 for r in rows) / len(rows), 1) if rows else 0
    worst = max((r.sla_hours or 0 for r in rows), default=0)
    bins = {"<=24h": 0, "<=48h": 0, ">48h": 0, "undecided": 0}
    red_res = await db.execute(select(func.count(Referral.id)).where(
        Referral.severity == "red", Referral.status == "pending"))
    bins["undecided"] = red_res.scalar_one() or 0
    for r in rows:
        h = r.sla_hours or 0
        if h <= 24: bins["<=24h"] += 1
        elif h <= 48: bins["<=48h"] += 1
        else: bins[">48h"] += 1
    return {"count": len(rows), "avg_hours": avg, "worst_hours": worst,
            "distribution": bins,
            "note": "وقت القرار محسوب بالساعات من إنشاء الإحالة حتى البت فيها."}