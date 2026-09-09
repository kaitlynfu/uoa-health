import os
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from . import models
from .database import engine, get_db
from .routers.auth import router as auth_router
from .routers.careers import router as career_router
from .routers.journey import router as journey_router
from .routers.programmes import router as programme_router
from .routers.profile import router as profile_router
from .routers.wayfinding import router as wayfinding_router
from .schemas import HealthResponse


JOURNEY_DEMO_FILE = Path(__file__).resolve().parent / "static" / "journey-demo.html"
WAYFINDING_DEMO_FILE = Path(__file__).resolve().parent / "static" / "wayfinding-demo.html"
PROFILE_DEMO_FILE = Path(__file__).resolve().parent / "static" / "profile-demo.html"
APP_DEMO_FILE = Path(__file__).resolve().parent / "static" / "app-demo.html"

app = FastAPI(
    title="CS399 Project 32 API",
    description="Programme discovery, student journey and campus wayfinding API.",
    version="1.0.0",
)

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:8081,http://127.0.0.1:8081",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

models.Base.metadata.create_all(bind=engine)

app.include_router(programme_router)
app.include_router(career_router)
app.include_router(auth_router)
app.include_router(journey_router)
app.include_router(wayfinding_router)
app.include_router(profile_router)


@app.get("/")
def home():
    return {
        "message": "Welcome to the CS399 Project 32 API!",
        "docs": "/docs",
    }


@app.get("/demo/journey", include_in_schema=False)
def journey_demo():
    return FileResponse(JOURNEY_DEMO_FILE)


@app.get("/demo/wayfinding", include_in_schema=False)
def wayfinding_demo():
    return FileResponse(WAYFINDING_DEMO_FILE)


@app.get("/demo/profile", include_in_schema=False)
def profile_demo():
    return FileResponse(PROFILE_DEMO_FILE)


@app.get("/demo/app", include_in_schema=False)
def app_demo():
    return FileResponse(APP_DEMO_FILE)


@app.get("/health", tags=["Health"], response_model=HealthResponse)
def health_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    programme_count = db.scalar(select(func.count(models.Programme.id))) or 0

    return {
        "status": "healthy",
        "database": "connected",
        "programmes": programme_count,
    }