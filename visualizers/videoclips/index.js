const DEFAULT_VIDEO = "assets/videos/loops/loop-01.mp4";
const dataArray = new Uint8Array(512);
const BPM = 120;
const BEAT_MS = 60000 / BPM;

let video = null;
let ready = false;
let lastBeatAt = 0;
let boostUntil = 0;
let prevBassAbove = false;

function videoUrl(path) {
  return new URL("../../" + path, import.meta.url).href;
}

function ensureVideo(container, src) {
  if (video && video.src.endsWith(src)) return;
  if (video) {
    video.pause();
    video.src = "";
    video.remove();
    video = null;
    ready = false;
  }
  video = document.createElement("video");
  video.loop = true;
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.style.cssText = "display:none;width:200px;height:160px";
  video.src = videoUrl(src);
  video.oncanplay = () => { ready = true; };
  video.onerror = () => console.warn("videoclips: video failed to load", src);
  container.appendChild(video);
  video.load();
}

export function render(canvas, ctx, analyser, container, options = {}) {
  const w = canvas.width;
  const h = canvas.height;
  const videoPath = options.video || DEFAULT_VIDEO;
  ensureVideo(container, videoPath);

  if (!ready || !video) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    if (ready && video) video.play();
    return;
  }

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (vw && vh) {
    ctx.drawImage(video, 0, 0, vw, vh, 0, 0, w, h);
  }

  analyser.getByteFrequencyData(dataArray);
  const bass = dataArray[2] / 255;
  const mid = dataArray[20] / 255;
  const level = bass * 0.6 + mid * 0.4;
  const minSpeed = options.minSpeed ?? 1;
  const maxSpeed = options.maxSpeed ?? 5;
  const debounceBeats = options.debounceBeats ?? 4;
  const boostBeats = options.boostBeats ?? 0.5;
  const now = performance.now();

  const threshold = 0.6;
  const bassAbove = bass > threshold;
  const beatDetected = bassAbove && !prevBassAbove && (now - lastBeatAt) >= debounceBeats * BEAT_MS;
  prevBassAbove = bassAbove;

  if (beatDetected) {
    lastBeatAt = now;
    boostUntil = now + boostBeats * BEAT_MS;
  }

  const intensity = Math.abs(level - 0.5) * 2;
  const baseSpeed = Math.max(minSpeed, Math.min(maxSpeed, minSpeed + intensity * (maxSpeed - minSpeed)));
  const speed = now < boostUntil ? maxSpeed : baseSpeed;

  video.playbackRate = speed;
  if (video.paused) video.play();
}

export function cleanup(canvas, container) {
  if (video) {
    video.pause();
    video.src = "";
    video.remove();
    video = null;
  }
  ready = false;
  lastBeatAt = 0;
  boostUntil = 0;
  prevBassAbove = false;
}
