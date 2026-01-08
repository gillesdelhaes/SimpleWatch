/**
 * Maintenance Windows JavaScript
 * Handles scheduling, viewing, and managing maintenance windows
 */

// ============================================
// Maintenance Icons
// ============================================

const maintenanceIcons = {
    wrench: `<svg viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M14.5 10a4.5 4.5 0 004.284-5.882c-.105-.324-.51-.391-.752-.15L15.34 6.66a.454.454 0 01-.493.11 3.01 3.01 0 01-1.618-1.616.455.455 0 01.11-.494l2.694-2.692c.24-.241.174-.647-.15-.752a4.5 4.5 0 00-5.873 4.575c.055.873-.128 1.808-.8 2.368l-7.23 6.024a2.724 2.724 0 103.837 3.837l6.024-7.23c.56-.672 1.495-.855 2.368-.8.096.007.193.01.29.01zM5 16a1 1 0 11-2 0 1 1 0 012 0z" clip-rule="evenodd"/>
    </svg>`,

    calendar: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="14" height="14" rx="2"/>
        <path d="M3 8h14M7 2v4M13 2v4"/>
    </svg>`,

    repeat: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 2v6h-6"/>
        <path d="M3 10a7 7 0 0112.9-3.9L17 8"/>
        <path d="M3 18v-6h6"/>
        <path d="M17 10a7 7 0 01-12.9 3.9L3 12"/>
    </svg>`,

    stopCircle: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="10" cy="10" r="8"/>
        <rect x="7" y="7" width="6" height="6" rx="1"/>
    </svg>`
};

// Add to global icons
if (window.icons) {
    window.icons = { ...window.icons, ...maintenanceIcons };
}

// ============================================
// Maintenance Modal Functions
// ============================================

let currentMaintenanceServiceId = null;

/**
 * Open maintenance modal for a service
 */
async function openMaintenanceModal(serviceId, serviceName) {
    currentMaintenanceServiceId = serviceId;

    // Create modal if it doesn't exist
    let modal = document.getElementById('maintenanceModal');
    if (!modal) {
        modal = createMaintenanceModal();
        document.body.appendChild(modal);
    }

    // Update title
    document.getElementById('maintenanceModalTitle').innerHTML = `
        <span class="icon">${maintenanceIcons.wrench}</span>
        Maintenance: ${serviceName}
    `;

    // Load maintenance windows
    await loadMaintenanceWindows(serviceId);

    // Show modal
    modal.classList.remove('hidden');

    // Reset form
    resetMaintenanceForm();
}

/**
 * Close maintenance modal
 */
function closeMaintenanceModal() {
    const modal = document.getElementById('maintenanceModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    currentMaintenanceServiceId = null;
}

/**
 * Create maintenance modal HTML
 */
function createMaintenanceModal() {
    const modal = document.createElement('div');
    modal.id = 'maintenanceModal';
    modal.className = 'modal hidden';

    modal.innerHTML = `
        <div class="modal-content maintenance-modal">
            <div class="modal-header">
                <h3 class="modal-title" id="maintenanceModalTitle">
                    <span class="icon">${maintenanceIcons.wrench}</span>
                    Maintenance Windows
                </h3>
                <button onclick="closeMaintenanceModal()" class="modal-close">
                    ${icons.x}
                </button>
            </div>

            <div id="maintenanceList" class="maintenance-list">
                <!-- Windows loaded here -->
            </div>

            <div class="maintenance-form">
                <h4 class="maintenance-form-title">
                    <span class="icon">${icons.plus}</span>
                    Schedule Maintenance
                </h4>

                <form id="maintenanceForm" onsubmit="submitMaintenanceForm(event)">
                    <div class="datetime-row">
                        <div class="form-group">
                            <label class="form-label">Start Time</label>
                            <input type="datetime-local" id="maintenanceStartTime" class="form-input" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">End Time</label>
                            <input type="datetime-local" id="maintenanceEndTime" class="form-input" required>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Recurrence</label>
                        <div class="recurrence-options">
                            <div class="recurrence-option">
                                <input type="radio" name="recurrence" id="recurrenceNone" value="none" checked>
                                <label for="recurrenceNone">One-time</label>
                            </div>
                            <div class="recurrence-option">
                                <input type="radio" name="recurrence" id="recurrenceDaily" value="daily">
                                <label for="recurrenceDaily">Daily</label>
                            </div>
                            <div class="recurrence-option">
                                <input type="radio" name="recurrence" id="recurrenceWeekly" value="weekly">
                                <label for="recurrenceWeekly">Weekly</label>
                            </div>
                            <div class="recurrence-option">
                                <input type="radio" name="recurrence" id="recurrenceMonthly" value="monthly">
                                <label for="recurrenceMonthly">Monthly</label>
                            </div>
                        </div>
                    </div>

                    <div id="weeklyDaysContainer" class="form-group hidden">
                        <label class="form-label">Repeat on</label>
                        <div class="weekly-days">
                            <div class="day-toggle">
                                <input type="checkbox" id="day0" value="0">
                                <label for="day0">Mon</label>
                            </div>
                            <div class="day-toggle">
                                <input type="checkbox" id="day1" value="1">
                                <label for="day1">Tue</label>
                            </div>
                            <div class="day-toggle">
                                <input type="checkbox" id="day2" value="2">
                                <label for="day2">Wed</label>
                            </div>
                            <div class="day-toggle">
                                <input type="checkbox" id="day3" value="3">
                                <label for="day3">Thu</label>
                            </div>
                            <div class="day-toggle">
                                <input type="checkbox" id="day4" value="4">
                                <label for="day4">Fri</label>
                            </div>
                            <div class="day-toggle">
                                <input type="checkbox" id="day5" value="5">
                                <label for="day5">Sat</label>
                            </div>
                            <div class="day-toggle">
                                <input type="checkbox" id="day6" value="6">
                                <label for="day6">Sun</label>
                            </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Reason (optional)</label>
                        <input type="text" id="maintenanceReason" class="form-input" placeholder="e.g., Server updates, Database migration...">
                    </div>

                    <button type="submit" class="btn btn-primary" style="width: 100%;">
                        Schedule Maintenance
                    </button>
                </form>
            </div>
        </div>
    `;

    // Add event listeners for recurrence options
    modal.querySelectorAll('input[name="recurrence"]').forEach(radio => {
        radio.addEventListener('change', handleRecurrenceChange);
    });

    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeMaintenanceModal();
        }
    });

    return modal;
}

/**
 * Handle recurrence type change
 */
function handleRecurrenceChange(e) {
    const weeklyContainer = document.getElementById('weeklyDaysContainer');
    if (e.target.value === 'weekly') {
        weeklyContainer.classList.remove('hidden');
    } else {
        weeklyContainer.classList.add('hidden');
    }
}

/**
 * Load maintenance windows for a service
 */
async function loadMaintenanceWindows(serviceId) {
    const container = document.getElementById('maintenanceList');

    try {
        const response = await authenticatedFetch(`/api/v1/maintenance/?service_id=${serviceId}`);
        const windows = response.maintenance_windows || [];

        if (windows.length === 0) {
            container.innerHTML = `
                <div class="maintenance-empty">
                    <div class="icon">${maintenanceIcons.calendar}</div>
                    <h4>No maintenance scheduled</h4>
                    <p>Schedule maintenance to suppress notifications during planned downtime.</p>
                </div>
            `;
            return;
        }

        // Sort: active first, then scheduled, then completed
        const statusOrder = { 'active': 0, 'scheduled': 1, 'completed': 2, 'cancelled': 3 };
        windows.sort((a, b) => {
            const orderDiff = statusOrder[a.status] - statusOrder[b.status];
            if (orderDiff !== 0) return orderDiff;
            return new Date(b.start_time) - new Date(a.start_time);
        });

        container.innerHTML = windows.map(w => renderMaintenanceItem(w)).join('');
    } catch (error) {
        console.error('Failed to load maintenance windows:', error);
        container.innerHTML = `
            <div class="maintenance-empty">
                <div class="icon">${icons.alertTriangle}</div>
                <h4>Failed to load maintenance windows</h4>
                <p>${error.message}</p>
            </div>
        `;
    }
}

/**
 * Render a single maintenance window item
 */
function renderMaintenanceItem(window) {
    const startTime = formatDateTime(window.start_time);
    const endTime = formatDateTime(window.end_time);

    const recurrenceLabels = {
        'none': '',
        'daily': 'Repeats daily',
        'weekly': 'Repeats weekly',
        'monthly': 'Repeats monthly',
        'monthly_weekday': 'Repeats monthly'
    };

    const statusClasses = {
        'active': 'active',
        'scheduled': 'scheduled',
        'completed': 'completed',
        'cancelled': 'completed'
    };

    const statusLabels = {
        'active': 'In Progress',
        'scheduled': 'Scheduled',
        'completed': 'Completed',
        'cancelled': 'Cancelled'
    };

    return `
        <div class="maintenance-item ${statusClasses[window.status]}">
            <div class="maintenance-item-header">
                <span class="maintenance-item-status maintenance-status-${window.status}">
                    ${statusLabels[window.status]}
                </span>
                <div class="maintenance-item-actions">
                    ${window.status === 'active' ? `
                        <button class="icon-btn" onclick="cancelMaintenance(${window.id})" title="End maintenance early">
                            ${maintenanceIcons.stopCircle}
                        </button>
                    ` : ''}
                    ${window.status === 'scheduled' ? `
                        <button class="icon-btn delete" onclick="deleteMaintenance(${window.id})" title="Delete">
                            ${icons.trash}
                        </button>
                    ` : ''}
                </div>
            </div>

            <div class="maintenance-item-time">
                <div class="maintenance-time-block">
                    <span class="icon">${icons.clock}</span>
                    <span class="maintenance-time-label">Start:</span>
                    <span class="maintenance-time-value">${startTime}</span>
                </div>
                <div class="maintenance-time-block">
                    <span class="icon">${icons.clock}</span>
                    <span class="maintenance-time-label">End:</span>
                    <span class="maintenance-time-value">${endTime}</span>
                </div>
            </div>

            ${window.reason ? `
                <div class="maintenance-item-reason">${escapeHtml(window.reason)}</div>
            ` : ''}

            ${window.recurrence_type !== 'none' ? `
                <div class="maintenance-item-recurrence">
                    <span class="icon">${maintenanceIcons.repeat}</span>
                    ${recurrenceLabels[window.recurrence_type]}
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Submit maintenance form
 */
async function submitMaintenanceForm(event) {
    event.preventDefault();

    const startTime = document.getElementById('maintenanceStartTime').value;
    const endTime = document.getElementById('maintenanceEndTime').value;
    const reason = document.getElementById('maintenanceReason').value;
    const recurrenceType = document.querySelector('input[name="recurrence"]:checked').value;

    // Validate times
    if (new Date(endTime) <= new Date(startTime)) {
        showError('End time must be after start time');
        return;
    }

    // Build recurrence config for weekly
    let recurrenceConfig = null;
    if (recurrenceType === 'weekly') {
        const selectedDays = Array.from(document.querySelectorAll('.weekly-days input:checked'))
            .map(cb => parseInt(cb.value));

        if (selectedDays.length === 0) {
            showError('Please select at least one day for weekly recurrence');
            return;
        }
        recurrenceConfig = { days: selectedDays };
    }

    try {
        await authenticatedFetch('/api/v1/maintenance/', {
            method: 'POST',
            body: JSON.stringify({
                service_id: currentMaintenanceServiceId,
                start_time: new Date(startTime).toISOString(),
                end_time: new Date(endTime).toISOString(),
                recurrence_type: recurrenceType,
                recurrence_config: recurrenceConfig,
                reason: reason || null
            })
        });

        showSuccess('Maintenance window scheduled');
        resetMaintenanceForm();
        await loadMaintenanceWindows(currentMaintenanceServiceId);
    } catch (error) {
        showError('Failed to schedule maintenance: ' + error.message);
    }
}

/**
 * Cancel active maintenance early
 */
async function cancelMaintenance(windowId) {
    const confirmed = await showConfirm(
        'Are you sure you want to end this maintenance window early?',
        {
            title: 'End Maintenance',
            confirmText: 'End Now',
            cancelText: 'Keep Active',
            confirmClass: 'btn-primary'
        }
    );

    if (!confirmed) return;

    try {
        await authenticatedFetch(`/api/v1/maintenance/${windowId}/cancel`, {
            method: 'POST'
        });
        showSuccess('Maintenance ended');
        await loadMaintenanceWindows(currentMaintenanceServiceId);

        // Reload services if on services page
        if (typeof loadServices === 'function') {
            loadServices();
        }
    } catch (error) {
        showError('Failed to end maintenance: ' + error.message);
    }
}

/**
 * Delete scheduled maintenance
 */
async function deleteMaintenance(windowId) {
    const confirmed = await showConfirm(
        'Are you sure you want to delete this scheduled maintenance?',
        {
            title: 'Delete Maintenance',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            confirmClass: 'btn-danger'
        }
    );

    if (!confirmed) return;

    try {
        await authenticatedFetch(`/api/v1/maintenance/${windowId}`, {
            method: 'DELETE'
        });
        showSuccess('Maintenance deleted');
        await loadMaintenanceWindows(currentMaintenanceServiceId);
    } catch (error) {
        showError('Failed to delete maintenance: ' + error.message);
    }
}

/**
 * Reset maintenance form
 */
function resetMaintenanceForm() {
    const form = document.getElementById('maintenanceForm');
    if (form) {
        form.reset();

        // Set default start time to now + 1 hour
        const now = new Date();
        now.setHours(now.getHours() + 1);
        now.setMinutes(0, 0, 0);
        document.getElementById('maintenanceStartTime').value = formatDateTimeLocal(now);

        // Set default end time to start + 1 hour
        const end = new Date(now);
        end.setHours(end.getHours() + 1);
        document.getElementById('maintenanceEndTime').value = formatDateTimeLocal(end);

        // Hide weekly days
        document.getElementById('weeklyDaysContainer').classList.add('hidden');
    }
}

// ============================================
// Dashboard Maintenance Badge Functions
// ============================================

/**
 * Render maintenance badge for dashboard card
 */
function renderMaintenanceBadge(maintenance) {
    if (!maintenance) return '';

    if (maintenance.in_maintenance && maintenance.active_maintenance) {
        return `
            <div class="maintenance-badge-container">
                <span class="maintenance-badge maintenance-badge-active">
                    <span class="icon">${maintenanceIcons.wrench}</span>
                    In Maintenance
                </span>
            </div>
        `;
    }

    // Check for upcoming maintenance within 24 hours
    if (maintenance.upcoming_maintenance) {
        const upcoming = maintenance.upcoming_maintenance;
        const startTime = new Date(upcoming.start_time);
        const now = new Date();
        const hoursUntil = (startTime - now) / (1000 * 60 * 60);

        if (hoursUntil <= 24 && hoursUntil > 0) {
            return `
                <div class="maintenance-badge-container">
                    <span class="maintenance-badge maintenance-badge-scheduled">
                        <span class="icon">${maintenanceIcons.calendar}</span>
                        Scheduled
                    </span>
                </div>
            `;
        }
    }

    return '';
}

/**
 * Check if service is in maintenance (for dashboard card styling)
 */
function isServiceInMaintenance(service) {
    return service.maintenance && service.maintenance.in_maintenance;
}

// ============================================
// Public Status Page Functions
// ============================================

/**
 * Render maintenance banner for public status page
 */
function renderStatusMaintenanceBanner(maintenance) {
    if (!maintenance) return '';

    // Active maintenance banner
    if (maintenance.in_maintenance && maintenance.active_maintenance) {
        const mw = maintenance.active_maintenance;
        const endTime = formatDateTime(mw.end_time);

        return `
            <div class="status-maintenance-banner">
                <div class="maintenance-banner-icon">
                    <span class="icon">${maintenanceIcons.wrench}</span>
                </div>
                <div class="maintenance-banner-content">
                    <div class="maintenance-banner-title">Scheduled Maintenance In Progress</div>
                    ${mw.reason ? `<div class="maintenance-banner-reason">${escapeHtml(mw.reason)}</div>` : ''}
                    <div class="maintenance-banner-time">
                        <span class="icon">${icons.clock}</span>
                        Expected to end: ${endTime}
                    </div>
                </div>
            </div>
        `;
    }

    // Upcoming maintenance banner (within 24 hours)
    if (maintenance.upcoming_maintenance) {
        const upcoming = maintenance.upcoming_maintenance;
        const startTime = new Date(upcoming.start_time);
        const now = new Date();
        const hoursUntil = (startTime - now) / (1000 * 60 * 60);

        if (hoursUntil <= 24 && hoursUntil > 0) {
            return `
                <div class="status-maintenance-banner scheduled">
                    <div class="maintenance-banner-icon">
                        <span class="icon">${maintenanceIcons.calendar}</span>
                    </div>
                    <div class="maintenance-banner-content">
                        <div class="maintenance-banner-title">Maintenance Scheduled</div>
                        ${upcoming.reason ? `<div class="maintenance-banner-reason">${escapeHtml(upcoming.reason)}</div>` : ''}
                        <div class="maintenance-banner-time">
                            <span class="icon">${icons.clock}</span>
                            Starting: ${formatDateTime(upcoming.start_time)}
                        </div>
                    </div>
                </div>
            `;
        }
    }

    return '';
}

// ============================================
// Utility Functions
// ============================================

/**
 * Format date for datetime-local input
 */
function formatDateTimeLocal(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Format datetime for display (converts UTC to local timezone)
 */
function formatDateTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// Export functions to global scope
// ============================================

window.openMaintenanceModal = openMaintenanceModal;
window.closeMaintenanceModal = closeMaintenanceModal;
window.cancelMaintenance = cancelMaintenance;
window.deleteMaintenance = deleteMaintenance;
window.renderMaintenanceBadge = renderMaintenanceBadge;
window.isServiceInMaintenance = isServiceInMaintenance;
window.renderStatusMaintenanceBanner = renderStatusMaintenanceBanner;
window.maintenanceIcons = maintenanceIcons;
