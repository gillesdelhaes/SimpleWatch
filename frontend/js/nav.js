// Shared Navigation Component

function createNavigation(activePage) {
    const userInfo = getUserInfo();

    const nav = `
        <nav style="background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); position: sticky; top: 0; z-index: 100; backdrop-filter: blur(10px);">
            <div style="max-width: 1400px; margin: 0 auto; padding: 0 2rem; display: flex; justify-content: space-between; align-items: center; height: 4rem;">
                <div style="font-family: var(--font-display); font-size: 1.5rem; font-weight: 700; background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                    SimpleWatch
                </div>
                <div style="display: flex; align-items: center; gap: 2rem;">
                    <a href="/static/dashboard.html" class="nav-link ${activePage === 'dashboard' ? 'active' : ''}">Dashboard</a>
                    <a href="/static/services.html" class="nav-link ${activePage === 'services' ? 'active' : ''}">Services</a>
                    <a href="/static/incidents.html" class="nav-link ${activePage === 'incidents' ? 'active' : ''}">Incidents</a>
                    <a href="/static/notifications.html" class="nav-link ${activePage === 'notifications' ? 'active' : ''}">Notifications</a>
                    <a href="/static/settings.html" class="nav-link ${activePage === 'settings' ? 'active' : ''}">Settings</a>
                    ${userInfo.isAdmin ? `<a href="/static/users.html" class="nav-link ${activePage === 'users' ? 'active' : ''}">Users</a>` : ''}
                    <div id="aiStatusIndicator" title="AI SRE Companion" style="cursor: pointer; display: none;"></div>
                    <div id="navThemeToggle"></div>
                    <span style="color: var(--text-tertiary); font-family: var(--font-mono); font-size: 0.875rem;">${userInfo.username}</span>
                    <button onclick="logout()" style="color: var(--status-down); background: none; border: none; font-weight: 600; font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer;">Logout</button>
                </div>
            </div>
        </nav>
        <style>
            .nav-link {
                color: var(--text-secondary);
                text-decoration: none;
                font-weight: 600;
                font-size: 0.875rem;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                transition: color var(--transition-normal);
                position: relative;
            }
            .nav-link:hover {
                color: var(--accent-primary);
            }
            .nav-link.active {
                color: var(--accent-primary);
            }
            .nav-link.active::after {
                content: '';
                position: absolute;
                bottom: -1.25rem;
                left: 0;
                right: 0;
                height: 2px;
                background: var(--accent-primary);
            }
        </style>
    `;

    return nav;
}

/**
 * Update AI status indicator in navigation
 */
function updateAIStatusIndicator() {
    const indicator = document.getElementById('aiStatusIndicator');
    if (!indicator) return;

    try {
        const statusStr = localStorage.getItem('ai_status');
        if (!statusStr) {
            indicator.style.display = 'none';
            return;
        }

        const status = JSON.parse(statusStr);

        if (!status.enabled) {
            indicator.style.display = 'none';
            return;
        }

        // Show indicator
        indicator.style.display = 'flex';
        indicator.style.alignItems = 'center';
        indicator.style.gap = '0.375rem';
        indicator.style.position = 'relative';

        // Determine color based on connection status
        let color;
        if (status.connected === true) {
            color = 'var(--status-operational)';
        } else if (status.connected === false) {
            color = 'var(--status-down)';
        } else {
            color = 'var(--status-degraded)';
        }

        indicator.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="4" y="6" width="16" height="14" rx="3" ry="3"/>
                <circle cx="9" cy="12" r="1.5" fill="${color}" stroke="none"/>
                <circle cx="15" cy="12" r="1.5" fill="${color}" stroke="none"/>
                <path d="M9 16h6" stroke-width="2"/>
                <path d="M12 2v4"/>
                <circle cx="12" cy="2" r="1" fill="${color}" stroke="none"/>
                <path d="M2 11h2"/>
                <path d="M20 11h2"/>
            </svg>
        `;

        // Click to toggle popup
        indicator.onclick = (e) => {
            e.stopPropagation();
            toggleAIStatusPopup(status);
        };

    } catch (error) {
        console.error('Error updating AI status indicator:', error);
        indicator.style.display = 'none';
    }
}

/**
 * Toggle AI status popup
 */
function toggleAIStatusPopup(status) {
    // Remove existing popup if any
    const existingPopup = document.getElementById('aiStatusPopup');
    if (existingPopup) {
        existingPopup.remove();
        return;
    }

    const indicator = document.getElementById('aiStatusIndicator');
    if (!indicator) return;

    // Determine status info
    let statusText, statusColor, statusDot;
    if (status.connected === true) {
        statusText = 'Connected';
        statusColor = 'var(--status-operational)';
        statusDot = 'ai-status-connected';
    } else if (status.connected === false) {
        statusText = 'Disconnected';
        statusColor = 'var(--status-down)';
        statusDot = 'ai-status-disconnected';
    } else {
        statusText = 'Unknown';
        statusColor = 'var(--status-degraded)';
        statusDot = 'ai-status-unknown';
    }

    // Format last query time
    let lastQueryText = 'Never';
    if (status.lastQueryAt) {
        const lastQuery = new Date(status.lastQueryAt);
        lastQueryText = formatRelativeTime(lastQuery);
    }

    // Create popup
    const popup = document.createElement('div');
    popup.id = 'aiStatusPopup';
    popup.className = 'ai-status-popup';
    popup.innerHTML = `
        <div class="ai-status-popup-header">
            <span class="ai-status-popup-title">AI SRE Companion</span>
            <span class="ai-status-dot ${statusDot}"></span>
        </div>
        <div class="ai-status-popup-content">
            <div class="ai-status-row">
                <span class="ai-status-label">Status</span>
                <span class="ai-status-value" style="color: ${statusColor}">${statusText}</span>
            </div>
            ${status.provider ? `
            <div class="ai-status-row">
                <span class="ai-status-label">Provider</span>
                <span class="ai-status-value">${status.provider}</span>
            </div>
            ` : ''}
            ${status.model ? `
            <div class="ai-status-row">
                <span class="ai-status-label">Model</span>
                <span class="ai-status-value">${status.model}</span>
            </div>
            ` : ''}
            <div class="ai-status-row">
                <span class="ai-status-label">Last Query</span>
                <span class="ai-status-value">${lastQueryText}</span>
            </div>
        </div>
        <a href="/static/settings.html" class="ai-status-popup-link">Configure Settings</a>
    `;

    indicator.appendChild(popup);

    // Close popup when clicking outside
    setTimeout(() => {
        document.addEventListener('click', closeAIStatusPopupOnOutsideClick);
    }, 0);
}

/**
 * Close popup when clicking outside
 */
function closeAIStatusPopupOnOutsideClick(e) {
    const popup = document.getElementById('aiStatusPopup');
    const indicator = document.getElementById('aiStatusIndicator');
    if (popup && indicator && !indicator.contains(e.target)) {
        popup.remove();
        document.removeEventListener('click', closeAIStatusPopupOnOutsideClick);
    }
}

/**
 * Format relative time (e.g., "2 minutes ago")
 */
function formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
    if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
    if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
}

// Insert navigation on page load
document.addEventListener('DOMContentLoaded', () => {
    const navPlaceholder = document.getElementById('navigation');
    if (navPlaceholder && navPlaceholder.dataset.page) {
        navPlaceholder.outerHTML = createNavigation(navPlaceholder.dataset.page);
        // Insert theme toggle after navigation is created
        if (typeof insertThemeToggle === 'function') {
            insertThemeToggle('navThemeToggle');
        }
        // Update AI status indicator
        updateAIStatusIndicator();
    }
});

// Export for use by other scripts
window.updateAIStatusIndicator = updateAIStatusIndicator;
