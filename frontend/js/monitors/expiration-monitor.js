// Expiration Monitor Plugin
// Monitors expiration dates for licenses, subscriptions, domains, contracts, etc.

export default {
    // Unique identifier (must match backend monitor_type)
    type: 'expiration',

    // Display information
    name: 'Expiration Monitor',
    description: 'Track expiration dates for licenses, subscriptions, domains, and contracts',
    icon: 'calendar',
    category: 'Operations',

    // Configuration schema
    schema: {
        item_name: {
            type: 'text',
            label: 'Item Name',
            placeholder: 'e.g., GitHub Enterprise License',
            required: true,
            hint: 'What are you tracking? (license, domain, subscription, etc.)'
        },
        expiration_date: {
            type: 'date',
            label: 'Expiration Date',
            required: true,
            hint: 'When does this item expire?'
        },
        warning_days: {
            type: 'number',
            label: 'Warning Threshold (days)',
            default: 30,
            required: true,
            min: 1,
            hint: 'Alert when expiration is within this many days'
        },
        critical_days: {
            type: 'number',
            label: 'Critical Threshold (days)',
            default: 7,
            required: true,
            min: 1,
            hint: 'Critical alert when expiration is within this many days'
        },
        renewal_url: {
            type: 'url',
            label: 'Renewal URL (Optional)',
            placeholder: 'https://example.com/renew',
            required: false,
            hint: 'Quick link to renewal page'
        },
        cost: {
            type: 'text',
            label: 'Cost (Optional)',
            placeholder: 'e.g., $500/year',
            required: false,
            hint: 'Renewal cost for reference'
        },
        notes: {
            type: 'textarea',
            label: 'Notes (Optional)',
            placeholder: 'License key location, renewal instructions, etc.',
            required: false,
            hint: 'Additional information about this item'
        }
    },

    // Default check interval in minutes (daily checks by default)
    defaultInterval: 1440,

    // Available interval options
    intervalOptions: [
        { value: 360, label: 'Every 6 hours' },
        { value: 720, label: 'Every 12 hours' },
        { value: 1440, label: 'Every 24 hours (Daily)' },
        { value: 2880, label: 'Every 48 hours' }
    ],

    // Validate configuration
    validate(config) {
        if (!config.item_name || config.item_name.trim() === '') {
            return 'Item name is required';
        }
        if (!config.expiration_date || config.expiration_date.trim() === '') {
            return 'Expiration date is required';
        }
        if (config.warning_days < 1) {
            return 'Warning threshold must be at least 1 day';
        }
        if (config.critical_days < 1) {
            return 'Critical threshold must be at least 1 day';
        }
        if (config.critical_days >= config.warning_days) {
            return 'Critical threshold must be less than warning threshold';
        }
        return null; // Valid
    },

    // Extract configuration from form
    extractConfig(formPrefix) {
        const config = {
            item_name: document.getElementById(`${formPrefix}ItemName`).value.trim(),
            expiration_date: document.getElementById(`${formPrefix}ExpirationDate`).value,
            warning_days: parseInt(document.getElementById(`${formPrefix}WarningDays`).value || 30),
            critical_days: parseInt(document.getElementById(`${formPrefix}CriticalDays`).value || 7)
        };

        // Optional fields
        const renewalUrl = document.getElementById(`${formPrefix}RenewalUrl`)?.value.trim();
        if (renewalUrl) {
            config.renewal_url = renewalUrl;
        }

        const cost = document.getElementById(`${formPrefix}Cost`)?.value.trim();
        if (cost) {
            config.cost = cost;
        }

        const notes = document.getElementById(`${formPrefix}Notes`)?.value.trim();
        if (notes) {
            config.notes = notes;
        }

        return config;
    },

    // Populate form with existing configuration
    populateForm(formPrefix, config) {
        document.getElementById(`${formPrefix}ItemName`).value = config.item_name || '';
        document.getElementById(`${formPrefix}ExpirationDate`).value = config.expiration_date || '';
        document.getElementById(`${formPrefix}WarningDays`).value = config.warning_days || 30;
        document.getElementById(`${formPrefix}CriticalDays`).value = config.critical_days || 7;

        if (config.renewal_url) {
            const renewalUrlEl = document.getElementById(`${formPrefix}RenewalUrl`);
            if (renewalUrlEl) renewalUrlEl.value = config.renewal_url;
        }

        if (config.cost) {
            const costEl = document.getElementById(`${formPrefix}Cost`);
            if (costEl) costEl.value = config.cost;
        }

        if (config.notes) {
            const notesEl = document.getElementById(`${formPrefix}Notes`);
            if (notesEl) notesEl.value = config.notes;
        }
    },

    // Get description for services page
    getDescription(config) {
        if (!config) return '';
        let desc = config.item_name || 'Expiration';

        if (config.expiration_date) {
            const date = new Date(config.expiration_date);
            desc += ` (expires ${date.toLocaleDateString()})`;
        }

        if (config.cost) {
            desc += ` - ${config.cost}`;
        }

        return desc;
    },

    // Render detailed metrics for modal view
    renderDetailMetrics(monitor) {
        let html = '';

        // Show days until expiry
        if (monitor.metadata && monitor.metadata.days_until_expiry !== undefined) {
            const days = monitor.metadata.days_until_expiry;
            const daysClass = days < 0 ? 'error' : days <= 7 ? 'error' : days <= 30 ? 'warning' : '';
            const daysText = days < 0 ? `Expired ${Math.abs(days)} days ago` : `${days} days remaining`;

            html += `
                <div class="monitor-metric">
                    <div class="monitor-metric-label">Status</div>
                    <div class="monitor-metric-value ${daysClass}">${daysText}</div>
                </div>
            `;
        }

        // Show expiration date
        if (monitor.metadata && monitor.metadata.expiry_date) {
            html += `
                <div class="monitor-metric">
                    <div class="monitor-metric-label">Expiration Date</div>
                    <div class="monitor-metric-value">${new Date(monitor.metadata.expiry_date).toLocaleDateString()}</div>
                </div>
            `;
        }

        // Show cost
        if (monitor.metadata && monitor.metadata.cost) {
            html += `
                <div class="monitor-metric">
                    <div class="monitor-metric-label">Cost</div>
                    <div class="monitor-metric-value">${monitor.metadata.cost}</div>
                </div>
            `;
        }

        // Show renewal URL as link
        if (monitor.metadata && monitor.metadata.renewal_url) {
            html += `
                <div class="monitor-metric" style="grid-column: span 2;">
                    <div class="monitor-metric-label">Renewal Link</div>
                    <div class="monitor-metric-value">
                        <a href="${monitor.metadata.renewal_url}" target="_blank" rel="noopener noreferrer"
                           style="color: var(--accent); text-decoration: none;">
                            ${monitor.metadata.renewal_url}
                        </a>
                    </div>
                </div>
            `;
        }

        // Show notes
        if (monitor.metadata && monitor.metadata.notes) {
            html += `
                <div class="monitor-metric" style="grid-column: span 2;">
                    <div class="monitor-metric-label">Notes</div>
                    <div class="monitor-metric-value" style="white-space: pre-wrap;">${monitor.metadata.notes}</div>
                </div>
            `;
        }

        return html;
    }
};
