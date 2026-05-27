/**
 * =============================================
 * Difexa Frontend - Display (Polling por UID)
 * =============================================
 */

const DISPLAY_POLL_MS = 2000;
const DISPLAY_IMAGE_DURATION_MS = 8000;
const DISPLAY_VIDEO_FALLBACK_MS = 30000;
const DISPLAY_VIDEO_WATCHDOG_MS = 6000;

const DISPLAY_CHANNEL_COLORS = {
    departamento: { bg: '#D4E9FF', text: '#0D47A1', icon: 'apartment' },
    instituto: { bg: '#E8F5E9', text: '#1B5E20', icon: 'school' },
    'secretaría': { bg: '#FFF3E0', text: '#E65100', icon: 'admin_panel_settings' },
    centro: { bg: '#F3E5F5', text: '#6A1B9A', icon: 'hub' },
};

const displayState = {
    uid: null,
    posts: [],
    pollTimer: null,
    playbackTimer: null,
    watchdogTimer: null,
    postIndex: 0,
    itemIndex: 0,
    mediaCache: new Map(),
    lastFeedSignature: '',
};

function extractDisplayUid() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const deviceIndex = parts.indexOf('device');
    if (deviceIndex >= 0 && parts[deviceIndex + 1]) {
        return parts[deviceIndex + 1];
    }
    return null;
}

function setDisplayStatus(message, type = 'info') {
    const status = document.getElementById('displayStatus');
    if (!status) return;
    status.textContent = message;
    status.classList.remove('display-status--ok', 'display-status--error');
    if (type === 'ok') status.classList.add('display-status--ok');
    if (type === 'error') status.classList.add('display-status--error');
}

function setDisplayError(message) {
    const error = document.getElementById('displayError');
    if (!error) return;
    error.textContent = message || '';
}

function renderDisplayInactive(message) {
    clearDisplayPlaybackTimers();
    if (displayState.pollTimer) {
        clearInterval(displayState.pollTimer);
        displayState.pollTimer = null;
    }

    displayState.posts = [];
    displayState.mediaCache.clear();
    displayState.lastFeedSignature = 'inactive';

    const wrapper = document.getElementById('displayMedia');
    const empty = document.getElementById('displayEmpty');
    const playlist = document.getElementById('displayPlaylist');
    const channels = document.getElementById('displayChannels');

    setDisplayStatus('Dispositivo inactivo', 'error');
    setDisplayError(message || 'Lo sentimos, este dispositivo está inactivo. Contacta con el administrador para reactivarlo.');
    updateDisplayNow(null);

    if (playlist) playlist.innerHTML = '<span class="text-muted">Sin publicaciones disponibles</span>';
    if (channels) channels.textContent = 'Sin canales asignados';

    if (wrapper) {
        wrapper.innerHTML = `
            <div class="display-fallback" style="min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:32px;">
                <span class="material-symbols-rounded" style="font-size:4.5rem;color:#ffb84d;margin-bottom:16px;">tv_off</span>
                <h2 style="margin:0 0 10px;font-size:2rem;">Este dispositivo está inactivo</h2>
                <p style="margin:0;max-width:32rem;color:var(--display-muted,#9fb2cc);line-height:1.7;">
                    Lo sentimos, este dispositivo está inactivo. Conéctate con el administrador para reactivarlo y volver a recibir publicaciones.
                </p>
            </div>
        `;
    }

    if (empty) {
        empty.style.display = 'none';
    }
}

function setDisplaySyncTimestamp() {
    const sync = document.getElementById('displaySync');
    if (!sync) return;
    sync.textContent = `Ultima sincronizacion: ${formatDate(new Date().toISOString())}`;
}

function updateDisplayUid(uid) {
    const uidEl = document.getElementById('displayUid');
    if (uidEl) uidEl.textContent = `UID: ${uid}`;
}

function updateDisplayChannels(posts) {
    const el = document.getElementById('displayChannels');
    if (!el) return;
    const channelMap = new Map();
    posts.forEach(post => {
        (post.channels || []).forEach(ch => {
            channelMap.set(ch.id, ch);
        });
    });

    if (channelMap.size === 0) {
        el.textContent = 'Sin canales asignados';
        return;
    }

    el.innerHTML = Array.from(channelMap.values()).map(ch => {
        const c = DISPLAY_CHANNEL_COLORS[ch.type] || { bg: '#EEEEEE', text: '#49454F', icon: 'label' };
        return `<span class="ch-media-tag" style="background:${c.bg};color:${c.text};">
            <span class="material-symbols-rounded" style="font-size:13px;">${c.icon}</span>
            ${escapeHtml(ch.name)}
        </span>`;
    }).join('');
}

function updateDisplayPlaylist(posts) {
    const list = document.getElementById('displayPlaylist');
    if (!list) return;
    if (!posts || posts.length === 0) {
        list.innerHTML = '<span class="text-muted">Sin publicaciones.</span>';
        return;
    }

    list.innerHTML = posts.map((post, index) => {
        const isActive = index === displayState.postIndex;
        return `<div class="display-playlist__item ${isActive ? 'is-active' : ''}">
            <span class="display-playlist__title">${escapeHtml(post.name || 'Publicacion')}</span>
            <span class="display-playlist__meta">${escapeHtml(post.type || '')}</span>
        </div>`;
    }).join('');
}

function updateDisplayNow(post) {
    const nowEl = document.getElementById('displayNow');
    if (!nowEl) return;
    if (!post) {
        nowEl.textContent = 'Sin contenido';
        return;
    }
    nowEl.textContent = `${post.name || 'Publicacion'}${post.published_at ? ' · ' + formatDate(post.published_at) : ''}`;
}

function buildDisplayMediaItems(post) {
    if (!post) return [];
    if (displayState.mediaCache.has(post.id)) {
        return displayState.mediaCache.get(post.id);
    }

    const items = (post.attachments || []).map(att => {
        const mime = att.mime_type || '';
        const url = `/storage/${att.path}`;
        if (mime.startsWith('image/')) {
            return { type: 'image', url, label: post.name || 'Imagen', durationMs: DISPLAY_IMAGE_DURATION_MS };
        }
        if (mime.startsWith('video/')) {
            return { type: 'video', url, label: post.name || 'Video', mime };
        }
        return { type: 'other', url, label: post.name || 'Contenido' };
    });

    displayState.mediaCache.set(post.id, items);
    return items;
}

function clearDisplayPlaybackTimers() {
    if (displayState.playbackTimer) {
        clearTimeout(displayState.playbackTimer);
    }
    displayState.playbackTimer = null;

    if (displayState.watchdogTimer) {
        clearInterval(displayState.watchdogTimer);
    }
    displayState.watchdogTimer = null;
}

function renderDisplayItem() {
    const wrapper = document.getElementById('displayMedia');
    const empty = document.getElementById('displayEmpty');
    if (!wrapper || !empty) return;

    const posts = displayState.posts;
    if (!posts.length) {
        wrapper.innerHTML = '';
        empty.style.display = 'flex';
        updateDisplayNow(null);
        return;
    }

    empty.style.display = 'none';

    const post = posts[displayState.postIndex];
    const items = buildDisplayMediaItems(post);

    if (!items.length) {
        wrapper.innerHTML = `
            <div class="display-fallback">
                <h2>${escapeHtml(post.name || 'Publicacion')}</h2>
                <p>${escapeHtml(post.content || 'Sin contenido multimedia disponible.')}</p>
            </div>
        `;
        updateDisplayNow(post);
        scheduleNextItem(DISPLAY_IMAGE_DURATION_MS);
        return;
    }

    const item = items[displayState.itemIndex];
    updateDisplayNow(post);

    if (item.type === 'image') {
        wrapper.innerHTML = `<img src="${item.url}" alt="${escapeHtml(item.label)}" class="display-media-item">`;
        scheduleNextItem(item.durationMs || DISPLAY_IMAGE_DURATION_MS);
        return;
    }

    if (item.type === 'video') {
        wrapper.innerHTML = `
            <video class="display-media-item" autoplay muted playsinline>
                <source src="${item.url}" type="${escapeHtml(item.mime || 'video/mp4')}">
                Tu navegador no soporta video.
            </video>
        `;

        const videoEl = wrapper.querySelector('video');
        if (!videoEl) return;

        const fallbackMs = DISPLAY_VIDEO_FALLBACK_MS;
        let handled = false;

        const onAdvance = () => {
            if (handled) return;
            handled = true;
            advanceDisplayPlayback();
        };

        videoEl.addEventListener('ended', onAdvance);
        displayState.playbackTimer = setTimeout(onAdvance, fallbackMs);

        let lastTime = 0;
        let stuckTicks = 0;
        displayState.watchdogTimer = setInterval(() => {
            const current = videoEl.currentTime || 0;
            if (current <= lastTime + 0.01) {
                stuckTicks += 1;
            } else {
                stuckTicks = 0;
            }
            lastTime = current;

            if (stuckTicks >= Math.ceil(DISPLAY_VIDEO_WATCHDOG_MS / 2000)) {
                onAdvance();
            }
        }, 2000);
        return;
    }

    wrapper.innerHTML = `
        <div class="display-fallback">
            <h2>${escapeHtml(post.name || 'Publicacion')}</h2>
            <p>Contenido no soportado.</p>
        </div>
    `;
    scheduleNextItem(DISPLAY_IMAGE_DURATION_MS);
}

function scheduleNextItem(delayMs) {
    clearDisplayPlaybackTimers();
    displayState.playbackTimer = setTimeout(() => advanceDisplayPlayback(), delayMs);
}

function advanceDisplayPlayback() {
    clearDisplayPlaybackTimers();

    const posts = displayState.posts;
    if (!posts.length) return;

    const currentPost = posts[displayState.postIndex];
    const items = buildDisplayMediaItems(currentPost);

    if (displayState.itemIndex < items.length - 1) {
        displayState.itemIndex += 1;
    } else {
        displayState.itemIndex = 0;
        displayState.postIndex = (displayState.postIndex + 1) % posts.length;
    }

    updateDisplayPlaylist(posts);
    renderDisplayItem();
}

function resetDisplayPlayback() {
    clearDisplayPlaybackTimers();
    displayState.postIndex = 0;
    displayState.itemIndex = 0;
    updateDisplayPlaylist(displayState.posts);
    renderDisplayItem();
}

function updateFeed(posts) {
    const signature = posts.length ? posts.map(p => p.id).join(',') : 'empty';
    if (signature === displayState.lastFeedSignature) {
        return;
    }

    displayState.lastFeedSignature = signature;
    displayState.posts = posts;
    displayState.mediaCache.clear();
    updateDisplayChannels(posts);
    resetDisplayPlayback();
}

async function pollDisplayFeed() {
    if (!displayState.uid) return;

    try {
        const res = await api.get(`/device/feed/${displayState.uid}`);
        const posts = res.data || [];

        setDisplayStatus('Conectado', 'ok');
        setDisplayError('');
        setDisplaySyncTimestamp();
        updateFeed(posts);
    } catch (err) {
        if ((err.message || '').toLowerCase().includes('dispositivo no autorizado')) {
            renderDisplayInactive('Lo sentimos, este dispositivo está inactivo. Conéctate con el administrador para reactivarlo y volver a recibir publicaciones.');
            return;
        }
        setDisplayStatus('Sin conexion', 'error');
        setDisplayError(err.message || 'Error al sincronizar');
    }
}

function startDisplayPolling() {
    if (displayState.pollTimer) {
        clearInterval(displayState.pollTimer);
    }
    displayState.pollTimer = setInterval(pollDisplayFeed, DISPLAY_POLL_MS);
}

function initDisplay() {
    const uid = extractDisplayUid();
    if (!uid) {
        setDisplayStatus('UID invalido', 'error');
        setDisplayError('No se detecto el UID en la URL.');
        return;
    }

    displayState.uid = uid;
    updateDisplayUid(uid);

    setDisplayStatus('Conectando...', 'info');
    pollDisplayFeed();
    startDisplayPolling();

    const fullscreenBtn = document.getElementById('displayFullscreen');
    const player = document.getElementById('displayPlayer');
    fullscreenBtn?.addEventListener('click', () => {
        if (!player) return;
        if (document.fullscreenElement) {
            document.exitFullscreen?.();
            return;
        }
        player.requestFullscreen?.();
    });
}

document.addEventListener('DOMContentLoaded', initDisplay);
