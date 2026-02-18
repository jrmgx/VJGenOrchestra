import { start as startMic } from "./audio.js";
import { createAudio, updateAudio } from "./audioAnalysis.js";
import { createBottomPanel } from "./bottomPanel.js";
import { createOffscreenCanvas, createMainCanvas } from "./canvas.js";

const startBtn = document.querySelector("#start");
const app = document.querySelector("#app");
const controls = document.querySelector("#controls");

const BLEND_MODES = [
  { label: "Normal", value: "source-over", base: "black" },
  { label: "Multiply", value: "multiply", base: "white" },
  { label: "Screen", value: "screen", base: "black" },
  { label: "Overlay", value: "overlay", base: "black" },
  { label: "Soft Light", value: "soft-light", base: "black" },
  { label: "Hard Light", value: "hard-light", base: "black" },
  { label: "Darken", value: "darken", base: "black" },
  { label: "Lighten", value: "lighten", base: "black" },
  { label: "Color Dodge", value: "color-dodge", base: "black" },
  { label: "Color Burn", value: "color-burn", base: "white" },
  { label: "Lighter", value: "lighter", base: "black" },
  { label: "Difference", value: "difference", base: "black" },
  { label: "Exclusion", value: "exclusion", base: "black" },
];

async function loadEffects() {
  const manifestUrl = new URL("../visualizers/manifest.json", import.meta.url);
  const ids = await fetch(manifestUrl + "?t=" + Date.now()).then((r) => r.json());
  const baseUrl = new URL("../visualizers/", import.meta.url).href;
  const effects = await Promise.all(
    ids.map(async (id) => {
      try {
        const [mod, optionsRes] = await Promise.all([
          import(`../visualizers/${id}/index.js?t=${Date.now()}`),
          fetch(new URL(`${id}/options.html`, baseUrl).href).catch(() => null),
        ]);
        const optionsUrl = new URL(`${id}/options.html`, baseUrl).href;
        return {
          id,
          name: id,
          render: mod.render,
          cleanup: mod.cleanup,
          optionsUrl: optionsRes?.ok ? optionsUrl : null,
          postProcess: !!mod.postProcess,
          fileInputs: mod.fileInputs || null,
        };
      } catch (e) {
        console.error(`Failed to load visualizer "${id}":`, e);
        return null;
      }
    })
  );
  return effects.filter(Boolean);
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

function setupOptionsListeners(slot, optionsContainer, contentContainer) {
  const update = () => {
    slot.options = { ...extractOptions(optionsContainer.contentDocument || optionsContainer), ...slot.fileInputValues };
  };
  const doc = optionsContainer.contentDocument || optionsContainer;
  if (slot.effect.fileInputs && contentContainer) {
    const fileInputsDiv = document.createElement("div");
    fileInputsDiv.className = "options-file-inputs";
    for (const [key, cfg] of Object.entries(slot.effect.fileInputs)) {
      const row = document.createElement("label");
      row.className = "options-file-row";
      const input = document.createElement("input");
      input.type = "file";
      input.accept = cfg.accept || "*";
      input.style.display = "none";
      input.id = `file-${slot.effect.id}-${key}`;
      input.addEventListener("change", () => {
        slot.fileInputValues[key] = input.files?.[0] ?? null;
        update();
      });
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = cfg.label || key;
      btn.addEventListener("click", () => input.click());
      row.appendChild(btn);
      row.appendChild(input);
      fileInputsDiv.appendChild(row);
    }
    contentContainer.insertBefore(fileInputsDiv, contentContainer.firstChild);
  }
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
  const audio = createAudio(analyser);
  const bottomPanel = createBottomPanel(audio, analyser, app);

  const optionsPanel = document.createElement("div");
  optionsPanel.id = "options-panel";
  app.insertBefore(optionsPanel, controls);

  const buttonsRow = document.createElement("div");
  buttonsRow.className = "options-panel-buttons";

  const fullscreenBtn = document.createElement("button");
  fullscreenBtn.id = "fullscreen-toggle";
  fullscreenBtn.type = "button";
  fullscreenBtn.title = "Toggle fullscreen";
  fullscreenBtn.textContent = "Fullscreen";
  fullscreenBtn.addEventListener("click", () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  });
  document.addEventListener("fullscreenchange", () => {
    fullscreenBtn.textContent = document.fullscreenElement ? "Exit FS" : "Fullscreen";
  });
  buttonsRow.appendChild(fullscreenBtn);

  const optionsToggle = document.createElement("button");
  optionsToggle.id = "options-toggle";
  optionsToggle.textContent = "Options";
  optionsToggle.type = "button";
  buttonsRow.appendChild(optionsToggle);

  optionsPanel.appendChild(buttonsRow);

  const optionsBox = document.createElement("div");
  optionsBox.id = "options-box";
  optionsPanel.appendChild(optionsBox);
  optionsPanel.classList.add("empty");

  let audioOptions = {};

  const syncOptionsPanelVisibility = () => {
    optionsPanel.classList.toggle("empty", optionsBox.children.length === 0);
  };

  const insertOptionsSectionInOrder = (slot) => {
    const pos = effectOrder.indexOf(slot.effectIndex);
    for (let i = pos + 1; i < effectOrder.length; i++) {
      const ref = slots[effectOrder[i]]?.optionsSection;
      if (ref && optionsBox.contains(ref)) {
        optionsBox.insertBefore(slot.optionsSection, ref);
        return;
      }
    }
    optionsBox.appendChild(slot.optionsSection);
  };

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

  const slots = effects.map((effect, effectIndex) => {
    const { canvas, ctx, resize } = createOffscreenCanvas();
    const container = document.createElement("div");
    container.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
    container.appendChild(canvas);
    offscreenLayer.appendChild(container);

    let active = false;

    return {
      effect,
      effectIndex,
      container,
      canvas,
      ctx,
      resize,
      options: {},
      fileInputValues: {},
      optionsSection: null,
      get active() {
        return active;
      },
      set active(v) {
        active = v;
      },
    };
  });

  let effectOrder = effects.map((_, i) => i);

  const blendRow = document.createElement("div");
  blendRow.className = "blend-row controls-row";
  const blendPrevKey = document.createElement("span");
  blendPrevKey.className = "key-hint";
  blendPrevKey.textContent = "-";
  blendPrevKey.title = "Previous blend mode";
  const blendNextKey = document.createElement("span");
  blendNextKey.className = "key-hint";
  blendNextKey.textContent = "+";
  blendNextKey.title = "Next blend mode";
  const blendSelect = document.createElement("select");
  blendSelect.id = "blend-mode";
  BLEND_MODES.forEach((m, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = m.label;
    if (m.label === "Lighten") opt.selected = true;
    blendSelect.appendChild(opt);
  });
  blendRow.appendChild(blendPrevKey);
  blendRow.appendChild(blendSelect);
  blendRow.appendChild(blendNextKey);
  controls.appendChild(blendRow);

  function getOutputCanvas(slot) {
    const canvases = slot.container.querySelectorAll("canvas");
    return canvases.length > 0 ? canvases[canvases.length - 1] : slot.canvas;
  }

  let width = 0;
  let height = 0;
  let blend = BLEND_MODES[0];
  const updateSize = () => {
    const r = app.getBoundingClientRect();
    width = r.width;
    height = r.height;
  };
  updateSize();
  new ResizeObserver(updateSize).observe(app);
  const syncBlend = () => {
    blend = BLEND_MODES[parseInt(blendSelect.value, 10)] || BLEND_MODES[0];
  };
  blendSelect.addEventListener("change", syncBlend);
  syncBlend();

  function drawSlotOutput(slot, w, h) {
    const out = getOutputCanvas(slot);
    if (out?.width && out?.height) mainCtx.drawImage(out, 0, 0, w, h);
  }

  const engine = { text: "" };
  let lastTime = performance.now();
  const fpsSamples = [];

  function loop() {
    const now = performance.now();
    const delta = now - lastTime;
    if (delta > 0) fpsSamples.push(1000 / delta);
    if (fpsSamples.length > 10) fpsSamples.shift();
    lastTime = now;
    const fps = fpsSamples.length ? Math.round(fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length) : 0;
    bottomPanel.updateFps(fps);

    if (width && height) {
      engine.text = bottomPanel.getText();

      resizeMain(width, height);
      mainCtx.fillStyle = blend.base === "white" ? "#fff" : "#000";
      mainCtx.fillRect(0, 0, width, height);
      mainCtx.globalCompositeOperation = blend.value;

      audioOptions = bottomPanel.getOptions();
      updateAudio(audio, audioOptions);
      bottomPanel.draw();

      for (const i of effectOrder) {
        const slot = slots[i];
        if (!slot?.active) continue;
        slot.resize(width, height);

        if (slot.effect.postProcess) {
          slot.effect.render(slot.canvas, slot.ctx, audio, slot.container, slot.options ?? {}, engine, mainCanvas);
          mainCtx.globalCompositeOperation = "source-over";
          mainCtx.fillStyle = blend.base === "white" ? "#fff" : "#000";
          mainCtx.fillRect(0, 0, width, height);
          drawSlotOutput(slot, width, height);
          mainCtx.globalCompositeOperation = blend.value;
        } else {
          slot.effect.render(slot.canvas, slot.ctx, audio, slot.container, slot.options ?? {}, engine);
          drawSlotOutput(slot, width, height);
        }
      }
      mainCtx.globalCompositeOperation = "source-over";
    }
    requestAnimationFrame(loop);
  }
  loop();

  const createOptionsSection = (slot) => {
    const section = document.createElement("div");
    section.className = "options-section collapsed";
    const header = document.createElement("div");
    header.className = "options-section-header";
    if (slot.effect.optionsUrl) {
      header.textContent = slot.effect.name;
      header.addEventListener("click", () => {
        section.classList.toggle("collapsed");
        if (!section.classList.contains("collapsed")) {
          requestAnimationFrame(() => requestAnimationFrame(recalcIframeHeights));
        }
      });
      const content = document.createElement("div");
      content.className = "options-section-content";
      const iframe = document.createElement("iframe");
      iframe.src = slot.effect.optionsUrl + (slot.effect.optionsUrl.includes("?") ? "&" : "?") + "t=" + Date.now();
      iframe.style.cssText = "border:0;width:100%;min-height:40px";
      iframe.onload = () => {
        injectOptionsCss(iframe);
        setupOptionsListeners(slot, iframe, content);
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
    const items = sortableContainer.querySelectorAll(".sortable-item");
    effectOrder = [...items].map((item) => parseInt(item.dataset.effectIndex, 10)).filter((i) => !isNaN(i));
    for (const i of effectOrder) {
      const slot = slots[i];
      if (slot?.optionsSection) optionsBox.appendChild(slot.optionsSection);
    }
    updateKeyHints();
  }

  const VISUALIZER_KEY_CODES = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0"];
  const VISUALIZER_KEY_LABELS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  const KEY_CODE_TO_IDX = new Map(VISUALIZER_KEY_CODES.map((c, i) => [c, i]));
  function updateKeyHints() {
    const items = sortableContainer.querySelectorAll(".sortable-item");
    items.forEach((item, i) => {
      const btn = item.querySelector("button");
      if (!btn) return;
      let hint = btn.querySelector(".key-hint");
      if (i < 10) {
        if (!hint) {
          hint = document.createElement("span");
          hint.className = "key-hint";
          btn.appendChild(hint);
        }
        hint.textContent = VISUALIZER_KEY_LABELS[i];
        hint.title = `Toggle (${VISUALIZER_KEY_LABELS[i]})`;
      } else {
        hint?.remove();
      }
    });
  }

  const sortableContainer = document.createElement("div");
  sortableContainer.className = "sortable-list";
  for (const i of effectOrder) {
    const effect = effects[i];
    const slot = slots[i];
    const item = document.createElement("div");
    item.className = "sortable-item controls-row";
    item.dataset.effectIndex = i;

    const btn = document.createElement("button");
    btn.dataset.effectIndex = i;
    const handle = document.createElement("span");
    handle.className = "drag-handle";
    handle.title = "Drag to reorder";
    handle.textContent = "⋮⋮";
    btn.appendChild(handle);
    btn.appendChild(document.createTextNode(effect.name));
    btn.addEventListener("click", () => {
      const willActivate = !slot.active;
      if (!willActivate) {
        if (slot.effect.cleanup) {
          slot.effect.cleanup(slot.canvas, slot.container);
        }
        if (slot.optionsSection) {
          slot.optionsSection.remove();
          slot.optionsSection = null;
          slot.fileInputValues = {};
          syncOptionsPanelVisibility();
        }
      } else {
        slot.optionsSection = createOptionsSection(slot);
        insertOptionsSectionInOrder(slot);
        syncOptionsPanelVisibility();
      }
      slot.active = willActivate;
      btn.classList.toggle("active", slot.active);
    });

    item.appendChild(btn);
    sortableContainer.appendChild(item);
  }
  controls.appendChild(sortableContainer);
  updateKeyHints();

  function isOptionsFocused() {
    const el = document.activeElement;
    if (!el) return false;
    if (el.closest("#bottom-panel")) return false;
    if (["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName)) return true;
    if (el.tagName === "IFRAME" && optionsBox?.contains(el)) return true;
    return false;
  }

  document.addEventListener("keydown", (e) => {
    if (isOptionsFocused()) return;
    if (!e.ctrlKey) return;
    const idx = KEY_CODE_TO_IDX.get(e.code);
    if (idx !== undefined) {
      const items = sortableContainer.querySelectorAll(".sortable-item");
      if (idx >= items.length) return;
      e.preventDefault();
      const btn = items[idx].querySelector("button");
      btn?.click();
      return;
    }
    if (e.code === "Minus") {
      e.preventDefault();
      blendSelect.value = Math.max(0, parseInt(blendSelect.value, 10) - 1);
      syncBlend();
      return;
    }
    if (e.code === "Equal") {
      e.preventDefault();
      blendSelect.value = Math.min(BLEND_MODES.length - 1, parseInt(blendSelect.value, 10) + 1);
      syncBlend();
    }
  });

  let draggedItem = null;
  sortableContainer.querySelectorAll(".sortable-item").forEach((item) => {
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
    const items = [...sortableContainer.querySelectorAll(".sortable-item")];
    const idx = items.indexOf(draggedItem);
    if (idx < 0) return;
    const next = items[idx + 1];
    const prev = items[idx - 1];
    const nextRect = next?.getBoundingClientRect();
    const prevRect = prev?.getBoundingClientRect();
    const nextMid = nextRect ? nextRect.top + nextRect.height / 2 : 0;
    const prevMid = prevRect ? prevRect.top + prevRect.height / 2 : 0;
    if (next && e.clientY > nextMid) {
      sortableContainer.insertBefore(draggedItem, next.nextSibling);
    } else if (prev && e.clientY < prevMid) {
      sortableContainer.insertBefore(draggedItem, prev);
    }
  });
});
