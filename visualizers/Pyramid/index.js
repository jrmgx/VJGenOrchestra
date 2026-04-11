let THREE = null;

function createSqueezedGeometry(verticalSteps = 96, horizontalSteps = 96, fromTop = false) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const vertsPerRow = horizontalSteps + 1;

  for (let i = 0; i <= verticalSteps; i++) {
    const t = i / verticalSteps;
    const halfWidth = 1 - t;
    const y = fromTop ? 1 - t : -1 + t;

    for (let j = 0; j <= horizontalSteps; j++) {
      const u = j / horizontalSteps;
      const x = -halfWidth + 2 * halfWidth * u;
      positions.push(x, y, 0);
      uvs.push(u, t);
    }
  }

  for (let i = 0; i < verticalSteps; i++) {
    for (let j = 0; j < horizontalSteps; j++) {
      const a = i * vertsPerRow + j;
      const b = a + 1;
      const c = a + vertsPerRow + 1;
      const d = a + vertsPerRow;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

function createSqueezedGeometryHorizontal(xSteps = 96, ySteps = 96, fromRight = false) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const vertsPerRow = ySteps + 1;

  for (let i = 0; i <= xSteps; i++) {
    const t = i / xSteps;
    const halfHeight = 1 - t;
    const x = fromRight ? 1 - t : -1 + t;

    for (let j = 0; j <= ySteps; j++) {
      const vAlong = j / ySteps;
      const y = -halfHeight + 2 * halfHeight * vAlong;
      positions.push(x, y, 0);
      uvs.push(vAlong, t);
    }
  }

  for (let i = 0; i < xSteps; i++) {
    for (let j = 0; j < ySteps; j++) {
      const a = i * vertsPerRow + j;
      const b = a + 1;
      const c = a + vertsPerRow + 1;
      const d = a + vertsPerRow;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

function initThree(container, state) {
  const { width, height } = container.getBoundingClientRect();

  state.scene = new THREE.Scene();
  state.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  state.camera.position.z = 1;

  state.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  state.renderer.setClearColor(0x000000, 0);
  state.renderer.setSize(width || 1, height || 1);
  container.appendChild(state.renderer.domElement);

  const matOpts = { color: 0xffffff, side: THREE.DoubleSide };
  state.geometryBottom = createSqueezedGeometry();
  state.geometryTop = createSqueezedGeometry(96, 96, true);
  state.materialBottom = new THREE.MeshBasicMaterial(matOpts);
  state.materialTop = new THREE.MeshBasicMaterial(matOpts);
  state.meshBottom = new THREE.Mesh(state.geometryBottom, state.materialBottom);
  state.meshTop = new THREE.Mesh(state.geometryTop, state.materialTop);
  state.geometryLeft = createSqueezedGeometryHorizontal();
  state.geometryRight = createSqueezedGeometryHorizontal(96, 96, true);
  state.materialLeft = new THREE.MeshBasicMaterial(matOpts);
  state.materialRight = new THREE.MeshBasicMaterial(matOpts);
  state.meshLeft = new THREE.Mesh(state.geometryLeft, state.materialLeft);
  state.meshRight = new THREE.Mesh(state.geometryRight, state.materialRight);
  state.scene.add(state.meshBottom);
  state.scene.add(state.meshTop);
  state.scene.add(state.meshLeft);
  state.scene.add(state.meshRight);

  state.textureBottom = null;
  state.textureTop = null;
  state.textureLeft = null;
  state.textureRight = null;
  state.scroll = 0;
  state.kickPulse = 0;
  state.prevKick = false;
  state.initialized = true;
}

function wrapScroll(s, period) {
  let x = s % period;
  if (x < 0) x += period;
  return x;
}

function ensureSize(container, state) {
  const { width, height } = container.getBoundingClientRect();
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const canvasEl = state.renderer.domElement;
  if (canvasEl.width === w && canvasEl.height === h) return;
  state.renderer.setSize(w, h, false);
}

function applyTextureSettings(tex, state, miror, flipU) {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = miror ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping;
  tex.repeat.set(flipU ? -1 : 1, 2);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  if (state.renderer?.capabilities) {
    tex.anisotropy = state.renderer.capabilities.getMaxAnisotropy();
  }
}

function ensureTextures(state, sourceCanvas, miror) {
  if (!state.textureBottom) {
    state.textureBottom = new THREE.CanvasTexture(sourceCanvas);
    state.textureTop = state.textureBottom.clone();
    state.textureLeft = state.textureBottom.clone();
    state.textureRight = state.textureBottom.clone();
    state.materialBottom.map = state.textureBottom;
    state.materialTop.map = state.textureTop;
    state.materialLeft.map = state.textureLeft;
    state.materialRight.map = state.textureRight;
    state.materialBottom.needsUpdate = true;
    state.materialTop.needsUpdate = true;
    state.materialLeft.needsUpdate = true;
    state.materialRight.needsUpdate = true;
  } else {
    state.textureBottom.image = sourceCanvas;
    state.textureTop.image = sourceCanvas;
    state.textureLeft.image = sourceCanvas;
    state.textureRight.image = sourceCanvas;
  }

  applyTextureSettings(state.textureBottom, state, miror, false);
  applyTextureSettings(state.textureLeft, state, miror, false);
  applyTextureSettings(state.textureTop, state, miror, miror);
  applyTextureSettings(state.textureRight, state, miror, miror);
  state.textureBottom.needsUpdate = true;
  state.textureTop.needsUpdate = true;
  state.textureLeft.needsUpdate = true;
  state.textureRight.needsUpdate = true;
}

export const postProcess = true;

export function render(canvas, ctx, audio, container, options = {}, engine, sourceCanvas) {
  if (!THREE) {
    if (!window.THREE) return;
    THREE = window.THREE;
  }

  const state = container.visualizerState;
  if (!state.initialized) initThree(container, state);
  ensureSize(container, state);

  const { width, height } = canvas;
  if (!sourceCanvas || sourceCanvas.width === 0 || sourceCanvas.height === 0 || !width || !height) {
    ctx.clearRect(0, 0, width, height);
    return;
  }

  const miror = Boolean(options.miror);
  ensureTextures(state, sourceCanvas, miror);

  const scrollPeriod = miror ? 2 : 1;
  const baseSpeed = 0.003;
  const baseMul = options.speed ?? 1;
  let speedMul = baseMul;
  const reactiveAmt = options.reactive ?? 0;
  if (reactiveAmt > 0) {
    if (audio.kick && !state.prevKick) state.kickPulse = 1;
    const pulseDir = Math.sign(baseMul) || 1;
    speedMul += pulseDir * reactiveAmt * state.kickPulse;
    state.kickPulse *= 0.89;
    if (state.kickPulse < 1e-4) state.kickPulse = 0;
  } else {
    state.kickPulse = 0;
  }
  state.prevKick = !!audio.kick;
  state.scroll = wrapScroll(state.scroll + baseSpeed * speedMul, scrollPeriod);
  const flipXOff = miror ? 1 : 0;
  state.textureBottom.offset.set(0, -state.scroll);
  state.textureTop.offset.set(flipXOff, -state.scroll);
  state.textureLeft.offset.set(0, -state.scroll);
  state.textureRight.offset.set(flipXOff, -state.scroll);

  state.renderer.render(state.scene, state.camera);
}

export function cleanup(canvas, container, slot) {
  const state = container.visualizerState;
  if (!state?.initialized) return;

  if (state.renderer?.domElement?.parentElement === container) {
    container.removeChild(state.renderer.domElement);
  }

  state.textureBottom?.dispose();
  state.textureTop?.dispose();
  state.textureLeft?.dispose();
  state.textureRight?.dispose();
  state.materialBottom?.dispose();
  state.materialTop?.dispose();
  state.materialLeft?.dispose();
  state.materialRight?.dispose();
  state.geometryBottom?.dispose();
  state.geometryTop?.dispose();
  state.geometryLeft?.dispose();
  state.geometryRight?.dispose();
  state.scene?.clear();

  Object.keys(state).forEach((key) => delete state[key]);
}
