'use strict';

// ShaderToy – loads shader from assets/shadertoy/
// Edit files and use Reload or change shader to refresh.

const SHADER_BASE = new URL('../../assets/shadertoy/', import.meta.url).href;
const MANIFEST_URL = new URL('../../assets/shadertoy/manifest.json', import.meta.url).href;

const QUALITY = { low: 320, med: 640, hi: 1024 };

const shaderCache = {};
let manifestCache = null;

async function loadManifest() {
  if (manifestCache) return manifestCache;
  const res = await fetch(MANIFEST_URL + '?t=' + Date.now());
  manifestCache = res.ok ? await res.json() : [];
  return manifestCache;
}

function getDefaultShader() {
  return manifestCache?.length ? manifestCache[0] : null;
}

const VERTEX = `#version 300 es
in vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

function buildFragmentShader(userCode) {
  const hasChannel0 = /iChannel0\b/.test(userCode);
  const hasChannel1 = /iChannel1\b/.test(userCode);
  const hasChannel2 = /iChannel2\b/.test(userCode);
  const hasChannel3 = /iChannel3\b/.test(userCode);

  let preamble = `#version 300 es
precision highp float;

uniform vec3 iResolution;
uniform float iTime;
uniform vec4 iMouse;
`;
  if (hasChannel0) preamble += 'uniform sampler2D iChannel0;\n';
  if (hasChannel1) preamble += 'uniform sampler2D iChannel1;\n';
  if (hasChannel2) preamble += 'uniform sampler2D iChannel2;\n';
  if (hasChannel3) preamble += 'uniform sampler2D iChannel3;\n';

  const cleanCode = userCode
    .replace(/^#version[^\n]*\n?/gi, '')
    .replace(/^precision[^\n]*\n?/gi, '')
    .replace(/texture\s*\(\s*(iChannel\d)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)/g, 'textureLod($1, $2, $3)');

  return preamble + cleanCode + `

out vec4 fragColor;
void main() {
  mainImage(fragColor, gl_FragCoord.xy);
}
`;
}

function createNoiseTexture(gl) {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.floor(Math.random() * 256);
    data[i] = data[i + 1] = data[i + 2] = v;
    data[i + 3] = 255;
  }
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  return tex;
}

function createShader(gl, code, type) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, code);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('ShaderToy shader:', gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

async function loadShaderCode(shaderFile) {
  if (shaderCache[shaderFile]) return shaderCache[shaderFile];
  const url = new URL(shaderFile, SHADER_BASE).href;
  const res = await fetch(url + '?t=' + Date.now());
  if (!res.ok) throw new Error('Failed to load shader: ' + res.status);
  const code = await res.text();
  shaderCache[shaderFile] = code;
  return code;
}

function getCachedShader(shaderFile) {
  return shaderCache[shaderFile] || null;
}

loadManifest().then((list) => {
  if (list.length) loadShaderCode(list[0]).catch(() => {});
});

function init(container, state, w, h, userCode, renderW, renderH) {
  const glCanvas = document.createElement('canvas');
  glCanvas.width = renderW;
  glCanvas.height = renderH;
  const gl = glCanvas.getContext('webgl2');
  if (!gl) return null;

  const fragmentCode = buildFragmentShader(userCode);
  const vs = createShader(gl, VERTEX, gl.VERTEX_SHADER);
  const fs = createShader(gl, fragmentCode, gl.FRAGMENT_SHADER);
  if (!vs || !fs) return null;

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('ShaderToy program:', gl.getProgramInfoLog(program));
    return null;
  }

  const vertexData = new Float32Array([-1, 1, -1, -1, 1, 1, 1, -1]);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);

  const displayCanvas = document.createElement('canvas');
  displayCanvas.width = w;
  displayCanvas.height = h;

  const hasChannel0 = /iChannel0\b/.test(userCode);
  const noiseTex = hasChannel0 ? createNoiseTexture(gl) : null;

  state.gl = gl;
  state.glCanvas = glCanvas;
  state.canvas = displayCanvas;
  state.program = program;
  state.buf = buf;
  state.noiseTex = noiseTex;
  state.locPosition = gl.getAttribLocation(program, 'a_position');
  state.locResolution = gl.getUniformLocation(program, 'iResolution');
  state.locTime = gl.getUniformLocation(program, 'iTime');
  state.locMouse = gl.getUniformLocation(program, 'iMouse');
  state.locChannel0 = hasChannel0 ? gl.getUniformLocation(program, 'iChannel0') : null;
  state.renderW = renderW;
  state.renderH = renderH;

  container.appendChild(displayCanvas);
  return state;
}

export function render(canvas, ctx, audio, container, options = {}) {
  const state = container.visualizerState;
  const w = canvas.width;
  const h = canvas.height;
  if (!w || !h) return;

  let shaderFile = options.shader || getDefaultShader();
  if (!shaderFile) {
    if (!state.manifestLoading) {
      state.manifestLoading = true;
      loadManifest().then(() => { state.manifestLoading = false; });
    }
    return;
  }
  const qualityKey = options.quality || 'med';
  const keepAspectRatio = options.keepAspectRatio !== false;
  const renderW = QUALITY[qualityKey] ?? 640;
  const renderH = Math.round(renderW * 3 / 4);

  const shaderChanged = state.currentShader && state.currentShader !== shaderFile;
  const qualityChanged = state.renderW && state.renderW !== renderW;

  if (shaderChanged) {
    delete shaderCache[shaderFile];
    state.currentShader = shaderFile;
    if (state.canvas?.parentElement) container.removeChild(state.canvas);
    if (state.program && state.gl) state.gl.deleteProgram(state.program);
    Object.keys(state).forEach((k) => { if (k !== 'currentShader') delete state[k]; });
  }

  if (!state.initialized) {
    const cached = getCachedShader(shaderFile);
    if (cached) {
      state.initialized = true;
      state.currentShader = shaderFile;
      init(container, state, w, h, cached, renderW, renderH);
    } else if (!state.loading) {
      state.loading = true;
      state.currentShader = shaderFile;
      loadShaderCode(shaderFile)
        .then((userCode) => {
          state.initialized = true;
          state.loading = false;
          init(container, state, w, h, userCode, renderW, renderH);
        })
        .catch((e) => {
          console.error('ShaderToy:', e);
          state.loading = false;
        });
    }
    return;
  }

  if (qualityChanged) {
    state.glCanvas.width = renderW;
    state.glCanvas.height = renderH;
    state.renderW = renderW;
    state.renderH = renderH;
  }

  const gl = state.gl;
  const glCanvas = state.glCanvas;
  const displayCanvas = state.canvas;
  if (!gl || !glCanvas || !displayCanvas) return;

  if (displayCanvas.width !== w || displayCanvas.height !== h) {
    displayCanvas.width = w;
    displayCanvas.height = h;
  }

  const speed = options.speed ?? 1;
  const t = (performance.now() / 1000) * speed;
  const rw = state.renderW;
  const rh = state.renderH;

  gl.viewport(0, 0, rw, rh);
  gl.useProgram(state.program);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.buf);
  gl.enableVertexAttribArray(state.locPosition);
  gl.vertexAttribPointer(state.locPosition, 2, gl.FLOAT, false, 0, 0);

  gl.uniform3f(state.locResolution, rw, rh, 1);
  gl.uniform1f(state.locTime, t);
  gl.uniform4f(state.locMouse, 0, 0, 0, 0);

  if (state.noiseTex && state.locChannel0 !== null) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.noiseTex);
    gl.uniform1i(state.locChannel0, 0);
  }

  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  const dctx = displayCanvas.getContext('2d');
  dctx.fillStyle = '#000';
  dctx.fillRect(0, 0, w, h);
  if (keepAspectRatio) {
    const scale = Math.min(w / rw, h / rh);
    const drawW = rw * scale;
    const drawH = rh * scale;
    const drawX = (w - drawW) / 2;
    const drawY = (h - drawH) / 2;
    dctx.drawImage(glCanvas, 0, 0, rw, rh, drawX, drawY, drawW, drawH);
  } else {
    dctx.drawImage(glCanvas, 0, 0, rw, rh, 0, 0, w, h);
  }
}

export function cleanup(canvas, container, slot) {
  const state = container.visualizerState;
  if (!state?.initialized) return;
  const displayCanvas = state.canvas;
  if (displayCanvas?.parentElement) container.removeChild(displayCanvas);
  if (!container.contains(canvas)) container.appendChild(canvas);
  Object.keys(state).forEach((k) => delete state[k]);
}
