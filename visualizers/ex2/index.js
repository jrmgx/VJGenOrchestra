const dataArray = new Uint8Array(1024);
let t = 0;

export function render(canvas, ctx, analyser) {
  analyser.getByteTimeDomainData(dataArray);

  const w = canvas.width;
  const h = canvas.height;
  let maxAmp = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const d = Math.abs(dataArray[i] - 128);
    if (d > maxAmp) maxAmp = d;
  }
  const scale = 1 + (maxAmp / 128) * 0.5;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(scale, scale);
  ctx.rotate((t++ * 0.5 * Math.PI) / 180);

  const n = 12;
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    const r = Math.min(w, h) * 0.3;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(x, y);
    ctx.strokeStyle = `hsl(${(i / n) * 360}, 80%, 60%)`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  ctx.restore();
}
