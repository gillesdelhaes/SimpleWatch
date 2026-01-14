"""
SRE Companion - AI-powered incident analysis and remediation suggestions.
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session

from database import (
    Service, Monitor, StatusUpdate, Incident,
    AISettings, ActionLog, ServiceAIConfig
)
from ai import get_llm, decrypt_api_key
from ai.prompts import SRE_ANALYSIS_PROMPT, POSTMORTEM_PROMPT

logger = logging.getLogger(__name__)


class SRECompanion:
    """AI-powered SRE companion for incident analysis and remediation."""

    def __init__(self, db: Session):
        self.db = db
        self.settings = db.query(AISettings).first()

    def is_enabled(self) -> bool:
        """Check if AI SRE is enabled and configured."""
        return self.settings is not None and self.settings.enabled

    async def analyze_incident(self, incident_id: int) -> Optional[Dict[str, Any]]:
        """
        Analyze an incident and generate a recommendation.

        Returns:
            Dict with recommendation details or None if analysis fails.
        """
        if not self.is_enabled():
            logger.debug("AI SRE not enabled, skipping analysis")
            return None

        incident = self.db.query(Incident).filter(Incident.id == incident_id).first()
        if not incident:
            logger.error(f"Incident {incident_id} not found")
            return None

        try:
            # Gather context for the AI
            context = self._gather_incident_context(incident)

            # Get AI recommendation
            recommendation = await self._get_ai_recommendation(context)

            if recommendation:
                # Create action log entry
                action_log = self._create_action_log(incident, recommendation)

                # Update AI settings with success
                self.settings.last_query_at = datetime.utcnow()
                self.settings.last_query_success = True
                self.settings.last_error = None
                self.db.commit()

                return {
                    "action_log_id": action_log.id,
                    "recommendation": recommendation
                }

            return None

        except Exception as e:
            logger.error(f"Error analyzing incident {incident_id}: {e}")
            # Update AI settings with failure
            if self.settings:
                self.settings.last_query_at = datetime.utcnow()
                self.settings.last_query_success = False
                self.settings.last_error = str(e)
                self.db.commit()
            return None

    def _gather_incident_context(self, incident: Incident) -> Dict[str, Any]:
        """Gather all relevant context for AI analysis."""
        service = incident.service

        # Get service AI config if exists
        ai_config = self.db.query(ServiceAIConfig).filter(
            ServiceAIConfig.service_id == service.id
        ).first()

        # Get affected monitors
        affected_monitor_ids = []
        if incident.affected_monitors_json:
            try:
                affected_monitor_ids = json.loads(incident.affected_monitors_json)
            except json.JSONDecodeError:
                pass

        affected_monitors = []
        if affected_monitor_ids:
            monitors = self.db.query(Monitor).filter(
                Monitor.id.in_(affected_monitor_ids)
            ).all()
            for m in monitors:
                config = json.loads(m.config_json) if m.config_json else {}
                affected_monitors.append({
                    "id": m.id,
                    "type": m.monitor_type,
                    "config": config
                })

        # Get recent status updates (last 24 hours)
        yesterday = datetime.utcnow() - timedelta(hours=24)
        recent_updates = self.db.query(StatusUpdate).filter(
            StatusUpdate.service_id == service.id,
            StatusUpdate.timestamp >= yesterday
        ).order_by(StatusUpdate.timestamp.desc()).limit(50).all()

        updates_text = []
        for update in recent_updates:
            metadata = {}
            if update.metadata_json:
                try:
                    metadata = json.loads(update.metadata_json)
                except json.JSONDecodeError:
                    pass

            reason = metadata.get("reason", "")
            updates_text.append(
                f"- {update.timestamp.isoformat()}: {update.status}"
                f"{f' - {reason}' if reason else ''}"
                f"{f' ({update.response_time_ms}ms)' if update.response_time_ms else ''}"
            )

        # Get past incidents for pattern recognition (last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        past_incidents = self.db.query(Incident).filter(
            Incident.service_id == service.id,
            Incident.id != incident.id,
            Incident.started_at >= thirty_days_ago
        ).order_by(Incident.started_at.desc()).limit(10).all()

        past_incidents_text = []
        for pi in past_incidents:
            duration = f"{pi.duration_seconds}s" if pi.duration_seconds else "ongoing"
            past_incidents_text.append(
                f"- {pi.started_at.isoformat()}: {pi.severity} for {duration}"
            )

        # Format available webhooks
        webhooks_text = "No remediation webhooks configured."
        if ai_config and ai_config.remediation_webhooks:
            webhooks = ai_config.remediation_webhooks
            if webhooks:
                webhooks_text = "\n".join([
                    f"- {w.get('name', 'Unnamed')}: {w.get('url', 'No URL')} ({w.get('method', 'POST')})"
                    for w in webhooks
                ])

        return {
            "service_name": service.name,
            "service_description": service.description or "No description",
            "service_context": ai_config.service_context if ai_config else "No additional context",
            "known_issues": ai_config.known_issues if ai_config else "No known issues documented",
            "incident_severity": incident.severity,
            "incident_started": incident.started_at.isoformat(),
            "affected_monitors": json.dumps(affected_monitors, indent=2),
            "recent_updates": "\n".join(updates_text) if updates_text else "No recent updates",
            "past_incidents": "\n".join(past_incidents_text) if past_incidents_text else "No past incidents",
            "available_webhooks": webhooks_text
        }

    async def _get_ai_recommendation(self, context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Get recommendation from the LLM."""
        try:
            llm = get_llm(self.settings)
            if not llm:
                logger.error("Failed to initialize LLM")
                return None

            # Format the prompt
            prompt = SRE_ANALYSIS_PROMPT.format(**context)

            # Invoke LLM
            if hasattr(llm, 'invoke'):
                response = llm.invoke(prompt)
                # Handle different response types
                if hasattr(response, 'content'):
                    response_text = response.content
                else:
                    response_text = str(response)
            else:
                response_text = llm(prompt)

            # Parse JSON response
            # Try to extract JSON from the response
            response_text = response_text.strip()

            # Handle markdown code blocks
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]

            recommendation = json.loads(response_text.strip())

            # Validate required fields
            required_fields = ["action_type", "action", "reasoning", "confidence", "root_cause"]
            for field in required_fields:
                if field not in recommendation:
                    logger.error(f"Missing required field in recommendation: {field}")
                    return None

            return recommendation

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
            return None
        except Exception as e:
            logger.error(f"Error getting AI recommendation: {e}")
            raise

    def _create_action_log(self, incident: Incident, recommendation: Dict[str, Any]) -> ActionLog:
        """Create an action log entry for the recommendation."""
        action = recommendation.get("action", {})

        # Determine initial status based on action type and settings
        action_type = recommendation.get("action_type", "suggest_only")

        if action_type == "auto_execute":
            # Check if auto-execute is allowed
            service_config = self.db.query(ServiceAIConfig).filter(
                ServiceAIConfig.service_id == incident.service_id
            ).first()

            auto_execute_allowed = self.settings.auto_execute_enabled
            if service_config and service_config.auto_execute_enabled is not None:
                auto_execute_allowed = service_config.auto_execute_enabled

            confidence = recommendation.get("confidence", 0)
            threshold = self.settings.auto_execute_confidence_threshold or 0.95

            if (auto_execute_allowed and
                confidence >= threshold and
                not self.settings.require_approval):
                initial_status = "pending_execution"
            else:
                # Downgrade to prompt_user if conditions not met
                initial_status = "pending"
        else:
            initial_status = "pending"

        action_log = ActionLog(
            service_id=incident.service_id,
            incident_id=incident.id,
            action_type=action.get("webhook") is not None and "webhook" or "suggestion",
            action_description=action.get("description", "No description"),
            action_config={
                "name": action.get("name"),
                "webhook": action.get("webhook"),
                "alternatives": recommendation.get("alternatives", [])
            },
            ai_reasoning=recommendation.get("reasoning"),
            confidence_score=recommendation.get("confidence"),
            status=initial_status,
            created_at=datetime.utcnow()
        )

        self.db.add(action_log)
        self.db.commit()
        self.db.refresh(action_log)

        return action_log

    async def approve_action(self, action_log_id: int, user_id: int) -> Dict[str, Any]:
        """Approve and execute a pending action."""
        action_log = self.db.query(ActionLog).filter(ActionLog.id == action_log_id).first()

        if not action_log:
            return {"success": False, "error": "Action not found"}

        if action_log.status != "pending":
            return {"success": False, "error": f"Action is not pending (status: {action_log.status})"}

        # Execute the action
        result = await self._execute_action(action_log)

        action_log.status = "executed" if result["success"] else "failed"
        action_log.executed_at = datetime.utcnow()
        action_log.executed_by = f"user:{user_id}"
        action_log.result = result

        self.db.commit()

        return result

    async def reject_action(self, action_log_id: int, user_id: int, reason: str = None) -> Dict[str, Any]:
        """Reject a pending action."""
        action_log = self.db.query(ActionLog).filter(ActionLog.id == action_log_id).first()

        if not action_log:
            return {"success": False, "error": "Action not found"}

        if action_log.status != "pending":
            return {"success": False, "error": f"Action is not pending (status: {action_log.status})"}

        action_log.status = "rejected"
        action_log.executed_at = datetime.utcnow()
        action_log.executed_by = f"user:{user_id}"
        action_log.result = {"reason": reason} if reason else None

        self.db.commit()

        return {"success": True, "message": "Action rejected"}

    async def _execute_action(self, action_log: ActionLog) -> Dict[str, Any]:
        """Execute the action (webhook call)."""
        import httpx

        config = action_log.action_config or {}
        webhook = config.get("webhook")

        if not webhook:
            return {"success": True, "message": "No webhook to execute - suggestion only"}

        try:
            url = webhook.get("url")
            method = webhook.get("method", "POST").upper()
            payload = webhook.get("payload", {})

            async with httpx.AsyncClient(timeout=30.0) as client:
                if method == "GET":
                    response = await client.get(url)
                elif method == "POST":
                    response = await client.post(url, json=payload)
                elif method == "PUT":
                    response = await client.put(url, json=payload)
                elif method == "DELETE":
                    response = await client.delete(url)
                else:
                    return {"success": False, "error": f"Unsupported HTTP method: {method}"}

                return {
                    "success": response.status_code < 400,
                    "status_code": response.status_code,
                    "response": response.text[:1000] if response.text else None
                }

        except httpx.TimeoutException:
            return {"success": False, "error": "Webhook request timed out"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_pending_actions(self, service_id: int = None) -> List[Dict[str, Any]]:
        """Get all pending actions, optionally filtered by service."""
        query = self.db.query(ActionLog).filter(ActionLog.status == "pending")

        if service_id:
            query = query.filter(ActionLog.service_id == service_id)

        actions = query.order_by(ActionLog.created_at.desc()).all()

        result = []
        for action in actions:
            service = self.db.query(Service).filter(Service.id == action.service_id).first()
            result.append({
                "id": action.id,
                "service_id": action.service_id,
                "service_name": service.name if service else "Unknown",
                "incident_id": action.incident_id,
                "action_type": action.action_type,
                "description": action.action_description,
                "reasoning": action.ai_reasoning,
                "confidence": action.confidence_score,
                "config": action.action_config,
                "created_at": action.created_at.isoformat() if action.created_at else None
            })

        return result

    async def generate_postmortem(
        self,
        service_id: int,
        start_date: datetime,
        end_date: datetime
    ) -> Optional[str]:
        """Generate a post-mortem report for incidents in a time period."""
        if not self.is_enabled():
            return None

        service = self.db.query(Service).filter(Service.id == service_id).first()
        if not service:
            return None

        # Get incidents in the time period
        incidents = self.db.query(Incident).filter(
            Incident.service_id == service_id,
            Incident.started_at >= start_date,
            Incident.started_at <= end_date
        ).order_by(Incident.started_at).all()

        if not incidents:
            return "No incidents found in the specified time period."

        # Build timeline
        timeline_entries = []
        for incident in incidents:
            # Get status updates during this incident
            updates = self.db.query(StatusUpdate).filter(
                StatusUpdate.service_id == service_id,
                StatusUpdate.timestamp >= incident.started_at,
                StatusUpdate.timestamp <= (incident.ended_at or datetime.utcnow())
            ).order_by(StatusUpdate.timestamp).all()

            timeline_entries.append(f"### Incident started: {incident.started_at.isoformat()}")
            timeline_entries.append(f"- Severity: {incident.severity}")

            for update in updates[:10]:  # Limit to 10 updates per incident
                metadata = {}
                if update.metadata_json:
                    try:
                        metadata = json.loads(update.metadata_json)
                    except json.JSONDecodeError:
                        pass
                reason = metadata.get("reason", "")
                timeline_entries.append(
                    f"- {update.timestamp.strftime('%H:%M:%S')}: {update.status}"
                    f"{f' - {reason}' if reason else ''}"
                )

            if incident.ended_at:
                timeline_entries.append(f"### Incident resolved: {incident.ended_at.isoformat()}")
                timeline_entries.append(f"- Duration: {incident.duration_seconds}s")

        # Format context for LLM
        context = {
            "service_name": service.name,
            "start_date": start_date.strftime("%Y-%m-%d"),
            "end_date": end_date.strftime("%Y-%m-%d"),
            "incident_count": len(incidents),
            "timeline": "\n".join(timeline_entries)
        }

        try:
            llm = get_llm(self.settings)
            if not llm:
                return None

            prompt = POSTMORTEM_PROMPT.format(**context)

            if hasattr(llm, 'invoke'):
                response = llm.invoke(prompt)
                if hasattr(response, 'content'):
                    return response.content
                return str(response)
            else:
                return llm(prompt)

        except Exception as e:
            logger.error(f"Error generating postmortem: {e}")
            return None
