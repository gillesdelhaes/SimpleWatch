"""
Heartbeat API endpoint for deadman monitors.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, Service, Monitor, StatusUpdate
from datetime import datetime
from pydantic import BaseModel
import json

router = APIRouter(prefix="/api/v1/heartbeat", tags=["heartbeat"])


class HeartbeatRequest(BaseModel):
    """Heartbeat ping request."""
    api_key: str


@router.post("/{service_name}")
def receive_heartbeat(
    service_name: str,
    heartbeat: HeartbeatRequest,
    db: Session = Depends(get_db)
):
    """
    Receive a heartbeat ping for a deadman monitor.

    This endpoint is called by external processes (cron jobs, backups, etc.)
    to signal they are still alive and running.
    """
    # Find service by name
    service = db.query(Service).filter(
        Service.name == service_name,
        Service.is_active == True
    ).first()

    if not service:
        raise HTTPException(status_code=404, detail=f"Service '{service_name}' not found")

    # Find deadman monitor for this service
    monitor = db.query(Monitor).filter(
        Monitor.service_id == service.id,
        Monitor.monitor_type == "deadman",
        Monitor.is_active == True
    ).first()

    if not monitor:
        raise HTTPException(
            status_code=404,
            detail=f"No active deadman monitor found for service '{service_name}'"
        )

    # Verify API key
    from api.auth import get_user_from_api_key
    user = get_user_from_api_key(heartbeat.api_key, db)

    # Update monitor's last_check_at to mark heartbeat received
    monitor.last_check_at = datetime.utcnow()

    # Create a status update marking the heartbeat as received
    status_update = StatusUpdate(
        service_id=service.id,
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

    return {
        "success": True,
        "message": f"Heartbeat received for '{service_name}'",
        "timestamp": datetime.utcnow().isoformat()
    }
