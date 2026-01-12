"""
SLA calculation utilities for SimpleWatch.
"""
from sqlalchemy.orm import Session
from database import Service
from datetime import datetime, timedelta
from typing import Dict, Optional
import logging
from utils.uptime import calculate_service_uptime_window

logger = logging.getLogger(__name__)


def update_sla_cache(db: Session):
    """
    Update cached SLA data for all services with SLA configured.
    Called by background job every 5 minutes to keep SLA data fresh.

    Args:
        db: Database session
    """
    # Only get services with SLA configured
    services = db.query(Service).filter(
        Service.is_active == True,
        Service.sla_target.isnot(None),
        Service.sla_timeframe_days.isnot(None)
    ).all()

    if not services:
        return

    logger.info(f"Updating SLA cache for {len(services)} services")

    for service in services:
        try:
            sla_data = calculate_service_sla(db, service.id)

            if sla_data:
                service.cached_sla_percentage = sla_data["percentage"]
                service.cached_sla_status = sla_data["status"]
                service.cached_sla_error_budget_seconds = sla_data["error_budget_seconds"]
                service.cached_sla_updated_at = datetime.utcnow()
            else:
                # No SLA data available
                service.cached_sla_percentage = None
                service.cached_sla_status = None
                service.cached_sla_error_budget_seconds = None
                service.cached_sla_updated_at = datetime.utcnow()

        except Exception as e:
            logger.error(f"Error updating SLA cache for service {service.id}: {e}")
            continue

    db.commit()
    logger.info(f"SLA cache updated for {len(services)} services")


def calculate_service_sla(db: Session, service_id: int) -> Optional[Dict]:
    """
    Calculate SLA metrics for a service.

    Uses the service's configured SLA target and timeframe to calculate:
    - Actual uptime percentage in the SLA period
    - Error budget remaining (allowed downtime not yet consumed)
    - SLA status (ok, at_risk, breached)

    Args:
        db: Database session
        service_id: ID of the service

    Returns:
        Dict with percentage, status, and error_budget_seconds, or None if no SLA configured
        Example: {
            "percentage": 99.87,
            "status": "ok",
            "error_budget_seconds": 11520
        }
    """
    # Get service
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        return None

    # Check if SLA is configured
    if service.sla_target is None or service.sla_timeframe_days is None:
        return None

    # Calculate cutoff time based on SLA timeframe
    cutoff_time = datetime.utcnow() - timedelta(days=service.sla_timeframe_days)

    # Calculate actual uptime percentage using existing function
    actual_uptime = calculate_service_uptime_window(db, service_id, cutoff_time)

    if actual_uptime is None:
        # No data available for this period
        return None

    # Calculate error budget
    # Error budget = (100 - SLA target) * total seconds in period
    # Example: 99.9% SLA over 30 days = 0.1% allowed downtime = 43.2 minutes
    total_seconds = service.sla_timeframe_days * 86400  # 86400 seconds per day
    allowed_downtime_percentage = 100 - service.sla_target
    total_error_budget_seconds = (allowed_downtime_percentage / 100) * total_seconds

    # Calculate consumed downtime
    actual_downtime_percentage = 100 - actual_uptime
    consumed_downtime_seconds = (actual_downtime_percentage / 100) * total_seconds

    # Remaining error budget
    error_budget_seconds = total_error_budget_seconds - consumed_downtime_seconds
    error_budget_seconds = max(0, error_budget_seconds)  # Can't be negative

    # Calculate error budget consumption percentage
    if total_error_budget_seconds > 0:
        error_budget_consumed_pct = (consumed_downtime_seconds / total_error_budget_seconds) * 100
    else:
        # If SLA target is 100%, any downtime is a breach
        error_budget_consumed_pct = 100 if actual_downtime_percentage > 0 else 0

    # Determine SLA status based on error budget consumption
    if error_budget_consumed_pct < 50:
        sla_status = "ok"  # Green
    elif error_budget_consumed_pct < 80:
        sla_status = "at_risk"  # Yellow
    else:
        sla_status = "breached"  # Red

    return {
        "percentage": round(actual_uptime, 2),
        "status": sla_status,
        "error_budget_seconds": int(error_budget_seconds)
    }
