let THREE = null;
let scene, camera, renderer, cube, cubeMat;
let initialized = false;

function initThree(container) {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.z = 5;

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  cubeMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), cubeMat);
  scene.add(mesh);
  cube = mesh;
  initialized = true;
}

export const postProcess = true;

export function render(canvas, ctx, analyser, container, options = {}, sourceCanvas) {
  if (!THREE) {
    if (!window.THREE) return;
    THREE = window.THREE;
  }

  if (!initialized) {
    initThree(container);
  }

  const { width, height } = container.getBoundingClientRect();
  if (renderer.domElement.width !== width || renderer.domElement.height !== height) {
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  if (sourceCanvas && sourceCanvas.width > 0 && sourceCanvas.height > 0) {
    if (!cubeMat.map) cubeMat.map = new THREE.CanvasTexture(sourceCanvas);
    else cubeMat.map.image = sourceCanvas;
    cubeMat.map.needsUpdate = true;
    cubeMat.color.setHex(0xffffff);
  } else {
    cubeMat.map = null;
    cubeMat.color.setHex(0xffffff);
  }

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);
  const bass = dataArray[2] / 255;
  const mid = dataArray[20] / 255;
  const high = dataArray[60] / 255;

  const sizePercent = (options.size ?? 90) / 100;
  const visibleHeight = 2 * 5 * Math.tan((75 * Math.PI) / 360);
  const baseSize = 1.5;
  cube.scale.setScalar((sizePercent * visibleHeight) / baseSize);

  const baseSpeed = 0.01;
  const speed = baseSpeed + (bass + mid + high) * 0.04;
  const dirX = (mid - high) * 2;
  const dirY = (high - mid) * 2;
  const dirZ = bass - 0.5;

  cube.rotation.x += speed * dirX;
  cube.rotation.y += speed * dirY;
  cube.rotation.z += speed * dirZ;

  renderer.render(scene, camera);
}

export function cleanup(canvas, container) {
  if (!initialized) return;
  if (renderer?.domElement?.parentElement) container.removeChild(renderer.domElement);
  cubeMat?.dispose();
  scene?.clear();
  initialized = false;
}
