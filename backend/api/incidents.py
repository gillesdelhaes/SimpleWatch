"""
API endpoints for incident tracking.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import get_db, Incident, Service, Monitor
from api.auth import get_current_user
from utils.uptime import calculate_service_uptime
from datetime import datetime, timedelta
import json
import io
import csv
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/incidents", tags=["incidents"])


@router.get("/")
def list_incidents(
    service_id: int = Query(None, description="Filter by service ID"),
    time_window: str = Query("30d", description="Time window: 24h, 7d, 30d, 90d, all"),
    status: str = Query(None, description="Filter by status: ongoing, resolved"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    List all incidents with optional filters.
    Returns incidents in reverse chronological order (newest first).
    Only includes incidents from active services.
    """
    # Join with Service table to filter by is_active
    query = db.query(Incident).join(Service, Incident.service_id == Service.id).filter(Service.is_active == True)

    # Filter by service
    if service_id:
        query = query.filter(Incident.service_id == service_id)

    # Filter by status
    if status:
        query = query.filter(Incident.status == status)

    # Filter by time window
    if time_window != "all":
        window_map = {
            "24h": timedelta(hours=24),
            "7d": timedelta(days=7),
            "30d": timedelta(days=30),
            "90d": timedelta(days=90)
        }
        cutoff = datetime.utcnow() - window_map.get(time_window, timedelta(days=30))
        query = query.filter(Incident.started_at >= cutoff)

    # Order by newest first
    incidents = query.order_by(Incident.started_at.desc()).all()

    # Enrich with service names and monitor details
    result = []
    for incident in incidents:
        service = db.query(Service).filter(Service.id == incident.service_id).first()

        # Get affected monitor names (only active monitors)
        affected_ids = json.loads(incident.affected_monitors_json) if incident.affected_monitors_json else []
        affected_monitors = []
        for mid in affected_ids:
            monitor = db.query(Monitor).filter(Monitor.id == mid, Monitor.is_active == True).first()
            if monitor:
                config = json.loads(monitor.config_json) if monitor.config_json else {}
                affected_monitors.append({
                    "id": monitor.id,
                    "type": monitor.monitor_type,
                    "name": config.get("name") if config else None
                })

        result.append({
            "id": incident.id,
            "service_id": incident.service_id,
            "service_name": service.name if service else "Unknown",
            "started_at": incident.started_at.isoformat(),
            "ended_at": incident.ended_at.isoformat() if incident.ended_at else None,
            "duration_seconds": incident.duration_seconds,
            "severity": incident.severity,
            "status": incident.status,
            "affected_monitors": affected_monitors
        })

    return {"success": True, "incidents": result}


@router.get("/stats")
def get_incident_stats(
    time_window: str = Query("30d", description="Time window: 24h, 7d, 30d, 90d"),
    service_id: int = Query(None, description="Filter by service ID"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get aggregated incident statistics for dashboard/charts.
    Returns: incident count, MTTR, uptime %, incidents by service, incidents by severity.
    Only includes incidents from active services.
    """
    window_map = {
        "24h": timedelta(hours=24),
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
        "90d": timedelta(days=90)
    }
    cutoff = datetime.utcnow() - window_map.get(time_window, timedelta(days=30))

    # Get all incidents in time window from active services only
    query = db.query(Incident).join(Service, Incident.service_id == Service.id).filter(
        Service.is_active == True,
        Incident.started_at >= cutoff
    )

    # Filter by service if specified
    if service_id:
        query = query.filter(Incident.service_id == service_id)

    incidents = query.all()

    # Calculate MTTR (Mean Time To Recovery) - only for resolved incidents
    resolved_incidents = [i for i in incidents if i.status == "resolved" and i.duration_seconds]
    mttr_seconds = sum(i.duration_seconds for i in resolved_incidents) / len(resolved_incidents) if resolved_incidents else 0

    # Incidents by service
    by_service = {}
    for incident in incidents:
        service_id = incident.service_id
        if service_id not in by_service:
            service = db.query(Service).filter(Service.id == service_id).first()
            by_service[service_id] = {
                "service_id": service_id,
                "service_name": service.name if service else "Unknown",
                "count": 0
            }
        by_service[service_id]["count"] += 1

    # Incidents by severity
    by_severity = {"degraded": 0, "down": 0}
    for incident in incidents:
        by_severity[incident.severity] = by_severity.get(incident.severity, 0) + 1

    # Uptime calculation - use same method as dashboard
    if service_id:
        # Single service: use accurate StatusUpdate-based calculation
        uptime_data = calculate_service_uptime(db, service_id)
        # Don't default to 100% for services with no data - return None instead
        uptime_percentage = uptime_data["percentage"] if uptime_data else None
    else:
        # All services: calculate average uptime across all services
        all_services = db.query(Service).filter(Service.is_active == True).all()
        if all_services:
            uptimes = []
            for service in all_services:
                uptime_data = calculate_service_uptime(db, service.id)
                if uptime_data:
                    uptimes.append(uptime_data["percentage"])
            uptime_percentage = sum(uptimes) / len(uptimes) if uptimes else 100.0
        else:
            uptime_percentage = 100.0

    return {
        "success": True,
        "time_window": time_window,
        "total_incidents": len(incidents),
        "ongoing_incidents": len([i for i in incidents if i.status == "ongoing"]),
        "resolved_incidents": len(resolved_incidents),
        "mttr_seconds": int(mttr_seconds),
        "mttr_formatted": format_duration(mttr_seconds),
        "uptime_percentage": round(uptime_percentage, 2),
        "by_service": list(by_service.values()),
        "by_severity": by_severity
    }


@router.get("/timeline")
def get_incident_timeline(
    time_window: str = Query("7d", description="Time window: 24h, 7d, 30d"),
    service_id: int = Query(None, description="Filter by service ID"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get incident timeline data for chart visualization.
    Returns hourly/daily incident counts suitable for Chart.js.
    Only includes incidents from active services.
    """
    window_map = {
        "24h": (timedelta(hours=24), "hour"),
        "7d": (timedelta(days=7), "hour"),
        "30d": (timedelta(days=30), "day")
    }
    delta, granularity = window_map.get(time_window, (timedelta(days=7), "hour"))
    cutoff = datetime.utcnow() - delta

    # Only include incidents from active services
    query = db.query(Incident).join(Service, Incident.service_id == Service.id).filter(
        Service.is_active == True,
        Incident.started_at >= cutoff
    )
    if service_id:
        query = query.filter(Incident.service_id == service_id)

    incidents = query.all()

    # Group by time bucket
    buckets = {}
    for incident in incidents:
        if granularity == "hour":
            bucket = incident.started_at.replace(minute=0, second=0, microsecond=0)
        else:
            bucket = incident.started_at.replace(hour=0, minute=0, second=0, microsecond=0)

        bucket_key = bucket.isoformat()
        if bucket_key not in buckets:
            buckets[bucket_key] = 0
        buckets[bucket_key] += 1

    # Sort by time
    labels = sorted(buckets.keys())
    data = [buckets[label] for label in labels]

    return {
        "success": True,
        "labels": labels,
        "data": data,
        "granularity": granularity
    }


@router.get("/export")
def export_incidents_csv(
    service_id: int = Query(None),
    time_window: str = Query("30d"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Export incidents as CSV for reporting. Only includes incidents from active services."""
    # Build query for incidents from active services only
    query = db.query(Incident).join(Service, Incident.service_id == Service.id).filter(Service.is_active == True)

    # Filter by service
    if service_id:
        query = query.filter(Incident.service_id == service_id)

    # Filter by time window
    if time_window != "all":
        window_map = {
            "24h": timedelta(hours=24),
            "7d": timedelta(days=7),
            "30d": timedelta(days=30),
            "90d": timedelta(days=90)
        }
        cutoff = datetime.utcnow() - window_map.get(time_window, timedelta(days=30))
        query = query.filter(Incident.started_at >= cutoff)

    # Order by newest first
    incidents_list = query.order_by(Incident.started_at.desc()).all()

    # Enrich with service names and monitor details
    incidents = []
    for incident in incidents_list:
        service = db.query(Service).filter(Service.id == incident.service_id).first()

        # Get affected monitor names (only active monitors)
        affected_ids = json.loads(incident.affected_monitors_json) if incident.affected_monitors_json else []
        affected_monitors = []
        for mid in affected_ids:
            monitor = db.query(Monitor).filter(Monitor.id == mid, Monitor.is_active == True).first()
            if monitor:
                config = json.loads(monitor.config_json) if monitor.config_json else {}
                affected_monitors.append({
                    "id": monitor.id,
                    "type": monitor.monitor_type,
                    "name": config.get("name") if config else None
                })

        incidents.append({
            "id": incident.id,
            "service_id": incident.service_id,
            "service_name": service.name if service else "Unknown",
            "started_at": incident.started_at.isoformat(),
            "ended_at": incident.ended_at.isoformat() if incident.ended_at else None,
            "duration_seconds": incident.duration_seconds,
            "severity": incident.severity,
            "status": incident.status,
            "affected_monitors": affected_monitors
        })

    # Generate CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Incident ID", "Service Name", "Started At", "Ended At",
        "Duration (seconds)", "Duration (formatted)", "Severity",
        "Status", "Affected Monitors"
    ])

    for inc in incidents:
        duration_formatted = format_duration(inc["duration_seconds"]) if inc["duration_seconds"] else "Ongoing"
        affected = ", ".join([f"{m['type']}:{m['name'] or m['id']}" for m in inc["affected_monitors"]])

        writer.writerow([
            inc["id"],
            inc["service_name"],
            inc["started_at"],
            inc["ended_at"] or "Ongoing",
            inc["duration_seconds"] or "",
            duration_formatted,
            inc["severity"],
            inc["status"],
            affected
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=incidents_{time_window}.csv"}
    )


def format_duration(seconds):
    """Format duration in human-readable format."""
    if not seconds:
        return "N/A"

    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)

    parts = []
    if hours > 0:
        parts.append(f"{hours}h")
    if minutes > 0:
        parts.append(f"{minutes}m")
    if secs > 0 or not parts:
        parts.append(f"{secs}s")

    return " ".join(parts)
