# SimpleWatch

AI-powered monitoring for teams who just want to know when something breaks.

Most monitoring tools are designed for large infrastructures and dedicated ops teams.
They are powerful, flexible, and far more complex than what many small teams actually need.

SimpleWatch takes a different approach.

It is a self-hosted monitoring dashboard built for small businesses and small teams who want to:

- Know when a service goes down
- Get notified without noise
- Understand uptime and incidents over time
- Move on with their day

```bash
docker pull gdelhaes/simplewatch
docker run -d -p 5050:5050 -v simplewatch-data:/data gdelhaes/simplewatch
# Open http://localhost:5050
```

---

## Who SimpleWatch is for

SimpleWatch is a good fit if you:

- Run a small business, internal tools, or side projects
- Monitor a few websites, APIs, servers, or background jobs
- Do not want to maintain a monitoring stack
- Want alerts that are clear and calm

SimpleWatch is not a metrics platform, a query engine, or a full observability solution.
Those tools exist and work very well for large and complex environments.

---

## What SimpleWatch does

- Monitor services with a few clicks
- Send alerts only on meaningful status changes
- Track incidents automatically
- Show uptime and recovery metrics
- Share status with customers (public status pages)
- Schedule maintenance windows to suppress alerts
- Stay quiet when everything is fine

Everything is configured through the web interface.
No configuration files. No scripting.

---

## Monitors

SimpleWatch includes 11 ready-to-use monitor types:

- **Website** - HTTP/HTTPS endpoint checks
- **API** - JSON API validation with custom headers
- **Metric Threshold** - Push metrics from scripts, alert on thresholds
- **Port** - TCP port availability checks
- **Deadman/Heartbeat** - Alert if no ping received (perfect for cron jobs)
- **SSL Certificate** - Expiration tracking with configurable warnings
- **DNS** - Verify DNS records resolve to expected values (A, AAAA, CNAME, MX, TXT)
- **Ping/ICMP** - Host reachability, latency, and packet loss measurement
- **SEO** - Comprehensive SEO health checks (title, meta, headings, structured data)
- **Ollama/Local LLM** - Monitor local LLM APIs (Ollama, LM Studio, LocalAI)
- **GitHub Actions** - Monitor CI/CD workflow status and build success rates

Monitors are designed to be practical, not endlessly configurable.

---

## Alerts and notifications

- Alerts trigger only on status changes
- Built-in cooldown to avoid notification spam
- Pause/resume at service or monitor level
- Notification history is kept for traceability

**Supported channels:**

- Email (SMTP)
- Slack
- Discord
- Custom webhooks

The notification system is extensible.

---

## Incidents and reliability

When something goes down, SimpleWatch creates an incident automatically.

You can:

- View incident timelines
- See uptime percentages
- Review mean time to recovery (MTTR)
- Filter by service or time range
- Export incident logs

This provides reliability insight without becoming an incident management platform.

---

## AI SRE Companion

SimpleWatch includes an optional AI assistant that helps you respond to incidents faster.

When something breaks, the AI can:

- Analyze incidents automatically and suggest remediation actions
- Generate post-mortem reports with a single click
- Learn from your service context and known issues
- Execute approved actions via configurable webhooks

The AI works with:

- **Ollama** - Run models locally, no data leaves your server
- **OpenAI** - GPT-4o and other models
- **Anthropic** - Claude models

All AI actions require human approval by default. You stay in control.

---

## Quick start

### Pull the image

```bash
docker pull gdelhaes/simplewatch
```

### Run SimpleWatch

```bash
docker run -d \
  --name simplewatch \
  -p 5050:5050 \
  -v simplewatch-data:/data \
  gdelhaes/simplewatch
```

### Open the interface

Open your browser at:

```
http://localhost:5050
```

On first launch you will:

1. Create an admin account
2. Optionally enable demo monitors
3. Start adding your own services

**Important:** Mounting `/data` is required to persist the database across restarts.

---

## Documentation

SimpleWatch includes a complete user manual that covers all features, configuration options, and advanced usage.

If you need more details, see:

- **User Guide:** [USER_GUIDE.md](USER_GUIDE.md)
- **API Documentation:** [API_DOCS.md](API_DOCS.md)

---

## License

SimpleWatch is open source under the **AGPL-3.0** license.
See the [LICENSE](LICENSE) file for details.

For commercial or proprietary use cases, a commercial license is available.
See [LICENSE-COMMERCIAL](LICENSE-COMMERCIAL) for more information.

---

**SimpleWatch** - Monitor what matters. Ignore the rest.
