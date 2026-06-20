"""
API endpoint monitor implementation.
"""
import requests
import time
import json
from typing import Dict, Any
from monitors.base import BaseMonitor


class APIMonitor(BaseMonitor):
    """Monitor for checking API endpoint availability and responses."""

    GRAPH_METRICS = [
        {"key": "response_time_ms", "label": "Response Time", "unit": "ms", "color": "#10B981", "source": "response_time_ms"},
        {"key": "status_code", "label": "Status Code", "unit": "", "color": "#6366F1", "source": "metadata.status_code"},
    ]

    def _parse_body(self, request_body: str):
        """Return (json_data, raw_data) tuple for a request body string."""
        if not request_body or not request_body.strip():
            return None, None
        try:
            return json.loads(request_body), None
        except json.JSONDecodeError:
            return None, request_body

    def check(self) -> Dict[str, Any]:
        """Check if API endpoint responds correctly."""
        url = self.config.get("url")
        method = self.config.get("method", "GET").upper()
        headers = self.config.get("headers", {})
        request_body = self.config.get("request_body", "")
        expected_status_code = self.config.get("expected_status_code", 200)
        timeout = self.config.get("timeout_seconds", 10)
        json_path_validations = self.config.get("json_path_validations")

        try:
            start_time = time.time()

            if method in ("POST", "PUT", "PATCH"):
                json_data, data = self._parse_body(request_body)
                response = getattr(requests, method.lower())(
                    url, headers=headers, json=json_data, data=data, timeout=timeout
                )
            elif method in ("GET", "DELETE"):
                response = getattr(requests, method.lower())(url, headers=headers, timeout=timeout)
            else:
                return {
                    "status": "down",
                    "metadata": {"reason": f"Unsupported HTTP method: {method}"}
                }

            response_time_ms = int((time.time() - start_time) * 1000)

            if response.status_code != expected_status_code:
                return {
                    "status": "down",
                    "response_time_ms": response_time_ms,
                    "metadata": {
                        "status_code": response.status_code,
                        "expected_status_code": expected_status_code,
                        "url": url,
                        "reason": f"Expected {expected_status_code}, got {response.status_code}"
                    }
                }

            if json_path_validations:
                try:
                    response_json = response.json()
                    for path, expected_value in json_path_validations.items():
                        keys = path.split(".")
                        value = response_json
                        for key in keys:
                            value = value.get(key) if isinstance(value, dict) else None
                            if value is None:
                                return {
                                    "status": "degraded",
                                    "response_time_ms": response_time_ms,
                                    "metadata": {"reason": f"JSON path '{path}' not found in response"}
                                }
                        if expected_value is not None and value != expected_value:
                            return {
                                "status": "degraded",
                                "response_time_ms": response_time_ms,
                                "metadata": {"reason": f"JSON path '{path}' expected '{expected_value}', got '{value}'"}
                            }
                except json.JSONDecodeError:
                    return {
                        "status": "degraded",
                        "response_time_ms": response_time_ms,
                        "metadata": {"reason": "Response is not valid JSON"}
                    }

            return {
                "status": "operational",
                "response_time_ms": response_time_ms,
                "metadata": {
                    "status_code": response.status_code,
                    "url": url,
                    "reason": f"HTTP {response.status_code}"
                }
            }

        except requests.exceptions.Timeout:
            return {
                "status": "down",
                "metadata": {"error": "timeout", "url": url, "reason": f"Timed out after {timeout}s"}
            }

        except requests.exceptions.ConnectionError as e:
            return {
                "status": "down",
                "metadata": {"error": "connection_error", "url": url, "reason": f"Connection failed: {str(e)}"}
            }

        except Exception as e:
            return {
                "status": "down",
                "metadata": {"error": "unknown_error", "url": url, "reason": f"Check failed: {str(e)}"}
            }
