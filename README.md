# SimpleWatch

![Python](https://img.shields.io/badge/python-3.11-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104.1-009688.svg)
![SQLite](https://img.shields.io/badge/sqlite-3-003B57.svg)
![Docker](https://img.shields.io/badge/docker-ready-2496ED.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

A self-hosted monitoring dashboard designed for business users to track the status of internal and external services. Built with simplicity and ease of use in mind.

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
- Drag-and-drop dashboard customization
- Real-time status updates (10-second polling)
- Last heartbeat timestamp display for deadman monitors
- **Notification system** - Email (SMTP), Slack, Discord, and custom webhooks
- Service-level notification settings with cooldown and recovery alerts
- Simple REST API for automation
- Built-in background scheduler (no Redis/Celery needed)
- 4 working example monitors included
- Docker-based deployment

## Quick Start

### 1. Deploy with Docker

```bash
# Clone or download SimpleWatch
cd simplewatch

# Copy environment template
cp .env.example .env

# Start SimpleWatch
docker-compose up -d
```

### 2. Login

Open http://localhost:5050

- **Username:** `admin`
- **Password:** `changeme`

**Important:** Change the default password after first login!

### 3. Create Your First Monitor

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

## Environment Variables

Create a `.env` file or configure in `docker-compose.yml`:

```bash
# Default Admin Account
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme

# Database Location
DATABASE_PATH=/data/simplewatch.db

# Create Example Monitors on First Startup
CREATE_EXAMPLES=true
```

**Note:** `SECRET_KEY` is automatically generated on first startup if not provided. SMTP and other settings are configured through the web UI (Settings → Notifications).

## Built-in Examples

When `CREATE_EXAMPLES=true` (default), SimpleWatch creates 4 example monitors:

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

## Project Structure

```
simplewatch/
├── backend/
│   ├── app.py                    # Main FastAPI application
│   ├── database.py               # Database models and initialization
│   ├── models.py                 # Pydantic models for validation
│   ├── scheduler.py              # APScheduler background monitor scheduler
│   ├── api/                      # API endpoints
│   │   ├── auth.py               # Authentication endpoints
│   │   ├── dashboard.py          # Dashboard status queries (read-only)
│   │   ├── services.py           # Service CRUD endpoints
│   │   ├── monitors.py           # Monitor CRUD endpoints
│   │   ├── users.py              # User management endpoints
│   │   ├── notifications.py      # Notification configuration endpoints
│   │   └── monitor_ingestion.py # Metric and heartbeat data ingestion
│   ├── monitors/                 # Monitor implementations
│   │   ├── website.py            # Website monitor
│   │   ├── api.py                # API monitor
│   │   ├── metric.py             # Metric threshold monitor
│   │   ├── port.py               # Port monitor
│   │   └── deadman.py            # Deadman/heartbeat monitor
│   ├── services/                 # Business logic layer
│   │   └── notification_service.py # Notification orchestration
│   ├── utils/                    # Utility functions
│   │   └── notifications.py      # SMTP and webhook helpers
│   └── examples/                 # Example scripts
├── frontend/
│   ├── dashboard.html      # Main dashboard (shows last heartbeat)
│   ├── services.html       # Service management + Quick Monitor + Edit
│   ├── settings.html       # User settings and API keys
│   ├── users.html          # User management (admin only)
│   └── js/                 # JavaScript utilities
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## Development

### Local Development (without Docker)

```bash
# Install Python dependencies
cd backend
pip install -r requirements.txt

# Set environment variables
export DATABASE_PATH=./simplewatch.db
export ADMIN_PASSWORD=changeme

# Run the application
python app.py
```

Access at http://localhost:5050

### Running Tests

```bash
# Manual testing checklist in TESTING.md
# Unit tests can be added in tests/ directory
```

## Upgrading

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose down
docker-compose build
docker-compose up -d
```

Your data persists in the `./data` directory.

## Troubleshooting

### Container won't start
- Check logs: `docker-compose logs simplewatch`
- Verify port 5050 is available: `lsof -i :5050`

### Dashboard not updating
- Check browser console for errors
- Verify API key in Settings
- Check container health: `docker-compose ps`

### Monitors not running
- Check logs for scheduler errors
- Verify monitors are active in Services page
- Check monitor configuration

### Database locked errors
- Stop container: `docker-compose down`
- Check if database file is accessible
- Restart: `docker-compose up -d`

## Security Considerations

- Change default admin password immediately
- Use HTTPS in production (configure reverse proxy)
- Keep API keys secure (regenerate in Settings if exposed)
- Enable firewall rules to restrict access
- Regular backups of `./data` directory
- SECRET_KEY is auto-generated securely on first startup

## Documentation

- [API Documentation](API_DOCS.md) - Complete API reference
- [User Guide](USER_GUIDE.md) - Detailed usage instructions
- [Examples](backend/examples/README.md) - Integration examples

## License

MIT License

## Support

For issues and questions:
- Check documentation
- Review example scripts
- Check GitHub issues

## Roadmap

Completed features:
- ✅ Notifications (Email, Slack, Discord, custom webhooks)
- ✅ Service-level notification settings
- ✅ Per-service notification configuration with cooldown

Future enhancements (not yet implemented):
- Advanced charting and custom dashboards
- Incident tracking and MTTR calculations
- Alert rules engine
- Integration marketplace
- Mobile app
- Multi-tenancy support
- SSO/LDAP authentication

---

**SimpleWatch** - Making monitoring simple for everyone.
