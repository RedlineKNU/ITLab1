import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import chokidar from 'chokidar';
import { compareFileLists, SYNC_STATES } from '@mini-drive/shared/sync';

export { compareFileLists, SYNC_STATES };

export class SyncService {
  constructor({ api, onEvent } = {}) {
    this.api = api;
    this.localPath = null;
    this.watcher = null;
    this.onEvent = onEvent || (() => {});
    this.autoTimer = null;
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

  async start(localPath, { intervalMs = 15000 } = {}) {
    await this.stop();
    this.localPath = localPath;
    if (!fs.existsSync(localPath)) fs.mkdirSync(localPath, { recursive: true });
    this._emit({ type: 'started', path: localPath, at: new Date().toISOString() });

    let debounce;
    this.watcher = chokidar.watch(localPath, {
      ignoreInitial: true,
      depth: 0,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 50 },
    });
    const trigger = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => this.syncOnce().catch(() => {}), 500);
    };
    this.watcher.on('add', trigger).on('change', trigger).on('unlink', trigger);

    this.autoTimer = setInterval(() => {
      this.syncOnce().catch(() => {});
    }, intervalMs);

    await this.syncOnce();
  }

  async stop() {
    if (this.autoTimer) {
      clearInterval(this.autoTimer);
      this.autoTimer = null;
    }
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    if (this.localPath) {
      this._emit({ type: 'stopped', path: this.localPath, at: new Date().toISOString() });
    }
    this.localPath = null;
  }

  async _readLocalList() {
    const list = [];
    const entries = await fsp.readdir(this.localPath, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile()) continue;
      const full = path.join(this.localPath, e.name);
      const st = await fsp.stat(full);
      list.push({ name: e.name, size: st.size, modifiedAt: st.mtime.toISOString(), fullPath: full });
    }
    return list;
  }

  async syncOnce() {
    if (!this.localPath) return { actions: [] };
    if (this.inflight) return { actions: [] };
    this.inflight = true;
    try {
      const [local, remote] = await Promise.all([this._readLocalList(), this.api.listFiles()]);
      const actions = compareFileLists(local, remote);
      for (const action of actions) {
        try {
          if (action.kind === 'upload') {
            this._emit({ type: 'file-state', name: action.name, state: SYNC_STATES.UPLOADING });
            const buffer = await fsp.readFile(path.join(this.localPath, action.name));
            const uploaded = await this.api.uploadFile(action.name, buffer);
            // Align local mtime with server modifiedAt — prevents re-upload loop.
            if (uploaded?.modifiedAt) {
              const t = new Date(uploaded.modifiedAt);
              await fsp.utimes(path.join(this.localPath, action.name), t, t);
            }
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
            const target = path.join(this.localPath, action.name);
            await fsp.writeFile(target, dl.buffer);
            if (dl.modifiedAt) {
              const t = new Date(dl.modifiedAt);
              await fsp.utimes(target, t, t);
            }
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
      this.lastSyncAt = new Date().toISOString();
      this._emit({ type: 'synced', at: this.lastSyncAt, count: actions.length });
      return { actions, at: this.lastSyncAt };
    } finally {
      this.inflight = false;
    }
  }
}
