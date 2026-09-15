from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Response, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from app.db.session import get_db
from app.core.config import settings
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from app.core.deps import get_current_user, require_admin
from app.core.utils import validate_password_strength
from app.core.rate_limit import limiter
from app.models import User, PasswordResetRequest
from app.site_settings import _get_setting

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    employee_id: str
    phone_number: str | None = None
    department_id: int | None = None
    job_title: str | None = None


class LoginRequest(BaseModel):
    identifier: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class PasswordResetInitiate(BaseModel):
    email: EmailStr


class PasswordResetRead(BaseModel):
    id: int
    user_id: int
    user_name: str
    user_email: str
    status: str
    requested_at: datetime | None
    decided_at: datetime | None


@router.post("/register")
@limiter.limit("5/hour")
def register(request: Request, payload: RegisterRequest, db: Session = Depends(get_db)):
    if _get_setting(db, "system.registration_enabled", "true") != "true":
        raise HTTPException(status_code=403, detail="New registrations are currently closed")

    password_error = validate_password_strength(payload.password)
    if password_error:
        raise HTTPException(status_code=400, detail=password_error)

    existing = db.query(User).filter(
        (User.email == payload.email) | (
            User.employee_id == payload.employee_id)
    ).first()
    if existing:
        raise HTTPException(
            status_code=400, detail="Email or employee ID already in use")

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        employee_id=payload.employee_id,
        phone_number=payload.phone_number,
        department_id=payload.department_id,
        job_title=payload.job_title,
        role="staff",
        account_status="pending",
    )
    db.add(user)
    db.commit()
    return {"message": "Registration submitted. An admin will review your account."}


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        (User.email == payload.identifier) | (
            User.employee_id == payload.identifier)
    ).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.account_locked:
        raise HTTPException(
            status_code=403, detail="Account locked. Contact an admin to unlock it.")

    if user.locked_until and user.locked_until > datetime.utcnow():
        minutes_left = int(
            (user.locked_until - datetime.utcnow()).total_seconds() / 60) + 1
        raise HTTPException(
            status_code=403, detail=f"Too many attempts. Try again in {minutes_left} minute(s).")

    if user.account_status == "pending":
        raise HTTPException(status_code=403, detail="Account pending approval")
    if user.account_status == "rejected":
        raise HTTPException(
            status_code=403, detail=f"Registration rejected: {user.rejection_reason or 'no reason given'}")
    if user.account_status == "disabled":
        raise HTTPException(
            status_code=403, detail="This account has been disabled")

    if not verify_password(payload.password, user.password_hash):
        user.failed_login_count += 1

        max_attempts = int(_get_setting(db, "system.login_max_attempts", str(settings.LOGIN_MAX_ATTEMPTS)))
        stage1_minutes = int(_get_setting(db, "system.lockout_stage1_minutes", str(settings.LOGIN_COOLDOWN_STAGE_1_MINUTES)))
        stage2_minutes = int(_get_setting(db, "system.lockout_stage2_minutes", str(settings.LOGIN_COOLDOWN_STAGE_2_MINUTES)))

        if user.failed_login_count >= max_attempts:
            user.failed_login_count = 0
            if user.lockout_stage == 0:
                user.lockout_stage = 1
                user.locked_until = datetime.utcnow() + timedelta(minutes=stage1_minutes)
            elif user.lockout_stage == 1:
                user.lockout_stage = 2
                user.locked_until = datetime.utcnow() + timedelta(minutes=stage2_minutes)
            else:
                user.account_locked = True

        db.commit()
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user.failed_login_count = 0
    user.lockout_stage = 0
    user.locked_until = None
    user.last_login_at = datetime.utcnow()
    db.commit()

    access_token = create_access_token(
        {"sub": str(user.id), "role": user.role})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.ENVIRONMENT != "development",
        samesite="strict",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/auth",
    )

    return TokenResponse(access_token=access_token)


@router.post("/refresh", response_model=TokenResponse)
def refresh(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")

    payload = decode_token(token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=401, detail="Invalid or expired refresh token")

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=401, detail="Invalid or expired refresh token")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or user.account_status != "active":
        raise HTTPException(status_code=401, detail="Account not available")

    access_token = create_access_token(
        {"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=access_token)


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("refresh_token", path="/auth")
    return {"logged_out": True}


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=400, detail="Current password is incorrect")

    password_error = validate_password_strength(payload.new_password)
    if password_error:
        raise HTTPException(status_code=400, detail=password_error)

    current_user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password updated"}


@router.post("/password-reset/request")
@limiter.limit("5/hour")
def request_password_reset(request: Request, payload: PasswordResetInitiate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or user.is_blocked:
        return {"message": "If that account exists, a reset request has been submitted for review."}

    reset_request = PasswordResetRequest(user_id=user.id, status="pending")
    db.add(reset_request)
    db.commit()
    return {"message": "If that account exists, a reset request has been submitted for review."}


@router.get("/password-reset/pending", response_model=list[PasswordResetRead])
def list_pending_resets(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    rows = db.query(PasswordResetRequest).filter(
        PasswordResetRequest.status == "pending").all()
    return [
        PasswordResetRead(
            id=r.id,
            user_id=r.user_id,
            user_name=r.user.name,
            user_email=r.user.email,
            status=r.status,
            requested_at=r.requested_at,
            decided_at=r.decided_at,
        )
        for r in rows
    ]


@router.post("/password-reset/{request_id}/approve")
def approve_password_reset(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    reset_request = db.query(PasswordResetRequest).filter(
        PasswordResetRequest.id == request_id).first()
    if not reset_request:
        raise HTTPException(status_code=404, detail="Request not found")

    reset_request.status = "approved"
    reset_request.decided_at = datetime.utcnow()
    reset_request.decided_by = current_user.id
    db.commit()

    return {"message": "Reset approved. Email delivery is pending SMTP setup."}


@router.post("/password-reset/{request_id}/reject")
def reject_password_reset(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    reset_request = db.query(PasswordResetRequest).filter(
        PasswordResetRequest.id == request_id).first()
    if not reset_request:
        raise HTTPException(status_code=404, detail="Request not found")

    reset_request.status = "rejected"
    reset_request.decided_at = datetime.utcnow()
    reset_request.decided_by = current_user.id
    db.commit()

    return {"message": "Reset request rejected."}
