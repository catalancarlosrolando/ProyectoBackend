/**
 * =============================================
 * Difexa Frontend - Core (Estado, Storage, API)
 * =============================================
 */

// ── Configuración ──
const API_BASE = '/api';
const TOKEN_KEY = 'difexa_token';
const USER_KEY = 'difexa_user';

// ── Estado global ──
const state = {
    isAuthenticated: false,
    user: null,
    token: null,
    roles: [],
    permissions: [],
    selectedFiles: [],
    confirmCallback: null,
    // Admin users
    adminUsers: {
        currentPage: 1,
        lastPage: 1,
        selectedUserId: null,
        statusChangeAction: null,
        statusChangeUserId: null,
        roleAction: null,
        roleUserId: null,
        sortBy: null,
        sortOrder: null,
    },
    // Channels
    channels: {
        selectedChannelId: null,
        editingChannelId: null,
        mediaAssignChannelId: null,
    },
};

// ── Storage ──
const storage = {
    setToken(t) { localStorage.setItem(TOKEN_KEY, t); },
    getToken() { return localStorage.getItem(TOKEN_KEY); },
    setUser(u) { localStorage.setItem(USER_KEY, JSON.stringify(u)); },
    getUser() { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } },
    clear() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); },
};

// ── API Client ──
const api = {
    async request(method, endpoint, { body = null, auth = false, isFormData = false } = {}) {
        const headers = { 'Accept': 'application/json' };
        if (auth && state.token) headers['Authorization'] = `Bearer ${state.token}`;
        if (!isFormData) headers['Content-Type'] = 'application/json';

        const opts = { method, headers };
        if (body) {
            opts.body = isFormData ? body : JSON.stringify(body);
        }

        const res = await fetch(`${API_BASE}${endpoint}`, opts);
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            const msg = data.errors
                ? Object.values(data.errors).flat().join(', ')
                : data.message || `Error HTTP ${res.status}`;
            throw new Error(msg);
        }
        return data;
    },

    get(ep, auth = false) { return this.request('GET', ep, { auth }); },
    post(ep, body, auth = false) { return this.request('POST', ep, { body, auth }); },
    del(ep, auth = false) { return this.request('DELETE', ep, { auth }); },
    upload(ep, formData) { return this.request('POST', ep, { body: formData, isFormData: true }); },
};
