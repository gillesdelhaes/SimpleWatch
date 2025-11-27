"""
Services API endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, Service, StatusUpdate
from models import ServiceCreate, ServiceResponse
from api.auth import get_current_user
from typing import List
import json

router = APIRouter(prefix="/api/v1/services", tags=["services"])


@router.get("", response_model=List[ServiceResponse])
def list_services(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """List all services."""
    services = db.query(Service).filter(Service.is_active == True).all()
    return services


@router.post("", response_model=ServiceResponse)
def create_service(
    service: ServiceCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create a new service."""
    existing = db.query(Service).filter(Service.name == service.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Service already exists")

    new_service = Service(
        name=service.name,
        description=service.description,
        category=service.category,
        created_by=current_user.id,
        is_active=True
    )
    db.add(new_service)
    db.commit()
    db.refresh(new_service)

    return new_service


@router.get("/{service_id}", response_model=ServiceResponse)
def get_service(
    service_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get a specific service."""
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return service


@router.put("/{service_id}", response_model=ServiceResponse)
def update_service(
    service_id: int,
    service_update: ServiceCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update a service."""
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    service.name = service_update.name
    service.description = service_update.description
    service.category = service_update.category

    db.commit()
    db.refresh(service)

    return service


@router.delete("/{service_id}")
def delete_service(
    service_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete (archive) a service."""
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    service.is_active = False
    db.commit()

    return {"success": True, "message": "Service archived"}


@router.get("/{service_id}/history")
def get_service_history(
    service_id: int,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get status history for a service."""
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    history = db.query(StatusUpdate).filter(
        StatusUpdate.service_id == service_id
    ).order_by(StatusUpdate.timestamp.desc()).limit(limit).all()

    result = []
    for update in history:
        metadata = json.loads(update.metadata_json) if update.metadata_json else None
        result.append({
            "status": update.status,
            "timestamp": update.timestamp,
            "response_time_ms": update.response_time_ms,
            "metadata": metadata
        })

    return {"service": service.name, "history": result}
