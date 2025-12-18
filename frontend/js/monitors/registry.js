// Monitor Registry
// Auto-discovers and manages all monitor plugins

class MonitorRegistry {
    constructor() {
        this.monitors = new Map();
        this.loaded = false;
    }

    // Register a monitor plugin
    register(monitorPlugin) {
        if (!monitorPlugin.type || !monitorPlugin.name) {
            throw new Error('Monitor plugin must have type and name');
        }
        this.monitors.set(monitorPlugin.type, monitorPlugin);
    }

    // Get monitor by type
    get(type) {
        return this.monitors.get(type);
    }

    // Get all registered monitors
    getAll() {
        return Array.from(this.monitors.values());
    }

    // Check if monitors are loaded
    isLoaded() {
        return this.loaded;
    }

    // Load monitor plugins
    async loadMonitors() {
        if (this.loaded) {
            return;
        }

        try {
            // List of all monitor plugin files
            // To add a new monitor: just add its filename (without .js) to this array
            const monitorFiles = [
                'website-monitor',
                'api-monitor',
                'metric-monitor',
                'port-monitor',
                'deadman-monitor',
                'ssl-cert-monitor',
                'dns-monitor',
                'ping-monitor',
                'seo-monitor',
                'ollama-monitor'
            ];

            // Import and register each monitor plugin
            for (const file of monitorFiles) {
                const module = await import(`./${file}.js`);
                this.register(module.default);
            }

            this.loaded = true;
        } catch (error) {
            console.error('Failed to load monitor plugins:', error);
            throw error;
        }
    }

    // Generate categorized HTML for type selection cards
    renderCategorizedTypeCards(onClickHandler) {
        // Group monitors by category
        const categories = {
            'Infrastructure': {
                icon: 'key',
                monitors: []
            },
            'Web & API': {
                icon: 'mail',
                monitors: []
            },
            'Operations': {
                icon: 'clipboardList',
                monitors: []
            },
            'AI & ML': {
                icon: 'alertCircle',
                monitors: []
            }
        };

        // Categorize monitors
        this.getAll().forEach(monitor => {
            const category = monitor.category || 'Operations';
            if (categories[category]) {
                categories[category].monitors.push(monitor);
            }
        });

        // Render categorized view
        return Object.entries(categories)
            .filter(([_, data]) => data.monitors.length > 0)
            .map(([categoryName, data], index) => {
                const categoryId = categoryName.replace(/\s+/g, '-').toLowerCase();
                const isFirstCategory = index === 0;

                const monitorsHtml = data.monitors.map(monitor => {
                    const iconSvg = window.icons && window.icons[monitor.icon] ? window.icons[monitor.icon] : '';
                    return `
                        <div class="type-card"
                             onclick="${onClickHandler}('${monitor.type}')"
                             data-type="${monitor.type.replace(/_/g, '')}">
                            <div class="type-card-title">
                                ${iconSvg ? `<span class="icon" style="width: 20px; height: 20px;">${iconSvg}</span>` : ''}
                                ${monitor.name}
                            </div>
                            <div class="type-card-desc">${monitor.description}</div>
                        </div>
                    `;
                }).join('');

                const iconSvg = window.icons && window.icons[data.icon] ? window.icons[data.icon] : '';

                return `
                    <div class="monitor-category">
                        <div class="category-header" onclick="toggleCategory('${categoryId}', event)" ${isFirstCategory ? 'data-expanded="true"' : ''}>
                            <div class="category-title">
                                <span class="category-icon">${iconSvg}</span>
                                <span class="category-name">${categoryName}</span>
                                <span class="category-count">${data.monitors.length}</span>
                            </div>
                            <svg class="category-chevron" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
                            </svg>
                        </div>
                        <div class="category-content ${isFirstCategory ? 'expanded' : ''}" id="category-${categoryId}">
                            <div class="type-grid">
                                ${monitorsHtml}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
    }

    // Generate form HTML from monitor schema
    renderForm(monitor, formPrefix, includeServiceName = false) {
        let html = '';

        // Add service name field if requested (for Quick Monitor)
        if (includeServiceName) {
            html += `
                <div class="form-group">
                    <label class="form-label">Service Name</label>
                    <input type="text" id="${formPrefix}ServiceName" class="form-input" required>
                </div>
            `;
        }

        // Generate fields from schema
        html += Object.entries(monitor.schema).map(([key, field]) => {
            const fieldId = `${formPrefix}${this.capitalize(key)}`;

            if (field.type === 'checkbox') {
                return `
                    <div class="form-group">
                        <label class="form-label" style="display: flex; align-items: center; gap: 0.5rem;">
                            <input type="checkbox"
                                   id="${fieldId}"
                                   ${field.default ? 'checked' : ''}>
                            ${field.label}
                        </label>
                    </div>
                `;
            }

            if (field.type === 'select') {
                return `
                    <div class="form-group">
                        <label class="form-label">${field.label}</label>
                        <select id="${fieldId}" class="form-input" ${field.required ? 'required' : ''}>
                            ${field.options.map(opt => `
                                <option value="${opt.value}" ${opt.value === field.default ? 'selected' : ''}>
                                    ${opt.label}
                                </option>
                            `).join('')}
                        </select>
                        ${field.hint ? `<p class="form-hint">${field.hint}</p>` : ''}
                    </div>
                `;
            }

            return `
                <div class="form-group">
                    <label class="form-label">${field.label}</label>
                    <input type="${field.type}"
                           id="${fieldId}"
                           class="form-input"
                           ${field.placeholder ? `placeholder="${field.placeholder}"` : ''}
                           ${field.default !== undefined && field.type !== 'checkbox' ? `value="${field.default}"` : ''}
                           ${field.step !== undefined ? `step="${field.step}"` : ''}
                           ${field.min !== undefined ? `min="${field.min}"` : ''}
                           ${field.max !== undefined ? `max="${field.max}"` : ''}
                           ${field.required ? 'required' : ''}>
                    ${field.hint ? `<p class="form-hint">${field.hint}</p>` : ''}
                </div>
            `;
        }).join('');

        return html;
    }

    // Generate interval dropdown HTML (only if monitor needs it)
    renderIntervalDropdown(monitor, formPrefix) {
        // Skip interval dropdown for passive monitors (e.g., metric_threshold)
        if (monitor.showInterval === false) {
            return '';
        }

        // Default interval options if not specified by monitor
        const intervalOptions = monitor.intervalOptions || [
            { value: 1, label: 'Every 1 minute' },
            { value: 5, label: 'Every 5 minutes' },
            { value: 15, label: 'Every 15 minutes' },
            { value: 30, label: 'Every 30 minutes' },
            { value: 60, label: 'Every 1 hour' }
        ];

        return `
            <div class="form-group">
                <label class="form-label">Check Interval</label>
                <select id="${formPrefix}Interval" class="form-input">
                    ${intervalOptions.map(opt => `
                        <option value="${opt.value}"
                                ${opt.value === monitor.defaultInterval ? 'selected' : ''}>
                            ${opt.label}
                        </option>
                    `).join('')}
                </select>
            </div>
        `;
    }

    // Render custom collapsible content if monitor provides it
    renderCollapsible(monitor, formPrefix, serviceName = 'SERVICE_NAME', monitorName = null) {
        if (monitor.renderCollapsible) {
            return monitor.renderCollapsible(formPrefix, serviceName, monitorName);
        }
        return '';
    }

    // Helper: Capitalize string (e.g., 'timeout_seconds' -> 'TimeoutSeconds')
    capitalize(str) {
        return str.split('_').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join('');
    }
}

// Create global instance
window.monitorRegistry = new MonitorRegistry();

// Export for ES6 modules
export default window.monitorRegistry;
