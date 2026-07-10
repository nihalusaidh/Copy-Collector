const { app, BrowserWindow, Tray, Menu, clipboard, ipcMain, screen, nativeImage, globalShortcut, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

// ---- Globals ----
let tray = null;
let popupWin = null;
let managerWin = null;
let lastClip = '';
let skipMonitor = false;

// ---- Storage ----
function getDataFile() {
  return path.join(app.getPath('userData'), 'collection.json');
}

function loadItems() {
  try {
    const f = getDataFile();
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf-8'));
  } catch(e) {}
  return [];
}

function saveItems(items) {
  try { fs.writeFileSync(getDataFile(), JSON.stringify(items, null, 2)); } catch(e) {}
}

// ---- History Storage ----
function getHistoryFile() {
  return path.join(app.getPath('userData'), 'history.json');
}

function loadHistory() {
  try {
    const f = getHistoryFile();
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf-8'));
  } catch(e) {}
  return [];
}

function saveHistory(history) {
  try { fs.writeFileSync(getHistoryFile(), JSON.stringify(history, null, 2)); } catch(e) {}
}

// ---- Clipboard Monitor ----
function startMonitor() {
  setInterval(() => {
    if (skipMonitor) { skipMonitor = false; return; }
    const text = clipboard.readText().trim();
    if (text && text !== lastClip && text.length > 2) {
      lastClip = text;
      showPopup(text);
    }
  }, 600);
}

function writeClipboard(text) {
  skipMonitor = true;
  clipboard.writeText(text);
}

// ---- Floating Popup ----
function showPopup(text) {
  closePopup();

  const cursor = screen.getCursorScreenPoint();
  const displays = screen.getAllDisplays();
  let bounds = { x: cursor.x, y: cursor.y, width: 1920, height: 1080 };
  for (const d of displays) {
    if (cursor.x >= d.bounds.x && cursor.x < d.bounds.x + d.bounds.width &&
        cursor.y >= d.bounds.y && cursor.y < d.bounds.y + d.bounds.height) {
      bounds = d.bounds;
      break;
    }
  }

  popupWin = new BrowserWindow({
    width: 35,
    height: 35,
    x: Math.min(cursor.x, bounds.x + bounds.width - 39),
    y: cursor.y + 15,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  popupWin.loadFile(path.join(__dirname, 'renderer', 'popup.html'));
  popupWin.once('ready-to-show', () => {
    popupWin.show();
    popupWin.webContents.send('show-text', text);
  });
  popupWin.on('closed', () => { popupWin = null; });
}

function closePopup() {
  if (popupWin && !popupWin.isDestroyed()) popupWin.close();
  popupWin = null;
}

// ---- Manager Window ----
function showManager() {
  if (managerWin && !managerWin.isDestroyed()) {
    managerWin.focus();
    return;
  }

  managerWin = new BrowserWindow({
    width: 500,
    height: 640,
    title: 'Copy Collector',
    resizable: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  managerWin.loadFile(path.join(__dirname, 'renderer', 'manager.html'));
  managerWin.on('closed', () => { managerWin = null; });
}

// ---- Tray Icon ----
function createTray() {
  const iconPath = path.join(__dirname, 'icons', 'tray-icon.png');
  let trayIcon = nativeImage.createFromPath(iconPath);
  if (trayIcon.isEmpty()) {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Copy Collector');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Collection', click: showManager },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('click', showManager);
  tray.on('right-click', showManager);
}

// ---- IPC Handlers ----
ipcMain.on('save-text', (event, text) => {
  const items = loadItems();
  items.push({
    id: Date.now(),
    text: text,
    timestamp: new Date().toISOString(),
    source: 'Desktop'
  });
  saveItems(items);
  event.reply('saved', { count: items.length });
  setTimeout(closePopup, 1000);
  try {
    new Notification({ title: 'Copy Collector', body: 'Saved! (' + items.length + ' items)', silent: true }).show();
  } catch(e) {}
});

ipcMain.on('skip-text', closePopup);

ipcMain.on('open-manager', showManager);

ipcMain.handle('get-collection', () => loadItems());

ipcMain.handle('remove-item', (event, id) => {
  let items = loadItems();
  items = items.filter(i => i.id !== id);
  saveItems(items);
  return items;
});

ipcMain.handle('update-item', (event, id, text) => {
  let items = loadItems();
  items = items.map(i => {
    if (i.id === id && text !== undefined) i.text = text;
    return i;
  });
  saveItems(items);
  return items;
});

ipcMain.handle('reorder-items', (event, ids) => {
  const items = loadItems();
  const idSet = new Set(ids);
  const moved = ids.map(id => items.find(i => i.id === id)).filter(Boolean);
  const rest = items.filter(i => !idSet.has(i.id));
  saveItems(moved.concat(rest));
  return moved.concat(rest);
});

ipcMain.handle('clear-collection', () => {
  saveItems([]);
  return [];
});

ipcMain.handle('paste-all', () => {
  const items = loadItems();
  const text = items.map(i => i.text).join('\n\n');
  if (text) writeClipboard(text);
  return { text, count: items.length };
});

ipcMain.on('set-launch-on-startup', (event, enable) => {
  app.setLoginItemSettings({ openAtLogin: enable });
});

ipcMain.handle('get-launch-on-startup', () => {
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle('complete-session', () => {
  const items = loadItems();
  if (!items.length) return { saved: false, reason: 'empty' };
  const history = loadHistory();
  history.unshift({
    id: Date.now(),
    date: new Date().toISOString(),
    items: items,
    count: items.length
  });
  saveHistory(history);
  saveItems([]);
  return { saved: true, count: items.length };
});

ipcMain.handle('get-history', () => {
  return loadHistory();
});

ipcMain.handle('delete-session', (event, sessionId) => {
  let history = loadHistory();
  history = history.filter(s => s.id !== sessionId);
  saveHistory(history);
  return history;
});

// ---- App Lifecycle ----
app.whenReady().then(() => {
  createTray();
  startMonitor();
  showManager();

  globalShortcut.register('CommandOrControl+Shift+C', showManager);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // Don't quit - keep running in system tray
});

app.on('before-quit', () => {
  if (tray) tray.destroy();
});
