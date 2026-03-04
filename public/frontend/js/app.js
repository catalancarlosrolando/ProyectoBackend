/**
 * =============================================
 * Difexa Frontend Application
 * =============================================
 * Cubre todas las funcionalidades del backend:
 * - Auth: login, register, logout, perfil, forgot/reset password
 * - Files: upload, list, download, delete
 * - Dashboard: panel admin con stats
 * - Admin Users: listado, filtros, aprobación, rechazo,
 *   habilitar/deshabilitar, roles, historial
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

// ── Toast Notifications ──
function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;

    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    toast.innerHTML = `
        <span class="toast__icon">${icons[type] || icons.info}</span>
        <span class="toast__message">${message}</span>
        <button class="toast__close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast--visible'));

    setTimeout(() => {
        toast.classList.remove('toast--visible');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ── Modal helpers ──
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

function showConfirm(title, message, callback) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    state.confirmCallback = callback;
    openModal('confirmModal');
}

// ── Navigation ──
function navigateTo(sectionName) {
    // Deactivate all sections and nav links
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    // Activate target
    const section = document.getElementById('section' + capitalize(sectionName));
    const link = document.querySelector(`[data-section="${sectionName}"]`);
    if (section) section.classList.add('active');
    if (link) link.classList.add('active');

    // Load section data
    if (sectionName === 'files') loadFiles();
    if (sectionName === 'profile') loadProfile();
    if (sectionName === 'dashboard') loadDashboard();
    if (sectionName === 'admin-users') loadAdminUsers();
}

function capitalize(str) {
    // Handle 'admin-users' → 'Admin-users' so it matches id 'sectionAdmin-users'
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── Auth UI Update ──
function updateAuthUI() {
    const authOnlyEls = document.querySelectorAll('.auth-only');
    const adminOnlyEls = document.querySelectorAll('.admin-only');
    const welcome = document.getElementById('userWelcome');
    const btnLogin = document.getElementById('btnLogin');
    const btnRegister = document.getElementById('btnRegister');
    const btnLogout = document.getElementById('btnLogout');
    const guestActions = document.getElementById('guestActions');

    if (state.isAuthenticated) {
        welcome.textContent = `👋 ${state.user?.name || 'Usuario'}`;
        welcome.style.display = 'inline-flex';
        btnLogin.style.display = 'none';
        btnRegister.style.display = 'none';
        btnLogout.style.display = 'inline-flex';
        if (guestActions) guestActions.style.display = 'none';

        authOnlyEls.forEach(el => el.style.display = '');
        const hasAdminAccess = state.permissions.includes('acceder-panel-admin') ||
            state.permissions.includes('gestionar-usuarios');
        adminOnlyEls.forEach(el => el.style.display = hasAdminAccess ? '' : 'none');
    } else {
        welcome.style.display = 'none';
        btnLogin.style.display = '';
        btnRegister.style.display = '';
        btnLogout.style.display = 'none';
        if (guestActions) guestActions.style.display = '';

        authOnlyEls.forEach(el => el.style.display = 'none');
        adminOnlyEls.forEach(el => el.style.display = 'none');
    }
}

// ── Auth Functions ──
function setAuthState(data) {
    state.isAuthenticated = true;
    state.token = data.token;
    state.user = data.user;
    state.roles = data.user.roles || [];
    state.permissions = data.user.permissions || [];
    storage.setToken(data.token);
    storage.setUser(data.user);
}

function clearAuthState() {
    state.isAuthenticated = false;
    state.token = null;
    state.user = null;
    state.roles = [];
    state.permissions = [];
    storage.clear();
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const remember = document.getElementById('rememberMe').checked;
    const errorEl = document.getElementById('loginError');
    const errorMsg = document.getElementById('loginErrorMessage');
    const btn = document.getElementById('btnSubmitLogin');

    errorEl.style.display = 'none';

    if (!email || !password) {
        errorEl.style.display = 'block';
        errorMsg.textContent = 'Completa todos los campos.';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Ingresando...';

    try {
        const res = await api.post('/login', { email, password, remember });
        if (res.status !== 'success') throw new Error(res.message || 'Error en login');

        setAuthState(res.data);
        closeModal('loginModal');
        document.getElementById('loginForm').reset();
        updateAuthUI();
        showToast(`¡Bienvenido, ${state.user.name}!`, 'success');
    } catch (err) {
        errorEl.style.display = 'block';
        errorMsg.textContent = err.message;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Iniciar Sesión';
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const firstName = document.getElementById('registerFirstName').value.trim();
    const lastName = document.getElementById('registerLastName').value.trim();
    const mobile = document.getElementById('registerMobile').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const passwordConfirm = document.getElementById('registerPasswordConfirm').value;
    const semanticContext = document.getElementById('registerSemanticContext').value.trim();
    const errorEl = document.getElementById('registerError');
    const errorMsg = document.getElementById('registerErrorMessage');
    const btn = document.getElementById('btnSubmitRegister');

    errorEl.style.display = 'none';

    if (!firstName || !lastName || !email || !password || !passwordConfirm) {
        errorEl.style.display = 'block';
        errorMsg.textContent = 'Completa todos los campos obligatorios.';
        return;
    }
    if (password !== passwordConfirm) {
        errorEl.style.display = 'block';
        errorMsg.textContent = 'Las contraseñas no coinciden.';
        return;
    }
    if (password.length < 8) {
        errorEl.style.display = 'block';
        errorMsg.textContent = 'La contraseña debe tener al menos 8 caracteres.';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Registrando...';

    try {
        const res = await api.post('/register', {
            first_name: firstName,
            last_name: lastName,
            name: `${firstName} ${lastName}`,
            mobile: mobile || null,
            semantic_context: semanticContext || null,
            email,
            password,
            password_confirmation: passwordConfirm,
        });

        if (res.status !== 'success') throw new Error(res.message || 'Error en registro');

        setAuthState(res.data);
        closeModal('registerModal');
        document.getElementById('registerForm').reset();
        updateAuthUI();
        showToast('¡Cuenta creada exitosamente!', 'success');
    } catch (err) {
        errorEl.style.display = 'block';
        errorMsg.textContent = err.message;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Crear Cuenta';
    }
}

async function handleLogout() {
    try {
        await api.post('/logout', {}, true);
    } catch (e) {
        console.warn('Error en logout:', e);
    }
    clearAuthState();
    updateAuthUI();
    navigateTo('home');
    showToast('Sesión cerrada correctamente.', 'info');
}

async function handleForgotPassword(e) {
    e.preventDefault();
    const email = document.getElementById('forgotEmail').value.trim();
    const errorEl = document.getElementById('forgotError');
    const errorMsg = document.getElementById('forgotErrorMessage');
    const successEl = document.getElementById('forgotSuccess');
    const successMsg = document.getElementById('forgotSuccessMessage');
    const btn = document.getElementById('btnSubmitForgot');

    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    if (!email) {
        errorEl.style.display = 'block';
        errorMsg.textContent = 'Ingresa tu email.';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try {
        const res = await api.post('/password/forgot', { email });
        successEl.style.display = 'block';
        successMsg.textContent = res.message || 'Enlace de recuperación enviado a tu email.';
    } catch (err) {
        errorEl.style.display = 'block';
        errorMsg.textContent = err.message;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Enviar Enlace de Recuperación';
    }
}

async function resendVerification() {
    try {
        const res = await api.post('/email/resend', {}, true);
        showToast(res.message || 'Email de verificación enviado.', 'success');
    } catch (err) {
        showToast(err.message || 'No se pudo enviar el email.', 'error');
    }
}

// ── Home / Landing ──
async function loadLanding() {
    const loading = document.getElementById('homeLoading');
    const content = document.getElementById('homeContent');
    const error = document.getElementById('homeError');

    loading.style.display = 'flex';
    content.style.display = 'none';
    error.style.display = 'none';

    try {
        const data = await api.get('/landing');
        document.getElementById('apiMessage').textContent = data.message || '-';
        document.getElementById('apiVersion').textContent = data.version || '-';
        document.getElementById('apiTimestamp').textContent = formatDate(data.timestamp);
        document.getElementById('apiStatus').textContent = 'Conectado';

        loading.style.display = 'none';
        content.style.display = 'block';
    } catch (err) {
        loading.style.display = 'none';
        error.style.display = 'block';
        document.getElementById('homeErrorMessage').textContent =
            'No se pudo conectar con la API. Verifica que el servidor esté ejecutándose.';
    }
}

async function doPing() {
    const pre = document.querySelector('#pingResult pre');
    pre.textContent = 'Enviando ping...';

    try {
        const start = performance.now();
        const data = await api.get('/ping');
        const ms = Math.round(performance.now() - start);
        pre.textContent = JSON.stringify(data, null, 2) + `\n\n⏱ Tiempo de respuesta: ${ms}ms`;
    } catch (err) {
        pre.textContent = `❌ Error: ${err.message}`;
    }
}

// ── Profile ──
async function loadProfile() {
    if (!state.isAuthenticated) return;

    try {
        const res = await api.get('/user', true);
        const user = res.data?.user || res.data;

        // Update state
        state.user = user;
        state.roles = user.roles || [];
        state.permissions = user.permissions || [];
        storage.setUser(user);

        // Update UI
        document.getElementById('profileAvatar').textContent = (user.name || '?')[0].toUpperCase();
        document.getElementById('profileId').textContent = user.id;
        document.getElementById('profileName').textContent = user.name;
        document.getElementById('profileEmail').textContent = user.email;
        document.getElementById('profileVerified').textContent =
            user.email_verified_at ? '✅ Verificado' : '❌ No verificado';

        // Roles
        const rolesContainer = document.getElementById('profileRoles');
        rolesContainer.innerHTML = (user.roles && user.roles.length)
            ? user.roles.map(r => `<span class="tag tag--primary">${r}</span>`).join('')
            : '<span class="tag tag--muted">Sin roles</span>';

        // Permissions
        const permsContainer = document.getElementById('profilePermissions');
        permsContainer.innerHTML = (user.permissions && user.permissions.length)
            ? user.permissions.map(p => `<span class="tag tag--info">${p}</span>`).join('')
            : '<span class="tag tag--muted">Sin permisos</span>';

        // Token (masked)
        const token = storage.getToken() || '-';
        document.getElementById('profileToken').textContent =
            token.length > 20 ? token.substring(0, 10) + '...' + token.substring(token.length - 6) : token;

        updateAuthUI();
    } catch (err) {
        showToast('Error al cargar perfil: ' + err.message, 'error');
        // Token might be expired
        if (err.message.includes('401') || err.message.includes('Unauthenticated')) {
            clearAuthState();
            updateAuthUI();
            navigateTo('home');
        }
    }
}

// ── Files ──
function setupFileUpload() {
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');

    // Click to select
    uploadZone.addEventListener('click', () => fileInput.click());

    // Drag & drop
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('upload-zone--dragover');
    });
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('upload-zone--dragover');
    });
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('upload-zone--dragover');
        handleFileSelection(e.dataTransfer.files);
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
        handleFileSelection(e.target.files);
    });
}

function handleFileSelection(files) {
    const fileArray = Array.from(files).slice(0, 10);
    state.selectedFiles = fileArray;

    const selectedEl = document.getElementById('selectedFiles');
    const countEl = document.getElementById('selectedCount');
    const listEl = document.getElementById('filePreviewList');
    const uploadBtn = document.getElementById('btnUpload');

    if (fileArray.length === 0) {
        selectedEl.style.display = 'none';
        uploadBtn.disabled = true;
        return;
    }

    selectedEl.style.display = 'block';
    countEl.textContent = `${fileArray.length} archivo(s) seleccionado(s)`;
    uploadBtn.disabled = false;

    listEl.innerHTML = fileArray.map((f, i) => `
        <div class="file-preview-item">
            <span class="file-preview-item__icon">${getFileIcon(f.name)}</span>
            <span class="file-preview-item__name">${escapeHtml(f.name)}</span>
            <span class="file-preview-item__size">${formatSize(f.size)}</span>
            <button class="btn btn--ghost btn--xs" onclick="removeSelectedFile(${i})">✕</button>
        </div>
    `).join('');
}

function removeSelectedFile(index) {
    state.selectedFiles.splice(index, 1);
    handleFileSelection(state.selectedFiles);
    // Reset file input since we modified the array
    document.getElementById('fileInput').value = '';
}

function clearSelectedFiles() {
    state.selectedFiles = [];
    document.getElementById('selectedFiles').style.display = 'none';
    document.getElementById('btnUpload').disabled = true;
    document.getElementById('fileInput').value = '';
}

async function uploadFiles() {
    if (state.selectedFiles.length === 0) return;

    const btn = document.getElementById('btnUpload');
    const btnText = document.getElementById('uploadBtnText');
    const progress = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('uploadProgressFill');

    btn.disabled = true;
    btnText.textContent = 'Subiendo...';
    progress.style.display = 'block';
    progressFill.style.width = '30%';

    const formData = new FormData();
    state.selectedFiles.forEach(f => formData.append('files[]', f));

    const desc = document.getElementById('uploadDescription').value.trim();
    if (desc) formData.append('description', desc);

    try {
        progressFill.style.width = '60%';
        const res = await api.upload('/test-files', formData);
        progressFill.style.width = '100%';

        const count = res.data?.total_files || state.selectedFiles.length;
        showToast(`${count} archivo(s) subido(s) exitosamente.`, 'success');

        clearSelectedFiles();
        document.getElementById('uploadDescription').value = '';
        loadFiles();
    } catch (err) {
        showToast('Error al subir archivos: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btnText.textContent = 'Subir Archivos';
        setTimeout(() => {
            progress.style.display = 'none';
            progressFill.style.width = '0%';
        }, 1000);
    }
}

async function loadFiles() {
    const loading = document.getElementById('filesLoading');
    const empty = document.getElementById('filesEmpty');
    const table = document.getElementById('filesTable');
    const tbody = document.getElementById('filesTableBody');

    loading.style.display = 'flex';
    empty.style.display = 'none';
    table.style.display = 'none';

    try {
        const res = await api.get('/test-files');
        const files = res.data?.files || [];

        loading.style.display = 'none';

        if (files.length === 0) {
            empty.style.display = 'block';
            return;
        }

        table.style.display = 'block';
        document.getElementById('filesTotalCount').textContent = `${files.length} archivo(s)`;

        tbody.innerHTML = files.map(f => `
            <tr>
                <td>
                    <span class="file-name">
                        ${getFileIcon(f.name)} ${escapeHtml(f.name)}
                    </span>
                </td>
                <td>${formatSize(f.size)}</td>
                <td>${formatDate(f.last_modified * 1000)}</td>
                <td>
                    <div class="btn-group btn-group--sm">
                        <a href="${API_BASE}/test-files/download/${encodeURIComponent(f.name)}"
                           class="btn btn--sm btn--outline" download>
                            ⬇ Descargar
                        </a>
                        <button class="btn btn--sm btn--danger"
                                onclick="confirmDeleteFile('${escapeHtml(f.name)}')">
                            🗑 Eliminar
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

    } catch (err) {
        loading.style.display = 'none';
        empty.style.display = 'block';
        empty.querySelector('p').textContent = '❌ Error al cargar archivos: ' + err.message;
    }
}

function confirmDeleteFile(filename) {
    showConfirm(
        'Eliminar Archivo',
        `¿Estás seguro de que deseas eliminar "${filename}"?`,
        () => deleteFile(filename)
    );
}

async function deleteFile(filename) {
    closeModal('confirmModal');
    try {
        await api.del(`/test-files/${encodeURIComponent(filename)}`);
        showToast('Archivo eliminado exitosamente.', 'success');
        loadFiles();
    } catch (err) {
        showToast('Error al eliminar: ' + err.message, 'error');
    }
}

// ── Dashboard ──
async function loadDashboard() {
    if (!state.isAuthenticated) return;

    const loading = document.getElementById('dashLoading');
    const responseEl = document.getElementById('dashResponse');

    loading.style.display = 'flex';

    try {
        const res = await api.get('/admin/dashboard', true);
        const stats = res.data?.stats;

        if (stats) {
            document.getElementById('dashUsers').textContent = stats.users ?? '-';
            document.getElementById('dashPosts').textContent = stats.posts ?? '-';
            document.getElementById('dashComments').textContent = stats.comments ?? '-';
            document.getElementById('dashActive').textContent = stats.active ?? '-';
        }

        responseEl.querySelector('pre').textContent = JSON.stringify(res, null, 2);
        loading.style.display = 'none';
    } catch (err) {
        loading.style.display = 'none';
        responseEl.querySelector('pre').textContent = `❌ Error: ${err.message}`;
        showToast('Error al cargar dashboard: ' + err.message, 'error');
    }
}

// ── Utility Functions ──
function formatDate(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('es-ES', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function formatSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(name) {
    const ext = (name || '').split('.').pop().toLowerCase();
    const icons = {
        pdf: '📄', doc: '📝', docx: '📝', txt: '📃',
        jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', svg: '🖼️', webp: '🖼️',
        mp4: '🎬', avi: '🎬', mov: '🎬', mp3: '🎵', wav: '🎵',
        zip: '📦', rar: '📦', tar: '📦', gz: '📦',
        js: '⚡', ts: '⚡', php: '🐘', py: '🐍', json: '📋', csv: '📊', xlsx: '📊',
    };
    return icons[ext] || '📎';
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ── Admin Users ──
const STATUS_LABELS = {
    registered: 'Registrado',
    verified: 'Verificado',
    approved: 'Aprobado',
    disabled: 'Deshabilitado',
    deleted: 'Eliminado',
};

const ACTION_LABELS = {
    status_change: 'Cambio de estado',
    role_assigned: 'Rol asignado',
    role_revoked: 'Rol revocado',
    enabled: 'Habilitado',
    disabled: 'Deshabilitado',
};

function getAdminFilters() {
    const filters = {};
    const name = document.getElementById('filterName')?.value.trim();
    const email = document.getElementById('filterEmail')?.value.trim();
    const dni = document.getElementById('filterDni')?.value.trim();
    const status = document.getElementById('filterStatus')?.value;
    const role = document.getElementById('filterRole')?.value;
    const perPage = document.getElementById('filterPerPage')?.value;

    if (name) filters.name = name;
    if (email) filters.email = email;
    if (dni) filters.dni = dni;
    if (status) filters.status = status;
    if (role) filters.role = role;
    if (perPage) filters.per_page = perPage;

    return filters;
}

async function loadAdminUsers(page = 1) {
    if (!state.isAuthenticated) return;

    const loading = document.getElementById('usersLoading');
    const empty = document.getElementById('usersEmpty');
    const tableWrapper = document.getElementById('usersTableWrapper');

    loading.style.display = 'flex';
    empty.style.display = 'none';
    tableWrapper.style.display = 'none';

    const filters = getAdminFilters();
    filters.page = page;

    const params = new URLSearchParams(filters).toString();

    try {
        const res = await api.get(`/admin/users?${params}`, true);
        const users = res.data?.users || [];
        const pagination = res.data?.pagination || {};

        state.adminUsers.currentPage = pagination.current_page || 1;
        state.adminUsers.lastPage = pagination.last_page || 1;

        loading.style.display = 'none';

        if (users.length === 0) {
            empty.style.display = 'block';
            return;
        }

        tableWrapper.style.display = 'block';
        renderUsersTable(users);
        renderPagination(pagination);
    } catch (err) {
        loading.style.display = 'none';
        empty.style.display = 'block';
        empty.querySelector('p').textContent = '❌ Error: ' + err.message;
        showToast('Error al cargar usuarios: ' + err.message, 'error');
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = users.map(u => `
        <tr>
            <td><strong>${u.id}</strong></td>
            <td>
                <div style="font-weight:500;">${escapeHtml(u.name || '-')}</div>
                ${u.dni ? `<small class="text-muted">${escapeHtml(u.dni)}</small>` : ''}
            </td>
            <td><span style="font-size:0.85rem;">${escapeHtml(u.email)}</span></td>
            <td><span class="status-badge status-badge--${u.status}">${STATUS_LABELS[u.status] || u.status}</span></td>
            <td>
                <div class="tags">
                    ${(u.roles && u.roles.length)
            ? u.roles.map(r => `<span class="tag tag--primary">${r}</span>`).join('')
            : '<span class="tag tag--muted">—</span>'}
                </div>
            </td>
            <td><small>${formatDate(u.created_at)}</small></td>
            <td>
                <div class="btn-group btn-group--actions">
                    <button class="btn btn--sm btn--outline" onclick="viewUserDetail(${u.id})" title="Ver detalle">👁</button>
                    <button class="btn btn--sm btn--outline" onclick="viewUserHistory(${u.id})" title="Historial">📜</button>
                    ${u.status === 'registered' ? `
                        <button class="btn btn--sm btn--success" onclick="adminAction('approve', ${u.id})" title="Aprobar">✓</button>
                        <button class="btn btn--sm btn--danger" onclick="adminAction('reject', ${u.id})" title="Rechazar">✗</button>
                    ` : ''}
                    ${u.status === 'approved' ? `
                        <button class="btn btn--sm btn--warning" onclick="adminAction('disable', ${u.id})" title="Deshabilitar">⏸</button>
                    ` : ''}
                    ${u.status === 'disabled' ? `
                        <button class="btn btn--sm btn--success" onclick="adminAction('enable', ${u.id})" title="Habilitar">▶</button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

function renderPagination(pagination) {
    const container = document.getElementById('usersPagination');
    if (!pagination || pagination.last_page <= 1) {
        container.innerHTML = `<span class="pagination-info">${pagination.total || 0} usuario(s)</span>`;
        return;
    }

    let html = '';

    // Prev
    if (pagination.current_page > 1) {
        html += `<button class="btn btn--sm btn--outline" onclick="loadAdminUsers(${pagination.current_page - 1})">←</button>`;
    }

    // Pages
    for (let i = 1; i <= pagination.last_page; i++) {
        if (
            i === 1 || i === pagination.last_page ||
            (i >= pagination.current_page - 2 && i <= pagination.current_page + 2)
        ) {
            html += `<button class="btn btn--sm ${i === pagination.current_page ? 'active' : 'btn--outline'}"
                        onclick="loadAdminUsers(${i})">${i}</button>`;
        } else if (i === pagination.current_page - 3 || i === pagination.current_page + 3) {
            html += `<span style="padding:0 0.25rem;">…</span>`;
        }
    }

    // Next
    if (pagination.current_page < pagination.last_page) {
        html += `<button class="btn btn--sm btn--outline" onclick="loadAdminUsers(${pagination.current_page + 1})">→</button>`;
    }

    html += `<span class="pagination-info">${pagination.from}-${pagination.to} de ${pagination.total}</span>`;
    container.innerHTML = html;
}

async function viewUserDetail(userId) {
    const card = document.getElementById('userDetailCard');
    card.style.display = '';

    try {
        const res = await api.get(`/admin/users/${userId}`, true);
        const u = res.data?.user;
        if (!u) throw new Error('Usuario no encontrado');

        state.adminUsers.selectedUserId = u.id;

        document.getElementById('userDetailTitle').textContent = `Detalle: ${u.name}`;
        document.getElementById('userDetailAvatar').textContent = (u.name || '?')[0].toUpperCase();
        document.getElementById('udId').textContent = u.id;
        document.getElementById('udName').textContent = u.name || '-';
        document.getElementById('udEmail').textContent = u.email;
        document.getElementById('udDni').textContent = u.dni || '-';
        document.getElementById('udMobile').textContent = u.mobile || '-';
        document.getElementById('udStatus').innerHTML = `<span class="status-badge status-badge--${u.status}">${u.status_label || u.status}</span>`;
        document.getElementById('udVerified').textContent = u.email_verified_at ? '✅ ' + formatDate(u.email_verified_at) : '❌ No';
        document.getElementById('udLastAccess').textContent = u.last_access_at ? formatDate(u.last_access_at) : 'Nunca';
        document.getElementById('udCreatedAt').textContent = formatDate(u.created_at);
        document.getElementById('udRejection').textContent = u.rejection_reason || '-';

        document.getElementById('udRoles').innerHTML = (u.roles?.length)
            ? u.roles.map(r => `<span class="tag tag--primary">${r}</span>`).join('')
            : '<span class="tag tag--muted">Sin roles</span>';

        document.getElementById('udPermissions').innerHTML = (u.permissions?.length)
            ? u.permissions.map(p => `<span class="tag tag--info">${p}</span>`).join('')
            : '<span class="tag tag--muted">Sin permisos</span>';

        // Build action buttons
        let actions = '';
        if (u.status === 'registered') {
            actions += `<button class="btn btn--success btn--sm" onclick="adminAction('approve', ${u.id})">✓ Aprobar</button>`;
            actions += `<button class="btn btn--danger btn--sm" onclick="adminAction('reject', ${u.id})">✗ Rechazar</button>`;
        }
        if (u.status === 'approved') {
            actions += `<button class="btn btn--warning btn--sm" onclick="adminAction('disable', ${u.id})">⏸ Deshabilitar</button>`;
        }
        if (u.status === 'disabled') {
            actions += `<button class="btn btn--success btn--sm" onclick="adminAction('enable', ${u.id})">▶ Habilitar</button>`;
        }
        actions += `<button class="btn btn--info btn--sm" onclick="openRoleModal('assign', ${u.id})">🏷 Asignar Rol</button>`;
        actions += `<button class="btn btn--outline btn--sm" onclick="openRoleModal('revoke', ${u.id})">🏷 Revocar Rol</button>`;
        actions += `<button class="btn btn--outline btn--sm" onclick="viewUserHistory(${u.id})">📜 Ver Historial</button>`;

        document.getElementById('udActions').innerHTML = actions;

        // Scroll to card
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
        showToast('Error al cargar detalle: ' + err.message, 'error');
    }
}

function adminAction(action, userId) {
    state.adminUsers.statusChangeAction = action;
    state.adminUsers.statusChangeUserId = userId;

    const titles = {
        approve: 'Aprobar Usuario',
        reject: 'Rechazar Registro',
        enable: 'Habilitar Cuenta',
        disable: 'Deshabilitar Cuenta',
    };
    const descs = {
        approve: '¿Aprobar este registro? El usuario recibirá una notificación por email.',
        reject: '¿Rechazar este registro? El usuario será notificado. Puedes indicar un motivo.',
        enable: '¿Habilitar esta cuenta? El usuario podrá volver a iniciar sesión.',
        disable: '¿Deshabilitar esta cuenta? Se invalidarán todas sus sesiones activas.',
    };

    document.getElementById('statusChangeTitle').textContent = titles[action] || 'Cambiar Estado';
    document.getElementById('statusChangeDesc').textContent = descs[action] || '¿Estás seguro?';
    document.getElementById('statusChangeReason').value = '';
    openModal('statusChangeModal');
}

async function confirmStatusChange() {
    const action = state.adminUsers.statusChangeAction;
    const userId = state.adminUsers.statusChangeUserId;
    const reason = document.getElementById('statusChangeReason').value.trim();
    const btn = document.getElementById('btnStatusChangeConfirm');

    if (!action || !userId) return;

    btn.disabled = true;
    btn.textContent = 'Procesando...';

    try {
        const body = reason ? { reason } : {};
        const res = await api.post(`/admin/users/${userId}/${action}`, body, true);
        closeModal('statusChangeModal');
        showToast(res.message || 'Operación exitosa', 'success');

        // Refresh data
        loadAdminUsers(state.adminUsers.currentPage);
        if (state.adminUsers.selectedUserId === userId) {
            viewUserDetail(userId);
        }
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Confirmar';
    }
}

function openRoleModal(action, userId) {
    state.adminUsers.roleAction = action;
    state.adminUsers.roleUserId = userId;

    const isAssign = action === 'assign';
    document.getElementById('roleModalTitle').textContent = isAssign ? 'Asignar Rol' : 'Revocar Rol';
    document.getElementById('roleModalDesc').textContent = isAssign
        ? 'Selecciona el rol que deseas asignar al usuario.'
        : 'Selecciona el rol que deseas revocar del usuario.';
    document.getElementById('roleSelect').value = '';
    openModal('roleModal');
}

async function confirmRoleChange() {
    const action = state.adminUsers.roleAction;
    const userId = state.adminUsers.roleUserId;
    const role = document.getElementById('roleSelect').value;
    const btn = document.getElementById('btnRoleConfirm');

    if (!role) {
        showToast('Selecciona un rol', 'warning');
        return;
    }

    const endpoint = action === 'assign' ? 'assign-role' : 'revoke-role';
    btn.disabled = true;
    btn.textContent = 'Procesando...';

    try {
        const res = await api.post(`/admin/users/${userId}/${endpoint}`, { role }, true);
        closeModal('roleModal');
        showToast(res.message || 'Operación exitosa', 'success');

        loadAdminUsers(state.adminUsers.currentPage);
        if (state.adminUsers.selectedUserId === userId) {
            viewUserDetail(userId);
        }
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Confirmar';
    }
}

async function viewUserHistory(userId) {
    const card = document.getElementById('userHistoryCard');
    const loading = document.getElementById('historyLoading');
    const empty = document.getElementById('historyEmpty');
    const tableWrapper = document.getElementById('historyTableWrapper');

    card.style.display = '';
    loading.style.display = 'flex';
    empty.style.display = 'none';
    tableWrapper.style.display = 'none';

    try {
        const res = await api.get(`/admin/users/${userId}/history`, true);
        const history = res.data?.history || [];

        document.getElementById('userHistoryTitle').textContent =
            `📜 Historial: ${res.data?.user_name || 'Usuario #' + userId}`;

        loading.style.display = 'none';

        if (history.length === 0) {
            empty.style.display = 'block';
            card.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }

        tableWrapper.style.display = 'block';
        const tbody = document.getElementById('historyTableBody');
        tbody.innerHTML = history.map(h => `
            <tr>
                <td><span class="tag tag--info">${ACTION_LABELS[h.action] || h.action}</span></td>
                <td>${h.old_value ? `<span class="status-badge status-badge--${h.old_value}">${STATUS_LABELS[h.old_value] || h.old_value}</span>` : '—'}</td>
                <td>${h.new_value ? `<span class="status-badge status-badge--${h.new_value}">${STATUS_LABELS[h.new_value] || h.new_value}</span>` : '—'}</td>
                <td><small>${h.reason ? escapeHtml(h.reason) : '—'}</small></td>
                <td><small>${h.changed_by?.name || '—'}</small></td>
                <td><small>${formatDate(h.created_at)}</small></td>
            </tr>
        `).join('');

        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
        loading.style.display = 'none';
        showToast('Error al cargar historial: ' + err.message, 'error');
    }
}

function clearAdminFilters() {
    document.getElementById('filterName').value = '';
    document.getElementById('filterEmail').value = '';
    document.getElementById('filterDni').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterRole').value = '';
    document.getElementById('filterPerPage').value = '20';
    loadAdminUsers(1);
}

// ── Initialization ──
async function initApp() {
    console.log('🚀 Inicializando Difexa Frontend...');

    // Check stored session
    const token = storage.getToken();
    const user = storage.getUser();
    if (token && user) {
        state.isAuthenticated = true;
        state.token = token;
        state.user = user;
        state.roles = user.roles || [];
        state.permissions = user.permissions || [];

        // Verify token is still valid
        try {
            await loadProfile();
        } catch {
            clearAuthState();
        }
    }

    // Update UI
    updateAuthUI();

    // Load landing data
    await loadLanding();

    // Setup file upload
    setupFileUpload();

    // ── Event Listeners ──
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;
            if (section) navigateTo(section);
        });
    });

    // Mobile nav toggle
    document.getElementById('navToggle').addEventListener('click', () => {
        document.getElementById('mainNav').classList.toggle('open');
    });

    // Auth buttons
    document.getElementById('btnLogin').addEventListener('click', () => openModal('loginModal'));
    document.getElementById('btnRegister').addEventListener('click', () => openModal('registerModal'));
    document.getElementById('btnLogout').addEventListener('click', handleLogout);
    document.getElementById('btnGuestLogin')?.addEventListener('click', () => openModal('loginModal'));
    document.getElementById('btnGuestRegister')?.addEventListener('click', () => openModal('registerModal'));

    // Forms
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('forgotForm').addEventListener('submit', handleForgotPassword);

    // Modal switches
    document.getElementById('switchToRegister').addEventListener('click', (e) => {
        e.preventDefault();
        closeModal('loginModal');
        openModal('registerModal');
    });
    document.getElementById('switchToLogin').addEventListener('click', (e) => {
        e.preventDefault();
        closeModal('registerModal');
        openModal('loginModal');
    });
    document.getElementById('showForgotPassword').addEventListener('click', (e) => {
        e.preventDefault();
        closeModal('loginModal');
        openModal('forgotModal');
    });
    document.getElementById('backToLogin').addEventListener('click', (e) => {
        e.preventDefault();
        closeModal('forgotModal');
        openModal('loginModal');
    });

    // Close modal buttons
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
    });

    // Close modals on overlay click
    document.querySelectorAll('.modal__overlay').forEach(overlay => {
        overlay.addEventListener('click', () => {
            const modal = overlay.closest('.modal');
            if (modal) modal.classList.remove('active');
            document.body.style.overflow = 'auto';
        });
    });

    // Confirm modal
    document.getElementById('btnConfirmYes').addEventListener('click', () => {
        if (state.confirmCallback) {
            state.confirmCallback();
            state.confirmCallback = null;
        }
    });

    // Ping button
    document.getElementById('btnPing').addEventListener('click', doPing);
    document.getElementById('btnRetry')?.addEventListener('click', loadLanding);

    // Profile buttons
    document.getElementById('btnRefreshProfile')?.addEventListener('click', loadProfile);
    document.getElementById('btnProfileLogout')?.addEventListener('click', handleLogout);
    document.getElementById('btnResendVerification')?.addEventListener('click', resendVerification);

    // Files buttons
    document.getElementById('btnUpload').addEventListener('click', uploadFiles);
    document.getElementById('btnClearFiles').addEventListener('click', clearSelectedFiles);
    document.getElementById('btnRefreshFiles').addEventListener('click', loadFiles);

    // Dashboard button
    document.getElementById('btnRefreshDash')?.addEventListener('click', loadDashboard);

    // Admin Users buttons
    document.getElementById('btnApplyFilters')?.addEventListener('click', () => loadAdminUsers(1));
    document.getElementById('btnClearFilters')?.addEventListener('click', clearAdminFilters);
    document.getElementById('btnRefreshUsers')?.addEventListener('click', () => loadAdminUsers(state.adminUsers.currentPage));
    document.getElementById('btnCloseDetail')?.addEventListener('click', () => {
        document.getElementById('userDetailCard').style.display = 'none';
        state.adminUsers.selectedUserId = null;
    });
    document.getElementById('btnCloseHistory')?.addEventListener('click', () => {
        document.getElementById('userHistoryCard').style.display = 'none';
    });
    document.getElementById('btnStatusChangeConfirm')?.addEventListener('click', confirmStatusChange);
    document.getElementById('btnRoleConfirm')?.addEventListener('click', confirmRoleChange);

    // Enter key in filters triggers search
    document.querySelectorAll('#filterName, #filterEmail, #filterDni').forEach(input => {
        input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                loadAdminUsers(1);
            }
        });
    });

    console.log('✅ Difexa Frontend inicializado');
}

// Start
document.addEventListener('DOMContentLoaded', initApp);
