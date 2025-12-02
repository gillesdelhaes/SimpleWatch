"""
Notification utilities for email and webhooks.
"""
import os
import smtplib
import requests
import json
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, List
from cryptography.fernet import Fernet
import logging

logger = logging.getLogger(__name__)

# Encryption key is now managed in the database
# Will be retrieved from utils.db.get_encryption_key() when needed
_cipher_suite_cache = None


def _get_cipher_suite():
    """
    Get Fernet cipher suite, using cached instance.
    The encryption key is stored in the database and auto-generated on first deployment.
    """
    global _cipher_suite_cache
    if _cipher_suite_cache is None:
        from database import SessionLocal
        from utils.db import get_encryption_key

        db = SessionLocal()
        try:
            key = get_encryption_key(db)
            _cipher_suite_cache = Fernet(key.encode())
        finally:
            db.close()

    return _cipher_suite_cache


# ============================================
# Notification Functions
# ============================================

def encrypt_password(password: str) -> str:
    """
    Encrypt password for storage.
    Uses auto-generated encryption key from database.
    """
    cipher_suite = _get_cipher_suite()
    return cipher_suite.encrypt(password.encode()).decode()


def decrypt_password(encrypted_password: str) -> str:
    """
    Decrypt password from storage.
    Uses auto-generated encryption key from database.
    """
    cipher_suite = _get_cipher_suite()
    return cipher_suite.decrypt(encrypted_password.encode()).decode()


def send_email_with_config(smtp_config: dict, to_emails: List[str],
                           subject: str, body: str) -> tuple[bool, str]:
    """
    Send email notification via SMTP using provided config.

    Args:
        smtp_config: Dict with keys: host, port, username, password_encrypted, from_address, use_tls
        to_emails: List of recipient email addresses
        subject: Email subject line
        body: Email body (plain text)

    Returns:
        Tuple of (success: bool, error_message: str or None)
    """
    try:
        # Decrypt password
        password = decrypt_password(smtp_config['password_encrypted'])

        # Create message
        msg = MIMEMultipart()
        msg['From'] = smtp_config['from_address']
        msg['To'] = ', '.join(to_emails)
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))

        # Connect and send
        server = smtplib.SMTP(smtp_config['host'], smtp_config['port'])
        if smtp_config['use_tls']:
            server.starttls()
        server.login(smtp_config['username'], password)
        server.send_message(msg)
        server.quit()

        logger.info(f"Email sent to {to_emails}: {subject}")
        return True, None

    except Exception as e:
        error_msg = str(e)
        logger.error(f"Failed to send email: {error_msg}")
        return False, error_msg


def send_webhook_with_payload(webhook_url: str, payload: dict,
                               secret_token: str = None) -> tuple[bool, str]:
    """
    Send webhook notification with given payload.

    Args:
        webhook_url: Webhook destination URL
        payload: JSON payload to send
        secret_token: Optional secret token for authentication

    Returns:
        Tuple of (success: bool, error_message: str or None)
    """
    try:
        headers = {"Content-Type": "application/json"}
        if secret_token:
            headers["X-Webhook-Secret"] = secret_token

        response = requests.post(
            webhook_url,
            json=payload,
            headers=headers,
            timeout=10
        )
        response.raise_for_status()

        logger.info(f"Webhook sent to {webhook_url}")
        return True, None

    except Exception as e:
        error_msg = str(e)
        logger.error(f"Failed to send webhook to {webhook_url}: {error_msg}")
        return False, error_msg


def format_slack_payload(service_name: str, old_status: str, new_status: str,
                         affected_monitors: List[dict], all_monitors: List[dict],
                         timestamp: str) -> dict:
    """
    Format notification payload for Slack Block Kit.

    Args:
        service_name: Name of the service
        old_status: Previous status
        new_status: Current status (operational, degraded, down)
        affected_monitors: List of monitors that changed (dict with name, type, status, error)
        all_monitors: List of all monitors for this service (dict with name, status, response_time)
        timestamp: ISO timestamp of status change

    Returns:
        Slack-formatted payload dict
    """
    # Determine emoji and color
    if new_status == "operational":
        emoji = "✅"
        color = "good"  # Green
        title = f"{emoji} {service_name} recovered"
    elif new_status == "degraded":
        emoji = "🟡"
        color = "warning"  # Yellow
        title = f"{emoji} {service_name} is DEGRADED"
    else:  # down
        emoji = "🔴"
        color = "danger"  # Red
        title = f"{emoji} {service_name} is DOWN"

    # Count operational monitors
    operational_count = sum(1 for m in all_monitors if m['status'] == 'operational')
    total_count = len(all_monitors)

    # Format affected monitors
    affected_text = "\n".join([
        f"❌ {m['name']} ({m['type']}) - {m.get('error', 'failed')}"
        for m in affected_monitors
    ]) if affected_monitors else "All monitors recovered"

    return {
        "attachments": [{
            "color": color,
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": title
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {
                            "type": "mrkdwn",
                            "text": f"*Affected:*\n{affected_text}"
                        },
                        {
                            "type": "mrkdwn",
                            "text": f"*All Monitors:*\n{operational_count}/{total_count} operational"
                        }
                    ]
                },
                {
                    "type": "context",
                    "elements": [{
                        "type": "mrkdwn",
                        "text": f"{timestamp}"
                    }]
                }
            ]
        }]
    }


def format_discord_payload(service_name: str, old_status: str, new_status: str,
                           affected_monitors: List[dict], all_monitors: List[dict],
                           timestamp: str) -> dict:
    """
    Format notification payload for Discord embeds.

    Args: Same as format_slack_payload

    Returns:
        Discord-formatted payload dict
    """
    # Determine emoji and color
    if new_status == "operational":
        emoji = "✅"
        color = 5763719  # Green
        title = f"{emoji} {service_name} recovered"
    elif new_status == "degraded":
        emoji = "🟡"
        color = 16763904  # Yellow/Orange
        title = f"{emoji} {service_name} is DEGRADED"
    else:  # down
        emoji = "🔴"
        color = 15158332  # Red
        title = f"{emoji} {service_name} is DOWN"

    # Count operational monitors
    operational_count = sum(1 for m in all_monitors if m['status'] == 'operational')
    total_count = len(all_monitors)

    # Format description
    if affected_monitors:
        affected_text = "\n".join([
            f"❌ {m['name']} ({m['type']}) - {m.get('error', 'failed')}"
            for m in affected_monitors
        ])
        description = f"**Affected:**\n{affected_text}\n\n**Status:** {operational_count}/{total_count} monitors operational"
    else:
        description = f"All monitors operational ({total_count}/{total_count})"

    return {
        "embeds": [{
            "title": title,
            "description": description,
            "color": color,
            "timestamp": timestamp,
            "footer": {
                "text": "SimpleWatch"
            }
        }]
    }


def format_generic_payload(template: str, service_name: str, old_status: str,
                           new_status: str, affected_monitors: List[dict],
                           all_monitors: List[dict], timestamp: str) -> dict:
    """
    Format notification payload using custom JSON template.

    Template variables available:
        {{service_name}}     - Service name
        {{old_status}}       - Previous status
        {{new_status}}       - Current status
        {{status_emoji}}     - ✅, 🟡, or 🔴 based on new_status
        {{affected_count}}   - Number of affected monitors
        {{operational_count}} - Number of operational monitors
        {{total_count}}      - Total number of monitors
        {{timestamp}}        - ISO timestamp
        {{affected_monitors}} - JSON array of affected monitors
        {{all_monitors}}     - JSON array of all monitors

    Args:
        template: JSON template string with {{variables}}
        (other args same as format_slack_payload)

    Returns:
        Parsed JSON payload dict
    """
    # Determine emoji
    emoji_map = {
        "operational": "✅",
        "degraded": "🟡",
        "down": "🔴"
    }

    # Replace template variables
    payload_str = template
    payload_str = payload_str.replace("{{service_name}}", service_name)
    payload_str = payload_str.replace("{{old_status}}", old_status)
    payload_str = payload_str.replace("{{new_status}}", new_status)
    payload_str = payload_str.replace("{{status_emoji}}", emoji_map.get(new_status, "❓"))
    payload_str = payload_str.replace("{{affected_count}}", str(len(affected_monitors)))
    payload_str = payload_str.replace("{{operational_count}}",
                                     str(sum(1 for m in all_monitors if m['status'] == 'operational')))
    payload_str = payload_str.replace("{{total_count}}", str(len(all_monitors)))
    payload_str = payload_str.replace("{{timestamp}}", timestamp)
    payload_str = payload_str.replace("{{affected_monitors}}", json.dumps(affected_monitors))
    payload_str = payload_str.replace("{{all_monitors}}", json.dumps(all_monitors))

    # Parse and return
    try:
        return json.loads(payload_str)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse generic payload template: {e}")
        raise
