"""محرك الإنذار التنبؤي للمؤشرات الحيوية — رعايتي DZ.

قاعدة قرار بسيطة (Adult) تُحلل القياسات وتنشئ إنذارات (info/warning/danger)
بشكل ذاتي عند تسجيل متابعة جديدة، وتُقدم واجهة للاطلاع والإقرار من الطبيب/الإدارة.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..audit import record
from ..deps import current_user, get_db
from ..models import VitalAlert

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


# ---------- قواعد التحليل التنبؤي ----------

def _band(value: float | None, low_danger, low_warn, high_warn, high_danger, unit: str = ""):
    """يُعيد مستوى إنذار اعتماداً على عتبتين (danger / warning) على كل جانب."""
    level, disp = None, str(value) if value is not None else "-"
    if value is None:
        return None
    disp = f"{value:g}{unit}"
    if value <= low_danger or value >= high_danger:
        return "danger", disp
    if value <= low_warn or value >= high_warn:
        return "warning", disp
    return None


def analyze(vitals: dict, patient_name: str = "") -> list[dict]:
    """يُحلل القياسات ويعيد قائمة {level, metric, value, message}."""
    out: list[dict] = []
    p = patient_name or "مريض"

    def _push(metric: str, name: str, res):
        if not res:
            return
        level, disp = res
        msg = {
            "danger": f"⚠️ مؤشر حرج ({name}): {disp}",
            "warning": f"تنبيه ({name}): {disp}",
        }[level]
        out.append({"level": level, "metric": metric, "value": disp, "message": msg})

    try:
        b = _band(float(vitals.get("pulse") or 0) or None, 40, 50, 100, 130, " ن/د")
        _push("pulse", "نبض القلب", b)
    except (TypeError, ValueError):
        pass

    try:
        sys = float(vitals.get("bpSys") or 0) or None
        dia = float(vitals.get("bpDia") or 0) or None
        if dia:
            b = _band(dia, 60, 60, 95, 115, " ملم ز")
            if b:
                _push("bp", f"ضغط الدم {sys:g}/{dia:g}", b)
        if sys:
            b = _band(sys, 80, 90, 160, 185, "")
            if b:
                _push("bp", f"ضغط الدم الانقباضي {sys:g}", b)
    except (TypeError, ValueError):
        pass

    try:
        o2 = float(vitals.get("spO2") or 0) or None
        if o2 and o2 <= 93:
            level = "danger" if o2 < 90 else "warning"
            out.append({"level": level, "metric": "spO2", "value": f"{o2:g}%",
                        "message": f"{'⚠️ نقص حاد في الأكسجين' if level == 'danger' else 'تنبيه انخفاض الأكسجين'}: {o2:g}%"})
    except (TypeError, ValueError):
        pass

    try:
        t = float(vitals.get("temp") or 0) or None
        if t:
            if t >= 40 or t <= 35:
                out.append({"level": "danger", "metric": "temp", "value": f"{t:g}°", "message": f"⚠️ حرارة الجسم حرجة: {t:g}°"})
            elif t >= 38.5 or t <= 35.5:
                out.append({"level": "warning", "metric": "temp", "value": f"{t:g}°", "message": f"تنبيه حرارة الجسم: {t:g}°"})
    except (TypeError, ValueError):
        pass

    try:
        su = float(vitals.get("sugar") or 0) or None
        if su:
            if su < 60 or su > 300:
                out.append({"level": "danger", "metric": "sugar", "value": f"{su:g}", "message": f"⚠️ سكر الدم حرج: {su:g} (ملغ/دل)"})
            elif su < 80 or su > 220:
                out.append({"level": "warning", "metric": "sugar", "value": f"{su:g}", "message": f"تنبيه سكر الدم: {su:g} (ملغ/دل)"})
    except (TypeError, ValueError):
        pass

    return out


async def analyze_and_persist(db: AsyncSession, patient_name: str, vitals: dict, followup_id: int | None = None) -> list[VitalAlert]:
    """يحلل القياسات ويخزّن الإنذارات المستجدة (دون تكرار للإنذار المفتوح نفسه)."""
    created: list[VitalAlert] = []
    for a in analyze(vitals, patient_name):
        res = await db.execute(
            select(VitalAlert).where(
                VitalAlert.patient_name == patient_name,
                VitalAlert.metric == a["metric"],
                VitalAlert.level == a["level"],
                VitalAlert.acknowledged.is_(False),
            )
        )
        if res.scalars().first():
            continue
        va = VitalAlert(**a, patient_name=patient_name, followup_id=followup_id)
        db.add(va)
        created.append(va)
    if created:
        await db.flush()
    return created


async def _ser(a: VitalAlert) -> dict:
    return {
        "id": a.id, "patient_name": a.patient_name, "level": a.level,
        "metric": a.metric, "value": a.value, "message": a.message,
        "followup_id": a.followup_id, "acknowledged": a.acknowledged,
        "ack_by": a.ack_by,
        "acked_at": a.acked_at.isoformat() if a.acked_at else None,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


# ---------- واجهات ----------

class CheckIn(BaseModel):
    patient_name: str = ""
    vitals: dict = {}


@router.post("/check")
async def check_vitals(body: CheckIn):
    """فحص فوري (بدون حفظ): يعيد الإنذارات المقترحة للقياسات المرسلة."""
    return {"danger": any(a["level"] == "danger" for a in analyze(body.vitals, body.patient_name)),
            "warning": any(a["level"] == "warning" for a in analyze(body.vitals, body.patient_name)),
            "alerts": analyze(body.vitals, body.patient_name)}


@router.get("")
async def list_alerts(
    open_only: bool = False,
    payload=Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(VitalAlert).order_by(VitalAlert.created_at.desc()).limit(200)
    if open_only:
        q = q.where(VitalAlert.acknowledged.is_(False))
    res = await db.execute(q)
    return [await _ser(a) for a in res.scalars().all()]


class AckIn(BaseModel):
    acknowledged: bool = True


@router.post("/{alert_id}/ack")
async def acknowledge_alert(
    alert_id: int,
    body: AckIn,
    payload=Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(VitalAlert).where(VitalAlert.id == alert_id))
    a = res.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="إنذار غير موجود")
    a.acknowledged = body.acknowledged
    a.ack_by = payload.get("name", "")
    a.acked_at = datetime.now(timezone.utc) if body.acknowledged else None
    await record(db, actor=a.ack_by, action="ack", entity="vital_alert",
                 entity_id=a.id, detail=f"إقرار إنذار {a.level} للمريض: {a.patient_name} ({a.metric})")
    await db.commit()
    await db.refresh(a)
    return await _ser(a)


@router.get("/today")
async def today_summary(db: AsyncSession = Depends(get_db)):
    """ملخص اليوم (بدون مصادقة) يستخدمه تطبيق كبار السن في الاستقبال."""
    from sqlalchemy import func
    today = date.today().isoformat()
    res = await db.execute(
        select(func.count(VitalAlert.id)).where(VitalAlert.created_at >= datetime.fromisoformat(f"{today}T00:00:00"))
    )
    return {"today": res.scalar_one() or 0}