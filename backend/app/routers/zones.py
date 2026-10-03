"""Geofencing — أسوار جغرافية حول الوحدات المتنقلة والحمامات، مع فحص موقع الممرض."""

from __future__ import annotations

import math

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..audit import record
from ..deps import current_user, get_db
from ..models import GeoZone, ThermalStation

router = APIRouter(prefix="/api/zones", tags=["zones"])


def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    a = math.sin(math.radians(lat2 - lat1) / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(
        math.radians(lat2)) * math.sin(math.radians(lng2 - lng1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


class ZoneIn(BaseModel):
    name: str
    wilaya_code: int | None = None
    lat: float
    lng: float
    radius_km: float = 10
    enabled: bool = True


async def _ser(z: GeoZone) -> dict:
    return {"id": z.id, "name": z.name, "wilaya_code": z.wilaya_code, "lat": z.lat,
            "lng": z.lng, "radius_km": z.radius_km, "enabled": z.enabled}


@router.get("")
async def list_zones(db: AsyncSession = Depends(get_db), payload=Depends(current_user)):
    if payload.get("role") not in ("admin", "doctor", "nurse"):
        return []
    res = await db.execute(select(GeoZone).order_by(GeoZone.id))
    return [await _ser(z) for z in res.scalars().all()]


@router.post("")
async def create_zone(body: ZoneIn, payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="المدير فقط")
    z = GeoZone(**body.model_dump())
    db.add(z)
    await db.flush()
    await record(db, actor=payload.get("name", ""), action="create", entity="zone",
                 entity_id=z.id, detail=f"سور جغرافي جديد: {z.name} (نصف قطر {z.radius_km} كم)")
    await db.commit()
    await db.refresh(z)
    return await _ser(z)


@router.put("/{zone_id}")
async def update_zone(zone_id: int, body: ZoneIn, payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="المدير فقط")
    res = await db.execute(select(GeoZone).where(GeoZone.id == zone_id))
    z = res.scalar_one_or_none()
    if not z:
        raise HTTPException(status_code=404, detail="غير موجود")
    for k, v in body.model_dump().items():
        setattr(z, k, v)
    await record(db, actor=payload.get("name", ""), action="update", entity="zone",
                 entity_id=zone_id, detail=f"تعديل السور: {z.name}")
    await db.commit()
    await db.refresh(z)
    return await _ser(z)


@router.delete("/{zone_id}")
async def delete_zone(zone_id: int, payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="المدير فقط")
    res = await db.execute(select(GeoZone).where(GeoZone.id == zone_id))
    z = res.scalar_one_or_none()
    if not z:
        raise HTTPException(status_code=404, detail="غير موجود")
    await db.delete(z)
    await record(db, actor=payload.get("name", ""), action="delete", entity="zone",
                 entity_id=zone_id, detail="حذف سور جغرافي")
    await db.commit()
    return {"ok": True}


@router.post("/check")
async def check_point(lat: float, lng: float, db: AsyncSession = Depends(get_db), payload=Depends(current_user)):
    """فحص موقع — هل النقطة داخل أي سور؟ (تنبيه Geofencing للممرض المتنقل)."""
    res = await db.execute(select(GeoZone).where(GeoZone.enabled == True))  # noqa: E712
    zones = res.scalars().all()
    inside = []
    for z in zones:
        d = haversine(lat, lng, z.lat, z.lng)
        state = "inside" if d <= z.radius_km else "outside"
        inside.append({"zone_id": z.id, "name": z.name, "distance_km": round(d, 2),
                       "radius_km": z.radius_km, "state": state})
    inside_any = any(x["state"] == "inside" for x in inside)
    await record(db, actor=payload.get("name", ""), action="gps", entity="zone",
                 entity_id=0, detail=f"فحص جغرافي ({lat:.4f},{lng:.4f}) → {'داخل' if inside_any else 'خارج الأسوار'}")
    await db.commit()
    return {"inside_any": inside_any, "zones": inside}


@router.get("/stations")
async def zone_stations(db: AsyncSession = Depends(get_db), payload=Depends(current_user)):
    """كل الحمّامات المعدنية مع إحداثياتها (يرسمها تطبيق Vital DZ على الخريطة)."""
    res = await db.execute(select(ThermalStation, GeoZone).join(GeoZone,
        ThermalStation.wilaya_id == GeoZone.wilaya_code, isouter=True))
    out = []
    for st, z in res.all():
        out.append({"id": st.id, "name": st.name, "lat": st.lat, "lng": st.lng,
                    "water_temp": st.water_temp, "treatments": st.treatments,
                    "rating_avg": st.rating_avg,
                    "zone": (z.name + f" ({z.radius_km} كم)" if z else None)})
    return out