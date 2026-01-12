"""
Services API endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import get_db, Service, StatusUpdate, Monitor
from models import ServiceCreate, ServiceResponse
from api.auth import get_current_user
from typing import List, Optional
from datetime import datetime, timedelta
import json
import io

router = APIRouter(prefix="/api/v1/services", tags=["services"])


@router.get("", response_model=List[ServiceResponse])
def list_services(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """List all services (both active and paused)."""
    services = db.query(Service).all()
    return services


@router.post("", response_model=ServiceResponse)
def create_service(
    service: ServiceCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create a new service."""
    existing = db.query(Service).filter(
        Service.name == service.name,
        Service.is_active == True
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Service already exists")

    new_service = Service(
        name=service.name,
        description=service.description,
        category=service.category,
        created_by=current_user.id,
        is_active=True,
        show_on_status_page=service.show_on_status_page,
        sla_target=service.sla_target,
        sla_timeframe_days=service.sla_timeframe_days
    )
    db.add(new_service)
    db.commit()
    db.refresh(new_service)

    return new_service


@router.get("/export")
def export_services(
    service_ids: Optional[str] = Query(None, description="Comma-separated list of service IDs to export"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Export selected services and their monitors to JSON.

    Args:
        service_ids: Optional comma-separated list of service IDs. If not provided, exports all services.

    Returns:
        JSON file download containing service configurations and monitors.
    """
    # Parse service IDs filter
    selected_ids = None
    if service_ids:
        try:
            selected_ids = [int(sid.strip()) for sid in service_ids.split(',')]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid service_ids format. Expected comma-separated integers.")

    # Query services
    query = db.query(Service)
    if selected_ids:
        query = query.filter(Service.id.in_(selected_ids))

    services = query.all()

    if not services:
        raise HTTPException(status_code=404, detail="No services found to export")

    # Build export data
    export_data = {
        "export_version": "1.0",
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "services": []
    }

    for service in services:
        # Load monitors for this service
        monitors = db.query(Monitor).filter(Monitor.service_id == service.id).all()

        service_data = {
            "name": service.name,
            "description": service.description,
            "category": service.category,
            "is_active": service.is_active,
            "monitors": []
        }

        for monitor in monitors:
            config = json.loads(monitor.config_json) if monitor.config_json else {}
            service_data["monitors"].append({
                "type": monitor.monitor_type,
                "config": config,
                "check_interval_minutes": monitor.check_interval_minutes,
                "is_active": monitor.is_active
            })

        export_data["services"].append(service_data)

    # Create JSON file for download
    json_str = json.dumps(export_data, indent=2)
    json_bytes = io.BytesIO(json_str.encode('utf-8'))

    # Generate filename with timestamp
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"simplewatch_export_{timestamp}.json"

    return StreamingResponse(
        json_bytes,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/import/validate")
async def validate_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Validate an import file and preview what would be imported.

    Returns:
        Validation results with summary and details of what would be created/skipped.
    """
    # Read and parse JSON file
    try:
        contents = await file.read()
        import_data = json.loads(contents)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")

    # Validate file format
    if "export_version" not in import_data or "services" not in import_data:
        raise HTTPException(status_code=400, detail="Invalid export file format. Missing required fields.")

    if import_data["export_version"] != "1.0":
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported export version: {import_data['export_version']}. Expected 1.0."
        )

    # Analyze what would be imported
    results = []
    new_services_count = 0
    new_monitors_count = 0
    skipped_services_count = 0

    for service_data in import_data["services"]:
        # Check if service already exists
        existing = db.query(Service).filter(Service.name == service_data["name"]).first()

        if existing:
            results.append({
                "service_name": service_data["name"],
                "action": "skip",
                "reason": "Service already exists",
                "monitors": len(service_data.get("monitors", []))
            })
            skipped_services_count += 1
        else:
            monitor_count = len(service_data.get("monitors", []))
            results.append({
                "service_name": service_data["name"],
                "action": "create",
                "reason": "New service",
                "monitors": monitor_count
            })
            new_services_count += 1
            new_monitors_count += monitor_count

    return {
        "valid": True,
        "summary": {
            "total_services": len(import_data["services"]),
            "new_services": new_services_count,
            "new_monitors": new_monitors_count,
            "skipped_services": skipped_services_count
        },
        "details": results
    }


@router.post("/import")
async def import_services(
    file: UploadFile = File(...),
    service_indices: Optional[str] = Query(None, description="Comma-separated list of service indices to import (0-based)"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Import services and monitors from a JSON file.

    Args:
        file: JSON file exported from SimpleWatch
        service_indices: Optional comma-separated list of service indices (0-based) to import.
                        If not provided, imports all services that don't already exist.

    Returns:
        Import results summary with counts and details of imported/skipped/failed services.
    """
    # Read and validate file
    try:
        contents = await file.read()
        import_data = json.loads(contents)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")

    # Validate format
    if "export_version" not in import_data or "services" not in import_data:
        raise HTTPException(status_code=400, detail="Invalid export file format")

    if import_data["export_version"] != "1.0":
        raise HTTPException(status_code=400, detail=f"Unsupported export version: {import_data['export_version']}")

    # Parse service indices filter
    selected_indices = None
    if service_indices:
        try:
            selected_indices = [int(idx.strip()) for idx in service_indices.split(',')]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid service_indices format. Expected comma-separated integers.")

    # Import services
    imported = []
    skipped = []
    failed = []

    services_to_import = import_data["services"]
    if selected_indices:
        # Filter to only selected indices
        services_to_import = [
            services_to_import[i] for i in selected_indices
            if i < len(services_to_import)
        ]

    for service_data in services_to_import:
        try:
            # Check if service already exists
            existing = db.query(Service).filter(Service.name == service_data["name"]).first()

            if existing:
                skipped.append({
                    "service": service_data["name"],
                    "reason": "Service already exists"
                })
                continue

            # Create new service
            new_service = Service(
                name=service_data["name"],
                description=service_data.get("description"),
                category=service_data.get("category"),
                created_by=current_user.id,
                is_active=service_data.get("is_active", True)
            )
            db.add(new_service)
            db.flush()  # Get service ID

            # Create monitors
            monitors_created = 0
            for monitor_data in service_data.get("monitors", []):
                new_monitor = Monitor(
                    service_id=new_service.id,
                    monitor_type=monitor_data["type"],
                    config_json=json.dumps(monitor_data["config"]),
                    check_interval_minutes=monitor_data.get("check_interval_minutes", 5),
                    is_active=monitor_data.get("is_active", True),
                    next_check_at=datetime.utcnow() + timedelta(minutes=1),
                    created_by=current_user.id
                )
                db.add(new_monitor)
                monitors_created += 1

            db.commit()

            imported.append({
                "service": service_data["name"],
                "monitors": monitors_created
            })

        except Exception as e:
            db.rollback()
            failed.append({
                "service": service_data["name"],
                "error": str(e)
            })

    return {
        "success": True,
        "imported": len(imported),
        "skipped": len(skipped),
        "failed": len(failed),
        "details": {
            "imported": imported,
            "skipped": skipped,
            "failed": failed
        }
    }


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
    service.show_on_status_page = service_update.show_on_status_page
    service.sla_target = service_update.sla_target
    service.sla_timeframe_days = service_update.sla_timeframe_days

    db.commit()
    db.refresh(service)

    return service


@router.delete("/{service_id}")
def delete_service(
    service_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete a service and all associated monitors and status updates."""
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    # CASCADE delete will remove all monitors and status_updates
    db.delete(service)
    db.commit()

    return {"success": True, "message": "Service deleted"}


@router.post("/{service_id}/pause")
def pause_service(
    service_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Pause a service and all its monitors (sets is_active to False without deleting)."""
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    if not service.is_active:
        raise HTTPException(status_code=400, detail="Service is already paused")

    service.is_active = False

    # Also pause all monitors attached to this service
    db.query(Monitor).filter(
        Monitor.service_id == service_id,
        Monitor.is_active == True
    ).update({"is_active": False})

    db.commit()

    return {"success": True, "message": "Service and all monitors paused"}


@router.post("/{service_id}/resume")
def resume_service(
    service_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Resume a paused service and all its monitors (sets is_active to True)."""
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    if service.is_active:
        raise HTTPException(status_code=400, detail="Service is already active")

    service.is_active = True

    # Also resume all monitors attached to this service
    db.query(Monitor).filter(
        Monitor.service_id == service_id,
        Monitor.is_active == False
    ).update({"is_active": True})

    db.commit()

    return {"success": True, "message": "Service and all monitors resumed"}


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
