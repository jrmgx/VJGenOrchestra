function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: +("0x" + m[1]), g: +("0x" + m[2]), b: +("0x" + m[3]) } : { r: 211, g: 211, b: 211 };
}

function hexToHsl(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return Math.max(0, Math.min(1, l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return {
    r: Math.round(f(0) * 255),
    g: Math.round(f(8) * 255),
    b: Math.round(f(4) * 255),
  };
}

function almondPath(ctx, cx, cy, width, height) {
  const innerX = cx - width / 2;
  const outerX = cx + width / 2;
  ctx.beginPath();
  ctx.moveTo(innerX, cy);
  ctx.quadraticCurveTo(cx - width * 0.15, cy - height * 0.55, outerX, cy);
  ctx.quadraticCurveTo(cx + width * 0.15, cy + height * 0.4, innerX, cy);
  ctx.closePath();
}

function sampleAlmondBoundary(cx, cy, width, height, samplesPerCurve = 120) {
  const innerX = cx - width / 2;
  const outerX = cx + width / 2;
  const c1x = cx - width * 0.15;
  const c1y = cy - height * 0.55;
  const c2x = cx + width * 0.15;
  const c2y = cy + height * 0.4;
  const curves = [
    [innerX, cy, c1x, c1y, outerX, cy],
    [outerX, cy, c2x, c2y, innerX, cy],
  ];
  const pts = [];
  for (const [x0, y0, cx1, cy1, x2, y2] of curves) {
    for (let i = 0; i <= samplesPerCurve; i++) {
      const t = i / samplesPerCurve;
      const mt = 1 - t;
      const x = mt * mt * x0 + 2 * mt * t * cx1 + t * t * x2;
      const y = mt * mt * y0 + 2 * mt * t * cy1 + t * t * y2;
      if (i === 0 && pts.length) continue;
      pts.push([x, y]);
    }
  }
  return pts;
}

function raySegmentIntersectT(ox, oy, vx, vy, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const det = vx * dy - vy * dx;
  if (Math.abs(det) < 1e-12) return null;
  const t = ((x1 - ox) * dy - (y1 - oy) * dx) / det;
  const u = ((x1 - ox) * vy - (y1 - oy) * vx) / det;
  if (t >= 0 && u >= 0 && u <= 1) return t;
  return null;
}

/** Smallest t>0 where (cx,cy)+t*(ux,uy) hits the closed boundary (center should be inside). */
function firstOutwardBoundaryHit(cx, cy, ux, uy, boundary) {
  let bestT = Infinity;
  for (let i = 0; i < boundary.length; i++) {
    const j = (i + 1) % boundary.length;
    const [x1, y1] = boundary[i];
    const [x2, y2] = boundary[j];
    const t = raySegmentIntersectT(cx, cy, ux, uy, x1, y1, x2, y2);
    if (t != null && t > 1e-6 && t < bestT) bestT = t;
  }
  return bestT < Infinity ? bestT : null;
}

export function render(canvas, ctx, audio, container, options = {}) {
  const w = canvas.width;
  const h = canvas.height;
  const state = (container.visualizerState ??= {});

  const dt = 0.016;
  const t = (state.t ?? 0) + dt;
  state.t = t;

  state.blinkNextAt ??= t + 3 + Math.random() * 2;
  if (t >= state.blinkNextAt && !state.blinkStart) {
    state.blinkStart = t;
    state.blinkNextAt = t + 3 + Math.random() * 2;
  }
  let heightScale = 1;
  if (state.blinkStart) {
    const elapsed = t - state.blinkStart;
    const blinkDuration = 0.12;
    if (elapsed >= blinkDuration) {
      state.blinkStart = null;
    } else {
      const phase = elapsed / blinkDuration;
      heightScale = phase < 0.5 ? 1 - 2 * phase : 2 * phase - 1;
      heightScale = Math.max(0.02, heightScale);
    }
  }

  const size = Math.min(w, h) * 0.2;
  const eyeRadius = size;
  const pupilRadius = eyeRadius * 0.42;

  const almondW = eyeRadius * 3.4;
  const almondH = eyeRadius * 3 * heightScale;
  const lineW = 40;

  const kick = audio.kick === 1;
  const bass = audio.bass ?? 0;
  const mid = audio.mid ?? 0;
  const high = audio.high ?? 0;
  const energy = (bass + mid + high) / 3;

  const reactive = options.reactive !== false;
  const effectThickness = reactive ? (state.reactiveEffectThickness ?? 1) : (options.effectThickness ?? 1);
  const effectLineW = 40 * effectThickness;
  const cooldown = 0.4;
  state.lastKickTime ??= t;
  const timeSinceKick = t - state.lastKickTime;

  const kicksToSwitch = 10;
  if (reactive) {
    state.reactiveRaySpeed ??= 0.3;
    state.reactiveTunnelSpeed ??= 0.25;
    state.reactiveEffectThickness ??= 1;
    if (kick && timeSinceKick >= cooldown) {
      state.lastKickTime = t;
      state.kickCount = (state.kickCount ?? 0) + 1;
      if (state.kickCount >= kicksToSwitch) {
        state.kickCount = 0;
        state.effectMode = ((state.effectMode ?? 0) + 1) % 3;
        state.reactiveRaySpeed = (Math.random() - 0.5) * 4;
        state.reactiveTunnelSpeed = (Math.random() - 0.5) * 4;
        state.reactiveEffectThickness = 1 + Math.random() * 4;
      }
      const corners = [[-1, -0.5], [1, -0.5], [-1, 0.5], [1, 0.5]];
      state.lookTarget = corners[Math.floor(Math.random() * 4)];
    }
    state.hue = (state.hue ?? 0) + energy * dt * 120;
    const idleReturn = 3;
    if (timeSinceKick >= idleReturn) state.lookTarget = [0, 0];
    state.lookTarget ??= [0, 0];
    const lerpFactor = dt / cooldown;
    state.lookX = (state.lookX ?? 0) + (state.lookTarget[0] - (state.lookX ?? 0)) * lerpFactor;
    state.lookY = (state.lookY ?? 0) + (state.lookTarget[1] - (state.lookY ?? 0)) * lerpFactor;
  } else {
    state.hue = (state.hue ?? 0) + dt * 30;
    state.lookX = 0;
    state.lookY = 0;
  }
  if ((state.hue ?? 0) >= 360) state.hue -= 360;
  if ((state.hue ?? 0) < 0) state.hue += 360;
  const hue = state.hue ?? 0;

  const centerX = w / 2;
  const centerY = h / 2;
  const lookOffsetX = eyeRadius * 0.35 * (state.lookX ?? 0);
  const lookOffsetY = eyeRadius * 0.35 * (state.lookY ?? 0);
  const speed = 0.5;
  const swayAmp = w * 0.04;
  const eyeX = centerX + Math.sin(t * 0.8 * speed) * swayAmp;

  const parallaxFactor = 0.6;
  const pupilOffsetX = -Math.sin(t * 0.8 * speed) * swayAmp * parallaxFactor;
  const pupilWander = eyeRadius * 0.15;
  const pupilOffsetY = Math.sin(t * 1.2 * speed) * pupilWander;
  const irisX = eyeX + lookOffsetX;
  const irisY = centerY + lookOffsetY;
  const pupilX = irisX + pupilOffsetX + Math.sin(t * 0.6 * speed) * pupilWander;
  const pupilY = irisY + pupilOffsetY;

  const rayHsl = hexToHsl(options.rayColor ?? "#d3d3d3");
  const tunnelHsl = hexToHsl(options.tunnelColor ?? "#d3d3d3");
  const rayS = rayHsl.s < 5 ? 25 : rayHsl.s;
  const rayL = rayHsl.s < 5 ? 80 : rayHsl.l;
  const tunnelS = tunnelHsl.s < 5 ? 25 : tunnelHsl.s;
  const tunnelL = tunnelHsl.s < 5 ? 80 : tunnelHsl.l;
  const baseHue = 210;
  const borderColor = reactive
    ? `hsl(${(baseHue + hue) % 360}, 20%, 83%)`
    : (options.tunnelColor ?? "#d3d3d3");
  const rayColor = `hsl(${(rayHsl.h + hue) % 360}, ${rayS}%, ${rayL}%)`;
  const tunnelRgb = hslToRgb((tunnelHsl.h + hue) % 360, tunnelS, tunnelL);
  const irisColor = reactive
    ? `hsl(${(baseHue + hue + 60) % 360}, 70%, 45%)`
    : (options.irisColor ?? "#196bd7");

  ctx.clearRect(0, 0, w, h);
  ctx.globalAlpha = 1;

  const showRays = reactive ? state.effectMode === 0 : options.effectRays !== false;
  const showTunnel = reactive ? state.effectMode === 1 : options.effectTunnel === true;

  if (showRays) {
    const rayCount = 14;
    const baseRadius = Math.min(w, h) * 0.48;
    const stopBefore = 100;
    const raySpeed = (reactive ? (state.reactiveRaySpeed ?? 0.3) : (options.raySpeed ?? 0.3)) * (reactive ? 1 + energy * 1.5 : 1);
    state.rayAngle = (state.rayAngle ?? 0) + raySpeed * dt;
    const rot = state.rayAngle;

    const raysBoundary = sampleAlmondBoundary(centerX, centerY, almondW, almondH);
    ctx.strokeStyle = rayColor;
    ctx.lineWidth = effectLineW;
    ctx.lineCap = "round";
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2 + rot;
      const ux = Math.cos(angle);
      const uy = Math.sin(angle);
      const tExit = firstOutwardBoundaryHit(centerX, centerY, ux, uy, raysBoundary);
      if (tExit == null) continue;
      const tNear = tExit + stopBefore;
      const tFar = baseRadius;
      if (tNear >= tFar - 1e-3) continue;
      const px = centerX + tFar * ux;
      const py = centerY + tFar * uy;
      const tx = centerX + tNear * ux;
      const ty = centerY + tNear * uy;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
  }

  if (showTunnel) {
    const tunnelRings = 12;
    const tunnelStep = 0.4;
    const tunnelSpeed = (reactive ? (state.reactiveTunnelSpeed ?? 0.25) : (options.tunnelSpeed ?? 0.25)) * (reactive ? 1 + energy * 1.5 : 1);
    const tunnelBaseW = almondW;
    const tunnelBaseH = eyeRadius * 3;
    state.tunnelPhase = (state.tunnelPhase ?? 0) + tunnelSpeed * dt;
    const growPhase = state.tunnelPhase % tunnelStep;
    const rgb = tunnelRgb;
    ctx.lineWidth = effectLineW;
    for (let i = 1; i <= tunnelRings; i++) {
      const scale = 1 + (i - 1) * tunnelStep + growPhase;
      const alpha = Math.max(0, Math.min(1, 1 - i / 10));
      ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
      almondPath(ctx, centerX, centerY, tunnelBaseW * scale, tunnelBaseH * scale);
      ctx.stroke();
    }
  }

  ctx.save();
  almondPath(ctx, centerX, centerY, almondW, almondH);
  ctx.clip();

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);

  ctx.beginPath();
  ctx.arc(irisX, irisY, eyeRadius, 0, Math.PI * 2);
  ctx.fillStyle = irisColor;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(pupilX, pupilY, pupilRadius, 0, Math.PI * 2);
  ctx.fillStyle = "#000";
  ctx.fill();

  const reflX = pupilX + pupilRadius * 0.35;
  const reflY = pupilY - pupilRadius * 0.35;
  ctx.beginPath();
  ctx.arc(reflX, reflY, pupilRadius * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();

  ctx.restore();

  almondPath(ctx, centerX, centerY, almondW, almondH);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = lineW;
  ctx.stroke();
}
