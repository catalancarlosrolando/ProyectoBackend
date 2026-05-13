/**
 * =============================================
 * Difexa Frontend - Dispositivo Cliente
 * =============================================
 */

let devicePostsCache = [];
let deviceSelectedPostId = null;

function setDeviceAuthState(data) {
    state.isDeviceAuthenticated = true;
    state.deviceToken = data.token;
    state.device = data.device;
    storage.setDeviceToken(data.token);
    storage.setDevice(data.device);
}

function clearDeviceAuthState() {
    state.isDeviceAuthenticated = false;
    state.deviceToken = null;
    state.device = null;
    storage.clearDevice();
}

function updateDeviceUI() {
    const status = document.getElementById('deviceStatus');
    const uidValue = document.getElementById('deviceUidValue');
    const loginForm = document.getElementById('deviceLoginForm');
    const logoutBtn = document.getElementById('btnDeviceLogout');
    const refreshBtn = document.getElementById('btnDeviceRefresh');

    if (!status || !uidValue || !loginForm || !logoutBtn || !refreshBtn) return;

    if (state.isDeviceAuthenticated && state.device) {
        status.textContent = 'Conectado';
        status.classList.add('device-status--ok');
        uidValue.textContent = state.device.uid;
        loginForm.classList.add('is-hidden');
        logoutBtn.style.display = 'inline-flex';
        refreshBtn.disabled = false;
    } else {
        status.textContent = 'Desconectado';
        status.classList.remove('device-status--ok');
        uidValue.textContent = '-';
        loginForm.classList.remove('is-hidden');
        logoutBtn.style.display = 'none';
        refreshBtn.disabled = true;
        renderDevicePosts([]);
        renderDevicePlayer(null);
    }
}

async function handleDeviceLogin(e) {
    e.preventDefault();

    const uidInput = document.getElementById('deviceUidInput');
    const errorEl = document.getElementById('deviceLoginError');
    const btn = document.getElementById('btnDeviceLogin');

    if (!uidInput || !errorEl || !btn) return;

    const uid = uidInput.value.trim();
    errorEl.style.display = 'none';

    if (!uid) {
        errorEl.textContent = 'Ingresa el UID del dispositivo.';
        errorEl.style.display = 'block';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Conectando...';

    try {
        const res = await api.post('/device/login', { uid });
        if (res.status !== 'success') throw new Error(res.message || 'Error en autenticacion');

        setDeviceAuthState(res.data);
        updateDeviceUI();
        uidInput.value = '';
        showToast('Dispositivo autenticado.', 'success');
        await loadDevicePosts();
    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Conectar';
    }
}

function handleDeviceLogout() {
    clearDeviceAuthState();
    updateDeviceUI();
    showToast('Dispositivo desconectado.', 'info');
}

async function loadDevicePosts() {
    const loading = document.getElementById('devicePostsLoading');
    const empty = document.getElementById('devicePostsEmpty');
    const list = document.getElementById('devicePostsList');
    const count = document.getElementById('devicePostsCount');

    if (!loading || !empty || !list || !count) return;

    if (!state.isDeviceAuthenticated) {
        renderDevicePosts([]);
        return;
    }

    loading.style.display = 'flex';
    empty.style.display = 'none';
    list.style.display = 'none';

    try {
        const res = await api.deviceGet('/device/posts');
        const paginated = res.data || {};
        const posts = paginated.data || [];
        devicePostsCache = posts;
        count.textContent = String(res.total || paginated.total || posts.length);

        loading.style.display = 'none';

        if (posts.length === 0) {
            empty.style.display = 'block';
            renderDevicePosts([]);
            return;
        }

        list.style.display = 'grid';
        renderDevicePosts(posts);
    } catch (err) {
        loading.style.display = 'none';
        empty.style.display = 'block';
        empty.querySelector('p').textContent = 'Error al cargar publicaciones: ' + err.message;
    }
}

function renderDevicePosts(posts) {
    const list = document.getElementById('devicePostsList');
    if (!list) return;

    if (!posts || posts.length === 0) {
        list.innerHTML = '';
        return;
    }

    list.innerHTML = posts.map(post => {
        const typeLabel = getDeviceTypeLabel(post.type);
        const publishedAt = formatDate(post.published_at);
        const isActive = deviceSelectedPostId === post.id;

        return `
            <div class="device-post ${isActive ? 'is-active' : ''}">
                <div class="device-post__meta">
                    <span class="device-post__title">${escapeHtml(post.name || 'Sin titulo')}</span>
                    <span class="device-post__type">${escapeHtml(typeLabel)}</span>
                </div>
                <div class="device-post__footer">
                    <span class="device-post__date">${escapeHtml(publishedAt)}</span>
                    <button class="btn btn--outline btn--sm" onclick="selectDevicePost(${post.id})">
                        Reproducir
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function selectDevicePost(postId) {
    deviceSelectedPostId = postId;
    renderDevicePosts(devicePostsCache);

    const playerStatus = document.getElementById('devicePlayerStatus');
    if (playerStatus) playerStatus.textContent = 'Cargando contenido...';

    try {
        const res = await api.deviceGet(`/device/posts/${postId}`);
        const post = res.data;
        console.log('Publicacion seleccionada:', res);
        renderDevicePlayer(post);
    } catch (err) {
        renderDevicePlayer(null, err.message);
        console.error('Error al cargar publicacion:', err);
    }
}

function renderDevicePlayer(post, errorMessage = null) {
    const wrapper = document.getElementById('devicePlayerContent');
    const empty = document.getElementById('devicePlayerEmpty');
    const status = document.getElementById('devicePlayerStatus');

    if (!wrapper || !empty || !status) return;

    if (!post) {
        wrapper.innerHTML = '';
        empty.style.display = 'block';
        status.textContent = errorMessage || 'Selecciona una publicacion para reproducir.';
        return;
    }

    empty.style.display = 'none';
    status.textContent = post.name || 'Reproduciendo';

    const mediaUrl = resolvePostMediaUrl(post);
    const type = post.type || '';

    if (mediaUrl && type === 'image') {
        wrapper.innerHTML = `<img src="${mediaUrl}" alt="${escapeHtml(post.name || 'Imagen')}" class="device-media">`;
        return;
    }

    if (mediaUrl && type === 'video') {
        wrapper.innerHTML = `
            <video class="device-media" controls autoplay muted loop>
                <source src="${mediaUrl}" type="video/mp4">
                Tu navegador no soporta video.
            </video>
        `;
        return;
    }

    wrapper.innerHTML = `
        <div class="device-fallback">
            <h4>${escapeHtml(post.name || 'Publicacion')}</h4>
            <p class="text-muted">${escapeHtml(post.content || 'Sin contenido multimedia disponible.')}</p>
        </div>
    `;
}

function resolvePostMediaUrl(post) {
    if (!post) return '';

    if (post.content && isMediaUrl(post.content)) {
        return post.content;
    }

    if (post.attachments && post.attachments.length > 0) {
        const attachment = post.attachments[0];
        if (attachment?.path) {
            return `/storage/${attachment.path}`;
        }
    }

    return '';
}

function isMediaUrl(value) {
    if (!value) return false;
    const v = value.trim().toLowerCase();
    return v.startsWith('http://') || v.startsWith('https://') || v.startsWith('/storage/');
}

function getDeviceTypeLabel(type) {
    const labels = {
        text: 'Texto',
        image: 'Imagen',
        video: 'Video',
        audio: 'Audio',
        multimedia: 'Multimedia',
    };
    return labels[type] || type || 'Desconocido';
}
