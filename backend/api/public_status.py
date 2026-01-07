"""
Public Status Page API endpoints.
Provides public access to service status without authentication.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db, Service, Incident
from datetime import datetime, timedelta
from utils.uptime import calculate_service_uptime_window
from utils.service_status import get_service_current_status

router = APIRouter(prefix="/api/v1", tags=["public_status"])


@router.get("/status/public")
def get_public_status(db: Session = Depends(get_db)):
    """
    Get current status for all services marked as public.
    No authentication required - this is the public status page.

    Returns:
        - Current service status (aggregated from monitors)
        - 7-day uptime percentage
        - Recent incidents (last 7 days)
    """
    services = db.query(Service).filter(
        Service.show_on_status_page == True,
        Service.is_active == True
    ).all()

    result = []
    seven_days_ago = datetime.utcnow() - timedelta(days=7)

    for service in services:
        # Get current status using shared utility
        status_data = get_service_current_status(db, service.id)

        # Calculate 7-day uptime percentage
        uptime_percentage = calculate_service_uptime_window(db, service.id, seven_days_ago)
        if uptime_percentage is None:
            uptime_percentage = 100.0

        # Get recent incidents (last 7 days)
        recent_incidents = db.query(Incident).filter(
            Incident.service_id == service.id,
            Incident.started_at >= seven_days_ago
        ).order_by(Incident.started_at.desc()).all()

        incidents_data = [{
            "started_at": incident.started_at.isoformat(),
            "ended_at": incident.ended_at.isoformat() if incident.ended_at else None,
            "duration_seconds": incident.duration_seconds,
            "severity": incident.severity,
            "status": incident.status
        } for incident in recent_incidents]

        result.append({
            "service_name": service.name,
            "description": service.description,
            "status": status_data["status"],
            "last_checked": status_data["latest_timestamp"].isoformat() if status_data["latest_timestamp"] else None,
            "uptime_7d": round(uptime_percentage, 2),
            "recent_incidents": incidents_data
        })

    return {
        "services": result,
        "updated_at": datetime.utcnow().isoformat()
    }
