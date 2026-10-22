from app.database import SessionLocal, engine
from app.models import Base
from app.services.career_service import sync_all_programme_careers


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        programme_count, link_count = sync_all_programme_careers(db)
        db.commit()
        print(
            f"Synced {link_count} career links across "
            f"{programme_count} programmes."
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
