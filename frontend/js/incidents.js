// Incidents page - uses global api, showSuccess, showError, requireAuth, getUserInfo from loaded scripts

let timelineChart = null;
let serviceChart = null;

// Require authentication
requireAuth();

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    await loadServices();
    await loadIncidents();
    await loadStats();
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

// Export functions for global access
window.loadIncidents = loadIncidents;
window.loadStats = loadStats;
window.exportIncidentsCSV = exportIncidentsCSV;
