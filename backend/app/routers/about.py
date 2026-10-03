"""من نحن + السيرة الذاتية للباحثة (صفحات عامة قابلة للتعديل من المدير)."""

from __future__ import annotations

import json
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..audit import record
from ..deps import current_user, get_db, require_role
from ..models import SiteContent

router = APIRouter(prefix="/api/about", tags=["about"])

SECTIONS_DEFAULT = {
    "about": [
        {"h": "رؤية المنظومة", "p": "منظومة وطنية موحدة تربط الدولة بالقطاع الجمعوي والمؤسسات الصحية لتقديم رعاية موصولة لكبار السن في الجزائر."},
        {"h": "الهدف", "p": "نقل الخدمة الطبية والتمريضية إلى منازل المسنين والمعزولين، ومتابعة ملفهم الطبي بشكل آلي وموثّق ومتواصل."},
    ],
    "researcher": [
        {"h": "الباحثة", "p": "رجاء بن إسماعيل — طالبة دراسات عليا في إدارة الأعمال السياحية، جامعة غرداية."},
        {"h": "فكرة المذكرة", "p": "دور التكنولوجيا في تطوير السياحة العلاجية والرعاية الصحية المنزلية في المناطق الصحراوية."},
    ],
}


class ContentIn(BaseModel):
    title: str
    sections: list[dict] = []


async def _ser(c: SiteContent) -> dict:
    try:
        body = json.loads(c.body_json)
    except Exception:
        body = []
    return {"key": c.key, "title": c.title, "sections": body,
            "updated_by": c.updated_by,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None}


@router.get("/{key}")
async def get_content(key: str, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(SiteContent).where(SiteContent.key == key))
    c = res.scalar_one_or_none()
    if not c:
        return {"key": key, "title": "—", "sections": SECTIONS_DEFAULT.get(key, []), "updated_by": "", "updated_at": None}
    return await _ser(c)


@router.put("/{key}", dependencies=[Depends(require_role("admin"))])
async def put_content(key: str, body: ContentIn, payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    if key not in ("about", "researcher"):
        raise HTTPException(status_code=422, detail="مفتاح غير معروف")
    res = await db.execute(select(SiteContent).where(SiteContent.key == key))
    c = res.scalar_one_or_none()
    old = c.body_json[:100] if c else ""
    if not c:
        c = SiteContent(key=key)
        db.add(c)
    c.title = body.title
    c.body_json = json.dumps(body.sections, ensure_ascii=False)
    c.updated_by = payload.get("name", "المدير")
    await record(db, actor=payload.get("name", "المدير"), action="update", entity="about",
                 entity_id=c.id or 0, detail=f"تعديل صفحة: {key}", old=old, new=c.body_json[:100])
    await db.commit()
    await db.refresh(c)
    return await _ser(c)