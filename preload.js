const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  getAssets: () => ipcRenderer.invoke('get-assets'),
  getWindowPos: () => ipcRenderer.invoke('get-window-pos'),
  setWindowPos: (x, y) => ipcRenderer.send('set-window-pos', x, y),
  showContextMenu: () => ipcRenderer.send('show-context-menu'),
  onReloadAssets: (cb) => ipcRenderer.on('reload-assets', cb),
  openManager: () => ipcRenderer.send('open-manager'),
  getScale: () => ipcRenderer.invoke('get-scale'),
  zoomPet: (delta) => ipcRenderer.send('zoom-pet', delta),
  onSetScale: (cb) => ipcRenderer.on('set-scale', cb),
});

contextBridge.exposeInMainWorld('managerAPI', {
  getUserDir: () => ipcRenderer.invoke('get-user-dir'),
  chooseUserDir: () => ipcRenderer.invoke('choose-user-dir'),
  openUserDir: () => ipcRenderer.send('open-user-dir'),
  listAssets: () => ipcRenderer.invoke('get-assets'),
  addAudio: (payload) => ipcRenderer.invoke('add-audio', payload),
  addAudioFromUrl: (payload) => ipcRenderer.invoke('add-audio-from-url', payload),
  addImage: (payload) => ipcRenderer.invoke('add-image', payload),
  addImageCutout: (payload) => ipcRenderer.invoke('add-image-cutout', payload),
  deleteAsset: (filePath) => ipcRenderer.invoke('delete-asset', filePath),
  pathForFile: (file) => webUtils.getPathForFile(file),
  reloadPet: () => ipcRenderer.send('reload-pet'),
});
