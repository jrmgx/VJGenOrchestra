'use strict';

// Metaball inspired from https://niklasknaack.de/

const SCHEME_IDS = ['ocean', 'fire', 'forest', 'ice', 'sunset'];

const COLOR_SCHEMES = {
  ocean: [
    { r: 0, g: 130, b: 175 }, { r: 38, g: 146, b: 166 }, { r: 88, g: 179, b: 156 },
    { r: 155, g: 202, b: 59 }, { r: 234, g: 207, b: 0 }, { r: 236, g: 143, b: 2 },
    { r: 237, g: 85, b: 32 }, { r: 168, g: 29, b: 27 }, { r: 115, g: 44, b: 78 },
    { r: 96, g: 44, b: 72 }, { r: 73, g: 36, b: 69 }, { r: 56, g: 30, b: 59 },
    { r: 43, g: 25, b: 48 }, { r: 30, g: 24, b: 41 },
  ],
  fire: [
    { r: 30, g: 24, b: 41 }, { r: 56, g: 30, b: 59 }, { r: 96, g: 44, b: 72 },
    { r: 168, g: 29, b: 27 }, { r: 237, g: 85, b: 32 }, { r: 236, g: 143, b: 2 },
    { r: 234, g: 207, b: 0 }, { r: 255, g: 220, b: 100 }, { r: 255, g: 200, b: 150 },
    { r: 255, g: 180, b: 120 }, { r: 255, g: 140, b: 80 }, { r: 255, g: 100, b: 50 },
    { r: 255, g: 60, b: 30 }, { r: 200, g: 30, b: 10 },
  ],
  forest: [
    { r: 15, g: 25, b: 20 }, { r: 25, g: 45, b: 30 }, { r: 40, g: 70, b: 45 },
    { r: 60, g: 100, b: 55 }, { r: 90, g: 140, b: 70 }, { r: 120, g: 170, b: 85 },
    { r: 155, g: 200, b: 100 }, { r: 180, g: 220, b: 120 }, { r: 200, g: 235, b: 140 },
    { r: 170, g: 200, b: 110 }, { r: 130, g: 160, b: 80 }, { r: 95, g: 120, b: 55 },
    { r: 65, g: 85, b: 40 }, { r: 40, g: 55, b: 28 },
  ],
  ice: [
    { r: 10, g: 15, b: 35 }, { r: 20, g: 35, b: 60 }, { r: 40, g: 70, b: 100 },
    { r: 70, g: 120, b: 150 }, { r: 110, g: 170, b: 200 }, { r: 150, g: 210, b: 235 },
    { r: 190, g: 235, b: 250 }, { r: 220, g: 245, b: 255 }, { r: 240, g: 250, b: 255 },
    { r: 200, g: 240, b: 255 }, { r: 160, g: 220, b: 250 }, { r: 120, g: 190, b: 230 },
    { r: 80, g: 150, b: 200 }, { r: 45, g: 100, b: 160 },
  ],
  sunset: [
    { r: 25, g: 15, b: 35 }, { r: 55, g: 25, b: 60 }, { r: 100, g: 40, b: 90 },
    { r: 160, g: 60, b: 120 }, { r: 220, g: 90, b: 140 }, { r: 255, g: 130, b: 150 },
    { r: 255, g: 170, b: 140 }, { r: 255, g: 200, b: 120 }, { r: 255, g: 230, b: 150 },
    { r: 255, g: 180, b: 100 }, { r: 255, g: 120, b: 80 }, { r: 240, g: 80, b: 90 },
    { r: 200, g: 50, b: 100 }, { r: 140, g: 35, b: 80 },
  ],
};

function getVertexShaderCode() {
  return `
    attribute vec2 a_position;
    void main(void) {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;
}

function getFragmentShaderCode(metaCount, colorCount) {
  return `
    precision highp float;
    uniform vec3 u_metaballs[${metaCount}];
    uniform vec3 u_metaballColors[${colorCount}];
    void main(void) {
      gl_FragColor = vec4(u_metaballColors[0], 1.0);
      float x = gl_FragCoord.x;
      float y = gl_FragCoord.y;
      float v = 0.0;
      for (int i = 0; i < ${metaCount}; i++) {
        vec3 metaball = u_metaballs[i];
        float dx = metaball.x - x;
        float dy = metaball.y - y;
        float radius = metaball.z;
        v += radius * radius / (dx * dx + dy * dy);
      }
      float t = 0.3;
      float tStep = 0.065;
      for (int i = 0; i < ${colorCount}; i++) {
        vec3 color = u_metaballColors[i];
        if (i < ${colorCount} - 1) {
          if (v > t && v < t + tStep) gl_FragColor = vec4(color, 1.0);
        } else {
          if (v > t) gl_FragColor = vec4(color, 1.0);
        }
        t += tStep;
      }
    }
  `;
}

function createShader(gl, code, type) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, code);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('Metaball shader compile:', gl.getShaderInfoLog(shader));
  }
  return shader;
}

function createShaderProgram(gl, vs, fs) {
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('Metaball program link:', gl.getProgramInfoLog(program));
  }
  return program;
}

function getColors(scheme, reverse) {
  const pal = COLOR_SCHEMES[scheme] || COLOR_SCHEMES.ocean;
  const arr = reverse ? [...pal].reverse() : pal;
  return arr.map((c) => ({ r: c.r / 255, g: c.g / 255, b: c.b / 255 }));
}

function initMetaballs(state, w, h, count) {
  const metaballs = [];
  const border = { x: 0, y: 0, w, h };
  const radiusValue = w > h ? Math.floor(h / 10) : Math.floor(w / 14);
  const maxRadius = radiusValue;

  for (let i = 0; i < count; i++) {
    const radius = Math.round(Math.random() * (maxRadius - maxRadius / 2)) + maxRadius / 2;
    const metaball = {
      x: Math.floor(Math.random() * (border.w - radius * 2)) + radius,
      y: Math.floor(Math.random() * (border.h - radius * 2)) + radius,
      vx: Math.random() - 0.5,
      vy: Math.random() - 0.5,
      baseRadius: radius,
      radius,
    };
    if (i === 0) metaball.baseRadius = Math.round(maxRadius + maxRadius / 2);
    metaballs.push(metaball);
  }

  state.metaballs = metaballs;
  state.border = border;
}

function moveMetaballs(state, w, h, speed) {
  const border = state.border;
  border.w = w;
  border.h = h;

  for (const m of state.metaballs) {
    m.x += m.vx * speed;
    m.y += m.vy * speed;

    if (m.x > border.w - m.baseRadius) {
      m.x = border.w - m.baseRadius;
      m.vx *= -1;
    } else if (m.x < border.x + m.baseRadius) {
      m.x = border.x + m.baseRadius;
      m.vx *= -1;
    }
    if (m.y > border.h - m.baseRadius) {
      m.y = border.h - m.baseRadius;
      m.vy *= -1;
    } else if (m.y < border.y + m.baseRadius) {
      m.y = border.y + m.baseRadius;
      m.vy *= -1;
    }
  }
}

export function render(canvas, ctx, audio, container, options = {}) {
  const state = container.visualizerState;
  const w = canvas.width;
  const h = canvas.height;
  if (!w || !h) return;

  const count = Math.min(options.count ?? 8, 15);
  let speed = (options.speed ?? 1) * 9;
  const audioReactivity = (options.audioReactivity ?? 0.3) * 3;
  const reactiveSpeed = options.reactiveSpeed !== false;
  const colorReactive = options.colorReactive ?? false;
  let scheme = options.colorScheme ?? 'ocean';
  let reverse = options.colorReverse ?? false;

  if (colorReactive) {
    const kick = audio.kick ?? 0;
    const now = performance.now();
    if (kick > 0.5 && now - (state.colorReactiveLastChange ?? 0) > 400) {
      state.colorReactiveLastChange = now;
      scheme = SCHEME_IDS[Math.floor(Math.random() * SCHEME_IDS.length)];
      reverse = Math.random() > 0.5;
    } else {
      scheme = state.colorReactiveScheme ?? scheme;
      reverse = state.colorReactiveReverse ?? reverse;
    }
    state.colorReactiveScheme = scheme;
    state.colorReactiveReverse = reverse;
  }

  const colorsConverted = getColors(scheme, reverse);

  if (!state.initialized || state.count !== count) {
    if (state.canvas?.parentElement) container.removeChild(state.canvas);
    state.initialized = true;
    state.count = count;
    initMetaballs(state, w, h, count);

    const glCanvas = document.createElement('canvas');
    glCanvas.width = w;
    glCanvas.height = h;
    const gl = glCanvas.getContext('webgl') || glCanvas.getContext('experimental-webgl');
    if (!gl) return;

    const vs = createShader(gl, getVertexShaderCode(), gl.VERTEX_SHADER);
    const fs = createShader(gl, getFragmentShaderCode(count, colorsConverted.length), gl.FRAGMENT_SHADER);
    const program = createShaderProgram(gl, vs, fs);

    const vertexData = new Float32Array([-1, 1, -1, -1, 1, 1, 1, -1]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const fc = colorsConverted[0];
    gl.clearColor(fc.r, fc.g, fc.b, 1);

    state.gl = gl;
    state.canvas = glCanvas;
    state.program = program;
    state.buf = buf;
    state.locPosition = gl.getAttribLocation(program, 'a_position');
    state.locMetaballs = gl.getUniformLocation(program, 'u_metaballs');
    state.locColors = gl.getUniformLocation(program, 'u_metaballColors');

    container.appendChild(glCanvas);
  }

  if (!state.gl || !state.canvas) return;

  const gl = state.gl;
  const glCanvas = state.canvas;

  if (glCanvas.width !== w || glCanvas.height !== h) {
    glCanvas.width = w;
    glCanvas.height = h;
    gl.viewport(0, 0, w, h);
    initMetaballs(state, w, h, count);
  }

  const bass = audio.bass ?? 0;
  const kick = audio.kick ?? 0;
  const mid = audio.mid ?? 0;
  const high = audio.high ?? 0;

  if (reactiveSpeed) speed *= 1 + 0.5 * (bass + kick);

  const audioBoost = 1 + audioReactivity * (bass * 0.15 + kick * 0.2 + (mid + high) * 0.05);
  const LERP = 0.07;

  for (let i = 0; i < state.metaballs.length; i++) {
    const m = state.metaballs[i];
    const bandFactor = i === 0 ? 1 + kick * 0.08 : 1 + (bass + mid) * 0.06;
    const targetRadius = m.baseRadius * bandFactor * audioBoost;
    m.radius += (targetRadius - m.radius) * LERP;
  }

  moveMetaballs(state, w, h, speed);

  const metaballsData = new Float32Array(3 * count);
  const colorsData = new Float32Array(3 * colorsConverted.length);

  for (let i = 0; i < count; i++) {
    const m = state.metaballs[i];
    metaballsData[i * 3] = m.x;
    metaballsData[i * 3 + 1] = m.y;
    metaballsData[i * 3 + 2] = m.radius;
  }
  const fc = colorsConverted[0];
  gl.clearColor(fc.r, fc.g, fc.b, 1);

  for (let i = 0; i < colorsConverted.length; i++) {
    const c = colorsConverted[i];
    colorsData[i * 3] = c.r;
    colorsData[i * 3 + 1] = c.g;
    colorsData[i * 3 + 2] = c.b;
  }

  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(state.program);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.buf);
  gl.enableVertexAttribArray(state.locPosition);
  gl.vertexAttribPointer(state.locPosition, 2, gl.FLOAT, false, 0, 0);
  gl.uniform3fv(state.locMetaballs, metaballsData);
  gl.uniform3fv(state.locColors, colorsData);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

export function cleanup(canvas, container, slot) {
  const state = container.visualizerState;
  if (!state?.initialized) return;
  if (state.canvas?.parentElement) container.removeChild(state.canvas);
  if (!container.contains(canvas)) container.appendChild(canvas);
  Object.keys(state).forEach((k) => delete state[k]);
}
