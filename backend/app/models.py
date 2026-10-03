from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(256))
    role: Mapped[str] = mapped_column(String(32), index=True)
    name: Mapped[str] = mapped_column(String(160))
    email: Mapped[str] = mapped_column(String(160), default="")
    phone: Mapped[str] = mapped_column(String(32), default="")
    wilaya_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    facility: Mapped[str] = mapped_column(String(240), default="")
    avatar: Mapped[str] = mapped_column(String(32), default="avatar-1")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class Wilaya(Base):
    __tablename__ = "wilayas"

    code: Mapped[int] = mapped_column(Integer, primary_key=True)
    name_ar: Mapped[str] = mapped_column(String(80))
    name_fr: Mapped[str] = mapped_column(String(80))
    lat: Mapped[float] = mapped_column(Float, default=0)
    lng: Mapped[float] = mapped_column(Float, default=0)


class Institution(Base):
    __tablename__ = "institutions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    type: Mapped[str] = mapped_column(String(40), default="hospital")  # hospital | unit | clinic
    city: Mapped[str] = mapped_column(String(120), default="")
    wilaya_id: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)
    lat: Mapped[float] = mapped_column(Float, default=0)
    lng: Mapped[float] = mapped_column(Float, default=0)
    phone: Mapped[str] = mapped_column(String(32), default="")
    refers: Mapped[bool] = mapped_column(Boolean, default=True)


class StaffMember(Base):
    __tablename__ = "staff_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    full_name: Mapped[str] = mapped_column(String(160), index=True)
    kind: Mapped[str] = mapped_column(String(16))  # doctor | nurse
    specialty: Mapped[str] = mapped_column(String(200), default="")
    institution_id: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)
    wilaya_id: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)
    phone: Mapped[str] = mapped_column(String(32), default="")
    patients_count: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    license_doc: Mapped[str] = mapped_column(String(240), default="")      # رخصة الممارسة / بطاقة التعريف
    license_status: Mapped[str] = mapped_column(String(16), default="pending")  # pending | verified | rejected
    verified_by: Mapped[str] = mapped_column(String(160), default="")
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class Referral(Base):
    __tablename__ = "referrals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_name: Mapped[str] = mapped_column(String(160), index=True)
    from_institution_id: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)
    to_institution_id: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)
    reason: Mapped[str] = mapped_column(Text, default="")
    medical_note: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)  # pending | accepted | rejected
    severity: Mapped[str] = mapped_column(String(12), default="normal")            # normal | red (Red Alert)
    sla_hours: Mapped[float | None] = mapped_column(Float, nullable=True)          # ساعة بين الإصدار والقرار
    created_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
    assigned_doctor: Mapped[str] = mapped_column(String(160), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    decided_by: Mapped[str] = mapped_column(String(160), default="")


class InstitutionLink(Base):
    __tablename__ = "institution_links"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    institution_a_id: Mapped[int] = mapped_column(Integer, index=True)
    institution_b_id: Mapped[int] = mapped_column(Integer, index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class Association(Base):
    __tablename__ = "associations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    wilaya_id: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)
    volunteers: Mapped[int] = mapped_column(Integer, default=0)
    visits: Mapped[int] = mapped_column(Integer, default=0)
    activities: Mapped[int] = mapped_column(Integer, default=0)
    points: Mapped[int] = mapped_column(Integer, default=0)
    stars: Mapped[float] = mapped_column(Float, default=0)
    last_evaluated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor: Mapped[str] = mapped_column(String(160), index=True)
    action: Mapped[str] = mapped_column(String(32), index=True)  # create | update | delete | decide | evaluate | link
    entity: Mapped[str] = mapped_column(String(32), index=True)
    entity_id: Mapped[int] = mapped_column(Integer, index=True)
    detail: Mapped[str] = mapped_column(String(400), default="")
    old_value: Mapped[str] = mapped_column(Text, default="")
    new_value: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class AssociationEvaluation(Base):
    __tablename__ = "association_evaluations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    association_id: Mapped[int] = mapped_column(Integer, index=True)
    field_visits: Mapped[int] = mapped_column(Integer, default=0)
    coverage: Mapped[int] = mapped_column(Integer, default=0)   # ما تغطيته الولايات/الأحياء
    impact: Mapped[int] = mapped_column(Integer, default=0)     # الأثر الميداني
    notes: Mapped[str] = mapped_column(Text, default="")
    by_user: Mapped[str] = mapped_column(String(160), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


# =================  المرحلة 1: المتابعة الطبية والتمريضية (Offline-First)  =================

class FollowupRecord(Base):
    __tablename__ = "followup_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_name: Mapped[str] = mapped_column(String(160), index=True)
    referral_id: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)
    kind: Mapped[str] = mapped_column(String(20), default="consultation")  # consultation | nursing | vitals | medication
    date: Mapped[str] = mapped_column(String(20), default="")              # YYYY-MM-DD
    author: Mapped[str] = mapped_column(String(160), default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    subjective: Mapped[str] = mapped_column(Text, default="")
    objective: Mapped[str] = mapped_column(Text, default="")
    vitals_json: Mapped[str] = mapped_column(Text, default="{}")   # {"pulse","bpSys","bpDia","temp","spO2","sugar"}
    medications_json: Mapped[str] = mapped_column(Text, default="[]")  # ["غليمبريد", ...]
    attachments_json: Mapped[str] = mapped_column(Text, default="[]")  # [{"name","dataUrl"}]
    signed_by: Mapped[str] = mapped_column(String(160), default="")     # توقيع الاعتماد القانوني
    signed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    device_id: Mapped[str] = mapped_column(String(80), default="")      # معرّف جهاز الممرض (offline)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)


class SiteContent(Base):
    __tablename__ = "site_content"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(40), unique=True)            # about | researcher
    title: Mapped[str] = mapped_column(String(200), default="")
    body_json: Mapped[str] = mapped_column(Text, default="[]")           # قائمة أقسام (عناوين/فقرات/صور)
    updated_by: Mapped[str] = mapped_column(String(160), default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)


class DutyShift(Base):
    __tablename__ = "duty_shifts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    staff_id: Mapped[int] = mapped_column(Integer, index=True)
    date: Mapped[str] = mapped_column(String(20), index=True)            # YYYY-MM-DD
    shift: Mapped[str] = mapped_column(String(20), default="morning")    # morning | evening | night
    unit: Mapped[str] = mapped_column(String(160), default="")
    note: Mapped[str] = mapped_column(Text, default="")


class GeoZone(Base):
    __tablename__ = "geo_zones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    wilaya_code: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)
    lat: Mapped[float] = mapped_column(Float, default=0)
    lng: Mapped[float] = mapped_column(Float, default=0)
    radius_km: Mapped[float] = mapped_column(Float, default=10)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)


# =================  المرحلة 2: السياحة العلاجية (وكالات + حمامات)  =================

class AgencyProfile(Base):
    __tablename__ = "agency_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)
    name: Mapped[str] = mapped_column(String(200))
    license_no: Mapped[str] = mapped_column(String(80), default="")
    wilaya_id: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)
    city: Mapped[str] = mapped_column(String(120), default="")
    phone: Mapped[str] = mapped_column(String(32), default="")
    desc: Mapped[str] = mapped_column(Text, default="")


class FleetVehicle(Base):
    __tablename__ = "fleet_vehicles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agency_id: Mapped[int] = mapped_column(Integer, index=True)
    kind: Mapped[str] = mapped_column(String(20), default="ambulance")   # ambulance | medical_bus | minibus
    plate: Mapped[str] = mapped_column(String(30), default="")
    seats: Mapped[int] = mapped_column(Integer, default=4)
    medical: Mapped[bool] = mapped_column(Boolean, default=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class TourGuide(Base):
    __tablename__ = "tour_guides"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agency_id: Mapped[int] = mapped_column(Integer, index=True)
    name: Mapped[str] = mapped_column(String(160))
    langs: Mapped[str] = mapped_column(String(120), default="")
    phone: Mapped[str] = mapped_column(String(32), default="")
    license: Mapped[str] = mapped_column(String(120), default="")


class HealthPackage(Base):
    __tablename__ = "health_packages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agency_id: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)  # null ⇒ حزمة محطة حموية
    title: Mapped[str] = mapped_column(String(200))
    destination: Mapped[str] = mapped_column(String(120), default="")
    nights: Mapped[int] = mapped_column(Integer, default=7)
    price: Mapped[float] = mapped_column(Float, default=0)
    includes: Mapped[str] = mapped_column(Text, default="")
    treatments: Mapped[str] = mapped_column(Text, default="")   # قائمة بالفواصل "،"
    station_id: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)


class ThermalStation(Base):
    __tablename__ = "thermal_stations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    wilaya_id: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)
    lat: Mapped[float] = mapped_column(Float, default=0)
    lng: Mapped[float] = mapped_column(Float, default=0)
    treatments: Mapped[str] = mapped_column(Text, default="")   # "أمراض المفاصل، الروماتيزم،..."
    water_temp: Mapped[float] = mapped_column(Float, default=40)
    services: Mapped[str] = mapped_column(Text, default="")
    rating_avg: Mapped[float] = mapped_column(Float, default=0)


class ThermalBooking(Base):
    __tablename__ = "thermal_bookings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    station_id: Mapped[int] = mapped_column(Integer, index=True)
    package_id: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)
    patient_name: Mapped[str] = mapped_column(String(160))
    agency_id: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)
    date_start: Mapped[str] = mapped_column(String(20), default="")
    date_end: Mapped[str] = mapped_column(String(20), default="")
    price: Mapped[float] = mapped_column(Float, default=0)
    insurance: Mapped[bool] = mapped_column(Boolean, default=False)      # تأمين صحي وسياحي
    doctor_approved: Mapped[bool | None] = mapped_column(Boolean, nullable=True)  # موافقة الطبيب قبل السفر
    doctor_name: Mapped[str] = mapped_column(String(160), default="")
    status: Mapped[str] = mapped_column(String(20), default="pending")   # pending | approved | rejected | done
    created_by: Mapped[str] = mapped_column(String(160), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    target_type: Mapped[str] = mapped_column(String(20), index=True)    # station | package | guide
    target_id: Mapped[int] = mapped_column(Integer, index=True)
    user_name: Mapped[str] = mapped_column(String(160), default="")
    stars: Mapped[int] = mapped_column(Integer, default=5)
    comment: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


# =================  المرحلة 2 (الأمان): الإنذار التنبؤي للمؤشرات الحيوية  =================

class VitalAlert(Base):
    __tablename__ = "vital_alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_name: Mapped[str] = mapped_column(String(160), index=True)
    level: Mapped[str] = mapped_column(String(16), default="info")      # info | warning | danger
    metric: Mapped[str] = mapped_column(String(40), default="")         # pulse | bp | temp | spO2 | sugar
    value: Mapped[str] = mapped_column(String(80), default="")          # قيمة نصية للعرض
    message: Mapped[str] = mapped_column(Text, default="")
    followup_id: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    ack_by: Mapped[str] = mapped_column(String(160), default="")
    acked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


# =================  المرحلة 2α: الدواء والصيدليات  =================

class Pharmacy(Base):
    __tablename__ = "pharmacies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    wilaya_id: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)
    city: Mapped[str] = mapped_column(String(120), default="")
    phone: Mapped[str] = mapped_column(String(32), default="")
    manager: Mapped[str] = mapped_column(String(160), default="")
    license_no: Mapped[str] = mapped_column(String(80), default="")
    open_24: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pharmacy_id: Mapped[int] = mapped_column(Integer, index=True)
    drug: Mapped[str] = mapped_column(String(200), index=True)
    strength: Mapped[str] = mapped_column(String(40), default="")
    form: Mapped[str] = mapped_column(String(40), default="")          # tablet | ampoule | syrup |...
    qty: Mapped[int] = mapped_column(Integer, default=0)
    min_level: Mapped[int] = mapped_column(Integer, default=10)        # حد التنبيه
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)


class Prescription(Base):
    __tablename__ = "prescriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ref: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    patient_name: Mapped[str] = mapped_column(String(160), index=True)
    doctor_name: Mapped[str] = mapped_column(String(160), default="")
    institution: Mapped[str] = mapped_column(String(240), default="")
    purpose: Mapped[str] = mapped_column(String(320), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    signed: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[str] = mapped_column(String(20), default="open")     # open | dispensed | partial | void
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    dispensed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    dispensed_by: Mapped[str] = mapped_column(String(160), default="")


class PrescriptionItem(Base):
    __tablename__ = "prescription_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    prescription_id: Mapped[int] = mapped_column(Integer, index=True)
    drug: Mapped[str] = mapped_column(String(200))
    strength: Mapped[str] = mapped_column(String(40), default="")
    dosage: Mapped[str] = mapped_column(String(120), default="")
    duration: Mapped[str] = mapped_column(String(80), default="")
    qty: Mapped[int] = mapped_column(Integer, default=1)


# =================  المرحلة 2α: الموافقات الرقمية وخطة ما بعد العلاج  =================

class Consent(Base):
    __tablename__ = "consents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_name: Mapped[str] = mapped_column(String(160), index=True)
    ref: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    type: Mapped[str] = mapped_column(String(40))          # record | treatment | research | sharing
    grantor: Mapped[str] = mapped_column(String(160), default="")
    granted_to: Mapped[str] = mapped_column(String(160), default="")
    scope: Mapped[str] = mapped_column(String(400), default="")
    signed: Mapped[bool] = mapped_column(Boolean, default=True)
    expires_on: Mapped[str] = mapped_column(String(20), default="")     # YYYY-MM-DD
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class CarePlan(Base):
    __tablename__ = "care_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_name: Mapped[str] = mapped_column(String(160), index=True)
    doctor_name: Mapped[str] = mapped_column(String(160), default="")
    title: Mapped[str] = mapped_column(String(240), default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    goals_json: Mapped[str] = mapped_column(Text, default="[]")   # [{"g","done"}]
    schedule_json: Mapped[str] = mapped_column(Text, default="[]")  # [{"task","when"}]
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


# =================  المرحلة 2α: الصحة النفسية ورعاية المقدِّم  =================

class PsychScreening(Base):
    __tablename__ = "psych_screenings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_name: Mapped[str] = mapped_column(String(160), index=True)
    kind: Mapped[str] = mapped_column(String(20), default="phq")   # phq | gad | caregiver
    score: Mapped[int] = mapped_column(Integer, default=0)
    level: Mapped[str] = mapped_column(String(40), default="")     # mild | moderate | severe
    advice: Mapped[str] = mapped_column(Text, default="")
    answers_json: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class TelePsychSession(Base):
    __tablename__ = "tele_psych_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_name: Mapped[str] = mapped_column(String(160), index=True)
    specialist: Mapped[str] = mapped_column(String(160), default="")
    kind: Mapped[str] = mapped_column(String(40), default="video")  # video | voice | text
    slot: Mapped[str] = mapped_column(String(40), default="")       # "2026-10-01 10:00"
    reason: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | confirmed | done | cancelled
    created_by: Mapped[str] = mapped_column(String(160), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


# =================  المرحلة 2α: كسر الزجاج (ورقة OTP) =================

class BreakGlassEvent(Base):
    __tablename__ = "break_glass_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    requester: Mapped[str] = mapped_column(String(160), index=True)
    role: Mapped[str] = mapped_column(String(32), default="")
    reason: Mapped[str] = mapped_column(Text, default="")
    otp_hash: Mapped[str] = mapped_column(String(128), default="")
    otp_used: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | active | released
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    granted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    released_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


# =================  المرحلة 2α: SOS → الحماية المدنية =================

class SosDispatch(Base):
    __tablename__ = "sos_dispatches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ref: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    patient_name: Mapped[str] = mapped_column(String(160), default="")
    phone: Mapped[str] = mapped_column(String(32), default="")
    lat: Mapped[float] = mapped_column(Float, default=0)
    lng: Mapped[float] = mapped_column(Float, default=0)
    detail: Mapped[str] = mapped_column(Text, default="")
    channel: Mapped[str] = mapped_column(String(20), default="sms")    # sms | api | both
    status: Mapped[str] = mapped_column(String(20), default="fired")   # fired | enroute | resolved
    resolved_by: Mapped[str] = mapped_column(String(160), default="")
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


# =================  تطبيق الرفيق: حضور دائم + موقع حي =================

class Presence(Base):
    """نبض الحضور من تطبيق الرفيق — يتصل الجهاز كل 60 ثانية بموقعه الحالي."""

    __tablename__ = "presence"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    device: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    app: Mapped[str] = mapped_column(String(40), default="vitaldz")   # vitaldz | android | ios
    patient_name: Mapped[str] = mapped_column(String(160), default="")
    role: Mapped[str] = mapped_column(String(32), default="")
    lat: Mapped[float] = mapped_column(Float, default=0)
    lng: Mapped[float] = mapped_column(Float, default=0)
    acc: Mapped[float] = mapped_column(Float, default=0)
    online: Mapped[bool] = mapped_column(Boolean, default=True)
    seen_at: Mapped[datetime] = mapped_column(DateTime, default=_now)