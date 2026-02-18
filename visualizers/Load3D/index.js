export const fileInputs = { glb: { accept: ".glb,.gltf", label: "Choose GLB" } };

let THREE = null;
let GLTFLoader = null;
let scene, camera, renderer, model, placeholder, baseScale = 1;
let initialized = false;
let loadPromise = null;
let lastUrl = null;
let lastGlbFile = null;
let lastBlobUrl = null;

function getLoadUrl(options) {
  if (options.glb instanceof File) {
    if (options.glb === lastGlbFile) return lastBlobUrl;
    if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
    lastGlbFile = options.glb;
    lastBlobUrl = URL.createObjectURL(options.glb);
    return lastBlobUrl;
  }
  lastGlbFile = null;
  if (lastBlobUrl) {
    URL.revokeObjectURL(lastBlobUrl);
    lastBlobUrl = null;
  }
  return (options.url || "").trim();
}

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

  scene.add(new THREE.DirectionalLight(0xffffff, 1));
  scene.add(new THREE.AmbientLight(0x404040));

  placeholder = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0x4488ff, wireframe: true })
  );
  scene.add(placeholder);
  initialized = true;
}

async function loadModel(url) {
  if (!url || url === lastUrl) return;
  lastUrl = url;
  if (model) {
    scene.remove(model);
    model.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
        else o.material.dispose?.();
      }
    });
  }
  model = null;

  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        model.position.sub(center);
        const maxDim = Math.max(size.x, size.y, size.z);
        baseScale = maxDim > 0 ? 4 / maxDim : 1;
        model.scale.setScalar(baseScale);
        scene.add(model);
        resolve();
      },
      undefined,
      (err) => {
        console.error("glb3d: load failed", err);
        reject(err);
      }
    );
  });
}

export async function render(canvas, ctx, audio, container, options = {}) {
  if (!THREE) {
    if (!window.THREE) return;
    THREE = window.THREE;
  }
  if (!GLTFLoader) {
    const mod = await import(
      "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/loaders/GLTFLoader.js"
    );
    GLTFLoader = mod.GLTFLoader;
  }

  if (!initialized) initThree(container);

  const { width, height } = container.getBoundingClientRect();
  if (renderer.domElement.width !== width || renderer.domElement.height !== height) {
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  const url = getLoadUrl(options);
  if (url && url !== lastUrl) {
    loadPromise = loadModel(url).catch(() => { loadPromise = null; });
  }
  if (loadPromise) await loadPromise;

  const bass = audio.bass ?? 0;
  const mid = audio.mid ?? 0;
  const high = audio.high ?? 0;

  const speed = (options.speed ?? 1) * (0.01 + (bass + mid + high) * 0.04);
  const scale = (options.scale ?? 100) / 100;

  if (model) {
    placeholder.visible = false;
    model.rotation.y += speed;
    model.rotation.x += speed * 0.3 * (mid - high);
    model.scale.setScalar(baseScale * scale * (0.8 + bass * 0.5));
  } else {
    placeholder.visible = true;
    placeholder.rotation.y += speed;
    placeholder.rotation.x += speed * 0.3 * (mid - high);
  }

  renderer.render(scene, camera);
}

export function cleanup(canvas, container) {
  if (!initialized) return;
  if (placeholder) scene.remove(placeholder);
  if (model) {
    scene.remove(model);
    model.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose?.();
      }
    });
    model = null;
    baseScale = 1;
  }
  if (renderer?.domElement?.parentElement) container.removeChild(renderer.domElement);
  scene?.clear();
  initialized = false;
  lastUrl = null;
  lastGlbFile = null;
  if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
  lastBlobUrl = null;
  loadPromise = null;
}
