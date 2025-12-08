# SimpleWatch API Documentation

Complete API reference for integrating with SimpleWatch.

## Base URL

```
http://localhost:5050/api/v1
```

## Authentication

SimpleWatch supports two authentication methods:

### 1. API Key (for automated scripts)

Include your API key in request body:

```json
{
  "api_key": "your_api_key_here"
}
```

Get your API key from Settings page in the web interface.

### 2. JWT Token (for web UI)

Include Bearer token in Authorization header:

```
Authorization: Bearer your_jwt_token
```

Obtain token via `/api/v1/auth/login` endpoint.

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

**Parameters:**
- `api_key` (query parameter)

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
curl "http://localhost:5050/api/v1/status/my_service?api_key=your_key"
```

#### GET /api/v1/status/all

Get current status for all services with aggregated monitor status.

**Parameters:**
- `api_key` (query parameter)

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

#### POST /api/v1/monitors/{monitor_id}/test

Test a monitor immediately without waiting for scheduled check.

**Requires:** JWT authentication

**Response:**
```json
{
  "success": true,
  "result": {
    "status": "operational",
    "response_time_ms": 123,
    "message": "Website returned status code 200"
  }
}
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

#### DELETE /api/v1/users/{user_id}

Delete a user (admin only).

**Requires:** JWT authentication + admin privileges

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
