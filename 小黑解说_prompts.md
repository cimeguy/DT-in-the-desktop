# 小黑解说图 · 生成 Prompt 集

为 David Tao 桌面宠物项目准备的 6 张小黑风格解说图，逐张生成（在 Codex / 任意文生图环境里把对应代码块整段粘贴即可）。出完图建议放进 `assets/小黑解说/`，再写进 `小黑解说.md` 排版。

顺序：主视觉 → ①点击三输出 → ②文件名=台词 → ③按停顿切 → ④量分贝定阈值 → ⑤版权红线。

---

## 主视觉 · 桌宠本体（小黑歌手）

```text
Generate one standalone 16:9 horizontal Chinese article illustration.

Visual DNA:
Pure white background. Minimalist black hand-drawn line art with slightly wobbly pen lines. Lots of empty white space (at least 35% blank). Sparse handwritten Chinese annotations. Clean, absurd, product-sketch feeling. No gradients, no shadows, no paper texture, no PPT infographic look, no cute mascot poster, no children's illustration, no realistic UI, no app screenshot.

Recurring IP character (core actor):
小黑, a small solid-black creature with white dot eyes, tiny thin legs, a blank deadpan expression, slightly uneven hand-drawn body. Not cute. Here 小黑 is a tiny desktop pet living in a small floating window.

Theme:
A singing desktop-pet. One click on 小黑 makes it do three things at once: switch its picture, sing out a sound, and pop a speech-bubble line above its head.

Structure type: 概念隐喻 (single hero scene)

Core idea:
小黑 is a deadpan little singer pet floating on the desktop; a cursor-hand pokes it, and one poke triggers three outputs together.

Composition:
Center: 小黑 standing inside a small frameless floating window outline, holding a tiny microphone, mouth open singing. A cursor-hand pokes 小黑 from the side. Three orange lines fan out from 小黑 to three small outputs: (1) a swapped new face card, (2) a music note for the sound, (3) a speech bubble above its head. Keep everything sparse with one calm blank area.

Suggested elements:
tiny microphone / music note / speech bubble above head / cursor-hand poking / small floating-window outline

Chinese handwritten labels:
点一下 / 换图 / 唱一句 / 台词气泡

Color use:
Black for 小黑 and all main line art. Orange for the three output arrows/flow. Red only for one key accent (the poke or the bubble). Blue optional for the floating-window hint.

Constraints:
One image, one core idea. Main subject 40%-60% of canvas, keep 35% blank white. At most 6 short handwritten Chinese labels. No title in the top-left corner. Do not write the structure type on the image. Hand-drawn, clean, strange but readable, not childish.
```

---

## ① 一次点击，三样东西同时弹出

```text
Generate one standalone 16:9 horizontal Chinese article illustration.

Visual DNA:
Pure white background. Minimalist black hand-drawn line art with slightly wobbly pen lines. Lots of empty white space (at least 35% blank). Sparse handwritten Chinese annotations. Clean, absurd, product-sketch feeling. No gradients, no shadows, no paper texture, no PPT infographic look, no cute mascot poster, no children's illustration, no realistic UI.

Recurring IP character (core actor):
小黑, a small solid-black creature with white dot eyes, tiny thin legs, a blank deadpan expression, slightly uneven hand-drawn body. Not cute.

Theme:
One click on the desktop pet triggers three outputs at the same time.

Structure type: 概念隐喻

Core idea:
小黑 is a desktop pet; a single poke makes three different things pop out together.

Composition:
Center: 小黑 squats on top of a big quirky low-tech push-button. A cursor-hand presses the button down. Three orange lines shoot out from 小黑 toward three small outputs arranged around it: a new face card (switch image), a music note (play sound), and a speech bubble (caption line). One calm blank area at a corner.

Suggested elements:
big push-button / cursor-hand pressing / new face card / music note / speech bubble

Chinese handwritten labels:
点一下 / 换图 / 出声 / 台词

Color use:
Black for 小黑 and main line art. Orange for the three output lines. Red only for the press point. Blue optional.

Constraints:
One image, one core idea. Main subject 40%-60% of canvas, keep 35% blank white. At most 6 short handwritten Chinese labels. No top-left title. Hand-drawn, clean, strange but readable, not childish.
```

---

## ② 文件名就是台词

```text
Generate one standalone 16:9 horizontal Chinese article illustration.

Visual DNA:
Pure white background. Minimalist black hand-drawn line art with slightly wobbly pen lines. Lots of empty white space (at least 35% blank). Sparse handwritten Chinese annotations. Clean, absurd, product-sketch feeling. No gradients, no shadows, no paper texture, no PPT infographic look, no cute mascot poster, no children's illustration, no realistic UI.

Recurring IP character (core actor):
小黑, a small solid-black creature with white dot eyes, tiny thin legs, a blank deadpan expression, slightly uneven hand-drawn body. Not cute.

Theme:
The audio file's name is literally the spoken line shown in the bubble.

Structure type: 概念隐喻 / 系统局部

Core idea:
Rename the file = change the line, no config needed.

Composition:
Center-left: 小黑 pushes a labeled audio cassette into a small low-tech machine. The handwritten text on the cassette label floats up out of the machine and turns into a speech bubble above. An orange flow runs from the label up into the bubble. Keep one blank quiet area on the right.

Suggested elements:
labeled cassette / small machine slot / speech bubble / 小黑 pushing

Chinese handwritten labels:
文件名 / =台词 / 改名就改词 / 不用配置

Color use:
Black for 小黑 and main line art. Orange for the flow from label to bubble. Red only for one key accent. Blue optional.

Constraints:
One image, one core idea. Main subject 40%-60% of canvas, keep 35% blank white. At most 6 short handwritten Chinese labels. No top-left title. Hand-drawn, clean, strange but readable, not childish.
```

---

## ③ 按静音停顿切音频

```text
Generate one standalone 16:9 horizontal Chinese article illustration.

Visual DNA:
Pure white background. Minimalist black hand-drawn line art with slightly wobbly pen lines. Lots of empty white space (at least 35% blank). Sparse handwritten Chinese annotations. Clean, absurd, product-sketch feeling. No gradients, no shadows, no paper texture, no PPT infographic look, no cute mascot poster, no children's illustration, no realistic UI.

Recurring IP character (core actor):
小黑, a small solid-black creature with white dot eyes, tiny thin legs, a blank deadpan expression, slightly uneven hand-drawn body. Not cute.

Theme:
Auto-split audio only at the silent pauses, not by understanding lyrics.

Structure type: 系统局部

Core idea:
小黑 cuts a long waveform only at its flat quiet gaps.

Composition:
A long horizontal sound waveform across the canvas with tall busy bumps and flat low quiet gaps. 小黑 stands inside one flat quiet gap holding big scissors, snipping the waveform exactly at the dips, ignoring the loud bumps. Red marks at the cut points. Keep a blank area above.

Suggested elements:
long waveform / flat quiet gaps / big scissors / cut marks

Chinese handwritten labels:
只在停顿处剪 / 不懂歌词 / 静音=低谷 / -30dB

Color use:
Black for 小黑 and the waveform. Red only for the cut points. Orange optional for a small pointer. Blue optional.

Constraints:
One image, one core idea. Main subject 40%-60% of canvas, keep 35% blank white. At most 6 short handwritten Chinese labels. No top-left title. Hand-drawn, clean, strange but readable, not childish.
```

---

## ④ 先量分贝，自动定阈值

```text
Generate one standalone 16:9 horizontal Chinese article illustration.

Visual DNA:
Pure white background. Minimalist black hand-drawn line art with slightly wobbly pen lines. Lots of empty white space (at least 35% blank). Sparse handwritten Chinese annotations. Clean, absurd, product-sketch feeling. No gradients, no shadows, no paper texture, no PPT infographic look, no cute mascot poster, no children's illustration, no realistic UI.

Recurring IP character (core actor):
小黑, a small solid-black creature with white dot eyes, tiny thin legs, a blank deadpan expression, slightly uneven hand-drawn body. Not cute.

Theme:
Measure the overall loudness first, then auto-pick a threshold.

Structure type: 概念隐喻

Core idea:
小黑 weighs the sound on a decibel scale and the needle suggests a threshold.

Composition:
Center: 小黑 holds up a quirky low-tech scale / round meter marked in decibels, weighing a small blob of sound placed on the pan. The needle points to a suggested dashed threshold line drawn in blue. Orange needle. Keep one calm blank area.

Suggested elements:
decibel meter / sound blob on a pan / pointer needle / dashed suggested line

Chinese handwritten labels:
先量平均音量 / 平均再低8dB / 自动定阈值

Color use:
Black for 小黑 and the meter. Orange for the needle. Blue for the dashed suggested threshold line. Red only if one accent is needed.

Constraints:
One image, one core idea. Main subject 40%-60% of canvas, keep 35% blank white. At most 6 short handwritten Chinese labels. No top-left title. Hand-drawn, clean, strange but readable, not childish.
```

---

## ⑤ 版权红线：本地自用 vs 对外分发

```text
Generate one standalone 16:9 horizontal Chinese article illustration.

Visual DNA:
Pure white background. Minimalist black hand-drawn line art with slightly wobbly pen lines. Lots of empty white space (at least 35% blank). Sparse handwritten Chinese annotations. Clean, absurd, product-sketch feeling. No gradients, no shadows, no paper texture, no PPT infographic look, no cute mascot poster, no children's illustration, no realistic UI.

Recurring IP character (core actor):
小黑, a small solid-black creature with white dot eyes, tiny thin legs, a blank deadpan expression, slightly uneven hand-drawn body. Not cute.

Theme:
Copyrighted material stays for local use only; only original / CC0 material may be shared.

Structure type: 前后对比

Core idea:
小黑 is a deadpan gatekeeper deciding what is allowed out the door.

Composition:
A small "local" house on the left with a doorway; 小黑 stands at the door as a gatekeeper. Inside the house, copyrighted material (marked red) stays locked in. Through the door, original / CC0 material (marked orange) is allowed out along an orange path to be shared. Keep a blank area on the right.

Suggested elements:
small house / doorway / 小黑 gatekeeper / red copyrighted items kept inside / orange CC0 items going out

Chinese handwritten labels:
本地自用 / 有版权→留本地 / 原创CC0→才能出门 / 可分发

Color use:
Black for 小黑 and main line art. Red for the copyrighted/blocked items. Orange for the allowed outgoing path. Blue optional.

Constraints:
One image, one core idea. Main subject 40%-60% of canvas, keep 35% blank white. At most 6 short handwritten Chinese labels. No top-left title. Hand-drawn, clean, strange but readable, not childish.
```

---

## 出图后建议命名

```
assets/小黑解说/00-主视觉.png
assets/小黑解说/01-点击三输出.png
assets/小黑解说/02-文件名等于台词.png
assets/小黑解说/03-按停顿切.png
assets/小黑解说/04-量分贝定阈值.png
assets/小黑解说/05-版权红线.png
```

出完把图放进上面目录，我负责写 `小黑解说.md` 把图与文字排好版。
