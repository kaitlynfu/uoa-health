from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AuthSession, User
from app.schemas import AuthResponse, LoginRequest, RegisterRequest, UserResponse
from app.security import hash_access_token
from app.services.auth_service import (
    authenticate_user,
    create_session,
    get_current_user,
    register_user,
)


router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    user = register_user(db, request.email, request.password, request.display_name)
    token, expires_at = create_session(db, user)
    db.commit()
    db.refresh(user)
    return {"access_token": token, "expires_at": expires_at, "user": user}


@router.post("/login", response_model=AuthResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, request.email, request.password)
    token, expires_at = create_session(db, user)
    db.commit()
    return {"access_token": token, "expires_at": expires_at, "user": user}


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/logout", status_code=204)
def logout(
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(AuthSession).filter(AuthSession.user_id == user.id).delete()
    db.commit()
    return response
