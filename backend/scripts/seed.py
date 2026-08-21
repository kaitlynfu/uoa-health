from app.database import SessionLocal
from app.models import Programme
from app.services.career_service import sync_programme_careers


def seed_database():
    db = SessionLocal()

    try:
        programme_data = dict(
            name="Bachelor of Health Sciences BHSc",
            faculty="Faculty of Medical and Health Sciences",
            description="A programme focused on improving the health and wellbeing of individuals and communities through interdisciplinary study.",
            duration="3 years",
            entry_requirements="University Entrance + Rank Score",
            career_pathways="Public Health, Physiotherapy, Medicine, Research",
            programme_url=(
                "https://www.auckland.ac.nz/en/study/study-options/"
                "find-a-study-option/bachelor-of-health-sciences-bhsc.html"
            ),
            image_url=None,
        )

        programme = (
            db.query(Programme)
            .filter(Programme.programme_url == programme_data["programme_url"])
            .first()
        )

        if programme is None:
            programme = Programme(**programme_data)
            db.add(programme)
            action = "Added"
        else:
            for field, value in programme_data.items():
                setattr(programme, field, value)
            action = "Updated"

        sync_programme_careers(db, programme)
        db.commit()
        db.refresh(programme)

        print(f"{action} programme with ID {programme.id}")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
