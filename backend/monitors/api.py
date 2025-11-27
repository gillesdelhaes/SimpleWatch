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

    def check(self) -> Dict[str, Any]:
        """Check if API endpoint responds correctly."""
        url = self.config.get("url")
        method = self.config.get("method", "GET")
        headers = self.config.get("headers", {})
        expected_status_code = self.config.get("expected_status_code", 200)
        timeout = self.config.get("timeout_seconds", 10)
        json_path_validations = self.config.get("json_path_validations")

        try:
            start_time = time.time()

            if method.upper() == "GET":
                response = requests.get(
                    url,
                    headers=headers,
                    timeout=timeout
                )
            elif method.upper() == "POST":
                response = requests.post(
                    url,
                    headers=headers,
                    timeout=timeout
                )
            else:
                return {
                    "status": "down",
                    "message": f"Unsupported HTTP method: {method}"
                }

            end_time = time.time()
            response_time_ms = int((end_time - start_time) * 1000)

            if response.status_code != expected_status_code:
                return {
                    "status": "down",
                    "response_time_ms": response_time_ms,
                    "metadata": {
                        "status_code": response.status_code,
                        "expected_status_code": expected_status_code,
                        "url": url
                    },
                    "message": f"Expected status code {expected_status_code}, got {response.status_code}"
                }

            if json_path_validations:
                try:
                    response_json = response.json()

                    for path, expected_value in json_path_validations.items():
                        keys = path.split(".")
                        value = response_json
                        for key in keys:
                            value = value.get(key)
                            if value is None:
                                return {
                                    "status": "degraded",
                                    "response_time_ms": response_time_ms,
                                    "message": f"JSON path '{path}' not found in response"
                                }

                        if expected_value is not None and value != expected_value:
                            return {
                                "status": "degraded",
                                "response_time_ms": response_time_ms,
                                "message": f"JSON path '{path}' expected '{expected_value}', got '{value}'"
                            }

                except json.JSONDecodeError:
                    return {
                        "status": "degraded",
                        "response_time_ms": response_time_ms,
                        "message": "Response is not valid JSON"
                    }

            return {
                "status": "operational",
                "response_time_ms": response_time_ms,
                "metadata": {
                    "status_code": response.status_code,
                    "url": url
                },
                "message": f"API responded with expected status code {expected_status_code}"
            }

        except requests.exceptions.Timeout:
            return {
                "status": "down",
                "metadata": {
                    "error": "timeout",
                    "url": url
                },
                "message": f"API timed out after {timeout} seconds"
            }

        except requests.exceptions.ConnectionError as e:
            return {
                "status": "down",
                "metadata": {
                    "error": "connection_error",
                    "url": url
                },
                "message": f"Connection failed: {str(e)}"
            }

        except Exception as e:
            return {
                "status": "down",
                "metadata": {
                    "error": "unknown_error",
                    "url": url
                },
                "message": f"Check failed: {str(e)}"
            }
