import { start as startMic } from "./audio.js";
import { createAudio, updateAudio } from "./audioAnalysis.js";
import { createBottomPanel } from "./bottomPanel.js";
import { createOffscreenCanvas, createMainCanvas } from "./canvas.js";

const startBtn = document.querySelector("#start");
const app = document.querySelector("#app");
const controls = document.querySelector("#controls");

function extractOptionsSchema(doc, fileInputKeys = []) {
  const schema = {};
  for (const el of doc.querySelectorAll("input, select, textarea")) {
    const key = el.name || el.id;
    if (!key || fileInputKeys.includes(key)) continue;
    if (el.type === "file") continue;
    if (el.type === "range" || el.type === "number") {
      const min = parseFloat(el.getAttribute("min")) ?? 0;
      const max = parseFloat(el.getAttribute("max")) ?? 1;
      const step = parseFloat(el.getAttribute("step")) ?? 0.01;
      schema[key] = { type: el.type, min, max, step };
    } else if (el.type === "checkbox") {
      schema[key] = { type: "checkbox" };
    } else if (el.type === "radio") {
      const name = el.name;
      if (!(name in schema)) {
        const opts = [...doc.querySelectorAll(`input[type="radio"][name="${name}"]`)].map((r) => r.value);
        schema[name] = { type: "radio", options: opts };
      }
    } else if (el.type === "color") {
      schema[key] = { type: "color" };
    } else if (el.type === "hidden") {
      const container = el.closest("label") || el.parentElement;
      const values = [];
      if (container) {
        for (const btn of container.querySelectorAll("[data-value]")) {
          const v = btn.dataset.value;
          if (v != null && v !== "") values.push(String(v));
        }
      }
      if (values.length) schema[key] = { type: "hidden", options: values };
      else schema[key] = { type: "hidden", options: [el.value || ""] };
    } else if (el.tagName === "SELECT") {
      const opts = [...el.querySelectorAll("option")].map((o) => o.value);
      schema[key] = { type: "select", options: opts };
    } else {
      schema[key] = { type: "text", value: el.value };
    }
  }
  return schema;
}

function generateRandomOptions(schema, fileInputKeys = [], fileInputValues = {}) {
  const opts = { ...fileInputValues };
  for (const [key, s] of Object.entries(schema || {})) {
    if (fileInputKeys.includes(key)) continue;
    if (key in fileInputValues) continue;
    if (s.type === "range" || s.type === "number") {
      const { min, max, step } = s;
      const steps = Math.round((max - min) / step);
      const v = min + Math.round(Math.random() * steps) * step;
      opts[key] = Math.min(max, v);
    } else if (s.type === "checkbox") {
      opts[key] = Math.random() > 0.5;
    } else if (s.type === "radio" || s.type === "select" || s.type === "hidden") {
      const options = s.options || [];
      opts[key] = options[Math.floor(Math.random() * options.length)] ?? "";
    } else if (s.type === "color") {
      opts[key] = "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0");
    } else if (s.type === "text") {
      opts[key] = s.value ?? "";
    }
  }
  return opts;
}

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

function loadSchemaFromOptionsUrl(optionsUrl, fileInputKeys) {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;visibility:hidden";
    document.body.appendChild(iframe);
    iframe.onload = () => {
      try {
        const doc = iframe.contentDocument;
        const schema = doc ? extractOptionsSchema(doc, fileInputKeys || []) : {};
        resolve(schema);
      } catch {
        resolve({});
      } finally {
        iframe.remove();
      }
    };
    iframe.src = optionsUrl;
  });
}

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
        const fileInputKeys = Object.keys(mod.fileInputs || {});
        let optionsSchema = {};
        if (optionsRes?.ok) {
          optionsSchema = await loadSchemaFromOptionsUrl(optionsUrl, fileInputKeys);
          console.log(`[automix] ${id} options:`, optionsSchema);
        }
        return {
          id,
          name: id,
          render: mod.render,
          cleanup: mod.cleanup,
          optionsUrl: optionsRes?.ok ? optionsUrl : null,
          postProcess: !!mod.postProcess,
          fileInputs: mod.fileInputs || null,
          optionsSchema,
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
    else if (el.type === "radio") { if (el.checked) options[key] = el.value; }
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
    else if (el.type === "radio") el.checked = el.value === v;
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
    contentContainer.querySelector(".options-file-inputs")?.remove();
    const fileInputsDiv = document.createElement("div");
    fileInputsDiv.className = "options-file-inputs";
    for (const [key, cfg] of Object.entries(slot.effect.fileInputs)) {
      const row = document.createElement("label");
      row.className = "options-file-row";
      const input = document.createElement("input");
      input.type = "file";
      input.accept = cfg.accept || "*";
      input.style.display = "none";
      input.id = `file-slot-${slot.effectIndex}-${key}`;
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
  const bottomPanel = await createBottomPanel(audio, analyser, app, { effects });

  const optionsPanel = document.createElement("div");
  optionsPanel.id = "options-panel";
  app.insertBefore(optionsPanel, controls);

  const buttonsRow = document.createElement("div");
  buttonsRow.className = "options-panel-buttons";

  const fpsEl = document.createElement("button");
  fpsEl.id = "fps-counter";
  fpsEl.type = "button";
  fpsEl.title = "Frame rate";
  fpsEl.textContent = "— fps";
  fpsEl.style.pointerEvents = "none";
  fpsEl.style.cursor = "default";
  buttonsRow.appendChild(fpsEl);

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

  const idCounts = {};
  effects.forEach((e) => { idCounts[e.id] = (idCounts[e.id] || 0) + 1; });
  const idIndex = {};
  effects.forEach((e, i) => {
    idIndex[i] = idCounts[e.id] > 1 ? (idIndex[e.id] = (idIndex[e.id] ?? 0) + 1) : 0;
  });

  const slots = effects.map((effect, effectIndex) => {
    const { canvas, ctx, resize } = createOffscreenCanvas();
    const container = document.createElement("div");
    container.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
    container.visualizerState = {};
    container.appendChild(canvas);
    offscreenLayer.appendChild(container);

    const displayName = idIndex[effectIndex] ? `${effect.name} (${idIndex[effectIndex]})` : effect.name;
    let active = false;

    return {
      displayName,
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

  const engine = {};
  const AUTOMIX_COOLDOWN_MS = 2500;
  let lastAutomixChange = 0;

  function syncSlotButtons() {
    sortableContainer.querySelectorAll(".sortable-item").forEach((item) => {
      const idx = parseInt(item.dataset.effectIndex, 10);
      if (!isNaN(idx) && slots[idx]) {
        item.querySelector("button")?.classList.toggle("active", slots[idx].active);
      }
    });
  }

  function applyOptionsToSlot(slot) {
    const iframe = slot.optionsSection?.querySelector("iframe");
    const doc = iframe?.contentDocument;
    if (doc) {
      applyOptions(doc, slot.options);
      doc.dispatchEvent(new CustomEvent("optionsApplied"));
    }
  }

  function runAutomix() {
    const { enabled, visualizerIds, postProcessorIds } = bottomPanel.getAutomixState();
    if (!enabled) return;
    const now = Date.now();
    if (!audio.kick || now - lastAutomixChange < AUTOMIX_COOLDOWN_MS) return;
    lastAutomixChange = now;

    const fileInputKeys = (e) => Object.keys(e.fileInputs || {});
    const pick = (arr, n) => {
      const shuffled = [...arr].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, Math.min(n, shuffled.length));
    };
    const activate = (slot) => {
      slot.options = generateRandomOptions(slot.effect.optionsSchema, fileInputKeys(slot.effect), slot.fileInputValues);
      slot.optionsSection = createOptionsSection(slot);
      insertOptionsSectionInOrder(slot);
      slot.active = true;
    };
    const deactivate = (slot) => {
      if (slot.effect.cleanup) slot.effect.cleanup(slot.canvas, slot.container, slot);
      if (slot.optionsSection) {
        slot.optionsSection.remove();
        slot.optionsSection = null;
        slot.fileInputValues = {};
      }
      slot.active = false;
    };

    const activeVizCount = slots.filter((s) => !s.effect.postProcess && s.active).length;
    let actions = ["viz", "post", "options"].filter(() => Math.random() > 0.5);
    if (actions.length === 0) actions.push("viz");
    if (activeVizCount === 0 && visualizerIds.length > 0) actions = ["viz"];

    if (actions.includes("viz") && visualizerIds.length > 0) {
      const poolViz = slots.filter((s) => !s.effect.postProcess && visualizerIds.includes(s.effect.id));
      const activeViz = poolViz.filter((s) => s.active);
      const inactiveViz = poolViz.filter((s) => !s.active);
      const turnOffCount = activeViz.length > 1 ? Math.floor(Math.random() * activeViz.length) : 0;
      const toTurnOff = pick(activeViz, turnOffCount);
      const remaining = activeViz.length - turnOffCount;
      const maxTurnOn = Math.min(Math.max(0, 3 - remaining), inactiveViz.length);
      let turnOnCount = Math.floor(Math.random() * (maxTurnOn + 1));
      if (remaining === 0 && inactiveViz.length > 0) turnOnCount = Math.max(1, turnOnCount);
      const toTurnOn = pick(inactiveViz, turnOnCount);
      toTurnOff.forEach(deactivate);
      toTurnOn.forEach(activate);
      syncOptionsPanelVisibility();
      syncSlotButtons();
    }
    if (actions.includes("post") && postProcessorIds.length > 0) {
      const poolPost = slots.filter((s) => s.effect.postProcess && postProcessorIds.includes(s.effect.id));
      const activePost = poolPost.filter((s) => s.active);
      const inactivePost = poolPost.filter((s) => !s.active);
      const turnOffCount = Math.floor(Math.random() * (activePost.length + 1));
      const toTurnOff = pick(activePost, turnOffCount);
      const remaining = activePost.length - turnOffCount;
      const maxTurnOn = Math.min(Math.max(0, 3 - remaining), inactivePost.length);
      const turnOnCount = Math.floor(Math.random() * (maxTurnOn + 1));
      const toTurnOn = pick(inactivePost, turnOnCount);
      toTurnOff.forEach(deactivate);
      toTurnOn.forEach(activate);
      syncOptionsPanelVisibility();
      syncSlotButtons();
    }
    if (actions.includes("options")) {
      const inPool = (s) =>
        s.effect.postProcess ? postProcessorIds.includes(s.effect.id) : visualizerIds.includes(s.effect.id);
      for (const i of effectOrder) {
        const slot = slots[i];
        if (!slot?.active || !slot.effect.optionsSchema || !inPool(slot)) continue;
        slot.options = generateRandomOptions(slot.effect.optionsSchema, fileInputKeys(slot.effect), slot.fileInputValues);
        applyOptionsToSlot(slot);
      }
    }
  }

  let fpsUpdateTime = performance.now();
  let fpsFrameCount = 0;
  function loop() {
    const now = performance.now();
    fpsFrameCount++;
    if (now - fpsUpdateTime >= 500) {
      fpsEl.textContent = Math.round((fpsFrameCount * 1000) / (now - fpsUpdateTime)) + " fps";
      fpsFrameCount = 0;
      fpsUpdateTime = now;
    }
    if (width && height) {
      resizeMain(width, height);
      mainCtx.fillStyle = blend.base === "white" ? "#fff" : "#000";
      mainCtx.fillRect(0, 0, width, height);
      mainCtx.globalCompositeOperation = blend.value;

      audioOptions = bottomPanel.getOptions();
      updateAudio(audio, audioOptions);
      bottomPanel.draw();
      runAutomix();

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
      header.textContent = slot.displayName;
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
      header.textContent = `${slot.displayName} has no options`;
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
    btn.appendChild(document.createTextNode(slot.displayName));
    btn.addEventListener("click", () => {
      const willActivate = !slot.active;
      if (!willActivate) {
        if (slot.effect.cleanup) {
          slot.effect.cleanup(slot.canvas, slot.container, slot);
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
