"""
Monitor management API endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, Monitor, Service
from models import MonitorCreate, MonitorUpdate, MonitorResponse
from api.auth import get_current_user
from datetime import datetime, timedelta
from typing import List
import json

router = APIRouter(prefix="/api/v1/monitors", tags=["monitors"])


@router.get("", response_model=List[MonitorResponse])
def list_monitors(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """List all monitors (both active and paused)."""
    monitors = db.query(Monitor).all()

    result = []
    for monitor in monitors:
        result.append(MonitorResponse(
            id=monitor.id,
            service_id=monitor.service_id,
            monitor_type=monitor.monitor_type,
            config=json.loads(monitor.config_json),
            check_interval_minutes=monitor.check_interval_minutes,
            is_active=monitor.is_active,
            last_check_at=monitor.last_check_at,
            next_check_at=monitor.next_check_at,
            created_at=monitor.created_at
        ))

    return result


@router.post("", response_model=MonitorResponse)
def create_monitor(
    monitor: MonitorCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create a new monitor."""
    service = db.query(Service).filter(Service.id == monitor.service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    new_monitor = Monitor(
        service_id=monitor.service_id,
        monitor_type=monitor.monitor_type,
        config_json=json.dumps(monitor.config),
        check_interval_minutes=monitor.check_interval_minutes,
        is_active=True,
        next_check_at=datetime.utcnow() + timedelta(minutes=1),
        created_by=current_user.id
    )
    db.add(new_monitor)
    db.commit()
    db.refresh(new_monitor)

    return MonitorResponse(
        id=new_monitor.id,
        service_id=new_monitor.service_id,
        monitor_type=new_monitor.monitor_type,
        config=json.loads(new_monitor.config_json),
        check_interval_minutes=new_monitor.check_interval_minutes,
        is_active=new_monitor.is_active,
        last_check_at=new_monitor.last_check_at,
        next_check_at=new_monitor.next_check_at,
        created_at=new_monitor.created_at
    )


@router.get("/{monitor_id}", response_model=MonitorResponse)
def get_monitor(
    monitor_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get a specific monitor."""
    monitor = db.query(Monitor).filter(Monitor.id == monitor_id).first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    return MonitorResponse(
        id=monitor.id,
        service_id=monitor.service_id,
        monitor_type=monitor.monitor_type,
        config=json.loads(monitor.config_json),
        check_interval_minutes=monitor.check_interval_minutes,
        is_active=monitor.is_active,
        last_check_at=monitor.last_check_at,
        next_check_at=monitor.next_check_at,
        created_at=monitor.created_at
    )


@router.put("/{monitor_id}", response_model=MonitorResponse)
def update_monitor(
    monitor_id: int,
    monitor_update: MonitorUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update a monitor."""
    monitor = db.query(Monitor).filter(Monitor.id == monitor_id).first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    if monitor_update.config is not None:
        monitor.config_json = json.dumps(monitor_update.config)
    if monitor_update.check_interval_minutes is not None:
        monitor.check_interval_minutes = monitor_update.check_interval_minutes
    if monitor_update.is_active is not None:
        monitor.is_active = monitor_update.is_active

    db.commit()
    db.refresh(monitor)

    return MonitorResponse(
        id=monitor.id,
        service_id=monitor.service_id,
        monitor_type=monitor.monitor_type,
        config=json.loads(monitor.config_json),
        check_interval_minutes=monitor.check_interval_minutes,
        is_active=monitor.is_active,
        last_check_at=monitor.last_check_at,
        next_check_at=monitor.next_check_at,
        created_at=monitor.created_at
    )


@router.delete("/{monitor_id}")
def delete_monitor(
    monitor_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete a monitor and all associated status updates."""
    monitor = db.query(Monitor).filter(Monitor.id == monitor_id).first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    service_id = monitor.service_id

    # CASCADE delete will remove all status_updates
    db.delete(monitor)
    db.commit()

    # Check if service has any remaining active monitors
    active_monitors = db.query(Monitor).filter(
        Monitor.service_id == service_id,
        Monitor.is_active == True
    ).count()

    # Auto-pause service if no active monitors remain
    if active_monitors == 0:
        service = db.query(Service).filter(Service.id == service_id).first()
        if service and service.is_active:
            service.is_active = False
            db.commit()

    return {"success": True, "message": "Monitor deleted"}


@router.post("/{monitor_id}/pause")
def pause_monitor(
    monitor_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Pause a monitor (sets is_active to False without deleting)."""
    monitor = db.query(Monitor).filter(Monitor.id == monitor_id).first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    if not monitor.is_active:
        raise HTTPException(status_code=400, detail="Monitor is already paused")

    service_id = monitor.service_id
    monitor.is_active = False
    db.commit()

    # Check if service has any remaining active monitors
    active_monitors = db.query(Monitor).filter(
        Monitor.service_id == service_id,
        Monitor.is_active == True
    ).count()

    # Auto-pause service if no active monitors remain
    if active_monitors == 0:
        service = db.query(Service).filter(Service.id == service_id).first()
        if service and service.is_active:
            service.is_active = False
            db.commit()

    return {"success": True, "message": "Monitor paused"}


@router.post("/{monitor_id}/resume")
def resume_monitor(
    monitor_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Resume a paused monitor (sets is_active to True)."""
    monitor = db.query(Monitor).filter(Monitor.id == monitor_id).first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    if monitor.is_active:
        raise HTTPException(status_code=400, detail="Monitor is already active")

    service_id = monitor.service_id
    monitor.is_active = True
    db.commit()

    # Auto-resume service if it was paused
    service = db.query(Service).filter(Service.id == service_id).first()
    if service and not service.is_active:
        service.is_active = True
        db.commit()

    return {"success": True, "message": "Monitor resumed"}


@router.post("/{monitor_id}/test")
def test_monitor(
    monitor_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Test a monitor immediately."""
    monitor = db.query(Monitor).filter(Monitor.id == monitor_id).first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    from monitors.website import WebsiteMonitor
    from monitors.api import APIMonitor
    from monitors.metric import MetricThresholdMonitor
    from monitors.port import PortMonitor

    config = json.loads(monitor.config_json)

    try:
        if monitor.monitor_type == "website":
            monitor_instance = WebsiteMonitor(config)
        elif monitor.monitor_type == "api":
            monitor_instance = APIMonitor(config)
        elif monitor.monitor_type == "metric_threshold":
            return {"success": True, "message": "Metric monitors are passive and cannot be tested directly"}
        elif monitor.monitor_type == "port":
            monitor_instance = PortMonitor(config)
        else:
            raise HTTPException(status_code=400, detail="Unknown monitor type")

        result = monitor_instance.check()

        return {
            "success": True,
            "result": result
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
