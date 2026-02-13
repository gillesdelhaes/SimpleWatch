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


def send_pagerduty(routing_key: str, payload: dict) -> tuple[bool, str]:
    """
    Send alert to PagerDuty Events API v2.
    """
    try:
        response = requests.post(
            "https://events.pagerduty.com/v2/enqueue",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        response.raise_for_status()
        logger.info(f"PagerDuty alert sent (action: {payload.get('event_action')})")
        return True, None
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Failed to send PagerDuty alert: {error_msg}")
        return False, error_msg


def send_opsgenie(api_key: str, payload: dict) -> tuple[bool, str]:
    """
    Send alert to Opsgenie Alert API.
    Handles both create and close actions.
    """
    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"GenieKey {api_key}"
        }

        # Check if this is a close action
        if payload.get("_opsgenie_action") == "close":
            alias = payload.get("alias")
            response = requests.post(
                f"https://api.opsgenie.com/v2/alerts/{alias}/close?identifierType=alias",
                json={"source": "SimpleWatch"},
                headers=headers,
                timeout=10
            )
        else:
            response = requests.post(
                "https://api.opsgenie.com/v2/alerts",
                json=payload,
                headers=headers,
                timeout=10
            )

        response.raise_for_status()
        logger.info(f"Opsgenie alert sent")
        return True, None
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Failed to send Opsgenie alert: {error_msg}")
        return False, error_msg


def send_telegram(bot_token: str, payload: dict) -> tuple[bool, str]:
    """
    Send message via Telegram Bot API.
    """
    try:
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        response = requests.post(
            url,
            json=payload,
            timeout=10
        )
        response.raise_for_status()
        logger.info(f"Telegram message sent to chat {payload.get('chat_id')}")
        return True, None
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Failed to send Telegram message: {error_msg}")
        return False, error_msg


def send_ntfy(topic_url: str, payload: dict, access_token: str = None) -> tuple[bool, str]:
    """
    Send notification via ntfy.sh.

    Args:
        topic_url: Full ntfy URL (e.g., https://ntfy.sh/mytopic)
        payload: Dict with _ntfy_headers and _ntfy_body
        access_token: Optional access token for private topics
    """
    try:
        headers = payload.get("_ntfy_headers", {})
        body = payload.get("_ntfy_body", "")

        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"

        response = requests.post(
            topic_url,
            data=body.encode('utf-8'),
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        logger.info(f"ntfy notification sent to {topic_url}")
        return True, None
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Failed to send ntfy notification: {error_msg}")
        return False, error_msg


def send_matrix(homeserver_url: str, room_id: str, access_token: str, payload: dict) -> tuple[bool, str]:
    """
    Send message to Matrix room.

    Args:
        homeserver_url: Matrix homeserver URL (e.g., https://matrix.org)
        room_id: Room ID (e.g., !roomid:matrix.org)
        access_token: Matrix access token
        payload: Message payload
    """
    try:
        import time
        txn_id = int(time.time() * 1000)
        url = f"{homeserver_url}/_matrix/client/r0/rooms/{room_id}/send/m.room.message/{txn_id}"

        response = requests.put(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            timeout=10
        )
        response.raise_for_status()
        logger.info(f"Matrix message sent to {room_id}")
        return True, None
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Failed to send Matrix message: {error_msg}")
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


def format_pagerduty_payload(service_name: str, old_status: str, new_status: str,
                              affected_monitors: List[dict], all_monitors: List[dict],
                              timestamp: str, routing_key: str, service_id: int = None) -> dict:
    """
    Format notification payload for PagerDuty Events API v2.

    Args:
        routing_key: PagerDuty integration/routing key
        service_id: Optional service ID for dedup_key
        (other args same as format_slack_payload)

    Returns:
        PagerDuty Events API v2 payload
    """
    # Determine severity and event action
    if new_status == "operational":
        event_action = "resolve"
        severity = "info"
    elif new_status == "degraded":
        event_action = "trigger"
        severity = "warning"
    else:  # down
        event_action = "trigger"
        severity = "critical"

    # Build summary
    operational_count = sum(1 for m in all_monitors if m['status'] == 'operational')
    total_count = len(all_monitors)

    if new_status == "operational":
        summary = f"{service_name} has recovered ({total_count}/{total_count} monitors operational)"
    else:
        affected_text = ", ".join([m['name'] for m in affected_monitors[:3]])
        if len(affected_monitors) > 3:
            affected_text += f" (+{len(affected_monitors) - 3} more)"
        summary = f"{service_name} is {new_status.upper()}: {affected_text}"

    # Use service_id for dedup_key to group related alerts
    dedup_key = f"simplewatch-{service_id}" if service_id else f"simplewatch-{service_name}"

    payload = {
        "routing_key": routing_key,
        "event_action": event_action,
        "dedup_key": dedup_key,
        "payload": {
            "summary": summary,
            "severity": severity,
            "source": "SimpleWatch",
            "timestamp": timestamp,
            "custom_details": {
                "service_name": service_name,
                "old_status": old_status,
                "new_status": new_status,
                "operational_monitors": operational_count,
                "total_monitors": total_count,
                "affected_monitors": [m['name'] for m in affected_monitors]
            }
        }
    }

    return payload


def format_opsgenie_payload(service_name: str, old_status: str, new_status: str,
                            affected_monitors: List[dict], all_monitors: List[dict],
                            timestamp: str, service_id: int = None) -> dict:
    """
    Format notification payload for Opsgenie Alert API.

    Args:
        service_id: Optional service ID for alias (deduplication)
        (other args same as format_slack_payload)

    Returns:
        Opsgenie Alert API payload
    """
    # Determine priority
    if new_status == "operational":
        # For recovery, we close the alert
        return {
            "_opsgenie_action": "close",
            "alias": f"simplewatch-{service_id}" if service_id else f"simplewatch-{service_name}"
        }
    elif new_status == "degraded":
        priority = "P3"
    else:  # down
        priority = "P1"

    # Build message
    operational_count = sum(1 for m in all_monitors if m['status'] == 'operational')
    total_count = len(all_monitors)

    affected_text = ", ".join([m['name'] for m in affected_monitors[:3]])
    if len(affected_monitors) > 3:
        affected_text += f" (+{len(affected_monitors) - 3} more)"

    return {
        "message": f"{service_name} is {new_status.upper()}",
        "alias": f"simplewatch-{service_id}" if service_id else f"simplewatch-{service_name}",
        "description": f"Affected monitors: {affected_text}\n\nStatus: {operational_count}/{total_count} monitors operational",
        "priority": priority,
        "source": "SimpleWatch",
        "tags": ["simplewatch", new_status],
        "details": {
            "service_name": service_name,
            "old_status": old_status,
            "new_status": new_status,
            "affected_monitors": ", ".join([m['name'] for m in affected_monitors])
        }
    }


def format_teams_payload(service_name: str, old_status: str, new_status: str,
                         affected_monitors: List[dict], all_monitors: List[dict],
                         timestamp: str) -> dict:
    """
    Format notification payload for Microsoft Teams (Adaptive Cards via Webhook).

    Returns:
        Teams Adaptive Card payload
    """
    # Determine color and title
    if new_status == "operational":
        color = "good"  # Green
        title = f"✅ {service_name} recovered"
    elif new_status == "degraded":
        color = "warning"  # Yellow
        title = f"🟡 {service_name} is DEGRADED"
    else:  # down
        color = "attention"  # Red
        title = f"🔴 {service_name} is DOWN"

    # Count operational monitors
    operational_count = sum(1 for m in all_monitors if m['status'] == 'operational')
    total_count = len(all_monitors)

    # Format affected monitors
    if affected_monitors:
        affected_text = "\n".join([
            f"- {m['name']} ({m['type']}): {m.get('error', 'failed')}"
            for m in affected_monitors
        ])
    else:
        affected_text = "All monitors recovered"

    # Teams Adaptive Card format
    return {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": "FF0000" if new_status == "down" else ("FFA500" if new_status == "degraded" else "00FF00"),
        "summary": title,
        "sections": [{
            "activityTitle": title,
            "facts": [
                {"name": "Service", "value": service_name},
                {"name": "Status", "value": f"{operational_count}/{total_count} monitors operational"},
                {"name": "Affected", "value": affected_text},
                {"name": "Time", "value": timestamp}
            ],
            "markdown": True
        }]
    }


def format_telegram_payload(service_name: str, old_status: str, new_status: str,
                            affected_monitors: List[dict], all_monitors: List[dict],
                            timestamp: str, chat_id: str) -> dict:
    """
    Format notification payload for Telegram Bot API.

    Args:
        chat_id: Telegram chat/group ID to send to
        (other args same as format_slack_payload)

    Returns:
        Telegram sendMessage payload
    """
    # Determine emoji
    if new_status == "operational":
        emoji = "✅"
        status_text = "recovered"
    elif new_status == "degraded":
        emoji = "🟡"
        status_text = "DEGRADED"
    else:  # down
        emoji = "🔴"
        status_text = "DOWN"

    # Count operational monitors
    operational_count = sum(1 for m in all_monitors if m['status'] == 'operational')
    total_count = len(all_monitors)

    # Format message with Markdown
    lines = [
        f"{emoji} *{service_name}* is {status_text}",
        "",
        f"📊 Status: {operational_count}/{total_count} monitors operational"
    ]

    if affected_monitors:
        lines.append("")
        lines.append("*Affected:*")
        for m in affected_monitors[:5]:
            error = m.get('error', 'failed')
            lines.append(f"  • {m['name']}: {error}")
        if len(affected_monitors) > 5:
            lines.append(f"  _...and {len(affected_monitors) - 5} more_")

    lines.append("")
    lines.append(f"🕐 {timestamp}")

    return {
        "chat_id": chat_id,
        "text": "\n".join(lines),
        "parse_mode": "Markdown"
    }


def format_ntfy_payload(service_name: str, old_status: str, new_status: str,
                        affected_monitors: List[dict], all_monitors: List[dict],
                        timestamp: str) -> dict:
    """
    Format notification for ntfy.sh (headers + body).

    Returns:
        Dict with 'headers' and 'body' keys for ntfy
    """
    # Determine priority and emoji
    if new_status == "operational":
        priority = "default"
        emoji = "white_check_mark"
        title = f"{service_name} recovered"
    elif new_status == "degraded":
        priority = "high"
        emoji = "warning"
        title = f"{service_name} is DEGRADED"
    else:  # down
        priority = "urgent"
        emoji = "rotating_light"
        title = f"{service_name} is DOWN"

    # Count operational monitors
    operational_count = sum(1 for m in all_monitors if m['status'] == 'operational')
    total_count = len(all_monitors)

    # Build message body
    if affected_monitors:
        affected_text = ", ".join([m['name'] for m in affected_monitors[:3]])
        if len(affected_monitors) > 3:
            affected_text += f" (+{len(affected_monitors) - 3} more)"
        body = f"Affected: {affected_text}\nStatus: {operational_count}/{total_count} operational"
    else:
        body = f"All {total_count} monitors operational"

    return {
        "_ntfy_headers": {
            "Title": title,
            "Priority": priority,
            "Tags": emoji
        },
        "_ntfy_body": body
    }


def format_matrix_payload(service_name: str, old_status: str, new_status: str,
                          affected_monitors: List[dict], all_monitors: List[dict],
                          timestamp: str) -> dict:
    """
    Format notification payload for Matrix (m.room.message).

    Returns:
        Matrix message event payload
    """
    # Determine emoji
    if new_status == "operational":
        emoji = "✅"
        status_text = "recovered"
    elif new_status == "degraded":
        emoji = "🟡"
        status_text = "DEGRADED"
    else:  # down
        emoji = "🔴"
        status_text = "DOWN"

    # Count operational monitors
    operational_count = sum(1 for m in all_monitors if m['status'] == 'operational')
    total_count = len(all_monitors)

    # Plain text version
    plain_lines = [
        f"{emoji} {service_name} is {status_text}",
        f"Status: {operational_count}/{total_count} monitors operational"
    ]

    if affected_monitors:
        plain_lines.append("Affected:")
        for m in affected_monitors[:5]:
            plain_lines.append(f"  - {m['name']}: {m.get('error', 'failed')}")

    # HTML version
    html_lines = [
        f"<h4>{emoji} {service_name} is {status_text}</h4>",
        f"<p><strong>Status:</strong> {operational_count}/{total_count} monitors operational</p>"
    ]

    if affected_monitors:
        html_lines.append("<p><strong>Affected:</strong></p><ul>")
        for m in affected_monitors[:5]:
            html_lines.append(f"<li>{m['name']}: {m.get('error', 'failed')}</li>")
        html_lines.append("</ul>")

    return {
        "msgtype": "m.text",
        "body": "\n".join(plain_lines),
        "format": "org.matrix.custom.html",
        "formatted_body": "\n".join(html_lines)
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
