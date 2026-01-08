"""
API endpoints for maintenance windows.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db, MaintenanceWindow, Service
from models import (
    MaintenanceWindowCreate,
    MaintenanceWindowUpdate,
    MaintenanceWindowResponse
)
from api.auth import get_current_user
from datetime import datetime, timezone
from typing import List, Optional
import json
import logging

logger = logging.getLogger(__name__)


def to_naive_utc(dt: datetime) -> datetime:
    """Convert a datetime to naive UTC (strip timezone info after converting to UTC)."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        # Convert to UTC then strip timezone
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt

router = APIRouter(prefix="/api/v1/maintenance", tags=["maintenance"])


def maintenance_to_response(mw: MaintenanceWindow, service_name: str = None) -> dict:
    """Convert MaintenanceWindow to response dict."""
    return {
        "id": mw.id,
        "service_id": mw.service_id,
        "service_name": service_name,
        "start_time": mw.start_time.isoformat() + 'Z' if mw.start_time else None,
        "end_time": mw.end_time.isoformat() + 'Z' if mw.end_time else None,
        "recurrence_type": mw.recurrence_type,
        "recurrence_config": json.loads(mw.recurrence_config) if mw.recurrence_config else None,
        "reason": mw.reason,
        "status": mw.status,
        "created_at": mw.created_at.isoformat() + 'Z' if mw.created_at else None,
        "created_by": mw.created_by,
        "updated_at": mw.updated_at.isoformat() + 'Z' if mw.updated_at else None
    }


@router.get("/")
def list_maintenance_windows(
    service_id: Optional[int] = Query(None, description="Filter by service ID"),
    status: Optional[str] = Query(None, description="Filter by status: scheduled, active, completed, cancelled"),
    include_completed: bool = Query(False, description="Include completed/cancelled windows"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    List maintenance windows with optional filters.
    By default, excludes completed and cancelled windows.
    """
    query = db.query(MaintenanceWindow).join(Service)

    if service_id:
        query = query.filter(MaintenanceWindow.service_id == service_id)

    if status:
        query = query.filter(MaintenanceWindow.status == status)
    elif not include_completed:
        query = query.filter(MaintenanceWindow.status.in_(["scheduled", "active"]))

    # Order by start time (upcoming first)
    windows = query.order_by(MaintenanceWindow.start_time.asc()).all()

    result = []
    for mw in windows:
        service = db.query(Service).filter(Service.id == mw.service_id).first()
        result.append(maintenance_to_response(mw, service.name if service else None))

    return {"success": True, "maintenance_windows": result}


@router.get("/{window_id}")
def get_maintenance_window(
    window_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get a specific maintenance window by ID."""
    mw = db.query(MaintenanceWindow).filter(MaintenanceWindow.id == window_id).first()
    if not mw:
        raise HTTPException(status_code=404, detail="Maintenance window not found")

    service = db.query(Service).filter(Service.id == mw.service_id).first()
    return {"success": True, "maintenance_window": maintenance_to_response(mw, service.name if service else None)}


@router.post("/")
def create_maintenance_window(
    window: MaintenanceWindowCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create a new maintenance window."""
    # Verify service exists
    service = db.query(Service).filter(Service.id == window.service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    # Convert to naive UTC for consistent comparison
    start_time = to_naive_utc(window.start_time)
    end_time = to_naive_utc(window.end_time)

    # Validate time window
    if end_time <= start_time:
        raise HTTPException(status_code=400, detail="End time must be after start time")

    # Determine initial status
    now = datetime.utcnow()
    if start_time <= now < end_time:
        initial_status = "active"
    elif end_time <= now:
        raise HTTPException(status_code=400, detail="Cannot create maintenance window in the past")
    else:
        initial_status = "scheduled"

    # Create maintenance window
    mw = MaintenanceWindow(
        service_id=window.service_id,
        start_time=start_time,
        end_time=end_time,
        recurrence_type=window.recurrence_type,
        recurrence_config=json.dumps(window.recurrence_config) if window.recurrence_config else None,
        reason=window.reason,
        status=initial_status,
        created_by=current_user.id
    )

    db.add(mw)
    db.commit()
    db.refresh(mw)

    logger.info(f"Created maintenance window {mw.id} for service {service.name}")

    return {
        "success": True,
        "message": "Maintenance window created",
        "maintenance_window": maintenance_to_response(mw, service.name)
    }


@router.put("/{window_id}")
def update_maintenance_window(
    window_id: int,
    update: MaintenanceWindowUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update an existing maintenance window."""
    mw = db.query(MaintenanceWindow).filter(MaintenanceWindow.id == window_id).first()
    if not mw:
        raise HTTPException(status_code=404, detail="Maintenance window not found")

    # Don't allow updating completed or cancelled windows
    if mw.status in ["completed", "cancelled"]:
        raise HTTPException(status_code=400, detail=f"Cannot update {mw.status} maintenance window")

    # Update fields (convert to naive UTC)
    if update.start_time is not None:
        mw.start_time = to_naive_utc(update.start_time)
    if update.end_time is not None:
        mw.end_time = to_naive_utc(update.end_time)
    if update.recurrence_type is not None:
        mw.recurrence_type = update.recurrence_type
    if update.recurrence_config is not None:
        mw.recurrence_config = json.dumps(update.recurrence_config)
    if update.reason is not None:
        mw.reason = update.reason

    # Validate time window
    if mw.end_time <= mw.start_time:
        raise HTTPException(status_code=400, detail="End time must be after start time")

    # Update status if needed
    now = datetime.utcnow()
    if mw.start_time <= now < mw.end_time:
        mw.status = "active"
    elif mw.end_time <= now:
        mw.status = "completed"
    else:
        mw.status = "scheduled"

    db.commit()
    db.refresh(mw)

    service = db.query(Service).filter(Service.id == mw.service_id).first()
    logger.info(f"Updated maintenance window {mw.id}")

    return {
        "success": True,
        "message": "Maintenance window updated",
        "maintenance_window": maintenance_to_response(mw, service.name if service else None)
    }


@router.delete("/{window_id}")
def delete_maintenance_window(
    window_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete a maintenance window."""
    mw = db.query(MaintenanceWindow).filter(MaintenanceWindow.id == window_id).first()
    if not mw:
        raise HTTPException(status_code=404, detail="Maintenance window not found")

    db.delete(mw)
    db.commit()

    logger.info(f"Deleted maintenance window {window_id}")

    return {"success": True, "message": "Maintenance window deleted"}


@router.post("/{window_id}/cancel")
def cancel_maintenance_window(
    window_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Cancel a maintenance window (early termination).
    Sets status to 'cancelled' and preserves history.
    """
    mw = db.query(MaintenanceWindow).filter(MaintenanceWindow.id == window_id).first()
    if not mw:
        raise HTTPException(status_code=404, detail="Maintenance window not found")

    if mw.status in ["completed", "cancelled"]:
        raise HTTPException(status_code=400, detail=f"Maintenance window already {mw.status}")

    mw.status = "cancelled"
    mw.end_time = datetime.utcnow()  # Set end time to now

    db.commit()
    db.refresh(mw)

    service = db.query(Service).filter(Service.id == mw.service_id).first()
    logger.info(f"Cancelled maintenance window {window_id}")

    return {
        "success": True,
        "message": "Maintenance window cancelled",
        "maintenance_window": maintenance_to_response(mw, service.name if service else None)
    }


@router.get("/service/{service_id}/active")
def get_active_maintenance(
    service_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Check if a service is currently in maintenance."""
    now = datetime.utcnow()

    active_window = db.query(MaintenanceWindow).filter(
        MaintenanceWindow.service_id == service_id,
        MaintenanceWindow.status == "active",
        MaintenanceWindow.start_time <= now,
        MaintenanceWindow.end_time > now
    ).first()

    if active_window:
        service = db.query(Service).filter(Service.id == service_id).first()
        return {
            "success": True,
            "in_maintenance": True,
            "maintenance_window": maintenance_to_response(active_window, service.name if service else None)
        }

    return {"success": True, "in_maintenance": False, "maintenance_window": None}


def is_service_in_maintenance(db: Session, service_id: int) -> bool:
    """
    Check if a service is currently in an active maintenance window.
    Used by scheduler to suppress notifications.
    """
    now = datetime.utcnow()

    active_window = db.query(MaintenanceWindow).filter(
        MaintenanceWindow.service_id == service_id,
        MaintenanceWindow.status == "active",
        MaintenanceWindow.start_time <= now,
        MaintenanceWindow.end_time > now
    ).first()

    return active_window is not None


def get_service_maintenance_info(db: Session, service_id: int) -> dict:
    """
    Get maintenance info for a service.
    Returns active maintenance and upcoming maintenance (next 24 hours).
    Used by dashboard and public status page.
    """
    now = datetime.utcnow()
    from datetime import timedelta
    next_24h = now + timedelta(hours=24)

    # Check for active maintenance
    active_window = db.query(MaintenanceWindow).filter(
        MaintenanceWindow.service_id == service_id,
        MaintenanceWindow.status == "active",
        MaintenanceWindow.start_time <= now,
        MaintenanceWindow.end_time > now
    ).first()

    # Check for upcoming maintenance in next 24 hours
    upcoming_window = db.query(MaintenanceWindow).filter(
        MaintenanceWindow.service_id == service_id,
        MaintenanceWindow.status == "scheduled",
        MaintenanceWindow.start_time > now,
        MaintenanceWindow.start_time <= next_24h
    ).order_by(MaintenanceWindow.start_time.asc()).first()

    return {
        "in_maintenance": active_window is not None,
        "active_maintenance": {
            "id": active_window.id,
            "start_time": active_window.start_time.isoformat() + 'Z',
            "end_time": active_window.end_time.isoformat() + 'Z',
            "reason": active_window.reason
        } if active_window else None,
        "upcoming_maintenance": {
            "id": upcoming_window.id,
            "start_time": upcoming_window.start_time.isoformat() + 'Z',
            "end_time": upcoming_window.end_time.isoformat() + 'Z',
            "reason": upcoming_window.reason
        } if upcoming_window else None
    }
