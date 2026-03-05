/**
 * =============================================
 * Difexa Frontend - Perfil de Usuario
 * =============================================
 */

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
