/**
 * =============================================
 * Difexa Frontend - Core (Estado, Storage, API)
 * =============================================
 */

// ── Configuración ──
const API_BASE = '/api';
const TOKEN_KEY = 'difexa_token';
const USER_KEY = 'difexa_user';
const DEVICE_TOKEN_KEY = 'difexa_device_token';
const DEVICE_KEY = 'difexa_device';

// ── Estado global ──
const state = {
    isAuthenticated: false,
    user: null,
    token: null,
    roles: [],
    permissions: [],
    isDeviceAuthenticated: false,
    device: null,
    deviceToken: null,
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
    // User-Channels (asignación publicadores)
    userChannels: {
        selectedUserId: null,
        assignUserId: null,
        currentPage: 1,
        lastPage: 1,
    },
    // Device-Channels (asignación dispositivos)
    deviceChannels: {
        selectedDeviceId: null,
        assignDeviceId: null,
        currentPage: 1,
        lastPage: 1,
    },
    // Notificaciones
    notifications: {
        items: [],
        unreadCount: 0,
    },
};

// ── Storage ──
const storage = {
    setToken(t) { localStorage.setItem(TOKEN_KEY, t); },
    getToken() { return localStorage.getItem(TOKEN_KEY); },
    setUser(u) { localStorage.setItem(USER_KEY, JSON.stringify(u)); },
    getUser() { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } },
    setDeviceToken(t) { localStorage.setItem(DEVICE_TOKEN_KEY, t); },
    getDeviceToken() { return localStorage.getItem(DEVICE_TOKEN_KEY); },
    setDevice(d) { localStorage.setItem(DEVICE_KEY, JSON.stringify(d)); },
    getDevice() { try { return JSON.parse(localStorage.getItem(DEVICE_KEY)); } catch { return null; } },
    clear() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); },
    clearDevice() { localStorage.removeItem(DEVICE_TOKEN_KEY); localStorage.removeItem(DEVICE_KEY); },
};

// ── API Client ──
const api = {
    async request(method, endpoint, { body = null, auth = false, isFormData = false, token = null } = {}) {
        const headers = { 'Accept': 'application/json' };
        const authToken = token || (auth && state.token ? state.token : null);
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
        if (!isFormData && body !== null) headers['Content-Type'] = 'application/json';

        const controller = new AbortController();
        const timeoutMs = 15000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const opts = { method, headers, signal: controller.signal };
        if (body) {
            opts.body = isFormData ? body : JSON.stringify(body);
        }

        let res;
        try {
            res = await fetch(`${API_BASE}${endpoint}`, opts);
        } catch (error) {
            if (error?.name === 'AbortError') {
                throw new Error('La solicitud tardó demasiado y fue cancelada. Intente nuevamente.');
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }

        const contentType = res.headers.get('content-type') || '';
        const raw = await res.text();
        let data = null;

        if (raw) {
            if (contentType.includes('application/json')) {
                try {
                    data = JSON.parse(raw);
                } catch {
                    data = { raw };
                }
            } else {
                data = { raw };
            }
        }

        if (!res.ok) {
            const msg = data?.errors
                ? Object.values(data.errors).flat().join(', ')
                : data?.message || data?.raw || `Error HTTP ${res.status}`;
            throw new Error(msg);
        }
        return data;
    },

    get(ep, auth = false) { return this.request('GET', ep, { auth }); },
    post(ep, body, auth = false) { return this.request('POST', ep, { body, auth }); },
    put(ep, body, auth = false) { return this.request('PUT', ep, { body, auth }); },
    patch(ep, body, auth = false) { return this.request('PATCH', ep, { body, auth }); },
    del(ep, auth = false, body = null) { return this.request('DELETE', ep, { auth, body }); },
    upload(ep, formData) { return this.request('POST', ep, { body: formData, isFormData: true }); },
    authUpload(ep, formData) { return this.request('POST', ep, { body: formData, auth: true, isFormData: true }); },
    authUploadPut(ep, formData) { return this.request('POST', ep, { body: formData, auth: true, isFormData: true }); },
    deviceGet(ep) { return this.request('GET', ep, { token: state.deviceToken }); },
    devicePost(ep, body) { return this.request('POST', ep, { body, token: state.deviceToken }); },
};
