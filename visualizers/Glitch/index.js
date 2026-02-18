const JPEG_HEADER_SIZE = 615;
let cachedImage = null;
let pipelineInFlight = false;

function glitchBytes(bytes, iterations) {
  if (bytes.length <= JPEG_HEADER_SIZE + 4) return;
  for (let i = 0; i < iterations; i++) {
    const rnd = JPEG_HEADER_SIZE + Math.floor(Math.random() * (bytes.length - JPEG_HEADER_SIZE - 4));
    bytes[rnd] = Math.floor(Math.random() * 256);
  }
}

function runPipeline(sourceCanvas, options, canvas, ctx) {
  if (pipelineInFlight || !sourceCanvas?.width || !sourceCanvas?.height) return;
  pipelineInFlight = true;

  const quality = options.quality ?? 0.9;
  let iterations = options.iterations ?? 3;
  if (options.reactive && options.audio?.kick) iterations = Math.min(10, iterations + 4);

  sourceCanvas.toBlob(
    async (blob) => {
      try {
        const buf = await blob.arrayBuffer();
        const bytes = new Uint8Array(buf);
        glitchBytes(bytes, iterations);
        const corrupted = new Blob([bytes], { type: "image/jpeg" });
        const bitmap = await createImageBitmap(corrupted);
        if (cachedImage) cachedImage.close?.();
        cachedImage = bitmap;
      } catch (e) {
        console.warn("Glitch pipeline error:", e);
      } finally {
        pipelineInFlight = false;
      }
    },
    "image/jpeg",
    quality
  );
}

export const postProcess = true;

export function render(canvas, ctx, audio, container, options = {}, engine, sourceCanvas) {
  const { width, height } = canvas;
  if (!width || !height) return;

  if (!sourceCanvas || sourceCanvas.width === 0 || sourceCanvas.height === 0) {
    ctx.clearRect(0, 0, width, height);
    return;
  }

  const iterations = Math.max(0, options.iterations ?? 3);
  if (iterations === 0) {
    ctx.drawImage(sourceCanvas, 0, 0, width, height);
    return;
  }

  if (cachedImage) {
    ctx.drawImage(cachedImage, 0, 0, width, height);
  } else {
    ctx.drawImage(sourceCanvas, 0, 0, width, height);
  }

  runPipeline(sourceCanvas, { ...options, audio }, canvas, ctx);
}

export function cleanup(canvas, container) {
  if (cachedImage) {
    cachedImage.close?.();
    cachedImage = null;
  }
  pipelineInFlight = false;
}
