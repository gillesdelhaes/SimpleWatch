/**
 * Services Page JavaScript
 * Handles service and monitor management using the plugin system
 */

// ============================================
// Service Management
// ============================================

// Load and render all services with their monitors
async function loadServices() {
    try {
        const services = await api.listServices();
        const monitors = await api.listMonitors();

        // Group monitors by service_id
        const monitorsByService = {};
        monitors.forEach(monitor => {
            if (!monitorsByService[monitor.service_id]) {
                monitorsByService[monitor.service_id] = [];
            }
            monitorsByService[monitor.service_id].push(monitor);
        });

        const servicesList = document.getElementById('servicesList');

        if (services.length === 0) {
            servicesList.innerHTML = '<div style="text-align: center; padding: 4rem; color: var(--text-secondary);"><h3 style="font-size: 1.5rem; margin-bottom: 1rem;">No services yet</h3><p>Create your first service using Quick Monitor or Add Service</p></div>';
            return;
        }

        servicesList.innerHTML = services.map(service => {
            const serviceMonitors = monitorsByService[service.id] || [];
            return `
            <div class="service-card${!service.is_active ? ' paused' : ''}"${!service.is_active ? ' title="This service is paused"' : ''}>
                <div class="service-header">
                    <div style="flex: 1;">
                        <h3 class="service-title">${service.name}</h3>
                        ${service.description ? `<p class="service-description">${service.description}</p>` : ''}
                        <div class="service-meta">
                            ${service.category ? `<span style="display: inline-flex; align-items: baseline; gap: 0.25rem;"><span class="icon" style="width: 14px; height: 14px; flex-shrink: 0; display: inline-flex; align-items: center;">${icons.folder}</span><span style="line-height: 1;">${service.category}</span></span>` : ''}
                            <span style="display: inline-flex; align-items: baseline; gap: 0.25rem;"><span class="icon" style="width: 14px; height: 14px; flex-shrink: 0; display: inline-flex; align-items: center;">${icons.search}</span><span style="line-height: 1;">${serviceMonitors.length} monitor${serviceMonitors.length !== 1 ? 's' : ''}</span></span>
                        </div>
                    </div>
                    <div class="actions">
                        <button class="icon-btn" onclick="openMaintenanceModal(${service.id}, '${service.name.replace(/'/g, "\\'")}')" title="Schedule maintenance">
                            <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M14.5 10a4.5 4.5 0 004.284-5.882c-.105-.324-.51-.391-.752-.15L15.34 6.66a.454.454 0 01-.493.11 3.01 3.01 0 01-1.618-1.616.455.455 0 01.11-.494l2.694-2.692c.24-.241.174-.647-.15-.752a4.5 4.5 0 00-5.873 4.575c.055.873-.128 1.808-.8 2.368l-7.23 6.024a2.724 2.724 0 103.837 3.837l6.024-7.23c.56-.672 1.495-.855 2.368-.8.096.007.193.01.29.01zM5 16a1 1 0 11-2 0 1 1 0 012 0z" clip-rule="evenodd"></path></svg>
                        </button>
                        <button class="icon-btn" onclick="showEditServiceModal(${service.id}, '${service.name.replace(/'/g, "\\'")}', '${(service.description || '').replace(/'/g, "\\'")}', '${(service.category || '').replace(/'/g, "\\'")}', ${service.show_on_status_page || false}, ${service.sla_target || 'null'}, ${service.sla_timeframe_days || 'null'})">
                            <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path></svg>
                        </button>
                        ${service.is_active ? `
                            <button class="icon-btn" onclick="pauseService(${service.id})" title="Pause service">
                                <span class="icon" style="width: 20px; height: 20px;">${icons.pause}</span>
                            </button>
                        ` : `
                            <button class="icon-btn" onclick="resumeService(${service.id})" title="Resume service" style="color: var(--status-operational);">
                                <span class="icon" style="width: 20px; height: 20px;">${icons.play}</span>
                            </button>
                        `}
                        <button class="icon-btn delete" onclick="deleteService(${service.id})">
                            <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
                        </button>
                    </div>
                </div>
                ${serviceMonitors.length > 0 ? `
                    <div class="monitors-section">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h4 class="monitors-title">Monitors</h4>
                            <button class="btn btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.875rem;" onclick="showAddMonitorToServiceModal(${service.id}, '${service.name.replace(/'/g, "\\'")}')">+ Add Monitor</button>
                        </div>
                        ${serviceMonitors.map(monitor => `
                            <div class="monitor-item${!monitor.is_active ? ' paused' : ''}"${!monitor.is_active ? ' title="This monitor is paused"' : ''}>
                                <div class="monitor-info">
                                    <div class="monitor-type">${getMonitorTypeName(monitor.monitor_type)}${monitor.config && monitor.config.name ? ` [${monitor.config.name}]` : ''}</div>
                                    <div class="monitor-config">${getMonitorDescription(monitor)}</div>
                                    <div class="monitor-interval">Every ${monitor.check_interval_minutes} minutes</div>
                                </div>
                                <div class="actions">
                                    <button class="icon-btn" onclick="editMonitor(${monitor.id})">
                                        <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path></svg>
                                    </button>
                                    ${monitor.is_active ? `
                                        <button class="icon-btn" onclick="pauseMonitor(${monitor.id})" title="Pause monitor">
                                            <span class="icon" style="width: 20px; height: 20px;">${icons.pause}</span>
                                        </button>
                                    ` : `
                                        <button class="icon-btn" onclick="resumeMonitor(${monitor.id})" title="Resume monitor" style="color: var(--status-operational);">
                                            <span class="icon" style="width: 20px; height: 20px;">${icons.play}</span>
                                        </button>
                                    `}
                                    <button class="icon-btn delete" onclick="deleteMonitor(${monitor.id})">
                                        <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="monitors-section">
                        <p style="color: var(--text-tertiary); text-align: center; padding: 1rem;">No monitors configured</p>
                        <button class="btn btn-secondary" style="width: 100%;" onclick="showAddMonitorToServiceModal(${service.id}, '${service.name.replace(/'/g, "\\'")}')">+ Add First Monitor</button>
                    </div>
                `}
            </div>
        `;
        }).join('');
    } catch (error) {
        console.error('Failed to load services:', error);
    }
}

function getMonitorTypeName(type) {
    const monitorPlugin = window.monitorRegistry.get(type);
    if (!monitorPlugin) {
        return `<span class="monitor-type-badge">${type}</span>`;
    }

    const iconSvg = icons[monitorPlugin.icon] || '';
    const name = monitorPlugin.name.replace(' Monitor', ''); // Strip "Monitor" suffix for brevity
    return `<span class="monitor-type-badge"><span class="icon" style="width: 14px; height: 14px;">${iconSvg}</span>${name}</span>`;
}

function getMonitorDescription(monitor) {
    if (!monitor.config) return '';
    const monitorPlugin = window.monitorRegistry.get(monitor.monitor_type);
    if (monitorPlugin && monitorPlugin.getDescription) {
        return monitorPlugin.getDescription(monitor.config);
    }
    return '';
}

async function deleteService(id) {
    const confirmed = await showConfirm(
        'Are you sure you want to delete this service and all its monitors?',
        {
            title: 'Delete Service',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            confirmClass: 'btn-danger'
        }
    );
    if (!confirmed) return;
    try {
        await api.deleteService(id);
        loadServices();
        showSuccess('Service deleted successfully');
    } catch (error) {
        showError('Failed to delete service: ' + error.message);
    }
}

async function deleteMonitor(id) {
    const confirmed = await showConfirm(
        'Are you sure you want to delete this monitor?',
        {
            title: 'Delete Monitor',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            confirmClass: 'btn-danger'
        }
    );
    if (!confirmed) return;
    try {
        await api.deleteMonitor(id);
        loadServices();
        showSuccess('Monitor deleted successfully');
    } catch (error) {
        showError('Failed to delete monitor: ' + error.message);
    }
}

async function pauseService(id) {
    try {
        await authenticatedFetch(`/api/v1/services/${id}/pause`, { method: 'POST' });
        loadServices();
        showSuccess('Service paused successfully');
    } catch (error) {
        showError('Failed to pause service: ' + error.message);
    }
}

async function resumeService(id) {
    try {
        await authenticatedFetch(`/api/v1/services/${id}/resume`, { method: 'POST' });
        loadServices();
        showSuccess('Service resumed successfully');
    } catch (error) {
        showError('Failed to resume service: ' + error.message);
    }
}

async function pauseMonitor(id) {
    try {
        await authenticatedFetch(`/api/v1/monitors/${id}/pause`, { method: 'POST' });
        loadServices();
        showSuccess('Monitor paused successfully');
    } catch (error) {
        showError('Failed to pause monitor: ' + error.message);
    }
}

async function resumeMonitor(id) {
    try {
        await authenticatedFetch(`/api/v1/monitors/${id}/resume`, { method: 'POST' });
        loadServices();
        showSuccess('Monitor resumed successfully');
    } catch (error) {
        showError('Failed to resume monitor: ' + error.message);
    }
}

// ============================================
// Modal Functions
// ============================================

function showAddServiceModal() {
    document.getElementById('addServiceModal').classList.remove('hidden');
}

function hideAddServiceModal() {
    document.getElementById('addServiceModal').classList.add('hidden');
}

async function showEditServiceModal(id, name, desc, cat, showOnStatusPage = false, slaTarget = null, slaTimeframeDays = null) {
    document.getElementById('editServiceId').value = id;
    document.getElementById('editServiceName').value = name;
    document.getElementById('editServiceDescription').value = desc;
    document.getElementById('editServiceCategory').value = cat;
    document.getElementById('editShowOnStatusPage').checked = showOnStatusPage;

    // Set SLA fields
    document.getElementById('editSlaTarget').value = slaTarget || '';
    document.getElementById('editSlaTimeframe').value = slaTimeframeDays || '';

    // Load notification settings for this service
    await loadNotificationSettingsForService(id);

    // Check if AI is enabled and load AI config
    const aiEnabled = await checkAIEnabledAndShowSection();
    if (aiEnabled) {
        await loadServiceAIConfig(id);
        hideWebhookForm(); // Reset webhook form state
    }

    document.getElementById('editServiceModal').classList.remove('hidden');
}

function hideEditServiceModal() {
    document.getElementById('editServiceModal').classList.add('hidden');
}

// ============================================
// Unified Monitor Modal Wrappers
// ============================================

// Wrapper for Add Monitor to Service button (called from HTML)
function showAddMonitorToServiceModal(serviceId, serviceName) {
    openMonitorModal(MonitorModalMode.ADD_TO_SERVICE, { serviceId, serviceName });
}

// ============================================
// Edit Monitor Functions
// ============================================

// Wrapper for Edit Monitor button (called from HTML)
async function editMonitor(monitorId) {
    try {
        const monitor = await api.getMonitor(monitorId);
        const service = await api.getService(monitor.service_id);

        openMonitorModal(MonitorModalMode.EDIT, {
            serviceId: monitor.service_id,
            serviceName: service.name,
            monitorId: monitor.id,
            monitor: monitor
        });
    } catch (error) {
        showError('Failed to load monitor: ' + error.message);
    }
}

// ============================================
// Notification Settings Functions
// ============================================

async function loadNotificationSettingsForService(serviceId) {
    try {
        // Load all active webhook channels (tested or not)
        const channelsResponse = await authenticatedFetch('/api/v1/notifications/channels');
        const activeChannels = (channelsResponse.channels || []).filter(c => c.is_active);

        // Render webhook channels checkboxes
        const webhookList = document.getElementById('webhookChannelsList');
        if (activeChannels.length === 0) {
            webhookList.innerHTML = '<span style="color: var(--text-tertiary);">No webhook channels configured. <a href="/static/notifications.html" style="color: var(--accent-primary);">Add channels</a></span>';
        } else {
            webhookList.innerHTML = activeChannels.map(channel => `
                <label class="checkbox-label" style="margin-bottom: 0.5rem;">
                    <input type="checkbox" name="webhook_channel" value="${channel.id}" class="form-checkbox">
                    <span>${channel.label} (${channel.channel_type})${channel.is_tested ? ' ✓' : ' (not tested)'}</span>
                </label>
            `).join('');
        }

        // Load existing notification settings (API returns settings object directly)
        const settings = await authenticatedFetch(`/api/v1/notifications/services/${serviceId}`);
        if (settings && settings.service_id) {
            document.getElementById('editNotificationsEnabled').checked = settings.enabled;
            document.getElementById('editEmailEnabled').checked = settings.email_enabled;
            document.getElementById('editEmailRecipients').value = settings.email_recipients || '';
            document.getElementById('editCooldownMinutes').value = settings.cooldown_minutes;
            document.getElementById('editNotifyOnRecovery').checked = settings.notify_on_recovery;

            // Show/hide email recipients group
            document.getElementById('emailRecipientsGroup').style.display = settings.email_enabled ? 'block' : 'none';

            // Check selected channels
            if (settings.channel_ids) {
                try {
                    const selectedIds = JSON.parse(settings.channel_ids);
                    selectedIds.forEach(id => {
                        const checkbox = document.querySelector(`input[name="webhook_channel"][value="${id}"]`);
                        if (checkbox) checkbox.checked = true;
                    });
                } catch (e) {
                    console.error('Failed to parse channel_ids:', e);
                }
            }

            // Update content visibility
            const content = document.getElementById('notificationSettingsContent');
            if (settings.enabled) {
                content.style.opacity = '1';
                content.style.pointerEvents = 'auto';
            } else {
                content.style.opacity = '0.5';
                content.style.pointerEvents = 'none';
            }
        } else {
            // No settings exist, use defaults
            document.getElementById('editNotificationsEnabled').checked = true;
            document.getElementById('editEmailEnabled').checked = false;
            document.getElementById('editEmailRecipients').value = '';
            document.getElementById('editCooldownMinutes').value = 5;
            document.getElementById('editNotifyOnRecovery').checked = true;
            document.getElementById('emailRecipientsGroup').style.display = 'none';
        }
    } catch (error) {
        console.error('Failed to load notification settings:', error);
        // Use defaults on error
        document.getElementById('webhookChannelsList').innerHTML = '<span style="color: var(--text-tertiary);">Failed to load channels</span>';
    }
}

// ============================================
// Event Listeners
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Authentication check
    requireAuth();

    // Add lightning icon to Quick Monitor button
    const quickMonitorBtn = document.getElementById('quickMonitorBtn');
    if (quickMonitorBtn) {
        quickMonitorBtn.style.display = 'inline-flex';
        quickMonitorBtn.style.alignItems = 'center';
        quickMonitorBtn.style.gap = '0.5rem';
        quickMonitorBtn.innerHTML = `<span class="icon" style="width: 16px; height: 16px; color: white;">${icons.zap}</span><span>Quick Monitor</span>`;
    }

    // Form submissions
    document.getElementById('addServiceForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const slaTarget = document.getElementById('serviceSlaTarget').value;
            const slaTimeframe = document.getElementById('serviceSlaTimeframe').value;

            await api.createService({
                name: document.getElementById('serviceName').value,
                description: document.getElementById('serviceDescription').value,
                category: document.getElementById('serviceCategory').value,
                sla_target: slaTarget ? parseFloat(slaTarget) : null,
                sla_timeframe_days: slaTimeframe ? parseInt(slaTimeframe) : null
            });
            hideAddServiceModal();
            e.target.reset();
            loadServices();
            showSuccess('Service created successfully');
        } catch (error) {
            showError('Failed to create service: ' + error.message);
        }
    });

    document.getElementById('editServiceForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const id = document.getElementById('editServiceId').value;

            // Update service details
            const slaTarget = document.getElementById('editSlaTarget').value;
            const slaTimeframe = document.getElementById('editSlaTimeframe').value;

            await api.updateService(id, {
                name: document.getElementById('editServiceName').value,
                description: document.getElementById('editServiceDescription').value,
                category: document.getElementById('editServiceCategory').value,
                show_on_status_page: document.getElementById('editShowOnStatusPage').checked,
                sla_target: slaTarget ? parseFloat(slaTarget) : null,
                sla_timeframe_days: slaTimeframe ? parseInt(slaTimeframe) : null
            });

            // Update notification settings
            const channelCheckboxes = document.querySelectorAll('input[name="webhook_channel"]:checked');
            const selectedChannelIds = Array.from(channelCheckboxes).map(cb => cb.value);

            await authenticatedFetch(`/api/v1/notifications/services/${id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    enabled: document.getElementById('editNotificationsEnabled').checked,
                    email_enabled: document.getElementById('editEmailEnabled').checked,
                    email_recipients: document.getElementById('editEmailRecipients').value || null,
                    channel_ids: selectedChannelIds.length > 0 ? JSON.stringify(selectedChannelIds.map(Number)) : null,
                    cooldown_minutes: parseInt(document.getElementById('editCooldownMinutes').value),
                    notify_on_recovery: document.getElementById('editNotifyOnRecovery').checked
                })
            });

            // Update AI configuration if section is visible
            if (document.getElementById('aiConfigSection').style.display !== 'none') {
                await saveServiceAIConfig(id);
            }

            hideEditServiceModal();
            loadServices();
            showSuccess('Service updated successfully');
        } catch (error) {
            showError('Failed to update service: ' + error.message);
        }
    });

    // Close modals on background click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    });

    // Toggle email recipients field visibility
    document.getElementById('editEmailEnabled').addEventListener('change', (e) => {
        const recipientsGroup = document.getElementById('emailRecipientsGroup');
        if (e.target.checked) {
            recipientsGroup.style.display = 'block';
        } else {
            recipientsGroup.style.display = 'none';
        }
    });

    // Toggle notification settings content visibility
    document.getElementById('editNotificationsEnabled').addEventListener('change', (e) => {
        const content = document.getElementById('notificationSettingsContent');
        if (e.target.checked) {
            content.style.opacity = '1';
            content.style.pointerEvents = 'auto';
        } else {
            content.style.opacity = '0.5';
            content.style.pointerEvents = 'none';
        }
    });
});

// Wait for monitor plugins to load before loading services
window.addEventListener('monitorPluginsLoaded', () => {
    loadServices();
});

// ============================================
// AI Configuration Functions
// ============================================

// Store webhooks in memory while editing
let currentRemediationWebhooks = [];

/**
 * Check if AI is enabled and show/hide the AI config section
 */
async function checkAIEnabledAndShowSection() {
    try {
        const statusStr = localStorage.getItem('ai_status');
        if (statusStr) {
            const status = JSON.parse(statusStr);
            if (status.enabled) {
                document.getElementById('aiConfigSection').style.display = 'block';
                return true;
            }
        }
        document.getElementById('aiConfigSection').style.display = 'none';
        return false;
    } catch (error) {
        console.error('Error checking AI status:', error);
        document.getElementById('aiConfigSection').style.display = 'none';
        return false;
    }
}

/**
 * Load AI configuration for a service
 */
async function loadServiceAIConfig(serviceId) {
    try {
        const response = await authenticatedFetch(`/api/v1/ai/services/${serviceId}/config`);

        document.getElementById('editServiceContext').value = response.service_context || '';
        document.getElementById('editKnownIssues').value = response.known_issues || '';

        currentRemediationWebhooks = response.remediation_webhooks || [];
        renderRemediationWebhooks();
    } catch (error) {
        console.error('Failed to load AI config:', error);
        // Reset to defaults
        document.getElementById('editServiceContext').value = '';
        document.getElementById('editKnownIssues').value = '';
        currentRemediationWebhooks = [];
        renderRemediationWebhooks();
    }
}

/**
 * Save AI configuration for a service
 */
async function saveServiceAIConfig(serviceId) {
    try {
        await authenticatedFetch(`/api/v1/ai/services/${serviceId}/config`, {
            method: 'PUT',
            body: JSON.stringify({
                service_context: document.getElementById('editServiceContext').value || null,
                known_issues: document.getElementById('editKnownIssues').value || null,
                remediation_webhooks: currentRemediationWebhooks.length > 0 ? currentRemediationWebhooks : null
            })
        });
    } catch (error) {
        console.error('Failed to save AI config:', error);
        throw error;
    }
}

/**
 * Render the list of remediation webhooks
 */
function renderRemediationWebhooks() {
    const container = document.getElementById('remediationWebhooksList');

    if (currentRemediationWebhooks.length === 0) {
        container.innerHTML = '<div class="webhook-empty">No webhooks configured</div>';
        return;
    }

    container.innerHTML = currentRemediationWebhooks.map((webhook, index) => `
        <div class="webhook-item">
            <div class="webhook-item-info">
                <span class="webhook-method webhook-method-${webhook.method.toLowerCase()}">${webhook.method}</span>
                <span class="webhook-name">${webhook.name}</span>
            </div>
            <div class="webhook-item-url">${webhook.url}</div>
            <div class="webhook-item-actions">
                <button type="button" onclick="editWebhook(${index})" class="btn-icon" title="Edit">
                    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M14.5 3.5l2 2-9 9H5.5v-2z"/>
                        <path d="M12.5 5.5l2 2"/>
                    </svg>
                </button>
                <button type="button" onclick="deleteWebhook(${index})" class="btn-icon btn-icon-danger" title="Delete">
                    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M6 6l8 8M14 6l-8 8"/>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * Show the add webhook form
 */
function showAddWebhookForm() {
    document.getElementById('webhookFormTitle').textContent = 'Add Remediation Webhook';
    document.getElementById('editWebhookIndex').value = '-1';
    document.getElementById('webhookName').value = '';
    document.getElementById('webhookMethod').value = 'POST';
    document.getElementById('webhookUrl').value = '';
    document.getElementById('webhookPayload').value = '';
    document.getElementById('webhookHeaders').value = '';
    document.getElementById('addWebhookForm').style.display = 'block';
}

/**
 * Hide the webhook form
 */
function hideWebhookForm() {
    document.getElementById('addWebhookForm').style.display = 'none';
}

/**
 * Edit an existing webhook
 */
function editWebhook(index) {
    const webhook = currentRemediationWebhooks[index];
    if (!webhook) return;

    document.getElementById('webhookFormTitle').textContent = 'Edit Remediation Webhook';
    document.getElementById('editWebhookIndex').value = index;
    document.getElementById('webhookName').value = webhook.name || '';
    document.getElementById('webhookMethod').value = webhook.method || 'POST';
    document.getElementById('webhookUrl').value = webhook.url || '';
    document.getElementById('webhookPayload').value = webhook.payload ? JSON.stringify(webhook.payload, null, 2) : '';
    document.getElementById('webhookHeaders').value = webhook.headers ? JSON.stringify(webhook.headers, null, 2) : '';
    document.getElementById('addWebhookForm').style.display = 'block';
}

/**
 * Delete a webhook
 */
function deleteWebhook(index) {
    currentRemediationWebhooks.splice(index, 1);
    renderRemediationWebhooks();
}

/**
 * Save webhook from form
 */
function saveWebhook() {
    const name = document.getElementById('webhookName').value.trim();
    const method = document.getElementById('webhookMethod').value;
    const url = document.getElementById('webhookUrl').value.trim();
    const payloadStr = document.getElementById('webhookPayload').value.trim();
    const headersStr = document.getElementById('webhookHeaders').value.trim();

    // Validate required fields
    if (!name || !url) {
        showError('Name and URL are required');
        return;
    }

    // Parse optional JSON fields
    let payload = null;
    let headers = null;

    if (payloadStr) {
        try {
            payload = JSON.parse(payloadStr);
        } catch (e) {
            showError('Invalid JSON in payload field');
            return;
        }
    }

    if (headersStr) {
        try {
            headers = JSON.parse(headersStr);
        } catch (e) {
            showError('Invalid JSON in headers field');
            return;
        }
    }

    const webhook = { name, method, url };
    if (payload) webhook.payload = payload;
    if (headers) webhook.headers = headers;

    const editIndex = parseInt(document.getElementById('editWebhookIndex').value);
    if (editIndex >= 0) {
        // Update existing
        currentRemediationWebhooks[editIndex] = webhook;
    } else {
        // Add new
        currentRemediationWebhooks.push(webhook);
    }

    renderRemediationWebhooks();
    hideWebhookForm();
}

/**
 * Unified Monitor Modal System
 * Handles Quick Monitor, Add to Service, and Edit Monitor flows
 * Single source of truth for all monitor creation/editing
 */

// Modal modes
const MonitorModalMode = {
    CREATE_WITH_SERVICE: 'create_with_service',  // Quick Monitor
    ADD_TO_SERVICE: 'add_to_service',            // Add to existing service
    EDIT: 'edit'                                  // Edit existing monitor
};

// Modal state
let currentModalState = {
    mode: null,
    serviceId: null,        // For ADD_TO_SERVICE and EDIT modes
    serviceName: null,      // For display
    monitorId: null,        // For EDIT mode
    monitorType: null,      // Selected type or existing type
    step: 'type_selection'  // 'type_selection' or 'configuration'
};

/**
 * Open the unified monitor modal
 * @param {string} mode - MonitorModalMode value
 * @param {object} options - { serviceId, serviceName, monitorId, monitor }
 */
function openMonitorModal(mode, options = {}) {
    currentModalState = {
        mode,
        serviceId: options.serviceId || null,
        serviceName: options.serviceName || null,
        monitorId: options.monitorId || null,
        monitorType: options.monitor?.monitor_type || null,
        monitor: options.monitor || null,
        step: mode === MonitorModalMode.EDIT ? 'configuration' : 'type_selection'
    };

    // Show modal
    const modal = document.getElementById('unifiedMonitorModal');
    modal.classList.remove('hidden');

    // Render appropriate view
    if (currentModalState.step === 'type_selection') {
        renderTypeSelection();
    } else {
        renderConfiguration();
    }
}

/**
 * Close the unified monitor modal
 */
function closeMonitorModal() {
    document.getElementById('unifiedMonitorModal').classList.add('hidden');
    resetModalState();
}

/**
 * Reset modal state
 */
function resetModalState() {
    currentModalState = {
        mode: null,
        serviceId: null,
        serviceName: null,
        monitorId: null,
        monitorType: null,
        monitor: null,
        step: 'type_selection'
    };
}

/**
 * Render type selection screen
 */
function renderTypeSelection() {
    const container = document.getElementById('monitorModalContent');

    // Set modal title based on mode
    const title = currentModalState.mode === MonitorModalMode.CREATE_WITH_SERVICE
        ? 'Quick Monitor Setup'
        : `Add Monitor to ${currentModalState.serviceName}`;

    const subtitle = currentModalState.mode === MonitorModalMode.CREATE_WITH_SERVICE
        ? 'Create a service and monitor in one step'
        : 'Select the type of monitor to add';

    document.getElementById('monitorModalTitle').textContent = title;
    document.getElementById('monitorModalSubtitle').textContent = subtitle;

    // Render categorized type cards
    container.innerHTML = `
        <div class="monitor-modal-section">
            <h4 style="font-weight: 700; margin-bottom: 1rem; color: var(--text-primary);">Select Monitor Type</h4>
            <div id="typeSelectionGrid">
                ${window.monitorRegistry.renderCategorizedTypeCards('selectMonitorType')}
            </div>
            <button onclick="closeMonitorModal()" class="btn btn-secondary" style="width: 100%; margin-top: 1.5rem;">Cancel</button>
        </div>
    `;
}

/**
 * Handle monitor type selection
 */
function selectMonitorType(type) {
    currentModalState.monitorType = type;
    currentModalState.step = 'configuration';
    renderConfiguration();
}

/**
 * Render configuration screen
 */
function renderConfiguration() {
    const container = document.getElementById('monitorModalContent');
    const monitorPlugin = window.monitorRegistry.get(currentModalState.monitorType);

    if (!monitorPlugin) {
        console.error('Monitor plugin not found:', currentModalState.monitorType);
        return;
    }

    // Set modal title based on mode
    let title, subtitle;
    if (currentModalState.mode === MonitorModalMode.CREATE_WITH_SERVICE) {
        title = `Create ${monitorPlugin.name}`;
        subtitle = 'Configure your new service and monitor';
    } else if (currentModalState.mode === MonitorModalMode.ADD_TO_SERVICE) {
        title = `Add ${monitorPlugin.name}`;
        subtitle = `Adding to ${currentModalState.serviceName}`;
    } else {
        title = `Edit ${monitorPlugin.name}`;
        subtitle = currentModalState.serviceName;
    }

    document.getElementById('monitorModalTitle').textContent = title;
    document.getElementById('monitorModalSubtitle').textContent = subtitle;

    // Generate form
    const includeServiceName = currentModalState.mode === MonitorModalMode.CREATE_WITH_SERVICE;
    const formPrefix = 'unified';
    const formHtml = window.monitorRegistry.renderForm(monitorPlugin, formPrefix, includeServiceName);
    const intervalHtml = window.monitorRegistry.renderIntervalDropdown(monitorPlugin, formPrefix);

    container.innerHTML = `
        <div class="monitor-modal-section">
            ${currentModalState.mode !== MonitorModalMode.EDIT ? `
                <button onclick="backToTypeSelection()" class="btn btn-secondary" style="margin-bottom: 1rem;">
                    ← Back to Type Selection
                </button>
            ` : ''}

            <form id="unifiedMonitorForm" onsubmit="handleMonitorSubmit(event)">
                ${formHtml}
                ${intervalHtml}

                <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                    <button type="submit" class="btn btn-primary" style="flex: 1;">
                        ${currentModalState.mode === MonitorModalMode.EDIT ? 'Update Monitor' : 'Create Monitor'}
                    </button>
                    <button type="button" onclick="closeMonitorModal()" class="btn btn-secondary" style="flex: 1;">
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    `;

    // Populate form if editing
    if (currentModalState.mode === MonitorModalMode.EDIT && currentModalState.monitor) {
        monitorPlugin.populateForm(formPrefix, currentModalState.monitor.config);

        // Set interval
        const intervalSelect = document.getElementById(`${formPrefix}Interval`);
        if (intervalSelect) {
            intervalSelect.value = currentModalState.monitor.check_interval_minutes;
        }
    }
}

/**
 * Go back to type selection
 */
function backToTypeSelection() {
    currentModalState.step = 'type_selection';
    currentModalState.monitorType = null;
    renderTypeSelection();
}

/**
 * Handle form submission
 */
async function handleMonitorSubmit(event) {
    event.preventDefault();

    const monitorPlugin = window.monitorRegistry.get(currentModalState.monitorType);
    const formPrefix = 'unified';

    try {
        // Extract configuration
        const config = monitorPlugin.extractConfig(formPrefix);

        // Validate configuration
        const validationError = monitorPlugin.validate(config);
        if (validationError) {
            showError(validationError);
            return;
        }

        // Get interval
        const intervalSelect = document.getElementById(`${formPrefix}Interval`);
        const checkInterval = intervalSelect ? parseInt(intervalSelect.value) : monitorPlugin.defaultInterval;

        if (currentModalState.mode === MonitorModalMode.CREATE_WITH_SERVICE) {
            // Quick Monitor: Create service + monitor
            const serviceName = document.getElementById(`${formPrefix}ServiceName`).value.trim();

            if (!serviceName) {
                showError('Service name is required');
                return;
            }

            // Create service first
            const service = await api.createService({
                name: serviceName,
                description: `Monitored via ${monitorPlugin.name}`,
                category: monitorPlugin.category || 'Operations'
            });

            // Create monitor
            await api.createMonitor({
                service_id: service.id,
                monitor_type: currentModalState.monitorType,
                config: config,
                check_interval_minutes: checkInterval
            });

            showSuccess(`Service "${serviceName}" and ${monitorPlugin.name} created successfully`);

        } else if (currentModalState.mode === MonitorModalMode.ADD_TO_SERVICE) {
            // Add monitor to existing service
            await api.createMonitor({
                service_id: currentModalState.serviceId,
                monitor_type: currentModalState.monitorType,
                config: config,
                check_interval_minutes: checkInterval
            });

            showSuccess(`${monitorPlugin.name} added to ${currentModalState.serviceName}`);

        } else {
            // Edit existing monitor
            await api.updateMonitor(currentModalState.monitorId, {
                config: config,
                check_interval_minutes: checkInterval
            });

            showSuccess(`${monitorPlugin.name} updated successfully`);
        }

        closeMonitorModal();

        // Reload services list
        if (typeof loadServices === 'function') {
            loadServices();
        }

    } catch (error) {
        console.error('Monitor operation failed:', error);
        showError('Operation failed: ' + error.message);
    }
}

// Make functions globally available
window.openMonitorModal = openMonitorModal;
window.closeMonitorModal = closeMonitorModal;
window.selectMonitorType = selectMonitorType;
window.backToTypeSelection = backToTypeSelection;
window.handleMonitorSubmit = handleMonitorSubmit;
window.MonitorModalMode = MonitorModalMode;
