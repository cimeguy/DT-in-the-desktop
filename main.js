const { app, BrowserWindow, ipcMain, Menu, screen, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const BUNDLED_ASSETS_DIR = path.join(__dirname, 'assets');
const BUNDLED_IMAGE_DIR = path.join(BUNDLED_ASSETS_DIR, 'images');
const BUNDLED_AUDIO_DIR = path.join(BUNDLED_ASSETS_DIR, 'audio');

const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
const AUDIO_EXT = ['.mp3', '.wav', '.ogg', '.m4a', '.aac'];

const BASE_W = 260;
const BASE_H = 320;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;

let win;
let managerWin = null;

// ---------- 配置(用户自选素材目录) ----------
function configPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function defaultUserDir() {
  return path.join(app.getPath('userData'), 'assets');
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf8'));
  } catch (e) {
    return {};
  }
}

function saveConfig(cfg) {
  fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2));
}

function getUserDir() {
  const cfg = loadConfig();
  return cfg.userAssetsDir || defaultUserDir();
}

function setUserDir(dir) {
  const cfg = loadConfig();
  cfg.userAssetsDir = dir;
  saveConfig(cfg);
  ensureUserDirs();
}

function getScale() {
  const cfg = loadConfig();
  const s = Number(cfg.scale);
  if (!s || Number.isNaN(s)) return 1;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

function applyScale(scale) {
  const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(scale) || 1));
  const cfg = loadConfig();
  cfg.scale = s;
  saveConfig(cfg);
  if (win && !win.isDestroyed()) {
    win.setSize(Math.round(BASE_W * s), Math.round(BASE_H * s));
    win.webContents.send('set-scale', s);
  }
  return s;
}

function ensureUserDirs() {
  const base = getUserDir();
  fs.mkdirSync(path.join(base, 'images'), { recursive: true });
  fs.mkdirSync(path.join(base, 'audio'), { recursive: true });
}

// ---------- 素材扫描(自带 + 用户目录合并) ----------
function scanDir(dir, exts) {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => exts.includes(path.extname(f).toLowerCase()))
      .map((f) => ({
        name: path.basename(f, path.extname(f)),
        path: path.join(dir, f),
        url: 'file://' + encodeURI(path.join(dir, f).split(path.sep).join('/')),
      }));
  } catch (e) {
    return [];
  }
}

function scanAssets() {
  const userDir = getUserDir();
  return {
    images: [
      ...scanDir(BUNDLED_IMAGE_DIR, IMAGE_EXT),
      ...scanDir(path.join(userDir, 'images'), IMAGE_EXT),
    ],
    audio: [
      ...scanDir(BUNDLED_AUDIO_DIR, AUDIO_EXT),
      ...scanDir(path.join(userDir, 'audio'), AUDIO_EXT),
    ],
  };
}

function sanitizeName(name) {
  return String(name)
    .replace(/[\/\\:*?"<>|\n\r\t]/g, '_')
    .replace(/^\.+/, '_')
    .trim()
    .slice(0, 120) || 'clip';
}

// GUI 启动不继承 shell PATH,按常见安装位置查找命令行工具
function findBin(name) {
  const candidates = [
    `/opt/homebrew/bin/${name}`,
    `/usr/local/bin/${name}`,
    `/usr/bin/${name}`,
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return name; // 兜底走 PATH
}

function runCmd(bin, args) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(String(stderr || err.message || '').trim()));
      else resolve(stdout);
    });
  });
}

// 复制文件进用户目录,重名自动加序号
function importFile(srcPath, destDir, baseName, ext) {
  fs.mkdirSync(destDir, { recursive: true });
  let candidate = path.join(destDir, baseName + ext);
  let i = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(destDir, `${baseName} (${i})${ext}`);
    i += 1;
  }
  fs.copyFileSync(srcPath, candidate);
  return candidate;
}

function createWindow() {
  const s = getScale();
  win = new BrowserWindow({
    width: Math.round(BASE_W * s),
    height: Math.round(BASE_H * s),
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

function openManager() {
  if (managerWin && !managerWin.isDestroyed()) {
    managerWin.focus();
    return;
  }
  managerWin = new BrowserWindow({
    width: 820,
    height: 720,
    minWidth: 560,
    title: '管理素材',
    resizable: true,
    minimizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  managerWin.loadFile(path.join(__dirname, 'renderer', 'manager.html'));
  managerWin.on('closed', () => {
    managerWin = null;
  });
}

// ---------- IPC ----------
ipcMain.handle('get-assets', () => scanAssets());
ipcMain.handle('get-window-pos', () => win.getPosition());
ipcMain.on('set-window-pos', (e, x, y) => {
  win.setPosition(Math.round(x), Math.round(y));
});

ipcMain.handle('get-user-dir', () => getUserDir());

ipcMain.handle('get-scale', () => getScale());
ipcMain.on('zoom-pet', (e, delta) => {
  applyScale(getScale() + Number(delta || 0));
});
ipcMain.on('set-pet-scale', (e, scale) => {
  applyScale(scale);
});

ipcMain.handle('choose-user-dir', async () => {
  const r = await dialog.showOpenDialog(managerWin || win, {
    title: '选择素材保存目录',
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: getUserDir(),
  });
  if (r.canceled || !r.filePaths[0]) return getUserDir();
  setUserDir(r.filePaths[0]);
  return getUserDir();
});

ipcMain.handle('add-audio', (e, { srcPath, caption, ext }) => {
  if (!srcPath) return { ok: false, error: '没有音频文件' };
  const base = sanitizeName(caption || path.basename(srcPath, ext));
  const dest = importFile(srcPath, path.join(getUserDir(), 'audio'), base, ext || '.mp3');
  if (win && !win.isDestroyed()) win.webContents.send('reload-assets');
  return { ok: true, file: path.basename(dest) };
});

// 从在线链接(B站/YouTube 等)下载音频,按起止时间切出一段 mp3 入库
ipcMain.handle('add-audio-from-url', async (e, { url, start, end, caption }) => {
  url = String(url || '').trim();
  start = String(start || '').trim();
  end = String(end || '').trim();
  if (!url) return { ok: false, error: '请填写链接' };
  if (!start || !end) return { ok: false, error: '请填写起点和终点时间' };

  const ytdlp = findBin('yt-dlp');
  const ffmpeg = findBin('ffmpeg');
  if (!fs.existsSync(ytdlp)) return { ok: false, error: '未找到 yt-dlp,请先安装:brew install yt-dlp' };
  if (!fs.existsSync(ffmpeg)) return { ok: false, error: '未找到 ffmpeg,请先安装:brew install ffmpeg' };

  const stamp = Date.now();
  const dlBase = path.join(app.getPath('temp'), `dl_${stamp}`);
  const cutOut = path.join(app.getPath('temp'), `clip_${stamp}.mp3`);

  const cleanup = () => {
    try {
      for (const f of fs.readdirSync(app.getPath('temp'))) {
        if (f.startsWith(`dl_${stamp}`) || f === `clip_${stamp}.mp3`) {
          fs.unlink(path.join(app.getPath('temp'), f), () => {});
        }
      }
    } catch (_) {}
  };

  try {
    await runCmd(ytdlp, [
      '-x', '--audio-format', 'mp3', '--no-playlist',
      '-o', `${dlBase}.%(ext)s`, url,
    ]);
    let dlOut = `${dlBase}.mp3`;
    if (!fs.existsSync(dlOut)) {
      const hit = fs
        .readdirSync(app.getPath('temp'))
        .find((f) => f.startsWith(`dl_${stamp}`));
      if (!hit) throw new Error('下载失败,未生成音频文件');
      dlOut = path.join(app.getPath('temp'), hit);
    }

    await runCmd(ffmpeg, [
      '-nostdin', '-y', '-i', dlOut,
      '-ss', start, '-to', end,
      '-c:a', 'libmp3lame', '-q:a', '3', cutOut,
    ]);
    if (!fs.existsSync(cutOut) || fs.statSync(cutOut).size === 0) {
      throw new Error('切片失败,请检查时间格式(如 1:23 或 83)');
    }

    const base = sanitizeName(caption || `clip_${stamp}`);
    const dest = importFile(cutOut, path.join(getUserDir(), 'audio'), base, '.mp3');
    if (win && !win.isDestroyed()) win.webContents.send('reload-assets');
    return { ok: true, file: path.basename(dest) };
  } catch (err) {
    return { ok: false, error: String(err.message || err).slice(0, 300) };
  } finally {
    cleanup();
  }
});

ipcMain.handle('add-image', (e, { srcPath, name, ext }) => {
  if (!srcPath) return { ok: false, error: '没有图片文件' };
  const base = sanitizeName(name || path.basename(srcPath, ext));
  const dest = importFile(srcPath, path.join(getUserDir(), 'images'), base, ext || '.png');
  const url = 'file://' + encodeURI(dest.split(path.sep).join('/'));
  if (win && !win.isDestroyed()) win.webContents.send('reload-assets', url);
  return { ok: true, file: path.basename(dest) };
});

const CUTOUT_BIN = path.join(__dirname, 'tools', 'cutout_person');

ipcMain.handle('add-image-cutout', (e, { srcPath, name }) => {
  if (!srcPath) return { ok: false, error: '没有图片文件' };
  if (!fs.existsSync(CUTOUT_BIN)) {
    return {
      ok: false,
      error: '抠图工具未编译,请先运行: swiftc tools/cutout_person.swift -o tools/cutout_person',
    };
  }
  const tmpOut = path.join(app.getPath('temp'), `cutout_${Date.now()}.png`);
  return new Promise((resolve) => {
    execFile(CUTOUT_BIN, [srcPath, tmpOut], (err, stdout, stderr) => {
      if (err) {
        resolve({ ok: false, error: (stderr || err.message || '抠图失败').trim() });
        return;
      }
      try {
        const base = sanitizeName(name || path.basename(srcPath, path.extname(srcPath)));
        const dest = importFile(tmpOut, path.join(getUserDir(), 'images'), base, '.png');
        fs.unlink(tmpOut, () => {});
        const url = 'file://' + encodeURI(dest.split(path.sep).join('/'));
        if (win && !win.isDestroyed()) win.webContents.send('reload-assets', url);
        resolve({ ok: true, file: path.basename(dest) });
      } catch (e2) {
        resolve({ ok: false, error: String(e2) });
      }
    });
  });
});

ipcMain.on('open-manager', () => openManager());

ipcMain.on('open-user-dir', () => {
  ensureUserDirs();
  shell.openPath(getUserDir());
});

ipcMain.on('reload-pet', () => {
  if (win && !win.isDestroyed()) win.webContents.send('reload-assets');
});

ipcMain.handle('delete-asset', (e, filePath) => {
  try {
    const resolved = path.resolve(filePath);
    const roots = [BUNDLED_ASSETS_DIR, getUserDir()].map((r) => path.resolve(r) + path.sep);
    if (!roots.some((r) => resolved.startsWith(r))) {
      return { ok: false, error: '不允许删除该位置的文件' };
    }
    fs.unlinkSync(resolved);
    if (win && !win.isDestroyed()) win.webContents.send('reload-assets');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.on('show-context-menu', () => {
  const menu = Menu.buildFromTemplate([
    { label: '管理素材…', click: () => openManager() },
    { label: '重新加载素材', click: () => win.webContents.send('reload-assets') },
    { type: 'separator' },
    { label: '放大', click: () => applyScale(getScale() + 0.2) },
    { label: '缩小', click: () => applyScale(getScale() - 0.2) },
    { label: '重置大小', click: () => applyScale(1) },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]);
  menu.popup({ window: win });
});

app.whenReady().then(() => {
  ensureUserDirs();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
