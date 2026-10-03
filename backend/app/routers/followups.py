"""ملف المتابعة والتطورات — سجل طبي موحد (Offline-First: push/pull sync)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..audit import record
from ..crypto import decrypt_json, decrypt_text, encrypt_json, encrypt_text
from ..deps import current_user, get_db
from ..models import FollowupRecord
from .predict import analyze_and_persist

router = APIRouter(prefix="/api/followups", tags=["followups"])

ALLOWED = ("admin", "doctor", "nurse")

KINDS = {
    "consultation": "معاينة طبية",
    "nursing": "تدوين تمريضي",
    "vitals": "مؤشرات حيوية",
    "medication": "وصفة / أدوية",
}


class FollowupIn(BaseModel):
    patient_name: str
    referral_id: Optional[int] = None
    kind: str = "consultation"
    date: str = ""
    summary: str = ""
    subjective: str = ""
    objective: str = ""
    vitals: dict = {}
    medications: list[str] = []
    attachments: list[dict] = []
    device_id: str = ""


def _vitals(v: dict) -> dict:
    return {k: (v.get(k) if k in v else None) for k in ("pulse", "bpSys", "bpDia", "temp", "spO2", "sugar")}


async def _ser(f: FollowupRecord) -> dict:
    try:
        vitals = decrypt_json(f.vitals_json)
    except Exception:
        vitals = {}
    try:
        meds = decrypt_json(f.medications_json)
    except Exception:
        meds = []
    try:
        atts = decrypt_json(f.attachments_json)
    except Exception:
        atts = []
    return {
        "id": f.id, "patient_name": f.patient_name, "referral_id": f.referral_id,
        "kind": f.kind, "kind_label": KINDS.get(f.kind, f.kind),
        "date": f.date, "author": f.author, "summary": decrypt_text(f.summary),
        "subjective": decrypt_text(f.subjective), "objective": decrypt_text(f.objective),
        "vitals": vitals, "medications": meds, "attachments": atts,
        "signed_by": f.signed_by,
        "signed_at": f.signed_at.isoformat() if f.signed_at else None,
        "created_at": f.created_at.isoformat() if f.created_at else None,
        "updated_at": f.updated_at.isoformat() if f.updated_at else None,
    }


@router.get("")
async def list_followups(patient: str = "", db: AsyncSession = Depends(get_db), payload=Depends(current_user)):
    if payload.get("role") not in ALLOWED:
        return []
    q = select(FollowupRecord).order_by(FollowupRecord.date.desc(), FollowupRecord.id.desc())
    if patient:
        q = q.where(or_(FollowupRecord.patient_name.ilike(f"%{patient.strip()}%"),
                        FollowupRecord.summary.ilike(f"%{patient.strip()}%")))
    res = await db.execute(q)
    rows = [await _ser(f) for f in res.scalars().all()]
    if rows and payload.get("role") != "nurse":
        await record(db, actor=payload.get("name", ""), action="view", entity="followup",
                     entity_id=0, detail=f"عرض ملف المتابعة — {len(rows)} سجل ({patient or 'الكل'})")
        await db.commit()
    return rows


async def _save(db: AsyncSession, f: FollowupRecord, body: FollowupIn, author: str):
    f.patient_name = body.patient_name
    f.referral_id = body.referral_id
    f.kind = body.kind
    f.date = body.date
    f.author = author
    f.summary = encrypt_text(body.summary)
    f.subjective = encrypt_text(body.subjective)
    f.objective = encrypt_text(body.objective)
    f.vitals_json = encrypt_json(_vitals(body.vitals))
    f.medications_json = encrypt_json(body.medications)
    f.attachments_json = encrypt_json(body.attachments)
    if body.device_id:
        f.device_id = body.device_id
    if not f.signed_by:
        f.signed_by = author
        f.signed_at = datetime.now(timezone.utc)


@router.post("")
async def create_followup(body: FollowupIn, payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    if payload.get("role") not in ALLOWED:
        raise HTTPException(status_code=403, detail="غير مصرح لهذا الدور")
    f = FollowupRecord()
    await _save(db, f, body, payload.get("name", ""))
    db.add(f)
    await db.flush()
    fn = f.patient_name
    alerts = await analyze_and_persist(db, fn, _vitals(body.vitals), f.id)
    await record(db, actor=payload.get("name", ""), action="create", entity="followup",
                 entity_id=f.id,
                 detail=f"تسجيل سجل متابعة ({KINDS.get(f.kind, f.kind)}) للمريض: {fn}"
                        + (f" + {len(alerts)} إنذار تنبؤي" if alerts else ""),
                 new=f.summary[:80])
    await db.commit()
    await db.refresh(f)
    ser = await _ser(f)
    if alerts:
        ser["alerts"] = [{"level": a.level, "metric": a.metric, "value": a.value,
                          "message": a.message, "id": a.id} for a in alerts]
    return ser


@router.put("/{rec_id}")
async def update_followup(rec_id: int, body: FollowupIn, payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    if payload.get("role") not in ALLOWED:
        raise HTTPException(status_code=403, detail="غير مصرح لهذا الدور")
    res = await db.execute(select(FollowupRecord).where(FollowupRecord.id == rec_id))
    f = res.scalar_one_or_none()
    if not f:
        raise HTTPException(status_code=404, detail="غير موجود")
    old = f.summary[:80]
    await _save(db, f, body, payload.get("name", ""))
    await record(db, actor=payload.get("name", ""), action="update", entity="followup",
                 entity_id=f.id,
                 detail=f"تعديل سجل المتابعة: {f.patient_name}", old=old, new=f.summary[:80])
    await db.commit()
    await db.refresh(f)
    return await _ser(f)


@router.delete("/{rec_id}")
async def delete_followup(rec_id: int, payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    if payload.get("role") not in ALLOWED:
        raise HTTPException(status_code=403, detail="غير مصرح لهذا الدور")
    res = await db.execute(select(FollowupRecord).where(FollowupRecord.id == rec_id))
    f = res.scalar_one_or_none()
    if not f:
        raise HTTPException(status_code=404, detail="غير موجود")
    name = f.patient_name
    await db.delete(f)
    await record(db, actor=payload.get("name", ""), action="delete", entity="followup",
                 entity_id=rec_id, detail=f"حذف سجل متابعة: {name}")
    await db.commit()
    return {"ok": True}


# =================  مزامنة Offline-First =================

@router.get("/sync/pull")
async def pull_since(since: str = "", db: AsyncSession = Depends(get_db), payload=Depends(current_user)):
    if payload.get("role") not in ALLOWED:
        return {"since": since, "rows": []}
    q = select(FollowupRecord)
    if since:
        try:
            since_dt = datetime.fromisoformat(since)
        except Exception:
            since_dt = None
        if since_dt:
            q = q.where(FollowupRecord.updated_at > since_dt)
    res = await db.execute(q.order_by(FollowupRecord.updated_at))
    rows = [await _ser(f) for f in res.scalars().all()]
    return {"since": datetime.now(timezone.utc).isoformat(), "rows": rows, "offline": False}


class SyncOp(BaseModel):
    op: str = "create"          # create | update
    id: Optional[int] = None    # لمعدّل
    payload: dict = {}


class SyncPush(BaseModel):
    device: str = ""
    ops: list[SyncOp] = []


@router.post("/sync/push")
async def push_ops(body: SyncPush, payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    if payload.get("role") not in ALLOWED:
        raise HTTPException(status_code=403, detail="غير مصرح لهذا الدور")
    applied, errors = 0, 0
    for op in body.ops:
        try:
            fin = FollowupIn(**op.payload)
            if op.op == "update" and op.id:
                res = await db.execute(select(FollowupRecord).where(FollowupRecord.id == op.id))
                f = res.scalar_one_or_none()
                if not f:
                    continue
                await _save(db, f, fin, payload.get("name", ""))
            else:
                f = FollowupRecord(device_id=body.device or "offline")
                await _save(db, f, fin, payload.get("name", ""))
                db.add(f)
                await db.flush()
            await analyze_and_persist(db, fin.patient_name, _vitals(fin.vitals), f.id)
            applied += 1
        except Exception:
            errors += 1
    if applied:
        await db.commit()
    return {"applied": applied, "errors": errors}