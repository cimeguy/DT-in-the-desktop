const imgEl = document.getElementById('petImg');
const bubble = document.getElementById('bubble');
const hint = document.getElementById('hint');
const pet = document.getElementById('pet');

let assets = { images: [], audio: [] };
let clipMap = {};
let audioVolumes = {};
let hiddenImages = new Set();
let muted = false;
let playMode = 'random';
let imgIndex = -1;
let lastClipName = null;
let currentImageName = null;
let currentAudio = null;
let bubbleTimer = null;

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 过滤掉「不显示」的图;若全部被隐藏则回退到全部,避免宠物空白
function visibleImages() {
  const vis = assets.images.filter((im) => !hiddenImages.has(im.name));
  return vis.length ? vis : assets.images;
}

async function loadAssets(showUrl) {
  assets = await window.petAPI.getAssets();
  clipMap = assets.map || {};
  audioVolumes = assets.volumes || {};
  hiddenImages = new Set(assets.hidden || []);
  if (assets.playMode) playMode = assets.playMode;
  if (assets.images.length > 0) {
    hint.style.display = 'none';
    const vis = visibleImages();
    const first = showUrl
      ? assets.images.find((im) => im.url === showUrl) || pick(vis)
      : pick(vis);
    currentImageName = first.name;
    imgEl.src = showUrl || first.url;
  } else {
    hint.style.display = 'block';
    currentImageName = null;
    imgEl.removeAttribute('src');
  }
}

const BASE_IMG = 240;
function applyScale(scale) {
  const s = Number(scale) || 1;
  const px = Math.round(BASE_IMG * s) + 'px';
  imgEl.style.maxWidth = px;
  imgEl.style.maxHeight = px;
}

// 去掉切片文件名里的日期后缀(_YYYYMMDD-HHMMSS),气泡只显示标题部分
function stripDateSuffix(name) {
  return String(name).replace(/_\d{8}-\d{6}$/, '');
}

function showBubble(text) {
  if (!text) return;
  bubble.textContent = text;
  bubble.classList.remove('hidden');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubble.classList.add('hidden'), 4000);
}

function bounce() {
  imgEl.classList.remove('bounce');
  void imgEl.offsetWidth; // 强制重排以重启动画
  imgEl.classList.add('bounce');
}

function wobble() {
  imgEl.classList.remove('wobble');
  void imgEl.offsetWidth;
  imgEl.classList.add('wobble');
}

// 音频始终跟随当前图片的映射:有专属池就从池里随机,否则全局随机
function pickFromPool() {
  let pool = assets.audio;
  const mapped = currentImageName && clipMap[currentImageName];
  if (Array.isArray(mapped) && mapped.length) {
    const byName = assets.audio.filter((a) => mapped.includes(a.name));
    if (byName.length) pool = byName;
  }
  return pool.length ? pick(pool) : null;
}

// 播放模式控制「换图」方式:顺序 / 随机 / 固定当前图
function selectImage() {
  const vis = visibleImages();
  if (!vis.length) return null;
  if (playMode === 'single') {
    return vis.find((im) => im.name === currentImageName) || vis[0];
  }
  if (playMode === 'list') {
    imgIndex = (imgIndex + 1) % vis.length;
    return vis[imgIndex];
  }
  return pick(vis);
}

function onClickPet() {
  bounce();
  const img = selectImage();
  if (img) {
    currentImageName = img.name;
    imgEl.src = img.url;
  }
  const clip = pickFromPool();
  if (clip) {
    lastClipName = clip.name;
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    if (!muted) {
      currentAudio = new Audio(clip.url);
      currentAudio.volume = audioVolumes[clip.name] != null ? audioVolumes[clip.name] : 1;
      currentAudio.play().catch(() => {});
    }
    showBubble(stripDateSuffix(clip.name));
  } else {
    showBubble('把音频放进 assets/audio 就能听到台词啦');
  }
}

// 拖动 vs 点击:位移小于阈值视为点击
let dragging = false;
let moved = false;
let startX = 0;
let startY = 0;
let winStart = [0, 0];
const THRESHOLD = 4;

pet.addEventListener('mousedown', async (e) => {
  if (e.button !== 0) return;
  dragging = true;
  moved = false;
  startX = e.screenX;
  startY = e.screenY;
  winStart = await window.petAPI.getWindowPos();
});

// 鼠标移到宠物上轻晃几下(菜单展开/拖动时不触发)
pet.addEventListener('mouseenter', () => {
  if (dragging || radialOpen) return;
  wobble();
});

// 鼠标在宠物上快速来回晃 -> 根据频率转圈
let shakeTimes = [];
let lastShakeX = null;
let lastShakeDir = 0;
let spinning = false;
const SHAKE_WINDOW = 700;   // 统计最近 700ms 内的换向
const SHAKE_MIN_DX = 6;     // 小于此位移忽略,避免抖动误判
const SHAKE_TRIGGER = 4;    // 窗口内换向达到这么多次就转

function resetShake() {
  shakeTimes = [];
  lastShakeX = null;
  lastShakeDir = 0;
}

function trackShake(e) {
  if (dragging || radialOpen || spinning) { resetShake(); return; }
  const x = e.screenX;
  if (lastShakeX === null) { lastShakeX = x; return; }
  const dx = x - lastShakeX;
  if (Math.abs(dx) < SHAKE_MIN_DX) return;
  const dir = dx > 0 ? 1 : -1;
  if (lastShakeDir && dir !== lastShakeDir) {
    const now = performance.now();
    shakeTimes.push(now);
    shakeTimes = shakeTimes.filter((t) => now - t <= SHAKE_WINDOW);
    if (shakeTimes.length >= SHAKE_TRIGGER) {
      triggerSpin(shakeTimes.length);
      resetShake();
    }
  }
  lastShakeDir = dir;
  lastShakeX = x;
}

function triggerSpin(intensity) {
  if (spinning) return;
  spinning = true;
  // 换向越密 -> 时长越短 -> 转得越快(0.3s ~ 0.95s)
  const dur = Math.max(0.3, 0.95 - (intensity - SHAKE_TRIGGER) * 0.1);
  imgEl.classList.remove('wobble');
  imgEl.style.setProperty('--spin-dur', dur + 's');
  imgEl.classList.add('spin');
}

imgEl.addEventListener('animationend', (ev) => {
  if (ev.animationName === 'petSpin') {
    imgEl.classList.remove('spin');
    spinning = false;
  }
});

window.addEventListener('mousemove', trackShake);
pet.addEventListener('mouseleave', resetShake);

window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const dx = e.screenX - startX;
  const dy = e.screenY - startY;
  if (Math.abs(dx) > THRESHOLD || Math.abs(dy) > THRESHOLD) moved = true;
  if (moved) window.petAPI.setWindowPos(winStart[0] + dx, winStart[1] + dy);
});

window.addEventListener('mouseup', (e) => {
  if (!dragging) return;
  dragging = false;
  if (!moved) onClickPet();
});

pet.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  openRadial();
});

// ---- 环形右键菜单 ----
const radial = document.getElementById('radial');
let radialState = { muted: false, autoLaunch: false, rememberPos: false, playMode: 'random' };
let radialOpen = false;
let radialHint = null;
let lastMouse = { x: 0, y: 0 };

function moveRadialHint(e) {
  lastMouse.x = e.clientX;
  lastMouse.y = e.clientY;
  positionRadialHint(e.clientX, e.clientY);
}

function positionRadialHint(cx, cy) {
  if (!radialOpen || !radialHint) return;
  const pad = 16;
  let x = cx + pad;
  let y = cy + pad;
  const r = radialHint.getBoundingClientRect();
  if (x + r.width > window.innerWidth) x = cx - r.width - pad;
  if (y + r.height > window.innerHeight) y = cy - r.height - pad;
  radialHint.style.left = x + 'px';
  radialHint.style.top = y + 'px';
}
window.addEventListener('mousemove', moveRadialHint);

const MAIN_ITEMS = [
  { key: 'manage', ic: '📁', lb: '管理素材' },      // 正上方
  { key: 'mute', ic: '🔊', lb: '静音', toggle: 'muted' },
  { key: 'playmode', ic: '🎵', lb: '换图模式' },
  { key: 'quit', ic: '✕', lb: '退出' },             // 右下角
  { key: 'size', ic: '🔍', lb: '图片大小' },
  { key: 'autolaunch', ic: '🚀', lb: '自启动', toggle: 'autoLaunch' },
  { key: 'rememberpos', ic: '📍', lb: '固定此处', toggle: 'rememberPos' },
];

const SIZE_ITEMS = [
  { key: 'zoomin', ic: '➕', lb: '放大' },
  { key: 'zoomout', ic: '➖', lb: '缩小' },
  { key: 'reset', ic: '↺', lb: '重置大小' },
  { key: 'default', ic: '⭐', lb: '设为默认' },
  { key: 'back', ic: '↩', lb: '返回' },
];

const PLAYMODE_ITEMS = [
  { key: 'pm-list', ic: '🔢', lb: '顺序换图', mode: 'list' },
  { key: 'pm-random', ic: '🔀', lb: '随机换图', mode: 'random' },
  { key: 'pm-single', ic: '🔂', lb: '固定一张', mode: 'single' },
  { key: 'back', ic: '↩', lb: '返回' },
];

let currentItems = MAIN_ITEMS;

function iconFor(item) {
  if (item.key === 'mute') return radialState.muted ? '🔇' : '🔊';
  return item.ic;
}

async function openRadial() {
  if (radialOpen) return;
  radialOpen = true;
  currentItems = MAIN_ITEMS;
  radialState = await window.petAPI.getMenuState();
  window.petAPI.openRadial();
  document.body.classList.add('menu-open');
  buildRadial();
  radial.classList.remove('hidden');
}

function closeRadial() {
  if (!radialOpen) return;
  radialOpen = false;
  currentItems = MAIN_ITEMS;
  radial.classList.add('hidden');
  document.body.classList.remove('menu-open');
  window.petAPI.closeRadial();
}

function buildRadial() {
  radial.innerHTML = '';
  radialHint = document.createElement('div');
  radialHint.className = 'radial-hint';
  radialHint.textContent = '点击空白处取消菜单';
  radial.appendChild(radialHint);
  positionRadialHint(lastMouse.x, lastMouse.y);
  const items = currentItems;
  const n = items.length;
  const R = 150;
  // 把「管理素材」锚定在正上方(12点),其余按钮顺时针等距排开;
  // MAIN_ITEMS 的顺序已让「退出」落在右下角(约5点方向)
  const manageIdx = items.findIndex((it) => it.key === 'manage');
  const start = manageIdx >= 0 ? -90 - manageIdx * (360 / n) : -90;
  items.forEach((item, i) => {
    const ang = ((start + i * (360 / n)) * Math.PI) / 180;
    const x = Math.cos(ang) * R;
    const y = Math.sin(ang) * R;
    const btn = document.createElement('div');
    btn.className = 'radial-item';
    if (item.toggle && radialState[item.toggle]) btn.classList.add('on');
    if (item.mode && radialState.playMode === item.mode) btn.classList.add('on');
    btn.style.left = `calc(50% + ${x}px)`;
    btn.style.top = `calc(50% + ${y}px)`;
    btn.style.animationDelay = i * 0.018 + 's';
    btn.title = item.lb;
    btn.innerHTML = `<span class="ic">${iconFor(item)}</span><span class="lb">${item.lb}</span>`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onRadialClick(item, btn);
    });
    radial.appendChild(btn);
  });
}

function flash(btn) {
  btn.classList.add('flash');
  setTimeout(() => btn.classList.remove('flash'), 500);
}

async function onRadialClick(item, btn) {
  if (item.mode) {
    radialState.playMode = await window.petAPI.setPlayMode(item.mode);
    playMode = radialState.playMode;
    imgIndex = -1;
    buildRadial();
    return;
  }
  switch (item.key) {
    case 'manage':
      window.petAPI.openManager();
      closeRadial();
      break;
    case 'quit':
      window.petAPI.quitApp();
      break;
    case 'size':
      currentItems = SIZE_ITEMS;
      buildRadial();
      break;
    case 'playmode':
      currentItems = PLAYMODE_ITEMS;
      buildRadial();
      break;
    case 'back':
      currentItems = MAIN_ITEMS;
      buildRadial();
      break;
    case 'zoomin':
      window.petAPI.zoomPet(0.2);
      break;
    case 'zoomout':
      window.petAPI.zoomPet(-0.2);
      break;
    case 'reset':
      window.petAPI.resetSize();
      break;
    case 'default':
      window.petAPI.setDefaultSize();
      flash(btn);
      break;
    case 'mute':
      radialState.muted = await window.petAPI.toggleMute();
      muted = radialState.muted;
      btn.querySelector('.ic').textContent = iconFor(item);
      btn.classList.toggle('on', radialState.muted);
      break;
    case 'autolaunch':
      radialState.autoLaunch = await window.petAPI.toggleAutoLaunch();
      btn.classList.toggle('on', radialState.autoLaunch);
      break;
    case 'rememberpos':
      radialState.rememberPos = await window.petAPI.toggleRememberPos();
      btn.classList.toggle('on', radialState.rememberPos);
      break;
  }
}

radial.addEventListener('click', (e) => {
  if (e.target === radial) closeRadial();
});
radial.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  closeRadial();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && radialOpen) closeRadial();
});

window.petAPI.onReloadAssets((e, showUrl) => loadAssets(showUrl));
window.petAPI.onSetScale((e, scale) => applyScale(scale));
window.petAPI.onClipMap((e, map) => { clipMap = map || {}; });
window.petAPI.onAudioVolumes((e, v) => {
  audioVolumes = v || {};
  // 若调的正是当前正在播放的这首,音量实时跟着动
  if (currentAudio && !currentAudio.ended && lastClipName != null) {
    currentAudio.volume = audioVolumes[lastClipName] != null ? audioVolumes[lastClipName] : 1;
  }
});
window.petAPI.onHiddenImages((e, h) => { hiddenImages = new Set(h || []); });
window.petAPI.onSetPlayMode((e, m) => { if (m) { playMode = m; imgIndex = -1; } });
window.petAPI.onSetMuted((e, m) => {
  muted = !!m;
  if (muted && currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
});

// 按住 Ctrl/⌘ 滚轮缩放
window.addEventListener('wheel', (e) => {
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  window.petAPI.zoomPet(e.deltaY < 0 ? 0.1 : -0.1);
}, { passive: false });

(async () => {
  applyScale(await window.petAPI.getScale());
  muted = await window.petAPI.getMuted();
  loadAssets();
})();
