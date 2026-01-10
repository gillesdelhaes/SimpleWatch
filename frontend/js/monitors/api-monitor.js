// API Monitor Plugin
// Monitor API endpoints with custom methods, headers, and request bodies

export default {
    // Unique identifier (must match backend monitor_type)
    type: 'api',

    // Display information
    name: 'API Monitor',
    description: 'Monitor API endpoints with custom payloads and validation',
    icon: 'api',
    category: 'Web & API',

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
                { value: 'POST', label: 'POST' },
                { value: 'PUT', label: 'PUT' },
                { value: 'PATCH', label: 'PATCH' },
                { value: 'DELETE', label: 'DELETE' }
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
        },
        timeout_seconds: {
            type: 'number',
            label: 'Timeout (seconds)',
            default: 10,
            required: false,
            min: 1,
            max: 60,
            hint: 'How long to wait for response'
        },
        headers: {
            type: 'textarea',
            label: 'Headers (Optional)',
            placeholder: '{\n  "Authorization": "Bearer token",\n  "Content-Type": "application/json"\n}',
            required: false,
            hint: 'JSON object with custom headers'
        },
        request_body: {
            type: 'textarea',
            label: 'Request Body (Optional)',
            placeholder: '{\n  "key": "value"\n}',
            required: false,
            hint: 'JSON payload for POST/PUT/PATCH requests'
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
    validate(config) {
        if (!config.url.startsWith('http://') && !config.url.startsWith('https://')) {
            return 'URL must start with http:// or https://';
        }
        if (config.expected_status_code < 100 || config.expected_status_code > 599) {
            return 'Status code must be between 100 and 599';
        }
        // Headers validation happens in extractConfig (JSON.parse)
        // If we get here with headers as an object, it's already valid
        return null; // Valid
    },

    // Extract configuration from form fields
    extractConfig(formPrefix) {
        const config = {
            url: document.getElementById(`${formPrefix}Url`).value,
            method: document.getElementById(`${formPrefix}Method`).value,
            expected_status_code: parseInt(document.getElementById(`${formPrefix}ExpectedStatusCode`).value),
            timeout_seconds: parseInt(document.getElementById(`${formPrefix}TimeoutSeconds`)?.value || 10)
        };

        // Optional: headers
        const headersEl = document.getElementById(`${formPrefix}Headers`);
        if (headersEl && headersEl.value.trim()) {
            try {
                config.headers = JSON.parse(headersEl.value.trim());
            } catch (e) {
                // Keep as empty object if invalid
                config.headers = {};
            }
        }

        // Optional: request body
        const bodyEl = document.getElementById(`${formPrefix}RequestBody`);
        if (bodyEl && bodyEl.value.trim()) {
            config.request_body = bodyEl.value.trim();
        }

        return config;
    },

    // Populate form fields with existing configuration
    populateForm(formPrefix, config) {
        document.getElementById(`${formPrefix}Url`).value = config.url || '';
        document.getElementById(`${formPrefix}Method`).value = config.method || 'GET';
        document.getElementById(`${formPrefix}ExpectedStatusCode`).value = config.expected_status_code || 200;

        const timeoutEl = document.getElementById(`${formPrefix}TimeoutSeconds`);
        if (timeoutEl) {
            timeoutEl.value = config.timeout_seconds || 10;
        }

        const headersEl = document.getElementById(`${formPrefix}Headers`);
        if (headersEl && config.headers) {
            headersEl.value = typeof config.headers === 'string'
                ? config.headers
                : JSON.stringify(config.headers, null, 2);
        }

        const bodyEl = document.getElementById(`${formPrefix}RequestBody`);
        if (bodyEl && config.request_body) {
            bodyEl.value = config.request_body;
        }
    },

    // Custom rendering logic for monitor status display
    renderStatus(monitor) {
        if (monitor.response_time_ms) {
            return `${monitor.response_time_ms}ms`;
        }
        return null;
    },

    // Get description text for services page
    getDescription(config) {
        if (!config) return '';
        let desc = `${config.method || 'GET'} ${config.url}`;
        if (config.request_body) {
            desc += ' (with body)';
        }
        return desc;
    },

    // Render detailed metrics for modal view
    renderDetailMetrics(monitor) {
        let html = '';

        // Show response time
        if (monitor.response_time_ms !== null && monitor.response_time_ms !== undefined) {
            html += `
                <div class="monitor-metric">
                    <div class="monitor-metric-label">Response Time</div>
                    <div class="monitor-metric-value">${monitor.response_time_ms}ms</div>
                </div>
            `;
        }

        // Show status code
        if (monitor.metadata && monitor.metadata.status_code) {
            html += `
                <div class="monitor-metric">
                    <div class="monitor-metric-label">Status Code</div>
                    <div class="monitor-metric-value">${monitor.metadata.status_code}</div>
                </div>
            `;
        }

        return html;
    }
};
