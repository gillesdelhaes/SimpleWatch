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

### Status Updates

#### POST /api/v1/status

Update status for a service.

**Request:**
```json
{
  "api_key": "your_api_key",
  "service": "payment_gateway",
  "status": "operational",
  "timestamp": "2025-01-15T10:30:00Z",
  "metadata": {
    "response_time_ms": 145,
    "message": "All systems running"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Status updated successfully",
  "service": "payment_gateway"
}
```

**curl Example:**
```bash
curl -X POST http://localhost:5050/api/v1/status \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "your_key",
    "service": "my_service",
    "status": "operational"
  }'
```

#### POST /api/v1/status/bulk

Update multiple services in one request.

**Request:**
```json
{
  "api_key": "your_api_key",
  "updates": [
    {
      "service": "service1",
      "status": "operational"
    },
    {
      "service": "service2",
      "status": "degraded",
      "metadata": {"error_rate": 2.3}
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bulk updated 2 services"
}
```

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

Get current status for all services.

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
      "metadata": {}
    }
  ]
}
```

#### POST /api/v1/metric/{service_name}

Ultra-simple metric update API. Automatically determines status based on thresholds.

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
curl -X POST http://localhost:5050/api/v1/metric/daily_sales \
  -H "Content-Type: application/json" \
  -d '{"api_key":"your_key","value":15420}'
```

**Use Cases:**
- Daily sales numbers (alert if below target)
- Error rates (alert if above threshold)
- Queue lengths (alert if backed up)
- Disk usage (alert when high)
- Any numeric business metric

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

Archive a service.

**Requires:** JWT authentication

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
    "warning_threshold": 75.0,
    "critical_threshold": 90.0,
    "comparison": "greater"
  },
  "check_interval_minutes": 15
}
```

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

Delete a monitor.

**Requires:** JWT authentication

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

### Webhooks

#### GET /api/v1/webhooks

List webhooks for current user.

**Requires:** JWT authentication

#### POST /api/v1/webhooks

Create a webhook.

**Requires:** JWT authentication

**Request:**
```json
{
  "url": "https://example.com/webhook",
  "event_types": ["status_change", "service_down"],
  "secret_token": "optional_secret"
}
```

**Event Types:**
- `status_change` - Any status change
- `service_down` - Service goes down
- `service_up` - Service recovers

**Webhook Payload:**
```json
{
  "event": "status_change",
  "service": "payment_gateway",
  "old_status": "operational",
  "new_status": "down",
  "timestamp": "2025-01-15T10:30:00Z",
  "metadata": {}
}
```

#### DELETE /api/v1/webhooks/{webhook_id}

Delete a webhook.

**Requires:** JWT authentication

#### PUT /api/v1/webhooks/{webhook_id}/toggle

Toggle webhook active status.

**Requires:** JWT authentication

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

# Update status
response = requests.post(
    f"{api_url}/status",
    json={
        "api_key": api_key,
        "service": "my_app",
        "status": "operational"
    }
)

# Send metric
response = requests.post(
    f"{api_url}/metric/error_rate",
    json={
        "api_key": api_key,
        "value": 0.5
    }
)
```

### Shell Script

```bash
#!/bin/bash
API_KEY="your_api_key"
API_URL="http://localhost:5050/api/v1"

# Check service and report
if systemctl is-active --quiet myservice; then
    STATUS="operational"
else
    STATUS="down"
fi

curl -X POST "$API_URL/status" \
  -H "Content-Type: application/json" \
  -d "{\"api_key\":\"$API_KEY\",\"service\":\"myservice\",\"status\":\"$STATUS\"}"
```

### Node.js

```javascript
const axios = require('axios');

const apiUrl = 'http://localhost:5050/api/v1';
const apiKey = 'your_api_key';

async function updateStatus(service, status) {
  const response = await axios.post(`${apiUrl}/status`, {
    api_key: apiKey,
    service: service,
    status: status
  });
  return response.data;
}

updateStatus('my_app', 'operational');
```

---

## Need Help?

- Check the [User Guide](USER_GUIDE.md) for detailed usage instructions
- See [example scripts](backend/examples/README.md) for more integration patterns
- Review the main [README](README.md) for setup and troubleshooting
