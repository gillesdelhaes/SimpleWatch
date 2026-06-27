/**
 * Settings Page JavaScript
 */

requireAuth();

const userInfo = getUserInfo();
let currentApiKey = '';
let keyVisible = false;
let currentUserId = null;
let currentRetentionDays = 90;
let currentBannerText = '';
let currentBannerSeverity = 'info';

// ============================================================
// Tab switching
// ============================================================

const VALID_TABS = ['account', 'status-page', 'ai', 'data'];

function activateTab(tabId) {
    if (!VALID_TABS.includes(tabId)) tabId = 'account';
    VALID_TABS.forEach(id => {
        document.querySelector(`[data-tab="${id}"]`)?.classList.toggle('active', id === tabId);
        document.getElementById(`tab-${id}`)?.classList.toggle('hidden', id !== tabId);
    });
    const url = new URL(location.href);
    url.searchParams.set('tab', tabId);
    history.replaceState(null, '', url);
}

document.querySelectorAll('.settings-tab').forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
});

// ============================================================
// Dirty state tracking
// ============================================================

function trackDirty(inputIds, saveBarId) {
    const bar = document.getElementById(saveBarId);
    if (!bar) return;
    inputIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', () => bar.classList.remove('hidden'));
        el.addEventListener('change', () => bar.classList.remove('hidden'));
    });
}

// ============================================================
// DOMContentLoaded init
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // Icons still used in new design
    const injectIcon = (id, icon) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = icon;
    };
    injectIcon('warningIcon', icons.alertTriangle);
    injectIcon('downloadBtnIcon', icons.download);
    injectIcon('uploadBtnIcon', icons.upload);
    injectIcon('modalCloseIcon', icons.x);
    injectIcon('warningTriangleIcon', icons.alertTriangle);
    injectIcon('exportModalCloseIcon', icons.x);
    injectIcon('exportBtnIcon', icons.download);
    injectIcon('importModalCloseIcon', icons.x);
    injectIcon('uploadAreaIcon', icons.upload);
    injectIcon('fileCheckIcon', icons.checkCircle);
    injectIcon('fileClearIcon', icons.x);
    injectIcon('importInfoIcon', icons.info);
    injectIcon('importValidateBtnIcon', icons.check);
    injectIcon('importExecuteBtnIcon', icons.upload);
    injectIcon('auditExportBtnIcon', icons.download);

    // Restore active tab from URL
    const tab = new URL(location.href).searchParams.get('tab') || 'account';
    activateTab(tab);

    // Load data
    loadCurrentUser();
    loadRetentionSettings();
    loadAuditLogCount();
    loadStatusPageBannerSettings();

    // Dirty tracking
    trackDirty(['currentPassword', 'newPassword', 'confirmPassword'], 'passwordSaveBar');
    trackDirty(['retentionDaysInput'], 'retentionSaveBar');
    trackDirty([
        'aiEnabled', 'aiProvider',
        'localEndpoint', 'localModel',
        'openaiKey', 'openaiModel', 'openaiCustomModel',
        'anthropicKey', 'anthropicModel', 'anthropicCustomModel',
        'autoAnalyzeIncidents', 'requireApproval', 'autoExecuteEnabled', 'confidenceThreshold'
    ], 'aiSaveBar');

    // Banner live updates
    document.getElementById('bannerText')?.addEventListener('input', () => {
        updateBannerCharCount();
        updateBannerPreview();
        document.getElementById('bannerSaveBar')?.classList.remove('hidden');
    });
    document.getElementById('bannerSeverity')?.addEventListener('change', () => {
        updateBannerPreview();
        document.getElementById('bannerSaveBar')?.classList.remove('hidden');
    });
});

// ============================================================
// Current user & API key
// ============================================================

async function loadCurrentUser() {
    try {
        const user = await api.getCurrentUser();
        currentApiKey = user.api_key;
        currentUserId = user.id;
    } catch (error) {
        console.error('Failed to load user info:', error);
    }
}

function toggleApiKeyVisibility() {
    const display = document.getElementById('apiKeyValue');
    const btn = document.getElementById('toggleBtn');
    if (keyVisible) {
        display.textContent = '••••••••••••••••••••••••••••••••';
        btn.textContent = 'Show Key';
        keyVisible = false;
    } else {
        display.textContent = currentApiKey;
        btn.textContent = 'Hide Key';
        keyVisible = true;
    }
}

function copyApiKey() {
    navigator.clipboard.writeText(currentApiKey).then(() => showSuccess('API key copied to clipboard!'));
}

async function regenerateApiKey() {
    const confirmed = await showConfirm(
        'Are you sure? This will invalidate your current API key and may break existing integrations.',
        { title: 'Regenerate API Key', confirmText: 'Regenerate', cancelText: 'Cancel', confirmClass: 'btn-danger' }
    );
    if (!confirmed) return;
    try {
        const user = await api.regenerateApiKey();
        currentApiKey = user.api_key;
        localStorage.setItem('apiKey', user.api_key);
        if (keyVisible) document.getElementById('apiKeyValue').textContent = currentApiKey;
        showSuccess('API key regenerated successfully!');
    } catch (error) {
        showError('Failed to regenerate API key: ' + error.message);
    }
}

// ============================================================
// Password change
// ============================================================

async function savePassword() {
    const current = document.getElementById('currentPassword').value;
    const newPwd  = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmPassword').value;

    if (!current || !newPwd || !confirm) {
        showError('All password fields are required');
        return;
    }
    if (newPwd !== confirm) {
        showError('New passwords do not match');
        return;
    }
    if (newPwd.length < 8) {
        showError('Password must be at least 8 characters');
        return;
    }
    if (!currentUserId) {
        showError('User not loaded yet, please wait');
        return;
    }

    try {
        await authenticatedFetch(`/api/v1/users/${currentUserId}/password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_password: current, new_password: newPwd })
        });
        showSuccess('Password changed successfully');
        discardPassword();
    } catch (error) {
        showError('Failed to change password: ' + error.message);
    }
}

function discardPassword() {
    ['currentPassword', 'newPassword', 'confirmPassword'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('passwordSaveBar')?.classList.add('hidden');
}

// ============================================================
// Data Retention
// ============================================================

async function loadRetentionSettings() {
    try {
        const response = await authenticatedFetch('/api/v1/settings/retention');
        currentRetentionDays = response.retention_days;
        document.getElementById('currentRetentionDays').textContent = currentRetentionDays;
        document.getElementById('retentionDaysInput').placeholder = currentRetentionDays;
    } catch (error) {
        console.error('Failed to load retention settings:', error);
    }
}

function showRetentionModal() {
    const input = document.getElementById('retentionDaysInput');
    const newRetention = parseInt(input.value);
    if (!input.value || isNaN(newRetention)) {
        showError('Please enter a valid number of days');
        return;
    }
    if (newRetention < 1) {
        showError('Retention period must be at least 1 day');
        return;
    }
    document.getElementById('modalCurrentRetention').textContent = currentRetentionDays;
    document.getElementById('modalNewRetention').textContent = newRetention;
    document.getElementById('modalRetentionDays').textContent = newRetention;
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ retention_days: newRetention })
        });
        currentRetentionDays = newRetention;
        document.getElementById('currentRetentionDays').textContent = newRetention;
        input.value = '';
        input.placeholder = newRetention;
        closeRetentionModal();
        document.getElementById('retentionSaveBar')?.classList.add('hidden');
        showSuccess(response.message || `Data retention updated to ${newRetention} days`);
    } catch (error) {
        closeRetentionModal();
        showError('Failed to update retention policy: ' + error.message);
    }
}

function discardRetention() {
    document.getElementById('retentionDaysInput').value = '';
    document.getElementById('retentionSaveBar')?.classList.add('hidden');
}

document.getElementById('retentionModal')?.addEventListener('click', e => {
    if (e.target.id === 'retentionModal') closeRetentionModal();
});

// ============================================================
// Service Export / Import
// ============================================================

let allServices = [];
let selectedExportServices = new Set();
let importFileData = null;
let importValidationResult = null;
let selectedImportServices = new Set();

async function loadAllServices() {
    try {
        const services = await authenticatedFetch('/api/v1/services');
        const monitors = await authenticatedFetch('/api/v1/monitors');
        const monitorCounts = {};
        monitors.forEach(m => { monitorCounts[m.service_id] = (monitorCounts[m.service_id] || 0) + 1; });
        allServices = services.map(s => ({ ...s, monitor_count: monitorCounts[s.id] || 0 }));
    } catch (error) {
        console.error('Failed to load services:', error);
    }
}

loadAllServices();

async function showExportModal() {
    await loadAllServices();
    selectedExportServices.clear();
    const serviceList = document.getElementById('exportServiceList');
    if (allServices.length === 0) {
        serviceList.innerHTML = '<p style="padding:2rem;text-align:center;color:var(--text-secondary);">No services found</p>';
    } else {
        serviceList.innerHTML = allServices.map(service => {
            const n = service.monitor_count || 0;
            return `
                <div class="export-service-item">
                    <input type="checkbox" class="export-service-checkbox"
                        id="export-service-${service.id}" data-service-id="${service.id}"
                        onchange="toggleExportService(${service.id})" checked>
                    <label for="export-service-${service.id}" class="export-service-info">
                        <div class="export-service-name">${service.name}</div>
                        <div class="export-service-meta">${n} monitor${n !== 1 ? 's' : ''}</div>
                    </label>
                </div>`;
        }).join('');
        allServices.forEach(s => selectedExportServices.add(s.id));
    }
    document.getElementById('exportModal').classList.remove('hidden');
}

function closeExportModal() { document.getElementById('exportModal').classList.add('hidden'); }

function toggleExportService(serviceId) {
    if (selectedExportServices.has(serviceId)) selectedExportServices.delete(serviceId);
    else selectedExportServices.add(serviceId);
}

async function executeExport() {
    if (selectedExportServices.size === 0) { showError('Please select at least one service to export'); return; }
    try {
        const serviceIds = Array.from(selectedExportServices).join(',');
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/services/export?service_ids=${serviceIds}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Export failed');
        const cd = response.headers.get('Content-Disposition');
        let filename = 'simplewatch_export.json';
        if (cd) { const m = cd.match(/filename="?([^"]+)"?/); if (m) filename = m[1]; }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        window.URL.revokeObjectURL(url); document.body.removeChild(a);
        showSuccess(`Exported ${selectedExportServices.size} service${selectedExportServices.size !== 1 ? 's' : ''}`);
        closeExportModal();
    } catch (error) {
        showError('Failed to export services: ' + error.message);
    }
}

document.getElementById('exportModal')?.addEventListener('click', e => {
    if (e.target.id === 'exportModal') closeExportModal();
});

function showImportModal() {
    importFileData = null; importValidationResult = null; selectedImportServices.clear();
    document.getElementById('importUploadSection').classList.remove('hidden');
    document.getElementById('importPreviewSection').classList.add('hidden');
    document.getElementById('importResultSection').classList.add('hidden');
    document.getElementById('importFileInfo').classList.add('hidden');
    document.getElementById('importValidateBtn').classList.add('hidden');
    document.getElementById('importExecuteBtn').classList.add('hidden');
    document.getElementById('importCancelBtn').textContent = 'Cancel';

    const fileInput = document.getElementById('importFileInput');
    const uploadArea = document.getElementById('importUploadArea');
    fileInput.onchange = handleFileSelect;
    uploadArea.onclick = () => fileInput.click();
    uploadArea.ondragover = e => { e.preventDefault(); uploadArea.classList.add('drag-over'); };
    uploadArea.ondragleave = () => uploadArea.classList.remove('drag-over');
    uploadArea.ondrop = e => {
        e.preventDefault(); uploadArea.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) { fileInput.files = e.dataTransfer.files; handleFileSelect(); }
    };
    document.getElementById('importModal').classList.remove('hidden');
}

function closeImportModal() { document.getElementById('importModal').classList.add('hidden'); }

function handleFileSelect() {
    const fileInput = document.getElementById('importFileInput');
    const file = fileInput.files[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) { showError('Please select a JSON file'); return; }
    document.getElementById('importFileName').textContent = file.name;
    document.getElementById('importFileInfo').classList.remove('hidden');
    document.getElementById('importValidateBtn').classList.remove('hidden');
    const reader = new FileReader();
    reader.onload = e => {
        try { importFileData = JSON.parse(e.target.result); }
        catch { showError('Invalid JSON file'); clearImportFile(); }
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
    if (!importFileData) { showError('No file selected'); return; }
    try {
        const blob = new Blob([JSON.stringify(importFileData)], { type: 'application/json' });
        const formData = new FormData();
        formData.append('file', blob, 'import.json');
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/services/import/validate', {
            method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData
        });
        if (!response.ok) { const err = await response.json(); throw new Error(err.detail || 'Validation failed'); }
        importValidationResult = await response.json();
        displayImportPreview(importValidationResult);
    } catch (error) { showError('Validation failed: ' + error.message); }
}

function displayImportPreview(validation) {
    const { summary, details } = validation;
    document.getElementById('importPreviewSummary').textContent =
        `Found ${summary.total_services} service${summary.total_services !== 1 ? 's' : ''}. ` +
        `${summary.new_services} will be created with ${summary.new_monitors} monitor${summary.new_monitors !== 1 ? 's' : ''}. ` +
        `${summary.skipped_services} will be skipped (already exist).`;

    const serviceList = document.getElementById('importServiceList');
    serviceList.innerHTML = details.map((item, index) => {
        const willCreate = item.action === 'create';
        const badge = willCreate
            ? '<span class="import-service-badge badge-new">NEW</span>'
            : '<span class="import-service-badge badge-skip">EXISTS</span>';
        if (willCreate) selectedImportServices.add(index);
        return `
            <div class="import-service-item ${!willCreate ? 'will-skip' : ''}">
                <input type="checkbox" class="import-service-checkbox"
                    id="import-service-${index}" data-service-index="${index}"
                    onchange="toggleImportService(${index})" ${willCreate ? 'checked' : 'disabled'}>
                <label for="import-service-${index}" class="import-service-info">
                    <div class="import-service-header">
                        <div class="import-service-name">${item.service_name}</div>
                        ${badge}
                    </div>
                    <div class="import-service-meta">${item.monitors} monitor${item.monitors !== 1 ? 's' : ''} • ${item.reason}</div>
                </label>
            </div>`;
    }).join('');

    document.getElementById('importUploadSection').classList.add('hidden');
    document.getElementById('importPreviewSection').classList.remove('hidden');
    document.getElementById('importValidateBtn').classList.add('hidden');
    document.getElementById('importExecuteBtn').classList.remove('hidden');
}

function toggleImportService(index) {
    if (selectedImportServices.has(index)) selectedImportServices.delete(index);
    else selectedImportServices.add(index);
}

async function executeImport() {
    if (selectedImportServices.size === 0) { showError('Please select at least one service to import'); return; }
    try {
        const blob = new Blob([JSON.stringify(importFileData)], { type: 'application/json' });
        const formData = new FormData();
        formData.append('file', blob, 'import.json');
        const serviceIndices = Array.from(selectedImportServices).join(',');
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/services/import?service_indices=${serviceIndices}`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData
        });
        if (!response.ok) { const err = await response.json(); throw new Error(err.detail || 'Import failed'); }
        const result = await response.json();
        displayImportResult(result);
        await loadAllServices();
    } catch (error) { showError('Import failed: ' + error.message); }
}

function displayImportResult(result) {
    const { imported, skipped, failed } = result;
    document.getElementById('importResultSummary').innerHTML = `
        <div class="import-result-stat"><span class="import-result-label">Successfully imported:</span><span class="import-result-value success">${imported}</span></div>
        <div class="import-result-stat"><span class="import-result-label">Skipped (already exist):</span><span class="import-result-value warning">${skipped}</span></div>
        ${failed > 0 ? `<div class="import-result-stat"><span class="import-result-label">Failed:</span><span class="import-result-value error">${failed}</span></div>` : ''}
    `;
    document.getElementById('importPreviewSection').classList.add('hidden');
    document.getElementById('importResultSection').classList.remove('hidden');
    document.getElementById('importExecuteBtn').classList.add('hidden');
    document.getElementById('importCancelBtn').textContent = 'Close';
    if (imported > 0) showSuccess(`Successfully imported ${imported} service${imported !== 1 ? 's' : ''}`);
}

document.getElementById('importModal')?.addEventListener('click', e => {
    if (e.target.id === 'importModal') closeImportModal();
});

// ============================================================
// Audit Log
// ============================================================

async function loadAuditLogCount() {
    try {
        const response = await authenticatedFetch('/api/v1/audit/count');
        document.getElementById('auditLogCount').textContent = response.count;
    } catch (error) {
        console.error('Failed to load audit log count:', error);
    }
}

async function exportAuditLog() {
    try {
        const fromDate = document.getElementById('auditFromDate').value;
        const toDate   = document.getElementById('auditToDate').value;
        const token    = localStorage.getItem('token');
        let url = '/api/v1/audit/export';
        const params = [];
        if (fromDate) params.push(`from_date=${fromDate}`);
        if (toDate)   params.push(`to_date=${toDate}`);
        if (params.length) url += '?' + params.join('&');

        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) { const err = await response.json(); throw new Error(err.detail || 'Export failed'); }

        const cd = response.headers.get('Content-Disposition');
        let filename = 'audit_log.csv';
        if (cd) { const m = cd.match(/filename="?([^"]+)"?/); if (m) filename = m[1]; }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl; a.download = filename;
        document.body.appendChild(a); a.click();
        window.URL.revokeObjectURL(downloadUrl); document.body.removeChild(a);
        showSuccess('Audit log exported successfully');
    } catch (error) { showError('Failed to export audit log: ' + error.message); }
}

// ============================================================
// Status Page Banner
// ============================================================

async function loadStatusPageBannerSettings() {
    try {
        const response = await authenticatedFetch('/api/v1/settings/status-page-banner');
        currentBannerText = response.text || '';
        currentBannerSeverity = response.severity || 'info';
        document.getElementById('bannerText').value = currentBannerText;
        document.getElementById('bannerSeverity').value = currentBannerSeverity;
        updateBannerCharCount();
        updateBannerPreview();
    } catch (error) {
        console.error('Failed to load banner settings:', error);
    }
}

function updateBannerCharCount() {
    const text = document.getElementById('bannerText').value;
    document.getElementById('bannerCharCount').textContent = text.length;
}

function updateBannerPreview() {
    const text = document.getElementById('bannerText').value.trim();
    const severity = document.getElementById('bannerSeverity').value;
    const preview = document.getElementById('bannerPreview');
    if (!text) {
        preview.innerHTML = '<div class="banner-preview-empty">Enter a message above to see preview</div>';
        return;
    }
    const icon = severity === 'critical' ? icons.alertCircle : severity === 'warning' ? icons.alertTriangle : icons.info;
    const div = document.createElement('div'); div.textContent = text;
    preview.innerHTML = `
        <div class="status-banner banner-${severity}">
            <span class="status-banner-icon">${icon}</span>
            <span class="status-banner-text">${div.innerHTML}</span>
        </div>`;
}

async function saveStatusPageBanner() {
    const text = document.getElementById('bannerText').value.trim();
    const severity = document.getElementById('bannerSeverity').value;
    try {
        await authenticatedFetch('/api/v1/settings/status-page-banner', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, severity })
        });
        currentBannerText = text;
        currentBannerSeverity = severity;
        document.getElementById('bannerSaveBar')?.classList.add('hidden');
        showSuccess('Banner settings saved');
    } catch (error) { showError('Failed to save banner: ' + error.message); }
}

function discardBanner() {
    document.getElementById('bannerText').value = currentBannerText;
    document.getElementById('bannerSeverity').value = currentBannerSeverity;
    updateBannerCharCount();
    updateBannerPreview();
    document.getElementById('bannerSaveBar')?.classList.add('hidden');
}

// ============================================================
// AI settings bridge (ai-settings.js owns the logic)
// ============================================================

async function saveAIAndHideBar() {
    await saveAISettings();
    document.getElementById('aiSaveBar')?.classList.add('hidden');
}

function discardAI() {
    loadAISettings().then(() => {
        document.getElementById('aiSaveBar')?.classList.add('hidden');
    });
}
