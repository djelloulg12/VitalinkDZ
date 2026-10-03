"""بوابة وكالات السياحة والأسفار — معلومات الوكالة / الأسطول / المرشدون / الحزم + ربط الإحالات."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..audit import record
from ..crypto import decrypt_text, encrypt_text
from ..deps import current_user, get_db
from ..models import AgencyProfile, FleetVehicle, HealthPackage, Referral, Review, TourGuide, User

router = APIRouter(prefix="/api/agencies", tags=["agencies"])


class ProfileIn(BaseModel):
    name: str
    license_no: str = ""
    wilaya_id: int | None = None
    city: str = ""
    phone: str = ""
    desc: str = ""


async def _profile(db: AsyncSession, a: AgencyProfile) -> dict:
    res = await db.execute(select(FleetVehicle).where(FleetVehicle.agency_id == a.id))
    fleet = [{**{"id": v.id, "kind": v.kind, "plate": v.plate, "seats": v.seats,
                 "medical": v.medical, "active": v.active}} for v in res.scalars().all()]
    res = await db.execute(select(TourGuide).where(TourGuide.agency_id == a.id))
    guides = [{"id": g.id, "name": g.name, "langs": g.langs, "phone": g.phone, "license": g.license}
              for g in res.scalars().all()]
    res = await db.execute(select(HealthPackage).where(HealthPackage.agency_id == a.id))
    packs = [{"id": p.id, "title": p.title, "destination": p.destination, "nights": p.nights,
              "price": p.price, "includes": p.includes, "treatments": p.treatments,
              "station_id": p.station_id} for p in res.scalars().all()]
    return {"id": a.id, "name": a.name, "license_no": a.license_no, "wilaya_id": a.wilaya_id,
            "city": a.city, "phone": a.phone, "desc": a.desc,
            "fleet": fleet, "guides": guides, "packages": packs}


@router.get("")
async def list_agencies(db: AsyncSession = Depends(get_db), payload=Depends(current_user)):
    res = await db.execute(select(AgencyProfile))
    return [await _profile(db, a) for a in res.scalars().all()]


@router.get("/{agency_id}")
async def get_agency(agency_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(AgencyProfile).where(AgencyProfile.id == agency_id))
    a = res.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="غير موجودة")
    return await _profile(db, a)


@router.put("/{agency_id}")
async def update_profile(agency_id: int, body: ProfileIn, payload=Depends(current_user),
                         db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(AgencyProfile).where(AgencyProfile.id == agency_id))
    a = res.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="غير موجودة")
    if payload.get("role") not in ("admin", "agency") and a.user_id != payload.get("uid"):
        raise HTTPException(status_code=403, detail="ليست وكالتك")
    old = a.name
    for k, v in body.model_dump().items():
        setattr(a, k, v)
    await record(db, actor=payload.get("name", ""), action="update", entity="agency",
                 entity_id=a.id, detail=f"تحديث معلومات الوكالة: {old}", new=a.name)
    await db.commit()
    await db.refresh(a)
    return await _profile(db, a)


# ---------- الأسطول ----------

class FleetIn(BaseModel):
    kind: str = "ambulance"
    plate: str = ""
    seats: int = 4
    medical: bool = True
    active: bool = True


@router.post("/{agency_id}/fleet")
async def add_vehicle(agency_id: int, body: FleetIn, payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    if payload.get("role") not in ("admin", "agency"):
        raise HTTPException(status_code=403, detail="غير مصرح")
    v = FleetVehicle(agency_id=agency_id, **body.model_dump())
    db.add(v)
    await db.flush()
    await record(db, actor=payload.get("name", ""), action="create", entity="fleet",
                 entity_id=v.id, detail=f"إضافة وسيلة أسطول (رقم: {v.plate})")
    await db.commit()
    return {"ok": True, "id": v.id}


# ---------- المرشدون ----------

class GuideIn(BaseModel):
    name: str
    langs: str = ""
    phone: str = ""
    license: str = ""


@router.post("/{agency_id}/guides")
async def add_guide(agency_id: int, body: GuideIn, payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    if payload.get("role") not in ("admin", "agency"):
        raise HTTPException(status_code=403, detail="غير مصرح")
    g = TourGuide(agency_id=agency_id, **body.model_dump())
    db.add(g)
    await db.flush()
    await record(db, actor=payload.get("name", ""), action="create", entity="guide",
                 entity_id=g.id, detail=f"إضافة مرشد: {g.name}")
    await db.commit()
    return {"ok": True, "id": g.id}


# ---------- الحزم ----------

class PackageIn(BaseModel):
    title: str
    destination: str = ""
    nights: int = 7
    price: float = 0
    includes: str = ""
    treatments: str = ""
    station_id: int | None = None


@router.post("/{agency_id}/packages")
async def add_package(agency_id: int, body: PackageIn, payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    if payload.get("role") not in ("admin", "agency"):
        raise HTTPException(status_code=403, detail="غير مصرح")
    p = HealthPackage(agency_id=agency_id, **body.model_dump())
    db.add(p)
    await db.flush()
    await record(db, actor=payload.get("name", ""), action="create", entity="package",
                 entity_id=p.id, detail=f"حزمة جديدة: {p.title}")
    await db.commit()
    return {"ok": True, "id": p.id}


@router.delete("/packages/{pkg_id}")
async def delete_package(pkg_id: int, payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    if payload.get("role") not in ("admin", "agency"):
        raise HTTPException(status_code=403, detail="غير مصرح")
    res = await db.execute(select(HealthPackage).where(HealthPackage.id == pkg_id))
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="غير موجودة")
    await db.delete(p)
    await record(db, actor=payload.get("name", ""), action="delete", entity="package",
                 entity_id=pkg_id, detail="حذف حزمة")
    await db.commit()
    return {"ok": True}


# ---------- الربط بالإحالات ----------

@router.get("/link/referrals")
async def agency_referrals(db: AsyncSession = Depends(get_db), payload=Depends(current_user)):
    """إحالات مؤهلة للسياحة العلاجية (تخصصات: باطنية/روماتيزم/غدد). """
    res = await db.execute(select(Referral).where(Referral.status == "pending").order_by(
        Referral.id.desc()))
    out = []
    for r in res.scalars().all():
        out.append({"id": r.id, "patient_name": r.patient_name, "reason": r.reason,
                    "from_institution_id": r.from_institution_id, "created_at": r.created_at.isoformat()})
    return out


@router.post("/link/{referral_id}/package/{pkg_id}")
async def link_package(referral_id: int, pkg_id: int, payload=Depends(current_user),
                       db: AsyncSession = Depends(get_db)):
    """ربط إحالة طبية بحزمة سياحة علاجية + تقييمه عبر /api/thermal/bookings."""
    res = await db.execute(select(Referral).where(Referral.id == referral_id))
    r = res.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="الإحالة غير موجودة")
    res = await db.execute(select(HealthPackage).where(HealthPackage.id == pkg_id))
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="الحزمة غير موجودة")
    note = f"{decrypt_text(r.medical_note) or ''}\n[سياحة علاجية] حزمة مقترحة: {p.title} ({p.destination})"
    r.medical_note = encrypt_text(note.strip())
    await record(db, actor=payload.get("name", ""), action="link", entity="referral",
                 entity_id=r.id,
                 detail=f"ربط الإحالة {r.id} بالحزمة {p.title}")
    await db.commit()
    return {"ok": True, "suggested_package": p.title}