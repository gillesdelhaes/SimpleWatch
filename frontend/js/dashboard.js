/**
 * Dashboard Page JavaScript
 * Handles dashboard display and real-time status updates
 */

requireAuth();

const userInfo = getUserInfo();
let statusPoller;
let aiEnabled = false;
let passiveMonitorTypes = new Set();

// Fetch monitor types to identify passive monitors
async function fetchMonitorTypes() {
    try {
        const response = await fetch('/api/v1/monitors/types');
        if (response.ok) {
            const data = await response.json();
            passiveMonitorTypes = new Set(
                data.types.filter(t => t.is_passive).map(t => t.type)
            );
        }
    } catch (error) {
        console.debug('Failed to fetch monitor types:', error);
    }
}

// Check if AI SRE is enabled
async function checkAiStatus() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/ai/status', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            aiEnabled = data.enabled && data.connected;
        }
    } catch (error) {
        console.debug('AI status check failed:', error);
        aiEnabled = false;
    }
}

// Analyze a service with AI by finding its ongoing incident
async function analyzeServiceWithAi(serviceId, serviceName) {
    // Find button - could be card button or modal button
    const btn = event.target.closest('.ai-analyze-btn') || event.target.closest('.modal-ai-analyze-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `
            <svg class="ai-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32"/>
            </svg>
            Analyzing...
        `;
    }

    try {
        const token = localStorage.getItem('token');

        // First, get the ongoing incident for this service
        const incidentsResponse = await fetch(`/api/v1/incidents?service_id=${serviceId}&status=ongoing`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!incidentsResponse.ok) {
            throw new Error('Failed to fetch incidents');
        }

        const incidents = await incidentsResponse.json();

        if (!incidents.incidents || incidents.incidents.length === 0) {
            showToast(`No ongoing incident found for ${serviceName}`, 'info');
            return;
        }

        const incidentId = incidents.incidents[0].id;

        // Trigger AI analysis
        const analyzeResponse = await fetch(`/api/v1/ai/analyze/${incidentId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!analyzeResponse.ok) {
            const error = await analyzeResponse.json();
            throw new Error(error.detail || 'Analysis failed');
        }

        const result = await analyzeResponse.json();

        // Reload pending actions and refresh dashboard
        await loadAllPendingActions();
        await loadDashboard();

        // Update modal if open - replace button with pending indicator
        const modal = document.getElementById('monitorDetailsModal');
        if (!modal.classList.contains('hidden')) {
            const aiAnalyzeContainer = document.getElementById('modalAiAnalyzeContainer');
            aiAnalyzeContainer.innerHTML = `
                <div class="modal-ai-analysis-available">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 6v6l4 2"/>
                    </svg>
                    Analysis Available
                </div>
            `;
            loadModalAiSuggestions(serviceId);
        }

        showToast('AI analysis complete! Check service details for recommendations.', 'success');

    } catch (error) {
        console.error('AI analysis failed:', error);
        showToast(error.message || 'AI analysis failed', 'error');

        // Restore button on failure
        if (btn) {
            btn.disabled = false;
            const iconSize = btn.classList.contains('modal-ai-analyze-btn') ? 16 : 14;
            btn.innerHTML = `
                <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                </svg>
                Analyze with AI
            `;
        }
    }
}

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
    // Handle null/undefined timestamps (e.g., passive monitors that haven't received data)
    if (!timestamp) {
        return 'Never';
    }

    // Parse timestamp - append 'Z' if no timezone info to treat as UTC
    let isoString = timestamp;
    if (!isoString.endsWith('Z') && !isoString.includes('+') && !isoString.includes('-', 10)) {
        isoString += 'Z';
    }

    const date = new Date(isoString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    // Handle future dates or invalid dates
    if (isNaN(diff) || diff < 0) {
        return 'Never';
    }

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

function formatErrorBudget(seconds) {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

function renderSlaBadge(sla) {
    if (!sla || !sla.target || !sla.status) return '';

    const statusColors = {
        'ok': 'var(--status-operational)',
        'at_risk': 'var(--status-degraded)',
        'breached': 'var(--status-down)'
    };

    const statusLabels = {
        'ok': 'OK',
        'at_risk': 'At Risk',
        'breached': 'Breached'
    };

    const color = statusColors[sla.status] || 'var(--text-tertiary)';
    const label = statusLabels[sla.status] || 'Unknown';

    // Determine opacity based on status (subtle when ok, prominent when at-risk/breached)
    const opacity = sla.status === 'ok' ? '0.7' : '1';

    return `
        <span class="sla-badge sla-${sla.status}" data-tooltip="SLA ${label}&#10;Target: ${sla.target}% (${sla.timeframe_days}d)&#10;Actual: ${sla.percentage}%&#10;Error budget: ${formatErrorBudget(sla.error_budget_seconds || 0)}">
            <span class="icon" style="width: 16px; height: 16px; color: ${color}; opacity: ${opacity};">${icons.sla}</span>
        </span>
    `;
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

    const inMaintenance = service.maintenance && service.maintenance.in_maintenance;
    const maintenanceBadge = typeof renderMaintenanceBadge === 'function'
        ? renderMaintenanceBadge(service.maintenance)
        : '';

    // Show AI analyze button for services with issues (but not if analysis is already pending)
    const hasIssue = service.status === 'degraded' || service.status === 'down';
    const hasPendingAnalysis = pendingActionsByService[service.service_id]?.length > 0;
    const showAiButton = aiEnabled && hasIssue && !hasPendingAnalysis;
    const showPendingIndicator = aiEnabled && hasIssue && hasPendingAnalysis;

    return `
        <div class="service-card${inMaintenance ? ' in-maintenance' : ''}" onclick="openMonitorModal(${service.service_id})">
            ${maintenanceBadge}
            <div class="service-header">
                <div class="service-name">${service.service}</div>
                <div class="service-status-dot ${getStatusClass(service.status)}"></div>
            </div>
            <div class="service-metrics">
                ${service.monitor_count > 0 && monitorSummary ?
                    `<div class="service-monitor-summary">
                        <span class="monitors-info">${monitorSummary}</span>
                        ${service.uptime ? `<span class="service-uptime">${service.uptime.percentage}% (${service.uptime.period_label})${renderSlaBadge(service.sla)}</span>` : ''}
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
                ${showAiButton ? `
                <button class="ai-analyze-btn" onclick="event.stopPropagation(); analyzeServiceWithAi(${service.service_id}, '${service.service}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                    </svg>
                    Analyze with AI
                </button>
                ` : ''}
                ${showPendingIndicator ? `
                <div class="ai-analysis-available" onclick="event.stopPropagation(); openMonitorModal(${service.service_id})">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 6v6l4 2"/>
                    </svg>
                    Analysis Available
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

let currentServiceData = [];

function getMonitorTypeName(type) {
    const monitorPlugin = window.monitorRegistry?.get(type);
    if (!monitorPlugin) {
        return type; // Fallback to type string if registry not loaded or plugin not found
    }
    return monitorPlugin.name.replace(' Monitor', ''); // Strip "Monitor" suffix for brevity
}

function getMonitorDescription(monitor) {
    if (!monitor.config) return '';
    const monitorPlugin = window.monitorRegistry?.get(monitor.monitor_type);
    if (monitorPlugin && monitorPlugin.getDescription) {
        return monitorPlugin.getDescription(monitor.config);
    }
    return '';
}

function getMonitorMetrics(monitor) {
    let html = '';

    // Try to get custom metrics from monitor plugin
    const monitorPlugin = window.monitorRegistry?.get(monitor.monitor_type);
    if (monitorPlugin && monitorPlugin.renderDetailMetrics) {
        try {
            const customMetrics = monitorPlugin.renderDetailMetrics(monitor);
            if (customMetrics) {
                html += customMetrics;
            }
        } catch (error) {
            console.error(`Error rendering metrics for ${monitor.monitor_type}:`, error);
        }
    }

    // Add common metrics that apply to all monitors
    if (monitor.metadata && monitor.metadata.reason) {
        html += `
            <div class="monitor-metric">
                <div class="monitor-metric-label">Reason</div>
                <div class="monitor-metric-value">${monitor.metadata.reason}</div>
            </div>
        `;
    }

    if (monitor.timestamp) {
        html += `
            <div class="monitor-metric">
                <div class="monitor-metric-label">Last Check</div>
                <div class="monitor-metric-value">${formatTimestamp(monitor.timestamp)}</div>
            </div>
        `;
    }

    return html;
}

// ============================================
// Graph State and Functions
// ============================================

let monitorChart = null;
let currentGraphMonitorId = null;
let currentGraphPeriod = '24h';
let currentGraphData = null;
let currentGraphMetricIndex = 0;

// Status colors for annotations
const STATUS_COLORS = {
    'operational': 'rgba(16, 185, 129, 0.7)',
    'degraded': 'rgba(245, 158, 11, 0.7)',
    'down': 'rgba(239, 68, 68, 0.7)'
};

function getGraphableMetrics(monitorType) {
    // Try to get from plugin first
    const plugin = window.monitorRegistry?.get(monitorType);
    if (plugin?.graphableMetrics) {
        return plugin.graphableMetrics;
    }
    // Fallback defaults
    return [{ key: 'response_time_ms', label: 'Response Time', unit: 'ms', color: '#10B981' }];
}

function populateGraphSelectors(service) {
    const monitorSelect = document.getElementById('graphMonitorSelect');
    const metricSelect = document.getElementById('graphMetricSelect');

    // Clear and populate monitor selector
    monitorSelect.innerHTML = '';
    if (service.monitors && service.monitors.length > 0) {
        service.monitors.forEach((monitor, idx) => {
            const option = document.createElement('option');
            option.value = monitor.monitor_id;
            option.textContent = `${getMonitorTypeName(monitor.monitor_type)}${monitor.config?.name ? ` (${monitor.config.name})` : ''}`;
            if (idx === 0) option.selected = true;
            monitorSelect.appendChild(option);
        });
        currentGraphMonitorId = service.monitors[0].monitor_id;

        // Populate metric selector for first monitor
        populateMetricSelector(service.monitors[0].monitor_type);
    }
}

function populateMetricSelector(monitorType) {
    const metricSelect = document.getElementById('graphMetricSelect');
    const metrics = getGraphableMetrics(monitorType);

    metricSelect.innerHTML = '';
    metrics.forEach((metric, idx) => {
        const option = document.createElement('option');
        option.value = idx;
        option.textContent = `${metric.label}${metric.unit ? ` (${metric.unit})` : ''}`;
        if (idx === 0) option.selected = true;
        metricSelect.appendChild(option);
    });
    currentGraphMetricIndex = 0;
}

async function loadMonitorGraph() {
    const monitorSelect = document.getElementById('graphMonitorSelect');
    const selectedMonitorId = monitorSelect.value;

    if (!selectedMonitorId) {
        showGraphNoData();
        return;
    }

    currentGraphMonitorId = parseInt(selectedMonitorId);

    // Update metric selector for the selected monitor type
    const service = currentServiceData.find(s =>
        s.monitors?.some(m => m.monitor_id === currentGraphMonitorId)
    );
    const monitor = service?.monitors?.find(m => m.monitor_id === currentGraphMonitorId);
    if (monitor) {
        populateMetricSelector(monitor.monitor_type);
    }

    await fetchAndRenderGraph();
}

function updateGraphMetric() {
    const metricSelect = document.getElementById('graphMetricSelect');
    currentGraphMetricIndex = parseInt(metricSelect.value) || 0;

    if (currentGraphData) {
        renderGraph(currentGraphData);
    }
}

function setGraphPeriod(period) {
    currentGraphPeriod = period;

    // Update button styles
    document.querySelectorAll('.graph-period-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.period === period);
    });

    fetchAndRenderGraph();
}

async function fetchAndRenderGraph() {
    if (!currentGraphMonitorId) {
        showGraphNoData();
        return;
    }

    showGraphLoading();

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(
            `/api/v1/monitors/${currentGraphMonitorId}/graph?period=${currentGraphPeriod}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (!response.ok) {
            throw new Error('Failed to fetch graph data');
        }

        currentGraphData = await response.json();
        renderGraph(currentGraphData);

    } catch (error) {
        console.error('Failed to load graph:', error);
        showGraphNoData();
    }
}

function showGraphLoading() {
    document.getElementById('graphLoading').classList.remove('hidden');
    document.getElementById('graphNoData').classList.add('hidden');
    const canvas = document.getElementById('monitorGraph');
    canvas.style.display = 'none';
}

function showGraphNoData() {
    document.getElementById('graphLoading').classList.add('hidden');
    document.getElementById('graphNoData').classList.remove('hidden');
    const canvas = document.getElementById('monitorGraph');
    canvas.style.display = 'none';
}

function renderGraph(data) {
    document.getElementById('graphLoading').classList.add('hidden');
    document.getElementById('graphNoData').classList.add('hidden');

    const canvas = document.getElementById('monitorGraph');
    canvas.style.display = 'block';

    // Destroy existing chart
    if (monitorChart) {
        monitorChart.destroy();
        monitorChart = null;
    }

    // Get the selected metric
    const metric = data.metrics[currentGraphMetricIndex];
    if (!metric || !metric.data || metric.data.length === 0) {
        showGraphNoData();
        return;
    }

    // Check if all values are null
    const hasData = metric.data.some(d => d.value !== null);
    if (!hasData) {
        showGraphNoData();
        return;
    }

    // Prepare data for Chart.js
    const labels = metric.data.map(d => new Date(d.timestamp));
    const values = metric.data.map(d => d.value);

    // Create status change annotations
    const annotations = {};
    if (data.status_changes) {
        data.status_changes.forEach((change, idx) => {
            annotations[`statusChange${idx}`] = {
                type: 'line',
                xMin: new Date(change.timestamp),
                xMax: new Date(change.timestamp),
                borderColor: STATUS_COLORS[change.to] || 'rgba(156, 163, 175, 0.5)',
                borderWidth: 2,
                borderDash: [5, 5],
                label: {
                    display: true,
                    content: change.to.charAt(0).toUpperCase(),
                    position: 'start',
                    backgroundColor: STATUS_COLORS[change.to] || 'rgba(156, 163, 175, 0.8)',
                    color: 'white',
                    font: { size: 10, weight: 'bold' },
                    padding: 3
                }
            };
        });
    }

    const ctx = canvas.getContext('2d');
    monitorChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: metric.label,
                data: values,
                borderColor: metric.color || '#10B981',
                backgroundColor: (metric.color || '#10B981') + '20',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 4,
                spanGaps: false  // Show gaps for null values
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleFont: { size: 12 },
                    bodyFont: { size: 12 },
                    padding: 10,
                    displayColors: false,
                    callbacks: {
                        title: function(items) {
                            const date = new Date(items[0].parsed.x);
                            return date.toLocaleString();
                        },
                        label: function(context) {
                            const value = context.parsed.y;
                            if (value === null) return 'No data';
                            return `${metric.label}: ${value}${metric.unit ? ' ' + metric.unit : ''}`;
                        }
                    }
                },
                annotation: {
                    annotations: annotations
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        displayFormats: {
                            hour: 'HH:mm',
                            day: 'MMM d'
                        }
                    },
                    grid: {
                        color: 'rgba(156, 163, 175, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(156, 163, 175, 0.8)',
                        maxRotation: 0
                    }
                },
                y: {
                    beginAtZero: metric.key !== 'status_code',
                    grid: {
                        color: 'rgba(156, 163, 175, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(156, 163, 175, 0.8)',
                        callback: function(value) {
                            return value + (metric.unit ? ' ' + metric.unit : '');
                        }
                    }
                }
            }
        }
    });
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
            const isPassive = passiveMonitorTypes.has(monitor.monitor_type);
            const checkNowBtn = !isPassive ? `
                <button class="check-now-btn" onclick="checkMonitorNow(${monitor.monitor_id}, this)" title="Run check now">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M5 12l5 5L20 7"/>
                    </svg>
                    Check Now
                </button>
            ` : '';
            return `
            <div class="monitor-detail-card">
                <div class="monitor-detail-header">
                    <div style="flex: 1;">
                        <div class="monitor-type">${getMonitorTypeName(monitor.monitor_type)}</div>
                        ${description ? `<div class="monitor-description">${description}</div>` : ''}
                        <div class="monitor-interval">Every ${monitor.check_interval_minutes} minutes</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        ${checkNowBtn}
                        <div class="status-indicator status-${getStatusClass(monitor.status)}">
                            <span class="status-dot"></span>
                            ${getStatusText(monitor.status)}
                        </div>
                    </div>
                </div>
                <div class="monitor-metrics">
                    ${getMonitorMetrics(monitor)}
                </div>
            </div>
        `}).join('');
    } else {
        monitorDetailsList.innerHTML = '<p style="text-align: center; color: var(--text-tertiary); padding: 2rem;">No monitors configured for this service</p>';
    }

    // Initialize graph section
    if (service.monitors && service.monitors.length > 0) {
        document.getElementById('graphSection').style.display = 'block';
        populateGraphSelectors(service);
        // Reset period to 24h
        currentGraphPeriod = '24h';
        document.querySelectorAll('.graph-period-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.period === '24h');
        });
        // Load graph data
        fetchAndRenderGraph();
    } else {
        document.getElementById('graphSection').style.display = 'none';
    }

    // Show AI analyze button and suggestions if AI is enabled
    const aiAnalyzeContainer = document.getElementById('modalAiAnalyzeContainer');
    const hasIssue = service.status === 'degraded' || service.status === 'down';
    const hasPendingAnalysis = pendingActionsByService[service.service_id]?.length > 0;

    if (aiEnabled && hasIssue && !hasPendingAnalysis) {
        // Show analyze button (no pending analysis)
        aiAnalyzeContainer.innerHTML = `
            <button class="modal-ai-analyze-btn" onclick="analyzeServiceWithAi(${service.service_id}, '${service.service.replace(/'/g, "\\'")}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                </svg>
                Analyze with AI
            </button>
        `;
        loadModalAiSuggestions(serviceId);
    } else if (aiEnabled && hasIssue && hasPendingAnalysis) {
        // Show pending indicator (analysis already exists)
        aiAnalyzeContainer.innerHTML = `
            <div class="modal-ai-analysis-available">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v6l4 2"/>
                </svg>
                Analysis Available
            </div>
        `;
        loadModalAiSuggestions(serviceId);
    } else if (aiEnabled) {
        aiAnalyzeContainer.innerHTML = '';
        loadModalAiSuggestions(serviceId);
    } else {
        aiAnalyzeContainer.innerHTML = '';
        document.getElementById('modalAiSuggestions').classList.add('hidden');
    }

    document.getElementById('monitorDetailsModal').classList.remove('hidden');
}

function closeMonitorModal() {
    document.getElementById('monitorDetailsModal').classList.add('hidden');
}

async function checkMonitorNow(monitorId, btn) {
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `
        <svg class="spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32"/>
        </svg>
        Checking...
    `;

    showToast('Running monitor check...', 'info');

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/monitors/${monitorId}/check`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (response.ok) {
            const statusText = data.status === 'operational' ? 'Operational' :
                              data.status === 'degraded' ? 'Degraded' : 'Down';
            showToast(`Check complete: ${statusText}`, data.status === 'operational' ? 'success' : 'error');
            // Refresh the dashboard to show updated status
            await loadDashboard();
        } else {
            showToast(data.detail || 'Check failed', 'error');
        }
    } catch (error) {
        showToast('Failed to run check', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
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

// ============================================
// AI SRE Suggestions (Modal Integration)
// ============================================

// Store pending actions by service ID for quick lookup
let pendingActionsByService = {};

function renderConfidenceBar(confidence) {
    const percentage = Math.round(confidence * 100);
    const color = confidence >= 0.8 ? 'var(--status-operational)' :
                  confidence >= 0.5 ? 'var(--status-degraded)' : 'var(--status-down)';
    return `
        <div class="ai-confidence">
            <span class="ai-confidence-label">Confidence</span>
            <div class="ai-confidence-bar">
                <div class="ai-confidence-fill" style="width: ${percentage}%; background: ${color};"></div>
            </div>
            <span class="ai-confidence-value">${percentage}%</span>
        </div>
    `;
}

function renderModalAiSuggestionCard(action) {
    const hasWebhook = action.config && action.config.webhook;
    const webhook = hasWebhook ? action.config.webhook : null;
    const actionButtonText = hasWebhook ? 'Execute Action' : 'Acknowledge';

    // Build webhook info display
    let webhookInfo = '';
    if (webhook) {
        webhookInfo = `
            <div class="modal-ai-webhook">
                <div class="modal-ai-webhook-header">
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                    </svg>
                    Action: ${webhook.name || 'Webhook'}
                </div>
                <div class="modal-ai-webhook-url">
                    <span class="modal-ai-webhook-method modal-ai-webhook-method-${(webhook.method || 'POST').toLowerCase()}">${webhook.method || 'POST'}</span>
                    ${webhook.url}
                </div>
            </div>
        `;
    }

    return `
        <div class="modal-ai-card" data-action-id="${action.id}">
            <div class="modal-ai-card-header">
                <span class="modal-ai-badge">AI Recommendation</span>
                <span class="modal-ai-time">${formatTimestamp(action.created_at)}</span>
            </div>

            <div class="modal-ai-description">${action.description}</div>

            <div class="modal-ai-reasoning">${action.reasoning}</div>

            ${renderConfidenceBar(action.confidence)}

            ${webhookInfo}

            ${action.config && action.config.alternatives && action.config.alternatives.length > 0 ? `
                <details class="modal-ai-alternatives">
                    <summary>Alternative approaches</summary>
                    <ul>
                        ${action.config.alternatives.map(alt => `<li>${alt}</li>`).join('')}
                    </ul>
                </details>
            ` : ''}

            <div class="modal-ai-actions">
                <button class="modal-ai-btn modal-ai-btn-approve" onclick="event.stopPropagation(); approveAiAction(${action.id})">
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                    </svg>
                    ${actionButtonText}
                </button>
                <button class="modal-ai-btn modal-ai-btn-dismiss" onclick="event.stopPropagation(); rejectAiAction(${action.id})">
                    Dismiss
                </button>
            </div>
        </div>
    `;
}

async function loadAllPendingActions() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/ai/actions', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            pendingActionsByService = {};
            return;
        }

        const actions = await response.json();

        // Group by service ID
        pendingActionsByService = {};
        for (const action of actions) {
            if (!pendingActionsByService[action.service_id]) {
                pendingActionsByService[action.service_id] = [];
            }
            pendingActionsByService[action.service_id].push(action);
        }
    } catch (error) {
        console.debug('Failed to load pending actions:', error);
        pendingActionsByService = {};
    }
}

function loadModalAiSuggestions(serviceId) {
    const container = document.getElementById('modalAiSuggestions');
    const list = document.getElementById('modalAiSuggestionsList');

    const actions = pendingActionsByService[serviceId] || [];

    if (actions.length === 0) {
        container.classList.add('hidden');
        return;
    }

    list.innerHTML = actions.map(action => renderModalAiSuggestionCard(action)).join('');
    container.classList.remove('hidden');
}

async function approveAiAction(actionId) {
    const card = document.querySelector(`[data-action-id="${actionId}"]`);
    if (card) {
        card.classList.add('modal-ai-processing');
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/ai/actions/${actionId}/approve`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to approve action');
        }

        const result = await response.json();

        // Action was processed (even if webhook failed)
        if (result.processed) {
            // Remove card with appropriate animation
            if (card) {
                card.classList.add(result.success ? 'modal-ai-approved' : 'modal-ai-failed');
                setTimeout(() => {
                    card.remove();
                    checkModalAiEmpty();
                }, 400);
            }

            // Show appropriate toast
            if (result.success) {
                showToast(result.message || 'Action executed successfully', 'success');
            } else {
                showToast(result.error || 'Webhook execution failed', 'error');
            }

            // Refresh pending actions and dashboard cards
            await loadAllPendingActions();
            await loadDashboard();
        }

    } catch (error) {
        console.error('Failed to approve action:', error);
        showToast(error.message || 'Failed to execute action', 'error');
        if (card) {
            card.classList.remove('modal-ai-processing');
        }
    }
}

async function rejectAiAction(actionId) {
    const card = document.querySelector(`[data-action-id="${actionId}"]`);

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/ai/actions/${actionId}/reject`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to dismiss action');
        }

        // Remove card with animation
        if (card) {
            card.classList.add('modal-ai-dismissed');
            setTimeout(() => {
                card.remove();
                checkModalAiEmpty();
            }, 300);
        }

        // Refresh pending actions and dashboard cards
        await loadAllPendingActions();
        await loadDashboard();

    } catch (error) {
        console.error('Failed to reject action:', error);
        showToast(error.message || 'Failed to dismiss action', 'error');
    }
}

function checkModalAiEmpty() {
    const container = document.getElementById('modalAiSuggestions');
    const list = document.getElementById('modalAiSuggestionsList');

    if (list.querySelectorAll('.modal-ai-card').length === 0) {
        container.classList.add('hidden');
    }
}

// ============================================
// Initialize Dashboard
// ============================================

async function loadDashboardWithAi() {
    await fetchMonitorTypes();
    await checkAiStatus();
    await loadDashboard();
    if (aiEnabled) {
        await loadAllPendingActions();
    }
}

loadDashboardWithAi();

statusPoller = new Poller(loadDashboardWithAi, 10000);
statusPoller.start();

window.addEventListener('beforeunload', () => {
    if (statusPoller) {
        statusPoller.stop();
    }
});
