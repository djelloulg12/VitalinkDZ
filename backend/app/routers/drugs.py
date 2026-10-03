"""تنبيه تداخل الأدوية — قاعدة معرفة أولية قابلة للتوسع (أداة مساعدة لا تُغني عن الطبيب)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..audit import record
from ..deps import current_user, get_db

router = APIRouter(prefix="/api/drugs", tags=["drugs"])

SMART_PAIRS: list[dict] = [
    {"a": ["وارفارين", "الوارفارين", "كومادين"], "b": ["أسبرين", "أسبو", "كلوبيدوقرل", "هيبارين"],
     "level": "high", "advice": "خطر نزف حاد متراكم — يُمنع الجمع دون وصفة طبية مشددة ومراقبة INR."},
    {"a": ["ديجوكسين", "الديجوكسين"], "b": ["أميودارون", "هيدروكلوروثيازيد"],
     "level": "high", "advice": "يرفع مستوى الديجوكسين — خطر اضطراب نظم القلب."},
    {"a": ["الليثيوم", "ليثيوم"], "b": ["ديكلوفيناك", "إندوميتاسين", "إيبوبروفين"],
     "level": "high", "advice": "يُضعف تصفية الليثيوم — خطر تسمّم كِلوّي."},
    {"a": ["كلاريترومايسين"], "b": ["سيمفاستاتين", "أتورفاستاتين"],
     "level": "high", "advice": "اعتلال عضلي حاد ورابدوميوليز — يُمنع الجمع."},
    {"a": ["ميتفورمين", "الغليفاج"], "b": ["يود", "كونتراست"],
     "level": "medium", "advice": "خطر حمض لاكتيكي مع مادة التباين عند ضعف الكلى."},
    {"a": ["سيمفاستاتين", "أتورفاستاتين"], "b": ["الغريبفروت", "العنب الهندي"],
     "level": "medium", "advice": "يقلّل التمثيل الغذائي — يرفع خطر اعتلال العضلات."},
    {"a": ["كلورفينيرامين", "سيتريزين", "لوراتادين"], "b": ["ترامادول", "كودايين", "مورفين"],
     "level": "high", "advice": "تثبيط مشترك للجهاز العصبي — خطر تثبيط التنفس."},
    {"a": ["غليمبريد", "غليكلازيد", "ميتفورمين"], "b": ["كحول"],
     "level": "medium", "advice": "خطر هبوط سكري حاد — يمنع شرب الكحول أثناء العلاج."},
    {"a": ["إندوميتاسين", "ديكلوفيناك", "إيبوبروفين"], "b": ["فوروسيميد", "هيدروكلوروثيازيد"],
     "level": "medium", "advice": "يُضعف تأثير المدرات — خطر احتباس السوائل ورفع الضغط."},
    {"a": ["فينيتوين"], "b": ["إيزونيازيد", "ريفامبيسين"],
     "level": "medium", "advice": "تغير مستويات الفينيتويل — قد يلزم ضبط الجرعة."},
]


class DrugsIn(BaseModel):
    drugs: list[str] = []


def _norm(d: str) -> str:
    return d.strip().lower().replace("ال", "")


def _match(drug: str, names: list[str]) -> bool:
    n = _norm(drug)
    return any(n == _norm(x) or n in _norm(x) or _norm(x) in n for x in names)


@router.post("/check")
async def check_interactions(body: DrugsIn, payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    drugs = [d for d in body.drugs if d and d.strip()]
    found = []
    for rule in SMART_PAIRS:
        for d1 in drugs:
            if not _match(d1, rule["a"]):
                continue
            for d2 in drugs:
                if d1 == d2 or not _match(d2, rule["b"]):
                    continue
                found.append({"pair": f"{rule['a'][0]} + {rule['b'][0]}",
                              "level": rule.get("level", "medium"),
                              "advice": rule.get("advice", ""),
                              "drugs": [d1, d2]})
    seen, uniq = set(), []
    for f in found:
        key = (f["pair"], tuple(f["drugs"]))
        if key not in seen:
            seen.add(key)
            uniq.append(f)
    high = sum(1 for f in uniq if f["level"] == "high")
    if uniq and payload.get("role") in ("admin", "doctor"):
        await record(db, actor=payload.get("name", ""), action="check", entity="drugs",
                     entity_id=0,
                     detail=f"فحص تداخل أدوية: {len(drugs)} دواء → {len(uniq)} تنبيه ({high} خطر مرتفع)")
        await db.commit()
    return {
        "checked": drugs, "interactions": uniq, "high_risk": high,
        "safe": len(drugs) > 0 and not uniq,
        "advice": "أداة تنبيه مساعدة ولا تُغني عن المراجعة الطبية — برجاء مراجعة الطبيب في كل تغيير للخطة الدوائية.",
    }


@router.get("/knowledge")
async def knowledge(payload=Depends(current_user)):
    return {"count": len(SMART_PAIRS), "rules": SMART_PAIRS}