let THREE = null;
const CDN = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/postprocessing";

// Shaders inspired by Camera Filter Pack (VETASOFT 2018)
// CameraFilterPack_Distortion_Water_Drop, CameraFilterPack_Light_Water2
const WaterDropShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    amount: { value: 1 },
    waveIntensity: { value: 1 },
    numberOfWaves: { value: 5 },
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
uniform float time;
uniform float amount;
uniform float waveIntensity;
uniform float numberOfWaves;
varying vec2 vUv;

float genWave(float len, float PI, float t) {
  float wave = sin(8.0 * PI * len + t);
  wave = (wave + 1.0) * 0.5;
  wave -= 0.3;
  wave *= wave * wave;
  return wave;
}

float scene(float len, float PI, float t) {
  return genWave(len, PI, t) * waveIntensity / 3.0;
}

void main() {
  float PI = 3.0 + numberOfWaves;
  float t = -time * 5.0;
  vec2 so = vec2(0.5, 0.5);
  vec2 pos2 = vUv - so;
  float len = length(pos2);
  float wave = scene(len, PI, t);
  vec2 uv2 = -normalize(pos2) * wave / (1.0 + 5.0 * len) * amount;
  vec2 uv = vUv + uv2;
  gl_FragColor = texture2D(tDiffuse, uv);
}
`,
};

// Inspired by CameraFilterPack_Light_Water2 (VETASOFT 2018)
const LightWater2Shader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    amount: { value: 1 },
    speed: { value: 0.2 },
    speedX: { value: 0.2 },
    speedY: { value: 0.3 },
    intensity: { value: 2.4 },
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
uniform float time;
uniform float amount;
uniform float speed;
uniform float speedX;
uniform float speedY;
uniform float intensity;
varying vec2 vUv;

float col(vec2 coord) {
  float t = time * 1.3;
  float deltaTheta = 0.8975979010256552;
  float c = 0.0;
  for (int i = 0; i < 8; i++) {
    vec2 adjc = coord;
    float theta = deltaTheta * float(i);
    adjc.x += cos(theta) * t * speed + t * speedX;
    adjc.y -= sin(theta) * t * speed - t * speedY;
    c += cos((adjc.x * cos(theta) - adjc.y * sin(theta)) * 6.0) * intensity;
  }
  return cos(c);
}

void main() {
  vec2 p = vUv;
  vec2 c1 = p, c2 = p;
  float cc1 = col(c1);
  c2.x += 8.53;
  float dx = 0.50 * (cc1 - col(c2)) / 60.0 * amount;
  c2.x = p.x;
  c2.y += 8.53;
  float dy = 0.50 * (cc1 - col(c2)) / 60.0 * amount;
  c1.x += dx * 2.0;
  c1.y += dy * 2.0;
  gl_FragColor = texture2D(tDiffuse, c1);
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
    state.waterDropPass = new ShaderPass(WaterDropShader);
    state.composer.addPass(state.waterDropPass);
    state.lightWater2Pass = new ShaderPass(LightWater2Shader);
    state.composer.addPass(state.lightWater2Pass);

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

  const t = (state.startTime ??= performance.now());
  const time = (performance.now() - t) / 1000;

  const waterDrop = options.waterDrop ?? 0;
  const lightWater2 = options.lightWater2 ?? 0;

  state.waterDropPass.uniforms.time.value = time;
  state.waterDropPass.uniforms.amount.value = waterDrop;
  state.waterDropPass.uniforms.waveIntensity.value = 1;
  state.waterDropPass.uniforms.numberOfWaves.value = 5;

  state.lightWater2Pass.uniforms.time.value = time;
  state.lightWater2Pass.uniforms.amount.value = lightWater2;
  state.lightWater2Pass.uniforms.speed.value = 0.2;
  state.lightWater2Pass.uniforms.speedX.value = 0.2;
  state.lightWater2Pass.uniforms.speedY.value = 0.3;
  state.lightWater2Pass.uniforms.intensity.value = 2.4;

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
