export const postProcess = true;

const METRICS = {
  hue: { min: -180, max: 180 },
  saturation: { min: 0, max: 300 },
  brightness: { min: 20, max: 300 },
  contrast: { min: 100, max: 300 },
};

function initState(state) {
  if (state.initialized) return;
  state.initialized = true;
  state.lastKick = false;
  state.current = {};
  state.target = {};
  Object.keys(METRICS).forEach((key) => {
    state.current[key] = null;
    state.target[key] = null;
  });
}

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

export function render(canvas, ctx, audio, container, options = {}, engine, sourceCanvas) {
  const state = container.visualizerState;
  initState(state);

  if (!sourceCanvas || sourceCanvas.width === 0 || sourceCanvas.height === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const kick = !!audio.kick;
  const kickRisingEdge = kick && !state.lastKick;
  state.lastKick = kick;

  if (!state.lastTime) state.lastTime = performance.now();
  const now = performance.now();
  const dt = Math.min(0.05, (now - state.lastTime) / 1000);
  state.lastTime = now;

  const lerpFactor = 1 - Math.exp(-30 * dt);

  Object.entries(METRICS).forEach(([key, range]) => {
    const optionValue = toNumber(options[key], key === "hue" ? 0 : 100);
    const reactive = !!options[`${key}Reactive`];

    if (state.current[key] === null) state.current[key] = optionValue;
    if (state.target[key] === null) state.target[key] = optionValue;

    if (!reactive) {
      state.target[key] = optionValue;
    } else if (kickRisingEdge) {
      state.target[key] = randomInRange(range.min, range.max);
    }

    state.current[key] += (state.target[key] - state.current[key]) * lerpFactor;
  });

  const safeBrightness = Math.max(20, state.current.brightness);
  const safeContrast = Math.max(100, state.current.contrast);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.filter = `hue-rotate(${state.current.hue}deg) saturate(${state.current.saturation}%) brightness(${safeBrightness}%) contrast(${safeContrast}%)`;
  ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
  ctx.filter = "none";
}

export function cleanup(canvas, container, slot) {
  const state = container.visualizerState;
  Object.keys(state).forEach((key) => delete state[key]);
}
