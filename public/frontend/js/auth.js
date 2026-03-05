/**
 * =============================================
 * Difexa Frontend - Autenticación
 * =============================================
 */

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

// ── Auth State Management ──
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

// ── Auth Handlers ──
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
