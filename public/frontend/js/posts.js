/**
 * =============================================
 * Difexa Frontend - Gestión de Publicaciones
 * =============================================
 */

const POST_STATUS_LABELS = {
    draft: 'Borrador',
    approved_by_moderator: 'Aprobada',
    scheduled: 'Programada',
    archived: 'Archivada',
};

const POST_STATUS_COLORS = {
    draft: { bg: '#FFF3E0', text: '#E65100', icon: 'edit_note' },
    approved_by_moderator: { bg: '#E8F5E9', text: '#1B5E20', icon: 'check_circle' },
    scheduled: { bg: '#E3F2FD', text: '#0D47A1', icon: 'schedule' },
    archived: { bg: '#F5F5F5', text: '#616161', icon: 'archive' },
};

const POST_TYPE_LABELS = {
    text: 'Texto',
    video: 'Video',
    audio: 'Audio',
    image: 'Imagen',
    multimedia: 'Multimedia',
};

const POST_TYPE_ICONS = {
    text: 'article',
    video: 'videocam',
    audio: 'audiotrack',
    image: 'image',
    multimedia: 'perm_media',
};

// ── State ──
let postsSelectedFiles = [];
let postsChannelsCache = [];

// ── Helpers ──

function renderPostStatusBadge(status) {
    const c = POST_STATUS_COLORS[status] || { bg: '#EEEEEE', text: '#49454F', icon: 'help' };
    const label = POST_STATUS_LABELS[status] || status;
    return `<span class="au-status-badge" style="background:${c.bg};color:${c.text};">
        <span class="material-symbols-rounded" style="font-size:14px;color:${c.text};">${c.icon}</span>
        ${escapeHtml(label).toUpperCase()}
    </span>`;
}

function renderPostTypeBadge(type) {
    const icon = POST_TYPE_ICONS[type] || 'description';
    const label = POST_TYPE_LABELS[type] || type;
    return `<span class="au-status-badge" style="background:#EDE7F6;color:#4527A0;">
        <span class="material-symbols-rounded" style="font-size:14px;color:#4527A0;">${icon}</span>
        ${escapeHtml(label)}
    </span>`;
}

function renderPostChannelTags(channels) {
    if (!channels || channels.length === 0) return '<span class="text-muted">—</span>';
    return channels.map(ch => {
        const c = CHANNEL_TYPE_COLORS[ch.type] || { bg: '#EEEEEE', text: '#49454F' };
        return `<span class="ch-media-tag" style="background:${c.bg};color:${c.text};">${escapeHtml(ch.name)}</span>`;
    }).join('');
}

// ── Load Posts ──

async function loadPosts(page = 1) {
    if (!state.isAuthenticated) return;

    const loading = document.getElementById('postsLoading');
    const empty = document.getElementById('postsEmpty');
    const tableWrapper = document.getElementById('postsTableWrapper');
    const stats = document.getElementById('postsStats');

    loading.style.display = 'flex';
    empty.style.display = 'none';
    tableWrapper.style.display = 'none';
    stats.style.display = 'none';

    try {
        const res = await api.get(`/posts?page=${page}`, true);
        const paginatedData = res.data;
        const posts = paginatedData.data || [];

        loading.style.display = 'none';

        if (posts.length === 0 && page === 1) {
            empty.style.display = 'block';
            return;
        }

        // Update stats
        stats.style.display = '';
        const total = paginatedData.total || posts.length;
        const drafts = posts.filter(p => p.status === 'draft').length;
        const approved = posts.filter(p => p.status === 'approved_by_moderator').length;
        const scheduled = posts.filter(p => p.status === 'scheduled').length;
        document.getElementById('postsTotalCount').textContent = total;
        document.getElementById('postsDraftCount').textContent = drafts;
        document.getElementById('postsApprovedCount').textContent = approved;
        document.getElementById('postsScheduledCount').textContent = scheduled;

        tableWrapper.style.display = 'block';
        renderPostsTable(posts);
        renderPostsPagination(paginatedData);
    } catch (err) {
        loading.style.display = 'none';
        empty.style.display = 'block';
        showToast('Error al cargar publicaciones: ' + err.message, 'error');
    }
}

function renderPostsTable(posts) {
    // Desktop
    const tbody = document.getElementById('postsTableBody');
    tbody.innerHTML = posts.map(post => `
        <div class="au-row">
            <span class="au-cell au-cell--id">${post.id}</span>
            <div class="au-cell post-col--title">
                <span class="au-name-text">${escapeHtml(post.name)}</span>
            </div>
            <div class="au-cell post-col--type">${renderPostTypeBadge(post.type)}</div>
            <div class="au-cell post-col--status">${renderPostStatusBadge(post.status)}</div>
            <div class="au-cell post-col--channels" style="display:flex;flex-wrap:wrap;gap:0.25rem;">
                ${renderPostChannelTags(post.channels)}
            </div>
            <div class="au-cell post-col--date">
                <span>${formatDate(post.created_at)}</span>
            </div>
            <div class="au-cell au-cell--actions">
                <button class="btn btn--xs btn--outline" onclick="viewPostDetail(${post.id})" title="Ver detalle">
                    <span class="material-symbols-rounded" style="font-size:18px;">visibility</span>
                </button>
            </div>
        </div>
    `).join('');

    // Mobile cards
    const mobileContainer = document.getElementById('postsMobileCards');
    mobileContainer.innerHTML = posts.map(post => `
        <div class="au-user-card">
            <div class="au-user-card__top">
                <div class="au-user-card__left">
                    <div class="au-user-card__avatar" style="background:#EDE7F6;color:#4527A0;">
                        <span class="material-symbols-rounded" style="font-size:18px;">${POST_TYPE_ICONS[post.type] || 'article'}</span>
                    </div>
                    <div class="au-user-card__name-col">
                        <span class="au-user-card__name">${escapeHtml(post.name)}</span>
                        <span class="au-user-card__id">ID: ${post.id}</span>
                    </div>
                </div>
                ${renderPostStatusBadge(post.status)}
            </div>
            <div class="au-user-card__divider"></div>
            <div class="au-user-card__info">
                <div class="au-user-card__info-row">
                    <span class="material-symbols-rounded au-user-card__info-icon">category</span>
                    ${renderPostTypeBadge(post.type)}
                </div>
                <div class="au-user-card__info-row">
                    <span class="material-symbols-rounded au-user-card__info-icon">calendar_today</span>
                    <span>${formatDate(post.created_at)}</span>
                </div>
                <div class="au-user-card__info-row" style="flex-wrap:wrap;gap:0.375rem;">
                    <span class="material-symbols-rounded au-user-card__info-icon">podcasts</span>
                    ${renderPostChannelTags(post.channels)}
                </div>
                ${post.scheduled_at ? `
                <div class="au-user-card__info-row">
                    <span class="material-symbols-rounded au-user-card__info-icon">schedule</span>
                    <span>Programada: ${formatDate(post.scheduled_at)}</span>
                </div>` : ''}
                ${post.attachments && post.attachments.length > 0 ? `
                <div class="au-user-card__info-row">
                    <span class="material-symbols-rounded au-user-card__info-icon">attach_file</span>
                    <span>${post.attachments.length} archivo(s) adjunto(s)</span>
                </div>` : ''}
            </div>
            <div class="au-user-card__actions">
                <button class="btn btn--xs btn--outline" onclick="viewPostDetail(${post.id})">
                    <span class="material-symbols-rounded" style="font-size:16px;">visibility</span> Ver detalle
                </button>
            </div>
        </div>
    `).join('');
}

function renderPostsPagination(data) {
    const container = document.getElementById('postsPagination');
    if (!data || data.last_page <= 1) {
        container.innerHTML = '';
        return;
    }
    const current = data.current_page;
    const last = data.last_page;
    let html = '<div class="pagination">';
    html += `<button class="pagination__btn" ${current <= 1 ? 'disabled' : ''} onclick="loadPosts(${current - 1})">
        <span class="material-symbols-rounded">chevron_left</span>
    </button>`;
    for (let i = 1; i <= last; i++) {
        if (last > 7 && i > 2 && i < last - 1 && Math.abs(i - current) > 1) {
            if (i === 3 || i === last - 2) html += '<span class="pagination__dots">…</span>';
            continue;
        }
        html += `<button class="pagination__btn ${i === current ? 'pagination__btn--active' : ''}" onclick="loadPosts(${i})">${i}</button>`;
    }
    html += `<button class="pagination__btn" ${current >= last ? 'disabled' : ''} onclick="loadPosts(${current + 1})">
        <span class="material-symbols-rounded">chevron_right</span>
    </button>`;
    html += '</div>';
    container.innerHTML = html;
}

// ── Post Detail ──

async function viewPostDetail(postId) {
    const loading = document.getElementById('postDetailLoading');
    const content = document.getElementById('postDetailContent');

    loading.style.display = 'flex';
    content.innerHTML = '';
    openModal('postDetailModal');

    try {
        const res = await api.get(`/posts/${postId}`, true);
        const post = res.data;
        loading.style.display = 'none';

        document.getElementById('postDetailTitle').textContent = post.name;

        content.innerHTML = `
            <div class="post-detail">
                <div class="post-detail__meta">
                    ${renderPostStatusBadge(post.status)}
                    ${renderPostTypeBadge(post.type)}
                    ${post.scheduled_at ? `<span class="au-status-badge" style="background:#E3F2FD;color:#0D47A1;">
                        <span class="material-symbols-rounded" style="font-size:14px;">schedule</span>
                        ${formatDate(post.scheduled_at)}
                    </span>` : ''}
                </div>

                <div class="post-detail__section">
                    <h4>Contenido</h4>
                    <div class="post-detail__content">${escapeHtml(post.content)}</div>
                </div>

                <div class="post-detail__section">
                    <h4>Canales</h4>
                    <div style="display:flex;flex-wrap:wrap;gap:0.375rem;">
                        ${renderPostChannelTags(post.channels)}
                    </div>
                </div>

                ${post.medias && post.medias.length > 0 ? `
                <div class="post-detail__section">
                    <h4>Medios de publicación</h4>
                    <div style="display:flex;flex-wrap:wrap;gap:0.375rem;">
                        ${post.medias.map(m => renderMediaTypeBadge(m.type, m.name)).join('')}
                    </div>
                </div>` : ''}

                ${post.attachments && post.attachments.length > 0 ? `
                <div class="post-detail__section">
                    <h4>Archivos adjuntos (${post.attachments.length})</h4>
                    <div class="post-detail__attachments">
                        ${post.attachments.map(a => `
                            <div class="post-detail__attachment">
                                <span class="material-symbols-rounded" style="font-size:18px;color:var(--primary);">attach_file</span>
                                <span>${escapeHtml(a.path.split('/').pop())}</span>
                                <span class="text-muted" style="font-size:0.75rem;">${escapeHtml(a.mime_type)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>` : ''}

                <div class="post-detail__section post-detail__footer">
                    <span class="text-muted">Creada: ${formatDate(post.created_at)}</span>
                    ${post.updated_at ? `<span class="text-muted">Actualizada: ${formatDate(post.updated_at)}</span>` : ''}
                </div>
            </div>
        `;
    } catch (err) {
        loading.style.display = 'none';
        content.innerHTML = `<div class="alert alert--error"><p>${escapeHtml(err.message)}</p></div>`;
    }
}

// ── Post Form (Create) ──

async function openPostFormModal() {
    // Reset form
    document.getElementById('postFormName').value = '';
    document.getElementById('postFormContent').value = '';
    document.getElementById('postFormType').value = '';
    document.getElementById('postFormScheduledAt').value = '';
    const errorEl = document.getElementById('postFormError');
    errorEl.style.display = 'none';
    errorEl.innerHTML = '';
    postsSelectedFiles = [];
    renderPostFilePreview();

    // Load publisher's authorized channels
    const channelsContainer = document.getElementById('postFormChannels');
    channelsContainer.innerHTML = '<p class="text-muted">Cargando canales...</p>';

    openModal('postFormModal');

    try {
        // Get channels assigned to this publisher from user-channels endpoint
        const res = await api.get(`/posts/channels/${state.user.id}`, true);
        const channels = res.data?.channels || [];
        postsChannelsCache = channels;

        if (channels.length === 0) {
            channelsContainer.innerHTML = `
                <div class="alert alert--warning" style="margin:0;">
                    <p>No tienes canales asignados. Contacta al administrador para que te asigne canales.</p>
                </div>`;
            return;
        }

        renderChannelsWithMediaSlots(channels, channelsContainer);
    } catch {
        // Fallback: try getting channels from admin endpoint (for admins)
        try {
            const res = await api.get('/admin/channels', true);
            const channels = res.data || [];
            postsChannelsCache = channels;

            if (channels.length === 0) {
                channelsContainer.innerHTML = '<p class="text-muted">No hay canales disponibles.</p>';
                return;
            }

            renderChannelsWithMediaSlots(channels, channelsContainer);
        } catch (err2) {
            channelsContainer.innerHTML = `<div class="alert alert--error" style="margin:0;"><p>Error al cargar canales: ${escapeHtml(err2.message)}</p></div>`;
        }
    }
}

// Render channels as vertical list, each with a media slot below
function renderChannelsWithMediaSlots(channels, container) {
    container.innerHTML = channels.map(ch => {
        const c = CHANNEL_TYPE_COLORS[ch.type] || { bg: '#EEEEEE', text: '#49454F', icon: 'label' };
        return `
        <div class="post-channel-block" data-channel-id="${ch.id}">
            <label class="post-checkbox-item" style="border-left:3px solid ${c.text};">
                <input type="checkbox" class="checkbox-input post-channel-cb" value="${ch.id}"
                    onchange="onPostChannelToggle(${ch.id})">
                <div class="post-checkbox-item__info">
                    <span class="post-checkbox-item__name">
                        <span class="material-symbols-rounded" style="font-size:16px;color:${c.text};">${c.icon}</span>
                        ${escapeHtml(ch.name)}
                    </span>
                </div>
            </label>
            <div class="post-channel-medias" id="postChannelMedias_${ch.id}" style="display:none;"></div>
        </div>`;
    }).join('');
}

// When a specific channel is toggled, load/hide its medias
async function onPostChannelToggle(channelId) {
    const mediasContainer = document.getElementById(`postChannelMedias_${channelId}`);
    const checkbox = document.querySelector(`.post-channel-cb[value="${channelId}"]`);

    if (!checkbox.checked) {
        mediasContainer.style.display = 'none';
        mediasContainer.innerHTML = '';
        return;
    }

    // Show and load medias for this channel
    mediasContainer.style.display = '';
    mediasContainer.innerHTML = '<p class="text-muted" style="padding:0.5rem 0;">Cargando medios...</p>';

    try {
        const res = await api.get(`/posts/${channelId}/medias`, true);
        const medias = res.data || [];

        if (medias.length === 0) {
            mediasContainer.innerHTML = '<p class="text-muted post-channel-medias__empty">Sin medios asociados</p>';
            return;
        }

        mediasContainer.innerHTML = `
            <p class="post-channel-medias__label">Medios disponibles:</p>
            ${medias.map(m => {
            const c = MEDIA_TYPE_COLORS[m.type] || { bg: '#EEEEEE', text: '#49454F' };
            const icon = MEDIA_TYPE_ICONS[m.type] || 'devices';
            return `
                <label class="post-checkbox-item post-checkbox-item--media">
                    <input type="checkbox" class="checkbox-input post-media-cb" value="${m.id}">
                    <div class="post-checkbox-item__info">
                        <span class="post-checkbox-item__name">
                            <span class="material-symbols-rounded" style="font-size:14px;color:${c.text};">${icon}</span>
                            ${escapeHtml(m.name)}
                        </span>
                    </div>
                </label>`;
        }).join('')}
        `;
    } catch {
        mediasContainer.innerHTML = '<p class="text-muted post-channel-medias__empty">Error al cargar medios</p>';
    }
}

// ── File handling for post form ──

function setupPostFileUpload() {
    const zone = document.getElementById('postUploadZone');
    const input = document.getElementById('postFileInput');
    if (!zone || !input) return;

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('upload-zone--dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('upload-zone--dragover'));
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('upload-zone--dragover');
        addPostFiles(e.dataTransfer.files);
    });
    input.addEventListener('change', () => {
        addPostFiles(input.files);
        input.value = '';
    });
    document.getElementById('btnClearPostFiles')?.addEventListener('click', () => {
        postsSelectedFiles = [];
        renderPostFilePreview();
    });
}

function addPostFiles(fileList) {
    for (const file of fileList) {
        if (postsSelectedFiles.length >= 10) {
            showToast('Máximo 10 archivos permitidos', 'warning');
            break;
        }
        if (file.size > 10 * 1024 * 1024) {
            showToast(`${file.name} supera los 10 MB`, 'warning');
            continue;
        }
        postsSelectedFiles.push(file);
    }
    renderPostFilePreview();
}

function renderPostFilePreview() {
    const container = document.getElementById('postSelectedFiles');
    const list = document.getElementById('postFilePreviewList');
    const count = document.getElementById('postSelectedCount');

    if (postsSelectedFiles.length === 0) {
        container.style.display = 'none';
        return;
    }
    container.style.display = '';
    count.textContent = `${postsSelectedFiles.length} archivo(s)`;
    list.innerHTML = postsSelectedFiles.map((f, i) => `
        <div class="file-preview-item">
            <span>${getFileIcon(f.name)} ${escapeHtml(f.name)} (${formatSize(f.size)})</span>
            <button class="btn btn--ghost btn--xs" onclick="removePostFile(${i})">✕</button>
        </div>
    `).join('');
}

function removePostFile(index) {
    postsSelectedFiles.splice(index, 1);
    renderPostFilePreview();
}

// ── Submit Post ──

async function submitPostForm() {
    const errorEl = document.getElementById('postFormError');
    errorEl.style.display = 'none';

    const name = document.getElementById('postFormName').value.trim();
    const content = document.getElementById('postFormContent').value.trim();
    const type = document.getElementById('postFormType').value;
    const scheduledAt = document.getElementById('postFormScheduledAt').value;
    const channelIds = Array.from(document.querySelectorAll('.post-channel-cb:checked')).map(cb => parseInt(cb.value));
    const mediaIds = Array.from(document.querySelectorAll('.post-media-cb:checked')).map(cb => parseInt(cb.value));

    // Client-side validation
    if (!name || !content || !type || channelIds.length === 0) {
        errorEl.innerHTML = '<p>Completa todos los campos obligatorios (título, contenido, tipo y al menos un canal).</p>';
        errorEl.style.display = '';
        return;
    }

    const btn = document.getElementById('btnPostFormSubmit');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner spinner--xs"></span> Creando...';

    try {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('content', content);
        formData.append('type', type);
        if (scheduledAt) formData.append('scheduled_at', scheduledAt);
        channelIds.forEach(id => formData.append('channel_ids[]', id));
        mediaIds.forEach(id => formData.append('media_ids[]', id));
        postsSelectedFiles.forEach(file => formData.append('attachments[]', file));

        await api.authUpload('/posts', formData);

        closeModal('postFormModal');
        showToast('Publicación creada correctamente en estado borrador', 'success');
        loadPosts();
    } catch (err) {
        errorEl.innerHTML = `<p>${escapeHtml(err.message)}</p>`;
        errorEl.style.display = '';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-rounded">send</span> Crear Publicación';
    }
}
