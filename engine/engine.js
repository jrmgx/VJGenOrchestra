import { start as startMic } from "./audio.js";
import { createOffscreenCanvas, createMainCanvas } from "./canvas.js";

const startBtn = document.querySelector("#start");
const app = document.querySelector("#app");
const controls = document.querySelector("#controls");

const BLEND_MODES = [
  { label: "Normal", value: "source-over", base: "black" },
  { label: "Dissolve", value: "source-over", base: "black" },
  { label: "Darken", value: "darken", base: "black" },
  { label: "Multiply", value: "multiply", base: "white" },
  { label: "Color Burn", value: "color-burn", base: "white" },
  { label: "Linear Burn", value: "color-burn", base: "white" },
  { label: "Darker Color", value: "darken", base: "black" },
  { label: "Lighten", value: "lighten", base: "black" },
  { label: "Screen", value: "screen", base: "black" },
  { label: "Color Dodge", value: "color-dodge", base: "black" },
  { label: "Linear Dodge", value: "lighter", base: "black" },
  { label: "Lighter Color", value: "lighten", base: "black" },
  { label: "Overlay", value: "overlay", base: "black" },
  { label: "Soft Light", value: "soft-light", base: "black" },
  { label: "Hard Light", value: "hard-light", base: "black" },
  { label: "Vivid Light", value: "hard-light", base: "black" },
  { label: "Linear Light", value: "overlay", base: "black" },
  { label: "Pin Light", value: "soft-light", base: "black" },
  { label: "Hard Mix", value: "difference", base: "black" },
  { label: "Difference", value: "difference", base: "black" },
  { label: "Exclusion", value: "exclusion", base: "black" },
  { label: "Subtract", value: "difference", base: "black" },
  { label: "Divide", value: "color-dodge", base: "black" },
  { label: "Hue", value: "hue", base: "black" },
  { label: "Saturation", value: "saturation", base: "black" },
  { label: "Color", value: "color", base: "black" },
  { label: "Luminosity", value: "luminosity", base: "black" },
];

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
        postProcess: !!mod.postProcess,
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

const optionsCssUrl = new URL("options.css", import.meta.url).href;

function applyOptions(doc, options) {
  if (!doc || !options || Object.keys(options).length === 0) return;
  for (const el of doc.querySelectorAll("input, select, textarea")) {
    const key = el.name || el.id;
    if (!key || !(key in options)) continue;
    const v = options[key];
    if (el.type === "file") continue;
    if (el.type === "checkbox") el.checked = !!v;
    else if (el.type === "number" || el.type === "range") el.value = String(v);
    else el.value = v;
  }
}

function setupOptionsListeners(slot, optionsContainer) {
  const update = () => {
    slot.options = extractOptions(optionsContainer.contentDocument || optionsContainer);
  };
  const doc = optionsContainer.contentDocument || optionsContainer;
  applyOptions(doc, slot.options);
  doc.dispatchEvent(new CustomEvent("optionsApplied"));
  doc.addEventListener("change", update);
  doc.addEventListener("input", update);
  update();
}

function injectOptionsCss(iframe) {
  const doc = iframe.contentDocument;
  if (!doc) return;
  const link = doc.createElement("link");
  link.rel = "stylesheet";
  link.href = optionsCssUrl + "?t=" + Date.now();
  doc.head.appendChild(link);
}

function setIframeHeight(iframe) {
  try {
    const doc = iframe.contentDocument;
    if (doc?.body) {
      iframe.style.height = (doc.body.scrollHeight + 10) + "px";
    }
  } catch (_) {}
}

startBtn.addEventListener("click", async () => {
  startBtn.style.display = "none";
  app.style.display = "block";

  const [effects, { analyser }] = await Promise.all([loadEffects(), startMic()]);

  const optionsPanel = document.createElement("div");
  optionsPanel.id = "options-panel";
  app.insertBefore(optionsPanel, controls);

  const optionsToggle = document.createElement("button");
  optionsToggle.id = "options-toggle";
  optionsToggle.textContent = "Options";
  optionsToggle.type = "button";
  optionsPanel.appendChild(optionsToggle);

  const optionsBox = document.createElement("div");
  optionsBox.id = "options-box";
  optionsPanel.appendChild(optionsBox);

  const recalcIframeHeights = () => {
    optionsBox.querySelectorAll("iframe").forEach(setIframeHeight);
  };

  optionsToggle.addEventListener("click", () => {
    optionsBox.classList.toggle("visible");
    requestAnimationFrame(() => requestAnimationFrame(recalcIframeHeights));
  });

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
    container.appendChild(canvas);
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

  const blendSelect = document.createElement("select");
  blendSelect.id = "blend-mode";
  blendSelect.className = "controls-row";
  BLEND_MODES.forEach((m, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = m.label;
    if (m.label === "Lighten") opt.selected = true;
    blendSelect.appendChild(opt);
  });
  controls.appendChild(blendSelect);

  function getOutputCanvas(slot) {
    const canvases = slot.container.querySelectorAll("canvas");
    return canvases.length > 0 ? canvases[canvases.length - 1] : slot.canvas;
  }

  function loop() {
    const { width, height } = app.getBoundingClientRect();
    resizeMain(width, height);

    const blend = BLEND_MODES[parseInt(blendSelect.value, 10)] || BLEND_MODES[0];
    mainCtx.fillStyle = blend.base === "white" ? "#fff" : "#000";
    mainCtx.fillRect(0, 0, width, height);
    mainCtx.globalCompositeOperation = blend.value;

    for (const slot of slots) {
      if (!slot.active) continue;
      slot.resize(width, height);

      if (slot.effect.postProcess) {
        slot.effect.render(slot.canvas, slot.ctx, analyser, slot.container, slot.options ?? {}, mainCanvas);
        const out = getOutputCanvas(slot);
        if (out && out.width && out.height) {
          mainCtx.globalCompositeOperation = "source-over";
          mainCtx.fillStyle = blend.base === "white" ? "#fff" : "#000";
          mainCtx.fillRect(0, 0, width, height);
          mainCtx.drawImage(out, 0, 0, width, height);
          mainCtx.globalCompositeOperation = blend.value;
        }
      } else {
        slot.effect.render(slot.canvas, slot.ctx, analyser, slot.container, slot.options ?? {});
        const out = getOutputCanvas(slot);
        if (out && out.width && out.height) {
          mainCtx.drawImage(out, 0, 0, width, height);
        }
      }
    }
    mainCtx.globalCompositeOperation = "source-over";

    requestAnimationFrame(loop);
  }
  loop();

  const createOptionsSection = (slot) => {
    const section = document.createElement("div");
    section.className = "options-section";
    const header = document.createElement("div");
    header.className = "options-section-header";
    if (slot.effect.optionsUrl) {
      header.textContent = slot.effect.name;
      header.addEventListener("click", () => section.classList.toggle("collapsed"));
      const content = document.createElement("div");
      content.className = "options-section-content";
      const iframe = document.createElement("iframe");
      iframe.src = slot.effect.optionsUrl + (slot.effect.optionsUrl.includes("?") ? "&" : "?") + "t=" + Date.now();
      iframe.style.cssText = "border:0;width:100%;min-height:40px";
      iframe.onload = () => {
        injectOptionsCss(iframe);
        setupOptionsListeners(slot, iframe);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setIframeHeight(iframe));
        });
      };
      content.appendChild(iframe);
      section.appendChild(header);
      section.appendChild(content);
    } else {
      section.classList.add("no-options");
      header.textContent = `${slot.effect.name} has no options`;
      section.appendChild(header);
    }
    return section;
  };

  function reorderSlotsFromDOM() {
    const items = controls.querySelectorAll(".sortable-item");
    const newOrder = [];
    for (const item of items) {
      const effectId = item.querySelector("button")?.dataset.effect;
      const slot = slots.find((s) => s.effect.id === effectId);
      if (slot) newOrder.push(slot);
    }
    slots.length = 0;
    slots.push(...newOrder);
  }

  effects.forEach((effect) => {
    const item = document.createElement("div");
    item.className = "sortable-item controls-row";
    item.dataset.effect = effect.id;

    const btn = document.createElement("button");
    btn.dataset.effect = effect.id;
    const handle = document.createElement("span");
    handle.className = "drag-handle";
    handle.title = "Drag to reorder";
    handle.textContent = "⋮⋮";
    btn.appendChild(handle);
    btn.appendChild(document.createTextNode(effect.name));
    btn.addEventListener("click", () => {
      const slot = slots.find((s) => s.effect.id === effect.id);
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

    item.appendChild(btn);
    controls.appendChild(item);
  });

  let draggedItem = null;
  controls.querySelectorAll(".sortable-item").forEach((item) => {
    const handle = item.querySelector(".drag-handle");
    handle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      draggedItem = item;
      item.classList.add("dragging");
    });
  });
  document.addEventListener("mouseup", () => {
    if (draggedItem) {
      draggedItem.classList.remove("dragging");
      reorderSlotsFromDOM();
      draggedItem = null;
    }
  });
  document.addEventListener("mousemove", (e) => {
    if (!draggedItem) return;
    const items = [...controls.querySelectorAll(".sortable-item")];
    const idx = items.indexOf(draggedItem);
    if (idx < 0) return;
    const next = items[idx + 1];
    const prev = items[idx - 1];
    const nextRect = next?.getBoundingClientRect();
    const prevRect = prev?.getBoundingClientRect();
    const nextMid = nextRect ? nextRect.top + nextRect.height / 2 : 0;
    const prevMid = prevRect ? prevRect.top + prevRect.height / 2 : 0;
    if (next && e.clientY > nextMid) {
      controls.insertBefore(draggedItem, next.nextSibling);
    } else if (prev && e.clientY < prevMid) {
      controls.insertBefore(draggedItem, prev);
    }
  });
});
