import React, { useEffect, useState } from 'react';

function formatEventLine(event) {
  if (event.type === 'action') {
    const emoji = event.action === 'upload' ? '↑' : event.action === 'download' ? '↓' : '!';
    return `${emoji} ${event.name} (${event.reason || event.action})${event.error ? ` — ${event.error}` : ''}`;
  }
  if (event.type === 'synced') return `✓ Синхронізовано (${event.count} дій)`;
  if (event.type === 'started') return `▶ Старт у ${event.path}`;
  if (event.type === 'stopped') return `■ Зупинено`;
  if (event.type === 'file-state') return `• ${event.name}: ${event.state}`;
  return JSON.stringify(event);
}

export function SyncPanel({ initialFolder, showToast }) {
  const [folder, setFolder] = useState(initialFolder || null);
  const [active, setActive] = useState(false);
  const [log, setLog] = useState([]);

  useEffect(() => {
    const off = window.miniDrive.sync.onEvent((event) => {
      if (event.type === 'started') {
        setActive(true);
        if (event.path) setFolder(event.path);
      }
      if (event.type === 'stopped') setActive(false);
      setLog((entries) => [{ at: new Date().toISOString(), ...event }, ...entries].slice(0, 50));
    });
    return () => off?.();
  }, []);

  const chooseFolder = async () => {
    const res = await window.miniDrive.sync.chooseFolder();
    if (!res.canceled) setFolder(res.path);
  };

  const toggle = async () => {
    try {
      if (active) {
        await window.miniDrive.sync.stop();
      } else {
        if (!folder) {
          showToast?.('Спочатку оберіть локальну папку', 'error');
          return;
        }
        await window.miniDrive.sync.start({ folder });
      }
    } catch (err) {
      showToast?.(err.message || 'Помилка синхронізації', 'error');
    }
  };

  const syncNow = async () => {
    try {
      await window.miniDrive.sync.now();
    } catch (err) {
      showToast?.(err.message || 'Помилка синхронізації', 'error');
    }
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
        {folder || '— папка не обрана —'}
      </p>
      <div className="row" style={{ marginTop: 8 }}>
        <button onClick={toggle} data-testid="toggle-sync">
          {active ? 'Вимкнути' : 'Увімкнути'}
        </button>
        <button className="secondary" onClick={syncNow} data-testid="sync-now">
          Синхронізувати зараз
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
