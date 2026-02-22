/**
 * Yugam – waveform rings. Wave amplitude scales with music, rotation on kick.
 */
let THREE = null;
const LINES_CDN = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/lines";
const DIMENSION = 1024;
const MAX_SAMPLES = 40;
const FPS = 60;
const FPS_INTERVAL_MS = 1000 / FPS;

class SampleLine {
  constructor(scene, waveformData, T, Line2, LineGeometry, LineMaterial, resolution, waveCoef) {
    this.scene = scene;
    this.data = new Float32Array(waveformData.length);
    this.data.set(waveformData);
    this.delta = 1;
    this.THREE = T;
    this.Line2 = Line2;
    this.LineGeometry = LineGeometry;
    this.LineMaterial = LineMaterial;
    this.resolution = resolution;
    this.waveCoef = waveCoef;
  }

  init() {
    const positions = [];
    const step = (2 * Math.PI) / DIMENSION;
    const coef = this.waveCoef;
    for (let i = 0; i <= 2 * Math.PI; i += step) {
      const idx = Math.min(positions.length / 3, this.data.length - 1);
      const f = idx >= 0 ? this.data[idx] : 0;
      const r = 1;
      const x = r * Math.cos(i);
      const y = r * Math.sin(i);
      const z = (f / 2) * coef;
      positions.push(x, y, z);
    }
    const geometry = new this.LineGeometry();
    geometry.setPositions(positions);
    const material = new this.LineMaterial({
      color: 0xffffff,
      linewidth: 3,
      transparent: true,
      opacity: 1,
      resolution: this.resolution,
    });
    this.mesh = new this.Line2(geometry, material);
    this.scene.add(this.mesh);
  }

  setResolution(w, h) {
    if (this.mesh?.material?.resolution) {
      this.mesh.material.resolution.set(w, h);
    }
  }

  destroy() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }

  animate(h) {
    this.mesh.scale.set(this.delta, this.delta, 1);
    this.mesh.material.opacity = 1 - this.delta / 7;
    this.mesh.material.color = new this.THREE.Color(
      `hsl(${h}, 100%, ${~~(100 - this.delta * 10)}%)`
    );
    this.delta += 0.09;
  }
}

function initYugam(container, state, w, h) {
  return (async () => {
    try {
      THREE = window.THREE;
      if (!THREE) return false;

      const [{ Line2 }, { LineGeometry }, { LineMaterial }] = await Promise.all([
        import(`${LINES_CDN}/Line2.js`),
        import(`${LINES_CDN}/LineGeometry.js`),
        import(`${LINES_CDN}/LineMaterial.js`),
      ]);
      state.Line2 = Line2;
      state.LineGeometry = LineGeometry;
      state.LineMaterial = LineMaterial;

      const width = w || 800;
      const height = h || 600;

      state.scene = new THREE.Scene();
      state.group = new THREE.Group();
      state.scene.add(state.group);
      state.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 10000);
      state.camera.position.set(0, -4.3, 2.4);
      state.camera.lookAt(0, 0, 0);

      state.renderer = new THREE.WebGLRenderer({ antialias: false });
      state.renderer.setSize(width, height);
      state.renderer.setClearColor(0x000000);
      state.renderer.setPixelRatio(1);
      container.appendChild(state.renderer.domElement);

      state.sampleObj = [];
      state.lastLogicTime = 0;
      state.h = 0;
      state.rotation = 0;
      state.kickRotation = 0;
      state.rotationDir = 1;
      state.initialized = true;
      return true;
    } catch (e) {
      console.error("Yugam init failed:", e);
      return false;
    }
  })();
}

export function render(canvas, ctx, audio, container, options = {}, engine) {
  if (!THREE) THREE = window.THREE;
  if (!THREE) return;

  const state = container.visualizerState;
  if (!state.initialized) {
    if (!state.initPromise) {
      const w = canvas?.width || container.clientWidth || 800;
      const h = canvas?.height || container.clientHeight || 600;
      state.initPromise = initYugam(container, state, w, h);
    }
    return;
  }

  const width = canvas.width;
  const height = canvas.height;
  if (!width || !height) return;

  if (state.renderer.domElement.width !== width || state.renderer.domElement.height !== height) {
    state.renderer.setSize(width, height);
    state.camera.aspect = width / height;
    state.camera.updateProjectionMatrix();
  }

  const bass = audio.bass ?? 0;
  const mid = audio.mid ?? 0;
  const high = audio.high ?? 0;
  const energy = bass + mid * 0.5 + high * 0.3;
  const waveCoef = 0.5 + energy * (options.waveCoef ?? 2);

  if (audio.kick) {
    state.kickRotation += (options.kickRotation ?? 0.5);
    state.rotationDir *= -1;
  }
  state.rotation += state.rotationDir * (0.002 + state.kickRotation * 0.02);
  state.kickRotation *= 0.92;
  const toRad = Math.PI / 180;
  state.group.rotation.x = (options.rotX ?? 0) * toRad;
  state.group.rotation.y = (options.rotY ?? 0) * toRad;
  state.group.rotation.z = state.rotation;

  const fftSize = audio.analyser.fftSize;
  if (!state.waveformData || state.waveformData.length !== fftSize) {
    state.waveformData = new Float32Array(fftSize);
  }
  audio.analyser.getFloatTimeDomainData(state.waveformData);

  const now = performance.now();
  const elapsed = now - state.lastLogicTime;
  if (elapsed > FPS_INTERVAL_MS) {
    state.lastLogicTime = now - (elapsed % FPS_INTERVAL_MS);
    if (state.sampleObj.length === MAX_SAMPLES) {
      state.sampleObj[0].destroy();
      state.sampleObj = state.sampleObj.slice(1);
    }
    const res = new THREE.Vector2(width, height);
    const samp = new SampleLine(
      state.group,
      state.waveformData,
      THREE,
      state.Line2,
      state.LineGeometry,
      state.LineMaterial,
      res,
      waveCoef
    );
    samp.init();
    state.sampleObj.push(samp);
  }

  for (const el of state.sampleObj) {
    el.setResolution(width, height);
    el.animate(state.h);
    state.h += 0.01;
    if (state.h >= 359) state.h = 0;
  }

  state.renderer.render(state.scene, state.camera);
}

export function cleanup(canvas, container, slot) {
  const state = container.visualizerState;
  if (!state?.initialized) return;
  for (const s of state.sampleObj || []) s.destroy();
  state.sampleObj = [];
  if (state.renderer?.domElement?.parentElement) {
    container.removeChild(state.renderer.domElement);
  }
  state.scene?.clear();
  Object.keys(state).forEach((k) => delete state[k]);
}
