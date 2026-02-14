"""
System settings API endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, AppSettings, User
from api.auth import get_current_user
from pydantic import BaseModel, Field
from scheduler import cleanup_old_status_updates
import logging

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])
logger = logging.getLogger(__name__)


class RetentionSettings(BaseModel):
    retention_days: int = Field(..., gt=0, description="Number of days to retain status update data (must be greater than 0)")


class StatusPageBannerSettings(BaseModel):
    text: str = Field("", max_length=500, description="Banner message text (empty to hide)")
    severity: str = Field("info", description="Banner severity: info, warning, or critical")


@router.get("/retention")
async def get_retention_settings(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current data retention settings.

    Returns the number of days that status update data is retained.
    Default is 365 days if not configured.
    """
    retention_setting = db.query(AppSettings).filter(
        AppSettings.key == "retention_days"
    ).first()

    retention_days = int(retention_setting.value) if retention_setting else 365

    return {"retention_days": retention_days}


@router.post("/retention")
async def update_retention_settings(
    settings: RetentionSettings,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update data retention settings (admin only).

    Updates the number of days to retain status update data.
    Immediately triggers cleanup of data older than the new retention period.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    # Get or create retention setting
    retention_setting = db.query(AppSettings).filter(
        AppSettings.key == "retention_days"
    ).first()

    if retention_setting:
        retention_setting.value = str(settings.retention_days)
    else:
        retention_setting = AppSettings(
            key="retention_days",
            value=str(settings.retention_days)
        )
        db.add(retention_setting)

    db.commit()

    logger.info(f"Data retention updated to {settings.retention_days} days by user {current_user.username}")

    # Immediately trigger cleanup to remove data older than new retention period
    try:
        cleanup_old_status_updates()
        logger.info(f"Cleanup triggered after retention update")
    except Exception as e:
        logger.error(f"Error triggering cleanup after retention update: {e}")

    return {
        "success": True,
        "retention_days": settings.retention_days,
        "message": f"Data retention set to {settings.retention_days} days. Old data has been cleaned up."
    }


@router.get("/status-page-banner")
async def get_status_page_banner(db: Session = Depends(get_db)):
    """
    Get current status page banner settings.
    Public endpoint - no authentication required (used by public status page).
    """
    text_setting = db.query(AppSettings).filter(
        AppSettings.key == "status_page_banner_text"
    ).first()
    severity_setting = db.query(AppSettings).filter(
        AppSettings.key == "status_page_banner_severity"
    ).first()

    return {
        "text": text_setting.value if text_setting else "",
        "severity": severity_setting.value if severity_setting else "info"
    }


@router.put("/status-page-banner")
async def update_status_page_banner(
    settings: StatusPageBannerSettings,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update status page banner settings (admin only).
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    # Validate severity
    if settings.severity not in ["info", "warning", "critical"]:
        raise HTTPException(status_code=400, detail="Invalid severity. Must be: info, warning, or critical")

    # Update or create text setting
    text_setting = db.query(AppSettings).filter(
        AppSettings.key == "status_page_banner_text"
    ).first()
    if text_setting:
        text_setting.value = settings.text.strip()
    else:
        text_setting = AppSettings(key="status_page_banner_text", value=settings.text.strip())
        db.add(text_setting)

    # Update or create severity setting
    severity_setting = db.query(AppSettings).filter(
        AppSettings.key == "status_page_banner_severity"
    ).first()
    if severity_setting:
        severity_setting.value = settings.severity
    else:
        severity_setting = AppSettings(key="status_page_banner_severity", value=settings.severity)
        db.add(severity_setting)

    db.commit()

    logger.info(f"Status page banner updated by user {current_user.username}")

    return {
        "success": True,
        "text": settings.text.strip(),
        "severity": settings.severity
    }
