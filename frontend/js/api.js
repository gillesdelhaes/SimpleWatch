/**
 * API client for SimpleWatch backend.
 */

const API_BASE = '/api/v1';

class APIClient {
    constructor() {
        this.token = localStorage.getItem('token');
        this.apiKey = localStorage.getItem('apiKey');
    }

    async request(url, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token && !url.includes('/auth/login')) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(url, {
            ...options,
            headers
        });

        if (response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('apiKey');
            window.location.href = '/static/login.html';
            throw new Error('Unauthorized');
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || data.detail || 'Request failed');
        }

        return data;
    }

    async login(username, password) {
        const data = await this.request(`${API_BASE}/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        this.token = data.access_token;
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('username', data.username);
        localStorage.setItem('isAdmin', data.is_admin);

        const userInfo = await this.getCurrentUser();
        localStorage.setItem('apiKey', userInfo.api_key);
        this.apiKey = userInfo.api_key;

        return data;
    }

    async getCurrentUser() {
        return this.request(`${API_BASE}/users/me`);
    }

    async listServices() {
        return this.request(`${API_BASE}/services`);
    }

    async createService(serviceData) {
        return this.request(`${API_BASE}/services`, {
            method: 'POST',
            body: JSON.stringify(serviceData)
        });
    }

    async getService(serviceId) {
        return this.request(`${API_BASE}/services/${serviceId}`);
    }

    async updateService(serviceId, serviceData) {
        return this.request(`${API_BASE}/services/${serviceId}`, {
            method: 'PUT',
            body: JSON.stringify(serviceData)
        });
    }

    async deleteService(serviceId) {
        return this.request(`${API_BASE}/services/${serviceId}`, {
            method: 'DELETE'
        });
    }

    async getServiceHistory(serviceId, limit = 100) {
        return this.request(`${API_BASE}/services/${serviceId}/history?limit=${limit}`);
    }

    async getAllStatus() {
        return this.request(`${API_BASE}/status/all`);
    }

    async getStatus(serviceName) {
        return this.request(`${API_BASE}/status/${serviceName}`);
    }

    async listMonitors() {
        return this.request(`${API_BASE}/monitors`);
    }

    async createMonitor(monitorData) {
        return this.request(`${API_BASE}/monitors`, {
            method: 'POST',
            body: JSON.stringify(monitorData)
        });
    }

    async getMonitor(monitorId) {
        return this.request(`${API_BASE}/monitors/${monitorId}`);
    }

    async updateMonitor(monitorId, monitorData) {
        return this.request(`${API_BASE}/monitors/${monitorId}`, {
            method: 'PUT',
            body: JSON.stringify(monitorData)
        });
    }

    async deleteMonitor(monitorId) {
        return this.request(`${API_BASE}/monitors/${monitorId}`, {
            method: 'DELETE'
        });
    }

    async listUsers() {
        return this.request(`${API_BASE}/users`);
    }

    async createUser(userData) {
        return this.request(`${API_BASE}/users`, {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async deleteUser(userId) {
        return this.request(`${API_BASE}/users/${userId}`, {
            method: 'DELETE'
        });
    }

    async changePassword(userId, currentPassword, newPassword) {
        return this.request(`${API_BASE}/users/${userId}/password`, {
            method: 'PUT',
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword
            })
        });
    }

    async regenerateApiKey() {
        return this.request(`${API_BASE}/users/me/regenerate-api-key`, {
            method: 'POST'
        });
    }

    async listWebhooks() {
        return this.request(`${API_BASE}/webhooks`);
    }

    async createWebhook(webhookData) {
        return this.request(`${API_BASE}/webhooks`, {
            method: 'POST',
            body: JSON.stringify(webhookData)
        });
    }

    async deleteWebhook(webhookId) {
        return this.request(`${API_BASE}/webhooks/${webhookId}`, {
            method: 'DELETE'
        });
    }

    async toggleWebhook(webhookId) {
        return this.request(`${API_BASE}/webhooks/${webhookId}/toggle`, {
            method: 'PUT'
        });
    }

    // Incidents API
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = `${API_BASE}${endpoint}${queryString ? '?' + queryString : ''}`;
        return this.request(url);
    }
}

const api = new APIClient();

// Helper function for authenticated fetch (used by some pages)
async function authenticatedFetch(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    const token = localStorage.getItem('token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('apiKey');
        window.location.href = '/static/login.html';
        throw new Error('Unauthorized');
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || data.detail || 'Request failed');
    }

    return data;
}
