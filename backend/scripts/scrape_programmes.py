from app.database import SessionLocal
from app.database import engine
from app.models import Base
from app.models import Programme
from app.services.scraper import (
    get_programme_urls,
    scrape_programme,
)


def main():

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

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

            existing_programme.name = programme_data["name"]
            existing_programme.faculty = programme_data["faculty"]
            existing_programme.description = programme_data["description"]
            existing_programme.duration = programme_data["duration"]
            existing_programme.entry_requirements = programme_data["entry_requirements"]
            existing_programme.career_pathways = programme_data["career_pathways"]
            existing_programme.image_url = programme_data["image_url"]

            print(f"Updated: {existing_programme.name}")

        else:

            programme = Programme(**programme_data)

            db.add(programme)

            print(f"Added: {programme.name}")

    db.commit()
    db.close()

    print("\nFinished scraping!")


if __name__ == "__main__":
    main()