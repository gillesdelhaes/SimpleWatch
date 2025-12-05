"""
Password validation utilities for SimpleWatch.
Centralized validation logic used across setup, user management, and password changes.
"""
from typing import Tuple


def validate_password(password: str) -> Tuple[bool, str]:
    """
    Validate password meets security requirements.

    Requirements:
    - At least 8 characters long

    Args:
        password: The password to validate

    Returns:
        Tuple of (is_valid, error_message)
        - is_valid: True if password meets requirements, False otherwise
        - error_message: Empty string if valid, error description if invalid
    """
    if not password:
        return False, "Password is required"

    if len(password) < 8:
        return False, "Password must be at least 8 characters long"

    return True, ""


def validate_password_match(password: str, confirm_password: str) -> Tuple[bool, str]:
    """
    Validate that password and confirmation match.

    Args:
        password: The password
        confirm_password: The confirmation password

    Returns:
        Tuple of (is_valid, error_message)
    """
    if password != confirm_password:
        return False, "Passwords do not match"

    return True, ""
