/**
 * Services Page JavaScript
 * Handles service and monitor management using the plugin system
 */

// State
let currentQuickMonitorType = null;
let currentAddMonitorType = null;

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
            <div class="service-card">
                <div class="service-header">
                    <div style="flex: 1;">
                        <h3 class="service-title">${service.name}</h3>
                        ${service.description ? `<p class="service-description">${service.description}</p>` : ''}
                        <div class="service-meta">
                            ${service.category ? `<span style="display: inline-flex; align-items: baseline; gap: 0.25rem;"><span class="icon" style="width: 14px; height: 14px; flex-shrink: 0; display: inline-flex; align-items: center;">${icons.folder}</span><span style="line-height: 1;">${service.category}</span></span>` : ''}
                            <span style="display: inline-flex; align-items: baseline; gap: 0.25rem;"><span class="icon" style="width: 14px; height: 14px; flex-shrink: 0; display: inline-flex; align-items: center;">${icons.search}</span><span style="line-height: 1;">${serviceMonitors.length} monitor${serviceMonitors.length !== 1 ? 's' : ''}</span></span>
                        </div>
                    </div>
                    <div class="service-actions">
                        <button class="icon-btn" onclick="showEditServiceModal(${service.id}, '${service.name.replace(/'/g, "\\'")}', '${(service.description || '').replace(/'/g, "\\'")}', '${(service.category || '').replace(/'/g, "\\'")}')">
                            <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path></svg>
                        </button>
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
                            <div class="monitor-item">
                                <div class="monitor-info">
                                    <div class="monitor-type">${getMonitorTypeName(monitor.monitor_type)}${monitor.config && monitor.config.name ? ` [${monitor.config.name}]` : ''}</div>
                                    <div class="monitor-config">${getMonitorDescription(monitor)}</div>
                                    <div class="monitor-interval">Every ${monitor.check_interval_minutes} minutes</div>
                                </div>
                                <div class="monitor-actions">
                                    <button class="icon-btn" onclick="editMonitor(${monitor.id})">
                                        <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path></svg>
                                    </button>
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
    const iconMap = {
        'website': icons.globe,
        'api': icons.api,
        'metric_threshold': icons.chart,
        'port': icons.port,
        'deadman': icons.skull,
        'ssl_cert': icons.shield
    };
    const nameMap = {
        'website': 'Website',
        'api': 'API',
        'metric_threshold': 'Metric',
        'port': 'Port',
        'deadman': 'Deadman',
        'ssl_cert': 'SSL Certificate'
    };
    const icon = iconMap[type] || '';
    const name = nameMap[type] || type;
    return `<span class="monitor-type-badge"><span class="icon" style="width: 14px; height: 14px;">${icon}</span>${name}</span>`;
}

function getMonitorDescription(monitor) {
    if (!monitor.config) return '';
    const c = monitor.config;
    if (monitor.monitor_type === 'website') return c.url;
    if (monitor.monitor_type === 'api') return `${c.method || 'GET'} ${c.url}`;
    if (monitor.monitor_type === 'metric_threshold') return `Warning ${c.comparison === 'greater' ? '>' : '<'} ${c.warning_threshold}, Critical ${c.comparison === 'greater' ? '>' : '<'} ${c.critical_threshold}`;
    if (monitor.monitor_type === 'port') return `${c.host}:${c.port}`;
    if (monitor.monitor_type === 'deadman') return `Expect every ${c.expected_interval_hours}h (grace: ${c.grace_period_hours}h)`;
    if (monitor.monitor_type === 'ssl_cert') return `${c.hostname}:${c.port} (Warn: ${c.warning_days}d, Critical: ${c.critical_days}d)`;
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

// ============================================
// Modal Functions
// ============================================

// Initialize collapsible triggers (for dynamically generated content)
function initializeCollapsibles() {
    document.querySelectorAll('.collapsible-trigger').forEach(trigger => {
        // Remove any existing listeners
        const newTrigger = trigger.cloneNode(true);
        trigger.parentNode.replaceChild(newTrigger, trigger);

        newTrigger.addEventListener('click', function() {
            const isExpanded = this.getAttribute('aria-expanded') === 'true';
            this.setAttribute('aria-expanded', !isExpanded);

            const content = this.parentElement.querySelector('.collapsible-content');
            if (content) {
                content.classList.toggle('expanded');
            }
        });
    });
}

function showAddServiceModal() {
    document.getElementById('addServiceModal').classList.remove('hidden');
}

function hideAddServiceModal() {
    document.getElementById('addServiceModal').classList.add('hidden');
}

function showQuickMonitorModal() {
    document.getElementById('quickMonitorModal').classList.remove('hidden');
}

function hideQuickMonitorModal() {
    document.getElementById('quickMonitorModal').classList.add('hidden');
    backToMonitorSelection();
}

async function showEditServiceModal(id, name, desc, cat) {
    document.getElementById('editServiceId').value = id;
    document.getElementById('editServiceName').value = name;
    document.getElementById('editServiceDescription').value = desc;
    document.getElementById('editServiceCategory').value = cat;

    // Load notification settings for this service
    await loadNotificationSettingsForService(id);

    document.getElementById('editServiceModal').classList.remove('hidden');
}

function hideEditServiceModal() {
    document.getElementById('editServiceModal').classList.add('hidden');
}

// ============================================
// Quick Monitor Functions
// ============================================

function selectMonitorType(type) {
    currentQuickMonitorType = type;
    const monitor = monitorRegistry.get(type);
    if (!monitor) {
        showError('Monitor type not found: ' + type);
        return;
    }

    // Hide type selection, show form
    document.getElementById('monitorTypeSelection').classList.add('hidden');
    document.getElementById('monitorConfigForm').classList.remove('hidden');

    // Update form title
    document.getElementById('monitorFormTitle').textContent = monitor.name + ' Configuration';

    // Generate form fields using registry
    const serviceName = ''; // Will be extracted from form on submit
    const formHTML = monitorRegistry.renderForm(monitor, type, true) +
                    monitorRegistry.renderIntervalDropdown(monitor, type) +
                    monitorRegistry.renderCollapsible(monitor, type, serviceName || 'SERVICE_NAME');

    document.getElementById('quickMonitorFormFields').innerHTML = formHTML;

    // Initialize collapsible triggers
    initializeCollapsibles();
}

function backToMonitorSelection() {
    document.getElementById('monitorConfigForm').classList.add('hidden');
    document.getElementById('monitorTypeSelection').classList.remove('hidden');
    currentQuickMonitorType = null;
}

async function handleQuickMonitorSubmit(event) {
    event.preventDefault();

    if (!currentQuickMonitorType) {
        showError('No monitor type selected');
        return;
    }

    const monitor = monitorRegistry.get(currentQuickMonitorType);
    if (!monitor) {
        showError('Monitor not found: ' + currentQuickMonitorType);
        return;
    }

    try {
        // Extract configuration using plugin's extractConfig method
        const config = monitor.extractConfig(currentQuickMonitorType);

        // Validate using plugin's validate method
        const validationError = monitor.validate(config);
        if (validationError) {
            showError('Validation error: ' + validationError);
            return;
        }

        // Get service name and interval
        const serviceName = document.getElementById(`${currentQuickMonitorType}ServiceName`).value;
        const interval = parseInt(document.getElementById(`${currentQuickMonitorType}Interval`).value);

        // Create service
        const service = await api.createService({
            name: serviceName,
            description: monitor.name,
            category: 'Monitor'
        });

        // Create monitor
        await api.createMonitor({
            service_id: service.id,
            monitor_type: currentQuickMonitorType,
            config: config,
            check_interval_minutes: interval
        });

        hideQuickMonitorModal();
        loadServices();

        // Show success with endpoint info for metric_threshold and deadman monitors
        if (currentQuickMonitorType === 'metric_threshold' && config.name) {
            const encodedService = encodeURIComponent(serviceName);
            const encodedMonitor = encodeURIComponent(config.name);
            const endpoint = `/api/v1/metric/${encodedService}/${encodedMonitor}`;
            showSuccess(`Monitor created successfully! Send values to: POST ${endpoint}`);
        } else if (currentQuickMonitorType === 'deadman' && config.name) {
            const encodedService = encodeURIComponent(serviceName);
            const encodedMonitor = encodeURIComponent(config.name);
            const endpoint = `/api/v1/heartbeat/${encodedService}/${encodedMonitor}`;
            showSuccess(`Monitor created successfully! Send heartbeats to: POST ${endpoint}`);
        } else {
            showSuccess('Monitor created successfully');
        }
    } catch (error) {
        showError('Failed to create monitor: ' + error.message);
    }
}

// ============================================
// Add Monitor to Service Functions
// ============================================

function showAddMonitorToServiceModal(serviceId, serviceName) {
    document.getElementById('targetServiceId').value = serviceId;
    document.getElementById('targetServiceName').textContent = serviceName;

    // Generate type selection cards using registry
    document.getElementById('addMonitorTypeGrid').innerHTML = monitorRegistry.renderTypeCards('selectAddMonitorType');

    document.getElementById('addMonitorToServiceModal').classList.remove('hidden');
}

function hideAddMonitorToServiceModal() {
    document.getElementById('addMonitorToServiceModal').classList.add('hidden');
    backToAddMonitorSelection();
}

function selectAddMonitorType(type) {
    currentAddMonitorType = type;
    const monitor = monitorRegistry.get(type);
    if (!monitor) {
        showError('Monitor type not found: ' + type);
        return;
    }

    // Hide type selection, show form
    document.getElementById('addMonitorTypeSelection').classList.add('hidden');
    document.getElementById('addMonitorConfigForm').classList.remove('hidden');

    // Update form title
    document.getElementById('addMonitorFormTitle').textContent = monitor.name + ' Configuration';

    // Generate form fields using registry
    const serviceName = document.getElementById('targetServiceName').textContent;
    const formPrefix = 'addMonitor';
    const formHTML = monitorRegistry.renderForm(monitor, formPrefix, false) +
                    monitorRegistry.renderIntervalDropdown(monitor, formPrefix) +
                    monitorRegistry.renderCollapsible(monitor, formPrefix, serviceName);

    document.getElementById('addMonitorFormFields').innerHTML = formHTML;

    // Initialize collapsible triggers
    initializeCollapsibles();
}

function backToAddMonitorSelection() {
    document.getElementById('addMonitorConfigForm').classList.add('hidden');
    document.getElementById('addMonitorTypeSelection').classList.remove('hidden');
    currentAddMonitorType = null;
}

async function handleAddMonitorSubmit(event) {
    event.preventDefault();

    if (!currentAddMonitorType) {
        showError('No monitor type selected');
        return;
    }

    const monitor = monitorRegistry.get(currentAddMonitorType);
    if (!monitor) {
        showError('Monitor not found: ' + currentAddMonitorType);
        return;
    }

    try {
        // Extract configuration using plugin's extractConfig method
        const config = monitor.extractConfig('addMonitor');

        // Validate using plugin's validate method
        const validationError = monitor.validate(config);
        if (validationError) {
            showError('Validation error: ' + validationError);
            return;
        }

        // Get service ID and interval
        const serviceId = parseInt(document.getElementById('targetServiceId').value);
        const serviceName = document.getElementById('targetServiceName').textContent;
        const interval = parseInt(document.getElementById('addMonitorInterval').value);

        // Create monitor
        await api.createMonitor({
            service_id: serviceId,
            monitor_type: currentAddMonitorType,
            config: config,
            check_interval_minutes: interval
        });

        hideAddMonitorToServiceModal();
        loadServices();

        // Show success with endpoint info for metric_threshold and deadman monitors
        if (currentAddMonitorType === 'metric_threshold' && config.name) {
            const encodedService = encodeURIComponent(serviceName);
            const encodedMonitor = encodeURIComponent(config.name);
            const endpoint = `/api/v1/metric/${encodedService}/${encodedMonitor}`;
            showSuccess(`Monitor added successfully! Send values to: POST ${endpoint}`);
        } else if (currentAddMonitorType === 'deadman' && config.name) {
            const encodedService = encodeURIComponent(serviceName);
            const encodedMonitor = encodeURIComponent(config.name);
            const endpoint = `/api/v1/heartbeat/${encodedService}/${encodedMonitor}`;
            showSuccess(`Monitor added successfully! Send heartbeats to: POST ${endpoint}`);
        } else {
            showSuccess('Monitor added successfully');
        }
    } catch (error) {
        showError('Failed to add monitor: ' + error.message);
    }
}

// ============================================
// Edit Monitor Functions
// ============================================

async function editMonitor(monitorId) {
    try {
        const monitor = await api.getMonitor(monitorId);
        const monitorPlugin = monitorRegistry.get(monitor.monitor_type);

        if (!monitorPlugin) {
            showError('Monitor type not found: ' + monitor.monitor_type);
            return;
        }

        // Fetch service for metric and deadman monitors (needed for API endpoint preview)
        let serviceName = '';
        if (monitor.monitor_type === 'metric_threshold' || monitor.monitor_type === 'deadman') {
            const service = await api.getService(monitor.service_id);
            serviceName = service.name;
        }

        // Store monitor info in hidden fields
        document.getElementById('editMonitorId').value = monitor.id;
        document.getElementById('editMonitorType').value = monitor.monitor_type;
        document.getElementById('editMonitorServiceId').value = monitor.service_id;
        document.getElementById('editMonitorServiceName').value = serviceName;

        // Update modal title
        document.getElementById('editMonitorTitle').textContent = `Edit ${monitorPlugin.name}`;

        // Generate form fields using registry and populate with existing values
        const formPrefix = 'editMonitor';

        // Pass monitor name for metric/deadman monitors when available
        const monitorName = (monitor.monitor_type === 'metric_threshold' || monitor.monitor_type === 'deadman')
            ? monitor.config?.name : null;

        const formHTML = monitorRegistry.renderForm(monitorPlugin, formPrefix, false) +
                        monitorRegistry.renderIntervalDropdown(monitorPlugin, formPrefix) +
                        monitorRegistry.renderCollapsible(monitorPlugin, formPrefix, serviceName, monitorName);

        document.getElementById('editMonitorFormFields').innerHTML = formHTML;

        // Populate form with existing monitor values
        monitorPlugin.populateForm(formPrefix, monitor.config);
        document.getElementById('editMonitorInterval').value = monitor.check_interval_minutes;

        // Initialize collapsible triggers
        initializeCollapsibles();

        // Show modal
        document.getElementById('editMonitorModal').classList.remove('hidden');
    } catch (error) {
        showError('Failed to load monitor: ' + error.message);
    }
}

function hideEditMonitorModal() {
    document.getElementById('editMonitorModal').classList.add('hidden');
}

async function handleEditMonitorSubmit(event) {
    event.preventDefault();

    const monitorId = document.getElementById('editMonitorId').value;
    const monitorType = document.getElementById('editMonitorType').value;

    const monitorPlugin = monitorRegistry.get(monitorType);
    if (!monitorPlugin) {
        showError('Monitor type not found: ' + monitorType);
        return;
    }

    try {
        // Extract configuration using plugin's extractConfig method
        const config = monitorPlugin.extractConfig('editMonitor');

        // Validate using plugin's validate method
        const validationError = monitorPlugin.validate(config);
        if (validationError) {
            showError('Validation error: ' + validationError);
            return;
        }

        // Get interval
        const interval = parseInt(document.getElementById('editMonitorInterval').value);

        // Update monitor
        await api.updateMonitor(monitorId, {
            config: config,
            check_interval_minutes: interval
        });

        hideEditMonitorModal();
        loadServices();
        showSuccess('Monitor updated successfully');
    } catch (error) {
        showError('Failed to update monitor: ' + error.message);
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
        quickMonitorBtn.innerHTML = `<span class="icon" style="width: 16px; height: 16px;">${icons.zap}</span><span>Quick Monitor</span>`;
    }

    // Load monitor plugins and services
    (async () => {
        try {
            await monitorRegistry.loadMonitors();

            // Render Quick Monitor type cards
            const quickMonitorTypeGrid = document.getElementById('quickMonitorTypeGrid');
            if (quickMonitorTypeGrid) {
                quickMonitorTypeGrid.innerHTML = monitorRegistry.renderTypeCards('selectMonitorType');
            }

            // Render Add Monitor type cards
            const addMonitorTypeGrid = document.getElementById('addMonitorTypeGrid');
            if (addMonitorTypeGrid) {
                addMonitorTypeGrid.innerHTML = monitorRegistry.renderTypeCards('selectAddMonitorType');
            }
        } catch (error) {
            console.error('Failed to initialize monitor plugin system:', error);
        }
    })();

    // Load services
    loadServices();

    // Form submissions
    document.getElementById('addServiceForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await api.createService({
                name: document.getElementById('serviceName').value,
                description: document.getElementById('serviceDescription').value,
                category: document.getElementById('serviceCategory').value
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
            await api.updateService(id, {
                name: document.getElementById('editServiceName').value,
                description: document.getElementById('editServiceDescription').value,
                category: document.getElementById('editServiceCategory').value
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
