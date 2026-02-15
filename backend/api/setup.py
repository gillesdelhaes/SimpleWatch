"""
Setup API endpoints for first-run configuration.
These endpoints are accessible without authentication during initial setup.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from database import get_db, User, AppSettings
from utils.auth import hash_password, generate_api_key
from utils.password_validation import validate_password, validate_password_match
from utils.audit import log_action
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/setup", tags=["setup"])


class SetupRequest(BaseModel):
    """Request model for initial setup."""
    username: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)
    create_examples: bool = True


class SetupStatusResponse(BaseModel):
    """Response model for setup status check."""
    setup_completed: bool


@router.get("/status", response_model=SetupStatusResponse)
def get_setup_status(db: Session = Depends(get_db)):
    """
    Check if initial setup has been completed.

    Returns:
        SetupStatusResponse with setup_completed boolean
    """
    setting = db.query(AppSettings).filter(AppSettings.key == "setup_completed").first()
    setup_completed = setting is not None and setting.value == "true"

    return SetupStatusResponse(setup_completed=setup_completed)


@router.post("")
def complete_setup(setup: SetupRequest, req: Request, db: Session = Depends(get_db)):
    """
    Complete initial setup by creating admin user and marking setup as done.

    This endpoint can only be called once when setup_completed is false.
    Creates the admin user and optionally creates example monitors.

    Args:
        setup: Setup configuration with username, password, and options
        db: Database session

    Returns:
        Success message

    Raises:
        HTTPException: If setup already completed or validation fails
    """
    # Check if setup is already completed
    setting = db.query(AppSettings).filter(AppSettings.key == "setup_completed").first()
    if setting and setting.value == "true":
        raise HTTPException(status_code=400, detail="Setup already completed")

    # Validate password
    is_valid, error_msg = validate_password(setup.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    # Validate password match
    is_valid, error_msg = validate_password_match(setup.password, setup.confirm_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    # Check if username already exists (shouldn't happen on fresh install)
    existing_user = db.query(User).filter(User.username == setup.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")

    # Create admin user
    admin_user = User(
        username=setup.username,
        password_hash=hash_password(setup.password),
        api_key=generate_api_key(),
        is_admin=True
    )
    db.add(admin_user)

    # Commit the admin user first so it's available for example creation
    db.commit()
    db.refresh(admin_user)

    # Create examples if requested
    if setup.create_examples:
        logger.info("Creating example monitors as requested during setup")
        try:
            from utils.examples import create_example_monitors
            create_example_monitors(db)
        except Exception as e:
            logger.error(f"Failed to create example monitors: {e}")
            # Don't fail setup if examples fail

    # Mark setup as completed
    if setting:
        setting.value = "true"
    else:
        setting = AppSettings(key="setup_completed", value="true")
        db.add(setting)

    db.commit()

    log_action(db, user=admin_user, action="setup.complete", resource_type="system",
               details={"create_examples": setup.create_examples},
               ip_address=req.client.host if req.client else None)

    logger.info(f"Setup completed successfully. Admin user '{setup.username}' created.")

    return {
        "success": True,
        "message": "Setup completed successfully",
        "username": setup.username
    }
