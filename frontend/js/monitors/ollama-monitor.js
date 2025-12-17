// Ollama/Local LLM Monitor Plugin
// Monitors local LLM APIs (Ollama, LM Studio, LocalAI, etc.)

export default {
    // Unique identifier (must match backend monitor_type)
    type: 'ollama',

    // Display information
    name: 'Ollama/LLM Monitor',
    description: 'Monitor local LLM APIs (Ollama, LM Studio, LocalAI)',
    icon: 'brain',

    // Configuration schema
    schema: {
        host: {
            type: 'text',
            label: 'Host',
            placeholder: 'localhost',
            default: 'localhost',
            required: true,
            hint: 'Hostname or IP address'
        },
        port: {
            type: 'number',
            label: 'Port',
            placeholder: '11434',
            default: 11434,
            required: true,
            min: 1,
            max: 65535,
            hint: 'Ollama: 11434, LM Studio: 1234, LocalAI: 8080'
        },
        protocol: {
            type: 'select',
            label: 'Protocol',
            options: [
                { value: 'http', label: 'HTTP' },
                { value: 'https', label: 'HTTPS' }
            ],
            default: 'http',
            required: true
        },
        api_type: {
            type: 'select',
            label: 'API Type',
            options: [
                { value: 'ollama', label: 'Ollama' },
                { value: 'lm_studio', label: 'LM Studio' },
                { value: 'openai_compatible', label: 'OpenAI Compatible (LocalAI, etc.)' }
            ],
            default: 'ollama',
            required: true,
            hint: 'API format to use'
        },
        expected_model: {
            type: 'text',
            label: 'Expected Model (Optional)',
            placeholder: 'e.g., llama3.2:latest',
            required: false,
            hint: 'Alert if this model is not loaded (leave blank to skip check)'
        },
        timeout_seconds: {
            type: 'number',
            label: 'Timeout (seconds)',
            default: 10,
            required: true,
            min: 1,
            max: 60,
            hint: 'How long to wait for response'
        },
        slow_response_threshold: {
            type: 'number',
            label: 'Slow Response Threshold (ms)',
            default: 5000,
            required: false,
            min: 100,
            max: 30000,
            hint: 'Mark as degraded if response time exceeds this value (default: 5000ms)'
        }
    },

    // Default check interval in minutes
    defaultInterval: 5,

    // Available interval options
    intervalOptions: [
        { value: 1, label: 'Every 1 minute' },
        { value: 5, label: 'Every 5 minutes' },
        { value: 10, label: 'Every 10 minutes' },
        { value: 15, label: 'Every 15 minutes' },
        { value: 30, label: 'Every 30 minutes' }
    ],

    // Validate configuration
    validate(config) {
        if (!config.host || config.host.trim() === '') {
            return 'Host is required';
        }
        if (config.port < 1 || config.port > 65535) {
            return 'Port must be between 1 and 65535';
        }
        if (config.timeout_seconds < 1 || config.timeout_seconds > 60) {
            return 'Timeout must be between 1 and 60 seconds';
        }
        return null; // Valid
    },

    // Extract configuration from form
    extractConfig(formPrefix) {
        return {
            host: document.getElementById(`${formPrefix}Host`).value.trim(),
            port: parseInt(document.getElementById(`${formPrefix}Port`).value),
            protocol: document.getElementById(`${formPrefix}Protocol`).value,
            api_type: document.getElementById(`${formPrefix}ApiType`).value,
            expected_model: document.getElementById(`${formPrefix}ExpectedModel`).value.trim(),
            timeout_seconds: parseInt(document.getElementById(`${formPrefix}TimeoutSeconds`).value),
            slow_response_threshold: parseInt(document.getElementById(`${formPrefix}SlowResponseThreshold`).value || 5000)
        };
    },

    // Populate form with existing configuration
    populateForm(formPrefix, config) {
        document.getElementById(`${formPrefix}Host`).value = config.host || 'localhost';
        document.getElementById(`${formPrefix}Port`).value = config.port || 11434;
        document.getElementById(`${formPrefix}Protocol`).value = config.protocol || 'http';
        document.getElementById(`${formPrefix}ApiType`).value = config.api_type || 'ollama';
        document.getElementById(`${formPrefix}ExpectedModel`).value = config.expected_model || '';
        document.getElementById(`${formPrefix}TimeoutSeconds`).value = config.timeout_seconds || 10;
        document.getElementById(`${formPrefix}SlowResponseThreshold`).value = config.slow_response_threshold || 5000;
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

        // Show loaded model
        if (monitor.metadata && monitor.metadata.loaded_model) {
            html += `
                <div class="monitor-metric">
                    <div class="monitor-metric-label">Loaded Model</div>
                    <div class="monitor-metric-value">${monitor.metadata.loaded_model}</div>
                </div>
            `;
        }

        // Show model count
        if (monitor.metadata && monitor.metadata.model_count !== undefined) {
            html += `
                <div class="monitor-metric">
                    <div class="monitor-metric-label">Available Models</div>
                    <div class="monitor-metric-value">${monitor.metadata.model_count} model${monitor.metadata.model_count !== 1 ? 's' : ''}</div>
                </div>
            `;
        }

        return html;
    },

    // Get description for services page
    getDescription(config) {
        if (!config) return '';
        const parts = [
            config.protocol || 'http',
            '://',
            config.host || 'localhost',
            ':',
            config.port || 11434
        ];

        if (config.expected_model) {
            parts.push(` (${config.expected_model})`);
        }

        return parts.join('');
    }
};
