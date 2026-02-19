let THREE = null;

function initThree(container, state) {
  state.scene = new THREE.Scene();
  state.camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  state.camera.position.z = 5;

  state.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  state.renderer.setSize(container.clientWidth, container.clientHeight);
  state.renderer.setClearColor(0x000000, 0);
  container.appendChild(state.renderer.domElement);

  state.cubeMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), state.cubeMat);
  state.scene.add(mesh);
  state.cube = mesh;
  state.initialized = true;
}

export const postProcess = true;

export function render(canvas, ctx, audio, container, options = {}, engine, sourceCanvas) {
  if (!THREE) {
    if (!window.THREE) return;
    THREE = window.THREE;
  }

  const state = container.visualizerState;
  if (!state.initialized) initThree(container, state);

  const { width, height } = container.getBoundingClientRect();
  if (state.renderer.domElement.width !== width || state.renderer.domElement.height !== height) {
    state.renderer.setSize(width, height);
    state.camera.aspect = width / height;
    state.camera.updateProjectionMatrix();
  }

  if (sourceCanvas && sourceCanvas.width > 0 && sourceCanvas.height > 0) {
    if (!state.cubeMat.map) state.cubeMat.map = new THREE.CanvasTexture(sourceCanvas);
    else state.cubeMat.map.image = sourceCanvas;
    state.cubeMat.map.needsUpdate = true;
    state.cubeMat.color.setHex(0xffffff);
  } else {
    state.cubeMat.map = null;
    state.cubeMat.color.setHex(0xffffff);
  }

  const bass = audio.bass ?? 0;
  const mid = audio.mid ?? 0;
  const high = audio.high ?? 0;

  const sizePercent = (options.size ?? 90) / 100;
  const visibleHeight = 2 * 5 * Math.tan((75 * Math.PI) / 360);
  const baseSize = 1.5;
  state.cube.scale.setScalar((sizePercent * visibleHeight) / baseSize);

  const baseSpeed = 0.01;
  const speed = baseSpeed + (bass + mid + high) * 0.04;
  const dirX = (mid - high) * 2;
  const dirY = (high - mid) * 2;
  const dirZ = bass - 0.5;

  state.cube.rotation.x += speed * dirX;
  state.cube.rotation.y += speed * dirY;
  state.cube.rotation.z += speed * dirZ;

  state.renderer.render(state.scene, state.camera);
}

export function cleanup(canvas, container, slot) {
  const state = container.visualizerState;
  if (!state?.initialized) return;
  if (state.renderer?.domElement?.parentElement) container.removeChild(state.renderer.domElement);
  state.cubeMat?.dispose();
  state.scene?.clear();
  Object.keys(state).forEach((k) => delete state[k]);
}
