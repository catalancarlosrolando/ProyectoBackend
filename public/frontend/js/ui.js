/**
 * =============================================
 * Difexa Frontend - UI (Toast, Modals, Navegación)
 * =============================================
 */

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
    if (sectionName === 'channels') loadChannels();
    if (sectionName === 'user-channels') loadUserChannels();
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
