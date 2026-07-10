const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Popup events (from main)
  onShowText: (callback) => {
    ipcRenderer.on('show-text', (event, text) => callback(text));
  },
  onSaved: (callback) => {
    ipcRenderer.on('saved', (event, data) => callback(data));
  },

  // Popup actions (to main)
  saveText: (text) => ipcRenderer.send('save-text', text),
  skipText: () => ipcRenderer.send('skip-text'),
  openManager: () => ipcRenderer.send('open-manager'),

  // Manager actions (to main)
  getCollection: () => ipcRenderer.invoke('get-collection'),
  removeItem: (id) => ipcRenderer.invoke('remove-item', id),
  updateItem: (id, text) => ipcRenderer.invoke('update-item', id, text),
  reorderItems: (ids) => ipcRenderer.invoke('reorder-items', ids),
  clearCollection: () => ipcRenderer.invoke('clear-collection'),
  pasteAll: () => ipcRenderer.invoke('paste-all'),
  setLaunchOnStartup: (enable) => ipcRenderer.send('set-launch-on-startup', enable),
  getLaunchOnStartup: () => ipcRenderer.invoke('get-launch-on-startup'),
  completeSession: () => ipcRenderer.invoke('complete-session'),
  getHistory: () => ipcRenderer.invoke('get-history'),
  deleteSession: (id) => ipcRenderer.invoke('delete-session', id),
});
