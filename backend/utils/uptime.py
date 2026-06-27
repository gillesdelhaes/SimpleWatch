"""
Uptime calculation utilities for SimpleWatch.
"""
from sqlalchemy.orm import Session
from database import Service, StatusUpdate, Monitor
from datetime import datetime, timedelta
from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)


def update_uptime_cache(db: Session):
    """
    Update cached uptime data for all active services.
    Called by background job every 5 minutes to keep uptime data fresh.

    Args:
        db: Database session
    """
    services = db.query(Service).filter(Service.is_active == True).all()

    if not services:
        return

    logger.info(f"Updating uptime cache for {len(services)} services")

    for service in services:
        try:
            uptime_data = calculate_service_uptime(db, service.id)

            if uptime_data:
                service.cached_uptime_percentage = uptime_data["percentage"]
                service.cached_uptime_period_days = uptime_data["period_days"]
                service.cached_uptime_period_label = uptime_data["period_label"]
                service.cached_uptime_updated_at = datetime.utcnow()
            else:
                # No uptime data available (new service or no status updates)
                service.cached_uptime_percentage = None
                service.cached_uptime_period_days = None
                service.cached_uptime_period_label = None
                service.cached_uptime_updated_at = datetime.utcnow()

        except Exception as e:
            logger.error(f"Error updating uptime cache for service {service.id}: {e}")
            continue

    db.commit()
    logger.info(f"Uptime cache updated for {len(services)} services")


def _accumulate_operational_seconds(
    sorted_timestamps, timeline, monitor_status: dict,
    previous_service_status: str, start_time: datetime
) -> float:
    """
    Walk a monitor-status timeline forward, accumulating seconds spent in operational state.
    Mutates monitor_status in place. Returns total operational seconds including tail to now.
    """
    operational_seconds = 0.0
    previous_time = start_time

    for ts in sorted_timestamps:
        duration = (ts - previous_time).total_seconds()
        if previous_service_status == "operational":
            operational_seconds += duration

        for mid, status in timeline[ts].items():
            monitor_status[mid] = status

        operational_count = sum(1 for s in monitor_status.values() if s == "operational")
        total_monitors = len(monitor_status)
        if operational_count == total_monitors:
            previous_service_status = "operational"
        elif operational_count == 0:
            previous_service_status = "down"
        else:
            previous_service_status = "degraded"

        previous_time = ts

    final_duration = (datetime.utcnow() - previous_time).total_seconds()
    if previous_service_status == "operational":
        operational_seconds += final_duration

    return operational_seconds


def calculate_service_uptime_window(db: Session, service_id: int, cutoff_time: datetime) -> Optional[float]:
    """
    Calculate uptime percentage for a service within a specific time window.
    Used by incidents page for time-filtered uptime stats.

    Args:
        db: Database session
        service_id: ID of the service
        cutoff_time: Start of the time window (e.g., now - 24 hours)

    Returns:
        Uptime percentage (0-100) or None if no data available
    """
    # Get all monitors for this service
    monitors = db.query(Monitor).filter(
        Monitor.service_id == service_id,
        Monitor.is_active == True
    ).all()

    if not monitors:
        return None

    # Get service to check creation date
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service or not service.created_at:
        return None

    # If service is younger than the time window, use creation date as cutoff
    # This prevents counting time before the service existed as "operational"
    actual_cutoff = max(cutoff_time, service.created_at)

    # Get status updates for all monitors in the time window
    monitor_ids = [m.id for m in monitors]
    all_status_updates = db.query(StatusUpdate).filter(
        StatusUpdate.service_id == service_id,
        StatusUpdate.monitor_id.in_(monitor_ids),
        StatusUpdate.timestamp >= actual_cutoff
    ).order_by(StatusUpdate.timestamp).all()

    if not all_status_updates:
        return None

    # Build timeline
    timeline = {}
    for update in all_status_updates:
        ts = update.timestamp
        if ts not in timeline:
            timeline[ts] = {}
        timeline[ts][update.monitor_id] = update.status

    sorted_timestamps = sorted(timeline.keys())

    # Track current status for each monitor
    # Initialize from last known status BEFORE actual_cutoff
    monitor_status = {}
    for mid in monitor_ids:
        # Get last status update before actual_cutoff
        last_status = db.query(StatusUpdate).filter(
            StatusUpdate.monitor_id == mid,
            StatusUpdate.timestamp < actual_cutoff
        ).order_by(StatusUpdate.timestamp.desc()).first()

        # If we have a status before cutoff, use it; otherwise assume operational
        monitor_status[mid] = last_status.status if last_status else "operational"

    # Derive initial service status from seeded monitor statuses
    operational_count = sum(1 for s in monitor_status.values() if s == "operational")
    total_monitors = len(monitor_status)
    if operational_count == total_monitors:
        initial_service_status = "operational"
    elif operational_count == 0:
        initial_service_status = "down"
    else:
        initial_service_status = "degraded"

    operational_seconds = _accumulate_operational_seconds(
        sorted_timestamps, timeline, monitor_status, initial_service_status, actual_cutoff
    )

    total_seconds = (datetime.utcnow() - actual_cutoff).total_seconds()
    if total_seconds > 0:
        return round((operational_seconds / total_seconds) * 100, 1)
    return 100.0


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

    # Get status updates for all monitors in the period (in one query)
    monitor_ids = [m.id for m in monitors]
    all_status_updates = db.query(StatusUpdate).filter(
        StatusUpdate.service_id == service_id,
        StatusUpdate.monitor_id.in_(monitor_ids),
        StatusUpdate.timestamp >= cutoff_time
    ).order_by(StatusUpdate.timestamp).all()

    if not all_status_updates:
        # No status updates in period - service never initialized
        # Return None so frontend can display "N/A" or hide uptime
        logger.info(f"Service {service_id}: No status updates, returning None")
        return None

    # Build timeline of all monitor status changes
    # Group updates by timestamp for efficient processing
    timeline = {}
    for update in all_status_updates:
        ts = update.timestamp
        if ts not in timeline:
            timeline[ts] = {}
        timeline[ts][update.monitor_id] = update.status

    # Sort timestamps
    sorted_timestamps = sorted(timeline.keys())

    # All monitors assumed operational at start of period (no pre-seeding needed here)
    monitor_status = {mid: "operational" for mid in monitor_ids}

    operational_seconds = _accumulate_operational_seconds(
        sorted_timestamps, timeline, monitor_status, "operational", cutoff_time
    )

    if actual_period_seconds > 0:
        uptime_percentage = round((operational_seconds / actual_period_seconds) * 100, 1)
    else:
        uptime_percentage = 100.0

    return {
        "percentage": uptime_percentage,
        "period_days": period_days,
        "period_label": period_label
    }

