/*
Adapted from WebGL Fluid Simulation by Pavel Dobryakov
Source: https://github.com/PavelDoGreat/WebGL-Fluid-Simulation
License: MIT
*/

const DEFAULT_OPTIONS = {
  velocityDiffusion: 2,
  vorticity: 15,
  colorful: true,
  primaryColor: "#1a1aff"
};

const FIXED_CONFIG = {
  SIM_RESOLUTION: 128,
  DYE_RESOLUTION: 512,
  DENSITY_DISSIPATION: 1,
  PRESSURE: 0.8,
  PRESSURE_ITERATIONS: 20,
  SPLAT_RADIUS: 0.25,
  SPLAT_FORCE: 6000,
  SHADING: true,
  SUNRAYS: true,
  SUNRAYS_RESOLUTION: 196,
  SUNRAYS_WEIGHT: 1.0,
  COLOR_UPDATE_SPEED: 10
};

const ZONE_BOUNDS = [
  { x: [-0.5, -1 / 3], y: [1 / 3, 0.5] },
  { x: [-1 / 3, 1 / 3], y: [1 / 3, 0.5] },
  { x: [1 / 3, 0.5], y: [1 / 3, 0.5] },
  { x: [-0.5, -1 / 3], y: [-1 / 3, 1 / 3] },
  { x: [-1 / 3, 1 / 3], y: [-1 / 3, 1 / 3] },
  { x: [1 / 3, 0.5], y: [-1 / 3, 1 / 3] },
  { x: [-0.5, -1 / 3], y: [-0.5, -1 / 3] },
  { x: [-1 / 3, 1 / 3], y: [-0.5, -1 / 3] },
  { x: [1 / 3, 0.5], y: [-0.5, -1 / 3] }
];

function randomInZone(zoneIdx) {
  const z = ZONE_BOUNDS[zoneIdx];
  const x = z.x[0] + Math.random() * (z.x[1] - z.x[0]);
  const y = z.y[0] + Math.random() * (z.y[1] - z.y[0]);
  return { x, y };
}

const NEON_IDLE_AFTER_MS = 3000;

function hexToPrimarySplatColor(hex) {
  const s = String(hex ?? "").replace(/^#/, "");
  const n = parseInt(s, 16);
  if (s.length !== 6 || Number.isNaN(n)) {
    const k = 0.15;
    return { r: 0.5 * k, g: 0.5 * k, b: 0.5 * k };
  }
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const k = 0.15;
  return { r: r * k, g: g * k, b: b * k };
}

function copyPrimaryRgb(c) {
  return { r: c.r, g: c.g, b: c.b };
}

function pointerPrototype() {
  return {
    id: -1,
    texcoordX: 0,
    texcoordY: 0,
    prevTexcoordX: 0,
    prevTexcoordY: 0,
    deltaX: 0,
    deltaY: 0,
    down: false,
    moved: false,
    color: [30, 0, 300]
  };
}

function createState(container) {
  const state = container.visualizerState || {};
  state.initialized = state.initialized ?? false;
  state.config = state.config ?? { ...FIXED_CONFIG, ...DEFAULT_OPTIONS };
  state.pointers = state.pointers ?? [pointerPrototype()];
  state.splatStack = state.splatStack ?? [];
  state.lastUpdateTime = state.lastUpdateTime ?? performance.now();
  state.colorUpdateTimer = state.colorUpdateTimer ?? 0;
  state.lastRandomSplatPulse = state.lastRandomSplatPulse ?? -1;
  container.visualizerState = state;
  return state;
}

function getState(container) {
  return createState(container);
}

function setupCanvas(container) {
  const glCanvas = document.createElement("canvas");
  glCanvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
  container.appendChild(glCanvas);
  return glCanvas;
}

function getWebGLContext(canvas) {
  const params = {
    alpha: true,
    depth: false,
    stencil: false,
    antialias: false,
    preserveDrawingBuffer: false
  };

  let gl = canvas.getContext("webgl2", params);
  const isWebGL2 = !!gl;
  if (!isWebGL2) gl = canvas.getContext("webgl", params) || canvas.getContext("experimental-webgl", params);
  if (!gl) return null;

  let halfFloat;
  let supportLinearFiltering;
  if (isWebGL2) {
    gl.getExtension("EXT_color_buffer_float");
    supportLinearFiltering = gl.getExtension("OES_texture_float_linear");
  } else {
    halfFloat = gl.getExtension("OES_texture_half_float");
    supportLinearFiltering = gl.getExtension("OES_texture_half_float_linear");
  }

  gl.clearColor(0, 0, 0, 0);

  const halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : halfFloat?.HALF_FLOAT_OES;
  let formatRGBA;
  let formatRG;
  let formatR;

  if (isWebGL2) {
    formatRGBA = getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloatTexType);
    formatRG = getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloatTexType);
    formatR = getSupportedFormat(gl, gl.R16F, gl.RED, halfFloatTexType);
  } else {
    formatRGBA = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
    formatRG = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
    formatR = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
  }

  return {
    gl,
    ext: {
      formatRGBA,
      formatRG,
      formatR,
      halfFloatTexType,
      supportLinearFiltering: !!supportLinearFiltering
    }
  };
}

function getSupportedFormat(gl, internalFormat, format, type) {
  if (!supportRenderTextureFormat(gl, internalFormat, format, type)) {
    switch (internalFormat) {
      case gl.R16F:
        return getSupportedFormat(gl, gl.RG16F, gl.RG, type);
      case gl.RG16F:
        return getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
      default:
        return null;
    }
  }
  return { internalFormat, format };
}

function supportRenderTextureFormat(gl, internalFormat, format, type) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);

  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  return status === gl.FRAMEBUFFER_COMPLETE;
}

function compileShader(gl, type, source, keywords) {
  const finalSource = addKeywords(source, keywords);
  const shader = gl.createShader(type);
  gl.shaderSource(shader, finalSource);
  gl.compileShader(shader);
  return shader;
}

function addKeywords(source, keywords) {
  if (!keywords || keywords.length === 0) return source;
  let keywordsString = "";
  for (const keyword of keywords) keywordsString += `#define ${keyword}\n`;
  return keywordsString + source;
}

function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  return program;
}

function getUniforms(gl, program) {
  const uniforms = [];
  const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < uniformCount; i++) {
    const uniformName = gl.getActiveUniform(program, i).name;
    uniforms[uniformName] = gl.getUniformLocation(program, uniformName);
  }
  return uniforms;
}

class Program {
  constructor(gl, vertexShader, fragmentShader) {
    this.gl = gl;
    this.program = createProgram(gl, vertexShader, fragmentShader);
    this.uniforms = getUniforms(gl, this.program);
  }

  bind() {
    this.gl.useProgram(this.program);
  }
}

class Material {
  constructor(gl, vertexShader, fragmentShaderSource) {
    this.gl = gl;
    this.vertexShader = vertexShader;
    this.fragmentShaderSource = fragmentShaderSource;
    this.programs = [];
    this.activeProgram = null;
    this.uniforms = [];
  }

  setKeywords(keywords) {
    let hash = 0;
    for (const keyword of keywords) hash += hashCode(keyword);
    let program = this.programs[hash];
    if (!program) {
      const fragmentShader = compileShader(this.gl, this.gl.FRAGMENT_SHADER, this.fragmentShaderSource, keywords);
      program = createProgram(this.gl, this.vertexShader, fragmentShader);
      this.programs[hash] = program;
    }
    if (program === this.activeProgram) return;
    this.uniforms = getUniforms(this.gl, program);
    this.activeProgram = program;
  }

  bind() {
    this.gl.useProgram(this.activeProgram);
  }
}

function initGL(state) {
  state.glCanvas = setupCanvas(state.container);
  const context = getWebGLContext(state.glCanvas);
  if (!context) return false;
  state.gl = context.gl;
  state.ext = context.ext;
  if (!state.ext.formatRGBA || !state.ext.formatRG || !state.ext.formatR) return false;

  const gl = state.gl;
  const ext = state.ext;
  const config = state.config;

  if (!ext.supportLinearFiltering) config.SHADING = false;

  const baseVertexShader = compileShader(gl, gl.VERTEX_SHADER, `
    precision highp float;
    attribute vec2 aPosition;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform vec2 texelSize;
    void main () {
      vUv = aPosition * 0.5 + 0.5;
      vL = vUv - vec2(texelSize.x, 0.0);
      vR = vUv + vec2(texelSize.x, 0.0);
      vT = vUv + vec2(0.0, texelSize.y);
      vB = vUv - vec2(0.0, texelSize.y);
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `);

  const blurVertexShader = compileShader(gl, gl.VERTEX_SHADER, `
    precision highp float;
    attribute vec2 aPosition;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    uniform vec2 texelSize;
    void main () {
      vUv = aPosition * 0.5 + 0.5;
      float offset = 1.33333333;
      vL = vUv - texelSize * offset;
      vR = vUv + texelSize * offset;
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `);

  const blurShader = compileShader(gl, gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    uniform sampler2D uTexture;
    void main () {
      vec4 sum = texture2D(uTexture, vUv) * 0.29411764;
      sum += texture2D(uTexture, vL) * 0.35294117;
      sum += texture2D(uTexture, vR) * 0.35294117;
      gl_FragColor = sum;
    }
  `);

  const clearShader = compileShader(gl, gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    uniform sampler2D uTexture;
    uniform float value;
    void main () {
      gl_FragColor = value * texture2D(uTexture, vUv);
    }
  `);

  const colorShader = compileShader(gl, gl.FRAGMENT_SHADER, `
    precision mediump float;
    uniform vec4 color;
    void main () {
      gl_FragColor = color;
    }
  `);

  const displayShaderSource = `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D uTexture;
    uniform sampler2D uSunrays;
    uniform vec2 texelSize;
    void main () {
      vec3 c = texture2D(uTexture, vUv).rgb;
      #ifdef SHADING
        vec3 lc = texture2D(uTexture, vL).rgb;
        vec3 rc = texture2D(uTexture, vR).rgb;
        vec3 tc = texture2D(uTexture, vT).rgb;
        vec3 bc = texture2D(uTexture, vB).rgb;
        float dx = length(rc) - length(lc);
        float dy = length(tc) - length(bc);
        vec3 n = normalize(vec3(dx, dy, length(texelSize)));
        vec3 l = vec3(0.0, 0.0, 1.0);
        float diffuse = clamp(dot(n, l) + 0.7, 0.7, 1.0);
        c *= diffuse;
      #endif
      #ifdef SUNRAYS
        float sunrays = texture2D(uSunrays, vUv).r;
        c *= sunrays;
      #endif
      float a = max(c.r, max(c.g, c.b));
      gl_FragColor = vec4(c, a);
    }
  `;

  const sunraysMaskShader = compileShader(gl, gl.FRAGMENT_SHADER, `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    uniform sampler2D uTexture;
    void main () {
      vec4 c = texture2D(uTexture, vUv);
      float br = max(c.r, max(c.g, c.b));
      c.a = 1.0 - min(max(br * 20.0, 0.0), 0.8);
      gl_FragColor = c;
    }
  `);

  const sunraysShader = compileShader(gl, gl.FRAGMENT_SHADER, `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    uniform sampler2D uTexture;
    uniform float weight;
    #define ITERATIONS 16
    void main () {
      float Density = 0.3;
      float Decay = 0.95;
      float Exposure = 0.7;
      vec2 coord = vUv;
      vec2 dir = vUv - 0.5;
      dir *= 1.0 / float(ITERATIONS) * Density;
      float illuminationDecay = 1.0;
      float color = texture2D(uTexture, vUv).a;
      for (int i = 0; i < ITERATIONS; i++) {
        coord -= dir;
        float col = texture2D(uTexture, coord).a;
        color += col * illuminationDecay * weight;
        illuminationDecay *= Decay;
      }
      gl_FragColor = vec4(color * Exposure, 0.0, 0.0, 1.0);
    }
  `);

  const splatShader = compileShader(gl, gl.FRAGMENT_SHADER, `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    uniform sampler2D uTarget;
    uniform float aspectRatio;
    uniform vec3 color;
    uniform vec2 point;
    uniform float radius;
    void main () {
      vec2 p = vUv - point.xy;
      p.x *= aspectRatio;
      vec3 splat = exp(-dot(p, p) / radius) * color;
      vec3 base = texture2D(uTarget, vUv).xyz;
      gl_FragColor = vec4(base + splat, 1.0);
    }
  `);

  const advectionShader = compileShader(gl, gl.FRAGMENT_SHADER, `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    uniform sampler2D uVelocity;
    uniform sampler2D uSource;
    uniform vec2 texelSize;
    uniform vec2 dyeTexelSize;
    uniform float dt;
    uniform float dissipation;
    vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
      vec2 st = uv / tsize - 0.5;
      vec2 iuv = floor(st);
      vec2 fuv = fract(st);
      vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
      vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
      vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
      vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
      return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
    }
    void main () {
      #ifdef MANUAL_FILTERING
        vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
        vec4 result = bilerp(uSource, coord, dyeTexelSize);
      #else
        vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
        vec4 result = texture2D(uSource, coord);
      #endif
      float decay = 1.0 + dissipation * dt;
      gl_FragColor = result / decay;
    }
  `, ext.supportLinearFiltering ? null : ["MANUAL_FILTERING"]);

  const divergenceShader = compileShader(gl, gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uVelocity;
    void main () {
      float L = texture2D(uVelocity, vL).x;
      float R = texture2D(uVelocity, vR).x;
      float T = texture2D(uVelocity, vT).y;
      float B = texture2D(uVelocity, vB).y;
      vec2 C = texture2D(uVelocity, vUv).xy;
      if (vL.x < 0.0) L = -C.x;
      if (vR.x > 1.0) R = -C.x;
      if (vT.y > 1.0) T = -C.y;
      if (vB.y < 0.0) B = -C.y;
      float div = 0.5 * (R - L + T - B);
      gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
    }
  `);

  const curlShader = compileShader(gl, gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uVelocity;
    void main () {
      float L = texture2D(uVelocity, vL).y;
      float R = texture2D(uVelocity, vR).y;
      float T = texture2D(uVelocity, vT).x;
      float B = texture2D(uVelocity, vB).x;
      float vorticity = R - L - T + B;
      gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
    }
  `);

  const vorticityShader = compileShader(gl, gl.FRAGMENT_SHADER, `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D uVelocity;
    uniform sampler2D uCurl;
    uniform float curl;
    uniform float dt;
    void main () {
      float L = texture2D(uCurl, vL).x;
      float R = texture2D(uCurl, vR).x;
      float T = texture2D(uCurl, vT).x;
      float B = texture2D(uCurl, vB).x;
      float C = texture2D(uCurl, vUv).x;
      vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
      force /= length(force) + 0.0001;
      force *= curl * C;
      force.y *= -1.0;
      vec2 velocity = texture2D(uVelocity, vUv).xy;
      velocity += force * dt;
      velocity = min(max(velocity, -1000.0), 1000.0);
      gl_FragColor = vec4(velocity, 0.0, 1.0);
    }
  `);

  const pressureShader = compileShader(gl, gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uPressure;
    uniform sampler2D uDivergence;
    void main () {
      float L = texture2D(uPressure, vL).x;
      float R = texture2D(uPressure, vR).x;
      float T = texture2D(uPressure, vT).x;
      float B = texture2D(uPressure, vB).x;
      float divergence = texture2D(uDivergence, vUv).x;
      float pressure = (L + R + B + T - divergence) * 0.25;
      gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
    }
  `);

  const gradientSubtractShader = compileShader(gl, gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uPressure;
    uniform sampler2D uVelocity;
    void main () {
      float L = texture2D(uPressure, vL).x;
      float R = texture2D(uPressure, vR).x;
      float T = texture2D(uPressure, vT).x;
      float B = texture2D(uPressure, vB).x;
      vec2 velocity = texture2D(uVelocity, vUv).xy;
      velocity.xy -= vec2(R - L, T - B);
      gl_FragColor = vec4(velocity, 0.0, 1.0);
    }
  `);

  state.programs = {
    blurProgram: new Program(gl, blurVertexShader, blurShader),
    clearProgram: new Program(gl, baseVertexShader, clearShader),
    colorProgram: new Program(gl, baseVertexShader, colorShader),
    sunraysMaskProgram: new Program(gl, baseVertexShader, sunraysMaskShader),
    sunraysProgram: new Program(gl, baseVertexShader, sunraysShader),
    splatProgram: new Program(gl, baseVertexShader, splatShader),
    advectionProgram: new Program(gl, baseVertexShader, advectionShader),
    divergenceProgram: new Program(gl, baseVertexShader, divergenceShader),
    curlProgram: new Program(gl, baseVertexShader, curlShader),
    vorticityProgram: new Program(gl, baseVertexShader, vorticityShader),
    pressureProgram: new Program(gl, baseVertexShader, pressureShader),
    gradientSubtractProgram: new Program(gl, baseVertexShader, gradientSubtractShader),
    displayMaterial: new Material(gl, baseVertexShader, displayShaderSource)
  };

  setupBlit(state);
  updateKeywords(state);
  initFramebuffers(state);
  installInputHandlers(state);
  state.autoGoal = { x: 0, y: 0 };
  state.autoTarget = { x: 0, y: 0 };
  state.lastKickTime = performance.now() - NEON_IDLE_AFTER_MS - 1;
  state.autoPointer = pointerPrototype();
  state.autoPointer.color = state.config.colorful ? generateColor() : copyPrimaryRgb(state.config.primaryRgb);
  state.autoPointer.texcoordX = 0.5;
  state.autoPointer.texcoordY = 0.5;
  state.autoPointer.prevTexcoordX = 0.5;
  state.autoPointer.prevTexcoordY = 0.5;
  state.initialized = true;
  return true;
}

function setupBlit(state) {
  const gl = state.gl;
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  state.blit = (target, clear = false) => {
    if (!target) {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    } else {
      gl.viewport(0, 0, target.width, target.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    }
    if (clear) {
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  };
}

function createFBO(state, w, h, internalFormat, format, type, param) {
  const gl = state.gl;
  gl.activeTexture(gl.TEXTURE0);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.viewport(0, 0, w, h);
  gl.clear(gl.COLOR_BUFFER_BIT);

  return {
    texture,
    fbo,
    width: w,
    height: h,
    texelSizeX: 1 / w,
    texelSizeY: 1 / h,
    attach(id) {
      gl.activeTexture(gl.TEXTURE0 + id);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      return id;
    }
  };
}

function createDoubleFBO(state, w, h, internalFormat, format, type, param) {
  let fbo1 = createFBO(state, w, h, internalFormat, format, type, param);
  let fbo2 = createFBO(state, w, h, internalFormat, format, type, param);

  return {
    width: w,
    height: h,
    texelSizeX: fbo1.texelSizeX,
    texelSizeY: fbo1.texelSizeY,
    get read() {
      return fbo1;
    },
    set read(value) {
      fbo1 = value;
    },
    get write() {
      return fbo2;
    },
    set write(value) {
      fbo2 = value;
    },
    swap() {
      const temp = fbo1;
      fbo1 = fbo2;
      fbo2 = temp;
    }
  };
}

function resizeDoubleFBO(state, target, w, h, internalFormat, format, type, param) {
  if (target.width === w && target.height === h) return target;
  target.read = createFBO(state, w, h, internalFormat, format, type, param);
  target.write = createFBO(state, w, h, internalFormat, format, type, param);
  target.width = w;
  target.height = h;
  target.texelSizeX = 1 / w;
  target.texelSizeY = 1 / h;
  return target;
}

function initFramebuffers(state) {
  const gl = state.gl;
  const ext = state.ext;
  const config = state.config;
  const simRes = getResolution(gl, config.SIM_RESOLUTION);
  const dyeRes = getResolution(gl, config.DYE_RESOLUTION);

  const texType = ext.halfFloatTexType;
  const rgba = ext.formatRGBA;
  const rg = ext.formatRG;
  const r = ext.formatR;
  const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

  gl.disable(gl.BLEND);

  if (!state.dye) {
    state.dye = createDoubleFBO(state, dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, filtering);
  } else {
    state.dye = resizeDoubleFBO(state, state.dye, dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, filtering);
  }

  if (!state.velocity) {
    state.velocity = createDoubleFBO(state, simRes.width, simRes.height, rg.internalFormat, rg.format, texType, filtering);
  } else {
    state.velocity = resizeDoubleFBO(
      state,
      state.velocity,
      simRes.width,
      simRes.height,
      rg.internalFormat,
      rg.format,
      texType,
      filtering
    );
  }

  state.divergence = createFBO(state, simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
  state.curl = createFBO(state, simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
  state.pressure = createDoubleFBO(state, simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);

  initSunraysFramebuffers(state);
}

function initSunraysFramebuffers(state) {
  const gl = state.gl;
  const ext = state.ext;
  const config = state.config;
  const res = getResolution(gl, config.SUNRAYS_RESOLUTION);
  const texType = ext.halfFloatTexType;
  const r = ext.formatR;
  const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;
  state.sunrays = createFBO(state, res.width, res.height, r.internalFormat, r.format, texType, filtering);
  state.sunraysTemp = createFBO(state, res.width, res.height, r.internalFormat, r.format, texType, filtering);
}

function updateKeywords(state) {
  const displayKeywords = [];
  if (state.config.SHADING) displayKeywords.push("SHADING");
  if (state.config.SUNRAYS) displayKeywords.push("SUNRAYS");
  state.programs.displayMaterial.setKeywords(displayKeywords);
}

function calcDeltaTime(state) {
  const now = performance.now();
  let dt = (now - state.lastUpdateTime) / 1000;
  dt = Math.min(dt, 0.016666);
  state.lastUpdateTime = now;
  return dt;
}

function resizeCanvas(state) {
  const canvas = state.glCanvas;
  const rect = state.container.getBoundingClientRect();
  const width = scaleByPixelRatio(rect.width || 1);
  const height = scaleByPixelRatio(rect.height || 1);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    return true;
  }
  return false;
}

function syncMainPointerColors(state) {
  const c = state.config.primaryRgb;
  if (!c) return;
  for (const p of state.pointers) p.color = copyPrimaryRgb(c);
  if (state.autoPointer) state.autoPointer.color = copyPrimaryRgb(c);
}

function updateColors(state, dt) {
  state.colorUpdateTimer += dt * state.config.COLOR_UPDATE_SPEED;
  if (state.colorUpdateTimer >= 1) {
    state.colorUpdateTimer = wrap(state.colorUpdateTimer, 0, 1);
    state.pointers.forEach((pointer) => {
      pointer.color = generateColor();
    });
    if (state.autoPointer) state.autoPointer.color = generateColor();
  }
}

function wrap(value, min, max) {
  const range = max - min;
  if (range === 0) return min;
  return ((value - min) % range) + min;
}

function updateNeonStyleAuto(state, audio, options = {}) {
  if (!state.glCanvas || !state.autoPointer) return;
  const cooldownMs = options.cooldown ?? 400;
  const moveSpeed = options.speed ?? 0.08;
  const now = performance.now();
  const timeSinceKick = now - (state.lastKickTime ?? 0);
  const r = 0.25;
  const idleSpeed = 0.0008;
  const phase = 0;

  if (audio.kick && timeSinceKick >= cooldownMs) {
    state.lastKickTime = now;
    const zone = Math.floor(Math.random() * 9);
    const pt = randomInZone(zone);
    state.autoGoal.x = pt.x;
    state.autoGoal.y = pt.y;
    if (options.reactiveSplat) {
      state.splatStack.push(Math.floor(Math.random() * 20) + 5);
    }
  } else if (timeSinceKick >= NEON_IDLE_AFTER_MS) {
    state.autoGoal.x = r * Math.cos(now * idleSpeed + phase);
    state.autoGoal.y = r * Math.sin(now * idleSpeed + phase);
  }

  state.autoTarget.x += (state.autoGoal.x - state.autoTarget.x) * moveSpeed;
  state.autoTarget.y += (state.autoGoal.y - state.autoTarget.y) * moveSpeed;

  const tx = state.autoTarget.x + 0.5;
  const ty = 0.5 - state.autoTarget.y;
  const ap = state.autoPointer;
  ap.prevTexcoordX = ap.texcoordX;
  ap.prevTexcoordY = ap.texcoordY;
  ap.texcoordX = tx;
  ap.texcoordY = ty;
  ap.deltaX = correctDeltaX(state.glCanvas, ap.texcoordX - ap.prevTexcoordX);
  ap.deltaY = correctDeltaY(state.glCanvas, ap.texcoordY - ap.prevTexcoordY);
  ap.moved = Math.abs(ap.deltaX) > 0 || Math.abs(ap.deltaY) > 0;
}

function applyInputs(state) {
  if (state.splatStack.length > 0) multipleSplats(state, state.splatStack.pop());
  for (const pointer of state.pointers) {
    if (pointer.moved) {
      pointer.moved = false;
      splatPointer(state, pointer);
    }
  }
  if (state.autoPointer?.moved) {
    state.autoPointer.moved = false;
    splatPointer(state, state.autoPointer);
  }
}

function step(state, dt) {
  const { gl, config, programs, velocity, curl, divergence, pressure, dye } = state;
  gl.disable(gl.BLEND);

  programs.curlProgram.bind();
  gl.uniform2f(programs.curlProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
  gl.uniform1i(programs.curlProgram.uniforms.uVelocity, velocity.read.attach(0));
  state.blit(curl);

  programs.vorticityProgram.bind();
  gl.uniform2f(programs.vorticityProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
  gl.uniform1i(programs.vorticityProgram.uniforms.uVelocity, velocity.read.attach(0));
  gl.uniform1i(programs.vorticityProgram.uniforms.uCurl, curl.attach(1));
  gl.uniform1f(programs.vorticityProgram.uniforms.curl, config.vorticity);
  gl.uniform1f(programs.vorticityProgram.uniforms.dt, dt);
  state.blit(velocity.write);
  velocity.swap();

  programs.divergenceProgram.bind();
  gl.uniform2f(programs.divergenceProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
  gl.uniform1i(programs.divergenceProgram.uniforms.uVelocity, velocity.read.attach(0));
  state.blit(divergence);

  programs.clearProgram.bind();
  gl.uniform1i(programs.clearProgram.uniforms.uTexture, pressure.read.attach(0));
  gl.uniform1f(programs.clearProgram.uniforms.value, config.PRESSURE);
  state.blit(pressure.write);
  pressure.swap();

  programs.pressureProgram.bind();
  gl.uniform2f(programs.pressureProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
  gl.uniform1i(programs.pressureProgram.uniforms.uDivergence, divergence.attach(0));
  for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
    gl.uniform1i(programs.pressureProgram.uniforms.uPressure, pressure.read.attach(1));
    state.blit(pressure.write);
    pressure.swap();
  }

  programs.gradientSubtractProgram.bind();
  gl.uniform2f(programs.gradientSubtractProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
  gl.uniform1i(programs.gradientSubtractProgram.uniforms.uPressure, pressure.read.attach(0));
  gl.uniform1i(programs.gradientSubtractProgram.uniforms.uVelocity, velocity.read.attach(1));
  state.blit(velocity.write);
  velocity.swap();

  programs.advectionProgram.bind();
  gl.uniform2f(programs.advectionProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
  if (!state.ext.supportLinearFiltering) {
    gl.uniform2f(programs.advectionProgram.uniforms.dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
  }
  const velocityId = velocity.read.attach(0);
  gl.uniform1i(programs.advectionProgram.uniforms.uVelocity, velocityId);
  gl.uniform1i(programs.advectionProgram.uniforms.uSource, velocityId);
  gl.uniform1f(programs.advectionProgram.uniforms.dt, dt);
  gl.uniform1f(programs.advectionProgram.uniforms.dissipation, config.velocityDiffusion);
  state.blit(velocity.write);
  velocity.swap();

  if (!state.ext.supportLinearFiltering) {
    gl.uniform2f(programs.advectionProgram.uniforms.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);
  }
  gl.uniform1i(programs.advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
  gl.uniform1i(programs.advectionProgram.uniforms.uSource, dye.read.attach(1));
  gl.uniform1f(programs.advectionProgram.uniforms.dissipation, config.DENSITY_DISSIPATION);
  state.blit(dye.write);
  dye.swap();
}

function applySunrays(state, source, mask, destination) {
  const { gl, programs, config } = state;
  gl.disable(gl.BLEND);
  programs.sunraysMaskProgram.bind();
  gl.uniform1i(programs.sunraysMaskProgram.uniforms.uTexture, source.attach(0));
  state.blit(mask);

  programs.sunraysProgram.bind();
  gl.uniform1f(programs.sunraysProgram.uniforms.weight, config.SUNRAYS_WEIGHT);
  gl.uniform1i(programs.sunraysProgram.uniforms.uTexture, mask.attach(0));
  state.blit(destination);
}

function blur(state, target, temp, iterations) {
  const { gl, programs } = state;
  programs.blurProgram.bind();
  for (let i = 0; i < iterations; i++) {
    gl.uniform2f(programs.blurProgram.uniforms.texelSize, target.texelSizeX, 0);
    gl.uniform1i(programs.blurProgram.uniforms.uTexture, target.attach(0));
    state.blit(temp);

    gl.uniform2f(programs.blurProgram.uniforms.texelSize, 0, target.texelSizeY);
    gl.uniform1i(programs.blurProgram.uniforms.uTexture, temp.attach(0));
    state.blit(target);
  }
}

function drawColor(state, target, color) {
  const { gl, programs } = state;
  programs.colorProgram.bind();
  gl.uniform4f(programs.colorProgram.uniforms.color, color.r, color.g, color.b, 1);
  state.blit(target);
}

function drawDisplay(state, target) {
  const { gl, programs, config, dye, sunrays } = state;
  const width = target == null ? gl.drawingBufferWidth : target.width;
  const height = target == null ? gl.drawingBufferHeight : target.height;
  programs.displayMaterial.bind();
  if (config.SHADING) gl.uniform2f(programs.displayMaterial.uniforms.texelSize, 1 / width, 1 / height);
  gl.uniform1i(programs.displayMaterial.uniforms.uTexture, dye.read.attach(0));
  if (config.SUNRAYS) gl.uniform1i(programs.displayMaterial.uniforms.uSunrays, sunrays.attach(1));
  state.blit(target);
}

function renderScene(state) {
  const { gl, config, dye, sunrays, sunraysTemp } = state;
  if (config.SUNRAYS) {
    applySunrays(state, dye.read, dye.write, sunrays);
    blur(state, sunrays, sunraysTemp, 1);
  }
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.enable(gl.BLEND);
  drawColor(state, null, { r: 0, g: 0, b: 0 });
  drawDisplay(state, null);
}

function splatPointer(state, pointer) {
  const dx = pointer.deltaX * state.config.SPLAT_FORCE;
  const dy = pointer.deltaY * state.config.SPLAT_FORCE;
  splat(state, pointer.texcoordX, pointer.texcoordY, dx, dy, pointer.color);
}

function multipleSplats(state, amount) {
  let burstColor = null;
  if (!state.config.colorful) {
    burstColor = generateColor();
    burstColor.r *= 10;
    burstColor.g *= 10;
    burstColor.b *= 10;
  }
  for (let i = 0; i < amount; i++) {
    let color;
    if (state.config.colorful) {
      color = generateColor();
      color.r *= 10;
      color.g *= 10;
      color.b *= 10;
    } else {
      color = burstColor;
    }
    splat(
      state,
      Math.random(),
      Math.random(),
      1000 * (Math.random() - 0.5),
      1000 * (Math.random() - 0.5),
      color
    );
  }
}

function splat(state, x, y, dx, dy, color) {
  const { gl, programs, velocity, dye, glCanvas } = state;
  programs.splatProgram.bind();
  gl.uniform1i(programs.splatProgram.uniforms.uTarget, velocity.read.attach(0));
  gl.uniform1f(programs.splatProgram.uniforms.aspectRatio, glCanvas.width / glCanvas.height);
  gl.uniform2f(programs.splatProgram.uniforms.point, x, y);
  gl.uniform3f(programs.splatProgram.uniforms.color, dx, dy, 0);
  gl.uniform1f(programs.splatProgram.uniforms.radius, correctRadius(glCanvas, state.config.SPLAT_RADIUS / 100));
  state.blit(velocity.write);
  velocity.swap();

  gl.uniform1i(programs.splatProgram.uniforms.uTarget, dye.read.attach(0));
  gl.uniform3f(programs.splatProgram.uniforms.color, color.r, color.g, color.b);
  state.blit(dye.write);
  dye.swap();
}

function installInputHandlers(state) {
  const inputSurface = document.querySelector(".main-canvas-wrapper canvas") || window;
  const getPosFromMouse = (e) => {
    if (!("clientX" in e) || !("clientY" in e)) return null;
    const rect =
      inputSurface instanceof HTMLCanvasElement
        ? inputSurface.getBoundingClientRect()
        : state.container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
    return { x: scaleByPixelRatio(x), y: scaleByPixelRatio(y) };
  };

  const getPosFromTouch = (touch) => {
    const rect =
      inputSurface instanceof HTMLCanvasElement
        ? inputSurface.getBoundingClientRect()
        : state.container.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
    return { x: scaleByPixelRatio(x), y: scaleByPixelRatio(y) };
  };

  const onMouseDown = (e) => {
    const pos = getPosFromMouse(e);
    if (!pos) return;
    let pointer = state.pointers.find((p) => p.id === -1);
    if (!pointer) pointer = pointerPrototype();
    updatePointerDownData(state, pointer, -1, pos.x, pos.y);
  };

  const onMouseMove = (e) => {
    const pointer = state.pointers[0];
    if (!pointer.down) return;
    const pos = getPosFromMouse(e);
    if (!pos) return;
    updatePointerMoveData(state, pointer, pos.x, pos.y);
  };

  const onMouseUp = () => {
    updatePointerUpData(state.pointers[0]);
  };

  const onTouchStart = (e) => {
    e.preventDefault();
    const touches = e.targetTouches;
    while (touches.length >= state.pointers.length) state.pointers.push(pointerPrototype());
    for (let i = 0; i < touches.length; i++) {
      const pos = getPosFromTouch(touches[i]);
      if (!pos) continue;
      updatePointerDownData(state, state.pointers[i + 1], touches[i].identifier, pos.x, pos.y);
    }
  };

  const onTouchMove = (e) => {
    e.preventDefault();
    const touches = e.targetTouches;
    for (let i = 0; i < touches.length; i++) {
      const pointer = state.pointers[i + 1];
      if (!pointer.down) continue;
      const pos = getPosFromTouch(touches[i]);
      if (!pos) continue;
      updatePointerMoveData(state, pointer, pos.x, pos.y);
    }
  };

  const onTouchEnd = (e) => {
    const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
      const pointer = state.pointers.find((p) => p.id === touches[i].identifier);
      if (!pointer) continue;
      updatePointerUpData(pointer);
    }
  };

  inputSurface.addEventListener("mousedown", onMouseDown);
  inputSurface.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  inputSurface.addEventListener("touchstart", onTouchStart, { passive: false });
  inputSurface.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd);

  state.removeInputHandlers = () => {
    inputSurface.removeEventListener("mousedown", onMouseDown);
    inputSurface.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    inputSurface.removeEventListener("touchstart", onTouchStart);
    inputSurface.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
  };
}

function updatePointerDownData(state, pointer, id, posX, posY) {
  pointer.id = id;
  pointer.down = true;
  pointer.moved = false;
  pointer.texcoordX = posX / state.glCanvas.width;
  pointer.texcoordY = 1 - posY / state.glCanvas.height;
  pointer.prevTexcoordX = pointer.texcoordX;
  pointer.prevTexcoordY = pointer.texcoordY;
  pointer.deltaX = 0;
  pointer.deltaY = 0;
  pointer.color = state.config.colorful ? generateColor() : copyPrimaryRgb(state.config.primaryRgb);
}

function updatePointerMoveData(state, pointer, posX, posY) {
  pointer.prevTexcoordX = pointer.texcoordX;
  pointer.prevTexcoordY = pointer.texcoordY;
  pointer.texcoordX = posX / state.glCanvas.width;
  pointer.texcoordY = 1 - posY / state.glCanvas.height;
  pointer.deltaX = correctDeltaX(state.glCanvas, pointer.texcoordX - pointer.prevTexcoordX);
  pointer.deltaY = correctDeltaY(state.glCanvas, pointer.texcoordY - pointer.prevTexcoordY);
  pointer.moved = Math.abs(pointer.deltaX) > 0 || Math.abs(pointer.deltaY) > 0;
}

function updatePointerUpData(pointer) {
  pointer.down = false;
}

function correctDeltaX(canvas, delta) {
  const aspectRatio = canvas.width / canvas.height;
  if (aspectRatio < 1) delta *= aspectRatio;
  return delta;
}

function correctDeltaY(canvas, delta) {
  const aspectRatio = canvas.width / canvas.height;
  if (aspectRatio > 1) delta /= aspectRatio;
  return delta;
}

function correctRadius(canvas, radius) {
  const aspectRatio = canvas.width / canvas.height;
  if (aspectRatio > 1) radius *= aspectRatio;
  return radius;
}

function generateColor() {
  const c = HSVtoRGB(Math.random(), 1, 1);
  c.r *= 0.15;
  c.g *= 0.15;
  c.b *= 0.15;
  return c;
}

function HSVtoRGB(h, s, v) {
  let r;
  let g;
  let b;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    default:
      r = v;
      g = p;
      b = q;
      break;
  }
  return { r, g, b };
}

function getResolution(gl, resolution) {
  let aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
  if (aspectRatio < 1) aspectRatio = 1 / aspectRatio;
  const min = Math.round(resolution);
  const max = Math.round(resolution * aspectRatio);
  if (gl.drawingBufferWidth > gl.drawingBufferHeight) {
    return { width: max, height: min };
  }
  return { width: min, height: max };
}

function scaleByPixelRatio(input) {
  const pixelRatio = window.devicePixelRatio || 1;
  return Math.floor(input * pixelRatio);
}

function hashCode(s) {
  if (s.length === 0) return 0;
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function applyConfigFromOptions(state, options = {}) {
  state.config.velocityDiffusion = options.velocityDiffusion ?? DEFAULT_OPTIONS.velocityDiffusion;
  state.config.vorticity = options.vorticity ?? DEFAULT_OPTIONS.vorticity;
  state.config.colorful = options.colorful ?? DEFAULT_OPTIONS.colorful;
  state.config.primaryRgb = hexToPrimarySplatColor(options.primaryColor ?? DEFAULT_OPTIONS.primaryColor);
  const pulse = Number(options.randomSplatPulse ?? -1);
  if (!Number.isNaN(pulse) && pulse !== state.lastRandomSplatPulse) {
    if (state.lastRandomSplatPulse === -1) {
      state.lastRandomSplatPulse = pulse;
    } else {
      state.lastRandomSplatPulse = pulse;
      state.splatStack.push(Math.floor(Math.random() * 20) + 5);
    }
  }
}

export function render(canvas, ctx, audio, container, options = {}) {
  const state = getState(container);
  state.container = container;
  applyConfigFromOptions(state, options);

  if (!state.initialized) {
    const ok = initGL(state);
    if (!ok) return;
  }

  if (resizeCanvas(state)) initFramebuffers(state);
  const dt = calcDeltaTime(state);
  if (state.config.colorful) updateColors(state, dt);
  else syncMainPointerColors(state);
  updateNeonStyleAuto(state, audio, options);
  applyInputs(state);
  step(state, dt);
  renderScene(state);
}

export function cleanup(canvas, container) {
  const state = container.visualizerState;
  if (!state) return;
  state.removeInputHandlers?.();
  if (state.glCanvas?.parentElement === container) container.removeChild(state.glCanvas);
  Object.keys(state).forEach((key) => delete state[key]);
}
