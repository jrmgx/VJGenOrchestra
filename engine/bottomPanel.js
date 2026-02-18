let dataArray;
let lastBass = 0;
const MID_BIN = 20;
const HIGH_BIN = 60;
const STORAGE_KEY = "vjgen-audio-options";

function loadSavedOptions() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return null;
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function saveOptions(opts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(opts));
  } catch {}
}

export function createBottomPanel(audio, analyser, container = document.body) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("bottomPanel.css", import.meta.url).href;
  document.head.appendChild(link);

  const panel = document.createElement("div");
  panel.id = "bottom-panel";

  const vizArea = document.createElement("div");
  vizArea.className = "viz-area";

  const canvas = document.createElement("canvas");
  canvas.width = 200;
  canvas.height = 56;
  canvas.title = "Bass | Mid | High bars. Red/green line = min level. Bottom strip = bass rise (orange line = min rise)";

  const kickLedWrap = document.createElement("div");
  kickLedWrap.className = "kick-led-wrap";
  const kickLed = document.createElement("div");
  kickLed.className = "kick-led";
  kickLed.title = "Kick detected";
  const kickLabel = document.createElement("small");
  kickLabel.textContent = "Kick";
  kickLedWrap.appendChild(kickLed);
  kickLedWrap.appendChild(kickLabel);

  vizArea.appendChild(canvas);
  vizArea.appendChild(kickLedWrap);

  const sliders = document.createElement("div");
  sliders.className = "sliders";

  const defaults = { kickThreshold: 0.2, kickDiff: 0.15, kickFrames: 5 };
  const saved = loadSavedOptions();
  const val = (name, def, min, max) => {
    const s = saved?.[name];
    if (typeof s !== "number" || isNaN(s)) return def;
    return Math.max(min, Math.min(max, s));
  };
  const sliderConfig = [
    ["kickThreshold", 0, 1, 0.01, val("kickThreshold", 0.2, 0, 1), "Min level", "Ignore kicks below this bass level. Filters out noise."],
    ["kickDiff", 0, 0.5, 0.01, val("kickDiff", 0.15, 0, 0.5), "Min rise", "How much bass must jump in one frame to trigger. Lower = more sensitive."],
    ["kickFrames", 1, 15, 1, val("kickFrames", 5, 1, 15), "Hold time", "How long the kick stays on (in frames). Longer = visualizers react longer."],
  ];
  const inputs = {};
  for (const [name, min, max, step, value, labelText, tooltip] of sliderConfig) {
    const label = document.createElement("label");
    label.title = tooltip;
    const span = document.createElement("span");
    span.textContent = labelText;
    const input = document.createElement("input");
    input.type = "range";
    input.name = name;
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = value;
    input.title = tooltip;
    label.appendChild(span);
    label.appendChild(input);
    sliders.appendChild(label);
    inputs[name] = input;
  }

  const saveOnChange = () => saveOptions(getOptions());
  Object.values(inputs).forEach((input) => {
    input.addEventListener("input", saveOnChange);
    input.addEventListener("change", saveOnChange);
  });

  const textInput = document.createElement("textarea");
  textInput.className = "text-input";
  textInput.placeholder = "Type text for visualizers…";
  textInput.rows = 2;

  const content = document.createElement("div");
  content.className = "bottom-panel-content";
  content.appendChild(vizArea);
  content.appendChild(sliders);
  content.appendChild(textInput);

  const fpsEl = document.createElement("span");
  fpsEl.className = "fps-display";
  fpsEl.textContent = "—";

  const toggleBtn = document.createElement("button");
  toggleBtn.className = "bottom-panel-toggle";
  toggleBtn.type = "button";
  toggleBtn.title = "Show/hide panel";
  toggleBtn.textContent = "▼";
  toggleBtn.addEventListener("click", () => {
    panel.classList.toggle("collapsed");
    toggleBtn.textContent = panel.classList.contains("collapsed") ? "▲" : "▼";
  });

  panel.appendChild(toggleBtn);
  panel.appendChild(content);
  panel.appendChild(fpsEl);
  container.appendChild(panel);

  function getOptions() {
    const num = (input, def) => {
      const v = parseFloat(input.value);
      return Number.isFinite(v) ? v : def;
    };
    return {
      kickThreshold: num(inputs.kickThreshold, defaults.kickThreshold),
      kickDiff: num(inputs.kickDiff, defaults.kickDiff),
      kickFrames: num(inputs.kickFrames, defaults.kickFrames),
    };
  }

  function getText() {
    return textInput.value;
  }

  function updateFps(value) {
    fpsEl.textContent = value ? value + " FPS" : "—";
  }

  function draw() {
    const opts = getOptions();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const targetW = Math.max(80, rect.width || 200);
    const targetH = Math.max(40, rect.height || 56);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    if (!dataArray) dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    const w = canvas.width;
    const h = canvas.height;
    if (w <= 0 || h <= 0) return;
    const barH = h - 14;
    const barW = w / 3 - 4;
    const bass = (dataArray[0] + dataArray[1] + dataArray[2] + dataArray[3] + dataArray[4]) / (5 * 255);
    const mid = dataArray[MID_BIN] / 255;
    const high = dataArray[HIGH_BIN] / 255;
    const bassDelta = Math.max(0, bass - lastBass);
    lastBass = bass;

    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, w, h);

    const drawBar = (x, val, color, dim = false) => {
      const bh = Math.max(1, val * (barH - 4));
      ctx.globalAlpha = dim ? 0.5 : 1;
      ctx.fillStyle = color;
      ctx.fillRect(x, barH - bh - 2, barW, bh);
      ctx.globalAlpha = 1;
    };

    const bassAboveThreshold = bass > opts.kickThreshold;
    drawBar(2, bass, "#0a8", !bassAboveThreshold);
    drawBar(w / 3 + 2, mid, "#f80");
    drawBar((w * 2) / 3 + 2, high, "#f0f");

    const threshY = barH - 2 - opts.kickThreshold * (barH - 4);
    ctx.strokeStyle = bassAboveThreshold ? "rgba(100,255,100,0.9)" : "rgba(255,100,100,0.8)";
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(0, threshY);
    ctx.lineTo(w, threshY);
    ctx.stroke();
    ctx.setLineDash([]);

    const riseH = 8;
    const riseY = h - riseH - 2;
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, riseY, w, riseH);
    const riseW = Math.min(1, bassDelta / 0.5) * (w - 4);
    ctx.fillStyle = bassDelta > opts.kickDiff ? "#0c8" : "#4a4a4a";
    ctx.fillRect(2, riseY + 1, riseW, riseH - 2);
    const diffX = 2 + (opts.kickDiff / 0.5) * (w - 4);
    ctx.strokeStyle = "rgba(255,200,100,0.9)";
    ctx.beginPath();
    ctx.moveTo(diffX, riseY);
    ctx.lineTo(diffX, riseY + riseH);
    ctx.stroke();

    kickLed.classList.toggle("active", !!audio.kick);
  }

  return { getOptions, getText, draw, updateFps };
}
