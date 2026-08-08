from fastapi import FastAPI

from .database import engine
from . import models
from .routers.programmes import router as programme_router

app = FastAPI()

models.Base.metadata.create_all(bind=engine)

app.include_router(programme_router)


@app.get("/")
def home():
    return {"message": "Welcome to the CS399 Project 32 API!"}