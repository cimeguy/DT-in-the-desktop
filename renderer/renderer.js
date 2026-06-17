const imgEl = document.getElementById('petImg');
const bubble = document.getElementById('bubble');
const hint = document.getElementById('hint');
const pet = document.getElementById('pet');

let assets = { images: [], audio: [] };
let currentAudio = null;
let bubbleTimer = null;

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function loadAssets() {
  assets = await window.petAPI.getAssets();
  if (assets.images.length > 0) {
    hint.style.display = 'none';
    imgEl.src = pick(assets.images).url;
  } else {
    hint.style.display = 'block';
    imgEl.removeAttribute('src');
  }
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

function onClickPet() {
  bounce();
  if (assets.images.length > 0) {
    imgEl.src = pick(assets.images).url;
  }
  if (assets.audio.length > 0) {
    const clip = pick(assets.audio);
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    currentAudio = new Audio(clip.url);
    currentAudio.play().catch(() => {});
    showBubble(clip.name);
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
  window.petAPI.showContextMenu();
});

window.petAPI.onReloadAssets(() => loadAssets());

loadAssets();
