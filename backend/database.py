"""
Database initialization and configuration for SimpleWatch.
"""
import os
from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, TIMESTAMP, ForeignKey, JSON, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

DATABASE_PATH = "/data/simplewatch.db"
SQLALCHEMY_DATABASE_URL = f"sqlite:////{DATABASE_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    email = Column(String(255))
    api_key = Column(String(64), unique=True, nullable=False, index=True)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    is_admin = Column(Boolean, default=False)

    services = relationship("Service", back_populates="owner")
    dashboard_layouts = relationship("DashboardLayout", back_populates="user")
    monitors = relationship("Monitor", back_populates="creator")
    notification_channels = relationship("NotificationChannel", back_populates="user")


class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text)
    category = Column(String(255))
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.id"))
    is_active = Column(Boolean, default=True)
    show_on_status_page = Column(Boolean, default=False)

    # Cached uptime data (updated by background job every 5 minutes)
    cached_uptime_percentage = Column(Integer)  # e.g., 99.5
    cached_uptime_period_days = Column(Integer)  # e.g., 365
    cached_uptime_period_label = Column(String(10))  # e.g., "1y" or "90d"
    cached_uptime_updated_at = Column(TIMESTAMP)  # Last cache update time

    # SLA configuration and cached metrics
    sla_target = Column(Float)  # e.g., 99.9 (nullable - only set if SLA configured)
    sla_timeframe_days = Column(Integer)  # e.g., 30 (nullable - only set if SLA configured)
    cached_sla_percentage = Column(Float)  # Actual uptime for SLA period
    cached_sla_status = Column(String(20))  # 'ok', 'at_risk', 'breached'
    cached_sla_error_budget_seconds = Column(Integer)  # Remaining error budget
    cached_sla_updated_at = Column(TIMESTAMP)  # Last cache update time

    owner = relationship("User", back_populates="services")
    status_updates = relationship("StatusUpdate", back_populates="service", cascade="all, delete-orphan")
    monitors = relationship("Monitor", back_populates="service", cascade="all, delete-orphan")
    incidents = relationship("Incident", back_populates="service", cascade="all, delete-orphan")
    maintenance_windows = relationship("MaintenanceWindow", back_populates="service", cascade="all, delete-orphan")


class StatusUpdate(Base):
    __tablename__ = "status_updates"

    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id", ondelete="CASCADE"), index=True)
    monitor_id = Column(Integer, ForeignKey("monitors.id", ondelete="CASCADE"), index=True, nullable=True)
    status = Column(String(50), nullable=False)
    timestamp = Column(TIMESTAMP, default=datetime.utcnow, index=True)
    response_time_ms = Column(Integer)
    metadata_json = Column(Text)

    service = relationship("Service", back_populates="status_updates")
    monitor = relationship("Monitor")


class DashboardLayout(Base):
    __tablename__ = "dashboard_layouts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    layout_json = Column(Text)
    updated_at = Column(TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="dashboard_layouts")


class Monitor(Base):
    __tablename__ = "monitors"

    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id", ondelete="CASCADE"), index=True)
    monitor_type = Column(String(50), nullable=False)
    config_json = Column(Text, nullable=False)
    check_interval_minutes = Column(Integer, default=5)
    is_active = Column(Boolean, default=True)
    last_check_at = Column(TIMESTAMP)
    next_check_at = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.id"))

    service = relationship("Service", back_populates="monitors")
    creator = relationship("User", back_populates="monitors")


class SMTPConfig(Base):
    __tablename__ = "smtp_config"

    id = Column(Integer, primary_key=True, index=True)
    host = Column(String(255), nullable=False)
    port = Column(Integer, nullable=False, default=587)
    username = Column(String(255), nullable=False)
    password_encrypted = Column(Text, nullable=False)
    from_address = Column(String(255), nullable=False)
    use_tls = Column(Boolean, nullable=False, default=True)
    is_tested = Column(Boolean, nullable=False, default=False)
    tested_at = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class NotificationChannel(Base):
    __tablename__ = "notification_channels"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    label = Column(String(255), nullable=False)
    channel_type = Column(String(50), nullable=False)  # 'slack', 'discord', 'generic'
    webhook_url = Column(Text, nullable=False)
    secret_token = Column(String(255))
    custom_payload_template = Column(Text)
    is_active = Column(Boolean, nullable=False, default=True)
    is_tested = Column(Boolean, nullable=False, default=False)
    tested_at = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="notification_channels")


class ServiceNotificationSettings(Base):
    __tablename__ = "service_notification_settings"

    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    enabled = Column(Boolean, nullable=False, default=True)
    email_enabled = Column(Boolean, nullable=False, default=False)
    email_recipients = Column(Text)  # Comma-separated
    channel_ids = Column(Text)  # JSON array
    cooldown_minutes = Column(Integer, nullable=False, default=5)
    notify_on_recovery = Column(Boolean, nullable=False, default=True)
    last_notification_sent_at = Column(TIMESTAMP)
    last_notified_status = Column(String(50))
    created_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class NotificationLog(Base):
    __tablename__ = "notification_log"

    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id", ondelete="CASCADE"), nullable=False, index=True)
    notification_type = Column(String(50), nullable=False)  # 'email' or 'webhook'
    channel_id = Column(Integer, ForeignKey("notification_channels.id", ondelete="SET NULL"))
    channel_label = Column(String(255))
    status_change = Column(String(100), nullable=False)  # "operational -> down"
    delivery_status = Column(String(50), nullable=False)  # 'sent', 'failed'
    error_message = Column(Text)
    sent_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow)


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id", ondelete="CASCADE"), nullable=False, index=True)

    # Incident timeline
    started_at = Column(TIMESTAMP, nullable=False, index=True)
    ended_at = Column(TIMESTAMP, nullable=True)  # NULL = ongoing incident
    duration_seconds = Column(Integer, nullable=True)  # Calculated when ended_at is set

    # Severity and status
    severity = Column(String(50), nullable=False)  # "degraded" or "down"
    status = Column(String(50), nullable=False, default="ongoing")  # "ongoing" or "resolved"

    # Affected monitors (JSON array of monitor IDs that were failing)
    affected_monitors_json = Column(Text, nullable=True)  # JSON: [1, 2, 3]

    # Metadata
    recovery_metadata_json = Column(Text, nullable=True)  # JSON: {"trigger": "manual" | "auto", "note": "..."}

    # Relationships
    service = relationship("Service", back_populates="incidents")


class MaintenanceWindow(Base):
    __tablename__ = "maintenance_windows"

    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id", ondelete="CASCADE"), nullable=False, index=True)

    # Time window
    start_time = Column(TIMESTAMP, nullable=False, index=True)
    end_time = Column(TIMESTAMP, nullable=False)

    # Recurrence settings
    # Types: 'none', 'daily', 'weekly', 'monthly', 'monthly_weekday'
    recurrence_type = Column(String(50), nullable=False, default="none")
    # JSON config for recurrence details:
    # - weekly: {"days": [0, 2, 4]} (Mon, Wed, Fri - 0=Monday)
    # - monthly: {"day": 15} or {"day": -1} for last day
    # - monthly_weekday: {"week": 2, "day": 6} (2nd Sunday - week 1-4 or -1 for last, day 0-6)
    recurrence_config = Column(Text)

    # Optional description
    reason = Column(String(500))

    # Status: 'scheduled', 'active', 'completed', 'cancelled'
    status = Column(String(50), nullable=False, default="scheduled", index=True)

    # Metadata
    created_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.id"))
    updated_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    service = relationship("Service", back_populates="maintenance_windows")
    creator = relationship("User")


class EncryptionKey(Base):
    __tablename__ = "encryption_key"

    id = Column(Integer, primary_key=True, index=True)
    key_value = Column(String(255), nullable=False)  # Base64-encoded Fernet key
    created_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow)


class AppSettings(Base):
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(255), unique=True, nullable=False, index=True)
    value = Column(String(255), nullable=True)


class AISettings(Base):
    """AI SRE Companion configuration"""
    __tablename__ = "ai_settings"

    id = Column(Integer, primary_key=True, index=True)
    enabled = Column(Boolean, default=False)

    # LLM Provider
    provider = Column(String(50))  # 'local', 'openai', 'anthropic'
    endpoint = Column(String(500))  # For local models (Ollama URL)
    model_name = Column(String(100))  # 'gpt-4o', 'claude-sonnet-4-20250514', 'llama3.2'
    api_key_encrypted = Column(Text)  # Encrypted API key

    # Behavior settings - SAFE BY DEFAULT
    auto_analyze_incidents = Column(Boolean, default=True)  # Auto-analyze when incidents occur (default: ON)
    require_approval = Column(Boolean, default=True)  # Always require human approval (default: ON)
    auto_execute_enabled = Column(Boolean, default=False)  # Skip approval for high-confidence (default: OFF)
    auto_execute_confidence_threshold = Column(Float, default=0.95)  # Very high threshold when enabled

    # Status tracking (for indicator)
    last_query_success = Column(Boolean)  # True if last LLM query succeeded
    last_query_at = Column(TIMESTAMP)  # When last query was made
    last_error = Column(Text)  # Last error message if failed

    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)


class ActionLog(Base):
    """Audit log for AI-suggested and executed actions"""
    __tablename__ = "action_log"

    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey('services.id', ondelete="CASCADE"), index=True)
    incident_id = Column(Integer, ForeignKey('incidents.id', ondelete="SET NULL"), nullable=True)

    # Action details
    action_type = Column(String(50))  # 'webhook', 'suggestion', 'postmortem'
    action_description = Column(Text)  # Human-readable description
    action_config = Column(JSON)  # Webhook URL, payload, etc.

    # AI decision
    ai_reasoning = Column(Text)  # Why AI suggested this action
    confidence_score = Column(Float)

    # Execution status
    status = Column(String(50), default='pending')  # 'pending', 'approved', 'rejected', 'executed', 'failed', 'expired'
    executed_at = Column(TIMESTAMP, nullable=True)
    executed_by = Column(String(100))  # 'auto', 'user:{id}', 'timeout'
    result = Column(JSON, nullable=True)  # Webhook response, etc.

    created_at = Column(TIMESTAMP, default=datetime.utcnow)

    # Relationships
    service = relationship("Service")
    incident = relationship("Incident")


class ServiceAIConfig(Base):
    """Per-service AI configuration and remediation webhooks"""
    __tablename__ = "service_ai_config"

    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey('services.id', ondelete="CASCADE"), unique=True, index=True)

    # Remediation webhooks for this service
    # Format: [{"name": "Restart", "url": "...", "method": "POST", "payload": {...}}]
    remediation_webhooks = Column(JSON)

    # Context for AI to understand the service better
    service_context = Column(Text)  # "This is a Node.js API running on AWS ECS..."
    known_issues = Column(Text)  # "Sometimes needs restart after memory spike"

    # Behavior overrides (null = use global settings)
    auto_execute_enabled = Column(Boolean, nullable=True)

    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    service = relationship("Service")


def init_db():
    """Initialize database and create all tables."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
