"""الصحة النفسية عن بُعد ورعاية مقدم الرعاية — المرحلة 2α.

- فحص ذاتي قصير (PHQ/GAD) بمنسوب خطر + نصيحة؛
- طلب جلسة استشارة نفسية عن بُعد؛
- فحص إرهاق مقدم الرعاية (اختصار Zarit) مع دليل عملي.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..audit import record
from ..deps import current_user, get_db
from ..models import PsychScreening, TelePsychSession

router = APIRouter(prefix="/api/psych", tags=["mental-health"])

RESOURCES = [
    {"id": 1, "icon": "🧘", "title": "تمارين التنفس 4-7-8",
     "body": "شهيق 4 ثوانٍ، حبس 7، زفير 8 — ثلاث مرات يهدئ الجهاز العصبي."},
    {"id": 2, "icon": "🌙", "title": "أساسيات النوم الصحي",
     "body": "تثبيت موعد النوم، إضاءة خافتة قبل بساعة، تقليل الكافيين بعد العصر."},
    {"id": 3, "icon": "🚶", "title": "المشي اليومي 20 دقيقة",
     "body": "بمعدل 5 أيام أسبوعياً يخفض أعراض القلق والاكتئاب بشكل ملموس."},
    {"id": 4, "icon": "✋", "title": "لا تُحمّل نفسك وحدك",
     "body": "قسّم المهام بين أفراد العائلة واحصل على يوم راحة أسبوعي — لست وحدك."},
]

PHQ_ITEMS = 9
GAD_ITEMS = 7


def _phq_level(score: int) -> tuple[str, str]:
    if score >= 15:
        return "severe", "نسبة مرتفعة — ننصح بمراجعة طبيب نفسي عاجلاً والتحدث مع محب"
    if score >= 10:
        return "moderate", "أعراض متوسطة — جلسات دعم منتظمة وتتبع يومي للمزاج"
    if score >= 5:
        return "mild", "أعراض خفيفة — أنشطة يومية وتمارين تنفس كافية"
    return "minimal", "لا مؤشرات على اضطراب — حافظ على عاداتك الصحية"


def _zarit_level(score: int) -> tuple[str, str]:
    if score >= 17:
        return "severe", "إرهاق مرتفع للمقدِّم — اطلب دعم عائلة/جمعية وأخذ فترات راحة إلزامية"
    if score >= 10:
        return "moderate", "إرهاق متوسط — نظّم وقتك وشارك المهام مع الجمعية أو الفريق"
    return "mild", "إرهاق خفيف — ممارسة خفيفة وجدولة راحة دورية"


class ScreenIn(BaseModel):
    patient_name: str
    kind: str = "phq"          # phq | gad | caregiver
    answers: list[int] = []    # درجة كل بند (0..3) أو (0..4) للـ caregiver


@router.post("/screen")
async def run_screening(body: ScreenIn, payload=Depends(current_user),
                        db: AsyncSession = Depends(get_db)):
    answers = list(body.answers or [])
    n = len(answers)
    if body.kind == "caregiver":
        if n < 1:
            raise HTTPException(status_code=422, detail="أعد اختبار مقدم الرعاية أولاً")
        score = sum(min(max(a, 0), 4) for a in answers)
        level, advice = _zarit_level(score)
    else:
        items = PHQ_ITEMS if body.kind == "phq" else GAD_ITEMS
        if n != items:
            raise HTTPException(status_code=422, detail=f"الفحص {body.kind} يتطلب {items} بنوداً")
        score = sum(min(max(a, 0), 3) for a in answers)
        level, advice = _phq_level(score)
    s = PsychScreening(patient_name=body.patient_name.strip() or payload.get("name", ""),
                       kind=body.kind, score=score, level=level, advice=advice,
                       answers_json=str(answers))
    db.add(s)
    await db.flush()
    await record(db, actor=payload.get("name", ""), action="create", entity="psych_screening",
                 entity_id=s.id, detail=f"فحص {s.kind}: {score} ({level})")
    await db.commit()
    return {"id": s.id, "score": score, "level": level, "advice": advice,
            "max": (17 if body.kind == "caregiver" else (PHQ_ITEMS * 3 if body.kind == "phq" else GAD_ITEMS * 3))}


@router.get("/screening")
async def list_screenings(patient: str = "", payload=Depends(current_user),
                          db: AsyncSession = Depends(get_db)):
    q = select(PsychScreening).order_by(PsychScreening.created_at.desc()).limit(200)
    if patient.strip():
        q = q.where(PsychScreening.patient_name.ilike(f"%{patient.strip()}%"))
    res = await db.execute(q)
    out = []
    for s in res.scalars().all():
        out.append({"id": s.id, "patient_name": s.patient_name, "kind": s.kind,
                    "score": s.score, "level": s.level, "advice": s.advice,
                    "created_at": s.created_at.isoformat() if s.created_at else None})
    return out


class SessionIn(BaseModel):
    patient_name: str
    specialist: str = ""
    kind: str = "video"    # video | voice | text
    slot: str = ""
    reason: str = ""


def _ser_s(s: TelePsychSession) -> dict:
    return {"id": s.id, "patient_name": s.patient_name, "specialist": s.specialist,
            "kind": s.kind, "slot": s.slot, "reason": s.reason, "status": s.status,
            "created_by": s.created_by,
            "created_at": s.created_at.isoformat() if s.created_at else None}


@router.post("/sessions")
async def request_session(body: SessionIn, payload=Depends(current_user),
                          db: AsyncSession = Depends(get_db)):
    s = TelePsychSession(patient_name=body.patient_name.strip() or payload.get("name", ""),
                         specialist=body.specialist or "د. نفسي مناوب", kind=body.kind,
                         slot=body.slot, reason=body.reason, created_by=payload.get("name", ""))
    db.add(s)
    await db.flush()
    await record(db, actor=payload.get("name", ""), action="create", entity="tele_session",
                 entity_id=s.id, detail=f"حجز جلسة {s.kind} — {s.slot or 'موعد قريب'}")
    await db.commit()
    return _ser_s(s)


@router.get("/sessions")
async def list_sessions(payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(TelePsychSession).order_by(TelePsychSession.created_at.desc()).limit(200))
    return [_ser_s(s) for s in res.scalars().all()]


class SessionPatch(BaseModel):
    status: str = "confirmed"


@router.post("/sessions/{sid}/status")
async def set_session_status(sid: int, body: SessionPatch, payload=Depends(current_user),
                             db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(TelePsychSession).where(TelePsychSession.id == sid))
    s = res.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="جلسة غير موجودة")
    s.status = body.status
    await db.commit()
    return _ser_s(s)


@router.get("/resources")
async def resources():
    return RESOURCES