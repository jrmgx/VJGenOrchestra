import { start as startMic } from "./microphone.js";
import { init as initCanvas, setEffect } from "./canvas.js";

const startBtn = document.querySelector("#start");
const app = document.querySelector("#app");
const controls = document.querySelector("#controls");

async function loadEffects() {
  const manifestUrl = new URL("../visualizers/manifest.json", import.meta.url);
  const ids = await fetch(manifestUrl).then((r) => r.json());
  const effects = await Promise.all(
    ids.map(async (id) => {
      const mod = await import(`../visualizers/${id}/index.js?t=${Date.now()}`);
      return { id, name: id, render: mod.render };
    })
  );
  return effects;
}

startBtn.addEventListener("click", async () => {
  startBtn.style.display = "none";
  app.style.display = "block";

  const [effects, { analyser }] = await Promise.all([loadEffects(), startMic()]);
  const { canvas, ctx } = initCanvas(app);

  function switchTo(effect) {
    setEffect(() => effect.render(canvas, ctx, analyser));
    controls.querySelectorAll("button").forEach((btn) => btn.classList.toggle("active", btn.dataset.effect === effect.id));
  }

  effects.forEach((effect) => {
    const btn = document.createElement("button");
    btn.textContent = effect.name;
    btn.dataset.effect = effect.id;
    btn.addEventListener("click", () => switchTo(effect));
    controls.appendChild(btn);
  });

  if (effects.length) switchTo(effects[0]);
});
