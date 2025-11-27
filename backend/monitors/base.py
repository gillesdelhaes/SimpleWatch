"""
Base monitor class for all monitor types.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any


class BaseMonitor(ABC):
    """Base class for all monitors."""

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

    def _determine_status_from_http_code(self, status_code: int) -> str:
        """
        Determine service status from HTTP status code.

        Args:
            status_code: HTTP status code

        Returns:
            Status string: "operational", "degraded", or "down"
        """
        if 200 <= status_code < 300:
            return "operational"
        elif 300 <= status_code < 400:
            return "degraded"
        else:
            return "down"
