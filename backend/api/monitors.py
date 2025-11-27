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
    """List all monitors."""
    monitors = db.query(Monitor).filter(Monitor.is_active == True).all()

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
    """Delete a monitor."""
    monitor = db.query(Monitor).filter(Monitor.id == monitor_id).first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    db.delete(monitor)
    db.commit()

    return {"success": True, "message": "Monitor deleted"}


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
