"""
Base monitor class for all monitor types.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, List


class BaseMonitor(ABC):
    """Base class for all monitors."""

    # Monitor type identifier (derived from filename, e.g., 'website' from website.py)
    # Set automatically by the scheduler's discover_monitors()
    MONITOR_TYPE: str = ""

    # Whether this monitor is passive (only receives data via API, not actively checked)
    IS_PASSIVE: bool = False

    # Whether this monitor's last_check_at is managed by an external heartbeat signal
    # rather than the scheduler. When True:
    #   - The scheduler does NOT update last_check_at after running a check
    #   - The heartbeat ingestion endpoint updates last_check_at instead
    #   - The dashboard displays last_check_at as the meaningful "last seen" timestamp
    ACCEPTS_HEARTBEAT: bool = False

    # Whether this monitor can receive external metric values via the metric ingestion API.
    # When True, the monitor must implement evaluate_metric(value) -> {"status", "reason"}.
    ACCEPTS_METRIC: bool = False

    # Graphable metrics for this monitor type
    # Each metric: {"key": str, "label": str, "unit": str, "color": str, "source": str}
    # source can be "response_time_ms" or "metadata.<key>"
    GRAPH_METRICS: List[Dict[str, str]] = []

    def __init__(self, config: Dict[str, Any]):
        """
        Initialize monitor with configuration.

        Args:
            config: Monitor-specific configuration dictionary
        """
        self.config = config

    @abstractmethod
    def check(self) -> Dict[str, Any]:
        """
        Perform the monitor check.

        Returns:
            Dictionary with check results:
            {
                "status": "operational|degraded|down",
                "response_time_ms": int (optional),
                "metadata": {"reason": str, ...} (optional)
            }
        """
        pass
