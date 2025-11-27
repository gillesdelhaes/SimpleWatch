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


class MetricUpdateRequest(BaseModel):
    api_key: str
    value: float


class MetricUpdateResponse(BaseModel):
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


class MonitorCreate(BaseModel):
    service_id: int
    monitor_type: str = Field(..., pattern="^(website|api|metric_threshold|port)$")
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


class WebhookCreate(BaseModel):
    url: str
    event_types: List[str]
    secret_token: Optional[str] = None


class WebhookResponse(BaseModel):
    id: int
    url: str
    event_types: str
    is_active: bool
    secret_token: Optional[str]

    class Config:
        from_attributes = True


class DashboardLayoutUpdate(BaseModel):
    layout_json: str


class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    error_code: str
