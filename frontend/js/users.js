/**
 * Users Page JavaScript
 * Handles user management, password changes, and admin functions
 */

requireAuth();

const userInfo = getUserInfo();

if (!userInfo.isAdmin) {
    window.location.href = '/static/dashboard.html';
}

let changingUserId = null;

// Set validation hints from centralized rules
document.getElementById('addUserUsernameHint').textContent = getUsernameRequirements();
document.getElementById('addUserPasswordHint').textContent = getPasswordRequirements();
document.getElementById('changePasswordHint').textContent = getPasswordRequirements();

async function loadUsers() {
    try {
        const users = await api.listUsers();
        const usersList = document.getElementById('usersList');

        usersList.innerHTML = users.map(user => `
            <div class="user-item">
                <div class="user-info">
                    <div class="user-name">
                        ${user.username}
                        ${user.is_admin ? '<span class="user-badge">Admin</span>' : ''}
                    </div>
                    <div class="user-meta">${user.email || 'No email'}</div>
                </div>
                <div class="user-actions">
                    ${!(user.username != userInfo.username && user.is_admin) ? `
                        <button class="icon-btn" onclick="showChangePasswordModal(${user.id}, '${user.username}')" title="Change password">
                            <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"></path>
                            </svg>
                        </button>
                    ` : ''}
                    ${user.id != userInfo.id ? `
                        <button class="icon-btn delete" onclick="deleteUser(${user.id}, '${user.username}')" title="Delete user">
                            <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                            </svg>
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

function showAddUserModal() {
    document.getElementById('addUserModal').classList.remove('hidden');
}

function hideAddUserModal() {
    document.getElementById('addUserModal').classList.add('hidden');
    document.getElementById('addUserForm').reset();
}

function showChangePasswordModal(userId, username) {
    changingUserId = userId;
    document.getElementById('changePasswordUsername').textContent = username;

    if (username === userInfo.username) {
        document.getElementById('currentPasswordField').classList.remove('hidden');
        document.getElementById('currentPassword').required = true;
    } else {
        document.getElementById('currentPasswordField').classList.add('hidden');
        document.getElementById('currentPassword').required = false;
    }

    document.getElementById('changePasswordModal').classList.remove('hidden');
}

function hideChangePasswordModal() {
    document.getElementById('changePasswordModal').classList.add('hidden');
    document.getElementById('changePasswordForm').reset();
    changingUserId = null;
}

document.getElementById('addUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value;

    // Client-side validation using centralized rules
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
        showError(usernameValidation.error);
        return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
        showError(passwordValidation.error);
        return;
    }

    try {
        await api.createUser({
            username: username,
            password: password,
            email: document.getElementById('newEmail').value || null,
            is_admin: document.getElementById('newIsAdmin').checked
        });
        hideAddUserModal();
        loadUsers();
        showSuccess('User created successfully!');
    } catch (error) {
        showError('Failed to create user: ' + error.message);
    }
});

document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const newPassword = document.getElementById('changeNewPassword').value;
    const confirmPassword = document.getElementById('confirmNewPassword').value;
    const currentPassword = document.getElementById('currentPassword').value;

    // Client-side validation using centralized rules
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
        showError(passwordValidation.error);
        return;
    }

    const passwordMatchValidation = validatePasswordMatch(newPassword, confirmPassword);
    if (!passwordMatchValidation.valid) {
        showError(passwordMatchValidation.error);
        return;
    }

    try {
        await api.changePassword(changingUserId, currentPassword, newPassword);
        hideChangePasswordModal();
        showSuccess('Password changed successfully!');
    } catch (error) {
        showError('Failed to change password: ' + error.message);
    }
});

async function deleteUser(userId, username) {
    const confirmed = await showConfirm(
        `Are you sure you want to delete user "${username}"?`,
        {
            title: 'Delete User',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            confirmClass: 'btn-danger'
        }
    );
    if (!confirmed) return;

    try {
        await api.deleteUser(userId);
        loadUsers();
        showSuccess('User deleted successfully!');
    } catch (error) {
        showError('Failed to delete user: ' + error.message);
    }
}

// Real-time password match validation for change password form
document.getElementById('confirmNewPassword').addEventListener('input', (e) => {
    const password = document.getElementById('changeNewPassword').value;
    const confirmPassword = e.target.value;

    if (confirmPassword && password !== confirmPassword) {
        e.target.style.borderColor = 'var(--status-down)';
    } else {
        e.target.style.borderColor = 'var(--border-color)';
    }
});

// Close modals on background click
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });
});

loadUsers();
