/**
 * SimpleWatch — theme.js
 * Dark mode removed. Light mode only.
 * Keeps form validation UI helpers used across all pages.
 */

// No-op stubs so any remaining calls to themeManager don't throw
window.themeManager = {
  theme: 'light',
  toggle: function() {},
  applyTheme: function() {},
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
  document.querySelectorAll('.form-input, .form-group input').forEach(input => {
    input.classList.remove('invalid', 'valid');
  });
  document.querySelectorAll('.field-error').forEach(error => {
    error.classList.remove('visible');
  });
}
