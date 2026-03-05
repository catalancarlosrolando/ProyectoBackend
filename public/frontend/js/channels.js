/**
 * =============================================
 * Difexa Frontend - Gestión de Canales
 * =============================================
 */

const CHANNEL_TYPE_LABELS = {
    departamento: 'Departamento',
    instituto: 'Instituto',
    'secretaría': 'Secretaría',
    centro: 'Centro',
};

const CHANNEL_TYPE_COLORS = {
    departamento: { bg: '#D4E9FF', text: '#0D47A1', icon: 'apartment' },
    instituto: { bg: '#E8F5E9', text: '#1B5E20', icon: 'school' },
    'secretaría': { bg: '#FFF3E0', text: '#E65100', icon: 'admin_panel_settings' },
    centro: { bg: '#F3E5F5', text: '#6A1B9A', icon: 'hub' },
};

const MEDIA_TYPE_ICONS = {
    physical_screen: 'tv',
    social_media: 'share',
    editorial_platform: 'article',
};

const MEDIA_TYPE_COLORS = {
    physical_screen: { bg: '#E1F5FE', text: '#0277BD' },
    social_media: { bg: '#FCE4EC', text: '#C62828' },
    editorial_platform: { bg: '#F3E5F5', text: '#6A1B9A' },
};

// ── Helpers ──

function renderChannelTypeBadge(type) {
    const c = CHANNEL_TYPE_COLORS[type] || { bg: '#EEEEEE', text: '#49454F', icon: 'label' };
    const label = CHANNEL_TYPE_LABELS[type] || type;
    return `<span class="au-status-badge" style="background:${c.bg};color:${c.text};">
        <span class="material-symbols-rounded" style="font-size:16px;color:${c.text};">${c.icon}</span>
        ${escapeHtml(label).toUpperCase()}
    </span>`;
}

function renderMediaTypeBadge(type, label) {
    const c = MEDIA_TYPE_COLORS[type] || { bg: '#EEEEEE', text: '#49454F' };
    const icon = MEDIA_TYPE_ICONS[type] || 'devices';
    return `<span class="au-status-badge" style="background:${c.bg};color:${c.text};">
        <span class="material-symbols-rounded" style="font-size:14px;color:${c.text};">${icon}</span>
        ${escapeHtml(label || type)}
    </span>`;
}

function renderChannelMediasList(medias) {
    if (!medias || medias.length === 0) {
        return '<span class="au-role-badge au-role-badge--muted">Sin medios</span>';
    }
    return medias.map(m => {
        const c = MEDIA_TYPE_COLORS[m.type] || { bg: '#EEEEEE', text: '#49454F' };
        const icon = MEDIA_TYPE_ICONS[m.type] || 'devices';
        return `<span class="ch-media-tag" style="background:${c.bg};color:${c.text};">
            <span class="material-symbols-rounded" style="font-size:13px;">${icon}</span>
            ${escapeHtml(m.name)}
        </span>`;
    }).join('');
}

function truncateText(text, max = 60) {
    if (!text) return '—';
    return text.length > max ? text.substring(0, max) + '…' : text;
}

function renderLastModifiedInfo(channel) {
    if (!channel.last_modified_at) return '—';
    const user = channel.last_modified_by_user || channel.last_modified_by;
    let userName = '—';
    if (user && typeof user === 'object') {
        userName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.name || 'Usuario #' + user.id;
    }
    return `<span class="ch-modified-info">
        <span class="material-symbols-rounded" style="font-size:14px;">person</span>
        ${escapeHtml(userName)} · ${formatDate(channel.last_modified_at)}
    </span>`;
}

// ── Load Channels ──

async function loadChannels() {
    if (!state.isAuthenticated) return;

    const loading = document.getElementById('channelsLoading');
    const empty = document.getElementById('channelsEmpty');
    const tableWrapper = document.getElementById('channelsTableWrapper');

    loading.style.display = 'flex';
    empty.style.display = 'none';
    tableWrapper.style.display = 'none';

    try {
        const res = await api.get('/channels', true);
        const channels = res.data || [];

        loading.style.display = 'none';

        if (channels.length === 0) {
            empty.style.display = 'block';
            return;
        }

        tableWrapper.style.display = 'block';
        renderChannelsTable(channels);
    } catch (err) {
        loading.style.display = 'none';
        empty.style.display = 'block';
        showToast('Error al cargar canales: ' + err.message, 'error');
    }
}

function renderChannelsTable(channels) {
    // Desktop
    const tbody = document.getElementById('channelsTableBody');
    tbody.innerHTML = channels.map(ch => `
        <div class="au-row">
            <span class="au-cell au-cell--id">${ch.id}</span>
            <div class="au-cell ch-cell--name">
                <span class="au-name-text">${escapeHtml(ch.name)}</span>
            </div>
            <div class="au-cell ch-cell--type">${renderChannelTypeBadge(ch.type)}</div>
            <div class="au-cell ch-cell--desc">
                <span class="ch-desc-text">${escapeHtml(truncateText(ch.description, 50))}</span>
            </div>
            <div class="au-cell ch-cell--medias">${renderChannelMediasList(ch.medias)}</div>
            <div class="au-cell au-cell--actions">
                <button class="au-action-btn au-action-btn--view" onclick="viewChannelDetail(${ch.id})" title="Ver detalle">
                    <span class="material-symbols-rounded" style="font-size:16px;">visibility</span>
                </button>
                <button class="au-action-btn au-action-btn--history" onclick="openEditChannelModal(${ch.id})" title="Editar">
                    <span class="material-symbols-rounded" style="font-size:16px;">edit</span>
                </button>
                <button class="au-action-btn au-action-btn--reject" onclick="confirmDeleteChannel(${ch.id}, '${escapeHtml(ch.name)}')" title="Eliminar">
                    <span class="material-symbols-rounded" style="font-size:16px;">delete</span>
                </button>
            </div>
        </div>
    `).join('');

    // Mobile cards
    const mobileContainer = document.getElementById('channelsMobileCards');
    mobileContainer.innerHTML = channels.map(ch => `
        <div class="au-user-card">
            <div class="au-user-card__top">
                <div class="au-user-card__left">
                    <div class="au-user-card__avatar" style="background:${(CHANNEL_TYPE_COLORS[ch.type] || {}).bg || '#D4E9FF'};color:${(CHANNEL_TYPE_COLORS[ch.type] || {}).text || '#0D47A1'};">
                        <span class="material-symbols-rounded" style="font-size:18px;">${(CHANNEL_TYPE_COLORS[ch.type] || {}).icon || 'label'}</span>
                    </div>
                    <div class="au-user-card__name-col">
                        <span class="au-user-card__name">${escapeHtml(ch.name)}</span>
                        <span class="au-user-card__id">ID: ${ch.id}</span>
                    </div>
                </div>
                ${renderChannelTypeBadge(ch.type)}
            </div>
            <div class="au-user-card__divider"></div>
            <div class="au-user-card__info">
                <div class="au-user-card__info-row">
                    <span class="material-symbols-rounded au-user-card__info-icon">description</span>
                    <span>${escapeHtml(truncateText(ch.description, 80))}</span>
                </div>
                <div class="au-user-card__info-row">
                    <span class="material-symbols-rounded au-user-card__info-icon">calendar_today</span>
                    <span>${formatDate(ch.created_at)}</span>
                </div>
                <div class="au-user-card__info-row" style="flex-wrap:wrap;gap:0.375rem;">
                    <span class="material-symbols-rounded au-user-card__info-icon">subscriptions</span>
                    ${renderChannelMediasList(ch.medias)}
                </div>
            </div>
            <div class="au-user-card__actions">
                <button class="au-action-btn au-action-btn--view" onclick="viewChannelDetail(${ch.id})" title="Ver detalle">
                    <span class="material-symbols-rounded" style="font-size:18px;">visibility</span>
                </button>
                <button class="au-action-btn au-action-btn--history" onclick="openEditChannelModal(${ch.id})" title="Editar">
                    <span class="material-symbols-rounded" style="font-size:18px;">edit</span>
                </button>
                <button class="au-action-btn au-action-btn--reject" onclick="confirmDeleteChannel(${ch.id}, '${escapeHtml(ch.name)}')" title="Eliminar">
                    <span class="material-symbols-rounded" style="font-size:18px;">delete</span>
                </button>
            </div>
        </div>
    `).join('');
}

// ── View Channel Detail ──

async function viewChannelDetail(channelId) {
    const card = document.getElementById('channelDetailCard');
    card.style.display = '';

    try {
        const res = await api.get(`/channels/${channelId}`, true);
        const ch = res.data;
        if (!ch) throw new Error('Canal no encontrado');

        state.channels.selectedChannelId = ch.id;

        document.getElementById('channelDetailTitle').textContent = `Detalle: ${ch.name}`;
        document.getElementById('cdName').textContent = ch.name;
        document.getElementById('cdType').innerHTML = renderChannelTypeBadge(ch.type);
        document.getElementById('cdDescription').textContent = ch.description || '—';
        document.getElementById('cdSemanticContext').textContent = ch.semantic_context || '—';
        document.getElementById('cdCreatedAt').textContent = formatDate(ch.created_at);
        document.getElementById('cdUpdatedAt').textContent = formatDate(ch.updated_at);

        // Última modificación
        const modifiedContainer = document.getElementById('cdLastModified');
        if (modifiedContainer) {
            modifiedContainer.innerHTML = renderLastModifiedInfo(ch);
        }

        // Medias list
        const mediasContainer = document.getElementById('cdMedias');
        if (ch.medias && ch.medias.length > 0) {
            mediasContainer.innerHTML = ch.medias.map(m => `
                <div class="ch-detail-media-item">
                    ${renderMediaTypeBadge(m.type)}
                    <span class="ch-detail-media-name">${escapeHtml(m.name)}</span>
                    <span class="ch-detail-media-status">${m.is_active ? '🟢 Activo' : '🔴 Inactivo'}</span>
                </div>
            `).join('');
        } else {
            mediasContainer.innerHTML = '<span class="au-role-badge au-role-badge--muted">Sin medios asociados</span>';
        }

        // Actions
        let actions = '';
        actions += `<button class="btn btn--primary btn--sm" onclick="openEditChannelModal(${ch.id})"><span class="material-symbols-rounded" style="font-size:16px;">edit</span> Editar Canal</button>`;
        actions += `<button class="btn btn--info btn--sm" onclick="openMediaAssignModal(${ch.id})"><span class="material-symbols-rounded" style="font-size:16px;">add_link</span> Gestionar Medios</button>`;
        actions += `<button class="btn btn--danger btn--sm" onclick="confirmDeleteChannel(${ch.id}, '${escapeHtml(ch.name)}')"><span class="material-symbols-rounded" style="font-size:16px;">delete</span> Eliminar</button>`;
        document.getElementById('cdActions').innerHTML = actions;

        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
        showToast('Error al cargar detalle: ' + err.message, 'error');
    }
}

// ── Create Channel ──

async function openCreateChannelModal() {
    // Load channel types
    try {
        const res = await api.get('/channels/types', true);
        const types = res.data || [];
        const select = document.getElementById('channelFormType');
        select.innerHTML = '<option value="">Seleccionar tipo...</option>' +
            types.map(t => `<option value="${t.value}">${escapeHtml(t.label)}</option>`).join('');
    } catch (err) {
        showToast('Error al cargar tipos de canal', 'error');
    }

    // Clear form
    document.getElementById('channelFormTitle').textContent = 'Crear Canal';
    document.getElementById('channelFormName').value = '';
    document.getElementById('channelFormDesc').value = '';
    document.getElementById('channelFormType').value = '';
    document.getElementById('channelFormContext').value = '';
    document.getElementById('channelFormError').style.display = 'none';
    document.getElementById('btnChannelFormSubmit').textContent = 'Crear Canal';

    state.channels.editingChannelId = null;
    openModal('channelFormModal');
}

async function openEditChannelModal(channelId) {
    try {
        const res = await api.get(`/channels/${channelId}`, true);
        const ch = res.data;

        // Load types
        const typesRes = await api.get('/channels/types', true);
        const types = typesRes.data || [];
        const select = document.getElementById('channelFormType');
        select.innerHTML = '<option value="">Seleccionar tipo...</option>' +
            types.map(t => `<option value="${t.value}">${escapeHtml(t.label)}</option>`).join('');

        document.getElementById('channelFormTitle').textContent = 'Editar Canal';
        document.getElementById('channelFormName').value = ch.name || '';
        document.getElementById('channelFormDesc').value = ch.description || '';
        document.getElementById('channelFormType').value = ch.type || '';
        document.getElementById('channelFormContext').value = ch.semantic_context || '';
        document.getElementById('channelFormError').style.display = 'none';
        document.getElementById('btnChannelFormSubmit').textContent = 'Guardar Cambios';

        state.channels.editingChannelId = ch.id;
        openModal('channelFormModal');
    } catch (err) {
        showToast('Error al cargar canal: ' + err.message, 'error');
    }
}

async function submitChannelForm() {
    const name = document.getElementById('channelFormName').value.trim();
    const description = document.getElementById('channelFormDesc').value.trim();
    const type = document.getElementById('channelFormType').value;
    const semantic_context = document.getElementById('channelFormContext').value.trim();
    const errorDiv = document.getElementById('channelFormError');
    const btn = document.getElementById('btnChannelFormSubmit');

    if (!name || !type) {
        errorDiv.textContent = 'El nombre y el tipo son obligatorios.';
        errorDiv.style.display = 'block';
        return;
    }

    const body = { name, type };
    if (description) body.description = description;
    if (semantic_context) body.semantic_context = semantic_context;

    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Procesando...';

    try {
        if (state.channels.editingChannelId) {
            await api.request('PUT', `/channels/${state.channels.editingChannelId}`, { body, auth: true });
            showToast('Canal actualizado correctamente', 'success');
        } else {
            await api.request('POST', '/channels', { body, auth: true });
            showToast('Canal creado correctamente', 'success');
        }
        closeModal('channelFormModal');
        loadChannels();

        if (state.channels.selectedChannelId === state.channels.editingChannelId && state.channels.editingChannelId) {
            viewChannelDetail(state.channels.editingChannelId);
        }
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// ── Delete Channel ──

function confirmDeleteChannel(channelId, channelName) {
    showConfirm(
        'Eliminar Canal',
        `¿Estás seguro de que deseas eliminar el canal "${channelName}"? Esta acción no se puede deshacer.`,
        async () => {
            try {
                await api.del(`/channels/${channelId}`, true);
                showToast('Canal eliminado correctamente', 'success');
                closeModal('confirmModal');
                loadChannels();

                // Close detail if viewing
                if (state.channels.selectedChannelId === channelId) {
                    document.getElementById('channelDetailCard').style.display = 'none';
                    state.channels.selectedChannelId = null;
                }
            } catch (err) {
                showToast('Error al eliminar: ' + err.message, 'error');
                closeModal('confirmModal');
            }
        }
    );
}

// ── Media Assignment ──

async function openMediaAssignModal(channelId) {
    state.channels.mediaAssignChannelId = channelId;

    const loading = document.getElementById('mediaAssignLoading');
    const content = document.getElementById('mediaAssignContent');

    loading.style.display = 'flex';
    content.style.display = 'none';

    openModal('mediaAssignModal');

    try {
        // Load all medias and channel's current medias in parallel
        const [allMediasRes, channelMediasRes] = await Promise.all([
            api.get('/medias', true),
            api.get(`/channels/${channelId}/medias`, true),
        ]);

        const allMedias = allMediasRes.data || [];
        const channelMedias = channelMediasRes.data || [];
        const assignedIds = new Set(channelMedias.map(m => m.id));

        loading.style.display = 'none';
        content.style.display = 'block';

        // Group medias by type
        const grouped = {};
        allMedias.forEach(m => {
            if (!grouped[m.type]) grouped[m.type] = [];
            grouped[m.type].push(m);
        });

        const mediaTypeLabels = {
            physical_screen: 'Pantallas Físicas',
            social_media: 'Redes Sociales',
            editorial_platform: 'Plataformas Editoriales',
        };

        let html = '';
        for (const [type, medias] of Object.entries(grouped)) {
            const icon = MEDIA_TYPE_ICONS[type] || 'devices';
            const label = mediaTypeLabels[type] || type;
            html += `<div class="ch-media-group">
                <div class="ch-media-group-title">
                    <span class="material-symbols-rounded" style="font-size:18px;">${icon}</span>
                    <span>${escapeHtml(label)}</span>
                </div>
                <div class="ch-media-group-items">`;
            medias.forEach(m => {
                const checked = assignedIds.has(m.id) ? 'checked' : '';
                const activeLabel = m.is_active ? '' : ' (Inactivo)';
                html += `
                    <label class="ch-media-checkbox">
                        <input type="checkbox" value="${m.id}" ${checked} class="media-checkbox-input">
                        <span class="ch-media-checkbox-label">${escapeHtml(m.name)}${activeLabel}</span>
                    </label>`;
            });
            html += `</div></div>`;
        }

        content.innerHTML = html;
    } catch (err) {
        loading.style.display = 'none';
        showToast('Error al cargar medios: ' + err.message, 'error');
    }
}

async function submitMediaAssign() {
    const channelId = state.channels.mediaAssignChannelId;
    if (!channelId) return;

    const checkboxes = document.querySelectorAll('#mediaAssignContent .media-checkbox-input');
    const selectedIds = [];
    checkboxes.forEach(cb => {
        if (cb.checked) selectedIds.push(parseInt(cb.value));
    });

    const btn = document.getElementById('btnMediaAssignSubmit');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
        // First get current medias to compute diff
        const currentRes = await api.get(`/channels/${channelId}/medias`, true);
        const currentIds = (currentRes.data || []).map(m => m.id);

        const toAdd = selectedIds.filter(id => !currentIds.includes(id));
        const toRemove = currentIds.filter(id => !selectedIds.includes(id));

        if (toAdd.length > 0) {
            await api.post(`/channels/${channelId}/medias`, { media_ids: toAdd }, true);
        }
        if (toRemove.length > 0) {
            await api.request('DELETE', `/channels/${channelId}/medias`, {
                body: { media_ids: toRemove },
                auth: true,
            });
        }

        showToast('Medios actualizados correctamente', 'success');
        closeModal('mediaAssignModal');
        loadChannels();

        if (state.channels.selectedChannelId === channelId) {
            viewChannelDetail(channelId);
        }
    } catch (err) {
        showToast('Error al actualizar medios: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar Medios';
    }
}
