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

function renderUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = users.map(u => `
        <tr>
            <td><strong>${u.id}</strong></td>
            <td>
                <div style="font-weight:500;">${escapeHtml(u.name || '-')}</div>
                ${u.dni ? `<small class="text-muted">${escapeHtml(u.dni)}</small>` : ''}
            </td>
            <td><span style="font-size:0.85rem;">${escapeHtml(u.email)}</span></td>
            <td><span class="status-badge status-badge--${u.status}">${STATUS_LABELS[u.status] || u.status}</span></td>
            <td>
                <div class="tags">
                    ${(u.roles && u.roles.length)
            ? u.roles.map(r => `<span class="tag tag--primary">${r}</span>`).join('')
            : '<span class="tag tag--muted">—</span>'}
                </div>
            </td>
            <td><small>${formatDate(u.created_at)}</small></td>
            <td>
                <div class="btn-group btn-group--actions">
                    <button class="btn btn--sm btn--outline" onclick="viewUserDetail(${u.id})" title="Ver detalle">👁</button>
                    <button class="btn btn--sm btn--outline" onclick="viewUserHistory(${u.id})" title="Historial">📜</button>
                    ${u.status === 'registered' ? `
                        <button class="btn btn--sm btn--success" onclick="adminAction('approve', ${u.id})" title="Aprobar">✓</button>
                        <button class="btn btn--sm btn--danger" onclick="adminAction('reject', ${u.id})" title="Rechazar">✗</button>
                    ` : ''}
                    ${u.status === 'approved' ? `
                        <button class="btn btn--sm btn--warning" onclick="adminAction('disable', ${u.id})" title="Deshabilitar">⏸</button>
                    ` : ''}
                    ${u.status === 'disabled' ? `
                        <button class="btn btn--sm btn--success" onclick="adminAction('enable', ${u.id})" title="Habilitar">▶</button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
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
        document.getElementById('userDetailAvatar').textContent = (u.name || '?')[0].toUpperCase();
        document.getElementById('udId').textContent = u.id;
        document.getElementById('udName').textContent = u.name || '-';
        document.getElementById('udEmail').textContent = u.email;
        document.getElementById('udDni').textContent = u.dni || '-';
        document.getElementById('udMobile').textContent = u.mobile || '-';
        document.getElementById('udStatus').innerHTML = `<span class="status-badge status-badge--${u.status}">${u.status_label || u.status}</span>`;
        document.getElementById('udVerified').textContent = u.email_verified_at ? '✅ ' + formatDate(u.email_verified_at) : '❌ No';
        document.getElementById('udLastAccess').textContent = u.last_access_at ? formatDate(u.last_access_at) : 'Nunca';
        document.getElementById('udCreatedAt').textContent = formatDate(u.created_at);
        document.getElementById('udRejection').textContent = u.rejection_reason || '-';

        document.getElementById('udRoles').innerHTML = (u.roles?.length)
            ? u.roles.map(r => `<span class="tag tag--primary">${r}</span>`).join('')
            : '<span class="tag tag--muted">Sin roles</span>';

        document.getElementById('udPermissions').innerHTML = (u.permissions?.length)
            ? u.permissions.map(p => `<span class="tag tag--info">${p}</span>`).join('')
            : '<span class="tag tag--muted">Sin permisos</span>';

        // Build action buttons
        let actions = '';
        if (u.status === 'registered') {
            actions += `<button class="btn btn--success btn--sm" onclick="adminAction('approve', ${u.id})">✓ Aprobar</button>`;
            actions += `<button class="btn btn--danger btn--sm" onclick="adminAction('reject', ${u.id})">✗ Rechazar</button>`;
        }
        if (u.status === 'approved') {
            actions += `<button class="btn btn--warning btn--sm" onclick="adminAction('disable', ${u.id})">⏸ Deshabilitar</button>`;
        }
        if (u.status === 'disabled') {
            actions += `<button class="btn btn--success btn--sm" onclick="adminAction('enable', ${u.id})">▶ Habilitar</button>`;
        }
        actions += `<button class="btn btn--info btn--sm" onclick="openRoleModal('assign', ${u.id})">🏷 Asignar Rol</button>`;
        actions += `<button class="btn btn--outline btn--sm" onclick="openRoleModal('revoke', ${u.id})">🏷 Revocar Rol</button>`;
        actions += `<button class="btn btn--outline btn--sm" onclick="viewUserHistory(${u.id})">📜 Ver Historial</button>`;

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
            `📜 Historial: ${res.data?.user_name || 'Usuario #' + userId}`;

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
    loadAdminUsers(1);
}
