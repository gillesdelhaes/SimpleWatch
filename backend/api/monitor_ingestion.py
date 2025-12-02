"""
Monitor data ingestion API endpoints.
External systems POST data to these endpoints to update monitor status.
Includes heartbeat pings for deadman monitors and metric values for threshold monitors.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, Service, Monitor, StatusUpdate
from datetime import datetime
from pydantic import BaseModel
import json

heartbeat_router = APIRouter(prefix="/api/v1/heartbeat", tags=["monitor-ingestion"])
metric_router = APIRouter(prefix="/api/v1/metric", tags=["monitor-ingestion"])


class HeartbeatRequest(BaseModel):
    """Heartbeat ping request."""
    api_key: str


class MetricUpdateRequest(BaseModel):
    """Metric value update request."""
    api_key: str
    value: float


class MetricUpdateResponse(BaseModel):
    """Metric update response."""
    success: bool
    service: str
    value: float
    status: str
    reason: str


@heartbeat_router.post("/{service_name}/{monitor_name}")
def receive_heartbeat(
    service_name: str,
    monitor_name: str,
    heartbeat: HeartbeatRequest,
    db: Session = Depends(get_db)
):
    """
    Receive a heartbeat ping for a deadman monitor.

    This endpoint is called by external processes (cron jobs, backups, etc.)
    to signal they are still alive and running. Both service_name and monitor_name
    are required to identify which specific deadman monitor to update.
    """
    # Find service by name
    service = db.query(Service).filter(
        Service.name == service_name,
        Service.is_active == True
    ).first()

    if not service:
        raise HTTPException(status_code=404, detail=f"Service '{service_name}' not found")

    # Find deadman monitor by name in config
    monitors = db.query(Monitor).filter(
        Monitor.service_id == service.id,
        Monitor.monitor_type == "deadman",
        Monitor.is_active == True
    ).all()

    monitor = None
    for m in monitors:
        config = json.loads(m.config_json)
        if config.get("name") == monitor_name:
            monitor = m
            break

    if not monitor:
        raise HTTPException(
            status_code=404,
            detail=f"No active deadman monitor named '{monitor_name}' found for service '{service_name}'"
        )

    # Verify API key
    from api.auth import get_user_from_api_key
    user = get_user_from_api_key(heartbeat.api_key, db)

    # Update monitor's last_check_at to mark heartbeat received
    monitor.last_check_at = datetime.utcnow()

    # Create a status update marking the heartbeat as received
    status_update = StatusUpdate(
        service_id=service.id,
        monitor_id=monitor.id,
        status="operational",
        timestamp=datetime.utcnow(),
        response_time_ms=0,
        metadata_json=json.dumps({
            "type": "heartbeat",
            "message": "Heartbeat received",
            "heartbeat_time": datetime.utcnow().isoformat()
        })
    )

    db.add(status_update)
    db.commit()

    # Check if service status changed and send notifications
    from services.notification_service import determine_service_status, send_service_notification
    from database import ServiceNotificationSettings

    new_service_status = determine_service_status(db, service.id)

    # Get previous service status from notification settings
    settings = db.query(ServiceNotificationSettings).filter(
        ServiceNotificationSettings.service_id == service.id
    ).first()

    old_service_status = settings.last_notified_status if settings else "unknown"

    # If status changed, send notification
    if new_service_status != old_service_status:
        send_service_notification(db, service.id, old_service_status, new_service_status)

    return {
        "success": True,
        "message": f"Heartbeat received for '{service_name}'",
        "timestamp": datetime.utcnow().isoformat()
    }


# ============================================
# Metric Monitor Data Ingestion
# ============================================

@metric_router.post("/{service_name}/{monitor_name}", response_model=MetricUpdateResponse)
def update_metric(
    service_name: str,
    monitor_name: str,
    request: MetricUpdateRequest,
    db: Session = Depends(get_db)
):
    """
    Submit a metric value for a metric threshold monitor.

    External systems POST metric values to this endpoint. The monitor evaluates
    the value against configured thresholds and creates appropriate status updates.
    Both service_name and monitor_name are required to identify the specific monitor.
    """
    # Verify API key
    from api.auth import get_user_from_api_key
    user = get_user_from_api_key(request.api_key, db)

    # Find service by name
    service = db.query(Service).filter(
        Service.name == service_name,
        Service.is_active == True
    ).first()

    if not service:
        raise HTTPException(status_code=404, detail=f"Service '{service_name}' not found")

    # Find metric monitor by name in config
    monitors = db.query(Monitor).filter(
        Monitor.service_id == service.id,
        Monitor.monitor_type == "metric_threshold",
        Monitor.is_active == True
    ).all()

    monitor = None
    for m in monitors:
        config = json.loads(m.config_json)
        if config.get("name") == monitor_name:
            monitor = m
            break

    if not monitor:
        raise HTTPException(
            status_code=404,
            detail=f"No active metric threshold monitor named '{monitor_name}' found for service '{service_name}'"
        )

    # Load monitor configuration
    config = json.loads(monitor.config_json)
    warning_threshold = config.get("warning_threshold")
    critical_threshold = config.get("critical_threshold")
    comparison = config.get("comparison", "greater")

    # Evaluate metric value against thresholds
    status = "operational"
    reason = f"Value {request.value} is within normal range"

    if comparison == "greater":
        if request.value >= critical_threshold:
            status = "down"
            reason = f"Value {request.value} exceeds critical threshold of {critical_threshold}"
        elif request.value >= warning_threshold:
            status = "degraded"
            reason = f"Value {request.value} exceeds warning threshold of {warning_threshold}"
    else:
        if request.value <= critical_threshold:
            status = "down"
            reason = f"Value {request.value} is below critical threshold of {critical_threshold}"
        elif request.value <= warning_threshold:
            status = "degraded"
            reason = f"Value {request.value} is below warning threshold of {warning_threshold}"

    # Create status update
    status_update = StatusUpdate(
        service_id=service.id,
        monitor_id=monitor.id,
        status=status,
        timestamp=datetime.utcnow(),
        metadata_json=json.dumps({"value": request.value, "reason": reason})
    )
    db.add(status_update)
    db.commit()

    # Check if service status changed and send notifications
    from services.notification_service import determine_service_status, send_service_notification
    from database import ServiceNotificationSettings

    new_service_status = determine_service_status(db, service.id)

    # Get previous service status from notification settings
    settings = db.query(ServiceNotificationSettings).filter(
        ServiceNotificationSettings.service_id == service.id
    ).first()

    old_service_status = settings.last_notified_status if settings else "unknown"

    # If status changed, send notification
    if new_service_status != old_service_status:
        send_service_notification(db, service.id, old_service_status, new_service_status)

    return MetricUpdateResponse(
        success=True,
        service=service_name,
        value=request.value,
        status=status,
        reason=reason
    )
