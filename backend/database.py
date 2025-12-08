"""
Database initialization and configuration for SimpleWatch.
"""
import os
from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, TIMESTAMP, ForeignKey, JSON
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

    owner = relationship("User", back_populates="services")
    status_updates = relationship("StatusUpdate", back_populates="service", cascade="all, delete-orphan")
    monitors = relationship("Monitor", back_populates="service", cascade="all, delete-orphan")


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
