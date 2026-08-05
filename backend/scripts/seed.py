from app.database import SessionLocal
from app.models import Programme


def seed_database():
    # Open a database session
    db = SessionLocal()

    try:
        # Create a Programme object
        health_science = Programme(
            name="Bachelor of Health Sciences",
            faculty="Faculty of Medical and Health Sciences",
            description="A programme focused on improving the health and wellbeing of individuals and communities through interdisciplinary study.",
            duration="3 years",
            entry_requirements="University Entrance + Rank Score",
            career_pathways="Public Health, Physiotherapy, Medicine, Research",
            programme_url="https://www.auckland.ac.nz/",
            image_url="https://www.auckland.ac.nz/"
        )

        # Add it to the session
        db.add(health_science)

        # Save it permanently
        db.commit()

        # Refresh so SQLAlchemy gets the generated ID
        db.refresh(health_science)

        print(f"✅ Added programme with ID {health_science.id}")

    finally:
        # Always close the database session
        db.close()


if __name__ == "__main__":
    seed_database()