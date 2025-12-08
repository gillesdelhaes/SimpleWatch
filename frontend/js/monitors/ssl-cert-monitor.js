// SSL Certificate Monitor Plugin
// This is a self-contained module that defines everything needed for the SSL certificate monitor

export default {
    // Unique identifier (must match backend monitor_type)
    type: 'ssl_cert',

    // Display information
    name: 'SSL Certificate',
    description: 'Monitor certificate expiration',
    icon: 'shield',

    // Configuration schema - defines all fields needed for this monitor
    schema: {
        hostname: {
            type: 'text',
            label: 'Hostname',
            placeholder: 'example.com',
            required: true,
            hint: null
        },
        port: {
            type: 'number',
            label: 'Port',
            default: 443,
            required: true,
            min: 1,
            max: 65535
        },
        warning_days: {
            type: 'number',
            label: 'Warning Threshold (days)',
            default: 30,
            required: true,
            min: 1,
            hint: 'Alert when certificate expires in this many days'
        },
        critical_days: {
            type: 'number',
            label: 'Critical Threshold (days)',
            default: 7,
            required: true,
            min: 1,
            hint: 'Critical alert when certificate expires in this many days'
        }
    },

    // Default check interval in minutes (daily checks by default)
    defaultInterval: 1440,

    // Available interval options for the dropdown
    intervalOptions: [
        { value: 60, label: 'Every 1 hour' },
        { value: 360, label: 'Every 6 hours' },
        { value: 720, label: 'Every 12 hours' },
        { value: 1440, label: 'Every 24 hours (Daily)' }
    ],

    // Validate configuration before submission
    // Returns error message string if invalid, null if valid
    validate(config) {
        if (!config.hostname || config.hostname.trim() === '') {
            return 'Hostname is required';
        }
        if (config.port < 1 || config.port > 65535) {
            return 'Port must be between 1 and 65535';
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

    // Extract configuration from form fields
    // formPrefix: 'ssl_cert' for Quick Monitor, 'addSslCert' for Add to Service, 'editSslCert' for Edit
    extractConfig(formPrefix) {
        return {
            hostname: document.getElementById(`${formPrefix}Hostname`).value,
            port: parseInt(document.getElementById(`${formPrefix}Port`).value),
            warning_days: parseInt(document.getElementById(`${formPrefix}WarningDays`).value),
            critical_days: parseInt(document.getElementById(`${formPrefix}CriticalDays`).value)
        };
    },

    // Populate form fields with existing configuration
    // Used when editing a monitor
    populateForm(formPrefix, config) {
        document.getElementById(`${formPrefix}Hostname`).value = config.hostname;
        document.getElementById(`${formPrefix}Port`).value = config.port;
        document.getElementById(`${formPrefix}WarningDays`).value = config.warning_days;
        document.getElementById(`${formPrefix}CriticalDays`).value = config.critical_days;
    },

    // Optional: Custom rendering logic for monitor status display
    // This is used on the dashboard or services page
    renderStatus(monitor) {
        if (monitor.metadata && monitor.metadata.days_until_expiry !== undefined) {
            return `Expires in ${monitor.metadata.days_until_expiry} days`;
        }
        return null;
    }
};
