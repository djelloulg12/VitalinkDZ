from __future__ import annotations

from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from .config import settings

engine = create_async_engine(settings.normalized_database_url, echo=False, future=True,
                             pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

# أعمدة جديدة تُضاف لقواعد البيانات القائمة (SQLite) دون مسح البيانات — تُنفَّذ عند كل إقلاع بأمان.
_SCHEMA_PATCHES: list[tuple[str, str, str]] = [
    ("users", "must_change_password", "BOOLEAN NOT NULL DEFAULT 0"),
    ("referrals", "outcome", "TEXT NOT NULL DEFAULT ''"),
    ("referrals", "completed_at", "DATETIME"),
]


async def init_db() -> None:
    from . import models  # noqa: F401

    if settings.is_sqlite:
        db_path = settings.normalized_database_url.replace("sqlite+aiosqlite:///", "").rsplit("?", 1)[0]
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    else:
        Path(settings.storage_path).mkdir(parents=True, exist_ok=True)
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)
    await _patch_schema()


async def _patch_schema() -> None:
    """ALBER TABLE ADD COLUMN للأعمدة الجديدة (يتجاهل الموجودة) — يدعم SQLite وPostgreSQL."""
    async with engine.begin() as conn:
        for table, column, ddl in _SCHEMA_PATCHES:
            if conn.dialect.name == "postgresql":
                await conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {ddl}")
            else:
                rows = (await conn.exec_driver_sql(f"PRAGMA table_info({table})")).mappings().all()
                if column not in {r["name"] for r in rows}:
                    await conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")