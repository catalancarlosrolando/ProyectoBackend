/**
 * =============================================
 * Difexa Frontend - Home / Landing & Dashboard
 * =============================================
 */

// ── Home / Landing ──
async function loadLanding() {
    const loading = document.getElementById('homeLoading');
    const content = document.getElementById('homeContent');
    const error = document.getElementById('homeError');

    loading.style.display = 'flex';
    content.style.display = 'none';
    error.style.display = 'none';

    try {
        const data = await api.get('/landing');
        document.getElementById('apiMessage').textContent = data.message || '-';
        document.getElementById('apiVersion').textContent = data.version || '-';
        document.getElementById('apiTimestamp').textContent = formatDate(data.timestamp);
        document.getElementById('apiStatus').textContent = 'Conectado';

        // Update date in timestamp card trend
        const dateEl = document.getElementById('apiDate');
        if (dateEl && data.timestamp) {
            const d = new Date(data.timestamp);
            dateEl.textContent = d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
        }

        loading.style.display = 'none';
        content.style.display = 'block';
    } catch (err) {
        loading.style.display = 'none';
        error.style.display = 'block';
        document.getElementById('homeErrorMessage').textContent =
            'No se pudo conectar con la API. Verifica que el servidor esté ejecutándose.';
    }
}

async function doPing() {
    const pre = document.querySelector('#pingResult pre');
    const meta = document.getElementById('pingMeta');
    const responseTime = document.getElementById('pingResponseTime');
    pre.textContent = 'Enviando ping...';
    if (meta) meta.style.display = 'none';

    try {
        const start = performance.now();
        const data = await api.get('/ping');
        const ms = Math.round(performance.now() - start);
        pre.textContent = JSON.stringify(data, null, 2);
        if (meta) {
            meta.style.display = 'flex';
            responseTime.textContent = `Tiempo de respuesta: ${ms}ms`;
        }
    } catch (err) {
        pre.textContent = `Error: ${err.message}`;
    }
}

// ── Dashboard ──
async function loadDashboard() {
    if (!state.isAuthenticated) return;

    const loading = document.getElementById('dashLoading');
    const lastSync = document.getElementById('dashLastSync');

    loading.style.display = 'flex';

    try {
        const res = await api.get('/admin/dashboard', true);
        const stats = res.data?.stats;

        const totalPosts = stats?.total_posts ?? stats?.posts ?? '-';
        const devicesOnline = stats?.devices_online ?? stats?.active ?? '-';
        const channels = stats?.channels ?? stats?.total_channels ?? '-';
        const alerts = stats?.alerts ?? stats?.comments ?? '-';

        document.getElementById('dashTotalPosts').textContent = totalPosts;
        document.getElementById('dashDevicesOnline').textContent = devicesOnline;
        document.getElementById('dashChannels').textContent = channels;
        document.getElementById('dashAlerts').textContent = alerts;

        renderDashboardLogs(res.data?.recent || res.data?.logs || []);
        if (lastSync) lastSync.textContent = `Actualizado: ${formatDate(new Date())}`;
        loading.style.display = 'none';
    } catch (err) {
        loading.style.display = 'none';
        renderDashboardLogs([]);
        if (lastSync) lastSync.textContent = 'Actualizado: -';
        showToast('Error al cargar dashboard: ' + err.message, 'error');
    }
}

function renderDashboardLogs(logs) {
    const tbody = document.getElementById('dashLogsBody');
    if (!tbody) return;

    const fallback = [
        { id: 'DT-102', status: 'online', channel: 'Ofertas', pulse: 'hace 2 min' },
        { id: 'DT-318', status: 'online', channel: 'Eventos', pulse: 'hace 6 min' },
        { id: 'DT-409', status: 'offline', channel: 'Noticias', pulse: 'hace 12 min' },
        { id: 'DT-552', status: 'alerta', channel: 'Promos', pulse: 'hace 20 min' }
    ];

    const rows = Array.isArray(logs) && logs.length > 0 ? logs : fallback;

    tbody.innerHTML = rows.map((log) => {
        const id = escapeHtml(String(log.id ?? log.device_id ?? '—'));
        const statusRaw = String(log.status ?? log.state ?? log.online ?? 'offline').toLowerCase();
        const channel = escapeHtml(String(log.channel ?? log.active_channel ?? '—'));
        const pulse = escapeHtml(String(log.pulse ?? log.last_seen ?? log.last_pulse ?? '—'));

        const statusLabel = statusRaw === 'online' || statusRaw === 'activo' || statusRaw === 'true'
            ? 'online'
            : statusRaw === 'offline' || statusRaw === 'inactivo' || statusRaw === 'false'
                ? 'offline'
                : 'alerta';

        const statusClass = statusLabel === 'online'
            ? 'status-pill--success'
            : statusLabel === 'offline'
                ? 'status-pill--error'
                : 'status-pill--warning';

        return `
            <tr>
                <td>${id}</td>
                <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
                <td>${channel}</td>
                <td>${pulse}</td>
            </tr>
        `;
    }).join('');
}
