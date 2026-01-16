// Incidents page - uses global api, showSuccess, showError, requireAuth, getUserInfo from loaded scripts

let timelineChart = null;
let serviceChart = null;
let aiEnabled = false;
let actionHistoryData = null;
let incidentLogExpanded = false;
let actionHistoryExpanded = false;

// Require authentication
requireAuth();

// Check AI status and setup UI
async function checkAiStatus() {
    try {
        const response = await api.get('/ai/status');
        aiEnabled = response.enabled && response.connected;

        if (aiEnabled) {
            // Show header button
            const headerBtn = document.getElementById('generateReportHeaderBtn');
            if (headerBtn) headerBtn.style.display = 'flex';

            // Show action history section
            const historySection = document.getElementById('aiActionHistorySection');
            if (historySection) historySection.style.display = 'block';

            // Populate report modal service dropdown
            const select = document.getElementById('reportServiceSelect');
            if (select) {
                const services = await api.listServices();
                (Array.isArray(services) ? services : services.services || [])
                    .filter(s => s.is_active)
                    .forEach(s => {
                        const opt = document.createElement('option');
                        opt.value = s.id;
                        opt.textContent = s.name;
                        select.appendChild(opt);
                    });
            }

            // Set default dates (last 30 days)
            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - 30);
            const endInput = document.getElementById('reportEndDate');
            const startInput = document.getElementById('reportStartDate');
            if (endInput) endInput.value = end.toISOString().split('T')[0];
            if (startInput) startInput.value = start.toISOString().split('T')[0];
        }
    } catch (error) {
        aiEnabled = false;
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    await checkAiStatus();
    await loadServices();
    await loadIncidents();
    await loadStats();

    // Expand incident log by default
    toggleIncidentLog();
});

async function loadServices() {
    try {
        const response = await api.listServices();
        // API returns services directly as an array, not wrapped in an object
        const services = Array.isArray(response) ? response : (response.services || []);
        const select = document.getElementById('serviceFilter');

        // Only show active services in the dropdown
        services.filter(service => service.is_active).forEach(service => {
            const option = document.createElement('option');
            option.value = service.id;
            option.textContent = service.name;
            select.appendChild(option);
        });
    } catch (error) {
        showError('Failed to load services: ' + error.message);
    }
}

async function loadIncidents() {
    try {
        const timeWindow = document.getElementById('timeWindow').value;
        const serviceId = document.getElementById('serviceFilter').value;
        const status = document.getElementById('statusFilter').value;

        const params = { time_window: timeWindow };
        if (serviceId) params.service_id = serviceId;
        if (status) params.status = status;

        const response = await api.get('/incidents', params);

        renderIncidentsTable(response.incidents);
    } catch (error) {
        showError('Failed to load incidents: ' + error.message);
    }
}

async function loadStats() {
    try {
        const timeWindow = document.getElementById('timeWindow').value;
        const serviceId = document.getElementById('serviceFilter').value;

        const params = { time_window: timeWindow };
        if (serviceId) params.service_id = serviceId;

        const response = await api.get('/incidents/stats', params);

        renderStats(response);
        await renderCharts(timeWindow);
    } catch (error) {
        showError('Failed to load statistics: ' + error.message);
    }
}

function renderStats(stats) {
    const grid = document.getElementById('statsGrid');
    const uptimeDisplay = stats.uptime_percentage !== null ? `${stats.uptime_percentage}%` : 'N/A';
    grid.innerHTML = `
        <div class="stat-card">
            <div class="stat-label">Total Incidents</div>
            <div class="stat-value">${stats.total_incidents}</div>
            <div class="stat-trend">${stats.ongoing_incidents} ongoing, ${stats.resolved_incidents} resolved</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Mean Time To Recovery</div>
            <div class="stat-value">${stats.mttr_formatted}</div>
            <div class="stat-trend">Average incident duration</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Uptime</div>
            <div class="stat-value">${uptimeDisplay}</div>
            <div class="stat-trend">Last ${stats.time_window}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Critical Incidents</div>
            <div class="stat-value">${stats.by_severity.down || 0}</div>
            <div class="stat-trend">${stats.by_severity.degraded || 0} degraded</div>
        </div>
    `;
}

async function renderCharts(timeWindow) {
    const serviceId = document.getElementById('serviceFilter').value;

    // Timeline Chart
    const timelineParams = { time_window: timeWindow };
    if (serviceId) timelineParams.service_id = serviceId;

    const timelineData = await api.get('/incidents/timeline', timelineParams);

    const timelineCtx = document.getElementById('timelineChart');
    if (timelineChart) {
        timelineChart.destroy();
    }

    timelineChart = new Chart(timelineCtx, {
        type: 'line',
        data: {
            labels: timelineData.labels.map(formatChartLabel),
            datasets: [{
                label: 'Incidents',
                data: timelineData.data,
                borderColor: 'rgb(239, 68, 68)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            }
        }
    });

    // Service Chart (from stats)
    const statsParams = { time_window: timeWindow };
    if (serviceId) statsParams.service_id = serviceId;

    const statsData = await api.get('/incidents/stats', statsParams);

    const serviceCtx = document.getElementById('serviceChart');
    if (serviceChart) {
        serviceChart.destroy();
    }

    const serviceData = statsData.by_service || [];

    serviceChart = new Chart(serviceCtx, {
        type: 'bar',
        data: {
            labels: serviceData.map(s => s.service_name),
            datasets: [{
                label: 'Incidents',
                data: serviceData.map(s => s.count),
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                borderColor: 'rgb(59, 130, 246)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            }
        }
    });
}

function renderIncidentsTable(incidents) {
    const container = document.getElementById('incidentsTable');

    if (incidents.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon" id="checkCircleIcon"></div>
                <div class="empty-state-title">No incidents found</div>
                <div class="empty-state-text">All services are running smoothly in this time period</div>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <table class="incidents-table">
            <thead>
                <tr>
                    <th>Service</th>
                    <th>Started</th>
                    <th>Duration</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Affected Monitors</th>
                    ${aiEnabled ? '<th>Report</th>' : ''}
                </tr>
            </thead>
            <tbody>
                ${incidents.map(incident => `
                    <tr>
                        <td>
                            <div class="incident-service">${incident.service_name}</div>
                        </td>
                        <td>
                            <div class="incident-time">${formatTimestamp(incident.started_at)}</div>
                            ${incident.ended_at ? `<div class="incident-time">Ended: ${formatTimestamp(incident.ended_at)}</div>` : '<div class="incident-time">Ongoing</div>'}
                        </td>
                        <td>
                            <div class="incident-duration">
                                ${incident.duration_seconds ? formatDuration(incident.duration_seconds) : 'Ongoing'}
                            </div>
                        </td>
                        <td>
                            <span class="badge severity-${incident.severity}">${incident.severity}</span>
                        </td>
                        <td>
                            <span class="badge status-${incident.status}">${incident.status}</span>
                        </td>
                        <td>
                            <div class="incident-monitors">
                                ${incident.affected_monitors.map(m => `
                                    <span class="monitor-badge">${m.type}${m.name ? ': ' + m.name : ''}</span>
                                `).join('')}
                            </div>
                        </td>
                        ${aiEnabled ? `
                        <td>
                            <button class="btn-postmortem" onclick="generateIncidentPostmortem(${incident.id})" title="Generate Post-Mortem">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                    <polyline points="14 2 14 8 20 8"/>
                                    <line x1="16" y1="13" x2="8" y2="13"/>
                                    <line x1="16" y1="17" x2="8" y2="17"/>
                                    <polyline points="10 9 9 9 8 9"/>
                                </svg>
                            </button>
                        </td>
                        ` : ''}
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function exportIncidentsCSV() {
    try {
        const timeWindow = document.getElementById('timeWindow').value;
        const serviceId = document.getElementById('serviceFilter').value;

        const params = new URLSearchParams({ time_window: timeWindow });
        if (serviceId) params.append('service_id', serviceId);

        const url = `/api/v1/incidents/export?${params.toString()}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Export failed');
        }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `incidents_${timeWindow}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);

        showSuccess('Incidents exported successfully');
    } catch (error) {
        showError('Failed to export incidents: ' + error.message);
    }
}

function formatTimestamp(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString();
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
}

function formatChartLabel(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ============================================
// Post-Mortem Generation
// ============================================

async function generateIncidentPostmortem(incidentId) {
    const btn = event.target.closest('.btn-postmortem');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<svg class="ai-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32"/></svg>`;
    }

    try {
        const response = await fetch('/api/v1/ai/postmortem', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                incident_id: incidentId
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to generate report');
        }

        const result = await response.json();
        showPostmortemModal(result.report);

    } catch (error) {
        showError(error.message || 'Failed to generate post-mortem');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;
        }
    }
}

function openReportGeneratorModal() {
    document.getElementById('reportGeneratorModal').classList.remove('hidden');
}

function closeReportGeneratorModal() {
    document.getElementById('reportGeneratorModal').classList.add('hidden');
}

async function generateServiceReport() {
    const serviceId = document.getElementById('reportServiceSelect').value;
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;

    if (!serviceId || !startDate || !endDate) {
        showError('Please select a service and date range');
        return;
    }

    const btn = document.getElementById('generateReportBtn');
    btn.disabled = true;
    btn.innerHTML = `<svg class="ai-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32"/></svg> Generating...`;

    try {
        const response = await fetch('/api/v1/ai/postmortem', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                service_id: parseInt(serviceId),
                start_date: startDate,
                end_date: endDate
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to generate report');
        }

        const result = await response.json();
        closeReportGeneratorModal();
        showPostmortemModal(result.report);

    } catch (error) {
        showError(error.message || 'Failed to generate post-mortem');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Generate Report';
    }
}

function showPostmortemModal(markdown) {
    const modal = document.getElementById('postmortemModal');
    const content = document.getElementById('postmortemContent');

    // Store raw markdown for download/copy
    modal.dataset.markdown = markdown;

    // Render markdown (basic conversion)
    content.innerHTML = renderMarkdown(markdown);
    modal.classList.remove('hidden');
}

function closePostmortemModal() {
    document.getElementById('postmortemModal').classList.add('hidden');
}

function renderMarkdown(md) {
    // Basic markdown to HTML conversion
    return md
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^- (.*$)/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/^(.+)$/gm, function(match) {
            if (match.startsWith('<')) return match;
            return `<p>${match}</p>`;
        })
        .replace(/<p><\/p>/g, '')
        .replace(/<p>(<h[123]>)/g, '$1')
        .replace(/(<\/h[123]>)<\/p>/g, '$1')
        .replace(/<p>(<ul>)/g, '$1')
        .replace(/(<\/ul>)<\/p>/g, '$1')
        .replace(/<p>(<li>)/g, '$1')
        .replace(/(<\/li>)<\/p>/g, '$1');
}

function downloadPostmortem() {
    const modal = document.getElementById('postmortemModal');
    const markdown = modal.dataset.markdown;

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `postmortem_${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showSuccess('Post-mortem downloaded');
}

function copyPostmortem() {
    const modal = document.getElementById('postmortemModal');
    const markdown = modal.dataset.markdown;

    navigator.clipboard.writeText(markdown).then(() => {
        showSuccess('Post-mortem copied to clipboard');
    }).catch(() => {
        showError('Failed to copy to clipboard');
    });
}

// ============================================
// AI Action History
// ============================================

async function loadActionHistory(offset = 0) {
    try {
        const serviceId = document.getElementById('serviceFilter').value;
        const status = document.getElementById('actionStatusFilter').value;

        const params = { limit: 50, offset: offset };
        if (serviceId) params.service_id = serviceId;
        if (status) params.status = status;

        const response = await api.get('/ai/actions/history', params);
        actionHistoryData = response;

        renderActionHistoryTable(response.items);
        renderActionHistoryPagination(response.total, response.limit, response.offset);
    } catch (error) {
        console.error('Failed to load action history:', error);
    }
}

function renderActionHistoryTable(actions) {
    const container = document.getElementById('actionHistoryTable');

    if (!actions || actions.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 2rem;">
                <div class="empty-state-title">No AI actions recorded</div>
                <div class="empty-state-text">AI suggestions and their outcomes will appear here</div>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <table class="incidents-table">
            <thead>
                <tr>
                    <th>Timestamp</th>
                    <th>Service</th>
                    <th>Action</th>
                    <th>Confidence</th>
                    <th>Status</th>
                    <th>Executed By</th>
                </tr>
            </thead>
            <tbody>
                ${actions.map(action => `
                    <tr>
                        <td>
                            <div class="incident-time">${formatTimestamp(action.created_at)}</div>
                            ${action.executed_at ? `<div class="incident-time" style="font-size: 0.75rem;">Resolved: ${formatTimestamp(action.executed_at)}</div>` : ''}
                        </td>
                        <td>
                            <div class="incident-service">${action.service_name}</div>
                        </td>
                        <td>
                            <div style="max-width: 300px;">
                                <div style="font-weight: 500;">${action.description || 'N/A'}</div>
                                ${action.config?.webhook ? `
                                    <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 0.25rem;">
                                        ${action.config.webhook.name || 'Webhook'}: ${action.config.webhook.method} ${truncateUrl(action.config.webhook.url)}
                                    </div>
                                ` : ''}
                            </div>
                        </td>
                        <td>
                            <div class="confidence-display">
                                <div class="confidence-bar">
                                    <div class="confidence-fill" style="width: ${(action.confidence * 100).toFixed(0)}%;"></div>
                                </div>
                                <span>${(action.confidence * 100).toFixed(0)}%</span>
                            </div>
                        </td>
                        <td>
                            <span class="badge action-status-${action.status}">${action.status}</span>
                        </td>
                        <td>
                            <div style="font-size: 0.875rem; color: var(--text-secondary);">
                                ${formatExecutedBy(action.executed_by)}
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderActionHistoryPagination(total, limit, offset) {
    const container = document.getElementById('actionHistoryPagination');

    if (total <= limit) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';
    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    container.innerHTML = `
        <button class="btn btn-secondary btn-sm" ${offset === 0 ? 'disabled' : ''} onclick="loadActionHistory(${offset - limit})">
            Previous
        </button>
        <span style="color: var(--text-secondary); font-size: 0.875rem;">
            Page ${currentPage} of ${totalPages} (${total} items)
        </span>
        <button class="btn btn-secondary btn-sm" ${offset + limit >= total ? 'disabled' : ''} onclick="loadActionHistory(${offset + limit})">
            Next
        </button>
    `;
}

function truncateUrl(url) {
    if (!url) return '';
    if (url.length <= 40) return url;
    return url.substring(0, 37) + '...';
}

function formatExecutedBy(executedBy) {
    if (!executedBy) return '-';
    if (executedBy === 'auto') return 'Auto-execute';
    if (executedBy.startsWith('user:')) return 'User';
    return executedBy;
}

// ============================================
// Collapsible Section Toggles
// ============================================

function toggleIncidentLog() {
    const section = document.getElementById('incidentLogSection');
    incidentLogExpanded = !incidentLogExpanded;

    if (incidentLogExpanded) {
        section.classList.add('expanded');
    } else {
        section.classList.remove('expanded');
    }
}

function toggleActionHistory() {
    const section = document.getElementById('aiActionHistorySection');
    actionHistoryExpanded = !actionHistoryExpanded;

    if (actionHistoryExpanded) {
        section.classList.add('expanded');
        loadActionHistory();
    } else {
        section.classList.remove('expanded');
    }
}

async function exportActionHistoryCSV() {
    try {
        const serviceId = document.getElementById('serviceFilter').value;
        const status = document.getElementById('actionStatusFilter').value;

        // Fetch all actions (no pagination for export)
        const params = { limit: 10000, offset: 0 };
        if (serviceId) params.service_id = serviceId;
        if (status) params.status = status;

        const response = await api.get('/ai/actions/history', params);
        const actions = response.items;

        if (actions.length === 0) {
            showError('No actions to export');
            return;
        }

        // Build CSV
        const headers = ['Timestamp', 'Service', 'Action', 'Confidence', 'Status', 'Executed By', 'Executed At', 'Reasoning'];
        const rows = actions.map(a => [
            a.created_at,
            a.service_name,
            `"${(a.description || '').replace(/"/g, '""')}"`,
            (a.confidence * 100).toFixed(0) + '%',
            a.status,
            formatExecutedBy(a.executed_by),
            a.executed_at || '',
            `"${(a.reasoning || '').replace(/"/g, '""')}"`
        ]);

        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai_action_history_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showSuccess('Action history exported');
    } catch (error) {
        showError('Failed to export action history: ' + error.message);
    }
}

// Export functions for global access
window.loadIncidents = loadIncidents;
window.loadStats = loadStats;
window.exportIncidentsCSV = exportIncidentsCSV;
window.generateIncidentPostmortem = generateIncidentPostmortem;
window.openReportGeneratorModal = openReportGeneratorModal;
window.closeReportGeneratorModal = closeReportGeneratorModal;
window.generateServiceReport = generateServiceReport;
window.showPostmortemModal = showPostmortemModal;
window.closePostmortemModal = closePostmortemModal;
window.downloadPostmortem = downloadPostmortem;
window.copyPostmortem = copyPostmortem;
window.loadActionHistory = loadActionHistory;
window.exportActionHistoryCSV = exportActionHistoryCSV;
window.toggleIncidentLog = toggleIncidentLog;
window.toggleActionHistory = toggleActionHistory;
