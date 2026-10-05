import { app, BrowserWindow, ipcMain, dialog, nativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { MainApiClient } from './apiClient.js';
import { SyncService } from './syncService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !!process.env.VITE_DEV_SERVER_URL || process.env.NODE_ENV === 'development';

const userDataOverride = process.env.MINI_DRIVE_USER_DATA;
if (userDataOverride) {
  fs.mkdirSync(userDataOverride, { recursive: true });
  app.setPath('userData', userDataOverride);
}

const DEFAULT_SERVER = process.env.MINI_DRIVE_DEFAULT_SERVER || 'http://localhost:3000';

const api = new MainApiClient({ baseUrl: DEFAULT_SERVER });
let mainWindow = null;
let sync = null;
const dragCacheDir = path.join(os.tmpdir(), `mini-drive-drag-${process.pid}`);
fs.mkdirSync(dragCacheDir, { recursive: true });

function configPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function readConfig() {
  try {
    const raw = fs.readFileSync(configPath(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return { serverUrl: DEFAULT_SERVER, token: null, login: null, syncFolder: null };
  }
}

function writeConfig(patch) {
  const current = readConfig();
  const next = { ...current, ...patch };
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(next, null, 2));
  return next;
}

function broadcast(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    title: 'Mini Drive',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (isDev && devUrl) {
    await mainWindow.loadURL(devUrl);
  } else if (isDev) {
    await mainWindow.loadURL('http://localhost:5173');
  } else {
    await mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'renderer', 'index.html'));
  }
}

function ensureSync() {
  if (!sync) {
    sync = new SyncService({
      api,
      onEvent: (event) => broadcast('mini-drive:sync:event', event),
    });
  }
  return sync;
}

app.whenReady().then(async () => {
  const cfg = readConfig();
  api.configure({ baseUrl: cfg.serverUrl || DEFAULT_SERVER, token: cfg.token || null });
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', async () => {
  if (sync) await sync.stop();
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('mini-drive:config:get', () => readConfig());

ipcMain.handle('mini-drive:config:set', (_e, patch) => {
  const next = writeConfig(patch || {});
  if (patch?.serverUrl !== undefined || patch?.token !== undefined) {
    api.configure({ baseUrl: next.serverUrl, token: next.token });
  }
  return next;
});

ipcMain.handle('mini-drive:auth:login', async (_e, { serverUrl, login, password }) => {
  api.configure({ baseUrl: serverUrl, token: null });
  const res = await apiFetch(serverUrl, '/api/auth/login', { login, password });
  const next = writeConfig({ serverUrl, token: res.token, login: res.user.login });
  api.configure({ baseUrl: serverUrl, token: res.token });
  return next;
});

ipcMain.handle('mini-drive:auth:register', async (_e, { serverUrl, login, password }) => {
  await apiFetch(serverUrl, '/api/auth/register', { login, password });
  return apiFetch(serverUrl, '/api/auth/login', { login, password }).then((res) => {
    const next = writeConfig({ serverUrl, token: res.token, login: res.user.login });
    api.configure({ baseUrl: serverUrl, token: res.token });
    return next;
  });
});

ipcMain.handle('mini-drive:auth:logout', async () => {
  if (sync) await sync.stop();
  const next = writeConfig({ token: null, login: null });
  api.configure({ token: null });
  return next;
});

ipcMain.handle('mini-drive:files:list', async () => api.listFiles());

ipcMain.handle('mini-drive:files:upload', async (_e, { name, dataB64, path: filePath }) => {
  let buffer;
  if (filePath) {
    buffer = await fsp.readFile(filePath);
  } else if (dataB64) {
    buffer = Buffer.from(dataB64, 'base64');
  } else {
    throw new Error('Треба передати dataB64 або path');
  }
  return api.uploadFile(name, buffer);
});

ipcMain.handle('mini-drive:files:download-to-dialog', async (_e, { id, defaultName }) => {
  const result = await dialog.showSaveDialog(mainWindow, { defaultPath: defaultName });
  if (result.canceled || !result.filePath) return { canceled: true };
  const { buffer, modifiedAt } = await api.downloadFile(id);
  await fsp.writeFile(result.filePath, buffer);
  if (modifiedAt) {
    const t = new Date(modifiedAt);
    await fsp.utimes(result.filePath, t, t);
  }
  return { canceled: false, path: result.filePath };
});

ipcMain.handle('mini-drive:files:read', async (_e, { id }) => {
  const { buffer, name, modifiedAt } = await api.downloadFile(id);
  return { name, modifiedAt, dataB64: buffer.toString('base64') };
});

ipcMain.handle('mini-drive:files:delete', async (_e, { id }) => {
  await api.deleteFile(id);
  return { ok: true };
});

ipcMain.handle('mini-drive:files:prepare-drag', async (_e, { id, name }) => {
  const safe = name.replace(/[^\p{L}\p{N}._-]+/gu, '_');
  const target = path.join(dragCacheDir, `${id}-${safe}`);
  if (!fs.existsSync(target)) {
    const { buffer } = await api.downloadFile(id);
    await fsp.writeFile(target, buffer);
  }
  return { path: target };
});

ipcMain.on('mini-drive:files:start-drag', async (event, { path: filePath }) => {
  if (!filePath || !fs.existsSync(filePath)) return;
  const icon = nativeImage.createFromNamedImage?.('NSImageNameMultipleDocuments')
    || nativeImage.createEmpty();
  try {
    event.sender.startDrag({ file: filePath, icon });
  } catch (err) {
    console.error('startDrag failed', err);
  }
});

ipcMain.handle('mini-drive:sync:choose-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths?.[0]) return { canceled: true };
  writeConfig({ syncFolder: result.filePaths[0] });
  return { canceled: false, path: result.filePaths[0] };
});

ipcMain.handle('mini-drive:sync:start', async (_e, { folder }) => {
  const path = folder || readConfig().syncFolder;
  if (!path) throw new Error('Не обрано локальну папку для синхронізації');
  await ensureSync().start(path);
  writeConfig({ syncFolder: path });
  return { folder: path };
});

ipcMain.handle('mini-drive:sync:stop', async () => {
  if (sync) await sync.stop();
  return { ok: true };
});

ipcMain.handle('mini-drive:sync:now', async () => {
  const s = ensureSync();
  const cfg = readConfig();
  if (!s.localPath && cfg.syncFolder) {
    await s.start(cfg.syncFolder);
    return { triggered: 'started' };
  }
  await s.syncOnce();
  return { triggered: 'cycle' };
});

ipcMain.handle('mini-drive:open-dialog:file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
  });
  if (result.canceled) return { canceled: true };
  return { canceled: false, paths: result.filePaths };
});

ipcMain.handle('mini-drive:confirm-delete', async (_e, { name }) => {
  const res = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Скасувати', 'Видалити'],
    defaultId: 0,
    cancelId: 0,
    title: 'Видалити файл?',
    message: `Видалити файл «${name}»?`,
    detail: 'Цю дію не можна скасувати.',
  });
  return { confirmed: res.response === 1 };
});

async function apiFetch(serverUrl, path, body) {
  const res = await fetch(`${serverUrl.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}
