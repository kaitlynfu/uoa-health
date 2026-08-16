from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .database import engine, SessionLocal
from . import models
from .routers.programmes import router as programme_router

app = FastAPI() # cretes actual API application instance

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://127.0.0.1:8081",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

models.Base.metadata.create_all(bind=engine) # creates the database tables based on the defined models

app.include_router(programme_router) # includes the programme router in the main application, allowing the endpoints defined in programmes.py to be accessible through the API


@app.get("/")
def home():
    return {"message": "Welcome to the CS399 Project 32 API!"}


@app.get("/health", tags=["Health"])
def health_check():

    db = SessionLocal()

    try:
        # Check that the database can execute a query
        db.execute(text("SELECT 1"))

        # Check how many programmes are currently stored
        programme_count = db.query(models.Programme).count()

        return {
            "status": "healthy",
            "database": "connected",
            "programmes": programme_count
        }

    finally:
        db.close()
    

