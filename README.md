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

按用途分两类:**开发/运行** 和 **打包**。

**系统**
- **macOS**(窗口透明置顶等行为针对 macOS 调试;其他系统未测试)

**① 开发 / 运行宠物(必需)**
- **Node.js** 18 或更高版本(含 `npm`)
- **Electron** —— 不用单独装,`npm install` 会按 `package.json` 自动装好(`^33.0.0`)
- **ffmpeg** —— 音频切片 / 转码必需(用本地文件添加素材,装这一个就够了)

**② 打包成安装包(打 DMG / exe 时需要)**
- **electron-builder** —— 不用单独装,`npm install` 会自动装好(`^25.1.8`,在 devDependencies 里)
- **ffmpeg** —— 同上,打包前确保素材已处理好
- **wine**(仅在 Mac 上打 **Windows** 安装包时需要;只打 macOS DMG 不用)

**③ 用「在线链接」加素材(用到此功能则必需)**
- **you-get** —— 从在线链接(尤其 **B 站**)下载音频必需;B 站对 yt-dlp 有 412 风控,**只能靠 you-get**。只要你用在线链接来源,这一项就是必需的(仅纯本地文件添加素材时可不装)。

**④ 可选工具(用到对应功能才装)**
- **yt-dlp** —— YouTube 等非 B 站链接的兜底,**尚未实测**,基本可不装
- **swiftc(Xcode 命令行工具)+ macOS 13+** —— 仅「人物去背景」抠图功能需要(详见下方「抠图工具」)

### 一次性安装（全新 Mac 从零开始）

```bash
# 1) 如未安装 Homebrew，先装它（macOS 包管理器）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2) 安装 Node.js 和 ffmpeg（开发/运行/打包都要用的核心依赖）
brew install node ffmpeg

# 3) 安装项目内依赖(Electron + electron-builder，开发和打包都靠它)
cd DT-in-the-desktop && npm install

# 4) 可选:在 Mac 上打 Windows 安装包才需要 wine（只打 macOS DMG 可跳过）
brew install --cask wine-stable

# 5) 用「在线链接」来源必需(B 站只能靠 you-get)
brew install you-get    # B 站链接(已实测)
# yt-dlp 基本用不上(YouTube 等兜底,尚未实测)，需要时再装：
#   brew install yt-dlp
#   或下载官方独立二进制（更快、无额外依赖）：
#   curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos -o /opt/homebrew/bin/yt-dlp && chmod +x /opt/homebrew/bin/yt-dlp
```

验证依赖是否就绪：
```bash
node -v && npm -v                        # 开发/打包核心
ffmpeg -version | head -1                # 音频处理核心
npx electron-builder --version           # 打包工具(npm install 后可用)
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

### 自己从零构建 DMG（无需 AI，照抄即可）

在项目根目录依次执行下面这几条命令，就能打出 macOS 安装包：

```bash
cd DT-in-the-desktop          # 1) 进入项目目录
npm install                   # 2) 安装依赖（首次或依赖更新后才需要）
pkill -f electron 2>/dev/null # 3) 关掉正在运行的宠物（没开着可忽略报错）
rm -rf release                # 4) 清掉上次的打包产物，避免残留
npm run dist:mac              # 5) 打包，生成 arm64 + x64 两个 .dmg
ls -lh release/*.dmg          # 6) 查看产物
```

打完会在 `release/` 看到两个文件：

- `DT-in-the-desktop-<版本号>-arm64.dmg` —— Apple 芯片（M 系列）用
- `DT-in-the-desktop-<版本号>.dmg` —— Intel 芯片用

> 想改版本号：编辑根目录 `package.json` 里的 `"version"`（如改成 `1.1.0`），再重新执行上面第 5 步，文件名里的版本号会自动跟着变。


### 安装说明（发给别人时一并附上）

**macOS：** 安装包未做苹果签名/公证，首次打开会提示「无法验证开发者」「来自身份不明的开发者」。
这是正常现象（只是没花钱买苹果签名），**任选下面一种方法打开一次即可，之后正常双击使用**：

- **方法 A（最简单）右键打开**：右键点击 App 图标 → 选「打开」→ 弹窗里再点「打开」（不要直接双击）。
- **方法 B 系统设置里「仍要打开」**（新版 macOS Ventura/Sonoma 推荐）：
  1. **先双击一次** App，被拦下后点「完成/取消」关掉弹窗（这一步是为了让系统记录下来）；
  2. 打开 **系统设置 → 隐私与安全性**，往下滚到「安全性」区域；
  3. 会看到一行「已阻止使用"DT-in-the-desktop"，因为来自身份不明的开发者」，点右边的 **「仍要打开」**；
  4. 弹窗里再点一次 **「仍要打开」**，按提示输密码/指纹即可。
     （⚠️ 必须先双击被拦一次，这一行提示才会出现。）
- **方法 C 终端命令**：`xattr -cr "/Applications/DT-in-the-desktop.app"`，之后双击即可打开。

**Windows：** 未签名会弹一次 SmartScreen 蓝色提示，点 **「更多信息」→「仍要运行」** 即可安装，不影响使用。

> 注意：Mac 的 Intel 与 Apple 芯片（M 系列）安装包不通用，发给对方时认准对应架构的 `.dmg`。

## 依赖一览

| 工具 | 用途 | 阶段 | 是否必需 |
|------|------|------|------|
| Node.js + npm | 运行 npm / 启动 / 打包的基础 | 开发 + 打包 | 必需 |
| Electron(`npm install` 自动装) | 运行宠物窗口 | 开发 | 必需 |
| electron-builder(`npm install` 自动装) | 打 DMG / exe 安装包 | 打包 | 打包时必需 |
| ffmpeg | 音频切片 / 转码 | 开发(处理素材) | 必需 |
| wine | 在 Mac 上打 Windows 安装包 | 打包 | 仅打 Win 包时需要 |
| you-get | B 站在线链接下载 | 开发(在线链接) | 用在线链接来源时**必需**(B 站只能靠它,已实测) |
| yt-dlp | YouTube 等非 B 站链接下载(带进度) | 开发(可选) | 兜底,**非 B 站链接尚未实测**,可不装 |
| swiftc（Xcode CLT）+ macOS 13+ | 人物抠图去背景 | 开发(可选) | 仅用抠图功能时需要 |

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

## 🚧 敬请期待（v1.1.0）

- 新增 "imok"（I'm OK）语音
- 新增 "sorry 我不在" 语音
- 新增 "小包包了包" 语音
- 新增「绿色的呕吐的豹」音频 + 图像
- 为新语音配上抽象风格的气泡台词
