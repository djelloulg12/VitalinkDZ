"""تطبيق الرفيق — نبض الحضور (Presence heartbeat).

تطبيق الهاتف (Vital DZ / رعايتي) يرسل موقعه كل 60 ثانية عبر POST /api/presence
ويستعلم آخر حضوره عبر GET /api/presence. بهذا تبقى المنصة «متصلة دائمًا»
مع المستفيد، ويتوفر موقعه الحالي لحظة الطوارئ.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import current_user, get_db
from ..models import Presence, User

router = APIRouter(prefix="/api/presence", tags=["presence"])

ONLINE_WINDOW = 5 * 60  # 5 دقائق = «على الخط»


def _seen(dt: datetime | None) -> str:
    return dt.isoformat() if dt else ""


class PresenceIn(BaseModel):
    device: str = "vitaldz-web"
    app: str = "web"            # vitaldz | android | ios | web
    patient_name: str = ""
    role: str = ""
    lat: float = Field(default=0, ge=-90, le=90)
    lng: float = Field(default=0, ge=-180, le=180)
    acc: float = Field(default=0, ge=0)


@router.post("")
async def send_presence(body: PresenceIn, payload=Depends(current_user),
                        db: AsyncSession = Depends(get_db)):
    if not body.device or len(body.device) > 160:
        body.device = "vitaldz-device-" + str(int(payload.get("sub", 0)))
    res = await db.execute(select(Presence).where(Presence.device == body.device))
    row = res.scalar_one_or_none()
    if row is None:
        row = Presence(device=body.device)
        db.add(row)
    row.app = body.app or "web"
    row.patient_name = body.patient_name or payload.get("name", "")
    row.role = body.role or payload.get("role", "")
    row.lat = body.lat
    row.lng = body.lng
    row.acc = body.acc
    row.online = True
    row.seen_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True, "device": row.device, "seen_at": _seen(row.seen_at)}


@router.get("")
async def list_presence(payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    now = datetime.utcnow()
    res = await db.execute(select(Presence).order_by(Presence.seen_at.desc()).limit(200))
    rows = []
    online = 0
    for p in res.scalars().all():
        if p.seen_at is not None and p.seen_at.tzinfo is not None:
            p.seen_at = p.seen_at.replace(tzinfo=None)
        alive = p.seen_at is not None and (now - p.seen_at).total_seconds() <= ONLINE_WINDOW
        if alive:
            online += 1
        rows.append({
            "id": p.id, "device": p.device, "app": p.app, "patient_name": p.patient_name,
            "role": p.role, "lat": p.lat, "lng": p.lng, "acc": p.acc,
            "online": alive and p.online,
            "seen_at": _seen(p.seen_at),
            "maps": f"https://maps.google.com/?q={p.lat:.5f},{p.lng:.5f}" if (p.lat or p.lng) else "",
        })
    return {"online": online, "total": len(rows), "devices": rows}