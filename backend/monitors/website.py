"""
Website/URL monitor implementation.
"""
import requests
import time
from typing import Dict, Any
from monitors.base import BaseMonitor


class WebsiteMonitor(BaseMonitor):
    """Monitor for checking website/URL availability."""

    def check(self) -> Dict[str, Any]:
        """Check if website responds properly."""
        url = self.config.get("url")
        timeout = self.config.get("timeout_seconds", 10)
        follow_redirects = self.config.get("follow_redirects", True)
        verify_ssl = self.config.get("verify_ssl", True)

        try:
            start_time = time.time()

            response = requests.get(
                url,
                timeout=timeout,
                allow_redirects=follow_redirects,
                verify=verify_ssl,
                headers={"User-Agent": "SimpleWatch-Monitor/1.0"}
            )

            end_time = time.time()
            response_time_ms = int((end_time - start_time) * 1000)

            status = self._determine_status_from_http_code(response.status_code)

            return {
                "status": status,
                "response_time_ms": response_time_ms,
                "metadata": {
                    "status_code": response.status_code,
                    "url": url
                },
                "message": f"Website returned status code {response.status_code}"
            }

        except requests.exceptions.Timeout:
            return {
                "status": "down",
                "metadata": {
                    "error": "timeout",
                    "url": url
                },
                "message": f"Website timed out after {timeout} seconds"
            }

        except requests.exceptions.SSLError as e:
            return {
                "status": "down",
                "metadata": {
                    "error": "ssl_error",
                    "url": url
                },
                "message": f"SSL certificate verification failed: {str(e)}"
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
