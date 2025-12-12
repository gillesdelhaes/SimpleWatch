"""
Uptime calculation utilities for SimpleWatch.
"""
from sqlalchemy.orm import Session
from database import Service, StatusUpdate, Monitor
from datetime import datetime, timedelta
from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)


def calculate_service_uptime(db: Session, service_id: int) -> Optional[Dict]:
    """
    Calculate uptime percentage for a service.

    Returns uptime for the last year (if service is > 1 year old) or since creation.
    Only counts "operational" status as uptime.

    Args:
        db: Database session
        service_id: ID of the service

    Returns:
        Dict with percentage and period_label, or None if no data
        Example: {"percentage": 99.5, "period_days": 30, "period_label": "30d"}
    """
    # Get service
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service or not service.created_at:
        return None

    # Determine time period
    service_age = datetime.utcnow() - service.created_at
    service_age_days = service_age.days

    if service_age_days >= 365:
        period_days = 365
        period_label = "1y"
        # Use actual period (1 year from now)
        cutoff_time = datetime.utcnow() - timedelta(days=365)
        if service.created_at > cutoff_time:
            cutoff_time = service.created_at
            actual_period_seconds = (datetime.utcnow() - cutoff_time).total_seconds()
        else:
            actual_period_seconds = 365 * 86400
    else:
        # For services younger than 1 year, ALWAYS use since creation
        period_days = max(service_age_days, 1)  # At least 1 day for display
        period_label = f"{period_days}d"
        cutoff_time = service.created_at
        actual_period_seconds = (datetime.utcnow() - service.created_at).total_seconds()

    # Get all monitors for this service
    monitors = db.query(Monitor).filter(
        Monitor.service_id == service_id,
        Monitor.is_active == True
    ).all()

    if not monitors:
        return None

    # Get status updates for all monitors in the period
    monitor_ids = [m.id for m in monitors]
    status_updates = db.query(StatusUpdate).filter(
        StatusUpdate.service_id == service_id,
        StatusUpdate.timestamp >= cutoff_time
    ).order_by(StatusUpdate.timestamp).all()

    if not status_updates:
        # No status updates in period - service never initialized
        # Return None so frontend can display "N/A" or hide uptime
        logger.info(f"Service {service_id}: No status updates, returning None")
        return None

    # Calculate uptime by tracking service status over time
    operational_seconds = 0.0

    # Get initial status at cutoff time (or assume operational)
    previous_status = "operational"
    previous_time = cutoff_time

    for update in status_updates:
        # Calculate duration since last update
        duration = (update.timestamp - previous_time).total_seconds()

        # Add to operational time if previous status was operational
        if previous_status == "operational":
            operational_seconds += duration

        # Determine service status at this update
        # Service is operational only if ALL monitors are operational
        # We need to check all monitor statuses at this point
        previous_status = get_service_status_at_time(db, service_id, monitor_ids, update.timestamp)
        previous_time = update.timestamp

    # Add time from last update to now
    final_duration = (datetime.utcnow() - previous_time).total_seconds()
    if previous_status == "operational":
        operational_seconds += final_duration

    # Calculate percentage
    if actual_period_seconds > 0:
        uptime_percentage = (operational_seconds / actual_period_seconds) * 100
        uptime_percentage = round(uptime_percentage, 1)
    else:
        uptime_percentage = 100.0

    return {
        "percentage": uptime_percentage,
        "period_days": period_days,
        "period_label": period_label
    }


def get_service_status_at_time(db: Session, service_id: int, monitor_ids: list, timestamp: datetime) -> str:
    """
    Determine aggregated service status at a specific point in time.
    Service is operational only if ALL monitors are operational.

    Args:
        db: Database session
        service_id: Service ID
        monitor_ids: List of monitor IDs for this service
        timestamp: Point in time to check

    Returns:
        "operational", "degraded", or "down"
    """
    # Get the latest status for each monitor before or at the timestamp
    monitor_statuses = {}

    for monitor_id in monitor_ids:
        latest = db.query(StatusUpdate).filter(
            StatusUpdate.monitor_id == monitor_id,
            StatusUpdate.timestamp <= timestamp
        ).order_by(StatusUpdate.timestamp.desc()).first()

        if latest:
            monitor_statuses[monitor_id] = latest.status
        else:
            # No status yet, assume operational
            monitor_statuses[monitor_id] = "operational"

    # Count statuses
    operational_count = sum(1 for s in monitor_statuses.values() if s == "operational")
    degraded_count = sum(1 for s in monitor_statuses.values() if s == "degraded")
    down_count = sum(1 for s in monitor_statuses.values() if s == "down")
    total_count = len(monitor_statuses)

    # Apply same logic as dashboard status calculation
    if operational_count == total_count:
        return "operational"
    elif down_count == total_count:
        return "down"
    else:
        return "degraded"
