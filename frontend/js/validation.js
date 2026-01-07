/**
 * Centralized validation rules for SimpleWatch.
 * These rules must match the backend validation in backend/utils/password_validation.py
 */

const ValidationRules = {
    username: {
        minLength: 3,
        maxLength: 255
    },
    password: {
        minLength: 8
    }
};

/**
 * Validate username according to application rules.
 *
 * @param {string} username - The username to validate
 * @returns {Object} - { valid: boolean, error: string }
 */
function validateUsername(username) {
    if (!username || username.trim().length === 0) {
        return { valid: false, error: 'Username is required' };
    }

    const trimmed = username.trim();

    if (trimmed.length < ValidationRules.username.minLength) {
        return { valid: false, error: `Username must be at least ${ValidationRules.username.minLength} characters long` };
    }

    if (trimmed.length > ValidationRules.username.maxLength) {
        return { valid: false, error: `Username must not exceed ${ValidationRules.username.maxLength} characters` };
    }

    return { valid: true, error: '' };
}

/**
 * Validate password according to application rules.
 *
 * @param {string} password - The password to validate
 * @returns {Object} - { valid: boolean, error: string }
 */
function validatePassword(password) {
    if (!password) {
        return { valid: false, error: 'Password is required' };
    }

    if (password.length < ValidationRules.password.minLength) {
        return { valid: false, error: `Password must be at least ${ValidationRules.password.minLength} characters long` };
    }

    // Check for uppercase letter
    if (!/[A-Z]/.test(password)) {
        return { valid: false, error: 'Password must contain at least one uppercase letter' };
    }

    // Check for special character
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
        return { valid: false, error: 'Password must contain at least one special character' };
    }

    return { valid: true, error: '' };
}

/**
 * Validate that password and confirmation match.
 *
 * @param {string} password - The password
 * @param {string} confirmPassword - The confirmation password
 * @returns {Object} - { valid: boolean, error: string }
 */
function validatePasswordMatch(password, confirmPassword) {
    if (password !== confirmPassword) {
        return { valid: false, error: 'Passwords do not match' };
    }

    return { valid: true, error: '' };
}

/**
 * Get password requirements as human-readable text.
 *
 * @returns {string} - Password requirements description
 */
function getPasswordRequirements() {
    return `Minimum ${ValidationRules.password.minLength} characters, one uppercase letter, one special character`;
}

/**
 * Get username requirements as human-readable text.
 *
 * @returns {string} - Username requirements description
 */
function getUsernameRequirements() {
    return `Minimum ${ValidationRules.username.minLength} characters`;
}
