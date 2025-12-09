/**
 * Notifications Page JavaScript
 * Handles SMTP configuration, webhook channels, and notification logs
 */

let channels = [];
let editingChannelId = null;

// Inject icons
document.addEventListener('DOMContentLoaded', () => {
    const emptyIcon = document.getElementById('emptyIcon');
    if (emptyIcon) {
        emptyIcon.innerHTML = icons.bellSlash;
    }

    const smtpIcon = document.getElementById('smtpIcon');
    if (smtpIcon) {
        smtpIcon.innerHTML = icons.mail;
    }
});

// ============================================
// SMTP Configuration
// ============================================

async function loadSMTPConfig() {
    try {
        const config = await authenticatedFetch('/api/v1/notifications/smtp');
        // API returns config object directly
        document.getElementById('smtpHost').value = config.host || '';
        document.getElementById('smtpPort').value = config.port || 587;
        document.getElementById('smtpUsername').value = config.username || '';
        document.getElementById('smtpFromAddress').value = config.from_address || '';
        document.getElementById('smtpUseTls').checked = config.use_tls !== false;

        // Update status badge
        const badge = document.getElementById('smtpStatusBadge');
        if (config.is_tested) {
            badge.innerHTML = '<span class="badge badge-success">✓ Tested</span>';
        } else {
            badge.innerHTML = '<span class="badge badge-warning">Not Tested</span>';
        }
    } catch (error) {
        console.log('No SMTP config found, using defaults');
    }
}

document.getElementById('smtpForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const config = {
        host: document.getElementById('smtpHost').value,
        port: parseInt(document.getElementById('smtpPort').value),
        username: document.getElementById('smtpUsername').value,
        from_address: document.getElementById('smtpFromAddress').value,
        use_tls: document.getElementById('smtpUseTls').checked
    };

    const password = document.getElementById('smtpPassword').value;
    if (password) {
        config.password = password;
    }

    try {
        await authenticatedFetch('/api/v1/notifications/smtp', {
            method: 'PUT',
            body: JSON.stringify(config)
        });
        showSuccess('SMTP settings saved successfully!');
        document.getElementById('smtpPassword').value = ''; // Clear password field
        await loadSMTPConfig();
    } catch (error) {
        showError('Failed to save SMTP settings: ' + error.message);
    }
});

async function testSMTP() {
    const btn = document.getElementById('testSMTPBtn');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
        const response = await authenticatedFetch('/api/v1/notifications/smtp/test', {
            method: 'POST'
        });
        showSuccess('Test email sent successfully! Check your inbox.');
        await loadSMTPConfig(); // Refresh to show "Tested" badge
    } catch (error) {
        showError('Failed to send test email: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Test Email';
    }
}

// ============================================
// Webhook Channels
// ============================================

async function loadChannels() {
    try {
        const response = await authenticatedFetch('/api/v1/notifications/channels');
        channels = response.channels || [];
        renderChannels();
    } catch (error) {
        console.error('Failed to load channels:', error);
    }
}

function renderChannels() {
    const container = document.getElementById('channelsList');
    const emptyState = document.getElementById('emptyChannelsState');

    if (channels.length === 0) {
        container.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    container.innerHTML = channels.map(channel => `
        <div class="channel-card">
            <div class="channel-header">
                <div>
                    <div class="channel-title">${channel.label}</div>
                    <div class="channel-type">${channel.channel_type}</div>
                    <div class="channel-url">${channel.webhook_url}</div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-end;">
                    ${channel.is_tested ? '<span class="badge badge-success">✓ Tested</span>' : '<span class="badge badge-warning">Not Tested</span>'}
                    <div class="actions">
                        <button onclick="testChannel(${channel.id})" class="icon-btn" title="Test">
                            <svg fill="currentColor" viewBox="0 0 20 20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"></path></svg>
                        </button>
                        <button onclick="toggleChannel(${channel.id})" class="icon-btn" title="${channel.is_active ? 'Disable' : 'Enable'}">
                            ${channel.is_active
                                ? '<svg fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>'
                                : '<svg fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path></svg>'
                            }
                        </button>
                        <button onclick="editChannel(${channel.id})" class="icon-btn" title="Edit">
                            <svg fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path></svg>
                        </button>
                        <button onclick="deleteChannel(${channel.id})" class="icon-btn delete" title="Delete">
                            <svg fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function showAddChannelModal() {
    editingChannelId = null;
    document.getElementById('channelModalTitle').textContent = 'Add Webhook Channel';
    document.getElementById('channelForm').reset();
    document.getElementById('channelId').value = '';
    updateChannelTypeHelp();
    document.getElementById('channelModal').classList.remove('hidden');
}

function hideChannelModal() {
    document.getElementById('channelModal').classList.add('hidden');
}

function updateChannelTypeHelp() {
    const type = document.getElementById('channelType').value;
    const helpText = document.getElementById('webhookHelp');
    const customTemplateGroup = document.getElementById('customTemplateGroup');

    if (type === 'slack') {
        helpText.textContent = 'Enter your Slack webhook URL from Incoming Webhooks app';
        customTemplateGroup.style.display = 'none';
    } else if (type === 'discord') {
        helpText.textContent = 'Enter your Discord webhook URL from Server Settings > Integrations';
        customTemplateGroup.style.display = 'none';
    } else {
        helpText.textContent = 'Enter any webhook URL that accepts JSON POST requests';
        customTemplateGroup.style.display = 'block';
    }
}

document.getElementById('channelForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const channelData = {
        label: document.getElementById('channelLabel').value,
        channel_type: document.getElementById('channelType').value,
        webhook_url: document.getElementById('channelWebhookUrl').value,
        secret_token: document.getElementById('channelSecretToken').value || null,
        custom_payload_template: document.getElementById('channelCustomTemplate').value || null
    };

    try {
        const channelId = document.getElementById('channelId').value;
        if (channelId) {
            // Update existing
            await authenticatedFetch(`/api/v1/notifications/channels/${channelId}`, {
                method: 'PUT',
                body: JSON.stringify(channelData)
            });
        } else {
            // Create new
            await authenticatedFetch('/api/v1/notifications/channels', {
                method: 'POST',
                body: JSON.stringify(channelData)
            });
        }
        hideChannelModal();
        await loadChannels();
        showSuccess('Channel saved successfully');
    } catch (error) {
        showError('Failed to save channel: ' + error.message);
    }
});

async function editChannel(id) {
    const channel = channels.find(c => c.id === id);
    if (!channel) return;

    editingChannelId = id;
    document.getElementById('channelModalTitle').textContent = 'Edit Webhook Channel';
    document.getElementById('channelId').value = id;
    document.getElementById('channelLabel').value = channel.label;
    document.getElementById('channelType').value = channel.channel_type;
    document.getElementById('channelWebhookUrl').value = channel.webhook_url;
    document.getElementById('channelSecretToken').value = channel.secret_token || '';
    document.getElementById('channelCustomTemplate').value = channel.custom_payload_template || '';

    updateChannelTypeHelp();
    document.getElementById('channelModal').classList.remove('hidden');
}

async function deleteChannel(id) {
    const confirmed = await showConfirm(
        'Are you sure you want to delete this webhook channel?',
        {
            title: 'Delete Channel',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            confirmClass: 'btn-danger'
        }
    );
    if (!confirmed) return;

    try {
        await authenticatedFetch(`/api/v1/notifications/channels/${id}`, {
            method: 'DELETE'
        });
        await loadChannels();
        showSuccess('Channel deleted successfully');
    } catch (error) {
        showError('Failed to delete channel: ' + error.message);
    }
}

async function toggleChannel(id) {
    try {
        await authenticatedFetch(`/api/v1/notifications/channels/${id}/toggle`, {
            method: 'POST'
        });
        await loadChannels();
    } catch (error) {
        showError('Failed to toggle channel: ' + error.message);
    }
}

async function testChannel(id) {
    try {
        await authenticatedFetch(`/api/v1/notifications/channels/${id}/test`, {
            method: 'POST'
        });
        showSuccess('Test notification sent successfully! Check your channel.');
        await loadChannels(); // Refresh to show "Tested" badge
    } catch (error) {
        showError('Failed to send test notification: ' + error.message);
    }
}

// ============================================
// Notification Log Functions
// ============================================

let logExpanded = false;
let logRefreshInterval = null;

function toggleLogSection() {
    const section = document.getElementById('logSection');
    logExpanded = !logExpanded;

    if (logExpanded) {
        section.classList.add('expanded');
        loadNotificationLogs();
        // Auto-refresh every 10 seconds when expanded
        logRefreshInterval = setInterval(loadNotificationLogs, 10000);
    } else {
        section.classList.remove('expanded');
        // Stop auto-refresh when collapsed
        if (logRefreshInterval) {
            clearInterval(logRefreshInterval);
            logRefreshInterval = null;
        }
    }
}

async function loadNotificationLogs() {
    const loadingEl = document.getElementById('logLoading');
    const emptyEl = document.getElementById('logEmptyState');
    const tableEl = document.getElementById('logTable');
    const exportBtn = document.getElementById('exportBtn');
    const tbody = document.getElementById('logTableBody');

    // Show loading only on first load
    if (!tbody.children.length) {
        loadingEl.classList.remove('hidden');
        emptyEl.classList.add('hidden');
        tableEl.style.display = 'none';
    }

    try {
        const data = await authenticatedFetch('/api/v1/notifications/logs?limit=50');
        console.log('Notification logs data:', data);

        loadingEl.classList.add('hidden');

        if (!data.logs || data.logs.length === 0) {
            // Show empty state
            emptyEl.classList.remove('hidden');
            tableEl.style.display = 'none';
            exportBtn.style.display = 'none';
        } else {
            // Populate table
            emptyEl.classList.add('hidden');
            tableEl.style.display = 'table';
            exportBtn.style.display = 'inline-flex';

            tbody.innerHTML = data.logs.map(log => {
                const timestamp = new Date(log.timestamp);
                const formattedTime = timestamp.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                });

                const deliveryIcon = log.delivery_status === 'sent'
                    ? '<svg class="log-delivery-icon" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>'
                    : '<svg class="log-delivery-icon" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>';

                const errorTooltip = log.error_message
                    ? `title="${log.error_message.replace(/"/g, '&quot;')}"`
                    : '';

                return `
                    <tr>
                        <td><span class="log-timestamp">${formattedTime}</span></td>
                        <td><span class="log-service">${log.service_name}</span></td>
                        <td><span class="log-channel">${log.channel}</span></td>
                        <td><span class="log-status-change">${log.status_change}</span></td>
                        <td>
                            <span class="log-delivery-status ${log.delivery_status}" ${errorTooltip}>
                                ${deliveryIcon}
                                ${log.delivery_status}
                            </span>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    } catch (error) {
        loadingEl.classList.add('hidden');
        console.error('Failed to load notification logs:', error);
        showError('Failed to load notification logs');
    }
}

async function exportNotificationLog() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/notifications/logs/export', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to export logs');
        }

        // Get the blob from the response
        const blob = await response.blob();

        // Create a download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // Extract filename from Content-Disposition header or use default
        const contentDisposition = response.headers.get('Content-Disposition');
        const filename = contentDisposition
            ? contentDisposition.split('filename=')[1].replace(/"/g, '')
            : `notification-log-${new Date().toISOString().split('T')[0]}.csv`;

        a.download = filename;
        document.body.appendChild(a);
        a.click();

        // Cleanup
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showSuccess('Notification log downloaded successfully');
    } catch (error) {
        showError('Failed to export notification log: ' + error.message);
    }
}

// ============================================
// Initialize
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    await loadSMTPConfig();
    await loadChannels();

    // Inject empty state icon for log
    const logEmptyIcon = document.getElementById('logEmptyIcon');
    if (logEmptyIcon) {
        logEmptyIcon.innerHTML = icons.clipboardList;
    }
});

// Insert theme toggle
if (typeof insertThemeToggle === 'function') {
    insertThemeToggle('settingsThemeToggle');
}
