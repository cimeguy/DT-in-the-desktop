const dirPathEl = document.getElementById('dirPath');
const toastEl = document.getElementById('toast');

let audioPath = null;
let audioExt = '.mp3';

function extOf(name, fallback) {
  const m = /\.[^.\\/]+$/.exec(name || '');
  return m ? m[0].toLowerCase() : fallback;
}

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 1800);
}

async function refreshDir() {
  dirPathEl.textContent = await window.managerAPI.getUserDir();
}

document.getElementById('chooseDir').addEventListener('click', async () => {
  dirPathEl.textContent = await window.managerAPI.chooseUserDir();
  renderLists();
});

document.getElementById('openDir').addEventListener('click', () => {
  window.managerAPI.openUserDir();
});

// 通用拖拽区绑定
function bindDrop(dropEl, inputEl, fileLabel, onPick) {
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
  dropEl.addEventListener('click', () => inputEl.click());
  inputEl.addEventListener('change', () => {
    const files = Array.from(inputEl.files);
    if (files.length) onPick(files);
  });
}

// 音频(单个)
bindDrop(
  document.getElementById('audioDrop'),
  document.getElementById('audioInput'),
  document.getElementById('audioFile'),
  (files) => {
    const file = files[0];
    audioPath = window.managerAPI.pathForFile(file);
    audioExt = extOf(file.name, '.mp3');
    document.getElementById('audioFile').textContent = file.name;
    updateAudioBtn();
  }
);

const captionEl = document.getElementById('caption');
const saveAudioBtn = document.getElementById('saveAudio');
function updateAudioBtn() {
  saveAudioBtn.disabled = !(audioPath && captionEl.value.trim());
}
captionEl.addEventListener('input', updateAudioBtn);

saveAudioBtn.addEventListener('click', async () => {
  saveAudioBtn.disabled = true;
  const r = await window.managerAPI.addAudio({
    srcPath: audioPath,
    caption: captionEl.value.trim(),
    ext: audioExt,
  });
  if (r.ok) {
    toast('已添加音频:' + r.file);
    audioPath = null;
    captionEl.value = '';
    document.getElementById('audioFile').textContent = '';
    renderLists();
  } else {
    toast('失败:' + (r.error || '未知错误'));
  }
  updateAudioBtn();
});

// 从链接切片
const clipUrl = document.getElementById('clipUrl');
const clipStart = document.getElementById('clipStart');
const clipEnd = document.getElementById('clipEnd');
const clipCaption = document.getElementById('clipCaption');
const saveClipBtn = document.getElementById('saveClip');

function updateClipBtn() {
  saveClipBtn.disabled = !(
    clipUrl.value.trim() &&
    clipStart.value.trim() &&
    clipEnd.value.trim()
  );
}
[clipUrl, clipStart, clipEnd, clipCaption].forEach((el) =>
  el.addEventListener('input', updateClipBtn)
);

saveClipBtn.addEventListener('click', async () => {
  saveClipBtn.disabled = true;
  saveClipBtn.textContent = '处理中…(下载+切片)';
  const r = await window.managerAPI.addAudioFromUrl({
    url: clipUrl.value.trim(),
    start: clipStart.value.trim(),
    end: clipEnd.value.trim(),
    caption: clipCaption.value.trim(),
  });
  saveClipBtn.textContent = '下载并切片';
  if (r.ok) {
    toast('已添加音频:' + r.file);
    clipUrl.value = '';
    clipStart.value = '';
    clipEnd.value = '';
    clipCaption.value = '';
    renderLists();
  } else {
    toast('失败:' + (r.error || '未知错误'));
  }
  updateClipBtn();
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

const imageListEl = document.getElementById('imageList');
const audioListEl = document.getElementById('audioList');

async function renderLists() {
  const assets = await window.managerAPI.listAssets();
  renderOne(imageListEl, assets.images, true);
  renderOne(audioListEl, assets.audio, false);
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
    if (isImage) {
      const img = document.createElement('img');
      img.src = it.url;
      row.appendChild(img);
    }
    const nm = document.createElement('div');
    nm.className = 'nm';
    nm.textContent = it.name;
    row.appendChild(nm);
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '删除';
    del.addEventListener('click', async () => {
      if (!window.confirm(`确定删除「${it.name}」?`)) return;
      const r = await window.managerAPI.deleteAsset(it.path);
      if (r.ok) {
        toast('已删除:' + it.name);
        renderLists();
      } else {
        toast('删除失败:' + (r.error || '未知'));
      }
    });
    row.appendChild(del);
    container.appendChild(row);
  });
}

renderLists();

document.getElementById('reloadPet').addEventListener('click', () => {
  window.managerAPI.reloadPet();
  toast('已刷新老大素材');
});
