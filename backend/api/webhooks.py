"""
Webhook management API endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, Webhook
from models import WebhookCreate, WebhookResponse
from api.auth import get_current_user
from typing import List
import json

router = APIRouter(prefix="/api/v1/webhooks", tags=["webhooks"])


@router.get("", response_model=List[WebhookResponse])
def list_webhooks(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """List all webhooks for current user."""
    webhooks = db.query(Webhook).filter(Webhook.user_id == current_user.id).all()

    result = []
    for webhook in webhooks:
        result.append(WebhookResponse(
            id=webhook.id,
            url=webhook.url,
            event_types=webhook.event_types,
            is_active=webhook.is_active,
            secret_token=webhook.secret_token
        ))

    return result


@router.post("", response_model=WebhookResponse)
def create_webhook(
    webhook: WebhookCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create a new webhook."""
    new_webhook = Webhook(
        user_id=current_user.id,
        url=webhook.url,
        event_types=json.dumps(webhook.event_types),
        secret_token=webhook.secret_token,
        is_active=True
    )
    db.add(new_webhook)
    db.commit()
    db.refresh(new_webhook)

    return WebhookResponse(
        id=new_webhook.id,
        url=new_webhook.url,
        event_types=new_webhook.event_types,
        is_active=new_webhook.is_active,
        secret_token=new_webhook.secret_token
    )


@router.delete("/{webhook_id}")
def delete_webhook(
    webhook_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete a webhook."""
    webhook = db.query(Webhook).filter(
        Webhook.id == webhook_id,
        Webhook.user_id == current_user.id
    ).first()

    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    db.delete(webhook)
    db.commit()

    return {"success": True, "message": "Webhook deleted"}


@router.put("/{webhook_id}/toggle")
def toggle_webhook(
    webhook_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Toggle webhook active status."""
    webhook = db.query(Webhook).filter(
        Webhook.id == webhook_id,
        Webhook.user_id == current_user.id
    ).first()

    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    webhook.is_active = not webhook.is_active
    db.commit()

    return {"success": True, "is_active": webhook.is_active}
