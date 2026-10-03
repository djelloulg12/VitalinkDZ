from __future__ import annotations

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .database import SessionLocal
from .models import User
from .security import decode_token


async def get_db():
    async with SessionLocal() as db:
        yield db


def current_user(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="مطلوب تسجيل الدخول")
    payload = decode_token(authorization.removeprefix("Bearer ").strip())
    if not payload:
        raise HTTPException(status_code=401, detail="الجلسة منتهية — سجّل الدخول مجدداً")
    return payload


def require_role(*roles: str):
    def _dep(payload: dict = Depends(current_user)):
        if payload.get("role") not in roles:
            raise HTTPException(status_code=403, detail="غير مصرح لهذا الدور")
        return payload

    return _dep


async def get_user_row(db: AsyncSession, user_id: int | None) -> User | None:
    if not user_id:
        return None
    res = await db.execute(select(User).where(User.id == user_id))
    return res.scalar_one_or_none()