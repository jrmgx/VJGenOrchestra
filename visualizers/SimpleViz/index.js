const freqData = new Uint8Array(512);
const timeData = new Uint8Array(1024);

export function render(canvas, ctx, audio, container, options = {}) {
  const w = canvas.width;
  const h = canvas.height;
  const speed = options.speed ?? 0.5;
  const color = options.color ?? null;
  const mode = options.mode ?? "bar";
  const colorRotate = options.colorRotate !== false;

  const state = (container.visualizerState ??= {});
  state.hue = (state.hue ?? 0) + 1;
  if (state.hue >= 360) state.hue = 0;
  const hue = state.hue;

  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "rgba(0,0,0,0.1)";
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";

  const getColor = (i, n) =>
    colorRotate ? `hsl(${(hue + (i / n) * 360) % 360},100%,60%)` : color || `rgb(${(i / n) * 255},128,${255 - (i / n) * 255})`;

  if (mode === "oscilloscope") {
    audio.analyser.getByteTimeDomainData(timeData);
    const bufferLength = timeData.length;
    const amplitude = speed * h * 0.5;
    const sliceWidth = w / bufferLength;

    ctx.beginPath();
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = (timeData[i] - 128) / 128;
      const y = h / 2 + v * amplitude;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.strokeStyle = colorRotate ? `hsl(${hue},100%,60%)` : color || "#8080ff";
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    audio.getByteFrequencyData(freqData);
    const bufferLength = freqData.length;
    const barWidth = (w / bufferLength) * 2.5;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = freqData[i] / 255;
      const barHeight = v * h * 0.5 * speed;
      ctx.fillStyle = getColor(i, bufferLength);
      ctx.fillRect(x, h / 2 - barHeight / 2, barWidth, barHeight);
      x += barWidth + 1;
    }
  }
}
