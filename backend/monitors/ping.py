"""
ICMP Ping monitor implementation.
Checks host reachability, latency, and packet loss via ICMP ping.
"""
from icmplib import ping as icmp_ping
from typing import Dict, Any
from monitors.base import BaseMonitor


class PingMonitor(BaseMonitor):
    """Monitor for checking host reachability via ICMP ping."""

    GRAPH_METRICS = [
        {"key": "avg_rtt_ms", "label": "Avg Latency", "unit": "ms", "color": "#10B981", "source": "metadata.avg_rtt_ms"},
        {"key": "packet_loss_percent", "label": "Packet Loss", "unit": "%", "color": "#EF4444", "source": "metadata.packet_loss_percent"},
    ]

    def check(self) -> Dict[str, Any]:
        """Perform ICMP ping check."""
        host = self.config.get("host")
        count = self.config.get("count", 4)
        timeout_seconds = self.config.get("timeout_seconds", 5)
        latency_threshold_ms = self.config.get("latency_threshold_ms", 200)
        packet_loss_threshold_percent = self.config.get("packet_loss_threshold_percent", 20)

        try:
            # Perform ping (icmplib handles privileged/unprivileged mode automatically)
            result = icmp_ping(
                host,
                count=count,
                timeout=timeout_seconds,
                privileged=False  # Try unprivileged first
            )

            # Calculate metrics
            packets_sent = result.packets_sent
            packets_received = result.packets_received
            packet_loss_percent = ((packets_sent - packets_received) / packets_sent * 100) if packets_sent > 0 else 100
            avg_rtt_ms = result.avg_rtt if result.is_alive else None

            # Determine status
            if not result.is_alive or packets_received == 0:
                # Host is down - no packets received
                return {
                    "status": "down",
                    "response_time_ms": None,
                    "metadata": {
                        "host": host,
                        "packets_sent": packets_sent,
                        "packets_received": packets_received,
                        "packet_loss_percent": 100,
                        "reason": "Host unreachable - no ping responses received"
                    },
                    "message": f"Host {host} is unreachable"
                }

            # Host is reachable - check degradation conditions
            if packet_loss_percent >= packet_loss_threshold_percent:
                # High packet loss
                status = "degraded"
                reason = f"High packet loss: {packet_loss_percent:.1f}% (threshold: {packet_loss_threshold_percent}%)"
            elif avg_rtt_ms > latency_threshold_ms:
                # High latency
                status = "degraded"
                reason = f"High latency: {avg_rtt_ms:.1f}ms (threshold: {latency_threshold_ms}ms)"
            else:
                # All good
                status = "operational"
                reason = f"Latency: {avg_rtt_ms:.1f}ms, Packet loss: {packet_loss_percent:.1f}%"

            return {
                "status": status,
                "response_time_ms": int(avg_rtt_ms) if avg_rtt_ms else None,
                "metadata": {
                    "host": host,
                    "packets_sent": packets_sent,
                    "packets_received": packets_received,
                    "packet_loss_percent": round(packet_loss_percent, 2),
                    "avg_rtt_ms": round(avg_rtt_ms, 2) if avg_rtt_ms else None,
                    "min_rtt_ms": round(result.min_rtt, 2) if result.min_rtt else None,
                    "max_rtt_ms": round(result.max_rtt, 2) if result.max_rtt else None,
                    "reason": reason
                },
                "message": reason
            }

        except PermissionError:
            # icmplib needs elevated permissions - try with privileged=True
            try:
                result = icmp_ping(
                    host,
                    count=count,
                    timeout=timeout_seconds,
                    privileged=True
                )

                # Same logic as above (repeated to avoid nesting complexity)
                packets_sent = result.packets_sent
                packets_received = result.packets_received
                packet_loss_percent = ((packets_sent - packets_received) / packets_sent * 100) if packets_sent > 0 else 100
                avg_rtt_ms = result.avg_rtt if result.is_alive else None

                if not result.is_alive or packets_received == 0:
                    return {
                        "status": "down",
                        "response_time_ms": None,
                        "metadata": {
                            "host": host,
                            "packets_sent": packets_sent,
                            "packets_received": packets_received,
                            "packet_loss_percent": 100,
                            "reason": "Host unreachable - no ping responses received"
                        },
                        "message": f"Host {host} is unreachable"
                    }

                if packet_loss_percent >= packet_loss_threshold_percent:
                    status = "degraded"
                    reason = f"High packet loss: {packet_loss_percent:.1f}% (threshold: {packet_loss_threshold_percent}%)"
                elif avg_rtt_ms > latency_threshold_ms:
                    status = "degraded"
                    reason = f"High latency: {avg_rtt_ms:.1f}ms (threshold: {latency_threshold_ms}ms)"
                else:
                    status = "operational"
                    reason = f"Latency: {avg_rtt_ms:.1f}ms, Packet loss: {packet_loss_percent:.1f}%"

                return {
                    "status": status,
                    "response_time_ms": int(avg_rtt_ms) if avg_rtt_ms else None,
                    "metadata": {
                        "host": host,
                        "packets_sent": packets_sent,
                        "packets_received": packets_received,
                        "packet_loss_percent": round(packet_loss_percent, 2),
                        "avg_rtt_ms": round(avg_rtt_ms, 2) if avg_rtt_ms else None,
                        "min_rtt_ms": round(result.min_rtt, 2) if result.min_rtt else None,
                        "max_rtt_ms": round(result.max_rtt, 2) if result.max_rtt else None,
                        "reason": reason
                    },
                    "message": reason
                }

            except Exception as e:
                return {
                    "status": "down",
                    "metadata": {
                        "host": host,
                        "error": "permission_error",
                        "reason": "ICMP ping requires elevated permissions and privileged mode failed"
                    },
                    "message": f"Permission error: {str(e)}"
                }

        except Exception as e:
            return {
                "status": "down",
                "metadata": {
                    "host": host,
                    "error": "ping_failed",
                    "reason": str(e)
                },
                "message": f"Ping failed: {str(e)}"
            }
