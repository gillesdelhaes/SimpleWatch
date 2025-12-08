/**
 * Dashboard Page JavaScript
 * Handles dashboard display and real-time status updates
 */

requireAuth();

const userInfo = getUserInfo();
let statusPoller;

function getStatusClass(status) {
    return status === 'operational' ? 'operational' :
           status === 'degraded' ? 'degraded' :
           status === 'down' ? 'down' : 'unknown';
}

function getStatusText(status) {
    const texts = {
        'operational': 'Operational',
        'degraded': 'Degraded',
        'down': 'Down',
        'maintenance': 'Maintenance',
        'unknown': 'Unknown'
    };
    return texts[status] || 'Unknown';
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

function getMonitorSummary(monitors) {
    const operational = monitors.filter(m => m.status === 'operational').length;
    const degraded = monitors.filter(m => m.status === 'degraded').length;
    const down = monitors.filter(m => m.status === 'down').length;
    const unknown = monitors.filter(m => m.status === 'unknown').length;

    const parts = [];
    if (operational > 0) parts.push(`<span style="color: var(--status-operational); font-weight: 600;">${operational} ✓</span>`);
    if (degraded > 0) parts.push(`<span style="color: var(--status-degraded); font-weight: 600;">${degraded} ~</span>`);
    if (down > 0) parts.push(`<span style="color: var(--status-down); font-weight: 600;">${down} ✗</span>`);
    if (unknown > 0) parts.push(`<span style="color: var(--text-tertiary); font-weight: 600;">${unknown} ?</span>`);

    return parts.join(', ');
}

function createStatusWidget(service) {
    const monitorSummary = service.monitors && service.monitors.length > 0
        ? getMonitorSummary(service.monitors)
        : '';

    return `
        <div class="service-card" onclick="openMonitorModal(${service.service_id})">
            <div class="service-header">
                <div class="service-name">${service.service}</div>
                <div class="service-status-dot ${getStatusClass(service.status)}"></div>
            </div>
            <div class="service-metrics">
                ${service.monitor_count > 0 && monitorSummary ?
                    `<div class="service-monitor-summary">
                        <span class="monitors-info">${monitorSummary}</span>
                        ${service.uptime ? `<span class="service-uptime">${service.uptime.percentage}% (${service.uptime.period_label})</span>` : ''}
                    </div>` : ''}
                <div class="metric-row">
                    <span class="metric-label">Status</span>
                    <span class="metric-value status ${getStatusClass(service.status)}">${getStatusText(service.status)}</span>
                </div>
                ${service.response_time_ms ? `
                <div class="metric-row">
                    <span class="metric-label">Avg Response</span>
                    <span class="metric-value">${service.response_time_ms}ms</span>
                </div>
                ` : ''}
                <div class="metric-row">
                    <span class="metric-label">Last Check</span>
                    <span class="metric-value">${formatTimestamp(service.timestamp)}</span>
                </div>
            </div>
        </div>
    `;
}

let currentServiceData = [];

function getMonitorTypeName(type) {
    const typeNames = {
        'website': 'Website',
        'api': 'API',
        'metric_threshold': 'Metric Threshold',
        'port': 'Port',
        'deadman': 'Deadman/Heartbeat'
    };
    return typeNames[type] || type;
}

function getMonitorDescription(monitor) {
    if (!monitor.config) return '';

    let description = '';
    if (monitor.monitor_type === 'website') {
        description = monitor.config.url;
    } else if (monitor.monitor_type === 'api') {
        description = `${monitor.config.method || 'GET'} ${monitor.config.url}`;
    } else if (monitor.monitor_type === 'metric_threshold') {
        const comparison = monitor.config.comparison === 'greater' ? '>' : '<';
        const thresholds = `Warning ${comparison} ${monitor.config.warning_threshold}, Critical ${comparison} ${monitor.config.critical_threshold}`;
        description = monitor.config.name ? `[${monitor.config.name}] ${thresholds}` : thresholds;
    } else if (monitor.monitor_type === 'port') {
        description = `${monitor.config.host}:${monitor.config.port}`;
    } else if (monitor.monitor_type === 'deadman') {
        const heartbeat = `Expect heartbeat every ${monitor.config.expected_interval_hours}h (grace: ${monitor.config.grace_period_hours}h)`;
        description = monitor.config.name ? `[${monitor.config.name}] ${heartbeat}` : heartbeat;
    }
    return description;
}

function openMonitorModal(serviceId) {
    const service = currentServiceData.find(s => s.service_id === serviceId);
    if (!service) return;

    document.getElementById('modalServiceName').textContent = service.service;
    document.getElementById('modalOverallStatus').textContent = getStatusText(service.status);
    document.getElementById('modalOverallStatus').style.color =
        service.status === 'operational' ? 'var(--status-operational)' :
        service.status === 'degraded' ? 'var(--status-degraded)' :
        'var(--status-down)';

    const statusDot = document.getElementById('modalStatusIndicator');
    statusDot.className = `service-status-dot ${getStatusClass(service.status)}`;

    const monitorSummary = service.monitors && service.monitors.length > 0
        ? getMonitorSummary(service.monitors)
        : 'No monitors';
    document.getElementById('modalMonitorSummary').innerHTML =
        `${service.monitor_count} monitor${service.monitor_count !== 1 ? 's' : ''}: ${monitorSummary}`;

    const monitorDetailsList = document.getElementById('monitorDetailsList');
    if (service.monitors && service.monitors.length > 0) {
        monitorDetailsList.innerHTML = service.monitors.map(monitor => {
            const description = getMonitorDescription(monitor);
            return `
            <div class="monitor-detail-card">
                <div class="monitor-detail-header">
                    <div style="flex: 1;">
                        <div class="monitor-type">${getMonitorTypeName(monitor.monitor_type)}</div>
                        ${description ? `<div class="monitor-description">${description}</div>` : ''}
                        <div class="monitor-interval">Every ${monitor.check_interval_minutes} minutes</div>
                    </div>
                    <div class="status-indicator status-${getStatusClass(monitor.status)}">
                        <span class="status-dot"></span>
                        ${getStatusText(monitor.status)}
                    </div>
                </div>
                <div class="monitor-metrics">
                    ${monitor.monitor_type === 'deadman' ? `
                    <div class="monitor-metric">
                        <div class="monitor-metric-label">Last Heartbeat</div>
                        <div class="monitor-metric-value">${monitor.timestamp ? formatTimestamp(monitor.timestamp) : 'Never'}</div>
                    </div>
                    ` : monitor.monitor_type === 'ssl_cert' && monitor.metadata && monitor.metadata.days_until_expiry !== undefined ? `
                    <div class="monitor-metric">
                        <div class="monitor-metric-label">Days Until Expiry</div>
                        <div class="monitor-metric-value">${monitor.metadata.days_until_expiry} days</div>
                    </div>
                    ${monitor.metadata.expiry_date ? `
                    <div class="monitor-metric">
                        <div class="monitor-metric-label">Expires On</div>
                        <div class="monitor-metric-value">${new Date(monitor.metadata.expiry_date).toLocaleDateString()}</div>
                    </div>
                    ` : ''}
                    ` : monitor.response_time_ms ? `
                    <div class="monitor-metric">
                        <div class="monitor-metric-label">Response Time</div>
                        <div class="monitor-metric-value">${monitor.response_time_ms}ms</div>
                    </div>
                    ` : ''}
                    ${monitor.metadata && monitor.metadata.reason ? `
                    <div class="monitor-metric">
                        <div class="monitor-metric-label">Reason</div>
                        <div class="monitor-metric-value">${monitor.metadata.reason}</div>
                    </div>
                    ` : ''}
                    ${monitor.monitor_type !== 'deadman' ? `
                    <div class="monitor-metric">
                        <div class="monitor-metric-label">Last Check</div>
                        <div class="monitor-metric-value">${monitor.timestamp ? formatTimestamp(monitor.timestamp) : 'Never'}</div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `}).join('');
    } else {
        monitorDetailsList.innerHTML = '<p style="text-align: center; color: var(--text-tertiary); padding: 2rem;">No monitors configured for this service</p>';
    }

    document.getElementById('monitorDetailsModal').classList.remove('hidden');
}

function closeMonitorModal() {
    document.getElementById('monitorDetailsModal').classList.add('hidden');
}

// Close modal when clicking outside
document.getElementById('monitorDetailsModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeMonitorModal();
    }
});

async function loadDashboard() {
    try {
        const data = await api.getAllStatus();
        currentServiceData = data.services;
        const dashboardGrid = document.getElementById('dashboardGrid');
        const emptyState = document.getElementById('emptyState');

        if (data.services.length === 0) {
            dashboardGrid.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');

        dashboardGrid.innerHTML = data.services
            .map(service => createStatusWidget(service))
            .join('');

        const lastUpdate = document.getElementById('lastUpdate');
        const now = new Date();
        lastUpdate.textContent = `Last updated: ${now.toLocaleTimeString()}`;

    } catch (error) {
        console.error('Failed to load dashboard:', error);
    }
}

loadDashboard();

statusPoller = new Poller(loadDashboard, 10000);
statusPoller.start();

window.addEventListener('beforeunload', () => {
    if (statusPoller) {
        statusPoller.stop();
    }
});
