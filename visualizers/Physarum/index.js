/**
 * Physarum transport network simulation.
 * Adapted from https://github.com/amandaghassaei/gpu-io (Amanda Ghassaei).
 * Based on Jones 2010 and https://cargocollective.com/sagejenson/physarum
 */

const PARTICLES_NUM_COMPONENTS = 4;

const FIBERS_DEFAULTS = {
  decayFactor: 0.9,
  depositAmount: 4,
  particleDensity: 0.35,
  renderAmplitude: 0.03,
  stepSize: 2,
};

const PRESETS = {
  Fibers: { sensorDistance: 18, sensorAngle: 5.5, rotationAngle: 45 },
  Fingerprint: { sensorDistance: 14, sensorAngle: 70, rotationAngle: -25 },
  Honeycomb: { sensorDistance: 7.5, sensorAngle: 90, rotationAngle: -45 },
  Net: { sensorDistance: 18, sensorAngle: 90, rotationAngle: -16 },
};

function initParticlesArrays(width, height, particleDensity) {
  const numParticles = Math.round(width * height * particleDensity);
  const positions = new Float32Array(numParticles * PARTICLES_NUM_COMPONENTS);
  const heading = new Float32Array(numParticles);
  for (let i = 0; i < numParticles; i++) {
    positions[PARTICLES_NUM_COMPONENTS * i] = Math.random() * width;
    positions[PARTICLES_NUM_COMPONENTS * i + 1] = Math.random() * height;
    positions[PARTICLES_NUM_COMPONENTS * i + 2] = 0;
    positions[PARTICLES_NUM_COMPONENTS * i + 3] = 0;
    heading[i] = Math.random() * Math.PI * 2;
  }
  return { positions, heading, numParticles };
}

function init(container, state, width, height, opts) {
  if (!window.GPUIO) return false;
  const {
    GPUComposer,
    GPUProgram,
    GPULayer,
    INT,
    BOOL,
    FLOAT,
    REPEAT,
    LINEAR,
    renderAmplitudeProgram,
    addValueProgram,
  } = window.GPUIO;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
  container.appendChild(canvas);

  const { positions, heading, numParticles } = initParticlesArrays(
    width,
    height,
    FIBERS_DEFAULTS.particleDensity
  );

  const composer = new GPUComposer({ canvas });
  const particlesPositions = new GPULayer(composer, {
    name: "particlesPositions",
    dimensions: numParticles,
    numComponents: PARTICLES_NUM_COMPONENTS,
    type: FLOAT,
    numBuffers: 2,
    array: positions,
  });
  const particlesHeading = new GPULayer(composer, {
    name: "particlesHeading",
    dimensions: numParticles,
    numComponents: 1,
    type: FLOAT,
    numBuffers: 2,
    array: heading,
  });

  const updateParticles = new GPUProgram(composer, {
    name: "updateParticles",
    fragmentShader: `
      in vec2 v_uv;
      #define TWO_PI 6.28318530718
      uniform sampler2D u_particlesHeading;
      uniform sampler2D u_particlesPositions;
      uniform sampler2D u_trail;
      uniform vec2 u_dimensions;
      uniform float u_sensorAngle;
      uniform float u_sensorDistance;
      uniform float u_rotationAngle;
      uniform bool u_randomDir;
      uniform float u_stepSize;
      layout (location = 0) out float out_heading;
      layout (location = 1) out vec4 out_position;
      float sense(vec2 position, float angle) {
        vec2 sensePosition = position + u_sensorDistance * vec2(cos(angle), sin(angle));
        return texture(u_trail, sensePosition / u_dimensions).x;
      }
      void main() {
        float heading = texture(u_particlesHeading, v_uv).r;
        vec4 positionInfo = texture(u_particlesPositions, v_uv);
        vec2 absolute = positionInfo.xy;
        vec2 displacement = positionInfo.zw;
        vec2 position = absolute + displacement;
        float middleState = sense(position, heading);
        float leftState = sense(position, heading + u_sensorAngle);
        float rightState = sense(position, heading - u_sensorAngle);
        float rightWeight = step(middleState, rightState);
        float leftWeight = step(middleState, leftState);
        heading += mix(
          rightWeight * mix(u_rotationAngle, -u_rotationAngle, float(u_randomDir)),
          mix(u_rotationAngle, -u_rotationAngle, rightWeight),
          abs(leftWeight - rightWeight)
        );
        heading = mod(heading + TWO_PI, TWO_PI);
        out_heading = heading;
        vec2 move = u_stepSize * vec2(cos(heading), sin(heading));
        vec2 nextDisplacement = displacement + move;
        float shouldMerge = step(30.0, dot(nextDisplacement, nextDisplacement));
        absolute = mod(absolute + shouldMerge * nextDisplacement + u_dimensions, u_dimensions);
        nextDisplacement *= (1.0 - shouldMerge);
        out_position = vec4(absolute, nextDisplacement);
      }`,
    uniforms: [
      { name: "u_particlesHeading", value: 0, type: INT },
      { name: "u_particlesPositions", value: 1, type: INT },
      { name: "u_trail", value: 2, type: INT },
      { name: "u_dimensions", value: [width, height], type: FLOAT },
      { name: "u_sensorAngle", value: (opts.sensorAngle ?? 5.5) * (Math.PI / 180), type: FLOAT },
      { name: "u_sensorDistance", value: opts.sensorDistance ?? 18, type: FLOAT },
      { name: "u_rotationAngle", value: (opts.rotationAngle ?? 45) * (Math.PI / 180), type: FLOAT },
      { name: "u_randomDir", value: false, type: BOOL },
      { name: "u_stepSize", value: FIBERS_DEFAULTS.stepSize, type: FLOAT },
    ],
  });

  const trail = new GPULayer(composer, {
    name: "trail",
    dimensions: [width, height],
    numComponents: 1,
    type: FLOAT,
    filter: LINEAR,
    numBuffers: 2,
    wrapX: REPEAT,
    wrapY: REPEAT,
  });

  const deposit = addValueProgram(composer, {
    name: "deposit",
    type: trail.type,
    value: FIBERS_DEFAULTS.depositAmount,
  });

  const diffuseAndDecay = new GPUProgram(composer, {
    name: "diffuseAndDecay",
    fragmentShader: `
      in vec2 v_uv;
      uniform sampler2D u_trail;
      uniform float u_decayFactor;
      uniform vec2 u_pxSize;
      out float out_state;
      void main() {
        vec2 halfPx = u_pxSize / 2.0;
        float prevStateNE = texture(u_trail, v_uv + halfPx).x;
        float prevStateNW = texture(u_trail, v_uv + vec2(-halfPx.x, halfPx.y)).x;
        float prevStateSE = texture(u_trail, v_uv + vec2(halfPx.x, -halfPx.y)).x;
        float prevStateSW = texture(u_trail, v_uv - halfPx).x;
        float diffusedState = (prevStateNE + prevStateNW + prevStateSE + prevStateSW) / 4.0;
        out_state = u_decayFactor * diffusedState;
      }`,
    uniforms: [
      { name: "u_trail", value: 0, type: INT },
      { name: "u_decayFactor", value: FIBERS_DEFAULTS.decayFactor, type: FLOAT },
      { name: "u_pxSize", value: [1 / width, 1 / height], type: FLOAT },
    ],
  });

  const render = renderAmplitudeProgram(composer, {
    name: "render",
    type: trail.type,
    components: "x",
    scale: FIBERS_DEFAULTS.renderAmplitude,
  });

  state.canvas = canvas;
  state.composer = composer;
  state.particlesPositions = particlesPositions;
  state.particlesHeading = particlesHeading;
  state.updateParticles = updateParticles;
  state.trail = trail;
  state.deposit = deposit;
  state.diffuseAndDecay = diffuseAndDecay;
  state.render = render;
  state.numParticles = numParticles;
  state.initialized = true;
  return true;
}

function applyOptions(state, opts) {
  const preset = PRESETS[opts.preset] ?? PRESETS.Fibers;
  const o = { ...preset, ...opts };
  const deg = Math.PI / 180;
  state.updateParticles.setUniform("u_sensorAngle", (o.sensorAngle ?? 5.5) * deg);
  state.updateParticles.setUniform("u_sensorDistance", o.sensorDistance ?? 18);
  state.updateParticles.setUniform("u_rotationAngle", (o.rotationAngle ?? 45) * deg);
  state.updateParticles.setUniform("u_stepSize", FIBERS_DEFAULTS.stepSize);
  state.deposit.setUniform("u_value", FIBERS_DEFAULTS.depositAmount);
  state.diffuseAndDecay.setUniform("u_decayFactor", FIBERS_DEFAULTS.decayFactor);
  state.render.setUniform("u_scale", FIBERS_DEFAULTS.renderAmplitude);
}

export function render(canvas, ctx, audio, container, options = {}, engine) {
  if (!window.GPUIO) return;
  const state = container.visualizerState;
  const width = canvas.width;
  const height = canvas.height;
  if (!width || !height) return;

  if (!state.initialized) {
    const opts = { ...PRESETS.Fibers, ...options };
    if (!init(container, state, width, height, opts)) return;
  }

  const opts = { ...PRESETS[options.preset] ?? PRESETS.Fibers, ...options };

  if (state.canvas.width !== width || state.canvas.height !== height) {
    state.canvas.width = width;
    state.canvas.height = height;
    state.composer.resize([width, height]);
    const { positions, heading, numParticles } = initParticlesArrays(
      width,
      height,
      FIBERS_DEFAULTS.particleDensity
    );
    state.particlesPositions.resize(numParticles, positions);
    state.particlesHeading.resize(numParticles, heading);
    state.trail.resize([width, height]);
    state.diffuseAndDecay.setUniform("u_pxSize", [1 / width, 1 / height]);
    state.updateParticles.setUniform("u_dimensions", [width, height]);
  }

  applyOptions(state, opts);

  state.updateParticles.setUniform("u_randomDir", Math.random() < 0.5);
  state.composer.step({
    program: state.updateParticles,
    input: [state.particlesHeading, state.particlesPositions, state.trail],
    output: [state.particlesHeading, state.particlesPositions],
  });
  state.composer.drawLayerAsPoints({
    layer: state.particlesPositions,
    program: state.deposit,
    input: state.trail,
    output: state.trail,
    pointSize: 1,
    wrapX: true,
    wrapY: true,
  });
  state.composer.step({
    program: state.diffuseAndDecay,
    input: state.trail,
    output: state.trail,
  });
  state.composer.step({
    program: state.render,
    input: state.trail,
  });
}

export function cleanup(canvas, container, slot) {
  const state = container.visualizerState;
  if (!state?.initialized) return;
  state.particlesPositions?.dispose();
  state.particlesHeading?.dispose();
  state.updateParticles?.dispose();
  state.trail?.dispose();
  state.deposit?.dispose();
  state.diffuseAndDecay?.dispose();
  state.render?.dispose();
  state.composer?.dispose();
  if (state.canvas?.parentElement) container.removeChild(state.canvas);
  Object.keys(state).forEach((k) => delete state[k]);
}
