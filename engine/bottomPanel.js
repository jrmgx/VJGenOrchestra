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

export async function createBottomPanel(audio, analyser, container = document.body, opts = {}) {
  const { effects = [] } = opts;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("bottomPanel.css", import.meta.url).href;
  document.head.appendChild(link);

  const htmlUrl = new URL("bottomPanel.html", import.meta.url).href;
  const html = await fetch(htmlUrl + "?t=" + Date.now()).then((r) => r.text());
  const wrap = document.createElement("div");
  wrap.innerHTML = html.trim();
  const panel = wrap.firstElementChild;
  container.appendChild(panel);

  const canvas = panel.querySelector("#bottom-panel-canvas");
  const kickLed = panel.querySelector(".kick-led");
  const toggleBtn = panel.querySelector(".bottom-panel-toggle");
  const automixCheck = panel.querySelector("#automix-check");
  const vizSelect = panel.querySelector("#automix-viz-select");
  const postSelect = panel.querySelector("#automix-post-select");

  const defaults = { kickThreshold: 0.2, kickDiff: 0.15, kickFrames: 5 };
  const saved = loadSavedOptions();
  const val = (name, def, min, max) => {
    const s = saved?.[name];
    if (typeof s !== "number" || isNaN(s)) return def;
    return Math.max(min, Math.min(max, s));
  };

  const inputs = {
    kickThreshold: panel.querySelector('input[name="kickThreshold"]'),
    kickDiff: panel.querySelector('input[name="kickDiff"]'),
    kickFrames: panel.querySelector('input[name="kickFrames"]'),
  };
  inputs.kickThreshold.value = val("kickThreshold", 0.2, 0, 1);
  inputs.kickDiff.value = val("kickDiff", 0.15, 0, 0.5);
  inputs.kickFrames.value = val("kickFrames", 5, 1, 15);

  const saveOnChange = () => saveOptions(getOptions());
  Object.values(inputs).forEach((input) => {
    input.addEventListener("input", saveOnChange);
    input.addEventListener("change", saveOnChange);
  });

  const visualizers = effects.filter((e) => !e.postProcess);
  const postProcessors = effects.filter((e) => e.postProcess);
  visualizers.forEach((e) => {
    const opt = document.createElement("option");
    opt.value = e.id;
    opt.textContent = e.name;
    vizSelect.appendChild(opt);
  });
  postProcessors.forEach((e) => {
    const opt = document.createElement("option");
    opt.value = e.id;
    opt.textContent = e.name;
    postSelect.appendChild(opt);
  });

  toggleBtn.addEventListener("click", () => {
    panel.classList.toggle("collapsed");
    toggleBtn.textContent = panel.classList.contains("collapsed") ? "▲" : "▼";
  });

  function getAutomixState() {
    const vizSelected = [...vizSelect.selectedOptions].map((o) => o.value);
    const postSelected = [...postSelect.selectedOptions].map((o) => o.value);
    return {
      enabled: automixCheck.checked,
      visualizerIds: vizSelected,
      postProcessorIds: postSelected,
    };
  }

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

  return { getOptions, draw, getAutomixState };
}
