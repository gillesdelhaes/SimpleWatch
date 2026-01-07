"""
Public Status Page API endpoints.
Provides public access to service status without authentication.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, StatusUpdate, Service, Monitor, Incident
from datetime import datetime, timedelta
from utils.uptime import calculate_service_uptime_window
import json
from typing import List, Optional

router = APIRouter(prefix="/api/v1", tags=["public_status"])


def calculate_service_status_from_counts(operational: int, degraded: int, down: int) -> str:
    """
    Calculate overall service status from monitor status counts.

    Rules:
    - All operational → operational
    - All down → down
    - Mixed → degraded
    - No valid statuses → unknown

    Args:
        operational: Count of operational monitors
        degraded: Count of degraded monitors
        down: Count of down monitors

    Returns:
        Overall status: 'operational', 'degraded', 'down', or 'unknown'
    """
    total_monitors = operational + degraded + down

    if total_monitors == 0:
        return "unknown"
    elif operational == total_monitors:
        return "operational"
    elif down == total_monitors:
        return "down"
    else:
        # Some monitors failing = degraded
        return "degraded"


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
    # Get all services marked for public display
    services = db.query(Service).filter(
        Service.show_on_status_page == True,
        Service.is_active == True
    ).all()

    result = []
    seven_days_ago = datetime.utcnow() - timedelta(days=7)

    for service in services:
        # Get all active monitors for this service
        monitors = db.query(Monitor).filter(
            Monitor.service_id == service.id,
            Monitor.is_active == True
        ).all()

        # Calculate current status (aggregated from all monitors)
        overall_status = "unknown"
        latest_timestamp = None

        if monitors:
            operational_count = 0
            degraded_count = 0
            down_count = 0

            for monitor in monitors:
                latest_status = db.query(StatusUpdate).filter(
                    StatusUpdate.monitor_id == monitor.id
                ).order_by(StatusUpdate.timestamp.desc()).first()

                if latest_status:
                    # Count statuses for aggregation
                    if latest_status.status == "operational":
                        operational_count += 1
                    elif latest_status.status == "degraded":
                        degraded_count += 1
                    elif latest_status.status == "down":
                        down_count += 1

                    # Track latest timestamp
                    if latest_timestamp is None or latest_status.timestamp > latest_timestamp:
                        latest_timestamp = latest_status.timestamp

            # Determine overall service status based on monitor statuses
            overall_status = calculate_service_status_from_counts(
                operational_count, degraded_count, down_count
            )

        # Calculate 7-day uptime percentage
        uptime_percentage = calculate_service_uptime_window(db, service.id, seven_days_ago)
        if uptime_percentage is None:
            uptime_percentage = 100.0  # Default to 100% if no data

        # Get recent incidents (last 7 days)
        recent_incidents = db.query(Incident).filter(
            Incident.service_id == service.id,
            Incident.started_at >= seven_days_ago
        ).order_by(Incident.started_at.desc()).all()

        incidents_data = []
        for incident in recent_incidents:
            incidents_data.append({
                "started_at": incident.started_at.isoformat(),
                "ended_at": incident.ended_at.isoformat() if incident.ended_at else None,
                "duration_seconds": incident.duration_seconds,
                "severity": incident.severity,
                "status": incident.status
            })

        # Add service to result
        result.append({
            "service_name": service.name,
            "description": service.description,
            "status": overall_status,
            "last_checked": latest_timestamp.isoformat() if latest_timestamp else None,
            "uptime_7d": round(uptime_percentage, 2),
            "recent_incidents": incidents_data
        })

    return {
        "services": result,
        "updated_at": datetime.utcnow().isoformat()
    }
