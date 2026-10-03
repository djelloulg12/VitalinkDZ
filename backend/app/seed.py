"""Seeds Voltas initial database: 58 wilayas, roles users, staff, institutions, referrals, associations."""

from __future__ import annotations

import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from . import models
from .database import SessionLocal
from .security import hash_password
from .wilayas import WILAYAS

DEFAULT_PASSWORD = "demo123"

ROLE_LABELS = {
    "admin": "المدير الوطني",
    "doctor": "طبيب معالِج",
    "nurse": "ممرض متنقل",
    "patient": "مستفيد",
    "family": "عائلة / مرافق",
    "dass": "أخصائي اجتماعي (DASS)",
    "agency": "وكالة سياحة وأسفار",
    "thermal": "السياحة العلاجية والحمامات",
    "researcher": "الباحثة / صاحبة المذكرة",
}


def points_formula(visits: int, volunteers: int, activities: int, impact: int) -> int:
    """نظام النقاط المتفق عليه: 10 ن./زيارة + 5 ن./متطوع + 40 ن./نشاط + 150 ن./أثر ميداني."""
    return visits * 10 + volunteers * 5 + activities * 40 + impact * 150


def stars_from_points(points: int) -> float:
    return round(min(5.0, points / 1000), 1)


def _ca(session: AsyncSession) -> dict[str, int]:
    return session.connection()

DEFAULT = "demo123"
_ADMIN_SEED = None


async def seed_if_empty(db: AsyncSession) -> bool:
    res = await db.execute(select(models.User.id).limit(1))
    if res.first() is not None:
        await ensure_phase2(db)
        return False

    inst = await seed_wilayas(db)
    users = await seed_users(db)
    await seed_institutions(db, users)
    await seed_staff(db, users)
    await seed_referrals(db, users)
    await seed_associations(db, users)
    await seed_links(db)
    await seed_followups(db, users)
    await seed_about(db)
    await seed_shifts(db)
    await seed_zones(db)
    await seed_tourism(db, users)
    await seed_phase2(db, users)
    await db.commit()
    return True


async def ensure_phase2(db: AsyncSession):
    """يُكمل بيانات المرحلة 2α دون المساس بالبيانات القائمة (قاعدة قديمة)."""
    has_users = (await db.execute(select(models.User.username))).scalars().all()
    users = {u: i for i, u in enumerate(has_users)}
    ph_count = await db.execute(select(models.Pharmacy.id))
    if ph_count.first() is None:
        await seed_phase2(db, users)
        await db.commit()


async def seed_phase2(db: AsyncSession, users: dict[str, int]):
    # حساب صيدلي
    if "pharma_1" not in users:
        db.add(models.User(username="pharma_1", password_hash=hash_password(DEFAULT_PASSWORD),
                           role="pharmacist", name="صيدلية الإحسان — غرداية",
                           email="pharma@vitalink.dz", phone="0555006606", wilaya_id=47,
                           facility="صيدلية الإحسان — غرداية", avatar="avatar-1"))

    db.add(models.Pharmacy(id=1, name="صيدلية الإحسان", wilaya_id=47, city="غرداية",
                           phone="0555006601", manager="أ. يعقوب واضح", license_no="PH-2026-047",
                           open_24=False))
    db.add(models.Pharmacy(id=2, name="صيدلية زلفانة الطبية", wilaya_id=47, city="زلفانة",
                           phone="0555006602", manager="أ. زكرياء بوعلام", license_no="PH-2026-118",
                           open_24=True))

    stock = [
        (1, "غليمبريد", "2mg", "أقراص", 32, 10),
        (1, "ميتفورمين", "500mg", "أقراص", 90, 20),
        (1, "راميبريل", "5mg", "أقراص", 28, 10),
        (1, "أملوديبين", "10mg", "أقراص", 40, 12),
        (1, "فالسارتان", "160mg", "أقراص", 25, 10),
        (1, "فوروسيميد", "40mg", "أقراص", 60, 10),
        (1, "بيسوبرولول", "2.5mg", "أقراص", 18, 8),
        (2, "باراسيتامول", "500mg", "أقراص", 150, 30),
        (2, "كلورفينيرامين", "4mg", "أقراص", 40, 12),
        (2, "أموكسيسيلين", "500mg", "كبسولات", 8, 20),
        (2, "إنسولين نوفورابيد", "100ui", "محلول حقن", 12, 4),
    ]
    for i, (ph, drug, strength, form, qty, mn) in enumerate(stock, start=1):
        db.add(models.InventoryItem(id=i, pharmacy_id=ph, drug=drug, strength=strength,
                                    form=form, qty=qty, min_level=mn))

    rx = models.Prescription(
        id=1, ref="RX-20260920-00142", patient_name="الحاج بلقاسم سليماني",
        doctor_name="د. بن عباس إلهام", institution="مستشفى إبراهيم ترشين — غرداية",
        purpose="ضبط سكر الدم والألم المفصلي", notes="إعادة التقييم خلال 3 أسابيع", status="open")
    db.add(rx)
    db.add(models.PrescriptionItem(prescription_id=1, drug="غليمبريد", strength="2mg",
                                   dosage="قرص صباحاً", duration="أسبوعان", qty=14))
    db.add(models.PrescriptionItem(prescription_id=1, drug="ميتفورمين", strength="500mg",
                                   dosage="قرص بعد الفطور والعشاء", duration="شهر", qty=60))
    db.add(models.PrescriptionItem(prescription_id=1, drug="راميبريل", strength="5mg",
                                   dosage="قرص مساءً", duration="مستمر", qty=28))

    db.add(models.Consent(id=1, patient_name="الحاج بلقاسم سليماني", ref="CN-20260920-000142",
                          type="record", grantor="الحاج بلقاسم سليماني (توقيع رقمي)",
                          granted_to="رعايتي DZ + الفريق المعالج + صيدلية الإحسان",
                          scope="الاطلاع على الملف الطبي الموحد للعلاج والصرف", signed=True,
                          expires_on="2027-09-20"))

    db.add(models.CarePlan(id=1, patient_name="الحاج بلقاسم سليماني",
                           doctor_name="د. بن عباس إلهام", title="خطة ما بعد الاستقرار",
                           summary="المتابعة الشهرية وتعديل الجرعات بمراقبة الغليسيميا.",
                           goals_json='[{"g":"مراقبة الغليسيميا الصائم أسبوعياً","done":false},{"g":"المشي 20 دقيقة يومياً","done":false},{"g":"مراجعة الطبيب بعد 21 يوم","done":false}]',
                           schedule_json='[{"task":"قياس صباحي","when":"كل يوم 07:00"},{"task":"جرعة غليمبريد","when":"بعد الفطور"},{"task":"معاينة شهرية","when":"كل 30 يوم"}]'))

    db.add(models.PsychScreening(id=1, patient_name="family_1", kind="caregiver", score=11,
                                 level="moderate",
                                 advice="إرهاق متوسط — نظّم وقتك وشارك المهام مع الجمعية أو الفريق",
                                 answers_json="[2,3,1,2,3]"))

    db.add(models.TelePsychSession(id=1, patient_name="family_1", specialist="د. نفسي مناوب",
                                   kind="video", slot="2026-10-02 10:00", reason="دعم مقدم الرعاية",
                                   status="pending", created_by="عمر بن يوسف"))


async def seed_wilayas(db: AsyncSession) -> dict[str, int]:
    inst = {code: code for code in [1]}
    for code, ar, fr, lat, lng in WILAYAS:
        db.add(models.Wilaya(code=code, name_ar=ar, name_fr=fr, lat=lat, lng=lng))
    return inst


async def seed_users(db: AsyncSession) -> dict[str, int]:
    rows = [
        ("admin", "admin", "المدير الوطني", "admin@vitalink.dz", "0551000101", 16, "وزارة الصحة والسكان", "avatar-1"),
        ("admin2", "admin", "مساعد المدير الوطني", "coadmin@vitalink.dz", "0551000102", 47, "مديرية الصحة — غرداية", "avatar-3"),
        ("doctor_1", "doctor", "د. بن عباس إلهام", "doctor@vitalink.dz", "0555001102", 47, "مستشفى إبراهيم ترشين — غرداية", "avatar-2"),
        ("doctor_2", "doctor", "د. مرابط حسين", "doctor2@vitalink.dz", "0555001103", 47, "زلفانة — غرداية", "avatar-3"),
        ("nurse_1", "nurse", "الممرضة فاطمة الزهراء عيسى", "nurse@vitalink.dz", "0555002202", 47, "الوحدة الميدانية للتمريض المنزلي — غرداية", "avatar-4"),
        ("nurse_2", "nurse", "ياسين عمارة", "nurse2@vitalink.dz", "0555002203", 31, "الوحدة المتنقلة — وهران", "avatar-3"),
        ("patient_1", "patient", "الحاج بلقاسم سليماني", "patient@vitalink.dz", "0661112233", 47, "التمريض المنزلي — غرداية", "avatar-2"),
        ("family_1", "family", "عمر بن يوسف", "family@vitalink.dz", "0661998877", 47, "مرافق عائلي", "avatar-5"),
        ("dass_1", "dass", "فاطمة زهرة", "dass@social.gov.dz", "0555003303", 47, "مديرية النشاط الاجتماعي — غرداية", "avatar-4"),
        ("agency_1", "agency", "وكالة صحارى فيتا", "agency@vitalink.dz", "0555004404", 47, "وكالة صحارى فيتا — غرداية", "avatar-1"),
        ("thermal_1", "thermal", "فندق زلفانة بالم", "thermal@vitalink.dz", "0555005505", 47, "المحطة الحموية زلفانة — غرداية", "avatar-4"),
        ("researcher_1", "researcher", "رجاء بن إسماعيل", "rajaaben1805@gmail.com", "0662004455", 47, "جامعة غرداية — إدارة أعمال سياحية", "avatar-5"),
    ]
    inst = {}
    for username, role, name, email, phone, wil, facility, avatar in rows:
        u = models.User(
            username=username,
            password_hash=hash_password(DEFAULT_PASSWORD),
            role=role,
            name=name,
            email=email,
            phone=phone,
            wilaya_id=wil,
            facility=facility,
            avatar=avatar,
        )
        db.add(u)
        await db.flush()
        inst[username] = u.id
    return inst


async def seed_institutions(db: AsyncSession, users: dict[str, int]) -> dict[int, int]:
    rows = [
        ("مستشفى إبراهيم ترشين", "hospital", "غرداية", 47, 32.49, 3.67, "029889911", True),
        ("الوحدة الميدانية للتمريض المنزلي", "unit", "غرداية", 47, 32.3850, 3.7850, "029889912", True),
        ("المركز الاستشفائي الجامعي مصطفى باشا", "hospital", "الجزائر", 16, 36.75, 3.06, "021234567", True),
        ("مستشفى الأغواط", "hospital", "الأغواط", 3, 33.80, 2.87, "029911223", True),
        ("الوحدة الميدانية للرعاية المنزلية", "unit", "ورقلة", 30, 31.95, 5.32, "029912334", True),
        ("الوحدة الميدانية للرعاية المنزلية", "unit", "تقرت", 55, 33.10, 6.07, "029913445", True),
        ("مستشفى الوادي", "hospital", "الوادي", 39, 33.36, 6.86, "032222333", True),
        ("الوحدة الميدانية للرعاية المنزلية", "unit", "المنيعة", 57, 30.57, 2.88, "029114556", True),
        ("مركز زلفانة الحراري", "clinic", "زلفانة", 47, 32.92, 3.29, "029115667", True),
        ("المحطة الحموية بوحنيفية", "clinic", "بوحنيفية — معسكر", 29, 35.31, 0.05, "029116778", True),
    ]
    inst = {}
    for i, (name, typ, city, wil, lat, lng, phone, refers) in enumerate(rows, start=1):
        it = models.Institution(id=i, name=name, type=typ, city=city, wilaya_id=wil, lat=lat, lng=lng, phone=phone, refers=refers)
        db.add(it)
        inst[i] = i
    return inst


async def seed_staff(db: AsyncSession, users: dict[str, int]):
    insts = {i: i for i in range(1, 11)}
    rows = [
        ("د. بن عباس إلهام", "doctor", "أخصائية أمراض الباطنية والتأهيل", 1, 47, "0555001102", 18, True),
        ("د. مرابط حسين", "doctor", "أخصائي أمراض الباطنية", 9, 47, "0555001103", 12, True),
        ("د. كريم يوسف", "doctor", "أخصائي أمراض السكري والغدد", 2, 47, "0555001104", 9, False),
        ("د. سلمى قاضي", "doctor", "أخصائية طب الشيخوخة", 4, 3, "0555001105", 15, True),
        ("د. نور الدين بلخير", "doctor", "أخصائي أمراض المفاصل والروماتيزم", 7, 39, "0555001106", 11, False),
        ("د. حكيم معمر", "doctor", "أخصائي طب عام — متابعة مزمنة", 5, 30, "0555001107", 8, True),
        ("الممرضة فاطمة الزهراء عيسى", "nurse", "ممرضة رعاية منزلية وكبار السن", 2, 47, "0555002202", 24, True),
        ("الممرض صالح بوعلام", "nurse", "ممرض رعاية منزلية — مرضى مزمنون", 2, 47, "0555002204", 17, True),
        ("الممرضة عائشة ناصف", "nurse", "ممرضة رعاية منزلية — مسنون معزولون", 8, 55, "0555002205", 14, False),
        ("الممرض عبد القادر حمياني", "nurse", "ممرض متعدد التخصصات", 5, 30, "0555002206", 10, True),
        ("الممرضة زهرة بومدين", "nurse", "ممرضة رعاية منزلية", 8, 57, "0555002207", 7, True),
        ("الممرضة خديجة العربي", "nurse", "ممرضة رعاية منزلية وكبار السن", 4, 3, "0555002208", 13, False),
        ("الممرض إلياس زروقي", "nurse", "ممرض إسعافات وتأهيل", 9, 47, "0555002209", 6, True),
        ("الممرضة رقية قاسمي", "nurse", "ممرضة متابعة حالات السكري", 8, 55, "0555002210", 9, True),
    ]
    inst = {1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10}
    for i, (name, kind, spec, inst_id, wil, phone, pc, verified) in enumerate(rows, start=1):
        db.add(models.StaffMember(
            id=i, full_name=name, kind=kind, specialty=spec,
            institution_id=inst_id, wilaya_id=wil, phone=phone,
            patients_count=pc, active=True,
            license_doc=f"license_{i}.pdf",
            license_status="verified" if verified else "pending",
            verified_by="المدير الوطني" if verified else "",
        ))
        inst[i] = inst_id


async def seed_referrals(db: AsyncSession, users: dict[str, int]):
    rows = [
        ("الحاج بلقاسم سليماني", 2, 1, "تكرار ارتفاع السكر مع آلام مفاصل حادة",
         "غليسيميا متكررة 2.3 g/L رغم العلاج، مع تيبّس مفاصل يستدعي معاينة مختصة.", "pending"),
        ("الخالة خديجة باحمد", 2, 1, "قصور قلبي حركة محدودة — تقييم عام",
         "ضيق تنفس مع وذمة أطراف سفلى، استدعاء تخطيط قلب وفحص قلبية.", "pending"),
        ("الحاج محمد بن أحمد", 5, 1, "ارتفاع ضغط غير منضبط رغم البروتوكول",
         "تعديل البروتوكول العلاجي بعد فشل الخط الأول.", "pending"),
        ("مرابط زهرة", 1, 9, "إحالة سياحة علاجية — سكري + حمام معدني",
         "مصاب سكري مستقر، موصى بالمسار الحموي بزلفانة مع مرافق صحي.", "pending"),
        ("بن سالم خديجة", 4, 3, "إعادة تأهيل حركي وتقييم وظيفي", "تحويل لوحدة الأغواط لمتابعة التأهيل.", "accepted"),
        ("قاسم عبد الرحمن", 6, 7, "متابعة قلبية تخصصية", "قبوله في مستشفى الوادي وضبط البروتوكول.", "accepted"),
    ]
    inst = {1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10}
    for i, (patient, frm, to, reason, note, status) in enumerate(rows, start=1):
        db.add(models.Referral(
            id=i, patient_name=patient, from_institution_id=frm, to_institution_id=to,
            reason=reason, medical_note=note, status=status,
            severity="red" if (i in (1, 2)) else "normal",
            sla_hours=(26.5 if status == "accepted" and i in (5, 6) else None),
            created_by=users.get("nurse_1"),
            assigned_doctor=(f"د. بن عباس إلهام" if i == 1 else "د. مرابط حسين" if i in (2, 3) else ""),
            decided_by=("د. بن عباس إلهام" if status in ("accepted", "rejected") else ""),
        ))


async def seed_associations(db: AsyncSession, users: dict[str, int]):
    rows = [
        ("جمعية الإحسان لرعاية المسنين", 47, 42, 380, 9, 4850, 4.9),
        ("جمعية المستقبل للتطوع الصحي", 47, 30, 264, 7, 3315, 3.3),
        ("جمعية الرحمة للرعاية المنزلية", 30, 25, 198, 5, 2480, 2.5),
        ("جمعية الكرامة لأهل تقرت", 55, 22, 175, 6, 2195, 2.2),
        ("جمعية العون الميداني — الوادي", 39, 28, 210, 6, 2610, 2.6),
        ("جمعية ألفة — الأغواط", 3, 18, 132, 4, 1650, 1.7),
        ("جمعية النسمة — المنيعة", 57, 15, 96, 3, 1170, 1.2),
    ]
    for i, (name, wil, volunteers, visits, activities, points, _) in enumerate(rows, start=1):
        stars = stars_from_points(points)
        db.add(models.Association(
            id=i, name=name, wilaya_id=wil, volunteers=volunteers, visits=visits,
            activities=activities, points=points, stars=stars,
        ))


async def seed_links(db: AsyncSession):
    pairs = [(2, 1), (2, 9), (2, 3), (5, 1), (6, 7), (4, 3), (8, 7)]
    for i, (a, b) in enumerate(pairs, start=1):
        db.add(models.InstitutionLink(id=i, institution_a_id=a, institution_b_id=b, active=True))


# =================  المرحلة 1: بيانات المتابعة و"من نحن" =================

async def seed_followups(db: AsyncSession, users: dict[str, int]):
    rows = [
        ("الحاج بلقاسم سليماني", 1, "consultation", "2026-09-20", "د. بن عباس إلهام",
         "معاينة شهرية — استقرار نسبي في الغليسيميا",
         "يشتكي من آلام مفاصل خفيفة صباحية تُزول مع الحركة.",
         "TA 13/8، نبض 78:د، غليسيميا 1.9 g/L، سكر عشوائي.",
         {"pulse": 78, "bpSys": 130, "bpDia": 80, "temp": 36.7, "spO2": 97, "sugar": 1.9},
         ["غليمبريد 2mg", "ميتفورمين 500mg", "راميبريل 5mg"],
         [{"name": "courbe_glycemie.png", "dataUrl": "data:image/png;base64,iVBORw0KGgo="}],
         "د. بن عباس إلهام"),
        ("الخالة خديجة باحمد", 2, "nursing", "2026-09-21", "الممرضة فاطمة الزهراء عيسى",
         "زيارة منزلية — متابعة قصور القلب",
         "تحسّن طفيف مع الاستمرار في أملاح فوروسيميد، يُنصح بتقليل الملح.",
         "وذمة خفيفة بالكاحلين، ضيق تنفس أثناء المجهود.",
         {"pulse": 84, "bpSys": 148, "bpDia": 92, "temp": 36.5, "spO2": 94, "sugar": 1.2},
         ["فوروسيميد 40mg", "بيسوبرولول 2.5mg"],
         [],
         "الممرضة فاطمة الزهراء عيسى"),
        ("الحاج محمد بن أحمد", 3, "vitals", "2026-09-22", "الممرض صالح بوعلام",
         "قياس مؤشرات حيوية صباحي",
         "", "ضغط مرتفع رغم البروتوكول — يوصى بتعديل العلاج.",
         {"pulse": 88, "bpSys": 162, "bpDia": 101, "temp": 36.8, "spO2": 96, "sugar": 1.1},
         ["أملوديبين 10mg", "فالسارتان 160mg"],
         [], "الممرض صالح بوعلام"),
        ("مرابط زهرة", 4, "medication", "2026-09-23", "د. مرابط حسين",
         "وصفة سياحة علاجية — مرشّحة لمسار زلفانة الحموي",
         "مصاب سكري مستقر, تسجيل بروتوكول الحجز.",
         "غليسيميا صائم 1.1 g/L.",
         {"pulse": 72, "bpSys": 120, "bpDia": 75, "temp": 36.6, "spO2": 98, "sugar": 1.1},
         ["غليمبريد 1mg", "ميتفورمين 500mg"],
         [], "د. مرابط حسين"),
    ]
    for i, (patient, ref, kind, date, author, summary, subj, obj, vitals, meds, atts, signed) in enumerate(rows, start=1):
        db.add(models.FollowupRecord(
            id=i, patient_name=patient, referral_id=ref, kind=kind, date=date, author=author,
            summary=summary, subjective=subj, objective=obj,
            vitals_json=str(vitals).replace("'", '"'),
            medications_json=str(meds),
            attachments_json=str(atts),
            signed_by=signed, signed_at=models._now(),
        ))


async def seed_about(db: AsyncSession):
    db.add(models.SiteContent(id=1, key="about", title="من نحن — رعايتي DZ",
        body_json='[{"h":"رؤية المنظومة","p":"منظومة وطنية موحدة تربط الدولة بالقطاع الجمعوي والمؤسسات الصحية لتقديم رعاية موصولة لكبار السن في الجزائر."},{"h":"الهدف","p":"نقل الخدمة الطبية والتمريضية إلى منازل المسنين والمعزولين، ومتابعة ملفهم الطبي بشكل آلي وموثّق ومتواصل."},{"h":"قيمة مضافة","p":"تنسيق حقيقي بين الطبيب، الممرض المتنقل، المستشفيات، الجمعيات النشطة ووكالات السياحة العلاجية."}]',
        updated_by="النظام"))
    db.add(models.SiteContent(id=2, key="researcher", title="السيرة الذاتية — رجاء بن إسماعيل",
        body_json='[{"h":"الباحثة","p":"رجاء بن إسماعيل — طالبة دراسات عليا في إدارة الأعمال السياحية، جامعة غرداية."},{"h":"فكرة المذكرة","p":"دور التكنولوجيا في تطوير السياحة العلاجية والرعاية الصحية المنزلية في المناطق الصحراوية، من خلال منظومة موحدة تدمج القطاع الصحي والجمعوي."},{"h":"المراسلة الأكاديمية","p":"rajaaben1805@gmail.com"}]',
        updated_by="النظام"))


async def seed_shifts(db: AsyncSession):
    rows = [
        (1, "2026-09-28", "morning", "قسم الباطنية", ""),
        (2, "2026-09-28", "evening", "زلفانة الحراري", "متابعة حالات الحمّام المعدني"),
        (7, "2026-09-28", "morning", "الرعاية المنزلية — غرداية", "زيارات ميدانية"),
        (8, "2026-09-28", "night", "الاستعجالات الميدانية", "مناوبة ليلية"),
        (3, "2026-09-29", "morning", "قسم الغدد", "عيادة السكري"),
        (10, "2026-09-30", "evening", "الوحدة المتنقلة — ورقلة", ""),
    ]
    for i, (staff, date, shift, unit, note) in enumerate(rows, start=1):
        db.add(models.DutyShift(id=i, staff_id=staff, date=date, shift=shift, unit=unit, note=note))


async def seed_zones(db: AsyncSession):
    rows = [
        ("نطاق غرداية الحضري", 47, 32.491, 3.673, 15),
        ("نطاق زلفانة الحموي", 47, 32.95, 3.24, 12),
        ("نطاق ورقلة الميداني", 30, 31.950, 5.320, 18),
        ("نطاق تقرت", 55, 33.100, 6.070, 12),
    ]
    for i, (name, wil, lat, lng, rad) in enumerate(rows, start=1):
        db.add(models.GeoZone(id=i, name=name, wilaya_code=wil, lat=lat, lng=lng, radius_km=rad, enabled=True))


# =================  المرحلة 2: بيانات السياحة العلاجية =================

async def seed_tourism(db: AsyncSession, users: dict[str, int]):
    for i, (name, lic, wil, city, phone, desc) in enumerate([
        ("وكالة صحارى فيتا", "AG-2026-047", 47, "غرداية", "0555004404", "رحلات علاجية منظمة للحمامات المعدنية والمراكز الحموية بمرافقة طبية."),
        ("وكالة الأمل للسفر العلاجي", "AG-2026-118", 16, "الجزائر", "021447766", "حزم العلاج الحراري والتأهيل مع إقامة فندقية ومرافقة صحية."),
    ], start=1):
        db.add(models.AgencyProfile(id=i, user_id=users.get("agency_1") if i == 1 else None,
                                    name=name, license_no=lic, wilaya_id=wil, city=city, phone=phone, desc=desc))

    db.add(models.FleetVehicle(id=1, agency_id=1, kind="ambulance", plate="غ ر 45817", seats=4, medical=True))
    db.add(models.FleetVehicle(id=2, agency_id=1, kind="medical_bus", plate="غ ر 90324", seats=14, medical=True))
    db.add(models.FleetVehicle(id=3, agency_id=2, kind="minibus", plate="16 ص 77120", seats=9, medical=False))
    db.add(models.TourGuide(id=1, agency_id=1, name="أحمد بلحاج", langs="العربية، الفرنسية، الإنجليزية", phone="0556002211", license="مؤهل إرشاد طبي"))
    db.add(models.TourGuide(id=2, agency_id=1, name="سارة مقراني", langs="العربية، الفرنسية، الألمانية", phone="0556002212", license="مرشدة سياحية"))
    db.add(models.TourGuide(id=3, agency_id=2, name="يوسف حداد", langs="العربية، الفرنسية", phone="021447788", license="مرشد سياحي"))

    stations = [
        (1, "حمام زلفانة الحراري", 47, 32.950, 3.240, 42, "أمراض المفاصل، الروماتيزم، التأهيل الحركي", "مسابح معدنية داخلية/خارجية، إقامة، تغذية"),
        (2, "حمام بوحنيفية", 29, 35.310, 0.050, 45, "الأمراض الجلدية، الروماتيزم", "وحدات حمام، رعاية طبية 24س"),
        (3, "حمام الشلالة", 47, 33.060, 2.890, 38, "تنشيط الدورة الدموية، الألم العضلي", "حجيرة حمام تراثية"),
        (4, "حمام أولاد يحيى", 18, 36.040, 5.410, 44, "أمراض العمود الفقري، العصبية", "مركز للراحة والتأهيل"),
    ]
    for i, (sid, name, wil, lat, lng, temp, tr, svc) in enumerate(stations, start=1):
        db.add(models.ThermalStation(id=sid, name=name, wilaya_id=wil, lat=lat, lng=lng, water_temp=temp,
                                     treatments=tr, services=svc, rating_avg=4.3))

    db.add(models.HealthPackage(id=1, agency_id=1, title="أسبوع التأهيل الحموي — زلفانة", destination="غرداية",
                                nights=7, price=48000, station_id=1,
                                includes="إقامة شبه كاملة + 10 جلسات حمام معدني + متابع طبي يومي + نقل مكيّف",
                                treatments="أمراض المفاصل، الروماتيزم"))
    db.add(models.HealthPackage(id=2, agency_id=1, title="عطلة علاجية — بوحنيفية", destination="معسكر",
                                nights=5, price=39000, station_id=2,
                                includes="إقامة + 8 جلسات + خطة غذائية + مرافقة",
                                treatments="الأمراض الجلدية، الروماتيزم"))
    db.add(models.HealthPackage(id=3, agency_id=2, title="برنامج التأهيل العصبي — أولاد يحيى",
                                destination="جيجل", nights=10, price=62000, station_id=4,
                                includes="إقامة كاملة + 14 جلسة + جلسات علاج طبيعي",
                                treatments="العمود الفقري، العصبية"))

    db.add(models.ThermalBooking(id=1, station_id=1, package_id=1, patient_name="مرابط زهرة",
                                 agency_id=1, date_start="2026-10-05", date_end="2026-10-12", price=48000,
                                 insurance=True, doctor_approved=True, doctor_name="د. مرابط حسين",
                                 status="approved", created_by="وكالة صحارى فيتا"))
    db.add(models.ThermalBooking(id=2, station_id=2, package_id=2, patient_name="بن سالم خديجة",
                                 agency_id=1, date_start="2026-11-01", date_end="2026-11-06", price=39000,
                                 insurance=False, doctor_approved=None, status="pending",
                                 created_by="وكالة صحارى فيتا"))
    db.add(models.ThermalBooking(id=3, station_id=4, package_id=3, patient_name="قاسم عبد الرحمن",
                                 agency_id=2, date_start="2026-10-20", date_end="2026-10-30", price=62000,
                                 insurance=True, doctor_approved=True, doctor_name="د. بن عباس إلهام",
                                 status="approved", created_by="وكالة الأمل للسفر العلاجي"))

    db.add(models.Review(id=1, target_type="station", target_id=1, user_name="مرابط زهرة",
                         stars=5, comment="مياه معدنية ممتازة وتكفل جيد، تحسن ملحوظ بالمفاصل."))
    db.add(models.Review(id=2, target_type="package", target_id=1, user_name="الحاج محمد بن أحمد",
                         stars=4, comment="برنامج منظم ونقل مريح، نتمنى جلسات أكثر."))
    db.add(models.Review(id=3, target_type="guide", target_id=1, user_name="قاسم عبد الرحمن",
                         stars=5, comment="مرشد محترف ويتحدث الفرنسية بطلاقة."))


async def _demo() -> None:
    async with SessionLocal() as db:
        ok = await seed_if_empty(db)
        print("Seeded:" if ok else "Already seeded.")


if __name__ == "__main__":
    asyncio.run(_demo())