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

    def evaluate_metric(self, value: float) -> Dict[str, Any]:
        """
        Evaluate a metric value against thresholds.

        Args:
            value: The metric value to evaluate

        Returns:
            Dictionary with evaluation results
        """
        warning_threshold = self.config.get("warning_threshold")
        critical_threshold = self.config.get("critical_threshold")
        comparison = self.config.get("comparison", "greater")

        if comparison == "greater":
            if value >= critical_threshold:
                return {
                    "status": "down",
                    "message": f"Value {value} exceeds critical threshold of {critical_threshold}",
                    "metadata": {
                        "value": value,
                        "warning_threshold": warning_threshold,
                        "critical_threshold": critical_threshold
                    }
                }
            elif value >= warning_threshold:
                return {
                    "status": "degraded",
                    "message": f"Value {value} exceeds warning threshold of {warning_threshold}",
                    "metadata": {
                        "value": value,
                        "warning_threshold": warning_threshold,
                        "critical_threshold": critical_threshold
                    }
                }
            else:
                return {
                    "status": "operational",
                    "message": f"Value {value} is within normal range",
                    "metadata": {
                        "value": value,
                        "warning_threshold": warning_threshold,
                        "critical_threshold": critical_threshold
                    }
                }
        else:
            if value <= critical_threshold:
                return {
                    "status": "down",
                    "message": f"Value {value} is below critical threshold of {critical_threshold}",
                    "metadata": {
                        "value": value,
                        "warning_threshold": warning_threshold,
                        "critical_threshold": critical_threshold
                    }
                }
            elif value <= warning_threshold:
                return {
                    "status": "degraded",
                    "message": f"Value {value} is below warning threshold of {warning_threshold}",
                    "metadata": {
                        "value": value,
                        "warning_threshold": warning_threshold,
                        "critical_threshold": critical_threshold
                    }
                }
            else:
                return {
                    "status": "operational",
                    "message": f"Value {value} is within normal range",
                    "metadata": {
                        "value": value,
                        "warning_threshold": warning_threshold,
                        "critical_threshold": critical_threshold
                    }
                }
