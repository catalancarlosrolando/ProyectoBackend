/**
 * =============================================
 * Difexa Frontend Application - Inicialización
 * =============================================
 * Módulos cargados previamente (en orden):
 *   1. core.js       → Estado global, Storage, API Client
 *   2. utils.js      → Funciones utilitarias (formatDate, escapeHtml, etc.)
 *   3. ui.js         → Toast, Modals, Navegación
 *   4. auth.js       → Login, Register, Logout, Forgot Password
 *   5. profile.js    → Perfil de usuario
 *   6. home.js       → Landing, Ping, Dashboard
 *   7. files.js      → Upload, listado, descarga, eliminación de archivos
 *   8. admin-users.js→ Panel admin de usuarios
 * =============================================
 */

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
            if (modal) {
                closeModal(modal.id);
            }
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

    // Filters toggle (mobile collapsible)
    document.getElementById('btnFiltersToggle')?.addEventListener('click', () => {
        const btn = document.getElementById('btnFiltersToggle');
        const body = document.getElementById('filtersBody');
        btn.classList.toggle('open');
        body.classList.toggle('open');
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

    // ── Channels buttons ──
    document.getElementById('btnCreateChannel')?.addEventListener('click', openCreateChannelModal);
    document.getElementById('btnRefreshChannels')?.addEventListener('click', loadChannels);
    document.getElementById('btnChannelFormSubmit')?.addEventListener('click', submitChannelForm);
    document.getElementById('btnMediaAssignSubmit')?.addEventListener('click', submitMediaAssign);

    // ── User-Channels (asignación publicadores) ──
    document.getElementById('btnRefreshUc')?.addEventListener('click', () => loadUserChannels(state.userChannels.currentPage));
    document.getElementById('btnUcAssignSubmit')?.addEventListener('click', submitAssignChannels);
    document.getElementById('btnUcRevokeSubmit')?.addEventListener('click', submitRevokeChannels);

    // ── Publicaciones ──
    document.getElementById('btnCreatePost')?.addEventListener('click', openPostFormModal);
    document.getElementById('btnRefreshPosts')?.addEventListener('click', () => loadPosts());
    document.getElementById('btnPostFormSubmit')?.addEventListener('click', submitPostForm);
    setupPostFileUpload();

    // Post filters
    document.getElementById('btnApplyPostFilters')?.addEventListener('click', () => loadPosts(1));
    document.getElementById('btnClearPostFilters')?.addEventListener('click', clearPostFilters);
    document.getElementById('btnPostsFiltersToggle')?.addEventListener('click', () => {
        const btn = document.getElementById('btnPostsFiltersToggle');
        const body = document.getElementById('postsFiltersBody');
        btn.classList.toggle('open');
        body.classList.toggle('open');
    });
    document.getElementById('btnSavePostFilter')?.addEventListener('click', saveCurrentFilter);
    document.getElementById('postSavedFilters')?.addEventListener('change', (e) => {
        if (e.target.value) applySavedFilter(e.target.value);
    });

    // Post filter inputs: enter key triggers search
    document.querySelectorAll('#postFilterSearch').forEach(input => {
        input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); loadPosts(1); }
        });
    });

    // Post action modal confirm
    document.getElementById('btnPostActionConfirm')?.addEventListener('click', confirmPostAction);

    // ── Moderación ──
    document.getElementById('btnRefreshModeration')?.addEventListener('click', () => loadModerationPosts(moderationCurrentPage));
    document.getElementById('btnModerationApprove')?.addEventListener('click', approveModerationPost);
    document.getElementById('btnModerationReject')?.addEventListener('click', rejectModerationPost);

    // ── Notificaciones ──
    document.getElementById('btnNotifBell')?.addEventListener('click', () => navigateTo('notifications'));
    document.getElementById('btnRefreshNotif')?.addEventListener('click', loadNotifications);
    document.getElementById('btnMarkAllRead')?.addEventListener('click', markAllNotificationsRead);

    console.log('✅ Difexa Frontend inicializado');
}

// Start
document.addEventListener('DOMContentLoaded', initApp);
