/**
 * =============================================
 * Difexa Frontend - Gestión de Publicaciones
 * H09: Crear | H10: Editar + Historial | H11: Eliminar
 * H11b: Buscar/Filtrar | H12: Archivar | H13/H14: via moderation.js
 * =============================================
 */

const POST_STATUS_LABELS = {
    draft: 'Borrador',
    pending_review: 'En revisión',
    approved_by_moderator: 'Aprobada',
    scheduled: 'Programada',
    published: 'Publicada',
    archived: 'Archivada',
};

const POST_STATUS_COLORS = {
    draft: { bg: '#FFF3E0', text: '#E65100', icon: 'edit_note' },
    pending_review: { bg: '#FFF8E1', text: '#F57F17', icon: 'hourglass_top' },
    approved_by_moderator: { bg: '#E8F5E9', text: '#1B5E20', icon: 'check_circle' },
    scheduled: { bg: '#E3F2FD', text: '#0D47A1', icon: 'schedule' },
    published: { bg: '#E8F5E9', text: '#2E7D32', icon: 'public' },
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
let postsEditingId = null; // null = creating, number = editing
let postActionCallback = null;
let postsSavedFiltersCache = [];

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

// ── Load Posts (with filters H11b) ──

function buildPostFilterParams() {
    const params = new URLSearchParams();
    const search = document.getElementById('postFilterSearch')?.value.trim();
    const status = document.getElementById('postFilterStatus')?.value;
    const type = document.getElementById('postFilterType')?.value;
    const dateFrom = document.getElementById('postFilterDateFrom')?.value;
    const dateTo = document.getElementById('postFilterDateTo')?.value;
    const perPage = document.getElementById('postFilterPerPage')?.value;

    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (type) params.set('type', type);
    if (dateFrom) params.set('created_from', dateFrom);
    if (dateTo) params.set('created_to', dateTo);
    if (perPage) params.set('per_page', perPage);

    return params.toString();
}

function clearPostFilters() {
    const ids = ['postFilterSearch', 'postFilterStatus', 'postFilterType', 'postFilterDateFrom', 'postFilterDateTo'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const perPage = document.getElementById('postFilterPerPage');
    if (perPage) perPage.value = '20';
    loadPosts(1);
}

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
        const filters = buildPostFilterParams();
        const qs = filters ? `&${filters}` : '';
        const res = await api.get(`/posts?page=${page}${qs}`, true);
        const paginatedData = res.data;
        const posts = paginatedData.data || [];

        loading.style.display = 'none';

        if (posts.length === 0 && page === 1) {
            empty.style.display = 'block';
            return;
        }

        // Update stats
        stats.style.display = '';
        const total = res.total || paginatedData.total || posts.length;
        const drafts = posts.filter(p => p.status === 'draft').length;
        const pending = posts.filter(p => p.status === 'pending_review').length;
        const published = posts.filter(p => p.status === 'published').length;
        const scheduled = posts.filter(p => p.status === 'scheduled').length;
        document.getElementById('postsTotalCount').textContent = total;
        document.getElementById('postsDraftCount').textContent = drafts;
        document.getElementById('postsPendingCount').textContent = pending;
        document.getElementById('postsPublishedCount').textContent = published;
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

function renderPostActionMenu(post) {
    const safeName = escapeHtml(post.name).replace(/'/g, "\\'");
    let items = '';

    // Ver detalle — siempre visible
    items += `<button class="au-actions-menu__item au-actions-menu__item--info" onclick="viewPostDetail(${post.id})">
        <span class="material-symbols-rounded">visibility</span> Ver detalle
    </button>`;

    if (post.status === 'draft') {
        items += `<button class="au-actions-menu__item" onclick="openEditPostModal(${post.id})">
            <span class="material-symbols-rounded">edit</span> Editar
        </button>`;
        items += `<button class="au-actions-menu__item au-actions-menu__item--success" onclick="submitPostForReview(${post.id})">
            <span class="material-symbols-rounded">send</span> Enviar a revisión
        </button>`;
    }

    if (post.status === 'pending_review' || post.status === 'scheduled' || post.status === 'published') {
        items += `<button class="au-actions-menu__item au-actions-menu__item--warning" onclick="revertPostToDraft(${post.id})">
            <span class="material-symbols-rounded">undo</span> Revertir a borrador
        </button>`;
    }

    if (post.status === 'published' || post.status === 'scheduled') {
        items += `<button class="au-actions-menu__item" onclick="openArchivePostAction(${post.id}, '${safeName}')">
            <span class="material-symbols-rounded">archive</span> Archivar
        </button>`;
    }

    if (post.status === 'draft' || post.status === 'pending_review' || post.status === 'scheduled') {
        items += `<div class="au-actions-menu__sep"></div>`;
        items += `<button class="au-actions-menu__item au-actions-menu__item--danger" onclick="openDeletePostAction(${post.id}, '${safeName}')">
            <span class="material-symbols-rounded">delete</span> Eliminar
        </button>`;
    }

    items += `<div class="au-actions-menu__sep"></div>`;
    items += `<button class="au-actions-menu__item" onclick="viewPostHistory(${post.id}, '${safeName}')">
        <span class="material-symbols-rounded">history</span> Historial
    </button>`;

    return `<div class="au-actions-dropdown">
        <button class="au-actions-trigger" onclick="toggleActionsMenu(event, this)" title="Acciones">
            <span class="material-symbols-rounded" style="font-size:20px;">more_vert</span>
        </button>
        <div class="au-actions-menu">${items}</div>
    </div>`;
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
                ${renderPostActionMenu(post)}
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
                ${renderPostActionMenu(post)}
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
                    ${post.published_at ? `<span class="text-muted">Publicada: ${formatDate(post.published_at)}</span>` : ''}
                    ${post.archived_at ? `<span class="text-muted">Archivada: ${formatDate(post.archived_at)}</span>` : ''}
                </div>

                ${post.moderator_comments ? `
                <div class="post-detail__section">
                    <h4>Comentarios del moderador</h4>
                    <div class="alert alert--warning" style="margin:0;"><p>${escapeHtml(post.moderator_comments)}</p></div>
                </div>` : ''}

                <div class="post-detail__section" style="display:flex;flex-wrap:wrap;gap:0.5rem;padding-top:1rem;border-top:1px solid var(--border);">
                    ${post.status === 'draft' ? `
                    <button class="btn btn--sm btn--outline" onclick="closeModal('postDetailModal');openEditPostModal(${post.id})">
                        <span class="material-symbols-rounded">edit</span> Editar
                    </button>
                    <button class="btn btn--sm btn--primary" onclick="closeModal('postDetailModal');submitPostForReview(${post.id})">
                        <span class="material-symbols-rounded">send</span> Enviar a revisión
                    </button>` : ''}
                    ${post.status === 'draft' || post.status === 'pending_review' || post.status === 'scheduled' ? `
                    <button class="btn btn--sm btn--danger-outline" onclick="closeModal('postDetailModal');openDeletePostAction(${post.id}, '${escapeHtml(post.name)}')">
                        <span class="material-symbols-rounded">delete</span> Eliminar
                    </button>` : ''}
                    ${post.status === 'published' || post.status === 'scheduled' ? `
                    <button class="btn btn--sm btn--outline" onclick="closeModal('postDetailModal');openArchivePostAction(${post.id}, '${escapeHtml(post.name)}')">
                        <span class="material-symbols-rounded">archive</span> Archivar
                    </button>` : ''}
                    ${post.status === 'archived' ? `
                    <span class="au-status-badge" style="background:#F5F5F5;color:#616161;">
                        <span class="material-symbols-rounded" style="font-size:14px;">archive</span> Publicación archivada
                    </span>` : ''}
                    <button class="btn btn--sm btn--ghost" onclick="closeModal('postDetailModal');viewPostHistory(${post.id}, '${escapeHtml(post.name)}')">
                        <span class="material-symbols-rounded">history</span> Historial
                    </button>
                </div>
            </div>
        `;
    } catch (err) {
        loading.style.display = 'none';
        content.innerHTML = `<div class="alert alert--error"><p>${escapeHtml(err.message)}</p></div>`;
    }
}

// ── Post Form (Create / Edit) ──

async function openPostFormModal() {
    postsEditingId = null;
    document.getElementById('postFormTitle').textContent = 'Nueva Publicación';
    document.getElementById('btnPostFormSubmit').innerHTML = '<span class="material-symbols-rounded">send</span> Crear Publicación';
    resetPostForm();
    openModal('postFormModal');
    await loadPostFormChannels();
}

async function openEditPostModal(postId) {
    postsEditingId = postId;
    document.getElementById('postFormTitle').textContent = 'Editar Publicación';
    document.getElementById('btnPostFormSubmit').innerHTML = '<span class="material-symbols-rounded">save</span> Guardar cambios';
    resetPostForm();
    openModal('postFormModal');

    try {
        const res = await api.get(`/posts/${postId}`, true);
        const post = res.data;

        document.getElementById('postFormName').value = post.name || '';
        document.getElementById('postFormContent').value = post.content || '';
        document.getElementById('postFormType').value = post.type || '';
        document.getElementById('postFormScheduledAt').value = post.scheduled_at ? post.scheduled_at.slice(0, 16) : '';

        await loadPostFormChannels();

        // Pre-select channels
        if (post.channels) {
            post.channels.forEach(ch => {
                const cb = document.querySelector(`.post-channel-cb[value="${ch.id}"]`);
                if (cb) {
                    cb.checked = true;
                    onPostChannelToggle(ch.id).then(() => {
                        // Pre-select medias
                        if (post.medias) {
                            post.medias.forEach(m => {
                                const mcb = document.querySelector(`.post-media-cb[value="${m.id}"]`);
                                if (mcb) mcb.checked = true;
                            });
                        }
                    });
                }
            });
        }
    } catch (err) {
        showToast('Error al cargar publicación: ' + err.message, 'error');
    }
}

function resetPostForm() {
    document.getElementById('postFormName').value = '';
    document.getElementById('postFormContent').value = '';
    document.getElementById('postFormType').value = '';
    document.getElementById('postFormScheduledAt').value = '';
    const errorEl = document.getElementById('postFormError');
    errorEl.style.display = 'none';
    errorEl.innerHTML = '';
    postsSelectedFiles = [];
    renderPostFilePreview();
    const channelsContainer = document.getElementById('postFormChannels');
    channelsContainer.innerHTML = '<p class="text-muted">Cargando canales...</p>';
}

async function loadPostFormChannels() {
    const channelsContainer = document.getElementById('postFormChannels');

    try {
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

// ── Submit Post (Create or Update) ──

async function submitPostForm() {
    //const errorEl = document.getElementById('postFormError');
    //errorEl.style.display = 'none';
    const errorEl = document.getElementById('postFormError');
    const modal = document.getElementById('postFormModal');

    // 1. SIEMPRE LIMPIAR AL INICIO
    errorEl.style.display = 'none';
    if (modal) {
        const inputs = modal.querySelectorAll('input, select, textarea');
        inputs.forEach(i => i.classList.remove('input-error', 'shake'));
    }

    const name = document.getElementById('postFormName').value.trim();
    const content = document.getElementById('postFormContent').value.trim();
    const type = document.getElementById('postFormType').value;
    const scheduledAt = document.getElementById('postFormScheduledAt').value;
    const channelIds = Array.from(document.querySelectorAll('.post-channel-cb:checked')).map(cb => parseInt(cb.value));
    const mediaIds = Array.from(document.querySelectorAll('.post-media-cb:checked')).map(cb => parseInt(cb.value));

    // Client-side validation
    if (!name || !content || !type || channelIds.length === 0 || mediaIds.length === 0) {
        //errorEl.innerHTML = '<p>Completa todos los campos obligatorios (título, contenido, tipo y al menos un canal).</p>';
        //errorEl.style.display = 'block';
        // errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });

        // 1. Limpiar errores previos


        // 2. Validar
        let firstError = null;
        if (!name) {
            const el = document.getElementById('postFormName');
            el.classList.add('input-error', 'shake');
            if (!firstError) firstError = el;
        }
        if (!content) {
            const el = document.getElementById('postFormContent');
            el.classList.add('input-error', 'shake');
            if (!firstError) firstError = el;
        }
        if (!type) {
            const el = document.getElementById('postFormType');
            el.classList.add('input-error', 'shake');
            if (!firstError) firstError = el;
        }
        if (channelIds.length === 0) {
            const el = document.querySelector('.post-channel-cb');
            el.classList.add('input-error', 'shake');
            if (!firstError) firstError = el;
        }

        if (firstError) {
            // En lugar de un scroll brusco al header,
            // solo nos aseguramos que el PRIMER error sea visible
            firstError.focus();

            return;
        }
    }


    const btn = document.getElementById('btnPostFormSubmit');
    btn.disabled = true;
    const isEditing = postsEditingId !== null;
    btn.innerHTML = `<span class="spinner spinner--xs"></span> ${isEditing ? 'Guardando...' : 'Creando...'}`;

    try {
        if (isEditing) {
            // PUT update (JSON)
            const body = { name, content, type, channel_ids: channelIds, media_ids: mediaIds };
            if (scheduledAt) body.scheduled_at = scheduledAt;
            await api.put(`/posts/${postsEditingId}`, body, true);
            closeModal('postFormModal');
            showToast('Publicación actualizada correctamente', 'success');
        } else {
            // POST create (FormData for attachments)
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
        }
        loadPosts();
    } catch (err) {
        errorEl.innerHTML = `<p>${escapeHtml(err.message)}</p>`;
        errorEl.style.display = '';
    } finally {
        btn.disabled = false;
        btn.innerHTML = isEditing
            ? '<span class="material-symbols-rounded">save</span> Guardar cambios'
            : '<span class="material-symbols-rounded">send</span> Crear Publicación';
    }
}

// ── Post Actions (H11 Delete, H12 Archive, H13 Submit, H10 Revert) ──

async function submitPostForReview(postId) {
    showConfirm('Enviar a revisión', '¿Deseas enviar esta publicación a moderación?', async () => {
        closeModal('confirmModal');
        try {
            await api.post(`/posts/${postId}/submit`, {}, true);
            showToast('Publicación enviada a moderación', 'success');
            loadPosts();
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
    });
}

async function revertPostToDraft(postId) {
    showConfirm('Revertir a borrador', '¿Deseas revertir esta publicación a borrador? Podrás editarla nuevamente.', async () => {
        closeModal('confirmModal');
        try {
            await api.post(`/posts/${postId}/revert-to-draft`, {}, true);
            showToast('Publicación revertida a borrador', 'success');
            loadPosts();
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
    });
}

function openDeletePostAction(postId, postName) {
    document.getElementById('postActionTitle').textContent = 'Eliminar publicación';
    document.getElementById('postActionDesc').textContent = `¿Estás seguro de eliminar "${postName}"? Esta acción es reversible (soft delete).`;
    document.getElementById('postActionReasonLabel').textContent = 'Razón de eliminación *';
    document.getElementById('postActionReason').value = '';
    document.getElementById('postActionReason').placeholder = 'Describe por qué deseas eliminar esta publicación...';
    const btn = document.getElementById('btnPostActionConfirm');
    btn.className = 'btn btn--danger';
    btn.innerHTML = '<span class="material-symbols-rounded">delete</span> Eliminar';
    postActionCallback = async () => {
        const reason = document.getElementById('postActionReason').value.trim();
        if (!reason) { showToast('La razón es obligatoria', 'warning'); return; }
        btn.disabled = true;
        try {
            const response = await api.del(`/posts/${postId}`, true, { reason: reason });
            console.log("Respuesta de la API:", response);
            closeModal('postActionModal');
            showToast('Publicación eliminada correctamente', 'success');
            loadPosts();
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        } finally { btn.disabled = false; }
    };
    openModal('postActionModal');
}

function openArchivePostAction(postId, postName) {
    document.getElementById('postActionTitle').textContent = 'Archivar publicación';
    document.getElementById('postActionDesc').textContent = `¿Deseas archivar "${postName}"? La publicación dejará de estar visible.`;
    document.getElementById('postActionReasonLabel').textContent = 'Confirmación';
    document.getElementById('postActionReason').value = '';
    document.getElementById('postActionReason').placeholder = '(Opcional) Notas sobre el archivado...';
    const btn = document.getElementById('btnPostActionConfirm');
    btn.className = 'btn btn--primary';
    btn.innerHTML = '<span class="material-symbols-rounded">archive</span> Archivar';
    postActionCallback = async () => {
        btn.disabled = true;
        try {
            await api.post(`/posts/${postId}/archive`, { confirm: true }, true);
            closeModal('postActionModal');
            showToast('Publicación archivada correctamente', 'success');
            loadPosts();
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        } finally { btn.disabled = false; }
    };
    openModal('postActionModal');
}

// ── Post History (H10) ──

const POST_ACTION_LABELS = {
    created: 'Creada',
    edited: 'Editada',
    status_changed: 'Estado cambiado',
    channels_updated: 'Canales actualizados',
    medias_updated: 'Medios actualizados',
    attachment_added: 'Adjunto añadido',
    attachment_removed: 'Adjunto eliminado',
    moderation_approved: 'Aprobada',
    moderation_rejected: 'Rechazada',
    scheduled: 'Programada',
    rescheduled: 'Reprogramada',
    archived: 'Archivada',
    unarchived: 'Desarchivada',
    restored_version: 'Versión restaurada',
    deleted: 'Eliminada',
    stopped: 'Detenida',
    submitted: 'Enviada a revisión',
};

async function viewPostHistory(postId, postName) {
    const loading = document.getElementById('postHistoryLoading');
    const empty = document.getElementById('postHistoryEmpty');
    const content = document.getElementById('postHistoryContent');

    document.getElementById('postHistoryTitle').textContent = `Historial: ${postName}`;
    loading.style.display = 'flex';
    empty.style.display = 'none';
    content.style.display = 'none';
    content.innerHTML = '';

    openModal('postHistoryModal');

    try {
        const res = await api.get(`/posts/${postId}/history`, true);
        const history = res.data.data || [];
        loading.style.display = 'none';
        console.log("historias de la publicacion:", history);

        if (history.length === 0) {
            empty.style.display = 'block';
            return;
        }

        content.style.display = '';
        content.innerHTML = `
            <div class="hm-cards-list">
                ${history.map(h => {
            const actionLabel = POST_ACTION_LABELS[h.action] || h.action;
            const userName = h.user ? (h.user.name || `${h.user.first_name} ${h.user.last_name}`) : 'Sistema';
            const changesHtml = h.changes ? renderHistoryChanges(h.changes) : '';
            return `
                    <div class="hm-card">
                        <div class="hm-card__header">
                            <span class="au-status-badge" style="background:#E3F2FD;color:#0D47A1;">
                                <span class="material-symbols-rounded" style="font-size:14px;">history</span>
                                ${escapeHtml(actionLabel)}
                            </span>
                            <span class="text-muted" style="font-size:0.8rem;">${formatDate(h.created_at)}</span>
                        </div>
                        <div class="hm-card__body">
                            <p style="font-size:0.85rem;"><strong>Por:</strong> ${escapeHtml(userName)}</p>
                            ${h.comment ? `<p style="font-size:0.85rem;color:var(--on-surface-variant);"><em>${escapeHtml(h.comment)}</em></p>` : ''}
                            ${changesHtml}
                        </div>
                    </div>`;
        }).join('')}
            </div>
            <div style="margin-top:1rem;text-align:right;">
                <button class="btn btn--outline btn--sm" onclick="exportPostHistory(${postId})">
                    <span class="material-symbols-rounded">download</span> Exportar CSV
                </button>
            </div>
        `;
    } catch (err) {
        loading.style.display = 'none';
        content.style.display = '';
        content.innerHTML = `<div class="alert alert--error"><p>${escapeHtml(err.message)}</p></div>`;
    }
}

function renderHistoryChanges(changes) {
    if (!changes || typeof changes !== 'object') return '';
    const entries = Object.entries(changes);

    console.log("cambios a mostrar:", entries);
    if (entries.length === 0) return '';

    return `<div style="margin-top:0.5rem;font-size:0.8rem;">
        <table style="width:100%;border-collapse:collapse;">
            <thead><tr style="border-bottom:1px solid var(--border);">
                <th style="text-align:left;padding:0.25rem 0.5rem;">Campo</th>
                <th style="text-align:left;padding:0.25rem 0.5rem;">Antes</th>
                <th style="text-align:left;padding:0.25rem 0.5rem;">Después</th>
            </tr></thead>
            <tbody>
                ${entries.map(([key, val]) => {
        const before = val.old !== undefined ? escapeHtml(String(val.old)) : '—';
        console.log("valor del cambio:", val);
        const after = val.new !== undefined ? escapeHtml(String(val.new)) : '—';
        return `<tr style="border-bottom:1px solid var(--border);">
                        <td style="padding:0.25rem 0.5rem;font-weight:500;">${escapeHtml(key)}</td>
                        <td style="padding:0.25rem 0.5rem;color:#B71C1C;">${before}</td>
                        <td style="padding:0.25rem 0.5rem;color:#1B5E20;">${after}</td>
                    </tr>`;
    }).join('')}
            </tbody>
        </table>
    </div>`;
}

async function exportPostHistory(postId) {
    try {
        const token = storage.getToken();
        const response = await fetch(`${API_BASE}/posts/${postId}/history/export`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'text/csv' }
        });
        if (!response.ok) throw new Error('Error al exportar');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `historial_post_${postId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Historial exportado', 'success');
    } catch (err) {
        showToast('Error al exportar: ' + err.message, 'error');
    }
}

// ── Saved Filters (H11b) ──

async function loadSavedFilters() {
    try {
        const res = await api.get('/posts/saved-filters', true);
        postsSavedFiltersCache = res.data || [];
        const select = document.getElementById('postSavedFilters');
        if (!select) return;

        if (postsSavedFiltersCache.length === 0) {
            select.style.display = 'none';
            return;
        }

        select.style.display = '';
        select.innerHTML = '<option value="">— Filtros guardados —</option>'
            + postsSavedFiltersCache.map(f =>
                `<option value="${f.id}">${escapeHtml(f.name)}</option>`
            ).join('');
    } catch { /* silent */ }
}

async function saveCurrentFilter() {
    const name = prompt('Nombre para este filtro:');
    if (!name || !name.trim()) return;

    const filters = {};
    const search = document.getElementById('postFilterSearch')?.value.trim();
    const status = document.getElementById('postFilterStatus')?.value;
    const type = document.getElementById('postFilterType')?.value;
    const dateFrom = document.getElementById('postFilterDateFrom')?.value;
    const dateTo = document.getElementById('postFilterDateTo')?.value;

    if (search) filters.search = search;
    if (status) filters.status = status;
    if (type) filters.type = type;
    if (dateFrom) filters.created_from = dateFrom;
    if (dateTo) filters.created_to = dateTo;

    try {
        await api.post('/posts/saved-filters', { name: name.trim(), filters }, true);
        showToast('Filtro guardado correctamente', 'success');
        loadSavedFilters();
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

function applySavedFilter(filterId) {
    const filter = postsSavedFiltersCache.find(f => f.id === parseInt(filterId));
    if (!filter) return;

    const f = filter.filters || {};
    document.getElementById('postFilterSearch').value = f.search || '';
    document.getElementById('postFilterStatus').value = f.status || '';
    document.getElementById('postFilterType').value = f.type || '';
    document.getElementById('postFilterDateFrom').value = f.created_from || '';
    document.getElementById('postFilterDateTo').value = f.created_to || '';

    loadPosts(1);
}

function confirmPostAction() {
    if (typeof postActionCallback === 'function') {
        Promise.resolve(postActionCallback()).catch(err => {
            showToast('Error: ' + err.message, 'error');
        });
    }
}
