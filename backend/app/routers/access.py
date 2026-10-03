"""كسر الزجاج (Break-Glass) — المرحلة 2α.

سيناريو: طبيب/ممرض موثوق، دون صلاحية دائمة، يحتاج وصولاً طارئًا لملف مريض
خارج النظام الاعتيادي. يرفع طلبًا <=> يتحقق النظام برمز OTP (قناة SMS — يُسلّم
هنا في بيئة العرض للتدريب) ثم يمنح وصولاً مؤقتًا مسجَّلًا قانونيًّا (Audit + Grant).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..audit import record
from ..deps import current_user, get_db
from ..models import BreakGlassEvent
from ..security import gen_otp, verify_otp

router = APIRouter(prefix="/api/access", tags=["break-glass"])

GRANT_MINUTES = 30


def _ser(bg: BreakGlassEvent, otp_plain: str = "") -> dict:
    return {"id": bg.id, "requester": bg.requester, "role": bg.role, "reason": bg.reason,
            "otp_plain": otp_plain, "otp_used": bg.otp_used, "status": bg.status,
            "expires_at": bg.expires_at.isoformat() if bg.expires_at else None,
            "granted_at": bg.granted_at.isoformat() if bg.granted_at else None,
            "released_at": bg.released_at.isoformat() if bg.released_at else None,
            "created_at": bg.created_at.isoformat() if bg.created_at else None}


class BgIn(BaseModel):
    reason: str = ""


@router.post("/break-glass")
async def request_break_glass(body: BgIn, payload=Depends(current_user),
                              db: AsyncSession = Depends(get_db)):
    if len(body.reason.strip()) < 8:
        raise HTTPException(status_code=422, detail="اذكر سبب الطوارئ بوضوح (8 أحرف على الأقل)")
    code, otp_hash = gen_otp()
    bg = BreakGlassEvent(requester=payload.get("name", ""), role=payload.get("role", ""),
                         reason=body.reason.strip(), otp_hash=otp_hash)
    db.add(bg)
    await db.flush()
    await record(db, actor=bg.requester, action="create", entity="break_glass",
                 entity_id=bg.id, detail=f"طلب وصول طارئ: {bg.reason}")
    await db.commit()
    return _ser(bg, otp_plain=code)


class VerifyIn(BaseModel):
    otp: str = ""


@router.post("/break-glass/{bg_id}/verify")
async def verify_break_glass(bg_id: int, body: VerifyIn, payload=Depends(current_user),
                             db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(BreakGlassEvent).where(BreakGlassEvent.id == bg_id))
    bg = res.scalar_one_or_none()
    if not bg:
        raise HTTPException(status_code=404, detail="طلب غير موجود")
    if bg.requester != payload.get("name", ""):
        raise HTTPException(status_code=403, detail="هذا الطلب ليس لك")
    if bg.status == "released":
        raise HTTPException(status_code=409, detail="تم إغلاق الوصول سابقاً")
    if not verify_otp(body.otp, bg.otp_hash):
        raise HTTPException(status_code=401, detail="رمز OTP غير صحيح")
    bg.otp_used = True
    now = datetime.now(timezone.utc)
    bg.status = "active"
    bg.granted_at = now
    bg.expires_at = now + timedelta(minutes=GRANT_MINUTES)
    await record(db, actor=bg.requester, action="update", entity="break_glass",
                 entity_id=bg.id, detail=f"وصول طارئ فعّل حتى {bg.expires_at.isoformat()}")
    await db.commit()
    return _ser(bg)


@router.get("/break-glass")
async def list_break_glass(payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(BreakGlassEvent).order_by(BreakGlassEvent.created_at.desc()).limit(100))
    return [_ser(bg) for bg in res.scalars().all()]


class ReleaseIn(BaseModel):
    note: str = ""


@router.post("/break-glass/{bg_id}/release")
async def release_break_glass(bg_id: int, body: ReleaseIn, payload=Depends(current_user),
                              db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(BreakGlassEvent).where(BreakGlassEvent.id == bg_id))
    bg = res.scalar_one_or_none()
    if not bg:
        raise HTTPException(status_code=404, detail="طلب غير موجود")
    bg.status = "released"
    bg.released_at = datetime.now(timezone.utc)
    await record(db, actor=payload.get("name", ""), action="update", entity="break_glass",
                 entity_id=bg.id, detail=f"إغلاق الوصول الطارئ: {body.note or 'نهاية المناوبة'}")
    await db.commit()
    return _ser(bg)