/**
 * SimpleWatch — Sidebar navigation (Glasshouse shell)
 * Replaces the <div id="navigation" data-page="..."> placeholder with the
 * full app shell: .aura background + .shell > .sidebar + main (.topbar + page
 * content). Theme toggle lives in the topbar and delegates to themeManager.
 */

// ── Page metadata ──────────────────────────────────────────────────────────────

const PAGE_META = {
  dashboard:     { title: 'Dashboard' },
  services:      { title: 'Services' },
  incidents:     { title: 'Incidents' },
  notifications: { title: 'Notifications' },
  settings:      { title: 'Settings' },
  users:         { title: 'Users' },
  status:        { title: 'Status Page' }, // public page, no shell
};

function getPageTitle(page) {
  return PAGE_META[page]?.title ?? page;
}

// ── SVG nav icons ──────────────────────────────────────────────────────────────

const NAV_ICONS = {
  dashboard: `<svg width="17" height="17" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="1.5" y="1.5" width="6" height="6" rx="1.5"/>
    <rect x="10.5" y="1.5" width="6" height="6" rx="1.5"/>
    <rect x="1.5" y="10.5" width="6" height="6" rx="1.5"/>
    <rect x="10.5" y="10.5" width="6" height="6" rx="1.5"/>
  </svg>`,

  services: `<svg width="17" height="17" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="1.5" y="1.5" width="6.5" height="6.5" rx="1.5"/>
    <rect x="10" y="1.5" width="6.5" height="6.5" rx="1.5"/>
    <rect x="1.5" y="10" width="6.5" height="6.5" rx="1.5"/>
    <path d="M13.25 10v6M10 13.25h6"/>
  </svg>`,

  incidents: `<svg width="17" height="17" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 13l3.5-5 3 3 3-4.5 4 5.5"/>
  </svg>`,

  bell: `<svg width="17" height="17" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 2a5.5 5.5 0 0 1 5.5 5.5c0 3 1.5 4.5 1.5 4.5H2s1.5-1.5 1.5-4.5A5.5 5.5 0 0 1 9 2z"/>
    <path d="M7.5 14.5a1.5 1.5 0 0 0 3 0"/>
  </svg>`,

  settings: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>`,

  users: `<svg width="17" height="17" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="7" cy="6" r="3"/>
    <path d="M1.5 15c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5"/>
    <path d="M13 4a3 3 0 0 1 0 6M16.5 15c0-2-1.12-3.75-2.75-4.65"/>
  </svg>`,

  logout: `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>
    <path d="M11 11l3-3-3-3M14 8H6"/>
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
        <span>${item.label}</span>
      </a>`;
  }).join('');
}

function buildSidebar(activePage, userInfo) {
  const initial = (userInfo.username || 'A').charAt(0).toUpperCase();
  const role = userInfo.isAdmin ? 'Admin' : 'User';

  return `
<aside class="sidebar" id="appSidebar">
  <a class="wordmark" href="/static/dashboard.html">
    <span class="lite">Simple</span><span class="brand">Watch</span>
  </a>

  <nav aria-label="Main">
    ${buildNavItems(NAV_MAIN, activePage)}

    <div class="nav-sep">System</div>
    ${userInfo.isAdmin ? `
    <a class="nav-item${activePage === 'users' ? ' active' : ''}" href="/static/users.html">
      ${NAV_ICONS.users}
      <span>Users</span>
    </a>` : ''}
    ${buildNavItems(NAV_SYSTEM, activePage)}
  </nav>

  <div class="side-foot-stack" id="sideFootStack">
    <button class="side-ai" id="sidebarAiIndicator" hidden onclick="toggleAIStatusPopup()" title="AI SRE status">
      <span class="dot unknown" id="sidebarAiDot"></span>
      <span class="side-ai-label" id="sidebarAiLabel">AI SRE</span>
    </button>
    <div class="side-foot">
      <div class="avatar">${initial}</div>
      <div class="who">
        <b>${userInfo.username || 'Admin'}</b>
        <span>${role}</span>
      </div>
      <button class="side-logout" onclick="logout()" aria-label="Sign out" title="Sign out">
        ${NAV_ICONS.logout}
      </button>
    </div>
  </div>
</aside>`;
}

function buildTopbar(pageTitle) {
  return `
<header class="topbar" id="appTopbar">
  <h1>${pageTitle}</h1>
  <button class="icon-btn" id="themeToggle" aria-label="Toggle theme"></button>
</header>`;
}

// ── AI SRE indicator update ────────────────────────────────────────────────────

function updateAIStatusIndicator() {
  const indicator = document.getElementById('sidebarAiIndicator');
  const stack     = document.getElementById('sideFootStack');
  const dot       = document.getElementById('sidebarAiDot');
  const label     = document.getElementById('sidebarAiLabel');
  if (!indicator) return;

  const hide = () => {
    indicator.hidden = true;
    stack?.classList.remove('has-ai');
  };

  try {
    const statusStr = localStorage.getItem('ai_status');
    if (!statusStr) { hide(); return; }

    const status = JSON.parse(statusStr);
    if (!status.enabled) { hide(); return; }

    indicator.hidden = false;
    stack?.classList.add('has-ai');

    if (status.connected === true) {
      dot.className = 'dot op';
      label.textContent = `AI SRE · ${status.model || 'connected'}`;
    } else if (status.connected === false) {
      dot.className = 'dot down';
      label.textContent = 'AI SRE · disconnected';
    } else {
      dot.className = 'dot deg';
      label.textContent = 'AI SRE · unknown';
    }
  } catch {
    hide();
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

  let statusText, statusColor;
  if (status.connected === true) {
    statusText = 'Connected';    statusColor = 'var(--brand-ink)';
  } else if (status.connected === false) {
    statusText = 'Disconnected'; statusColor = 'var(--danger-ink)';
  } else {
    statusText = 'Unknown';      statusColor = 'var(--warn-ink)';
  }

  const lastQueryText = status.lastQueryAt
    ? formatRelativeTime(status.lastQueryAt)
    : 'Never';

  const popup = document.createElement('div');
  popup.id = 'aiStatusPopup';
  popup.className = 'overlay-surface ai-pop';
  // Position to the right of the sidebar, aligned with the indicator
  popup.style.cssText = `
    position: fixed;
    left: ${Math.round(rect.right + 10)}px;
    bottom: ${Math.round(window.innerHeight - rect.bottom)}px;
    z-index: 200;
  `;

  popup.innerHTML = `
    <div class="ai-pop-head">
      <b>AI SRE Companion</b>
      <span class="dot" style="background:${statusColor}"></span>
    </div>
    <dl class="kv">
      <dt>Status</dt><dd style="color:${statusColor}">${statusText}</dd>
      ${status.provider ? `<dt>Provider</dt><dd>${status.provider}</dd>` : ''}
      ${status.model ? `<dt>Model</dt><dd class="mono">${status.model}</dd>` : ''}
      <dt>Last query</dt><dd>${lastQueryText}</dd>
    </dl>
    <a href="/static/settings.html" class="ai-pop-link">Configure settings →</a>
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

// ── Theme toggle ───────────────────────────────────────────────────────────────

function _syncThemeToggle() {
  const btn = document.getElementById('themeToggle');
  if (btn && window.themeManager) btn.innerHTML = themeManager.icon();
}

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

  // Aura background (sits behind the shell)
  const aura = document.createElement('div');
  aura.className = 'aura';
  aura.setAttribute('aria-hidden', 'true');

  // Shell: sidebar + main
  const shell = document.createElement('div');
  shell.className = 'shell';

  const sidebarWrap = document.createElement('div');
  sidebarWrap.innerHTML = buildSidebar(activePage, userInfo).trim();
  const sidebar = sidebarWrap.firstElementChild;

  const main = document.createElement('main');
  main.innerHTML = buildTopbar(pageTitle);

  // Move everything after the placeholder into <main>
  const siblings = [];
  let sibling = placeholder.nextSibling;
  while (sibling) {
    siblings.push(sibling);
    sibling = sibling.nextSibling;
  }
  siblings.forEach(node => main.appendChild(node));

  shell.append(sidebar, main);
  placeholder.replaceWith(shell);
  document.body.prepend(aura);

  // Theme toggle
  const toggle = document.getElementById('themeToggle');
  if (toggle) toggle.addEventListener('click', () => themeManager.toggle());
  document.addEventListener('themechange', _syncThemeToggle);
  _syncThemeToggle();

  // Update AI indicator
  updateAIStatusIndicator();
});

// ── Legacy createNavigation stub (called by nothing, but guards against errors) ─
window.createNavigation = function() { return ''; };
