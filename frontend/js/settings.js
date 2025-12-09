/**
 * Settings Page JavaScript
 * Handles user settings, API key management, and theme preferences
 */

requireAuth();
insertThemeToggle('settingsThemeToggle');

const userInfo = getUserInfo();
let currentApiKey = '';
let keyVisible = false;

// Inject icons
document.addEventListener('DOMContentLoaded', () => {
    const warningIcon = document.getElementById('warningIcon');
    if (warningIcon) {
        warningIcon.innerHTML = icons.alertTriangle;
    }

    const zapIcon = document.getElementById('zapIcon');
    if (zapIcon) {
        zapIcon.innerHTML = icons.zap;
    }

    const keyIcon = document.getElementById('keyIcon');
    if (keyIcon) {
        keyIcon.innerHTML = icons.key;
    }

    const databaseIcon = document.getElementById('databaseIcon');
    if (databaseIcon) {
        databaseIcon.innerHTML = icons.database;
    }

    const infoCircleIcon = document.getElementById('infoCircleIcon');
    if (infoCircleIcon) {
        infoCircleIcon.innerHTML = icons.infoCircle;
    }

    const warningTriangleIcon = document.getElementById('warningTriangleIcon');
    if (warningTriangleIcon) {
        warningTriangleIcon.innerHTML = icons.alertTriangle;
    }

    const modalCloseIcon = document.getElementById('modalCloseIcon');
    if (modalCloseIcon) {
        modalCloseIcon.innerHTML = icons.x;
    }

    // Load current retention settings
    loadRetentionSettings();
});

async function loadUserInfo() {
    try {
        const user = await api.getCurrentUser();
        currentApiKey = user.api_key;
    } catch (error) {
        console.error('Failed to load user info:', error);
    }
}

function toggleApiKeyVisibility() {
    const display = document.getElementById('apiKeyValue');
    const btn = document.getElementById('toggleBtn');

    if (keyVisible) {
        display.textContent = '••••••••••••••••••••••••••••••••';
        btn.innerHTML = '<svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20" style="display: inline; margin-right: 0.5rem;"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"></path><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"></path></svg>Show Key';
        keyVisible = false;
    } else {
        display.textContent = currentApiKey;
        btn.innerHTML = '<svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20" style="display: inline; margin-right: 0.5rem;"><path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd"></path><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"></path></svg>Hide Key';
        keyVisible = true;
    }
}

function copyApiKey() {
    navigator.clipboard.writeText(currentApiKey).then(() => {
        showSuccess('API key copied to clipboard!');
    });
}

async function regenerateApiKey() {
    const confirmed = await showConfirm(
        'Are you sure? This will invalidate your current API key and may break existing integrations.',
        {
            title: 'Regenerate API Key',
            confirmText: 'Regenerate',
            cancelText: 'Cancel',
            confirmClass: 'btn-danger'
        }
    );
    if (!confirmed) return;

    try {
        const user = await api.regenerateApiKey();
        currentApiKey = user.api_key;
        localStorage.setItem('apiKey', user.api_key);
        if (keyVisible) {
            document.getElementById('apiKeyValue').textContent = currentApiKey;
        }
        showSuccess('API key regenerated successfully!');
    } catch (error) {
        showError('Failed to regenerate API key: ' + error.message);
    }
}

loadUserInfo();

// Data Retention Management
let currentRetentionDays = 90;

async function loadRetentionSettings() {
    try {
        const response = await authenticatedFetch('/api/v1/settings/retention');
        currentRetentionDays = response.retention_days;
        document.getElementById('currentRetentionDays').textContent = currentRetentionDays;
        document.getElementById('retentionDaysInput').placeholder = currentRetentionDays;
    } catch (error) {
        console.error('Failed to load retention settings:', error);
        showError('Failed to load retention settings');
    }
}

function showRetentionModal() {
    const input = document.getElementById('retentionDaysInput');
    const newRetention = parseInt(input.value);

    // Validation
    if (!input.value || isNaN(newRetention)) {
        showError('Please enter a valid number of days');
        return;
    }

    if (newRetention < 1) {
        showError('Retention period must be at least 1 day');
        return;
    }

    // Update modal values
    document.getElementById('modalCurrentRetention').textContent = currentRetentionDays;
    document.getElementById('modalNewRetention').textContent = newRetention;
    document.getElementById('modalRetentionDays').textContent = newRetention;

    // Show modal
    document.getElementById('retentionModal').classList.remove('hidden');
}

function closeRetentionModal() {
    document.getElementById('retentionModal').classList.add('hidden');
}

async function confirmRetentionChange() {
    const input = document.getElementById('retentionDaysInput');
    const newRetention = parseInt(input.value);

    try {
        const response = await authenticatedFetch('/api/v1/settings/retention', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                retention_days: newRetention
            })
        });

        currentRetentionDays = newRetention;
        document.getElementById('currentRetentionDays').textContent = newRetention;
        document.getElementById('retentionDaysInput').value = '';
        document.getElementById('retentionDaysInput').placeholder = newRetention;

        closeRetentionModal();
        showSuccess(response.message || `Data retention updated to ${newRetention} days`);
    } catch (error) {
        closeRetentionModal();
        showError('Failed to update retention policy: ' + error.message);
    }
}

// Close modal when clicking backdrop
document.getElementById('retentionModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'retentionModal') {
        closeRetentionModal();
    }
});
