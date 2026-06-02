/**
 * SimpleWatch — Sidebar navigation
 * Replaces the <div id="navigation" data-page="..."> placeholder
 * with the full app shell: sidebar + main-area (topbar + page content).
 */

// ── Page metadata ──────────────────────────────────────────────────────────────

const PAGE_META = {
  dashboard:     { title: 'Dashboard',      icon: 'dashboard' },
  services:      { title: 'Services',       icon: 'services'  },
  incidents:     { title: 'Incidents',      icon: 'incidents' },
  notifications: { title: 'Notifications',  icon: 'bell'      },
  settings:      { title: 'Settings',       icon: 'settings'  },
  users:         { title: 'Users',          icon: 'users'     },
  status:        { title: 'Status Page',    icon: null        }, // public page, no shell
};

function getPageTitle(page) {
  return PAGE_META[page]?.title ?? page;
}

// ── SVG nav icons ──────────────────────────────────────────────────────────────

const NAV_ICONS = {
  dashboard: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="1.5" y="1.5" width="6" height="6" rx="1.2"/>
    <rect x="10.5" y="1.5" width="6" height="6" rx="1.2"/>
    <rect x="1.5" y="10.5" width="6" height="6" rx="1.2"/>
    <rect x="10.5" y="10.5" width="6" height="6" rx="1.2"/>
  </svg>`,

  services: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="1.5" y="1.5" width="6.5" height="6.5" rx="1.5"/>
    <rect x="10" y="1.5" width="6.5" height="6.5" rx="1.5"/>
    <rect x="1.5" y="10" width="6.5" height="6.5" rx="1.5"/>
    <path d="M13.25 10v6M10 13.25h6"/>
  </svg>`,

  incidents: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 13l3.5-5 3 3 3-4.5 4 5.5"/>
  </svg>`,

  bell: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 2a5.5 5.5 0 0 1 5.5 5.5c0 3 1.5 4.5 1.5 4.5H2s1.5-1.5 1.5-4.5A5.5 5.5 0 0 1 9 2z"/>
    <path d="M7.5 14.5a1.5 1.5 0 0 0 3 0"/>
  </svg>`,

  settings: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>`,

  users: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="7" cy="6" r="3"/>
    <path d="M1.5 15c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5"/>
    <path d="M13 4a3 3 0 0 1 0 6M16.5 15c0-2-1.12-3.75-2.75-4.65"/>
  </svg>`,

  logout: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>
    <path d="M11 11l3-3-3-3M14 8H6"/>
  </svg>`,

  search: `<svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
    <circle cx="8" cy="8" r="5.5"/>
    <path d="M12.5 12.5L16 16"/>
  </svg>`,
};

// ── Nav item definition ────────────────────────────────────────────────────────

const NAV_MAIN = [
  { page: 'dashboard',     href: '/static/dashboard.html',     label: 'Dashboard',     icon: 'dashboard' },
  { page: 'services',      href: '/static/services.html',      label: 'Services',      icon: 'services'  },
  { page: 'incidents',     href: '/static/incidents.html',     label: 'Incidents',     icon: 'incidents' },
  { page: 'notifications', href: '/static/notifications.html', label: 'Notifications', icon: 'bell'      },
];

const NAV_SYSTEM = [
  { page: 'settings', href: '/static/settings.html', label: 'Settings', icon: 'settings' },
];

// ── HTML builders ─────────────────────────────────────────────────────────────

function buildNavItems(items, activePage) {
  return items.map(item => {
    const active = item.page === activePage ? ' active' : '';
    return `
      <a class="nav-item${active}" href="${item.href}">
        ${NAV_ICONS[item.icon] || ''}
        ${item.label}
      </a>`;
  }).join('');
}

function buildSidebar(activePage, userInfo) {
  const initial = (userInfo.username || 'A').charAt(0).toUpperCase();
  const rolePill = userInfo.isAdmin ? 'Admin' : 'User';
  const showUsers = userInfo.isAdmin;

  return `
<aside class="sidebar" id="appSidebar">
  <div class="sidebar__rule"></div>
  <div class="sidebar__dots"></div>

  <a class="sidebar__wordmark" href="/static/dashboard.html">
    <span class="w-simple">Simple</span><span class="w-app">Watch</span>
  </a>

  <nav class="sidebar__nav">
    ${buildNavItems(NAV_MAIN, activePage)}

    ${showUsers ? `
    <a class="nav-item${activePage === 'users' ? ' active' : ''}" href="/static/users.html">
      ${NAV_ICONS.users}
      Users
    </a>` : ''}

    <span class="nav-section-label">System</span>
    ${buildNavItems(NAV_SYSTEM, activePage)}
  </nav>

  <div class="sidebar__bottom">
    <div class="sidebar__user">
      <div class="sidebar__avatar">${initial}</div>
      <div class="sidebar__user-info">
        <span class="sidebar__username">${userInfo.username || 'Admin'}</span>
        <span class="sidebar__role">${rolePill}</span>
      </div>
      <button class="sidebar__logout" onclick="logout()" title="Sign out">
        ${NAV_ICONS.logout}
      </button>
    </div>
    <div class="sidebar__ai-indicator" id="sidebarAiIndicator" style="display:none;" onclick="toggleAIStatusPopup()">
      <span class="sidebar__ai-dot" id="sidebarAiDot"></span>
      <span class="sidebar__ai-label" id="sidebarAiLabel">AI SRE</span>
    </div>
  </div>
</aside>`;
}

function buildTopbar(pageTitle) {
  return `
<header class="topbar" id="appTopbar">
  <h1 class="topbar__title">${pageTitle}</h1>
  <div class="topbar__search">
    <span class="topbar__search-icon">${NAV_ICONS.search}</span>
    <input type="text" id="topbarSearch" placeholder="Search…" autocomplete="off" />
  </div>
</header>`;
}

// ── AI SRE indicator update ────────────────────────────────────────────────────

function updateAIStatusIndicator() {
  const indicator = document.getElementById('sidebarAiIndicator');
  const dot       = document.getElementById('sidebarAiDot');
  const label     = document.getElementById('sidebarAiLabel');
  if (!indicator) return;

  try {
    const statusStr = localStorage.getItem('ai_status');
    if (!statusStr) { indicator.style.display = 'none'; return; }

    const status = JSON.parse(statusStr);
    if (!status.enabled) { indicator.style.display = 'none'; return; }

    indicator.style.display = 'flex';

    if (status.connected === true) {
      dot.style.background = '#00C896';
      label.textContent = `AI SRE · ${status.model || 'Connected'}`;
    } else if (status.connected === false) {
      dot.style.background = '#EF4444';
      label.textContent = 'AI SRE · Disconnected';
    } else {
      dot.style.background = '#F59E0B';
      label.textContent = 'AI SRE · Unknown';
    }
  } catch {
    indicator.style.display = 'none';
  }
}

// Keep legacy export name so existing pages that call window.updateAIStatusIndicator still work
window.updateAIStatusIndicator = updateAIStatusIndicator;

// ── AI status popup (appears to the right of the sidebar) ─────────────────────

function toggleAIStatusPopup() {
  const existing = document.getElementById('aiStatusPopup');
  if (existing) {
    existing.remove();
    document.removeEventListener('click', _closeAIPopupOutside);
    return;
  }

  const statusStr = localStorage.getItem('ai_status');
  if (!statusStr) return;

  let status;
  try { status = JSON.parse(statusStr); } catch { return; }
  if (!status.enabled) return;

  const indicator = document.getElementById('sidebarAiIndicator');
  if (!indicator) return;

  const rect = indicator.getBoundingClientRect();

  // Determine status display values
  let statusText, statusColor, dotClass;
  if (status.connected === true) {
    statusText = 'Connected';   statusColor = 'var(--status-operational)'; dotClass = 'ai-status-connected';
  } else if (status.connected === false) {
    statusText = 'Disconnected'; statusColor = 'var(--status-down)';        dotClass = 'ai-status-disconnected';
  } else {
    statusText = 'Unknown';     statusColor = 'var(--status-degraded)';     dotClass = 'ai-status-unknown';
  }

  const lastQueryText = status.lastQueryAt
    ? formatRelativeTime(status.lastQueryAt)
    : 'Never';

  const popup = document.createElement('div');
  popup.id = 'aiStatusPopup';
  popup.className = 'ai-status-popup ai-status-popup--sidebar';
  // Position to the right of the sidebar, aligned with the indicator
  popup.style.cssText = `
    position: fixed;
    left: ${Math.round(rect.right + 10)}px;
    bottom: ${Math.round(window.innerHeight - rect.bottom)}px;
    z-index: 200;
  `;

  popup.innerHTML = `
    <div class="ai-status-popup-header">
      <span class="ai-status-popup-title">AI SRE Companion</span>
      <span class="ai-status-dot ${dotClass}"></span>
    </div>
    <div class="ai-status-popup-content">
      <div class="ai-status-row">
        <span class="ai-status-label">Status</span>
        <span class="ai-status-value" style="color:${statusColor}">${statusText}</span>
      </div>
      ${status.provider ? `
      <div class="ai-status-row">
        <span class="ai-status-label">Provider</span>
        <span class="ai-status-value">${status.provider}</span>
      </div>` : ''}
      ${status.model ? `
      <div class="ai-status-row">
        <span class="ai-status-label">Model</span>
        <span class="ai-status-value">${status.model}</span>
      </div>` : ''}
      <div class="ai-status-row">
        <span class="ai-status-label">Last Query</span>
        <span class="ai-status-value">${lastQueryText}</span>
      </div>
    </div>
    <a href="/static/settings.html" class="ai-status-popup-link">Configure Settings →</a>
  `;

  document.body.appendChild(popup);

  // Close on outside click (deferred so this click doesn't immediately close it)
  setTimeout(() => {
    document.addEventListener('click', _closeAIPopupOutside);
  }, 0);
}

function _closeAIPopupOutside(e) {
  const popup     = document.getElementById('aiStatusPopup');
  const indicator = document.getElementById('sidebarAiIndicator');
  if (popup && !popup.contains(e.target) && indicator && !indicator.contains(e.target)) {
    popup.remove();
    document.removeEventListener('click', _closeAIPopupOutside);
  }
}

window.toggleAIStatusPopup = toggleAIStatusPopup;

// ── Format relative time (used by AI popup) ───────────────────────────────────
// Accepts an ISO string. Appends 'Z' if the string has no timezone marker so
// naive UTC timestamps from the server are not misread as local time.

function formatRelativeTime(isoString) {
  if (!isoString) return 'Never';

  let str = isoString;
  if (typeof str === 'string' && !str.endsWith('Z') && !str.includes('+') && !str.includes('-', 10)) {
    str += 'Z';
  }

  const date    = new Date(str);
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);

  if (isNaN(diffSec) || diffSec < 0) return 'Just now';
  if (diffSec < 60)                  return 'Just now';
  if (diffSec < 3600)                return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400)               return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 86400 * 7)           return `${Math.floor(diffSec / 86400)}d ago`;

  return date.toLocaleString('default', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit'
  });
}

window.formatRelativeTime = formatRelativeTime;

// ── DOM injection ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const placeholder = document.getElementById('navigation');
  if (!placeholder) return;

  const activePage = placeholder.dataset.page || '';
  const pageTitle  = placeholder.dataset.title || getPageTitle(activePage);

  // Public pages (status) get no sidebar
  if (activePage === 'status') {
    placeholder.remove();
    return;
  }

  const userInfo = (typeof getUserInfo === 'function') ? getUserInfo() : { username: '', isAdmin: false };

  // Build sidebar element
  const sidebarWrap = document.createElement('div');
  sidebarWrap.innerHTML = buildSidebar(activePage, userInfo).trim();
  const sidebar = sidebarWrap.firstElementChild;

  // Collect all body siblings that come after the placeholder
  const siblings = [];
  let sibling = placeholder.nextSibling;
  while (sibling) {
    siblings.push(sibling);
    sibling = sibling.nextSibling;
  }

  // Build main-area
  const mainArea = document.createElement('div');
  mainArea.className = 'main-area';
  mainArea.innerHTML = buildTopbar(pageTitle);

  // Content wrapper (replaces .main-container role)
  const pageContent = document.createElement('div');
  pageContent.className = 'page-content';
  siblings.forEach(node => pageContent.appendChild(node));
  mainArea.appendChild(pageContent);

  // Replace placeholder with sidebar + main-area
  placeholder.replaceWith(sidebar, mainArea);

  // Mark body as app-layout
  document.body.classList.add('app-layout');

  // Update AI indicator
  updateAIStatusIndicator();

  // Topbar search: navigate on Enter
  const searchInput = document.getElementById('topbarSearch');
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = searchInput.value.trim();
        if (q) window.location.href = `/static/services.html?q=${encodeURIComponent(q)}`;
      }
    });
  }
});

// ── Legacy createNavigation stub (called by nothing, but guards against errors) ─
window.createNavigation = function() { return ''; };
