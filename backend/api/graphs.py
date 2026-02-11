"""
Graph API endpoints.
Provides time-series data for monitor visualizations.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from database import get_db, StatusUpdate, Monitor, User
from api.auth import get_current_user
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import json

# Import monitor classes to access their GRAPH_METRICS
from monitors.website import WebsiteMonitor
from monitors.api import APIMonitor
from monitors.port import PortMonitor
from monitors.ssl_cert import SSLCertMonitor
from monitors.ping import PingMonitor
from monitors.metric import MetricThresholdMonitor
from monitors.deadman import DeadmanMonitor
from monitors.dns import DNSMonitor
from monitors.github_actions import GitHubActionsMonitor
from monitors.snmp import SNMPMonitor
from monitors.seo import SEOMonitor
from monitors.ollama import OllamaMonitor
from monitors.expiration import ExpirationMonitor

router = APIRouter(prefix="/api/v1", tags=["graphs"])

# Time bucket configuration (max ~250 data points per period)
PERIOD_CONFIG = {
    "24h": {"hours": 24, "bucket_minutes": 10},      # 144 points
    "7d": {"hours": 168, "bucket_minutes": 60},      # 168 points
    "30d": {"hours": 720, "bucket_minutes": 180},    # 240 points
}

# Map monitor_type string to monitor class for GRAPH_METRICS lookup
MONITOR_CLASSES = {
    "website": WebsiteMonitor,
    "api": APIMonitor,
    "port": PortMonitor,
    "ssl_certificate": SSLCertMonitor,
    "ping": PingMonitor,
    "metric_threshold": MetricThresholdMonitor,
    "deadman": DeadmanMonitor,
    "dns": DNSMonitor,
    "github_actions": GitHubActionsMonitor,
    "snmp": SNMPMonitor,
    "seo": SEOMonitor,
    "ollama": OllamaMonitor,
    "expiration": ExpirationMonitor,
}

# Default fallback metrics if a monitor doesn't define GRAPH_METRICS
DEFAULT_GRAPH_METRICS = [
    {"key": "response_time_ms", "label": "Response Time", "unit": "ms", "color": "#10B981", "source": "response_time_ms"}
]


def get_monitor_metrics(monitor_type: str) -> List[Dict[str, str]]:
    """Get graph metrics for a monitor type from its class definition."""
    monitor_class = MONITOR_CLASSES.get(monitor_type)
    if monitor_class and hasattr(monitor_class, 'GRAPH_METRICS') and monitor_class.GRAPH_METRICS:
        return monitor_class.GRAPH_METRICS
    return DEFAULT_GRAPH_METRICS


def extract_metric_value(status_update: StatusUpdate, source: str) -> Optional[float]:
    """Extract a metric value from a StatusUpdate based on source path."""
    if source == "response_time_ms":
        return status_update.response_time_ms

    if source.startswith("metadata."):
        key = source[9:]  # Remove "metadata." prefix
        if status_update.metadata_json:
            try:
                metadata = json.loads(status_update.metadata_json)
                value = metadata.get(key)
                if value is not None:
                    try:
                        return float(value)
                    except (ValueError, TypeError):
                        return None
            except json.JSONDecodeError:
                pass
    return None


def get_status_changes(
    db: Session,
    monitor_id: int,
    start_time: datetime,
    end_time: datetime
) -> List[Dict[str, Any]]:
    """Get status change events for a monitor within a time range."""
    # Query all status updates in the time range, ordered by time
    updates = db.query(StatusUpdate).filter(
        StatusUpdate.monitor_id == monitor_id,
        StatusUpdate.timestamp >= start_time,
        StatusUpdate.timestamp <= end_time
    ).order_by(StatusUpdate.timestamp.asc()).all()

    status_changes = []
    prev_status = None

    for update in updates:
        if prev_status is not None and update.status != prev_status:
            status_changes.append({
                "timestamp": update.timestamp.isoformat() + "Z",
                "from": prev_status,
                "to": update.status
            })
        prev_status = update.status

    return status_changes


@router.get("/monitors/{monitor_id}/graph")
def get_monitor_graph(
    monitor_id: int,
    period: str = Query("24h", regex="^(24h|7d|30d)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get time-series graph data for a monitor.

    Returns bucketed metric data and status change events for visualization.
    """
    # Get monitor
    monitor = db.query(Monitor).filter(Monitor.id == monitor_id).first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    # Get period configuration
    config = PERIOD_CONFIG[period]
    bucket_minutes = config["bucket_minutes"]
    hours = config["hours"]

    # Calculate time range
    end_time = datetime.utcnow()
    start_time = end_time - timedelta(hours=hours)

    # Get metric definitions for this monitor type from the monitor class
    metrics_def = get_monitor_metrics(monitor.monitor_type)

    # Query all status updates in the time range
    updates = db.query(StatusUpdate).filter(
        StatusUpdate.monitor_id == monitor_id,
        StatusUpdate.timestamp >= start_time,
        StatusUpdate.timestamp <= end_time
    ).order_by(StatusUpdate.timestamp.asc()).all()

    # Generate time buckets aligned to nice boundaries
    # Round start_time down to the nearest bucket boundary
    start_minute = (start_time.minute // bucket_minutes) * bucket_minutes
    aligned_start = start_time.replace(minute=start_minute, second=0, microsecond=0)
    if bucket_minutes >= 60:
        # For hourly or larger buckets, align to hour boundaries
        aligned_start = start_time.replace(minute=0, second=0, microsecond=0)
    if bucket_minutes >= 180:
        # For 3-hour buckets, align to 3-hour boundaries
        aligned_hour = (start_time.hour // 3) * 3
        aligned_start = start_time.replace(hour=aligned_hour, minute=0, second=0, microsecond=0)

    buckets = []
    current_bucket = aligned_start
    while current_bucket < end_time:
        buckets.append(current_bucket)
        current_bucket += timedelta(minutes=bucket_minutes)

    # Initialize metric data structures
    metrics_data = {}
    for metric in metrics_def:
        metrics_data[metric["key"]] = {
            "key": metric["key"],
            "label": metric["label"],
            "unit": metric["unit"],
            "color": metric["color"],
            "data": []
        }

    # Pre-compute which bucket each update belongs to for efficiency
    def get_bucket_index(ts):
        """Get the bucket index for a timestamp."""
        if ts < aligned_start:
            return -1
        delta_minutes = (ts - aligned_start).total_seconds() / 60
        return int(delta_minutes // bucket_minutes)

    # Group updates by bucket
    updates_by_bucket = {}
    for update in updates:
        # Handle timezone-naive timestamps (treat as UTC)
        ts = update.timestamp
        if ts.tzinfo is not None:
            ts = ts.replace(tzinfo=None)

        bucket_idx = get_bucket_index(ts)
        if 0 <= bucket_idx < len(buckets):
            if bucket_idx not in updates_by_bucket:
                updates_by_bucket[bucket_idx] = []
            updates_by_bucket[bucket_idx].append(update)

    # Process each bucket
    for bucket_idx, bucket_start in enumerate(buckets):
        bucket_updates = updates_by_bucket.get(bucket_idx, [])

        # Calculate aggregated values for each metric
        for metric in metrics_def:
            key = metric["key"]
            source = metric["source"]

            # Extract values from updates in this bucket
            values = []
            for update in bucket_updates:
                value = extract_metric_value(update, source)
                if value is not None:
                    values.append(value)

            # Aggregate: use average for most metrics
            if values:
                avg_value = sum(values) / len(values)
                metrics_data[key]["data"].append({
                    "timestamp": bucket_start.isoformat() + "Z",
                    "value": round(avg_value, 2)
                })
            else:
                # Check if we should show a gap or if the monitor just hasn't checked yet
                # Only show null if bucket is large enough for a check to have occurred
                check_interval = monitor.check_interval_minutes or 5
                if bucket_minutes >= check_interval:
                    metrics_data[key]["data"].append({
                        "timestamp": bucket_start.isoformat() + "Z",
                        "value": None
                    })
                else:
                    # Bucket is smaller than check interval, skip showing gap
                    # unless we're past the first check opportunity
                    time_since_start = (bucket_start - start_time).total_seconds() / 60
                    if time_since_start >= check_interval:
                        metrics_data[key]["data"].append({
                            "timestamp": bucket_start.isoformat() + "Z",
                            "value": None
                        })
                    else:
                        # Too early for data, still show null but it's expected
                        metrics_data[key]["data"].append({
                            "timestamp": bucket_start.isoformat() + "Z",
                            "value": None
                        })

    # Get status changes
    status_changes = get_status_changes(db, monitor_id, start_time, end_time)

    return {
        "monitor_id": monitor_id,
        "monitor_type": monitor.monitor_type,
        "period": period,
        "bucket_minutes": bucket_minutes,
        "check_interval_minutes": monitor.check_interval_minutes,
        "metrics": list(metrics_data.values()),
        "status_changes": status_changes
    }
