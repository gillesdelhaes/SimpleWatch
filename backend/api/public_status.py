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

        # Get incidents for public display:
        # - Always show ongoing incidents
        # - Show last resolved incident only if within 48 hours
        incidents_data = []
        forty_eight_hours_ago = datetime.utcnow() - timedelta(hours=48)

        # Get ongoing incidents (always show)
        ongoing_incidents = db.query(Incident).filter(
            Incident.service_id == service.id,
            Incident.status == "ongoing"
        ).order_by(Incident.started_at.desc()).all()

        for incident in ongoing_incidents:
            incidents_data.append({
                "started_at": incident.started_at.isoformat(),
                "ended_at": None,
                "duration_seconds": None,
                "severity": incident.severity,
                "status": "ongoing"
            })

        # Get last resolved incident if within 48 hours
        if not ongoing_incidents:
            last_resolved = db.query(Incident).filter(
                Incident.service_id == service.id,
                Incident.status == "resolved",
                Incident.ended_at >= forty_eight_hours_ago
            ).order_by(Incident.ended_at.desc()).first()

            if last_resolved:
                incidents_data.append({
                    "started_at": last_resolved.started_at.isoformat(),
                    "ended_at": last_resolved.ended_at.isoformat(),
                    "duration_seconds": last_resolved.duration_seconds,
                    "severity": last_resolved.severity,
                    "status": "resolved"
                })

        # Get maintenance info for public display
        from api.maintenance import get_service_maintenance_info
        maintenance_info = get_service_maintenance_info(db, service.id)

        result.append({
            "service_name": service.name,
            "description": service.description,
            "status": status_data["status"],
            "last_checked": status_data["latest_timestamp"].isoformat() if status_data["latest_timestamp"] else None,
            "uptime_7d": round(uptime_percentage, 2),
            "recent_incidents": incidents_data,
            "maintenance": maintenance_info
        })

    return {
        "services": result,
        "updated_at": datetime.utcnow().isoformat()
    }
