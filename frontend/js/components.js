/**
 * SimpleWatch UI Components
 * Toast notifications, confirmation modals, collapsible sections
 */

// ============================================
// SVG Icons
// ============================================

const icons = {
    check: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 6L8 14L4 10"/>
    </svg>`,

    cross: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 6L6 14M6 6l8 8"/>
    </svg>`,

    warning: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 7v4m0 4h.01M10 18a8 8 0 100-16 8 8 0 000 16z"/>
    </svg>`,

    info: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 11v5m0-9h.01M10 18a8 8 0 100-16 8 8 0 000 16z"/>
    </svg>`,

    chevronRight: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M7 4l6 6-6 6"/>
    </svg>`,

    trash: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6h14zM8 10v6m4-6v6"/>
    </svg>`,

    edit: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M13.5 4.5l2 2L7 15H5v-2l8.5-8.5zM12 6l2 2"/>
    </svg>`,

    plus: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 5v10m-5-5h10"/>
    </svg>`,

    bell: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 18a2 2 0 002-2H8a2 2 0 002 2zm5-8c0-2.21-1.79-4-4-4V4a1 1 0 10-2 0v2c-2.21 0-4 1.79-4 4v3l-2 2v1h16v-1l-2-2v-3z"/>
    </svg>`,

    clipboard: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 2h4a2 2 0 012 2v0H6v0a2 2 0 012-2zM6 4H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2h-1"/>
    </svg>`,

    clipboardList: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 2h4a2 2 0 012 2v0H6v0a2 2 0 012-2zM6 4H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2h-1"/>
        <path d="M6 9h8M6 12h8M6 15h5"/>
    </svg>`,

    // Monitor type icons
    globe: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="10" cy="10" r="8"/>
        <path d="M2 10h16M10 2a15.3 15.3 0 014 8 15.3 15.3 0 01-4 8 15.3 15.3 0 01-4-8 15.3 15.3 0 014-8z"/>
    </svg>`,

    api: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 8l4-4m0 0l4 4m-4-4v12"/>
        <path d="M17 12l-4 4m0 0l-4-4m4 4V4"/>
    </svg>`,

    chart: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 17V9m5 8V3m5 14v-6m5 6V7"/>
    </svg>`,

    port: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="4" y="4" width="12" height="12" rx="2"/>
        <path d="M8 1v2m4-2v2M8 17v2m4-2v2M1 8h2m-2 4h2m14-4h2m-2 4h2"/>
    </svg>`,

    skull: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 2C6.5 2 4 4.5 4 8c0 2 0 4 1 5h10c1-1 1-3 1-5 0-3.5-2.5-6-6-6z"/>
        <rect x="7" y="13" width="2" height="4" rx="1"/>
        <rect x="11" y="13" width="2" height="4" rx="1"/>
        <circle cx="7.5" cy="8" r="1"/>
        <circle cx="12.5" cy="8" r="1"/>
    </svg>`,

    shield: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 2L4 5v5c0 4 2.5 7 6 8 3.5-1 6-4 6-8V5l-6-3z"/>
        <path d="M8 10l1.5 1.5L13 8"/>
    </svg>`,

    // Utility icons
    alertTriangle: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 3L2 17h16L10 3z"/>
        <path d="M10 9v4m0 2h.01"/>
    </svg>`,

    clock: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="10" cy="10" r="8"/>
        <path d="M10 6v4l3 3"/>
    </svg>`,

    inbox: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 7v8a2 2 0 002 2h10a2 2 0 002-2V7M3 7l2-4h10l2 4M3 7h4l2 3h2l2-3h4"/>
    </svg>`,

    zap: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 2L5 12h6l-1 6 6-10h-6l1-6z"/>
    </svg>`,

    folder: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 7v8a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-4l-2-2H5a2 2 0 00-2 2v2z"/>
    </svg>`,

    search: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="8.5" cy="8.5" r="5.5"/>
        <path d="M12.5 12.5L17 17"/>
    </svg>`,

    key: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15.5 7.5a4 4 0 11-8 0 4 4 0 018 0z"/>
        <path d="M7.5 10.5L2 16l1 1 2-2 1 1 2-2 1 1 1.5-1.5"/>
    </svg>`,

    bellSlash: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 18a2 2 0 002-2H8a2 2 0 002 2zm5-8c0-2.21-1.79-4-4-4V4a1 1 0 10-2 0v2c-2.21 0-4 1.79-4 4v3l-2 2v1h16v-1l-2-2v-3z"/>
        <path d="M3 3l14 14" stroke-width="2.5"/>
    </svg>`,

    mail: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="4" width="16" height="12" rx="2"/>
        <path d="M2 6l8 5 8-5"/>
    </svg>`,

    pause: `<svg viewBox="0 0 20 20" fill="currentColor">
        <path d="M5 4h3v12H5V4zm7 0h3v12h-3V4z"/>
    </svg>`,

    play: `<svg viewBox="0 0 20 20" fill="currentColor">
        <path d="M6 4l10 6-10 6V4z"/>
    </svg>`,

    database: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <ellipse cx="10" cy="5" rx="7" ry="3"/>
        <path d="M3 5v6c0 1.66 3.13 3 7 3s7-1.34 7-3V5"/>
        <path d="M3 11v4c0 1.66 3.13 3 7 3s7-1.34 7-3v-4"/>
    </svg>`,

    infoCircle: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="10" cy="10" r="8"/>
        <path d="M10 10v4m0-7h.01"/>
    </svg>`,

    x: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 5L5 15M5 5l10 10"/>
    </svg>`,

    download: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 3v10m0 0l-4-4m4 4l4-4"/>
        <path d="M4 14v2a2 2 0 002 2h8a2 2 0 002-2v-2"/>
    </svg>`,

    upload: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 13V3m0 0L6 7m4-4l4 4"/>
        <path d="M4 14v2a2 2 0 002 2h8a2 2 0 002-2v-2"/>
    </svg>`,

    list: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 5h14M3 10h14M3 15h14"/>
    </svg>`,

    checkCircle: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="10" cy="10" r="8"/>
        <path d="M7 10l2 2 4-4"/>
    </svg>`,

    alertCircle: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="10" cy="10" r="8"/>
        <path d="M10 7v4m0 4h.01"/>
    </svg>`,

    brain: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 10a2 2 0 012-2h0a2 2 0 012-2h0a2 2 0 012 2h0a2 2 0 012 2h0a2 2 0 01-2 2h0a2 2 0 01-2 2h0a2 2 0 01-2-2h0a2 2 0 01-2-2z"/>
        <path d="M7 6V5a2 2 0 012-2h2a2 2 0 012 2v1"/>
        <path d="M7 14v1a2 2 0 002 2h2a2 2 0 002-2v-1"/>
    </svg>`,

    // Developer Tools icons
    gitBranch: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="5" cy="5" r="2"/>
        <circle cx="5" cy="15" r="2"/>
        <circle cx="15" cy="10" r="2"/>
        <path d="M5 7v6M13 10H7.5a2.5 2.5 0 01-2.5-2.5V5"/>
    </svg>`,

    code: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 6l-4 4 4 4M14 6l4 4-4 4M11 3l-2 14"/>
    </svg>`,

    // Operations icons
    calendar: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="14" height="14" rx="2"/>
        <path d="M3 8h14M7 2v4M13 2v4"/>
    </svg>`,

    sla: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
        <circle cx="10" cy="10" r="7" opacity="0.3"/>
        <path d="M 10 3 A 7 7 0 0 1 17 10" stroke-width="2" stroke-linecap="round"/>
    </svg>`
};

// ============================================
// Toast Notification System
// ============================================

class ToastManager {
    constructor() {
        this.container = null;
        this.toasts = [];
        this.init();
    }

    init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    }

    show(message, type = 'info', duration = 4000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const iconMap = {
            success: icons.check,
            error: icons.cross,
            warning: icons.warning,
            info: icons.info
        };

        toast.innerHTML = `
            <div class="toast-icon">${iconMap[type] || icons.info}</div>
            <div class="toast-message">${message}</div>
            <button class="toast-close" aria-label="Close">${icons.cross}</button>
        `;

        this.container.appendChild(toast);
        this.toasts.push(toast);

        // Close button
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.remove(toast));

        // Auto dismiss
        if (duration > 0) {
            setTimeout(() => this.remove(toast), duration);
        }

        return toast;
    }

    remove(toast) {
        if (!toast || !toast.parentElement) return;

        toast.classList.add('toast-exit');
        setTimeout(() => {
            toast.remove();
            this.toasts = this.toasts.filter(t => t !== toast);
        }, 250);
    }

    clear() {
        this.toasts.forEach(toast => this.remove(toast));
    }
}

// Global toast instance
const toastManager = new ToastManager();

// Convenient functions
window.showToast = (message, type = 'info', duration = 4000) => {
    return toastManager.show(message, type, duration);
};

window.showSuccess = (message) => showToast(message, 'success');
window.showError = (message) => showToast(message, 'error');
window.showWarning = (message) => showToast(message, 'warning');
window.showInfo = (message) => showToast(message, 'info');

// ============================================
// Confirmation Modal System
// ============================================

window.showConfirm = (message, options = {}) => {
    return new Promise((resolve) => {
        const {
            title = 'Confirm Action',
            confirmText = 'Delete',
            cancelText = 'Cancel',
            icon = icons.warning,
            confirmClass = 'btn-danger'
        } = options;

        // Create backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'confirm-modal-backdrop';

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'confirm-modal';
        modal.innerHTML = `
            <div class="confirm-modal-icon">${icon}</div>
            <h3 class="confirm-modal-title">${title}</h3>
            <p class="confirm-modal-message">${message}</p>
            <div class="confirm-modal-actions">
                <button class="btn btn-secondary" data-action="cancel">${cancelText}</button>
                <button class="btn ${confirmClass}" data-action="confirm">${confirmText}</button>
            </div>
        `;

        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        // Focus confirm button
        setTimeout(() => {
            modal.querySelector('[data-action="confirm"]').focus();
        }, 100);

        // Handle actions
        const cleanup = () => {
            backdrop.classList.add('fade-out');
            setTimeout(() => backdrop.remove(), 200);
        };

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                cleanup();
                resolve(false);
            }
        });

        modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
            cleanup();
            resolve(false);
        });

        modal.querySelector('[data-action="confirm"]').addEventListener('click', () => {
            cleanup();
            resolve(true);
        });

        // Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                cleanup();
                resolve(false);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    });
};

// ============================================
// Collapsible Component
// ============================================

window.initCollapsible = (selector) => {
    const triggers = document.querySelectorAll(selector);

    triggers.forEach(trigger => {
        trigger.addEventListener('click', () => {
            const collapsible = trigger.closest('.collapsible');
            const isOpen = collapsible.classList.contains('is-open');

            collapsible.classList.toggle('is-open');

            // Update aria-expanded
            trigger.setAttribute('aria-expanded', !isOpen);
        });
    });
};

// Auto-initialize collapsibles on page load
document.addEventListener('DOMContentLoaded', () => {
    initCollapsible('.collapsible-trigger');
});

// ============================================
// Export icons for use in HTML
// ============================================
window.icons = icons;
