import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  FileTable,
  ColumnToggles,
  FilePreview,
  DropZone,
  FileQueryService,
} from '@mini-drive/shared';
import { SyncPanel } from '../components/SyncPanel.jsx';

const DEFAULT_COLUMNS = ['name', 'createdAt', 'modifiedAt', 'uploadedBy', 'modifiedBy'];

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || '';
      const idx = String(result).indexOf('base64,');
      resolve(idx >= 0 ? String(result).slice(idx + 7) : '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function DriveScreen({ config, onLogout, showToast }) {
  const [files, setFiles] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_COLUMNS);
  const [sortDirection, setSortDirection] = useState('asc');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [previewBuffer, setPreviewBuffer] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = useCallback(() => setRefreshToken((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    window.miniDrive.files.list()
      .then((list) => active && setFiles(list))
      .catch((err) => showToast?.(err.message || 'Не вдалося отримати список', 'error'));
    return () => {
      active = false;
    };
  }, [refreshToken, showToast]);

  const visibleFiles = useMemo(
    () => FileQueryService.apply(files, { filter, sort: sortDirection }),
    [files, filter, sortDirection]
  );

  const handleRowClick = async (file) => {
    setSelected(file);
    setPreviewBuffer(null);
    setPreviewLoading(true);
    try {
      const { dataB64 } = await window.miniDrive.files.read({ id: file.id });
      setPreviewBuffer(base64ToBytes(dataB64));
    } catch (err) {
      showToast?.(err.message || 'Не вдалося прочитати файл', 'error');
    } finally {
      setPreviewLoading(false);
    }
    // startDrag requires a file on disk — cache now so first drag works.
    window.miniDrive.files.prepareDrag({ id: file.id, name: file.name }).catch(() => {});
  };

  const handleUpload = async (jsFiles) => {
    for (const f of jsFiles) {
      try {
        const dataB64 = await fileToBase64(f);
        await window.miniDrive.files.upload({ name: f.name, dataB64 });
        showToast?.(`Завантажено: ${f.name}`);
      } catch (err) {
        showToast?.(err.message || `Помилка завантаження ${f.name}`, 'error');
      }
    }
    refresh();
  };

  const pickFiles = async () => {
    const result = await window.miniDrive.dialog.openFile();
    if (result.canceled) return;
    for (const p of result.paths) {
      const name = p.split(/[\\/]/).pop();
      try {
        await window.miniDrive.files.upload({ name, path: p });
        showToast?.(`Завантажено: ${name}`);
      } catch (err) {
        showToast?.(err.message || `Помилка завантаження ${name}`, 'error');
      }
    }
    refresh();
  };

  const downloadSelected = async () => {
    if (!selected) return;
    try {
      const res = await window.miniDrive.files.downloadToDialog({
        id: selected.id,
        defaultName: selected.name,
      });
      if (!res.canceled) showToast?.(`Збережено: ${res.path}`);
    } catch (err) {
      showToast?.(err.message || 'Не вдалося зберегти', 'error');
    }
  };

  const removeFile = async (file) => {
    const target = file || selected;
    if (!target) return;
    const { confirmed } = await window.miniDrive.dialog.confirmDelete({ name: target.name });
    if (!confirmed) return;
    try {
      await window.miniDrive.files.delete({ id: target.id });
      if (selected?.id === target.id) {
        setSelected(null);
        setPreviewBuffer(null);
      }
      showToast?.(`Видалено: ${target.name}`);
      refresh();
    } catch (err) {
      showToast?.(err.message || 'Помилка видалення', 'error');
    }
  };

  const toggleSort = () => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));

  const handleDragStart = async (file, kind, event) => {
    const result = await window.miniDrive.files.prepareDrag({ id: file.id, name: file.name });
    if (!result?.path) return;
    if (kind === 'drag' && event) {
      event.preventDefault();
      window.miniDrive.files.startDrag({ path: result.path });
    }
  };

  return (
    <div className="drive-screen" data-testid="drive-screen">
      <header className="drive-topbar">
        <h2>Мій диск</h2>
        <span className="badge">{config.serverUrl}</span>
        <span className="spacer" />
        <span className="user">Вхід як <strong>{config.login}</strong></span>
        <button className="secondary" onClick={refresh} data-testid="refresh">Оновити</button>
        <button className="ghost" onClick={onLogout} data-testid="logout">Вийти</button>
      </header>

      <div className="drive-body">
        <section className="drive-main">
          <div className="toolbar">
            <button onClick={pickFiles} data-testid="upload-btn">Завантажити файли</button>
            <button className="secondary" onClick={downloadSelected} disabled={!selected} data-testid="download-btn">
              Скачати обраний
            </button>
            <button className="danger" onClick={() => removeFile()} disabled={!selected} data-testid="delete-btn">
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

          <DropZone onFiles={handleUpload}>
            <FileTable
              files={visibleFiles}
              visibleColumns={visibleColumns}
              sortDirection={sortDirection}
              onToggleSort={toggleSort}
              onRowClick={handleRowClick}
              selectedId={selected?.id}
              onDragStart={handleDragStart}
              onContextDelete={removeFile}
            />
          </DropZone>
        </section>

        <aside className="drive-sidebar">
          <div className="panel">
            <h3>Перегляд</h3>
            <FilePreview file={selected} loading={previewLoading} buffer={previewBuffer} />
          </div>
          <SyncPanel initialFolder={config.syncFolder} showToast={showToast} />
        </aside>
      </div>
    </div>
  );
}
