# SimpleWatch

A self-hosted monitoring dashboard designed for business users to track the status of internal and external services. Built with simplicity and ease of use in mind.

## Features

### Built-in Monitors (Zero Code Required!)
- **Website Monitor** - Check if URLs respond (60-second setup)
- **API Monitor** - Call API endpoints with validation (2-minute setup)
- **Metric Threshold Monitor** - Receive numbers, alert on thresholds (90-second setup)
- **Port Monitor** - Test if TCP ports are open (45-second setup)

### Key Capabilities
- Drag-and-drop dashboard customization
- Real-time status updates (10-second polling)
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
# Security
SECRET_KEY=your_random_secret_key

# Default Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme

# Database
DATABASE_PATH=/data/simplewatch.db

# Email Notifications (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM=alerts@yourdomain.com
SMTP_USE_TLS=true

# Features
CREATE_EXAMPLES=true
PUBLIC_STATUS_PAGE=false
DATA_RETENTION_DAYS=90
```

## Built-in Examples

When `CREATE_EXAMPLES=true` (default), SimpleWatch creates 4 example monitors:

1. **Google Search** - Website monitor (always operational)
2. **Slow Response API** - API monitor (intentionally times out)
3. **Server Disk Usage** - Metric threshold monitor
4. **Cloudflare DNS** - Port monitor (checks port 53)

These examples demonstrate all monitor types and can be deleted after testing.

## Ultra-Simple API

### Update Service Status

```bash
curl -X POST http://localhost:5050/api/v1/status \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "YOUR_API_KEY",
    "service": "my_service",
    "status": "operational"
  }'
```

### Send Metric Value

```bash
curl -X POST http://localhost:5050/api/v1/metric/SERVICE_NAME \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "YOUR_API_KEY",
    "value": 87.5
  }'
```

Get your API key from Settings page after logging in.

## Project Structure

```
simplewatch/
├── backend/
│   ├── app.py              # Main FastAPI application
│   ├── database.py         # Database models and initialization
│   ├── models.py           # Pydantic models for validation
│   ├── scheduler.py        # APScheduler background monitor scheduler
│   ├── api/                # API endpoints
│   ├── monitors/           # Monitor implementations
│   │   ├── website.py      # Website monitor
│   │   ├── api.py          # API monitor
│   │   ├── metric.py       # Metric threshold monitor
│   │   └── port.py         # Port monitor
│   ├── utils/              # Utility functions
│   └── examples/           # Example scripts
├── frontend/
│   ├── dashboard.html      # Main dashboard
│   ├── services.html       # Service management + Quick Monitor
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
- Regenerate SECRET_KEY for production
- Keep API keys secure
- Enable firewall rules to restrict access
- Regular backups of `./data` directory

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

Future enhancements (not yet implemented):
- Advanced charting and custom dashboards
- Alert rules engine
- Integration marketplace
- Mobile app
- Multi-tenancy support
- SSO/LDAP authentication
- Incident management system
- ChatOps integrations

---

**SimpleWatch** - Making monitoring simple for everyone.
