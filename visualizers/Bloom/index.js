let THREE = null;
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

function init(container, state) {
  return (async () => {
    THREE = window.THREE;
    if (!THREE) return false;

    const [{ EffectComposer }, { UnrealBloomPass }] = await Promise.all([
      import(`${CDN}/EffectComposer.js`),
      import(`${CDN}/UnrealBloomPass.js`),
    ]);

    const { width, height } = container.getBoundingClientRect();
    state.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    state.renderer.setSize(width, height);
    state.renderer.setClearColor(0x000000, 0);
    container.appendChild(state.renderer.domElement);

    state.texture = new THREE.CanvasTexture(document.createElement("canvas"));
    state.texturePass = new TexturePass(state.texture);
    state.texturePass.init(THREE);

    state.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      1,
      0.4,
      0.5
    );

    state.composer = new EffectComposer(state.renderer);
    state.composer.addPass(state.texturePass);
    state.composer.addPass(state.bloomPass);

    state.initialized = true;
    return true;
  })();
}

export const postProcess = true;

export function render(canvas, ctx, audio, container, options = {}, engine, sourceCanvas) {
  if (!THREE) THREE = window.THREE;
  if (!THREE) return;

  const state = container.visualizerState;
  if (!state.initialized) {
    if (!state.initPromise) state.initPromise = init(container, state);
    return;
  }

  const { width, height } = canvas;
  if (!width || !height) return;

  if (!sourceCanvas || sourceCanvas.width === 0 || sourceCanvas.height === 0) {
    state.renderer.setClearColor(0x000000, 0);
    state.renderer.setRenderTarget(null);
    state.renderer.clear();
    return;
  }

  state.texture.image = sourceCanvas;
  state.texture.needsUpdate = true;

  const baseStrength = options.strength ?? 1;
  const baseRadius = options.radius ?? 0.4;
  const baseThreshold = options.threshold ?? 0.5;

  if (options.reactive) {
    const kickBoost = audio.kick ? 1.5 : 0;
    const bassLevel = (audio.bass ?? 0) * 0.5;
    state.bloomPass.strength = baseStrength * (1 + kickBoost + bassLevel);
    state.bloomPass.radius = baseRadius * (1 + (audio.kick ? 0.3 : 0));
  } else {
    state.bloomPass.strength = baseStrength;
    state.bloomPass.radius = baseRadius;
  }
  state.bloomPass.threshold = baseThreshold;

  if (state.renderer.domElement.width !== width || state.renderer.domElement.height !== height) {
    state.renderer.setSize(width, height);
    state.composer.setSize(width, height);
    state.composer.setPixelRatio(1);
  }

  state.composer.render();
}

export function cleanup(canvas, container, slot) {
  const state = container.visualizerState;
  if (!state?.initialized) return;
  state.texture?.dispose();
  state.bloomPass?.dispose?.();
  if (state.renderer?.domElement?.parentElement) container.removeChild(state.renderer.domElement);
  Object.keys(state).forEach((k) => delete state[k]);
}
