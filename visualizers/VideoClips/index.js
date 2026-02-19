const DEFAULT_VIDEO = "assets/videos/loops/loop-01.mp4";
const BPM = 120;
const BEAT_MS = 60000 / BPM;

function videoUrl(path) {
  return new URL("../../" + path, import.meta.url).href;
}

function ensureVideo(container, src, state) {
  if (state.video && state.video.src.endsWith(src)) return;
  if (state.video) {
    state.video.pause();
    state.video.src = "";
    state.video.remove();
    state.video = null;
    state.ready = false;
  }
  state.video = document.createElement("video");
  state.video.loop = true;
  state.video.preload = "auto";
  state.video.muted = true;
  state.video.playsInline = true;
  state.video.style.cssText = "display:none;width:200px;height:160px";
  state.video.src = videoUrl(src);
  state.video.oncanplay = () => { state.ready = true; };
  state.video.onerror = () => console.warn("videoclips: video failed to load", src);
  container.appendChild(state.video);
  state.video.load();
}

export function render(canvas, ctx, audio, container, options = {}) {
  const state = container.visualizerState;
  const w = canvas.width;
  const h = canvas.height;
  const videoPath = options.video || DEFAULT_VIDEO;
  ensureVideo(container, videoPath, state);

  if (!state.ready || !state.video) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    if (state.ready && state.video) state.video.play();
    return;
  }

  const vw = state.video.videoWidth;
  const vh = state.video.videoHeight;
  if (vw && vh) {
    ctx.drawImage(state.video, 0, 0, vw, vh, 0, 0, w, h);
  }

  const bass = audio.bass ?? 0;
  const mid = audio.mid ?? 0;
  const level = bass * 0.6 + mid * 0.4;
  const minSpeed = options.minSpeed ?? 1;
  const maxSpeed = options.maxSpeed ?? 5;
  const boostBeats = options.boostBeats ?? 0.5;
  const now = performance.now();

  if (audio.kick) state.boostUntil = now + boostBeats * BEAT_MS;

  const intensity = Math.abs(level - 0.5) * 2;
  const baseSpeed = Math.max(minSpeed, Math.min(maxSpeed, minSpeed + intensity * (maxSpeed - minSpeed)));
  const speed = now < state.boostUntil ? maxSpeed : baseSpeed;

  state.video.playbackRate = speed;
  if (state.video.paused) state.video.play();
}

export function cleanup(canvas, container, slot) {
  const state = container.visualizerState;
  if (!state) return;
  if (state.video) {
    state.video.pause();
    state.video.src = "";
    state.video.remove();
    state.video = null;
  }
  state.ready = false;
  state.boostUntil = 0;
}
