// SNMP Monitor Plugin
// Monitors network devices via SNMP GET operations
// Supports SNMP v1, v2c, and v3 with categorized OID presets

// ─── OID Presets ────────────────────────────────────────────────────────────
// Each preset auto-fills: oid, value_type, comparison, expected_value,
// warning_threshold, critical_threshold, and a human-readable hint.
const SNMP_PRESETS = {
    // ── System ──────────────────────────────────────────────────────────
    sysUptime: {
        label: 'System Uptime',
        group: 'System',
        oid: '1.3.6.1.2.1.1.3.0',
        value_type: 'presence',
        hint: 'Timeticks since last reboot. Any response means the device is reachable.'
    },
    sysDescr: {
        label: 'System Description / OS',
        group: 'System',
        oid: '1.3.6.1.2.1.1.1.0',
        value_type: 'string',
        comparison: 'contains',
        expected_value: 'Linux',
        hint: 'Returns OS and kernel info. Use "contains" to match OS name (e.g. Linux, Cisco IOS, Windows).'
    },
    sysName: {
        label: 'System Hostname',
        group: 'System',
        oid: '1.3.6.1.2.1.1.5.0',
        value_type: 'string',
        comparison: 'equal',
        expected_value: '',
        hint: 'Device hostname. Set expected value to verify it hasn\'t changed.'
    },
    sysContact: {
        label: 'System Contact',
        group: 'System',
        oid: '1.3.6.1.2.1.1.4.0',
        value_type: 'presence',
        hint: 'Administrative contact configured on the device.'
    },
    sysLocation: {
        label: 'System Location',
        group: 'System',
        oid: '1.3.6.1.2.1.1.6.0',
        value_type: 'presence',
        hint: 'Physical location configured on the device.'
    },

    // ── CPU & Memory (NET-SNMP / UCD-SNMP — Linux servers) ──────────────
    cpuUser: {
        label: 'CPU User %',
        group: 'CPU & Memory',
        oid: '1.3.6.1.4.1.2021.11.9.0',
        value_type: 'numeric',
        comparison: 'greater',
        warning_threshold: 80,
        critical_threshold: 95,
        hint: 'User-space CPU usage (NET-SNMP / UCD-SNMP agent on Linux).'
    },
    cpuSystem: {
        label: 'CPU System %',
        group: 'CPU & Memory',
        oid: '1.3.6.1.4.1.2021.11.10.0',
        value_type: 'numeric',
        comparison: 'greater',
        warning_threshold: 60,
        critical_threshold: 85,
        hint: 'Kernel-space CPU usage (NET-SNMP / UCD-SNMP agent on Linux).'
    },
    cpuIdle: {
        label: 'CPU Idle %',
        group: 'CPU & Memory',
        oid: '1.3.6.1.4.1.2021.11.11.0',
        value_type: 'numeric',
        comparison: 'less',
        warning_threshold: 20,
        critical_threshold: 5,
        hint: 'CPU idle percentage. Alert when idle drops too low (NET-SNMP).'
    },
    memTotalReal: {
        label: 'Total RAM (kB)',
        group: 'CPU & Memory',
        oid: '1.3.6.1.4.1.2021.4.5.0',
        value_type: 'presence',
        hint: 'Total physical memory in kB (NET-SNMP). Useful as a baseline reference.'
    },
    memAvailReal: {
        label: 'Available RAM (kB)',
        group: 'CPU & Memory',
        oid: '1.3.6.1.4.1.2021.4.6.0',
        value_type: 'numeric',
        comparison: 'less',
        warning_threshold: 524288,
        critical_threshold: 131072,
        hint: 'Available physical memory in kB (NET-SNMP). Defaults: warn < 512MB, critical < 128MB.'
    },
    memBuffer: {
        label: 'Memory Buffers (kB)',
        group: 'CPU & Memory',
        oid: '1.3.6.1.4.1.2021.4.14.0',
        value_type: 'presence',
        hint: 'Memory used for buffers in kB (NET-SNMP).'
    },
    memCached: {
        label: 'Memory Cached (kB)',
        group: 'CPU & Memory',
        oid: '1.3.6.1.4.1.2021.4.15.0',
        value_type: 'presence',
        hint: 'Memory used for cache in kB (NET-SNMP).'
    },
    swapAvail: {
        label: 'Swap Available (kB)',
        group: 'CPU & Memory',
        oid: '1.3.6.1.4.1.2021.4.4.0',
        value_type: 'numeric',
        comparison: 'less',
        warning_threshold: 524288,
        critical_threshold: 131072,
        hint: 'Available swap space in kB (NET-SNMP). Defaults: warn < 512MB, critical < 128MB.'
    },
    loadAvg1: {
        label: 'Load Average (1 min)',
        group: 'CPU & Memory',
        oid: '1.3.6.1.4.1.2021.10.1.3.1',
        value_type: 'numeric',
        comparison: 'greater',
        warning_threshold: 4,
        critical_threshold: 8,
        hint: '1-minute load average as string (NET-SNMP). Adjust thresholds to your CPU count.'
    },
    loadAvg5: {
        label: 'Load Average (5 min)',
        group: 'CPU & Memory',
        oid: '1.3.6.1.4.1.2021.10.1.3.2',
        value_type: 'numeric',
        comparison: 'greater',
        warning_threshold: 4,
        critical_threshold: 8,
        hint: '5-minute load average (NET-SNMP). Adjust thresholds to your CPU count.'
    },

    // ── Network Interfaces ──────────────────────────────────────────────
    ifNumber: {
        label: 'Interface Count',
        group: 'Network Interfaces',
        oid: '1.3.6.1.2.1.2.1.0',
        value_type: 'numeric',
        comparison: 'equal',
        expected_value: '',
        hint: 'Total number of network interfaces. Set expected value to detect changes.'
    },
    ifOperStatus: {
        label: 'Interface Status',
        group: 'Network Interfaces',
        oid: '1.3.6.1.2.1.2.2.1.8.1',
        value_type: 'numeric',
        comparison: 'equal',
        expected_value: '1',
        hint: 'Operational status: 1=up, 2=down, 3=testing. Change last digit for interface index.'
    },
    ifAdminStatus: {
        label: 'Interface Admin Status',
        group: 'Network Interfaces',
        oid: '1.3.6.1.2.1.2.2.1.7.1',
        value_type: 'numeric',
        comparison: 'equal',
        expected_value: '1',
        hint: 'Admin status: 1=up, 2=down, 3=testing. Change last digit for interface index.'
    },
    ifInOctets: {
        label: 'Interface Bytes In',
        group: 'Network Interfaces',
        oid: '1.3.6.1.2.1.2.2.1.10.1',
        value_type: 'presence',
        hint: 'Total bytes received on interface (32-bit counter). Change last digit for interface index.'
    },
    ifOutOctets: {
        label: 'Interface Bytes Out',
        group: 'Network Interfaces',
        oid: '1.3.6.1.2.1.2.2.1.16.1',
        value_type: 'presence',
        hint: 'Total bytes sent on interface (32-bit counter). Change last digit for interface index.'
    },
    ifHCInOctets: {
        label: 'Interface Bytes In (64-bit)',
        group: 'Network Interfaces',
        oid: '1.3.6.1.2.1.31.1.1.1.6.1',
        value_type: 'presence',
        hint: '64-bit bytes received counter (IF-MIB). Use for high-speed interfaces. Change last digit for index.'
    },
    ifHCOutOctets: {
        label: 'Interface Bytes Out (64-bit)',
        group: 'Network Interfaces',
        oid: '1.3.6.1.2.1.31.1.1.1.10.1',
        value_type: 'presence',
        hint: '64-bit bytes sent counter (IF-MIB). Use for high-speed interfaces. Change last digit for index.'
    },
    ifInErrors: {
        label: 'Interface Input Errors',
        group: 'Network Interfaces',
        oid: '1.3.6.1.2.1.2.2.1.14.1',
        value_type: 'numeric',
        comparison: 'greater',
        warning_threshold: 10,
        critical_threshold: 100,
        hint: 'Input errors on interface. Non-zero usually indicates a problem. Change last digit for index.'
    },
    ifOutErrors: {
        label: 'Interface Output Errors',
        group: 'Network Interfaces',
        oid: '1.3.6.1.2.1.2.2.1.20.1',
        value_type: 'numeric',
        comparison: 'greater',
        warning_threshold: 10,
        critical_threshold: 100,
        hint: 'Output errors on interface. Non-zero usually indicates a problem. Change last digit for index.'
    },
    ifInDiscards: {
        label: 'Interface Input Discards',
        group: 'Network Interfaces',
        oid: '1.3.6.1.2.1.2.2.1.13.1',
        value_type: 'numeric',
        comparison: 'greater',
        warning_threshold: 50,
        critical_threshold: 500,
        hint: 'Discarded inbound packets (buffer overflow, QoS). Change last digit for index.'
    },
    ifSpeed: {
        label: 'Interface Speed (bps)',
        group: 'Network Interfaces',
        oid: '1.3.6.1.2.1.2.2.1.5.1',
        value_type: 'presence',
        hint: 'Interface speed in bits per second. Change last digit for interface index.'
    },

    // ── Routing ─────────────────────────────────────────────────────────
    bgpPeerState: {
        label: 'BGP Peer State',
        group: 'Routing',
        oid: '1.3.6.1.2.1.15.3.1.2.0.0.0.0',
        value_type: 'numeric',
        comparison: 'equal',
        expected_value: '6',
        hint: 'BGP4-MIB peer state. Replace 0.0.0.0 with peer IP. States: 1=idle, 2=connect, 3=active, 4=openSent, 5=openConfirm, 6=established.'
    },
    bgpPeerAdminStatus: {
        label: 'BGP Peer Admin Status',
        group: 'Routing',
        oid: '1.3.6.1.2.1.15.3.1.3.0.0.0.0',
        value_type: 'numeric',
        comparison: 'equal',
        expected_value: '2',
        hint: 'BGP peer admin status. Replace 0.0.0.0 with peer IP. 1=stop, 2=start.'
    },
    bgpPeerRecvPrefixes: {
        label: 'BGP Received Prefixes',
        group: 'Routing',
        oid: '1.3.6.1.4.1.9.9.187.1.2.4.1.1.0.0.0.0',
        value_type: 'numeric',
        comparison: 'less',
        warning_threshold: 10,
        critical_threshold: 1,
        hint: 'Cisco BGP4 received prefixes. Replace 0.0.0.0 with peer IP. Alert if prefix count drops.'
    },
    ospfNbrState: {
        label: 'OSPF Neighbor State',
        group: 'Routing',
        oid: '1.3.6.1.2.1.14.10.1.6.0.0.0.0.0',
        value_type: 'numeric',
        comparison: 'equal',
        expected_value: '8',
        hint: 'OSPF-MIB neighbor state. Replace with neighbor IP + interface index. States: 1=down ... 8=full.'
    },
    ipForwarding: {
        label: 'IP Forwarding Enabled',
        group: 'Routing',
        oid: '1.3.6.1.2.1.4.1.0',
        value_type: 'numeric',
        comparison: 'equal',
        expected_value: '1',
        hint: 'IP forwarding status: 1=forwarding (router), 2=not-forwarding (host).'
    },

    // ── Cisco Devices ───────────────────────────────────────────────────
    ciscoCpu5min: {
        label: 'Cisco CPU (5 min avg)',
        group: 'Cisco',
        oid: '1.3.6.1.4.1.9.2.1.58.0',
        value_type: 'numeric',
        comparison: 'greater',
        warning_threshold: 75,
        critical_threshold: 90,
        hint: 'Cisco OLD-CISCO-CPU-MIB 5-minute CPU average percentage.'
    },
    ciscoCpu1min: {
        label: 'Cisco CPU (1 min avg)',
        group: 'Cisco',
        oid: '1.3.6.1.4.1.9.2.1.57.0',
        value_type: 'numeric',
        comparison: 'greater',
        warning_threshold: 80,
        critical_threshold: 95,
        hint: 'Cisco OLD-CISCO-CPU-MIB 1-minute CPU average percentage.'
    },
    ciscoMemPoolUsed: {
        label: 'Cisco Memory Used (bytes)',
        group: 'Cisco',
        oid: '1.3.6.1.4.1.9.9.48.1.1.1.5.1',
        value_type: 'presence',
        hint: 'Cisco MEMORY-POOL-MIB processor memory used (index 1 = Processor).'
    },
    ciscoMemPoolFree: {
        label: 'Cisco Memory Free (bytes)',
        group: 'Cisco',
        oid: '1.3.6.1.4.1.9.9.48.1.1.1.6.1',
        value_type: 'numeric',
        comparison: 'less',
        warning_threshold: 50000000,
        critical_threshold: 10000000,
        hint: 'Cisco MEMORY-POOL-MIB processor memory free. Defaults: warn < 50MB, critical < 10MB.'
    },
    ciscoEnvTemp: {
        label: 'Cisco Temperature (C)',
        group: 'Cisco',
        oid: '1.3.6.1.4.1.9.9.13.1.3.1.3.1',
        value_type: 'numeric',
        comparison: 'greater',
        warning_threshold: 55,
        critical_threshold: 70,
        hint: 'Cisco ENVMON temperature sensor value in Celsius (sensor index 1).'
    },
    ciscoEnvFanState: {
        label: 'Cisco Fan State',
        group: 'Cisco',
        oid: '1.3.6.1.4.1.9.9.13.1.4.1.3.1',
        value_type: 'numeric',
        comparison: 'equal',
        expected_value: '1',
        hint: 'Cisco fan status: 1=normal, 2=warning, 3=critical, 4=shutdown, 5=notPresent.'
    },

    // ── Storage (HOST-RESOURCES-MIB) ────────────────────────────────────
    hrStorageUsed: {
        label: 'Storage Used (blocks)',
        group: 'Storage',
        oid: '1.3.6.1.2.1.25.2.3.1.6.1',
        value_type: 'presence',
        hint: 'HOST-RESOURCES-MIB storage used in allocation units. Index varies by mount point; walk hrStorage to find it.'
    },
    hrStorageSize: {
        label: 'Storage Size (blocks)',
        group: 'Storage',
        oid: '1.3.6.1.2.1.25.2.3.1.5.1',
        value_type: 'presence',
        hint: 'HOST-RESOURCES-MIB storage total size. Index varies by mount point.'
    },
    hrProcessorLoad: {
        label: 'Processor Load %',
        group: 'Storage',
        oid: '1.3.6.1.2.1.25.3.3.1.2.1',
        value_type: 'numeric',
        comparison: 'greater',
        warning_threshold: 80,
        critical_threshold: 95,
        hint: 'HOST-RESOURCES-MIB CPU load percentage (per CPU, index 1). Works on most SNMP agents.'
    },
    hrNumProcesses: {
        label: 'Number of Processes',
        group: 'Storage',
        oid: '1.3.6.1.2.1.25.1.6.0',
        value_type: 'numeric',
        comparison: 'greater',
        warning_threshold: 300,
        critical_threshold: 500,
        hint: 'Total number of running processes. High counts may indicate fork bombs or runaway processes.'
    },

    // ── TCP / UDP / IP Statistics ───────────────────────────────────────
    tcpCurrEstab: {
        label: 'TCP Connections (established)',
        group: 'TCP/IP',
        oid: '1.3.6.1.2.1.6.9.0',
        value_type: 'numeric',
        comparison: 'greater',
        warning_threshold: 500,
        critical_threshold: 1000,
        hint: 'Number of currently established TCP connections. High values may indicate connection leaks.'
    },
    tcpInErrs: {
        label: 'TCP Input Errors',
        group: 'TCP/IP',
        oid: '1.3.6.1.2.1.6.14.0',
        value_type: 'presence',
        hint: 'Total TCP segments received in error (counter).'
    },
    udpInErrors: {
        label: 'UDP Input Errors',
        group: 'TCP/IP',
        oid: '1.3.6.1.2.1.7.3.0',
        value_type: 'presence',
        hint: 'UDP datagrams that could not be delivered (counter).'
    },
    ipInDiscards: {
        label: 'IP Input Discards',
        group: 'TCP/IP',
        oid: '1.3.6.1.2.1.4.8.0',
        value_type: 'presence',
        hint: 'IP datagrams discarded due to resource issues (counter).'
    },

    // ── Custom ──────────────────────────────────────────────────────────
    custom: {
        label: 'Custom OID...',
        group: 'Custom',
        oid: '',
        value_type: 'presence',
        hint: 'Enter any OID manually.'
    }
};

// Build grouped options for the preset <select>
function buildPresetOptions() {
    const groups = {};
    for (const [key, preset] of Object.entries(SNMP_PRESETS)) {
        const group = preset.group || 'Other';
        if (!groups[group]) groups[group] = [];
        groups[group].push({ key, label: preset.label });
    }

    let html = '';
    for (const [groupName, items] of Object.entries(groups)) {
        html += `<optgroup label="${groupName}">`;
        for (const item of items) {
            html += `<option value="${item.key}">${item.label}</option>`;
        }
        html += `</optgroup>`;
    }
    return html;
}

// ─── Plugin Export ──────────────────────────────────────────────────────────

export default {
    // Unique identifier (must match backend monitor_type)
    type: 'snmp',

    // Display information
    name: 'SNMP',
    description: 'Query network devices via SNMP',
    icon: 'snmp',
    category: 'Infrastructure',

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
            type: 'raw_html',
            html: () => `
                <div class="form-group">
                    <label class="form-label">OID Preset</label>
                    <select id="__PREFIX__OidPreset" class="form-input">
                        ${buildPresetOptions()}
                    </select>
                    <p class="form-hint" id="__PREFIX__PresetHint">Select a preset to auto-fill the OID and evaluation settings.</p>
                </div>
            `
        },
        oid: {
            type: 'text',
            label: 'OID',
            placeholder: '1.3.6.1.2.1.1.3.0',
            required: true,
            hint: 'Object Identifier to query. Select a preset above or enter manually.'
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

    // ── Post-render hook: wire up the preset dropdown ───────────────────
    onFormRendered(formPrefix) {
        const presetSelect = document.getElementById(`${formPrefix}OidPreset`);
        if (!presetSelect) return;

        const applyPreset = () => {
            const key = presetSelect.value;
            const preset = SNMP_PRESETS[key];
            if (!preset) return;

            // Auto-fill OID
            const oidField = document.getElementById(`${formPrefix}Oid`);
            if (oidField) oidField.value = preset.oid;

            // Auto-fill value type
            const valueTypeField = document.getElementById(`${formPrefix}ValueType`);
            if (valueTypeField) valueTypeField.value = preset.value_type || 'presence';

            // Auto-fill comparison
            const comparisonField = document.getElementById(`${formPrefix}Comparison`);
            if (comparisonField) comparisonField.value = preset.comparison || 'greater';

            // Auto-fill expected value
            const expectedField = document.getElementById(`${formPrefix}ExpectedValue`);
            if (expectedField) expectedField.value = preset.expected_value ?? '';

            // Auto-fill thresholds
            const warningField = document.getElementById(`${formPrefix}WarningThreshold`);
            if (warningField) warningField.value = preset.warning_threshold ?? '';

            const criticalField = document.getElementById(`${formPrefix}CriticalThreshold`);
            if (criticalField) criticalField.value = preset.critical_threshold ?? '';

            // Update hint
            const hintEl = document.getElementById(`${formPrefix}PresetHint`);
            if (hintEl) hintEl.textContent = preset.hint || '';
        };

        presetSelect.addEventListener('change', applyPreset);

        // Apply the default preset on first render
        applyPreset();
    },

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
        if (config.value_type === 'numeric' && config.comparison) {
            if ((config.comparison === 'greater' || config.comparison === 'less') &&
                config.warning_threshold !== undefined && config.critical_threshold !== undefined) {
                if (config.comparison === 'greater' && config.warning_threshold > config.critical_threshold) {
                    return 'Warning threshold should be less than critical threshold for "greater than" comparison';
                }
                if (config.comparison === 'less' && config.warning_threshold < config.critical_threshold) {
                    return 'Warning threshold should be greater than critical threshold for "less than" comparison';
                }
            }
        }
        return null;
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

        // Try to match OID to a preset for the dropdown
        const presetSelect = document.getElementById(`${formPrefix}OidPreset`);
        if (presetSelect) {
            let matched = 'custom';
            for (const [key, preset] of Object.entries(SNMP_PRESETS)) {
                if (preset.oid === config.oid) {
                    matched = key;
                    break;
                }
            }
            presetSelect.value = matched;
        }

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
        // Try to find a preset label for this OID
        for (const [key, preset] of Object.entries(SNMP_PRESETS)) {
            if (preset.oid === config.oid && key !== 'custom') {
                return `${config.host} - ${preset.label}`;
            }
        }
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

        // Show preset name if matched
        for (const [key, preset] of Object.entries(SNMP_PRESETS)) {
            if (preset.oid === monitor.config.oid && key !== 'custom') {
                metricsHtml += `
                    <div class="monitor-metric">
                        <div class="monitor-metric-label">Preset</div>
                        <div class="monitor-metric-value">${preset.label}</div>
                    </div>
                `;
                break;
            }
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

        // Show expected value if configured
        if (monitor.config.expected_value) {
            metricsHtml += `
                <div class="monitor-metric">
                    <div class="monitor-metric-label">Expected Value</div>
                    <div class="monitor-metric-value">${monitor.config.comparison || '=='} ${monitor.config.expected_value}</div>
                </div>
            `;
        }

        return metricsHtml;
    },

    // Custom collapsible content for OID reference
    renderCollapsible(formPrefix, serviceName = 'SERVICE_NAME', monitorName = null) {
        return `
            <div class="collapsible">
                <button type="button" class="collapsible-trigger" aria-expanded="false">
                    <svg class="collapsible-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M7 4l6 6-6 6"/>
                    </svg>
                    <span>OID Quick Reference</span>
                </button>
                <div class="collapsible-content">
                    <div class="collapsible-content-inner">
                        <div class="code-example">
                            <p class="form-hint" style="margin-bottom: 0.75rem;">
                                <strong>Tip:</strong> Use the OID Preset dropdown above to auto-fill common monitoring scenarios.
                                For interface and routing OIDs, replace the trailing index number with the correct interface or peer value.
                            </p>
                            <table style="width: 100%; font-size: 0.85em; border-collapse: collapse;">
                                <tr style="border-bottom: 1px solid var(--border); background: var(--bg-secondary);">
                                    <td style="padding: 0.4rem 0.5rem; font-weight: 700;" colspan="2">Interface Status Values</td>
                                </tr>
                                <tr style="border-bottom: 1px solid var(--border);">
                                    <td style="padding: 0.3rem 0.5rem; font-family: monospace;">1</td>
                                    <td style="padding: 0.3rem 0.5rem;">Up</td>
                                </tr>
                                <tr style="border-bottom: 1px solid var(--border);">
                                    <td style="padding: 0.3rem 0.5rem; font-family: monospace;">2</td>
                                    <td style="padding: 0.3rem 0.5rem;">Down</td>
                                </tr>
                                <tr style="border-bottom: 1px solid var(--border);">
                                    <td style="padding: 0.3rem 0.5rem; font-family: monospace;">3</td>
                                    <td style="padding: 0.3rem 0.5rem;">Testing</td>
                                </tr>
                                <tr style="border-bottom: 1px solid var(--border); background: var(--bg-secondary);">
                                    <td style="padding: 0.4rem 0.5rem; font-weight: 700;" colspan="2">BGP Peer States</td>
                                </tr>
                                <tr style="border-bottom: 1px solid var(--border);">
                                    <td style="padding: 0.3rem 0.5rem; font-family: monospace;">1</td>
                                    <td style="padding: 0.3rem 0.5rem;">Idle</td>
                                </tr>
                                <tr style="border-bottom: 1px solid var(--border);">
                                    <td style="padding: 0.3rem 0.5rem; font-family: monospace;">2-5</td>
                                    <td style="padding: 0.3rem 0.5rem;">Connecting / OpenSent / OpenConfirm</td>
                                </tr>
                                <tr style="border-bottom: 1px solid var(--border);">
                                    <td style="padding: 0.3rem 0.5rem; font-family: monospace;">6</td>
                                    <td style="padding: 0.3rem 0.5rem;">Established (healthy)</td>
                                </tr>
                                <tr style="border-bottom: 1px solid var(--border); background: var(--bg-secondary);">
                                    <td style="padding: 0.4rem 0.5rem; font-weight: 700;" colspan="2">OSPF Neighbor States</td>
                                </tr>
                                <tr style="border-bottom: 1px solid var(--border);">
                                    <td style="padding: 0.3rem 0.5rem; font-family: monospace;">1</td>
                                    <td style="padding: 0.3rem 0.5rem;">Down</td>
                                </tr>
                                <tr style="border-bottom: 1px solid var(--border);">
                                    <td style="padding: 0.3rem 0.5rem; font-family: monospace;">4</td>
                                    <td style="padding: 0.3rem 0.5rem;">Exchange</td>
                                </tr>
                                <tr>
                                    <td style="padding: 0.3rem 0.5rem; font-family: monospace;">8</td>
                                    <td style="padding: 0.3rem 0.5rem;">Full (healthy)</td>
                                </tr>
                            </table>
                            <p class="form-hint" style="margin-top: 0.75rem;">
                                Interface indexes usually start at 1. Use <code>snmpwalk -v2c -c public HOST 1.3.6.1.2.1.2.2.1.2</code> to list interface names and their indexes.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
};
