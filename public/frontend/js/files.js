/**
 * =============================================
 * Difexa Frontend - Gestión de Archivos
 * =============================================
 */

function setupFileUpload() {
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');

    // Click to select
    uploadZone.addEventListener('click', () => fileInput.click());

    // Drag & drop
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('upload-zone--dragover');
    });
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('upload-zone--dragover');
    });
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('upload-zone--dragover');
        handleFileSelection(e.dataTransfer.files);
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
        handleFileSelection(e.target.files);
    });
}

function handleFileSelection(files) {
    const fileArray = Array.from(files).slice(0, 10);
    state.selectedFiles = fileArray;

    const selectedEl = document.getElementById('selectedFiles');
    const countEl = document.getElementById('selectedCount');
    const listEl = document.getElementById('filePreviewList');
    const uploadBtn = document.getElementById('btnUpload');

    if (fileArray.length === 0) {
        selectedEl.style.display = 'none';
        uploadBtn.disabled = true;
        return;
    }

    selectedEl.style.display = 'block';
    countEl.textContent = `${fileArray.length} archivo(s) seleccionado(s)`;
    uploadBtn.disabled = false;

    listEl.innerHTML = fileArray.map((f, i) => `
        <div class="file-preview-item">
            <span class="file-preview-item__icon">${getFileIcon(f.name)}</span>
            <span class="file-preview-item__name">${escapeHtml(f.name)}</span>
            <span class="file-preview-item__size">${formatSize(f.size)}</span>
            <button class="btn btn--ghost btn--xs" onclick="removeSelectedFile(${i})">✕</button>
        </div>
    `).join('');
}

function removeSelectedFile(index) {
    state.selectedFiles.splice(index, 1);
    handleFileSelection(state.selectedFiles);
    document.getElementById('fileInput').value = '';
}

function clearSelectedFiles() {
    state.selectedFiles = [];
    document.getElementById('selectedFiles').style.display = 'none';
    document.getElementById('btnUpload').disabled = true;
    document.getElementById('fileInput').value = '';
}

async function uploadFiles() {
    if (state.selectedFiles.length === 0) return;

    const btn = document.getElementById('btnUpload');
    const btnText = document.getElementById('uploadBtnText');
    const progress = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('uploadProgressFill');

    btn.disabled = true;
    btnText.textContent = 'Subiendo...';
    progress.style.display = 'block';
    progressFill.style.width = '30%';

    const formData = new FormData();
    state.selectedFiles.forEach(f => formData.append('files[]', f));

    const desc = document.getElementById('uploadDescription').value.trim();
    if (desc) formData.append('description', desc);

    try {
        progressFill.style.width = '60%';
        const res = await api.upload('/test-files', formData);
        progressFill.style.width = '100%';

        const count = res.data?.total_files || state.selectedFiles.length;
        showToast(`${count} archivo(s) subido(s) exitosamente.`, 'success');

        clearSelectedFiles();
        document.getElementById('uploadDescription').value = '';
        loadFiles();
    } catch (err) {
        showToast('Error al subir archivos: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btnText.textContent = 'Subir Archivos';
        setTimeout(() => {
            progress.style.display = 'none';
            progressFill.style.width = '0%';
        }, 1000);
    }
}

async function loadFiles() {
    const loading = document.getElementById('filesLoading');
    const empty = document.getElementById('filesEmpty');
    const table = document.getElementById('filesTable');
    const tbody = document.getElementById('filesTableBody');

    loading.style.display = 'flex';
    empty.style.display = 'none';
    table.style.display = 'none';

    try {
        const res = await api.get('/test-files');
        const files = res.data?.files || [];

        loading.style.display = 'none';

        if (files.length === 0) {
            empty.style.display = 'block';
            return;
        }

        table.style.display = 'block';
        document.getElementById('filesTotalCount').textContent = `${files.length} archivo(s)`;

        tbody.innerHTML = files.map(f => `
            <tr>
                <td>
                    <span class="file-name">
                        ${getFileIcon(f.name)} ${escapeHtml(f.name)}
                    </span>
                </td>
                <td>${formatSize(f.size)}</td>
                <td>${formatDate(f.last_modified * 1000)}</td>
                <td>
                    <div class="btn-group btn-group--sm">
                        <a href="${API_BASE}/test-files/download/${encodeURIComponent(f.name)}"
                           class="btn btn--sm btn--outline" download>
                            ⬇ Descargar
                        </a>
                        <button class="btn btn--sm btn--danger"
                                onclick="confirmDeleteFile('${escapeHtml(f.name)}')">
                            🗑 Eliminar
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

    } catch (err) {
        loading.style.display = 'none';
        empty.style.display = 'block';
        empty.querySelector('p').textContent = '❌ Error al cargar archivos: ' + err.message;
    }
}

function confirmDeleteFile(filename) {
    showConfirm(
        'Eliminar Archivo',
        `¿Estás seguro de que deseas eliminar "${filename}"?`,
        () => deleteFile(filename)
    );
}

async function deleteFile(filename) {
    closeModal('confirmModal');
    try {
        await api.del(`/test-files/${encodeURIComponent(filename)}`);
        showToast('Archivo eliminado exitosamente.', 'success');
        loadFiles();
    } catch (err) {
        showToast('Error al eliminar: ' + err.message, 'error');
    }
}
