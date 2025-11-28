"""
Database initialization and configuration for SimpleWatch.
"""
import os
from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, TIMESTAMP, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

DATABASE_PATH = os.getenv("DATABASE_PATH", "/data/simplewatch.db")
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

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
    webhooks = relationship("Webhook", back_populates="user")
    monitors = relationship("Monitor", back_populates="creator")


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
    status_updates = relationship("StatusUpdate", back_populates="service")
    incidents = relationship("Incident", back_populates="service")
    monitors = relationship("Monitor", back_populates="service")


class StatusUpdate(Base):
    __tablename__ = "status_updates"

    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id"), index=True)
    monitor_id = Column(Integer, ForeignKey("monitors.id"), index=True, nullable=True)
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


class Webhook(Base):
    __tablename__ = "webhooks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    url = Column(Text, nullable=False)
    event_types = Column(Text)
    is_active = Column(Boolean, default=True)
    secret_token = Column(String(255))

    user = relationship("User", back_populates="webhooks")


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id"), index=True)
    started_at = Column(TIMESTAMP, default=datetime.utcnow)
    resolved_at = Column(TIMESTAMP)
    severity = Column(String(50))
    description = Column(Text)

    service = relationship("Service", back_populates="incidents")


class Monitor(Base):
    __tablename__ = "monitors"

    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id"), index=True)
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
