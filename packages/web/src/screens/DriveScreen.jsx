import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FileTable,
  ColumnToggles,
  FilePreview,
  DropZone,
  FileQueryService,
  ApiError,
} from '@mini-drive/shared';
import { SyncPanel } from '../components/SyncPanel.jsx';
import { ConfirmModal } from '../components/ConfirmModal.jsx';

const DEFAULT_COLUMNS = ['name', 'createdAt', 'modifiedAt', 'uploadedBy', 'modifiedBy'];

function extensionLower(name) {
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot + 1).toLowerCase();
}

function mimeForName(name) {
  const ext = extensionLower(name);
  if (ext === 'png') return 'image/png';
  if (ext === 'html') return 'text/html';
  if (ext === 'txt') return 'text/plain';
  if (ext === 'js') return 'application/javascript';
  return 'application/octet-stream';
}

export function DriveScreen({ api, session, onLogout, onUnauthorized, showToast }) {
  const [files, setFiles] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_COLUMNS);
  const [sortDirection, setSortDirection] = useState('asc');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [previewBuffer, setPreviewBuffer] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const uploadInputRef = useRef(null);
  // Signed URLs by file id — pre-warmed for DownloadURL drag-out.
  const signedUrlCache = useRef(new Map());

  const refresh = useCallback(() => setRefreshToken((n) => n + 1), []);

  const absoluteUrl = useCallback(
    (relative) => {
      try {
        return new URL(relative, session.serverUrl || window.location.origin).toString();
      } catch {
        return relative;
      }
    },
    [session.serverUrl]
  );

  const callApi = useCallback(
    async (fn) => {
      try {
        return await fn();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          onUnauthorized?.();
        }
        throw err;
      }
    },
    [onUnauthorized]
  );

  useEffect(() => {
    let active = true;
    callApi(() => api.listFiles())
      .then((list) => active && setFiles(list))
      .catch((err) => showToast?.(err.message || 'Не вдалося отримати список', 'error'));
    return () => {
      active = false;
    };
  }, [api, callApi, refreshToken, showToast]);

  const visibleFiles = useMemo(
    () => FileQueryService.apply(files, { filter, sort: sortDirection }),
    [files, filter, sortDirection]
  );

  const prepareSignedUrl = useCallback(
    async (file) => {
      const cached = signedUrlCache.current.get(file.id);
      if (cached && cached.expiresAt > Date.now() + 5000) return cached;
      const url = `${session.serverUrl.replace(/\/$/, '')}/api/files/${file.id}/signed-url`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ ttlSeconds: 60 }),
      });
      if (!res.ok) throw new Error(`signed-url: HTTP ${res.status}`);
      const data = await res.json();
      const payload = {
        url: absoluteUrl(data.url),
        expiresAt: Date.parse(data.expiresAt),
      };
      signedUrlCache.current.set(file.id, payload);
      return payload;
    },
    [absoluteUrl, session.serverUrl, session.token]
  );

  const handleRowClick = async (file) => {
    setSelected(file);
    setPreviewBuffer(null);
    setPreviewLoading(true);
    try {
      const { buffer } = await callApi(() => api.downloadFile(file.id));
      setPreviewBuffer(buffer);
    } catch (err) {
      showToast?.(err.message || 'Не вдалося прочитати файл', 'error');
    } finally {
      setPreviewLoading(false);
    }
    prepareSignedUrl(file).catch(() => {});
  };

  const uploadBlobs = async (blobs) => {
    for (const blob of blobs) {
      try {
        await callApi(() => api.uploadFile(blob.name, blob));
        showToast?.(`Завантажено: ${blob.name}`);
      } catch (err) {
        showToast?.(err.message || `Помилка завантаження ${blob.name}`, 'error');
      }
    }
    refresh();
  };

  const handleUploadFromInput = (event) => {
    const list = Array.from(event.target.files || []);
    if (list.length) uploadBlobs(list);
    event.target.value = '';
  };

  const downloadSelected = async () => {
    if (!selected) return;
    try {
      const { buffer, name } = await callApi(() => api.downloadFile(selected.id));
      const blob = new Blob([buffer], { type: mimeForName(name || selected.name) });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name || selected.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
      showToast?.(err.message || 'Не вдалося скачати', 'error');
    }
  };

  const askDelete = (file) => setConfirmTarget(file || selected);
  const cancelDelete = () => setConfirmTarget(null);
  const confirmDelete = async () => {
    const target = confirmTarget;
    if (!target) return;
    setConfirmTarget(null);
    try {
      await callApi(() => api.deleteFile(target.id));
      if (selected?.id === target.id) {
        setSelected(null);
        setPreviewBuffer(null);
      }
      signedUrlCache.current.delete(target.id);
      showToast?.(`Видалено: ${target.name}`);
      refresh();
    } catch (err) {
      showToast?.(err.message || 'Помилка видалення', 'error');
    }
  };

  const toggleSort = () => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));

  const handleDragStart = async (file, kind, event) => {
    if (kind === 'select') {
      prepareSignedUrl(file).catch(() => {});
      return;
    }
    if (kind === 'drag' && event) {
      const mime = mimeForName(file.name);
      try {
        const cached = signedUrlCache.current.get(file.id);
        if (cached && cached.expiresAt > Date.now() + 5000) {
          event.dataTransfer.setData('DownloadURL', `${mime}:${file.name}:${cached.url}`);
          event.dataTransfer.effectAllowed = 'copy';
          return;
        }
        const payload = await prepareSignedUrl(file);
        event.dataTransfer.setData('DownloadURL', `${mime}:${file.name}:${payload.url}`);
        event.dataTransfer.effectAllowed = 'copy';
      } catch (err) {
        showToast?.(err.message || 'Не вдалося підготувати drag-out', 'error');
      }
    }
  };

  return (
    <div className="drive-screen" data-testid="drive-screen">
      <header className="drive-topbar">
        <h2>Мій диск</h2>
        <span className="badge">{session.serverUrl || window.location.origin}</span>
        <span className="spacer" />
        <span className="user">Вхід як <strong>{session.login}</strong></span>
        <button className="secondary" onClick={refresh} data-testid="refresh">Оновити</button>
        <button className="ghost" onClick={onLogout} data-testid="logout">Вийти</button>
      </header>

      <div className="drive-body">
        <section className="drive-main">
          <div className="toolbar">
            <button onClick={() => uploadInputRef.current?.click()} data-testid="upload-btn">
              Завантажити файли
            </button>
            <input
              ref={uploadInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={handleUploadFromInput}
              data-testid="upload-input"
            />
            <button className="secondary" onClick={downloadSelected} disabled={!selected} data-testid="download-btn">
              Скачати обраний
            </button>
            <button className="danger" onClick={() => askDelete()} disabled={!selected} data-testid="delete-btn">
              Видалити
            </button>
            <span style={{ flex: 1 }} />
            <ColumnToggles visible={visibleColumns} onChange={setVisibleColumns} />
          </div>

          <div className="toolbar filter-group">
            <strong>Фільтр:</strong>
            <label>
              <input
                type="radio"
                name="filter"
                value="all"
                checked={filter === 'all'}
                onChange={() => setFilter('all')}
                data-testid="filter-all"
              />
              Усі файли
            </label>
            <label>
              <input
                type="radio"
                name="filter"
                value="cpp_png"
                checked={filter === 'cpp_png'}
                onChange={() => setFilter('cpp_png')}
                data-testid="filter-cpp-png"
              />
              Лише .cpp, .png
            </label>
          </div>

          <DropZone onFiles={uploadBlobs}>
            <FileTable
              files={visibleFiles}
              visibleColumns={visibleColumns}
              sortDirection={sortDirection}
              onToggleSort={toggleSort}
              onRowClick={handleRowClick}
              selectedId={selected?.id}
              onDragStart={handleDragStart}
              onContextDelete={askDelete}
            />
          </DropZone>
        </section>

        <aside className="drive-sidebar">
          <div className="panel">
            <h3>Перегляд</h3>
            <FilePreview file={selected} loading={previewLoading} buffer={previewBuffer} />
          </div>
          <SyncPanel api={api} showToast={showToast} />
        </aside>
      </div>

      <ConfirmModal
        open={!!confirmTarget}
        title="Видалити файл?"
        message={confirmTarget ? `Видалити «${confirmTarget.name}»? Цю дію не можна скасувати.` : ''}
        confirmLabel="Видалити"
        cancelLabel="Скасувати"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        danger
      />
    </div>
  );
}
