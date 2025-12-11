"""
Pydantic models for API request/response validation.
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime


class StatusUpdateRequest(BaseModel):
    api_key: str
    service: str
    status: str = Field(..., pattern="^(operational|degraded|down|maintenance|unknown)$")
    timestamp: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None


class StatusUpdateResponse(BaseModel):
    success: bool
    message: str
    service: str


class BulkStatusUpdate(BaseModel):
    service: str
    status: str
    metadata: Optional[Dict[str, Any]] = None


class BulkStatusUpdateRequest(BaseModel):
    api_key: str
    updates: List[BulkStatusUpdate]


class HeartbeatRequest(BaseModel):
    """Heartbeat ping request for deadman monitors."""
    api_key: str


class MetricUpdateRequest(BaseModel):
    """Metric value update request for threshold monitors."""
    api_key: str
    value: float


class MetricUpdateResponse(BaseModel):
    """Metric update response."""
    success: bool
    service: str
    value: float
    status: str
    reason: str


class ServiceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None


class ServiceResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    category: Optional[str]
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class StatusResponse(BaseModel):
    service: str
    status: str
    timestamp: datetime
    response_time_ms: Optional[int]
    metadata: Optional[Dict[str, Any]]


class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    is_admin: bool = False


class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str]
    api_key: str
    created_at: datetime
    is_admin: bool

    class Config:
        from_attributes = True


class PasswordChangeRequest(BaseModel):
    current_password: Optional[str] = None  # Required when changing own password
    new_password: str = Field(..., min_length=8)


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    username: str
    is_admin: bool


class MonitorConfig(BaseModel):
    """Base monitor configuration."""
    pass


class WebsiteMonitorConfig(MonitorConfig):
    url: str
    timeout_seconds: int = 10
    follow_redirects: bool = True
    verify_ssl: bool = True


class APIMonitorConfig(MonitorConfig):
    url: str
    method: str = Field(..., pattern="^(GET|POST)$")
    headers: Optional[Dict[str, str]] = None
    expected_status_code: int = 200
    json_path_validations: Optional[Dict[str, Any]] = None
    timeout_seconds: int = 10


class MetricThresholdMonitorConfig(MonitorConfig):
    warning_threshold: float
    critical_threshold: float
    comparison: str = Field(default="greater", pattern="^(greater|less)$")


class PortMonitorConfig(MonitorConfig):
    host: str
    port: int
    timeout_seconds: int = 5


class DeadmanMonitorConfig(MonitorConfig):
    expected_interval_hours: float
    grace_period_hours: float


class MonitorCreate(BaseModel):
    service_id: int
    monitor_type: str  # Validated by frontend registry and scheduler
    config: Dict[str, Any]
    check_interval_minutes: int = 5


class MonitorUpdate(BaseModel):
    config: Optional[Dict[str, Any]] = None
    check_interval_minutes: Optional[int] = None
    is_active: Optional[bool] = None


class MonitorResponse(BaseModel):
    id: int
    service_id: int
    monitor_type: str
    config: Dict[str, Any]
    check_interval_minutes: int
    is_active: bool
    last_check_at: Optional[datetime]
    next_check_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class DashboardLayoutUpdate(BaseModel):
    layout_json: str


# ============================================
# Notification Models
# ============================================

class SMTPConfigBase(BaseModel):
    host: str
    port: int = 587
    username: str
    from_address: str
    use_tls: bool = True


class SMTPConfigCreate(SMTPConfigBase):
    password: str  # Plain text, will be encrypted


class SMTPConfigUpdate(SMTPConfigBase):
    password: Optional[str] = None  # Only if changing


class SMTPConfigResponse(SMTPConfigBase):
    id: int
    is_tested: bool
    tested_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class NotificationChannelBase(BaseModel):
    label: str
    channel_type: str  # 'slack', 'discord', 'generic'
    webhook_url: str
    secret_token: Optional[str] = None
    custom_payload_template: Optional[str] = None


class NotificationChannelCreate(NotificationChannelBase):
    pass


class NotificationChannelUpdate(NotificationChannelBase):
    pass


class NotificationChannelResponse(NotificationChannelBase):
    id: int
    user_id: int
    is_active: bool
    is_tested: bool
    tested_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ServiceNotificationSettingsBase(BaseModel):
    enabled: bool = True
    email_enabled: bool = False
    email_recipients: Optional[str] = None
    channel_ids: Optional[str] = None  # JSON array string
    cooldown_minutes: int = 5
    notify_on_recovery: bool = True


class ServiceNotificationSettingsUpdate(ServiceNotificationSettingsBase):
    pass


class ServiceNotificationSettingsResponse(ServiceNotificationSettingsBase):
    id: int
    service_id: int
    last_notification_sent_at: Optional[datetime] = None
    last_notified_status: Optional[str] = None

    class Config:
        from_attributes = True


class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    error_code: str
