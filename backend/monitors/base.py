"""
Base monitor class for all monitor types.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, List


class BaseMonitor(ABC):
    """Base class for all monitors."""

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
                "metadata": dict (optional),
                "message": str (optional)
            }
        """
        pass
