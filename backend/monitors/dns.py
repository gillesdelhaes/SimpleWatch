"""
DNS records monitor implementation.
Checks DNS resolution and optionally validates expected values.
"""
import dns.resolver
import dns.exception
import time
from typing import Dict, Any, List
from monitors.base import BaseMonitor


class DNSMonitor(BaseMonitor):
    """Monitor for checking DNS record resolution and validation."""

    def check(self) -> Dict[str, Any]:
        """Check DNS records for a hostname."""
        hostname = self.config.get("hostname")
        record_type = self.config.get("record_type", "A")
        expected_value = self.config.get("expected_value")
        nameserver = self.config.get("nameserver")
        timeout_seconds = self.config.get("timeout_seconds", 5)

        # Configure resolver
        resolver = dns.resolver.Resolver()
        resolver.timeout = timeout_seconds
        resolver.lifetime = timeout_seconds

        # Use custom nameserver if provided
        if nameserver:
            resolver.nameservers = [nameserver]

        try:
            start_time = time.time()

            # Perform DNS query
            answers = resolver.resolve(hostname, record_type)

            end_time = time.time()
            response_time_ms = int((end_time - start_time) * 1000)

            # Extract resolved values
            resolved_values = []
            for rdata in answers:
                # Format based on record type
                if record_type in ["A", "AAAA"]:
                    resolved_values.append(str(rdata))
                elif record_type == "CNAME":
                    resolved_values.append(str(rdata.target).rstrip('.'))
                elif record_type == "MX":
                    resolved_values.append(f"{rdata.preference} {str(rdata.exchange).rstrip('.')}")
                elif record_type == "TXT":
                    # TXT records can have multiple strings
                    resolved_values.append(' '.join([s.decode('utf-8') if isinstance(s, bytes) else s for s in rdata.strings]))
                elif record_type == "NS":
                    resolved_values.append(str(rdata.target).rstrip('.'))
                else:
                    resolved_values.append(str(rdata))

            # Determine status based on expected value
            status = "operational"
            message = f"DNS {record_type} records resolved successfully"

            if expected_value:
                # Normalize expected value for comparison
                expected_normalized = expected_value.strip()

                # Check if expected value matches any resolved value
                match_found = False
                for resolved in resolved_values:
                    # For MX records, check if expected value is in the full "priority hostname" string
                    # or just matches the hostname part
                    if record_type == "MX":
                        if expected_normalized in resolved or expected_normalized in resolved.split(' ')[1]:
                            match_found = True
                            break
                    # For other records, direct comparison
                    elif resolved == expected_normalized:
                        match_found = True
                        break

                if match_found:
                    status = "operational"
                    message = f"DNS {record_type} record matches expected value"
                else:
                    status = "down"
                    message = f"DNS {record_type} record does not match expected value '{expected_value}'"

            return {
                "status": status,
                "response_time_ms": response_time_ms,
                "metadata": {
                    "hostname": hostname,
                    "record_type": record_type,
                    "resolved_values": resolved_values,
                    "expected_value": expected_value,
                    "nameserver": nameserver or "system default"
                },
                "message": message
            }

        except dns.resolver.NXDOMAIN:
            return {
                "status": "down",
                "metadata": {
                    "error": "nxdomain",
                    "hostname": hostname,
                    "record_type": record_type
                },
                "message": f"Domain {hostname} does not exist (NXDOMAIN)"
            }

        except dns.resolver.NoAnswer:
            return {
                "status": "down",
                "metadata": {
                    "error": "no_answer",
                    "hostname": hostname,
                    "record_type": record_type
                },
                "message": f"No {record_type} records found for {hostname}"
            }

        except dns.resolver.Timeout:
            return {
                "status": "down",
                "metadata": {
                    "error": "timeout",
                    "hostname": hostname,
                    "record_type": record_type
                },
                "message": f"DNS query timed out after {timeout_seconds} seconds"
            }

        except dns.exception.DNSException as e:
            return {
                "status": "down",
                "metadata": {
                    "error": "dns_error",
                    "hostname": hostname,
                    "record_type": record_type
                },
                "message": f"DNS error: {str(e)}"
            }

        except Exception as e:
            return {
                "status": "down",
                "metadata": {
                    "error": "unknown_error",
                    "hostname": hostname,
                    "record_type": record_type
                },
                "message": f"Check failed: {str(e)}"
            }
