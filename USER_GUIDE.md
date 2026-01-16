# SimpleWatch User Guide

Complete guide to using SimpleWatch for monitoring your services.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Understanding the Dashboard](#understanding-the-dashboard)
3. [Creating Monitors](#creating-monitors)
4. [Managing Services](#managing-services)
5. [Maintenance Windows](#maintenance-windows)
6. [Public Status Page](#public-status-page)
7. [Backup & Restore](#backup--restore)
8. [Setting Up Notifications](#setting-up-notifications)
9. [Incident Command Center](#incident-command-center)
10. [AI SRE Companion](#ai-sre-companion)
11. [Using the API](#using-the-api)
12. [User Management](#user-management)
13. [Best Practices](#best-practices)
14. [FAQ](#faq)

---

## Getting Started

### Installation

**Option 1: Docker Hub (Fastest)**

```bash
# Pull and run SimpleWatch from Docker Hub
docker run -p 5050:5050 -v simplewatch-data:/data gdelhaes/simplewatch
```

This creates a volume named `simplewatch-data` to persist your database.

**Option 2: docker-compose**

```bash
# Clone the repository
cd simplewatch
docker-compose up -d
```

### First-Time Setup

1. Navigate to http://localhost:5050
2. You'll see the **Setup Page** on first launch:
   - Choose your admin username
   - Create a secure password (minimum 8 characters)
   - Confirm your password
   - Optionally create example monitors (recommended)
   - Click "Initialize System"
3. You'll be redirected to the login page
4. Log in with the credentials you just created

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

SimpleWatch offers 9 types of built-in monitors that require NO coding.

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

**Use Case:** Monitor API endpoints and webhooks with custom payloads

**Setup Time:** 2 minutes

**Steps:**
1. Select "API Monitor"
2. Enter service name (e.g., "Payment API")
3. Enter API URL
4. Choose HTTP method (GET, POST, PUT, PATCH, DELETE)
5. Set expected status code (usually 200, or 204 for webhooks)
6. Optionally set timeout (default: 10 seconds)
7. Optionally add custom headers (JSON format)
8. Optionally add request body (JSON or raw text)
9. Choose check interval
10. Create

**How It Works:**
- Calls your API endpoint with specified method
- Sends custom headers and request body if configured
- Validates response status code
- Measures response time
- Can validate JSON response structure (advanced)

**Custom Headers Example:**
```json
{
  "Authorization": "Bearer your-token",
  "Content-Type": "application/json"
}
```

**Request Body Example (JSON):**
```json
{
  "key": "value",
  "message": "test"
}
```

**Example Uses:**
- Monitor payment gateway health
- Check third-party API integrations
- Watch microservice endpoints
- Track authentication services
- **Test webhook integrations** (Discord, Slack, custom webhooks)
- Monitor REST API CRUD operations (POST/PUT/PATCH/DELETE)

**Webhook Testing:**
The API monitor can test webhooks by sending POST requests with custom payloads. For example, to test a Discord webhook:
- Method: POST
- Expected Status: 204
- Headers: `{"Content-Type": "application/json"}`
- Body: `{"content": "SimpleWatch test message"}`

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

**Important:** If your service or monitor names contain spaces or special characters, they must be URL-encoded:
- "cpu usage" → "cpu%20usage"
- "disk /var" → "disk%20%2Fvar"
- Most tools (curl, Python requests, etc.) handle this automatically

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

**Important:** If your service or monitor names contain spaces or special characters, they must be URL-encoded:
- "backup job" → "backup%20job"
- "database backup" → "database%20backup"
- Most tools (curl, Python requests, etc.) handle this automatically

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

### Monitor Type 6: SSL Certificate Monitor

**Use Case:** Monitor SSL/TLS certificate expiration and get alerted before certificates expire

**Setup Time:** 45 seconds

**Steps:**
1. Select "SSL Certificate Monitor"
2. Enter service name (e.g., "Company Website SSL")
3. Enter hostname (e.g., "example.com" or "www.example.com")
4. Enter port (default: 443 for HTTPS)
5. Set warning threshold in days (default: 30 days)
6. Set critical threshold in days (default: 7 days)
7. Choose check interval (default: 24 hours/daily)
8. Create

**How It Works:**
- Connects to the specified hostname and port
- Retrieves the SSL/TLS certificate
- Calculates days until certificate expiration
- Determines status:
  - More than warning threshold: Operational
  - Between warning and critical: Degraded
  - Less than critical or expired: Down
- Dashboard displays days until expiry and expiration date

**Example Uses:**
- Monitor website SSL certificates
- Track API endpoint certificates
- Watch multiple domain certificates
- Alert before certificate renewal deadlines
- Ensure certificates are renewed on time

**Practical Example - Website Certificate:**

Create an SSL certificate monitor with:
- Hostname: www.example.com
- Port: 443
- Warning threshold: 30 days
- Critical threshold: 7 days
- Check interval: 24 hours (daily)

The monitor will:
- Check certificate once per day
- Alert 30 days before expiration (degraded status)
- Alert 7 days before expiration (down status)
- Show exact expiration date and days remaining on dashboard

**Status Logic:**
- ✅ **Operational:** Certificate valid for > 30 days
- ⚠️ **Degraded:** Certificate expires in 8-30 days (warning)
- ❌ **Down:** Certificate expires in ≤ 7 days or already expired

**Benefits:**
- Never miss certificate renewals
- Get early warnings before expiration
- Monitor multiple certificates in one place
- Automatic daily checks (no manual tracking)
- See exact expiration dates at a glance

### Monitor Type 7: DNS Monitor

**Use Case:** Verify DNS record resolution and ensure DNS records point to the correct values

**Setup Time:** 60 seconds

**Steps:**
1. Select "DNS Monitor"
2. Enter service name (e.g., "Company DNS")
3. Enter hostname to query (e.g., "example.com")
4. Select record type (A, AAAA, CNAME, MX, or TXT)
5. Enter expected value (e.g., "93.184.216.34" for A record)
6. Optionally specify DNS server (e.g., "8.8.8.8"), leave blank for system default
7. Set timeout (default: 5 seconds)
8. Choose check interval
9. Create

**How It Works:**
- Queries the specified DNS server for the hostname
- Retrieves the DNS record of the specified type
- Compares the result with the expected value
- Determines status:
  - Record matches expected value: Operational
  - Record doesn't match: Down
  - DNS query timeout or error: Down

**Example Uses:**
- Verify website DNS points to correct IP
- Monitor mail server MX records
- Check CDN CNAME records
- Ensure TXT records for domain verification
- Track DNS propagation after changes
- Monitor backup DNS servers

**Practical Example - Website DNS:**

Create a DNS monitor with:
- Hostname: www.example.com
- Record type: A
- Expected value: 93.184.216.34
- DNS server: 8.8.8.8 (Google DNS)
- Check interval: 15 minutes

The monitor will alert if DNS resolves to a different IP, indicating potential DNS hijacking or misconfiguration.

**Status Logic:**
- ✅ **Operational:** DNS record matches expected value
- ❌ **Down:** DNS record doesn't match, timeout, or query error

### Monitor Type 8: Ping/ICMP Monitor

**Use Case:** Check host reachability and network latency via ICMP ping

**Setup Time:** 45 seconds

**Steps:**
1. Select "Ping Monitor"
2. Enter service name (e.g., "Network Gateway")
3. Enter host (IP address or hostname, e.g., "8.8.8.8")
4. Set packet count (default: 4)
5. Set timeout (default: 5 seconds)
6. Set latency threshold in milliseconds (default: 200ms)
7. Set packet loss threshold as percentage (default: 20%)
8. Choose check interval
9. Create

**How It Works:**
- Sends ICMP echo requests to the host
- Measures round-trip time (RTT) for each packet
- Calculates average, min, and max latency
- Measures packet loss percentage
- Determines status:
  - All packets received, latency below threshold: Operational
  - Packet loss or latency exceeds threshold: Degraded
  - Host unreachable or complete packet loss: Down

**Example Uses:**
- Monitor network gateway availability
- Check server reachability
- Measure network latency to remote locations
- Verify VPN connections
- Monitor ISP uptime
- Track quality of network links

**Practical Example - Gateway Monitor:**

Create a ping monitor with:
- Host: 192.168.1.1 (your router)
- Packet count: 4
- Timeout: 5 seconds
- Latency threshold: 50ms
- Packet loss threshold: 10%
- Check interval: 1 minute

The monitor will alert if your gateway becomes unreachable or network quality degrades.

**Status Logic:**
- ✅ **Operational:** Host reachable, latency < threshold, packet loss < threshold
- ⚠️ **Degraded:** Host reachable but latency or packet loss exceeds threshold
- ❌ **Down:** Host unreachable or complete packet loss

**Displayed Metrics:**
- Average RTT (round-trip time)
- Minimum RTT
- Maximum RTT
- Packet loss percentage
- Packets sent/received

### Monitor Type 9: SEO Monitor

**Use Case:** Perform comprehensive SEO health checks on web pages

**Setup Time:** 60 seconds

**Steps:**
1. Select "SEO Monitor"
2. Enter service name (e.g., "Homepage SEO")
3. Enter URL to check (e.g., "https://example.com")
4. Set timeout (default: 10 seconds)
5. Enable checks you want to perform:
   - **Title Tag** - Verify page has a title
   - **Meta Description** - Check for meta description
   - **H1 Heading** - Ensure page has H1 tag
   - **Canonical URL** - Verify canonical link tag
   - **Robots Meta** - Check robots meta tag
   - **Sitemap** - Verify sitemap.xml accessibility
   - **Structured Data** - Validate JSON-LD structured data
6. Choose check interval (default: 24 hours/daily)
7. Create

**How It Works:**
- Fetches the specified URL
- Parses HTML and extracts SEO elements
- Validates each enabled check
- Reports findings with specific issues
- Determines status:
  - All checks pass: Operational
  - Some issues found: Degraded
  - Critical SEO problems or page unreachable: Down

**Example Uses:**
- Monitor homepage SEO health
- Track product page SEO compliance
- Verify blog post SEO elements
- Ensure landing pages have proper metadata
- Monitor sitemap accessibility
- Validate structured data implementation

**Practical Example - Homepage SEO:**

Create an SEO monitor with:
- URL: https://example.com
- All checks enabled
- Check interval: 24 hours (daily)

The monitor will alert if:
- Title tag is missing or empty
- Meta description is missing
- No H1 heading found
- Canonical URL is missing
- Sitemap.xml is not accessible
- Structured data is invalid

**Status Logic:**
- ✅ **Operational:** All enabled checks pass
- ⚠️ **Degraded:** Some non-critical SEO issues detected
- ❌ **Down:** Critical SEO problems or page unreachable

**Displayed Information:**
- SEO score breakdown
- Missing elements
- Issues found
- Structured data validation results
- Recommendations for improvement

**Benefits:**
- Automated SEO monitoring
- Early detection of SEO regressions
- Ensure consistent SEO across deployments
- Track sitemap availability
- Validate structured data markup
- Peace of mind for marketing teams

### Monitor Type 10: Ollama/Local LLM Monitor

**Use Case:** Monitor local LLM API availability and model loading status

**Setup Time:** 60 seconds

**Steps:**
1. Select "Ollama/LLM Monitor"
2. Enter service name (e.g., "Local AI Server")
3. Enter host (e.g., "localhost" or "host.docker.internal" when running in Docker)
4. Enter port:
   - Ollama: 11434 (default)
   - LM Studio: 1234 (default)
   - LocalAI: 8080 (default)
5. Choose protocol (HTTP or HTTPS)
6. Select API type (Ollama, LM Studio, or OpenAI Compatible)
7. Optionally specify expected model name (e.g., "llama3.2:latest")
8. Set timeout (default: 10 seconds)
9. Set slow response threshold (default: 5000ms)
10. Choose check interval (default: 5 minutes)
11. Create

**How It Works:**
- Checks if LLM API is responding
- Verifies models are loaded and accessible
- Tests completion endpoint for APIs that show all available models
- Validates expected model is actually loaded (if specified)
- Measures response time
- Determines status:
  - API responding, models loaded: Operational
  - Slow responses or wrong model loaded: Degraded
  - API down or no models loaded: Down

**Example Uses:**
- Monitor Ollama server availability
- Ensure LM Studio has models loaded
- Track LocalAI API health
- Verify specific AI models are running
- Monitor self-hosted AI infrastructure
- Alert if local LLM services go offline

**Practical Example - Ollama Server:**

Create an Ollama monitor with:
- Host: localhost (or host.docker.internal if SimpleWatch runs in Docker)
- Port: 11434
- Protocol: HTTP
- API Type: Ollama
- Expected Model: llama3.2:latest
- Check interval: 5 minutes

The monitor will:
- Check API availability every 5 minutes
- Verify llama3.2:latest is loaded
- Alert if model is unloaded or different model is running
- Show loaded model name in dashboard modal
- Track response time

**API-Specific Behaviors:**

**Ollama:**
- Uses `/api/tags` endpoint (shows only loaded models)
- If expected model specified, checks if it's in the loaded models list
- If no models loaded, status becomes degraded

**LM Studio:**
- Uses `/v1/models` endpoint (shows all available models)
- Tests `/v1/chat/completions` to verify a model is actually loaded in memory
- If expected model specified, verifies the loaded model matches
- Detects "no models loaded" error and sets status to degraded

**OpenAI Compatible (LocalAI, etc.):**
- Uses standard OpenAI-compatible endpoints
- Tests completion request to verify model availability
- Validates expected model if specified

**Status Logic:**
- ✅ **Operational:** API responds, models loaded, response time normal
- ⚠️ **Degraded:** Slow responses, wrong model loaded, or no models loaded
- ❌ **Down:** API unreachable, connection refused, or timeout

**Displayed Metrics (in modal):**
- Response Time (milliseconds)
- Loaded Model (which model is currently active)
- Available Models (count of models)
- Model status (expected vs actual)

**Docker Networking Note:**
When SimpleWatch runs in Docker and you want to monitor LLM services on your host machine:
- Use `host.docker.internal` instead of `localhost`
- Example: `host.docker.internal:11434` for Ollama on Mac/Windows Docker Desktop

**Benefits:**
- Monitor self-hosted AI infrastructure
- Ensure LLM services stay online
- Verify correct models are loaded
- Track AI API response times
- First monitoring tool specifically for local LLMs
- Perfect for privacy-focused AI deployments

### Monitor Type 11: GitHub Actions CI/CD Monitor

**Use Case:** Monitor CI/CD workflow status for GitHub repositories

**Setup Time:** 60 seconds

**Steps:**
1. Select "GitHub Actions"
2. Enter service name (e.g., "Main Repository CI")
3. Enter repository owner (GitHub username or organization, e.g., "vercel")
4. Enter repository name (e.g., "next.js")
5. Optionally specify workflow file (e.g., "ci.yml") - leave blank to monitor all workflows
6. Optionally specify branch (e.g., "main") - leave blank to monitor all branches
7. Optionally enter GitHub token for higher rate limits (5000/hr vs 60/hr unauthenticated)
8. Set success threshold percentage (default: 80%) - marks degraded if success rate falls below
9. Set timeout (default: 10 seconds)
10. Choose check interval (default: 30 minutes, recommended to avoid rate limits)
11. Create

**How It Works:**
- Queries GitHub Actions API for workflow runs
- Analyzes last 20 runs to calculate success rate
- Tracks latest build status (success/failure/running)
- Calculates average build duration
- Monitors API rate limit consumption
- Determines status:
  - Latest build passed and success rate ≥ threshold: Operational
  - Latest build failed or success rate below threshold: Degraded
  - API error, repo not found, or rate limited: Down

**Example Uses:**
- Monitor main branch build health
- Track deployment pipeline success
- Alert on failing CI/CD workflows
- Monitor open-source project builds
- Ensure test suites are passing
- Track build performance trends

**Practical Example - Production CI Pipeline:**

Create a GitHub Actions monitor with:
- Owner: yourcompany
- Repo: backend-api
- Workflow: deploy.yml
- Branch: main
- Success threshold: 90%
- Check interval: 30 minutes

The monitor will:
- Check main branch deploy.yml workflow every 30 minutes
- Calculate success rate from last 20 runs
- Alert if success rate drops below 90%
- Show latest build status and link to run
- Display average build time

**Rate Limits:**
- **Without token:** 60 requests/hour (sufficient for 4-5 repos at 30-min intervals)
- **With token:** 5000 requests/hour (monitor hundreds of repos)

**Status Logic:**
- ✅ **Operational:** Latest build succeeded, success rate ≥ threshold
- ⚠️ **Degraded:** Latest build failed OR success rate below threshold
- ❌ **Down:** Repository not found, API error, or rate limited

**Displayed Metrics (in modal):**
- Response Time (GitHub API response time)
- Success Rate (percentage of successful builds)
- Latest Build (success/failure/running with run number and link)
- Avg Build Time (average duration across recent runs)
- API Rate Limit (remaining requests)

**Testing with Public Repositories:**
You can test the monitor with popular public repos:
- vercel/next.js (large active project)
- facebook/react (stable builds)
- rust-lang/rust (comprehensive CI)

**Benefits:**
- Monitor CI/CD health without Jenkins/CircleCI dashboards
- Track build success rates over time
- Get alerts when pipelines break
- No GitHub Actions setup required (read-only)
- Works with public and private repos (with token)
- Perfect for DevOps teams tracking deployment health

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

### Pausing a Service

Temporarily disable a service and all its monitors without deleting data:

1. Click **Services**
2. Find the service
3. Click **Pause** button (pause icon)
4. Service and all attached monitors are paused

**What happens when paused:**
- Service stops being monitored (no checks run)
- All attached monitors are also paused
- Service shows with dashed border and "(Paused)" label
- Historical data is retained
- Can be resumed at any time

### Resuming a Service

Reactivate a paused service:

1. Click **Services**
2. Find the paused service
3. Click **Resume** button (play icon)
4. Service and all attached monitors are resumed

### Pausing a Monitor

Temporarily disable a single monitor:

1. Click **Services**
2. Find the monitor under its service
3. Click **Pause** button (pause icon) next to the monitor

**Note:** If you pause all monitors for a service, the service will automatically pause as well. A service must have at least one active monitor to remain active.

### Resuming a Monitor

Reactivate a paused monitor:

1. Click **Services**
2. Find the paused monitor
3. Click **Resume** button (play icon) next to the monitor

**Note:** If the service was paused, resuming a monitor will automatically resume the service.

### Deleting a Service

Permanently delete a service and all associated data:

1. Click **Services**
2. Find the service
3. Click **Delete** button (X icon)
4. Confirm deletion

**Warning:** This permanently deletes the service, all monitors, and all historical status data via CASCADE delete. This action cannot be undone. Consider pausing instead if you want to temporarily disable monitoring.

### Deleting a Monitor

Permanently delete a monitor:

1. Click **Services**
2. Find the service with the monitor
3. Click **Delete** button (X icon) next to the monitor
4. Confirm deletion

**Note:** The service remains with other monitors intact. If you delete all monitors for a service, the service will automatically pause. Historical data for this monitor is permanently deleted via CASCADE delete.

---

## Maintenance Windows

Maintenance windows allow you to schedule planned maintenance periods during which notifications are suppressed. This prevents false alerts while you perform updates, migrations, or other scheduled work.

### What Happens During Maintenance

When a service is in an active maintenance window:

- **Notifications are suppressed** - No alerts sent even if monitors fail
- **Monitoring continues** - Monitors still run and record status
- **Dashboard shows maintenance badge** - Violet "IN MAINTENANCE" badge displayed
- **Public status page shows banner** - Customers see maintenance message
- **Incidents still tracked** - Outages during maintenance are recorded

### Scheduling Maintenance

To schedule maintenance for a service:

1. Click **Services** in the navigation
2. Find your service
3. Click the **wrench icon** (Schedule maintenance button)
4. In the maintenance modal:
   - **Start Time:** When maintenance begins
   - **End Time:** When maintenance ends
   - **Recurrence:** Choose maintenance pattern:
     - **One-time:** Single maintenance window
     - **Daily:** Repeat every day at the same time
     - **Weekly:** Repeat on specific days (check days: Mon, Tue, Wed, etc.)
     - **Monthly:** Repeat on the same day each month
   - **Reason:** Optional description (e.g., "Database migration")
5. Click **Schedule Maintenance**

**Example:** Schedule weekly maintenance every Wednesday at 2 AM for 2 hours:
- Start: 2026-01-15 02:00
- End: 2026-01-15 04:00
- Recurrence: Weekly
- Days: Wednesday ☑
- Reason: "Weekly database optimization"

### Viewing Scheduled Maintenance

After scheduling, the maintenance window appears in the modal:

- **Status badges:**
  - `Scheduled` - Maintenance is planned for the future
  - `In Progress` - Maintenance is currently active
  - `Completed` - Maintenance has finished
  - `Cancelled` - Maintenance was cancelled early

- **Window details:**
  - Start and end times (displayed in your local timezone)
  - Recurrence pattern (if applicable)
  - Reason/description

### Cancelling Active Maintenance

If maintenance finishes early:

1. Open the maintenance modal
2. Find the active maintenance window
3. Click **End Early** button
4. The window status changes to `Cancelled` and notifications resume

### Deleting Scheduled Maintenance

To delete a future maintenance window:

1. Open the maintenance modal
2. Find the scheduled window
3. Click **Delete** button (trash icon)
4. Confirm deletion

**Note:** Only scheduled (future) windows can be deleted. Active windows must be cancelled instead.

### Recurring Maintenance

Recurring maintenance automatically creates new windows when the current one completes:

**Daily Recurrence:**
- Creates new window for next day at same time
- Continues indefinitely until you delete the pattern

**Weekly Recurrence:**
- Creates windows for selected days only
- Example: Monday + Thursday creates two windows per week

**Monthly Recurrence:**
- Repeats on same day of month (e.g., 15th of each month)
- Use day `-1` for last day of month

**Managing Recurring Windows:**
- Deleting a scheduled window only removes that occurrence
- Future occurrences continue as scheduled
- To stop recurrence, delete all future windows

### Maintenance on Dashboard

When a service is in maintenance:

- **Violet badge** displays at top-right of service card
- Badge shows "IN MAINTENANCE" or "SCHEDULED"
- Hover for details (end time, reason)
- **Violet top border** on service card indicates active maintenance

### Maintenance on Public Status Page

Customers visiting `/status` see maintenance information:

**Active maintenance:**
- Violet banner: "🔧 Service under maintenance"
- Shows: "Maintenance expected to complete: [time]"
- Optional reason displayed

**Upcoming maintenance (within 24 hours):**
- Blue banner: "ℹ️ Scheduled maintenance"
- Shows: "Starting: [time]"
- Optional reason displayed

### Best Practices

**Schedule maintenance in advance:**
- Create windows before starting work
- Gives team visibility into maintenance schedule
- Prevents confusion from expected downtime

**Use descriptive reasons:**
- "Database migration to PostgreSQL 15"
- "SSL certificate renewal"
- "Network infrastructure upgrade"

**Test before maintenance:**
- Verify monitors detect the outage correctly
- Confirm maintenance suppresses notifications
- Check public status page display

**Coordinate with team:**
- Schedule during low-traffic periods
- Notify stakeholders in advance
- Keep maintenance windows realistic

**Monitor completion:**
- Cancel maintenance early if finishing ahead of schedule
- Allows notifications to resume sooner
- Improves alert responsiveness

---

## Public Status Page

The public status page allows you to share service status with customers and stakeholders without requiring login. It provides transparency during outages and scheduled maintenance.

### Accessing the Status Page

The public status page is available at:

```
http://your-simplewatch-url:5050/status
```

**Example:** `http://monitor.yourcompany.com:5050/status`

**No authentication required** - Anyone with the URL can view it.

### Enabling Services on Status Page

By default, services are **not shown** on the public status page. To enable:

1. Click **Services** in navigation
2. Click **Edit** (pencil icon) next to the service
3. Check **"Show on status page"**
4. Click **Save Changes**

The service now appears on the public status page.

### What's Displayed

The status page shows:

**Header:**
- **SimpleWatch** branding
- **Overall system status** with pulse indicator:
  - Green pulse: All systems operational
  - Amber pulse: Partial outage (some services degraded)
  - Red pulse: System outage (services down)
- **Theme toggle** - Switch between light and dark mode

**Service Cards:**
Each service shows:
- **Service name** and description
- **Current status badge** (Operational/Degraded/Down)
- **7-day uptime percentage**
- **Maintenance banners** (if in maintenance or upcoming)
- **Recent incidents** (ongoing or last resolved within 48h)

**Incident Information:**
- **Active incident:** Shows "Active Incident" header with start time and duration
- **Recent incident:** Shows "Recent Incident" if resolved within 48 hours
- If no incidents in 48 hours: Section hidden

**Maintenance Banners:**
- **Active maintenance:** Violet banner with expected completion time
- **Upcoming maintenance:** Blue banner with start time (if within 24 hours)

**Footer:**
- **Last updated timestamp**
- **Auto-refresh notice** (refreshes every 30 seconds)

### Customizing Status Page

**Theme:**
- Users can toggle between light and dark mode
- Preference saved in browser
- Applies to entire status page

**Service Ordering:**
- Services appear in the order they were created
- Customize by editing service order in database (advanced)

**Status Page Privacy:**
- Status page is public by default
- To restrict access, use reverse proxy with authentication
- Or deploy SimpleWatch behind VPN

### Sharing the Status Page

**With customers:**
- Add link to your main website footer
- Include in service documentation
- Share in incident communications

**Best practices:**
- Use memorable URL (e.g., status.yourcompany.com)
- Keep service names customer-friendly
- Write clear incident descriptions
- Update maintenance reasons to be informative

**Example HTML snippet for your site:**
```html
<a href="http://status.yourcompany.com:5050/status" target="_blank">
  System Status
</a>
```

### Status Page Use Cases

**During Incidents:**
- Reduces support ticket volume
- Provides real-time status updates
- Shows affected services clearly
- Displays incident duration

**During Maintenance:**
- Informs customers of planned work
- Sets expectations for completion
- Reduces confusion from expected downtime

**Business As Usual:**
- Builds customer trust with transparency
- Demonstrates system reliability (high uptime)
- Shows proactive monitoring

### Mobile Access

The status page is fully responsive:
- Works on phones and tablets
- Readable without zooming
- Touch-friendly buttons
- Auto-refreshes on mobile

### Auto-Refresh

The page automatically refreshes every 30 seconds to show current status without manual reload.

**Note:** If actively viewing during an incident, the page updates in real-time as services recover.

---

## Backup & Restore

SimpleWatch provides export and import functionality to back up your service configurations or migrate them to another instance.

### What's Included in Export/Import

**Included:**
- Service configurations (name, description, category, active status)
- Monitor configurations (type, settings, check intervals, active status)

**Not Included:**
- Historical status update data
- Notification channel settings
- Notification configuration per service
- User accounts

### Exporting Services

Back up your service configurations:

1. Click **Settings** in navigation
2. Scroll to **Service Backup & Restore** section
3. Click **Export Configuration**
4. Select which services to export (all selected by default)
5. Click **Export Selected**
6. JSON file downloads automatically

**Tips:**
- Export filename includes timestamp (e.g., `simplewatch_export_20250115_143022.json`)
- You can export all services or select specific ones
- Export before major configuration changes as a backup
- Store exports securely as they contain service URLs and settings

### Importing Services

Restore or migrate service configurations:

1. Click **Settings** in navigation
2. Scroll to **Service Backup & Restore** section
3. Click **Import Configuration**
4. Upload your JSON export file (click or drag & drop)
5. Click **Validate File** to preview what will be imported
6. Review the preview:
   - **NEW** services will be created
   - **EXISTS** services will be skipped (never overwritten)
7. Select which services to import (optional)
8. Click **Import Selected**
9. Review import results

**Important Behaviors:**
- **Never overwrites existing services** - protects your historical data
- Services with duplicate names are automatically skipped
- Imported monitors are scheduled to run their first check 1 minute after import
- If import is interrupted, partial imports may occur (database transactions per service)

### Common Use Cases

**Backup Before Changes:**
```
1. Export all services
2. Make risky configuration changes
3. If problems occur, delete broken services and re-import
```

**Migrating to New Instance:**
```
1. Export from old SimpleWatch instance
2. Install SimpleWatch on new server
3. Import configuration file
4. Reconfigure notification channels (not included in export)
5. Verify monitors are running
```

**Cloning Environments:**
```
1. Export production services
2. Import to staging instance
3. Modify URLs/endpoints for staging
4. Test changes in staging before production
```

**Disaster Recovery:**
```
1. Schedule regular exports (manual for now)
2. Store exports in secure location
3. If database corruption occurs, restore from export
4. Note: Historical data is lost, but configurations are preserved
```

### After Importing

Once import completes:

1. **Check Dashboard** - Verify services appear
2. **Wait 1-2 minutes** - Monitors begin their first checks
3. **Verify Status Updates** - Ensure monitors are running
4. **Reconfigure Notifications** - Set up notification channels and service notification settings
5. **Test Alerts** - Send test notifications to verify

### Troubleshooting Import Issues

**"Service already exists" for all services:**
- Export was created from the same instance you're importing to
- Service names conflict with existing services
- Either delete conflicting services first or skip them in the import

**Monitors not running after import:**
- Wait at least 1 minute for scheduler to pick up monitors
- Check Dashboard for status updates
- View Docker logs: `docker-compose logs -f simplewatch`
- Look for scheduler messages about monitor checks

**Import validation fails:**
- Ensure JSON file is a valid SimpleWatch export
- Check export_version is "1.0"
- Verify JSON is not corrupted

**Partial import (some succeed, some fail):**
- Review import results for error details
- Failed services can be retried by importing again (succeeded ones will be skipped)

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

## Incident Command Center

The Incident Command Center provides comprehensive incident tracking, analytics, and reporting capabilities. Access it by clicking **Incidents** in the navigation bar.

### What is an Incident?

An **incident** is automatically created whenever a service transitions from "operational" to "degraded" or "down" status. SimpleWatch tracks:
- When the incident started
- Which monitors were affected
- Severity level (degraded or down)
- Duration (calculated when resolved)
- Current status (ongoing or resolved)

Incidents are automatically resolved when the service returns to operational status.

### Dashboard Overview

The Incident Command Center displays:

#### Summary Statistics
- **Total Incidents** - Count of all incidents in the selected time window
- **Mean Time To Recovery (MTTR)** - Average incident duration (only resolved incidents)
- **Uptime** - Percentage of time services were operational
- **Critical Incidents** - Count of "down" severity incidents vs "degraded"

#### Visual Analytics
- **Incident Timeline** - Line chart showing incident frequency over time
- **By Service** - Bar chart breaking down incidents by service

#### Filters
- **Time Window** - 24 hours, 7 days, 30 days, 90 days, or all time
- **Service** - Filter by specific service or view all services
- **Status** - Filter by ongoing, resolved, or all incidents

### Incident Log

The incident log table shows complete incident history with:
- **Service** - Which service experienced the incident
- **Started** - Incident start time (and end time if resolved)
- **Duration** - How long the incident lasted
- **Severity** - Degraded or Down
- **Status** - Ongoing or Resolved
- **Affected Monitors** - Which specific monitors detected the issue

Click column headers to sort by any field.

### Filtering and Analysis

**Time Window Filtering:**
- All filters affect statistics, charts, and the incident log simultaneously
- Choose shorter windows (24h, 7d) for recent incident analysis
- Use longer windows (30d, 90d) for trend analysis
- Select "All Time" for complete historical view

**Service Filtering:**
- Select a specific service to see only its incidents
- When filtered, uptime percentage shows that service's uptime
- Use this for service-specific reliability reports

**Status Filtering:**
- "Ongoing" - View active incidents requiring attention
- "Resolved" - View historical incidents for post-mortems
- "All" - Complete incident history

### Exporting Data

Click **Export CSV** to download incident data including:
- Incident ID and service name
- Start and end timestamps
- Duration in seconds
- Severity and status
- Affected monitor details

**Use cases for export:**
- Monthly reliability reports
- SLA compliance documentation
- Executive summaries
- Post-incident review documentation
- Trend analysis in spreadsheets

### Understanding Uptime Calculation

The uptime percentage uses the same accurate StatusUpdate-based calculation as the dashboard:
- Counts operational time from every monitor check (not just incidents)
- Includes ongoing incidents in the calculation
- When filtering by service, shows that service's specific uptime
- When viewing all services, shows average uptime across all services

### Common Use Cases

**Post-Incident Review:**
1. Filter to the incident timeframe
2. Identify affected services and monitors
3. Review incident duration and severity
4. Export data for incident report

**SLA Compliance Reporting:**
1. Set time window to reporting period (e.g., 30 days)
2. Filter by service if needed
3. Note uptime percentage for SLA verification
4. Export for documentation

**Reliability Trends:**
1. Use 90-day or All Time view
2. Examine incident timeline chart for patterns
3. Check "By Service" chart to identify problematic services
4. Review MTTR trends over time

**Identifying Problem Services:**
1. View "All Services" with 30-day window
2. Sort incident log by service
3. Check "By Service" chart for highest incident counts
4. Drill down into specific services for details

### Best Practices

**Regular Review:**
- Check the Incident Center weekly to identify trends
- Review MTTR to ensure efficient incident response
- Monitor uptime percentages for SLA compliance

**Documentation:**
- Export incident data monthly for records
- Use CSV exports in post-incident reviews
- Track MTTR improvements over time

**Proactive Monitoring:**
- Use "Ongoing" filter to see active incidents
- Set up notification channels (Email, Slack, Discord) for real-time alerts
- Review frequently-failing services for underlying issues

**Reporting:**
- Generate monthly reliability reports from exported data
- Include MTTR and uptime trends in team meetings
- Use incident breakdown by service to prioritize infrastructure improvements

---

## AI SRE Companion

The AI SRE Companion provides intelligent incident analysis, remediation suggestions, and automated post-mortem report generation. It integrates with local LLMs (Ollama) or cloud providers (OpenAI, Anthropic) to analyze incidents and suggest actions.

### Overview

The AI SRE Companion helps you:
- **Analyze incidents automatically** - AI reviews incidents as they occur
- **Get remediation suggestions** - Receive AI-generated recommendations with confidence scores
- **Execute webhooks** - Trigger configured remediation actions with approval workflow
- **Generate post-mortems** - Create comprehensive incident reports with one click
- **Track AI decisions** - Full audit log of all AI suggestions and actions

### Setting Up AI Provider

#### Step 1: Enable AI SRE

1. Click **Settings** in navigation
2. Scroll to **AI SRE Companion** section
3. Toggle **Enable AI SRE Companion** to ON

#### Step 2: Configure Provider

Choose from three provider options:

**Local (Ollama) - Recommended for Privacy:**
1. Select "Local (Ollama)" as provider
2. Enter endpoint URL (default: `http://localhost:11434`)
3. Enter model name (e.g., `llama3.2`, `mistral`, `codellama`)
4. No API key required

**OpenAI:**
1. Select "OpenAI" as provider
2. Enter your OpenAI API key
3. Enter model name (e.g., `gpt-4o`, `gpt-4-turbo`, `gpt-3.5-turbo`)

**Anthropic:**
1. Select "Anthropic" as provider
2. Enter your Anthropic API key
3. Enter model name (e.g., `claude-sonnet-4-20250514`, `claude-3-haiku-20240307`)

#### Step 3: Test Connection

1. Click **Test Connection**
2. Verify success message appears
3. The AI status indicator in the navigation will turn green

### AI Status Indicator

A small AI indicator appears in the navigation bar showing:
- **Green dot** - AI connected and working
- **Red dot** - AI connection failed
- **Gray dot** - AI not enabled

Click the indicator to see:
- Connection status
- Provider and model being used
- Last successful query time

### Automatic vs Manual Analysis

Configure how AI analyzes incidents:

**Auto-Analyze Incidents (Recommended):**
- Toggle ON in AI settings
- AI automatically analyzes incidents when they occur
- No manual action needed
- Uses tokens for each incident

**Manual Analysis Only:**
- Toggle OFF to disable automatic analysis
- Click "Analyze with AI" on service cards to trigger analysis
- Saves tokens but requires manual intervention

### Using AI Suggestions

When an incident occurs and AI is enabled:

1. **View Suggestions**: Click on a service card to open the service detail modal
2. **Review Analysis**: AI suggestions appear inside the modal with:
   - Description of recommended action
   - Reasoning for the suggestion
   - Confidence score (0-100%)
   - Webhook details (if configured)
3. **Approve or Dismiss**:
   - Click **Approve** to execute the suggested action
   - Click **Dismiss** to reject the suggestion

### Configuring Per-Service AI

Customize AI behavior for each service:

1. Click **Services** in navigation
2. Click **Edit** (pencil icon) on a service
3. Scroll to **AI Configuration** section (visible when AI is enabled)

**Service Context:**
- Describe what the service does
- Include deployment information
- Example: "Node.js API running on AWS ECS, port 3000, connects to PostgreSQL"

**Known Issues:**
- Document common problems and solutions
- AI uses this context for better recommendations
- Example: "Sometimes needs restart after memory exceeds 2GB"

**Remediation Webhooks:**
Configure actions AI can suggest:

1. Click **+ Add Webhook**
2. Enter:
   - **Action Name**: "Restart Service", "Clear Cache", etc.
   - **Method**: POST, GET, PUT, DELETE
   - **URL**: Webhook endpoint
   - **Payload** (optional): JSON body
   - **Headers** (optional): Custom headers including auth tokens
3. Click **Save Webhook**

AI will suggest these webhooks when relevant to the incident.

### Post-Mortem Reports

Generate AI-written incident reports:

#### Single Incident Report:
1. Go to **Incidents** page
2. Find the incident in the log
3. Click the **Report** button in the Report column
4. AI generates a comprehensive post-mortem

#### Date Range Report:
1. Go to **Incidents** page
2. Click **Generate Report** header button
3. Select service and date range
4. Click **Generate**

**Report Contents:**
- Incident summary and timeline
- Affected services and monitors
- Duration and impact analysis
- Observations (not assumptions)
- Recommended investigation areas
- Unknown factors (what data is missing)

**Report Actions:**
- **Download**: Save as .md file
- **Copy**: Copy to clipboard
- View in modal with markdown rendering

### Action History & Audit Log

Track all AI decisions:

1. Go to **Incidents** page
2. Expand the **AI Action History** section (collapsible)
3. View history table showing:
   - Timestamp
   - Service name
   - Action description
   - Confidence score
   - Status (pending/executed/failed/rejected)
   - Executed by (user or "auto")

**Filtering:**
- Filter by service
- Filter by status (pending, executed, failed, rejected)

**Export:**
- Click **Export CSV** to download audit log
- Use for compliance and reporting

### Auto-Execute (Advanced)

For high-confidence actions, enable automatic execution:

1. Go to **Settings** → **AI SRE Companion**
2. Toggle **Auto-Execute High Confidence Actions** to ON
3. Set confidence threshold (default: 95%)

**Safety Notes:**
- Only actions with confidence above threshold execute automatically
- Require Approval setting must also be considered
- Auto-executed actions logged with `executed_by: auto`
- Use with caution - start with high thresholds

### Best Practices

**Model Selection:**
- Use capable models (GPT-4, Claude, Llama 3.2+) for best results
- Smaller models may give less accurate suggestions
- Local models (Ollama) work well for privacy-sensitive environments

**Service Context:**
- Write detailed service context for better AI recommendations
- Include architecture, dependencies, and common patterns
- Update context when services change

**Webhooks:**
- Start with safe actions (notifications, cache clears)
- Test webhooks manually before AI uses them
- Use approval workflow until confident in AI suggestions

**Token Management:**
- Disable auto-analyze for low-priority services
- Use manual analysis when needed to conserve tokens
- Monitor usage via provider dashboards

**Security:**
- API keys are encrypted at rest
- Webhook credentials stored securely
- Audit log tracks all AI actions
- Human-in-the-loop by default

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

Default: 90 days. This is currently hardcoded but will be configurable in the Settings page in a future update.

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
- Change default credentials immediately
- Use HTTPS (via reverse proxy like nginx or Caddy)
- Enable firewall rules to restrict access
- Regular backups of the `./data` directory
- Monitor the monitor (use external service to watch SimpleWatch)
- SECRET_KEY is auto-generated securely on first startup

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
