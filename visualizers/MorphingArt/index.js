'use strict';

// MorphingArt by Techartist – particle shapes with audio reactivity

let THREE = null;
const N = 20000;
const NSTAR = 6000;
const SPEED = 0.02;
const NAMES = ['Supernova Spiral', 'Quantum Lattice', 'Stellar Torus', 'Celestial Helix'];

function patSpiral(i, n) {
  const t = i / n;
  const arms = 5;
  const arm = i % arms;
  const θ = 3 * 2 * Math.PI * Math.pow(t, 0.7) + arm * 2 * Math.PI / arms;
  const r = t * 50 + Math.pow(t, 2) * 10;
  const z = Math.cos(t * 6 * Math.PI) * 5 * t;
  return new THREE.Vector3(Math.cos(θ) * r, Math.sin(θ) * r, z);
}

const Φ = (1 + Math.sqrt(5)) / 2;
const R = 28;
let NODES = null;
let EDGES = null;

function ensureIcosahedron() {
  if (NODES) return;
  const raw = [[-1, Φ, 0], [1, Φ, 0], [-1, -Φ, 0], [1, -Φ, 0], [0, -1, Φ], [0, 1, Φ], [0, -1, -Φ], [0, 1, -Φ], [Φ, 0, -1], [Φ, 0, 1], [-Φ, 0, -1], [-Φ, 0, 1]];
  NODES = raw.map(v => {
    const l = Math.hypot(...v);
    return new THREE.Vector3(v[0] / l * R, v[1] / l * R, v[2] / l * R);
  });
  const ELEN = 4 * R / Math.sqrt(10 + 2 * Math.sqrt(5));
  EDGES = [];
  for (let a = 0; a < 12; a++) {
    for (let b = a + 1; b < 12; b++) {
      if (Math.abs(NODES[a].distanceTo(NODES[b]) - ELEN) < 1e-3) EDGES.push([a, b]);
    }
  }
}

function patLattice(i, n) {
  const quota = Math.floor(n * 0.5);
  if (i < quota) {
    const node = i % NODES.length;
    const r = Math.cbrt(Math.random()) * 6;
    const u = Math.random();
    const v = Math.random();
    const θ = 2 * Math.PI * u;
    const φ = Math.acos(2 * v - 1);
    const off = new THREE.Vector3(r * Math.sin(φ) * Math.cos(θ), r * Math.sin(φ) * Math.sin(θ), r * Math.cos(φ));
    return NODES[node].clone().add(off);
  }
  const perEdge = Math.max(1, Math.floor((n - quota) / EDGES.length));
  const loc = i - quota;
  const eIdx = Math.floor(loc / perEdge) % EDGES.length;
  const τ = (loc % perEdge) / perEdge;
  const [ai, bi] = EDGES[eIdx];
  const A = NODES[ai];
  const B = NODES[bi];
  const mid = A.clone().add(B).multiplyScalar(0.5);
  const dir = B.clone().sub(A).normalize();
  const perp = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
  mid.add(perp.multiplyScalar(4));
  const p = new THREE.Vector3(
    (1 - τ) * (1 - τ) * A.x + 2 * (1 - τ) * τ * mid.x + τ * τ * B.x,
    (1 - τ) * (1 - τ) * A.y + 2 * (1 - τ) * τ * mid.y + τ * τ * B.y,
    (1 - τ) * (1 - τ) * A.z + 2 * (1 - τ) * τ * mid.z + τ * τ * B.z
  );
  p.add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5));
  return p;
}

const SIN45 = Math.SQRT1_2;
const COS45 = Math.SQRT1_2;

function patTorus(i, n) {
  const MAJ = Math.floor(Math.sqrt(n));
  const MIN = Math.floor(n / MAJ);
  const u = (i % MAJ) / MAJ * 2 * Math.PI;
  const v = Math.floor(i / MAJ) / MIN * 2 * Math.PI;
  const Rmaj = 40;
  const Rmin = 10;
  const x = (Rmaj + Rmin * Math.cos(v)) * Math.cos(u);
  const y = Rmin * Math.sin(v);
  const z = (Rmaj + Rmin * Math.cos(v)) * Math.sin(u);
  const y2 = y * COS45 - z * SIN45;
  const z2 = y * SIN45 + z * COS45;
  const breath = 0.6 * Math.sin(v * 3 + u * 2);
  return new THREE.Vector3(
    (x + breath) * (1 + 0.02 * (Math.random() - 0.5)),
    y2 * (1 + 0.02 * (Math.random() - 0.5)),
    (z2 + breath) * (1 + 0.02 * (Math.random() - 0.5))
  );
}

function patHelix(i, n) {
  const hel = i % 2;
  const r = 35;
  const turns = 5;
  const height = 80;
  const half = n / 2;
  const t = (i % half) / half;
  const θ = t * turns * 2 * Math.PI;
  const y = (t - 0.5) * height;
  const φ = hel * Math.PI;
  const x = Math.cos(θ + φ) * r;
  const z = Math.sin(θ + φ) * r;
  if (i % 20 === 0) {
    const bt = (i % 200) / 200;
    const b = Math.sin(bt * 2 * Math.PI);
    return new THREE.Vector3(Math.cos(θ) * r * (1 - b) + Math.cos(θ + Math.PI) * r * b, y, Math.sin(θ) * r * (1 - b) + Math.sin(θ + Math.PI) * r * b);
  }
  if (i % 10 === 0) {
    const or = r + 10 + Math.random() * 15;
    const oy = y + (Math.random() - 0.5) * 10;
    return new THREE.Vector3(Math.cos(θ + Math.random()) * or, oy, Math.sin(θ + Math.random()) * or);
  }
  const rv = 1 + 0.2 * Math.sin(θ * 3);
  const j = 0.8;
  return new THREE.Vector3(x * rv + (Math.random() - 0.5) * j, y + (Math.random() - 0.5) * j, z * rv + (Math.random() - 0.5) * j);
}

const PATTERNS = [patSpiral, patLattice, patTorus, patHelix];
const PALETTE_HEX = [
  [0xff3300, 0xff6600, 0xff9900, 0xffcc00, 0xffff00],
  [0x6600cc, 0x9900ff, 0xcc00ff, 0x6600ff, 0x330099],
  [0x007777, 0x00a999, 0x00d5bb, 0x33ffdd, 0x88fff1],
  [0x9900ff, 0x6600ff, 0x0066ff, 0x00ccff, 0x9966ff]
];
let PALETTES = null;

function ensurePalettes() {
  if (PALETTES) return;
  PALETTES = PALETTE_HEX.map(arr => arr.map(c => new THREE.Color(c)));
}

function starTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, '#fff');
  g.addColorStop(0.1, 'rgba(255,255,255,0.8)');
  g.addColorStop(0.25, 'rgba(128,128,255,0.5)');
  g.addColorStop(0.5, 'rgba(64,64,200,0.3)');
  g.addColorStop(1, 'rgba(0,0,64,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.moveTo(16, 8);
  ctx.lineTo(16, 24);
  ctx.moveTo(8, 16);
  ctx.lineTo(24, 16);
  ctx.stroke();
  return new THREE.CanvasTexture(c);
}

function dotTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, '#fff');
  g.addColorStop(0.2, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.4, 'rgba(200,200,255,0.5)');
  g.addColorStop(0.8, 'rgba(100,100,200,0.2)');
  g.addColorStop(1, 'rgba(0,0,64,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

async function loadAddons() {
  const [oc, ep, rp, ubp] = await Promise.all([
    import('three/examples/jsm/controls/OrbitControls.js'),
    import('three/examples/jsm/postprocessing/EffectComposer.js'),
    import('three/examples/jsm/postprocessing/RenderPass.js'),
    import('three/examples/jsm/postprocessing/UnrealBloomPass.js')
  ]);
  return { OrbitControls: oc.OrbitControls, EffectComposer: ep.EffectComposer, RenderPass: rp.RenderPass, UnrealBloomPass: ubp.UnrealBloomPass };
}

function makeStars(scene, state) {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(NSTAR * 3);
  const c = new Float32Array(NSTAR * 3);
  const s = new Float32Array(NSTAR);
  for (let i = 0; i < NSTAR; i++) {
    const R = 800;
    const φ = Math.acos(2 * Math.random() - 1);
    const θ = Math.random() * 2 * Math.PI;
    p[i * 3] = R * Math.sin(φ) * Math.cos(θ);
    p[i * 3 + 1] = R * Math.sin(φ) * Math.sin(θ);
    p[i * 3 + 2] = R * Math.cos(φ);
    const r = Math.random();
    let Rcol, Gcol, Bcol;
    if (r < 0.5) { Rcol = Gcol = Bcol = 0.8 + Math.random() * 0.2; s[i] = 0.5 + Math.random() * 0.5; }
    else if (r < 0.85) { Rcol = 0.8 + Math.random() * 0.2; Gcol = 0.6 + Math.random() * 0.3; Bcol = 0.4 + Math.random() * 0.2; s[i] = 0.6 + Math.random() * 0.6; }
    else if (r < 0.98) { Rcol = 0.4 + Math.random() * 0.2; Gcol = 0.6 + Math.random() * 0.2; Bcol = 0.8 + Math.random() * 0.2; s[i] = 0.7 + Math.random() * 0.9; }
    else { Rcol = 0.8 + Math.random() * 0.2; Gcol = 0.2 + Math.random() * 0.2; Bcol = 0.2 + Math.random() * 0.2; s[i] = 0.7 + Math.random() * 0.9; }
    c[i * 3] = Rcol;
    c[i * 3 + 1] = Gcol;
    c[i * 3 + 2] = Bcol;
  }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.setAttribute('size', new THREE.BufferAttribute(s, 1));
  const m = new THREE.PointsMaterial({ size: 1.5, map: starTex(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const stars = new THREE.Points(g, m);
  scene.add(stars);
  state.stars = stars;
}

function makeParticles(scene, state, current) {
  const geo = new THREE.BufferGeometry();
  const p = new Float32Array(N * 3);
  const c = new Float32Array(N * 3);
  const s = new Float32Array(N);
  const pat = PATTERNS[current];
  const pal = PALETTES[current];
  for (let i = 0; i < N; i++) {
    const v = pat(i, N);
    p[i * 3] = v.x;
    p[i * 3 + 1] = v.y;
    p[i * 3 + 2] = v.z;
    let idx = Math.floor(Math.random() * pal.length);
    const b = 0.8 + Math.random() * 0.4;
    if (current === 0) {
      const u = i / N;
      idx = Math.min(Math.floor((1 - Math.pow(u, 0.5)) * pal.length), pal.length - 1);
    }
    const col = pal[idx];
    c[i * 3] = col.r * b;
    c[i * 3 + 1] = col.g * b;
    c[i * 3 + 2] = col.b * b;
    s[i] = 0.8 + Math.random() * 1.8;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(s, 1));
  geo.userData.currentColors = new Float32Array(c);
  const mat = new THREE.PointsMaterial({ size: 2.5, map: dotTex(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const particles = new THREE.Points(geo, mat);
  scene.add(particles);
  state.particles = particles;
  state.geoPart = geo;
  state.basePositions = new Float32Array(p);
}

function startMorph(state, nxt) {
  const geo = state.geoPart;
  const fromP = new Float32Array(geo.attributes.position.array);
  const fromC = geo.userData.currentColors;
  const fromS = new Float32Array(geo.attributes.size.array);
  const toP = new Float32Array(fromP.length);
  const toC = new Float32Array(fromC.length);
  const toS = new Float32Array(fromS.length);
  const pat = PATTERNS[nxt];
  const pal = PALETTES[nxt];
  for (let i = 0; i < N; i++) {
    const v = pat(i, N);
    toP[i * 3] = v.x;
    toP[i * 3 + 1] = v.y;
    toP[i * 3 + 2] = v.z;
    let idx = Math.floor(Math.random() * pal.length);
    const b = 0.8 + Math.random() * 0.4;
    if (nxt === 0) {
      const u = i / N;
      idx = Math.min(Math.floor((1 - Math.pow(u, 0.5)) * pal.length), pal.length - 1);
    }
    const col = pal[idx];
    toC[i * 3] = col.r * b;
    toC[i * 3 + 1] = col.g * b;
    toC[i * 3 + 2] = col.b * b;
    toS[i] = 0.8 + Math.random() * 1.8;
  }
  state.morphData = { fromP, toP, fromC, toC, fromS, toS, target: nxt };
  state.isTrans = true;
  state.prog = 0;
}

function finishMorph(state) {
  const d = state.morphData;
  const geo = state.geoPart;
  geo.attributes.position.array.set(d.toP);
  geo.attributes.color.array.set(d.toC);
  geo.attributes.size.array.set(d.toS);
  geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = geo.attributes.size.needsUpdate = true;
  geo.userData.currentColors = new Float32Array(d.toC);
  state.current = d.target;
  state.isTrans = false;
  state.prog = 0;
  state.morphData = null;
  state.basePositions = new Float32Array(d.toP);
}

function liveAnim(state, time, audio = {}) {
  const { energy = 0.5, kick = false } = audio;
  const amp = (1 + energy * 4 + (kick ? 2 : 0)) * 1.5;
  const base = state.basePositions;
  const pos = state.geoPart.attributes.position.array;
  state.animAngle = (state.animAngle ?? 0) + 0.008;
  const angle = state.animAngle;
  const cur = state.current;

  for (let i = 0; i < N; i++) {
    const x = i * 3;
    const y = x + 1;
    const z = x + 2;
    let bx = base[x];
    let by = base[y];
    let bz = base[z];

    if (cur === 0) {
      const d = Math.hypot(bx, by);
      if (d > 0.1) {
        const a = 0.005 * (1 - Math.min(d / 50, 0.8)) * angle * 10;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const tx = bx * c - by * s;
        by = bx * s + by * c;
        bx = tx;
      }
    } else if (cur === 2) {
      const cs = Math.cos(angle * 0.5);
      const sn = Math.sin(angle * 0.5);
      const tx = bx * cs - bz * sn;
      bz = bx * sn + bz * cs;
      bx = tx;
    } else if (cur === 3) {
      const dir = i % 2 ? 1 : -1;
      const cs = Math.cos(angle * dir * 0.3);
      const sn = Math.sin(angle * dir * 0.3);
      const tx = bx * cs - bz * sn;
      bz = bx * sn + bz * cs;
      bx = tx;
    }

    const oscX = amp * Math.sin(time * 2.1 + i * 0.012);
    const oscY = amp * Math.sin(time * 1.7 + i * 0.017);
    const oscZ = amp * Math.sin(time * 1.3 + i * 0.019);

    pos[x] = bx + oscX;
    pos[y] = by + oscY;
    pos[z] = bz + oscZ;
  }
  state.geoPart.attributes.position.needsUpdate = true;
}

export function render(canvas, ctx, audio, container, options = {}, engine) {
  if (!THREE) {
    if (!window.THREE) return;
    THREE = window.THREE;
  }
  ensureIcosahedron();
  ensurePalettes();

  const state = container.visualizerState;
  if (!state.addonsReady) {
    state.addonsPromise = state.addonsPromise || loadAddons();
    state.addonsPromise.then(addons => {
      state.addons = addons;
      state.addonsReady = true;
    });
    return;
  }

  if (!state.initialized) {
    const w = Math.max(1, container.clientWidth || 1);
    const h = Math.max(1, container.clientHeight || 1);
    state.scene = new THREE.Scene();
    state.camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
    state.camera.position.z = 100;

    state.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    state.renderer.setSize(w, h);
    state.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    state.renderer.setClearColor(0x000000, 0);
    container.appendChild(state.renderer.domElement);

    const addons = state.addons;
    state.controls = new addons.OrbitControls(state.camera, state.renderer.domElement);
    state.controls.enableDamping = true;
    state.controls.dampingFactor = 0.1;
    state.controls.rotateSpeed = 0.5;
    state.controls.zoomSpeed = 0.7;
    state.controls.minDistance = 30;
    state.controls.maxDistance = 200;
    state.controls.enablePan = false;
    state.controls.autoRotate = true;

    state.composer = new addons.EffectComposer(state.renderer);
    state.composer.addPass(new addons.RenderPass(state.scene, state.camera));
    state.composer.addPass(new addons.UnrealBloomPass(new THREE.Vector2(w, h), 0.35, 0.4, 0.9));

    makeStars(state.scene, state);
    state.current = 0;
    makeParticles(state.scene, state, 0);
    state.time = 0;
    state.initialized = true;
  }


  const { width, height } = container.getBoundingClientRect();
  const w = Math.max(1, width || 1);
  const h = Math.max(1, height || 1);
  if (state.renderer.domElement.width !== w || state.renderer.domElement.height !== h) {
    state.renderer.setSize(w, h);
    state.camera.aspect = w / h;
    state.camera.updateProjectionMatrix();
    state.composer.setSize(w, h);
    state.composer.passes[1].resolution.set(w, h);
  }

  const bass = audio.bass ?? 0;
  const mid = audio.mid ?? 0;
  const high = audio.high ?? 0;
  const kick = audio.kick === 1;
  const energy = Math.min(1, (bass + mid + high) / 2);

  const optsShape = Math.max(0, Math.min(3, Math.floor(Number(options.shape) || 0)));
  const reactive = options.reactive === true || options.reactive === 'true';
  const changeShapeOnKick = options.changeShapeOnKick !== false;

  if (state.lastOptionsShape != null && optsShape !== state.lastOptionsShape) {
    state.kickTargetShape = null;
  }
  state.lastOptionsShape = optsShape;

  let targetShape = optsShape;
  if (changeShapeOnKick && kick && !state.isTrans) {
    const others = [0, 1, 2, 3].filter(s => s !== state.current);
    state.kickTargetShape = others[Math.floor(Math.random() * others.length)];
  }
  if (changeShapeOnKick && state.kickTargetShape != null) targetShape = state.kickTargetShape;
  if (!changeShapeOnKick) state.kickTargetShape = null;

  if (targetShape !== state.current && !state.isTrans) {
    startMorph(state, targetShape);
  }

  state.time += 0.01;
  const time = state.time;

  let rotBoost = 1;
  if (reactive && kick) rotBoost = 20;
  state.controls.autoRotateSpeed = 1.5 * rotBoost * (0.8 + energy * 0.6);
  state.controls.update();

  if (state.isTrans) {
    state.prog += SPEED * (1 + energy * 2 + (kick ? 1.5 : 0));
    if (state.prog >= 1) {
      finishMorph(state);
    } else {
      const e = state.prog < 0.5 ? 4 * state.prog * state.prog * state.prog : 1 - Math.pow(-2 * state.prog + 2, 3) / 2;
      const d = state.morphData;
      const pos = state.geoPart.attributes.position.array;
      const col = state.geoPart.attributes.color.array;
      const size = state.geoPart.attributes.size.array;
      for (let i = 0; i < pos.length; i++) pos[i] = d.fromP[i] * (1 - e) + d.toP[i] * e;
      for (let i = 0; i < col.length; i++) col[i] = d.fromC[i] * (1 - e) + d.toC[i] * e;
      for (let i = 0; i < size.length; i++) size[i] = d.fromS[i] * (1 - e) + d.toS[i] * e;
      state.geoPart.attributes.position.needsUpdate = state.geoPart.attributes.color.needsUpdate = state.geoPart.attributes.size.needsUpdate = true;
    }
  } else {
    liveAnim(state, time, { bass, mid, high, energy, kick });
  }

  if (state.stars) {
    state.stars.rotation.y += 0.0001;
    state.stars.rotation.x += 0.00005;
  }

  const sizeMul = 0.7 + energy * 1.2 + (kick ? 0.5 : 0);
  state.particles.material.size = 2.5 * sizeMul;

  state.composer.render();
}

export function cleanup(canvas, container, slot) {
  const state = container.visualizerState;
  if (!state?.initialized) return;
  state.scene?.remove(state.particles);
  state.scene?.remove(state.stars);
  state.geoPart?.dispose();
  state.particles?.material?.map?.dispose();
  state.particles?.material?.dispose();
  state.stars?.geometry?.dispose();
  state.stars?.material?.map?.dispose();
  state.stars?.material?.dispose();
  if (state.renderer?.domElement?.parentElement) container.removeChild(state.renderer.domElement);
  state.scene?.clear();
  Object.keys(state).forEach(k => delete state[k]);
}
