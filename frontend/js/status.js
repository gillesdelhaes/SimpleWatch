/**
 * Public Status Page JavaScript
 * Handles fetching and displaying public service status
 * No authentication required
 */

let refreshInterval;

// Format timestamp to human-readable
function formatTimestamp(isoString) {
    if (!isoString) return 'Never';

    const date = new Date(isoString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Format duration from seconds
function formatDuration(seconds) {
    if (!seconds) return 'Unknown';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

// Calculate overall system status from all services
function calculateOverallStatus(services) {
    if (!services || services.length === 0) {
        return {
            status: 'operational',
            label: 'All Systems Operational',
            subtitle: 'No issues detected'
        };
    }

    const downCount = services.filter(s => s.status === 'down').length;
    const degradedCount = services.filter(s => s.status === 'degraded').length;

    if (downCount > 0) {
        return {
            status: 'down',
            label: 'System Outage',
            subtitle: `${downCount} service${downCount > 1 ? 's' : ''} down`
        };
    } else if (degradedCount > 0) {
        return {
            status: 'degraded',
            label: 'Partial Outage',
            subtitle: `${degradedCount} service${degradedCount > 1 ? 's' : ''} degraded`
        };
    } else {
        return {
            status: 'operational',
            label: 'All Systems Operational',
            subtitle: `${services.length} service${services.length > 1 ? 's' : ''} monitored`
        };
    }
}

// Update overall status indicator
function updateOverallStatus(overallStatus) {
    const statusIndicator = document.querySelector('.status-pulse');
    const statusLabel = document.querySelector('.overall-status-label');
    const statusSubtitle = document.querySelector('.overall-status-subtitle');

    // Remove all status classes
    statusIndicator.classList.remove('operational', 'degraded', 'down');

    // Add current status class
    statusIndicator.classList.add(overallStatus.status);

    // Update text
    statusLabel.textContent = overallStatus.label;
    statusSubtitle.textContent = overallStatus.subtitle;
}

// Render incident item
function renderIncident(incident) {
    const statusClass = incident.status === 'ongoing' ? 'ongoing' : 'resolved';
    const severityClass = incident.severity === 'down' ? 'down' : 'degraded';

    const startTime = formatTimestamp(incident.started_at);
    const duration = incident.duration_seconds
        ? formatDuration(incident.duration_seconds)
        : 'Ongoing';

    return `
        <div class="incident-item ${severityClass} ${statusClass}">
            <div class="incident-time">${startTime}</div>
            <div class="incident-duration">
                Duration: ${duration}
                <span class="incident-status ${statusClass}">${incident.status}</span>
            </div>
        </div>
    `;
}

// Render service card
function renderServiceCard(service) {
    const statusClass = service.status || 'unknown';
    const statusText = service.status.charAt(0).toUpperCase() + service.status.slice(1);

    // Recent incidents (ongoing or last resolved within 48h)
    const incidents = service.recent_incidents || [];
    const hasOngoing = incidents.some(i => i.status === 'ongoing');
    const incidentHeader = hasOngoing ? 'Active Incident' : 'Recent Incident';

    return `
        <div class="service-card ${statusClass} fade-in">
            <div class="service-header">
                <h2 class="service-name">${service.service_name}</h2>
                <div class="service-status-badge ${statusClass}">
                    <div class="status-dot"></div>
                    ${statusText}
                </div>
            </div>

            <div class="service-metrics">
                <div class="metric-box">
                    <span class="metric-value">${service.uptime_7d.toFixed(1)}%</span>
                    <span class="metric-label">7-Day Uptime</span>
                </div>
                <div class="metric-box">
                    <span class="metric-value ${statusClass}">${statusText}</span>
                    <span class="metric-label">Current Status</span>
                </div>
            </div>

            ${incidents.length > 0 ? `
                <div class="incidents-section">
                    <div class="incidents-header">${incidentHeader}</div>
                    <div class="incident-list">
                        ${incidents.map(incident => renderIncident(incident)).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

// Fetch and render status
async function fetchStatus() {
    try {
        const response = await fetch('/api/v1/status/public');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Update last updated time
        const lastUpdatedEl = document.getElementById('lastUpdated');
        const updatedTime = new Date(data.updated_at);
        lastUpdatedEl.innerHTML = `Last updated: <span class="mono">${updatedTime.toLocaleTimeString()}</span>`;

        const servicesContainer = document.getElementById('servicesContainer');
        const emptyState = document.getElementById('emptyState');

        if (!data.services || data.services.length === 0) {
            // Show empty state
            servicesContainer.classList.add('hidden');
            emptyState.classList.remove('hidden');

            // Update overall status
            updateOverallStatus({
                status: 'operational',
                label: 'All Systems Operational',
                subtitle: 'No public services configured'
            });
        } else {
            // Hide empty state
            emptyState.classList.add('hidden');
            servicesContainer.classList.remove('hidden');

            // Calculate and update overall status
            const overallStatus = calculateOverallStatus(data.services);
            updateOverallStatus(overallStatus);

            // Render services with stagger animation
            servicesContainer.innerHTML = '';
            servicesContainer.classList.add('stagger-in');

            data.services.forEach(service => {
                const cardHtml = renderServiceCard(service);
                servicesContainer.insertAdjacentHTML('beforeend', cardHtml);
            });
        }
    } catch (error) {
        console.error('Error fetching status:', error);

        // Show error state
        const servicesContainer = document.getElementById('servicesContainer');
        servicesContainer.innerHTML = `
            <div class="loading-state">
                <div style="font-size: 3rem; opacity: 0.3;">⚠️</div>
                <p style="color: var(--status-down);">Failed to load status information</p>
                <p style="font-size: 0.75rem; color: var(--text-tertiary);">Retrying in 30 seconds...</p>
            </div>
        `;

        // Update overall status to show error
        updateOverallStatus({
            status: 'down',
            label: 'Cannot Load Status',
            subtitle: 'Connection error - retrying...'
        });
    }
}

// Initialize page
function init() {
    // Fetch status immediately
    fetchStatus();

    // Set up auto-refresh every 30 seconds
    refreshInterval = setInterval(fetchStatus, 30000);
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Clean up interval on page unload
window.addEventListener('beforeunload', () => {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
});
