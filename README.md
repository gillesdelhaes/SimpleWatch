# SimpleWatch

![Python](https://img.shields.io/badge/python-3.11-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104.1-009688.svg)
![SQLite](https://img.shields.io/badge/sqlite-3-003B57.svg)
![Docker](https://img.shields.io/badge/docker-ready-2496ED.svg)
![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)

**Monitor your services in under 60 seconds. No coding required.**

A self-hosted monitoring dashboard designed for business users and non-technical teams. Track websites, APIs, servers, and scheduled tasks with simple point-and-click setup. If you can fill out a form, you can monitor your infrastructure.

## Features

### Built-in Monitors (Zero Code Required!)
- **Website Monitor** - Check if URLs respond (60-second setup)
- **API Monitor** - Call API endpoints with validation (2-minute setup)
- **Metric Threshold Monitor** - Receive numbers, alert on thresholds (90-second setup)
- **Port Monitor** - Test if TCP ports are open (45-second setup)
- **Deadman Monitor** - Alert if no heartbeat received within expected interval (perfect for cron jobs and scheduled tasks)

### Key Capabilities
- Multiple monitors per service (track services in different ways)
- Named monitors for metric and deadman types (multiple metrics/heartbeats per service)
- Aggregated status display (see which monitors are operational/degraded/down)
- Clickable dashboard cards with detailed monitor modals
- Full CRUD operations (create, read, update, delete) for services and monitors
- Real-time status updates (10-second polling)
- Last heartbeat timestamp display for deadman monitors
- Notification system - Email (SMTP), Slack, Discord, and custom webhooks
- Service-level notification settings with cooldown and recovery alerts
- Simple REST API for automation
- Built-in background scheduler (no Redis/Celery needed)
- 4 working example monitors included
- Docker-based deployment

## Quick Start

### Option 1: Deploy from Docker Hub (Fastest)

```bash
# Pull and run SimpleWatch in one command
docker run -p 5050:5050 -v simplewatch-data:/data gdelhaes/simplewatch
```

This creates a volume named `simplewatch-data` to persist your database.

### Option 2: Deploy with docker-compose

```bash
# Clone or download SimpleWatch
cd simplewatch

# Start SimpleWatch (no .env file needed!)
docker-compose up -d
```

### First-Time Setup

Open http://localhost:5050

You'll see the **Setup Page** on first launch:

1. Choose your admin username
2. Create a secure password (minimum 8 characters)
3. Confirm your password
4. Optionally create example monitors (recommended for first-time users)
5. Click "Initialize System"

That's it! You'll be redirected to the login page.

### Create Your First Monitor

1. Click "Services" in the navigation
2. Click "Quick Monitor" button
3. Select "Website Monitor"
4. Enter your website URL
5. Click "Create Monitor"
6. Done! Check your dashboard

## Tech Stack

- **Backend:** FastAPI + Python 3.11
- **Frontend:** HTML + Tailwind CSS + Vanilla JavaScript
- **Database:** SQLite (no external DB needed)
- **Scheduler:** APScheduler (no Redis/Celery complexity)
- **Charts:** Chart.js 4.x
- **Deployment:** Docker + docker-compose

## Configuration

**SimpleWatch requires NO environment variables or .env file!**

All configuration is handled through the web interface.

## Built-in Examples

If you enable "Create Example Monitors" during setup (recommended), SimpleWatch creates 4 example monitors:

1. **Google Search** - Website monitor (always operational)
2. **Slow Response API** - API monitor (intentionally times out)
3. **Server Disk Usage** - Metric threshold monitor
4. **Cloudflare DNS** - Port monitor (checks port 53)

These examples demonstrate all monitor types and can be deleted after testing.

## Notifications

SimpleWatch includes a built-in notification system to alert you when service status changes.

### Supported Channels
- **Email (SMTP)** - Configure in Settings → Email Notifications
- **Slack** - Add webhook URL in Settings → Notification Channels
- **Discord** - Add webhook URL in Settings → Notification Channels
- **Custom Webhooks** - Generic JSON webhooks for any system

### Per-Service Configuration
For each service, you can configure:
- Enable/disable notifications
- Email recipients (comma-separated)
- Webhook channels to notify
- Cooldown period (prevent alert spam)
- Recovery notifications (alert when service comes back up)

**Setup:**
1. Go to Settings → Configure SMTP or add webhook channels
2. Test your configuration
3. Go to Services → Click notification icon for a service
4. Enable notifications and select channels
5. Save

Notifications are sent automatically when:
- Service status changes (operational ↔ degraded ↔ down)
- Respects cooldown period (default: 5 minutes)
- Always sends recovery notifications (when service comes back up)

**Notification Log:**
- View sent notification history on Notifications page
- Download full audit log as CSV
- Track delivery status and troubleshoot failed notifications

## Ultra-Simple API

### Send Metric Value

```bash
# Update specific named monitor (required)
curl -X POST http://localhost:5050/api/v1/metric/SERVICE_NAME/MONITOR_NAME \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "YOUR_API_KEY",
    "value": 87.5
  }'
```

### Send Heartbeat (Deadman Monitor)

```bash
# Ping specific named monitor (required)
curl -X POST http://localhost:5050/api/v1/heartbeat/SERVICE_NAME/MONITOR_NAME \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "YOUR_API_KEY"
  }'
```

Get your API key from Settings page after logging in.

**Note:** Service name and monitor name are both required. Monitor names are specified when creating the monitor.

## Security Considerations

- Choose a strong admin password during first-run setup (minimum 8 characters)
- Use HTTPS in production (configure reverse proxy)
- Keep API keys secure (regenerate in Settings if exposed)
- Enable firewall rules to restrict access
- Regular backups of `./data` directory
- SECRET_KEY is auto-generated securely on first startup

## Documentation

- [API Documentation](API_DOCS.md) - Complete API reference
- [User Guide](USER_GUIDE.md) - Detailed usage instructions

## License

SimpleWatch is **dual-licensed**.

### Open Source License (AGPL-3.0)

SimpleWatch is available under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

You are free to:
- ✅ Use SimpleWatch free of charge
- ✅ Self-host it for personal or internal organizational use
- ✅ Modify the source code
- ✅ Use it in commercial environments

**Condition:**
If you modify SimpleWatch and make it available to users over a network
(for example, as a hosted web service), you must make the complete
corresponding source code available under the same AGPL-3.0 license.

See the [LICENSE](LICENSE) file for full AGPL-3.0 terms.

---

### Commercial License

If you want to:
- Offer SimpleWatch as a **hosted SaaS** to external customers **without**
  open-sourcing your modifications
- Embed SimpleWatch in a proprietary or closed-source product
- Create closed-source extensions

you must obtain a **commercial license**, which replaces the AGPL-3.0
requirements for your deployment.

See [LICENSE-COMMERCIAL](LICENSE-COMMERCIAL) for details, or contact the
author for licensing inquiries.

---

**Why dual licensing?**  
This approach keeps SimpleWatch open for the community while allowing the
author to sustainably maintain and commercially support the project.

## Support

For issues and questions:
- Check documentation
- Check GitHub issues

**SimpleWatch** - Making monitoring simple for everyone.
