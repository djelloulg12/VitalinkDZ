from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..audit import record
from ..deps import get_db, current_user
from ..models import Association, AssociationEvaluation, Wilaya
from ..seed import points_formula, stars_from_points

router = APIRouter(prefix="/api/associations", tags=["associations"])

REWARD_TIERS = [
    {"min": 90, "badge": "منقذ ذهبي", "reward": "دعم مالي سنوي + تغطية إعلامية وطنية"},
    {"min": 70, "badge": "شريك ميداني مميز", "reward": "حصة أدوات طبية متنقلة"},
    {"min": 50, "badge": "جمعية فاعلة", "reward": "شهادة تكريم + ربط وثيق بالمؤسسات الصحية"},
    {"min": 30, "badge": "جمعية نامية", "reward": "ورشات تدريبية للفرق"},
    {"min": 0, "badge": "جمعية ناشئة", "reward": "إرشاد وتأطير أولي"},
]


def reward_tier(points: int) -> dict:
    for t in REWARD_TIERS:
        if points >= t["min"]:
            return {"badge": t["badge"], "reward": t["reward"]}
    return {"badge": "—", "reward": "—"}


class EvalIn(BaseModel):
    visits: Optional[int] = None
    volunteers: Optional[int] = None
    activities: Optional[int] = None
    impact: int = 0
    notes: str = ""


async def _serialize(db: AsyncSession, a: Association) -> dict:
    wil = None
    if a.wilaya_id:
        res = await db.execute(select(Wilaya).where(Wilaya.code == a.wilaya_id))
        w = res.scalar_one_or_none()
        wil = (w.name_ar if w else None, w.name_fr if w else None)
    return {
        "id": a.id, "name": a.name, "wilaya_id": a.wilaya_id,
        "wilaya_ar": wil[0] if wil else None, "wilaya_fr": wil[1] if wil else None,
        "volunteers": a.volunteers, "visits": a.visits, "activities": a.activities,
        "points": a.points, "stars": a.stars,
        "reward": reward_tier(a.points),
        "last_evaluated_at": a.last_evaluated_at.isoformat() if a.last_evaluated_at else None,
    }


@router.get("/public")
async def public_register(db: AsyncSession = Depends(get_db)):
    """لوحة الشفافية العامة — بيّنات قابلة للعموم بدون بيانات حساسة."""
    res = await db.execute(select(Association).order_by(Association.points.desc()))
    out = []
    for a in res.scalars().all():
        wil = None
        if a.wilaya_id:
            w = (await db.execute(select(Wilaya).where(Wilaya.code == a.wilaya_id))).scalar_one_or_none()
            wil = w.name_ar if w else None
        out.append({"id": a.id, "name": a.name, "wilaya_ar": wil,
                    "volunteers": a.volunteers, "visits": a.visits,
                    "activities": a.activities, "points": a.points, "stars": a.stars,
                    **reward_tier(a.points)})
    return {"tiers": REWARD_TIERS, "associations": out}


@router.get("")
async def list_associations(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Association).order_by(Association.points.desc()))
    return [await _serialize(db, a) for a in res.scalars().all()]


@router.post("/{assoc_id}/evaluate")
async def evaluate_association(
    assoc_id: int,
    body: EvalIn,
    payload=Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Association).where(Association.id == assoc_id))
    a = res.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="غير موجود")

    visits = body.visits if body.visits is not None else a.visits
    volunteers = body.volunteers if body.volunteers is not None else a.volunteers
    activities = body.activities if body.activities is not None else a.activities
    impact = body.impact

    a.visits, a.volunteers, a.activities = visits, volunteers, activities
    a.points = points_formula(visits, volunteers, activities, impact)
    a.stars = stars_from_points(a.points)
    a.last_evaluated_at = datetime.now(timezone.utc)

    actor = payload.get("name", "")
    db.add(AssociationEvaluation(
        association_id=a.id, field_visits=visits, coverage=activities,
        impact=impact, notes=body.notes, by_user=actor,
    ))
    old = (a.points, a.stars)
    await record(db, actor=actor, action="evaluate", entity="association",
                 entity_id=a.id,
                 detail=f"تقييم أداء الجمعية: {a.name} — {a.points} نقطة",
                 old=f"{old[0]} نقطة / ★{old[1]}", new=f"{a.points} نقطة / ★{a.stars}")
    await db.commit()
    await db.refresh(a)
    return await _serialize(db, a)