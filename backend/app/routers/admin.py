from __future__ import annotations

from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import current_user, get_db
from ..models import (AgencyProfile, BreakGlassEvent, CarePlan, Consent, DutyShift,
                      FollowupRecord, GeoZone, HealthPackage, InventoryItem, Pharmacy,
                      Prescription, PsychScreening, Review, SosDispatch, TelePsychSession,
                      ThermalBooking, ThermalStation, Association, AssociationEvaluation,
                      Institution, InstitutionLink, Referral, StaffMember, User, VitalAlert, Wilaya)

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/stats")
async def stats(payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    def _scalar(q):
        return db.scalar(q)

    staff = (await _scalar(select(func.count(StaffMember.id)))) or 0
    doctors = (await db.execute(select(func.count(StaffMember.id)).where(StaffMember.kind == "doctor"))).scalar_one() or 0
    nurses = (await db.execute(select(func.count(StaffMember.id)).where(StaffMember.kind == "nurse"))).scalar_one() or 0
    patients = (await db.execute(select(func.sum(StaffMember.patients_count)))).scalar_one() or 0
    referrals = (await db.execute(select(func.count(Referral.id)))).scalar_one() or 0
    pending = (await db.execute(select(func.count(Referral.id)).where(Referral.status == "pending"))).scalar_one() or 0
    accepted = (await db.execute(select(func.count(Referral.id)).where(Referral.status == "accepted"))).scalar_one() or 0
    red_alerts = (await db.execute(select(func.count(Referral.id)).where(
        Referral.severity == "red", Referral.status == "pending"))).scalar_one() or 0
    assoc_count = (await db.execute(select(func.count(Association.id)))).scalar_one() or 0
    total_points = (await db.execute(select(func.sum(Association.points)))).scalar_one() or 0
    units = (await db.execute(select(func.count(Institution.id)).where(Institution.type == "unit"))).scalar_one() or 0
    hospitals = (await db.execute(select(func.count(Institution.id)).where(Institution.type == "hospital"))).scalar_one() or 0
    links = (await db.execute(select(func.count(InstitutionLink.id)))).scalar_one() or 0
    users = (await db.execute(select(func.count(User.id)))).scalar_one() or 0
    wilayas = (await db.execute(select(func.count(Wilaya.code)))).scalar_one() or 0

    followups = (await db.execute(select(func.count(FollowupRecord.id)))).scalar_one() or 0
    shifts = (await db.execute(select(func.count(DutyShift.id)))).scalar_one() or 0
    zones = (await db.execute(select(func.count(GeoZone.id)))).scalar_one() or 0
    agencies = (await db.execute(select(func.count(AgencyProfile.id)))).scalar_one() or 0
    packages = (await db.execute(select(func.count(HealthPackage.id)))).scalar_one() or 0
    stations = (await db.execute(select(func.count(ThermalStation.id)))).scalar_one() or 0
    bookings = (await db.execute(select(func.count(ThermalBooking.id)))).scalar_one() or 0
    reviews = (await db.execute(select(func.count(Review.id)))).scalar_one() or 0
    alerts = (await db.execute(select(func.count(VitalAlert.id)))).scalar_one() or 0
    alerts_open = (await db.execute(select(func.count(VitalAlert.id)).where(
        VitalAlert.acknowledged.is_(False)))).scalar_one() or 0

    pharmacies = (await db.execute(select(func.count(Pharmacy.id)))).scalar_one() or 0
    rx_total = (await db.execute(select(func.count(Prescription.id)))).scalar_one() or 0
    rx_open = (await db.execute(select(func.count(Prescription.id)).where(
        Prescription.status == "open"))).scalar_one() or 0
    low_stock = (await db.execute(select(func.count(InventoryItem.id)).where(
        InventoryItem.qty < InventoryItem.min_level))).scalar_one() or 0
    consents = (await db.execute(select(func.count(Consent.id)).where(
        Consent.revoked.is_(False)))).scalar_one() or 0
    careplans = (await db.execute(select(func.count(CarePlan.id)).where(CarePlan.active.is_(True)))).scalar_one() or 0
    psych_runs = (await db.execute(select(func.count(PsychScreening.id)))).scalar_one() or 0
    tele_pending = (await db.execute(select(func.count(TelePsychSession.id)).where(
        TelePsychSession.status == "pending"))).scalar_one() or 0
    sos_fired = (await db.execute(select(func.count(SosDispatch.id)).where(
        SosDispatch.status != "resolved"))).scalar_one() or 0
    bg_active = (await db.execute(select(func.count(BreakGlassEvent.id)).where(
        BreakGlassEvent.status == "active"))).scalar_one() or 0

    res = await db.execute(
        select(Referral.status, func.count(Referral.id)).group_by(Referral.status)
    )
    by_status = {s: c for s, c in res.all()}

    top_assoc = await db.execute(select(Association).order_by(Association.points.desc()).limit(1))
    top = top_assoc.scalar_one_or_none()

    return {
        "staff": staff, "doctors": doctors, "nurses": nurses, "patients": patients,
        "referrals": referrals, "pending": pending, "accepted": accepted, "red_alerts": red_alerts,
        "associations": assoc_count, "total_points": total_points,
        "units": units, "hospitals": hospitals, "links": links, "users": users, "wilayas": wilayas,
        "followups": followups, "shifts": shifts, "zones": zones,
        "agencies": agencies, "packages": packages, "stations": stations,
        "bookings": bookings, "reviews": reviews, "alerts": alerts, "alerts_open": alerts_open,
        "pharmacies": pharmacies, "rx_total": rx_total, "rx_open": rx_open, "low_stock": low_stock,
        "consents": consents, "careplans": careplans, "psych_runs": psych_runs,
        "tele_pending": tele_pending, "sos_fired": sos_fired, "bg_active": bg_active,
        "by_status": by_status,
        "top_association": ({"name": top.name, "points": top.points, "stars": top.stars} if top else None),
    }


@router.get("/wilaya-report")
async def wilaya_report(payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    """تقرير الولايات (G2G): تغطية النشاط لكل ولاية من 58 — منتج الحوكمة الحكومي."""
    from ..deps import require_role
    require_role("admin")(payload)

    rows = {w.code: {"wilaya_ar": w.name_ar, "wilaya_fr": w.name_fr, "wilaya_code": w.code,
                     "staff": 0, "doctors": 0, "nurses": 0, "referrals": 0, "pending": 0,
                     "accepted": 0, "done": 0, "followups": 0, "institutions": 0,
                     "stations": 0, "pharmacies": 0, "agencies": 0, "bookings": 0}
            for w in (await db.execute(select(Wilaya).order_by(Wilaya.code))).scalars().all()}

    for kind, code, c in (await db.execute(
            select(StaffMember.kind, StaffMember.wilaya_id, func.count(StaffMember.id))
            .group_by(StaffMember.kind, StaffMember.wilaya_id))).all():
        if code in rows:
            rows[code]["staff"] += c or 0
            key = "doctors" if kind == "doctor" else ("nurses" if kind == "nurse" else None)
            if key:
                rows[code][key] = c or 0

    for code, status, c in (await db.execute(
            select(Institution.wilaya_id, Referral.status, func.count(Referral.id))
            .join(Referral, Referral.from_institution_id == Institution.id)
            .group_by(Institution.wilaya_id, Referral.status))).all():
        if code in rows:
            rows[code]["referrals"] += c or 0
            if status in ("pending", "accepted", "done"):
                rows[code][status] += c or 0

    for code, c in (await db.execute(
            select(Institution.wilaya_id, func.count(Institution.id))
            .group_by(Institution.wilaya_id))).all():
        if code in rows:
            rows[code]["institutions"] = c or 0

    for code, c in (await db.execute(
            select(ThermalStation.wilaya_id, func.count(ThermalStation.id))
            .group_by(ThermalStation.wilaya_id))).all():
        if code in rows:
            rows[code]["stations"] = c or 0

    for code, c in (await db.execute(
            select(Pharmacy.wilaya_id, func.count(Pharmacy.id))
            .group_by(Pharmacy.wilaya_id))).all():
        if code in rows:
            rows[code]["pharmacies"] = c or 0

    for code, c in (await db.execute(
            select(AgencyProfile.wilaya_id, func.count(AgencyProfile.id))
            .group_by(AgencyProfile.wilaya_id))).all():
        if code in rows:
            rows[code]["agencies"] = c or 0

    for code, c in (await db.execute(
            select(ThermalStation.wilaya_id, func.count(ThermalBooking.id))
            .join(ThermalBooking, ThermalBooking.station_id == ThermalStation.id)
            .group_by(ThermalStation.wilaya_id))).all():
        if code in rows:
            rows[code]["bookings"] = c or 0

    # المتابعات المرتبطة بإحالات (بقصد المرجعية الصحية)
    for code, c in (await db.execute(
            select(Institution.wilaya_id, func.count(FollowupRecord.id))
            .join(Referral, Referral.id == FollowupRecord.referral_id)
            .join(Institution, Institution.id == Referral.from_institution_id)
            .group_by(Institution.wilaya_id))).all():
        if code in rows:
            rows[code]["followups"] = c or 0

    items = [rows[c] for c in sorted(rows)]
    totals = {k: sum(r[k] for r in items) for k in
              ("staff", "doctors", "nurses", "referrals", "pending", "accepted", "done",
               "followups", "institutions", "stations", "pharmacies", "agencies", "bookings")}
    return {"items": items, "totals": totals, "count": len(items)}


@router.post("/backup")
async def run_backup(payload=Depends(current_user)):
    """نسخة احتياطية فورية مشفَّرة أفقية (AES-256-GCM) — تُدير يومياً أيضاً."""
    from ..crypto import encrypt_bytes
    from ..deps import require_role
    require_role("admin")(payload)
    root = Path(__file__).resolve().parents[3]
    db_file = root / "data" / "vitalink.db"
    out_dir = root / "backups"
    out_dir.mkdir(parents=True, exist_ok=True)
    enc = encrypt_bytes(db_file.read_bytes())
    stamp = datetime.now().strftime("%Y-%m-%d_%H%M")
    target = out_dir / f"ryt-{stamp}.bin"
    target.write_bytes(enc)
    (out_dir / "latest.bin").write_bytes(enc)
    return {"ok": True, "file": target.name, "bytes": len(enc), "at": stamp}


@router.get("/backups")
async def list_backups(payload=Depends(current_user)):
    from ..deps import require_role
    require_role("admin")(payload)
    root = Path(__file__).resolve().parents[3]
    out_dir = root / "backups"
    if not out_dir.exists():
        return {"backups": []}
    items = []
    for p in sorted(out_dir.glob("ryt-*.bin"), reverse=True):
        items.append({"name": p.name, "bytes": p.stat().st_size,
                      "created": datetime.fromtimestamp(p.stat().st_mtime).isoformat()})
    return {"backups": items}