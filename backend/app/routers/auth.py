from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_db, current_user
from ..models import User
from ..security import create_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginBody(BaseModel):
    username: str
    password: str


@router.post("/login")
async def login(body: LoginBody, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(User).where(User.username == body.username))
    user = res.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="اسم المستخدم أو كلمة المرور غير صحيحة")
    token = create_token(user.id, user.role, user.name)
    return {"token": token, "user": user_public(user)}


def user_public(u: User) -> dict:
    return {
        "id": u.id, "username": u.username, "role": u.role, "name": u.name,
        "email": u.email, "phone": u.phone, "wilaya_id": u.wilaya_id,
        "facility": u.facility, "avatar": u.avatar,
    }


@router.get("/me")
async def me(payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(User).where(User.id == payload["uid"]))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="غير موجود")
    return user_public(user)