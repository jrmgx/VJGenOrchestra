/**
 * Neon – glowing curve trail, kick-reactive.
 * On each kick: pick random zone (9-grid), pick random point in zone, move neon there.
 * Shader from https://github.com/nickshanks/threejs-toys
 */

let THREE = null;

const SHADER_POINTS = 16;
const NEON_FRAGMENT = `
  float sdBezier(vec2 pos, vec2 A, vec2 B, vec2 C) {
    vec2 a = B - A;
    vec2 b = A - 2.0*B + C;
    vec2 c = a * 2.0;
    vec2 d = A - pos;
    float kk = 1.0 / dot(b,b);
    float kx = kk * dot(a,b);
    float ky = kk * (2.0*dot(a,a)+dot(d,b)) / 3.0;
    float kz = kk * dot(d,a);
    float res = 0.0;
    float p = ky - kx*kx;
    float p3 = p*p*p;
    float q = kx*(2.0*kx*kx - 3.0*ky) + kz;
    float h = q*q + 4.0*p3;
    if(h >= 0.0){
      h = sqrt(h);
      vec2 x = (vec2(h, -h) - q) / 2.0;
      vec2 uv = sign(x)*pow(abs(x), vec2(1.0/3.0));
      float t = uv.x + uv.y - kx;
      t = clamp( t, 0.0, 1.0 );
      vec2 qos = d + (c + b*t)*t;
      res = length(qos);
    } else {
      float z = sqrt(-p);
      float v = acos( q/(p*z*2.0) ) / 3.0;
      float m = cos(v);
      float n = sin(v)*1.732050808;
      vec3 t = vec3(m + m, -n - m, n - m) * z - kx;
      t = clamp( t, 0.0, 1.0 );
      vec2 qos = d + (c + b*t.x)*t.x;
      float dis = dot(qos,qos);
      res = dis;
      qos = d + (c + b*t.y)*t.y;
      dis = dot(qos,qos);
      res = min(res,dis);
      qos = d + (c + b*t.z)*t.z;
      dis = dot(qos,qos);
      res = min(res,dis);
      res = sqrt( res );
    }
    return res;
  }

  uniform vec2 uRatio;
  uniform vec2 uSize;
  uniform vec2 uPoints[SHADER_POINTS];
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float intensity = 1.0;
    vec2 pos = (vUv - 0.5) * uRatio;
    vec2 c = (uPoints[0] + uPoints[1]) / 2.0;
    vec2 c_prev;
    float dist = 10000.0;
    for(int i = 0; i < SHADER_POINTS - 1; i++){
      c_prev = c;
      c = (uPoints[i] + uPoints[i + 1]) / 2.0;
      dist = min(dist, sdBezier(pos, c_prev, uPoints[i], c));
    }
    dist = max(0.0, dist);
    float glow = pow(uSize.y / dist, intensity);
    vec3 col = vec3(0.0);
    col += 10.0 * vec3(smoothstep(uSize.x, 0.0, dist));
    col += glow * uColor;
    col = 1.0 - exp(-col);
    col = pow(col, vec3(0.4545));
    gl_FragColor = vec4(col, 1.0);
  }
`;

// 9 zones: 0=TL, 1=T, 2=TR, 3=L, 4=M, 5=R, 6=BL, 7=B, 8=BR. Bounds in [-0.5, 0.5] normalized space.
const ZONE_BOUNDS = [
  { x: [-0.5, -1 / 3], y: [1 / 3, 0.5] },   // 0 top-left
  { x: [-1 / 3, 1 / 3], y: [1 / 3, 0.5] },  // 1 top
  { x: [1 / 3, 0.5], y: [1 / 3, 0.5] },     // 2 top-right
  { x: [-0.5, -1 / 3], y: [-1 / 3, 1 / 3] },// 3 left
  { x: [-1 / 3, 1 / 3], y: [-1 / 3, 1 / 3] },// 4 middle
  { x: [1 / 3, 0.5], y: [-1 / 3, 1 / 3] },  // 5 right
  { x: [-0.5, -1 / 3], y: [-0.5, -1 / 3] }, // 6 bottom-left
  { x: [-1 / 3, 1 / 3], y: [-0.5, -1 / 3] },// 7 bottom
  { x: [1 / 3, 0.5], y: [-0.5, -1 / 3] },   // 8 bottom-right
];

function randomInZone(zoneIdx) {
  const z = ZONE_BOUNDS[zoneIdx];
  const x = z.x[0] + Math.random() * (z.x[1] - z.x[0]);
  const y = z.y[0] + Math.random() * (z.y[1] - z.y[0]);
  return { x, y };
}

function initNeon(container, state, w, h, options) {
  THREE = window.THREE;
  if (!THREE) return false;

  const curvePoints = options.curvePoints ?? 80;
  const curveLerp = options.curveLerp ?? 0.5;
  const radius1 = options.radius1 ?? 5;
  const radius2 = options.radius2 ?? 30;

  state.uRatio = new THREE.Vector2(1, 1);
  state.uSize = new THREE.Vector2(radius1, radius2);
  state.curvePoints = curvePoints;
  state.curveLerp = curveLerp;
  state.radius1 = radius1;
  state.radius2 = radius2;

  state.neons = [
    { points: null, curve: null, target: { x: 0, y: 0 }, goal: { x: 0, y: 0 }, uPoints: null, uColor: new THREE.Color(0xff00ff), mesh: null },
    { points: null, curve: null, target: { x: 0, y: 0 }, goal: { x: 0, y: 0 }, uPoints: null, uColor: new THREE.Color(0x00ffff), mesh: null },
  ];

  const geo = new THREE.PlaneGeometry(2, 2);
  for (const neon of state.neons) {
    neon.points = Array.from({ length: curvePoints }, () => new THREE.Vector2(0, 0));
    neon.curve = new THREE.SplineCurve(neon.points);
    neon.uPoints = Array.from({ length: SHADER_POINTS }, () => new THREE.Vector2(0, 0));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uRatio: { value: state.uRatio },
        uSize: { value: state.uSize },
        uPoints: { value: neon.uPoints },
        uColor: { value: neon.uColor },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
      `,
      fragmentShader: NEON_FRAGMENT,
      defines: { SHADER_POINTS },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    neon.mesh = new THREE.Mesh(geo.clone(), mat);
  }

  state.scene = new THREE.Scene();
  state.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  for (const neon of state.neons) state.scene.add(neon.mesh);

  state.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
  state.renderer.setSize(w, h);
  state.renderer.setClearColor(0x000000, 0);
  state.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(state.renderer.domElement);

  state.initialized = true;
  return true;
}

function updateUniforms(state, w, h) {
  state.uSize.set(state.radius1, state.radius2);
  if (w >= h) {
    state.uRatio.set(1, h / w);
    state.uSize.multiplyScalar(1 / w);
  } else {
    state.uRatio.set(w / h, 1);
    state.uSize.multiplyScalar(1 / h);
  }
}

export function render(canvas, ctx, audio, container, options = {}, engine) {
  if (!THREE) THREE = window.THREE;
  if (!THREE) return;

  const state = container.visualizerState;
  const w = canvas.width || container.clientWidth || 800;
  const h = canvas.height || container.clientHeight || 600;

  if (!state.initialized) {
    if (!state.initPromise) {
      state.initPromise = Promise.resolve(initNeon(container, state, w, h, options));
    }
    return;
  }

  if (state.renderer.domElement.width !== w || state.renderer.domElement.height !== h) {
    state.renderer.setSize(w, h);
  }

  updateUniforms(state, w, h);

  const cooldownMs = options.cooldown ?? 400;
  const moveSpeed = options.speed ?? 0.08;
  const now = performance.now();
  const timeSinceKick = now - (state.lastKickTime ?? 0);
  const idleAfterMs = 3000;
  const r = 0.25;
  const idleSpeed = 0.0008;
  const { curveLerp, curvePoints, uRatio } = state;

  for (let n = 0; n < state.neons.length; n++) {
    const neon = state.neons[n];
    const phase = n * Math.PI;

    if (audio.kick && timeSinceKick >= cooldownMs) {
      if (n === 0) state.lastKickTime = now;
      const zone = Math.floor(Math.random() * 9);
      const pt = randomInZone(zone);
      neon.goal.x = pt.x;
      neon.goal.y = pt.y;
    } else if (timeSinceKick >= idleAfterMs) {
      neon.goal.x = r * Math.cos(now * idleSpeed + phase);
      neon.goal.y = r * Math.sin(now * idleSpeed + phase);
    }

    neon.target.x += (neon.goal.x - neon.target.x) * moveSpeed;
    neon.target.y += (neon.goal.y - neon.target.y) * moveSpeed;

    neon.points[0].set(neon.target.x * uRatio.x, neon.target.y * uRatio.y);
    for (let i = 1; i < curvePoints; i++) {
      neon.points[i].lerp(neon.points[i - 1], curveLerp);
    }
    for (let i = 0; i < SHADER_POINTS; i++) {
      neon.curve.getPoint(i / (SHADER_POINTS - 1), neon.uPoints[i]);
    }

    neon.uColor.r = 0.5 + 0.5 * Math.cos(performance.now() * 0.0015 + phase * 0.5);
    neon.uColor.g = 0;
    neon.uColor.b = 1 - neon.uColor.r;
  }

  state.renderer.render(state.scene, state.camera);
}

export function cleanup(canvas, container, slot) {
  const state = container.visualizerState;
  if (!state?.initialized) return;
  if (state.renderer?.domElement?.parentElement) {
    container.removeChild(state.renderer.domElement);
  }
  for (const neon of state.neons || []) {
    neon.mesh?.geometry?.dispose();
    neon.mesh?.material?.dispose();
  }
  state.scene?.clear();
  Object.keys(state).forEach((k) => delete state[k]);
}
