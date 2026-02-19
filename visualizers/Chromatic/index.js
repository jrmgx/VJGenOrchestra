let THREE = null;
const CDN = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/postprocessing";

const ChromaticShader = {
  uniforms: {
    tDiffuse: { value: null },
    amount: { value: 0.005 },
  },
  vertexShader: `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,
  fragmentShader: `
uniform sampler2D tDiffuse;
uniform float amount;
varying vec2 vUv;
void main() {
  vec2 uv = vUv - 0.5;
  float dist = length(uv);
  float offset = amount * dist;
  float r = texture2D(tDiffuse, vUv + vec2(offset, 0)).r;
  float g = texture2D(tDiffuse, vUv).g;
  float b = texture2D(tDiffuse, vUv - vec2(offset, 0)).b;
  gl_FragColor = vec4(r, g, b, texture2D(tDiffuse, vUv).a);
}
`,
};

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

    const [{ EffectComposer }, { ShaderPass }] = await Promise.all([
      import(`${CDN}/EffectComposer.js`),
      import(`${CDN}/ShaderPass.js`),
    ]);

    const { width, height } = container.getBoundingClientRect();
    state.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    state.renderer.setSize(width, height);
    state.renderer.setClearColor(0x000000, 0);
    container.appendChild(state.renderer.domElement);

    state.texture = new THREE.CanvasTexture(document.createElement("canvas"));
    state.texturePass = new TexturePass(state.texture);
    state.texturePass.init(THREE);

    state.composer = new EffectComposer(state.renderer);
    state.composer.addPass(state.texturePass);
    state.effectPass = new ShaderPass(ChromaticShader);
    state.composer.addPass(state.effectPass);

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

  const bass = audio.bass ?? 0;
  const level = Math.pow(Math.max(0, bass - 0.08), 1.5);

  const baseAmount = options.amount ?? 0.005;
  state.effectPass.uniforms.amount.value = options.reactive ? baseAmount * Math.min(1, level * 4) : baseAmount;

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
  if (state.renderer?.domElement?.parentElement) container.removeChild(state.renderer.domElement);
  Object.keys(state).forEach((k) => delete state[k]);
}
