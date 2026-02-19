export const fileInputs = { bitmap: { accept: "image/*", label: "Choose image" } };

let THREE = null;

const optionKeys = [
  "kickSphere",
  "bassTunnel",
  "highStars",
  "midRings",
  "glitchBox",
  "lightLeak",
  "floorGrid",
  "waveLine",
  "ghostSpiral",
  "imageBitmap",
];

const moduleConfigs = [
  { id: 1, name: "KICK SPHERE", type: "sphere", color: 0x00ffff },
  { id: 2, name: "BASS TUNNEL", type: "tunnel", color: 0xff0055 },
  { id: 3, name: "HIGH STARS", type: "particles", color: 0xffffff },
  { id: 4, name: "MID RINGS", type: "rings", color: 0xffff00 },
  { id: 5, name: "GLITCH BOX", type: "cube", color: 0x00ff00 },
  { id: 6, name: "LIGHT LEAK", type: "leak", color: 0xff4400 },
  { id: 7, name: "FLOOR GRID", type: "grid", color: 0x4444ff },
  { id: 8, name: "WAVE LINE", type: "line", color: 0xffffff },
  { id: 9, name: "GHOST SPIRAL", type: "spiral", color: 0xaa00ff },
  { id: 10, name: "IMAGE BITMAP", type: "bitmap", color: 0xffffff },
];

function createModule(cfg, state) {
  const group = new THREE.Group();
  group.visible = false;

  if (cfg.type === "sphere") {
    group.add(
      new THREE.Mesh(
        new THREE.IcosahedronGeometry(2, 1),
        new THREE.MeshBasicMaterial({ color: cfg.color, wireframe: true })
      )
    );
  } else if (cfg.type === "tunnel") {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 8, 100, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: cfg.color, wireframe: true, side: THREE.DoubleSide })
    );
    m.rotation.x = Math.PI / 2;
    group.add(m);
  } else if (cfg.type === "particles") {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(1500 * 3).map(() => (Math.random() - 0.5) * 50);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    group.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: cfg.color, size: 0.1 })));
  } else if (cfg.type === "rings") {
    for (let i = 0; i < 6; i++) {
      group.add(
        new THREE.Mesh(
          new THREE.TorusGeometry(i * 1.2 + 2, 0.03, 8, 50),
          new THREE.MeshBasicMaterial({ color: cfg.color })
        )
      );
    }
  } else if (cfg.type === "cube") {
    group.add(
      new THREE.Mesh(
        new THREE.BoxGeometry(3, 3, 3),
        new THREE.MeshBasicMaterial({ color: cfg.color, wireframe: true })
      )
    );
  } else if (cfg.type === "leak") {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 50),
      new THREE.MeshBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
      })
    );
    m.position.z = 5;
    group.add(m);
  } else if (cfg.type === "grid") {
    const m = new THREE.GridHelper(100, 30, cfg.color, cfg.color);
    m.position.y = -8;
    group.add(m);
  } else if (cfg.type === "line") {
    group.add(
      new THREE.Mesh(
        new THREE.BoxGeometry(25, 0.2, 0.2),
        new THREE.MeshBasicMaterial({ color: cfg.color })
      )
    );
  } else if (cfg.type === "spiral") {
    group.add(
      new THREE.Mesh(
        new THREE.TorusKnotGeometry(2, 0.4, 100, 16),
        new THREE.MeshBasicMaterial({ color: cfg.color, wireframe: true })
      )
    );
  } else if (cfg.type === "bitmap") {
    const mat = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      shininess: 100,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(16, 10, 64, 64), mat);
    group.add(mesh);
    group.userData.bitmapMat = mat;
  }

  state.scene.add(group);
  return { group, type: cfg.type };
}

function initThree(container, state) {
  state.textureLoader = new THREE.TextureLoader();
  state.scene = new THREE.Scene();
  state.camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  state.camera.position.z = 12;

  state.renderer = new THREE.WebGLRenderer({ antialias: true });
  state.renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(state.renderer.domElement);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(0, 0, 10);
  state.scene.add(light);
  state.scene.add(new THREE.AmbientLight(0x404040));

  state.modules = moduleConfigs.map((cfg) => createModule(cfg, state));
  state.modules[0].group.visible = true;
  state.initialized = true;
}

export function render(canvas, ctx, audio, container, options = {}) {
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

  optionKeys.forEach((key, i) => {
    state.modules[i].group.visible = key in options ? !!options[key] : i === 0;
  });

  const bitmapMod = state.modules.find((m) => m.type === "bitmap");
  if (bitmapMod && options.bitmap instanceof File && options.bitmap !== state.lastBitmapFile) {
    state.lastBitmapFile = options.bitmap;
    const url = URL.createObjectURL(options.bitmap);
    state.textureLoader.load(url, (t) => {
      bitmapMod.group.userData.bitmapMat.map = t;
      bitmapMod.group.userData.bitmapMat.displacementMap = t;
      bitmapMod.group.userData.bitmapMat.needsUpdate = true;
      URL.revokeObjectURL(url);
    });
  }

  const bass = audio.bass ?? 0;
  const mid = audio.mid ?? 0;
  const high = audio.high ?? 0;

  state.modules.forEach((m) => {
    if (!m.group.visible) return;

    if (m.type === "sphere") {
      m.group.scale.setScalar(1 + bass * 1.5);
      m.group.rotation.y += 0.01 + mid * 0.05;
    }
    if (m.type === "tunnel") {
      m.group.rotation.z += 0.005 + bass * 0.08;
      m.group.position.z = ((m.group.position.z + 0.1 + bass) % 20) - 10;
    }
    if (m.type === "bitmap") {
      const mesh = m.group.children[0];
      mesh.material.displacementScale = bass * 6;
      mesh.rotation.y = Math.sin(Date.now() * 0.001) * 0.2;
    }
    if (m.type === "rings") {
      m.group.children.forEach((r, i) => (r.rotation.x += 0.01 * (i + 1) + mid * 0.04));
    }
    if (m.type === "leak") {
      const mat = m.group.children[0].material;
      mat.opacity = bass > 0.85 ? 0.7 : mat.opacity * 0.92;
    }
    if (m.type === "grid") {
      m.group.position.z = ((m.group.position.z + 0.2 + bass) % 20) - 10;
    }
    if (m.type === "cube") {
      m.group.rotation.set(bass, mid, high);
      m.group.scale.setScalar(0.5 + bass * 2.5);
    }
    if (m.type === "spiral") {
      m.group.rotation.z += 0.02;
      m.group.scale.setScalar(0.8 + mid * 2);
    }
  });

  if (bass > 0.9) {
    state.camera.position.x = (Math.random() - 0.5) * 0.6;
    state.camera.position.y = (Math.random() - 0.5) * 0.6;
  } else {
    state.camera.position.lerp(new THREE.Vector3(0, 0, 12), 0.1);
  }

  state.renderer.render(state.scene, state.camera);
}

export function cleanup(canvas, container, slot) {
  const state = container.visualizerState;
  if (!state?.initialized) return;
  if (state.renderer?.domElement?.parentElement) container.removeChild(state.renderer.domElement);
  state.scene?.clear();
  Object.keys(state).forEach((k) => delete state[k]);
}
