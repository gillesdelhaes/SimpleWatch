// GitHub Actions Monitor Plugin
// Monitors CI/CD workflow status for GitHub repositories

export default {
    // Unique identifier (must match backend monitor_type)
    type: 'github_actions',

    // Display information
    name: 'GitHub Actions',
    description: 'Monitor CI/CD workflow status for GitHub repositories',
    icon: 'gitBranch',
    category: 'Developer Tools',

    // Configuration schema
    schema: {
        owner: {
            type: 'text',
            label: 'Repository Owner',
            placeholder: 'e.g., vercel',
            required: true,
            hint: 'GitHub username or organization'
        },
        repo: {
            type: 'text',
            label: 'Repository Name',
            placeholder: 'e.g., next.js',
            required: true,
            hint: 'Repository name (without owner)'
        },
        workflow_file: {
            type: 'text',
            label: 'Workflow File (Optional)',
            placeholder: 'e.g., ci.yml',
            required: false,
            hint: 'Monitor specific workflow file, or leave blank for all workflows'
        },
        branch: {
            type: 'text',
            label: 'Branch (Optional)',
            placeholder: 'e.g., main',
            required: false,
            hint: 'Filter runs by branch, or leave blank for all branches'
        },
        token: {
            type: 'password',
            label: 'GitHub Token (Optional)',
            placeholder: 'ghp_...',
            required: false,
            hint: 'Personal access token for higher rate limits (5000/hr vs 60/hr)'
        },
        success_threshold: {
            type: 'number',
            label: 'Success Threshold (%)',
            default: 80,
            required: true,
            min: 0,
            max: 100,
            hint: 'Mark as degraded if success rate falls below this value'
        },
        timeout_seconds: {
            type: 'number',
            label: 'Timeout (seconds)',
            default: 10,
            required: true,
            min: 1,
            max: 60,
            hint: 'How long to wait for GitHub API response'
        }
    },

    // Default check interval in minutes (30 min to be nice to rate limits)
    defaultInterval: 30,

    // Available interval options
    intervalOptions: [
        { value: 15, label: 'Every 15 minutes' },
        { value: 30, label: 'Every 30 minutes' },
        { value: 60, label: 'Every 1 hour' },
        { value: 120, label: 'Every 2 hours' },
        { value: 360, label: 'Every 6 hours' }
    ],

    // Validate configuration
    validate(config) {
        if (!config.owner || config.owner.trim() === '') {
            return 'Repository owner is required';
        }
        if (!config.repo || config.repo.trim() === '') {
            return 'Repository name is required';
        }
        if (config.success_threshold < 0 || config.success_threshold > 100) {
            return 'Success threshold must be between 0 and 100';
        }
        if (config.timeout_seconds < 1 || config.timeout_seconds > 60) {
            return 'Timeout must be between 1 and 60 seconds';
        }
        return null; // Valid
    },

    // Extract configuration from form
    extractConfig(formPrefix) {
        return {
            owner: document.getElementById(`${formPrefix}Owner`).value.trim(),
            repo: document.getElementById(`${formPrefix}Repo`).value.trim(),
            workflow_file: document.getElementById(`${formPrefix}WorkflowFile`).value.trim(),
            branch: document.getElementById(`${formPrefix}Branch`).value.trim(),
            token: document.getElementById(`${formPrefix}Token`).value.trim(),
            success_threshold: parseInt(document.getElementById(`${formPrefix}SuccessThreshold`).value || 80),
            timeout_seconds: parseInt(document.getElementById(`${formPrefix}TimeoutSeconds`).value || 10)
        };
    },

    // Populate form with existing configuration
    populateForm(formPrefix, config) {
        document.getElementById(`${formPrefix}Owner`).value = config.owner || '';
        document.getElementById(`${formPrefix}Repo`).value = config.repo || '';
        document.getElementById(`${formPrefix}WorkflowFile`).value = config.workflow_file || '';
        document.getElementById(`${formPrefix}Branch`).value = config.branch || '';
        document.getElementById(`${formPrefix}Token`).value = config.token || '';
        document.getElementById(`${formPrefix}SuccessThreshold`).value = config.success_threshold || 80;
        document.getElementById(`${formPrefix}TimeoutSeconds`).value = config.timeout_seconds || 10;
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

        // Show success rate
        if (monitor.metadata && monitor.metadata.success_rate !== undefined) {
            const rate = monitor.metadata.success_rate;
            const rateClass = rate >= 80 ? 'success' : rate >= 50 ? 'warning' : 'error';
            html += `
                <div class="monitor-metric">
                    <div class="monitor-metric-label">Success Rate</div>
                    <div class="monitor-metric-value ${rateClass}">${rate}%</div>
                </div>
            `;
        }

        // Show latest build status
        if (monitor.metadata && monitor.metadata.latest_status) {
            const status = monitor.metadata.latest_status;
            const statusIcon = status === 'success' ? 'check-circle' :
                              status === 'failure' ? 'x-circle' :
                              status === 'running' ? 'loader' : 'help-circle';
            const statusClass = status === 'success' ? 'success' :
                               status === 'failure' ? 'error' : 'warning';
            html += `
                <div class="monitor-metric">
                    <div class="monitor-metric-label">Latest Build</div>
                    <div class="monitor-metric-value ${statusClass}">${status}</div>
                </div>
            `;
        }

        // Show average duration
        if (monitor.metadata && monitor.metadata.avg_duration_seconds) {
            const duration = monitor.metadata.avg_duration_seconds;
            const formatted = duration >= 60 ?
                `${Math.floor(duration / 60)}m ${duration % 60}s` :
                `${duration}s`;
            html += `
                <div class="monitor-metric">
                    <div class="monitor-metric-label">Avg Build Time</div>
                    <div class="monitor-metric-value">${formatted}</div>
                </div>
            `;
        }

        // Show rate limit remaining
        if (monitor.metadata && monitor.metadata.rate_limit_remaining !== undefined) {
            const remaining = monitor.metadata.rate_limit_remaining;
            const limitClass = remaining < 10 ? 'error' : remaining < 30 ? 'warning' : '';
            html += `
                <div class="monitor-metric">
                    <div class="monitor-metric-label">API Rate Limit</div>
                    <div class="monitor-metric-value ${limitClass}">${remaining} remaining</div>
                </div>
            `;
        }

        // Show latest run link
        if (monitor.metadata && monitor.metadata.latest_run && monitor.metadata.latest_run.html_url) {
            html += `
                <div class="monitor-metric" style="grid-column: span 2;">
                    <div class="monitor-metric-label">Latest Run</div>
                    <div class="monitor-metric-value">
                        <a href="${monitor.metadata.latest_run.html_url}" target="_blank" rel="noopener noreferrer"
                           style="color: var(--accent); text-decoration: none;">
                            #${monitor.metadata.latest_run.run_number}: ${monitor.metadata.latest_run.name}
                        </a>
                    </div>
                </div>
            `;
        }

        return html;
    },

    // Get description for services page
    getDescription(config) {
        if (!config) return '';
        let desc = `${config.owner}/${config.repo}`;

        if (config.workflow_file) {
            desc += ` (${config.workflow_file})`;
        }
        if (config.branch) {
            desc += ` [${config.branch}]`;
        }

        return desc;
    }
};
