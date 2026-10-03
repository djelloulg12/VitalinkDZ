from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import current_user, get_db
from ..models import AuditEvent

router = APIRouter(prefix="/api/audit", tags=["audit"])

ACTION_ICO = {
    "create": "➕", "update": "✏️", "delete": "🗑️", "decide": "✅", "evaluate": "🎯", "link": "🔗",
}


@router.get("")
async def list_audit(
    payload=Depends(current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 200,
):
    if payload.get("role") != "admin":
        return []
    res = await db.execute(select(AuditEvent).order_by(AuditEvent.id.desc()).limit(limit))
    return [
        {
            "id": e.id, "actor": e.actor, "action": e.action,
            "action_ico": ACTION_ICO.get(e.action, "•"),
            "entity": e.entity, "entity_id": e.entity_id, "detail": e.detail,
            "old_value": e.old_value, "new_value": e.new_value,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in res.scalars().all()
    ]