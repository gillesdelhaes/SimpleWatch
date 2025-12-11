// Port Monitor Plugin
// This is a self-contained module that defines everything needed for the port monitor

export default {
    // Unique identifier (must match backend monitor_type)
    type: 'port',

    // Display information
    name: 'Port Monitor',
    description: 'Test if TCP port is open',
    icon: 'port',

    // Configuration schema - defines all fields needed for this monitor
    schema: {
        host: {
            type: 'text',
            label: 'Host',
            placeholder: 'example.com or 192.168.1.1',
            required: true,
            hint: null
        },
        port: {
            type: 'number',
            label: 'Port',
            placeholder: '80',
            required: true,
            min: 1,
            max: 65535
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
        if (!config.host || config.host.trim() === '') {
            return 'Host is required';
        }
        if (config.port < 1 || config.port > 65535) {
            return 'Port must be between 1 and 65535';
        }
        return null; // Valid
    },

    // Extract configuration from form fields
    // formPrefix: 'port' for Quick Monitor, 'addPort' for Add to Service, 'editPort' for Edit
    extractConfig(formPrefix) {
        return {
            host: document.getElementById(`${formPrefix}Host`).value,
            port: parseInt(document.getElementById(`${formPrefix}Port`).value)
        };
    },

    // Populate form fields with existing configuration
    // Used when editing a monitor
    populateForm(formPrefix, config) {
        document.getElementById(`${formPrefix}Host`).value = config.host;
        document.getElementById(`${formPrefix}Port`).value = config.port;
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
        return `${config.host}:${config.port}`;
    }
};
