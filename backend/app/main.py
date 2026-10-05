"""Vitalink DZ backend entrypoint."""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .database import SessionLocal, init_db
from .routers import (about, access, admin, agencies, associations, audit, auth, care, drugs,
                      followups, gps, institutions, notifications, predict, prescriptions, presence,
                      psych, public, referrals, shifts, sos, staff, thermal, wilayas, zones)


async def _seed():
    from .seed import seed_if_empty

    async with SessionLocal() as db:
        await seed_if_empty(db)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    await _seed()
    yield


app = FastAPI(title=settings.app_name, version="1.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (auth.router, wilayas.router, institutions.router, staff.router, referrals.router,
               associations.router, gps.router, audit.router, admin.router,
               followups.router, about.router, shifts.router, zones.router,
               agencies.router, thermal.router, drugs.router, predict.router,
               prescriptions.router, care.router, psych.router, sos.router, access.router,
               presence.router, notifications.router, public.router):
    app.include_router(router)


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "app": settings.app_name,
        "environment": settings.environment,
        "role_seed_password": settings.default_password,
    }


# ===== الإنتاج: خدمة الواجهة المبنية من الخادم نفسه (ملف واحد/منفذ واحد بلا CORS) =====
_STATIC = Path(settings.static_dir)

if _STATIC.is_dir():
    app.mount("/assets", StaticFiles(directory=_STATIC / "assets"), name="assets")

    @app.get("/{spa_path:path}", include_in_schema=False)
    async def spa(spa_path: str):
        """يخدم الملفات الثابتة إن وُجدت، وإلا index.html لدعم روابط SPA العميقة."""
        if spa_path and not spa_path.startswith("api/"):
            candidate = (_STATIC / spa_path).resolve()
            if candidate.is_file() and _STATIC.resolve() in candidate.parents:
                return FileResponse(candidate)
        return FileResponse(_STATIC / "index.html")

else:  # بيئة التطوير (لا يوجد dist) — رسالة واضحة بدل 404 غامض
    @app.get("/", include_in_schema=False)
    async def dev_hint():
        return {
            "message": "الواجهة تُقدَّم في التطوير عبر Vite على المنفذ 5173.",
            "api_docs": "/docs",
            "static_built": False,
        }