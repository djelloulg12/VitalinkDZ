from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_db
from ..models import Wilaya

router = APIRouter(prefix="/api/wilayas", tags=["wilayas"])


@router.get("")
async def list_wilayas(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Wilaya).order_by(Wilaya.code))
    return [
        {"code": w.code, "name_ar": w.name_ar, "name_fr": w.name_fr,
         "lat": w.lat, "lng": w.lng}
        for w in res.scalars().all()
    ]