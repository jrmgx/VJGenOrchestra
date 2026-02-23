export const postProcess = true;

function ensureBuffer(state, w, h) {
  if (state.acc?.width === w && state.acc?.height === h) return;
  state.acc = new OffscreenCanvas(w, h);
  state.accCtx = state.acc.getContext("2d");
  state.initialized = false;
}

export function render(canvas, ctx, audio, container, options = {}, engine, sourceCanvas) {
  const state = container.visualizerState;
  const { width, height } = canvas;
  if (!width || !height) return;

  const blendMode = options.blendMode ?? "lighten";

  if (!sourceCanvas || sourceCanvas.width === 0 || sourceCanvas.height === 0) {
    ctx.clearRect(0, 0, width, height);
    return;
  }

  ensureBuffer(state, width, height);

  if (!state.initialized) {
    state.accCtx.drawImage(sourceCanvas, 0, 0);
    state.initialized = true;
  }

  const decay = 0.83;

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = decay;
  ctx.drawImage(state.acc, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = blendMode;
  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.globalCompositeOperation = "source-over";

  state.accCtx.globalCompositeOperation = "source-over";
  state.accCtx.drawImage(canvas, 0, 0);
}

export function cleanup(canvas, container, slot) {
  const state = container.visualizerState;
  if (!state) return;
  state.acc = null;
  state.accCtx = null;
  state.initialized = false;
  if (canvas?.width && canvas?.height) {
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}
