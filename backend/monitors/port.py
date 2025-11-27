"""
Port/service availability monitor implementation.
"""
import socket
import time
from typing import Dict, Any
from monitors.base import BaseMonitor


class PortMonitor(BaseMonitor):
    """Monitor for checking TCP port availability."""

    def check(self) -> Dict[str, Any]:
        """Check if a TCP port is open and accepting connections."""
        host = self.config.get("host")
        port = self.config.get("port")
        timeout = self.config.get("timeout_seconds", 5)

        try:
            start_time = time.time()

            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)

            result = sock.connect_ex((host, port))

            end_time = time.time()
            connection_time_ms = int((end_time - start_time) * 1000)

            sock.close()

            if result == 0:
                return {
                    "status": "operational",
                    "response_time_ms": connection_time_ms,
                    "metadata": {
                        "host": host,
                        "port": port
                    },
                    "message": f"Port {port} on {host} is open"
                }
            else:
                return {
                    "status": "down",
                    "metadata": {
                        "host": host,
                        "port": port,
                        "error_code": result
                    },
                    "message": f"Port {port} on {host} is closed or unreachable"
                }

        except socket.timeout:
            return {
                "status": "down",
                "metadata": {
                    "error": "timeout",
                    "host": host,
                    "port": port
                },
                "message": f"Connection to {host}:{port} timed out after {timeout} seconds"
            }

        except socket.gaierror as e:
            return {
                "status": "down",
                "metadata": {
                    "error": "dns_resolution_failed",
                    "host": host,
                    "port": port
                },
                "message": f"DNS resolution failed for {host}: {str(e)}"
            }

        except Exception as e:
            return {
                "status": "down",
                "metadata": {
                    "error": "unknown_error",
                    "host": host,
                    "port": port
                },
                "message": f"Check failed: {str(e)}"
            }
