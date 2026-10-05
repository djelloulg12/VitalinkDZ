"""الإشعارات الموحّدة داخل المنصة — موجّهة للدور، تُقرأ من الجرس العلوي.

تُستعمل `push` من أي روتير لإشعار فريق (مثل: الإحالات وحجوزات السياحة).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import current_user, get_db
from ..models import Notification

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


async def push(
    db: AsyncSession,
    *,
    role: str,
    title: str,
    body: str = "",
    icon: str = "🔔",
    entity: str = "",
    entity_id: int = 0,
    link: str = "",
) -> Notification:
    """يُنشئ إشعاراً موجَّهاً لدور محدد (admin/doctor/nurse/...)."""
    n = Notification(role=role, title=title, body=body, icon=icon,
                     entity=entity, entity_id=entity_id, link=link)
    db.add(n)
    return n


def _ser(n: Notification) -> dict:
    return {
        "id": n.id, "role": n.role, "title": n.title, "body": n.body, "icon": n.icon,
        "entity": n.entity, "entity_id": n.entity_id, "link": n.link, "read": n.read,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


@router.get("")
async def list_notifications(payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    role = payload.get("role", "")
    res = await db.execute(
        select(Notification).where(Notification.role == role)
        .order_by(Notification.created_at.desc()).limit(60)
    )
    return [_ser(n) for n in res.scalars().all()]


@router.get("/unread-count")
async def unread_count(payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    n = (await db.execute(select(func.count(Notification.id)).where(
        Notification.role == payload.get("role", ""), Notification.read.is_(False)))).scalar_one() or 0
    return {"count": n}


@router.post("/{notif_id}/read")
async def mark_read(notif_id: int, payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Notification).where(
        Notification.id == notif_id, Notification.role == payload.get("role", "")))
    n = res.scalar_one_or_none()
    if not n:
        raise HTTPException(status_code=404, detail="غير موجود")
    n.read = True
    await db.commit()
    return {"ok": True}


@router.post("/read-all")
async def mark_all_read(payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    role = payload.get("role", "")
    rows = (await db.execute(
        select(Notification).where(Notification.role == role, Notification.read.is_(False)))).scalars().all()
    for n in rows:
        n.read = True
    await db.commit()
    return {"ok": True, "updated": len(rows)}