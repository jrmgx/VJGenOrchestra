let THREE = null;
let scene, camera, renderer, points, geometry, material, particleTexture;
let lastParticleType = null;
let lastEngineText = null;
const ASSETS_BASE = new URL("../../assets/textures/", import.meta.url).href;
let velocities, brightness, rotationAngle, rotationSpeed, fadeSpeed, fadePhase;
let initialized = false;
let targetFromPos = { x: 0, y: 0 };
let targetTo = 4;
let targetStartTime = 0;
let lastKick = false;
let kickCount = 0;
const MAX_COUNT = 8000;

const TARGETS = [
  { x: -2.2, y: 1.2 },   // 0: top-left
  { x: 2.2, y: 1.2 },    // 1: top-right
  { x: 2.2, y: -1.2 },   // 2: bottom-right
  { x: -2.2, y: -1.2 },  // 3: bottom-left
  { x: 0, y: 0 },        // 4: middle
  { x: 0, y: 1.2 },      // 5: top edge
  { x: 2.2, y: 0 },      // 6: right edge
  { x: 0, y: -1.2 },     // 7: bottom edge
  { x: -2.2, y: 0 },     // 8: left edge
];

function pickNextTarget(current) {
  const others = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((i) => i !== current);
  return others[Math.floor(Math.random() * others.length)];
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 1 / 6) { r = c; g = x; }
  else if (h < 2 / 6) { r = x; g = c; }
  else if (h < 3 / 6) { g = c; b = x; }
  else if (h < 4 / 6) { g = x; b = c; }
  else if (h < 5 / 6) { r = x; b = c; }
  else { r = c; b = x; }
  return [r + m, g + m, b + m];
}

function createParticleTexture() {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  const cx = size / 2, r = size / 2;
  const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, r);
  g.addColorStop(0, "rgba(255,255,255,0.5)");
  g.addColorStop(0.6, "rgba(255,255,255,0.5)");
  g.addColorStop(0.85, "rgba(255,255,255,0.9)");
  g.addColorStop(1, "rgba(255,255,255,1)");
  ctx.beginPath();
  ctx.arc(cx, cx, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

const POINTS_VERTEX = `
  attribute float size;
  attribute float brightness;
  attribute float rotation;
  attribute float fadeSpeed;
  attribute float fadePhase;
  attribute vec3 color;
  varying vec3 vColor;
  varying float vBrightness;
  varying float vRotation;
  varying float vFadeSpeed;
  varying float vFadePhase;
  void main() {
    vColor = color;
    vBrightness = brightness;
    vRotation = rotation;
    vFadeSpeed = fadeSpeed;
    vFadePhase = fadePhase;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (400.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const POINTS_FRAGMENT = `
  uniform sampler2D map;
  uniform float opacity;
  uniform float time;
  varying vec3 vColor;
  varying float vBrightness;
  varying float vRotation;
  varying float vFadeSpeed;
  varying float vFadePhase;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float c = cos(vRotation), s = sin(vRotation);
    uv = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c) + 0.5;
    vec4 tex = texture2D(map, uv);
    float fade = 0.15 + 0.85 * (0.5 + 0.5 * sin(time * vFadeSpeed + vFadePhase));
    float bri = vBrightness * fade;
    vec4 col = vec4(vColor, 1.0) * tex * bri;
    col.a *= opacity;
    gl_FragColor = col;
  }
`;

function createTextTexture(text) {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  const t = (text || "🙂").trim() || "🙂";
  ctx.font = `bold ${Math.floor(size * 0.75)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "white";
  ctx.fillText(t, size / 2, size / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function loadImageTexture(url, callback) {
  const loader = new THREE.TextureLoader();
  loader.load(
    url,
    (tex) => {
      tex.needsUpdate = true;
      callback(tex);
    },
    undefined,
    () => callback(createParticleTexture())
  );
}

function initThree(container) {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    100
  );
  camera.position.z = 4;

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const posArr = new Float32Array(MAX_COUNT * 3);
  const colArr = new Float32Array(MAX_COUNT * 3);
  velocities = new Float32Array(MAX_COUNT * 3);
  brightness = new Float32Array(MAX_COUNT);
  rotationAngle = new Float32Array(MAX_COUNT);
  rotationSpeed = new Float32Array(MAX_COUNT);
  fadeSpeed = new Float32Array(MAX_COUNT);
  fadePhase = new Float32Array(MAX_COUNT);

  const spread = 3;
  for (let i = 0; i < MAX_COUNT; i++) {
    posArr[i * 3] = (Math.random() - 0.5) * spread * 2;
    posArr[i * 3 + 1] = (Math.random() - 0.5) * spread * 2;
    posArr[i * 3 + 2] = (Math.random() - 0.5) * spread * 2;
    velocities[i * 3] = (Math.random() - 0.5) * 0.00027;
    velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.00027;
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.00027;
    brightness[i] = 1 + 4 * Math.random();
    rotationAngle[i] = Math.random() * Math.PI * 2;
    rotationSpeed[i] = (Math.random() - 0.5) * 0.008;
    fadeSpeed[i] = 0.3 + 1.5 * Math.random();
    fadePhase[i] = Math.random() * Math.PI * 2;
    const [r, g, b] = hslToRgb(Math.random(), 1, 0.65);
    colArr[i * 3] = r;
    colArr[i * 3 + 1] = g;
    colArr[i * 3 + 2] = b;
  }

  const brightArr = new Float32Array(MAX_COUNT);
  const rotArr = new Float32Array(MAX_COUNT);
  const fadeSpeedArr = new Float32Array(MAX_COUNT);
  const fadePhaseArr = new Float32Array(MAX_COUNT);
  for (let i = 0; i < MAX_COUNT; i++) {
    brightArr[i] = brightness[i];
    rotArr[i] = rotationAngle[i];
    fadeSpeedArr[i] = fadeSpeed[i];
    fadePhaseArr[i] = fadePhase[i];
  }

  geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colArr, 3));
  geometry.setAttribute("brightness", new THREE.BufferAttribute(brightArr, 1));
  geometry.setAttribute("rotation", new THREE.BufferAttribute(rotArr, 1));
  geometry.setAttribute("fadeSpeed", new THREE.BufferAttribute(fadeSpeedArr, 1));
  geometry.setAttribute("fadePhase", new THREE.BufferAttribute(fadePhaseArr, 1));

  particleTexture = createParticleTexture();
  const sizeAttr = new Float32Array(MAX_COUNT);
  sizeAttr.fill(0.16);
  geometry.setAttribute("size", new THREE.BufferAttribute(sizeAttr, 1));
  material = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: particleTexture },
      opacity: { value: 0.9 },
      time: { value: 0 },
    },
    vertexShader: POINTS_VERTEX,
    fragmentShader: POINTS_FRAGMENT,
    transparent: true,
    alphaTest: 0.01,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  points = new THREE.Points(geometry, material);
  scene.add(points);
  initialized = true;
}

export function render(canvas, ctx, audio, container, options = {}, engine = {}) {
  if (!THREE) {
    if (!window.THREE) return;
    THREE = window.THREE;
  }

  if (!initialized) {
    targetFromPos = { x: 0, y: 0 };
    targetTo = 4;
    targetStartTime = performance.now();
    initThree(container);
  }

  const { width, height } = container.getBoundingClientRect();
  if (renderer.domElement.width !== width || renderer.domElement.height !== height) {
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  const bass = audio.bass ?? 0;
  const mid = audio.mid ?? 0;
  const high = audio.high ?? 0;
  const kick = audio.kick === 1;
  const energy = bass + mid + high;

  const count = Math.max(1, Math.min(MAX_COUNT, Math.round(options.count ?? 889)));
  const speed = (options.speed ?? 1) * (0.1 + energy * 0.17);
  const sizeMul = (options.size ?? 200) / 100 * (0.7 + bass * 0.6);
  const spreadMul = (options.spread ?? 150) / 100;
  const transitionMs = (options.transitionMs ?? 2500);
  const particleType = options.particleType ?? "bubble";
  const engineText = engine?.text ?? "";

  const needsTextureUpdate =
    particleType !== lastParticleType ||
    (particleType === "text" && engineText !== lastEngineText);

  if (needsTextureUpdate && material) {
    lastParticleType = particleType;
    lastEngineText = engineText;
    particleTexture?.dispose();
    if (particleType === "text") {
      particleTexture = createTextTexture(engineText);
      material.uniforms.map.value = particleTexture;
    } else {
      particleTexture = createParticleTexture();
      material.uniforms.map.value = particleTexture;
      const url = ASSETS_BASE + (particleType === "orbs" ? "orbs.png" : "bubble.png");
      loadImageTexture(url, (tex) => {
        particleTexture?.dispose();
        particleTexture = tex;
        material.uniforms.map.value = tex;
      });
    }
  }

  if (kick && bass > 0.4 && !lastKick) {
    kickCount++;
    if (kickCount % 3 === 1) {
      targetFromPos = { x: points.position.x, y: points.position.y };
      targetTo = pickNextTarget(targetTo);
      targetStartTime = performance.now();
    }
  }
  lastKick = kick && bass > 0.4;

  const elapsed = performance.now() - targetStartTime;
  const frac = Math.min(1, elapsed / transitionMs);
  const ease = frac * frac * (3 - 2 * frac);
  const b = TARGETS[targetTo];
  points.position.x = targetFromPos.x + (b.x - targetFromPos.x) * ease;
  points.position.y = targetFromPos.y + (b.y - targetFromPos.y) * ease;

  geometry.setDrawRange(0, count);
  const baseSize = 0.12 * sizeMul * (1 + high * 0.5);
  material.uniforms.opacity.value = 0.6 + energy * 0.3;
  material.uniforms.time.value = performance.now() * 0.001;
  const sizeAttr = geometry.attributes.size;
  if (sizeAttr) for (let i = 0; i < count; i++) sizeAttr.array[i] = baseSize;
  if (sizeAttr) sizeAttr.needsUpdate = true;

  const posAttr = geometry.attributes.position;
  const rotAttr = geometry.attributes.rotation;

  if (kick && bass > 0.4) {
    const scatter = 0.027 * (0.5 + bass) * spreadMul;
    for (let i = 0; i < count; i++) {
      velocities[i * 3] += (Math.random() - 0.5) * scatter;
      velocities[i * 3 + 1] += (Math.random() - 0.5) * scatter;
      velocities[i * 3 + 2] += (Math.random() - 0.5) * scatter;
    }
  }

  const spread = 3 * spreadMul;
  for (let i = 0; i < count; i++) {
    posAttr.array[i * 3] += velocities[i * 3] * speed;
    posAttr.array[i * 3 + 1] += velocities[i * 3 + 1] * speed;
    posAttr.array[i * 3 + 2] += velocities[i * 3 + 2] * speed;

    velocities[i * 3] *= 0.98;
    velocities[i * 3 + 1] *= 0.98;
    velocities[i * 3 + 2] *= 0.98;

    if (posAttr.array[i * 3] < -spread) posAttr.array[i * 3] += spread * 2;
    else if (posAttr.array[i * 3] > spread) posAttr.array[i * 3] -= spread * 2;
    if (posAttr.array[i * 3 + 1] < -spread) posAttr.array[i * 3 + 1] += spread * 2;
    else if (posAttr.array[i * 3 + 1] > spread) posAttr.array[i * 3 + 1] -= spread * 2;
    if (posAttr.array[i * 3 + 2] < -spread) posAttr.array[i * 3 + 2] += spread * 2;
    else if (posAttr.array[i * 3 + 2] > spread) posAttr.array[i * 3 + 2] -= spread * 2;

    rotationAngle[i] = (rotationAngle[i] + rotationSpeed[i]) % (Math.PI * 2);
    rotAttr.array[i] = rotationAngle[i];
  }

  posAttr.needsUpdate = true;
  rotAttr.needsUpdate = true;

  renderer.render(scene, camera);
}

export function cleanup(canvas, container) {
  if (!initialized) return;
  scene.remove(points);
  geometry?.dispose();
  material?.dispose();
  particleTexture?.dispose();
  if (renderer?.domElement?.parentElement) container.removeChild(renderer.domElement);
  scene?.clear();
  initialized = false;
}
