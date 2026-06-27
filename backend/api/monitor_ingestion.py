"""
Monitor data ingestion API endpoints.
External systems POST data to these endpoints to update monitor status.
Includes heartbeat pings for deadman monitors and metric values for threshold monitors.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import json

from database import get_db, Service, Monitor, StatusUpdate
from models import HeartbeatRequest, MetricUpdateRequest, MetricUpdateResponse
from api.auth import get_user_from_api_key
from monitors import MONITOR_CLASSES, HEARTBEAT_MONITORS, METRIC_MONITORS
from utils.service_helpers import notify_service_status_change

heartbeat_router = APIRouter(prefix="/api/v1/heartbeat", tags=["monitor-ingestion"])
metric_router = APIRouter(prefix="/api/v1/metric", tags=["monitor-ingestion"])


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
    # Verify API key first before doing any DB work
    get_user_from_api_key(heartbeat.api_key, db)

    # Find service by name
    service = db.query(Service).filter(
        Service.name == service_name,
        Service.is_active == True
    ).first()

    if not service:
        raise HTTPException(status_code=404, detail=f"Service '{service_name}' not found")

    # Find a heartbeat-capable monitor by name in config
    monitors = db.query(Monitor).filter(
        Monitor.service_id == service.id,
        Monitor.monitor_type.in_(HEARTBEAT_MONITORS),
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
            detail=f"No active heartbeat monitor named '{monitor_name}' found for service '{service_name}'"
        )

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

    notify_service_status_change(db, service.id)

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
    # Verify API key first
    get_user_from_api_key(request.api_key, db)

    # Find service by name
    service = db.query(Service).filter(
        Service.name == service_name,
        Service.is_active == True
    ).first()

    if not service:
        raise HTTPException(status_code=404, detail=f"Service '{service_name}' not found")

    # Find a metric-capable monitor by name in config
    monitors = db.query(Monitor).filter(
        Monitor.service_id == service.id,
        Monitor.monitor_type.in_(METRIC_MONITORS),
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
            detail=f"No active metric monitor named '{monitor_name}' found for service '{service_name}'"
        )

    # Load monitor configuration and evaluate metric using the registered monitor class
    config = json.loads(monitor.config_json)
    monitor_instance = MONITOR_CLASSES[monitor.monitor_type](config)
    result = monitor_instance.evaluate_metric(request.value)

    status = result["status"]
    reason = result["reason"]

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

    notify_service_status_change(db, service.id)

    return MetricUpdateResponse(
        success=True,
        service=service_name,
        value=request.value,
        status=status,
        reason=reason
    )
