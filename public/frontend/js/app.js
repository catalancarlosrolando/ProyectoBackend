/**
 * =============================================
 * Difexa Frontend Application
 * =============================================
 * Cubre todas las funcionalidades del backend:
 * - Auth: login, register, logout, perfil, forgot/reset password
 * - Files: upload, list, download, delete
 * - Dashboard: panel admin con stats
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
}

function capitalize(str) {
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
        const isAdmin = state.permissions.includes('acceder-panel-admin');
        adminOnlyEls.forEach(el => el.style.display = isAdmin ? '' : 'none');
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

    console.log('✅ Difexa Frontend inicializado');
}

// Start
document.addEventListener('DOMContentLoaded', initApp);
