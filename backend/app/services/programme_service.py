from sqlalchemy.orm import Session

from app.models import Programme


def get_all_programmes(db: Session):
    return db.query(Programme).all()