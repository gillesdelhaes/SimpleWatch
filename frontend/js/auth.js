/**
 * Authentication utilities.
 */

function isAuthenticated() {
    return localStorage.getItem('token') !== null;
}

function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = '/static/login.html';
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('apiKey');
    localStorage.removeItem('username');
    localStorage.removeItem('isAdmin');
    window.location.href = '/static/login.html';
}

function getUserInfo() {
    return {
        username: localStorage.getItem('username'),
        apiKey: localStorage.getItem('apiKey'),
        isAdmin: localStorage.getItem('isAdmin') === 'true'
    };
}
