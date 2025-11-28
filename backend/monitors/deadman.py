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

    def __init__(self, config: Dict[str, Any], last_heartbeat: datetime = None):
        """
        Initialize deadman monitor.

        Args:
            config: Monitor configuration with expected_interval_hours and grace_period_hours
            last_heartbeat: Timestamp of last received heartbeat
        """
        super().__init__(config)
        self.last_heartbeat = last_heartbeat

    def check(self) -> Dict[str, Any]:
        """
        Check if heartbeat was received within expected interval.

        Returns:
            Dictionary with check results
        """
        expected_interval_hours = self.config.get("expected_interval_hours", 24)
        grace_period_hours = self.config.get("grace_period_hours", 1)

        # If no heartbeat received yet, status is down
        if not self.last_heartbeat:
            return {
                "status": "down",
                "message": "No heartbeat received yet",
                "metadata": {
                    "expected_interval_hours": expected_interval_hours,
                    "grace_period_hours": grace_period_hours,
                    "last_heartbeat": None
                }
            }

        now = datetime.utcnow()
        time_since_last_heartbeat = now - self.last_heartbeat

        # Calculate thresholds
        expected_interval = timedelta(hours=expected_interval_hours)
        grace_period = timedelta(hours=grace_period_hours)
        total_allowed_time = expected_interval + grace_period
        degraded_threshold = expected_interval * 0.8  # 80% of expected interval

        # Determine status based on time elapsed
        if time_since_last_heartbeat > total_allowed_time:
            # Grace period exceeded - DOWN
            hours_overdue = (time_since_last_heartbeat - total_allowed_time).total_seconds() / 3600
            return {
                "status": "down",
                "message": f"No heartbeat for {time_since_last_heartbeat.total_seconds() / 3600:.1f} hours ({hours_overdue:.1f}h overdue)",
                "metadata": {
                    "expected_interval_hours": expected_interval_hours,
                    "grace_period_hours": grace_period_hours,
                    "last_heartbeat": self.last_heartbeat.isoformat(),
                    "hours_since_heartbeat": time_since_last_heartbeat.total_seconds() / 3600
                }
            }
        elif time_since_last_heartbeat > degraded_threshold:
            # Approaching deadline - DEGRADED
            return {
                "status": "degraded",
                "message": f"Heartbeat due soon (last: {time_since_last_heartbeat.total_seconds() / 3600:.1f}h ago)",
                "metadata": {
                    "expected_interval_hours": expected_interval_hours,
                    "grace_period_hours": grace_period_hours,
                    "last_heartbeat": self.last_heartbeat.isoformat(),
                    "hours_since_heartbeat": time_since_last_heartbeat.total_seconds() / 3600
                }
            }
        else:
            # Within expected interval - OPERATIONAL
            return {
                "status": "operational",
                "message": f"Heartbeat received {time_since_last_heartbeat.total_seconds() / 3600:.1f}h ago",
                "metadata": {
                    "expected_interval_hours": expected_interval_hours,
                    "grace_period_hours": grace_period_hours,
                    "last_heartbeat": self.last_heartbeat.isoformat(),
                    "hours_since_heartbeat": time_since_last_heartbeat.total_seconds() / 3600
                }
            }

    def receive_heartbeat(self) -> Dict[str, Any]:
        """
        Process a heartbeat ping.

        Returns:
            Success status and updated timestamp
        """
        self.last_heartbeat = datetime.utcnow()

        return {
            "status": "operational",
            "message": "Heartbeat received",
            "metadata": {
                "heartbeat_time": self.last_heartbeat.isoformat()
            }
        }
