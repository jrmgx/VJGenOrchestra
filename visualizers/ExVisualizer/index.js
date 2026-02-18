const dataArray = new Uint8Array(512);

export function render(canvas, ctx, audio, container, options = {}) {
  audio.getByteFrequencyData(dataArray);
  const bufferLength = dataArray.length;

  const w = canvas.width;
  const h = canvas.height;
  const speed = options.speed ?? 1;
  const color = options.color ?? null;
  const barWidth = (w / bufferLength) * 2.5;
  let x = 0;

  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "rgba(0,0,0,0.1)";
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";

  for (let i = 0; i < bufferLength; i++) {
    const v = dataArray[i] / 255;
    const barHeight = v * h * 0.5 * speed;
    const fillStyle = color || `rgb(${(i / bufferLength) * 255},128,${255 - (i / bufferLength) * 255})`;
    ctx.fillStyle = fillStyle;
    ctx.fillRect(x, h - barHeight, barWidth, barHeight);

    x += barWidth + 1;
  }
}
