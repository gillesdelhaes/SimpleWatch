/**
 * SimpleWatch — theme.js
 * Glasshouse theme manager. Theme is carried by <html data-theme> (restored
 * pre-paint by the inline script in each page's <head>) and persisted in
 * localStorage under 'sw-theme'. Default is dark.
 *
 * Also keeps the form validation UI helpers used across all pages.
 */

window.themeManager = {
  get theme() {
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  },
  set(next) {
    document.documentElement.dataset.theme = next;
    localStorage.setItem('sw-theme', next);
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
  },
  toggle() {
    this.set(this.theme === 'light' ? 'dark' : 'light');
  },
  // Legacy no-op kept so old callers don't throw
  applyTheme() {},
};

// Sun/moon glyphs for the topbar toggle (17px stroke icons, Glasshouse style)
window.themeManager.icon = function () {
  return this.theme === 'dark'
    ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`
    : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
};


// ============================================================
// Form Field Validation UI Helpers
// ============================================================

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

function clearFieldError(fieldId, errorId) {
  const field = document.getElementById(fieldId);
  const error = document.getElementById(errorId);
  if (field && error) {
    field.classList.remove('invalid');
    error.classList.remove('visible');
  }
}

function markFieldValid(fieldId) {
  const field = document.getElementById(fieldId);
  if (field) {
    field.classList.remove('invalid');
    field.classList.add('valid');
  }
}

function clearAllFieldErrors() {
  document.querySelectorAll('.input, .form-input, .form-group input').forEach(input => {
    input.classList.remove('invalid', 'valid');
  });
  document.querySelectorAll('.field-error').forEach(error => {
    error.classList.remove('visible');
  });
}
