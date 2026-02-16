const dataArray = new Uint8Array(512);

export function render(canvas, ctx, analyser) {
  analyser.getByteFrequencyData(dataArray);
  const bufferLength = dataArray.length;

  const w = canvas.width;
  const h = canvas.height;
  const barWidth = (w / bufferLength) * 2.5;
  let x = 0;

  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "rgba(0,0,0,0.1)";
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";

  for (let i = 0; i < bufferLength; i++) {
    const v = dataArray[i] / 255;
    const barHeight = v * h * 0.5;
    const r = (i / bufferLength) * 255;
    const g = 128;
    const b = 255 - r;

    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x, h - barHeight, barWidth, barHeight);

    x += barWidth + 1;
  }
}
