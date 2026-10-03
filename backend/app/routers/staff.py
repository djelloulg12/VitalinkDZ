from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..audit import record
from ..deps import current_user, get_db, require_role
from ..models import Institution, StaffMember, Wilaya

router = APIRouter(prefix="/api/staff", tags=["staff"])

admin_only = require_role("admin")


class StaffIn(BaseModel):
    full_name: str
    kind: str
    specialty: str = ""
    institution_id: Optional[int] = None
    wilaya_id: Optional[int] = None
    phone: str = ""
    patients_count: int = 0
    active: bool = True
    license_doc: str = ""


async def _serialize(db: AsyncSession, s: StaffMember) -> dict:
    inst = None
    if s.institution_id:
        res = await db.execute(select(Institution).where(Institution.id == s.institution_id))
        inst = res.scalar_one_or_none()
    wil = None
    if s.wilaya_id:
        res = await db.execute(select(Wilaya).where(Wilaya.code == s.wilaya_id))
        wil = res.scalar_one_or_none()
    return {
        "id": s.id, "full_name": s.full_name, "kind": s.kind, "specialty": s.specialty,
        "institution_id": s.institution_id,
        "institution_name": inst.name if inst else None,
        "wilaya_id": s.wilaya_id,
        "wilaya_ar": wil.name_ar if wil else None,
        "wilaya_fr": wil.name_fr if wil else None,
        "phone": s.phone, "patients_count": s.patients_count,
        "active": s.active, "created_at": s.created_at.isoformat() if s.created_at else None,
        "license_doc": s.license_doc,
        "license_status": s.license_status,
        "verified_by": s.verified_by,
        "verified_at": s.verified_at.isoformat() if s.verified_at else None,
    }


@router.get("")
async def list_staff(db: AsyncSession = Depends(get_db), payload=Depends(current_user)):
    res = await db.execute(select(StaffMember).order_by(StaffMember.created_at.desc()))
    rows = [await _serialize(db, s) for s in res.scalars().all()]
    if rows:
        await record(db, actor=payload.get("name", ""), action="view", entity="staff",
                     entity_id=0, detail=f"عرض سجل الكوادر — {len(rows)} متعاقد")
        await db.commit()
    return rows


@router.post("", dependencies=[Depends(admin_only)])
async def create_staff(body: StaffIn, payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    s = StaffMember(**body.model_dump())
    db.add(s)
    await db.flush()
    await record(db, actor=payload.get("name", "مدير"), action="create", entity="staff",
                 entity_id=s.id, detail=f"إضافة {'طبيب' if s.kind == 'doctor' else 'ممرض'} متعاقد: {s.full_name}",
                 new=s.full_name)
    await db.commit()
    await db.refresh(s)
    return await _serialize(db, s)


@router.put("/{staff_id}", dependencies=[Depends(admin_only)])
async def update_staff(staff_id: int, body: StaffIn, payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(StaffMember).where(StaffMember.id == staff_id))
    s = res.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="غير موجود")
    old = s.full_name
    for k, v in body.model_dump().items():
        setattr(s, k, v)
    await record(db, actor=payload.get("name", "مدير"), action="update", entity="staff",
                 entity_id=s.id, detail=f"تعديل بيانات المتعاقد: {s.full_name}", old=old, new=s.full_name)
    await db.commit()
    await db.refresh(s)
    return await _serialize(db, s)


@router.delete("/{staff_id}", dependencies=[Depends(admin_only)])
async def delete_staff(staff_id: int, payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(StaffMember).where(StaffMember.id == staff_id))
    s = res.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="غير موجود")
    name = s.full_name
    await db.delete(s)
    await record(db, actor=payload.get("name", "مدير"), action="delete", entity="staff",
                 entity_id=staff_id, detail=f"حذف المتعاقد: {name}", old=name)
    await db.commit()
    return {"ok": True}


# ---------- التحقق من رخصة الممارسة / بطاقة التعريف ----------

class VerifyIn(BaseModel):
    license_status: str  # verified | rejected


@router.post("/{staff_id}/verify", dependencies=[Depends(admin_only)])
async def verify_license(staff_id: int, body: VerifyIn, payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    """تدقيق ترخيص الممارسة الصحية (قانون 18-07): يعيّن المدير الوطني حالته برمز موثّق."""
    if body.license_status not in ("verified", "rejected"):
        raise HTTPException(status_code=422, detail="حالة غير صالحة")
    res = await db.execute(select(StaffMember).where(StaffMember.id == staff_id))
    s = res.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="غير موجود")
    old = s.license_status
    s.license_status = body.license_status
    s.verified_by = payload.get("name", "المدير الوطني")
    s.verified_at = datetime.now(timezone.utc)
    status_str = "معتمَد" if body.license_status == "verified" else "مرفوض"
    await record(db, actor=payload.get("name", "المدير الوطني"), action="verify", entity="staff",
                 entity_id=s.id,
                 detail=f"تحقق من ترخيص الممارسة: {s.full_name} → {status_str}",
                 old=f"license={old}", new=f"license={body.license_status}")
    await db.commit()
    await db.refresh(s)
    return await _serialize(db, s)