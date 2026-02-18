let THREE = null;
let renderer, composer, texturePass, bloomPass, texture;
let initialized = false;
let initPromise = null;
const CDN = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/postprocessing";

class TexturePass {
  constructor(texture) {
    this.enabled = true;
    this.needsSwap = true;
    this.clear = true;
    this.texture = texture;
    this.material = null;
  }
  init(THREE) {
    this.material = new THREE.MeshBasicMaterial({ map: this.texture });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
    this.fsQuad = new THREE.Mesh(geo, this.material);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  setSize() {}
  render(renderer, writeBuffer) {
    if (!this.material) return;
    this.material.map = this.texture;
    renderer.setRenderTarget(writeBuffer);
    renderer.clear();
    renderer.render(this.fsQuad, this.camera);
  }
}

function init(container) {
  return (async () => {
    THREE = window.THREE;
    if (!THREE) return false;

    const [{ EffectComposer }, { UnrealBloomPass }] = await Promise.all([
      import(`${CDN}/EffectComposer.js`),
      import(`${CDN}/UnrealBloomPass.js`),
    ]);

    const { width, height } = container.getBoundingClientRect();
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    texture = new THREE.CanvasTexture(document.createElement("canvas"));
    texturePass = new TexturePass(texture);
    texturePass.init(THREE);

    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      1,
      0.4,
      0.5
    );

    composer = new EffectComposer(renderer);
    composer.addPass(texturePass);
    composer.addPass(bloomPass);

    initialized = true;
    return true;
  })();
}

export const postProcess = true;

export function render(canvas, ctx, audio, container, options = {}, engine, sourceCanvas) {
  if (!THREE) THREE = window.THREE;
  if (!THREE) return;

  if (!initialized) {
    if (!initPromise) initPromise = init(container);
    return;
  }

  const { width, height } = canvas;
  if (!width || !height) return;

  if (!sourceCanvas || sourceCanvas.width === 0 || sourceCanvas.height === 0) {
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(null);
    renderer.clear();
    return;
  }

  texture.image = sourceCanvas;
  texture.needsUpdate = true;

  const baseStrength = options.strength ?? 1;
  const baseRadius = options.radius ?? 0.4;
  const baseThreshold = options.threshold ?? 0.5;

  if (options.reactive) {
    const kickBoost = audio.kick ? 1.5 : 0;
    const bassLevel = (audio.bass ?? 0) * 0.5;
    bloomPass.strength = baseStrength * (1 + kickBoost + bassLevel);
    bloomPass.radius = baseRadius * (1 + (audio.kick ? 0.3 : 0));
  } else {
    bloomPass.strength = baseStrength;
    bloomPass.radius = baseRadius;
  }
  bloomPass.threshold = baseThreshold;

  if (renderer.domElement.width !== width || renderer.domElement.height !== height) {
    renderer.setSize(width, height);
    composer.setSize(width, height);
    composer.setPixelRatio(1);
  }

  composer.render();
}

export function cleanup(canvas, container) {
  if (!initialized) return;
  texture?.dispose();
  bloomPass?.dispose?.();
  if (renderer?.domElement?.parentElement) container.removeChild(renderer.domElement);
  initialized = false;
  initPromise = null;
}
