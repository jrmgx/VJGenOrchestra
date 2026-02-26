let THREE = null;

export const postProcess = true;

const TILES = 19;
const PLANE_SIZE = 20;

function init(container, state) {
  THREE = window.THREE;
  if (!THREE) return false;

  const { width, height } = container.getBoundingClientRect();
  const aspect = Math.max(0.01, width / height);

  state.scene = new THREE.Scene();
  state.camera = new THREE.OrthographicCamera(
    -10 * aspect, 10 * aspect,
    10, -10,
    0.1, 100
  );
  state.camera.position.z = 5;
  state.camera.lookAt(0, 0, 0);

  state.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
  state.renderer.setSize(width, height);
  state.renderer.setClearColor(0x000000, 0);
  container.appendChild(state.renderer.domElement);

  state.texture = new THREE.CanvasTexture(document.createElement("canvas"));
  state.texture.repeat.set(TILES, TILES);

  const geo = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE);
  const mat = new THREE.MeshBasicMaterial({
    map: state.texture,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  state.mesh = new THREE.Mesh(geo, mat);
  state.scene.add(state.mesh);

  state.offsetX = 0;
  state.offsetY = 0;
  state.lastTime = performance.now() / 1000;
  state.initialized = true;
  return true;
}

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

  const mirror = options.mirror ?? false;
  state.texture.wrapS = state.texture.wrapT = mirror ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping;

  let zoom = options.zoom ?? 0;
  if (options.zoomReactive) {
    const level = ((audio.bass ?? 0) + (audio.mid ?? 0) + (audio.high ?? 0)) / 3;
    zoom *= 0.9 + 0.2 * level;
  }
  const speedX = options.speedX ?? 0;
  const speedY = options.speedY ?? 0;
  const resetToken = Number(options.resetOffset) || 0;
  if (resetToken && resetToken !== state.lastResetToken) {
    state.offsetX = 0;
    state.offsetY = 0;
    state.lastResetToken = resetToken;
  }

  const now = performance.now() / 1000;
  const dt = now - state.lastTime;
  state.lastTime = now;

  const moveX = speedX;
  const moveY = speedY;
  const wrap = mirror ? 2 : 1;
  state.offsetX = (state.offsetX + moveX * dt) % wrap;
  state.offsetY = (state.offsetY + moveY * dt) % wrap;
  if (state.offsetX < 0) state.offsetX += wrap;
  if (state.offsetY < 0) state.offsetY += wrap;
  state.texture.offset.set(state.offsetX, state.offsetY);

  const aspect = width / height;
  const zoomFactor = 1 + zoom * 59;
  const half = 10 / zoomFactor;
  const halfW = half * Math.max(aspect, 1);
  const halfH = half * Math.max(1, 1 / aspect);
  state.camera.left = -halfW;
  state.camera.right = halfW;
  state.camera.top = halfH;
  state.camera.bottom = -halfH;
  state.camera.updateProjectionMatrix();

  const scaleX = aspect >= 1 ? aspect : 1;
  const scaleY = aspect >= 1 ? 1 : 1 / aspect;
  state.mesh.scale.set(scaleX, scaleY, 1);

  if (state.renderer.domElement.width !== width || state.renderer.domElement.height !== height) {
    state.renderer.setSize(width, height);
  }

  state.renderer.setRenderTarget(null);
  state.renderer.clear();
  state.renderer.render(state.scene, state.camera);
}

export function cleanup(canvas, container, slot) {
  const state = container.visualizerState;
  if (!state?.initialized) return;
  state.texture?.dispose();
  state.mesh?.geometry?.dispose();
  state.mesh?.material?.dispose();
  if (state.renderer?.domElement?.parentElement) container.removeChild(state.renderer.domElement);
  Object.keys(state).forEach((k) => delete state[k]);
}
