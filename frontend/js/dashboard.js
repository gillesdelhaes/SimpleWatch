/**
 * Dashboard Page JavaScript
 * Handles dashboard display and real-time status updates
 */

requireAuth();

const userInfo = getUserInfo();
let statusPoller;
let aiEnabled = false;

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
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

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
                    ${getMonitorMetrics(monitor)}
                </div>
            </div>
        `}).join('');
    } else {
        monitorDetailsList.innerHTML = '<p style="text-align: center; color: var(--text-tertiary); padding: 2rem;">No monitors configured for this service</p>';
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
    const actionButtonText = hasWebhook ? 'Execute Action' : 'Acknowledge';

    return `
        <div class="modal-ai-card" data-action-id="${action.id}">
            <div class="modal-ai-card-header">
                <span class="modal-ai-badge">AI Recommendation</span>
                <span class="modal-ai-time">${formatTimestamp(action.created_at)}</span>
            </div>

            <div class="modal-ai-description">${action.description}</div>

            <div class="modal-ai-reasoning">${action.reasoning}</div>

            ${renderConfidenceBar(action.confidence)}

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

        // Remove card with animation
        if (card) {
            card.classList.add('modal-ai-approved');
            setTimeout(() => {
                card.remove();
                checkModalAiEmpty();
            }, 400);
        }

        // Show success toast using app's toast system
        showToast(result.message || 'Action executed successfully', 'success');

        // Refresh pending actions and dashboard cards
        await loadAllPendingActions();
        await loadDashboard();

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
