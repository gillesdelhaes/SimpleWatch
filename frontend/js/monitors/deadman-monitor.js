// Deadman Monitor Plugin
// This is a self-contained module that defines everything needed for the deadman monitor

export default {
    // Unique identifier (must match backend monitor_type)
    type: 'deadman',

    // Display information
    name: 'Deadman Monitor',
    description: 'Alert if no heartbeat received',
    icon: 'skull',

    // Configuration schema - defines all fields needed for this monitor
    schema: {
        name: {
            type: 'text',
            label: 'Monitor Name',
            placeholder: 'e.g., backup, cron-job',
            required: true,
            hint: 'Used in the API endpoint when sending heartbeats.'
        },
        expected_interval_hours: {
            type: 'number',
            label: 'Expected Interval (hours)',
            step: 0.1,
            default: 24,
            required: true,
            min: 0.1,
            hint: null
        },
        grace_period_hours: {
            type: 'number',
            label: 'Grace Period (hours)',
            step: 0.1,
            default: 1,
            required: true,
            min: 0,
            hint: null
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
        if (!config.name || config.name.trim() === '') {
            return 'Monitor name is required';
        }
        if (config.expected_interval_hours <= 0) {
            return 'Expected interval must be greater than 0';
        }
        if (config.grace_period_hours < 0) {
            return 'Grace period cannot be negative';
        }
        return null; // Valid
    },

    // Extract configuration from form fields
    // formPrefix: 'deadman' for Quick Monitor, 'addDeadman' for Add to Service, 'editDeadman' for Edit
    extractConfig(formPrefix) {
        return {
            name: document.getElementById(`${formPrefix}Name`).value,
            expected_interval_hours: parseFloat(document.getElementById(`${formPrefix}ExpectedIntervalHours`).value),
            grace_period_hours: parseFloat(document.getElementById(`${formPrefix}GracePeriodHours`).value)
        };
    },

    // Populate form fields with existing configuration
    // Used when editing a monitor
    populateForm(formPrefix, config) {
        document.getElementById(`${formPrefix}Name`).value = config.name || '';
        document.getElementById(`${formPrefix}ExpectedIntervalHours`).value = config.expected_interval_hours;
        document.getElementById(`${formPrefix}GracePeriodHours`).value = config.grace_period_hours;
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
                    <span>API Example: How to send heartbeats</span>
                </button>
                <div class="collapsible-content">
                    <div class="collapsible-content-inner">
                        <div class="code-example">
                            <div class="code-block">curl -X POST http://localhost:5050/api/v1/heartbeat/${encodedServiceName}/${encodedMonitorName} \\
  -H "Content-Type: application/json" \\
  -d '{
    "api_key": "YOUR_API_KEY"
  }'</div>
                            <p class="form-hint" style="margin-top: 0.5rem;">Replace YOUR_API_KEY with your actual API key from Settings page${monitorName ? '' : '. Enter a monitor name above to see the specific endpoint'}.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
};
