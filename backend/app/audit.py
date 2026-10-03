from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from .models import AuditEvent


def _short(v: object) -> str:
    s = str(v)
    return s if len(s) <= 120 else s[:117] + "..."


async def record(
    db: AsyncSession,
    *,
    actor: str,
    action: str,
    entity: str,
    entity_id: int,
    detail: str = "",
    old: object = None,
    new: object = None,
) -> None:
    db.add(AuditEvent(
        actor=actor,
        action=action,
        entity=entity,
        entity_id=entity_id,
        detail=detail,
        old_value=_short(old) if old is not None else "",
        new_value=_short(new) if new is not None else "",
    ))