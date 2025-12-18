// Metric Threshold Monitor Plugin
// This is a self-contained module that defines everything needed for the metric threshold monitor

export default {
    // Unique identifier (must match backend monitor_type)
    type: 'metric_threshold',

    // Display information
    name: 'Metric Threshold',
    description: 'Receive numbers, alert on thresholds',
    icon: 'chart',
    category: 'Operations',

    // Configuration schema - defines all fields needed for this monitor
    schema: {
        name: {
            type: 'text',
            label: 'Monitor Name',
            placeholder: 'e.g., cpu, memory, disk',
            required: true,
            hint: 'Used in the API endpoint when posting metrics.'
        },
        warning_threshold: {
            type: 'number',
            label: 'Warning Threshold',
            step: 0.1,
            required: true,
            hint: null
        },
        critical_threshold: {
            type: 'number',
            label: 'Critical Threshold',
            step: 0.1,
            required: true,
            hint: null
        },
        comparison_type: {
            type: 'select',
            label: 'Comparison Type',
            options: [
                { value: 'greater', label: 'Greater than (>)' },
                { value: 'less', label: 'Less than (<)' }
            ],
            default: 'greater',
            required: true
        }
    },

    // Passive monitor - receives data via API, doesn't actively check
    // Therefore no check interval is shown in the UI
    showInterval: false,
    defaultInterval: 5, // Still need a default for database, but not user-configurable

    // Validate configuration before submission
    // Returns error message string if invalid, null if valid
    validate(config) {
        if (!config.name || config.name.trim() === '') {
            return 'Monitor name is required';
        }
        if (config.warning_threshold === undefined || config.warning_threshold === null) {
            return 'Warning threshold is required';
        }
        if (config.critical_threshold === undefined || config.critical_threshold === null) {
            return 'Critical threshold is required';
        }
        return null; // Valid
    },

    // Extract configuration from form fields
    // formPrefix: 'metric_threshold' for Quick Monitor, 'addMetric' for Add to Service, 'editMetric' for Edit
    extractConfig(formPrefix) {
        return {
            name: document.getElementById(`${formPrefix}Name`).value,
            warning_threshold: parseFloat(document.getElementById(`${formPrefix}WarningThreshold`).value),
            critical_threshold: parseFloat(document.getElementById(`${formPrefix}CriticalThreshold`).value),
            comparison: document.getElementById(`${formPrefix}ComparisonType`).value
        };
    },

    // Populate form fields with existing configuration
    // Used when editing a monitor
    populateForm(formPrefix, config) {
        document.getElementById(`${formPrefix}Name`).value = config.name || '';
        document.getElementById(`${formPrefix}WarningThreshold`).value = config.warning_threshold;
        document.getElementById(`${formPrefix}CriticalThreshold`).value = config.critical_threshold;
        document.getElementById(`${formPrefix}ComparisonType`).value = config.comparison || 'greater';
    },

    // Custom collapsible content for API example
    renderCollapsible(formPrefix, serviceName = 'SERVICE_NAME', monitorName = null) {
        const encodedServiceName = encodeURIComponent(serviceName);
        const encodedMonitorName = monitorName ? encodeURIComponent(monitorName) : 'MONITOR_NAME';

        return `
            <div class="collapsible">
                <button type="button" class="collapsible-trigger" aria-expanded="false">
                    <svg class="collapsible-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M7 4l6 6-6 6"/>
                    </svg>
                    <span>API Example: How to send metric values</span>
                </button>
                <div class="collapsible-content">
                    <div class="collapsible-content-inner">
                        <div class="code-example">
                            <div class="code-block">curl -X POST http://localhost:5050/api/v1/metric/${encodedServiceName}/${encodedMonitorName} \\
  -H "Content-Type: application/json" \\
  -d '{
    "api_key": "YOUR_API_KEY",
    "value": 87.5
  }'</div>
                            <p class="form-hint" style="margin-top: 0.5rem;">Replace YOUR_API_KEY with your actual API key from Settings page${monitorName ? '' : '. Enter a monitor name above to see the specific endpoint'}.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // Get description text for services page
    getDescription(config) {
        if (!config) return '';
        const op = config.comparison === 'greater' ? '>' : '<';
        return `Warning ${op} ${config.warning_threshold}, Critical ${op} ${config.critical_threshold}`;
    },

    // Render custom metrics for dashboard modal
    // monitor: full monitor object with metadata
    renderDetailMetrics(monitor) {
        if (!monitor.config) return '';

        const comparison = monitor.config.comparison || 'greater';
        const operator = comparison === 'greater' ? '>' : '<';

        // Extract current value from metadata if available
        let currentValueHtml = '';
        if (monitor.metadata && monitor.metadata.value !== undefined) {
            const value = monitor.metadata.value;
            const warningThreshold = monitor.config.warning_threshold;
            const criticalThreshold = monitor.config.critical_threshold;

            // Determine color based on status
            let valueColor = 'var(--status-operational)';
            if (monitor.status === 'degraded') {
                valueColor = 'var(--status-degraded)';
            } else if (monitor.status === 'down') {
                valueColor = 'var(--status-down)';
            }

            currentValueHtml = `
            <div class="monitor-metric">
                <div class="monitor-metric-label">Current Value</div>
                <div class="monitor-metric-value" style="color: ${valueColor}; font-weight: 600;">${value}</div>
            </div>
            `;
        }

        return `
            ${currentValueHtml}
            <div class="monitor-metric">
                <div class="monitor-metric-label">Warning Threshold</div>
                <div class="monitor-metric-value">${operator} ${monitor.config.warning_threshold}</div>
            </div>
            <div class="monitor-metric">
                <div class="monitor-metric-label">Critical Threshold</div>
                <div class="monitor-metric-value">${operator} ${monitor.config.critical_threshold}</div>
            </div>
            <div class="monitor-metric">
                <div class="monitor-metric-label">Comparison Type</div>
                <div class="monitor-metric-value">${comparison === 'greater' ? 'Greater than' : 'Less than'}</div>
            </div>
        `;
    }
};
