from fastapi import FastAPI
from sqlalchemy import text

from .database import engine, SessionLocal
from . import models
from .routers.programmes import router as programme_router

app = FastAPI()

models.Base.metadata.create_all(bind=engine)

app.include_router(programme_router)


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
    

