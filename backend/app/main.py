"""Vitalink DZ backend entrypoint."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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