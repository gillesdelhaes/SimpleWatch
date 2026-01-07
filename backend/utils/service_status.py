"""
Service status calculation utilities.
Single source of truth for calculating aggregated service status from monitors.
"""
from sqlalchemy.orm import Session
from database import Monitor, StatusUpdate
from typing import Dict, Optional


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
        return "degraded"


def get_service_current_status(db: Session, service_id: int) -> Dict:
    """
    Get the current aggregated status for a service based on its monitors.

    Args:
        db: Database session
        service_id: ID of the service

    Returns:
        Dict with:
        - status: Overall service status ('operational', 'degraded', 'down', 'unknown')
        - latest_timestamp: Most recent status update timestamp
        - operational_count: Count of operational monitors
        - degraded_count: Count of degraded monitors
        - down_count: Count of down monitors
    """
    monitors = db.query(Monitor).filter(
        Monitor.service_id == service_id,
        Monitor.is_active == True
    ).all()

    if not monitors:
        return {
            "status": "unknown",
            "latest_timestamp": None,
            "operational_count": 0,
            "degraded_count": 0,
            "down_count": 0
        }

    operational_count = 0
    degraded_count = 0
    down_count = 0
    latest_timestamp = None

    for monitor in monitors:
        latest_status = db.query(StatusUpdate).filter(
            StatusUpdate.monitor_id == monitor.id
        ).order_by(StatusUpdate.timestamp.desc()).first()

        if latest_status:
            if latest_status.status == "operational":
                operational_count += 1
            elif latest_status.status == "degraded":
                degraded_count += 1
            elif latest_status.status == "down":
                down_count += 1

            if latest_timestamp is None or latest_status.timestamp > latest_timestamp:
                latest_timestamp = latest_status.timestamp

    overall_status = calculate_service_status_from_counts(
        operational_count, degraded_count, down_count
    )

    return {
        "status": overall_status,
        "latest_timestamp": latest_timestamp,
        "operational_count": operational_count,
        "degraded_count": degraded_count,
        "down_count": down_count
    }
