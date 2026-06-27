"""
Deadman (heartbeat) monitor implementation.
"""
from typing import Dict, Any
from datetime import datetime, timedelta
from monitors.base import BaseMonitor


class DeadmanMonitor(BaseMonitor):
    """
    Deadman monitor that expects regular heartbeat pings.

    Marks service as DOWN if no heartbeat received within expected interval.
    Useful for monitoring cron jobs, backups, and scheduled tasks.
    """

    ACCEPTS_HEARTBEAT = True

    GRAPH_METRICS = [
        {"key": "hours_since_heartbeat", "label": "Hours Since Heartbeat", "unit": "h", "color": "#F59E0B", "source": "metadata.hours_since_heartbeat"},
    ]

    def check(self) -> Dict[str, Any]:
        """Check if heartbeat was received within expected interval."""
        # last_check_at is injected by the scheduler alongside monitor_id
        last_heartbeat = self.config.get("last_check_at")
        if isinstance(last_heartbeat, str):
            last_heartbeat = datetime.fromisoformat(last_heartbeat)

        expected_interval_hours = self.config.get("expected_interval_hours", 24)
        grace_period_hours = self.config.get("grace_period_hours", 1)

        if not last_heartbeat:
            return {
                "status": "down",
                "metadata": {
                    "expected_interval_hours": expected_interval_hours,
                    "grace_period_hours": grace_period_hours,
                    "last_heartbeat": None,
                    "reason": "No heartbeat received yet"
                }
            }

        now = datetime.utcnow()
        time_since = now - last_heartbeat
        total_allowed = timedelta(hours=expected_interval_hours) + timedelta(hours=grace_period_hours)
        degraded_threshold = timedelta(hours=expected_interval_hours) * 0.8
        hours_since = time_since.total_seconds() / 3600

        base_meta = {
            "expected_interval_hours": expected_interval_hours,
            "grace_period_hours": grace_period_hours,
            "last_heartbeat": last_heartbeat.isoformat(),
            "hours_since_heartbeat": hours_since
        }

        if time_since > total_allowed:
            hours_overdue = (time_since - total_allowed).total_seconds() / 3600
            return {
                "status": "down",
                "metadata": {**base_meta, "reason": f"No heartbeat for {hours_since:.1f}h ({hours_overdue:.1f}h overdue)"}
            }
        elif time_since > degraded_threshold:
            return {
                "status": "degraded",
                "metadata": {**base_meta, "reason": f"Heartbeat due soon (last: {hours_since:.1f}h ago)"}
            }
        else:
            return {
                "status": "operational",
                "metadata": {**base_meta, "reason": f"Heartbeat received {hours_since:.1f}h ago"}
            }
