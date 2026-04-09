function findFontSize(ctx, lines, w, h, fontFamily) {
  const lineGap = 1.2;
  let best = 8;
  let lo = 8;
  let hi = Math.floor(Math.min(w, h) * 0.5);
  while (lo <= hi) {
    const fontSize = Math.floor((lo + hi) / 2);
    ctx.font = `${fontSize}px ${fontFamily}`;
    let totalH =
      lines.length <= 1
        ? fontSize
        : (lines.length - 1) * fontSize * lineGap + fontSize;
    let fits = true;
    for (const line of lines) {
      if (ctx.measureText(line).width > w) fits = false;
    }
    if (totalH > h) fits = false;
    if (fits) {
      best = fontSize;
      lo = fontSize + 1;
    } else {
      hi = fontSize - 1;
    }
  }
  return best;
}

function drawTextLine(ctx, line, x, y, mode) {
  if (mode === "fill") {
    ctx.fillText(line, x, y);
    return;
  }
  ctx.strokeText(line, x, y);
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillText(line, x, y);
  ctx.globalCompositeOperation = prev;
}

export function render(canvas, ctx, audio, container, options = {}, engine = {}) {
  const text = options.text ?? "";
  const w = canvas.width;
  const h = canvas.height;
  if (!w || !h) return;

  const color = options.color ?? "#fff";
  const fontFamily = options.font ?? "sans-serif";
  const mode = options.outline === false ? "fill" : "outline";
  const outlineScale = 0.12;
  let activeFontFamily = fontFamily;
  let activeMode = mode;
  let activeColor = color;
  const state = container.visualizerState || (container.visualizerState = {});

  if (options.reactiveFont) {
    if (state.fontPoolSource !== options.fontPool) {
      state.fontPoolSource = options.fontPool;
      try {
        const parsed = JSON.parse(options.fontPool || "[]");
        state.fontPool = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      } catch {
        state.fontPool = [];
      }
    }
    if (!state.fontPool?.length) state.fontPool = [fontFamily];
    if (!state.reactiveFontFamily) state.reactiveFontFamily = state.fontPool[0];
    const kick = audio?.kick ? 1 : 0;
    if (kick && !state.lastKickFont) {
      const i = Math.floor(Math.random() * state.fontPool.length);
      state.reactiveFontFamily = state.fontPool[i] || fontFamily;
    }
    state.lastKickFont = kick;
    activeFontFamily = state.reactiveFontFamily || fontFamily;
  }

  if (options.reactiveColor) {
    const kick = audio?.kick ? 1 : 0;
    if (!state.reactiveColor) {
      state.reactiveColor = color;
    }
    if (kick && !state.lastKickColor) {
      const hue = Math.floor(Math.random() * 360);
      state.reactiveColor = `hsl(${hue}, 100%, 50%)`;
    }
    state.lastKickColor = kick;
    activeColor = state.reactiveColor;
  } else {
    state.reactiveColor = color;
  }

  if (options.outlineReactive) {
    const kick = audio?.kick ? 1 : 0;
    if (typeof state.reactiveOutlineEnabled !== "boolean") {
      state.reactiveOutlineEnabled = mode === "outline";
    }
    if (kick && !state.lastKickOutline) {
      state.reactiveOutlineEnabled = Math.random() > 0.5;
    }
    state.lastKickOutline = kick;
    activeMode = state.reactiveOutlineEnabled ? "outline" : "fill";
  } else {
    state.reactiveOutlineEnabled = mode === "outline";
  }

  ctx.clearRect(0, 0, w, h);
  if (!text) return;

  const pad = 0.1;
  const innerW = w * (1 - pad * 2);
  const innerH = h * (1 - pad * 2);
  const allLines = text.split(/\r?\n/).map((line) => line.replace(/\r/g, ""));
  let lines = allLines;

  if (options.reactiveText) {
    const state = container.visualizerState || (container.visualizerState = {});
    if (!Array.isArray(state.reactiveLines) || state.reactiveSource !== text) {
      state.reactiveSource = text;
      state.reactiveLines = allLines.length ? allLines : [""];
      state.reactiveIndex = 0;
      state.lastKick = 0;
    }
    const kick = audio?.kick ? 1 : 0;
    if (kick && !state.lastKick) {
      state.reactiveIndex = (state.reactiveIndex + 1) % state.reactiveLines.length;
    }
    state.lastKick = kick;
    lines = [state.reactiveLines[state.reactiveIndex] ?? ""];
  }

  const fontSize = findFontSize(ctx, lines, innerW, innerH, activeFontFamily);
  ctx.font = `${fontSize}px ${activeFontFamily}`;
  const lineHeight = fontSize * 1.2;
  const blockH = lines.length === 1 ? fontSize : (lines.length - 1) * lineHeight + fontSize;
  const maxLineW = Math.max(...lines.map((line) => ctx.measureText(line).width), 1);
  const occupancy = Math.max(maxLineW / innerW, blockH / innerH);
  const strokeW = Math.min(
    fontSize * 0.45,
    Math.max(1, (fontSize * outlineScale) / Math.max(0.35, occupancy))
  );

  ctx.fillStyle = activeColor;
  ctx.strokeStyle = activeColor;
  ctx.lineWidth = strokeW;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.textAlign = "center";

  if (lines.length === 1) {
    ctx.textBaseline = "middle";
    drawTextLine(ctx, lines[0], w / 2, h / 2, activeMode);
    return;
  }

  ctx.textBaseline = "top";
  let y = (h - blockH) / 2;
  for (const line of lines) {
    drawTextLine(ctx, line, w / 2, y, activeMode);
    y += lineHeight;
  }
}
