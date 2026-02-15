"""
User management API endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from database import get_db, User
from models import UserCreate, UserResponse, PasswordChangeRequest
from api.auth import get_current_user
from utils.auth import hash_password, generate_api_key, verify_password
from utils.password_validation import validate_password
from utils.audit import log_action
from typing import List

router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.get("", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all users (admin only)."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    users = db.query(User).all()
    return users


@router.post("", response_model=UserResponse)
def create_user(
    user: UserCreate,
    req: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new user (admin only)."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    existing = db.query(User).filter(User.username == user.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    # Validate password
    is_valid, error_msg = validate_password(user.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    new_user = User(
        username=user.username,
        password_hash=hash_password(user.password),
        email=user.email,
        api_key=generate_api_key(),
        is_admin=user.is_admin
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    log_action(db, user=current_user, action="user.create", resource_type="user",
               resource_id=new_user.id, resource_name=new_user.username,
               ip_address=req.client.host if req.client else None)

    return new_user


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information."""
    return current_user


@router.post("/me/regenerate-api-key", response_model=UserResponse)
def regenerate_api_key(
    req: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Regenerate API key for current user."""
    current_user.api_key = generate_api_key()
    db.commit()
    db.refresh(current_user)

    log_action(db, user=current_user, action="user.apikey_regenerate", resource_type="user",
               resource_id=current_user.id, resource_name=current_user.username,
               ip_address=req.client.host if req.client else None)

    return current_user


@router.put("/{user_id}/password")
def change_password(
    user_id: int,
    password_change: PasswordChangeRequest,
    req: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Change password for a user.

    Rules:
    - Admin can change their own password (requires current_password)
    - Admin can change non-admin user passwords (no current_password required)
    - Admin cannot change other admin passwords
    - Non-admin users are not allowed (handled by admin-only page)
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    # Get target user
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if changing own password
    is_own_password = user_id == current_user.id

    if is_own_password:
        # Changing own password - require current password
        if not password_change.current_password:
            raise HTTPException(
                status_code=400,
                detail="Current password is required when changing your own password"
            )

        # Verify current password
        if not verify_password(password_change.current_password, current_user.password_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
    else:
        # Admin changing another user's password
        # Check if target user is also an admin
        if target_user.is_admin:
            raise HTTPException(
                status_code=403,
                detail="Cannot change password of another admin user"
            )

    # Validate new password
    is_valid, error_msg = validate_password(password_change.new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    # Update password
    target_user.password_hash = hash_password(password_change.new_password)
    db.commit()

    log_action(db, user=current_user, action="user.password_change", resource_type="user",
               resource_id=target_user.id, resource_name=target_user.username,
               details={"changed_own": is_own_password},
               ip_address=req.client.host if req.client else None)

    return {"success": True, "message": "Password changed successfully"}


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    req: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a user (admin only)."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    deleted_username = user.username

    db.delete(user)
    db.commit()

    log_action(db, user=current_user, action="user.delete", resource_type="user",
               resource_id=user_id, resource_name=deleted_username,
               ip_address=req.client.host if req.client else None)

    return {"success": True, "message": "User deleted"}
