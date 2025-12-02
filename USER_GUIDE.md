# SimpleWatch User Guide

Complete guide to using SimpleWatch for monitoring your services.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Understanding the Dashboard](#understanding-the-dashboard)
3. [Creating Monitors](#creating-monitors)
4. [Managing Services](#managing-services)
5. [Setting Up Notifications](#setting-up-notifications)
6. [Using the API](#using-the-api)
7. [User Management](#user-management)
8. [Best Practices](#best-practices)
9. [FAQ](#faq)

---

## Getting Started

### First Login

1. Navigate to http://localhost:5050
2. Enter default credentials:
   - Username: `admin`
   - Password: `changeme`
3. **Important:** Change your password in Settings after first login

### Exploring Example Monitors

SimpleWatch includes 4 working examples to help you understand the capabilities:

1. **Google Search** - Demonstrates website monitoring
2. **Slow Response API** - Shows how timeouts are handled
3. **Server Disk Usage** - Example of metric threshold monitoring
4. **Cloudflare DNS** - Port availability monitoring

These run automatically and update every few minutes.

---

## Understanding the Dashboard

### Dashboard Overview

The dashboard shows real-time status of all your monitored services.

**Status Colors:**
- 🟢 Green: Operational (everything working)
- 🟡 Yellow: Degraded (issues but functional)
- 🔴 Red: Down (not available)
- 🔵 Blue: Maintenance (planned downtime)
- ⚫ Gray: Unknown (no data)

**Auto-Update:**
The dashboard automatically refreshes every 10 seconds, showing the latest status without manual refresh.

**Widget Information:**
Each widget displays:
- Service name with monitor summary (e.g., "2 ✓, 1 ✗" for 2 operational, 1 down)
- Overall service status (aggregated from all monitors)
- Average response time (for website/API/port monitors)
- Last check time

**Monitor Summary Symbols:**
- ✓ - Operational monitors
- ~ - Degraded monitors
- ✗ - Down monitors
- ? - Unknown status monitors

**Detailed Monitor View:**
Click any service card to open a modal showing:
- Individual monitor statuses
- Monitor type and configuration
- Response times or last heartbeat timestamps
- Check intervals
- Status reasons for degraded/down monitors

---

## Creating Monitors

SimpleWatch offers 5 types of built-in monitors that require NO coding.

### Quick Monitor Feature

The fastest way to create a monitor:

1. Click **Services** in navigation
2. Click **Quick Monitor** button
3. Select monitor type
4. Fill in the form
5. Click **Create Monitor**

### Monitor Type 1: Website Monitor

**Use Case:** Check if a website is accessible

**Setup Time:** 60 seconds

**Steps:**
1. Select "Website Monitor"
2. Enter service name (e.g., "Company Website")
3. Enter URL (e.g., https://example.com)
4. Choose check interval (1, 5, 15, 30, or 60 minutes)
5. Set timeout (default: 10 seconds)
6. Create

**How It Works:**
- Makes HTTP GET request to your URL
- Checks response status code
- Measures response time
- Determines status:
  - 200-299: Operational
  - 300-399: Degraded
  - 400+: Down
  - Timeout: Down

**Example Uses:**
- Monitor company website
- Check customer portal
- Watch marketing landing pages
- Track admin panels

### Monitor Type 2: API Monitor

**Use Case:** Check if an API endpoint responds correctly

**Setup Time:** 2 minutes

**Steps:**
1. Select "API Monitor"
2. Enter service name (e.g., "Payment API")
3. Enter API URL
4. Choose method (GET or POST)
5. Set expected status code (usually 200)
6. Choose check interval
7. Create

**How It Works:**
- Calls your API endpoint
- Validates response status code
- Measures response time
- Can validate JSON response structure (advanced)

**Example Uses:**
- Monitor payment gateway health
- Check third-party API integrations
- Watch microservice endpoints
- Track authentication services

### Monitor Type 3: Metric Threshold Monitor

**Use Case:** Send numbers and alert when they exceed thresholds

**Setup Time:** 90 seconds

**Steps:**
1. Select "Metric Threshold Monitor"
2. Enter service name (e.g., "Server Metrics")
3. Optionally enter monitor name (e.g., "disk_usage")
   - Use names when you need multiple metric monitors per service
   - Example: "cpu", "memory", "disk" for one server
4. Set warning threshold (e.g., 75)
5. Set critical threshold (e.g., 90)
6. Choose comparison type:
   - "Greater than" for things that shouldn't be too high (disk usage, error rates)
   - "Less than" for things that shouldn't be too low (sales, inventory)
7. Create

**After Creation:**
You'll see the API endpoint to send values:

```bash
# Both service name and monitor name are required
curl -X POST http://localhost:5050/api/v1/metric/SERVICE_NAME/MONITOR_NAME \
  -H "Content-Type: application/json" \
  -d '{"api_key":"YOUR_KEY","value":87.5}'
```

**How It Works:**
- You send numeric values via API
- SimpleWatch compares against thresholds
- Automatically determines status:
  - Below warning: Operational
  - Between warning and critical: Degraded
  - Above critical: Down

**Example Uses:**
- Monitor daily sales (alert if below target)
- Track error rates (alert if above threshold)
- Watch disk usage (alert when high)
- Monitor queue lengths (alert if backed up)
- Track inventory levels (alert when low)

### Monitor Type 4: Port Monitor

**Use Case:** Check if a TCP port is open and accepting connections

**Setup Time:** 45 seconds

**Steps:**
1. Select "Port Monitor"
2. Enter service name (e.g., "Database Server")
3. Enter host (IP address or hostname)
4. Enter port number
5. Choose check interval
6. Create

**How It Works:**
- Attempts TCP connection to specified port
- Measures connection time
- Determines status:
  - Connection successful: Operational
  - Connection refused/timeout: Down

**Example Uses:**
- Monitor database servers (port 3306, 5432)
- Check SSH access (port 22)
- Watch mail servers (port 25, 587)
- Track internal services
- Monitor DNS servers (port 53)

### Monitor Type 5: Deadman Monitor

**Use Case:** Alert if a scheduled task/process doesn't report in regularly

**Setup Time:** 60 seconds

**Steps:**
1. Select "Deadman Monitor"
2. Enter service name (e.g., "Backup Jobs")
3. Optionally enter monitor name (e.g., "database_backup")
   - Use names when you need multiple deadman monitors per service
   - Example: "database_backup", "file_backup", "log_rotation" for one service
4. Set expected interval (how often should it ping? e.g., 24 hours)
5. Set grace period (extra time before alerting, e.g., 1 hour)
6. Create

**After Creation:**
You'll see the API endpoint to send heartbeats:

```bash
# Both service name and monitor name are required
curl -X POST http://localhost:5050/api/v1/heartbeat/SERVICE_NAME/MONITOR_NAME \
  -H "Content-Type: application/json" \
  -d '{"api_key":"YOUR_KEY"}'
```

**How It Works:**
- Your cron job/script sends a heartbeat ping after each run
- If no ping received within expected interval + grace period, status goes DOWN
- If ping is late but within grace period, status goes DEGRADED
- Dashboard shows timestamp of last heartbeat

**Example Uses:**
- Monitor cron jobs (ping after each run)
- Track backup completion (ping after backup finishes)
- Watch scheduled tasks (ping from Windows Task Scheduler)
- Monitor data pipelines (ping at pipeline end)
- Verify batch processes (ping after processing)

**Practical Example - Daily Backup:**

Create a deadman monitor with:
- Expected interval: 24 hours
- Grace period: 1 hour

Add to your backup script:
```bash
#!/bin/bash
# Run backup
/usr/local/bin/backup.sh

# If successful, send heartbeat
if [ $? -eq 0 ]; then
  curl -X POST http://localhost:5050/api/v1/heartbeat/nightly_backup \
    -H "Content-Type: application/json" \
    -d '{"api_key":"YOUR_KEY"}'
fi
```

**Status Logic:**
- ✅ **Operational:** Heartbeat received within expected interval
- ⚠️ **Degraded:** Heartbeat overdue but within grace period
- ❌ **Down:** No heartbeat for more than interval + grace period

---

## Managing Services

### Viewing All Services

1. Click **Services** in navigation
2. See list of all services and their monitors
3. Each service shows:
   - Name and description
   - Category tag
   - Associated monitors (can have multiple!)
   - Monitor details and status (Active/Inactive)

### Adding a Service Manually

If you want to create a service without a monitor (for API-only updates):

1. Click **Services**
2. Click **Add Service**
3. Enter name, description, and category
4. Click **Create**

### Editing a Service

To update service details:

1. Click **Services**
2. Find the service
3. Click the **Edit** button (pencil icon)
4. Update name, description, or category
5. Click **Update**

### Adding Multiple Monitors to One Service

You can monitor a service in different ways:

1. Click **Services**
2. Find the service
3. Click the **Add Monitor** button (+ icon)
4. Select monitor type (website, API, metric, port, or deadman)
5. Configure and create

**Example:** A "Payment Gateway" service might have:
- Website monitor (check landing page)
- API monitor (check health endpoint)
- Metric monitor (track transaction rate)

### Editing a Monitor

To update monitor configuration:

1. Click **Services**
2. Find the monitor under its service
3. Click the **Edit** button (pencil icon)
4. Update configuration
5. Click **Update**

### Deleting a Service

1. Click **Services**
2. Find the service
3. Click **Delete** button (X icon)
4. Confirm deletion

**Note:** This archives the service and all its monitors. Historical data is retained based on retention policy.

### Deleting a Monitor

1. Click **Services**
2. Find the service with the monitor
3. Click **Delete** button (X icon) next to the monitor
4. Confirm deletion

The service remains with other monitors intact.

---

## Setting Up Notifications

SimpleWatch can automatically notify you when service status changes via email, Slack, Discord, or custom webhooks.

### Overview

Notifications are configured in two steps:
1. **Global Settings** - Configure SMTP or add webhook channels
2. **Per-Service Settings** - Choose which services send notifications and to which channels

### Step 1: Configure Notification Channels

#### Email Notifications (SMTP)

1. Click **Settings** in navigation
2. Go to **Email Notifications** section
3. Enter SMTP configuration:
   - **Host:** smtp.gmail.com (or your mail server)
   - **Port:** 587 (or 465 for SSL, 25 for non-TLS)
   - **Username:** your_email@gmail.com
   - **Password:** Your email password or app-specific password
   - **From Address:** alerts@yourdomain.com
   - **Use TLS:** ✓ (recommended)
4. Click **Save SMTP Configuration**
5. Click **Test** to verify - check your inbox for test email

**Gmail Setup:**
- Enable 2-factor authentication
- Create an App Password at https://myaccount.google.com/apppasswords
- Use the app password (not your regular password)

#### Slack Webhooks

1. Go to https://api.slack.com/messaging/webhooks
2. Create a new webhook for your workspace
3. Copy the webhook URL
4. In SimpleWatch, go to **Settings → Notification Channels**
5. Click **Add Channel**
6. Enter:
   - **Label:** "Team Slack" (or any name)
   - **Type:** Slack
   - **Webhook URL:** Paste your Slack webhook URL
7. Click **Save**
8. Click **Test** to verify - check your Slack channel for test message

#### Discord Webhooks

1. In Discord, go to Server Settings → Integrations → Webhooks
2. Click **New Webhook**
3. Choose a channel and copy the webhook URL
4. In SimpleWatch, go to **Settings → Notification Channels**
5. Click **Add Channel**
6. Enter:
   - **Label:** "Ops Discord" (or any name)
   - **Type:** Discord
   - **Webhook URL:** Paste your Discord webhook URL
7. Click **Save**
8. Click **Test** to verify - check your Discord channel for test message

#### Generic/Custom Webhooks

For any other system (Microsoft Teams, PagerDuty, custom integrations):

1. In SimpleWatch, go to **Settings → Notification Channels**
2. Click **Add Channel**
3. Enter:
   - **Label:** "Custom System"
   - **Type:** Generic
   - **Webhook URL:** Your webhook endpoint
   - **Secret Token:** Optional security token
   - **Custom Payload:** JSON template (optional)
4. Click **Save**
5. Click **Test** to verify

**Default Payload Format:**
```json
{
  "service": "{{service_name}}",
  "old_status": "{{old_status}}",
  "new_status": "{{new_status}}",
  "timestamp": "{{timestamp}}",
  "affected_monitors": [/* monitor details */],
  "all_monitors": [/* all monitor statuses */]
}
```

### Step 2: Configure Per-Service Notifications

Now that channels are set up, configure which services send notifications:

1. Click **Services** in navigation
2. Find the service you want to configure
3. Click the **notification icon** (bell) next to the service
4. Configure notification settings:

**Enable Notifications:**
- ✓ Check to enable notifications for this service
- Uncheck to disable (no notifications will be sent)

**Email Recipients:**
- Enter comma-separated email addresses
- Example: `admin@company.com, ops@company.com, john@company.com`
- Only works if SMTP is configured in Settings

**Notification Channels:**
- Check the webhook channels to notify
- You can select multiple channels (e.g., both Slack and Discord)

**Cooldown Period:**
- Default: 5 minutes
- Prevents notification spam
- If status changes multiple times within cooldown, only first change triggers notification
- **Exception:** Recovery notifications always send (when service comes back up)

**Notify on Recovery:**
- ✓ Checked by default
- Sends notification when service returns to operational status
- Useful to know when issues are resolved
- Bypasses cooldown period

5. Click **Save**

### What Triggers Notifications

Notifications are sent when:
- Service status **changes** (operational → degraded, degraded → down, etc.)
- Status **actually differs** from last notified status
- **Cooldown period** has elapsed (except for recovery)
- Service has **notifications enabled**

Notifications are **NOT** sent when:
- Status remains the same
- Cooldown period is active (unless recovering)
- Notifications disabled for service
- No channels configured

### How Status is Determined

Service status is **aggregated from all monitors**:
- **Operational** - All monitors are operational
- **Degraded** - Some monitors failing, but not all
- **Down** - All monitors are down or critical failures

When any monitor status changes, the overall service status is recalculated and notifications sent if the service status changed.

### Notification Content

#### Email Format
```
Service: Payment Gateway
Current Status: 🔴 DOWN (was operational)
Changed At: 2025-12-02T18:30:00Z

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AFFECTED MONITORS:

❌ API Health Check (api)
   Status: DOWN
   Error: Connection timeout after 10 seconds

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALL MONITORS FOR THIS SERVICE:

✅ Website Check - operational (245ms)
❌ API Health Check - down
✅ Port Check - operational (12ms)

Service is 2/3 monitors operational (DOWN)
```

#### Slack/Discord Format
Rich formatted message with:
- Color-coded status indicator
- Service name and status change
- Timestamp
- List of affected monitors with errors
- Summary of all monitor statuses
- Overall service health fraction

### Managing Notification Channels

**View All Channels:**
1. Go to **Settings → Notification Channels**
2. See list of configured channels
3. Test status indicator shows which were successfully tested

**Edit a Channel:**
1. Click **Edit** button
2. Update configuration
3. Click **Save**
4. **Test again** to verify changes

**Delete a Channel:**
1. Click **Delete** button
2. Confirm deletion
3. Services using this channel will no longer send notifications to it

**Disable a Channel Temporarily:**
1. Click **Toggle** button
2. Channel becomes inactive (notifications won't be sent)
3. Click **Toggle** again to re-enable

### Troubleshooting Notifications

**Not receiving email notifications:**
- Verify SMTP configuration is correct
- Check spam folder
- Test SMTP settings in Settings page
- Ensure "Email Recipients" is filled in service settings
- Check email server logs (if accessible)

**Not receiving Slack/Discord notifications:**
- Verify webhook URL is correct
- Test the channel in Settings → Notification Channels
- Check if channel is active (not toggled off)
- Ensure channel is selected in service notification settings
- Check Slack/Discord webhook logs

**Notifications sending too frequently:**
- Increase cooldown period (default: 5 minutes)
- Check if multiple monitors are flapping (changing status repeatedly)
- Consider adjusting monitor thresholds to be less sensitive

**Not receiving recovery notifications:**
- Verify "Notify on Recovery" is checked in service settings
- Check that service actually returned to operational status
- Look at monitor details to ensure all monitors recovered

**Getting duplicate notifications:**
- This shouldn't happen - notifications track last notified status
- If it occurs, check logs for errors
- Report as a bug

### Best Practices

**Email:**
- Use distribution lists (ops@company.com) rather than individual emails
- Set up email filtering rules to categorize alerts
- Use different recipients for different service criticality

**Slack/Discord:**
- Create dedicated channels for alerts (#alerts, #monitoring)
- Use different channels for different service types
- Configure channel notifications based on criticality

**Cooldown:**
- **Critical services:** 5 minutes (default)
- **Normal services:** 10-15 minutes
- **Low priority:** 30+ minutes

**Recovery Notifications:**
- Keep enabled for critical services (know when issues resolved)
- Consider disabling for services with frequent, brief outages

**Channel Management:**
- Test channels after creation and after changes
- Document which services use which channels
- Review and prune unused channels periodically

---

## Using the API

### Getting Your API Key

1. Click **Settings** in navigation
2. Find "API Key" section
3. Click **Show** to reveal your key
4. Copy the key

**Security:** Keep your API key secret. Anyone with your key can send metrics and heartbeats.

### Sending Metrics

For metric threshold monitors:

```bash
# Both service name and monitor name are required
curl -X POST http://localhost:5050/api/v1/metric/SERVICE_NAME/MONITOR_NAME \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "YOUR_API_KEY",
    "value": 87.5
  }'
```

SimpleWatch automatically determines if the value is OK, warning, or critical based on the thresholds you configured.

**Multiple Metrics Example:**
If monitoring a server with multiple metrics:
```bash
# CPU usage
curl -X POST http://localhost:5050/api/v1/metric/webserver/cpu \
  -H "Content-Type: application/json" \
  -d '{"api_key":"KEY","value":45.2}'

# Memory usage
curl -X POST http://localhost:5050/api/v1/metric/webserver/memory \
  -H "Content-Type: application/json" \
  -d '{"api_key":"KEY","value":68.5}'

# Disk usage
curl -X POST http://localhost:5050/api/v1/metric/webserver/disk \
  -H "Content-Type: application/json" \
  -d '{"api_key":"KEY","value":82.3}'
```

### Sending Heartbeats

For deadman monitors (cron jobs, backups, scheduled tasks):

```bash
# Both service name and monitor name are required
curl -X POST http://localhost:5050/api/v1/heartbeat/SERVICE_NAME/MONITOR_NAME \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "YOUR_API_KEY"
  }'
```

**Cron Example:**
```bash
# Add to crontab - runs daily at 2am and reports success
0 2 * * * /usr/local/bin/backup.sh && curl -X POST http://localhost:5050/api/v1/heartbeat/nightly_backup/database_backup -H "Content-Type: application/json" -d '{"api_key":"YOUR_KEY"}'
```

**Windows Task Scheduler:**
Create a batch file:
```batch
@echo off
REM Run your task
C:\Scripts\backup.bat

REM If successful, send heartbeat
IF %ERRORLEVEL% EQU 0 (
    curl -X POST http://localhost:5050/api/v1/heartbeat/backup_job/windows_backup ^
    -H "Content-Type: application/json" ^
    -d "{\"api_key\":\"YOUR_KEY\"}"
)
```

### Integration with Automation Tools

#### Python Script

```python
import requests

def send_metric(service, monitor, value):
    requests.post(
        f"http://localhost:5050/api/v1/metric/{service}/{monitor}",
        json={
            "api_key": "YOUR_API_KEY",
            "value": value
        }
    )

def send_heartbeat(service, monitor):
    requests.post(
        f"http://localhost:5050/api/v1/heartbeat/{service}/{monitor}",
        json={
            "api_key": "YOUR_API_KEY"
        }
    )

# Examples
send_metric("webserver", "cpu_usage", 45.2)
send_heartbeat("backup_job", "database_backup")
```

---

## User Management

**Note:** Only admin users can manage other users.

### Adding a User

1. Click **Users** in navigation
2. Click **Add User**
3. Enter username and password
4. Optionally add email
5. Check "Admin privileges" if needed
6. Click **Create**

**Each user gets:**
- Their own API key
- Separate dashboard layout
- Access to all services (no per-user permissions yet)

### Deleting a User

1. Click **Users**
2. Find the user
3. Click **Delete**
4. Confirm

**Note:** You cannot delete yourself.

### Regenerating API Keys

If an API key is compromised:

1. Click **Settings**
2. Find "API Key" section
3. Click **Regenerate API Key**
4. Confirm (this invalidates the old key)
5. Update all scripts/integrations with new key

---

## Best Practices

### Monitor Naming

Use clear, descriptive names:
- ✅ "Production Payment API"
- ✅ "Company Website (www.example.com)"
- ❌ "Monitor 1"
- ❌ "Test"

### Check Intervals

Choose appropriate intervals:
- **Critical services:** 1-5 minutes
- **Normal services:** 5-15 minutes
- **Low priority:** 30-60 minutes

More frequent checks = more accurate but more resource usage.

### Metric Thresholds

Set realistic thresholds:
- **Warning:** First sign of issues (75% disk usage)
- **Critical:** Immediate attention needed (90% disk usage)

Leave buffer between warning and critical.

### Service Organization

Use categories to group related services:
- "Infrastructure"
- "Customer-Facing"
- "Internal Tools"
- "Third-Party APIs"

### Monitoring Strategy

**Start Simple:**
1. Monitor critical external-facing services first
2. Add internal infrastructure monitoring
3. Expand to metrics and custom integrations
4. Set up notifications and webhooks

**Don't Over-Monitor:**
- Not everything needs 1-minute checks
- Start with longer intervals, decrease if needed
- Focus on services that impact users

---

## FAQ

### How often does the dashboard update?

Every 10 seconds automatically. No need to refresh.

### Can I monitor services on my local network?

Yes! As long as SimpleWatch can reach the service. Use private IP addresses or hostnames.

### What happens if SimpleWatch is down?

- Monitors stop running
- No data is collected during downtime
- Historical data is preserved
- Monitoring resumes automatically when back up

### Can I export data?

Not yet in the UI, but you can:
- Access SQLite database directly in `./data/simplewatch.db`
- Use API to fetch status history
- Export via SQL queries

### How is data stored?

In SQLite database at `/data/simplewatch.db`. All status updates, services, and user data are stored there.

### How long is data retained?

Default: 90 days. Configure with `DATA_RETENTION_DAYS` environment variable.

### Can I monitor services that require authentication?

- Website monitors: No (basic auth coming soon)
- API monitors: Yes, use custom headers
- Metric monitors: Yes, via API key
- Port monitors: N/A (just TCP connection)

### Can I get email alerts?

Yes! Configure SMTP in Settings → Email Notifications. Then enable notifications for each service. See the "Setting Up Notifications" section above.

### Is there a mobile app?

Not yet. The web interface is mobile-responsive and works on phones/tablets.

### Can I have multiple organizations/teams?

Not yet. SimpleWatch is single-organization. All users see all services.

### How do I backup my data?

1. Stop SimpleWatch: `docker-compose down`
2. Copy `./data` directory
3. Restart: `docker-compose up -d`

Restore by replacing `./data` directory.

### Can I use SimpleWatch in production?

Yes! Recommendations:
- Change default credentials
- Use HTTPS (via reverse proxy)
- Set secure SECRET_KEY
- Enable firewall rules
- Regular backups
- Monitor the monitor (use external service to watch SimpleWatch)

### How many services can I monitor?

Tested with 100+ services. Limitations:
- SQLite performance (good for thousands of records)
- Check frequency (more frequent = more resources)
- Server resources

---

## Need More Help?

- **API Documentation:** See [API_DOCS.md](API_DOCS.md)
- **Examples:** Check [backend/examples/README.md](backend/examples/README.md)
- **Setup Issues:** Review [README.md](README.md) troubleshooting section
- **GitHub Issues:** Report bugs or request features

---

**SimpleWatch** - Making monitoring accessible to everyone.
