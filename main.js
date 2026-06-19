const { app, BrowserWindow, ipcMain, Menu, screen, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile, spawn } = require('child_process');

// 素材根目录 = app 路径下的 assets(开发时为项目目录,打包后为 .app 包内 Resources/app)
const BUNDLED_ASSETS_DIR = path.join(app.getAppPath(), 'assets');
const BUNDLED_IMAGE_DIR = path.join(BUNDLED_ASSETS_DIR, 'images');
const BUNDLED_AUDIO_DIR = path.join(BUNDLED_ASSETS_DIR, 'audio');

const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
const AUDIO_EXT = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.opus', '.webm', '.flac'];

const BASE_W = 260;
const BASE_H = 320;
// 环形菜单展开时窗口临时放大用
let radialOpen = false;
let savedBounds = null;
const MENU_SIZE = 380;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;

let win;
let managerWin = null;

// ---------- 配置(用户自选素材目录) ----------
function configPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function defaultUserDir() {
  // 默认素材目录 = app 数据目录下的 assets(~/Library/Application Support/<app>/assets),打包后可读写
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

// 原始音频下载目录(与素材目录分开,可单独配置)
function defaultDownloadDir() {
  return path.join(BUNDLED_ASSETS_DIR, 'download_audio');
}

function getDownloadDir() {
  const cfg = loadConfig();
  return cfg.downloadAudioDir || defaultDownloadDir();
}

function setDownloadDir(dir) {
  const cfg = loadConfig();
  cfg.downloadAudioDir = dir;
  saveConfig(cfg);
  fs.mkdirSync(getDownloadDir(), { recursive: true });
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
    if (radialOpen && savedBounds) {
      // 环形菜单展开期间窗口被临时放大,不改当前尺寸;
      // 只更新"恢复后"的目标尺寸(以中心为锚),关菜单时按新缩放还原
      const nw = Math.round(BASE_W * s);
      const nh = Math.round(BASE_H * s);
      const cx = savedBounds.x + savedBounds.width / 2;
      const cy = savedBounds.y + savedBounds.height / 2;
      savedBounds = { x: Math.round(cx - nw / 2), y: Math.round(cy - nh / 2), width: nw, height: nh };
    } else {
      win.setSize(Math.round(BASE_W * s), Math.round(BASE_H * s));
    }
    win.webContents.send('set-scale', s);
  }
  return s;
}

function getDefaultScale() {
  const cfg = loadConfig();
  const s = Number(cfg.defaultScale);
  if (!s || Number.isNaN(s)) return 1;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

function setDefaultScale(scale) {
  const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(scale) || 1));
  const cfg = loadConfig();
  cfg.defaultScale = s;
  saveConfig(cfg);
  return s;
}

function getMuted() {
  return !!loadConfig().muted;
}

const PLAY_MODES = ['random', 'list', 'single'];
function getPlayMode() {
  const m = loadConfig().playMode;
  return PLAY_MODES.includes(m) ? m : 'random';
}

function setPlayMode(mode) {
  const m = PLAY_MODES.includes(mode) ? mode : 'random';
  const cfg = loadConfig();
  cfg.playMode = m;
  saveConfig(cfg);
  if (win && !win.isDestroyed()) win.webContents.send('set-play-mode', m);
  return m;
}

function getAutoLaunch() {
  try { return !!app.getLoginItemSettings().openAtLogin; } catch (_) { return false; }
}

function setAutoLaunch(on) {
  try { app.setLoginItemSettings({ openAtLogin: !!on }); } catch (_) {}
  return getAutoLaunch();
}

function getRememberPos() {
  return !!loadConfig().rememberPos;
}

function setRememberPos(on) {
  const cfg = loadConfig();
  cfg.rememberPos = !!on;
  if (cfg.rememberPos && win && !win.isDestroyed()) {
    const [px, py] = win.getPosition();
    cfg.posX = px;
    cfg.posY = py;
  }
  saveConfig(cfg);
  return cfg.rememberPos;
}

let posSaveTimer = null;
function maybeSavePos(x, y) {
  if (!getRememberPos()) return;
  clearTimeout(posSaveTimer);
  posSaveTimer = setTimeout(() => {
    const cfg = loadConfig();
    cfg.posX = Math.round(x);
    cfg.posY = Math.round(y);
    saveConfig(cfg);
  }, 400);
}

function setMuted(m) {
  const cfg = loadConfig();
  cfg.muted = !!m;
  saveConfig(cfg);
  if (win && !win.isDestroyed()) win.webContents.send('set-muted', cfg.muted);
  return cfg.muted;
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

function getClipMap() {
  const m = loadConfig().imageAudioMap;
  return (m && typeof m === 'object') ? m : {};
}

function getAudioVolumes() {
  const v = loadConfig().audioVolumes;
  return (v && typeof v === 'object') ? v : {};
}

function getHiddenImages() {
  const h = loadConfig().hiddenImages;
  return Array.isArray(h) ? h : [];
}

// 清理失效引用:删除/改名素材后,config 里残留的映射会让徽章计数虚高、
// 图片配音指向不存在的音频。这里按当前实际文件名对齐,并持久化清理结果。
function reconcileConfig(imageNames, audioNames) {
  const cfg = loadConfig();
  let changed = false;

  const rawMap = (cfg.imageAudioMap && typeof cfg.imageAudioMap === 'object') ? cfg.imageAudioMap : {};
  const map = {};
  for (const img of Object.keys(rawMap)) {
    if (!imageNames.has(img)) { changed = true; continue; } // 图片已删
    const kept = (Array.isArray(rawMap[img]) ? rawMap[img] : []).filter((n) => audioNames.has(n));
    if (kept.length !== (rawMap[img] || []).length) changed = true;
    if (kept.length) map[img] = kept; // 空数组不保留(=随机全部)
    else if (rawMap[img] && rawMap[img].length) changed = true;
  }

  const rawVols = (cfg.audioVolumes && typeof cfg.audioVolumes === 'object') ? cfg.audioVolumes : {};
  const volumes = {};
  for (const n of Object.keys(rawVols)) {
    if (audioNames.has(n)) volumes[n] = rawVols[n];
    else changed = true;
  }

  const rawHidden = Array.isArray(cfg.hiddenImages) ? cfg.hiddenImages : [];
  const hidden = rawHidden.filter((n) => imageNames.has(n));
  if (hidden.length !== rawHidden.length) changed = true;

  if (changed) {
    cfg.imageAudioMap = map;
    cfg.audioVolumes = volumes;
    cfg.hiddenImages = hidden;
    saveConfig(cfg);
  }
  return { map, volumes, hidden };
}

function scanAssets() {
  const userDir = getUserDir();
  const images = [
    ...scanDir(BUNDLED_IMAGE_DIR, IMAGE_EXT),
    ...scanDir(path.join(userDir, 'images'), IMAGE_EXT),
  ];
  const audio = [
    ...scanDir(BUNDLED_AUDIO_DIR, AUDIO_EXT),
    ...scanDir(path.join(userDir, 'audio'), AUDIO_EXT),
  ];
  const imageNames = new Set(images.map((i) => i.name));
  const audioNames = new Set(audio.map((a) => a.name));
  const { map, volumes, hidden } = reconcileConfig(imageNames, audioNames);
  return {
    images,
    audio,
    map,
    volumes,
    hidden,
    playMode: getPlayMode(),
  };
}

function sanitizeName(name) {
  return String(name)
    .replace(/[\/\\:*?"<>|\n\r\t]/g, '_')
    .replace(/^\.+/, '_')
    .trim()
    .slice(0, 120) || 'clip';
}

// 音频编码 → 合适的容器后缀(用于流拷贝抽取,保持浏览器可播放)
function codecToExt(codec) {
  const m = {
    aac: '.m4a', alac: '.m4a',
    mp3: '.mp3',
    opus: '.opus',
    vorbis: '.ogg',
    flac: '.flac',
    pcm_s16le: '.wav', pcm_s16be: '.wav', pcm_f32le: '.wav',
  };
  return m[String(codec || '').toLowerCase()] || '';
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

// 正在运行的下载/转码子进程,供"停止"功能强杀
const activeChildren = new Set();
let clipCancelled = false;

function runCmd(bin, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(bin, args, { maxBuffer: 64 * 1024 * 1024, detached: true, ...opts }, (err, stdout, stderr) => {
      activeChildren.delete(child);
      if (err) reject(new Error(String(stderr || err.message || '').trim()));
      else resolve(stdout);
    });
    activeChildren.add(child);
  });
}

// 流式执行,边跑边解析输出里的百分比进度(yt-dlp/you-get/ffmpeg 都会打印 xx.x%)
function runCmdProgress(bin, args, opts = {}, onPercent) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { detached: true, ...opts });
    activeChildren.add(child);
    let out = '';
    let err = '';
    let last = -1;
    const scan = (chunk) => {
      const s = String(chunk);
      const matches = s.match(/(\d{1,3}(?:\.\d+)?)%/g);
      if (matches && matches.length && onPercent) {
        const pct = parseFloat(matches[matches.length - 1]);
        const rounded = Math.round(pct);
        if (!Number.isNaN(rounded) && rounded !== last) {
          last = rounded;
          onPercent(rounded);
        }
      }
    };
    if (child.stdout) child.stdout.on('data', (d) => { out += d; scan(d); });
    if (child.stderr) child.stderr.on('data', (d) => { err += d; scan(d); });
    child.on('error', (e) => { activeChildren.delete(child); reject(e); });
    child.on('close', (code) => {
      activeChildren.delete(child);
      if (code === 0) resolve(out);
      else reject(new Error(String(err || out || `exit ${code}`).trim()));
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

// ---------- 在线下载缓存(同一链接已下过则复用全曲,不重复下载) ----------
function dlIndexPath() {
  return path.join(getDownloadDir(), '.cache.json');
}

// 把链接归一化成缓存键:去掉 spm_id_from 等跟踪参数,保留站点路径(含 BV 号)与分P
function urlCacheKey(u) {
  try {
    const x = new URL(String(u));
    const p = x.searchParams.get('p') || '';
    return (x.host + x.pathname).replace(/\/+$/, '') + (p ? `?p=${p}` : '');
  } catch (_) {
    return String(u).trim();
  }
}
function loadDlIndex() {
  try {
    return JSON.parse(fs.readFileSync(dlIndexPath(), 'utf8')) || {};
  } catch (_) {
    return {};
  }
}
function saveDlIndex(idx) {
  try {
    fs.mkdirSync(getDownloadDir(), { recursive: true });
    fs.writeFileSync(dlIndexPath(), JSON.stringify(idx, null, 2));
  } catch (_) {}
}

function createWindow() {
  const s = getScale();
  const w = Math.round(BASE_W * s);
  const h = Math.round(BASE_H * s);
  // 启动时定位:开启"记住位置"且有保存值则用它,否则放主屏右下角
  const wa = screen.getPrimaryDisplay().workArea;
  const margin = 12;
  const cfg = loadConfig();
  let x, y;
  if (cfg.rememberPos && Number.isFinite(cfg.posX) && Number.isFinite(cfg.posY)) {
    x = cfg.posX;
    y = cfg.posY;
  } else {
    x = wa.x + wa.width - w - margin;
    y = wa.y + wa.height - h - margin;
  }
  win = new BrowserWindow({
    width: w,
    height: h,
    x,
    y,
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
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 14, y: 13 },
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
ipcMain.handle('get-clip-map', () => getClipMap());
ipcMain.handle('set-clip-map', (e, map) => {
  const cfg = loadConfig();
  // 只保留有勾选的图,清掉空数组,避免 config 越积越大
  const clean = {};
  if (map && typeof map === 'object') {
    for (const k of Object.keys(map)) {
      if (Array.isArray(map[k]) && map[k].length) clean[k] = map[k];
    }
  }
  cfg.imageAudioMap = clean;
  saveConfig(cfg);
  if (win && !win.isDestroyed()) win.webContents.send('clip-map', clean);
  return { ok: true };
});
// 逐条音频音量(0~1),按音频名保存;0 时清掉记录(=默认 1)
ipcMain.handle('set-audio-volume', (e, { name, volume }) => {
  const cfg = loadConfig();
  const vols = (cfg.audioVolumes && typeof cfg.audioVolumes === 'object') ? cfg.audioVolumes : {};
  const v = Math.min(1, Math.max(0, Number(volume)));
  if (Number.isNaN(v)) return { ok: false };
  vols[name] = v;
  cfg.audioVolumes = vols;
  saveConfig(cfg);
  if (win && !win.isDestroyed()) win.webContents.send('audio-volumes', vols);
  return { ok: true };
});
// 图片「不显示」开关:隐藏的图不会被宠物选中,但仍留在素材库
ipcMain.handle('set-image-hidden', (e, { name, hidden }) => {
  const cfg = loadConfig();
  const set = new Set(getHiddenImages());
  if (hidden) set.add(name);
  else set.delete(name);
  cfg.hiddenImages = Array.from(set);
  saveConfig(cfg);
  if (win && !win.isDestroyed()) win.webContents.send('hidden-images', cfg.hiddenImages);
  return { ok: true };
});
ipcMain.handle('get-window-pos', () => win.getPosition());
ipcMain.on('set-window-pos', (e, x, y) => {
  win.setPosition(Math.round(x), Math.round(y));
  maybeSavePos(x, y);
});

ipcMain.handle('get-user-dir', () => getUserDir());
ipcMain.handle('get-download-dir', () => getDownloadDir());

ipcMain.handle('choose-download-dir', async () => {
  const r = await dialog.showOpenDialog(managerWin || win, {
    title: '选择原始音频下载目录',
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: getDownloadDir(),
  });
  if (r.canceled || !r.filePaths[0]) return getDownloadDir();
  setDownloadDir(r.filePaths[0]);
  return getDownloadDir();
});

ipcMain.handle('get-scale', () => getScale());
ipcMain.handle('get-muted', () => getMuted());
ipcMain.on('zoom-pet', (e, delta) => {
  applyScale(getScale() + Number(delta || 0));
});
ipcMain.on('set-pet-scale', (e, scale) => {
  applyScale(scale);
});

// ---- 环形右键菜单 ----
ipcMain.handle('get-menu-state', () => ({
  muted: getMuted(),
  autoLaunch: getAutoLaunch(),
  rememberPos: getRememberPos(),
  playMode: getPlayMode(),
}));
ipcMain.handle('toggle-mute', () => setMuted(!getMuted()));
ipcMain.handle('set-play-mode', (e, mode) => setPlayMode(mode));
ipcMain.handle('toggle-auto-launch', () => setAutoLaunch(!getAutoLaunch()));
ipcMain.handle('toggle-remember-pos', () => setRememberPos(!getRememberPos()));
ipcMain.on('reset-size', () => applyScale(getDefaultScale()));
ipcMain.on('set-default-size', () => setDefaultScale(getScale()));
ipcMain.on('quit-app', () => app.quit());

ipcMain.on('open-radial', () => {
  if (!win || win.isDestroyed() || radialOpen) return;
  savedBounds = win.getBounds();
  const cx = savedBounds.x + savedBounds.width / 2;
  const cy = savedBounds.y + savedBounds.height / 2;
  radialOpen = true;
  win.setBounds({
    x: Math.round(cx - MENU_SIZE / 2),
    y: Math.round(cy - MENU_SIZE / 2),
    width: MENU_SIZE,
    height: MENU_SIZE,
  });
});

ipcMain.on('close-radial', () => {
  if (!radialOpen) return;
  radialOpen = false;
  if (win && !win.isDestroyed() && savedBounds) win.setBounds(savedBounds);
  savedBounds = null;
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

ipcMain.handle('reset-user-dir', () => {
  const cfg = loadConfig();
  delete cfg.userAssetsDir;
  saveConfig(cfg);
  ensureUserDirs();
  return getUserDir();
});

ipcMain.handle('reset-download-dir', () => {
  const cfg = loadConfig();
  delete cfg.downloadAudioDir;
  saveConfig(cfg);
  fs.mkdirSync(getDownloadDir(), { recursive: true });
  return getDownloadDir();
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
  const progress = (msg) => {
    try { e.sender.send('clip-progress', msg); } catch (_) {}
  };
  url = String(url || '').trim();
  start = String(start || '').trim();
  end = String(end || '').trim();
  if (!url) return { ok: false, error: '请填写链接' };
  clipCancelled = false;

  const DOWNLOAD_AUDIO_DIR = getDownloadDir();
  const ytdlp = findBin('yt-dlp');
  const youget = findBin('you-get');
  const ffmpeg = findBin('ffmpeg');
  const ffprobe = findBin('ffprobe');
  if (!fs.existsSync(ffmpeg)) return { ok: false, error: '未找到 ffmpeg,请先安装:brew install ffmpeg' };
  const hasYtdlp = fs.existsSync(ytdlp);
  const hasYouget = fs.existsSync(youget);
  if (!hasYtdlp && !hasYouget) {
    return { ok: false, error: '未找到下载工具,请安装:brew install yt-dlp 或 pip3 install you-get' };
  }

  const tmp = app.getPath('temp');
  const stamp = Date.now();
  const dlBase = path.join(tmp, `dl_${stamp}`);
  let keepClip = false; // 预览待确认时保留切片临时文件,不在 finally 里删
  // GUI 启动不继承终端 PATH,补上常用目录让 you-get 能找到 ffmpeg
  const runOpts = {
    env: {
      ...process.env,
      PATH: [path.dirname(ffmpeg), path.dirname(youget), process.env.PATH || '']
        .filter(Boolean).join(':'),
    },
  };

  const cleanup = () => {
    try {
      for (const f of fs.readdirSync(tmp)) {
        if (f.startsWith(`dl_${stamp}`) || f.startsWith(`audio_${stamp}`) ||
            (!keepClip && f.startsWith(`clip_${stamp}`))) {
          fs.unlink(path.join(tmp, f), () => {});
        }
      }
    } catch (_) {}
  };

  // 在临时目录里找下载产物(排除弹幕/字幕等非媒体文件)
  const MEDIA_EXT = ['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.opus', '.mp4', '.flv', '.mkv', '.webm', '.ts'];
  const findDownloaded = () => {
    try {
      const hit = fs.readdirSync(tmp)
        .filter((f) => f.startsWith(`dl_${stamp}`) && MEDIA_EXT.includes(path.extname(f).toLowerCase()))
        .sort((a, b) => fs.statSync(path.join(tmp, b)).size - fs.statSync(path.join(tmp, a)).size);
      return hit[0] ? path.join(tmp, hit[0]) : '';
    } catch (_) { return ''; }
  };

  // 取视频标题(用于命名):B 站用 you-get(yt-dlp 会 412),其它站点优先 yt-dlp
  const fetchTitle = async () => {
    const isBiliUrl = /(^|\.)bilibili\.com|b23\.tv/i.test(url);
    const byYtdlp = async () => {
      const t = await runCmd(ytdlp, ['--no-playlist', '--skip-download', '--print', '%(title)s', url], runOpts);
      const line = String(t).split('\n').map((s) => s.trim()).filter(Boolean)[0];
      return line || '';
    };
    const byYouget = async () => {
      const o = JSON.parse(await runCmd(youget, ['--json', url], runOpts));
      return o && o.title ? String(o.title) : '';
    };
    const order = isBiliUrl
      ? [['youget', hasYouget, byYouget], ['ytdlp', hasYtdlp, byYtdlp]]
      : [['ytdlp', hasYtdlp, byYtdlp], ['youget', hasYouget, byYouget]];
    for (const [, ok, fn] of order) {
      if (!ok || clipCancelled) continue;
      try {
        const t = await fn();
        if (t) return t;
      } catch (_) {
        if (clipCancelled) break;
      }
    }
    return '';
  };

  const pad = (n) => String(n).padStart(2, '0');
  const now = new Date();
  const dt = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const timeTag = (s) => String(s).replace(/[:.]/g, '-');
  const cleanName = (s) => String(s).replace(/[\/\\:*?"<>|\n\r\t]/g, '_').replace(/^\.+/, '_').trim();

  const cacheKey = urlCacheKey(url);
  const dlIndex = loadDlIndex();
  const cached = dlIndex[cacheKey];

  try {
    let srcFile = '';
    let archived = '';
    let title = '';
    let reused = false;

    // 命中缓存:复用 assets/download_audio/ 里的全曲,不再下载
    if (cached && cached.file && fs.existsSync(path.join(DOWNLOAD_AUDIO_DIR, cached.file))) {
      progress('已有下载,复用全曲…');
      srcFile = path.join(DOWNLOAD_AUDIO_DIR, cached.file);
      archived = cached.file;
      title = cached.title || path.basename(cached.file, path.extname(cached.file));
      reused = true;
    } else {
      progress('获取视频信息…');
      title = await fetchTitle();
      if (clipCancelled) throw new Error('已停止');
      const errors = [];

      const ytdlpStep = async () => {
        progress('下载中(yt-dlp) 0%');
        await runCmdProgress(ytdlp, [
          '-x', '--no-playlist', '--newline',
          '-o', `${dlBase}.%(ext)s`, url,
        ], runOpts, (pct) => progress(`下载中(yt-dlp) ${pct}%`));
        return findDownloaded();
      };
      const yougetStep = async () => {
        cleanup();
        progress('下载中(you-get) 0%');
        await runCmdProgress(youget, [
          '--no-caption', '-o', tmp, '-O', `dl_${stamp}`, url,
        ], runOpts, (pct) => progress(`下载中(you-get) ${pct}%`));
        return findDownloaded();
      };

      // B 站对 yt-dlp 有风控(常年 HTTP 412),直接用 you-get,跳过 yt-dlp;
      // 其它站点(YouTube 等)优先 yt-dlp,失败再回退 you-get
      const isBili = /(^|\.)bilibili\.com|b23\.tv/i.test(url);
      const steps = [];
      if (isBili) {
        if (hasYouget) steps.push(['you-get', yougetStep]);
        else if (hasYtdlp) steps.push(['yt-dlp', ytdlpStep]); // 没装 you-get 时才兜底
      } else {
        if (hasYtdlp) steps.push(['yt-dlp', ytdlpStep]);
        if (hasYouget) steps.push(['you-get', yougetStep]);
      }

      for (const [name, step] of steps) {
        if (clipCancelled) break;
        try {
          srcFile = await step();
          if (srcFile) break;
        } catch (err) {
          if (clipCancelled) break;
          errors.push(name + ': ' + String(err.message || err).split('\n').filter(Boolean).pop());
        }
      }
      if (clipCancelled) throw new Error('已停止');
      if (!srcFile) throw new Error('下载失败 ' + errors.join(' | '));

      // 归档:只抽音频轨(-vn -c:a copy,不重压),按音频编码选容器,存到 download_audio/
      const archBase = sanitizeName(title || caption || `download_${stamp}`);
      try {
        fs.mkdirSync(DOWNLOAD_AUDIO_DIR, { recursive: true });
        progress('抽取音频…');
        // 探测音频编码,决定输出容器(aac→m4a / opus→opus / mp3→mp3 …)
        let codec = '';
        try {
          codec = String(await runCmd(ffprobe, [
            '-v', 'error', '-select_streams', 'a:0',
            '-show_entries', 'stream=codec_name',
            '-of', 'default=nw=1:nk=1', srcFile,
          ], runOpts)).trim().split('\n')[0];
        } catch (_) {}
        const srcExt = path.extname(srcFile).toLowerCase();
        const archExt = codecToExt(codec) || (AUDIO_EXT.includes(srcExt) ? srcExt : '.m4a');
        const audioOnly = path.join(tmp, `audio_${stamp}${archExt}`);
        await runCmd(ffmpeg, [
          '-nostdin', '-y', '-i', srcFile,
          '-vn', '-c:a', 'copy', audioOnly,
        ], runOpts);
        const archPath = importFile(audioOnly, DOWNLOAD_AUDIO_DIR, archBase, archExt);
        try { fs.unlinkSync(audioOnly); } catch (_) {}
        archived = path.basename(archPath);
        srcFile = archPath; // 后续切片从归档音频切
        dlIndex[cacheKey] = { file: archived, title: title || archBase, url };
        saveDlIndex(dlIndex);
      } catch (_) {}
    }

    if (clipCancelled) throw new Error('已停止');

    // 没给起止点:不切片,直接把整段交给弹窗让用户手动选段
    if (!start || !end) {
      const baseTitle = cleanName(title || caption || 'clip').slice(0, 50).trim() || 'clip';
      const fullUrl0 = fs.existsSync(srcFile)
        ? 'file://' + encodeURI(srcFile.split(path.sep).join('/'))
        : '';
      return {
        ok: true,
        preview: true,
        tempPath: null,
        url: null,
        base: baseTitle,
        ext: path.extname(srcFile).toLowerCase() || '.m4a',
        fullPath: fs.existsSync(srcFile) ? srcFile : '',
        fullUrl: fullUrl0,
        archived,
        reused,
      };
    }

    // 切片命名:标题_起_止_日期时分秒(标题过长则截断,保证时间戳不被裁掉)
    const titlePart = cleanName(title || caption || 'clip').slice(0, 50).trim() || 'clip';
    const sliceBase = cleanName(`${titlePart}_${timeTag(start)}_${timeTag(end)}_${dt}`);

    // 保留原始音质:按原格式流拷贝切片,不二次编码
    const outExt = path.extname(srcFile).toLowerCase() || '.m4a';
    const cutOut = path.join(tmp, `clip_${stamp}${outExt}`);
    progress('切片中…');
    await runCmd(ffmpeg, [
      '-nostdin', '-y', '-i', srcFile,
      '-ss', start, '-to', end,
      '-c', 'copy', cutOut,
    ], runOpts);
    if (!fs.existsSync(cutOut) || fs.statSync(cutOut).size === 0) {
      throw new Error('切片失败,请检查时间格式(如 1:23 或 83)');
    }

    // 不直接入库,先保留切片临时文件返回给渲染层预览,确认后再放入素材目录
    keepClip = true;
    const previewUrl = 'file://' + encodeURI(cutOut.split(path.sep).join('/'));
    // 整段音频(归档全曲)路径,供"手动选段"在整首歌上重切
    const fullUrl = fs.existsSync(srcFile)
      ? 'file://' + encodeURI(srcFile.split(path.sep).join('/'))
      : '';
    return {
      ok: true,
      preview: true,
      tempPath: cutOut,
      url: previewUrl,
      base: sliceBase,
      ext: outExt,
      fullPath: fs.existsSync(srcFile) ? srcFile : '',
      fullUrl,
      archived,
      reused,
    };
  } catch (err) {
    if (clipCancelled) return { ok: false, error: '已停止', cancelled: true };
    return { ok: false, error: String(err.message || err).slice(0, 300) };
  } finally {
    cleanup();
  }
});

// 停止正在进行的下载/转码:强杀所有子进程
ipcMain.on('cancel-clip', () => {
  clipCancelled = true;
  for (const c of activeChildren) {
    // detached 启动,负 PID 杀掉整个进程组(连带 yt-dlp/you-get 衍生的 ffmpeg 等孙进程)
    try { process.kill(-c.pid, 'SIGKILL'); } catch (_) {
      try { c.kill('SIGKILL'); } catch (_) {}
    }
  }
  activeChildren.clear();
});

// 预览确认后:把切片临时文件放入素材目录
ipcMain.handle('confirm-add-clip', (e, { tempPath, base, ext, caption }) => {  try {
    if (!tempPath || !fs.existsSync(tempPath)) {
      return { ok: false, error: '预览文件已失效,请重新切片' };
    }
    const finalBase = sanitizeName(caption || base || 'clip');
    const dest = importFile(tempPath, path.join(getUserDir(), 'audio'), finalBase, ext || '.m4a');
    try { fs.unlinkSync(tempPath); } catch (_) {}
    if (win && !win.isDestroyed()) win.webContents.send('reload-assets');
    return { ok: true, file: path.basename(dest) };
  } catch (err) {
    return { ok: false, error: String(err.message || err).slice(0, 300) };
  }
});

// 预览取消:丢弃切片临时文件
ipcMain.handle('discard-clip', (e, { tempPath }) => {
  try {
    if (tempPath) fs.unlinkSync(tempPath);
  } catch (_) {}
  return { ok: true };
});

// 手动选段:在整首音频上,按用户插的起止点(绝对秒)重切出一段
// srcPath = 归档全曲(优先,不删除);兼容旧的 tempPath(切片内重切)
ipcMain.handle('retrim-clip', async (e, { srcPath, tempPath, start, end, ext }) => {
  try {
    const src = srcPath || tempPath;
    if (!src || !fs.existsSync(src)) {
      return { ok: false, error: '音频文件已失效,请重新切片' };
    }
    const s = Number(start);
    const en = Number(end);
    if (Number.isNaN(s) || Number.isNaN(en) || s < 0 || !(en > s)) {
      return { ok: false, error: '终点要大于起点' };
    }
    const ffmpeg = findBin('ffmpeg');
    if (!fs.existsSync(ffmpeg)) return { ok: false, error: '未找到 ffmpeg' };
    const tmp = app.getPath('temp');
    const outExt = ext || path.extname(src).toLowerCase() || '.m4a';
    const out = path.join(tmp, `clip_${Date.now()}${outExt}`);
    await runCmd(ffmpeg, [
      '-nostdin', '-y', '-i', src,
      '-ss', String(s), '-to', String(en),
      '-c', 'copy', out,
    ]);
    if (!fs.existsSync(out) || fs.statSync(out).size === 0) {
      return { ok: false, error: '重切失败,换个起止点再试' };
    }
    // 整段全曲不删除;只有在旧的切片内重切模式下才清理上一个临时切片
    if (!srcPath && tempPath) {
      try { fs.unlinkSync(tempPath); } catch (_) {}
    }
    const url = 'file://' + encodeURI(out.split(path.sep).join('/'));
    return { ok: true, tempPath: out, url };
  } catch (err) {
    return { ok: false, error: String(err.message || err).slice(0, 300) };
  }
});

// 本地音乐切片:从用户选的本地文件按起止点切一段,走和链接切片一样的预览/手动选段流程
ipcMain.handle('clip-local-audio', async (e, { srcPath, start, end, caption }) => {
  try {
    if (!srcPath || !fs.existsSync(srcPath)) return { ok: false, error: '找不到音频文件' };
    const pad = (n) => String(n).padStart(2, '0');
    const cleanName = (s) => String(s).replace(/[\/\\:*?"<>|\n\r\t]/g, '_').replace(/^\.+/, '_').trim();
    const outExt = path.extname(srcPath).toLowerCase() || '.m4a';
    const fullUrl = 'file://' + encodeURI(srcPath.split(path.sep).join('/'));

    // 没给起止点:不切片,直接把整段交给弹窗让用户手动选段
    if (!start || !end) {
      const baseTitle = cleanName(caption || path.basename(srcPath, path.extname(srcPath))).slice(0, 50).trim() || 'clip';
      return {
        ok: true,
        preview: true,
        tempPath: null,
        url: null,
        base: baseTitle,
        ext: outExt,
        fullPath: srcPath,
        fullUrl,
        reused: false,
      };
    }

    const ffmpeg = findBin('ffmpeg');
    if (!fs.existsSync(ffmpeg)) return { ok: false, error: '未找到 ffmpeg' };
    const tmp = app.getPath('temp');
    const stamp = Date.now();
    const now = new Date();
    const dt = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const timeTag = (s) => String(s).replace(/[:.]/g, '-');
    const titleSrc = caption || path.basename(srcPath, path.extname(srcPath));
    const titlePart = cleanName(titleSrc).slice(0, 50).trim() || 'clip';
    const sliceBase = cleanName(`${titlePart}_${timeTag(start)}_${timeTag(end)}_${dt}`);
    const cutOut = path.join(tmp, `clip_${stamp}${outExt}`);
    await runCmd(ffmpeg, [
      '-nostdin', '-y', '-i', srcPath,
      '-ss', String(start), '-to', String(end),
      '-c', 'copy', cutOut,
    ]);
    if (!fs.existsSync(cutOut) || fs.statSync(cutOut).size === 0) {
      return { ok: false, error: '切片失败,请检查时间格式(如 1:23 或 83)' };
    }
    const previewUrl = 'file://' + encodeURI(cutOut.split(path.sep).join('/'));
    return {
      ok: true,
      preview: true,
      tempPath: cutOut,
      url: previewUrl,
      base: sliceBase,
      ext: outExt,
      fullPath: srcPath, // 手动选段在整首本地音乐上重切
      fullUrl,
      reused: false,
    };
  } catch (err) {
    return { ok: false, error: String(err.message || err).slice(0, 300) };
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

ipcMain.handle('toggle-manager-top', () => {
  if (managerWin && !managerWin.isDestroyed()) {
    const next = !managerWin.isAlwaysOnTop();
    managerWin.setAlwaysOnTop(next);
    return next;
  }
  return false;
});

ipcMain.on('open-user-dir', () => {
  ensureUserDirs();
  shell.openPath(getUserDir());
});

ipcMain.on('open-download-dir', () => {
  fs.mkdirSync(getDownloadDir(), { recursive: true });
  shell.openPath(getDownloadDir());
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

// 重命名素材:同步更新配置里对它的引用(图片→映射键/隐藏列表;音频→映射值/音量键)
ipcMain.handle('rename-asset', (e, { path: filePath, newName }) => {
  try {
    const resolved = path.resolve(filePath);
    const roots = [BUNDLED_ASSETS_DIR, getUserDir()].map((r) => path.resolve(r) + path.sep);
    if (!roots.some((r) => resolved.startsWith(r))) {
      return { ok: false, error: '不允许操作该位置的文件' };
    }
    if (!fs.existsSync(resolved)) return { ok: false, error: '文件不存在' };
    const dir = path.dirname(resolved);
    const ext = path.extname(resolved);
    const oldName = path.basename(resolved, ext);
    const clean = sanitizeName(String(newName || '').trim());
    if (!clean) return { ok: false, error: '名字不能为空' };
    if (clean === oldName) return { ok: true, name: oldName };
    const target = path.join(dir, clean + ext);
    if (fs.existsSync(target)) return { ok: false, error: '已存在同名素材' };
    fs.renameSync(resolved, target);

    const isImage = dir.split(path.sep).includes('images');
    const cfg = loadConfig();
    if (isImage) {
      if (cfg.imageAudioMap && cfg.imageAudioMap[oldName] != null) {
        cfg.imageAudioMap[clean] = cfg.imageAudioMap[oldName];
        delete cfg.imageAudioMap[oldName];
      }
      if (Array.isArray(cfg.hiddenImages)) {
        cfg.hiddenImages = cfg.hiddenImages.map((n) => (n === oldName ? clean : n));
      }
    } else {
      if (cfg.imageAudioMap && typeof cfg.imageAudioMap === 'object') {
        for (const k of Object.keys(cfg.imageAudioMap)) {
          const arr = cfg.imageAudioMap[k];
          if (Array.isArray(arr)) cfg.imageAudioMap[k] = arr.map((n) => (n === oldName ? clean : n));
        }
      }
      if (cfg.audioVolumes && cfg.audioVolumes[oldName] != null) {
        cfg.audioVolumes[clean] = cfg.audioVolumes[oldName];
        delete cfg.audioVolumes[oldName];
      }
    }
    saveConfig(cfg);
    if (win && !win.isDestroyed()) {
      win.webContents.send('reload-assets');
      win.webContents.send('clip-map', cfg.imageAudioMap || {});
      win.webContents.send('audio-volumes', cfg.audioVolumes || {});
      win.webContents.send('hidden-images', cfg.hiddenImages || []);
    }
    return { ok: true, name: clean };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
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
