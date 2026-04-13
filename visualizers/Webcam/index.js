function drawCover(ctx, video, w, h, mirror) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;
  const scale = Math.max(w / vw, h / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const dx = (w - dw) / 2;
  const dy = (h - dh) / 2;
  ctx.save();
  if (mirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, vw, vh, dx, dy, dw, dh);
  ctx.restore();
}

function ensureWebcam(container, state) {
  if (state.stream || state.streamPromise) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    state.error = true;
    return;
  }
  state.captureId = (state.captureId || 0) + 1;
  const myId = state.captureId;
  state.streamPromise = navigator.mediaDevices
    .getUserMedia({ video: true, audio: false })
    .then((stream) => {
      state.streamPromise = null;
      if (myId !== state.captureId) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      state.stream = stream;
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.setAttribute("playsinline", "");
      video.style.cssText = "display:none;width:1px;height:1px";
      video.srcObject = stream;
      state.video = video;
      container.appendChild(video);
      video.onloadedmetadata = () => {
        if (myId === state.captureId) state.ready = true;
      };
      return video.play();
    })
    .catch(() => {
      state.streamPromise = null;
      if (myId === state.captureId) state.error = true;
    });
}

export function render(canvas, ctx, audio, container, options = {}) {
  const state = (container.visualizerState ??= {});
  const w = canvas.width;
  const h = canvas.height;
  const mirror = options.mirror !== false;

  if (!state.error) ensureWebcam(container, state);

  if (state.error || !state.ready || !state.video) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    return;
  }

  const vw = state.video.videoWidth;
  const vh = state.video.videoHeight;
  if (vw && vh) {
    drawCover(ctx, state.video, w, h, mirror);
  }
  if (state.video.paused) state.video.play();
}

export function cleanup(canvas, container, slot) {
  const state = container.visualizerState;
  if (!state) return;
  state.captureId = (state.captureId || 0) + 1;
  if (state.video) {
    state.video.pause();
    state.video.srcObject = null;
    state.video.remove();
    state.video = null;
  }
  if (state.stream) {
    state.stream.getTracks().forEach((t) => t.stop());
    state.stream = null;
  }
  state.streamPromise = null;
  state.ready = false;
  state.error = false;
}
