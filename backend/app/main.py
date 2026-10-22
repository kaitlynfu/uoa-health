import os

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from . import models
from .database import engine, get_db
from .routers.auth import router as auth_router
from .routers.careers import router as career_router
from .routers.journey import router as journey_router
from .routers.programmes import router as programme_router
from .routers.profile import router as profile_router
from .routers.route_permissions import router as route_permissions_router
from .routers.shared_home_routes import router as shared_home_routes_router
from .routers.campus_routes import router as campus_routes_router
from .routers.social import router as social_router
from .routers.social_inbox import router as social_inbox_router
from .routers.social_directory import router as social_directory_router
from .routers.safety import router as safety_router
from .routers.notifications import router as notifications_router
from .routers.account import router as account_router
from .routers.peers import router as peers_router
from .routers.profile_photos import router as profile_photos_router
from .routers.wayfinding import router as wayfinding_router
from .schemas import HealthResponse
from .web_app import mount_web_app


app = FastAPI(
    title="Student Compass — Team 43 API",
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

# PostgreSQL uses explicitly reviewed Alembic migrations before startup.
if engine.dialect.name == "sqlite":
    models.Base.metadata.create_all(bind=engine)

app.include_router(programme_router)
app.include_router(career_router)
app.include_router(auth_router)
app.include_router(journey_router)
app.include_router(wayfinding_router)
app.include_router(profile_router)
app.include_router(route_permissions_router)
app.include_router(shared_home_routes_router)
app.include_router(campus_routes_router)
app.include_router(social_inbox_router)
app.include_router(social_directory_router)
app.include_router(social_router)
app.include_router(safety_router)
app.include_router(notifications_router)
app.include_router(account_router)
app.include_router(peers_router)
app.include_router(profile_photos_router)


mount_web_app(app)


@app.get("/")
def home():
    return {
        "message": "Welcome to the Student Compass Team 43 API!",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"], response_model=HealthResponse)
def health_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    programme_count = db.scalar(select(func.count(models.Programme.id))) or 0

    return {
        "status": "healthy",
        "database": "connected",
        "programmes": programme_count,
    }


@app.get('/capabilities', tags=['Health'])
def capabilities(db: Session = Depends(get_db)):
    # Actually probe required tables: old schema must not advertise a ready API.
    db.execute(select(models.NotificationPreference.user_id).limit(1))
    db.execute(select(models.AccountEmailToken.token_hash).limit(1))
    db.execute(select(models.BlockedUser.user_id).limit(1))
    return {'account_management':1,'social_safety':1,'notifications':1,'app_completion':1,'milestone_customisation':1}
    

