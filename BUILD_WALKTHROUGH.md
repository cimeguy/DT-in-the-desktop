# 桌面宠物 Demo 制作全过程（可复用模板）

这份文档记录了从零做出这个「点击换图 + 播放音效 + 气泡台词」桌面宠物的完整过程，下次你可以照着自己做一个（换主题、换素材即可）。

---

## 0. 成品长什么样

一个透明、无边框、永远置顶的小窗口，里面是一个卡通形象：
- **左键点击** → 切换下一张图 + 随机播放一段音效 + 头顶气泡显示台词 + 弹跳动画
- **按住拖动** → 移动位置（位移 >5px 才算拖拽，避免误触）
- **右键** → 菜单（重新加载素材 / 退出）

技术栈：**Electron**（用网页技术做桌面 App），素材放在 `assets/` 目录，程序自动扫描。

---

## 1. 环境准备

```bash
# macOS 包管理器（已有可跳过）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

brew install node ffmpeg      # node 跑 Electron；ffmpeg 处理音频
# yt-dlp 可选，仅当你要从在线链接下载音频时才需要
```

---

## 2. 项目骨架

```
DT-in-the-desktop/
├── package.json        # 项目配置 + 启动脚本
├── main.js             # Electron 主进程：建窗口、扫描素材、IPC
├── preload.js          # 安全桥：把主进程能力暴露给网页层
├── renderer/           # 网页层（实际的宠物界面）
│   ├── index.html
│   ├── style.css
│   └── renderer.js
├── assets/
│   ├── images/         # 图片（png/jpg/gif/webp/svg）
│   └── audio/          # 音频（mp3/wav/ogg/m4a/aac）
└── tools/
    └── add_clip.sh     # 音频切片入库工具
```

### 2.1 package.json

```json
{
  "name": "DT-in-the-desktop",
  "version": "1.0.0",
  "main": "main.js",
  "scripts": { "start": "electron ." },
  "devDependencies": { "electron": "^33.0.0" }
}
```

然后 `npm install` 安装 Electron。

### 2.2 核心思路

- **main.js**：创建一个 `transparent: true, frame: false, alwaysOnTop: true` 的窗口，加载 `renderer/index.html`；并提供 `scanAssets()` 扫描 `assets/images` 和 `assets/audio` 返回文件列表（每个含 `name` 文件名和 `url` 的 `file://` 地址）。通过 `ipcMain.handle('get-assets', ...)` 等暴露给网页层；右键菜单用 `Menu.buildFromTemplate` + `menu.popup()`。
- **preload.js**：用 `contextBridge.exposeInMainWorld('petAPI', {...})` 把 `getAssets / getWindowPos / setWindowPos / showContextMenu / onReloadAssets` 这几个方法安全地挂到网页的 `window.petAPI` 上。
- **renderer.js**：调用 `window.petAPI.getAssets()` 拿素材；点击时换图 + 用 `new Audio(url).play()` 播音 + 显示气泡；拖拽用 `getWindowPos()` + 鼠标位移调 `setWindowPos()`；区分点击/拖拽靠位移阈值（>5px 算拖拽）。

> 关键约定（接口契约）：preload 暴露的 `window.petAPI` 方法名和签名，必须和 renderer 里调用的一致。先把这份契约定好，主进程和界面就能各自独立开发。

---

## 3. 素材的关键设计：文件名 = 台词

程序扫描音频时取「文件名去扩展名」作为气泡显示文字。所以：

```
assets/audio/你好呀.mp3   →  点击播放时气泡显示「你好呀」
```

这样不用写任何配置，给文件改名就改台词，非常灵活。

---

## 4. 生成「零版权」素材（本 Demo 的做法）

为了能放心分享，本 Demo 的素材全部是**本地原创/合成**的：

### 4.1 图片：手写 SVG 卡通形象

直接写 SVG（矢量、清晰、体积小），用渐变圆做脸 + 简单五官。例如：

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
  <circle cx="120" cy="120" r="110" fill="#5ab9ea" stroke="#fff" stroke-width="6"/>
  <circle cx="92" cy="108" r="13" fill="#23303a"/>
  <circle cx="148" cy="108" r="13" fill="#23303a"/>
  <path d="M96 150 Q120 172 144 150" stroke="#23303a" stroke-width="7" fill="none" stroke-linecap="round"/>
</svg>
```

换不同颜色/表情存成多个文件，点击就会循环切换。
（注意：要让程序识别 svg，`main.js` 的 `IMAGE_EXT` 数组里要加上 `'.svg'`。）

### 4.2 音频：用 ffmpeg 合成原创音效

用正弦波拼出小旋律（3 个音符串接 + 淡入淡出），完全原创无版权：

```bash
cd assets/audio
ffmpeg -nostdin -y \
  -f lavfi -i "sine=frequency=261.63:duration=0.38" \
  -f lavfi -i "sine=frequency=329.63:duration=0.38" \
  -f lavfi -i "sine=frequency=392.00:duration=0.38" \
  -filter_complex "[0][1][2]concat=n=3:v=0:a=1,volume=0.5,afade=t=in:d=0.04,afade=t=out:st=0.96:d=0.18" \
  -c:a libmp3lame -q:a 4 "你好呀.mp3"
```

- `sine=frequency=...` 生成某个音高的纯音（C4=261.63, E4=329.63, G4=392 …）
- `concat=n=3` 把 3 个音符接起来
- `afade` 加淡入淡出更柔和
- 文件名「你好呀」就是气泡台词

---

## 5. 用自己的素材（在原创之外）

写了个交互脚本 `tools/add_clip.sh`，把「下载 → 切片 → 命名 → 入库」自动化：

```bash
bash tools/add_clip.sh
# 选 1=本地文件 / 2=在线链接
# 输入起止时间(如 1:23 到 1:27) 和 台词文字
# 自动切片存进 assets/audio/
```

底层就两步：
```bash
yt-dlp -x --audio-format mp3 -o out.mp3 "链接"        # 在线链接才需要
ffmpeg -i 源文件 -ss 开始 -to 结束 -c:a libmp3lame 片段.mp3   # 切片
```

### 5.1 按停顿自动切割：`tools/auto_split.sh`

不想手动报时间，可以让程序按「句间停顿」自动拆段。原理是 ffmpeg 的 `silencedetect`：

```bash
# 检测静音区间（noise=阈值, d=最短静音时长）
ffmpeg -i 源文件 -af "silencedetect=noise=-30dB:d=0.45" -f null - 2>&1
```

它会输出一串 `silence_start: X` / `silence_end: Y`。脚本解析这些时间点，反推出"有声片段"的边界（片段 = 上一段静音结束 → 下一段静音开始），再用 `ffmpeg -ss/-to` 逐段切出来。

```bash
bash tools/auto_split.sh <音频文件> [静音阈值dB] [最短停顿秒]
# 切不开就放宽：bash tools/auto_split.sh file.m4a -35 0.3
```

要点：
- **只认声音停顿，不识别歌词内容**——切点≈换气/停顿处，不保证等于一句歌词。
- **自动定阈值**：不传第 2 个参数时，脚本先用 `volumedetect` 测整段平均/最大音量（`mean_volume / max_volume`），按「平均再低 8dB」自动选阈值，省得手动试。手动传参可覆盖。
- 纯 `bash + ffmpeg`，**无 AI 依赖**，可在任意装了 ffmpeg 的电脑独立运行。
- macOS 自带 bash 是 3.2，**不能用 `mapfile`**，要用 `while read` 读进数组（这是个常见坑）。

---

## 6. 运行与验证

```bash
npm start
```

放好新素材后，右键宠物 →「重新加载素材」即可生效，无需重启。

---

## 7. 版权红线（重要）

- 受版权的歌曲、MV、演唱会录音、官方照片：**只能本地个人使用，绝不可打包分发**。即使只用几秒、即使是你自己在演唱会拍的视频——里面的**词曲和表演权仍属原作者**，不因你举着手机录就归你。
- **要分享给别人的版本**：素材必须全部是「你自己原创」或「免版权/CC0」（图片 Pexels/Pixabay，音频 耳聆网/Freepd 等），就像本 Demo 这样。
- 工具（ffmpeg/yt-dlp）本身是合法的；是否抓取版权内容、用途是否合规，由使用者自行负责。

---

## 8. 想换个主题怎么做？（下次照这个改）

1. 复制本项目目录，改个名。
2. 把 `assets/images/` 换成你的新形象图。
3. 把 `assets/audio/` 换成你的新音效（文件名写成你要显示的台词）。
4. `npm start` 即可。

主程序（main/preload/renderer）基本不用动——它只是个「扫描素材 + 点击播放」的通用外壳。
