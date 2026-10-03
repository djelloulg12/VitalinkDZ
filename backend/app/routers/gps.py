from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_db
from ..models import Association, Institution, StaffMember, Wilaya

router = APIRouter(prefix="/api/gps", tags=["gps"])


async def _wil(dir1: int | None, db: AsyncSession) -> Wilaya | None:
    if dir1 is None:
        return None
    res = await db.execute(select(Wilaya).where(Wilaya.code == dir1))
    return res.scalar_one_or_none()


@router.get("/locations")
async def gps_locations(db: AsyncSession = Depends(get_db)):
    staff = []
    res = await db.execute(select(StaffMember).where(StaffMember.active.is_(True)))
    for s in res.scalars().all():
        w = await _wil(s.wilaya_id, db)
        if not w:
            continue
        staff.append({
            "kind": s.kind, "name": s.full_name, "specialty": s.specialty,
            "lat": w.lat, "lng": w.lng, "region": w.name_ar,
        })

    units = []
    res = await db.execute(select(Institution))
    for i in res.scalars().all():
        w = await _wil(i.wilaya_id, db)
        units.append({
            "type": i.type, "name": i.name, "city": i.city,
            "lat": i.lat or (w.lat if w else 0), "lng": i.lng or (w.lng if w else 0),
            "region": (w.name_ar if w else i.city), "phone": i.phone,
        })

    assocs = []
    res = await db.execute(select(Association))
    for a in res.scalars().all():
        w = await _wil(a.wilaya_id, db)
        assocs.append({
            "name": a.name, "points": a.points, "stars": a.stars,
            "lat": w.lat if w else 0, "lng": w.lng if w else 0,
            "region": w.name_ar if w else "",
        })

    return {"staff": staff, "units": units, "associations": assocs}