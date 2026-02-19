let THREE = null;
const CDN = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/postprocessing";

const KaleidoscopeShader = {
  uniforms: {
    tDiffuse: { value: null },
    segments: { value: 6 },
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
uniform float segments;
varying vec2 vUv;
void main() {
  vec2 uv = vUv - 0.5;
  float angle = atan(uv.y, uv.x);
  float radius = length(uv) * 2.0;
  float segmentAngle = 6.28318 / segments;
  angle = mod(angle + 3.14159, segmentAngle);
  angle = abs(angle - segmentAngle * 0.5) + segmentAngle * 0.5;
  vec2 folded = vec2(cos(angle), sin(angle)) * radius * 0.5 + 0.5;
  gl_FragColor = texture2D(tDiffuse, folded);
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
    state.effectPass = new ShaderPass(KaleidoscopeShader);
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

  const baseSegments = options.segments ?? 6;
  let segments = baseSegments;
  if (options.reactive) {
    const bass = audio.bass ?? 0;
    const mid = audio.mid ?? 0;
    const high = audio.high ?? 0;
    const level = bass * 0.5 + mid * 0.3 + high * 0.2;
    const kickBoost = audio.kick ? 3 : 0;
    segments = baseSegments + level * 2 + kickBoost;
  }
  state.effectPass.uniforms.segments.value = Math.max(2, Math.round(segments));

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
