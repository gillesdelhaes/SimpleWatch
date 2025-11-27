"""
Status update API endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session
from database import get_db, StatusUpdate, Service, Incident
from models import (
    StatusUpdateRequest,
    StatusUpdateResponse,
    BulkStatusUpdateRequest,
    MetricUpdateRequest,
    MetricUpdateResponse,
    StatusResponse
)
from api.auth import get_user_from_api_key
from utils.db import create_service_if_not_exists, get_service_by_name
from datetime import datetime
import json
from typing import List, Optional

router = APIRouter(prefix="/api/v1", tags=["status"])


@router.post("/status", response_model=StatusUpdateResponse)
def update_status(request: StatusUpdateRequest, db: Session = Depends(get_db)):
    """Update status for a service."""
    user = get_user_from_api_key(request.api_key, db)

    service = create_service_if_not_exists(db, request.service, created_by=user.id)

    timestamp = request.timestamp or datetime.utcnow()

    status_update = StatusUpdate(
        service_id=service.id,
        status=request.status,
        timestamp=timestamp,
        response_time_ms=request.metadata.get("response_time_ms") if request.metadata else None,
        metadata_json=json.dumps(request.metadata) if request.metadata else None
    )
    db.add(status_update)

    handle_incident_tracking(db, service, request.status)

    db.commit()

    return StatusUpdateResponse(
        success=True,
        message="Status updated successfully",
        service=request.service
    )


@router.post("/status/bulk")
def bulk_update_status(request: BulkStatusUpdateRequest, db: Session = Depends(get_db)):
    """Bulk update status for multiple services."""
    user = get_user_from_api_key(request.api_key, db)

    for update in request.updates:
        service = create_service_if_not_exists(db, update.service, created_by=user.id)

        status_update = StatusUpdate(
            service_id=service.id,
            status=update.status,
            timestamp=datetime.utcnow(),
            response_time_ms=update.metadata.get("response_time_ms") if update.metadata else None,
            metadata_json=json.dumps(update.metadata) if update.metadata else None
        )
        db.add(status_update)

        handle_incident_tracking(db, service, update.status)

    db.commit()

    return {
        "success": True,
        "message": f"Bulk updated {len(request.updates)} services"
    }


@router.post("/metric/{service_name}", response_model=MetricUpdateResponse)
def update_metric(
    service_name: str,
    request: MetricUpdateRequest,
    db: Session = Depends(get_db)
):
    """Ultra-simple metric update API."""
    user = get_user_from_api_key(request.api_key, db)

    service = get_service_by_name(db, service_name)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    from database import Monitor
    monitor = db.query(Monitor).filter(
        Monitor.service_id == service.id,
        Monitor.monitor_type == "metric_threshold",
        Monitor.is_active == True
    ).first()

    if not monitor:
        raise HTTPException(
            status_code=404,
            detail="No active metric threshold monitor configured for this service"
        )

    config = json.loads(monitor.config_json)
    warning_threshold = config.get("warning_threshold")
    critical_threshold = config.get("critical_threshold")
    comparison = config.get("comparison", "greater")

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

    status_update = StatusUpdate(
        service_id=service.id,
        status=status,
        timestamp=datetime.utcnow(),
        metadata_json=json.dumps({"value": request.value, "reason": reason})
    )
    db.add(status_update)

    handle_incident_tracking(db, service, status)

    db.commit()

    return MetricUpdateResponse(
        success=True,
        service=service_name,
        value=request.value,
        status=status,
        reason=reason
    )


@router.get("/status/all")
def get_all_status(api_key: str, db: Session = Depends(get_db)):
    """Get current status for all services."""
    get_user_from_api_key(api_key, db)

    services = db.query(Service).filter(Service.is_active == True).all()

    result = []
    for service in services:
        latest_status = db.query(StatusUpdate).filter(
            StatusUpdate.service_id == service.id
        ).order_by(StatusUpdate.timestamp.desc()).first()

        if latest_status:
            metadata = json.loads(latest_status.metadata_json) if latest_status.metadata_json else None
            result.append({
                "service": service.name,
                "service_id": service.id,
                "status": latest_status.status,
                "timestamp": latest_status.timestamp,
                "response_time_ms": latest_status.response_time_ms,
                "metadata": metadata
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


def handle_incident_tracking(db: Session, service: Service, new_status: str):
    """Track incidents based on status changes."""
    latest_incident = db.query(Incident).filter(
        Incident.service_id == service.id,
        Incident.resolved_at == None
    ).first()

    if new_status in ["down", "degraded"]:
        if not latest_incident:
            incident = Incident(
                service_id=service.id,
                started_at=datetime.utcnow(),
                severity=new_status,
                description=f"Service entered {new_status} state"
            )
            db.add(incident)
        elif latest_incident.severity != new_status:
            latest_incident.severity = new_status
            latest_incident.description = f"Service status changed to {new_status}"

    elif new_status == "operational":
        if latest_incident:
            latest_incident.resolved_at = datetime.utcnow()
