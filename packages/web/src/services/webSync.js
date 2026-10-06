import { SYNC_STATES } from '@mini-drive/shared/sync';
import {
  readManifest,
  writeManifestEntry,
  deleteManifestEntry,
  clearManifest,
  saveKv,
  readKv,
  deleteKv,
} from './manifest.js';

const HANDLE_KEY = 'syncDirHandle';
const IGNORE_NAMES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

export function isFileSystemAccessSupported() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

async function listLocal(dirHandle) {
  const out = [];
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind !== 'file') continue;
    if (IGNORE_NAMES.has(name)) continue;
    const file = await handle.getFile();
    out.push({ name, size: file.size, lastModified: file.lastModified, handle });
  }
  return out;
}

// Web-specific: compares current observed values to what the manifest recorded
// at the previous sync, so cross-clock drift between browser and server can't
// cause a ping-pong. Timestamps are only used to break true conflicts.
function decideActions(local, remote, manifest) {
  const names = new Set();
  for (const f of local) names.add(f.name);
  for (const f of remote) names.add(f.name);
  const actions = [];
  for (const name of names) {
    const l = local.find((f) => f.name === name);
    const r = remote.find((f) => f.name === name);
    const m = manifest[name];
    if (l && !r) {
      actions.push({ name, kind: 'upload', reason: 'only-local', local: l });
    } else if (!l && r) {
      actions.push({ name, kind: 'download', reason: 'only-remote', remote: r });
    } else if (l && r) {
      const localChanged = !m || l.lastModified !== m.localLastModified;
      const remoteChanged = !m || r.modifiedAt !== m.serverModifiedAt;
      if (!localChanged && !remoteChanged) {
        actions.push({ name, kind: 'skip', reason: 'in-sync', local: l, remote: r });
      } else if (localChanged && !remoteChanged) {
        actions.push({ name, kind: 'upload', reason: 'local-changed', local: l, remote: r });
      } else if (!localChanged && remoteChanged) {
        actions.push({ name, kind: 'download', reason: 'remote-changed', local: l, remote: r });
      } else {
        // Both sides changed since last sync — pick remote as safer default.
        actions.push({ name, kind: 'download', reason: 'conflict-remote-wins', local: l, remote: r });
      }
    }
  }
  return actions;
}

export class WebSyncService {
  constructor({ api, onEvent } = {}) {
    this.api = api;
    this.onEvent = onEvent || (() => {});
    this.dirHandle = null;
    this.intervalId = null;
    this.lastSyncAt = null;
    this.inflight = false;
  }

  _emit(event) {
    try {
      this.onEvent(event);
    } catch {
      // ignore
    }
  }

  async loadSavedHandle() {
    const handle = await readKv(HANDLE_KEY);
    if (!handle) return null;
    this.dirHandle = handle;
    return handle;
  }

  async saveHandle(handle) {
    await saveKv(HANDLE_KEY, handle);
    this.dirHandle = handle;
  }

  async forgetHandle() {
    this.dirHandle = null;
    await deleteKv(HANDLE_KEY);
    await clearManifest();
  }

  async ensurePermission(mode = 'readwrite') {
    if (!this.dirHandle) return 'denied';
    const opts = { mode };
    if ((await this.dirHandle.queryPermission?.(opts)) === 'granted') return 'granted';
    return this.dirHandle.requestPermission?.(opts) ?? 'denied';
  }

  async pickFolder() {
    if (!isFileSystemAccessSupported()) {
      throw new Error('Браузер не підтримує вибір локальної папки');
    }
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await this.saveHandle(handle);
    this._emit({ type: 'started', path: handle.name, at: new Date().toISOString() });
    return handle;
  }

  async start({ intervalMs = 15000 } = {}) {
    if (!this.dirHandle) throw new Error('Папку ще не обрано');
    const permission = await this.ensurePermission('readwrite');
    if (permission !== 'granted') {
      throw new Error('Немає дозволу на доступ до папки');
    }
    this.stop();
    this._emit({ type: 'started', path: this.dirHandle.name, at: new Date().toISOString() });
    this.intervalId = setInterval(() => {
      this.syncOnce().catch((err) => this._emit({
        type: 'action', action: 'error', name: '-', error: err.message, at: new Date().toISOString(),
      }));
    }, intervalMs);
    await this.syncOnce();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this._emit({ type: 'stopped', at: new Date().toISOString() });
    }
  }

  async syncOnce() {
    if (!this.dirHandle) throw new Error('Папку не обрано');
    if (this.inflight) return { actions: [] };
    this.inflight = true;
    try {
      const manifest = await readManifest();
      const [local, remote] = await Promise.all([
        listLocal(this.dirHandle),
        this.api.listFiles(),
      ]);
      const actions = decideActions(local, remote, manifest);

      for (const action of actions) {
        try {
          if (action.kind === 'upload') {
            this._emit({ type: 'file-state', name: action.name, state: SYNC_STATES.UPLOADING });
            const file = await action.local.handle.getFile();
            const buffer = new Uint8Array(await file.arrayBuffer());
            const uploaded = await this.api.uploadFile(action.name, buffer);
            // Re-read the file after upload: lastModified may have shifted
            // (writable close bumps it), and we need the exact value we'll
            // observe next cycle to detect "no change".
            const after = await action.local.handle.getFile();
            await writeManifestEntry(action.name, {
              localLastModified: after.lastModified,
              serverModifiedAt: uploaded.modifiedAt,
            });
            this._emit({
              type: 'action', action: 'upload', name: action.name,
              reason: action.reason, at: new Date().toISOString(),
            });
            this._emit({ type: 'file-state', name: action.name, state: SYNC_STATES.SYNCED });
          } else if (action.kind === 'download') {
            this._emit({ type: 'file-state', name: action.name, state: SYNC_STATES.DOWNLOADING });
            const dl = await this.api.downloadFile(action.remote.id);
            const fileHandle = await this.dirHandle.getFileHandle(action.name, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(dl.buffer);
            await writable.close();
            const file = await fileHandle.getFile();
            await writeManifestEntry(action.name, {
              localLastModified: file.lastModified,
              serverModifiedAt: dl.modifiedAt || action.remote.modifiedAt,
            });
            this._emit({
              type: 'action', action: 'download', name: action.name,
              reason: action.reason, at: new Date().toISOString(),
            });
            this._emit({ type: 'file-state', name: action.name, state: SYNC_STATES.SYNCED });
          } else {
            this._emit({ type: 'file-state', name: action.name, state: SYNC_STATES.SYNCED });
          }
        } catch (err) {
          this._emit({
            type: 'action', action: 'error', name: action.name,
            error: err.message, at: new Date().toISOString(),
          });
          this._emit({ type: 'file-state', name: action.name, state: SYNC_STATES.ERROR });
        }
      }

      const seen = new Set(actions.map((a) => a.name));
      for (const name of Object.keys(manifest)) {
        if (!seen.has(name)) {
          await deleteManifestEntry(name);
        }
      }

      this.lastSyncAt = new Date().toISOString();
      this._emit({ type: 'synced', at: this.lastSyncAt, count: actions.length });
      return { actions, at: this.lastSyncAt };
    } finally {
      this.inflight = false;
    }
  }
}
