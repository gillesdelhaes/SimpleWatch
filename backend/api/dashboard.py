"""
Dashboard API endpoints.
Provides read-only status queries for the dashboard.
All status is derived from monitors - no arbitrary status updates allowed.
"""
from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session
from database import get_db, StatusUpdate, Service
from models import StatusResponse
from api.auth import get_user_from_api_key
from utils.uptime import calculate_service_uptime
from datetime import datetime
import json
from typing import List, Optional

router = APIRouter(prefix="/api/v1", tags=["dashboard"])


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


# ============================================
# Dashboard Status Query Endpoints (Read-Only)
# ============================================

@router.get("/status/all")
def get_all_status(api_key: str, db: Session = Depends(get_db)):
    """Get current status for all services with aggregated monitor status."""
    from database import Monitor
    get_user_from_api_key(api_key, db)

    services = db.query(Service).filter(Service.is_active == True).all()

    result = []
    for service in services:
        # Get all active monitors for this service
        monitors = db.query(Monitor).filter(
            Monitor.service_id == service.id,
            Monitor.is_active == True
        ).all()

        monitor_statuses = []
        overall_status = "unknown"
        latest_timestamp = None
        aggregate_response_time = None

        if monitors:
            # Get the latest status for each monitor
            operational_count = 0
            degraded_count = 0
            down_count = 0
            total_response_time = 0
            response_time_count = 0

            for monitor in monitors:
                latest_status = db.query(StatusUpdate).filter(
                    StatusUpdate.monitor_id == monitor.id
                ).order_by(StatusUpdate.timestamp.desc()).first()

                config = json.loads(monitor.config_json) if monitor.config_json else {}

                if latest_status:
                    metadata = json.loads(latest_status.metadata_json) if latest_status.metadata_json else {}

                    # For deadman monitors, use monitor.last_check_at (actual heartbeat time)
                    # For other monitors, use latest_status.timestamp (last check time)
                    timestamp = monitor.last_check_at if monitor.monitor_type == "deadman" else latest_status.timestamp

                    monitor_statuses.append({
                        "monitor_id": monitor.id,
                        "monitor_type": monitor.monitor_type,
                        "config": config,
                        "check_interval_minutes": monitor.check_interval_minutes,
                        "is_active": monitor.is_active,
                        "status": latest_status.status,
                        "timestamp": timestamp,
                        "response_time_ms": latest_status.response_time_ms,
                        "metadata": metadata
                    })

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

                    # Calculate average response time
                    if latest_status.response_time_ms:
                        total_response_time += latest_status.response_time_ms
                        response_time_count += 1
                else:
                    # Monitor exists but has no status updates yet (e.g., passive metric monitors)
                    monitor_statuses.append({
                        "monitor_id": monitor.id,
                        "monitor_type": monitor.monitor_type,
                        "config": config,
                        "check_interval_minutes": monitor.check_interval_minutes,
                        "is_active": monitor.is_active,
                        "status": "unknown",
                        "timestamp": None,
                        "response_time_ms": None,
                        "metadata": {}
                    })

            # Determine overall service status based on monitor statuses
            overall_status = calculate_service_status_from_counts(
                operational_count, degraded_count, down_count
            )

            # Calculate average response time
            if response_time_count > 0:
                aggregate_response_time = total_response_time // response_time_count

        # Fallback to old behavior if no monitors (shouldn't happen but for safety)
        if not monitor_statuses:
            latest_status = db.query(StatusUpdate).filter(
                StatusUpdate.service_id == service.id
            ).order_by(StatusUpdate.timestamp.desc()).first()

            if latest_status:
                overall_status = latest_status.status
                latest_timestamp = latest_status.timestamp
                aggregate_response_time = latest_status.response_time_ms

        # Calculate uptime for this service
        uptime_data = calculate_service_uptime(db, service.id)

        # Include service if it has monitors or has been checked
        if monitor_statuses or latest_timestamp:
            result.append({
                "service": service.name,
                "service_id": service.id,
                "status": overall_status,
                "timestamp": latest_timestamp,
                "response_time_ms": aggregate_response_time,
                "monitor_count": len(monitors),
                "monitors": monitor_statuses,
                "uptime": uptime_data
            })

    return {"services": result}


@router.get("/status/{service_name}", response_model=StatusResponse)
def get_status(
    service_name: str,
    api_key: str,
    db: Session = Depends(get_db)
):
    """Get current status for a service."""
    get_user_from_api_key(api_key, db)

    service = get_service_by_name(db, service_name)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    latest_status = db.query(StatusUpdate).filter(
        StatusUpdate.service_id == service.id
    ).order_by(StatusUpdate.timestamp.desc()).first()

    if not latest_status:
        raise HTTPException(status_code=404, detail="No status data available")

    metadata = json.loads(latest_status.metadata_json) if latest_status.metadata_json else None

    return StatusResponse(
        service=service_name,
        status=latest_status.status,
        timestamp=latest_status.timestamp,
        response_time_ms=latest_status.response_time_ms,
        metadata=metadata
    )
