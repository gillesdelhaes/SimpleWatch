// Website Monitor Plugin
// This is a self-contained module that defines everything needed for the website monitor

export default {
    // Unique identifier (must match backend monitor_type)
    type: 'website',

    // Display information
    name: 'Website Monitor',
    description: 'Check if a URL responds',
    icon: 'globe',

    // Configuration schema - defines all fields needed for this monitor
    schema: {
        url: {
            type: 'url',
            label: 'URL',
            placeholder: 'https://example.com',
            required: true,
            hint: null
        },
        timeout_seconds: {
            type: 'number',
            label: 'Timeout (seconds)',
            default: 10,
            required: true,
            min: 1,
            max: 60
        },
        follow_redirects: {
            type: 'checkbox',
            label: 'Follow Redirects',
            default: true
        }
    },

    // Default check interval in minutes
    defaultInterval: 5,

    // Available interval options for the dropdown
    intervalOptions: [
        { value: 1, label: 'Every 1 minute' },
        { value: 5, label: 'Every 5 minutes' },
        { value: 15, label: 'Every 15 minutes' },
        { value: 30, label: 'Every 30 minutes' },
        { value: 60, label: 'Every 1 hour' }
    ],

    // Validate configuration before submission
    // Returns error message string if invalid, null if valid
    validate(config) {
        if (!config.url.startsWith('http://') && !config.url.startsWith('https://')) {
            return 'URL must start with http:// or https://';
        }
        if (config.timeout_seconds < 1 || config.timeout_seconds > 60) {
            return 'Timeout must be between 1 and 60 seconds';
        }
        return null; // Valid
    },

    // Extract configuration from form fields
    // formPrefix: 'website' for Quick Monitor, 'addWebsite' for Add to Service, 'editWebsite' for Edit
    extractConfig(formPrefix) {
        return {
            url: document.getElementById(`${formPrefix}Url`).value,
            timeout_seconds: parseInt(document.getElementById(`${formPrefix}TimeoutSeconds`).value),
            follow_redirects: document.getElementById(`${formPrefix}FollowRedirects`).checked
        };
    },

    // Populate form fields with existing configuration
    // Used when editing a monitor
    populateForm(formPrefix, config) {
        document.getElementById(`${formPrefix}Url`).value = config.url;
        document.getElementById(`${formPrefix}TimeoutSeconds`).value = config.timeout_seconds;
        document.getElementById(`${formPrefix}FollowRedirects`).checked = config.follow_redirects;
    },

    // Optional: Custom rendering logic for monitor status display
    // This is used on the dashboard or services page
    renderStatus(monitor) {
        if (monitor.response_time_ms) {
            return `${monitor.response_time_ms}ms`;
        }
        return null;
    },

    // Get description text for services page
    getDescription(config) {
        if (!config) return '';
        return config.url;
    }
};
