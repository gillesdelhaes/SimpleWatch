# SimpleWatch API Documentation

Complete API reference for integrating with SimpleWatch.

## Base URL

```
http://localhost:5050/api/v1
```

## Authentication

SimpleWatch supports two authentication methods:

### 1. JWT Token (for web UI and general API access)

Include Bearer token in Authorization header:

```
Authorization: Bearer your_jwt_token
```

Obtain token via `/api/v1/auth/login` endpoint.

### 2. API Key (for metric and heartbeat endpoints only)

Include your API key in request body for metric and heartbeat endpoints:

```json
{
  "api_key": "your_api_key_here"
}
```

Get your API key from Settings page in the web interface.

**Note:** Dashboard status endpoints (`/status/all`, `/status/{service_name}`) require JWT authentication only.

## Status Values

All services support these status values:

- `operational` - Service working normally
- `degraded` - Service has issues but functional
- `down` - Service not available
- `maintenance` - Planned maintenance
- `unknown` - Status cannot be determined

## Endpoints

### Authentication

#### POST /api/v1/auth/login

Authenticate and receive JWT token.

**Request:**
```json
{
  "username": "admin",
  "password": "changeme"
}
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "username": "admin",
  "is_admin": true
}
```

---

### Dashboard / Status Queries

#### GET /api/v1/status/{service_name}

Get current status for a specific service.

**Requires:** JWT authentication

**Response:**
```json
{
  "service": "payment_gateway",
  "status": "operational",
  "timestamp": "2025-01-15T10:30:00Z",
  "response_time_ms": 145,
  "metadata": {
    "message": "All systems running"
  }
}
```

**curl Example:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:5050/api/v1/status/my_service"
```

#### GET /api/v1/status/all

Get current status for all services with aggregated monitor status.

**Requires:** JWT authentication

**Response:**
```json
{
  "services": [
    {
      "service": "service1",
      "service_id": 1,
      "status": "operational",
      "timestamp": "2025-01-15T10:30:00Z",
      "response_time_ms": 120,
      "monitor_count": 3,
      "monitors": [
        {
          "monitor_id": 1,
          "monitor_type": "website",
          "config": {"url": "https://example.com"},
          "check_interval_minutes": 5,
          "is_active": true,
          "status": "operational",
          "timestamp": "2025-01-15T10:30:00Z",
          "response_time_ms": 120,
          "metadata": {}
        }
      ]
    }
  ]
}
```

**Status Aggregation:**
- `operational` - All monitors are operational
- `degraded` - Some monitors are failing but not all
- `down` - All monitors are down
- `unknown` - No status data available

#### GET /api/v1/status/public

Get current status for all public services (no authentication required).

This endpoint powers the public status page at `/status`. Services must have "Show on status page" enabled to appear here.

**Requires:** No authentication

**Response:**
```json
{
  "services": [
    {
      "service_name": "API Server",
      "description": "Main API endpoint",
      "status": "operational",
      "last_checked": "2026-01-08T20:30:00Z",
      "uptime_7d": 99.95,
      "recent_incidents": [
        {
          "started_at": "2026-01-07T15:30:00Z",
          "ended_at": "2026-01-07T15:45:00Z",
          "duration_seconds": 900,
          "severity": "degraded",
          "status": "resolved"
        }
      ],
      "maintenance": {
        "in_maintenance": false,
        "active_maintenance": null,
        "upcoming_maintenance": {
          "id": 5,
          "start_time": "2026-01-10T02:00:00Z",
          "end_time": "2026-01-10T04:00:00Z",
          "reason": "Database optimization"
        }
      }
    }
  ],
  "updated_at": "2026-01-08T20:30:00Z"
}
```

**Maintenance information:**
- `in_maintenance` - True if service is currently in maintenance
- `active_maintenance` - Details of current maintenance window (if active)
- `upcoming_maintenance` - Next maintenance within 24 hours (if scheduled)

**Incident display:**
- Shows ongoing incidents (always)
- Shows last resolved incident if within 48 hours (otherwise hidden)

**curl Example:**
```bash
curl http://localhost:5050/api/v1/status/public
```

---

#### POST /api/v1/metric/{service_name}/{monitor_name}

Ultra-simple metric update API. Automatically determines status based on thresholds.

**Note:** Both service_name and monitor_name are required.

**Request:**
```json
{
  "api_key": "your_key",
  "value": 87.5
}
```

**Response:**
```json
{
  "success": true,
  "service": "Server Disk Usage",
  "value": 87.5,
  "status": "degraded",
  "reason": "Value 87.5 exceeds warning threshold of 75"
}
```

**curl Example:**
```bash
curl -X POST http://localhost:5050/api/v1/metric/server_metrics/disk_usage \
  -H "Content-Type: application/json" \
  -d '{"api_key":"your_key","value":87.5}'
```

**Monitor Names:**
When creating a metric monitor, you must specify a `name` in the config. This allows multiple metric monitors per service (e.g., cpu, memory, disk for one server).

**URL Encoding:**
If service or monitor names contain spaces or special characters, they must be URL-encoded:
- `"cpu usage"` → `cpu%20usage`
- `"disk /var"` → `disk%20%2Fvar`

Most HTTP clients (curl, Python requests, JavaScript fetch) handle encoding automatically. For manual encoding, use an online URL encoder or:
- Python: `urllib.parse.quote(name)`
- JavaScript: `encodeURIComponent(name)`
- Bash: `echo "name with spaces" | jq -sRr @uri`

**Use Cases:**
- Daily sales numbers (alert if below target)
- Error rates (alert if above threshold)
- Queue lengths (alert if backed up)
- Disk usage (alert when high)
- Any numeric business metric
- Multiple metrics per service (CPU, memory, disk on one server)

#### POST /api/v1/heartbeat/{service_name}/{monitor_name}

Send a heartbeat ping for a deadman monitor.

**Note:** Both service_name and monitor_name are required.

**Request:**
```json
{
  "api_key": "your_key"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Heartbeat received for 'backup_job'",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

**curl Example:**
```bash
curl -X POST http://localhost:5050/api/v1/heartbeat/backup_job/database_backup \
  -H "Content-Type: application/json" \
  -d '{"api_key":"your_key"}'
```

**Monitor Names:**
When creating a deadman monitor, you must specify a `name` in the config. This allows multiple deadman monitors per service (e.g., separate monitors for database backup, file backup, and log rotation).

**URL Encoding:**
If service or monitor names contain spaces or special characters, they must be URL-encoded:
- `"backup job"` → `backup%20job`
- `"nightly backup"` → `nightly%20backup`

Most HTTP clients handle encoding automatically. See the metric endpoint documentation above for encoding examples in different languages.

**Use Cases:**
- Cron job monitoring (ping after each successful run)
- Backup verification (ping after backup completes)
- Scheduled task monitoring (ping from task scheduler)
- Data pipeline health (ping at pipeline completion)
- Watchdog processes (periodic health pings)
- Multiple tasks per service (database backup, file backup, cleanup job)

**How It Works:**
1. Create a deadman monitor for your service
2. Your script/cron sends a heartbeat ping after running
3. If no ping received within expected interval + grace period, monitor goes DOWN
4. Dashboard shows last heartbeat timestamp

**Example Cron Integration:**
```bash
#!/bin/bash
# Run backup
/usr/local/bin/backup.sh

# If successful, send heartbeat
if [ $? -eq 0 ]; then
  curl -X POST http://localhost:5050/api/v1/heartbeat/backup_job/database_backup \
    -H "Content-Type: application/json" \
    -d '{"api_key":"YOUR_KEY"}'
fi
```

---

### Services

#### GET /api/v1/services

List all services.

**Requires:** JWT authentication

**Response:**
```json
[
  {
    "id": 1,
    "name": "payment_gateway",
    "description": "Payment processing service",
    "category": "Infrastructure",
    "created_at": "2025-01-15T10:00:00Z",
    "is_active": true
  }
]
```

#### POST /api/v1/services

Create a new service.

**Requires:** JWT authentication

**Request:**
```json
{
  "name": "my_service",
  "description": "Service description",
  "category": "Backend"
}
```

**Response:** Service object

#### GET /api/v1/services/{service_id}

Get specific service details.

**Requires:** JWT authentication

#### PUT /api/v1/services/{service_id}

Update a service.

**Requires:** JWT authentication

#### DELETE /api/v1/services/{service_id}

Permanently delete a service and all associated data (CASCADE delete).

**Requires:** JWT authentication

**Warning:** This permanently deletes the service, all monitors, and all status history. This action cannot be undone.

#### POST /api/v1/services/{service_id}/pause

Pause a service and all its monitors (sets is_active to False without deleting).

**Requires:** JWT authentication

**Response:**
```json
{
  "success": true,
  "message": "Service and all monitors paused"
}
```

**Note:** All monitors attached to this service will also be paused.

#### POST /api/v1/services/{service_id}/resume

Resume a paused service and all its monitors (sets is_active to True).

**Requires:** JWT authentication

**Response:**
```json
{
  "success": true,
  "message": "Service and all monitors resumed"
}
```

**Note:** All monitors attached to this service will also be resumed.

#### GET /api/v1/services/{service_id}/history

Get status history for a service.

**Requires:** JWT authentication

**Parameters:**
- `limit` (query parameter, default: 100)

**Response:**
```json
{
  "service": "payment_gateway",
  "history": [
    {
      "status": "operational",
      "timestamp": "2025-01-15T10:30:00Z",
      "response_time_ms": 145,
      "metadata": {}
    }
  ]
}
```

#### GET /api/v1/services/export

Export selected services and their monitor configurations to JSON format for backup or migration.

**Requires:** JWT authentication

**Parameters:**
- `service_ids` (query parameter, optional): Comma-separated list of service IDs to export. If not provided, exports all services.

**Response:** JSON file download with `Content-Disposition: attachment` header

**Export Format:**
```json
{
  "export_version": "1.0",
  "exported_at": "2025-01-15T10:30:00Z",
  "services": [
    {
      "name": "payment_gateway",
      "description": "Payment processing service",
      "category": "Infrastructure",
      "is_active": true,
      "monitors": [
        {
          "type": "website",
          "config": {
            "url": "https://api.example.com/health",
            "timeout_seconds": 10
          },
          "check_interval_minutes": 5,
          "is_active": true
        }
      ]
    }
  ]
}
```

**curl Example:**
```bash
# Export all services
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:5050/api/v1/services/export" \
  -o simplewatch_export.json

# Export specific services
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:5050/api/v1/services/export?service_ids=1,3,5" \
  -o simplewatch_export.json
```

**Note:** Only exports service configurations and monitor settings. Does not export historical status data or notification settings.

#### POST /api/v1/services/import/validate

Validate an import file and preview what would be imported without making any changes (dry-run).

**Requires:** JWT authentication

**Request:** Multipart form data with JSON file

**Response:**
```json
{
  "valid": true,
  "summary": {
    "total_services": 3,
    "new_services": 2,
    "new_monitors": 5,
    "skipped_services": 1
  },
  "details": [
    {
      "service_name": "payment_gateway",
      "action": "create",
      "reason": "New service",
      "monitors": 2
    },
    {
      "service_name": "existing_service",
      "action": "skip",
      "reason": "Service already exists",
      "monitors": 1
    }
  ]
}
```

**curl Example:**
```bash
curl -X POST -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@simplewatch_export.json" \
  "http://localhost:5050/api/v1/services/import/validate"
```

**Note:** This endpoint performs validation only and does not modify the database. Use it to preview what will be imported before executing the actual import.

#### POST /api/v1/services/import

Import services and monitors from a JSON export file.

**Requires:** JWT authentication

**Request:** Multipart form data with JSON file

**Parameters:**
- `service_indices` (query parameter, optional): Comma-separated list of service indices (0-based) to import from the file. If not provided, imports all services that don't already exist.

**Response:**
```json
{
  "success": true,
  "imported": 2,
  "skipped": 1,
  "failed": 0,
  "details": {
    "imported": [
      {
        "service": "payment_gateway",
        "monitors": 2
      }
    ],
    "skipped": [
      {
        "service": "existing_service",
        "reason": "Service already exists"
      }
    ],
    "failed": []
  }
}
```

**curl Example:**
```bash
# Import all services from file
curl -X POST -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@simplewatch_export.json" \
  "http://localhost:5050/api/v1/services/import"

# Import only specific services by index (0-based)
curl -X POST -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@simplewatch_export.json" \
  "http://localhost:5050/api/v1/services/import?service_indices=0,2"
```

**Behavior:**
- **Never overwrites:** Existing services are automatically skipped to preserve historical data
- **Monitor scheduling:** Imported monitors are automatically scheduled to run their first check 1 minute after import
- **Scope:** Only imports service configurations and monitors. Notification settings must be reconfigured manually.

**Best Practice:** Always run `/import/validate` first to preview what will be imported before executing the actual import.

---

### Monitors

#### GET /api/v1/monitors

List all monitors.

**Requires:** JWT authentication

**Response:**
```json
[
  {
    "id": 1,
    "service_id": 1,
    "monitor_type": "website",
    "config": {
      "url": "https://example.com",
      "timeout_seconds": 10
    },
    "check_interval_minutes": 5,
    "is_active": true,
    "last_check_at": "2025-01-15T10:25:00Z",
    "next_check_at": "2025-01-15T10:30:00Z",
    "created_at": "2025-01-15T10:00:00Z"
  }
]
```

#### POST /api/v1/monitors

Create a new monitor.

**Requires:** JWT authentication

**Website Monitor Example:**
```json
{
  "service_id": 1,
  "monitor_type": "website",
  "config": {
    "url": "https://example.com",
    "timeout_seconds": 10,
    "follow_redirects": true,
    "verify_ssl": true
  },
  "check_interval_minutes": 5
}
```

**API Monitor Example:**
```json
{
  "service_id": 2,
  "monitor_type": "api",
  "config": {
    "url": "https://api.example.com/health",
    "method": "GET",
    "expected_status_code": 200,
    "timeout_seconds": 10
  },
  "check_interval_minutes": 5
}
```

**Metric Threshold Monitor Example:**
```json
{
  "service_id": 3,
  "monitor_type": "metric_threshold",
  "config": {
    "name": "disk_usage",
    "warning_threshold": 75.0,
    "critical_threshold": 90.0,
    "comparison": "greater"
  },
  "check_interval_minutes": 15
}
```

**Note:** The `name` field is optional but recommended if you have multiple metric monitors for one service. Use the name when posting values via `/api/v1/metric/{service_name}/{monitor_name}`.

**Port Monitor Example:**
```json
{
  "service_id": 4,
  "monitor_type": "port",
  "config": {
    "host": "1.1.1.1",
    "port": 53,
    "timeout_seconds": 5
  },
  "check_interval_minutes": 15
}
```

**Deadman Monitor Example:**
```json
{
  "service_id": 5,
  "monitor_type": "deadman",
  "config": {
    "name": "database_backup",
    "expected_interval_hours": 24,
    "grace_period_hours": 1
  },
  "check_interval_minutes": 5
}
```

**Note:** Deadman monitors expect regular heartbeat pings. Service goes DOWN if no heartbeat received within `expected_interval_hours + grace_period_hours`. Perfect for monitoring cron jobs, backups, and scheduled tasks. The `name` field is optional but recommended if you have multiple deadman monitors for one service. Use the name when sending heartbeats via `/api/v1/heartbeat/{service_name}/{monitor_name}`.

**SSL Certificate Monitor Example:**
```json
{
  "service_id": 6,
  "monitor_type": "ssl_cert",
  "config": {
    "hostname": "example.com",
    "port": 443,
    "warning_days": 30,
    "critical_days": 7
  },
  "check_interval_minutes": 1440
}
```

**Note:** SSL Certificate monitors check the expiration date of SSL/TLS certificates. Service goes DEGRADED when certificate expires within `warning_days` and DOWN when within `critical_days` or already expired. Default check interval is 1440 minutes (24 hours/daily). The monitor displays days until expiry and the exact expiration date on the dashboard.

**DNS Monitor Example:**
```json
{
  "service_id": 7,
  "monitor_type": "dns",
  "config": {
    "hostname": "example.com",
    "record_type": "A",
    "expected_value": "93.184.216.34",
    "dns_server": "8.8.8.8",
    "timeout_seconds": 5
  },
  "check_interval_minutes": 15
}
```

**Note:** DNS monitors verify DNS record resolution. Checks if the specified hostname resolves to the expected value. Supports A, AAAA, CNAME, MX, and TXT record types. Can optionally verify against a specific DNS server.

**Ping/ICMP Monitor Example:**
```json
{
  "service_id": 8,
  "monitor_type": "ping",
  "config": {
    "host": "8.8.8.8",
    "count": 4,
    "timeout_seconds": 5,
    "latency_threshold_ms": 200,
    "packet_loss_threshold_percent": 20
  },
  "check_interval_minutes": 5
}
```

**Note:** Ping monitors check host reachability via ICMP ping. Measures average latency, min/max RTT, and packet loss. Service goes DEGRADED if latency or packet loss exceeds thresholds, DOWN if host unreachable.

**SEO Monitor Example:**
```json
{
  "service_id": 9,
  "monitor_type": "seo",
  "config": {
    "url": "https://example.com",
    "timeout_seconds": 10,
    "check_title": true,
    "check_meta_description": true,
    "check_h1": true,
    "check_canonical": true,
    "check_robots": true,
    "check_sitemap": true,
    "check_structured_data": true
  },
  "check_interval_minutes": 1440
}
```

**Note:** SEO monitors perform comprehensive SEO health checks including title tags, meta descriptions, heading structure, canonical URLs, robots meta tags, sitemap accessibility, and structured data validation. Identifies missing or problematic SEO elements. Default check interval is 1440 minutes (24 hours/daily).

#### GET /api/v1/monitors/{monitor_id}

Get specific monitor details.

**Requires:** JWT authentication

#### PUT /api/v1/monitors/{monitor_id}

Update a monitor.

**Requires:** JWT authentication

**Request:**
```json
{
  "config": {
    "url": "https://newurl.com"
  },
  "check_interval_minutes": 10,
  "is_active": true
}
```

#### DELETE /api/v1/monitors/{monitor_id}

Permanently delete a monitor and all associated status data (CASCADE delete).

**Requires:** JWT authentication

**Note:** If this is the last active monitor for a service, the service will automatically be paused. A service must have at least one active monitor to remain active.

#### POST /api/v1/monitors/{monitor_id}/pause

Pause a monitor (sets is_active to False without deleting).

**Requires:** JWT authentication

**Response:**
```json
{
  "success": true,
  "message": "Monitor paused"
}
```

**Note:** If this is the last active monitor for the service, the service will automatically be paused as well.

#### POST /api/v1/monitors/{monitor_id}/resume

Resume a paused monitor (sets is_active to True).

**Requires:** JWT authentication

**Response:**
```json
{
  "success": true,
  "message": "Monitor resumed"
}
```

**Note:** If the service was paused, it will automatically be resumed when you resume a monitor.

---

### Maintenance Windows

Maintenance windows allow you to schedule planned maintenance periods during which notifications are suppressed.

#### GET /api/v1/maintenance/

List all maintenance windows (optionally filtered by service).

**Requires:** JWT authentication

**Query Parameters:**
- `service_id` (optional): Filter by service ID

**Response:**
```json
{
  "success": true,
  "maintenance_windows": [
    {
      "id": 1,
      "service_id": 5,
      "service_name": "API Server",
      "start_time": "2026-01-10T02:00:00Z",
      "end_time": "2026-01-10T04:00:00Z",
      "recurrence_type": "weekly",
      "recurrence_config": {
        "days": [2, 4]
      },
      "reason": "Weekly database optimization",
      "status": "scheduled",
      "created_at": "2026-01-08T15:30:00Z",
      "created_by": 1,
      "updated_at": "2026-01-08T15:30:00Z"
    }
  ]
}
```

**Status values:**
- `scheduled` - Window is scheduled for the future
- `active` - Maintenance is currently in progress
- `completed` - Maintenance has finished
- `cancelled` - Maintenance was cancelled before it started

**curl Example:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     "http://localhost:5050/api/v1/maintenance/?service_id=5"
```

---

#### POST /api/v1/maintenance/

Create a new maintenance window.

**Requires:** JWT authentication

**Request:**
```json
{
  "service_id": 5,
  "start_time": "2026-01-10T02:00:00Z",
  "end_time": "2026-01-10T04:00:00Z",
  "recurrence_type": "weekly",
  "recurrence_config": {
    "days": [2, 4]
  },
  "reason": "Weekly database optimization"
}
```

**Recurrence types:**
- `none` - One-time maintenance
- `daily` - Repeat every day at the same time
- `weekly` - Repeat on specific days of the week (Monday=0, Sunday=6)
- `monthly` - Repeat on the same day of each month

**Recurrence config:**
- For `weekly`: `{"days": [0, 2, 4]}` (Monday, Wednesday, Friday)
- For `monthly`: `{"day": 15}` (15th of each month) or `{"day": -1}` (last day)
- For `none` and `daily`: No config needed

**Response:**
```json
{
  "success": true,
  "message": "Maintenance window created",
  "maintenance_window": {
    "id": 1,
    "service_id": 5,
    "service_name": "API Server",
    "start_time": "2026-01-10T02:00:00Z",
    "end_time": "2026-01-10T04:00:00Z",
    "recurrence_type": "weekly",
    "recurrence_config": {
      "days": [2, 4]
    },
    "reason": "Weekly database optimization",
    "status": "scheduled",
    "created_at": "2026-01-08T20:15:30Z",
    "created_by": 1,
    "updated_at": "2026-01-08T20:15:30Z"
  }
}
```

**curl Example:**
```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "service_id": 5,
       "start_time": "2026-01-10T02:00:00Z",
       "end_time": "2026-01-10T04:00:00Z",
       "recurrence_type": "none",
       "reason": "Database migration"
     }' \
     http://localhost:5050/api/v1/maintenance/
```

---

#### DELETE /api/v1/maintenance/{window_id}

Delete a scheduled maintenance window.

**Requires:** JWT authentication

**Response:**
```json
{
  "success": true,
  "message": "Maintenance window deleted"
}
```

**Note:** Only scheduled windows can be deleted. Use cancel endpoint for active windows.

**curl Example:**
```bash
curl -X DELETE \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:5050/api/v1/maintenance/1
```

---

#### POST /api/v1/maintenance/{window_id}/cancel

Cancel an active maintenance window early.

**Requires:** JWT authentication

**Response:**
```json
{
  "success": true,
  "message": "Maintenance window cancelled",
  "maintenance_window": {
    "id": 1,
    "status": "cancelled",
    "end_time": "2026-01-10T03:15:00Z"
  }
}
```

**curl Example:**
```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:5050/api/v1/maintenance/1/cancel
```

---

#### GET /api/v1/maintenance/service/{service_id}/active

Check if a service is currently in an active maintenance window.

**Requires:** JWT authentication

**Response (in maintenance):**
```json
{
  "success": true,
  "in_maintenance": true,
  "maintenance_window": {
    "id": 1,
    "start_time": "2026-01-10T02:00:00Z",
    "end_time": "2026-01-10T04:00:00Z",
    "reason": "Database migration"
  }
}
```

**Response (not in maintenance):**
```json
{
  "success": true,
  "in_maintenance": false,
  "maintenance_window": null
}
```

**curl Example:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:5050/api/v1/maintenance/service/5/active
```

---

### Notifications

#### GET /api/v1/notifications/smtp

Get SMTP configuration.

**Requires:** JWT authentication

**Response:**
```json
{
  "host": "smtp.gmail.com",
  "port": 587,
  "username": "alerts@company.com",
  "from_address": "alerts@company.com",
  "use_tls": true,
  "is_tested": true,
  "tested_at": "2025-12-02T10:00:00Z"
}
```

#### POST /api/v1/notifications/smtp

Configure SMTP settings.

**Requires:** JWT authentication

**Request:**
```json
{
  "host": "smtp.gmail.com",
  "port": 587,
  "username": "alerts@company.com",
  "password": "app_password_here",
  "from_address": "alerts@company.com",
  "use_tls": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "SMTP configuration saved"
}
```

#### POST /api/v1/notifications/smtp/test

Test SMTP configuration by sending a test email.

**Requires:** JWT authentication

**Request:**
```json
{
  "recipient": "admin@company.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Test email sent successfully"
}
```

#### GET /api/v1/notifications/channels

List all notification channels for current user.

**Requires:** JWT authentication

**Response:**
```json
[
  {
    "id": 1,
    "label": "Team Slack",
    "channel_type": "slack",
    "webhook_url": "https://hooks.slack.com/...",
    "is_active": true,
    "is_tested": true,
    "tested_at": "2025-12-02T10:00:00Z",
    "created_at": "2025-12-01T12:00:00Z"
  }
]
```

#### POST /api/v1/notifications/channels

Create a notification channel.

**Requires:** JWT authentication

**Request:**
```json
{
  "label": "Ops Discord",
  "channel_type": "discord",
  "webhook_url": "https://discord.com/api/webhooks/...",
  "secret_token": "optional_secret",
  "custom_payload_template": "{\"text\": \"{{service_name}} is {{new_status}}\"}"
}
```

**Channel Types:**
- `slack` - Slack webhook
- `discord` - Discord webhook
- `generic` - Custom JSON webhook

**Response:**
```json
{
  "id": 2,
  "label": "Ops Discord",
  "channel_type": "discord",
  "is_active": true,
  "is_tested": false
}
```

#### POST /api/v1/notifications/channels/{channel_id}/test

Test a notification channel.

**Requires:** JWT authentication

**Response:**
```json
{
  "success": true,
  "message": "Test notification sent successfully"
}
```

#### PUT /api/v1/notifications/channels/{channel_id}/toggle

Toggle channel active status.

**Requires:** JWT authentication

#### DELETE /api/v1/notifications/channels/{channel_id}

Delete a notification channel.

**Requires:** JWT authentication

#### GET /api/v1/notifications/services/{service_id}

Get notification settings for a service.

**Requires:** JWT authentication

**Response:**
```json
{
  "enabled": true,
  "email_enabled": true,
  "email_recipients": "admin@company.com,ops@company.com",
  "channel_ids": [1, 2],
  "cooldown_minutes": 5,
  "notify_on_recovery": true,
  "last_notification_sent_at": "2025-12-02T10:30:00Z",
  "last_notified_status": "down"
}
```

#### POST /api/v1/notifications/services/{service_id}

Configure notification settings for a service.

**Requires:** JWT authentication

**Request:**
```json
{
  "enabled": true,
  "email_enabled": true,
  "email_recipients": "admin@company.com,ops@company.com",
  "channel_ids": [1, 2],
  "cooldown_minutes": 5,
  "notify_on_recovery": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notification settings updated"
}
```

**Notification Behavior:**
- Notifications sent when service status changes
- Cooldown prevents spam (default: 5 minutes)
- Recovery notifications always sent (bypass cooldown)
- Service status aggregated from all monitors
- Email requires SMTP configuration
- Webhooks require active, tested channels

#### PUT /api/v1/notifications/channels/{channel_id}

Update an existing notification channel.

**Requires:** JWT authentication

**Request:**
```json
{
  "label": "Updated Slack",
  "webhook_url": "https://hooks.slack.com/services/new/url",
  "secret_token": "optional_secret",
  "custom_payload_template": "{\"text\": \"{{service_name}} is {{new_status}}\"}"
}
```

**Response:**
```json
{
  "id": 1,
  "label": "Updated Slack",
  "channel_type": "slack",
  "is_active": true,
  "is_tested": false
}
```

#### GET /api/v1/notifications/logs

Get notification delivery logs.

**Requires:** JWT authentication

**Query Parameters:**
- `limit` (optional): Number of logs to return (default: 50)
- `offset` (optional): Offset for pagination (default: 0)

**Response:**
```json
{
  "logs": [
    {
      "id": 123,
      "timestamp": "2025-01-06T10:30:00Z",
      "service_name": "Payment Gateway",
      "channel": "Team Slack",
      "status_change": "operational → down",
      "delivery_status": "success",
      "error_message": null
    }
  ]
}
```

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:5050/api/v1/notifications/logs?limit=100&offset=0"
```

#### GET /api/v1/notifications/logs/export

Export all notification logs as CSV.

**Requires:** JWT authentication

**Response:** CSV file download

**CSV Columns:**
- Timestamp
- Service
- Channel
- Status Change
- Delivery Status
- Error Message

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:5050/api/v1/notifications/logs/export" \
  -o notification_logs.csv
```

---

### Incidents

Endpoints for incident tracking, analytics, and reporting. Incidents are automatically created when services transition to degraded or down status.

#### GET /api/v1/incidents

List all incidents with optional filtering.

**Requires:** JWT authentication

**Query Parameters:**
- `time_window` (optional): Time window for filtering
  - Options: `24h`, `7d`, `30d`, `90d`, `all`
  - Default: `30d`
- `service_id` (optional): Filter by specific service ID
- `status` (optional): Filter by incident status
  - Options: `ongoing`, `resolved`

**Response:**
```json
{
  "success": true,
  "incidents": [
    {
      "id": 1,
      "service_id": 2,
      "service_name": "Slow Response API",
      "started_at": "2025-12-10T09:15:30",
      "ended_at": "2025-12-10T09:45:20",
      "duration_seconds": 1790,
      "severity": "down",
      "status": "resolved",
      "affected_monitors": [
        {
          "id": 3,
          "type": "api",
          "name": null
        }
      ]
    }
  ]
}
```

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:5050/api/v1/incidents?time_window=7d&status=ongoing"
```

#### GET /api/v1/incidents/stats

Get aggregated incident statistics including MTTR, uptime, and breakdowns.

**Requires:** JWT authentication

**Query Parameters:**
- `time_window` (optional): Time window for statistics
  - Options: `24h`, `7d`, `30d`, `90d`
  - Default: `30d`
- `service_id` (optional): Calculate stats for specific service only

**Response:**
```json
{
  "success": true,
  "time_window": "30d",
  "total_incidents": 15,
  "ongoing_incidents": 2,
  "resolved_incidents": 13,
  "mttr_seconds": 3600,
  "mttr_formatted": "1h",
  "uptime_percentage": 99.5,
  "by_service": [
    {
      "service_id": 1,
      "service_name": "Google Search",
      "count": 0
    },
    {
      "service_id": 2,
      "service_name": "Slow Response API",
      "count": 15
    }
  ],
  "by_severity": {
    "degraded": 5,
    "down": 10
  }
}
```

**Notes:**
- MTTR (Mean Time To Recovery) only includes resolved incidents
- Uptime calculation uses StatusUpdate-based method (same as dashboard)
- When `service_id` is provided, shows that service's specific uptime
- When no `service_id`, shows average uptime across all active services (excludes services with no data)
- `uptime_percentage` will be `null` for services with no status update data

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:5050/api/v1/incidents/stats?time_window=7d&service_id=2"
```

#### GET /api/v1/incidents/timeline

Get incident frequency data for timeline visualization.

**Requires:** JWT authentication

**Query Parameters:**
- `time_window` (optional): Time window for timeline
  - Options: `24h`, `7d`, `30d`
  - Default: `7d`
- `service_id` (optional): Filter by specific service ID

**Response:**
```json
{
  "success": true,
  "labels": [
    "2025-12-09 09:00",
    "2025-12-09 10:00",
    "2025-12-09 11:00"
  ],
  "data": [2, 1, 0]
}
```

**Notes:**
- Data is bucketed by hour for 24h and 7d windows
- Data is bucketed by day for 30d window
- Labels are formatted for Chart.js compatibility

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:5050/api/v1/incidents/timeline?time_window=24h"
```

#### GET /api/v1/incidents/export

Export incident data as CSV file.

**Requires:** JWT authentication

**Query Parameters:**
- `time_window` (optional): Time window for export
  - Options: `24h`, `7d`, `30d`, `90d`, `all`
  - Default: `30d`
- `service_id` (optional): Filter by specific service ID

**Response:** CSV file download

**CSV Columns:**
- Incident ID
- Service Name
- Started At
- Ended At
- Duration (seconds)
- Severity
- Status
- Affected Monitor IDs
- Affected Monitor Types

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:5050/api/v1/incidents/export?time_window=30d" \
  -o incidents_30d.csv
```

**Notes:**
- Incidents are automatically created/resolved by the system
- No manual incident creation or modification endpoints (automated only)
- Incident severity matches service status (degraded or down)
- Affected monitors list includes monitor ID, type, and name (if set)
- Duration is only calculated for resolved incidents
- Uptime calculation matches dashboard for consistency

---

### Users

#### GET /api/v1/users

List all users (admin only).

**Requires:** JWT authentication + admin privileges

#### POST /api/v1/users

Create a new user (admin only).

**Requires:** JWT authentication + admin privileges

**Request:**
```json
{
  "username": "newuser",
  "password": "secure_password",
  "email": "user@example.com",
  "is_admin": false
}
```

#### GET /api/v1/users/me

Get current user information.

**Requires:** JWT authentication

#### POST /api/v1/users/me/regenerate-api-key

Regenerate API key for current user.

**Requires:** JWT authentication

**Response:**
```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@example.com",
  "api_key": "new_api_key_here",
  "created_at": "2025-01-15T10:00:00Z",
  "is_admin": true
}
```

#### PUT /api/v1/users/{user_id}/password

Change password for a user (admin only).

**Requires:** JWT authentication + admin privileges

**Request:**
```json
{
  "new_password": "new_secure_password"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password updated successfully"
}
```

**Notes:**
- Password must meet minimum requirements (8+ characters)
- User will need to login with new password

#### DELETE /api/v1/users/{user_id}

Delete a user (admin only).

**Requires:** JWT authentication + admin privileges

---

### Setup

First-run setup endpoints. These endpoints are only available when SimpleWatch has not been set up yet.

#### GET /api/v1/setup/status

Check if system setup has been completed.

**Requires:** No authentication (public endpoint)

**Response:**
```json
{
  "setup_completed": false
}
```

**Notes:**
- Returns `true` if admin account exists and setup is complete
- Returns `false` if system needs initial setup
- Used by frontend to redirect to setup page or login page

#### POST /api/v1/setup

Complete first-run setup by creating admin account.

**Requires:** No authentication (public endpoint, only works if setup not completed)

**Request:**
```json
{
  "username": "admin",
  "password": "secure_password_here",
  "confirm_password": "secure_password_here",
  "create_examples": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Setup completed successfully",
  "username": "admin"
}
```

**Notes:**
- This endpoint only works when `setup_completed` is `false`
- Creates admin user account with provided credentials
- If `create_examples` is true, creates 4 example monitors (Google Search, Slow API, Disk Usage, Cloudflare DNS)
- Password must be minimum 8 characters
- After setup, redirect to login page

---

### Settings

System settings endpoints.

#### GET /api/v1/settings/retention

Get current data retention policy.

**Requires:** JWT authentication

**Response:**
```json
{
  "retention_days": 90
}
```

#### POST /api/v1/settings/retention

Update data retention policy.

**Requires:** JWT authentication

**Request:**
```json
{
  "retention_days": 30
}
```

**Response:**
```json
{
  "success": true,
  "message": "Retention policy updated to 30 days",
  "retention_days": 30
}
```

**Notes:**
- Sets how many days of StatusUpdate history to keep
- Older data is automatically cleaned up daily by scheduler
- Changes take effect immediately
- Minimum value: 1 day
- Common values: 30, 60, 90, 180, 365 days

---

### AI SRE Companion

AI-powered incident analysis, remediation suggestions, and post-mortem generation.

#### GET /api/v1/ai/settings

Get current AI SRE Companion configuration.

**Requires:** JWT authentication

**Response:**
```json
{
  "enabled": true,
  "provider": "openai",
  "endpoint": null,
  "model_name": "gpt-4o",
  "has_api_key": true,
  "auto_analyze_incidents": true,
  "require_approval": true,
  "auto_execute_enabled": false,
  "auto_execute_confidence_threshold": 0.95,
  "last_query_success": true,
  "last_query_at": "2026-01-15T10:30:00Z",
  "last_error": null
}
```

**Notes:**
- `has_api_key` indicates if an API key is stored (never returns the actual key)
- `provider` options: `local`, `openai`, `anthropic`
- `endpoint` is used for local providers (Ollama URL)

#### PUT /api/v1/ai/settings

Update AI SRE Companion configuration (admin only).

**Requires:** JWT authentication + admin privileges

**Request:**
```json
{
  "enabled": true,
  "provider": "openai",
  "endpoint": null,
  "model_name": "gpt-4o",
  "api_key": "sk-...",
  "auto_analyze_incidents": true,
  "require_approval": true,
  "auto_execute_enabled": false,
  "auto_execute_confidence_threshold": 0.95
}
```

**Response:**
```json
{
  "success": true,
  "message": "AI settings updated"
}
```

**Notes:**
- `api_key` is encrypted before storage
- Only include `api_key` when updating it
- For local (Ollama), no API key required

#### GET /api/v1/ai/status

Get AI connection status for dashboard indicator.

**Requires:** JWT authentication

**Response:**
```json
{
  "enabled": true,
  "connected": true,
  "last_query_at": "2026-01-15T10:30:00Z",
  "provider": "openai",
  "model_name": "gpt-4o"
}
```

#### POST /api/v1/ai/test

Test connection to configured AI provider.

**Requires:** JWT authentication

**Response (success):**
```json
{
  "success": true,
  "message": "Connected to gpt-4o",
  "response_time_ms": 523
}
```

**Response (failure):**
```json
{
  "success": false,
  "error": "Connection refused"
}
```

#### GET /api/v1/ai/actions

Get pending AI action suggestions.

**Requires:** JWT authentication

**Query Parameters:**
- `service_id` (optional): Filter by service ID

**Response:**
```json
[
  {
    "id": 1,
    "service_id": 5,
    "service_name": "Payment API",
    "incident_id": 12,
    "action_type": "webhook",
    "description": "Restart the payment service container",
    "reasoning": "The service has been unresponsive for 10 minutes. Based on known issues, a restart typically resolves this.",
    "confidence": 0.87,
    "config": {
      "webhook_name": "Restart Service",
      "webhook_url": "https://api.example.com/restart",
      "webhook_method": "POST"
    },
    "created_at": "2026-01-15T10:30:00Z"
  }
]
```

#### GET /api/v1/ai/actions/history

Get AI action history with filtering and pagination.

**Requires:** JWT authentication

**Query Parameters:**
- `service_id` (optional): Filter by service ID
- `status` (optional): Filter by status (`pending`, `executed`, `failed`, `rejected`)
- `limit` (optional): Number of items (default: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "service_id": 5,
      "service_name": "Payment API",
      "incident_id": 12,
      "action_type": "webhook",
      "description": "Restart the payment service container",
      "reasoning": "Service unresponsive, restart recommended",
      "confidence": 0.87,
      "config": {},
      "status": "executed",
      "created_at": "2026-01-15T10:30:00Z",
      "executed_at": "2026-01-15T10:32:00Z",
      "executed_by": "user:1",
      "result": {
        "status_code": 200,
        "success": true
      }
    }
  ],
  "total": 45,
  "limit": 100,
  "offset": 0
}
```

**Status Values:**
- `pending` - Awaiting approval
- `executed` - Successfully executed
- `failed` - Execution failed
- `rejected` - Dismissed by user

#### POST /api/v1/ai/actions/{action_id}/approve

Approve and execute a pending AI action.

**Requires:** JWT authentication

**Response (success):**
```json
{
  "success": true,
  "message": "Action executed successfully",
  "result": {
    "status_code": 200,
    "response": {}
  }
}
```

**Response (webhook failure):**
```json
{
  "success": false,
  "error": "Webhook returned 500",
  "result": {
    "status_code": 500,
    "error": "Internal server error"
  }
}
```

**Notes:**
- Action must be in `pending` status
- Executes configured webhook if present
- Logs action with `executed_by: user:{id}`

#### POST /api/v1/ai/actions/{action_id}/reject

Reject/dismiss a pending AI action.

**Requires:** JWT authentication

**Request:**
```json
{
  "reason": "Not applicable to this situation"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Action rejected"
}
```

**Notes:**
- Optional `reason` for audit trail
- Action status changes to `rejected`

#### POST /api/v1/ai/analyze/{incident_id}

Manually trigger AI analysis for an incident.

**Requires:** JWT authentication

**Response:**
```json
{
  "success": true,
  "action_log_id": 15,
  "recommendation": {
    "action": "Restart Service",
    "reasoning": "Based on the error pattern and service context...",
    "confidence": 0.82,
    "webhook": {
      "name": "Restart Service",
      "url": "https://api.example.com/restart"
    }
  }
}
```

**Notes:**
- Creates a new ActionLog entry
- Returns the AI's recommendation
- Use when auto-analyze is disabled

#### GET /api/v1/ai/services/{service_id}/config

Get AI configuration for a specific service.

**Requires:** JWT authentication

**Response:**
```json
{
  "service_id": 5,
  "remediation_webhooks": [
    {
      "name": "Restart Service",
      "url": "https://api.example.com/restart",
      "method": "POST",
      "payload": {"force": true},
      "headers": {"Authorization": "Bearer token"}
    }
  ],
  "service_context": "Node.js API on AWS ECS, connects to PostgreSQL",
  "known_issues": "Memory spikes require restart after 2GB threshold",
  "auto_execute_enabled": null
}
```

#### PUT /api/v1/ai/services/{service_id}/config

Update AI configuration for a specific service.

**Requires:** JWT authentication

**Request:**
```json
{
  "remediation_webhooks": [
    {
      "name": "Restart Service",
      "url": "https://api.example.com/restart",
      "method": "POST",
      "payload": {"force": true},
      "headers": {"Authorization": "Bearer token"}
    },
    {
      "name": "Clear Cache",
      "url": "https://api.example.com/cache/clear",
      "method": "DELETE"
    }
  ],
  "service_context": "Node.js API on AWS ECS, port 3000",
  "known_issues": "Memory spikes require restart",
  "auto_execute_enabled": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Service AI config updated"
}
```

**Webhook Format:**
```json
{
  "name": "Action Name",
  "url": "https://webhook.url",
  "method": "POST",
  "payload": {},
  "headers": {}
}
```

#### POST /api/v1/ai/postmortem

Generate an AI post-mortem report.

**Requires:** JWT authentication

**Request (Single Incident):**
```json
{
  "incident_id": 12
}
```

**Request (Date Range):**
```json
{
  "service_id": 5,
  "start_date": "2026-01-01",
  "end_date": "2026-01-15"
}
```

**Response:**
```json
{
  "success": true,
  "report": "# Post-Mortem Report\n\n## Incident Summary\n\n..."
}
```

**Report Contents:**
- Incident summary and timeline
- Affected services and duration
- Observations (factual, not assumed)
- Recommended investigation areas
- Unknown factors section

**Notes:**
- Either `incident_id` OR `service_id` + date range required
- Report is markdown formatted
- Uses configured AI provider

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message here",
  "error_code": "ERROR_CODE"
}
```

**Common Error Codes:**
- `INVALID_API_KEY` - API key not valid
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Invalid input data
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `INTERNAL_ERROR` - Server error

**HTTP Status Codes:**
- 200 - Success
- 400 - Bad Request
- 401 - Unauthorized
- 403 - Forbidden
- 404 - Not Found
- 500 - Internal Server Error

---

## Rate Limiting

Default: 100 requests per minute per API key

Exceeding rate limit returns:
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "error_code": "RATE_LIMIT"
}
```

---

## Integration Examples

### Python

```python
import requests

api_url = "http://localhost:5050/api/v1"
api_key = "your_api_key"

# Send metric
response = requests.post(
    f"{api_url}/metric/webserver/cpu_usage",
    json={
        "api_key": api_key,
        "value": 45.2
    }
)

# Send heartbeat (for deadman monitor)
response = requests.post(
    f"{api_url}/heartbeat/backup_job/database_backup",
    json={
        "api_key": api_key
    }
)
```

### Shell Script

```bash
#!/bin/bash
API_KEY="your_api_key"
API_URL="http://localhost:5050/api/v1"

# Send metric value (e.g., disk usage)
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
curl -X POST "$API_URL/metric/server/disk_usage" \
  -H "Content-Type: application/json" \
  -d "{\"api_key\":\"$API_KEY\",\"value\":$DISK_USAGE}"

# Send heartbeat after successful backup
/usr/local/bin/backup.sh && \
curl -X POST "$API_URL/heartbeat/backup_job/database_backup" \
  -H "Content-Type: application/json" \
  -d "{\"api_key\":\"$API_KEY\"}"
```

### Node.js

```javascript
const axios = require('axios');

const apiUrl = 'http://localhost:5050/api/v1';
const apiKey = 'your_api_key';

async function sendMetric(service, monitor, value) {
  const response = await axios.post(`${apiUrl}/metric/${service}/${monitor}`, {
    api_key: apiKey,
    value: value
  });
  return response.data;
}

async function sendHeartbeat(service, monitor) {
  const response = await axios.post(`${apiUrl}/heartbeat/${service}/${monitor}`, {
    api_key: apiKey
  });
  return response.data;
}

// Examples
sendMetric('webserver', 'cpu_usage', 45.2);
sendHeartbeat('backup_job', 'database_backup');
```

---

## Need Help?

- Check the [User Guide](USER_GUIDE.md) for detailed usage instructions
- Review the main [README](README.md) for setup and troubleshooting
