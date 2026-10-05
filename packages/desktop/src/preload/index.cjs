const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, payload) => ipcRenderer.invoke(channel, payload);

contextBridge.exposeInMainWorld('miniDrive', {
  config: {
    get: () => invoke('mini-drive:config:get'),
    set: (patch) => invoke('mini-drive:config:set', patch),
  },
  auth: {
    login: (payload) => invoke('mini-drive:auth:login', payload),
    register: (payload) => invoke('mini-drive:auth:register', payload),
    logout: () => invoke('mini-drive:auth:logout'),
  },
  files: {
    list: () => invoke('mini-drive:files:list'),
    upload: (payload) => invoke('mini-drive:files:upload', payload),
    downloadToDialog: (payload) => invoke('mini-drive:files:download-to-dialog', payload),
    read: (payload) => invoke('mini-drive:files:read', payload),
    delete: (payload) => invoke('mini-drive:files:delete', payload),
    prepareDrag: (payload) => invoke('mini-drive:files:prepare-drag', payload),
    startDrag: (payload) => ipcRenderer.send('mini-drive:files:start-drag', payload),
  },
  sync: {
    chooseFolder: () => invoke('mini-drive:sync:choose-folder'),
    start: (payload) => invoke('mini-drive:sync:start', payload),
    stop: () => invoke('mini-drive:sync:stop'),
    now: () => invoke('mini-drive:sync:now'),
    onEvent: (cb) => {
      const handler = (_event, data) => cb(data);
      ipcRenderer.on('mini-drive:sync:event', handler);
      return () => ipcRenderer.removeListener('mini-drive:sync:event', handler);
    },
  },
  dialog: {
    openFile: () => invoke('mini-drive:open-dialog:file'),
    confirmDelete: (payload) => invoke('mini-drive:confirm-delete', payload),
  },
});
