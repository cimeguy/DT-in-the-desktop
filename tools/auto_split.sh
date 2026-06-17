#!/usr/bin/env bash
# 按静音停顿自动切割音频（不理解歌词，只检测声音间隙）
#
# 用法：
#   bash tools/auto_split.sh <音频或视频文件> [静音阈值dB] [最短静音秒]
# 例：
#   bash tools/auto_split.sh ~/Downloads/myrecording.m4a
#   bash tools/auto_split.sh ~/Downloads/myrecording.m4a -30 0.5
#
# 输出：切好的片段放在 tools/split_out/ 下，命名为 段01.mp3、段02.mp3 ...
# 你听过后，把想用的段改名成「想显示的台词.mp3」拖进 assets/audio/ 即可。
#
# 仅供处理你本人拥有或已授权的素材；受版权内容请勿分发。

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/tools/split_out"

err() { printf '\033[31m%s\033[0m\n' "$*" >&2; }
ok()  { printf '\033[32m%s\033[0m\n' "$*"; }

command -v ffmpeg  >/dev/null 2>&1 || { err "缺少 ffmpeg：brew install ffmpeg"; exit 1; }
command -v ffprobe >/dev/null 2>&1 || { err "缺少 ffprobe（随 ffmpeg 安装）"; exit 1; }

SRC="${1:-}"
SRC="${SRC/#\~/$HOME}"
SRC="$(printf '%s' "$SRC" | sed "s/^['\"]//; s/['\"]$//")"
[ -n "$SRC" ] && [ -f "$SRC" ] || { err "用法: bash tools/auto_split.sh <文件> [阈值dB] [最短静音秒]"; exit 1; }

NOISE="${2:--30}"      # 静音判定阈值，越接近 0 越严格（-30dB 较通用）
MINSIL="${3:-0.45}"    # 多长的停顿才算一句分隔（秒）
MINSEG=0.6             # 小于这个时长的碎段丢弃（秒）

mkdir -p "$OUT"; rm -f "$OUT"/段*.mp3 2>/dev/null || true

DUR="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SRC")"

# 先用 volumedetect 测一下整段音量，给个阈值建议（纯 ffmpeg，不依赖 AI）
VOL_LOG="$(ffmpeg -nostdin -i "$SRC" -af volumedetect -f null - 2>&1 || true)"
MEAN_VOL="$(printf '%s\n' "$VOL_LOG" | grep -o 'mean_volume: [-0-9.]*' | awk '{print $2}')"
MAX_VOL="$(printf '%s\n' "$VOL_LOG"  | grep -o 'max_volume: [-0-9.]*'  | awk '{print $2}')"
if [ -n "$MEAN_VOL" ]; then
  # 建议阈值 = 平均音量再低 8dB（比平均更安静的地方才算停顿）
  SUGGEST="$(awk -v m="$MEAN_VOL" 'BEGIN{printf "%.0f", m-8}')"
  ok "整段音量: 平均 ${MEAN_VOL}dB  最大 ${MAX_VOL}dB  → 建议阈值约 ${SUGGEST}dB"
  if [ "$#" -lt 2 ]; then
    NOISE="$SUGGEST"
    ok "(未手动指定阈值，已自动采用建议值 ${NOISE}dB；想覆盖就传第2个参数)"
  fi
fi

ok "源时长: ${DUR}s  | 静音阈值: ${NOISE}dB  | 最短停顿: ${MINSIL}s"
ok "正在检测停顿..."

# 用 silencedetect 找出所有静音的起止时间
LOG="$(ffmpeg -nostdin -i "$SRC" -af "silencedetect=noise=${NOISE}dB:d=${MINSIL}" -f null - 2>&1 || true)"

# 收集静音区间（silence_start / silence_end）—— bash 3.2 兼容，不用 mapfile
SIL_START=(); SIL_END=()
while IFS= read -r v; do [ -n "$v" ] && SIL_START+=("$v"); done < <(printf '%s\n' "$LOG" | grep -o 'silence_start: [0-9.]*' | awk '{print $2}')
while IFS= read -r v; do [ -n "$v" ] && SIL_END+=("$v"); done < <(printf '%s\n' "$LOG" | grep -o 'silence_end: [0-9.]*' | awk '{print $2}')

# 由静音区间反推出"有声片段"的边界：片段 = 上一个静音结束 → 下一个静音开始
boundaries_start=(0)
boundaries_end=()
n=${#SIL_START[@]}
for ((i=0; i<n; i++)); do
  boundaries_end+=("${SIL_START[$i]}")
  if [ -n "${SIL_END[$i]:-}" ]; then boundaries_start+=("${SIL_END[$i]}"); fi
done
boundaries_end+=("$DUR")

idx=0
for ((i=0; i<${#boundaries_start[@]}; i++)); do
  s="${boundaries_start[$i]}"; e="${boundaries_end[$i]:-$DUR}"
  len="$(awk -v a="$s" -v b="$e" 'BEGIN{printf "%.3f", b-a}')"
  keep="$(awk -v l="$len" -v m="$MINSEG" 'BEGIN{print (l>=m)?1:0}')"
  [ "$keep" = "1" ] || continue
  idx=$((idx+1))
  out="$(printf '%s/段%02d.mp3' "$OUT" "$idx")"
  ffmpeg -nostdin -y -i "$SRC" -ss "$s" -to "$e" \
    -af "afade=t=in:st=0:d=0.05,afade=t=out:st=$(awk -v l="$len" 'BEGIN{printf "%.3f",(l-0.15>0)?l-0.15:0}'):d=0.15" \
    -c:a libmp3lame -q:a 3 "$out" >/dev/null 2>&1 \
    && printf '  段%02d  %6.2fs ~ %6.2fs  (%.2fs)\n' "$idx" "$s" "$e" "$len"
done

echo "-----------------------------------------"
if [ "$idx" -eq 0 ]; then
  err "没切出片段。试着调参数：阈值放宽(如 -35)，或减小最短停顿(如 0.3)："
  err "  bash tools/auto_split.sh \"$SRC\" -35 0.3"
else
  ok "完成！共 $idx 段，已存到: $OUT"
  ok "下一步：听一听，把想要的段改名为「台词.mp3」并移动到 assets/audio/，例如："
  echo "  mv \"$OUT/段03.mp3\" \"$ROOT/assets/audio/你想显示的台词.mp3\""
  ok "然后启动宠物，右键 -> 重新加载素材。"
fi
