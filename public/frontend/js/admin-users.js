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
    let items = '';

    if (u.status === 'registered') {
        items += `<button class="au-actions-menu__item au-actions-menu__item--success" onclick="adminAction('approve', ${u.id})">
            <span class="material-symbols-rounded">check_circle</span> Aprobar
        </button>`;
        items += `<button class="au-actions-menu__item au-actions-menu__item--danger" onclick="adminAction('reject', ${u.id})">
            <span class="material-symbols-rounded">cancel</span> Rechazar
        </button>`;
        items += `<div class="au-actions-menu__sep"></div>`;
    } else if (u.status === 'approved') {
        items += `<button class="au-actions-menu__item au-actions-menu__item--warning" onclick="adminAction('disable', ${u.id})">
            <span class="material-symbols-rounded">block</span> Deshabilitar
        </button>`;
        items += `<div class="au-actions-menu__sep"></div>`;
    } else if (u.status === 'disabled') {
        items += `<button class="au-actions-menu__item au-actions-menu__item--success" onclick="adminAction('enable', ${u.id})">
            <span class="material-symbols-rounded">check_circle</span> Habilitar
        </button>`;
        items += `<div class="au-actions-menu__sep"></div>`;
    }

    items += `<button class="au-actions-menu__item au-actions-menu__item--info" onclick="openRoleModal('assign', ${u.id})">
        <span class="material-symbols-rounded">shield_person</span> Asignar Rol
    </button>`;
    items += `<button class="au-actions-menu__item" onclick="openRoleModal('revoke', ${u.id})">
        <span class="material-symbols-rounded">shield</span> Revocar Rol
    </button>`;
    items += `<div class="au-actions-menu__sep"></div>`;
    items += `<button class="au-actions-menu__item" onclick="viewUserHistory(${u.id})">
        <span class="material-symbols-rounded">history</span> Historial
    </button>`;

    return `<div class="au-actions-dropdown">
        <button class="au-actions-trigger" onclick="toggleActionsMenu(event, this)" title="Acciones">
            <span class="material-symbols-rounded" style="font-size:${size + 4}px;">more_vert</span>
        </button>
        <div class="au-actions-menu">${items}</div>
    </div>`;
}

function toggleActionsMenu(event, btn) {
    event.stopPropagation();
    const menu = btn.nextElementSibling;
    const wasActive = menu.classList.contains('active');

    // Close all other open menus
    closeAllActionMenus();

    if (!wasActive) {
        menu.classList.add('active');
    }
}

function closeAllActionMenus() {
    document.querySelectorAll('.au-actions-menu.active').forEach(m => m.classList.remove('active'));
}

// Close dropdown menus on outside click
document.addEventListener('click', () => closeAllActionMenus());

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
        <div class="au-row" data-user-id="${u.id}">
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
        <div class="au-user-card" data-user-id="${u.id}">
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

function adminAction(action, userId) {
    closeAllActionMenus();
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
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Confirmar';
    }
}

function openRoleModal(action, userId) {
    closeAllActionMenus();
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

    //if (!role) {
    //    showToast('Selecciona un rol', 'warning');
    //    return;
    //}

    const endpoint = action === 'assign' ? 'assign-role' : 'revoke-role';
    btn.disabled = true;
    btn.textContent = 'Procesando...';

    try {
        const res = await api.post(`/admin/users/${userId}/${endpoint}`, { role }, true);
        closeModal('roleModal');
        showToast(res.message || 'Operación exitosa', 'success');

        loadAdminUsers(state.adminUsers.currentPage);
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Confirmar';
    }
}

const HISTORY_ACTION_STYLES = {
    role_revoked: { icon: 'person_remove', label: 'Rol revocado', color: 'error' },
    role_assigned: { icon: 'person_add', label: 'Rol asignado', color: 'success' },
    status_change: { icon: 'swap_horiz', label: 'Cambio de estado', color: 'info' },
    enabled: { icon: 'check_circle', label: 'Habilitado', color: 'success' },
    disabled: { icon: 'block', label: 'Deshabilitado', color: 'warning' },
};

function renderHistoryValueBadge(value) {
    if (!value) return '<span class="hm-value-dash">—</span>';
    const statusLabel = STATUS_LABELS[value];
    if (statusLabel) {
        const colors = STATUS_COLORS[value];
        return `<span class="hm-value-badge" style="background:${colors?.bg || 'var(--surface-variant)'};color:${colors?.text || 'var(--on-surface)'}">${escapeHtml(statusLabel.toUpperCase())}</span>`;
    }
    return `<span class="hm-value-badge hm-value-badge--role">${escapeHtml(value.toUpperCase())}</span>`;
}

function renderHistoryCard(h) {
    const style = HISTORY_ACTION_STYLES[h.action] || { icon: 'info', label: h.action, color: 'info' };
    const colorVar = `var(--${style.color})`;
    const containerVar = `var(--${style.color}-container)`;

    let reasonHtml = '';
    if (h.reason) {
        reasonHtml = `
            <div class="hm-card__motivo">
                <span class="hm-card__motivo-label">Motivo</span>
                <div class="hm-card__motivo-box">${escapeHtml(h.reason)}</div>
            </div>`;
    }

    return `
    <div class="hm-card">
        <div class="hm-card__accent" style="background:${colorVar}"></div>
        <div class="hm-card__body">
            <div class="hm-card__top-row">
                <span class="hm-card__action-badge" style="background:${containerVar};color:${colorVar}">
                    <span class="material-symbols-rounded" style="font-size:14px">${style.icon}</span>
                    ${escapeHtml(style.label)}
                </span>
                <span class="hm-card__date">${formatDate(h.created_at)}</span>
            </div>
            <div class="hm-card__details">
                <div class="hm-card__col">
                    <span class="hm-card__col-label">Anterior</span>
                    ${renderHistoryValueBadge(h.old_value)}
                </div>
                <div class="hm-card__col">
                    <span class="hm-card__col-label">Nuevo</span>
                    ${renderHistoryValueBadge(h.new_value)}
                </div>
            </div>
            ${reasonHtml}
            <div class="hm-card__footer">
                <span class="material-symbols-rounded" style="font-size:16px">admin_panel_settings</span>
                <span>${escapeHtml(h.changed_by?.name || '—')}</span>
            </div>
        </div>
    </div>`;
}

async function viewUserHistory(userId) {
    closeAllActionMenus();
    highlightUserRow(userId);

    const loading = document.getElementById('historyLoading');
    const empty = document.getElementById('historyEmpty');
    const cardsList = document.getElementById('historyCardsList');

    loading.style.display = 'flex';
    empty.style.display = 'none';
    cardsList.style.display = 'none';

    openModal('historyModal');

    try {
        const res = await api.get(`/admin/users/${userId}/history`, true);
        const history = res.data?.history || [];
        const userName = res.data?.user_name || 'Usuario #' + userId;

        document.getElementById('historyModalTitle').textContent = 'Historial de actividad';
        document.getElementById('historyModalSubtitle').textContent = userName;

        loading.style.display = 'none';

        if (history.length === 0) {
            empty.style.display = 'block';
            return;
        }

        cardsList.style.display = 'flex';
        cardsList.innerHTML = history.map(renderHistoryCard).join('');
    } catch (err) {
        loading.style.display = 'none';
        showToast('Error al cargar historial: ' + err.message, 'error');
    }
}

function highlightUserRow(userId) {
    // Remove previous highlights
    document.querySelectorAll('.au-row--highlighted').forEach(el => el.classList.remove('au-row--highlighted'));
    document.querySelectorAll('.au-user-card--highlighted').forEach(el => el.classList.remove('au-user-card--highlighted'));

    // Highlight current
    const row = document.querySelector(`.au-row[data-user-id="${userId}"]`);
    if (row) row.classList.add('au-row--highlighted');

    const card = document.querySelector(`.au-user-card[data-user-id="${userId}"]`);
    if (card) card.classList.add('au-user-card--highlighted');

    state.adminUsers.selectedUserId = userId;
}

function clearUserRowHighlight() {
    document.querySelectorAll('.au-row--highlighted').forEach(el => el.classList.remove('au-row--highlighted'));
    document.querySelectorAll('.au-user-card--highlighted').forEach(el => el.classList.remove('au-user-card--highlighted'));
    state.adminUsers.selectedUserId = null;
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
