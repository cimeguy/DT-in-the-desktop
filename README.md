# 桌面宠物 🎵

一个 macOS 桌面宠物：点击它会切换图片，并随机播放一段音频，头顶气泡显示该音频对应的台词文字。

> 素材（图片/音频）由你自己提供并仅供本地个人使用，本程序不附带任何受版权保护的内容，请勿打包分发带版权素材的版本。

## 启动 / 关闭

```bash
cd DT-in-the-desktop   # 进入项目目录
npm start                                      # 启动桌面宠物（等价于 electron .）
```

关闭：命令行按 `Ctrl+C`，或在宠物上 **右键 → 退出**。

## 环境要求

- **macOS**（窗口透明置顶等行为针对 macOS 调试；其他系统未测试）
- **Node.js** 18 或更高版本（含 `npm`）
- **ffmpeg**：音频切片 / 转码必需（用本地文件添加素材，装这一个就够了）
- **you-get**（可选）：仅在用「在线链接」作为音频来源时才需要。B 站链接走 you-get（已实测）。
- **yt-dlp**（基本不用，可不装）：只是 YouTube 等非 B 站链接的兜底，**尚未实测**；B 站和本地文件都不需要它。
- **抠图工具（可选，仅「人物去背景」功能需要）**：macOS 13+ 与 Xcode 命令行工具里的 `swiftc`（详见下方「抠图工具」）

### 一次性安装（全新 Mac 从零开始）

```bash
# 1) 如未安装 Homebrew，先装它（macOS 包管理器）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2) 安装 Node.js 和 ffmpeg（核心依赖，本地添加素材只需这些）
brew install node ffmpeg

# 3) 下载工具（可选，仅「在线链接」来源才需要）
brew install you-get    # B 站链接(已实测)
# yt-dlp 基本用不上(YouTube 等兜底,尚未实测)，需要时再装：
#   brew install yt-dlp
#   或下载官方独立二进制（更快、无额外依赖）：
#   curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos -o /opt/homebrew/bin/yt-dlp && chmod +x /opt/homebrew/bin/yt-dlp
```

验证依赖是否就绪：
```bash
node -v && ffmpeg -version | head -1     # 核心依赖
# you-get --version                      # 用在线链接时才需要
```

## 快速开始（三步）

**1. 安装项目依赖并启动宠物**
```bash
cd DT-in-the-desktop     # 进入仓库目录
npm install       # 首次运行：安装 Electron 等依赖
npm start         # 启动桌面宠物
```
点它会换图、出气泡、弹跳；音频目录为空时还没有声音。

**2. 添加语音/歌曲片段**（本地自用）
```bash
bash tools/add_clip.sh
```
按提示操作：
- 选择来源：`1` = 本地已有的音频/视频文件（可直接把文件拖进终端）；`2` = 粘贴一个 B 站 / YouTube 链接
- 输入片段起止时间（如 `1:23` 到 `1:27`，也支持纯秒数）
- 输入**这段的台词文字**（会作为宠物气泡显示，同时作为文件名）

脚本会自动切片、加淡入淡出、存进 `assets/audio/`，可循环切多段。

**2b. 自动按停顿切割整段音频**（可选，不用手动报时间）

如果你有一整段录音/音频，想让程序按「句与句之间的停顿」自动拆成小段：
```bash
bash tools/auto_split.sh <你的音频或视频文件> [静音阈值dB] [最短停顿秒]

# 例：
bash tools/auto_split.sh ~/Downloads/myrecording.m4a
# 如果切不开（连唱、底噪大），放宽参数：
bash tools/auto_split.sh ~/Downloads/myrecording.m4a -35 0.3
```
- 它用 ffmpeg 的 `silencedetect` 检测静音间隙，在停顿处切段（**不识别歌词内容**，只认声音停顿）。
- **自动定阈值**：不传第 2 个参数时，脚本会先用 `volumedetect` 测出整段平均/最大音量，按「平均再低 8dB」自动选阈值并直接采用，省得手动试。
- 结果存到 `tools/split_out/段01.mp3、段02.mp3 …`。
- 参数：**静音阈值**默认自动建议（也可手动传，越靠近 0 越严格，现场录音可放宽到 `-35`）；**最短停顿**默认 `0.45` 秒（句间停顿短就调小到 `0.3`）。
- 挑好想用的段，改名成台词并移动到素材目录：
  ```bash
  mv tools/split_out/段03.mp3 assets/audio/你想显示的台词.mp3
  ```
- 此脚本是纯 `bash + ffmpeg`，**无 AI 依赖**，可在任意装了 ffmpeg 的电脑上独立运行。

**3. 添加图片**
把图片直接放进 `assets/images/`,宠物会**自动刷新生效**(无需手动重新加载)。

> 推荐做法:在运行中的宠物上 **右键 → 管理素材**,在弹出的窗口里直接拖入图片或音频、在线链接切片、调每条音频音量、删除已有素材,增删后宠物会自动刷新,无需用终端。文件会复制到你设置的「保存目录」(首次可在该窗口里更改)。

## 交互说明

- **左键点击**:切换下一张图 + 随机播放一段音频 + 头顶气泡显示台词 + 弹跳动画
- **按住拖动**:移动宠物位置(位移超过 5px 才算拖拽,不会误触发点击)
- **Ctrl/⌘ + 滚轮**:缩放宠物大小
- **右键**:在宠物四周弹出**环形图标菜单**,点空白处关闭。各图标:
  - **管理素材** — 打开素材管理窗口
  - **静音** — 开/关声音
  - **图片大小** — 展开子菜单:放大 / 缩小 / 重置大小 / 设为默认 / 返回
  - **自启动** — 开/关开机自动启动
  - **固定此处** — 记住当前位置,下次启动回到这里
  - **退出** — 关闭程序

## 抠图工具（人物去背景）

把一张人物照抠成只剩人物的透明 PNG（适合做宠物图）。基于 macOS 自带的 Vision 人物分割，**离线、零第三方依赖**（需要 macOS 13+ 和 Xcode 命令行工具里的 `swiftc`）。

```bash
# 首次编译（生成可执行文件 tools/cutout_person）
swiftc tools/cutout_person.swift -o tools/cutout_person

# 使用：输入图 → 输出透明 PNG
tools/cutout_person 输入图.jpg 输出.png
```

抠好的 PNG 可直接在「管理素材」窗口里拖进去当宠物图。

## 打包成可安装 App

项目已配置 `electron-builder`，可打出不签名的安装包：

```bash
npm install            # 确保依赖齐全（含 electron-builder）
npm run dist:mac       # 仅 macOS：在 release/ 生成 .dmg（arm64 + x64）
npm run dist:win       # 仅 Windows：生成 .exe 安装包（在 Mac 上需先装 wine）
npm run dist           # 同时打 Mac + Win
```

产物在 `release/` 目录。

### 安装说明（发给别人时一并附上）

**macOS：** 安装包未做苹果签名/公证，首次打开会提示「无法验证开发者」。
正确打开方式：**右键点击 App 图标 → 选「打开」→ 再点「打开」**（不要直接双击）。
之后就能正常双击使用。若仍被拦，可在「系统设置 → 隐私与安全性」页点「仍要打开」，
或在终端执行：`xattr -cr "/Applications/DT-in-the-desktop.app"`。

**Windows：** 未签名会弹一次 SmartScreen 蓝色提示，点 **「更多信息」→「仍要运行」** 即可安装，不影响使用。

> 注意：Mac 的 Intel 与 Apple 芯片（M 系列）安装包不通用，发给对方时认准对应架构的 `.dmg`。

## 依赖一览

| 工具 | 用途 | 是否必需 |
|------|------|------|
| Node.js + Electron | 运行宠物窗口 | 必需 |
| ffmpeg | 音频切片 / 转码 | 必需 |
| you-get | B 站在线链接下载 | 仅「B 站链接」来源时需要(已实测) |
| yt-dlp | YouTube 等非 B 站链接下载(带进度) | 兜底,**非 B 站链接尚未实测**,可不装 |
| swiftc（Xcode CLT）+ macOS 13+ | 人物抠图去背景 | 仅用抠图功能时需要 |

安装方式见上方「环境要求」。

## 目录结构

```
DT-in-the-desktop/
├── main.js / preload.js     桌面宠物外壳（透明、无边框、置顶窗口）
├── renderer/                渲染层：换图 / 播音 / 气泡 / 拖拽 / 右键菜单
│   ├── index.html
│   ├── renderer.js
│   └── style.css
├── assets/
│   ├── images/              图片目录（自带「小黑」风格形象 xiaohei_*.svg）
│   ├── images_backup/       原彩色圆脸形象备份（想换回把文件挪回 images/）
│   ├── audio/               音频目录（文件名 = 气泡台词）
│   └── README.md            素材命名规范与说明
└── tools/
    ├── add_clip.sh          交互式音频切片入库工具（手动指定时间段 / 在线链接）
    └── auto_split.sh         按静音停顿自动切割整段音频
```

## 版权与合规

- 受版权保护的素材（如歌曲、采访片段、官方照片）**仅可本地个人使用，不得分发**。即使只用几秒也可能构成侵权，切勿上传或打包发布。
- 如需可公开分发的版本，请改用免版权 / CC0 素材（图片：Pexels、Pixabay；音频：耳聆网、爱给网等），工具流程完全相同。
- 素材的获取与选取由使用者自行操作并自负其责。
