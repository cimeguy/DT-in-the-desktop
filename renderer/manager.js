const dirPathEl = document.getElementById('dirPath');
const downloadPathEl = document.getElementById('downloadPath');
const toastEl = document.getElementById('toast');

// 跟随鼠标的小气泡提示(用于显示时间输入框支持的格式)
const tipEl = document.getElementById('tip');
function moveTip(e) {
  const pad = 14;
  let x = e.clientX + pad;
  let y = e.clientY + pad;
  const r = tipEl.getBoundingClientRect();
  if (x + r.width > window.innerWidth) x = e.clientX - r.width - pad;
  if (y + r.height > window.innerHeight) y = e.clientY - r.height - pad;
  tipEl.style.left = x + 'px';
  tipEl.style.top = y + 'px';
}
document.querySelectorAll('[data-tip]').forEach((el) => {
  el.addEventListener('mouseenter', (e) => {
    tipEl.textContent = el.getAttribute('data-tip');
    tipEl.style.display = 'block';
    moveTip(e);
  });
  el.addEventListener('mousemove', moveTip);
  el.addEventListener('mouseleave', () => {
    tipEl.style.display = 'none';
  });
});

function extOf(name, fallback) {
  const m = /\.[^.\\/]+$/.exec(name || '');
  return m ? m[0].toLowerCase() : fallback;
}

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 1800);
}

// 应用内确认弹窗(Electron 原生 confirm 不可靠,改用自绘弹窗)
const confirmMask = document.getElementById('confirmMask');
const confirmMsgEl = document.getElementById('confirmMsg');
const confirmTitleEl = document.getElementById('confirmTitle');
const confirmOkBtn = document.getElementById('confirmOk');
const confirmCancelBtn = document.getElementById('confirmCancel');
function confirmDialog(message, title) {
  return new Promise((resolve) => {
    confirmMsgEl.textContent = message;
    confirmTitleEl.textContent = title || '确认删除';
    confirmMask.classList.add('show');
    const close = (val) => {
      confirmMask.classList.remove('show');
      confirmOkBtn.removeEventListener('click', onOk);
      confirmCancelBtn.removeEventListener('click', onCancel);
      confirmMask.removeEventListener('click', onMask);
      resolve(val);
    };
    const onOk = () => close(true);
    const onCancel = () => close(false);
    const onMask = (e) => { if (e.target === confirmMask) close(false); };
    confirmOkBtn.addEventListener('click', onOk);
    confirmCancelBtn.addEventListener('click', onCancel);
    confirmMask.addEventListener('click', onMask);
  });
}

// 只在显示时把路径里的用户名打码(不改实际路径)
function maskUser(p) {
  if (!p) return p;
  return String(p).replace(
    /^(\/Users\/|\/home\/|[A-Za-z]:\\Users\\)([^/\\]+)/,
    (m, pre, name) => pre + '*'.repeat(name.length)
  );
}

// 路径默认隐藏(只把用户名打码,其余照常显示),点小眼睛才显示完整路径
const dirShown = { user: false, download: false };
const dirReal = { user: '', download: '' };

function renderDirPath(key) {
  const el = key === 'user' ? dirPathEl : downloadPathEl;
  const real = dirReal[key] || '';
  if (dirShown[key]) {
    el.textContent = real || '—';
    el.classList.remove('masked');
  } else {
    el.textContent = real ? maskUser(real) : '—';
    el.classList.add('masked');
  }
}

function setDirPath(key, value) {
  dirReal[key] = value || '';
  renderDirPath(key);
}

async function refreshDir() {
  setDirPath('user', await window.managerAPI.getUserDir());
  setDirPath('download', await window.managerAPI.getDownloadDir());
}

document.getElementById('eyeDir').addEventListener('click', (e) => {
  dirShown.user = !dirShown.user;
  e.currentTarget.classList.toggle('on', dirShown.user);
  renderDirPath('user');
});

document.getElementById('eyeDownloadDir').addEventListener('click', (e) => {
  dirShown.download = !dirShown.download;
  e.currentTarget.classList.toggle('on', dirShown.download);
  renderDirPath('download');
});

document.getElementById('chooseDir').addEventListener('click', async () => {
  setDirPath('user', await window.managerAPI.chooseUserDir());
  renderLists();
});

document.getElementById('openDir').addEventListener('click', () => {
  window.managerAPI.openUserDir();
});

document.getElementById('resetDir').addEventListener('click', async () => {
  setDirPath('user', await window.managerAPI.resetUserDir());
  toast('素材目录已恢复默认');
  renderLists();
});

document.getElementById('chooseDownloadDir').addEventListener('click', async () => {
  setDirPath('download', await window.managerAPI.chooseDownloadDir());
});

document.getElementById('openDownloadDir').addEventListener('click', () => {
  window.managerAPI.openDownloadDir();
});

document.getElementById('resetDownloadDir').addEventListener('click', async () => {
  setDirPath('download', await window.managerAPI.resetDownloadDir());
  toast('下载目录已恢复默认');
});

document.getElementById('pinTop').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const on = await window.managerAPI.toggleManagerTop();
  btn.textContent = on ? '📌 已置顶 ✓' : '📌 置顶';
  btn.title = on ? '窗口已置顶,点击取消' : '点击让窗口始终在最前';
  btn.classList.toggle('active', on);
  toast(on ? '窗口已置顶,会始终显示在最前' : '已取消置顶');
});

// 跟随鼠标旋转开关
const spinFollowBtn = document.getElementById('spinFollowToggle');
function renderSpinFollow(on) {
  spinFollowBtn.textContent = on ? '🌀 跟随旋转 ✓' : '🌀 旋转已关';
  spinFollowBtn.title = on ? '宠物会随鼠标移动速度自转,点击关闭' : '点击开启:宠物随鼠标移动自转';
  spinFollowBtn.classList.toggle('active', on);
}
spinFollowBtn.addEventListener('click', async () => {
  const cur = spinFollowBtn.classList.contains('active');
  const on = await window.managerAPI.setSpinFollow(!cur);
  renderSpinFollow(on);
  toast(on ? '已开启跟随鼠标旋转' : '已关闭跟随鼠标旋转');
});

// 旋转灵敏度(转速倍率)
const spinMulEl = document.getElementById('spinMul');
const spinMulValEl = document.getElementById('spinMulVal');
let spinMulTimer = null;
spinMulEl.addEventListener('input', () => {
  const v = Number(spinMulEl.value);
  spinMulValEl.textContent = v.toFixed(1) + 'x';
  clearTimeout(spinMulTimer);
  spinMulTimer = setTimeout(() => window.managerAPI.setSpinMul(v), 150);
});
window.managerAPI.getSpinMul().then((v) => {
  spinMulEl.value = String(v);
  spinMulValEl.textContent = Number(v).toFixed(1) + 'x';
});

// 通用拖拽区绑定
function bindDrop(dropEl, inputEl, fileLabel, onPick, onClickOverride) {
  const stop = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  ['dragenter', 'dragover'].forEach((ev) =>
    dropEl.addEventListener(ev, (e) => {
      stop(e);
      dropEl.classList.add('over');
    })
  );
  ['dragleave', 'drop'].forEach((ev) =>
    dropEl.addEventListener(ev, (e) => {
      stop(e);
      dropEl.classList.remove('over');
    })
  );
  dropEl.addEventListener('drop', (e) => {
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onPick(files);
  });
  dropEl.addEventListener('click', () => {
    if (onClickOverride) onClickOverride();
    else inputEl.click();
  });
  inputEl.addEventListener('change', () => {
    const files = Array.from(inputEl.files);
    if (files.length) onPick(files);
  });
}

// 从链接切片(只粘链接,下载后在弹窗里手动选段)
const clipUrl = document.getElementById('clipUrl');
const saveClipBtn = document.getElementById('saveClip');
const cancelClipBtn = document.getElementById('cancelClip');

cancelClipBtn.addEventListener('click', () => {
  window.managerAPI.cancelClip();
  cancelClipBtn.disabled = true;
  cancelClipBtn.textContent = '停止中…';
});

function updateClipBtn() {
  saveClipBtn.disabled = !clipUrl.value.trim();
}
clipUrl.addEventListener('input', updateClipBtn);

// 处理中实时显示阶段(获取信息/下载/转码)
let clipBusy = false;
window.managerAPI.onClipProgress((e, msg) => {
  if (clipBusy && msg) saveClipBtn.textContent = '处理中…' + msg;
});

saveClipBtn.addEventListener('click', async () => {
  saveClipBtn.disabled = true;
  saveClipBtn.classList.add('processing');
  clipBusy = true;
  saveClipBtn.textContent = '处理中…(下载)';
  cancelClipBtn.style.display = '';
  cancelClipBtn.disabled = false;
  cancelClipBtn.textContent = '■ 停止处理';
  const r = await window.managerAPI.addAudioFromUrl({
    url: clipUrl.value.trim(),
  });
  clipBusy = false;
  saveClipBtn.classList.remove('processing');
  saveClipBtn.textContent = '下载并选段';
  cancelClipBtn.style.display = 'none';
  if (r.ok && r.preview) {
    openPreview(r, {
      onConfirmReset: () => {
        clipUrl.value = '';
        updateClipBtn();
      },
    });
  } else if (r.cancelled) {
    toast('已停止处理');
  } else {
    toast('失败:' + (r.error || '未知错误'));
  }
  updateClipBtn();
});

// 从本地音乐切片(只选文件,弹窗里手动选段)
let localClipPath = null;
let localClipExt = '.mp3';
const saveLocalClipBtn = document.getElementById('saveLocalClip');

bindDrop(
  document.getElementById('localClipDrop'),
  document.getElementById('localClipInput'),
  document.getElementById('localClipFile'),
  (files) => {
    const file = files[0];
    localClipPath = window.managerAPI.pathForFile(file);
    localClipExt = extOf(file.name, '.mp3');
    document.getElementById('localClipFile').textContent = file.name;
    updateLocalClipBtn();
  },
  // 点击拖拽区时用原生选择框,默认从下载目录打开
  async () => {
    const p = await window.managerAPI.pickLocalAudio();
    if (!p) return;
    localClipPath = p;
    localClipExt = extOf(p, '.mp3');
    document.getElementById('localClipFile').textContent = p.split(/[\\/]/).pop();
    updateLocalClipBtn();
  }
);

function updateLocalClipBtn() {
  saveLocalClipBtn.disabled = !localClipPath;
}

function resetLocalClip() {
  localClipPath = null;
  document.getElementById('localClipFile').textContent = '';
  updateLocalClipBtn();
}

saveLocalClipBtn.addEventListener('click', async () => {
  saveLocalClipBtn.disabled = true;
  saveLocalClipBtn.classList.add('processing');
  saveLocalClipBtn.textContent = '载入中…';
  const r = await window.managerAPI.clipLocalAudio({
    srcPath: localClipPath,
  });
  saveLocalClipBtn.classList.remove('processing');
  saveLocalClipBtn.textContent = '载入并选段';
  if (r.ok && r.preview) {
    openPreview(r, {
      onConfirmReset: resetLocalClip,
    });
  } else {
    toast('失败:' + (r.error || '未知错误'));
  }
  updateLocalClipBtn();
});

// ---- 切片选段确认(交互式时间轴) ----
const previewMask = document.getElementById('previewMask');
const previewAudio = document.getElementById('previewAudio');
const previewName = document.getElementById('previewName');
const previewConfirm = document.getElementById('previewConfirm');
const previewCaption = document.getElementById('previewCaption');
const previewCancel = document.getElementById('previewCancel');

const tlTrack = document.getElementById('tlTrack');
const tlSelection = document.getElementById('tlSelection');
const tlStart = document.getElementById('tlStart');
const tlEnd = document.getElementById('tlEnd');
const tlPlayhead = document.getElementById('tlPlayhead');
const tlT0 = document.getElementById('tlT0');
const tlT1 = document.getElementById('tlT1');
const segStartIn = document.getElementById('segStartIn');
const segEndIn = document.getElementById('segEndIn');
const segDur = document.getElementById('segDur');
const playSeg = document.getElementById('playSeg');
const playFull = document.getElementById('playFull');

const MIN_GAP = 0.05; // 起止点最小间隔(秒)
let pendingClip = null; // { tempPath, base, ext, fullPath, fullUrl, clipUrl, onConfirmReset }
let mediaDur = 0; // 整段时长(秒)
let segStart = 0;
let segEnd = 0;
let playMode = null; // 'seg' | 'full' | null
let rafId = null;

const pad2 = (n) => String(n).padStart(2, '0');
// 轨道两端标尺:只显示 分:秒
function fmtClock(t) {
  t = Math.max(0, t || 0);
  return pad2(Math.floor(t / 60)) + ':' + pad2(Math.floor(t % 60));
}
// 起止时间框:精确到 0.01 秒
function fmtPrecise(t) {
  t = Math.max(0, t || 0);
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return pad2(m) + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
}
// 解析手输的时间:支持 mm:ss.xx / ss.xx / 纯秒数
function parseTime(str) {
  str = String(str).trim();
  if (!str) return null;
  let sec;
  if (str.includes(':')) {
    const parts = str.split(':').map(Number);
    if (parts.some((n) => Number.isNaN(n))) return null;
    sec = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
  } else {
    sec = Number(str);
    if (Number.isNaN(sec)) return null;
  }
  return sec;
}

function clampSeg() {
  segStart = Math.max(0, Math.min(segStart, mediaDur));
  segEnd = Math.max(0, Math.min(segEnd, mediaDur));
  if (segEnd < segStart + MIN_GAP) segEnd = Math.min(mediaDur, segStart + MIN_GAP);
  if (segEnd <= segStart) segStart = Math.max(0, segEnd - MIN_GAP);
}

const pctOf = (t) => (mediaDur > 0 ? (t / mediaDur) * 100 : 0);

function refreshSeg(updateInputs = true) {
  clampSeg();
  const a = pctOf(segStart);
  const b = pctOf(segEnd);
  tlSelection.style.left = a + '%';
  tlSelection.style.width = b - a + '%';
  tlStart.style.left = a + '%';
  tlEnd.style.left = b + '%';
  segDur.textContent = (segEnd - segStart).toFixed(2) + 's';
  if (updateInputs) {
    segStartIn.value = fmtPrecise(segStart);
    segEndIn.value = fmtPrecise(segEnd);
  }
}

function updatePlayhead() {
  tlPlayhead.style.left = pctOf(previewAudio.currentTime || 0) + '%';
}

function stopPlayback() {
  previewAudio.pause();
  playMode = null;
  playSeg.classList.remove('playing');
  playSeg.textContent = '▶ 试听选段';
  playFull.classList.remove('playing');
  playFull.textContent = '▶ 播放全曲';
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function openPreview(r, opts = {}) {
  pendingClip = {
    tempPath: r.tempPath || null,
    base: r.base,
    ext: r.ext,
    fullPath: r.fullPath || '',
    fullUrl: r.fullUrl || '',
    clipUrl: r.url || null,
    onConfirmReset: opts.onConfirmReset || null,
  };
  previewName.textContent = (r.reused ? '(复用已下载音频) ' : '') + r.base + (r.ext || '');
  previewCaption.value = '';
  mediaDur = 0;
  segStart = 0;
  segEnd = 0;
  stopPlayback();
  refreshSeg();
  // 重新触发手柄脉冲提示,引导用户拖拽
  [tlStart, tlEnd].forEach((h) => {
    h.classList.remove('hint-pulse');
    void h.offsetWidth;
    h.classList.add('hint-pulse');
  });
  previewMask.classList.add('show');
  // 用整段音频(没有则退回切片)做选段
  previewAudio.src = pendingClip.fullUrl || pendingClip.clipUrl || '';
  previewAudio.load();
}

function closePreview() {
  stopPlayback();
  previewAudio.removeAttribute('src');
  previewAudio.load();
  previewMask.classList.remove('show');
}

// 读到时长后默认整段全选,等用户拖手柄/改时间
previewAudio.addEventListener('loadedmetadata', () => {
  mediaDur = previewAudio.duration || 0;
  segStart = 0;
  segEnd = mediaDur;
  tlT0.textContent = fmtClock(0);
  tlT1.textContent = fmtClock(mediaDur);
  refreshSeg();
  updatePlayhead();
});

function tick() {
  updatePlayhead();
  if (playMode === 'seg' && previewAudio.currentTime >= segEnd) {
    stopPlayback();
    previewAudio.currentTime = segStart;
    updatePlayhead();
    return;
  }
  rafId = requestAnimationFrame(tick);
}

playSeg.addEventListener('click', () => {
  if (playMode === 'seg') {
    stopPlayback();
    return;
  }
  stopPlayback();
  previewAudio.currentTime = segStart;
  playMode = 'seg';
  playSeg.classList.add('playing');
  playSeg.textContent = '⏸ 停止';
  previewAudio.play().catch(() => {});
  rafId = requestAnimationFrame(tick);
});

playFull.addEventListener('click', () => {
  if (playMode === 'full') {
    stopPlayback();
    return;
  }
  stopPlayback();
  playMode = 'full';
  playFull.classList.add('playing');
  playFull.textContent = '⏸ 停止';
  previewAudio.play().catch(() => {});
  rafId = requestAnimationFrame(tick);
});

previewAudio.addEventListener('ended', stopPlayback);

function timeFromEvent(e) {
  const rect = tlTrack.getBoundingClientRect();
  const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
  return mediaDur > 0 ? (x / rect.width) * mediaDur : 0;
}

// 点轨道空白处:跳转播放位置
tlTrack.addEventListener('mousedown', (e) => {
  if (tlStart.contains(e.target) || tlEnd.contains(e.target)) return;
  previewAudio.currentTime = timeFromEvent(e);
  updatePlayhead();
});

function startDrag(edge) {
  return (e) => {
    e.preventDefault();
    e.stopPropagation();
    tlStart.classList.remove('hint-pulse');
    tlEnd.classList.remove('hint-pulse');
    const move = (ev) => {
      const t = timeFromEvent(ev);
      if (edge === 'start') segStart = Math.min(t, segEnd - MIN_GAP);
      else segEnd = Math.max(t, segStart + MIN_GAP);
      refreshSeg();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
}
tlStart.addEventListener('mousedown', startDrag('start'));
tlEnd.addEventListener('mousedown', startDrag('end'));

// 手输时间框微调
function commitInput(which) {
  const el = which === 'start' ? segStartIn : segEndIn;
  const v = parseTime(el.value);
  if (v == null) {
    refreshSeg(); // 无效输入:还原
    return;
  }
  if (which === 'start') segStart = Math.min(v, segEnd - MIN_GAP);
  else segEnd = Math.max(v, segStart + MIN_GAP);
  refreshSeg();
}
segStartIn.addEventListener('change', () => commitInput('start'));
segEndIn.addEventListener('change', () => commitInput('end'));
segStartIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') commitInput('start'); });
segEndIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') commitInput('end'); });

// ± 细调按钮
document.querySelectorAll('.seg-row .nudge').forEach((btn) => {
  btn.addEventListener('click', () => {
    const edge = btn.dataset.edge;
    const step = Number(btn.dataset.step);
    if (edge === 'start') segStart = Math.min(Math.max(0, segStart + step), segEnd - MIN_GAP);
    else segEnd = Math.max(Math.min(mediaDur, segEnd + step), segStart + MIN_GAP);
    refreshSeg();
  });
});

// 「选取此处」:把当前播放位置设为起点/止点
document.querySelectorAll('.seg-row .pick').forEach((btn) => {
  btn.addEventListener('click', () => {
    const edge = btn.dataset.edge;
    const t = previewAudio.currentTime || 0;
    if (edge === 'start') segStart = Math.min(t, segEnd - MIN_GAP);
    else segEnd = Math.max(t, segStart + MIN_GAP);
    refreshSeg();
  });
});

previewConfirm.addEventListener('click', async () => {
  if (!pendingClip) return;
  if (!(segEnd > segStart)) {
    toast('终点要大于起点');
    return;
  }
  previewConfirm.disabled = true;
  previewConfirm.textContent = '处理中…';
  stopPlayback();
  // 按当前起止点切出片段
  const cut = await window.managerAPI.retrimClip({
    srcPath: pendingClip.fullPath || undefined,
    tempPath: pendingClip.fullPath ? undefined : pendingClip.tempPath,
    start: segStart,
    end: segEnd,
    ext: pendingClip.ext,
  });
  if (!cut.ok) {
    previewConfirm.disabled = false;
    previewConfirm.textContent = '放入素材';
    toast('失败:' + (cut.error || '未知错误'));
    return;
  }
  const r = await window.managerAPI.confirmAddClip({
    tempPath: cut.tempPath,
    base: pendingClip.base,
    ext: pendingClip.ext,
    caption: previewCaption.value.trim(),
  });
  previewConfirm.disabled = false;
  previewConfirm.textContent = '放入素材';
  const reset = pendingClip.onConfirmReset;
  if (r.ok) {
    closePreview();
    pendingClip = null;
    toast('已放入素材:' + r.file);
    if (reset) reset();
    renderLists();
  } else {
    toast('失败:' + (r.error || '未知错误'));
  }
});

previewCancel.addEventListener('click', async () => {
  if (pendingClip && pendingClip.tempPath) {
    await window.managerAPI.discardClip({ tempPath: pendingClip.tempPath });
  }
  pendingClip = null;
  closePreview();
  toast('已丢弃');
});

// 图片(支持批量)
let imageFiles = []; // [{ path, ext, base }]
const imageNameEl = document.getElementById('imageName');
const saveImageBtn = document.getElementById('saveImage');
const saveCutoutBtn = document.getElementById('saveCutout');

function baseOf(name) {
  return name.replace(/\.[^.\\/]+$/, '');
}

bindDrop(
  document.getElementById('imageDrop'),
  document.getElementById('imageInput'),
  document.getElementById('imageFile'),
  (files) => {
    imageFiles = files.map((f) => ({
      path: window.managerAPI.pathForFile(f),
      ext: extOf(f.name, '.png'),
      base: baseOf(f.name),
    }));
    const names = imageFiles.map((f) => f.base).join('、');
    document.getElementById('imageFile').textContent =
      imageFiles.length > 1 ? `${imageFiles.length} 张:${names}` : names;
    const has = imageFiles.length > 0;
    saveImageBtn.disabled = !has;
    saveCutoutBtn.disabled = !has;
  }
);

function resetImage() {
  imageFiles = [];
  imageNameEl.value = '';
  document.getElementById('imageFile').textContent = '';
  saveImageBtn.disabled = true;
  saveCutoutBtn.disabled = true;
}

// 多张时忽略自定义名(避免重名),用各自原文件名;单张时可用自定义名
function nameForFile(f, index, total) {
  const custom = imageNameEl.value.trim();
  if (custom && total === 1) return custom;
  return f.base;
}

async function runBatch(btn, label, apiFn) {
  saveImageBtn.disabled = true;
  saveCutoutBtn.disabled = true;
  const total = imageFiles.length;
  let ok = 0;
  const fails = [];
  for (let i = 0; i < imageFiles.length; i++) {
    const f = imageFiles[i];
    btn.textContent = total > 1 ? `${label}(${i + 1}/${total})` : label + '…';
    const r = await apiFn({
      srcPath: f.path,
      name: nameForFile(f, i, total),
      ext: f.ext,
    });
    if (r.ok) ok += 1;
    else fails.push(f.base + ':' + (r.error || '失败'));
  }
  btn.textContent = label;
  if (fails.length === 0) {
    toast(`已处理 ${ok} 张`);
  } else {
    toast(`成功 ${ok} 张,失败 ${fails.length} 张:${fails[0]}`);
  }
  resetImage();
  renderLists();
}

saveImageBtn.addEventListener('click', () =>
  runBatch(saveImageBtn, '保存图片', window.managerAPI.addImage)
);

saveCutoutBtn.addEventListener('click', () =>
  runBatch(saveCutoutBtn, '抠图保存（去背景，仅人物）', window.managerAPI.addImageCutout)
);

refreshDir();
window.managerAPI.getSpinFollow().then(renderSpinFollow);

const imageListEl = document.getElementById('imageList');
const audioListEl = document.getElementById('audioList');

let allAudio = []; // 供图片行的配音选择使用
let clipMapDraft = {}; // 当前编辑中的图片→音频映射
let volumesDraft = {}; // 每个音频的音量(0~1)
let scalesDraft = {}; // 每张图片的大小倍数(默认 1)
let hiddenDraft = new Set(); // 「不显示」的图片名

// 批量选择状态(按文件路径)
let selImages = new Set();
let selAudio = new Set();
let curImages = [];
let curAudio = [];
const imageDelSel = document.getElementById('imageDelSel');
const audioDelSel = document.getElementById('audioDelSel');
const imageSelAll = document.getElementById('imageSelAll');
const audioSelAll = document.getElementById('audioSelAll');
const imageMulti = document.getElementById('imageMulti');
const audioMulti = document.getElementById('audioMulti');

// 多选模式开关:默认关闭,点「多选」才显示复选框
function setMultiMode(isImage, on) {
  const btn = isImage ? imageMulti : audioMulti;
  const bar = btn.closest('.batchbar');
  const listEl = isImage ? imageListEl : audioListEl;
  btn.classList.toggle('on', on);
  btn.textContent = on ? '取消' : '多选';
  bar.classList.toggle('multi', on);
  listEl.classList.toggle('multi', on);
  if (!on) toggleAll(isImage, false); // 退出时清空选择
}

function updateBatch(isImage) {
  const sel = isImage ? selImages : selAudio;
  const cur = isImage ? curImages : curAudio;
  const btn = isImage ? imageDelSel : audioDelSel;
  const all = isImage ? imageSelAll : audioSelAll;
  const n = sel.size;
  btn.disabled = n === 0;
  btn.textContent = n ? `删除选中 (${n})` : '删除选中';
  all.checked = cur.length > 0 && n === cur.length;
  all.indeterminate = n > 0 && n < cur.length;
}

function toggleAll(isImage, on) {
  const sel = isImage ? selImages : selAudio;
  const cur = isImage ? curImages : curAudio;
  sel.clear();
  if (on) cur.forEach((it) => sel.add(it.path));
  const listEl = isImage ? imageListEl : audioListEl;
  listEl.querySelectorAll('.row').forEach((row) => {
    const cb = row.querySelector('.pickbox');
    if (cb) { cb.checked = on; row.classList.toggle('checked', on); }
  });
  updateBatch(isImage);
}

async function batchDelete(isImage) {
  const sel = isImage ? selImages : selAudio;
  if (!sel.size) return;
  const label = isImage ? '图片' : '音频';
  if (!(await confirmDialog(`确定删除选中的 ${sel.size} 个${label}?此操作不可撤销。`))) return;
  let ok = 0, fail = 0;
  for (const p of Array.from(sel)) {
    const r = await window.managerAPI.deleteAsset(p);
    if (r && r.ok) ok++; else fail++;
  }
  toast(`已删除 ${ok} 个${fail ? `,失败 ${fail} 个` : ''}`);
  renderLists();
}

imageSelAll.addEventListener('change', () => toggleAll(true, imageSelAll.checked));
audioSelAll.addEventListener('change', () => toggleAll(false, audioSelAll.checked));
imageDelSel.addEventListener('click', () => batchDelete(true));
audioDelSel.addEventListener('click', () => batchDelete(false));
imageMulti.addEventListener('click', () => setMultiMode(true, !imageMulti.classList.contains('on')));
audioMulti.addEventListener('click', () => setMultiMode(false, !audioMulti.classList.contains('on')));

// 全局静音总开关:两栏各放一个,与桌宠右键菜单的静音联动
const imageMute = document.getElementById('imageMute');
const audioMute = document.getElementById('audioMute');
function syncMute(muted) {
  [imageMute, audioMute].forEach((b) => {
    b.classList.toggle('on', muted);
    b.textContent = muted ? '🔇 已静音' : '🔊 全部静音';
  });
}
async function toggleMuteAll() {
  const muted = await window.managerAPI.toggleMute();
  syncMute(muted);
  toast(muted ? '已全部静音' : '已取消静音');
}
imageMute.addEventListener('click', toggleMuteAll);
audioMute.addEventListener('click', toggleMuteAll);
window.managerAPI.onSetMuted((e, m) => syncMute(!!m));
window.managerAPI.getMuted().then((m) => syncMute(!!m));

function saveClipMap() {
  for (const k of Object.keys(clipMapDraft)) {
    if (!Array.isArray(clipMapDraft[k]) || !clipMapDraft[k].length) delete clipMapDraft[k];
  }
  window.managerAPI.setClipMap(clipMapDraft);
}

async function renderLists() {
  const assets = await window.managerAPI.listAssets();
  allAudio = assets.audio || [];
  clipMapDraft = JSON.parse(JSON.stringify(assets.map || {}));
  volumesDraft = JSON.parse(JSON.stringify(assets.volumes || {}));
  scalesDraft = JSON.parse(JSON.stringify(assets.imageScales || {}));
  hiddenDraft = new Set(assets.hidden || []);
  curImages = assets.images || [];
  curAudio = assets.audio || [];
  selImages.clear();
  selAudio.clear();
  renderOne(imageListEl, assets.images, true);
  renderOne(audioListEl, assets.audio, false);
  updateBatch(true);
  updateBatch(false);
}

// 图片行内联配音:🎵N 计数 + 展开复选 chips
function buildImageAudioPanel(row, imgName) {
  const sel = new Set(clipMapDraft[imgName] || []);

  const badge = document.createElement('button');
  badge.className = 'assign';
  let caret = ' ▾';
  const updateBadge = () => {
    const n = sel.size;
    badge.textContent = (n ? `🎵 ${n}` : '🎵 随机全部') + caret;
    badge.classList.toggle('none', n === 0);
  };
  updateBadge();

  const panel = document.createElement('div');
  panel.className = 'audio-chips';

  if (!allAudio.length) {
    const e = document.createElement('div');
    e.className = 'chips-empty';
    e.textContent = '先添加音频';
    panel.appendChild(e);
  } else {
    allAudio.forEach((a) => {
      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = sel.has(a.name);
      label.classList.toggle('on', cb.checked);
      const span = document.createElement('span');
      span.textContent = a.name;
      cb.addEventListener('change', () => {
        if (cb.checked) sel.add(a.name);
        else sel.delete(a.name);
        label.classList.toggle('on', cb.checked);
        clipMapDraft[imgName] = Array.from(sel);
        updateBadge();
        saveClipMap();
      });
      label.appendChild(cb);
      label.appendChild(span);
      panel.appendChild(label);
    });
  }

  // 点击 🎵 徽标即可展开/收起音频选择,无需单独的展开按钮
  badge.addEventListener('click', () => {
    const open = panel.classList.toggle('show');
    caret = open ? ' ▴' : ' ▾';
    updateBadge();
  });

  return { badge, panel };
}

function renderOne(container, items, isImage) {
  container.innerHTML = '';
  if (!items.length) {
    const e = document.createElement('div');
    e.className = 'empty';
    e.textContent = '暂无';
    container.appendChild(e);
    return;
  }
  items.forEach((it) => {
    const row = document.createElement('div');
    row.className = 'row';
    const selSet = isImage ? selImages : selAudio;
    const pick = document.createElement('input');
    pick.type = 'checkbox';
    pick.className = 'pickbox';
    pick.checked = selSet.has(it.path);
    row.classList.toggle('checked', pick.checked);
    pick.addEventListener('change', () => {
      if (pick.checked) selSet.add(it.path);
      else selSet.delete(it.path);
      row.classList.toggle('checked', pick.checked);
      updateBatch(isImage);
    });
    let host = row;   // 控制按钮挂载点
    let nmHost = row; // 名字挂载点
    if (isImage) {
      row.classList.add('img-row');
      row.classList.toggle('img-hidden', hiddenDraft.has(it.name));
      const head = document.createElement('div');
      head.className = 'row-head';
      head.appendChild(pick);
      const img = document.createElement('img');
      img.src = it.url;
      head.appendChild(img);
      const ctrls = document.createElement('div');
      ctrls.className = 'row-ctrls';
      row.appendChild(head);
      row.appendChild(ctrls);
      nmHost = head;
      host = ctrls;
    } else {
      row.appendChild(pick);
    }
    const nm = document.createElement('div');
    nm.className = 'nm';
    const nmText = document.createElement('span');
    nmText.className = 'nm-text';
    nmText.textContent = it.name;
    nmText.title = it.name;
    const pen = document.createElement('span');
    pen.className = 'nm-pen';
    pen.textContent = '✎';
    nm.appendChild(nmText);
    nm.appendChild(pen);
    nmHost.appendChild(nm);

    // 点击名字(或铅笔)就地重命名
    const startRename = () => {
      if (nm.querySelector('input')) return; // 已在编辑中
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'nm-edit';
      input.value = it.name;
      nm.innerHTML = '';
      nm.appendChild(input);
      input.focus();
      input.select();
      let done = false;
      const commit = async () => {
        if (done) return;
        done = true;
        const name = input.value.trim();
        if (!name || name === it.name) { renderLists(); return; }
        const r = await window.managerAPI.renameAsset({ path: it.path, newName: name });
        toast(r.ok ? '已重命名:' + r.name : '重命名失败:' + (r.error || '未知'));
        renderLists();
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        else if (e.key === 'Escape') { e.preventDefault(); done = true; renderLists(); }
      });
      input.addEventListener('blur', commit);
    };
    nm.addEventListener('click', startRename);
    if (!isImage) {
      const play = document.createElement('button');
      play.className = 'play';
      play.textContent = '▶ 播放';
      let audio = null;
      play.addEventListener('click', () => {
        if (audio && !audio.paused) {
          audio.pause();
          audio.currentTime = 0;
          play.textContent = '▶ 播放';
          return;
        }
        audio = new Audio(it.url);
        audio.volume = volumesDraft[it.name] != null ? volumesDraft[it.name] : 1;
        play.textContent = '⏸ 停止';
        audio.addEventListener('ended', () => {
          play.textContent = '▶ 播放';
        });
        audio.play().catch(() => {
          play.textContent = '▶ 播放';
        });
      });
      host.appendChild(play);

      const vol = document.createElement('div');
      vol.className = 'vol';
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '0';
      slider.max = '1';
      slider.step = '0.05';
      const cur = volumesDraft[it.name] != null ? volumesDraft[it.name] : 1;
      slider.value = String(cur);
      const pct = document.createElement('span');
      pct.className = 'vol-pct';
      pct.textContent = Math.round(cur * 100) + '%';
      let volTimer = null;
      slider.addEventListener('input', () => {
        const v = Number(slider.value);
        pct.textContent = Math.round(v * 100) + '%';
        volumesDraft[it.name] = v;
        if (audio) audio.volume = v;
        clearTimeout(volTimer);
        volTimer = setTimeout(() => {
          window.managerAPI.setAudioVolume({ name: it.name, volume: v });
        }, 200);
      });
      vol.appendChild(slider);
      vol.appendChild(pct);
      host.appendChild(vol);
    }

    let panelEl = null;
    if (isImage) {
      const { badge, panel } = buildImageAudioPanel(row, it.name);
      host.appendChild(badge);
      panelEl = panel;

      // 试听配音:随机播放这张图配的音频(没配则随机全库),验证图声是否对应
      const prev = document.createElement('button');
      prev.className = 'play';
      prev.textContent = '▶ 试听';
      let pAudio = null;
      prev.addEventListener('click', () => {
        if (pAudio && !pAudio.paused) {
          pAudio.pause();
          pAudio.currentTime = 0;
          prev.textContent = '▶ 试听';
          return;
        }
        const mapped = clipMapDraft[it.name];
        let pool = allAudio;
        if (Array.isArray(mapped) && mapped.length) {
          const byName = allAudio.filter((a) => mapped.includes(a.name));
          if (byName.length) pool = byName;
        }
        if (!pool.length) { toast('还没有音频'); return; }
        const clip = pool[Math.floor(Math.random() * pool.length)];
        pAudio = new Audio(clip.url);
        pAudio.volume = volumesDraft[clip.name] != null ? volumesDraft[clip.name] : 1;
        prev.textContent = '⏸ 停止';
        pAudio.addEventListener('ended', () => { prev.textContent = '▶ 试听'; });
        pAudio.play().catch(() => { prev.textContent = '▶ 试听'; });
        toast('试听:' + clip.name);
      });
      host.appendChild(prev);

      // 每张图大小倍数:手写输入(0.3~2.5),实时改变桌宠该图显示尺寸
      const size = document.createElement('div');
      size.className = 'size';
      const sizeLbl = document.createElement('span');
      sizeLbl.className = 'size-lbl';
      sizeLbl.textContent = '大小';
      const sizeInput = document.createElement('input');
      sizeInput.type = 'number';
      sizeInput.className = 'size-input';
      sizeInput.min = '0.3';
      sizeInput.max = '2.5';
      sizeInput.step = '0.1';
      const curScale = scalesDraft[it.name] != null ? scalesDraft[it.name] : 1;
      sizeInput.value = String(curScale);
      const sizeUnit = document.createElement('span');
      sizeUnit.className = 'size-unit';
      sizeUnit.textContent = '倍';
      const commitScale = () => {
        let v = Number(sizeInput.value);
        if (!v || Number.isNaN(v)) v = 1;
        v = Math.min(2.5, Math.max(0.3, v));
        v = Math.round(v * 100) / 100;
        sizeInput.value = String(v);
        scalesDraft[it.name] = v;
        window.managerAPI.setImageScale({ name: it.name, scale: v });
      };
      sizeInput.addEventListener('change', commitScale);
      sizeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sizeInput.blur(); });
      size.appendChild(sizeLbl);
      size.appendChild(sizeInput);
      size.appendChild(sizeUnit);
      host.appendChild(size);

      const vis = document.createElement('button');
      vis.className = 'vis';
      const syncVis = () => {
        const hidden = hiddenDraft.has(it.name);
        vis.textContent = hidden ? '🚫 不显示' : '👁 显示中';
        vis.classList.toggle('off', hidden);
        vis.title = hidden ? '当前不会被宠物选中,点击恢复显示' : '点击后宠物不再选中此图(仍保留在素材库)';
      };
      syncVis();
      vis.addEventListener('click', async () => {
        const hidden = !hiddenDraft.has(it.name);
        if (hidden) hiddenDraft.add(it.name);
        else hiddenDraft.delete(it.name);
        row.classList.toggle('img-hidden', hidden);
        syncVis();
        await window.managerAPI.setImageHidden({ name: it.name, hidden });
      });
      nmHost.appendChild(vis);
    }

    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '删除';
    del.addEventListener('click', async () => {
      if (!(await confirmDialog(`确定删除「${it.name}」?此操作不可撤销。`))) return;
      const r = await window.managerAPI.deleteAsset(it.path);
      if (r.ok) {
        toast('已删除:' + it.name);
        renderLists();
      } else {
        toast('删除失败:' + (r.error || '未知'));
      }
    });
    host.appendChild(del);
    container.appendChild(row);
    // chips 面板独占一行,放在该图片行下方
    if (panelEl) container.appendChild(panelEl);
  });
}

renderLists();
