"""
Audit logging helper for tracking user actions.
"""
import json
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from database import AuditLog

logger = logging.getLogger(__name__)


def log_action(
    db: Session,
    user=None,
    username: str = None,
    action: str = "",
    resource_type: str = None,
    resource_id: int = None,
    resource_name: str = None,
    details: dict = None,
    ip_address: str = None
):
    """
    Log a user action to the audit log.

    Args:
        db: Database session
        user: User object (optional, None for failed logins)
        username: Username string (used when user object is not available)
        action: Action identifier (e.g. "login.success", "service.create")
        resource_type: Type of resource (e.g. "service", "monitor")
        resource_id: ID of the affected resource
        resource_name: Name of the affected resource
        details: Extra context as a dict (stored as JSON)
        ip_address: Client IP address
    """
    try:
        entry = AuditLog(
            user_id=user.id if user else None,
            username=username or (user.username if user else None),
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            resource_name=resource_name,
            details=json.dumps(details) if details else None,
            ip_address=ip_address,
            created_at=datetime.utcnow()
        )
        db.add(entry)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to write audit log: {e}")
        db.rollback()
