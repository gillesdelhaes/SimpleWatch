# SimpleWatch Example Scripts

This directory contains example scripts demonstrating how to integrate with SimpleWatch.

## Scripts

### 1. disk_reporter.py

Reports disk usage metrics to a metric threshold monitor.

**Usage:**
```bash
# Send once
python disk_reporter.py --api-key YOUR_API_KEY --once

# Continuous reporting every 15 minutes
python disk_reporter.py --api-key YOUR_API_KEY --service-name "Server Disk Usage"

# Custom interval (5 minutes)
python disk_reporter.py --api-key YOUR_API_KEY --interval 300
```

**Real Implementation:**
Replace the `get_disk_usage()` function with actual disk monitoring:
```python
import shutil

def get_disk_usage():
    """Get actual disk usage percentage."""
    total, used, free = shutil.disk_usage("/")
    return (used / total) * 100
```

### 2. batch_status_update.py

Updates multiple services in a single API call.

**Usage:**
```bash
python batch_status_update.py --api-key YOUR_API_KEY --file updates.json
```

**Example updates.json:**
```json
[
  {
    "service": "web_server",
    "status": "operational",
    "metadata": {"response_time_ms": 120}
  },
  {
    "service": "database",
    "status": "degraded",
    "metadata": {"connections": 95}
  }
]
```

## Integration Patterns

### 1. Cron Job Integration

Monitor disk usage every 15 minutes:
```bash
*/15 * * * * /usr/bin/python3 /path/to/disk_reporter.py --api-key YOUR_KEY --once
```

### 2. Shell Script Integration

```bash
#!/bin/bash
API_KEY="your_api_key"
API_URL="http://localhost:5050"

# Check if service is running
if systemctl is-active --quiet myservice; then
    STATUS="operational"
else
    STATUS="down"
fi

curl -X POST "$API_URL/api/v1/status" \
  -H "Content-Type: application/json" \
  -d "{\"api_key\":\"$API_KEY\",\"service\":\"myservice\",\"status\":\"$STATUS\"}"
```

### 3. Python Application Integration

```python
import requests

class SimpleWatchClient:
    def __init__(self, api_url, api_key):
        self.api_url = api_url
        self.api_key = api_key

    def report_status(self, service, status, metadata=None):
        response = requests.post(
            f"{self.api_url}/api/v1/status",
            json={
                "api_key": self.api_key,
                "service": service,
                "status": status,
                "metadata": metadata
            }
        )
        return response.json()

    def report_metric(self, service_name, value):
        response = requests.post(
            f"{self.api_url}/api/v1/metric/{service_name}",
            json={
                "api_key": self.api_key,
                "value": value
            }
        )
        return response.json()

# Usage
client = SimpleWatchClient("http://localhost:5050", "your_api_key")
client.report_status("my_app", "operational", {"uptime": 99.9})
client.report_metric("error_rate", 0.5)
```

## Status Values

- `operational` - Service is working normally
- `degraded` - Service has issues but still functional
- `down` - Service is not available
- `maintenance` - Service is under planned maintenance
- `unknown` - Status cannot be determined

## Getting Your API Key

1. Log in to SimpleWatch
2. Go to Settings
3. Copy your API key from the "API Key" section

## Need Help?

Check the main README.md and API_DOCS.md for complete documentation.
