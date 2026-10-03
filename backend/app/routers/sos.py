"""SOS → الحماية المدنية (API) — المرحلة 2α.

عند ضغط المستفيد زر الاستغاثة يُنشئ النظام بلاغاً منظمًا (ref) يحمل الموقع
والهاتف ونص الحماية المدنية، ويُجسد قناة == SMS عبر هاتف المستخدم
(تعمل دون إنترنت) مع سجل كمّ المرسل إليه في النظام. يوفر التتبع للمصادقة الثنائية.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..audit import record
from ..deps import current_user, get_db
from ..models import SosDispatch, User

router = APIRouter(prefix="/api/sos", tags=["sos"])

HELP_REF = "14"


def _ref() -> str:
    stamp = datetime.now(timezone.utc)
    return f"SOS-{stamp.strftime('%Y%m%d')}-{int(stamp.timestamp() % 100000):05d}"


class SosIn(BaseModel):
    patient_name: str = ""
    lat: float = Field(default=0, ge=-90, le=90)
    lng: float = Field(default=0, ge=-180, le=180)
    detail: str = ""
    channel: str = "both"   # sms | api | both


@router.post("/relay")
async def sos_relay(body: SosIn, payload=Depends(current_user),
                    db: AsyncSession = Depends(get_db)):
    ref = _ref()
    channel_label = {"sms": "SMS عبر هاتف المستفيد", "api": "API الحماية المدنية",
                     "both": "SMS + API"}.get(body.channel, body.channel)
    txt = (
        f"🚨 بلاغ {ref} من «رعايتي DZ» — الحماية المدنية {HELP_REF}.\n"
        f"المستفيد: {body.patient_name or payload.get('name', 'مستفيد')}.\n"
        + (f"الموقع: https://maps.google.com/?q={body.lat:.5f},{body.lng:.5f}\n" if (body.lat or body.lng) else "بدون تحديد موقع (فعّل GPS).\n")
        + f"القناة: {channel_label}"
    )
    d = SosDispatch(ref=ref, patient_name=body.patient_name or payload.get("name", ""),
                    phone=payload.get("phone", ""), lat=body.lat, lng=body.lng,
                    detail=body.detail, channel=body.channel, status="fired")
    db.add(d)
    await db.flush()
    await record(db, actor=payload.get("name", ""), action="create", entity="sos_dispatch",
                 entity_id=d.id, detail=f"بلاغ {ref} — {d.patient_name}")
    await db.commit()
    return {"ref": ref, "sms_text": txt, "signal": {"sms_to_help_ref": HELP_REF,
            "civil_protection": "https://pom.dz", "channel": body.channel},
            "status": "fired", "created_at": d.created_at.isoformat() if d.created_at else None}


class ResolveIn(BaseModel):
    status: str = "enroute"


@router.get("/dispatches")
async def list_dispatches(payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(SosDispatch).order_by(SosDispatch.created_at.desc()).limit(100))
    out = []
    for d in res.scalars().all():
        out.append({
            "id": d.id, "ref": d.ref, "patient_name": d.patient_name, "phone": d.phone,
            "lat": d.lat, "lng": d.lng, "detail": d.detail, "channel": d.channel,
            "status": d.status, "resolved_by": d.resolved_by,
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "maps": f"https://maps.google.com/?q={d.lat:.5f},{d.lng:.5f}" if (d.lat or d.lng) else "",
        })
    return out


@router.post("/dispatches/{did}/status")
async def set_dispatch_status(did: int, body: ResolveIn, payload=Depends(current_user),
                              db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(SosDispatch).where(SosDispatch.id == did))
    d = res.scalar_one_or_none()
    if not d:
        raise HTTPException(status_code=404, detail="بلاغ غير موجود")
    d.status = body.status
    if body.status == "resolved":
        d.resolved_by = payload.get("name", "")
        d.resolved_at = datetime.now(timezone.utc)
    await record(db, actor=payload.get("name", ""), action="update", entity="sos_dispatch",
                 entity_id=d.id, detail=f"بلاغ {d.ref} → {d.status}")
    await db.commit()
    return {"id": d.id, "status": d.status, "resolved_by": d.resolved_by}