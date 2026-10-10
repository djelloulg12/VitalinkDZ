from __future__ import annotations

import ssl as _ssl
from datetime import date, datetime, timezone
from pathlib import Path
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from .config import settings

# asyncpg تفهم `ssl=<SSLContext>` وليست `sslmode=...` — نحوّل الوسم إلى كائن.
_engine_kwargs = dict(echo=False, future=True, pool_pre_ping=True)
if settings.db_ssl_mode and not settings.is_sqlite:
    _ctx = _ssl.create_default_context()
    if settings.db_ssl_mode == "require":
        _ctx.check_hostname = False
        _ctx.verify_mode = _ssl.CERT_NONE
    _engine_kwargs["connect_args"] = {"ssl": _ctx}

engine = create_async_engine(settings.normalized_database_url, **_engine_kwargs)


def _naive_utc(value):
    """توافق PostgreSQL: تحويل أي datetime حامل للمنطقة الزمنية إلى UTC بلا منطقة."""
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).replace(tzinfo=None) if value.tzinfo else value
    if isinstance(value, dict):
        return {k: _naive_utc(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return type(value)(_naive_utc(v) for v in value)
    return value


if not settings.is_sqlite:
    @event.listens_for(engine.sync_engine, "before_cursor_execute", retval=True)
    def _dt_compat(conn, cursor, statement, parameters, context, executemany):
        return statement, _naive_utc(parameters)
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
        try:
            Path(settings.storage_path).mkdir(parents=True, exist_ok=True)
        except OSError:
            # بيئة سحابية بملفystem للقراءة فقط — النسخ الاحتياطي يسقط بسلام
            pass
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