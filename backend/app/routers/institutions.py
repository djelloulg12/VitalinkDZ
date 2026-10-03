from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_db
from ..models import Institution, Wilaya

router = APIRouter(prefix="/api/institutions", tags=["institutions"])


@router.get("")
async def list_institutions(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Institution).order_by(Institution.name))
    out = []
    for i in res.scalars().all():
        wil = None
        if i.wilaya_id:
            r = await db.execute(select(Wilaya).where(Wilaya.code == i.wilaya_id))
            w = r.scalar_one_or_none()
            wil = (w.name_ar if w else None)
        out.append({
            "id": i.id, "name": i.name, "type": i.type, "city": i.city,
            "wilaya_id": i.wilaya_id, "wilaya_ar": wil, "phone": i.phone, "refers": i.refers,
        })
    return out