"""
SNMP monitor implementation for querying network devices.
Supports SNMP v1, v2c, and v3 with GET operations.
Uses pysnmp v7+ async API.
"""
import asyncio
import time
import logging
from typing import Dict, Any, Optional, Tuple
from monitors.base import BaseMonitor

logger = logging.getLogger(__name__)


class SNMPMonitor(BaseMonitor):
    """
    Monitor for querying SNMP-enabled devices.

    Supports:
    - SNMP v1, v2c (community string auth)
    - SNMP v3 (username/password auth with optional encryption)
    - GET operations on single OIDs
    - Value comparison: exact match, threshold (greater/less), presence check

    Configuration:
        host: Target device hostname or IP
        port: SNMP port (default: 161)
        version: SNMP version ('v1', 'v2c', 'v3')
        community: Community string for v1/v2c
        username: Username for v3
        auth_password: Authentication password for v3
        priv_password: Privacy password for v3 (optional)
        auth_protocol: Authentication protocol for v3 ('MD5', 'SHA')
        priv_protocol: Privacy protocol for v3 ('DES', 'AES')
        oid: Object Identifier to query
        value_type: Expected value type ('numeric', 'string', 'presence')
        comparison: Comparison method ('equal', 'not_equal', 'greater', 'less', 'contains')
        expected_value: Expected value (for equal/not_equal/contains comparisons)
        warning_threshold: Warning threshold (for numeric comparisons)
        critical_threshold: Critical threshold (for numeric comparisons)
        timeout: Query timeout in seconds (default: 5)
    """

    # Common OID presets for quick reference
    COMMON_OIDS = {
        'sysUptime': '1.3.6.1.2.1.1.3.0',
        'sysDescr': '1.3.6.1.2.1.1.1.0',
        'sysName': '1.3.6.1.2.1.1.5.0',
        'sysContact': '1.3.6.1.2.1.1.4.0',
        'sysLocation': '1.3.6.1.2.1.1.6.0',
        'ifNumber': '1.3.6.1.2.1.2.1.0',
        'ifOperStatus': '1.3.6.1.2.1.2.2.1.8',  # Needs interface index
    }

    def check(self) -> Dict[str, Any]:
        """Perform SNMP query and evaluate the result."""
        host = self.config.get("host")
        port = self.config.get("port", 161)
        version = self.config.get("version", "v2c")
        oid = self.config.get("oid")
        timeout = self.config.get("timeout", 5)

        if not host or not oid:
            return {
                "status": "down",
                "metadata": {
                    "error": "configuration_error",
                    "reason": "Host and OID are required"
                },
                "message": "Invalid configuration: host and OID required"
            }

        try:
            start_time = time.time()

            # Run async SNMP query - create new event loop for thread safety
            # APScheduler runs in ThreadPoolExecutor which doesn't have an event loop
            result, error = asyncio.run(
                self._snmp_get_async(host, port, version, oid, timeout)
            )

            response_time_ms = int((time.time() - start_time) * 1000)

            if error:
                return {
                    "status": "down",
                    "response_time_ms": response_time_ms,
                    "metadata": {
                        "host": host,
                        "port": port,
                        "oid": oid,
                        "error": error,
                        "reason": error
                    },
                    "message": f"SNMP query failed: {error}"
                }

            # Evaluate the result
            status, reason = self._evaluate_result(result)

            return {
                "status": status,
                "response_time_ms": response_time_ms,
                "metadata": {
                    "host": host,
                    "port": port,
                    "oid": oid,
                    "value": str(result),
                    "value_type": type(result).__name__,
                    "reason": reason
                },
                "message": reason
            }

        except Exception as e:
            logger.error(f"SNMP check failed for {host}:{port}: {e}")
            return {
                "status": "down",
                "metadata": {
                    "host": host,
                    "port": port,
                    "oid": oid,
                    "error": str(e),
                    "reason": f"SNMP query failed: {str(e)}"
                },
                "message": f"SNMP check failed: {str(e)}"
            }

    async def _snmp_get_async(self, host: str, port: int, version: str, oid: str, timeout: int) -> Tuple[Any, Optional[str]]:
        """
        Perform async SNMP GET operation using pysnmp v7 API.

        Returns:
            Tuple of (result_value, error_message)
            On success, error_message is None
            On failure, result_value is None
        """
        try:
            from pysnmp.hlapi.v3arch.asyncio import (
                SnmpEngine, CommunityData, UsmUserData,
                UdpTransportTarget, ContextData, ObjectType, ObjectIdentity,
                get_cmd,
                usmHMACMD5AuthProtocol, usmHMACSHAAuthProtocol,
                usmDESPrivProtocol, usmAesCfb128Protocol
            )
        except ImportError as e:
            return None, f"pysnmp library not installed or import error: {e}. Install with: pip install pysnmp"

        # Build authentication data based on version
        if version in ('v1', 'v2c'):
            community = self.config.get("community", "public")
            mp_model = 0 if version == 'v1' else 1
            auth_data = CommunityData(community, mpModel=mp_model)
        elif version == 'v3':
            username = self.config.get("username", "")
            auth_password = self.config.get("auth_password")
            priv_password = self.config.get("priv_password")
            auth_protocol = self.config.get("auth_protocol", "SHA")
            priv_protocol = self.config.get("priv_protocol", "AES")

            # Map auth protocol names to pysnmp objects
            auth_protocol_map = {
                'MD5': usmHMACMD5AuthProtocol,
                'SHA': usmHMACSHAAuthProtocol,
            }

            # Map priv protocol names to pysnmp objects
            priv_protocol_map = {
                'DES': usmDESPrivProtocol,
                'AES': usmAesCfb128Protocol,
            }

            auth_proto = auth_protocol_map.get(auth_protocol, usmHMACSHAAuthProtocol)
            priv_proto = priv_protocol_map.get(priv_protocol, usmAesCfb128Protocol)

            if auth_password and priv_password:
                # Full auth + privacy
                auth_data = UsmUserData(
                    username,
                    authKey=auth_password,
                    privKey=priv_password,
                    authProtocol=auth_proto,
                    privProtocol=priv_proto
                )
            elif auth_password:
                # Auth only, no privacy
                auth_data = UsmUserData(
                    username,
                    authKey=auth_password,
                    authProtocol=auth_proto
                )
            else:
                # No auth (noAuthNoPriv)
                auth_data = UsmUserData(username)
        else:
            return None, f"Unsupported SNMP version: {version}"

        try:
            # Build transport target
            transport = await UdpTransportTarget.create((host, port), timeout=timeout, retries=1)

            # Perform the GET request using pysnmp v7 async API
            error_indication, error_status, error_index, var_binds = await get_cmd(
                SnmpEngine(),
                auth_data,
                transport,
                ContextData(),
                ObjectType(ObjectIdentity(oid))
            )

            # Check for errors
            if error_indication:
                return None, str(error_indication)

            if error_status:
                error_msg = f"{error_status.prettyPrint()} at {error_index and var_binds[int(error_index) - 1][0] or '?'}"
                return None, error_msg

            # Extract the value
            if var_binds:
                name, value = var_binds[0]

                # Convert to Python native type
                value_str = value.prettyPrint()

                # Try to convert to appropriate type
                try:
                    # Try integer first
                    try:
                        return int(value), None
                    except (ValueError, TypeError):
                        pass
                    # Try float
                    try:
                        return float(value), None
                    except (ValueError, TypeError):
                        pass
                    # Return as string
                    return value_str, None
                except Exception:
                    return value_str, None

            return None, "No data returned"

        except Exception as e:
            return None, str(e)

    def _evaluate_result(self, value: Any) -> Tuple[str, str]:
        """
        Evaluate the SNMP result against configured expectations.

        Returns:
            Tuple of (status, reason_message)
        """
        value_type = self.config.get("value_type", "presence")
        comparison = self.config.get("comparison", "equal")
        expected_value = self.config.get("expected_value")
        warning_threshold = self.config.get("warning_threshold")
        critical_threshold = self.config.get("critical_threshold")

        # Presence check - just verify we got a value
        if value_type == "presence":
            if value is not None:
                return "operational", f"OID returned value: {value}"
            else:
                return "down", "OID did not return a value"

        # String comparisons
        if value_type == "string":
            str_value = str(value)

            if comparison == "equal":
                if str_value == expected_value:
                    return "operational", f"Value '{str_value}' matches expected"
                else:
                    return "down", f"Value '{str_value}' does not match expected '{expected_value}'"

            elif comparison == "not_equal":
                if str_value != expected_value:
                    return "operational", f"Value '{str_value}' differs from '{expected_value}' as expected"
                else:
                    return "down", f"Value '{str_value}' unexpectedly equals '{expected_value}'"

            elif comparison == "contains":
                if expected_value in str_value:
                    return "operational", f"Value contains '{expected_value}'"
                else:
                    return "down", f"Value '{str_value}' does not contain '{expected_value}'"

        # Numeric comparisons with thresholds
        if value_type == "numeric":
            try:
                num_value = float(value)
            except (ValueError, TypeError):
                return "down", f"Expected numeric value, got: {value}"

            # Threshold-based evaluation (like metric_threshold)
            if warning_threshold is not None and critical_threshold is not None:
                if comparison == "greater":
                    if num_value >= critical_threshold:
                        return "down", f"Value {num_value} exceeds critical threshold {critical_threshold}"
                    elif num_value >= warning_threshold:
                        return "degraded", f"Value {num_value} exceeds warning threshold {warning_threshold}"
                    else:
                        return "operational", f"Value {num_value} is within normal range"

                elif comparison == "less":
                    if num_value <= critical_threshold:
                        return "down", f"Value {num_value} is below critical threshold {critical_threshold}"
                    elif num_value <= warning_threshold:
                        return "degraded", f"Value {num_value} is below warning threshold {warning_threshold}"
                    else:
                        return "operational", f"Value {num_value} is within normal range"

            # Simple numeric comparisons
            if expected_value is not None:
                try:
                    expected_num = float(expected_value)
                except (ValueError, TypeError):
                    return "down", f"Invalid expected value: {expected_value}"

                if comparison == "equal":
                    if num_value == expected_num:
                        return "operational", f"Value {num_value} equals expected {expected_num}"
                    else:
                        return "down", f"Value {num_value} does not equal expected {expected_num}"

                elif comparison == "not_equal":
                    if num_value != expected_num:
                        return "operational", f"Value {num_value} differs from {expected_num} as expected"
                    else:
                        return "down", f"Value {num_value} unexpectedly equals {expected_num}"

                elif comparison == "greater":
                    if num_value > expected_num:
                        return "operational", f"Value {num_value} is greater than {expected_num}"
                    else:
                        return "down", f"Value {num_value} is not greater than {expected_num}"

                elif comparison == "less":
                    if num_value < expected_num:
                        return "operational", f"Value {num_value} is less than {expected_num}"
                    else:
                        return "down", f"Value {num_value} is not less than {expected_num}"

            # No threshold or expected value configured, just return the value
            return "operational", f"Value: {num_value}"

        # Default: operational if we got any value
        return "operational", f"Value: {value}"
