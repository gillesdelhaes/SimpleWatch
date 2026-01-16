"""
AI SRE Companion API endpoints.

Phase 1: Settings and connection testing
Phase 2: Actions, analysis, and service configuration
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from api.auth import get_current_user
from database import get_db, User, AISettings, ActionLog, ServiceAIConfig, Service, Incident
from ai import get_llm, test_llm_connection, encrypt_api_key
from ai.sre_companion import SRECompanion
from models import (
    AISettingsRequest,
    AISettingsResponse,
    AIStatusResponse,
    AIActionResponse,
    AIActionApproveRequest,
    AIActionRejectRequest,
    ServiceAIConfigRequest,
    ServiceAIConfigResponse,
    PostmortemRequest,
    AIActionHistoryResponse,
)

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])


# Endpoints
@router.get("/settings", response_model=AISettingsResponse)
async def get_ai_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current AI SRE settings."""
    settings = db.query(AISettings).first()

    if not settings:
        return AISettingsResponse(
            enabled=False,
            auto_analyze_incidents=True,
            require_approval=True,
            auto_execute_enabled=False,
            auto_execute_confidence_threshold=0.95,
            prompt_via_notifications=True
        )

    return AISettingsResponse(
        enabled=settings.enabled,
        provider=settings.provider,
        endpoint=settings.endpoint,
        model_name=settings.model_name,
        has_api_key=settings.api_key_encrypted is not None,
        auto_analyze_incidents=settings.auto_analyze_incidents if settings.auto_analyze_incidents is not None else True,
        require_approval=settings.require_approval if settings.require_approval is not None else True,
        auto_execute_enabled=settings.auto_execute_enabled if settings.auto_execute_enabled is not None else False,
        auto_execute_confidence_threshold=settings.auto_execute_confidence_threshold or 0.95,
        prompt_via_notifications=settings.prompt_via_notifications if settings.prompt_via_notifications is not None else True,
        last_query_success=settings.last_query_success,
        last_query_at=settings.last_query_at,
        last_error=settings.last_error
    )


@router.put("/settings", response_model=dict)
async def update_ai_settings(
    request: AISettingsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update AI SRE settings (admin only)."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    settings = db.query(AISettings).first()

    if not settings:
        settings = AISettings()
        db.add(settings)

    settings.enabled = request.enabled
    settings.provider = request.provider
    settings.endpoint = request.endpoint
    settings.model_name = request.model_name
    settings.auto_analyze_incidents = request.auto_analyze_incidents
    settings.require_approval = request.require_approval
    settings.auto_execute_enabled = request.auto_execute_enabled
    settings.auto_execute_confidence_threshold = request.auto_execute_confidence_threshold
    settings.prompt_via_notifications = request.prompt_via_notifications
    settings.updated_at = datetime.utcnow()

    # Encrypt and store API key if provided
    if request.api_key:
        settings.api_key_encrypted = encrypt_api_key(request.api_key, db)

    db.commit()

    return {"success": True, "message": "AI settings updated"}


@router.post("/test", response_model=dict)
async def test_ai_connection_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Test connection to configured AI provider."""
    settings = db.query(AISettings).first()

    if not settings or not settings.enabled:
        raise HTTPException(status_code=400, detail="AI SRE not enabled")

    result = await test_llm_connection(settings)

    # Update status tracking
    settings.last_query_at = datetime.utcnow()
    settings.last_query_success = result["success"]
    settings.last_error = result.get("error") if not result["success"] else None
    db.commit()

    return result


@router.get("/status", response_model=AIStatusResponse)
async def get_ai_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get AI connection status for dashboard indicator."""
    settings = db.query(AISettings).first()

    if not settings:
        return AIStatusResponse(enabled=False)

    return AIStatusResponse(
        enabled=settings.enabled,
        connected=settings.last_query_success,
        last_query_at=settings.last_query_at,
        provider=settings.provider,
        model_name=settings.model_name
    )


# ========== Phase 2: Actions and Analysis ==========

@router.get("/actions", response_model=List[AIActionResponse])
async def get_pending_actions(
    service_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get pending AI actions awaiting approval."""
    companion = SRECompanion(db)
    actions = companion.get_pending_actions(service_id)
    return actions


@router.get("/actions/history", response_model=AIActionHistoryResponse)
async def get_action_history(
    service_id: Optional[int] = None,
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get AI action history with filtering and pagination."""
    companion = SRECompanion(db)
    return companion.get_action_history(
        service_id=service_id,
        status=status,
        limit=limit,
        offset=offset
    )


@router.post("/actions/{action_id}/approve")
async def approve_action(
    action_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approve and execute a pending action."""
    companion = SRECompanion(db)
    result = await companion.approve_action(action_id, current_user.id)

    # Only raise exception for action-level errors (not found, not pending)
    # Webhook failures are returned as processed but failed
    if result.get("error_type") == "action_error":
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to approve action"))

    return result


@router.post("/actions/{action_id}/reject")
async def reject_action(
    action_id: int,
    request: AIActionRejectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reject a pending action."""
    companion = SRECompanion(db)
    result = await companion.reject_action(action_id, current_user.id, request.reason)

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to reject action"))

    return result


@router.post("/analyze/{incident_id}")
async def analyze_incident(
    incident_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually trigger AI analysis for an incident."""
    companion = SRECompanion(db)

    if not companion.is_enabled():
        raise HTTPException(status_code=400, detail="AI SRE not enabled")

    result = await companion.analyze_incident(incident_id)

    if not result:
        raise HTTPException(status_code=500, detail="Analysis failed - check AI settings and logs")

    return {
        "success": True,
        "action_log_id": result["action_log_id"],
        "recommendation": result["recommendation"]
    }


@router.post("/postmortem")
async def generate_postmortem(
    request: PostmortemRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a post-mortem report for an incident or time period."""
    companion = SRECompanion(db)

    if not companion.is_enabled():
        raise HTTPException(status_code=400, detail="AI SRE not enabled")

    # Single incident mode
    if request.incident_id:
        incident = db.query(Incident).filter(Incident.id == request.incident_id).first()
        if not incident:
            raise HTTPException(status_code=404, detail="Incident not found")

        report = await companion.generate_single_incident_postmortem(incident)
        if not report:
            raise HTTPException(status_code=500, detail="Failed to generate post-mortem")
        return {"success": True, "report": report}

    # Date range mode
    if not request.service_id or not request.start_date or not request.end_date:
        raise HTTPException(status_code=400, detail="Either incident_id or service_id with date range required")

    try:
        start_date = datetime.fromisoformat(request.start_date)
        end_date = datetime.fromisoformat(request.end_date)
        # If end_date is just a date (no time), make it end of day
        if end_date.hour == 0 and end_date.minute == 0 and end_date.second == 0:
            end_date = end_date.replace(hour=23, minute=59, second=59)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use ISO format (YYYY-MM-DD)")

    report = await companion.generate_postmortem(request.service_id, start_date, end_date)

    if not report:
        raise HTTPException(status_code=500, detail="Failed to generate post-mortem")

    return {"success": True, "report": report}


# ========== Service AI Configuration ==========

@router.get("/services/{service_id}/config", response_model=ServiceAIConfigResponse)
async def get_service_ai_config(
    service_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get AI configuration for a service."""
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    config = db.query(ServiceAIConfig).filter(ServiceAIConfig.service_id == service_id).first()

    if not config:
        return ServiceAIConfigResponse(service_id=service_id)

    return ServiceAIConfigResponse(
        service_id=service_id,
        remediation_webhooks=config.remediation_webhooks,
        service_context=config.service_context,
        known_issues=config.known_issues,
        auto_execute_enabled=config.auto_execute_enabled
    )


@router.put("/services/{service_id}/config")
async def update_service_ai_config(
    service_id: int,
    request: ServiceAIConfigRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update AI configuration for a service."""
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    config = db.query(ServiceAIConfig).filter(ServiceAIConfig.service_id == service_id).first()

    if not config:
        config = ServiceAIConfig(service_id=service_id)
        db.add(config)

    if request.remediation_webhooks is not None:
        config.remediation_webhooks = request.remediation_webhooks
    if request.service_context is not None:
        config.service_context = request.service_context
    if request.known_issues is not None:
        config.known_issues = request.known_issues
    if request.auto_execute_enabled is not None:
        config.auto_execute_enabled = request.auto_execute_enabled

    config.updated_at = datetime.utcnow()
    db.commit()

    return {"success": True, "message": "Service AI config updated"}
