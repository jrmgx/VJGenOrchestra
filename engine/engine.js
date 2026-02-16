import { start as startMic } from "./audio.js";
import { createOffscreenCanvas, createMainCanvas } from "./canvas.js";

const startBtn = document.querySelector("#start");
const app = document.querySelector("#app");
const controls = document.querySelector("#controls");

async function loadEffects() {
  const manifestUrl = new URL("../visualizers/manifest.json", import.meta.url);
  const ids = await fetch(manifestUrl + "?t=" + Date.now()).then((r) => r.json());
  const baseUrl = new URL("../visualizers/", import.meta.url).href;
  const effects = [];
  for (const id of ids) {
    try {
      const mod = await import(`../visualizers/${id}/index.js?t=${Date.now()}`);
      const optionsUrl = new URL(`${id}/options.html`, baseUrl).href;
      const optionsRes = await fetch(optionsUrl).catch(() => null);
      const hasOptions = optionsRes?.ok;
      effects.push({
        id,
        name: id,
        render: mod.render,
        cleanup: mod.cleanup,
        optionsUrl: hasOptions ? optionsUrl : null,
      });
    } catch (e) {
      console.error(`Failed to load visualizer "${id}":`, e);
    }
  }
  return effects;
}

function extractOptions(doc) {
  if (!doc) return {};
  const options = {};
  for (const el of doc.querySelectorAll("input, select, textarea")) {
    const key = el.name || el.id;
    if (!key) continue;
    if (el.type === "checkbox") options[key] = el.checked;
    else if (el.type === "file") options[key] = el.files?.[0] ?? null;
    else if (el.type === "number" || el.type === "range")
      options[key] = parseFloat(el.value) || 0;
    else options[key] = el.value;
  }
  return options;
}

function setupOptionsListeners(slot, optionsContainer) {
  const update = () => {
    slot.options = extractOptions(optionsContainer.contentDocument || optionsContainer);
  };
  const doc = optionsContainer.contentDocument || optionsContainer;
  doc.addEventListener("change", update);
  doc.addEventListener("input", update);
  update();
}

startBtn.addEventListener("click", async () => {
  startBtn.style.display = "none";
  app.style.display = "block";

  const [effects, { analyser }] = await Promise.all([loadEffects(), startMic()]);

  const optionsBox = document.createElement("div");
  optionsBox.id = "options-box";
  optionsBox.style.cssText =
    "position:absolute;top:1rem;right:1rem;z-index:2;max-height:80vh;overflow-y:auto;pointer-events:auto";
  app.insertBefore(optionsBox, controls);

  const offscreenLayer = document.createElement("div");
  offscreenLayer.id = "offscreen-layer";
  offscreenLayer.style.cssText = "position:absolute;left:-9999px;top:0;width:100%;height:100%;pointer-events:none";
  app.insertBefore(offscreenLayer, controls);

  const mainWrapper = document.createElement("div");
  mainWrapper.className = "main-canvas-wrapper";
  mainWrapper.style.cssText = "position:absolute;inset:0";
  app.insertBefore(mainWrapper, offscreenLayer);

  const { canvas: mainCanvas, ctx: mainCtx, resize: resizeMain } = createMainCanvas(mainWrapper);

  const slots = effects.map((effect) => {
    const { canvas, ctx, resize } = createOffscreenCanvas();
    const container = document.createElement("div");
    container.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
    offscreenLayer.appendChild(container);

    let active = false;

    return {
      effect,
      container,
      canvas,
      ctx,
      resize,
      options: {},
      optionsSection: null,
      get active() {
        return active;
      },
      set active(v) {
        active = v;
      },
    };
  });

  function getOutputCanvas(slot) {
    const canvases = slot.container.querySelectorAll("canvas");
    return canvases.length > 0 ? canvases[canvases.length - 1] : slot.canvas;
  }

  function loop() {
    const { width, height } = app.getBoundingClientRect();
    resizeMain(width, height);

    for (const slot of slots) {
      if (!slot.active) continue;
      slot.resize(width, height);
      slot.effect.render(slot.canvas, slot.ctx, analyser, slot.container, slot.options ?? {});
    }

    mainCtx.clearRect(0, 0, width, height);
    for (const slot of slots) {
      if (!slot.active) continue;
      const out = getOutputCanvas(slot);
      if (out && out.width && out.height) {
        mainCtx.drawImage(out, 0, 0, width, height);
      }
    }

    requestAnimationFrame(loop);
  }
  loop();

  const createOptionsSection = (slot) => {
    const section = document.createElement("div");
    section.className = "options-section";
    const header = document.createElement("div");
    header.className = "options-section-header";
    header.textContent = slot.effect.name;
    section.appendChild(header);
    const content = document.createElement("div");
    content.className = "options-section-content";
    if (slot.effect.optionsUrl) {
      const iframe = document.createElement("iframe");
      iframe.src = slot.effect.optionsUrl;
      iframe.style.cssText = "border:0;width:100%;min-height:80px";
      iframe.onload = () => setupOptionsListeners(slot, iframe);
      content.appendChild(iframe);
    }
    section.appendChild(content);
    return section;
  };

  effects.forEach((effect, i) => {
    const btn = document.createElement("button");
    btn.textContent = effect.name;
    btn.dataset.effect = effect.id;
    btn.addEventListener("click", () => {
      const slot = slots[i];
      const willActivate = !slot.active;
      if (!willActivate) {
        if (slot.effect.cleanup) {
          slot.effect.cleanup(slot.canvas, slot.container);
        }
        if (slot.optionsSection) {
          slot.optionsSection.remove();
          slot.optionsSection = null;
        }
      } else {
        slot.optionsSection = createOptionsSection(slot);
        optionsBox.appendChild(slot.optionsSection);
      }
      slot.active = willActivate;
      btn.classList.toggle("active", slot.active);
    });
    controls.appendChild(btn);
  });
});
