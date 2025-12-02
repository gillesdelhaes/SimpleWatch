"""
Notification configuration API endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, SMTPConfig, NotificationChannel, ServiceNotificationSettings
from models import (
    SMTPConfigCreate, SMTPConfigUpdate, SMTPConfigResponse,
    NotificationChannelCreate, NotificationChannelUpdate, NotificationChannelResponse,
    ServiceNotificationSettingsUpdate, ServiceNotificationSettingsResponse
)
from api.auth import get_current_user
from utils.notifications import (
    encrypt_password, send_email_with_config, send_webhook_with_payload,
    format_slack_payload, format_discord_payload, format_generic_payload
)
from typing import List
from datetime import datetime
import json

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


# ============================================
# SMTP Configuration Endpoints
# ============================================

@router.get("/smtp", response_model=SMTPConfigResponse)
def get_smtp_config(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get SMTP configuration (password masked)."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    config = db.query(SMTPConfig).first()
    if not config:
        raise HTTPException(status_code=404, detail="SMTP not configured")

    return config


@router.put("/smtp", response_model=SMTPConfigResponse)
def update_smtp_config(
    config_data: SMTPConfigCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create or update SMTP configuration."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    config = db.query(SMTPConfig).first()

    if config:
        # Update existing
        config.host = config_data.host
        config.port = config_data.port
        config.username = config_data.username
        config.password_encrypted = encrypt_password(config_data.password)
        config.from_address = config_data.from_address
        config.use_tls = config_data.use_tls
        config.is_tested = False  # Reset on config change
        config.tested_at = None
        config.updated_at = datetime.utcnow()
    else:
        # Create new
        config = SMTPConfig(
            host=config_data.host,
            port=config_data.port,
            username=config_data.username,
            password_encrypted=encrypt_password(config_data.password),
            from_address=config_data.from_address,
            use_tls=config_data.use_tls,
            is_tested=False
        )
        db.add(config)

    db.commit()
    db.refresh(config)
    return config


@router.post("/smtp/test")
def test_smtp_config(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Send test email to verify SMTP configuration."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    config = db.query(SMTPConfig).first()
    if not config:
        raise HTTPException(status_code=404, detail="SMTP not configured")

    # Send test email to admin
    test_email = current_user.email if hasattr(current_user, 'email') and current_user.email else config.username

    success, error = send_email_with_config(
        {
            'host': config.host,
            'port': config.port,
            'username': config.username,
            'password_encrypted': config.password_encrypted,
            'from_address': config.from_address,
            'use_tls': config.use_tls
        },
        [test_email],
        "[SimpleWatch] Test Email",
        f"""This is a test email from SimpleWatch.

If you're seeing this, your SMTP configuration is working correctly!

Configuration:
- SMTP Host: {config.host}
- SMTP Port: {config.port}
- Username: {config.username}
- From Address: {config.from_address}
- Use TLS: {config.use_tls}

You can now enable email notifications for your services.
"""
    )

    if success:
        # Mark as tested
        config.is_tested = True
        config.tested_at = datetime.utcnow()
        db.commit()
        return {"success": True, "message": f"Test email sent to {test_email}"}
    else:
        raise HTTPException(status_code=500, detail=f"Failed to send test email: {error}")


# ============================================
# Notification Channels (Webhooks) Endpoints
# ============================================

@router.get("/channels")
def list_notification_channels(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """List all notification channels (global, available to all admins)."""
    channels = db.query(NotificationChannel).all()
    return {"channels": channels}


@router.post("/channels", response_model=NotificationChannelResponse)
def create_notification_channel(
    channel_data: NotificationChannelCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create a new notification channel."""
    # Validate channel type
    if channel_data.channel_type not in ['slack', 'discord', 'generic']:
        raise HTTPException(status_code=400, detail="Invalid channel_type. Must be 'slack', 'discord', or 'generic'")

    # Validate generic webhook has template
    if channel_data.channel_type == 'generic' and not channel_data.custom_payload_template:
        raise HTTPException(status_code=400, detail="Generic webhooks require custom_payload_template")

    channel = NotificationChannel(
        user_id=current_user.id,
        label=channel_data.label,
        channel_type=channel_data.channel_type,
        webhook_url=channel_data.webhook_url,
        secret_token=channel_data.secret_token,
        custom_payload_template=channel_data.custom_payload_template,
        is_active=True,
        is_tested=False
    )

    db.add(channel)
    db.commit()
    db.refresh(channel)
    return channel


@router.put("/channels/{channel_id}", response_model=NotificationChannelResponse)
def update_notification_channel(
    channel_id: int,
    channel_data: NotificationChannelUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update a notification channel."""
    channel = db.query(NotificationChannel).filter(
        NotificationChannel.id == channel_id
    ).first()

    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Update fields
    channel.label = channel_data.label
    channel.channel_type = channel_data.channel_type
    channel.webhook_url = channel_data.webhook_url
    channel.secret_token = channel_data.secret_token
    channel.custom_payload_template = channel_data.custom_payload_template
    channel.is_tested = False  # Reset on config change
    channel.tested_at = None
    channel.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(channel)
    return channel


@router.delete("/channels/{channel_id}")
def delete_notification_channel(
    channel_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete a notification channel."""
    channel = db.query(NotificationChannel).filter(
        NotificationChannel.id == channel_id
    ).first()

    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    db.delete(channel)
    db.commit()
    return {"success": True, "message": "Channel deleted"}


@router.post("/channels/{channel_id}/toggle")
def toggle_notification_channel(
    channel_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Toggle notification channel active status."""
    channel = db.query(NotificationChannel).filter(
        NotificationChannel.id == channel_id
    ).first()

    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    channel.is_active = not channel.is_active
    db.commit()

    return {"success": True, "is_active": channel.is_active}


@router.post("/channels/{channel_id}/test")
def test_notification_channel(
    channel_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Send test notification to verify channel configuration."""
    channel = db.query(NotificationChannel).filter(
        NotificationChannel.id == channel_id
    ).first()

    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Create test payload
    test_monitors = [
        {"name": "Website Monitor", "type": "website", "status": "operational", "response_time": 150},
        {"name": "API Monitor", "type": "api", "status": "operational", "response_time": 200}
    ]

    # ISO 8601 format for Discord compatibility
    timestamp = datetime.utcnow().isoformat() + "Z"

    try:
        if channel.channel_type == "slack":
            payload = format_slack_payload(
                "Test Service", "operational", "operational",
                [], test_monitors, timestamp
            )
        elif channel.channel_type == "discord":
            payload = format_discord_payload(
                "Test Service", "operational", "operational",
                [], test_monitors, timestamp
            )
        elif channel.channel_type == "generic":
            payload = format_generic_payload(
                channel.custom_payload_template,
                "Test Service", "operational", "operational",
                [], test_monitors, timestamp
            )
        else:
            raise HTTPException(status_code=400, detail="Invalid channel type")

        success, error = send_webhook_with_payload(
            channel.webhook_url,
            payload,
            channel.secret_token
        )

        if success:
            # Mark as tested
            channel.is_tested = True
            channel.tested_at = datetime.utcnow()
            db.commit()
            return {"success": True, "message": "Test notification sent successfully"}
        else:
            raise HTTPException(status_code=500, detail=f"Failed to send test notification: {error}")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error sending test notification: {str(e)}")


# ============================================
# Service Notification Settings Endpoints
# ============================================

@router.get("/services/{service_id}", response_model=ServiceNotificationSettingsResponse)
def get_service_notification_settings(
    service_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get notification settings for a service."""
    settings = db.query(ServiceNotificationSettings).filter(
        ServiceNotificationSettings.service_id == service_id
    ).first()

    if not settings:
        # Create default settings if none exist
        settings = ServiceNotificationSettings(
            service_id=service_id,
            enabled=False,
            email_enabled=False,
            channel_ids="[]",
            cooldown_minutes=5,
            notify_on_recovery=True
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)

    return settings


@router.put("/services/{service_id}", response_model=ServiceNotificationSettingsResponse)
def update_service_notification_settings(
    service_id: int,
    settings_data: ServiceNotificationSettingsUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update notification settings for a service."""
    settings = db.query(ServiceNotificationSettings).filter(
        ServiceNotificationSettings.service_id == service_id
    ).first()

    if not settings:
        # Create new
        settings = ServiceNotificationSettings(
            service_id=service_id,
            enabled=settings_data.enabled,
            email_enabled=settings_data.email_enabled,
            email_recipients=settings_data.email_recipients,
            channel_ids=settings_data.channel_ids,
            cooldown_minutes=settings_data.cooldown_minutes,
            notify_on_recovery=settings_data.notify_on_recovery
        )
        db.add(settings)
    else:
        # Update existing
        settings.enabled = settings_data.enabled
        settings.email_enabled = settings_data.email_enabled
        settings.email_recipients = settings_data.email_recipients
        settings.channel_ids = settings_data.channel_ids
        settings.cooldown_minutes = settings_data.cooldown_minutes
        settings.notify_on_recovery = settings_data.notify_on_recovery
        settings.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(settings)
    return settings
