import { start as startMic } from "./audio.js";
import { createOffscreenCanvas, createMainCanvas } from "./canvas.js";

const startBtn = document.querySelector("#start");
const app = document.querySelector("#app");
const controls = document.querySelector("#controls");

async function loadEffects() {
  const manifestUrl = new URL("../visualizers/manifest.json", import.meta.url);
  const ids = await fetch(manifestUrl + "?t=" + Date.now()).then((r) => r.json());
  const effects = [];
  for (const id of ids) {
    try {
      const mod = await import(`../visualizers/${id}/index.js?t=${Date.now()}`);
      effects.push({ id, name: id, render: mod.render, cleanup: mod.cleanup });
    } catch (e) {
      console.error(`Failed to load visualizer "${id}":`, e);
    }
  }
  return effects;
}

startBtn.addEventListener("click", async () => {
  startBtn.style.display = "none";
  app.style.display = "block";

  const [effects, { analyser }] = await Promise.all([loadEffects(), startMic()]);

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
      slot.effect.render(slot.canvas, slot.ctx, analyser, slot.container);
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

  effects.forEach((effect, i) => {
    const btn = document.createElement("button");
    btn.textContent = effect.name;
    btn.dataset.effect = effect.id;
    btn.addEventListener("click", () => {
      const slot = slots[i];
      const willActivate = !slot.active;
      if (!willActivate && slot.effect.cleanup) {
        slot.effect.cleanup(slot.canvas, slot.container);
      }
      slot.active = willActivate;
      btn.classList.toggle("active", slot.active);
    });
    controls.appendChild(btn);
  });
});
