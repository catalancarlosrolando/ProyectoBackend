/**
 * =============================================
 * Difexa Frontend - Notificaciones
 * =============================================
 * Funciones para el centro de notificaciones:
 *   - loadNotifications()        → Carga las últimas 50
 *   - loadUnreadCount()          → Actualiza badge de campana
 *   - renderNotifications()      → Dibuja la lista
 *   - markNotificationRead(id)   → Marca una como leída
 *   - markAllNotificationsRead() → Marca todas como leídas
 *   - deleteNotification(id)     → Elimina una notificación
 */

// ── Íconos por tipo de notificación ──
const NOTIF_ICONS = {
    channel_assigned: 'add_circle',
    channel_revoked: 'remove_circle',
    account_approved: 'check_circle',
    account_rejected: 'cancel',
    account_disabled: 'block',
    role_change: 'swap_horiz',
    status_change: 'info',
    general: 'notifications',
};

const NOTIF_COLORS = {
    channel_assigned: 'var(--color-success, #16a34a)',
    channel_revoked: 'var(--color-warning, #ea580c)',
    account_approved: 'var(--color-success, #16a34a)',
    account_rejected: 'var(--color-error, #dc2626)',
    account_disabled: 'var(--color-error, #dc2626)',
    role_change: 'var(--color-info, #2563eb)',
    status_change: 'var(--color-info, #2563eb)',
    general: 'var(--color-info, #2563eb)',
};

// ── Cargar notificaciones ──
async function loadNotifications() {
    const container = document.getElementById('notifList');
    if (!container) return;

    container.innerHTML = '<p class="notif-loading">Cargando notificaciones...</p>';

    try {
        const res = await api.get('/notifications', true);
        state.notifications.items = res.data || [];
        renderNotifications();
    } catch (err) {
        container.innerHTML = '<p class="notif-empty">Error al cargar notificaciones.</p>';
        showToast('Error al cargar notificaciones: ' + err.message, 'error');
    }
}

// ── Cargar contador de no leídas (para badge de campana) ──
async function loadUnreadCount() {
    try {
        const res = await api.get('/notifications/unread-count', true);
        const count = res.data?.count || 0;
        state.notifications.unreadCount = count;
        updateNotifBadge(count);
    } catch {
        // Silenciar errores del badge
    }
}

// ── Actualizar badge visual de la campana ──
function updateNotifBadge(count) {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;

    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

// ── Renderizar lista de notificaciones ──
function renderNotifications() {
    const container = document.getElementById('notifList');
    if (!container) return;

    const items = state.notifications.items;

    if (!items.length) {
        container.innerHTML = `
            <div class="notif-empty">
                <span class="material-symbols-rounded" style="font-size:3rem;opacity:.4">notifications_off</span>
                <p>No tienes notificaciones</p>
            </div>`;
        return;
    }

    container.innerHTML = items.map(n => {
        const isUnread = !n.read_at;
        const icon = n.icon || NOTIF_ICONS[n.type] || 'notifications';
        const color = NOTIF_COLORS[n.type] || NOTIF_COLORS.general;
        const timeAgo = formatTimeAgo(n.created_at);

        return `
        <div class="notif-item ${isUnread ? 'notif-item--unread' : ''}" data-id="${escapeHtml(n.id)}">
            <div class="notif-item__icon" style="color:${color}">
                <span class="material-symbols-rounded">${escapeHtml(icon)}</span>
            </div>
            <div class="notif-item__content">
                <div class="notif-item__title">${escapeHtml(n.title)}</div>
                <div class="notif-item__message">${escapeHtml(n.message)}</div>
                <div class="notif-item__time">${timeAgo}</div>
            </div>
            <div class="notif-item__actions">
                ${isUnread ? `<button class="btn btn--icon btn--ghost" title="Marcar como leída"
                    onclick="markNotificationRead('${escapeHtml(n.id)}')">
                    <span class="material-symbols-rounded">mark_email_read</span>
                </button>` : ''}
                <button class="btn btn--icon btn--ghost" title="Eliminar"
                    onclick="deleteNotification('${escapeHtml(n.id)}')">
                    <span class="material-symbols-rounded">delete</span>
                </button>
            </div>
        </div>`;
    }).join('');
}

// ── Marcar una como leída ──
async function markNotificationRead(id) {
    try {
        await api.request('PATCH', `/notifications/${id}/read`, { auth: true });
        // Actualizar en estado local
        const item = state.notifications.items.find(n => n.id === id);
        if (item) item.read_at = new Date().toISOString();
        renderNotifications();
        loadUnreadCount();
    } catch (err) {
        showToast('Error al marcar como leída: ' + err.message, 'error');
    }
}

// ── Marcar todas como leídas ──
async function markAllNotificationsRead() {
    try {
        await api.post('/notifications/read-all', {}, true);
        state.notifications.items.forEach(n => {
            if (!n.read_at) n.read_at = new Date().toISOString();
        });
        renderNotifications();
        loadUnreadCount();
        showToast('Todas las notificaciones marcadas como leídas.', 'success');
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

// ── Eliminar una notificación ──
async function deleteNotification(id) {
    try {
        await api.del(`/notifications/${id}`, true);
        state.notifications.items = state.notifications.items.filter(n => n.id !== id);
        renderNotifications();
        loadUnreadCount();
        showToast('Notificación eliminada.', 'info');
    } catch (err) {
        showToast('Error al eliminar: ' + err.message, 'error');
    }
}

// ── Formato de tiempo relativo ──
function formatTimeAgo(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Hace un momento';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `Hace ${days}d`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}
