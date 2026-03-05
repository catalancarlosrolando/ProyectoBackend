/**
 * =============================================
 * Difexa Frontend - Administración de Usuarios
 * =============================================
 */

const STATUS_LABELS = {
    registered: 'Registrado',
    verified: 'Verificado',
    approved: 'Aprobado',
    disabled: 'Deshabilitado',
    deleted: 'Eliminado',
};

const ACTION_LABELS = {
    status_change: 'Cambio de estado',
    role_assigned: 'Rol asignado',
    role_revoked: 'Rol revocado',
    enabled: 'Habilitado',
    disabled: 'Deshabilitado',
};

const SORT_FIELDS = ['name', 'email', 'created_at', 'last_access_at', 'status'];

function toggleAdminSort(field) {
    if (!SORT_FIELDS.includes(field)) return;

    if (state.adminUsers.sortBy === field) {
        // Cycle: asc → desc → none
        if (state.adminUsers.sortOrder === 'asc') {
            state.adminUsers.sortOrder = 'desc';
        } else {
            state.adminUsers.sortBy = null;
            state.adminUsers.sortOrder = null;
        }
    } else {
        state.adminUsers.sortBy = field;
        state.adminUsers.sortOrder = 'asc';
    }

    updateSortIcons();
    loadAdminUsers(1);
}

function updateSortIcons() {
    SORT_FIELDS.forEach(f => {
        const icon = document.getElementById('sortIcon-' + f);
        if (!icon) return;

        const col = icon.closest('.au-col--sortable');

        if (state.adminUsers.sortBy === f) {
            icon.textContent = state.adminUsers.sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward';
            col?.classList.add('au-col--sorted');
        } else {
            icon.textContent = 'unfold_more';
            col?.classList.remove('au-col--sorted');
        }
    });
}

function getAdminFilters() {
    const filters = {};
    const name = document.getElementById('filterName')?.value.trim();
    const email = document.getElementById('filterEmail')?.value.trim();
    const dni = document.getElementById('filterDni')?.value.trim();
    const status = document.getElementById('filterStatus')?.value;
    const role = document.getElementById('filterRole')?.value;
    const perPage = document.getElementById('filterPerPage')?.value;
    const registeredFrom = document.getElementById('filterRegisteredFrom')?.value;
    const registeredTo = document.getElementById('filterRegisteredTo')?.value;
    const lastAccessFrom = document.getElementById('filterLastAccessFrom')?.value;
    const lastAccessTo = document.getElementById('filterLastAccessTo')?.value;

    if (name) filters.name = name;
    if (email) filters.email = email;
    if (dni) filters.dni = dni;
    if (status) filters.status = status;
    if (role) filters.role = role;
    if (perPage) filters.per_page = perPage;
    if (registeredFrom) filters.registered_from = registeredFrom;
    if (registeredTo) filters.registered_to = registeredTo;
    if (lastAccessFrom) filters.last_access_from = lastAccessFrom;
    if (lastAccessTo) filters.last_access_to = lastAccessTo;

    // Sort
    if (state.adminUsers.sortBy) {
        filters.sort_by = state.adminUsers.sortBy;
        filters.sort_order = state.adminUsers.sortOrder || 'asc';
    }

    return filters;
}

async function loadAdminUsers(page = 1) {
    if (!state.isAuthenticated) return;

    const loading = document.getElementById('usersLoading');
    const empty = document.getElementById('usersEmpty');
    const tableWrapper = document.getElementById('usersTableWrapper');

    loading.style.display = 'flex';
    empty.style.display = 'none';
    tableWrapper.style.display = 'none';

    const filters = getAdminFilters();
    filters.page = page;

    const params = new URLSearchParams(filters).toString();

    try {
        const res = await api.get(`/admin/users?${params}`, true);
        const users = res.data?.users || [];
        const pagination = res.data?.pagination || {};

        state.adminUsers.currentPage = pagination.current_page || 1;
        state.adminUsers.lastPage = pagination.last_page || 1;

        loading.style.display = 'none';

        if (users.length === 0) {
            empty.style.display = 'block';
            return;
        }

        tableWrapper.style.display = 'block';
        renderUsersTable(users);
        renderPagination(pagination);
    } catch (err) {
        loading.style.display = 'none';
        empty.style.display = 'block';
        empty.querySelector('p').textContent = '❌ Error: ' + err.message;
        showToast('Error al cargar usuarios: ' + err.message, 'error');
    }
}

const STATUS_ICONS = {
    registered: 'check_circle',
    verified: 'verified',
    approved: 'task_alt',
    disabled: 'block',
    deleted: 'delete',
};

const STATUS_COLORS = {
    registered: { icon: '#388E3C', text: '#388E3C', bg: '#BBDEFB' },
    verified: { icon: '#1E90FF', text: '#1E90FF', bg: '#D4E9FF' },
    approved: { icon: '#388E3C', text: '#388E3C', bg: '#E8F5E9' },
    disabled: { icon: '#fb6e4b', text: '#fb6e4b', bg: '#FFF3E0' },
    deleted: { icon: '#922926', text: '#922926', bg: '#FFEBEE' },
};

function getUserInitials(name) {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : name.substring(0, 2).toUpperCase();
}

function renderActionButtons(u, size = 16) {
    let html = `
        <button class="au-action-btn au-action-btn--view" onclick="viewUserDetail(${u.id})" title="Ver detalle">
            <span class="material-symbols-rounded" style="font-size:${size}px;">visibility</span>
        </button>
        <button class="au-action-btn au-action-btn--history" onclick="viewUserHistory(${u.id})" title="Historial">
            <span class="material-symbols-rounded" style="font-size:${size}px;">description</span>
        </button>`;
    if (u.status === 'registered') {
        html += `
        <button class="au-action-btn au-action-btn--approve" onclick="adminAction('approve', ${u.id})" title="Aprobar">
            <span class="material-symbols-rounded" style="font-size:${size}px;">check</span>
        </button>
        <button class="au-action-btn au-action-btn--reject" onclick="adminAction('reject', ${u.id})" title="Rechazar">
            <span class="material-symbols-rounded" style="font-size:${size}px;">close</span>
        </button>`;
    } else if (u.status === 'approved') {
        html += `
        <button class="au-action-btn au-action-btn--reject" onclick="adminAction('disable', ${u.id})" title="Deshabilitar">
            <span class="material-symbols-rounded" style="font-size:${size}px;">block</span>
        </button>`;
    } else if (u.status === 'disabled') {
        html += `
        <button class="au-action-btn au-action-btn--approve" onclick="adminAction('enable', ${u.id})" title="Habilitar">
            <span class="material-symbols-rounded" style="font-size:${size}px;">check</span>
        </button>`;
    }
    return html;
}

function renderStatusBadge(status) {
    const colors = STATUS_COLORS[status] || { icon: '#49454F', text: '#49454F', bg: '#EEEEEE' };
    const icon = STATUS_ICONS[status] || 'help';
    const label = STATUS_LABELS[status] || status;
    return `<span class="au-status-badge" style="background:${colors.bg};color:${colors.text};">
        <span class="material-symbols-rounded" style="font-size:16px;color:${colors.icon};">${icon}</span>
        ${escapeHtml(label.toUpperCase())}
    </span>`;
}

function renderRoleBadge(roles) {
    if (!roles || !roles.length) return '<span class="au-role-badge au-role-badge--muted">—</span>';
    return roles.map(r => `<span class="au-role-badge">${escapeHtml(r)}</span>`).join('');
}

function renderUsersTable(users) {
    // Desktop table rows
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = users.map(u => `
        <div class="au-row">
            <span class="au-cell au-cell--id">${u.id}</span>
            <div class="au-cell au-cell--name">
                <span class="au-name-text">${escapeHtml(u.name || '-')}</span>
                ${u.dni ? `<span class="au-name-sub">${escapeHtml(u.dni)}</span>` : ''}
            </div>
            <span class="au-cell au-cell--email">${escapeHtml(u.email)}</span>
            <div class="au-cell au-cell--status">${renderStatusBadge(u.status)}</div>
            <div class="au-cell au-cell--role">${renderRoleBadge(u.roles)}</div>
            <span class="au-cell au-cell--date">${formatDate(u.created_at)}</span>
            <span class="au-cell au-cell--date">${u.last_access_at ? formatDate(u.last_access_at) : 'Nunca'}</span>
            <div class="au-cell au-cell--actions">${renderActionButtons(u)}</div>
        </div>
    `).join('');

    // Mobile cards
    const mobileContainer = document.getElementById('usersMobileCards');
    mobileContainer.innerHTML = users.map(u => {
        const initials = getUserInitials(u.name);
        return `
        <div class="au-user-card">
            <div class="au-user-card__top">
                <div class="au-user-card__left">
                    <div class="au-user-card__avatar">${initials}</div>
                    <div class="au-user-card__name-col">
                        <span class="au-user-card__name">${escapeHtml(u.name || '-')}</span>
                        <span class="au-user-card__id">ID: ${u.id}</span>
                    </div>
                </div>
                ${renderStatusBadge(u.status)}
            </div>
            <div class="au-user-card__divider"></div>
            <div class="au-user-card__info">
                <div class="au-user-card__info-row">
                    <span class="material-symbols-rounded au-user-card__info-icon">mail</span>
                    <span>${escapeHtml(u.email)}</span>
                </div>
                <div class="au-user-card__info-row">
                    <span class="material-symbols-rounded au-user-card__info-icon">calendar_today</span>
                    <span>${formatDate(u.created_at)}</span>
                </div>
                <div class="au-user-card__info-row">
                    <span class="material-symbols-rounded au-user-card__info-icon">schedule</span>
                    <span>Últ. acceso: ${u.last_access_at ? formatDate(u.last_access_at) : 'Nunca'}</span>
                </div>
                <div class="au-user-card__info-row au-user-card__info-row--between">
                    <div class="au-user-card__rol-label">
                        <span class="material-symbols-rounded au-user-card__info-icon">shield_person</span>
                        <span>Rol:</span>
                    </div>
                    ${renderRoleBadge(u.roles)}
                </div>
            </div>
            <div class="au-user-card__actions">${renderActionButtons(u, 18)}</div>
        </div>`;
    }).join('');
}

function renderPagination(pagination) {
    const container = document.getElementById('usersPagination');
    if (!pagination || pagination.last_page <= 1) {
        container.innerHTML = `<span class="pagination-info">${pagination.total || 0} usuario(s)</span>`;
        return;
    }

    let html = '';

    // Prev
    if (pagination.current_page > 1) {
        html += `<button class="btn btn--sm btn--outline" onclick="loadAdminUsers(${pagination.current_page - 1})">←</button>`;
    }

    // Pages
    for (let i = 1; i <= pagination.last_page; i++) {
        if (
            i === 1 || i === pagination.last_page ||
            (i >= pagination.current_page - 2 && i <= pagination.current_page + 2)
        ) {
            html += `<button class="btn btn--sm ${i === pagination.current_page ? 'active' : 'btn--outline'}"
                        onclick="loadAdminUsers(${i})">${i}</button>`;
        } else if (i === pagination.current_page - 3 || i === pagination.current_page + 3) {
            html += `<span style="padding:0 0.25rem;">…</span>`;
        }
    }

    // Next
    if (pagination.current_page < pagination.last_page) {
        html += `<button class="btn btn--sm btn--outline" onclick="loadAdminUsers(${pagination.current_page + 1})">→</button>`;
    }

    html += `<span class="pagination-info">${pagination.from}-${pagination.to} de ${pagination.total}</span>`;
    container.innerHTML = html;
}

async function viewUserDetail(userId) {
    const card = document.getElementById('userDetailCard');
    card.style.display = '';

    try {
        const res = await api.get(`/admin/users/${userId}`, true);
        const u = res.data?.user;
        if (!u) throw new Error('Usuario no encontrado');

        state.adminUsers.selectedUserId = u.id;

        document.getElementById('userDetailTitle').textContent = `Detalle: ${u.name}`;
        document.getElementById('userDetailAvatar').textContent = getUserInitials(u.name);
        document.getElementById('udId').textContent = u.id;
        document.getElementById('udName').textContent = u.name || '-';
        document.getElementById('udEmail').textContent = u.email;
        document.getElementById('udDni').textContent = u.dni || '-';
        document.getElementById('udMobile').textContent = u.mobile || '-';
        document.getElementById('udStatus').innerHTML = renderStatusBadge(u.status);
        document.getElementById('udVerified').textContent = u.email_verified_at ? '✅ ' + formatDate(u.email_verified_at) : '❌ No';
        document.getElementById('udLastAccess').textContent = u.last_access_at ? formatDate(u.last_access_at) : 'Nunca';
        document.getElementById('udCreatedAt').textContent = formatDate(u.created_at);
        document.getElementById('udRejection').textContent = u.rejection_reason || '-';

        document.getElementById('udRoles').innerHTML = (u.roles?.length)
            ? u.roles.map(r => `<span class="au-role-badge">${r}</span>`).join('')
            : '<span class="au-role-badge au-role-badge--muted">Sin roles</span>';

        document.getElementById('udPermissions').innerHTML = (u.permissions?.length)
            ? u.permissions.map(p => `<span class="tag tag--info">${p}</span>`).join('')
            : '<span class="tag tag--muted">Sin permisos</span>';

        // Build action buttons
        let actions = '';
        if (u.status === 'registered') {
            actions += `<button class="btn btn--success btn--sm" onclick="adminAction('approve', ${u.id})"><span class="material-symbols-rounded" style="font-size:16px;">check</span> Aprobar</button>`;
            actions += `<button class="btn btn--danger btn--sm" onclick="adminAction('reject', ${u.id})"><span class="material-symbols-rounded" style="font-size:16px;">close</span> Rechazar</button>`;
        }
        if (u.status === 'approved') {
            actions += `<button class="btn btn--warning btn--sm" onclick="adminAction('disable', ${u.id})"><span class="material-symbols-rounded" style="font-size:16px;">block</span> Deshabilitar</button>`;
        }
        if (u.status === 'disabled') {
            actions += `<button class="btn btn--success btn--sm" onclick="adminAction('enable', ${u.id})"><span class="material-symbols-rounded" style="font-size:16px;">check</span> Habilitar</button>`;
        }
        actions += `<button class="btn btn--info btn--sm" onclick="openRoleModal('assign', ${u.id})"><span class="material-symbols-rounded" style="font-size:16px;">shield_person</span> Asignar Rol</button>`;
        actions += `<button class="btn btn--outline btn--sm" onclick="openRoleModal('revoke', ${u.id})"><span class="material-symbols-rounded" style="font-size:16px;">shield</span> Revocar Rol</button>`;
        actions += `<button class="btn btn--outline btn--sm" onclick="viewUserHistory(${u.id})"><span class="material-symbols-rounded" style="font-size:16px;">history</span> Ver Historial</button>`;

        document.getElementById('udActions').innerHTML = actions;

        // Scroll to card
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
        showToast('Error al cargar detalle: ' + err.message, 'error');
    }
}

function adminAction(action, userId) {
    state.adminUsers.statusChangeAction = action;
    state.adminUsers.statusChangeUserId = userId;

    const titles = {
        approve: 'Aprobar Usuario',
        reject: 'Rechazar Registro',
        enable: 'Habilitar Cuenta',
        disable: 'Deshabilitar Cuenta',
    };
    const descs = {
        approve: '¿Aprobar este registro? El usuario recibirá una notificación por email.',
        reject: '¿Rechazar este registro? El usuario será notificado. Puedes indicar un motivo.',
        enable: '¿Habilitar esta cuenta? El usuario podrá volver a iniciar sesión.',
        disable: '¿Deshabilitar esta cuenta? Se invalidarán todas sus sesiones activas.',
    };

    document.getElementById('statusChangeTitle').textContent = titles[action] || 'Cambiar Estado';
    document.getElementById('statusChangeDesc').textContent = descs[action] || '¿Estás seguro?';
    document.getElementById('statusChangeReason').value = '';
    openModal('statusChangeModal');
}

async function confirmStatusChange() {
    const action = state.adminUsers.statusChangeAction;
    const userId = state.adminUsers.statusChangeUserId;
    const reason = document.getElementById('statusChangeReason').value.trim();
    const btn = document.getElementById('btnStatusChangeConfirm');

    if (!action || !userId) return;

    btn.disabled = true;
    btn.textContent = 'Procesando...';

    try {
        const body = reason ? { reason } : {};
        const res = await api.post(`/admin/users/${userId}/${action}`, body, true);
        closeModal('statusChangeModal');
        showToast(res.message || 'Operación exitosa', 'success');

        // Refresh data
        loadAdminUsers(state.adminUsers.currentPage);
        if (state.adminUsers.selectedUserId === userId) {
            viewUserDetail(userId);
        }
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Confirmar';
    }
}

function openRoleModal(action, userId) {
    state.adminUsers.roleAction = action;
    state.adminUsers.roleUserId = userId;

    const isAssign = action === 'assign';
    document.getElementById('roleModalTitle').textContent = isAssign ? 'Asignar Rol' : 'Revocar Rol';
    document.getElementById('roleModalDesc').textContent = isAssign
        ? 'Selecciona el rol que deseas asignar al usuario.'
        : 'Selecciona el rol que deseas revocar del usuario.';
    document.getElementById('roleSelect').value = '';
    openModal('roleModal');
}

async function confirmRoleChange() {
    const action = state.adminUsers.roleAction;
    const userId = state.adminUsers.roleUserId;
    const role = document.getElementById('roleSelect').value;
    const btn = document.getElementById('btnRoleConfirm');

    if (!role) {
        showToast('Selecciona un rol', 'warning');
        return;
    }

    const endpoint = action === 'assign' ? 'assign-role' : 'revoke-role';
    btn.disabled = true;
    btn.textContent = 'Procesando...';

    try {
        const res = await api.post(`/admin/users/${userId}/${endpoint}`, { role }, true);
        closeModal('roleModal');
        showToast(res.message || 'Operación exitosa', 'success');

        loadAdminUsers(state.adminUsers.currentPage);
        if (state.adminUsers.selectedUserId === userId) {
            viewUserDetail(userId);
        }
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Confirmar';
    }
}

async function viewUserHistory(userId) {
    const card = document.getElementById('userHistoryCard');
    const loading = document.getElementById('historyLoading');
    const empty = document.getElementById('historyEmpty');
    const tableWrapper = document.getElementById('historyTableWrapper');

    card.style.display = '';
    loading.style.display = 'flex';
    empty.style.display = 'none';
    tableWrapper.style.display = 'none';

    try {
        const res = await api.get(`/admin/users/${userId}/history`, true);
        const history = res.data?.history || [];

        document.getElementById('userHistoryTitle').textContent =
            `Historial: ${res.data?.user_name || 'Usuario #' + userId}`;

        loading.style.display = 'none';

        if (history.length === 0) {
            empty.style.display = 'block';
            card.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }

        tableWrapper.style.display = 'block';
        const tbody = document.getElementById('historyTableBody');
        tbody.innerHTML = history.map(h => `
            <tr>
                <td><span class="tag tag--info">${ACTION_LABELS[h.action] || h.action}</span></td>
                <td>${h.old_value ? `<span class="status-badge status-badge--${h.old_value}">${STATUS_LABELS[h.old_value] || h.old_value}</span>` : '—'}</td>
                <td>${h.new_value ? `<span class="status-badge status-badge--${h.new_value}">${STATUS_LABELS[h.new_value] || h.new_value}</span>` : '—'}</td>
                <td><small>${h.reason ? escapeHtml(h.reason) : '—'}</small></td>
                <td><small>${h.changed_by?.name || '—'}</small></td>
                <td><small>${formatDate(h.created_at)}</small></td>
            </tr>
        `).join('');

        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
        loading.style.display = 'none';
        showToast('Error al cargar historial: ' + err.message, 'error');
    }
}

function clearAdminFilters() {
    document.getElementById('filterName').value = '';
    document.getElementById('filterEmail').value = '';
    document.getElementById('filterDni').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterRole').value = '';
    document.getElementById('filterPerPage').value = '20';
    document.getElementById('filterRegisteredFrom').value = '';
    document.getElementById('filterRegisteredTo').value = '';
    document.getElementById('filterLastAccessFrom').value = '';
    document.getElementById('filterLastAccessTo').value = '';
    // Reset sort
    state.adminUsers.sortBy = null;
    state.adminUsers.sortOrder = null;
    updateSortIcons();
    loadAdminUsers(1);
}
