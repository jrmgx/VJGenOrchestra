export const fileInputs = { glb: { accept: ".glb,.gltf", label: "Choose GLB" } };

let THREE = null;
let GLTFLoader = null;

function getLoadUrl(options, state) {
  if (options.glb instanceof File) {
    if (options.glb === state.lastGlbFile) return state.lastBlobUrl;
    if (state.lastBlobUrl) URL.revokeObjectURL(state.lastBlobUrl);
    state.lastGlbFile = options.glb;
    state.lastBlobUrl = URL.createObjectURL(options.glb);
    return state.lastBlobUrl;
  }
  state.lastGlbFile = null;
  if (state.lastBlobUrl) {
    URL.revokeObjectURL(state.lastBlobUrl);
    state.lastBlobUrl = null;
  }
  return (options.url || "").trim();
}

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

  state.scene.add(new THREE.DirectionalLight(0xffffff, 1));
  state.scene.add(new THREE.AmbientLight(0x404040));

  state.placeholder = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0x4488ff, wireframe: true })
  );
  state.scene.add(state.placeholder);
  state.baseScale = 1;
  state.initialized = true;
}

async function loadModel(url, state) {
  if (!url || url === state.lastUrl) return;
  state.lastUrl = url;
  if (state.model) {
    state.scene.remove(state.model);
    state.model.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
        else o.material.dispose?.();
      }
    });
  }
  state.model = null;

  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        state.model = gltf.scene;
        const box = new THREE.Box3().setFromObject(state.model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        state.model.position.sub(center);
        const maxDim = Math.max(size.x, size.y, size.z);
        state.baseScale = maxDim > 0 ? 4 / maxDim : 1;
        state.model.scale.setScalar(state.baseScale);
        state.scene.add(state.model);
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

  const state = container.visualizerState;
  if (!state.initialized) initThree(container, state);

  const { width, height } = container.getBoundingClientRect();
  if (state.renderer.domElement.width !== width || state.renderer.domElement.height !== height) {
    state.renderer.setSize(width, height);
    state.camera.aspect = width / height;
    state.camera.updateProjectionMatrix();
  }

  const url = getLoadUrl(options, state);
  if (url && url !== state.lastUrl) {
    state.loadPromise = loadModel(url, state).catch(() => { state.loadPromise = null; });
  }
  if (state.loadPromise) await state.loadPromise;

  const bass = audio.bass ?? 0;
  const mid = audio.mid ?? 0;
  const high = audio.high ?? 0;

  const speed = (options.speed ?? 1) * (0.01 + (bass + mid + high) * 0.04);
  const scale = (options.scale ?? 100) / 100;

  if (state.model) {
    state.placeholder.visible = false;
    state.model.rotation.y += speed;
    state.model.rotation.x += speed * 0.3 * (mid - high);
    state.model.scale.setScalar(state.baseScale * scale * (0.8 + bass * 0.5));
  } else {
    state.placeholder.visible = true;
    state.placeholder.rotation.y += speed;
    state.placeholder.rotation.x += speed * 0.3 * (mid - high);
  }

  state.renderer.render(state.scene, state.camera);
}

export function cleanup(canvas, container, slot) {
  const state = container.visualizerState;
  if (!state?.initialized) return;
  if (state.placeholder) state.scene.remove(state.placeholder);
  if (state.model) {
    state.scene.remove(state.model);
    state.model.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose?.();
      }
    });
    state.model = null;
    state.baseScale = 1;
  }
  if (state.renderer?.domElement?.parentElement) container.removeChild(state.renderer.domElement);
  state.scene?.clear();
  state.lastUrl = null;
  state.lastGlbFile = null;
  if (state.lastBlobUrl) URL.revokeObjectURL(state.lastBlobUrl);
  state.lastBlobUrl = null;
  state.loadPromise = null;
  Object.keys(state).forEach((k) => delete state[k]);
}
