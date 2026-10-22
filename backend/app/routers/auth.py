from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AccountEmailToken, AuthSession, User, VerifiedEmail, utc_now
from app.schemas import (AccountCodeRequest, AccountEmailRequest, AuthResponse, LoginRequest,
                         PasswordChangeRequest, PasswordResetRequest, RegisterRequest, UserResponse)
from app.security import create_access_token, hash_access_token, hash_password, verify_password
from app.services.account_email import email_available, send_account_email
from app.services.request_limits import throttle
from app.services.auth_service import (
    authenticate_user,
    create_session,
    get_current_user,
    register_user,
)


router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get('/features')
def auth_features():
    return {'email_delivery': email_available()}


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(request: RegisterRequest, http: Request, db: Session = Depends(get_db)):
    throttle(db, 'register', http.client.host if http.client else 'unknown', 30)
    user = register_user(db, request.email, request.password, request.display_name)
    token, expires_at = create_session(db, user)
    db.commit()
    db.refresh(user)
    return {"access_token": token, "expires_at": expires_at, "user": user}


@router.post("/login", response_model=AuthResponse)
def login(request: LoginRequest, http: Request, db: Session = Depends(get_db)):
    throttle(db, 'login-email', request.email.strip().casefold(), 20)
    throttle(db, 'login-ip', http.client.host if http.client else 'unknown', 100)
    user = authenticate_user(db, request.email, request.password)
    token, expires_at = create_session(db, user)
    db.commit()
    return {"access_token": token, "expires_at": expires_at, "user": user}


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/password", response_model=AuthResponse)
def change_password(request: PasswordChangeRequest, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    throttle(db, 'password-change', user.id, 10)
    if not verify_password(request.current_password, user.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    if request.new_password == request.current_password:
        raise HTTPException(422, "Choose a different new password")
    user.password_hash = hash_password(request.new_password)
    db.query(AuthSession).filter(AuthSession.user_id == user.id).delete(synchronize_session=False)
    # A recovery link issued before this change must not undo the new password.
    db.query(AccountEmailToken).filter_by(user_id=user.id).delete(synchronize_session=False)
    token, expires_at = create_session(db, user)
    db.commit()
    return {"access_token": token, "expires_at": expires_at, "user": user}


def issue_email_code(db, user, purpose):
    db.query(AccountEmailToken).filter_by(user_id=user.id, purpose=purpose).delete()
    code = create_access_token()
    db.add(AccountEmailToken(token_hash=hash_access_token(code), user_id=user.id,
                            purpose=purpose, expires_at=utc_now() + timedelta(minutes=30)))
    send_account_email(user.email, purpose, code)
    db.commit()


def consume_email_code(db, code, purpose):
    user_id = db.scalar(delete(AccountEmailToken).where(
        AccountEmailToken.token_hash == hash_access_token(code), AccountEmailToken.purpose == purpose,
        AccountEmailToken.expires_at > utc_now()).returning(AccountEmailToken.user_id))
    if user_id is None:
        raise HTTPException(400, 'Code is invalid or expired. Request a new email.')
    return db.get(User, user_id)


@router.get('/email/status')
def email_status(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {'verified': db.get(VerifiedEmail, user.id) is not None, 'delivery_configured': email_available()}


@router.post('/password/reset/request', status_code=202)
def request_reset(request: AccountEmailRequest, http: Request, db: Session = Depends(get_db)):
    throttle(db, 'reset-ip', http.client.host if http.client else 'unknown', 30)
    throttle(db, 'reset-email', request.email, 3)
    if not email_available():
        raise HTTPException(503, 'Account emails are not configured yet. Contact the project team.')
    user = db.query(User).filter_by(email=request.email).first()
    if user:
        try: issue_email_code(db, user, 'reset')
        except HTTPException:
            db.rollback()  # Same public response as an unregistered address; no token persisted.
    return {'message': 'If this email is registered, a reset code will be sent. Check your inbox.'}


@router.post('/password/reset', status_code=204)
def reset_password(request: PasswordResetRequest, http: Request, db: Session = Depends(get_db)):
    throttle(db, 'reset-code', http.client.host if http.client else 'unknown', 30)
    user = consume_email_code(db, request.code, 'reset')
    user.password_hash = hash_password(request.new_password)
    db.query(AuthSession).filter_by(user_id=user.id).delete(synchronize_session=False)
    db.query(AccountEmailToken).filter_by(user_id=user.id).delete(synchronize_session=False)
    db.commit()
    return Response(status_code=204)


@router.post('/email/verification/request', status_code=202)
def request_verification(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    throttle(db, 'verify-email', user.id, 3)
    issue_email_code(db, user, 'verify')
    return {'message': 'A verification code has been sent.'}


@router.post('/email/verification', status_code=204)
def verify_email(request: AccountCodeRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    throttle(db, 'verify-code', user.id, 20)
    verified = consume_email_code(db, request.code, 'verify')
    if verified.id != user.id:
        db.rollback()
        raise HTTPException(400, 'This code belongs to a different account')
    if db.get(VerifiedEmail, user.id) is None:
        db.add(VerifiedEmail(user_id=user.id))
    db.commit()
    return Response(status_code=204)


@router.post("/logout", status_code=204)
def logout(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(AuthSession).filter(AuthSession.user_id == user.id).delete()
    db.commit()
    return Response(status_code=204)
