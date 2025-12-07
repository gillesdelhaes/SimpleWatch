"""
SSL Certificate monitor implementation.
"""
import ssl
import socket
from datetime import datetime
from typing import Dict, Any
from monitors.base import BaseMonitor


class SSLCertMonitor(BaseMonitor):
    """Monitor for checking SSL certificate expiration."""

    def check(self) -> Dict[str, Any]:
        """Check SSL certificate validity and expiration."""
        hostname = self.config.get("hostname")
        port = self.config.get("port", 443)
        warning_days = self.config.get("warning_days", 30)
        critical_days = self.config.get("critical_days", 7)

        try:
            # Create SSL context
            context = ssl.create_default_context()

            # Connect to the server and get certificate
            with socket.create_connection((hostname, port), timeout=10) as sock:
                with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                    cert = ssock.getpeercert()

            # Parse expiration date
            expiry_date_str = cert['notAfter']
            # Format: 'Jan 1 12:00:00 2025 GMT'
            expiry_date = datetime.strptime(expiry_date_str, '%b %d %H:%M:%S %Y %Z')

            # Calculate days until expiration
            days_until_expiry = (expiry_date - datetime.utcnow()).days

            # Determine status based on days remaining
            if days_until_expiry < 0:
                status = "down"
                message = f"Certificate expired {abs(days_until_expiry)} days ago"
            elif days_until_expiry <= critical_days:
                status = "down"
                message = f"Certificate expires in {days_until_expiry} days (critical)"
            elif days_until_expiry <= warning_days:
                status = "degraded"
                message = f"Certificate expires in {days_until_expiry} days (warning)"
            else:
                status = "operational"
                message = f"Certificate valid for {days_until_expiry} days"

            return {
                "status": status,
                "response_time_ms": 0,  # Not applicable for SSL cert checks
                "metadata": {
                    "hostname": hostname,
                    "port": port,
                    "expiry_date": expiry_date.isoformat(),
                    "days_until_expiry": days_until_expiry,
                    "issuer": cert.get('issuer', [[('organizationName', 'Unknown')]])[0][0][1]
                },
                "message": message
            }

        except ssl.SSLError as e:
            return {
                "status": "down",
                "response_time_ms": 0,
                "metadata": {
                    "error": "ssl_error",
                    "hostname": hostname,
                    "port": port
                },
                "message": f"SSL error: {str(e)}"
            }

        except socket.timeout:
            return {
                "status": "down",
                "response_time_ms": 0,
                "metadata": {
                    "error": "timeout",
                    "hostname": hostname,
                    "port": port
                },
                "message": f"Connection timed out"
            }

        except socket.gaierror as e:
            return {
                "status": "down",
                "response_time_ms": 0,
                "metadata": {
                    "error": "dns_error",
                    "hostname": hostname,
                    "port": port
                },
                "message": f"DNS resolution failed: {str(e)}"
            }

        except Exception as e:
            return {
                "status": "down",
                "response_time_ms": 0,
                "metadata": {
                    "error": "unknown_error",
                    "hostname": hostname,
                    "port": port
                },
                "message": f"Check failed: {str(e)}"
            }
