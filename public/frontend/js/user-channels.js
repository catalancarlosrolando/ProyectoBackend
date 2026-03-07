/**
 * =============================================
 * Difexa Frontend - Asignación Canales ↔ Publicadores
 * =============================================
 */

// ── Load Publishers ──

async function loadUserChannels(page = 1) {
    if (!state.isAuthenticated) return;

    const loading = document.getElementById('ucLoading');
    const empty = document.getElementById('ucEmpty');
    const tableWrapper = document.getElementById('ucTableWrapper');

    loading.style.display = 'flex';
    empty.style.display = 'none';
    tableWrapper.style.display = 'none';



    try {
        const res = await api.get(`/admin/user-channels/publishers?page=${page}`, true);
        // paginate() devuelve { data: [...], current_page, last_page, total, from, to }
        const paginated = res.data || {};
        const publishers = paginated.data || [];

        state.userChannels.currentPage = paginated.current_page || 1;
        state.userChannels.lastPage = paginated.last_page || 1;

        loading.style.display = 'none';

        if (publishers.length === 0) {
            empty.style.display = 'block';
            document.getElementById('ucPagination').innerHTML = '';
            return;
        }

        tableWrapper.style.display = 'block';
        renderPublishersTable(publishers);
        renderUcPagination(paginated);
    } catch (err) {
        loading.style.display = 'none';
        empty.style.display = 'block';
        showToast('Error al cargar publicadores: ' + err.message, 'error');
    }
}

function renderPublishersTable(publishers) {
    // Desktop
    const tbody = document.getElementById('ucTableBody');
    tbody.innerHTML = publishers.map(pub => {
        const fullName = [pub.first_name, pub.last_name].filter(Boolean).join(' ') || pub.name;
        const channelTags = renderUserChannelTags(pub.channels || []);
        const count = (pub.channels || []).length;
        return `
        <div class="au-row">
            <span class="au-cell au-cell--id">${pub.id}</span>
            <div class="au-cell uc-cell--name">
                <span class="au-name-text">${escapeHtml(fullName)}</span>
                <span class="au-email-text">${escapeHtml(pub.email)}</span>
            </div>
            <div class="au-cell uc-cell--channels">
                ${channelTags}
            </div>
            <div class="au-cell uc-cell--count">
                <span class="uc-count-badge">${count}</span>
            </div>
            <div class="au-cell au-cell--actions">
                <div class="au-actions-dropdown">
                    <button class="au-actions-trigger" onclick="toggleActionsMenu(event, this)" title="Acciones">
                        <span class="material-symbols-rounded" style="font-size:20px">more_vert</span>
                    </button>
                    <div class="au-actions-menu">
                        <button class="au-actions-menu__item au-actions-menu__item--success" onclick="openAssignChannelsModal(${pub.id})">
                            <span class="material-symbols-rounded">add_link</span> Asignar canales
                        </button>
                        <button class="au-actions-menu__item au-actions-menu__item--danger" onclick="openRevokeChannelsModal(${pub.id})">
                            <span class="material-symbols-rounded">link_off</span> Revocar canales
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');

    // Mobile cards
    const mobile = document.getElementById('ucMobileCards');
    mobile.innerHTML = publishers.map(pub => {
        const fullName = [pub.first_name, pub.last_name].filter(Boolean).join(' ') || pub.name;
        const channelTags = renderUserChannelTags(pub.channels || []);
        const count = (pub.channels || []).length;
        return `
        <div class="au-user-card">
            <div class="au-user-card__top">
                <div class="au-user-card__left">
                    <div class="au-user-card__avatar" style="background:#E3F2FD;color:#1565C0;">
                        <span class="material-symbols-rounded" style="font-size:18px;">person</span>
                    </div>
                    <div class="au-user-card__name-col">
                        <span class="au-user-card__name">${escapeHtml(fullName)}</span>
                        <span class="au-user-card__id">${escapeHtml(pub.email)}</span>
                    </div>
                </div>
                <span class="uc-count-badge">${count} canal${count !== 1 ? 'es' : ''}</span>
            </div>
            <div class="au-user-card__divider"></div>
            <div class="au-user-card__info">
                <div class="au-user-card__info-row" style="flex-wrap:wrap;gap:0.375rem;">
                    <span class="material-symbols-rounded au-user-card__info-icon">podcasts</span>
                    ${channelTags}
                </div>
            </div>
            <div class="au-user-card__actions">
                <div class="au-actions-dropdown">
                    <button class="au-actions-trigger" onclick="toggleActionsMenu(event, this)" title="Acciones">
                        <span class="material-symbols-rounded" style="font-size:20px">more_vert</span>
                    </button>
                    <div class="au-actions-menu">
                        <button class="au-actions-menu__item au-actions-menu__item--success" onclick="openAssignChannelsModal(${pub.id})">
                            <span class="material-symbols-rounded">add_link</span> Asignar canales
                        </button>
                        <button class="au-actions-menu__item au-actions-menu__item--danger" onclick="openRevokeChannelsModal(${pub.id})">
                            <span class="material-symbols-rounded">link_off</span> Revocar canales
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}

function renderUcPagination(pagination) {
    const container = document.getElementById('ucPagination');
    if (!pagination || pagination.last_page <= 1) {
        container.innerHTML = `<span class="pagination-info">${pagination.total || 0} publicador(es)</span>`;
        return;
    }

    let html = '';

    // Prev
    if (pagination.current_page > 1) {
        html += `<button class="btn btn--sm btn--outline" onclick="loadUserChannels(${pagination.current_page - 1})">←</button>`;
    }

    // Pages
    for (let i = 1; i <= pagination.last_page; i++) {
        if (
            i === 1 || i === pagination.last_page ||
            (i >= pagination.current_page - 2 && i <= pagination.current_page + 2)
        ) {
            html += `<button class="btn btn--sm ${i === pagination.current_page ? 'active' : 'btn--outline'}"
                        onclick="loadUserChannels(${i})">${i}</button>`;
        } else if (i === pagination.current_page - 3 || i === pagination.current_page + 3) {
            html += `<span style="padding:0 0.25rem;">…</span>`;
        }
    }

    // Next
    if (pagination.current_page < pagination.last_page) {
        html += `<button class="btn btn--sm btn--outline" onclick="loadUserChannels(${pagination.current_page + 1})">→</button>`;
    }

    html += `<span class="pagination-info">${pagination.from}-${pagination.to} de ${pagination.total}</span>`;
    container.innerHTML = html;
}

function renderUserChannelTags(channels) {
    if (!channels || channels.length === 0) {
        return '<span class="au-role-badge au-role-badge--muted">Sin canales</span>';
    }
    return channels.map(ch => {
        const c = CHANNEL_TYPE_COLORS[ch.type] || { bg: '#EEEEEE', text: '#49454F', icon: 'label' };
        return `<span class="ch-media-tag" style="background:${c.bg};color:${c.text};">
            <span class="material-symbols-rounded" style="font-size:13px;">${c.icon}</span>
            ${escapeHtml(ch.name)}
        </span>`;
    }).join('');
}



// ── Assign Channels Modal ──

async function openAssignChannelsModal(userId) {
    state.userChannels.assignUserId = userId;

    const loading = document.getElementById('ucAssignLoading');
    const content = document.getElementById('ucAssignContent');

    loading.style.display = 'flex';
    content.style.display = 'none';

    openModal('ucAssignModal');

    try {
        // Cargar canales disponibles y canales ya asignados en paralelo
        const [channelsRes, userRes] = await Promise.all([
            api.get('/admin/channels', true),
            api.get(`/admin/user-channels/${userId}`, true),
        ]);

        const allChannels = channelsRes.data || [];
        const userChannels = userRes.data.channels || [];
        console.log("canales del usuario:", userRes.data);
        const assignedIds = new Set(userChannels.map(ch => ch.id));
        const userName = [userRes.data.user.first_name, userRes.data.user.last_name].filter(Boolean).join(' ') || userRes.data.user.name;

        document.getElementById('ucAssignTitle').textContent = `Asignar Canales a: ${userName}`;

        loading.style.display = 'none';
        content.style.display = 'block';

        // Agrupar canales por tipo
        const grouped = {};
        allChannels.forEach(ch => {
            const type = ch.type || 'otro';
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(ch);
        });

        let html = '';
        for (const [type, channels] of Object.entries(grouped)) {
            const c = CHANNEL_TYPE_COLORS[type] || { bg: '#EEEEEE', text: '#49454F', icon: 'label' };
            const label = CHANNEL_TYPE_LABELS[type] || type;
            html += `<div class="ch-media-group">
                <div class="ch-media-group-title">
                    <span class="material-symbols-rounded" style="font-size:18px;color:${c.text};">${c.icon}</span>
                    <span>${escapeHtml(label)}</span>
                </div>
                <div class="ch-media-group-items">`;
            channels.forEach(ch => {
                const checked = assignedIds.has(ch.id) ? 'checked' : '';
                html += `
                    <label class="ch-media-checkbox">
                        <input type="checkbox" value="${ch.id}" ${checked} class="uc-channel-checkbox-input"
                               data-previously="${assignedIds.has(ch.id) ? '1' : '0'}">
                        <span class="ch-media-checkbox-label">${escapeHtml(ch.name)}</span>
                    </label>`;
            });
            html += `</div></div>`;
        }


        if (allChannels.length === 0) {
            html = '<p class="text-muted" style="text-align:center;">No hay canales disponibles. Crea uno primero.</p>';
        }

        content.innerHTML = html;
    } catch (err) {
        loading.style.display = 'none';
        showToast('Error al cargar datos: ' + err.message, 'error');
    }
}

async function submitAssignChannels() {
    const userId = state.userChannels.assignUserId;
    if (!userId) return;

    const checkboxes = document.querySelectorAll('#ucAssignContent .uc-channel-checkbox-input');
    const toAssign = [];
    const toRevoke = [];

    checkboxes.forEach(cb => {
        const id = parseInt(cb.value);
        const wasPreviously = cb.dataset.previously === '1';
        const isNow = cb.checked;

        if (isNow && !wasPreviously) toAssign.push(id);
        if (!isNow && wasPreviously) toRevoke.push(id);
    });

    //if (toAssign.length === 0 && toRevoke.length === 0) {
    //    showToast('No se realizaron cambios.', 'info');
    //   closeModal('ucAssignModal');
    //   return;
    //}

    const btn = document.getElementById('btnUcAssignSubmit');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
        if (toAssign.length >= 0) {
            const dataasig = await api.post(`/admin/user-channels/${userId}`, { channel_ids: toAssign }, true);
        }
        if (toRevoke.length > 0) {
            await api.request('DELETE', `/admin/user-channels/${userId}`, {
                body: { channel_ids: toRevoke },
                auth: true,
            });
        }

        const msgs = [];
        if (toAssign.length > 0) msgs.push(`${toAssign.length} asignado(s)`);
        if (toRevoke.length > 0) msgs.push(`${toRevoke.length} revocado(s)`);
        showToast(`Canales actualizados: ${msgs.join(', ')}. Se notificó al publicador.`, 'success');

        closeModal('ucAssignModal');
        loadUserChannels(state.userChannels.currentPage);

    } catch (err) {
        showToast('Error al actualizar canales: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar Asignación';
    }
}

// ── Revoke Channels Modal ──

async function openRevokeChannelsModal(userId) {
    closeAllActionMenus();
    state.userChannels.revokeUserId = userId;

    const loading = document.getElementById('ucRevokeLoading');
    const empty = document.getElementById('ucRevokeEmpty');
    const content = document.getElementById('ucRevokeContent');
    const actions = document.getElementById('ucRevokeActions');

    loading.style.display = 'flex';
    empty.style.display = 'none';
    content.style.display = 'none';
    actions.style.display = 'none';

    openModal('ucRevokeModal');

    try {
        const res = await api.get(`/admin/user-channels/${userId}`, true);
        const { user, channels } = res.data;

        const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.name;
        document.getElementById('ucRevokeTitle').textContent = `Revocar Canales de: ${fullName}`;

        loading.style.display = 'none';

        if (!channels || channels.length === 0) {
            empty.style.display = 'block';
            return;
        }

        actions.style.display = 'flex';
        content.style.display = 'block';

        // Agrupar canales por tipo
        const grouped = {};
        channels.forEach(ch => {
            const type = ch.type || 'otro';
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(ch);
        });

        let html = '';
        for (const [type, chs] of Object.entries(grouped)) {
            const c = CHANNEL_TYPE_COLORS[type] || { bg: '#EEEEEE', text: '#49454F', icon: 'label' };
            const label = CHANNEL_TYPE_LABELS[type] || type;
            html += `<div class="ch-media-group">
                <div class="ch-media-group-title">
                    <span class="material-symbols-rounded" style="font-size:18px;color:${c.text};">${c.icon}</span>
                    <span>${escapeHtml(label)}</span>
                </div>
                <div class="ch-media-group-items">`;
            chs.forEach(ch => {
                html += `
                    <label class="ch-media-checkbox">
                        <input type="checkbox" value="${ch.id}" class="uc-revoke-checkbox-input">
                        <span class="ch-media-checkbox-label">${escapeHtml(ch.name)}</span>
                    </label>`;
            });
            html += `</div></div>`;
        }

        content.innerHTML = html;
    } catch (err) {
        loading.style.display = 'none';
        showToast('Error al cargar canales: ' + err.message, 'error');
    }
}

async function submitRevokeChannels() {
    const userId = state.userChannels.revokeUserId;
    if (!userId) return;

    const checkboxes = document.querySelectorAll('#ucRevokeContent .uc-revoke-checkbox-input:checked');
    const ids = Array.from(checkboxes).map(cb => parseInt(cb.value));

    if (ids.length === 0) {
        showToast('Selecciona al menos un canal para revocar.', 'warning');
        return;
    }

    const btn = document.getElementById('btnUcRevokeSubmit');
    btn.disabled = true;
    btn.textContent = 'Revocando...';

    try {
        await api.request('DELETE', `/admin/user-channels/${userId}`, {
            body: { channel_ids: ids },
            auth: true,
        });

        showToast(`${ids.length} canal(es) revocado(s) correctamente. Se notificó al publicador.`, 'success');
        closeModal('ucRevokeModal');
        loadUserChannels(state.userChannels.currentPage);
    } catch (err) {
        showToast('Error al revocar canales: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Revocar Seleccionados';
    }
}
