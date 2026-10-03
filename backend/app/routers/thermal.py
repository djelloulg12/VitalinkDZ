"""بوابة السياحة العلاجية والحمامّات — محطات/حزم/حجوزات/تقارير + اقتراح مسار (AI) + تقييمات + موافقة الطبيب."""

from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..audit import record
from ..deps import current_user, get_db
from ..models import HealthPackage, Review, ThermalBooking, ThermalStation

router = APIRouter(prefix="/api/thermal", tags=["thermal"])

# خريطة أولية لـ"الاقتراح الذكي" (قاعدة معرفة بسيطة قابلة للتوسع)
WATER_PROFILE = {
    1: {"temp": 42, "desc": "مياه كبريتية حارة — مفيدة للمفاصل والروماتيزم", "treat": ["روماتيزم", "مفاصل", "تأهيل"]},
    2: {"temp": 45, "desc": "مياه كلسية — مفيدة للأمراض الجلدية والروماتيزم", "treat": ["جلدية", "روماتيزم"]},
    3: {"temp": 38, "desc": "مياه نابعة فاترة — تنشيط الدورة والآلام العضلية", "treat": ["عضلي", "دورة"]},
    4: {"temp": 44, "desc": "مياه كبريتية قوية — مفيدة للعمود الفقري والعصبية", "treat": ["عمود فقري", "عصبية"]},
}


class BookingIn(BaseModel):
    station_id: int
    package_id: int | None = None
    patient_name: str
    agency_id: int | None = None
    date_start: str = ""
    date_end: str = ""
    price: float = 0
    insurance: bool = False


async def _station(db: AsyncSession, s: ThermalStation) -> dict:
    res = await db.execute(select(func.avg(Review.stars)).where(
        Review.target_type == "station", Review.target_id == s.id))
    avg = res.scalar() or s.rating_avg
    res = await db.execute(select(Review).where(
        Review.target_type == "station", Review.target_id == s.id).order_by(Review.id.desc()).limit(5))
    reviews = [{"id": r.id, "stars": r.stars, "comment": r.comment, "user_name": r.user_name}
               for r in res.scalars().all()]
    res = await db.execute(select(HealthPackage).where(HealthPackage.station_id == s.id))
    packs = [await _package(p) for p in res.scalars().all()]
    return {"id": s.id, "name": s.name, "wilaya_id": s.wilaya_id, "lat": s.lat, "lng": s.lng,
            "treatments": s.treatments, "water_temp": s.water_temp, "services": s.services,
            "rating_avg": round(float(avg or 0), 1), "reviews": reviews, "packages": packs}


async def _package(p: HealthPackage) -> dict:
    return {"id": p.id, "title": p.title, "destination": p.destination, "nights": p.nights,
            "price": p.price, "includes": p.includes, "treatments": p.treatments,
            "agency_id": p.agency_id, "station_id": p.station_id}


async def _booking(db: AsyncSession, b: ThermalBooking) -> dict:
    res = await db.execute(select(ThermalStation).where(ThermalStation.id == b.station_id))
    st = res.scalar_one_or_none()
    return {"id": b.id, "station_id": b.station_id, "station_name": st.name if st else "?",
            "package_id": b.package_id, "patient_name": b.patient_name, "agency_id": b.agency_id,
            "date_start": b.date_start, "date_end": b.date_end, "price": b.price,
            "insurance": b.insurance, "insurance_label": ("مؤمَّن" if b.insurance else "بدون تأمين"),
            "doctor_approved": b.doctor_approved, "doctor_name": b.doctor_name,
            "status": b.status, "created_by": b.created_by,
            "created_at": b.created_at.isoformat() if b.created_at else None}


@router.get("/stations")
async def list_stations(name: str = "", db: AsyncSession = Depends(get_db), payload=Depends(current_user)):
    q = select(ThermalStation).order_by(ThermalStation.id)
    if name:
        q = q.where(ThermalStation.name.ilike(f"%{name.strip()}%"))
    res = await db.execute(q)
    return [await _station(db, s) for s in res.scalars().all()]


@router.get("/stations/{station_id}")
async def get_station(station_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(ThermalStation).where(ThermalStation.id == station_id))
    s = res.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="المحطة غير موجودة")
    return await _station(db, s)


@router.get("/packages")
async def list_packages(db: AsyncSession = Depends(get_db), payload=Depends(current_user)):
    res = await db.execute(select(HealthPackage).order_by(HealthPackage.id))
    return [await _package(p) for p in res.scalars().all()]


@router.get("/bookings")
async def list_bookings(db: AsyncSession = Depends(get_db), payload=Depends(current_user)):
    if payload.get("role") not in ("admin", "doctor", "agency", "thermal"):
        return []
    res = await db.execute(select(ThermalBooking).order_by(ThermalBooking.id.desc()))
    return [await _booking(db, b) for b in res.scalars().all()]


@router.post("/bookings")
async def create_booking(body: BookingIn, payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    if payload.get("role") not in ("admin", "agency", "thermal", "doctor"):
        raise HTTPException(status_code=403, detail="غير مصرح")
    b = ThermalBooking(**body.model_dump(), status="pending", created_by=payload.get("name", ""))
    db.add(b)
    await db.flush()
    await record(db, actor=payload.get("name", ""), action="create", entity="booking",
                 entity_id=b.id, detail=f"حجز سياحة علاجية: {b.patient_name} ({b.date_start})",
                 new=json.dumps({"pkg": b.package_id, "insurance": b.insurance}))
    await db.commit()
    await db.refresh(b)
    return await _booking(db, b)


@router.put("/bookings/{bid}/approve")
async def approve_booking(bid: int, approved: bool, payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    """موافقة الطبيب قبل السفر (المرحلة 2): بعد التحقق من الاستطباب ومراجعة مؤشرات المريض."""
    if payload.get("role") != "doctor":
        raise HTTPException(status_code=403, detail="الموافقة من الطبيب فقط")
    res = await db.execute(select(ThermalBooking).where(ThermalBooking.id == bid))
    b = res.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="الحجز غير موجود")
    b.doctor_approved = approved
    b.doctor_name = payload.get("name", "طبيب")
    b.status = "approved" if approved else "rejected"
    await record(db, actor=payload.get("name", ""), action="approve", entity="booking",
                 entity_id=bid, detail=f"موافقة الطبيب على حجز {b.patient_name} → {'معتمَد' if approved else 'مرفوض'}")
    await db.commit()
    return await _booking(db, b)


@router.put("/bookings/{bid}/status")
async def set_status(bid: int, status: str, payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    if payload.get("role") not in ("admin", "agency", "thermal"):
        raise HTTPException(status_code=403, detail="غير مصرح")
    res = await db.execute(select(ThermalBooking).where(ThermalBooking.id == bid))
    b = res.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="الحجز غير موجود")
    b.status = status
    await record(db, actor=payload.get("name", ""), action="update", entity="booking",
                 entity_id=bid, detail=f"حالة الحجز {bid} → {status}")
    await db.commit()
    return await _booking(db, b)


@router.post("/suggest")
async def suggest_route(diagnosis: str = "", conditions: list[str] = [], db: AsyncSession = Depends(get_db),
                        payload=Depends(current_user)):
    """اقتراح مسار سياحي علاجي: مطابقة التشخيص مع خصائص المحطات (AI مبسّط بقاعدة معرفة + استبعاد لافتات الخطر)."""
    text = (diagnosis + " " + " ".join(conditions)).lower()
    excluded = ["حمل", "مرض قلب", "قصور قلبي", "ارتفاع", "سرطان", "سكري", "حمى"]
    hits = [x for x in excluded if x in text]
    res = await db.execute(select(ThermalStation))
    stations = res.scalars().all()
    # حصر المحطات التي تخاطب تشخيص المريض
    matches = []
    for s in stations:
        treat = (s.treatments or "").lower()
        score = sum(1 for t in treat.replace("،", "،").split("،") if any(k in text for k in t.strip().split()))
        if score > 0:
            matches.append({"id": s.id, "name": s.name, "temp": s.water_temp,
                            "treatments": s.treatments, "score": score})
    matches.sort(key=lambda x: -x["score"])

    # قاعدة بسيطة للتوافق مع ماء معين حسب التشخيص
    if any(k in text for k in ["روماتيزم", "مفاصل", "عظم"]):
        best = 1
    elif any(k in text for k in ["جلد", "إكزيما"]):
        best = 2
    elif any(k in text for k in ["دورة دموية", "عضلات"]):
        best = 3
    elif any(k in text for k in ["فقرات", "عصبية"]):
        best = 4
    else:
        best = None

    res = await db.execute(select(ThermalStation).where(ThermalStation.id == best)) if best else None
    top = res.scalar_one_or_none() if best else None

    await record(db, actor=payload.get("name", ""), action="suggest", entity="thermal",
                 entity_id=0, detail=f"اقتراح مسار علاجي لتشخيص: {diagnosis[:60]}",
                 old="", new=(top.name if top else "لا تطابق"))
    await db.commit()
    return {
        "disclaimer": "اقتراح آلي بقاعدة معرفة أولية — يجب التحقق من الطبيب قبل الحجز (قانون الصحة/التقنيات الطبية).",
        "blocks": [x for x in hits if x],
        "matches": matches,
        "top": ({"id": top.id, "name": top.name, "temp": top.water_temp, "treatments": top.treatments} if top else None),
    }


# ---------- تقييمات ومراجعات ----------

class ReviewIn(BaseModel):
    target_type: str
    target_id: int
    stars: int = 5
    comment: str = ""


@router.post("/reviews")
async def add_review(body: ReviewIn, payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    if body.stars < 1 or body.stars > 5:
        raise HTTPException(status_code=422, detail="التقييم بين 1 و 5")
    rv = Review(**body.model_dump(), user_name=payload.get("name", "مستخدم"))
    db.add(rv)
    await db.flush()
    await record(db, actor=payload.get("name", ""), action="create", entity="review",
                 entity_id=rv.id, detail=f"تقييم ({body.stars}★) على {body.target_type}#{body.target_id}")
    await db.commit()
    return {"ok": True, "id": rv.id}


@router.get("/reports")
async def reports(db: AsyncSession = Depends(get_db), payload=Depends(current_user)):
    """التقارير: عدد الحجوزات، الإيراد المتوقع، نسب الحالات، المحطات الأكثر طلباً."""
    total = (await db.execute(select(func.count(ThermalBooking.id)))).scalar_one() or 0
    approved = (await db.execute(select(func.count(ThermalBooking.id)).where(
        ThermalBooking.status == "approved"))).scalar_one() or 0
    pending = (await db.execute(select(func.count(ThermalBooking.id)).where(
        ThermalBooking.status == "pending"))).scalar_one() or 0
    revenue = (await db.execute(select(func.sum(ThermalBooking.price)))).scalar_one() or 0
    insured = (await db.execute(select(func.count(ThermalBooking.id)).where(
        ThermalBooking.insurance == True))).scalar_one() or 0  # noqa: E712
    doc_ok = (await db.execute(select(func.count(ThermalBooking.id)).where(
        ThermalBooking.doctor_approved == True))).scalar_one() or 0  # noqa: E712
    # المحطات الأكثر طلبا
    res = await db.execute(
        select(ThermalStation.name, func.count(ThermalBooking.id))
        .join(ThermalBooking, ThermalBooking.station_id == ThermalStation.id)
        .group_by(ThermalStation.id).order_by(func.count(ThermalBooking.id).desc()))
    top_stations = [{"name": n, "count": c} for n, c in res.all()]
    return {"total": total, "approved": approved, "pending": pending,
            "revenue_dzd": float(revenue), "insured": insured, "doc_approved": doc_ok,
            "top_stations": top_stations}