const { app, BrowserWindow, ipcMain, Menu, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const ASSETS_DIR = path.join(__dirname, 'assets');
const IMAGE_DIR = path.join(ASSETS_DIR, 'images');
const AUDIO_DIR = path.join(ASSETS_DIR, 'audio');

const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
const AUDIO_EXT = ['.mp3', '.wav', '.ogg', '.m4a', '.aac'];

let win;

function scanDir(dir, exts) {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => exts.includes(path.extname(f).toLowerCase()))
      .map((f) => ({
        name: path.basename(f, path.extname(f)),
        url: 'file://' + encodeURI(path.join(dir, f).split(path.sep).join('/')),
      }));
  } catch (e) {
    return [];
  }
}

function scanAssets() {
  return {
    images: scanDir(IMAGE_DIR, IMAGE_EXT),
    audio: scanDir(AUDIO_DIR, AUDIO_EXT),
  };
}

function createWindow() {
  win = new BrowserWindow({
    width: 260,
    height: 320,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    hasShadow: false,
    skipTaskbar: true,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

ipcMain.handle('get-assets', () => scanAssets());
ipcMain.handle('get-window-pos', () => win.getPosition());
ipcMain.on('set-window-pos', (e, x, y) => {
  win.setPosition(Math.round(x), Math.round(y));
});

ipcMain.on('show-context-menu', () => {
  const menu = Menu.buildFromTemplate([
    { label: '重新加载素材', click: () => win.webContents.send('reload-assets') },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]);
  menu.popup({ window: win });
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
