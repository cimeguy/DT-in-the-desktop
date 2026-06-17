#!/usr/bin/env bash
# 陶喆桌面宠物 - 音频切片入库工具（仅供个人本地使用）
#
# 用法：bash tools/add_clip.sh
# 它会引导你：选源(本地文件或链接) -> 选时间段 -> 起台词名 -> 自动切片放进 assets/audio/
#
# 依赖：ffmpeg（必需）、yt-dlp（仅当你用在线链接时需要）

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AUDIO_DIR="$ROOT/assets/audio"
TMP_DIR="$ROOT/tools/.tmp"
mkdir -p "$AUDIO_DIR" "$TMP_DIR"

err() { printf '\033[31m%s\033[0m\n' "$*" >&2; }
ok()  { printf '\033[32m%s\033[0m\n' "$*"; }
ask() { local p="$1"; local v; read -r -p "$p" v; printf '%s' "$v"; }

command -v ffmpeg >/dev/null 2>&1 || { err "未找到 ffmpeg，请先安装：brew install ffmpeg"; exit 1; }

# 把任意文字清洗成安全文件名（保留中英文数字，空格转下划线）
sanitize() {
  printf '%s' "$1" | tr -d '/\\:*?"<>|' | sed 's/^ *//; s/ *$//; s/  */_/g'
}

echo "========================================="
echo "  陶喆桌面宠物 · 音频切片入库工具"
echo "  (仅供个人本地使用，请勿分发版权内容)"
echo "========================================="

SRC_TYPE="$(ask '素材来源? 1=本地音频/视频文件  2=在线链接(B站/YouTube): ')"

SOURCE_AUDIO=""
if [ "$SRC_TYPE" = "1" ]; then
  FILE="$(ask '请输入本地文件的完整路径(可直接把文件拖进终端): ')"
  FILE="${FILE/#\~/$HOME}"
  FILE="$(printf '%s' "$FILE" | sed "s/^['\"]//; s/['\"]$//")"   # 去掉拖拽产生的引号
  [ -f "$FILE" ] || { err "文件不存在: $FILE"; exit 1; }
  SOURCE_AUDIO="$FILE"
elif [ "$SRC_TYPE" = "2" ]; then
  command -v yt-dlp >/dev/null 2>&1 || { err "未找到 yt-dlp，请先安装：brew install yt-dlp"; exit 1; }
  URL="$(ask '粘贴视频链接: ')"
  ok "正在下载音频(最佳音质)..."
  rm -f "$TMP_DIR"/dl.*
  yt-dlp -x --audio-format mp3 -o "$TMP_DIR/dl.%(ext)s" "$URL"
  SOURCE_AUDIO="$(ls -t "$TMP_DIR"/dl.* 2>/dev/null | head -1)"
  [ -n "$SOURCE_AUDIO" ] && [ -f "$SOURCE_AUDIO" ] || { err "下载失败"; exit 1; }
  ok "下载完成: $SOURCE_AUDIO"
else
  err "无效选择"; exit 1
fi

DUR="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SOURCE_AUDIO" 2>/dev/null || echo '?')"
echo "源音频时长: ${DUR} 秒"

# 循环切多段
while true; do
  echo "-----------------------------------------"
  START="$(ask '片段开始时间 (格式 mm:ss 或 秒，如 1:23 或 83): ')"
  END="$(ask '片段结束时间 (同上): ')"
  CAPTION="$(ask '这段的台词文字(将作为气泡显示 & 文件名): ')"
  SAFE="$(sanitize "$CAPTION")"
  [ -n "$SAFE" ] || { err "台词不能为空"; continue; }

  OUT="$AUDIO_DIR/$SAFE.mp3"
  # 若重名则加序号
  i=1
  while [ -e "$OUT" ]; do OUT="$AUDIO_DIR/${SAFE}_$i.mp3"; i=$((i+1)); done

  ffmpeg -nostdin -y -i "$SOURCE_AUDIO" -ss "$START" -to "$END" \
    -af "afade=t=in:st=0:d=0.15,afade=t=out:st=0:d=0.15" \
    -c:a libmp3lame -q:a 3 "$OUT" >/dev/null 2>&1 \
    && ok "已生成: $(basename "$OUT")" \
    || { err "切片失败，请检查时间格式"; continue; }

  MORE="$(ask '继续从同一素材切下一段? (y/N): ')"
  case "$MORE" in y|Y) ;; *) break;; esac
done

# 清理临时下载文件
rm -f "$TMP_DIR"/dl.* 2>/dev/null || true

echo "========================================="
ok "完成！打开宠物后右键 -> 重新加载素材即可生效。"
ls -1 "$AUDIO_DIR" | grep -v '^\.' || true
