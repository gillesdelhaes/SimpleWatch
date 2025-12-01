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
                    <a href="/static/settings.html" class="nav-link ${activePage === 'settings' ? 'active' : ''}">Settings</a>
                    ${userInfo.isAdmin ? `<a href="/static/users.html" class="nav-link ${activePage === 'users' ? 'active' : ''}">Users</a>` : ''}
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

// Insert navigation on page load
document.addEventListener('DOMContentLoaded', () => {
    const navPlaceholder = document.getElementById('navigation');
    if (navPlaceholder && navPlaceholder.dataset.page) {
        navPlaceholder.outerHTML = createNavigation(navPlaceholder.dataset.page);
        // Insert theme toggle after navigation is created
        if (typeof insertThemeToggle === 'function') {
            insertThemeToggle('navThemeToggle');
        }
    }
});
