// DNS Monitor Plugin
// Monitors DNS record resolution and optionally validates against expected values

export default {
    // Unique identifier (must match backend monitor_type)
    type: 'dns',

    // Display information
    name: 'DNS Monitor',
    description: 'Check DNS record resolution',
    icon: 'database',
    category: 'Infrastructure',

    // Configuration schema - defines all fields needed for this monitor
    schema: {
        hostname: {
            type: 'text',
            label: 'Hostname',
            placeholder: 'example.com',
            required: true,
            hint: 'Domain name to query (without http://)'
        },
        record_type: {
            type: 'select',
            label: 'Record Type',
            required: true,
            default: 'A',
            options: [
                { value: 'A', label: 'A - IPv4 Address' },
                { value: 'AAAA', label: 'AAAA - IPv6 Address' },
                { value: 'CNAME', label: 'CNAME - Canonical Name' },
                { value: 'MX', label: 'MX - Mail Exchange' },
                { value: 'TXT', label: 'TXT - Text Record' },
                { value: 'NS', label: 'NS - Name Server' }
            ]
        },
        expected_value: {
            type: 'text',
            label: 'Expected Value (Optional)',
            placeholder: '93.184.216.34',
            required: false,
            hint: 'Leave blank to only verify DNS resolution works. If specified, will validate resolved value matches.'
        },
        nameserver: {
            type: 'text',
            label: 'Custom Nameserver (Optional)',
            placeholder: '8.8.8.8',
            required: false,
            hint: 'Leave blank to use system default DNS'
        },
        timeout_seconds: {
            type: 'number',
            label: 'Timeout (seconds)',
            default: 5,
            required: true,
            min: 1,
            max: 30
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
        if (!config.hostname || config.hostname.trim() === '') {
            return 'Hostname is required';
        }

        // Check for common mistakes
        if (config.hostname.startsWith('http://') || config.hostname.startsWith('https://')) {
            return 'Hostname should not include http:// or https://';
        }

        if (config.hostname.endsWith('/')) {
            return 'Hostname should not end with /';
        }

        if (config.timeout_seconds < 1 || config.timeout_seconds > 30) {
            return 'Timeout must be between 1 and 30 seconds';
        }

        // Validate nameserver format if provided
        if (config.nameserver && config.nameserver.trim() !== '') {
            const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
            if (!ipPattern.test(config.nameserver.trim())) {
                return 'Nameserver must be a valid IPv4 address (e.g., 8.8.8.8)';
            }
        }

        return null; // Valid
    },

    // Extract configuration from form fields
    // formPrefix: 'dns' for Quick Monitor, 'addDns' for Add to Service, 'editDns' for Edit
    extractConfig(formPrefix) {
        const nameserver = document.getElementById(`${formPrefix}Nameserver`).value.trim();
        const expectedValue = document.getElementById(`${formPrefix}ExpectedValue`).value.trim();

        return {
            hostname: document.getElementById(`${formPrefix}Hostname`).value.trim(),
            record_type: document.getElementById(`${formPrefix}RecordType`).value,
            expected_value: expectedValue || null,
            nameserver: nameserver || null,
            timeout_seconds: parseInt(document.getElementById(`${formPrefix}TimeoutSeconds`).value)
        };
    },

    // Populate form fields with existing configuration
    // Used when editing a monitor
    populateForm(formPrefix, config) {
        document.getElementById(`${formPrefix}Hostname`).value = config.hostname || '';
        document.getElementById(`${formPrefix}RecordType`).value = config.record_type || 'A';
        document.getElementById(`${formPrefix}ExpectedValue`).value = config.expected_value || '';
        document.getElementById(`${formPrefix}Nameserver`).value = config.nameserver || '';
        document.getElementById(`${formPrefix}TimeoutSeconds`).value = config.timeout_seconds || 5;
    },

    // Optional: Custom rendering logic for monitor status display
    // This is used on the dashboard or services page
    renderStatus(monitor) {
        // Show response time if available
        if (monitor.response_time_ms) {
            return `${monitor.response_time_ms}ms`;
        }

        // Show resolved values if available in metadata
        if (monitor.metadata && monitor.metadata.resolved_values && monitor.metadata.resolved_values.length > 0) {
            const values = monitor.metadata.resolved_values;
            if (values.length === 1) {
                return values[0];
            } else {
                return `${values.length} records`;
            }
        }

        return null;
    },

    // Get description text for services page
    // config: monitor configuration object
    getDescription(config) {
        if (!config) return '';
        return `${config.hostname} (${config.record_type})${config.expected_value ? ' → ' + config.expected_value : ''}`;
    },

    // Render custom metrics for dashboard modal
    // monitor: full monitor object with metadata
    renderDetailMetrics(monitor) {
        if (!monitor.metadata) return '';

        return `
            <div class="monitor-metric">
                <div class="monitor-metric-label">Hostname</div>
                <div class="monitor-metric-value">${monitor.metadata.hostname || 'N/A'}</div>
            </div>
            <div class="monitor-metric">
                <div class="monitor-metric-label">Record Type</div>
                <div class="monitor-metric-value">${monitor.metadata.record_type || 'N/A'}</div>
            </div>
            ${monitor.metadata.expected_value ? `
            <div class="monitor-metric">
                <div class="monitor-metric-label">Expected Value</div>
                <div class="monitor-metric-value">${monitor.metadata.expected_value}</div>
            </div>
            ` : ''}
            ${monitor.metadata.resolved_values && monitor.metadata.resolved_values.length > 0 ? `
            <div class="monitor-metric">
                <div class="monitor-metric-label">Resolved Values</div>
                <div class="monitor-metric-value" style="font-family: var(--font-mono); font-size: 0.8125rem;">
                    ${monitor.metadata.resolved_values.join('<br>')}
                </div>
            </div>
            ` : ''}
            ${monitor.response_time_ms ? `
            <div class="monitor-metric">
                <div class="monitor-metric-label">Query Time</div>
                <div class="monitor-metric-value">${monitor.response_time_ms}ms</div>
            </div>
            ` : ''}
        `;
    }
};
