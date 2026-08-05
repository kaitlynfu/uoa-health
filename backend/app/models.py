from sqlalchemy import Column, Integer, String
from .database import Base


class Programme(Base): # class that represents the Programme table in the database - inherits from Base which is a declarative base class that allows us to define our database models using Python classes
    __tablename__ = "programmes" # name of the table - called programmes

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String, nullable=False)

    faculty = Column(String)

    description = Column(String)

    duration = Column(String)

    entry_requirements = Column(String)

    career_pathways = Column(String)

    programme_url = Column(String)

    image_url = Column(String)