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
    - At least one uppercase letter
    - At least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)

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

    # Check for uppercase letter
    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter"

    # Check for special character
    special_chars = "!@#$%^&*()_+-=[]{}|;:,.<>?"
    if not any(c in special_chars for c in password):
        return False, "Password must contain at least one special character"

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
