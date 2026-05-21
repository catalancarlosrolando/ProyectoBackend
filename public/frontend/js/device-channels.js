/**
 * =============================================
 * Difexa Frontend - Asignacion Canales ↔ Dispositivos
 * =============================================
 */

async function loadDeviceChannels(page = 1) {
    if (!state.isAuthenticated) return;

    const loading = document.getElementById('dcLoading');
    const empty = document.getElementById('dcEmpty');
    const tableWrapper = document.getElementById('dcTableWrapper');

    loading.style.display = 'flex';
    empty.style.display = 'none';
    tableWrapper.style.display = 'none';

    try {
        const res = await api.get(`/admin/device-channels?page=${page}`, true);
        const paginated = res.data || {};
        const devices = paginated.data || [];

        state.deviceChannels.currentPage = paginated.current_page || 1;
        state.deviceChannels.lastPage = paginated.last_page || 1;

        loading.style.display = 'none';

        if (devices.length === 0) {
            empty.style.display = 'block';
            document.getElementById('dcPagination').innerHTML = '';
            return;
        }

        tableWrapper.style.display = 'block';
        renderDeviceChannelsTable(devices);
        renderDcPagination(paginated);
    } catch (err) {
        loading.style.display = 'none';
        empty.style.display = 'block';
        showToast('Error al cargar dispositivos: ' + err.message, 'error');
    }
}

function openCreateDeviceModal() {
    const error = document.getElementById('deviceCreateError');
    const isActive = document.getElementById('deviceCreateIsActive');

    if (error) {
        error.textContent = '';
        error.style.display = 'none';
    }
    if (isActive) isActive.checked = true;

    openModal('deviceCreateModal');
}

async function submitCreateDevice() {
    const btn = document.getElementById('btnDeviceCreateConfirm');
    const error = document.getElementById('deviceCreateError');
    const isActive = document.getElementById('deviceCreateIsActive');

    if (error) {
        error.textContent = '';
        error.style.display = 'none';
    }

    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Creando...';
    }

    try {
        const res = await api.post('/admin/devices', {
            is_active: isActive?.checked ?? true,
        }, true);
        showToast(res.message || 'Dispositivo creado correctamente.', 'success');
        closeModal('deviceCreateModal');
        loadDeviceChannels(1);
    } catch (err) {
        if (error) {
            error.textContent = err.message;
            error.style.display = 'block';
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Crear';
        }
    }
}

function renderDeviceChannelsTable(devices) {
    const tbody = document.getElementById('dcTableBody');
    tbody.innerHTML = devices.map(device => {
        const channelTags = renderDeviceChannelTags(device.channels || []);
        const count = (device.channels || []).length;
        return `
        <div class="au-row">
            <span class="au-cell au-cell--id">${device.id}</span>
            <div class="au-cell dc-cell--device">
                <span class="au-name-text">${escapeHtml(device.uid || '-')}
                    ${device.is_active ? '' : '<span class="tag tag--muted" style="margin-left:0.5rem;">Inactivo</span>'}
                </span>
                <span class="au-email-text">UID de dispositivo</span>
            </div>
            <div class="au-cell dc-cell--channels">
                ${channelTags}
            </div>
            <div class="au-cell dc-cell--count">
                <span class="uc-count-badge">${count}</span>
            </div>
            <div class="au-cell au-cell--actions">
                <div class="au-actions-dropdown">
                    <button class="au-actions-trigger" onclick="toggleActionsMenu(event, this)" title="Acciones">
                        <span class="material-symbols-rounded" style="font-size:20px">more_vert</span>
                    </button>
                    <div class="au-actions-menu">
                        <button class="au-actions-menu__item au-actions-menu__item--success" onclick="openAssignDeviceChannelsModal(${device.id})">
                            <span class="material-symbols-rounded">add_link</span> Asignar canales
                        </button>
                        <button class="au-actions-menu__item au-actions-menu__item--danger" onclick="openRevokeDeviceChannelsModal(${device.id})">
                            <span class="material-symbols-rounded">link_off</span> Revocar canales
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');

    const mobile = document.getElementById('dcMobileCards');
    mobile.innerHTML = devices.map(device => {
        const channelTags = renderDeviceChannelTags(device.channels || []);
        const count = (device.channels || []).length;
        return `
        <div class="au-user-card">
            <div class="au-user-card__top">
                <div class="au-user-card__left">
                    <div class="au-user-card__avatar" style="background:#E3F2FD;color:#1565C0;">
                        <span class="material-symbols-rounded" style="font-size:18px;">tv</span>
                    </div>
                    <div class="au-user-card__name-col">
                        <span class="au-user-card__name">${escapeHtml(device.uid || '-')}</span>
                        <span class="au-user-card__id">UID de dispositivo</span>
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
                        <button class="au-actions-menu__item au-actions-menu__item--success" onclick="openAssignDeviceChannelsModal(${device.id})">
                            <span class="material-symbols-rounded">add_link</span> Asignar canales
                        </button>
                        <button class="au-actions-menu__item au-actions-menu__item--danger" onclick="openRevokeDeviceChannelsModal(${device.id})">
                            <span class="material-symbols-rounded">link_off</span> Revocar canales
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}

function renderDcPagination(pagination) {
    const container = document.getElementById('dcPagination');
    if (!pagination || pagination.last_page <= 1) {
        container.innerHTML = `<span class="pagination-info">${pagination.total || 0} dispositivo(s)</span>`;
        return;
    }

    let html = '';

    if (pagination.current_page > 1) {
        html += `<button class="btn btn--sm btn--outline" onclick="loadDeviceChannels(${pagination.current_page - 1})">←</button>`;
    }

    for (let i = 1; i <= pagination.last_page; i++) {
        if (
            i === 1 || i === pagination.last_page ||
            (i >= pagination.current_page - 2 && i <= pagination.current_page + 2)
        ) {
            html += `<button class="btn btn--sm ${i === pagination.current_page ? 'active' : 'btn--outline'}"
                        onclick="loadDeviceChannels(${i})">${i}</button>`;
        } else if (i === pagination.current_page - 3 || i === pagination.current_page + 3) {
            html += `<span style="padding:0 0.25rem;">…</span>`;
        }
    }

    if (pagination.current_page < pagination.last_page) {
        html += `<button class="btn btn--sm btn--outline" onclick="loadDeviceChannels(${pagination.current_page + 1})">→</button>`;
    }

    html += `<span class="pagination-info">${pagination.from}-${pagination.to} de ${pagination.total}</span>`;
    container.innerHTML = html;
}

function renderDeviceChannelTags(channels) {
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

async function openAssignDeviceChannelsModal(deviceId) {
    state.deviceChannels.assignDeviceId = deviceId;

    const loading = document.getElementById('dcAssignLoading');
    const content = document.getElementById('dcAssignContent');

    loading.style.display = 'flex';
    content.style.display = 'none';

    openModal('dcAssignModal');

    try {
        const [channelsRes, deviceRes] = await Promise.all([
            api.get('/admin/channels', true),
            api.get(`/admin/device-channels/${deviceId}`, true),
        ]);

        const allChannels = channelsRes.data || [];
        const deviceChannels = deviceRes.data.channels || [];
        const assignedIds = new Set(deviceChannels.map(ch => ch.id));
        const deviceUid = deviceRes.data.device.uid || 'Dispositivo';

        document.getElementById('dcAssignTitle').textContent = `Asignar Canales a: ${deviceUid}`;

        loading.style.display = 'none';
        content.style.display = 'block';

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
                        <input type="checkbox" value="${ch.id}" ${checked} class="dc-channel-checkbox-input"
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

async function submitAssignDeviceChannels() {
    const deviceId = state.deviceChannels.assignDeviceId;
    if (!deviceId) return;

    const inputs = Array.from(document.querySelectorAll('.dc-channel-checkbox-input'));
    const selected = inputs.filter(i => i.checked).map(i => parseInt(i.value, 10)).filter(Boolean);

    if (selected.length === 0) {
        showToast('Selecciona al menos un canal.', 'warning');
        return;
    }

    try {
        await api.post(`/admin/device-channels/${deviceId}`, { channel_ids: selected }, true);
        showToast('Canales asignados correctamente.', 'success');
        closeModal('dcAssignModal');
        loadDeviceChannels(state.deviceChannels.currentPage);
    } catch (err) {
        showToast('Error al asignar canales: ' + err.message, 'error');
    }
}

async function openRevokeDeviceChannelsModal(deviceId) {
    state.deviceChannels.assignDeviceId = deviceId;

    const loading = document.getElementById('dcRevokeLoading');
    const empty = document.getElementById('dcRevokeEmpty');
    const content = document.getElementById('dcRevokeContent');
    const actions = document.getElementById('dcRevokeActions');

    loading.style.display = 'flex';
    empty.style.display = 'none';
    content.style.display = 'none';
    actions.style.display = 'none';

    openModal('dcRevokeModal');

    try {
        const res = await api.get(`/admin/device-channels/${deviceId}`, true);
        const device = res.data.device || {};
        const channels = res.data.channels || [];
        const deviceUid = device.uid || 'Dispositivo';

        document.getElementById('dcRevokeTitle').textContent = `Revocar Canales de: ${deviceUid}`;

        loading.style.display = 'none';

        if (channels.length === 0) {
            empty.style.display = 'block';
            return;
        }

        actions.style.display = 'flex';
        content.style.display = 'block';

        content.innerHTML = channels.map(ch => {
            const c = CHANNEL_TYPE_COLORS[ch.type] || { bg: '#EEEEEE', text: '#49454F', icon: 'label' };
            return `
                <label class="ch-media-checkbox">
                    <input type="checkbox" value="${ch.id}" class="dc-channel-revoke-input">
                    <span class="ch-media-checkbox-label" style="display:flex;align-items:center;gap:0.5rem;">
                        <span class="material-symbols-rounded" style="font-size:18px;color:${c.text};">${c.icon}</span>
                        ${escapeHtml(ch.name)}
                    </span>
                </label>`;
        }).join('');
    } catch (err) {
        loading.style.display = 'none';
        showToast('Error al cargar canales: ' + err.message, 'error');
    }
}

async function submitRevokeDeviceChannels() {
    const deviceId = state.deviceChannels.assignDeviceId;
    if (!deviceId) return;

    const inputs = Array.from(document.querySelectorAll('.dc-channel-revoke-input'));
    const selected = inputs.filter(i => i.checked).map(i => parseInt(i.value, 10)).filter(Boolean);

    if (selected.length === 0) {
        showToast('Selecciona al menos un canal para revocar.', 'warning');
        return;
    }

    try {
        await api.del(`/admin/device-channels/${deviceId}`, true, { channel_ids: selected });
        showToast('Canales revocados correctamente.', 'success');
        closeModal('dcRevokeModal');
        loadDeviceChannels(state.deviceChannels.currentPage);
    } catch (err) {
        showToast('Error al revocar canales: ' + err.message, 'error');
    }
}
