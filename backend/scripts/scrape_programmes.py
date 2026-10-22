from app.database import SessionLocal
from app.database import engine
from app.models import Base
from app.models import Programme
from app.services.career_service import sync_programme_careers
from app.services.scraper import (
    get_programme_urls,
    scrape_programme,
)


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        urls = get_programme_urls()
        print(f"Found {len(urls)} programme pages.\n")

        for url in sorted(urls):
            programme_data = scrape_programme(url)

            if programme_data is None:
                continue

            existing_programme = (
                db.query(Programme)
                .filter(
                    Programme.programme_url ==
                    programme_data["programme_url"]
                )
                .first()
            )

            if existing_programme:
                for field, value in programme_data.items():
                    setattr(existing_programme, field, value)

                print(f"Updated: {existing_programme.name}")
                current_programme = existing_programme
            else:
                current_programme = Programme(**programme_data)
                db.add(current_programme)
                print(f"Added: {current_programme.name}")

            sync_programme_careers(db, current_programme)

        db.commit()
        print("\nFinished scraping!")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
