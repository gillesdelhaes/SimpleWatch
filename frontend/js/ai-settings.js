/**
 * AI SRE Companion Settings
 * Handles AI configuration in the settings page
 */

// Load AI settings on page load
document.addEventListener('DOMContentLoaded', function() {
    // Set AI icon
    const aiIcon = document.getElementById('aiIcon');
    if (aiIcon && icons.brain) {
        aiIcon.innerHTML = icons.brain;
    }

    // Load current AI settings
    loadAISettings();
});

/**
 * Load AI settings from backend
 */
async function loadAISettings() {
    try {
        const response = await fetch('/api/v1/ai/settings', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            console.error('Failed to load AI settings');
            return;
        }

        const settings = await response.json();

        // Set enabled state
        document.getElementById('aiEnabled').checked = settings.enabled;
        toggleAISettings();

        // Set provider
        if (settings.provider) {
            document.getElementById('aiProvider').value = settings.provider;
            updateAIProviderSettings();
        }

        // Set provider-specific settings
        if (settings.endpoint) {
            document.getElementById('localEndpoint').value = settings.endpoint;
        }

        if (settings.model_name) {
            // Set model based on provider (handles custom models)
            if (settings.provider === 'local') {
                document.getElementById('localModel').value = settings.model_name;
            } else if (settings.provider === 'openai') {
                setModelName('openai', settings.model_name);
            } else if (settings.provider === 'anthropic') {
                setModelName('anthropic', settings.model_name);
            }
        }

        // Show API key hint if configured
        if (settings.has_api_key) {
            if (settings.provider === 'openai') {
                document.getElementById('openaiKeyHint').style.display = 'block';
            } else if (settings.provider === 'anthropic') {
                document.getElementById('anthropicKeyHint').style.display = 'block';
            }
        }

        // Set behavior settings
        document.getElementById('autoAnalyzeIncidents').checked = settings.auto_analyze_incidents;
        document.getElementById('requireApproval').checked = settings.require_approval;
        document.getElementById('autoExecuteEnabled').checked = settings.auto_execute_enabled;
        document.getElementById('confidenceThreshold').value = Math.round(settings.auto_execute_confidence_threshold * 100);
        document.getElementById('confidenceValue').textContent = Math.round(settings.auto_execute_confidence_threshold * 100) + '%';
        document.getElementById('promptViaNotifications').checked = settings.prompt_via_notifications;

        updateAutoExecuteVisibility();

        // Update AI status in localStorage for dashboard indicator
        updateLocalAIStatus(settings);

        // Update nav indicator
        if (typeof window.updateAIStatusIndicator === 'function') {
            window.updateAIStatusIndicator();
        }

    } catch (error) {
        console.error('Error loading AI settings:', error);
    }
}

/**
 * Toggle AI settings visibility
 */
function toggleAISettings() {
    const enabled = document.getElementById('aiEnabled').checked;
    const content = document.getElementById('aiSettingsContent');
    content.style.display = enabled ? 'block' : 'none';
}

/**
 * Update provider settings visibility
 */
function updateAIProviderSettings() {
    const provider = document.getElementById('aiProvider').value;

    // Hide all provider configs
    document.getElementById('localModelSettings').style.display = 'none';
    document.getElementById('openaiSettings').style.display = 'none';
    document.getElementById('anthropicSettings').style.display = 'none';

    // Show selected provider config
    if (provider === 'local') {
        document.getElementById('localModelSettings').style.display = 'block';
    } else if (provider === 'openai') {
        document.getElementById('openaiSettings').style.display = 'block';
    } else if (provider === 'anthropic') {
        document.getElementById('anthropicSettings').style.display = 'block';
    }
}

/**
 * Update auto-execute section visibility
 */
function updateAutoExecuteVisibility() {
    const requireApproval = document.getElementById('requireApproval').checked;
    const autoExecuteSection = document.getElementById('autoExecuteSection');
    autoExecuteSection.style.display = requireApproval ? 'none' : 'block';
}

/**
 * Toggle custom model input visibility
 */
function toggleCustomModelInput(provider) {
    const select = document.getElementById(provider + 'Model');
    const customInput = document.getElementById(provider + 'CustomModel');

    if (select.value === 'custom') {
        customInput.style.display = 'block';
        customInput.focus();
    } else {
        customInput.style.display = 'none';
        customInput.value = '';
    }
}

/**
 * Get model name for a provider (handles custom model input)
 */
function getModelName(provider) {
    const select = document.getElementById(provider + 'Model');
    if (select.value === 'custom') {
        return document.getElementById(provider + 'CustomModel').value;
    }
    return select.value;
}

/**
 * Set model name for a provider (handles custom model input)
 */
function setModelName(provider, modelName) {
    const select = document.getElementById(provider + 'Model');
    const customInput = document.getElementById(provider + 'CustomModel');

    // Check if the model is in the dropdown options
    const options = Array.from(select.options).map(o => o.value);
    if (options.includes(modelName) && modelName !== 'custom') {
        select.value = modelName;
        customInput.style.display = 'none';
        customInput.value = '';
    } else {
        // Custom model
        select.value = 'custom';
        customInput.style.display = 'block';
        customInput.value = modelName;
    }
}

/**
 * Save AI settings
 */
async function saveAISettings() {
    const provider = document.getElementById('aiProvider').value;

    // Get provider-specific settings
    let endpoint = null;
    let modelName = null;
    let apiKey = null;

    if (provider === 'local') {
        endpoint = document.getElementById('localEndpoint').value;
        modelName = document.getElementById('localModel').value;
    } else if (provider === 'openai') {
        modelName = getModelName('openai');
        const keyInput = document.getElementById('openaiKey').value;
        if (keyInput) apiKey = keyInput;
    } else if (provider === 'anthropic') {
        modelName = getModelName('anthropic');
        const keyInput = document.getElementById('anthropicKey').value;
        if (keyInput) apiKey = keyInput;
    }

    const settings = {
        enabled: document.getElementById('aiEnabled').checked,
        provider: provider,
        endpoint: endpoint,
        model_name: modelName,
        api_key: apiKey,
        auto_analyze_incidents: document.getElementById('autoAnalyzeIncidents').checked,
        require_approval: document.getElementById('requireApproval').checked,
        auto_execute_enabled: document.getElementById('autoExecuteEnabled').checked,
        auto_execute_confidence_threshold: parseInt(document.getElementById('confidenceThreshold').value) / 100,
        prompt_via_notifications: document.getElementById('promptViaNotifications').checked
    };

    const saveBtn = document.getElementById('saveAIBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        const response = await fetch('/api/v1/ai/settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(settings)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to save settings');
        }

        showSuccess('Settings saved successfully');

        // Clear API key inputs after successful save
        document.getElementById('openaiKey').value = '';
        document.getElementById('anthropicKey').value = '';

        // Reload to show updated state
        await loadAISettings();

    } catch (error) {
        showError(error.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Settings';
    }
}

/**
 * Test AI connection
 */
async function testAIConnection() {
    const testBtn = document.getElementById('testAIBtn');
    testBtn.disabled = true;
    testBtn.textContent = 'Testing...';

    try {
        const response = await fetch('/api/v1/ai/test', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        const result = await response.json();

        if (result.success) {
            showSuccess(`Connection successful: ${result.message}`);
            // Update status indicator
            const currentStatus = JSON.parse(localStorage.getItem('ai_status') || '{}');
            localStorage.setItem('ai_status', JSON.stringify({
                ...currentStatus,
                connected: true,
                timestamp: new Date().toISOString()
            }));
        } else {
            showError(`Connection failed: ${result.error}`);
            const currentStatus = JSON.parse(localStorage.getItem('ai_status') || '{}');
            localStorage.setItem('ai_status', JSON.stringify({
                ...currentStatus,
                connected: false,
                timestamp: new Date().toISOString(),
                error: result.error
            }));
        }

        // Update nav indicator
        if (typeof window.updateAIStatusIndicator === 'function') {
            window.updateAIStatusIndicator();
        }

    } catch (error) {
        showError(error.message);
        const currentStatus = JSON.parse(localStorage.getItem('ai_status') || '{}');
        localStorage.setItem('ai_status', JSON.stringify({
            ...currentStatus,
            connected: false,
            timestamp: new Date().toISOString(),
            error: error.message
        }));

        // Update nav indicator
        if (typeof window.updateAIStatusIndicator === 'function') {
            window.updateAIStatusIndicator();
        }
    } finally {
        testBtn.disabled = false;
        testBtn.textContent = 'Test Connection';
    }
}

/**
 * Update AI status in localStorage
 */
function updateLocalAIStatus(settings) {
    const status = {
        enabled: settings.enabled,
        connected: settings.last_query_success,
        lastQueryAt: settings.last_query_at,
        provider: settings.provider,
        model: settings.model_name
    };
    localStorage.setItem('ai_status', JSON.stringify(status));
}
