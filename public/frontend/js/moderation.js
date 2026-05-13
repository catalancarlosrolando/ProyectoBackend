/**
 * =============================================
 * Difexa Frontend – Módulo de Moderación
 * =============================================
 * Funcionalidades: H13 (moderación) + H14 (detener difusión)
 * Endpoints:
 *   GET    /api/moderation/posts         → lista pendientes
 *   GET    /api/moderation/posts/{id}    → detalle para revisión
 *   POST   /api/moderation/posts/{id}/approve → aprobar
 *   POST   /api/moderation/posts/{id}/reject  → rechazar
 *   POST   /api/moderation/posts/{id}/stop    → detener difusión
 * =============================================
 */

let moderationCurrentPage = 1;
let moderationReviewPostId = null;

// ── Load pending moderation posts ──

async function loadModerationPosts(page = 1) {
    moderationCurrentPage = page;

    const loading = document.getElementById('moderationLoading');
    const empty = document.getElementById('moderationEmpty');
    const table = document.getElementById('moderationTableWrapper');
    const cards = document.getElementById('moderationMobileCards');
    const pagination = document.getElementById('moderationPagination');

    loading.style.display = 'flex';
    empty.style.display = 'none';
    table.style.display = 'none';
    cards.style.display = 'none';

    try {
        const res = await api.get(`/moderation/posts?page=${page}`, true);
        const data = res.data;
        const posts = data.data || [];

        loading.style.display = 'none';

        if (posts.length === 0) {
            empty.style.display = 'block';
            if (pagination) pagination.innerHTML = '';
            return;
        }

        renderModerationDesktopTable(posts);
        renderModerationMobileCards(posts);

        table.style.display = '';
        cards.style.display = '';

        if (pagination) {
            renderModerationPagination(data, pagination);
        }
    } catch (err) {
        loading.style.display = 'none';
        empty.style.display = 'block';
        empty.innerHTML = `<span class="material-symbols-rounded" style="font-size:3rem;color:var(--error);">error</span>
            <h3>Error al cargar moderación</h3>
            <p>${escapeHtml(err.message)}</p>`;
    }
}

function renderModerationActionMenu(post) {
    const safeName = escapeHtml(post.name).replace(/'/g, "\\'");
    let items = '';

    items += `<button class="au-actions-menu__item au-actions-menu__item--success" onclick="openModerationReview(${post.id})">
        <span class="material-symbols-rounded">rate_review</span> Revisar
    </button>`;
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

// ── Render desktop table ──

function renderModerationDesktopTable(posts) {
    const tbody = document.getElementById('moderationTableBody');
    if (!tbody) return;

    tbody.innerHTML = posts.map(post => {
        const userName = post.user ? (post.user.name || `${post.user.first_name} ${post.user.last_name}`) : '—';
        return `
        <div class="au-row">
            <span class="au-cell au-col--id">${post.id}</span>
            <span class="au-cell post-col--title">${escapeHtml(post.name)}</span>
            <span class="au-cell post-col--type">${escapeHtml(post.type)}</span>
            <span class="au-cell post-col--channels">${escapeHtml(userName)}</span>
            <span class="au-cell post-col--date">${formatDate(post.created_at)}</span>
            <div class="au-cell au-cell--actions">
                ${renderModerationActionMenu(post)}
            </div>
        </div>`;
    }).join('');

}

// ── Render mobile cards ──

function renderModerationPagination(data, container) {
    if (!data || data.last_page <= 1) {
        container.innerHTML = '';
        return;
    }
    const current = data.current_page;
    const last = data.last_page;
    let html = '<div class="pagination">';
    html += `<button class="pagination__btn" ${current <= 1 ? 'disabled' : ''} onclick="loadModerationPosts(${current - 1})">
        <span class="material-symbols-rounded">chevron_left</span></button>`;
    for (let i = 1; i <= last; i++) {
        if (last > 7 && i > 2 && i < last - 1 && Math.abs(i - current) > 1) {
            if (i === 3 || i === last - 2) html += '<span class="pagination__dots">…</span>';
            continue;
        }
        html += `<button class="pagination__btn ${i === current ? 'pagination__btn--active' : ''}" onclick="loadModerationPosts(${i})">${i}</button>`;
    }
    html += `<button class="pagination__btn" ${current >= last ? 'disabled' : ''} onclick="loadModerationPosts(${current + 1})">
        <span class="material-symbols-rounded">chevron_right</span></button>`;
    html += '</div>';
    container.innerHTML = html;
}

function renderModerationMobileCards(posts) {
    const container = document.getElementById('moderationMobileCards');
    if (!container) return;

    container.innerHTML = posts.map(post => {
        const userName = post.user ? (post.user.name || `${post.user.first_name} ${post.user.last_name}`) : '—';
        return `
        <div class="hm-card">
            <div class="hm-card__accent" style="background:#F57C00;"></div>
            <div class="hm-card__body">
                <div class="hm-card__top-row">
                    <span class="au-status-badge" style="background:#FFF3E0;color:#E65100;">
                        <span class="material-symbols-rounded" style="font-size:14px;">pending</span>
                        Pendiente
                    </span>
                    <span class="hm-card__date">${formatDate(post.created_at)}</span>
                </div>
                <div>
                    <strong>${escapeHtml(post.name)}</strong>
                    <div class="text-muted" style="font-size:0.8rem;">Por: ${escapeHtml(userName)} · Tipo: ${escapeHtml(post.type)}</div>
                </div>
                <div class="post-actions-row">
                    ${renderModerationActionMenu(post)}
                </div>
            </div>
        </div>`;
    }).join('');
}

// ── Open moderation review modal ──

async function openModerationReview(postId) {
    moderationReviewPostId = postId;

    const content = document.getElementById('moderationReviewContent');
    const comments = document.getElementById('moderationComments');

    content.innerHTML = '<div style="text-align:center;padding:2rem;"><span class="spinner"></span></div>';
    comments.value = '';
    openModal('moderationReviewModal');

    try {
        const res = await api.get(`/moderation/posts/${postId}`, true);
        const post = res.data;

        const userName = post.user ? (post.user.name || `${post.user.first_name} ${post.user.last_name}`) : '—';
        const channels = (post.channels || []).map(c => `<span class="au-status-badge" style="background:#E3F2FD;color:#0D47A1;">${escapeHtml(c.name)}</span>`).join(' ');
        const medias = (post.medias || []).map(m => `<span class="au-status-badge" style="background:#F3E5F5;color:#6A1B9A;">${escapeHtml(m.name)}</span>`).join(' ');
        const attachments = (post.attachments || []).map(a => `<span class="au-status-badge" style="background:#ECEFF1;color:#37474F;"><span class="material-symbols-rounded" style="font-size:14px;">attach_file</span>${escapeHtml(a.original_name || a.file_name)}</span>`).join(' ');

        content.innerHTML = `
            <div class="mod-review-section">
                <h4>Información general</h4>
                <div class="mod-review-detail">
                    <p><strong>Título:</strong> ${escapeHtml(post.name)}</p>
                    <p><strong>Tipo:</strong> ${escapeHtml(post.type)}</p>
                    <p><strong>Autor:</strong> ${escapeHtml(userName)}</p>
                    <p><strong>Creada:</strong> ${formatDate(post.created_at)}</p>
                    ${post.scheduled_at ? `<p><strong>Programada:</strong> ${formatDate(post.scheduled_at)}</p>` : ''}
                </div>
            </div>
            <div class="mod-review-section">
                <h4>Contenido</h4>
                <div class="mod-review-detail" style="background:var(--surface-variant);padding:1rem;border-radius:var(--radius-md);white-space:pre-wrap;">${escapeHtml(post.content)}</div>
            </div>
            ${channels ? `<div class="mod-review-section"><h4>Canales</h4><div style="display:flex;gap:0.5rem;flex-wrap:wrap;">${channels}</div></div>` : ''}
            ${medias ? `<div class="mod-review-section"><h4>Medios</h4><div style="display:flex;gap:0.5rem;flex-wrap:wrap;">${medias}</div></div>` : ''}
            ${attachments ? `<div class="mod-review-section"><h4>Adjuntos</h4><div style="display:flex;gap:0.5rem;flex-wrap:wrap;">${attachments}</div></div>` : ''}
            ${post.moderator_comments ? `<div class="mod-review-section"><h4>Comentarios anteriores</h4><div class="mod-review-detail" style="color:var(--error);"><em>${escapeHtml(post.moderator_comments)}</em></div></div>` : ''}
        `;
    } catch (err) {
        content.innerHTML = `<div class="alert alert--error"><p>${escapeHtml(err.message)}</p></div>`;
    }
}

// ── Approve post ──

async function approveModerationPost() {
    if (!moderationReviewPostId) return;

    const comments = document.getElementById('moderationComments').value.trim();
    const btn = document.getElementById('btnModerationApprove');
    btn.disabled = true;

    try {
        await api.post(`/moderation/posts/${moderationReviewPostId}/approve`, {
            comments: comments || undefined
        }, true);
        closeModal('moderationReviewModal');
        showToast('Publicación aprobada correctamente', 'success');
        loadModerationPosts(moderationCurrentPage);
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
    }
}

// ── Reject post ──

async function rejectModerationPost() {
    if (!moderationReviewPostId) return;

    const comments = document.getElementById('moderationComments').value.trim();
    if (!comments) {
        showToast('Debes incluir comentarios al rechazar la publicación', 'warning');
        document.getElementById('moderationComments').focus();
        return;
    }

    const btn = document.getElementById('btnModerationReject');
    btn.disabled = true;

    try {
        await api.post(`/moderation/posts/${moderationReviewPostId}/reject`, {
            moderator_comments: comments
        }, true);
        closeModal('moderationReviewModal');
        showToast('Publicación rechazada. Se notificó al publicador.', 'success');
        loadModerationPosts(moderationCurrentPage);
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
    }
}

// ── Stop publication (H14) ──

function openStopPostAction(postId, postName) {
    document.getElementById('postActionTitle').textContent = 'Detener difusión';
    document.getElementById('postActionDesc').textContent = `¿Deseas detener la difusión de "${postName}"? La publicación volverá a estado borrador.`;
    document.getElementById('postActionReasonLabel').textContent = 'Razón de la detención *';
    document.getElementById('postActionReason').value = '';
    document.getElementById('postActionReason').placeholder = 'Describe por qué se detiene esta publicación...';
    const btn = document.getElementById('btnPostActionConfirm');
    btn.className = 'btn btn--danger';
    btn.innerHTML = '<span class="material-symbols-rounded">stop_circle</span> Detener';
    postActionCallback = async () => {
        const reason = document.getElementById('postActionReason').value.trim();
        if (!reason) { showToast('La razón es obligatoria', 'warning'); return; }
        btn.disabled = true;
        try {
            await api.post(`/moderation/posts/${postId}/stop`, { reason, confirm: true }, true);
            closeModal('postActionModal');
            showToast('Publicación detenida correctamente', 'success');
            loadModerationPosts(moderationCurrentPage);
            // Also refresh posts if the section is active
            if (document.getElementById('sectionPosts')?.classList.contains('active')) loadPosts();
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        } finally { btn.disabled = false; }
    };
    openModal('postActionModal');
}
