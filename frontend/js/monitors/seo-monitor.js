// SEO Meta Tag Monitor Plugin
// Monitors presence and validity of SEO meta tags

export default {
    // Unique identifier (must match backend monitor_type)
    type: 'seo',

    // Display information
    name: 'SEO Monitor',
    description: 'Check SEO meta tags (title, description, Open Graph)',
    icon: 'search', // Magnifying glass for SEO

    // Configuration schema - defines all fields needed for this monitor
    schema: {
        url: {
            type: 'text',
            label: 'Page URL',
            placeholder: 'https://example.com',
            required: true,
            hint: 'URL of the page to check for SEO tags'
        },
        timeout_seconds: {
            type: 'number',
            label: 'Timeout (seconds)',
            default: 10,
            required: true,
            min: 1,
            max: 30
        },
        check_title: {
            type: 'checkbox',
            label: 'Check Title Tag',
            default: true
        },
        check_description: {
            type: 'checkbox',
            label: 'Check Meta Description',
            default: true
        },
        check_og_tags: {
            type: 'checkbox',
            label: 'Check Open Graph Tags (og:title, og:description, og:image)',
            default: true
        },
        check_canonical: {
            type: 'checkbox',
            label: 'Check Canonical Link',
            default: false
        },
        check_robots: {
            type: 'checkbox',
            label: 'Check Robots Meta Tag',
            default: false
        },
        title_min_length: {
            type: 'number',
            label: 'Title Min Length (characters)',
            default: 30,
            required: true,
            min: 10,
            max: 100,
            hint: 'Recommended: 30-60 characters'
        },
        title_max_length: {
            type: 'number',
            label: 'Title Max Length (characters)',
            default: 60,
            required: true,
            min: 10,
            max: 100
        },
        description_min_length: {
            type: 'number',
            label: 'Description Min Length (characters)',
            default: 120,
            required: true,
            min: 50,
            max: 300,
            hint: 'Recommended: 120-160 characters'
        },
        description_max_length: {
            type: 'number',
            label: 'Description Max Length (characters)',
            default: 160,
            required: true,
            min: 50,
            max: 300
        }
    },

    // Default check interval in minutes
    defaultInterval: 15,

    // Available interval options for the dropdown
    intervalOptions: [
        { value: 5, label: 'Every 5 minutes' },
        { value: 15, label: 'Every 15 minutes' },
        { value: 30, label: 'Every 30 minutes' },
        { value: 60, label: 'Every 1 hour' },
        { value: 360, label: 'Every 6 hours' },
        { value: 1440, label: 'Every 24 hours' }
    ],

    // Validate configuration before submission
    // Returns error message string if invalid, null if valid
    validate(config) {
        if (!config.url || config.url.trim() === '') {
            return 'URL is required';
        }

        // Check for valid URL format
        try {
            new URL(config.url);
        } catch {
            return 'Invalid URL format (must include http:// or https://)';
        }

        if (config.timeout_seconds < 1 || config.timeout_seconds > 30) {
            return 'Timeout must be between 1 and 30 seconds';
        }

        // Check at least one tag type is selected
        if (!config.check_title && !config.check_description && !config.check_og_tags &&
            !config.check_canonical && !config.check_robots) {
            return 'At least one tag type must be selected';
        }

        // Validate length ranges
        if (config.title_min_length >= config.title_max_length) {
            return 'Title min length must be less than max length';
        }

        if (config.description_min_length >= config.description_max_length) {
            return 'Description min length must be less than max length';
        }

        return null; // Valid
    },

    // Extract configuration from form fields
    // formPrefix: 'seo' for Quick Monitor, 'addSeo' for Add to Service, 'editSeo' for Edit
    extractConfig(formPrefix) {
        return {
            url: document.getElementById(`${formPrefix}Url`).value.trim(),
            timeout_seconds: parseInt(document.getElementById(`${formPrefix}TimeoutSeconds`).value),
            check_title: document.getElementById(`${formPrefix}CheckTitle`).checked,
            check_description: document.getElementById(`${formPrefix}CheckDescription`).checked,
            check_og_tags: document.getElementById(`${formPrefix}CheckOgTags`).checked,
            check_canonical: document.getElementById(`${formPrefix}CheckCanonical`).checked,
            check_robots: document.getElementById(`${formPrefix}CheckRobots`).checked,
            title_min_length: parseInt(document.getElementById(`${formPrefix}TitleMinLength`).value),
            title_max_length: parseInt(document.getElementById(`${formPrefix}TitleMaxLength`).value),
            description_min_length: parseInt(document.getElementById(`${formPrefix}DescriptionMinLength`).value),
            description_max_length: parseInt(document.getElementById(`${formPrefix}DescriptionMaxLength`).value)
        };
    },

    // Populate form fields with existing configuration
    // Used when editing a monitor
    populateForm(formPrefix, config) {
        document.getElementById(`${formPrefix}Url`).value = config.url || '';
        document.getElementById(`${formPrefix}TimeoutSeconds`).value = config.timeout_seconds || 10;
        document.getElementById(`${formPrefix}CheckTitle`).checked = config.check_title !== false;
        document.getElementById(`${formPrefix}CheckDescription`).checked = config.check_description !== false;
        document.getElementById(`${formPrefix}CheckOgTags`).checked = config.check_og_tags !== false;
        document.getElementById(`${formPrefix}CheckCanonical`).checked = config.check_canonical || false;
        document.getElementById(`${formPrefix}CheckRobots`).checked = config.check_robots || false;
        document.getElementById(`${formPrefix}TitleMinLength`).value = config.title_min_length || 30;
        document.getElementById(`${formPrefix}TitleMaxLength`).value = config.title_max_length || 60;
        document.getElementById(`${formPrefix}DescriptionMinLength`).value = config.description_min_length || 120;
        document.getElementById(`${formPrefix}DescriptionMaxLength`).value = config.description_max_length || 160;
    },

    // Optional: Custom rendering logic for monitor status display
    // This is used on the dashboard or services page
    renderStatus(monitor) {
        if (monitor.metadata) {
            const issues = monitor.metadata.total_issues || 0;
            const warnings = monitor.metadata.total_warnings || 0;

            if (issues > 0) {
                return `${issues} critical issue${issues > 1 ? 's' : ''}`;
            }

            if (warnings > 0) {
                return `${warnings} warning${warnings > 1 ? 's' : ''}`;
            }

            return 'All tags valid';
        }

        return null;
    },

    // Get description text for services page
    // config: monitor configuration object
    getDescription(config) {
        if (!config) return '';

        const checks = [];
        if (config.check_title) checks.push('Title');
        if (config.check_description) checks.push('Description');
        if (config.check_og_tags) checks.push('OG');
        if (config.check_canonical) checks.push('Canonical');
        if (config.check_robots) checks.push('Robots');

        const url = new URL(config.url);
        const domain = url.hostname.replace('www.', '');

        return `${domain} (${checks.join(', ')})`;
    },

    // Render custom metrics for dashboard modal
    // monitor: full monitor object with metadata
    renderDetailMetrics(monitor) {
        if (!monitor.metadata) return '';

        return `
            <div class="monitor-metric">
                <div class="monitor-metric-label">URL</div>
                <div class="monitor-metric-value" style="font-family: var(--font-mono); font-size: 0.8125rem; word-break: break-all;">
                    ${monitor.metadata.url || monitor.config?.url || 'N/A'}
                </div>
            </div>
            ${monitor.metadata.title !== undefined ? `
            <div class="monitor-metric">
                <div class="monitor-metric-label">Title Tag</div>
                <div class="monitor-metric-value" style="font-family: var(--font-mono); font-size: 0.8125rem;">
                    ${monitor.metadata.title ? `${monitor.metadata.title_length || monitor.metadata.title.length} chars: "${monitor.metadata.title}"` : '<span style="color: var(--status-down);">Missing</span>'}
                </div>
            </div>
            ` : ''}
            ${monitor.metadata.description !== undefined ? `
            <div class="monitor-metric">
                <div class="monitor-metric-label">Meta Description</div>
                <div class="monitor-metric-value" style="font-family: var(--font-mono); font-size: 0.8125rem;">
                    ${monitor.metadata.description ? `${monitor.metadata.description_length || monitor.metadata.description.length} chars: "${monitor.metadata.description.substring(0, 80)}${monitor.metadata.description.length > 80 ? '...' : ''}"` : '<span style="color: var(--status-degraded);">Missing</span>'}
                </div>
            </div>
            ` : ''}
            ${monitor.metadata.og_title !== undefined || monitor.metadata.og_description !== undefined || monitor.metadata.og_image !== undefined ? `
            <div class="monitor-metric">
                <div class="monitor-metric-label">Open Graph Tags</div>
                <div class="monitor-metric-value" style="font-family: var(--font-mono); font-size: 0.8125rem; line-height: 1.6;">
                    og:title: ${monitor.metadata.og_title ? '<span style="color: var(--status-operational);">✓</span>' : '<span style="color: var(--status-degraded);">✗</span>'}<br>
                    og:description: ${monitor.metadata.og_description ? '<span style="color: var(--status-operational);">✓</span>' : '<span style="color: var(--status-degraded);">✗</span>'}<br>
                    og:image: ${monitor.metadata.og_image ? '<span style="color: var(--status-operational);">✓</span>' : '<span style="color: var(--status-degraded);">✗</span>'}
                </div>
            </div>
            ` : ''}
            ${monitor.metadata.canonical !== undefined ? `
            <div class="monitor-metric">
                <div class="monitor-metric-label">Canonical Link</div>
                <div class="monitor-metric-value" style="font-family: var(--font-mono); font-size: 0.8125rem; word-break: break-all;">
                    ${monitor.metadata.canonical || '<span style="color: var(--status-degraded);">Not set</span>'}
                </div>
            </div>
            ` : ''}
            ${monitor.metadata.robots !== undefined ? `
            <div class="monitor-metric">
                <div class="monitor-metric-label">Robots Meta</div>
                <div class="monitor-metric-value" style="font-family: var(--font-mono); font-size: 0.8125rem;">
                    ${monitor.metadata.robots || '<span style="color: var(--status-degraded);">Not set</span>'}
                </div>
            </div>
            ` : ''}
            ${monitor.metadata.issues && monitor.metadata.issues.length > 0 ? `
            <div class="monitor-metric">
                <div class="monitor-metric-label">Critical Issues</div>
                <div class="monitor-metric-value" style="color: var(--status-down); font-size: 0.8125rem; line-height: 1.6;">
                    ${monitor.metadata.issues.map(issue => `• ${issue}`).join('<br>')}
                </div>
            </div>
            ` : ''}
            ${monitor.metadata.warnings && monitor.metadata.warnings.length > 0 ? `
            <div class="monitor-metric">
                <div class="monitor-metric-label">Warnings</div>
                <div class="monitor-metric-value" style="color: var(--status-degraded); font-size: 0.8125rem; line-height: 1.6;">
                    ${monitor.metadata.warnings.map(warning => `• ${warning}`).join('<br>')}
                </div>
            </div>
            ` : ''}
            ${monitor.response_time_ms ? `
            <div class="monitor-metric">
                <div class="monitor-metric-label">Page Load Time</div>
                <div class="monitor-metric-value">${monitor.response_time_ms}ms</div>
            </div>
            ` : ''}
        `;
    }
};
