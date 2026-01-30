// SNMP Monitor Plugin
// Monitors network devices via SNMP GET operations
// Supports SNMP v1, v2c, and v3

export default {
    // Unique identifier (must match backend monitor_type)
    type: 'snmp',

    // Display information
    name: 'SNMP',
    description: 'Query network devices via SNMP',
    icon: 'snmp',
    category: 'Infrastructure',

    // Common OID presets for quick selection
    oidPresets: {
        'sysUptime': { oid: '1.3.6.1.2.1.1.3.0', label: 'System Uptime', valueType: 'numeric' },
        'sysDescr': { oid: '1.3.6.1.2.1.1.1.0', label: 'System Description', valueType: 'string' },
        'sysName': { oid: '1.3.6.1.2.1.1.5.0', label: 'System Name', valueType: 'string' },
        'sysContact': { oid: '1.3.6.1.2.1.1.4.0', label: 'System Contact', valueType: 'string' },
        'sysLocation': { oid: '1.3.6.1.2.1.1.6.0', label: 'System Location', valueType: 'string' },
        'ifNumber': { oid: '1.3.6.1.2.1.2.1.0', label: 'Interface Count', valueType: 'numeric' },
        'custom': { oid: '', label: 'Custom OID', valueType: 'presence' }
    },

    // Configuration schema - defines all fields needed for this monitor
    schema: {
        host: {
            type: 'text',
            label: 'Host',
            placeholder: 'e.g., 192.168.1.1 or router.local',
            required: true,
            hint: 'IP address or hostname of the SNMP-enabled device'
        },
        port: {
            type: 'number',
            label: 'Port',
            default: 161,
            min: 1,
            max: 65535,
            required: true
        },
        version: {
            type: 'select',
            label: 'SNMP Version',
            options: [
                { value: 'v2c', label: 'v2c (Community String)' },
                { value: 'v1', label: 'v1 (Community String)' },
                { value: 'v3', label: 'v3 (Username/Password)' }
            ],
            default: 'v2c',
            required: true,
            hint: 'v2c is most common. Use v3 for better security.'
        },
        community: {
            type: 'text',
            label: 'Community String',
            placeholder: 'public',
            default: 'public',
            required: false,
            hint: 'For SNMP v1/v2c. Default is "public" for read-only access.',
            showWhen: { field: 'version', values: ['v1', 'v2c'] }
        },
        username: {
            type: 'text',
            label: 'Username',
            placeholder: 'snmpuser',
            required: false,
            hint: 'For SNMP v3 authentication',
            showWhen: { field: 'version', values: ['v3'] }
        },
        auth_password: {
            type: 'password',
            label: 'Auth Password',
            placeholder: 'Authentication password',
            required: false,
            hint: 'Leave empty for noAuthNoPriv',
            showWhen: { field: 'version', values: ['v3'] }
        },
        auth_protocol: {
            type: 'select',
            label: 'Auth Protocol',
            options: [
                { value: 'SHA', label: 'SHA' },
                { value: 'MD5', label: 'MD5' },
                { value: 'SHA224', label: 'SHA-224' },
                { value: 'SHA256', label: 'SHA-256' },
                { value: 'SHA384', label: 'SHA-384' },
                { value: 'SHA512', label: 'SHA-512' }
            ],
            default: 'SHA',
            required: false,
            showWhen: { field: 'version', values: ['v3'] }
        },
        priv_password: {
            type: 'password',
            label: 'Privacy Password',
            placeholder: 'Encryption password (optional)',
            required: false,
            hint: 'For encrypted communication (authPriv)',
            showWhen: { field: 'version', values: ['v3'] }
        },
        priv_protocol: {
            type: 'select',
            label: 'Privacy Protocol',
            options: [
                { value: 'AES', label: 'AES-128' },
                { value: 'AES192', label: 'AES-192' },
                { value: 'AES256', label: 'AES-256' },
                { value: 'DES', label: 'DES' }
            ],
            default: 'AES',
            required: false,
            showWhen: { field: 'version', values: ['v3'] }
        },
        oid_preset: {
            type: 'select',
            label: 'OID Preset',
            options: [
                { value: 'sysUptime', label: 'System Uptime' },
                { value: 'sysDescr', label: 'System Description' },
                { value: 'sysName', label: 'System Name' },
                { value: 'sysContact', label: 'System Contact' },
                { value: 'sysLocation', label: 'System Location' },
                { value: 'ifNumber', label: 'Interface Count' },
                { value: 'custom', label: 'Custom OID...' }
            ],
            default: 'sysUptime',
            required: false,
            hint: 'Select a common OID or enter a custom one'
        },
        oid: {
            type: 'text',
            label: 'OID',
            placeholder: '1.3.6.1.2.1.1.3.0',
            required: true,
            hint: 'Object Identifier to query (e.g., 1.3.6.1.2.1.1.3.0 for uptime)'
        },
        value_type: {
            type: 'select',
            label: 'Value Type',
            options: [
                { value: 'presence', label: 'Presence Check (any value = OK)' },
                { value: 'numeric', label: 'Numeric (compare with thresholds)' },
                { value: 'string', label: 'String (compare text values)' }
            ],
            default: 'presence',
            required: true,
            hint: 'How to evaluate the returned value'
        },
        comparison: {
            type: 'select',
            label: 'Comparison',
            options: [
                { value: 'equal', label: 'Equal to' },
                { value: 'not_equal', label: 'Not equal to' },
                { value: 'greater', label: 'Greater than' },
                { value: 'less', label: 'Less than' },
                { value: 'contains', label: 'Contains (string)' }
            ],
            default: 'greater',
            required: false,
            hint: 'For numeric: use greater/less with thresholds. For string: use equal/contains.'
        },
        expected_value: {
            type: 'text',
            label: 'Expected Value',
            placeholder: 'e.g., 1 (for ifOperStatus up)',
            required: false,
            hint: 'For exact match comparisons (equal, not_equal, contains)'
        },
        warning_threshold: {
            type: 'number',
            label: 'Warning Threshold',
            step: 0.1,
            required: false,
            hint: 'For numeric values: warn when value exceeds/falls below this'
        },
        critical_threshold: {
            type: 'number',
            label: 'Critical Threshold',
            step: 0.1,
            required: false,
            hint: 'For numeric values: critical when value exceeds/falls below this'
        },
        timeout: {
            type: 'number',
            label: 'Timeout (seconds)',
            default: 5,
            min: 1,
            max: 30,
            required: false
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
        if (!config.host || config.host.trim() === '') {
            return 'Host is required';
        }
        if (!config.oid || config.oid.trim() === '') {
            return 'OID is required';
        }
        if (config.port < 1 || config.port > 65535) {
            return 'Port must be between 1 and 65535';
        }
        if (config.version === 'v3' && !config.username) {
            return 'Username is required for SNMP v3';
        }
        // Validate thresholds if numeric comparison with thresholds
        if (config.value_type === 'numeric' && config.comparison) {
            if ((config.comparison === 'greater' || config.comparison === 'less') &&
                config.warning_threshold !== undefined && config.critical_threshold !== undefined) {
                // Thresholds configured - validate they make sense
                if (config.comparison === 'greater' && config.warning_threshold > config.critical_threshold) {
                    return 'Warning threshold should be less than critical threshold for "greater than" comparison';
                }
                if (config.comparison === 'less' && config.warning_threshold < config.critical_threshold) {
                    return 'Warning threshold should be greater than critical threshold for "less than" comparison';
                }
            }
        }
        return null; // Valid
    },

    // Extract configuration from form fields
    extractConfig(formPrefix) {
        const version = document.getElementById(`${formPrefix}Version`).value;
        const valueType = document.getElementById(`${formPrefix}ValueType`).value;

        const config = {
            host: document.getElementById(`${formPrefix}Host`).value.trim(),
            port: parseInt(document.getElementById(`${formPrefix}Port`).value) || 161,
            version: version,
            oid: document.getElementById(`${formPrefix}Oid`).value.trim(),
            value_type: valueType,
            timeout: parseInt(document.getElementById(`${formPrefix}Timeout`)?.value) || 5
        };

        // Version-specific fields
        if (version === 'v1' || version === 'v2c') {
            config.community = document.getElementById(`${formPrefix}Community`)?.value || 'public';
        } else if (version === 'v3') {
            config.username = document.getElementById(`${formPrefix}Username`)?.value || '';
            const authPassword = document.getElementById(`${formPrefix}AuthPassword`)?.value;
            if (authPassword) {
                config.auth_password = authPassword;
                config.auth_protocol = document.getElementById(`${formPrefix}AuthProtocol`)?.value || 'SHA';
            }
            const privPassword = document.getElementById(`${formPrefix}PrivPassword`)?.value;
            if (privPassword) {
                config.priv_password = privPassword;
                config.priv_protocol = document.getElementById(`${formPrefix}PrivProtocol`)?.value || 'AES';
            }
        }

        // Comparison fields
        if (valueType !== 'presence') {
            config.comparison = document.getElementById(`${formPrefix}Comparison`)?.value || 'equal';
            const expectedValue = document.getElementById(`${formPrefix}ExpectedValue`)?.value;
            if (expectedValue) {
                config.expected_value = expectedValue;
            }
        }

        // Threshold fields for numeric
        if (valueType === 'numeric') {
            const warningThreshold = document.getElementById(`${formPrefix}WarningThreshold`)?.value;
            const criticalThreshold = document.getElementById(`${formPrefix}CriticalThreshold`)?.value;
            if (warningThreshold !== '' && warningThreshold !== undefined) {
                config.warning_threshold = parseFloat(warningThreshold);
            }
            if (criticalThreshold !== '' && criticalThreshold !== undefined) {
                config.critical_threshold = parseFloat(criticalThreshold);
            }
        }

        return config;
    },

    // Populate form fields with existing configuration
    populateForm(formPrefix, config) {
        document.getElementById(`${formPrefix}Host`).value = config.host || '';
        document.getElementById(`${formPrefix}Port`).value = config.port || 161;
        document.getElementById(`${formPrefix}Version`).value = config.version || 'v2c';
        document.getElementById(`${formPrefix}Oid`).value = config.oid || '';
        document.getElementById(`${formPrefix}ValueType`).value = config.value_type || 'presence';

        // Version-specific fields
        const communityField = document.getElementById(`${formPrefix}Community`);
        if (communityField) communityField.value = config.community || 'public';

        const usernameField = document.getElementById(`${formPrefix}Username`);
        if (usernameField) usernameField.value = config.username || '';

        const authPasswordField = document.getElementById(`${formPrefix}AuthPassword`);
        if (authPasswordField) authPasswordField.value = config.auth_password || '';

        const authProtocolField = document.getElementById(`${formPrefix}AuthProtocol`);
        if (authProtocolField) authProtocolField.value = config.auth_protocol || 'SHA';

        const privPasswordField = document.getElementById(`${formPrefix}PrivPassword`);
        if (privPasswordField) privPasswordField.value = config.priv_password || '';

        const privProtocolField = document.getElementById(`${formPrefix}PrivProtocol`);
        if (privProtocolField) privProtocolField.value = config.priv_protocol || 'AES';

        // Comparison fields
        const comparisonField = document.getElementById(`${formPrefix}Comparison`);
        if (comparisonField) comparisonField.value = config.comparison || 'greater';

        const expectedValueField = document.getElementById(`${formPrefix}ExpectedValue`);
        if (expectedValueField) expectedValueField.value = config.expected_value || '';

        const warningThresholdField = document.getElementById(`${formPrefix}WarningThreshold`);
        if (warningThresholdField) warningThresholdField.value = config.warning_threshold ?? '';

        const criticalThresholdField = document.getElementById(`${formPrefix}CriticalThreshold`);
        if (criticalThresholdField) criticalThresholdField.value = config.critical_threshold ?? '';

        const timeoutField = document.getElementById(`${formPrefix}Timeout`);
        if (timeoutField) timeoutField.value = config.timeout || 5;

        // Trigger conditional field visibility
        this.updateConditionalFields(formPrefix);
    },

    // Update visibility of conditional fields based on current selections
    updateConditionalFields(formPrefix) {
        const version = document.getElementById(`${formPrefix}Version`)?.value;
        const valueType = document.getElementById(`${formPrefix}ValueType`)?.value;

        // Show/hide version-specific auth fields
        const v2cFields = document.querySelectorAll(`[data-snmp-version="v1v2c"]`);
        const v3Fields = document.querySelectorAll(`[data-snmp-version="v3"]`);

        v2cFields.forEach(el => {
            el.style.display = (version === 'v1' || version === 'v2c') ? '' : 'none';
        });
        v3Fields.forEach(el => {
            el.style.display = version === 'v3' ? '' : 'none';
        });

        // Show/hide comparison fields based on value type
        const comparisonFields = document.querySelectorAll(`[data-snmp-comparison]`);
        const thresholdFields = document.querySelectorAll(`[data-snmp-threshold]`);

        comparisonFields.forEach(el => {
            el.style.display = valueType !== 'presence' ? '' : 'none';
        });
        thresholdFields.forEach(el => {
            el.style.display = valueType === 'numeric' ? '' : 'none';
        });
    },

    // Render custom status display
    renderStatus(monitor) {
        if (monitor.response_time_ms) {
            return `${monitor.response_time_ms}ms`;
        }
        return null;
    },

    // Get description text for services page
    getDescription(config) {
        if (!config) return '';
        const version = config.version || 'v2c';
        return `${config.host}:${config.port || 161} (${version}) - ${config.oid}`;
    },

    // Render custom metrics for dashboard modal
    renderDetailMetrics(monitor) {
        if (!monitor.config) return '';

        let metricsHtml = '';

        // Show current value if available
        if (monitor.metadata && monitor.metadata.value !== undefined) {
            let valueColor = 'var(--status-operational)';
            if (monitor.status === 'degraded') {
                valueColor = 'var(--status-degraded)';
            } else if (monitor.status === 'down') {
                valueColor = 'var(--status-down)';
            }

            metricsHtml += `
                <div class="monitor-metric">
                    <div class="monitor-metric-label">Current Value</div>
                    <div class="monitor-metric-value" style="color: ${valueColor}; font-weight: 600;">${monitor.metadata.value}</div>
                </div>
            `;
        }

        // Show OID
        metricsHtml += `
            <div class="monitor-metric">
                <div class="monitor-metric-label">OID</div>
                <div class="monitor-metric-value" style="font-family: monospace; font-size: 0.85em;">${monitor.config.oid}</div>
            </div>
        `;

        // Show version
        metricsHtml += `
            <div class="monitor-metric">
                <div class="monitor-metric-label">SNMP Version</div>
                <div class="monitor-metric-value">${monitor.config.version || 'v2c'}</div>
            </div>
        `;

        // Show thresholds if configured
        if (monitor.config.value_type === 'numeric' &&
            monitor.config.warning_threshold !== undefined &&
            monitor.config.critical_threshold !== undefined) {
            const op = monitor.config.comparison === 'less' ? '<' : '>';
            metricsHtml += `
                <div class="monitor-metric">
                    <div class="monitor-metric-label">Warning Threshold</div>
                    <div class="monitor-metric-value">${op} ${monitor.config.warning_threshold}</div>
                </div>
                <div class="monitor-metric">
                    <div class="monitor-metric-label">Critical Threshold</div>
                    <div class="monitor-metric-value">${op} ${monitor.config.critical_threshold}</div>
                </div>
            `;
        }

        return metricsHtml;
    },

    // Custom collapsible content for OID presets reference
    renderCollapsible(formPrefix, serviceName = 'SERVICE_NAME', monitorName = null) {
        return `
            <div class="collapsible">
                <button type="button" class="collapsible-trigger" aria-expanded="false">
                    <svg class="collapsible-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M7 4l6 6-6 6"/>
                    </svg>
                    <span>Common OIDs Reference</span>
                </button>
                <div class="collapsible-content">
                    <div class="collapsible-content-inner">
                        <div class="code-example">
                            <table style="width: 100%; font-size: 0.85em; border-collapse: collapse;">
                                <tr style="border-bottom: 1px solid var(--border);">
                                    <td style="padding: 0.5rem; font-weight: 600;">System Uptime</td>
                                    <td style="padding: 0.5rem; font-family: monospace;">1.3.6.1.2.1.1.3.0</td>
                                </tr>
                                <tr style="border-bottom: 1px solid var(--border);">
                                    <td style="padding: 0.5rem; font-weight: 600;">System Description</td>
                                    <td style="padding: 0.5rem; font-family: monospace;">1.3.6.1.2.1.1.1.0</td>
                                </tr>
                                <tr style="border-bottom: 1px solid var(--border);">
                                    <td style="padding: 0.5rem; font-weight: 600;">System Name</td>
                                    <td style="padding: 0.5rem; font-family: monospace;">1.3.6.1.2.1.1.5.0</td>
                                </tr>
                                <tr style="border-bottom: 1px solid var(--border);">
                                    <td style="padding: 0.5rem; font-weight: 600;">Interface Count</td>
                                    <td style="padding: 0.5rem; font-family: monospace;">1.3.6.1.2.1.2.1.0</td>
                                </tr>
                                <tr style="border-bottom: 1px solid var(--border);">
                                    <td style="padding: 0.5rem; font-weight: 600;">Interface Status</td>
                                    <td style="padding: 0.5rem; font-family: monospace;">1.3.6.1.2.1.2.2.1.8.{index}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid var(--border);">
                                    <td style="padding: 0.5rem; font-weight: 600;">CPU Load (Cisco)</td>
                                    <td style="padding: 0.5rem; font-family: monospace;">1.3.6.1.4.1.9.2.1.57.0</td>
                                </tr>
                                <tr>
                                    <td style="padding: 0.5rem; font-weight: 600;">Memory Used (UCD)</td>
                                    <td style="padding: 0.5rem; font-family: monospace;">1.3.6.1.4.1.2021.4.6.0</td>
                                </tr>
                            </table>
                            <p class="form-hint" style="margin-top: 0.75rem;">
                                Interface Status values: 1=up, 2=down, 3=testing<br>
                                Replace {index} with the interface number (usually starts at 1)
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
};
