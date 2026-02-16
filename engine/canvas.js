let canvas = null;
let ctx = null;
let effect = null;
let rafId = null;

function resize() {
  if (!canvas || !canvas.parentElement) return;
  const { width, height } = canvas.parentElement.getBoundingClientRect();
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function loop() {
  resize();
  if (effect) {
    effect();
  } else {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  rafId = requestAnimationFrame(loop);
}

export function init(container) {
  canvas = document.createElement("canvas");
  ctx = canvas.getContext("2d");
  container.appendChild(canvas);
  resize();
  loop();
  return { canvas, ctx };
}

export function setEffect(fn) {
  effect = fn;
}
