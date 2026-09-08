from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.config import settings
from core.events import subscribe
from core.redis import close_redis
from modules.ai.router import router as ai_router
from modules.analytics.router import router as analytics_router
from modules.identity.router import router as identity_router
from modules.integrations.router import router as integrations_router
from modules.logs.events import on_session_finished_record_attendance, on_session_finished_resolve_battle
from modules.logs.router import router as logs_router
from modules.training.router import router as training_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path(settings.media_root).mkdir(parents=True, exist_ok=True)
    subscribe("workout_session.finished", on_session_finished_record_attendance)
    subscribe("workout_session.finished", on_session_finished_resolve_battle)
    yield
    await close_redis()


app = FastAPI(title="gym-logs", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai_router, prefix="/api/v1")
app.include_router(identity_router, prefix="/api/v1")
app.include_router(integrations_router, prefix="/api/v1")
app.include_router(training_router, prefix="/api/v1")
app.include_router(logs_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")

app.mount("/media", StaticFiles(directory=settings.media_root), name="media")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
