from datetime import UTC, datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AuthSession, StudentPersonalisation, StudentProfile, User
from app.security import create_access_token, hash_access_token, hash_password, verify_password


SESSION_DAYS = 7
bearer_scheme = HTTPBearer(auto_error=False)


def utc_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def register_user(db: Session, email: str, password: str, display_name: str):
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email is already registered")

    user = User(
        email=email,
        password_hash=hash_password(password),
        display_name=display_name,
    )
    user.profile = StudentProfile()
    user.personalisation = StudentPersonalisation()
    db.add(user)
    db.flush()
    return user


def authenticate_user(db: Session, email: str, password: str):
    user = db.query(User).filter(User.email == email.strip().casefold()).first()
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return user


def create_session(db: Session, user: User):
    raw_token = create_access_token()
    expires_at = utc_now() + timedelta(days=SESSION_DAYS)
    db.add(
        AuthSession(
            user=user,
            token_hash=hash_access_token(raw_token),
            expires_at=expires_at,
        )
    )
    return raw_token, expires_at


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    if credentials is None or credentials.scheme.casefold() != "bearer":
        raise HTTPException(status_code=401, detail="Authentication required")

    session = (
        db.query(AuthSession)
        .filter(AuthSession.token_hash == hash_access_token(credentials.credentials))
        .first()
    )
    if session is None or session.expires_at <= utc_now():
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return session.user
