from sqlalchemy import create_engine # Creates connection between the database and the application - lets python code communicate with the database
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = "sqlite:///./health_app_v2.db" # Stores where the database is located - in this case, a local file called health_app.db - automatically created if it doesn't exist 

engine = create_engine( # Actually creates the connection to the database using the URL specified above
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker( # Everytime a request is made to the API, a new session is created to communicate with the database - this is done using the sessionmaker function from SQLAlchemy
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base() # Just a basic model of how our database will be structured - this is used to create the tables in the database and define their relationships

def get_db(): # This function is used to get a database session - it is used in the API endpoints to communicate with the database
    db = SessionLocal()
    try:
        yield db # pauses the function instead of returning a value and resumes later - this is done to allow the API endpoint to use the database session and then close it when it's done
    finally:
        db.close()