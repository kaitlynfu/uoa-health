from app.database import SessionLocal
from app.models import Programme


def check_programme_data():
    db = SessionLocal()

    try:
        programmes = db.query(Programme).all()

        print("\n===== PROGRAMME DATA CHECK =====\n")

        for programme in programmes:

            description_status = "✓" if programme.description else "✗"
            career_status = "✓" if programme.career_pathways else "✗"
            entry_status = "✓" if programme.entry_requirements else "✗"

            print(programme.name)
            print(f"Description:        {description_status}")
            print(f"Career pathways:    {career_status}")
            print(f"Entry requirements: {entry_status}")
            print("-" * 60)

        print(f"\nTotal programmes: {len(programmes)}")

    finally:
        db.close()


if __name__ == "__main__":
    check_programme_data()