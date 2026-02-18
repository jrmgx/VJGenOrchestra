function findFontSize(ctx, lines, w, h, fontFamily, bold) {
  const lineHeight = 1.2;
  let best = 8;
  let lo = 8;
  let hi = Math.floor(Math.min(w, h) * 0.5);
  while (lo <= hi) {
    const fontSize = Math.floor((lo + hi) / 2);
    ctx.font = `${bold ? "bold " : ""}${fontSize}px ${fontFamily}`;
    let totalH = 0;
    let fits = true;
    for (const line of lines) {
      if (ctx.measureText(line).width > w) fits = false;
      totalH += fontSize * lineHeight;
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
  const text = engine.text ?? "";
  const w = canvas.width;
  const h = canvas.height;
  if (!w || !h) return;

  const color = options.color ?? "#fff";
  const fontFamily = options.font ?? "sans-serif";
  const bold = options.bold !== false;

  ctx.clearRect(0, 0, w, h);
  if (!text) return;

  const lines = text.split("\n");
  const fontSize = findFontSize(ctx, lines, w, h, fontFamily, bold);
  ctx.font = `${bold ? "bold " : ""}${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const lineHeight = fontSize * 1.2;
  const totalHeight = lines.length * lineHeight;
  let y = (h - totalHeight) / 2 + lineHeight / 2;

  for (const line of lines) {
    ctx.fillText(line, w / 2, y);
    y += lineHeight;
  }
}
