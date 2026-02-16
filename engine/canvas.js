export function createOffscreenCanvas() {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: true });

  function resize(width, height) {
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  return { canvas, ctx, resize };
}

export function createMainCanvas(container) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: true });
  container.appendChild(canvas);

  function resize(width, height) {
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  return { canvas, ctx, resize };
}
