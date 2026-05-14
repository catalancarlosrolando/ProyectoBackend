/**
 * =============================================
 * Difexa Frontend - Dispositivo Cliente
 * =============================================
 */

let devicePostsCache = [];
let deviceSelectedPostId = null;
let devicePlaybackState = {
    items: [],
    currentIndex: 0,
    timerId: null,
    postTitle: null,
    currentPostId: null,
};

let devicePlaylist = [];
const devicePostDetailsCache = new Map();

const deviceMediaCache = new Map();

const DEVICE_IMAGE_DURATION_MS = 8000;
const DEVICE_VIDEO_FALLBACK_MS = 30000;

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
        updateDevicePlaylistUI();
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
    stopDevicePlayback();
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
                    <div class="btn-group btn-group--sm">
                        <button class="btn btn--outline btn--sm" onclick="selectDevicePost(${post.id})">
                            Reproducir
                        </button>
                        <button class="btn btn--outline btn--sm" onclick="addPostToPlaylist(${post.id})">
                            Agregar
                        </button>
                    </div>
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
        if (post) {
            devicePostDetailsCache.set(post.id, post);
        }
        console.log('Publicacion seleccionada:', res);
        renderDevicePlayer(post);
    } catch (err) {
        renderDevicePlayer(null, err.message);
        console.error('Error al cargar publicacion:', err);
    }
}

function renderDevicePlayer(post, errorMessage = null, options = {}) {
    const wrapper = document.getElementById('devicePlayerContent');
    const empty = document.getElementById('devicePlayerEmpty');
    const status = document.getElementById('devicePlayerStatus');

    if (!wrapper || !empty || !status) return;

    if (!post) {
        stopDevicePlayback();
        wrapper.innerHTML = '';
        empty.style.display = 'block';
        status.textContent = errorMessage || 'Selecciona una publicacion para reproducir.';
        return;
    }

    empty.style.display = 'none';

    const items = buildDeviceMediaItems(post);

    if (items.length === 0) {
        stopDevicePlayback();
        status.textContent = post.name || 'Reproduciendo';
        wrapper.innerHTML = `
            <div class="device-fallback">
                <h4>${escapeHtml(post.name || 'Publicacion')}</h4>
                <p class="text-muted">${escapeHtml(post.content || 'Sin contenido multimedia disponible.')}</p>
            </div>
        `;
        return;
    }

    startDevicePlayback(items, post.name || 'Reproduciendo', post.id, { preserveCache: options.preserveCache });
    if (options.addToPlaylist !== false) {
        addPostToPlaylist(post.id, { silent: true });
    }
}

function startDevicePlayback(items, postTitle, postId, options = {}) {
    stopDevicePlayback({ clearCache: !options.preserveCache });
    devicePlaybackState.items = items;
    devicePlaybackState.currentIndex = 0;
    devicePlaybackState.postTitle = postTitle;
    devicePlaybackState.currentPostId = postId || null;
    renderDevicePlaybackItem();
}

function stopDevicePlayback(options = {}) {
    if (devicePlaybackState.timerId) {
        clearTimeout(devicePlaybackState.timerId);
    }
    devicePlaybackState.timerId = null;
    devicePlaybackState.items = [];
    devicePlaybackState.currentIndex = 0;
    devicePlaybackState.postTitle = null;
    devicePlaybackState.currentPostId = null;
    if (options.clearCache !== false) {
        clearDeviceMediaCache();
    }
    stopActiveVideo();
}

function renderDevicePlaybackItem() {
    const wrapper = document.getElementById('devicePlayerContent');
    const status = document.getElementById('devicePlayerStatus');
    if (!wrapper || !status) return;

    const items = devicePlaybackState.items;
    if (!items.length) return;

    const item = items[devicePlaybackState.currentIndex];
    const indexLabel = `${devicePlaybackState.currentIndex + 1}/${items.length}`;
    status.textContent = `Reproduccion: ${devicePlaybackState.postTitle} (${indexLabel})`;

    const renderUrl = item.objectUrl || item.url;

    if (item.type === 'image') {
        wrapper.innerHTML = `<img src="${renderUrl}" alt="${escapeHtml(item.label)}" class="device-media">`;
        devicePlaybackState.timerId = setTimeout(() => advanceDevicePlayback(), item.durationMs);
        return;
    }

    if (item.type === 'video') {
        wrapper.innerHTML = `
            <video class="device-media" autoplay muted>
                <source src="${renderUrl}" type="${escapeHtml(item.mime || 'video/mp4')}">
                Tu navegador no soporta video.
            </video>
        `;

        const videoEl = wrapper.querySelector('video');
        if (!videoEl) return;

        const fallbackMs = item.durationMs || DEVICE_VIDEO_FALLBACK_MS;
        let handled = false;

        const onAdvance = () => {
            if (handled) return;
            handled = true;
            advanceDevicePlayback();
        };

        videoEl.addEventListener('ended', onAdvance);
        devicePlaybackState.timerId = setTimeout(onAdvance, fallbackMs);
        return;
    }

    wrapper.innerHTML = `
        <div class="device-fallback">
            <h4>${escapeHtml(devicePlaybackState.postTitle || 'Publicacion')}</h4>
            <p class="text-muted">Contenido no soportado.</p>
        </div>
    `;
    devicePlaybackState.timerId = setTimeout(() => advanceDevicePlayback(), DEVICE_IMAGE_DURATION_MS);
}

function stopActiveVideo() {
    const video = document.querySelector('#devicePlayerContent video');
    if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
    }
}

function toggleDeviceFullscreen() {
    const container = document.getElementById('devicePlayerCard');
    if (!container) return;

    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => { });
        return;
    }

    container.requestFullscreen?.().catch(() => { });
}

function stopDevicePlaybackUI() {
    stopDevicePlayback();
    renderDevicePlayer(null, 'Reproduccion detenida.');
}

function addPostToPlaylist(postId, options = {}) {
    const post = devicePostsCache.find(p => p.id === postId);
    if (!post) return;

    if (!devicePlaylist.includes(postId)) {
        devicePlaylist.push(postId);
        updateDevicePlaylistUI();
        if (!options.silent) showToast('Publicacion agregada a la lista.', 'success');
    }
}

function removePostFromPlaylist(postId) {
    devicePlaylist = devicePlaylist.filter(id => id !== postId);
    updateDevicePlaylistUI();
}

function updateDevicePlaylistUI() {
    const list = document.getElementById('devicePlaylistItems');
    const empty = document.getElementById('devicePlaylistEmpty');
    const count = document.getElementById('devicePlaylistCount');

    if (!list || !empty || !count) return;

    count.textContent = String(devicePlaylist.length);

    if (devicePlaylist.length === 0) {
        list.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    list.innerHTML = devicePlaylist.map(id => {
        const post = devicePostsCache.find(p => p.id === id);
        if (!post) return '';
        const isActive = deviceSelectedPostId === id;
        return `
            <div class="device-playlist__item ${isActive ? 'is-active' : ''}">
                <div class="device-playlist__meta">
                    <span class="device-playlist__title">${escapeHtml(post.name || 'Sin titulo')}</span>
                    <span class="device-playlist__type">${escapeHtml(getDeviceTypeLabel(post.type))}</span>
                </div>
                <div class="btn-group btn-group--sm">
                    <button class="btn btn--outline btn--sm" onclick="selectDevicePost(${id})">Reproducir</button>
                    <button class="btn btn--danger btn--sm" onclick="removePostFromPlaylist(${id})">Quitar</button>
                </div>
            </div>
        `;
    }).join('');
}

function advanceDevicePlayback() {
    if (!devicePlaybackState.items.length) return;

    if (devicePlaybackState.currentIndex < devicePlaybackState.items.length - 1) {
        devicePlaybackState.currentIndex += 1;
        renderDevicePlaybackItem();
        return;
    }

    if (devicePlaylist.length > 0) {
        const nextId = getNextPlaylistPostId();
        if (!nextId) {
            devicePlaybackState.currentIndex = 0;
            renderDevicePlaybackItem();
            return;
        }

        if (nextId === devicePlaybackState.currentPostId && devicePlaylist.length === 1) {
            devicePlaybackState.currentIndex = 0;
            renderDevicePlaybackItem();
            return;
        }

        loadPostForPlayback(nextId);
        return;
    }

    devicePlaybackState.currentIndex = 0;
    renderDevicePlaybackItem();
}

function getNextPlaylistPostId() {
    if (!devicePlaylist.length) return null;
    const currentId = devicePlaybackState.currentPostId || deviceSelectedPostId;
    const currentIndex = devicePlaylist.indexOf(currentId);
    if (currentIndex === -1) return devicePlaylist[0];
    const nextIndex = (currentIndex + 1) % devicePlaylist.length;
    return devicePlaylist[nextIndex];
}

async function loadPostForPlayback(postId) {
    deviceSelectedPostId = postId;
    renderDevicePosts(devicePostsCache);
    updateDevicePlaylistUI();

    const cached = devicePostDetailsCache.get(postId);
    if (cached) {
        renderDevicePlayer(cached, null, { preserveCache: true, addToPlaylist: false });
        return;
    }

    try {
        const res = await api.deviceGet(`/device/posts/${postId}`);
        const post = res.data;
        if (post) {
            devicePostDetailsCache.set(post.id, post);
        }
        renderDevicePlayer(post, null, { preserveCache: true, addToPlaylist: false });
    } catch {
        // Si falla, reintentamos desde el inicio.
        devicePlaybackState.currentIndex = 0;
        renderDevicePlaybackItem();
    }
}

function buildDeviceMediaItems(post) {
    const items = [];
    const postType = (post.type || '').toLowerCase();

    if (post.content && isMediaUrl(post.content)) {
        items.push(buildDeviceItemFromUrl(post.content, postType, post.name));
    }

    if (post.attachments && post.attachments.length > 0) {
        post.attachments.forEach((attachment) => {
            if (!attachment?.path) return;
            const url = `/storage/${attachment.path}`;
            const item = buildDeviceItemFromAttachment(url, attachment);
            if (item) items.push(item);
        });
    }

    const filtered = items.filter(Boolean);
    preloadDeviceMedia(filtered);
    return filtered;
}

function buildDeviceItemFromUrl(url, typeHint, label) {
    const type = detectMediaType(url, typeHint);
    if (!type) return null;
    return {
        type,
        url,
        label: label || url,
        durationMs: type === 'image' ? DEVICE_IMAGE_DURATION_MS : DEVICE_VIDEO_FALLBACK_MS,
    };
}

function buildDeviceItemFromAttachment(url, attachment) {
    const mime = (attachment.mime_type || '').toLowerCase();
    const typeHint = mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : '';
    const type = detectMediaType(url, typeHint);
    if (!type) return null;
    return {
        type,
        url,
        label: attachment.original_name || attachment.path || url,
        mime,
        durationMs: type === 'image' ? DEVICE_IMAGE_DURATION_MS : DEVICE_VIDEO_FALLBACK_MS,
    };
}

async function preloadDeviceMedia(items) {
    for (const item of items) {
        if (!item?.url || item.objectUrl) continue;
        try {
            const cached = deviceMediaCache.get(item.url);
            if (cached) {
                item.objectUrl = cached;
                continue;
            }

            const res = await fetch(item.url, { cache: 'force-cache' });
            if (!res.ok) continue;
            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);
            deviceMediaCache.set(item.url, objectUrl);
            item.objectUrl = objectUrl;
        } catch {
            // Si falla el prefetch, seguimos con la URL original.
        }
    }
}

function clearDeviceMediaCache() {
    deviceMediaCache.forEach((objectUrl) => {
        URL.revokeObjectURL(objectUrl);
    });
    deviceMediaCache.clear();
}

function detectMediaType(url, typeHint) {
    if (typeHint === 'image' || typeHint === 'video') return typeHint;
    const lower = (url || '').toLowerCase();
    if (lower.match(/\.(png|jpg|jpeg|gif|webp)$/)) return 'image';
    if (lower.match(/\.(mp4|mov|webm|avi)$/)) return 'video';
    return null;
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
