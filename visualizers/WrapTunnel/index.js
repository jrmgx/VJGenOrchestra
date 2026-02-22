'use strict';

// --- Constants ---
const FOV = 250;
const RADIUS = 75;
const SEGMENTS = 64;
const Z_STEP = 5;
const STROKE_WIDTH = 3;
const AUDIO_REACTIVE_MULT = 4.4;
const CORNER_DURATION = 8;
const CORNER_MARGIN = 0.15;
const MP_LERP = 0.008;
const BRIGHTNESS = 1.4;

// --- Shape geometry ---
function getCirclePoint(cx, cy, radius, index, segments, time) {
  const angle = index * ((Math.PI * 2) / segments) + time;
  return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
}

function getSquarePoint(cx, cy, radius, index, segments, time) {
  const ptsPerSide = segments / 4;
  const side = Math.floor((index % segments) / ptsPerSide) % 4;
  const t = ((index % segments) % ptsPerSide) / ptsPerSide;
  let x, y;
  if (side === 0) { x = radius - t * radius * 2; y = radius; }
  else if (side === 1) { x = -radius; y = radius - t * radius * 2; }
  else if (side === 2) { x = -radius + t * radius * 2; y = -radius; }
  else { x = radius; y = -radius + t * radius * 2; }
  const cos = Math.cos(time), sin = Math.sin(time);
  return { x: cx + x * cos - y * sin, y: cy + x * sin + y * cos };
}

function getShapePoint(shape, cx, cy, radius, index, segments, time) {
  return shape === 'square' ? getSquarePoint(cx, cy, radius, index, segments, time) : getCirclePoint(cx, cy, radius, index, segments, time);
}

// --- Drawing (Canvas 2D API - GPU accelerated) ---
function drawQuad(ctx, pp1, pp2, pp3, pp4, shape, circleObj, cr, cg, cb) {
  const cp1x = (pp1.x2d + pp2.x2d) / 2, cp1y = (pp1.y2d + pp2.y2d) / 2;
  const cp2x = (pp2.x2d + pp3.x2d) / 2, cp2y = (pp2.y2d + pp3.y2d) / 2;
  const cp3x = (pp3.x2d + pp4.x2d) / 2, cp3y = (pp3.y2d + pp4.y2d) / 2;
  const cp4x = (pp4.x2d + pp1.x2d) / 2, cp4y = (pp4.y2d + pp1.y2d) / 2;

  ctx.strokeStyle = `rgb(${cr},${cg},${cb})`;
  ctx.beginPath();
  if (shape === 'square') {
    ctx.moveTo(pp4.x2d, pp4.y2d);
    ctx.lineTo(pp1.x2d, pp1.y2d);
    ctx.lineTo(pp2.x2d, pp2.y2d);
    ctx.lineTo(pp3.x2d, pp3.y2d);
    ctx.closePath();
  } else {
    ctx.moveTo(cp4x, cp4y);
    ctx.quadraticCurveTo(pp1.x2d, pp1.y2d, cp1x, cp1y);
    ctx.quadraticCurveTo(pp2.x2d, pp2.y2d, cp2x, cp2y);
    ctx.quadraticCurveTo(pp3.x2d, pp3.y2d, cp3x, cp3y);
    ctx.quadraticCurveTo(pp4.x2d, pp4.y2d, cp4x, cp4y);
  }
  ctx.stroke();
}

// --- Colors ---
function getRGBColor(color, fast) {
  const r = Math.sin((color.r += fast ? 0.04 : 0.01)) * 1 + 1;
  const g = Math.sin((color.g += fast ? 0.028 : 0.007)) * 1 + 1;
  const b = Math.sin((color.b += fast ? 0.052 : 0.013)) * 1 + 1;
  return { r, g, b };
}

function clampColor(color, min) {
  color.r = Math.max(color.r, min);
  color.g = Math.max(color.g, min);
  color.b = Math.max(color.b, min);
}

// --- Tunnel geometry ---
function buildTunnelRings(w, h, shape, preserveMp) {
  const rings = [];
  const mp = preserveMp ? { x: preserveMp.x, y: preserveMp.y } : { x: Math.random() * w, y: Math.random() * h };
  let audioIdx = 8;

  for (let z = -FOV; z < FOV; z += Z_STEP) {
    const coords = [];
    for (let i = 0; i <= SEGMENTS; i++) {
      const pos = getShapePoint(shape, 0, 0, RADIUS, i, SEGMENTS, 0);
      coords.push({ ...pos, index: i, radius: RADIUS, segments: SEGMENTS });
    }

    const ring = {
      z, center: { x: 0, y: 0 }, mp: { x: mp.x, y: mp.y },
      radius: RADIUS, color: { r: 0, g: 0, b: 0 },
      segments: [],
    };

    const toggle = rings.length % 2;
    for (let i = 0; i < coords.length; i++) {
      const pt = coords[i];
      const prev = i > 0 ? coords[i - 1] : coords[coords.length - 1];

      if (i % 2 === toggle) {
        const seg = {
          x: pt.x, y: pt.y, x2d: 0, y2d: 0, active: true,
          index: pt.index, radius: RADIUS, radiusAudio: RADIUS, segments: SEGMENTS,
          audioBufferIndex: audioIdx,
          subs: [
            { x: prev.x, y: prev.y, index: prev.index },
            { x: pt.x, y: pt.y, index: pt.index },
            { x: prev.x, y: prev.y, index: prev.index },
          ],
        };
        ring.segments.push(seg);
        if (i < coords.length - 1) audioIdx = Math.floor(Math.random() * 1016) + 8;
      } else {
        ring.segments.push({ active: false });
      }
    }
    if (ring.segments.some(s => s.active)) {
      audioIdx = ring.segments.find(s => s.active).audioBufferIndex;
    }
    rings.push(ring);
  }
  return rings;
}

function getCenterTarget(w, h) {
  const corners = [
    { x: w * CORNER_MARGIN, y: h * CORNER_MARGIN },
    { x: w * (1 - CORNER_MARGIN), y: h * CORNER_MARGIN },
    { x: w * (1 - CORNER_MARGIN), y: h * (1 - CORNER_MARGIN) },
    { x: w * CORNER_MARGIN, y: h * (1 - CORNER_MARGIN) },
  ];
  const cycle = (Date.now() / 1000) % (4 * CORNER_DURATION);
  const idx = Math.floor(cycle / CORNER_DURATION) % 4;
  const t = (cycle % CORNER_DURATION) / CORNER_DURATION;
  const from = corners[idx], to = corners[(idx + 1) % 4];
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

// --- Main ---
export function render(canvas, ctx, audio, container, options = {}) {
  const w = canvas.width, h = canvas.height;
  if (!w || !h) return;

  const state = container.visualizerState;
  const shape = options.shape ?? 'circle';

  if (!state.initialized || state.shape !== shape) {
    state.initialized = true;
    state.shape = shape;
    state.rings = buildTunnelRings(w, h, shape, state.rings?.[0]?.mp);
    state.time = 0;
    state.rgb = state.rgb || { r: Math.random() * (Math.PI * 2), g: Math.random() * (Math.PI * 2), b: Math.random() * (Math.PI * 2) };
    state.rgb2 = state.rgb2 || { r: Math.random() * (Math.PI * 2), g: Math.random() * (Math.PI * 2), b: Math.random() * (Math.PI * 2) };
  }

  const rings = state.rings;
  if (!rings.length) return;

  const baseSpeed = options.speed ?? 1.5;
  const reactive = options.reactiveSpeed !== false;
  const speed = reactive ? baseSpeed * (1 + 0.6 * ((audio.bass ?? 0) + (audio.kick ?? 0))) : baseSpeed;

  const target = getCenterTarget(w, h);
  const freqCount = audio.analyser?.frequencyBinCount ?? 4096;
  if (!state.freqData || state.freqData.length !== freqCount) state.freqData = new Uint8Array(freqCount);
  audio.getByteFrequencyData(state.freqData);

  const col = getRGBColor(state.rgb2, true);
  const col2 = getRGBColor(state.rgb, false);
  clampColor(col, 0.6);
  clampColor(col2, 0.4);

  ctx.clearRect(0, 0, w, h);
  ctx.lineWidth = STROKE_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  let needsSort = false;

  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    const prev = i > 0 ? rings[i - 1] : null;

    ring.color.r = Math.max(col.r - (ring.z + FOV) / FOV, col2.r);
    ring.color.g = Math.max(col.g - (ring.z + FOV) / FOV, col2.g);
    ring.color.b = Math.max(col.b - (ring.z + FOV) / FOV, col2.b);

    ring.mp.x += (target.x - ring.mp.x) * MP_LERP;
    ring.mp.y += (target.y - ring.mp.y) * MP_LERP;
    const depthScale = (ring.z - FOV) / 500;
    ring.center.x = (w / 2 - ring.mp.x) * depthScale + w / 2;
    ring.center.y = (h / 2 - ring.mp.y) * depthScale + h / 2;

    const scale = FOV / (FOV + ring.z);
    const scaleBack = prev ? FOV / (FOV + prev.z) : scale;

    for (let j = 0; j < ring.segments.length; j++) {
      const seg = ring.segments[j];
      if (!seg.active) continue;

      const freq = state.freqData[Math.min(seg.audioBufferIndex, freqCount - 1)];
      seg.radiusAudio = seg.radius - (freq / 40) * AUDIO_REACTIVE_MULT;
      seg.x2d = seg.x * scale + ring.center.x;
      seg.y2d = seg.y * scale + ring.center.y;

      const lineVal = j > 0 ? Math.min(255, Math.max(80, Math.round((i / rings.length) * (120 + freq * AUDIO_REACTIVE_MULT)))) : 0;

      if (i > 0 && i < rings.length - 1 && seg.subs) {
        seg.subs.forEach((sub, o) => {
          if (o >= 1) {
            sub.x2d = sub.x * scaleBack + prev.center.x;
            sub.y2d = sub.y * scaleBack + prev.center.y;
          } else {
            sub.x2d = sub.x * scale + ring.center.x;
            sub.y2d = sub.y * scale + ring.center.y;
          }
          const p = getShapePoint(shape, 0, 0, seg.radiusAudio, sub.index, seg.segments, state.time);
          sub.x = p.x;
          sub.y = p.y;
        });

        const depthFactor = Math.max(0, (FOV - ring.z) / (2 * FOV));
        const cr = Math.min(255, Math.round(ring.color.r * lineVal * depthFactor * BRIGHTNESS));
        const cg = Math.min(255, Math.round(ring.color.g * lineVal * depthFactor * BRIGHTNESS));
        const cb = Math.min(255, Math.round(ring.color.b * lineVal * depthFactor * BRIGHTNESS));

        drawQuad(ctx, seg, seg.subs[1], seg.subs[2], seg.subs[0], shape, ring, cr, cg, cb);
      }

      const closeIndex = j < ring.segments.length - 1 ? seg.index : (ring.segments.find(s => s.active)?.index ?? 0);
      const p = getShapePoint(shape, 0, 0, seg.radiusAudio, closeIndex, seg.segments, state.time);
      seg.x = p.x;
      seg.y = p.y;
    }

    ring.z -= speed;
    if (ring.z < -FOV) {
      ring.z += FOV * 2;
      needsSort = true;
    }
  }

  if (needsSort) rings.sort((a, b) => b.z - a.z);
  state.time += 0.005;
}

export function cleanup(canvas, container, slot) {
  const state = container.visualizerState;
  if (!state?.initialized) return;
  state.rings = [];
  Object.keys(state).forEach(k => delete state[k]);
}
