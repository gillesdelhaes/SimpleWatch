"""
Service-level helper functions for status calculation, incident management, and notifications.
Consolidates all service-related operations in one place.
"""
from sqlalchemy.orm import Session
from database import (
    Service, Monitor, StatusUpdate, Incident,
    SMTPConfig, NotificationChannel, ServiceNotificationSettings, NotificationLog
)
from utils.notifications import (
    send_email_with_config, send_webhook_with_payload,
    format_slack_payload, format_discord_payload, format_generic_payload
)
from datetime import datetime, timedelta
from typing import List
import json
import logging

logger = logging.getLogger(__name__)


# ============================================
# Service Status Calculation
# ============================================

def calculate_service_status(db: Session, service_id: int) -> str:
    """
    Calculate overall service status by aggregating monitor statuses.
    Single source of truth for service status determination.

    Returns: 'operational', 'degraded', 'down', or 'unknown'
    """
    from api.dashboard import calculate_service_status_from_counts

    monitors = db.query(Monitor).filter(
        Monitor.service_id == service_id,
        Monitor.is_active == True
    ).all()

    if not monitors:
        return "unknown"

    # Count monitor statuses
    operational_count = 0
    degraded_count = 0
    down_count = 0

    for monitor in monitors:
        latest = db.query(StatusUpdate).filter(
            StatusUpdate.monitor_id == monitor.id
        ).order_by(StatusUpdate.timestamp.desc()).first()

        if latest:
            if latest.status == "operational":
                operational_count += 1
            elif latest.status == "degraded":
                degraded_count += 1
            elif latest.status == "down":
                down_count += 1

    # Use shared calculation logic from dashboard API
    return calculate_service_status_from_counts(
        operational_count, degraded_count, down_count
    )


def get_failing_monitor_ids(db: Session, service_id: int) -> List[int]:
    """
    Get list of monitor IDs that are currently failing (degraded or down).
    Used for incident tracking.

    Returns: List of monitor IDs
    """
    monitors = db.query(Monitor).filter(
        Monitor.service_id == service_id,
        Monitor.is_active == True
    ).all()

    failing = []
    for monitor in monitors:
        latest = db.query(StatusUpdate).filter(
            StatusUpdate.monitor_id == monitor.id
        ).order_by(StatusUpdate.timestamp.desc()).first()

        if latest and latest.status in ["degraded", "down"]:
            failing.append(monitor.id)

    return failing


# ============================================
# Incident Management
# ============================================

def update_service_incidents(db: Session, service_id: int):
    """
    Check if service status has changed and create/close incidents accordingly.
    Called after monitor checks and data ingestion.

    Handles:
    - Creating new incidents when service goes degraded/down
    - Updating severity if it changes mid-incident
    - Closing incidents when service recovers
    """
    try:
        # Calculate current aggregated service status
        current_status = calculate_service_status(db, service_id)

        # Check for existing ongoing incident
        ongoing = db.query(Incident).filter(
            Incident.service_id == service_id,
            Incident.status == "ongoing"
        ).first()

        # State transitions
        if current_status in ["degraded", "down"]:
            if not ongoing:
                # Service just went degraded/down - create new incident
                affected = get_failing_monitor_ids(db, service_id)
                incident = Incident(
                    service_id=service_id,
                    started_at=datetime.utcnow(),
                    severity=current_status,
                    status="ongoing",
                    affected_monitors_json=json.dumps(affected)
                )
                db.add(incident)
                db.commit()
                logger.info(f"Created incident for service {service_id} (severity: {current_status})")
            elif ongoing.severity != current_status:
                # Severity changed (e.g., degraded -> down or down -> degraded)
                ongoing.severity = current_status
                # Update affected monitors
                affected = get_failing_monitor_ids(db, service_id)
                ongoing.affected_monitors_json = json.dumps(affected)
                db.commit()
                logger.info(f"Updated incident {ongoing.id} severity to {current_status}")

        elif current_status == "operational":
            if ongoing:
                # Service recovered - close incident
                ongoing.ended_at = datetime.utcnow()
                ongoing.status = "resolved"
                ongoing.duration_seconds = int((ongoing.ended_at - ongoing.started_at).total_seconds())
                ongoing.recovery_metadata_json = json.dumps({"trigger": "auto"})
                db.commit()
                logger.info(f"Resolved incident {ongoing.id} (duration: {ongoing.duration_seconds}s)")

    except Exception as e:
        logger.error(f"Error updating incidents for service {service_id}: {e}")
        db.rollback()


# ============================================
# Notification Helper Functions
# ============================================

def should_send_notification(db: Session, service_id: int, new_status: str) -> bool:
    """
    Check if notification should be sent based on:
    1. Service has notifications enabled
    2. Status actually changed
    3. Cooldown period elapsed (except for recovery)

    Returns: True if should notify
    """
    settings = db.query(ServiceNotificationSettings).filter(
        ServiceNotificationSettings.service_id == service_id
    ).first()

    if not settings or not settings.enabled:
        return False

    # Check if status changed
    if settings.last_notified_status == new_status:
        return False

    # If recovering, always notify regardless of cooldown
    if new_status == "operational" and settings.notify_on_recovery:
        return True

    # Check cooldown
    if settings.last_notification_sent_at:
        cooldown_end = settings.last_notification_sent_at + timedelta(minutes=settings.cooldown_minutes)
        if datetime.utcnow() < cooldown_end:
            logger.info(f"Skipping notification for service {service_id} - cooldown period active")
            return False

    return True


def get_affected_monitors(db: Session, service_id: int) -> List[dict]:
    """
    Get monitors that recently changed status (last 2 minutes).
    Used to show which monitors triggered the notification.

    Returns: List of dicts with monitor info
    """
    cutoff_time = datetime.utcnow() - timedelta(minutes=2)

    monitors = db.query(Monitor).filter(
        Monitor.service_id == service_id,
        Monitor.is_active == True
    ).all()

    affected = []
    for monitor in monitors:
        latest = db.query(StatusUpdate).filter(
            StatusUpdate.monitor_id == monitor.id,
            StatusUpdate.timestamp >= cutoff_time
        ).order_by(StatusUpdate.timestamp.desc()).first()

        if latest and latest.status != "operational":
            config = json.loads(monitor.config_json)
            metadata = json.loads(latest.metadata_json or "{}")
            affected.append({
                "name": config.get("name", f"{monitor.monitor_type.title()} Monitor"),
                "type": monitor.monitor_type,
                "status": latest.status,
                "error": metadata.get("error", "Unknown error")
            })

    return affected


def get_all_monitors_summary(db: Session, service_id: int) -> List[dict]:
    """
    Get summary of all monitors for this service.

    Returns: List of dicts with monitor status
    """
    monitors = db.query(Monitor).filter(
        Monitor.service_id == service_id,
        Monitor.is_active == True
    ).all()

    summary = []
    for monitor in monitors:
        latest = db.query(StatusUpdate).filter(
            StatusUpdate.monitor_id == monitor.id
        ).order_by(StatusUpdate.timestamp.desc()).first()

        config = json.loads(monitor.config_json)
        summary.append({
            "name": config.get("name", f"{monitor.monitor_type.title()} Monitor"),
            "type": monitor.monitor_type,
            "status": latest.status if latest else "unknown",
            "response_time": latest.response_time_ms if latest else None
        })

    return summary


def format_email_body(service_name: str, old_status: str, new_status: str,
                      affected_monitors: List[dict], all_monitors: List[dict],
                      timestamp: str, dashboard_url: str = None) -> str:
    """
    Format email body with service status details.
    """
    # Status emoji
    emoji_map = {"operational": "✅", "degraded": "🟡", "down": "🔴"}
    emoji = emoji_map.get(new_status, "❓")

    # Header
    body = f"""Service: {service_name}
Current Status: {emoji} {new_status.upper()} (was {old_status})
Changed At: {timestamp}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"""

    # Affected monitors section
    if affected_monitors:
        body += "AFFECTED MONITORS:\n\n"
        for monitor in affected_monitors:
            body += f"❌ {monitor['name']} ({monitor['type']})\n"
            body += f"   Status: {monitor['status'].upper()}\n"
            body += f"   Error: {monitor['error']}\n\n"
        body += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"

    # All monitors summary
    body += "ALL MONITORS FOR THIS SERVICE:\n\n"
    operational_count = 0
    for monitor in all_monitors:
        status_icon = "✅" if monitor['status'] == "operational" else "❌"
        if monitor['status'] == "operational":
            operational_count += 1

        response_info = f" ({monitor['response_time']}ms)" if monitor['response_time'] else ""
        body += f"{status_icon} {monitor['name']} - {monitor['status']}{response_info}\n"

    body += f"\nService is {operational_count}/{len(all_monitors)} monitors operational"

    if new_status == "degraded":
        body += " (DEGRADED)"
    elif new_status == "down":
        body += " (DOWN)"

    body += "\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"

    # Footer
    if dashboard_url:
        body += f"View Dashboard: {dashboard_url}\n\n"

    body += f"""You're receiving this because email notifications are enabled for "{service_name}".
To change notification settings, visit the dashboard and edit this service."""

    return body


# ============================================
# Main Notification Function
# ============================================

def send_service_notification(db: Session, service_id: int, old_status: str, new_status: str):
    """
    Main function to send notifications for a service status change.

    This is called from scheduler.py and monitor_ingestion.py after status updates.
    Handles email and webhook notifications with proper logging.
    """
    # Get service
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        logger.error(f"Service {service_id} not found")
        return

    # Check if we should notify
    if not should_send_notification(db, service_id, new_status):
        return

    # Get notification settings
    settings = db.query(ServiceNotificationSettings).filter(
        ServiceNotificationSettings.service_id == service_id
    ).first()

    if not settings:
        return

    # Gather monitor data
    affected_monitors = get_affected_monitors(db, service_id)
    all_monitors = get_all_monitors_summary(db, service_id)
    # ISO 8601 format for Discord compatibility
    timestamp = datetime.utcnow().isoformat() + "Z"

    # Send email if enabled
    if settings.email_enabled and settings.email_recipients:
        smtp_config = db.query(SMTPConfig).first()
        if smtp_config and smtp_config.is_tested:
            # Format subject
            emoji = {"operational": "✅", "degraded": "🟡", "down": "🔴"}.get(new_status, "❓")
            subject = f"{emoji} [SimpleWatch] {service.name} is {new_status.upper()}"

            # Format body
            body = format_email_body(
                service.name, old_status, new_status,
                affected_monitors, all_monitors, timestamp
            )

            # Send
            recipients = [email.strip() for email in settings.email_recipients.split(",")]
            success, error = send_email_with_config(
                {
                    'host': smtp_config.host,
                    'port': smtp_config.port,
                    'username': smtp_config.username,
                    'password_encrypted': smtp_config.password_encrypted,
                    'from_address': smtp_config.from_address,
                    'use_tls': smtp_config.use_tls
                },
                recipients,
                subject,
                body
            )

            # Log email notification
            log_entry = NotificationLog(
                service_id=service_id,
                notification_type='email',
                channel_id=None,
                channel_label=", ".join(recipients),
                status_change=f"{old_status} -> {new_status}",
                delivery_status='sent' if success else 'failed',
                error_message=error if not success else None,
                sent_at=datetime.utcnow()
            )
            db.add(log_entry)
            db.commit()

            if success:
                logger.info(f"Email notification sent for service {service.name}")
            else:
                logger.error(f"Failed to send email for service {service.name}: {error}")

    # Send webhooks if enabled
    if settings.channel_ids:
        channel_ids = json.loads(settings.channel_ids)
        channels = db.query(NotificationChannel).filter(
            NotificationChannel.id.in_(channel_ids),
            NotificationChannel.is_active == True,
            NotificationChannel.is_tested == True
        ).all()

        for channel in channels:
            try:
                # Format payload based on channel type
                if channel.channel_type == "slack":
                    payload = format_slack_payload(
                        service.name, old_status, new_status,
                        affected_monitors, all_monitors, timestamp
                    )
                elif channel.channel_type == "discord":
                    payload = format_discord_payload(
                        service.name, old_status, new_status,
                        affected_monitors, all_monitors, timestamp
                    )
                elif channel.channel_type == "generic":
                    payload = format_generic_payload(
                        channel.custom_payload_template,
                        service.name, old_status, new_status,
                        affected_monitors, all_monitors, timestamp
                    )
                else:
                    logger.error(f"Unknown channel type: {channel.channel_type}")
                    continue

                # Send webhook
                success, error = send_webhook_with_payload(
                    channel.webhook_url,
                    payload,
                    channel.secret_token
                )

                # Log webhook notification
                log_entry = NotificationLog(
                    service_id=service_id,
                    notification_type='webhook',
                    channel_id=channel.id,
                    channel_label=channel.label,
                    status_change=f"{old_status} -> {new_status}",
                    delivery_status='sent' if success else 'failed',
                    error_message=error if not success else None,
                    sent_at=datetime.utcnow()
                )
                db.add(log_entry)
                db.commit()

                if success:
                    logger.info(f"Webhook notification sent to {channel.label}")
                else:
                    logger.error(f"Failed to send webhook to {channel.label}: {error}")

            except Exception as e:
                # Log failed webhook attempt
                log_entry = NotificationLog(
                    service_id=service_id,
                    notification_type='webhook',
                    channel_id=channel.id,
                    channel_label=channel.label,
                    status_change=f"{old_status} -> {new_status}",
                    delivery_status='failed',
                    error_message=str(e),
                    sent_at=datetime.utcnow()
                )
                db.add(log_entry)
                db.commit()
                logger.error(f"Error sending webhook to {channel.label}: {e}")

    # Update notification tracking
    settings.last_notification_sent_at = datetime.utcnow()
    settings.last_notified_status = new_status
    db.commit()

    logger.info(f"Notification process completed for service {service.name}: {old_status} → {new_status}")


# Backwards compatibility - alias for old function name
determine_service_status = calculate_service_status
