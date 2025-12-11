// API Monitor Plugin
// This is a self-contained module that defines everything needed for the API monitor

export default {
    // Unique identifier (must match backend monitor_type)
    type: 'api',

    // Display information
    name: 'API Monitor',
    description: 'Call API endpoint with validation',
    icon: 'api',

    // Configuration schema - defines all fields needed for this monitor
    schema: {
        url: {
            type: 'url',
            label: 'API URL',
            placeholder: 'https://api.example.com/endpoint',
            required: true,
            hint: null
        },
        method: {
            type: 'select',
            label: 'HTTP Method',
            options: [
                { value: 'GET', label: 'GET' },
                { value: 'POST', label: 'POST' }
            ],
            default: 'GET',
            required: true
        },
        expected_status_code: {
            type: 'number',
            label: 'Expected Status Code',
            default: 200,
            required: true,
            min: 100,
            max: 599
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
        if (config.expected_status_code < 100 || config.expected_status_code > 599) {
            return 'Status code must be between 100 and 599';
        }
        return null; // Valid
    },

    // Extract configuration from form fields
    // formPrefix: 'api' for Quick Monitor, 'addApi' for Add to Service, 'editApi' for Edit
    extractConfig(formPrefix) {
        return {
            url: document.getElementById(`${formPrefix}Url`).value,
            method: document.getElementById(`${formPrefix}Method`).value,
            expected_status_code: parseInt(document.getElementById(`${formPrefix}ExpectedStatusCode`).value)
        };
    },

    // Populate form fields with existing configuration
    // Used when editing a monitor
    populateForm(formPrefix, config) {
        document.getElementById(`${formPrefix}Url`).value = config.url;
        document.getElementById(`${formPrefix}Method`).value = config.method;
        document.getElementById(`${formPrefix}ExpectedStatusCode`).value = config.expected_status_code;
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
        return `${config.method || 'GET'} ${config.url}`;
    }
};
