const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  getAssets: () => ipcRenderer.invoke('get-assets'),
  getWindowPos: () => ipcRenderer.invoke('get-window-pos'),
  setWindowPos: (x, y) => ipcRenderer.send('set-window-pos', x, y),
  showContextMenu: () => ipcRenderer.send('show-context-menu'),
  onReloadAssets: (cb) => ipcRenderer.on('reload-assets', cb),
});
