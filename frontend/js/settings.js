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

// ====================================================================
// Service Export/Import
// ====================================================================

let allServices = [];
let selectedExportServices = new Set();
let importFileData = null;
let importValidationResult = null;
let selectedImportServices = new Set();

// Load all services for export/import
async function loadAllServices() {
    try {
        const services = await authenticatedFetch('/api/v1/services');
        const monitors = await authenticatedFetch('/api/v1/monitors');

        // Count monitors per service
        const monitorCounts = {};
        monitors.forEach(monitor => {
            monitorCounts[monitor.service_id] = (monitorCounts[monitor.service_id] || 0) + 1;
        });

        // Add monitor count to each service
        allServices = services.map(service => ({
            ...service,
            monitor_count: monitorCounts[service.id] || 0
        }));
    } catch (error) {
        console.error('Failed to load services:', error);
    }
}

// Initialize on page load
loadAllServices();

// Inject icons for backup section
document.addEventListener('DOMContentLoaded', () => {
    const backupIcon = document.getElementById('backupIcon');
    if (backupIcon) {
        backupIcon.innerHTML = icons.folder;
    }

    const exportIcon = document.getElementById('exportIcon');
    if (exportIcon) {
        exportIcon.innerHTML = icons.download;
    }

    const importIcon = document.getElementById('importIcon');
    if (importIcon) {
        importIcon.innerHTML = icons.upload;
    }

    const downloadBtnIcon = document.getElementById('downloadBtnIcon');
    if (downloadBtnIcon) {
        downloadBtnIcon.innerHTML = icons.download;
    }

    const uploadBtnIcon = document.getElementById('uploadBtnIcon');
    if (uploadBtnIcon) {
        uploadBtnIcon.innerHTML = icons.upload;
    }
});

// ====================================================================
// Export Modal
// ====================================================================

async function showExportModal() {
    // Reload services
    await loadAllServices();

    // Reset selection
    selectedExportServices.clear();

    // Populate service list
    const serviceList = document.getElementById('exportServiceList');
    if (allServices.length === 0) {
        serviceList.innerHTML = '<p style="padding: 2rem; text-align: center; color: var(--text-secondary);">No services found</p>';
    } else {
        serviceList.innerHTML = allServices.map(service => {
            const monitorCount = service.monitor_count || 0;
            return `
                <div class="export-service-item">
                    <input
                        type="checkbox"
                        class="export-service-checkbox"
                        id="export-service-${service.id}"
                        data-service-id="${service.id}"
                        onchange="toggleExportService(${service.id})"
                        checked
                    >
                    <label for="export-service-${service.id}" class="export-service-info">
                        <div class="export-service-name">${service.name}</div>
                        <div class="export-service-meta">${monitorCount} monitor${monitorCount !== 1 ? 's' : ''}</div>
                    </label>
                </div>
            `;
        }).join('');

        // Select all by default
        allServices.forEach(s => selectedExportServices.add(s.id));
    }

    // Inject icons
    const exportModalCloseIcon = document.getElementById('exportModalCloseIcon');
    if (exportModalCloseIcon) {
        exportModalCloseIcon.innerHTML = icons.x;
    }

    const exportBtnIcon = document.getElementById('exportBtnIcon');
    if (exportBtnIcon) {
        exportBtnIcon.innerHTML = icons.download;
    }

    // Show modal
    document.getElementById('exportModal').classList.remove('hidden');
}

function closeExportModal() {
    document.getElementById('exportModal').classList.add('hidden');
}

function toggleExportService(serviceId) {
    if (selectedExportServices.has(serviceId)) {
        selectedExportServices.delete(serviceId);
    } else {
        selectedExportServices.add(serviceId);
    }
}

async function executeExport() {
    if (selectedExportServices.size === 0) {
        showError('Please select at least one service to export');
        return;
    }

    try {
        const serviceIds = Array.from(selectedExportServices).join(',');
        const token = localStorage.getItem('token');

        // Download file
        const response = await fetch(`/api/v1/services/export?service_ids=${serviceIds}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Export failed');
        }

        // Get filename from header or use default
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'simplewatch_export.json';
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="?([^"]+)"?/);
            if (match) filename = match[1];
        }

        // Download blob
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showSuccess(`Exported ${selectedExportServices.size} service${selectedExportServices.size !== 1 ? 's' : ''}`);
        closeExportModal();
    } catch (error) {
        showError('Failed to export services: ' + error.message);
    }
}

// Close export modal when clicking backdrop
document.getElementById('exportModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'exportModal') {
        closeExportModal();
    }
});

// ====================================================================
// Import Modal
// ====================================================================

function showImportModal() {
    // Reset state
    importFileData = null;
    importValidationResult = null;
    selectedImportServices.clear();

    // Reset UI
    document.getElementById('importUploadSection').classList.remove('hidden');
    document.getElementById('importPreviewSection').classList.add('hidden');
    document.getElementById('importResultSection').classList.add('hidden');
    document.getElementById('importFileInfo').classList.add('hidden');
    document.getElementById('importValidateBtn').classList.add('hidden');
    document.getElementById('importExecuteBtn').classList.add('hidden');
    document.getElementById('importCancelBtn').textContent = 'Cancel';

    // Inject icons
    const importModalCloseIcon = document.getElementById('importModalCloseIcon');
    if (importModalCloseIcon) {
        importModalCloseIcon.innerHTML = icons.x;
    }

    const uploadAreaIcon = document.getElementById('uploadAreaIcon');
    if (uploadAreaIcon) {
        uploadAreaIcon.innerHTML = icons.upload;
    }

    const fileCheckIcon = document.getElementById('fileCheckIcon');
    if (fileCheckIcon) {
        fileCheckIcon.innerHTML = icons.checkCircle;
    }

    const fileClearIcon = document.getElementById('fileClearIcon');
    if (fileClearIcon) {
        fileClearIcon.innerHTML = icons.x;
    }

    const importInfoIcon = document.getElementById('importInfoIcon');
    if (importInfoIcon) {
        importInfoIcon.innerHTML = icons.info;
    }

    const importValidateBtnIcon = document.getElementById('importValidateBtnIcon');
    if (importValidateBtnIcon) {
        importValidateBtnIcon.innerHTML = icons.check;
    }

    const importExecuteBtnIcon = document.getElementById('importExecuteBtnIcon');
    if (importExecuteBtnIcon) {
        importExecuteBtnIcon.innerHTML = icons.upload;
    }

    // Setup file input
    const fileInput = document.getElementById('importFileInput');
    const uploadArea = document.getElementById('importUploadArea');

    fileInput.onchange = handleFileSelect;

    uploadArea.onclick = () => fileInput.click();

    // Drag and drop
    uploadArea.ondragover = (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    };

    uploadArea.ondragleave = () => {
        uploadArea.classList.remove('drag-over');
    };

    uploadArea.ondrop = (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files;
            handleFileSelect();
        }
    };

    // Show modal
    document.getElementById('importModal').classList.remove('hidden');
}

function closeImportModal() {
    document.getElementById('importModal').classList.add('hidden');
}

function handleFileSelect() {
    const fileInput = document.getElementById('importFileInput');
    const file = fileInput.files[0];

    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.json')) {
        showError('Please select a JSON file');
        return;
    }

    // Show file info
    document.getElementById('importFileName').textContent = file.name;
    document.getElementById('importFileInfo').classList.remove('hidden');
    document.getElementById('importValidateBtn').classList.remove('hidden');

    // Read file
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            importFileData = JSON.parse(e.target.result);
        } catch (error) {
            showError('Invalid JSON file');
            clearImportFile();
        }
    };
    reader.readAsText(file);
}

function clearImportFile() {
    document.getElementById('importFileInput').value = '';
    document.getElementById('importFileInfo').classList.add('hidden');
    document.getElementById('importValidateBtn').classList.add('hidden');
    importFileData = null;
}

async function validateImportFile() {
    if (!importFileData) {
        showError('No file selected');
        return;
    }

    try {
        // Create form data with file
        const blob = new Blob([JSON.stringify(importFileData)], { type: 'application/json' });
        const formData = new FormData();
        formData.append('file', blob, 'import.json');

        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/services/import/validate', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Validation failed');
        }

        importValidationResult = await response.json();

        // Show preview
        displayImportPreview(importValidationResult);
    } catch (error) {
        showError('Validation failed: ' + error.message);
    }
}

function displayImportPreview(validation) {
    const { summary, details } = validation;

    // Update summary
    document.getElementById('importPreviewSummary').textContent =
        `Found ${summary.total_services} service${summary.total_services !== 1 ? 's' : ''}. ` +
        `${summary.new_services} will be created with ${summary.new_monitors} monitor${summary.new_monitors !== 1 ? 's' : ''}. ` +
        `${summary.skipped_services} will be skipped (already exist).`;

    // Populate service list
    const serviceList = document.getElementById('importServiceList');
    serviceList.innerHTML = details.map((item, index) => {
        const willCreate = item.action === 'create';
        const badge = willCreate
            ? '<span class="import-service-badge badge-new">NEW</span>'
            : '<span class="import-service-badge badge-skip">EXISTS</span>';

        // Select new services by default
        if (willCreate) {
            selectedImportServices.add(index);
        }

        return `
            <div class="import-service-item ${!willCreate ? 'will-skip' : ''}">
                <input
                    type="checkbox"
                    class="import-service-checkbox"
                    id="import-service-${index}"
                    data-service-index="${index}"
                    onchange="toggleImportService(${index})"
                    ${willCreate ? 'checked' : 'disabled'}
                >
                <label for="import-service-${index}" class="import-service-info">
                    <div class="import-service-header">
                        <div class="import-service-name">${item.service_name}</div>
                        ${badge}
                    </div>
                    <div class="import-service-meta">
                        ${item.monitors} monitor${item.monitors !== 1 ? 's' : ''} • ${item.reason}
                    </div>
                </label>
            </div>
        `;
    }).join('');

    // Update UI
    document.getElementById('importUploadSection').classList.add('hidden');
    document.getElementById('importPreviewSection').classList.remove('hidden');
    document.getElementById('importValidateBtn').classList.add('hidden');
    document.getElementById('importExecuteBtn').classList.remove('hidden');
}

function toggleImportService(index) {
    if (selectedImportServices.has(index)) {
        selectedImportServices.delete(index);
    } else {
        selectedImportServices.add(index);
    }
}

async function executeImport() {
    if (selectedImportServices.size === 0) {
        showError('Please select at least one service to import');
        return;
    }

    try {
        // Create form data with file
        const blob = new Blob([JSON.stringify(importFileData)], { type: 'application/json' });
        const formData = new FormData();
        formData.append('file', blob, 'import.json');

        const serviceIndices = Array.from(selectedImportServices).join(',');
        const token = localStorage.getItem('token');

        const response = await fetch(`/api/v1/services/import?service_indices=${serviceIndices}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Import failed');
        }

        const result = await response.json();

        // Display results
        displayImportResult(result);

        // Reload services
        await loadAllServices();
    } catch (error) {
        showError('Import failed: ' + error.message);
    }
}

function displayImportResult(result) {
    const { imported, skipped, failed, details } = result;

    // Build result summary HTML
    const summaryHTML = `
        <div class="import-result-stat">
            <span class="import-result-label">Successfully imported:</span>
            <span class="import-result-value success">${imported}</span>
        </div>
        <div class="import-result-stat">
            <span class="import-result-label">Skipped (already exist):</span>
            <span class="import-result-value warning">${skipped}</span>
        </div>
        ${failed > 0 ? `
        <div class="import-result-stat">
            <span class="import-result-label">Failed:</span>
            <span class="import-result-value error">${failed}</span>
        </div>
        ` : ''}
    `;

    document.getElementById('importResultSummary').innerHTML = summaryHTML;

    // Update UI
    document.getElementById('importPreviewSection').classList.add('hidden');
    document.getElementById('importResultSection').classList.remove('hidden');
    document.getElementById('importExecuteBtn').classList.add('hidden');
    document.getElementById('importCancelBtn').textContent = 'Close';

    // Show success message
    if (imported > 0) {
        showSuccess(`Successfully imported ${imported} service${imported !== 1 ? 's' : ''}`);
    }
}

// Close import modal when clicking backdrop
document.getElementById('importModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'importModal') {
        closeImportModal();
    }
});
