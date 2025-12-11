"""
Metric threshold monitor implementation.
"""
from typing import Dict, Any
from monitors.base import BaseMonitor


class MetricThresholdMonitor(BaseMonitor):
    """
    Monitor for threshold-based metric monitoring.

    Note: This is a passive monitor that receives values via API.
    The check() method is not used for scheduled checks.
    """

    def check(self) -> Dict[str, Any]:
        """
        Metric monitors are passive receivers.
        They don't perform active checks.
        """
        return {
            "status": "unknown",
            "message": "Metric monitors are passive and receive data via API"
        }

    def evaluate_metric(self, value: float) -> Dict[str, str]:
        """
        Evaluate a metric value against thresholds.

        Args:
            value: The metric value to evaluate

        Returns:
            Dictionary with 'status' and 'reason' keys
        """
        warning_threshold = self.config.get("warning_threshold")
        critical_threshold = self.config.get("critical_threshold")
        comparison = self.config.get("comparison", "greater")

        if comparison == "greater":
            if value >= critical_threshold:
                return {
                    "status": "down",
                    "reason": f"Value {value} exceeds critical threshold of {critical_threshold}"
                }
            elif value >= warning_threshold:
                return {
                    "status": "degraded",
                    "reason": f"Value {value} exceeds warning threshold of {warning_threshold}"
                }
            else:
                return {
                    "status": "operational",
                    "reason": f"Value {value} is within normal range"
                }
        else:  # "less"
            if value <= critical_threshold:
                return {
                    "status": "down",
                    "reason": f"Value {value} is below critical threshold of {critical_threshold}"
                }
            elif value <= warning_threshold:
                return {
                    "status": "degraded",
                    "reason": f"Value {value} is below warning threshold of {warning_threshold}"
                }
            else:
                return {
                    "status": "operational",
                    "reason": f"Value {value} is within normal range"
                }
