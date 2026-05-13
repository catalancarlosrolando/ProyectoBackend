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
    const responseEl = document.getElementById('dashResponse');

    loading.style.display = 'flex';

    try {
        const res = await api.get('/admin/dashboard', true);
        const stats = res.data?.stats;

        if (stats) {
            document.getElementById('dashUsers').textContent = stats.users ?? '-';
            document.getElementById('dashPosts').textContent = stats.posts ?? '-';
            document.getElementById('dashComments').textContent = stats.comments ?? '-';
            document.getElementById('dashActive').textContent = stats.active ?? '-';
        }

        responseEl.querySelector('pre').textContent = JSON.stringify(res, null, 2);
        loading.style.display = 'none';
    } catch (err) {
        loading.style.display = 'none';
        responseEl.querySelector('pre').textContent = `❌ Error: ${err.message}`;
        showToast('Error al cargar dashboard: ' + err.message, 'error');
    }
}
