import React, { useEffect, useState } from 'react';
import { WebSyncService, isFileSystemAccessSupported } from '../services/webSync.js';

function formatEventLine(event) {
  if (event.type === 'action') {
    const emoji = event.action === 'upload' ? '↑' : event.action === 'download' ? '↓' : '!';
    return `${emoji} ${event.name} (${event.reason || event.action})${event.error ? ` — ${event.error}` : ''}`;
  }
  if (event.type === 'synced') return `✓ Синхронізовано (${event.count} дій)`;
  if (event.type === 'started') return `▶ Старт у «${event.path}»`;
  if (event.type === 'stopped') return `■ Зупинено`;
  if (event.type === 'file-state') return `• ${event.name}: ${event.state}`;
  return JSON.stringify(event);
}

export function SyncPanel({ api, showToast }) {
  const supported = isFileSystemAccessSupported();
  const [service] = useState(() => (supported ? new WebSyncService({ api }) : null));
  const [folderName, setFolderName] = useState(null);
  const [active, setActive] = useState(false);
  const [log, setLog] = useState([]);

  useEffect(() => {
    if (!service) return;
    service.onEvent = (event) => {
      if (event.type === 'started') {
        setActive(true);
        if (event.path) setFolderName(event.path);
      }
      if (event.type === 'stopped') setActive(false);
      setLog((entries) => [{ at: new Date().toISOString(), ...event }, ...entries].slice(0, 50));
    };
    service.loadSavedHandle().then((handle) => {
      if (handle) setFolderName(handle.name);
    });
    return () => service.stop();
  }, [service]);

  if (!supported) {
    return (
      <div className="panel" data-testid="sync-panel">
        <h3>Синхронізація</h3>
        <p className="muted">
          Браузер не підтримує File System Access API, тому синхронізація локальної папки доступна лише в Chrome, Edge, Opera чи Brave.
        </p>
        <span className="badge warn" data-testid="sync-status">Недоступна</span>
      </div>
    );
  }

  const chooseFolder = async () => {
    try {
      const handle = await service.pickFolder();
      setFolderName(handle.name);
      showToast?.(`Обрано папку «${handle.name}»`);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      showToast?.(err.message || 'Не вдалося обрати папку', 'error');
    }
  };

  const toggle = async () => {
    try {
      if (active) {
        service.stop();
      } else {
        if (!service.dirHandle) {
          await service.loadSavedHandle();
        }
        if (!service.dirHandle) {
          showToast?.('Спочатку оберіть локальну папку', 'error');
          return;
        }
        await service.start();
      }
    } catch (err) {
      showToast?.(err.message || 'Помилка синхронізації', 'error');
    }
  };

  const syncNow = async () => {
    try {
      if (!service.dirHandle) {
        showToast?.('Спочатку оберіть локальну папку', 'error');
        return;
      }
      const perm = await service.ensurePermission('readwrite');
      if (perm !== 'granted') {
        showToast?.('Немає дозволу на доступ до папки', 'error');
        return;
      }
      await service.syncOnce();
    } catch (err) {
      showToast?.(err.message || 'Помилка синхронізації', 'error');
    }
  };

  const forget = async () => {
    service.stop();
    await service.forgetHandle();
    setFolderName(null);
    setLog([]);
    showToast?.('Папку забуто');
  };

  return (
    <div className="panel" data-testid="sync-panel">
      <h3>Синхронізація</h3>
      <div className="row">
        <button className="secondary" onClick={chooseFolder} data-testid="choose-folder">
          Обрати папку…
        </button>
        <span className={`badge ${active ? 'on' : 'off'}`} data-testid="sync-status">
          {active ? 'Увімкнена' : 'Вимкнена'}
        </span>
      </div>
      <p className="muted" style={{ marginTop: 6, wordBreak: 'break-all' }} data-testid="sync-folder">
        {folderName ? `Папка: ${folderName}` : '— папка не обрана —'}
      </p>
      <div className="row" style={{ marginTop: 8 }}>
        <button onClick={toggle} data-testid="toggle-sync">
          {active ? 'Вимкнути' : 'Увімкнути'}
        </button>
        <button className="secondary" onClick={syncNow} data-testid="sync-now">
          Синхронізувати зараз
        </button>
        <button className="ghost" onClick={forget} data-testid="forget-folder">
          Забути
        </button>
      </div>
      <div className="sync-log" data-testid="sync-log" style={{ marginTop: 8 }}>
        {log.length === 0 ? <div className="entry muted">Журнал порожній</div> : null}
        {log.map((entry, idx) => {
          const action = entry.action || entry.type;
          return (
            <div key={idx} className={`entry ${action}`}>
              <span className="muted">{new Date(entry.at).toLocaleTimeString('uk-UA')}</span>{' '}
              {formatEventLine(entry)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
