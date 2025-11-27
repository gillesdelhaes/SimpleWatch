"""
Input validation utilities.
"""
import re
from typing import Optional


def is_valid_url(url: str) -> bool:
    """Validate URL format."""
    url_pattern = re.compile(
        r'^https?://'
        r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'
        r'localhost|'
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'
        r'(?::\d+)?'
        r'(?:/?|[/?]\S+)$', re.IGNORECASE)
    return url_pattern.match(url) is not None


def is_valid_port(port: int) -> bool:
    """Validate port number."""
    return 1 <= port <= 65535


def is_valid_hostname(hostname: str) -> bool:
    """Validate hostname or IP address."""
    hostname_pattern = re.compile(
        r'^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$'
    )
    ip_pattern = re.compile(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$')
    return hostname_pattern.match(hostname) is not None or ip_pattern.match(hostname) is not None


def sanitize_service_name(name: str) -> str:
    """Sanitize service name for storage."""
    return name.strip()
