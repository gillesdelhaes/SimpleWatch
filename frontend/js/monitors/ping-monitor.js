// Ping/ICMP Monitor Plugin
// Monitors host reachability, latency, and packet loss via ICMP ping

export default {
    // Unique identifier (must match backend monitor_type)
    type: 'ping',

    // Display information
    name: 'Ping Monitor',
    description: 'Check host reachability and latency via ICMP ping',
    icon: 'zap', // Lightning bolt for quick network check

    // Configuration schema - defines all fields needed for this monitor
    schema: {
        host: {
            type: 'text',
            label: 'Host',
            placeholder: '8.8.8.8 or example.com',
            required: true,
            hint: 'Hostname or IP address to ping'
        },
        count: {
            type: 'number',
            label: 'Packet Count',
            default: 4,
            required: true,
            min: 1,
            max: 10,
            hint: 'Number of ICMP packets to send (1-10)'
        },
        timeout_seconds: {
            type: 'number',
            label: 'Timeout (seconds)',
            default: 5,
            required: true,
            min: 1,
            max: 30
        },
        latency_threshold_ms: {
            type: 'number',
            label: 'Latency Threshold (ms)',
            default: 200,
            required: true,
            min: 10,
            max: 5000,
            hint: 'Degraded if average latency exceeds this value'
        },
        packet_loss_threshold_percent: {
            type: 'number',
            label: 'Packet Loss Threshold (%)',
            default: 20,
            required: true,
            min: 0,
            max: 100,
            hint: 'Degraded if packet loss exceeds this percentage'
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

        if (config.count < 1 || config.count > 10) {
            return 'Packet count must be between 1 and 10';
        }

        if (config.timeout_seconds < 1 || config.timeout_seconds > 30) {
            return 'Timeout must be between 1 and 30 seconds';
        }

        if (config.latency_threshold_ms < 10 || config.latency_threshold_ms > 5000) {
            return 'Latency threshold must be between 10 and 5000 ms';
        }

        if (config.packet_loss_threshold_percent < 0 || config.packet_loss_threshold_percent > 100) {
            return 'Packet loss threshold must be between 0 and 100%';
        }

        return null; // Valid
    },

    // Extract configuration from form fields
    // formPrefix: 'ping' for Quick Monitor, 'addPing' for Add to Service, 'editPing' for Edit
    extractConfig(formPrefix) {
        return {
            host: document.getElementById(`${formPrefix}Host`).value.trim(),
            count: parseInt(document.getElementById(`${formPrefix}Count`).value),
            timeout_seconds: parseInt(document.getElementById(`${formPrefix}TimeoutSeconds`).value),
            latency_threshold_ms: parseInt(document.getElementById(`${formPrefix}LatencyThresholdMs`).value),
            packet_loss_threshold_percent: parseInt(document.getElementById(`${formPrefix}PacketLossThresholdPercent`).value)
        };
    },

    // Populate form fields with existing configuration
    // Used when editing a monitor
    populateForm(formPrefix, config) {
        document.getElementById(`${formPrefix}Host`).value = config.host || '';
        document.getElementById(`${formPrefix}Count`).value = config.count || 4;
        document.getElementById(`${formPrefix}TimeoutSeconds`).value = config.timeout_seconds || 5;
        document.getElementById(`${formPrefix}LatencyThresholdMs`).value = config.latency_threshold_ms || 200;
        document.getElementById(`${formPrefix}PacketLossThresholdPercent`).value = config.packet_loss_threshold_percent || 20;
    },

    // Optional: Custom rendering logic for monitor status display
    // This is used on the dashboard or services page
    renderStatus(monitor) {
        // Show latency and packet loss if available
        if (monitor.metadata) {
            const parts = [];

            if (monitor.metadata.avg_rtt_ms !== null && monitor.metadata.avg_rtt_ms !== undefined) {
                parts.push(`${monitor.metadata.avg_rtt_ms.toFixed(1)}ms`);
            }

            if (monitor.metadata.packet_loss_percent !== null && monitor.metadata.packet_loss_percent !== undefined) {
                parts.push(`${monitor.metadata.packet_loss_percent.toFixed(0)}% loss`);
            }

            if (parts.length > 0) {
                return parts.join(', ');
            }
        }

        // Fallback to response time if available
        if (monitor.response_time_ms) {
            return `${monitor.response_time_ms}ms`;
        }

        return null;
    },

    // Get description text for services page
    // config: monitor configuration object
    getDescription(config) {
        if (!config) return '';

        const parts = [`${config.host}`];

        if (config.latency_threshold_ms) {
            parts.push(`RTT < ${config.latency_threshold_ms}ms`);
        }

        if (config.packet_loss_threshold_percent !== undefined && config.packet_loss_threshold_percent !== null) {
            parts.push(`Loss < ${config.packet_loss_threshold_percent}%`);
        }

        return parts.join(', ');
    },

    // Render custom metrics for dashboard modal
    // monitor: full monitor object with metadata
    renderDetailMetrics(monitor) {
        if (!monitor.metadata) return '';

        return `
            <div class="monitor-metric">
                <div class="monitor-metric-label">Host</div>
                <div class="monitor-metric-value">${monitor.metadata.host || 'N/A'}</div>
            </div>
            ${monitor.metadata.packets_sent !== undefined ? `
            <div class="monitor-metric">
                <div class="monitor-metric-label">Packets</div>
                <div class="monitor-metric-value">${monitor.metadata.packets_received || 0} / ${monitor.metadata.packets_sent || 0} received</div>
            </div>
            ` : ''}
            ${monitor.metadata.packet_loss_percent !== undefined ? `
            <div class="monitor-metric">
                <div class="monitor-metric-label">Packet Loss</div>
                <div class="monitor-metric-value">${monitor.metadata.packet_loss_percent}%</div>
            </div>
            ` : ''}
            ${monitor.metadata.avg_rtt_ms !== undefined && monitor.metadata.avg_rtt_ms !== null ? `
            <div class="monitor-metric">
                <div class="monitor-metric-label">Average RTT</div>
                <div class="monitor-metric-value">${monitor.metadata.avg_rtt_ms}ms</div>
            </div>
            ` : ''}
            ${monitor.metadata.min_rtt_ms !== undefined && monitor.metadata.min_rtt_ms !== null ? `
            <div class="monitor-metric">
                <div class="monitor-metric-label">Min RTT</div>
                <div class="monitor-metric-value">${monitor.metadata.min_rtt_ms}ms</div>
            </div>
            ` : ''}
            ${monitor.metadata.max_rtt_ms !== undefined && monitor.metadata.max_rtt_ms !== null ? `
            <div class="monitor-metric">
                <div class="monitor-metric-label">Max RTT</div>
                <div class="monitor-metric-value">${monitor.metadata.max_rtt_ms}ms</div>
            </div>
            ` : ''}
            ${monitor.config?.latency_threshold_ms ? `
            <div class="monitor-metric">
                <div class="monitor-metric-label">Latency Threshold</div>
                <div class="monitor-metric-value">${monitor.config.latency_threshold_ms}ms</div>
            </div>
            ` : ''}
            ${monitor.config?.packet_loss_threshold_percent !== undefined ? `
            <div class="monitor-metric">
                <div class="monitor-metric-label">Packet Loss Threshold</div>
                <div class="monitor-metric-value">${monitor.config.packet_loss_threshold_percent}%</div>
            </div>
            ` : ''}
        `;
    }
};
