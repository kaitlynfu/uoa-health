from fastapi import FastAPI

from .database import engine # Creates the connection to the database using the engine defined in the database.py file
from . import models # Imports the models defined in the models.py file - this is done to create the tables in the database based on the models defined in the models.py file

app = FastAPI()

models.Base.metadata.create_all(bind=engine) # Creates the tables in the database based on the models defined in the models.py file - this is done using the metadata attribute of the Base class which contains information about the tables and their relationships


@app.get("/")
def home():
    return {"message": "Welcome to the CS399 Project 32 API!"}