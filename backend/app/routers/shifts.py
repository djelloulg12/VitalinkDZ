"""إدارة نوبات العمل — تقديم الزمن الطبي والحضور."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..audit import record
from ..deps import current_user, get_db
from ..models import DutyShift, StaffMember

router = APIRouter(prefix="/api/shifts", tags=["shifts"])

SHIFTS = {"morning": "صباحية", "evening": "مسائية", "night": "ليلية"}


class ShiftIn(BaseModel):
    staff_id: int
    date: str
    shift: str = "morning"
    unit: str = ""
    note: str = ""


async def _ser(s: DutyShift, staff: StaffMember | None) -> dict:
    return {
        "id": s.id, "staff_id": s.staff_id, "date": s.date, "shift": s.shift,
        "shift_label": SHIFTS.get(s.shift, s.shift), "unit": s.unit, "note": s.note,
        "staff_name": staff.full_name if staff else "—",
        "staff_kind": staff.kind if staff else "",
    }


async def _row(db: AsyncSession, s: DutyShift) -> dict:
    res = await db.execute(select(StaffMember).where(StaffMember.id == s.staff_id))
    return await _ser(s, res.scalar_one_or_none())


@router.get("")
async def list_shifts(date: str = "", db: AsyncSession = Depends(get_db), payload=Depends(current_user)):
    if payload.get("role") not in ("admin", "doctor", "nurse"):
        return []
    q = select(DutyShift).order_by(DutyShift.date.desc(), DutyShift.shift)
    if date:
        q = q.where(DutyShift.date == date)
    res = await db.execute(q)
    return [await _row(db, s) for s in res.scalars().all()]


@router.post("")
async def create_shift(body: ShiftIn, payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="المدير فقط")
    s = DutyShift(**body.model_dump())
    db.add(s)
    await db.flush()
    await record(db, actor=payload.get("name", ""), action="create", entity="shift",
                 entity_id=s.id,
                 detail=f"نوبة جديدة: {s.date} ({SHIFTS.get(s.shift, s.shift)}) — {s.unit}")
    await db.commit()
    await db.refresh(s)
    return await _row(db, s)


@router.delete("/{shift_id}")
async def delete_shift(shift_id: int, payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="المدير فقط")
    res = await db.execute(select(DutyShift).where(DutyShift.id == shift_id))
    s = res.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="غير موجود")
    await db.delete(s)
    await record(db, actor=payload.get("name", ""), action="delete", entity="shift",
                 entity_id=shift_id, detail="حذف نوبة عمل")
    await db.commit()
    return {"ok": True}


@router.get("/weekly")
async def weekly_summary(db: AsyncSession = Depends(get_db), payload=Depends(current_user)):
    if payload.get("role") not in ("admin", "doctor", "nurse"):
        return {"days": []}
    res = await db.execute(
        select(DutyShift.date, func.count(DutyShift.id))
        .group_by(DutyShift.date).order_by(DutyShift.date.desc()).limit(14)
    )
    return {"days": [{"date": d, "count": c} for d, c in res.all()]}