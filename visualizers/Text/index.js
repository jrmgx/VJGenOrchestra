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

export function render(canvas, ctx, audio, container, options = {}, engine = {}) {
  const text = options.text ?? "";
  const w = canvas.width;
  const h = canvas.height;
  if (!w || !h) return;

  const color = options.color ?? "#fff";
  const fontFamily = options.font ?? "sans-serif";

  ctx.clearRect(0, 0, w, h);
  if (!text) return;

  const pad = 0.1;
  const innerW = w * (1 - pad * 2);
  const innerH = h * (1 - pad * 2);
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\r/g, ""));
  const fontSize = findFontSize(ctx, lines, innerW, innerH, fontFamily);
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  const lineHeight = fontSize * 1.2;

  if (lines.length === 1) {
    ctx.textBaseline = "middle";
    ctx.fillText(lines[0], w / 2, h / 2);
    return;
  }

  ctx.textBaseline = "top";
  const blockH = (lines.length - 1) * lineHeight + fontSize;
  let y = (h - blockH) / 2;
  for (const line of lines) {
    ctx.fillText(line, w / 2, y);
    y += lineHeight;
  }
}
