// Theme Management System

class ThemeManager {
    constructor() {
        this.theme = this.getStoredTheme() || 'dark';
        this.init();
    }

    init() {
        this.applyTheme(this.theme);
        this.setupListeners();
    }

    getStoredTheme() {
        return localStorage.getItem('simplewatch-theme');
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('simplewatch-theme', theme);
        this.theme = theme;
    }

    toggle() {
        const newTheme = this.theme === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme);
        this.triggerThemeChangeEvent();
    }

    setupListeners() {
        // Listen for theme toggle clicks
        document.addEventListener('click', (e) => {
            if (e.target.closest('.theme-toggle')) {
                this.toggle();
            }
        });
    }

    triggerThemeChangeEvent() {
        const event = new CustomEvent('themechange', { detail: { theme: this.theme } });
        document.dispatchEvent(event);
    }

    createToggleHTML() {
        return `
            <div class="theme-toggle">
                <svg class="theme-toggle-icon sun" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"></path>
                </svg>
                <svg class="theme-toggle-icon moon" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path>
                </svg>
                <div class="theme-toggle-slider"></div>
            </div>
        `;
    }
}

// Initialize theme manager
const themeManager = new ThemeManager();

// Export for use in other scripts
window.themeManager = themeManager;

// Helper function to insert theme toggle
function insertThemeToggle(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = themeManager.createToggleHTML();
    }
}

// ============================================
// Form Field Validation UI Helpers
// ============================================

/**
 * Show validation error on a field
 * @param {string} fieldId - ID of the input field
 * @param {string} errorId - ID of the error message element
 * @param {string} message - Error message to display
 */
function showFieldError(fieldId, errorId, message) {
    const field = document.getElementById(fieldId);
    const error = document.getElementById(errorId);
    if (field && error) {
        field.classList.add('invalid');
        field.classList.remove('valid');
        error.textContent = message;
        error.classList.add('visible');
    }
}

/**
 * Clear validation error from a field
 * @param {string} fieldId - ID of the input field
 * @param {string} errorId - ID of the error message element
 */
function clearFieldError(fieldId, errorId) {
    const field = document.getElementById(fieldId);
    const error = document.getElementById(errorId);
    if (field && error) {
        field.classList.remove('invalid');
        error.classList.remove('visible');
    }
}

/**
 * Mark a field as valid
 * @param {string} fieldId - ID of the input field
 */
function markFieldValid(fieldId) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.classList.remove('invalid');
        field.classList.add('valid');
    }
}

/**
 * Clear all validation states from all form fields
 */
function clearAllFieldErrors() {
    document.querySelectorAll('.form-input, .form-group input').forEach(input => {
        input.classList.remove('invalid', 'valid');
    });
    document.querySelectorAll('.field-error').forEach(error => {
        error.classList.remove('visible');
    });
}
