"""واجهة عامة للسياحة العلاجية (بدون تسجيل دخول):

- تصفح الحمامات المعدنية والحزم العلاجية (بيانات عامة فقط).
- استعلام دولي يصل للمشرفين كإشعار ثم كسجل في قاعدة البيانات
  (قناة الدخل الأولى: حزم سياحية علاجية للمقيمين في الخارج).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_db
from ..models import (AgencyProfile, HealthPackage, InternationalInquiry,
                      ThermalStation, Wilaya)
from .notifications import push

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get("/stations")
async def public_stations(db: AsyncSession = Depends(get_db)):
    """الحمامات المعدنية — بيانات ترويجية عامة مع أدنى سعر للحزم المتاحة."""
    res = await db.execute(
        select(ThermalStation, Wilaya.name_ar, Wilaya.name_fr)
        .outerjoin(Wilaya, Wilaya.code == ThermalStation.wilaya_id)
        .order_by(ThermalStation.name)
    )
    out = []
    for st, ar, fr in res.all():
        agg = (await db.execute(
            select(func.count(HealthPackage.id), func.min(HealthPackage.price))
            .where(HealthPackage.station_id == st.id)
        )).one()
        out.append({
            "id": st.id, "name": st.name,
            "wilaya_ar": ar or "", "wilaya_fr": fr or "",
            "treatments": st.treatments, "water_temp": st.water_temp,
            "services": st.services, "rating_avg": st.rating_avg,
            "packages_count": agg[0] or 0, "min_price": agg[1] or 0,
        })
    return out


@router.get("/packages")
async def public_packages(db: AsyncSession = Depends(get_db)):
    """الحزم العلاجية المتاحة للبيع — سعر وإقامة وتضمينات ووجهة."""
    res = await db.execute(
        select(HealthPackage, ThermalStation.name, AgencyProfile.name)
        .outerjoin(ThermalStation, ThermalStation.id == HealthPackage.station_id)
        .outerjoin(AgencyProfile, AgencyProfile.id == HealthPackage.agency_id)
        .order_by(HealthPackage.price)
    )
    return [
        {
            "id": p.id, "title": p.title, "destination": p.destination,
            "nights": p.nights, "price": p.price,
            "includes": p.includes, "treatments": p.treatments,
            "station_name": st_name or "", "agency_name": ag_name or "",
        }
        for p, st_name, ag_name in res.all()
    ]


class InquiryIn(BaseModel):
    name: str
    email: str = ""
    country: str = ""
    treatment: str = ""
    destination: str = ""
    nights: str = ""
    lang: str = "fr"
    message: str = ""


@router.post("/inquiries")
async def create_inquiry(body: InquiryIn, db: AsyncSession = Depends(get_db)):
    if not body.name.strip() or not body.treatment.strip():
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="الاسم والعلاج المطلوب مطلوبان")
    q = InternationalInquiry(
        name=body.name.strip(), email=body.email.strip(), country=body.country.strip(),
        treatment=body.treatment.strip(), destination=body.destination.strip(),
        nights=body.nights.strip(), lang=body.lang, message=body.message.strip(),
    )
    db.add(q)
    await db.flush()
    await push(db, role="admin", icon="🌍",
               title=f"استعلام سياحة علاجية — {q.name}",
               body=f"{q.country} · {q.treatment} · {q.destination or 'كل الوجهات'}",
               entity="inquiry", entity_id=q.id, link="/admin/wilayas")
    await db.commit()
    return {"ok": True, "id": q.id, "note": "سيتواصل معك منسق السياحة العلاجية خلال 48 ساعة."}