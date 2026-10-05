import { compareFileLists, SYNC_STATES } from '@mini-drive/shared/sync';
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

export function isFileSystemAccessSupported() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

async function listLocal(dirHandle, manifest) {
  const out = [];
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind !== 'file') continue;
    const file = await handle.getFile();
    const entry = manifest[name];
    // Browser can't set mtime: use manifest value once we've touched the file.
    const effectiveLocal = entry?.localLastModified
      ? Math.max(entry.localLastModified, file.lastModified)
      : file.lastModified;
    out.push({
      name,
      size: file.size,
      lastModified: file.lastModified,
      modifiedAt: new Date(effectiveLocal).toISOString(),
      handle,
    });
  }
  return out;
}

function remoteForCompare(remote, manifest) {
  // Pin remote modifiedAt to the stored value so sync converges and doesn't ping-pong.
  return remote.map((r) => {
    const entry = manifest[r.name];
    if (entry && entry.serverModifiedAt === r.modifiedAt) {
      return { ...r, modifiedAt: entry.serverModifiedAt };
    }
    return r;
  });
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
      this.syncOnce().catch((err) => this._emit({ type: 'action', action: 'error', name: '-', error: err.message, at: new Date().toISOString() }));
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
      const [localRaw, remoteRaw] = await Promise.all([
        listLocal(this.dirHandle, manifest),
        this.api.listFiles(),
      ]);
      const remote = remoteForCompare(remoteRaw, manifest);
      const actions = compareFileLists(localRaw, remote);

      for (const action of actions) {
        try {
          if (action.kind === 'upload') {
            this._emit({ type: 'file-state', name: action.name, state: SYNC_STATES.UPLOADING });
            const fileHandle = action.local.handle;
            const file = await fileHandle.getFile();
            const buffer = new Uint8Array(await file.arrayBuffer());
            const uploaded = await this.api.uploadFile(action.name, buffer);
            await writeManifestEntry(action.name, {
              localLastModified: file.lastModified,
              serverModifiedAt: uploaded.modifiedAt,
            });
            this._emit({
              type: 'action',
              action: 'upload',
              name: action.name,
              reason: action.reason,
              at: new Date().toISOString(),
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
              type: 'action',
              action: 'download',
              name: action.name,
              reason: action.reason,
              at: new Date().toISOString(),
            });
            this._emit({ type: 'file-state', name: action.name, state: SYNC_STATES.SYNCED });
          } else {
            this._emit({ type: 'file-state', name: action.name, state: SYNC_STATES.SYNCED });
          }
        } catch (err) {
          this._emit({
            type: 'action',
            action: 'error',
            name: action.name,
            error: err.message,
            at: new Date().toISOString(),
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
