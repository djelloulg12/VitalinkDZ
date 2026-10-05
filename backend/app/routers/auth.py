from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..audit import record
from ..config import settings
from ..deps import current_user, get_db
from ..models import User
from ..security import create_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginBody(BaseModel):
    username: str
    password: str


class ChangePwdBody(BaseModel):
    old_password: str
    new_password: str


@router.post("/login")
async def login(body: LoginBody, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(User).where(User.username == body.username))
    user = res.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        await record(db, actor=body.username, action="login_failed", entity="auth",
                     entity_id=0, detail=f"محاولة دخول فاشلة بالمعرّف: {body.username}")
        await db.commit()
        raise HTTPException(status_code=401, detail="اسم المستخدم أو كلمة المرور غير صحيحة")
    must = bool(user.must_change_password) or settings.force_password_change
    token = create_token(user.id, user.role, user.name)
    await record(db, actor=user.name, action="login", entity="auth", entity_id=user.id,
                 detail=f"تسجيل دخول ناجح: {user.username} ({user.role})")
    await db.commit()
    return {"token": token, "user": user_public(user, must)}


def _must_change(u: User) -> bool:
    return bool(u.must_change_password) or settings.force_password_change


def user_public(u: User, must: bool | None = None) -> dict:
    return {
        "id": u.id, "username": u.username, "role": u.role, "name": u.name,
        "email": u.email, "phone": u.phone, "wilaya_id": u.wilaya_id,
        "facility": u.facility, "avatar": u.avatar,
        "must_change_password": _must_change(u) if must is None else must,
    }


@router.get("/me")
async def me(payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(User).where(User.id == payload["uid"]))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="غير موجود")
    return user_public(user)


@router.post("/change-password")
async def change_password(body: ChangePwdBody, payload=Depends(current_user),
                          db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(User).where(User.id == payload["uid"]))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="غير موجود")
    if not verify_password(body.old_password, user.password_hash):
        raise HTTPException(status_code=401, detail="كلمة المرور الحالية غير صحيحة")
    if len(body.new_password) < 6:
        raise HTTPException(status_code=422, detail="كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف")
    if verify_password(body.new_password, user.password_hash):
        raise HTTPException(status_code=422, detail="كلمة المرور الجديدة مطابقة للقديمة")
    user.password_hash = hash_password(body.new_password)
    user.must_change_password = False
    await record(db, actor=user.name, action="update", entity="user", entity_id=user.id,
                 detail="تغيير كلمة المرور — تأمين الحساب")
    await db.commit()
    return {"ok": True, "user": user_public(user, False)}