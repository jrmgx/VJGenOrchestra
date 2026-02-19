const BOUNDS = { x: 4, y: 2.5, z: 0 };

export const postProcess = true;

let THREE = null;
let scene, camera, renderer;
let bubbles = [];
let bubbleMaterial = null;
let chainTexture = null;
let overlayScene = null;
let overlayCamera = null;
let overlayMesh = null;
let initialized = false;
let quietFrames = 0;
let lastBurstTime = 0;
let kickPoint = null;
let kickStrength = 0;
let kickScatterCenter = null;
let kickScatter = 0;
let kickCenterPull = 0;
let kickTowardPoint = false;

const FRESNEL_VERTEX = `
uniform float mRefractionRatio;
uniform float mFresnelBias;
uniform float mFresnelScale;
uniform float mFresnelPower;
varying vec3 vReflect;
varying vec3 vRefract[3];
varying float vReflectionFactor;
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vec3 worldNormal = normalize(mat3(modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz) * normal);
  vec3 I = worldPosition.xyz - cameraPosition;
  vReflect = reflect(I, worldNormal);
  vRefract[0] = refract(normalize(I), worldNormal, mRefractionRatio);
  vRefract[1] = refract(normalize(I), worldNormal, mRefractionRatio * 0.99);
  vRefract[2] = refract(normalize(I), worldNormal, mRefractionRatio * 0.98);
  vReflectionFactor = mFresnelBias + mFresnelScale * pow(1.0 + dot(normalize(I), worldNormal), mFresnelPower);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const FRESNEL_FRAGMENT = `
uniform sampler2D tEnv;
varying vec3 vReflect;
varying vec3 vRefract[3];
varying float vReflectionFactor;
vec2 dirToUV(vec3 dir) {
  float u = atan(dir.z, dir.x) / 6.28318530718 + 0.5;
  float v = asin(clamp(dir.y, -1.0, 1.0)) / 3.14159265359 + 0.5;
  return vec2(u, v);
}
void main() {
  vec4 reflectedColor = texture2D(tEnv, dirToUV(normalize(vec3(-vReflect.x, vReflect.yz))));
  vec4 refractedColor;
  refractedColor.r = texture2D(tEnv, dirToUV(normalize(vec3(-vRefract[0].x, vRefract[0].yz)))).r;
  refractedColor.g = texture2D(tEnv, dirToUV(normalize(vec3(-vRefract[1].x, vRefract[1].yz)))).g;
  refractedColor.b = texture2D(tEnv, dirToUV(normalize(vec3(-vRefract[2].x, vRefract[2].yz)))).b;
  refractedColor.a = 1.0;
  gl_FragColor = mix(refractedColor, reflectedColor, clamp(vReflectionFactor, 0.0, 1.0));
}
`;

function makeBubbleMaterial(options) {
  const ratio = options.refractionRatio ?? 1.02;
  const bias = options.fresnelBias ?? 0.1;
  const power = options.fresnelPower ?? 2.0;
  const scale = options.fresnelScale ?? 1.0;
  return new THREE.ShaderMaterial({
    vertexShader: FRESNEL_VERTEX,
    fragmentShader: FRESNEL_FRAGMENT,
    uniforms: {
      mRefractionRatio: { value: ratio },
      mFresnelBias: { value: bias },
      mFresnelPower: { value: power },
      mFresnelScale: { value: scale },
      tEnv: { value: null },
    },
    transparent: true,
    depthWrite: true,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
  });
}

function spawnBubble(options, group) {
  const sizeMin = (options.sizeMin ?? 30) / 1000;
  const sizeMax = (options.sizeMax ?? 150) / 1000;
  const baseScale = sizeMin + Math.random() * Math.max(0, sizeMax - sizeMin);
  const geo = new THREE.SphereGeometry(1, 32, 32);
  const mesh = new THREE.Mesh(geo, bubbleMaterial);
  mesh.position.set(
    (Math.random() - 0.5) * BOUNDS.x * 2,
    (Math.random() - 0.5) * BOUNDS.y * 2,
    (Math.random() - 0.5) * BOUNDS.z * 2
  );
  scene.add(mesh);
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.001 + Math.random() * 0.0025;
  const scalePhase = Math.random() * Math.PI * 2;
  const pulseAmp = 0.05 + Math.random() * 0.12;
  const pulse = 1 + pulseAmp * Math.sin(scalePhase);
  mesh.scale.setScalar(baseScale * pulse);
  return {
    mesh,
    velocity: new THREE.Vector3(Math.cos(angle) * speed, Math.sin(angle) * speed, 0),
    baseScale,
    scalePhase,
    scaleSpeed: 0.03 + Math.random() * 0.08,
    zigzagPhase: Math.random() * Math.PI * 2,
    zigzagFreq: 0.2 + Math.random() * 1,
    zigzagAmp: 0.0004 + Math.random() * 0.0008,
    turbulenceAmt: 0.0002 + Math.random() * 0.0006,
    turbulencePhase: Math.random() * Math.PI * 2,
    damping: 0.994 + Math.random() * 0.005,
    kickResponse: 0.6 + Math.random() * 0.8,
    pulseAmp,
    group: group ?? (Math.random() < 0.5 ? 1 : 2),
    collisionCount: 0,
    burstThreshold: 5 + Math.floor(Math.random() * 25),
    radius: baseScale * pulse,
    age: 0,
    lifetime: 3 + Math.random() * 8,
  };
}

function burstBubble(b, options) {
  scene.remove(b.mesh);
  b.mesh.geometry.dispose();
  const replacement = spawnBubble(options, b.group);
  const idx = bubbles.indexOf(b);
  bubbles[idx] = replacement;
}

function initThree(container) {
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-4, 4, 2.5, -2.5, 0.1, 100);
  camera.position.z = 8;
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(0x000000, 1);
  container.appendChild(renderer.domElement);

  const dir = new THREE.DirectionalLight(0xffffff, 1);
  dir.position.set(2, 2, 5);
  scene.add(dir);
  scene.add(new THREE.AmbientLight(0x404040));
  const point = new THREE.PointLight(0x88ccff, 0.5);
  point.position.set(-3, 2, 5);
  scene.add(point);

  bubbleMaterial = makeBubbleMaterial({});
  overlayScene = new THREE.Scene();
  overlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const overlayGeo = new THREE.PlaneGeometry(2, 2);
  const overlayMat = new THREE.MeshBasicMaterial({
    map: null,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.MaxEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  });
  overlayMesh = new THREE.Mesh(overlayGeo, overlayMat);
  overlayMesh.position.z = -0.5;
  overlayScene.add(overlayMesh);
  initialized = true;
}

export function render(canvas, ctx, audio, container, options = {}, engine, chainCanvas) {
  if (!THREE) {
    if (!window.THREE) return;
    THREE = window.THREE;
  }

  if (!initialized) initThree(container);

  if (chainCanvas?.width && chainCanvas?.height) {
    if (!chainTexture) {
      chainTexture = new THREE.CanvasTexture(chainCanvas);
      chainTexture.generateMipmaps = false;
      chainTexture.minFilter = THREE.LinearFilter;
      chainTexture.magFilter = THREE.LinearFilter;
      bubbleMaterial.uniforms.tEnv.value = chainTexture;
    }
    chainTexture.needsUpdate = true;
  }

  const ratio = options.refractionRatio ?? 1.02;
  const bias = options.fresnelBias ?? 0.1;
  const power = options.fresnelPower ?? 2.0;
  const scale = options.fresnelScale ?? 1.0;
  bubbleMaterial.uniforms.mRefractionRatio.value = ratio;
  bubbleMaterial.uniforms.mFresnelBias.value = bias;
  bubbleMaterial.uniforms.mFresnelPower.value = power;
  bubbleMaterial.uniforms.mFresnelScale.value = scale;

  const count = Math.max(100, Math.min(1000, options.count ?? 100));
  while (bubbles.length < count) bubbles.push(spawnBubble(options));
  while (bubbles.length > count) {
    const b = bubbles.pop();
    scene.remove(b.mesh);
    b.mesh.geometry.dispose();
  }

  const { width, height } = container.getBoundingClientRect();
  if (renderer.domElement.width !== width || renderer.domElement.height !== height) {
    renderer.setSize(width, height);
    const aspect = width / height;
    camera.left = -4 * aspect;
    camera.right = 4 * aspect;
    camera.top = 2.5;
    camera.bottom = -2.5;
    camera.updateProjectionMatrix();
  }

  const bass = audio.bass ?? 0;
  const mid = audio.mid ?? 0;
  const high = audio.high ?? 0;
  const kick = audio.kick === 1;
  const energy = bass + mid + high;
  if (energy < 0.15) quietFrames++;
  else quietFrames = 0;

  if (kick && bass > 0.5) {
    kickTowardPoint = !kickTowardPoint;
    if (kickTowardPoint) {
      kickPoint = null;
      kickScatterCenter = null;
      kickScatter = 0;
      kickCenterPull = 0;
      const edge = Math.floor(Math.random() * 4);
      if (edge === 0) kickPoint = { x: (Math.random() - 0.5) * BOUNDS.x * 2, y: BOUNDS.y };
      else if (edge === 1) kickPoint = { x: (Math.random() - 0.5) * BOUNDS.x * 2, y: -BOUNDS.y };
      else if (edge === 2) kickPoint = { x: -BOUNDS.x, y: (Math.random() - 0.5) * BOUNDS.y * 2 };
      else kickPoint = { x: BOUNDS.x, y: (Math.random() - 0.5) * BOUNDS.y * 2 };
      kickStrength = 0.0025 * (0.5 + bass);
    } else if (bubbles.length > 0) {
      kickPoint = null;
      kickStrength = 0;
      let cx = 0, cy = 0;
      for (const b of bubbles) {
        cx += b.mesh.position.x;
        cy += b.mesh.position.y;
      }
      kickScatterCenter = { x: cx / bubbles.length, y: cy / bubbles.length };
      kickScatter = 0.0018 * (0.5 + bass);
      kickCenterPull = 0.0012 * (0.5 + bass);
    }
  }
  kickStrength *= 0.96;
  kickScatter *= 0.96;
  kickCenterPull *= 0.96;

  if (quietFrames > 60 && Date.now() - lastBurstTime > 2000) {
    if (bubbles.length > 0) {
      burstBubble(bubbles[Math.floor(Math.random() * bubbles.length)], options);
      lastBurstTime = Date.now();
    }
  } else if (Math.random() < 0.001 && bubbles.length > 0) {
    burstBubble(bubbles[Math.floor(Math.random() * bubbles.length)], options);
  }

  const t = performance.now() * 0.001;
  const speedMul = (options.speed ?? 1) * (0.5 + energy * 0.3);

  for (const b of bubbles) {
    const vx = b.velocity.x, vy = b.velocity.y;
    const vLen = Math.sqrt(vx * vx + vy * vy) || 0.001;
    const perpX = -vy / vLen, perpY = vx / vLen;
    const zigzag = Math.sin(t * b.zigzagFreq + b.zigzagPhase) * b.zigzagAmp * speedMul;
    b.velocity.x += perpX * zigzag;
    b.velocity.y += perpY * zigzag;
    const turb = b.turbulenceAmt * (0.5 + 0.5 * Math.sin(t * 2.3 + b.turbulencePhase));
    b.velocity.x += (Math.random() - 0.5) * turb;
    b.velocity.y += (Math.random() - 0.5) * turb;
    const kr = b.kickResponse;
    if (kickPoint && kickStrength > 0.0001) {
      const dx = kickPoint.x - b.mesh.position.x;
      const dy = kickPoint.y - b.mesh.position.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const s = kickStrength * speedMul * 0.5 * kr;
      b.velocity.x += (dx / d) * s;
      b.velocity.y += (dy / d) * s;
    } else if (kickScatterCenter && (kickScatter > 0.0001 || kickCenterPull > 0.0001)) {
      const px = b.mesh.position.x, py = b.mesh.position.y;
      const dxAway = px - kickScatterCenter.x;
      const dyAway = py - kickScatterCenter.y;
      const dAway = Math.sqrt(dxAway * dxAway + dyAway * dyAway) || 1;
      const sAway = kickScatter * speedMul * 0.5 * kr;
      b.velocity.x += (dxAway / dAway) * sAway;
      b.velocity.y += (dyAway / dAway) * sAway;
      const dCenter = Math.sqrt(px * px + py * py) || 1;
      const sCenter = kickCenterPull * speedMul * 0.5 * kr;
      b.velocity.x -= (px / dCenter) * sCenter;
      b.velocity.y -= (py / dCenter) * sCenter;
    }
    b.velocity.multiplyScalar(b.damping);
    const maxV = 0.01 * speedMul;
    b.velocity.x = Math.max(-maxV, Math.min(maxV, b.velocity.x));
    b.velocity.y = Math.max(-maxV, Math.min(maxV, b.velocity.y));
    b.mesh.position.x += b.velocity.x;
    b.mesh.position.y += b.velocity.y;

    const w = BOUNDS.x * 2, h = BOUNDS.y * 2;
    if (b.mesh.position.x < -BOUNDS.x) b.mesh.position.x += w;
    else if (b.mesh.position.x > BOUNDS.x) b.mesh.position.x -= w;
    if (b.mesh.position.y < -BOUNDS.y) b.mesh.position.y += h;
    else if (b.mesh.position.y > BOUNDS.y) b.mesh.position.y -= h;

    b.scalePhase += b.scaleSpeed + energy * 0.02;
    const pulse = 1 + b.pulseAmp * Math.sin(b.scalePhase);
    b.mesh.scale.setScalar(b.baseScale * pulse);
    b.radius = b.baseScale * pulse;
    b.age += 1 / 60;
  }

  const toBurst = [];
  for (let i = 0; i < bubbles.length; i++) {
    const a = bubbles[i];
    for (let j = i + 1; j < bubbles.length; j++) {
      const b = bubbles[j];
      if (a.group !== b.group) continue;
      const dx = b.mesh.position.x - a.mesh.position.x;
      const dy = b.mesh.position.y - a.mesh.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const rSum = a.radius + b.radius;
      if (dist < rSum) {
        a.collisionCount++;
        b.collisionCount++;
        const nx = dx / dist, ny = dy / dist;
        const overlap = rSum - dist;
        a.mesh.position.x -= nx * overlap * 0.5;
        a.mesh.position.y -= ny * overlap * 0.5;
        b.mesh.position.x += nx * overlap * 0.5;
        b.mesh.position.y += ny * overlap * 0.5;
        const dvx = a.velocity.x - b.velocity.x;
        const dvy = a.velocity.y - b.velocity.y;
        const vn = dvx * nx + dvy * ny;
        if (vn < 0) {
          a.velocity.x -= vn * nx;
          a.velocity.y -= vn * ny;
          b.velocity.x += vn * nx;
          b.velocity.y += vn * ny;
        }
      }
    }
    if (a.collisionCount >= a.burstThreshold) toBurst.push(a);
  }
  for (const b of toBurst) burstBubble(b, options);

  const w = BOUNDS.x * 2, h = BOUNDS.y * 2;
  for (const b of bubbles) {
    if (b.mesh.position.x < -BOUNDS.x) b.mesh.position.x += w;
    else if (b.mesh.position.x > BOUNDS.x) b.mesh.position.x -= w;
    if (b.mesh.position.y < -BOUNDS.y) b.mesh.position.y += h;
    else if (b.mesh.position.y > BOUNDS.y) b.mesh.position.y -= h;
  }

  renderer.render(scene, camera);
  if (options.showTexture && chainTexture) {
    overlayMesh.material.map = chainTexture;
    overlayMesh.material.visible = true;
    renderer.autoClear = false;
    renderer.render(overlayScene, overlayCamera);
    renderer.autoClear = true;
  }
}

export function cleanup(canvas, container) {
  if (!initialized) return;
  for (const b of bubbles) {
    scene.remove(b.mesh);
    b.mesh.geometry.dispose();
  }
  bubbles = [];
  bubbleMaterial?.dispose();
  bubbleMaterial = null;
  chainTexture?.dispose();
  chainTexture = null;
  overlayMesh?.geometry?.dispose();
  overlayMesh?.material?.dispose();
  overlayMesh = null;
  overlayScene = null;
  overlayCamera = null;
  if (renderer?.domElement?.parentElement) container.removeChild(renderer.domElement);
  scene?.clear();
  initialized = false;
}
