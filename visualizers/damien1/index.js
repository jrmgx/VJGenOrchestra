const THREE_CDN = "https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.module.js";

let THREE = null;
let loadPromise = null;
let scene, camera, renderer, modules;
let initialized = false;
const optionKeys = ["bokeh", "sphere", "tunnel"];

const BokehShader = {
  uniforms: {
    uTime: { value: 0 },
    uBass: { value: 0 },
    uHigh: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    varying float vVisible;
    uniform float uBass;
    uniform float uTime;
    attribute float aSize;
    attribute vec3 aColor;
    varying vec3 vColor;

    void main() {
      vColor = aColor;
      vec3 pos = position;
      pos.x += sin(uTime * 0.2 + position.z) * 2.0;
      pos.y += cos(uTime * 0.15 + position.x) * 2.0;
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = aSize * (150.0 / -mvPosition.z) * (1.0 + uBass * 1.5);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform float uBass;
    varying vec3 vColor;

    void main() {
      vec2 uv = gl_PointCoord - vec2(0.5);
      float dist = length(uv);
      float ring = smoothstep(0.35, 0.4, dist) * smoothstep(0.5, 0.45, dist);
      float maskValue = sin(gl_FragCoord.x * 0.01 + uTime) * cos(gl_FragCoord.y * 0.01);
      float clip = smoothstep(-0.2, 0.5, maskValue + dist);
      vec3 finalColor = vColor;
      if(dist > 0.43) finalColor *= vec3(1.2, 0.8, 1.5);
      float alpha = ring * clip * (0.5 + uBass);
      if (alpha < 0.01) discard;
      gl_FragColor = vec4(finalColor, alpha);
    }
  `,
};

function createModule(cfg) {
  const group = new THREE.Group();
  group.visible = false;

  if (cfg.type === "pureBokeh") {
    const count = 400;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 100;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 100;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
      const r = Math.random();
      if (r < 0.3) {
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 0.8;
        colors[i * 3 + 2] = 0.2;
      } else if (r < 0.6) {
        colors[i * 3] = 0.2;
        colors[i * 3 + 1] = 0.9;
        colors[i * 3 + 2] = 1.0;
      } else {
        colors[i * 3] = 0.8;
        colors[i * 3 + 1] = 0.2;
        colors[i * 3 + 2] = 1.0;
      }
      sizes[i] = Math.random() * 5 + 2;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(BokehShader.uniforms),
      vertexShader: BokehShader.vertexShader,
      fragmentShader: BokehShader.fragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    group.add(new THREE.Points(geo, mat));
  } else if (cfg.type === "sphere") {
    group.add(
      new THREE.Mesh(
        new THREE.IcosahedronGeometry(2, 1),
        new THREE.MeshBasicMaterial({ color: cfg.color, wireframe: true })
      )
    );
  } else if (cfg.type === "tunnel") {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 8, 100, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: cfg.color,
        wireframe: true,
        side: THREE.DoubleSide,
      })
    );
    m.rotation.x = Math.PI / 2;
    group.add(m);
  }

  scene.add(group);
  return { group, type: cfg.type };
}

function initThree(container) {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.z = 30;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const configs = [
    { name: "BOKEH", type: "pureBokeh" },
    { name: "SPHERE", type: "sphere", color: 0x00ffff },
    { name: "TUNNEL", type: "tunnel", color: 0xff0055 },
  ];

  modules = configs.map((cfg) => createModule(cfg));
  modules[0].group.visible = true;
  initialized = true;
}

export function render(canvas, ctx, analyser, container, options = {}) {
  if (!THREE) {
    if (!loadPromise)
      loadPromise = import(THREE_CDN).then((m) => {
        THREE = m;
      });
    return;
  }

  if (!initialized) {
    canvas.style.display = "none";
    initThree(container);
  }

  const { width, height } = container.getBoundingClientRect();
  if (renderer.domElement.width !== width || renderer.domElement.height !== height) {
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  optionKeys.forEach((key, i) => {
    modules[i].group.visible = key in options ? !!options[key] : i === 0;
  });

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);
  const bass = dataArray[4] / 255;
  const time = Date.now() * 0.001;

  modules.forEach((m) => {
    if (!m.group.visible) return;
    if (m.type === "pureBokeh") {
      const mat = m.group.children[0].material;
      mat.uniforms.uTime.value = time;
      mat.uniforms.uBass.value = bass;
    }
    if (m.type === "sphere") {
      m.group.scale.setScalar(1 + bass);
      m.group.rotation.y += 0.01;
    }
  });

  renderer.render(scene, camera);
}

export function cleanup(canvas, container) {
  if (!initialized) return;
  canvas.style.display = "";
  if (renderer?.domElement?.parentElement)
    container.removeChild(renderer.domElement);
  scene?.clear();
  initialized = false;
}
