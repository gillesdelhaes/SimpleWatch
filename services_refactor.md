# Services Page Refactoring Plan

## Problem Statement

The `services.html` file has grown to **1934 lines** and continues to grow with each new monitor type. Currently, adding a new monitor requires changes in **12+ different locations** across the file:

### Current Issues

1. **Monolithic Structure**: All monitor forms, modals, and JavaScript in one file
2. **Code Duplication**: Each monitor type requires 3 nearly identical forms (Quick Monitor, Add to Service, Edit)
3. **Error-Prone**: Easy to miss locations when adding new monitors (SSL cert monitor is incomplete)
4. **Hard to Maintain**: No single source of truth for monitor configurations
5. **Tight Coupling**: Monitor logic scattered throughout services.html

### Places That Need Updates Per Monitor Type

When adding a new monitor, you must update:

1. Quick Monitor type card (`<div class="type-card">`)
2. Quick Monitor form HTML
3. Quick Monitor JavaScript function (`createXMonitor()`)
4. Add to Service type card
5. Add to Service form HTML
6. Add to Service JavaScript function (`addXMonitorToService()`)
7. Edit monitor modal HTML
8. Edit monitor form population logic (`editMonitor()`)
9. Edit monitor submit handler
10. Icon mapping (`iconMapping` object)
11. Form ID mapping (`formIds` object for Quick Monitor)
12. Form ID mapping (`formIds` object for Add to Service)
13. Hide form functions (`backToMonitorSelection()`, `backToAddMonitorSelection()`)
14. Modal close function (`hideEditMonitorModal()`)

**Missing from SSL cert monitor**: Check if all 14 locations were properly updated.

---

## Proposed Solution: Plugin-Based Architecture

### Core Concept

Each monitor type becomes a **self-contained module** with its own configuration that the system loads automatically. No more manual registration in 14 places.

### Architecture Overview

```
frontend/
├── services.html                    # Skeleton only (~300 lines)
├── js/
│   ├── monitors/
│   │   ├── registry.js             # Auto-discovery & registration
│   │   ├── base-monitor.js         # Base class/interface
│   │   ├── website-monitor.js      # Website monitor plugin
│   │   ├── api-monitor.js          # API monitor plugin
│   │   ├── metric-monitor.js       # Metric monitor plugin
│   │   ├── port-monitor.js         # Port monitor plugin
│   │   ├── deadman-monitor.js      # Deadman monitor plugin
│   │   └── ssl-cert-monitor.js     # SSL cert monitor plugin
│   ├── services.js                 # Services page logic (split from HTML)
│   ├── components.js               # Existing UI components
│   └── api.js                      # Existing API client
└── templates/
    └── monitor-forms.html          # Reusable form templates
```

---

## Detailed Design

### 1. Monitor Plugin Structure

Each monitor is a JavaScript module exporting a configuration object:

```javascript
// frontend/js/monitors/ssl-cert-monitor.js

export default {
    // Unique identifier
    type: 'ssl_cert',

    // Display information
    name: 'SSL Certificate',
    description: 'Monitor certificate expiration',
    icon: 'shield',
    category: 'network', // For future grouping

    // Configuration schema
    schema: {
        hostname: {
            type: 'text',
            label: 'Hostname',
            placeholder: 'example.com',
            required: true,
            hint: null
        },
        port: {
            type: 'number',
            label: 'Port',
            default: 443,
            required: true
        },
        warning_days: {
            type: 'number',
            label: 'Warning Threshold (days)',
            default: 30,
            required: true,
            hint: 'Alert when certificate expires in this many days'
        },
        critical_days: {
            type: 'number',
            label: 'Critical Threshold (days)',
            default: 7,
            required: true,
            hint: 'Critical alert when certificate expires in this many days'
        }
    },

    // Default check interval
    defaultInterval: 1440, // 24 hours

    // Interval options for dropdown
    intervalOptions: [
        { value: 60, label: 'Every 1 hour' },
        { value: 360, label: 'Every 6 hours' },
        { value: 720, label: 'Every 12 hours' },
        { value: 1440, label: 'Every 24 hours (Daily)' }
    ],

    // Validate config before submission
    validate(config) {
        if (config.critical_days >= config.warning_days) {
            return 'Critical threshold must be less than warning threshold';
        }
        return null; // Valid
    },

    // Extract config from form fields
    extractConfig(formPrefix) {
        return {
            hostname: document.getElementById(`${formPrefix}Hostname`).value,
            port: parseInt(document.getElementById(`${formPrefix}Port`).value),
            warning_days: parseInt(document.getElementById(`${formPrefix}WarningDays`).value),
            critical_days: parseInt(document.getElementById(`${formPrefix}CriticalDays`).value)
        };
    },

    // Populate form fields with existing config
    populateForm(formPrefix, config) {
        document.getElementById(`${formPrefix}Hostname`).value = config.hostname;
        document.getElementById(`${formPrefix}Port`).value = config.port;
        document.getElementById(`${formPrefix}WarningDays`).value = config.warning_days;
        document.getElementById(`${formPrefix}CriticalDays`).value = config.critical_days;
    },

    // Optional: Custom display logic for dashboard/services page
    renderStatus(monitor) {
        if (monitor.metadata?.days_until_expiry !== undefined) {
            return `${monitor.metadata.days_until_expiry} days until expiry`;
        }
        return null;
    }
};
```

### 2. Monitor Registry

Auto-discovers and manages all monitor plugins:

```javascript
// frontend/js/monitors/registry.js

class MonitorRegistry {
    constructor() {
        this.monitors = new Map();
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

    // Get all monitors
    getAll() {
        return Array.from(this.monitors.values());
    }

    // Auto-discover monitors from directory
    async loadMonitors() {
        const monitorModules = [
            'website-monitor.js',
            'api-monitor.js',
            'metric-monitor.js',
            'port-monitor.js',
            'deadman-monitor.js',
            'ssl-cert-monitor.js'
        ];

        for (const module of monitorModules) {
            const monitor = await import(`./monitors/${module}`);
            this.register(monitor.default);
        }
    }

    // Generate Quick Monitor type cards
    renderTypeCards(onClickHandler) {
        return this.getAll().map(monitor => `
            <div class="type-card"
                 onclick="${onClickHandler}('${monitor.type}')"
                 data-type="${monitor.type.replace('_', '')}">
                <div class="type-card-title">${monitor.name}</div>
                <div class="type-card-desc">${monitor.description}</div>
            </div>
        `).join('');
    }

    // Generate form HTML from schema
    renderForm(monitor, formPrefix) {
        return Object.entries(monitor.schema).map(([key, field]) => `
            <div class="form-group">
                <label class="form-label">${field.label}</label>
                <input type="${field.type}"
                       id="${formPrefix}${capitalize(key)}"
                       class="form-input"
                       ${field.placeholder ? `placeholder="${field.placeholder}"` : ''}
                       ${field.default !== undefined ? `value="${field.default}"` : ''}
                       ${field.required ? 'required' : ''}>
                ${field.hint ? `<p class="form-hint">${field.hint}</p>` : ''}
            </div>
        `).join('');
    }

    // Generate interval dropdown
    renderIntervalDropdown(monitor, formPrefix) {
        return `
            <div class="form-group">
                <label class="form-label">Check Interval</label>
                <select id="${formPrefix}Interval" class="form-input">
                    ${monitor.intervalOptions.map(opt => `
                        <option value="${opt.value}"
                                ${opt.value === monitor.defaultInterval ? 'selected' : ''}>
                            ${opt.label}
                        </option>
                    `).join('')}
                </select>
            </div>
        `;
    }
}

// Global instance
window.monitorRegistry = new MonitorRegistry();

// Helper function
function capitalize(str) {
    return str.split('_').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join('');
}
```

### 3. Refactored Services Page

```javascript
// frontend/js/services.js

import { monitorRegistry } from './monitors/registry.js';

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Load all monitor plugins
    await monitorRegistry.loadMonitors();

    // Render type cards
    renderQuickMonitorCards();
    renderAddMonitorCards();

    // Setup icon mapping
    setupIconMapping();

    // Load services
    loadServices();
});

function renderQuickMonitorCards() {
    const container = document.getElementById('quickMonitorTypeGrid');
    container.innerHTML = monitorRegistry.renderTypeCards('selectMonitorType');
}

function renderAddMonitorCards() {
    const container = document.getElementById('addMonitorTypeGrid');
    container.innerHTML = monitorRegistry.renderTypeCards('selectAddMonitorType');
}

function setupIconMapping() {
    const iconMapping = {};
    monitorRegistry.getAll().forEach(monitor => {
        const dataType = monitor.type.replace('_', '');
        iconMapping[dataType] = icons[monitor.icon];
    });

    // Apply icons to cards
    document.querySelectorAll('.type-card[data-type]').forEach(card => {
        const type = card.dataset.type;
        const icon = iconMapping[type];
        if (icon) {
            const title = card.querySelector('.type-card-title');
            const iconSpan = document.createElement('span');
            iconSpan.className = 'icon';
            iconSpan.style.color = 'var(--accent-primary)';
            iconSpan.innerHTML = icon;
            title.prepend(iconSpan);
        }
    });
}

// Generic monitor creation
async function createMonitor(type, serviceName) {
    const monitor = monitorRegistry.get(type);
    if (!monitor) {
        throw new Error(`Unknown monitor type: ${type}`);
    }

    // Extract config using monitor's method
    const config = monitor.extractConfig(getFormPrefix(type, 'quick'));

    // Validate
    const error = monitor.validate?.(config);
    if (error) {
        showError(error);
        return;
    }

    // Create service
    const service = await api.createService({
        name: serviceName,
        description: `${monitor.name} monitor`,
        category: 'Monitor'
    });

    // Create monitor
    await api.createMonitor({
        service_id: service.id,
        monitor_type: type,
        config: config,
        check_interval_minutes: parseInt(
            document.getElementById(`${getFormPrefix(type, 'quick')}Interval`).value
        )
    });

    hideQuickMonitorModal();
    loadServices();
    showSuccess(`${monitor.name} monitor created successfully`);
}

// Generic monitor editing
async function editMonitor(monitorId) {
    const monitorData = await api.getMonitor(monitorId);
    const monitor = monitorRegistry.get(monitorData.monitor_type);

    if (!monitor) {
        showError(`Unknown monitor type: ${monitorData.monitor_type}`);
        return;
    }

    // Show appropriate modal
    const modalId = `edit${capitalize(monitorData.monitor_type)}MonitorModal`;
    document.getElementById(modalId).classList.remove('hidden');

    // Populate form using monitor's method
    const formPrefix = `edit${capitalize(monitorData.monitor_type)}`;
    monitor.populateForm(formPrefix, monitorData.config);

    // Store monitor ID
    document.getElementById(`${formPrefix}MonitorId`).value = monitorId;
}

// Form prefix helper
function getFormPrefix(type, context) {
    const base = capitalize(type);
    if (context === 'quick') return base.charAt(0).toLowerCase() + base.slice(1);
    if (context === 'add') return 'add' + base;
    if (context === 'edit') return 'edit' + base;
    return base;
}
```

### 4. Simplified services.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Services - SimpleWatch</title>
    <link rel="stylesheet" href="/static/css/theme.css">
    <style>
        /* All existing styles */
    </style>
</head>
<body>
    <div id="navigation" data-page="services"></div>

    <div class="main-container">
        <div class="page-header">
            <h1 class="page-title">Services & Monitors</h1>
            <div class="action-buttons">
                <button onclick="showAddServiceModal()">+ Add Service</button>
                <button onclick="showQuickMonitorModal()">⚡ Quick Monitor</button>
            </div>
        </div>
        <div id="servicesList"></div>
    </div>

    <!-- Quick Monitor Modal -->
    <div id="quickMonitorModal" class="modal hidden">
        <div class="modal-content large">
            <!-- Type Selection -->
            <div id="monitorTypeSelection">
                <h3>Quick Monitor</h3>
                <div id="quickMonitorTypeGrid" class="type-grid">
                    <!-- Cards injected by monitorRegistry -->
                </div>
            </div>

            <!-- Forms Container -->
            <div id="quickMonitorFormsContainer">
                <!-- Forms dynamically generated -->
            </div>
        </div>
    </div>

    <!-- Add Monitor to Service Modal -->
    <div id="addMonitorToServiceModal" class="modal hidden">
        <!-- Similar structure -->
    </div>

    <!-- Edit Monitor Modals Container -->
    <div id="editMonitorModalsContainer">
        <!-- Edit modals dynamically generated -->
    </div>

    <!-- Scripts -->
    <script type="module" src="/static/js/monitors/registry.js"></script>
    <script type="module" src="/static/js/services.js"></script>
    <script src="/static/js/components.js"></script>
    <script src="/static/js/theme.js"></script>
    <script src="/static/js/api.js"></script>
    <script src="/static/js/auth.js"></script>
    <script src="/static/js/nav.js"></script>
</body>
</html>
```

---

## Benefits of This Approach

### 1. **Atomic Monitor Addition**
- Add one file: `frontend/js/monitors/new-monitor.js`
- Update one line: Add filename to `monitorRegistry.loadMonitors()`
- **That's it!** No hunting through 1900+ lines of HTML

### 2. **DRY Principle**
- Form generation logic written once
- Quick Monitor, Add to Service, and Edit forms generated from same schema
- No duplicate HTML/JavaScript

### 3. **Type Safety & Validation**
- Schema defines types, defaults, validation
- Validation logic in one place per monitor
- Catch errors before API calls

### 4. **Maintainability**
- Each monitor is ~100 lines instead of scattered across 200+ lines
- Easy to find and update monitor-specific logic
- Clear separation of concerns

### 5. **Testability**
- Each monitor module can be unit tested independently
- Mock the registry for integration tests
- Test schema validation separately

### 6. **Extensibility**
- Add new field types to form generator
- Support advanced features (conditional fields, dependencies)
- Plugin hooks for custom behavior

### 7. **Auto-Discovery**
- Registry can auto-detect monitors from directory
- No manual registration needed
- Could support dynamic loading from backend API

---

## Migration Strategy

### Phase 1: Create Infrastructure (1-2 hours)
1. Create `frontend/js/monitors/` directory
2. Implement `registry.js` with base functionality
3. Create form generation utilities
4. Add module loading to services.html

### Phase 2: Migrate One Monitor (1 hour)
1. Choose simplest monitor (port or website)
2. Create monitor plugin file
3. Test Quick Monitor, Add to Service, and Edit flows
4. Verify backwards compatibility

### Phase 3: Migrate Remaining Monitors (3-4 hours)
1. Convert each monitor to plugin format
2. Test each one thoroughly
3. Remove old code incrementally

### Phase 4: Cleanup (1 hour)
1. Remove all old monitor-specific code from services.html
2. Delete unused functions
3. Update documentation
4. Final testing

**Total Estimated Time**: 6-8 hours

---

## Backward Compatibility

### Concerns
- Existing monitors in database continue to work (backend unchanged)
- Form IDs might change (could break bookmarks/scripts)
- JavaScript module imports (ES6 modules need HTTP server)

### Solutions
- Keep form ID naming consistent with current pattern
- Use module bundler (optional) or ensure proper MIME types
- Test thoroughly with existing monitors in database

---

## Alternative Approaches Considered

### 1. **Template Literals in JavaScript**
- **Pros**: No new files, simpler
- **Cons**: Still requires manual registration, HTML in JS strings is ugly

### 2. **Web Components**
- **Pros**: True encapsulation, reusable
- **Cons**: Browser compatibility, learning curve, overkill for this

### 3. **Separate HTML Template Files**
- **Pros**: Clean separation of HTML/JS
- **Cons**: More HTTP requests, template loading complexity

### 4. **Backend-Driven Templates**
- **Pros**: Single source of truth (backend)
- **Cons**: Requires API changes, more backend complexity

**Decision**: Plugin-based JavaScript modules strike best balance of simplicity and power.

---

## Future Enhancements

Once plugin system is in place:

1. **Monitor Marketplace**: Share community-created monitors
2. **Dynamic Loading**: Load monitors from backend API
3. **Monitor Versioning**: Support multiple versions of same monitor
4. **Conditional Fields**: Show/hide fields based on other field values
5. **Field Dependencies**: One field's value affects another's options
6. **Custom Validators**: More complex validation rules
7. **Preview/Test**: Test monitor config before saving
8. **Import/Export**: Share monitor configs as JSON

---

## Breaking Changes

### What Breaks
- Direct JavaScript calls to `createWebsiteMonitor()` etc. (if any external scripts use them)
- Hard-coded form IDs in test automation (if exists)

### Migration Path
- **No backend changes required**
- **No database changes required**
- Frontend changes are internal only
- Existing monitors continue to work

---

## Success Criteria

### Definition of Done
- [ ] All 6 monitor types work as plugins
- [ ] services.html under 500 lines
- [ ] Adding new monitor requires only 1 file + 1 line in registry
- [ ] All existing functionality preserved (create, edit, delete)
- [ ] Form validation works correctly
- [ ] Icons display properly
- [ ] No console errors
- [ ] Dashboard integration works
- [ ] Edit monitor populates forms correctly
- [ ] All interval options work

### Testing Checklist
- [ ] Create each monitor type via Quick Monitor
- [ ] Add each monitor type to existing service
- [ ] Edit each monitor type
- [ ] Delete monitors
- [ ] Verify monitor checks run correctly
- [ ] Check browser console for errors
- [ ] Test on different browsers (Chrome, Firefox, Safari)
- [ ] Verify mobile responsiveness

---

## Code Smell Detection

### Before Refactor
```javascript
// 12 different functions, 200+ lines each
function createWebsiteMonitor() { /* ... */ }
function createApiMonitor() { /* ... */ }
function createMetricMonitor() { /* ... */ }
function createPortMonitor() { /* ... */ }
function createDeadmanMonitor() { /* ... */ }
function createSSLCertMonitor() { /* ... */ }
// ... 6 more for "add to service"
// ... 6 more for "edit"
// = 18 nearly identical functions!
```

### After Refactor
```javascript
// 1 generic function, ~30 lines
async function createMonitor(type, serviceName) {
    const monitor = monitorRegistry.get(type);
    const config = monitor.extractConfig(getFormPrefix(type, 'quick'));
    const error = monitor.validate?.(config);
    if (error) return showError(error);

    const service = await api.createService({...});
    await api.createMonitor({...});

    showSuccess(`${monitor.name} created`);
}
```

**Code Reduction**: ~3600 lines → ~500 lines (85% reduction)

---

## Risk Assessment

### High Risk
- ⚠️ **Breaking existing functionality**: Thorough testing required
- ⚠️ **Module loading in browser**: Ensure proper MIME types

### Medium Risk
- ⚠️ **Form ID changes**: Existing bookmarks/scripts might break
- ⚠️ **Validation changes**: Ensure same validation behavior

### Low Risk
- ✅ **Backend unchanged**: No database migrations needed
- ✅ **Gradual migration**: Can migrate one monitor at a time
- ✅ **Backwards compatible**: Old monitors in DB still work

---

## Recommended Next Steps

1. **Review this document** with team/stakeholders
2. **Create proof of concept** with one monitor (website)
3. **Validate approach** with real-world testing
4. **Proceed with full migration** if POC successful
5. **Document new monitor creation process** for future contributors

---

## Questions to Resolve

1. **ES6 Modules**: Do we need a build step (webpack/rollup) or serve as modules?
2. **Form Templates**: Generate HTML in JS or load from template files?
3. **Validation Library**: Use existing validation or build custom?
4. **Icon System**: Keep current approach or include in monitor plugin?
5. **Testing Strategy**: Unit tests for each monitor or integration tests only?

---

## Example: Adding a New Monitor (After Refactor)

```javascript
// frontend/js/monitors/dns-monitor.js

export default {
    type: 'dns',
    name: 'DNS Record',
    description: 'Check DNS record values',
    icon: 'dns', // Add to icons.js
    defaultInterval: 60,

    schema: {
        domain: {
            type: 'text',
            label: 'Domain',
            placeholder: 'example.com',
            required: true
        },
        record_type: {
            type: 'select',
            label: 'Record Type',
            options: ['A', 'AAAA', 'MX', 'TXT', 'CNAME'],
            default: 'A',
            required: true
        },
        expected_value: {
            type: 'text',
            label: 'Expected Value',
            placeholder: '192.168.1.1',
            required: false,
            hint: 'Leave empty to just check existence'
        }
    },

    intervalOptions: [
        { value: 5, label: 'Every 5 minutes' },
        { value: 15, label: 'Every 15 minutes' },
        { value: 60, label: 'Every 1 hour' }
    ],

    validate(config) {
        if (!config.domain.includes('.')) {
            return 'Invalid domain format';
        }
        return null;
    },

    extractConfig(formPrefix) {
        return {
            domain: document.getElementById(`${formPrefix}Domain`).value,
            record_type: document.getElementById(`${formPrefix}RecordType`).value,
            expected_value: document.getElementById(`${formPrefix}ExpectedValue`).value
        };
    },

    populateForm(formPrefix, config) {
        document.getElementById(`${formPrefix}Domain`).value = config.domain;
        document.getElementById(`${formPrefix}RecordType`).value = config.record_type;
        document.getElementById(`${formPrefix}ExpectedValue`).value = config.expected_value || '';
    }
};
```

**That's it!** Add one line to registry to load it, and the DNS monitor is fully integrated.

---

## Conclusion

This refactoring transforms SimpleWatch's frontend from a monolithic structure to a maintainable, extensible plugin-based architecture. The 85% code reduction and atomic monitor addition process will significantly improve developer experience and reduce bugs when adding new monitor types.

**Recommendation**: Proceed with Phase 1 (infrastructure) and Phase 2 (one monitor POC) to validate approach before full migration.
