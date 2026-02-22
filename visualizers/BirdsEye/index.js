'use strict';

function yieldToBrowser() {
  return new Promise((r) => {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => r(), { timeout: 1 });
    } else {
      setTimeout(r, 0);
    }
  });
}

const FOV = 600;
const fov = FOV;
const lightVector = { x: -fov * 0.25, y: 0, z: -fov * 0.5 };
const cameraVector = { x: 0, y: 0, z: -fov };

const vertexCode = `#version 300 es
    in vec2 a_position;
    in vec2 a_texcoord;
    in float a_layer;
    uniform vec2 u_resolution;
    out vec2 v_texcoord;
    out float v_layer;
    void main(void) {
        v_texcoord = a_texcoord;
        v_layer = a_layer;
        vec2 pos2d = a_position.xy;
        vec2 zeroToOne = pos2d / u_resolution;
        vec2 zeroToTwo = zeroToOne * 2.0;
        vec2 clipSpace = zeroToTwo - 1.0;
        gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    }
`;

const fragmentCode = `#version 300 es
    precision lowp float;
    precision lowp sampler2DArray;
    in vec2 v_texcoord;
    in float v_layer;
    uniform sampler2DArray u_textureArray;
    out vec4 fragColor;
    void main(void) {
        fragColor = texture(u_textureArray, vec3(v_texcoord, v_layer));
    }
`;

const gridMaxTileSize = 4;
const gridBuildingTileSizes = [
  { x: 4, y: 4 }, { x: 3, y: 4 }, { x: 2, y: 4 }, { x: 4, y: 3 }, { x: 4, y: 2 },
  { x: 3, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 2 }, { x: 1, y: 3 }, { x: 3, y: 1 },
  { x: 2, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 1 }, { x: 1, y: 1 }
];
const gridStreetTileTypes = [
  'empty', '1x1_vertical', '1x1_horizontal', '1x1_crossing', '2x1l_vertical', '2x1r_vertical',
  '1x2t_horizontal', '1x2b_horizontal', '1x2r_crossing', '1x2l_crossing', '2x1t_crossing', '2x1b_crossing',
  '2x2tl_crossing', '2x2tr_crossing', '2x2bl_crossing', '2x2br_crossing',
  '1x1l_horizontal_crosswalk', '1x1r_horizontal_crosswalk', '1x1b_vertical_crosswalk', '1x1t_vertical_crosswalk',
  '1x2lt_horizontal_crosswalk', '1x2lb_horizontal_crosswalk', '1x2rt_horizontal_crosswalk', '1x2rb_horizontal_crosswalk',
  '2x1tl_vertical_crosswalk', '2x1tr_vertical_crosswalk', '2x1bl_vertical_crosswalk', '2x1br_vertical_crosswalk'
];

const texturesBuildingsCount = 64;
const textureWidth = 64;
const textureHeight = 64;
const texturesBuildingRoofsTiles = 9;
const textureCubeNormals = [
  { x: 0, y: 0, z: -1 }, { x: -1, y: 0, z: 0 }, { x: 0, y: -1, z: 0 },
  { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }
];
const textureBuildingColors = [
  { cWa: { r: 254, g: 236, b: 214 }, cWi: { r: 67, g: 49, b: 37 } },
  { cWa: { r: 244, g: 250, b: 240 }, cWi: { r: 13, g: 39, b: 52 } },
  { cWa: { r: 244, g: 250, b: 240 }, cWi: { r: 26, g: 36, b: 48 } },
  { cWa: { r: 228, g: 231, b: 222 }, cWi: { r: 73, g: 79, b: 79 } },
  { cWa: { r: 228, g: 231, b: 222 }, cWi: { r: 103, g: 93, b: 94 } },
  { cWa: { r: 184, g: 187, b: 196 }, cWi: { r: 38, g: 56, b: 66 } },
  { cWa: { r: 219, g: 226, b: 230 }, cWi: { r: 32, g: 45, b: 54 } },
  { cWa: { r: 249, g: 244, b: 225 }, cWi: { r: 63, g: 53, b: 61 } },
  { cWa: { r: 240, g: 243, b: 234 }, cWi: { r: 19, g: 36, b: 46 } },
  { cWa: { r: 255, g: 255, b: 255 }, cWi: { r: 22, g: 34, b: 40 } },
  { cWa: { r: 230, g: 214, b: 201 }, cWi: { r: 63, g: 68, b: 74 } },
  { cWa: { r: 213, g: 212, b: 202 }, cWi: { r: 59, g: 75, b: 72 } },
  { cWa: { r: 243, g: 237, b: 237 }, cWi: { r: 94, g: 92, b: 81 } },
  { cWa: { r: 228, g: 228, b: 203 }, cWi: { r: 63, g: 52, b: 44 } },
  { cWa: { r: 233, g: 222, b: 216 }, cWi: { r: 39, g: 46, b: 54 } },
  { cWa: { r: 238, g: 219, b: 192 }, cWi: { r: 77, g: 87, b: 88 } },
  { cWa: { r: 238, g: 230, b: 225 }, cWi: { r: 55, g: 71, b: 84 } },
  { cWa: { r: 239, g: 211, b: 196 }, cWi: { r: 95, g: 87, b: 85 } },
  { cWa: { r: 243, g: 242, b: 238 }, cWi: { r: 32, g: 42, b: 51 } },
  { cWa: { r: 243, g: 233, b: 223 }, cWi: { r: 61, g: 72, b: 74 } },
  { cWa: { r: 230, g: 228, b: 225 }, cWi: { r: 30, g: 47, b: 55 } },
  { cWa: { r: 218, g: 226, b: 230 }, cWi: { r: 15, g: 29, b: 38 } },
  { cWa: { r: 244, g: 238, b: 224 }, cWi: { r: 99, g: 92, b: 89 } },
  { cWa: { r: 242, g: 219, b: 191 }, cWi: { r: 120, g: 111, b: 73 } },
  { cWa: { r: 233, g: 239, b: 245 }, cWi: { r: 80, g: 82, b: 91 } },
  { cWa: { r: 237, g: 225, b: 211 }, cWi: { r: 47, g: 40, b: 32 } },
  { cWa: { r: 211, g: 207, b: 198 }, cWi: { r: 55, g: 46, b: 39 } },
  { cWa: { r: 223, g: 222, b: 213 }, cWi: { r: 41, g: 41, b: 39 } }
];

const dotsRadius = 1;
const dotsDistance = 10;
const dotsDiameter = dotsRadius * 2;

// Forest mode
const FOREST_FOV = 800;
const pineTreesMax = 155;
const pineTreesTotal = 48;
const pineTreesMaxLayers = 10;
const pineTreeLayerDistance = 15;
const pineTreeMaximumSize = 150;
const pineTreeMinSpacing = 55;
const pineTreeColors = [
  { bottom: { r: 26, g: 28, b: 20 }, top: { r: 146, g: 147, b: 90 } },
  { bottom: { r: 23, g: 32, b: 29 }, top: { r: 142, g: 161, b: 155 } },
  { bottom: { r: 29, g: 45, b: 35 }, top: { r: 156, g: 176, b: 117 } },
  { bottom: { r: 39, g: 38, b: 17 }, top: { r: 201, g: 179, b: 78 } },
  { bottom: { r: 27, g: 37, b: 26 }, top: { r: 162, g: 170, b: 87 } },
  { bottom: { r: 27, g: 31, b: 8 }, top: { r: 171, g: 194, b: 53 } },
  { bottom: { r: 37, g: 38, b: 24 }, top: { r: 202, g: 194, b: 49 } },
  { bottom: { r: 32, g: 44, b: 40 }, top: { r: 170, g: 202, b: 89 } },
  { bottom: { r: 19, g: 30, b: 0 }, top: { r: 255, g: 156, b: 0 } },
  { bottom: { r: 0, g: 30, b: 29 }, top: { r: 181, g: 224, b: 119 } },
  { bottom: { r: 25, g: 25, b: 25 }, top: { r: 255, g: 255, b: 255 } }
];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function rgbToString(r, g, b) {
  return `rgb(${r}, ${g}, ${b})`;
}

function createShader(gl, shaderCode, type) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, shaderCode);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('BirdsEye: shader compile', gl.getShaderInfoLog(shader));
  }
  return shader;
}

function createShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = createShader(gl, vsSource, gl.VERTEX_SHADER);
  const fragmentShader = createShader(gl, fsSource, gl.FRAGMENT_SHADER);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.useProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('BirdsEye: program link', gl.getProgramInfoLog(program));
  }
  return program;
}

function createBuffer(gl, target, bufferArray, usage) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(target, buffer);
  gl.bufferData(target, bufferArray, usage);
  return buffer;
}

function createTextureArray(gl, width, height, numTextures) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_R, gl.REPEAT);
  gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA, width, height, numTextures, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  return texture;
}

function loadTextureIntoArray(gl, textureArray, layer, image, width, height) {
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, textureArray);
  gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, layer, width, height, 1, gl.RGBA, gl.UNSIGNED_BYTE, image);
}

function getUvCoordinates(repeatX = 1, repeatY = 1) {
  return [{ x: 0, y: 0 }, { x: repeatX, y: 0 }, { x: repeatX, y: repeatY }, { x: 0, y: repeatY }];
}

function addColorVariance(color, variance) {
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  return {
    r: clamp(color.r + Math.floor(Math.random() * variance * 2 - variance), 0, 255),
    g: clamp(color.g + Math.floor(Math.random() * variance * 2 - variance), 0, 255),
    b: clamp(color.b + Math.floor(Math.random() * variance * 2 - variance), 0, 255)
  };
}

function calcFaceNormalColor(color, faceNormal) {
  const lightBrightness = 1;
  const dotProductLight = faceNormal.x * lightVector.x + faceNormal.y * lightVector.y + faceNormal.z * lightVector.z;
  const normalMagnitude = Math.sqrt(faceNormal.x ** 2 + faceNormal.y ** 2 + faceNormal.z ** 2);
  const lightMagnitude = Math.sqrt(lightVector.x ** 2 + lightVector.y ** 2 + lightVector.z ** 2);
  const lightFactor = (Math.acos(dotProductLight / (normalMagnitude * lightMagnitude)) / Math.PI) * lightBrightness;
  return {
    r: Math.abs(color.r - Math.floor(color.r * lightFactor)),
    g: Math.abs(color.g - Math.floor(color.g * lightFactor)),
    b: Math.abs(color.b - Math.floor(color.b * lightFactor))
  };
}

function arrayShuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getRandomUniqueIndices(total, count) {
  const iterator = Math.floor(total / count);
  const start = Math.floor(iterator * 0.5);
  const indices = [];
  for (let i = start; i < total; i += iterator) {
    indices.push(i + Math.floor((Math.random() < 0.5 ? -1 : 1) * Math.floor(Math.random() * (start * 0.75))));
    if (Math.random() >= 0.5) indices.push(indices[indices.length - 1] + 1);
  }
  return indices;
}

function createRoofTexture(colorWall, w, h, numRows, numCols) {
  const width = w * numRows;
  const height = h * numCols;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const colorValue = Math.floor(Math.random() * 125);
    const colorDarkRandom = Math.random() * 0.15 + 0.4;
    data[i] = Math.floor(colorWall.r * colorDarkRandom) + colorValue;
    data[i + 1] = Math.floor(colorWall.g * colorDarkRandom) + colorValue;
    data[i + 2] = Math.floor(colorWall.b * colorDarkRandom) + colorValue;
    data[i + 3] = 255;
  }
  context.putImageData(imageData, 0, 0);
  const roofBorderWidth = Math.random() * (w * 0.15) + (w * 0.15);
  const roofRandomColorDiff = 1 - (Math.random() * 0.6 + 0.2);
  context.fillStyle = `rgba(${colorWall.r * roofRandomColorDiff}, ${colorWall.g * roofRandomColorDiff}, ${colorWall.b * roofRandomColorDiff}, ${Math.random() * 0.25 + 0.25})`;
  context.fillRect(roofBorderWidth, roofBorderWidth, width - roofBorderWidth * 2, height - roofBorderWidth * 2);
  context.lineWidth = Math.min(roofBorderWidth * 0.25, 4);
  context.strokeStyle = `rgba(${colorWall.r * 0.15}, ${colorWall.g * 0.15}, ${colorWall.b * 0.15}, ${Math.random() * 0.5 + 0.5})`;
  context.strokeRect(roofBorderWidth, roofBorderWidth, width - roofBorderWidth * 2, height - roofBorderWidth * 2);
  const imagesAndPromises = [];
  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      const smallCanvas = document.createElement('canvas');
      smallCanvas.width = w;
      smallCanvas.height = h;
      smallCanvas.getContext('2d').drawImage(canvas, col * w, row * h, w, h, 0, 0, w, h);
      const image = new Image();
      const promise = new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = smallCanvas.toDataURL();
      });
      imagesAndPromises.push({ image, promise });
    }
  }
  return imagesAndPromises;
}

function createWallTexture(textureType, colorWall, colorWindows, windowRatio, repeatX, repeatY, p, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const rgbWall = `rgb(${colorWall.r}, ${colorWall.g}, ${colorWall.b})`;
  const rgbWindows = `rgb(${colorWindows.r}, ${colorWindows.g}, ${colorWindows.b})`;
  context.fillStyle = rgbWall;
  context.fillRect(0, 0, w, h);
  if (textureType === 0) {
    const wallRatio = 1 - windowRatio;
    const totalHeight = h / repeatY;
    const windowHeight = totalHeight * windowRatio;
    const wallHeight = totalHeight * wallRatio;
    const border = wallHeight * 0.5;
    for (let i = 0; i < repeatY; i++) {
      context.fillStyle = rgbWindows;
      context.fillRect(0, i * totalHeight + border, w, windowHeight);
    }
  } else if (textureType === 1) {
    const wallRatio = 1 - windowRatio;
    const totalWidth = w / repeatX;
    const windowWidth = totalWidth * windowRatio;
    const border = totalWidth * wallRatio * 0.5;
    for (let i = 0; i < repeatX; i++) {
      context.fillStyle = rgbWindows;
      context.fillRect(i * totalWidth + border, 0, windowWidth, h);
    }
  } else if (textureType === 2) {
    const border = p;
    const windowWidth = (w - border - (repeatX - 1) * border) / repeatX;
    const windowHeight = (h - border - (repeatY - 1) * border) / repeatY;
    for (let row = 0; row < repeatY; row++) {
      for (let col = 0; col < repeatX; col++) {
        const x = col * (windowWidth + border) + border * 0.5;
        const y = row * (windowHeight + border) + border * 0.5;
        context.fillStyle = rgbWindows;
        context.fillRect(x, y, windowWidth, windowHeight);
      }
    }
  } else if (textureType === 3) {
    const windowWidth = w / repeatX;
    const windowHeight = h / repeatY;
    for (let row = 0; row < repeatY; row++) {
      for (let col = 0; col < repeatX; col++) {
        const x = col * windowWidth;
        const y = row * windowHeight;
        context.fillStyle = rgbWindows;
        context.fillRect(x, y, windowWidth, windowHeight);
        context.lineWidth = p * 5;
        context.strokeStyle = rgbWall;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + windowWidth, y + windowHeight);
        context.stroke();
        context.beginPath();
        context.moveTo(x + windowWidth, y);
        context.lineTo(x, y + windowHeight);
        context.stroke();
      }
    }
  } else if (textureType === 5) {
    const windowWidth = w / repeatX;
    const windowHeight = h / repeatY;
    for (let row = 0; row < repeatY; row++) {
      for (let col = 0; col < repeatX; col++) {
        const x = col * windowWidth;
        const y = row * windowHeight;
        context.fillStyle = rgbWindows;
        context.beginPath();
        context.arc(x + windowWidth * 0.5, y + windowHeight * 0.5, windowWidth * 0.25, 0, 2 * Math.PI);
        context.fill();
      }
    }
  } else {
    const windowWidth = w / repeatX;
    const windowHeight = h / repeatY;
    for (let row = 0; row < repeatY; row++) {
      for (let col = 0; col < repeatX; col++) {
        const x = col * windowWidth;
        const y = row * windowHeight;
        context.fillStyle = rgbWindows;
        context.fillRect(x, y, windowWidth, windowHeight);
      }
    }
  }
  const image = new Image();
  const promise = new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = canvas.toDataURL();
  });
  return { image, promise };
}

function createStreetTexture(textureType, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = context.getImageData(0, 0, w, h);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.floor(Math.random() * 75) + 25;
    data[i] = data[i + 1] = data[i + 2] = v;
    data[i + 3] = 255;
  }
  context.putImageData(imageData, 0, 0);
  const stroke = (t) => (t === '1x1_vertical' ? w / 50 : h / 50) * 2;
  if (textureType === '1x1_vertical') {
    const s = stroke('1x1_vertical');
    context.fillStyle = '#fff';
    context.fillRect(w / 2 - s / 2, 0, s, h);
  } else if (textureType === '1x1_horizontal') {
    const s = stroke('1x1_horizontal');
    context.fillStyle = '#fff';
    context.fillRect(0, h / 2 - s / 2, w, s);
  } else if (textureType === '1x1_crossing') {
    const s = h / 100 * 3;
    const diff = w / 100 * 16;
    context.lineWidth = s;
    context.setLineDash([10, 10]);
    context.strokeStyle = '#fff';
    context.strokeRect(diff, diff, w - diff * 2, h - diff * 2);
  }
  const image = new Image();
  const promise = new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = canvas.toDataURL();
  });
  return { image, promise };
}

async function createTextures(gl, state) {
  const textureHolder = [];
  const promiseHolder = [];
  let texturesCountBuildingRoofs = 0;

  for (let i = 0; i < texturesBuildingsCount; i++) {
    if (i > 0 && i % 2 === 0) await yieldToBrowser();
    const color = addColorVariance(textureBuildingColors[Math.floor(Math.random() * textureBuildingColors.length)].cWa, 2);
    const colorWall = calcFaceNormalColor(color, textureCubeNormals[0]);
    const num = Math.sqrt(texturesBuildingRoofsTiles);
    const textures = createRoofTexture(colorWall, textureWidth, textureHeight, num, num);
    for (let j = 0; j < texturesBuildingRoofsTiles; j++) {
      textureHolder.push(textures[j].image);
      promiseHolder.push(textures[j].promise);
      texturesCountBuildingRoofs++;
    }
  }
  state.texturesCountBuildingRoofs = texturesCountBuildingRoofs;

  let texturesCountBuildingWalls = 0;
  const wallCount = Math.floor(texturesBuildingsCount / 6);
  const createWalls = (tP, cWa, cWi, wR, rX, rY, p) => {
    for (let i = 1; i < textureCubeNormals.length; i++) {
      const cubeNormal = textureCubeNormals[i];
      const colorWall = calcFaceNormalColor(cWa, cubeNormal);
      const colorWindows = calcFaceNormalColor(cWi, cubeNormal);
      const t = createWallTexture(tP, colorWall, colorWindows, wR, rX, rY, p, textureWidth, textureHeight);
      textureHolder.push(t.image);
      promiseHolder.push(t.promise);
      texturesCountBuildingWalls++;
    }
  };
  for (let i = 0; i < wallCount * 0.5; i++) {
    const c = textureBuildingColors[Math.floor(Math.random() * textureBuildingColors.length)];
    createWalls(0, addColorVariance(c.cWa, 3), addColorVariance(c.cWi, 3), Math.random() * 0.3 + 0.1, 1, Math.floor(Math.random()) + 3, 0);
  }
  for (let i = 0; i < wallCount * 0.5; i++) {
    const c = textureBuildingColors[Math.floor(Math.random() * textureBuildingColors.length)];
    createWalls(1, addColorVariance(c.cWa, 3), addColorVariance(c.cWi, 3), Math.random() * 0.5 + 0.15, Math.floor(Math.random()) + 4, 1, 0);
  }
  for (let i = 0; i < wallCount; i++) {
    if (i % 2 === 0) await yieldToBrowser();
    const c = textureBuildingColors[Math.floor(Math.random() * textureBuildingColors.length)];
    const rX = Math.floor(Math.random() * 3) + 2;
    const rY = Math.floor(Math.random() * 2) + 3;
    const p = (rX + rY) * (Math.random() * 0.25 + 0.5);
    createWalls(2, addColorVariance(c.cWa, 3), addColorVariance(c.cWi, 3), Math.random() * 0.5 + 0.25, rX, rY, p);
  }
  for (let i = 0; i < wallCount; i++) {
    const c = textureBuildingColors[Math.floor(Math.random() * textureBuildingColors.length)];
    createWalls(5, addColorVariance(c.cWa, 3), addColorVariance(c.cWi, 3), 1, Math.round(Math.random() * 2) + 2, 2, 1);
  }
  state.texturesCountBuildingWalls = texturesCountBuildingWalls;

  await yieldToBrowser();
  let texturesCountStreets = 0;
  for (let i = 0; i < gridStreetTileTypes.length; i++) {
    if (i > 0 && i % 4 === 0) await yieldToBrowser();
    const t = createStreetTexture(gridStreetTileTypes[i], textureWidth, textureHeight);
    textureHolder.push(t.image);
    promiseHolder.push(t.promise);
    texturesCountStreets++;
  }
  state.texturesCountStreets = texturesCountStreets;

  await Promise.all(promiseHolder);

  await yieldToBrowser();
  state.textureArray = createTextureArray(gl, textureWidth, textureHeight, textureHolder.length);
  for (let i = 0; i < textureHolder.length; i++) {
    if (i > 0 && i % 20 === 0) await yieldToBrowser();
    loadTextureIntoArray(gl, state.textureArray, i, textureHolder[i], textureWidth, textureHeight);
  }
  gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
}

function projectPoint(v, center) {
  const scale = fov / (fov + v.z);
  v.x2d = v.x * scale + center.x;
  v.y2d = v.y * scale + center.y;
}

function drawFace(v0, v1, v2, v3, uvCoords, layer, webgl) {
  const drawTri = (a, b, c, u0, u1, u2) => {
    const baseIdx = webgl.vertices.length / 2;
    webgl.vertices.push(a.x2d, a.y2d, b.x2d, b.y2d, c.x2d, c.y2d);
    webgl.faces.push(baseIdx, baseIdx + 1, baseIdx + 2);
    webgl.uvs.push(u0.x, u0.y, u1.x, u1.y, u2.x, u2.y);
    webgl.layers.push(layer, layer, layer);
  };
  drawTri(v0, v1, v2, uvCoords[0], uvCoords[1], uvCoords[2]);
  drawTri(v2, v3, v0, uvCoords[2], uvCoords[3], uvCoords[0]);
}

function calcTileDepth(w, h, gridTileSize) {
  const width = w * gridTileSize;
  const height = h * gridTileSize;
  const areaFactor = w <= 1 && h <= 1 ? 0.15 : 0.05;
  const area = (width * height) * areaFactor;
  return Math.random() * area + area;
}

function addVertex(x, y, z = 0) {
  return { x, y, z, x2d: 0, y2d: 0 };
}

function addDot(x, y, rowIndex, colIndex) {
  const dot = addVertex(x, y);
  dot.rowIndex = rowIndex;
  dot.colIndex = colIndex;
  dot.neighborRight = dot.neighborBottom = dot.neighborRightBottom = dot.neighborLeft = dot.neighborTop = null;
  dot.isStreet = false;
  dot.inUse = false;
  dot.cubeIndex = -1;
  dot.depth = 0;
  return dot;
}

function areDotsAvailable(dotsHolder, dot, width, height, gridDotsPerRow, gridDotsPerColumn) {
  const { rowIndex, colIndex } = dot;
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      const nRow = (colIndex + i) % gridDotsPerColumn;
      const nCol = (rowIndex + j) % gridDotsPerRow;
      if (dotsHolder[nRow * gridDotsPerRow + nCol].inUse) return false;
    }
  }
  return true;
}

function setDotsInUse(dotsHolder, dot, width, height, buildingIndex, depth, gridDotsPerRow, gridDotsPerColumn) {
  const { rowIndex, colIndex } = dot;
  const dotsInUse = [];
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      const nRow = (colIndex + i) % gridDotsPerColumn;
      const nCol = (rowIndex + j) % gridDotsPerRow;
      const idx = nRow * gridDotsPerRow + nCol;
      dotsHolder[idx].inUse = true;
      dotsHolder[idx].cubeIndex = buildingIndex;
      dotsHolder[idx].depth = depth;
      dotsInUse.push(dotsHolder[idx]);
    }
  }
  return dotsInUse;
}

function getStreetTileIndex(dot) {
  const dT = dot.neighborTop, dB = dot.neighborBottom, dL = dot.neighborLeft, dR = dot.neighborRight;
  if (dT?.isStreet && dB?.isStreet && !dL?.isStreet && !dR?.isStreet) return 1;
  if (dL?.isStreet && dR?.isStreet && !dT?.isStreet && !dB?.isStreet) return 2;
  if (dL?.isStreet && dR?.isStreet && dT?.isStreet && dB?.isStreet) return 3;
  if (dT?.isStreet && dB?.isStreet && !dL?.isStreet && dR?.isStreet) return 4;
  if (dT?.isStreet && dB?.isStreet && dL?.isStreet && !dR?.isStreet) return 5;
  if (!dT?.isStreet && dB?.isStreet && dL?.isStreet && dR?.isStreet) return 6;
  if (dT?.isStreet && !dB?.isStreet && dL?.isStreet && dR?.isStreet) return 7;
  return 0;
}

function addTile(state, gridTileDots, width, height, type, depth = 0) {
  const s = state;
  const gts = s.gridTileSize;
  const tile = { dots: gridTileDots, w: width, h: height, type, width: width * gts, height: height * gts, depth: 0 };

  if (type === 'street') {
    const dot = tile.dots[0];
    const dTL = dot, dTR = dot.neighborRight, dBR = dot.neighborRightBottom, dBL = dot.neighborBottom;
    const streetTileIndex = getStreetTileIndex(dot);
    const uvCoordsIndex = s.texturesCountBuildingRoofs + s.texturesCountBuildingWalls + streetTileIndex;
    s.gridStreetHolder.push({
      face: [dTR, dTL, dBL, dBR],
      uvCoords: getUvCoordinates(1, 1),
      faceLayer: uvCoordsIndex
    });
  }

  if (type === 'building') {
    const uvCoordsIndexRoof = Math.floor(Math.random() * s.texturesCountBuildingRoofs / texturesBuildingRoofsTiles) * texturesBuildingRoofsTiles;
    const uvCoordsIndexWall = s.texturesCountBuildingRoofs + Math.floor(Math.random() * s.texturesCountBuildingWalls / 4) * 4;

    for (let i = 0; i < tile.dots.length; i++) {
      const dot = tile.dots[i];
      const cubeIndex = dot.cubeIndex;
      const depthVal = dot.depth;
      const dTL = dot, dTR = dot.neighborRight, dBR = dot.neighborRightBottom, dBL = dot.neighborBottom;
      const dT = dot.neighborTop, dB = dot.neighborBottom, dL = dot.neighborLeft, dR = dot.neighborRight;

      const topLeftFront = addVertex(dTL.x, dTL.y, dTL.z - depthVal);
      const topRightFront = addVertex(dTR.x, dTR.y, dTR.z - depthVal);
      const bottomRightFront = addVertex(dBR.x, dBR.y, dBR.z - depthVal);
      const bottomLeftFront = addVertex(dBL.x, dBL.y, dBL.z - depthVal);
      const cube = {
        baseDepth: depthVal,
        distance: Infinity,
        topLeftFront, topRightFront, bottomRightFront, bottomLeftFront,
        topLeftBack: dTL, topRightBack: dTR, bottomRightBack: dBR, bottomLeftBack: dBL,
        faces: [
          [topRightFront, topLeftFront, bottomLeftFront, bottomRightFront],
          [topLeftFront, dTL, dBL, bottomLeftFront],
          [topRightFront, dTR, dTL, topLeftFront],
          [bottomRightFront, dBR, dTR, topRightFront],
          [bottomLeftFront, dBL, dBR, bottomRightFront]
        ]
      };

      let indexRoof = 4;
      if (tile.w === 1 || tile.h === 1) indexRoof = 4;
      else if (dT?.cubeIndex !== cubeIndex && dB?.cubeIndex === cubeIndex && dL?.cubeIndex !== cubeIndex && dR?.cubeIndex === cubeIndex) indexRoof = 2;
      else if (dT?.cubeIndex !== cubeIndex && dB?.cubeIndex === cubeIndex && dL?.cubeIndex === cubeIndex && dR?.cubeIndex !== cubeIndex) indexRoof = 0;
      else if (dT?.cubeIndex === cubeIndex && dB?.cubeIndex !== cubeIndex && dL?.cubeIndex === cubeIndex && dR?.cubeIndex !== cubeIndex) indexRoof = 6;
      else if (dT?.cubeIndex === cubeIndex && dB?.cubeIndex !== cubeIndex && dL?.cubeIndex !== cubeIndex && dR?.cubeIndex === cubeIndex) indexRoof = 8;
      else if (dT?.cubeIndex !== cubeIndex && dB?.cubeIndex === cubeIndex && dL?.cubeIndex === cubeIndex && dR?.cubeIndex === cubeIndex) indexRoof = 1;
      else if (dT?.cubeIndex === cubeIndex && dB?.cubeIndex !== cubeIndex && dL?.cubeIndex === cubeIndex && dR?.cubeIndex === cubeIndex) indexRoof = 7;

      const repeatX = Math.round(depthVal / 3 / 10);
      cube.uvCoords = [getUvCoordinates(1, 1), getUvCoordinates(repeatX, 1), getUvCoordinates(repeatX, 1), getUvCoordinates(repeatX, 1), getUvCoordinates(repeatX, 1)];
      cube.faceLayers = [uvCoordsIndexRoof + indexRoof, uvCoordsIndexWall, uvCoordsIndexWall + 1, uvCoordsIndexWall + 2, uvCoordsIndexWall + 3];
      cube.hideFaces = [true, false, false, false, false];
      cube.drawFaces = [true, true, true, true, true];

      if (dT?.cubeIndex !== cubeIndex && dot.depth < dT?.depth) cube.hideFaces[2] = true;
      if (dR?.cubeIndex !== cubeIndex && dot.depth < dR?.depth) cube.hideFaces[3] = true;
      if (dB?.cubeIndex !== cubeIndex && dot.depth < dB?.depth) cube.hideFaces[4] = true;
      if (dL?.cubeIndex !== cubeIndex && dot.depth < dL?.depth) cube.hideFaces[1] = true;

      s.gridCubeHolder.push(cube);
    }
    s.gridTileHolder.push(tile);
  }
}

function sortCubes(state) {
  const s = state;
  const gtsh = s.gridTileSizeHalf;
  for (const cube of s.gridCubeHolder) {
    const cx = cube.topLeftBack.x + gtsh;
    const cy = cube.topLeftBack.y + gtsh;
    cube.distance = (0 - cx) ** 2 + (0 - cy) ** 2;
    cube.drawFaces[1] = !cube.hideFaces[1] && cx > 0;
    cube.drawFaces[3] = !cube.hideFaces[3] && cx <= 0;
    cube.drawFaces[2] = !cube.hideFaces[2] && cy > 0;
    cube.drawFaces[4] = !cube.hideFaces[4] && cy <= 0;
  }
  s.gridCubeHolder.sort((a, b) => b.distance - a.distance);
}

function isTileInsideRectangle(x, y, gridStartPositionX, gridEndPositionX, gridStartPositionY, gridEndPositionY, gridTileSize) {
  return x > gridStartPositionX + gridTileSize * 3 && x < gridEndPositionX - gridTileSize * 3 &&
    y > gridStartPositionY + gridTileSize * 3 && y < gridEndPositionY - gridTileSize * 3;
}

// --- Forest mode ---

function createPineTreeBranch(ctx, x, y, length, angle, colorRGB, needleCountFactor, needleLength) {
  const x2 = x + Math.cos(angle) * length;
  const y2 = y + Math.sin(angle) * length;
  colorRGB = addColorVariance(colorRGB, 4);
  const color = rgbToString(colorRGB.r, colorRGB.g, colorRGB.b);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  const needleCount = Math.floor(length / (needleCountFactor + Math.random() * 2));
  createPineTreeNeedles(ctx, x, y, x2, y2, color, needleCount, needleLength);
}

function createPineTreeNeedles(ctx, x1, y1, x2, y2, color, needleCount, needleLength) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const lineWidthFactor = Math.random() + 1;
  for (let i = 0; i < needleCount; i++) {
    const t = i / (needleCount - 1 || 1);
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    const baseNeedleLength = needleLength * (1 - t * 0.25);
    const length = baseNeedleLength + (Math.random() * 2 - 1);
    const xNeedleRight = x + Math.cos(angle + Math.PI / 4) * length;
    const yNeedleRight = y + Math.sin(angle + Math.PI / 4) * length;
    const xNeedleLeft = x + Math.cos(angle - Math.PI / 4) * length;
    const yNeedleLeft = y + Math.sin(angle - Math.PI / 4) * length;
    const lineWidth = lineWidthFactor * (1 - t * 0.55);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(xNeedleRight, yNeedleRight);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(xNeedleLeft, yNeedleLeft);
    ctx.stroke();
  }
}

function createPineTree(layers, maxSize, minSize, colors, needleCountFactor, needleLength) {
  const pineTree = { layers: [], size: maxSize, radius: maxSize * 0.5 };
  const colorBottom = addColorVariance(colors.bottom, 4);
  const colorTop = addColorVariance(colors.top, 7);
  for (let i = 0; i < layers; i++) {
    const canvasSize = maxSize;
    const canvasCenter = canvasSize * 0.5;
    const branchSize = maxSize - (i * ((maxSize - minSize) / layers)) - needleLength * 0.5;
    const radius = branchSize / 2;
    const circumference = 2 * Math.PI * radius;
    const maxBranchCount = Math.floor(circumference / needleLength);
    const minBranchCount = Math.max(maxBranchCount * 0.5, 10);
    const branchCount = maxBranchCount - Math.round(i * ((maxBranchCount - minBranchCount) / layers));
    const c = document.createElement('canvas');
    c.width = canvasSize;
    c.height = canvasSize;
    const context = c.getContext('2d');
    const t = i / layers;
    const r = lerp(colorBottom.r, colorTop.r, t);
    const g = lerp(colorBottom.g, colorTop.g, t);
    const b = lerp(colorBottom.b, colorTop.b, t);
    const colorRGB = addColorVariance({ r, g, b }, 2);
    const angleStart = Math.PI * 2 * Math.random() + i;
    for (let j = 0; j < branchCount; j++) {
      const angle = (2 * Math.PI / branchCount) * j + angleStart;
      const branchLength = branchSize * 0.5 - Math.random() * (branchSize * 0.05);
      createPineTreeBranch(context, canvasCenter, canvasCenter, branchLength, angle, colorRGB, needleCountFactor, needleLength);
    }
    if (i < layers - 1) {
      const gradient = context.createRadialGradient(canvasCenter, canvasCenter, branchSize * 0.015, canvasCenter, canvasCenter, branchSize * 0.35);
      gradient.addColorStop(0, `rgba(0, 0, 0, ${1 - i / layers})`);
      gradient.addColorStop(1, '#00000000');
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvasSize, canvasSize);
    }
    const image = new Image();
    image.src = c.toDataURL();
    pineTree.layers.push(image);
  }
  return pineTree;
}

async function createPineTrees(state) {
  state.pineTreeSourceHolder = [];
  for (let i = 0; i < pineTreesTotal; i++) {
    if (i > 0 && i % 2 === 0) await yieldToBrowser();
    const layers = Math.ceil(Math.random() * (pineTreesMaxLayers * 0.5) + pineTreesMaxLayers * 0.5);
    const maxSize = Math.round(Math.random() * (pineTreeMaximumSize * 0.55) + pineTreeMaximumSize * 0.45);
    const colors = pineTreeColors[i % pineTreeColors.length];
    state.pineTreeSourceHolder.push(createPineTree(layers, maxSize, 4, colors, 2, 12));
  }
}

async function addPineTrees(state) {
  const s = state;
  s.gridTileSize = pineTreeMaximumSize;
  const gridMax = 1;
  s.gridDotsPerRow = Math.ceil((s.border.right - s.border.left) / s.gridTileSize) + (gridMax * 2);
  s.gridDotsPerColumn = Math.ceil((s.border.bottom - s.border.top) / s.gridTileSize) + (gridMax * 2);
  s.gridWidth = s.gridDotsPerRow * s.gridTileSize;
  s.gridHeight = s.gridDotsPerColumn * s.gridTileSize;
  s.gridStartPositionX = s.gridWidth * -0.5;
  s.gridStartPositionY = s.gridHeight * -0.5;
  s.gridEndPositionX = s.gridStartPositionX + s.gridWidth;
  s.gridEndPositionY = s.gridStartPositionY + s.gridHeight;

  const newHolder = [];
  const treeCount = 1000;
  for (let i = 0; i < treeCount; i++) {
    if (i > 0 && i % 30 === 0) await yieldToBrowser();
    const source = s.pineTreeSourceHolder[Math.floor(Math.random() * s.pineTreeSourceHolder.length)];
    let overlapping = true;
    let attempts = 0;
    let newTree = null;
    do {
      overlapping = false;
      const x = s.gridStartPositionX + Math.random() * (s.gridWidth - 2 * source.radius) + source.radius;
      const y = s.gridStartPositionY + Math.random() * (s.gridHeight - 2 * source.radius) + source.radius;
      newTree = { x, y, radius: source.radius };
      for (const t of newHolder) {
        const dx = newTree.x - t.x;
        const dy = newTree.y - t.y;
        const minDist = newTree.radius + t.radius + pineTreeMinSpacing;
        if (dx * dx + dy * dy < minDist * minDist) {
          overlapping = true;
          break;
        }
      }
      attempts++;
      if (attempts > 1000) break;
    } while (overlapping);

    if (!overlapping && newHolder.length < pineTreesMax) {
      newHolder.push({
        x: newTree.x, y: newTree.y, z: Math.random() * (pineTreeLayerDistance * 2),
        size: source.size, radius: source.radius, layers: source.layers, distance: 0
      });
    }
  }
  s.pineTreeHolder = newHolder;
}

function sortForestTrees(state) {
  for (const t of state.pineTreeHolder) {
    t.distance = (0 - t.x) ** 2 + (0 - t.y) ** 2;
  }
  state.pineTreeHolder.sort((a, b) => b.distance - a.distance);
}

function addGrid(state) {
  const s = state;
  const border = s.border;
  s.gridTileHolder = [];
  s.gridCubeHolder = [];
  s.gridStreetHolder = [];
  s.gridTileSize = dotsDiameter + dotsDistance;
  s.gridTileSizeHalf = s.gridTileSize * 0.5;
  s.gridDotsPerRow = Math.ceil((border.right - border.left) / s.gridTileSize) + (gridMaxTileSize * 2);
  s.gridDotsPerColumn = Math.ceil((border.bottom - border.top) / s.gridTileSize) + (gridMaxTileSize * 2);
  s.gridWidth = s.gridDotsPerRow * s.gridTileSize;
  s.gridHeight = s.gridDotsPerColumn * s.gridTileSize;
  s.gridStartPositionX = s.gridWidth * -0.5;
  s.gridStartPositionY = s.gridHeight * -0.5;
  s.gridEndPositionX = s.gridStartPositionX + s.gridWidth;
  s.gridEndPositionY = s.gridStartPositionY + s.gridHeight;

  const streetsH = Math.floor(s.gridDotsPerRow / 10);
  const streetsV = Math.floor(s.gridDotsPerColumn / 10);
  const streetsCountHorizontal = Math.floor(Math.random() * (streetsH * 0.75) + streetsH * 0.5) + 1;
  const streetsCountVertical = Math.floor(Math.random() * (streetsV * 0.75) + streetsV * 0.5) + 1;
  const streetRows = getRandomUniqueIndices(s.gridDotsPerRow, streetsCountHorizontal);
  const streetColumns = getRandomUniqueIndices(s.gridDotsPerColumn, streetsCountVertical);

  s.dotsHolder = [];
  for (let i = 0; i < s.gridDotsPerColumn; i++) {
    for (let j = 0; j < s.gridDotsPerRow; j++) {
      const x = s.gridStartPositionX + j * (dotsDistance + dotsDiameter);
      const y = s.gridStartPositionY + i * (dotsDistance + dotsDiameter);
      s.dotsHolder.push(addDot(x, y, j, i));
    }
  }

  for (let i = 0; i < s.gridDotsPerColumn; i++) {
    for (let j = 0; j < s.gridDotsPerRow; j++) {
      const dot = s.dotsHolder[i * s.gridDotsPerRow + j];
      dot.neighborRight = s.dotsHolder[(j + 1) % s.gridDotsPerRow + i * s.gridDotsPerRow];
      dot.neighborBottom = s.dotsHolder[((i + 1) % s.gridDotsPerColumn) * s.gridDotsPerRow + j];
      dot.neighborRightBottom = s.dotsHolder[((i + 1) % s.gridDotsPerColumn) * s.gridDotsPerRow + (j + 1) % s.gridDotsPerRow];
      dot.neighborLeft = s.dotsHolder[(j - 1 + s.gridDotsPerRow) % s.gridDotsPerRow + i * s.gridDotsPerRow];
      dot.neighborTop = s.dotsHolder[((i - 1 + s.gridDotsPerColumn) % s.gridDotsPerColumn) * s.gridDotsPerRow + j];
    }
  }

  for (let i = 0; i < s.gridDotsPerColumn; i++) {
    for (let j = 0; j < s.gridDotsPerRow; j++) {
      const dot = s.dotsHolder[i * s.gridDotsPerRow + j];
      if (streetColumns.includes(i) || streetRows.includes(j)) {
        dot.isStreet = true;
        dot.inUse = true;
      }
    }
  }

  for (const dot of s.dotsHolder) {
    if (dot.isStreet) addTile(s, [dot], 1, 1, 'street');
  }

  let buildingCounter = 0;
  const buildingHolder = [];
  for (let i = 0; i < gridBuildingTileSizes.length; i++) {
    const gbts = gridBuildingTileSizes[i];
    if (i < gridBuildingTileSizes.length - 1) {
      const count = Math.floor((s.gridDotsPerRow * s.gridDotsPerColumn) / (gridBuildingTileSizes.length - i)) * ((i + 1) * 0.5) * (gridBuildingTileSizes.length * 0.5 / 100);
      const indices = arrayShuffle([...Array(s.dotsHolder.length).keys()]).slice(0, count);
      for (const idx of indices) {
        const dot = s.dotsHolder[idx];
        if (areDotsAvailable(s.dotsHolder, dot, gbts.x, gbts.y, s.gridDotsPerRow, s.gridDotsPerColumn)) {
          buildingCounter++;
          dot.inUse = true;
          dot.cubeIndex = buildingCounter;
          dot.depth = calcTileDepth(gbts.x, gbts.y, s.gridTileSize);
          buildingHolder.push({
            dots: setDotsInUse(s.dotsHolder, dot, gbts.x, gbts.y, buildingCounter, dot.depth, s.gridDotsPerRow, s.gridDotsPerColumn),
            width: gbts.x, height: gbts.y, depth: dot.depth
          });
        }
      }
    } else {
      for (const dot of s.dotsHolder) {
        if (!dot.inUse) {
          buildingCounter++;
          dot.inUse = true;
          dot.cubeIndex = buildingCounter;
          dot.depth = calcTileDepth(1, 1, s.gridTileSize);
          buildingHolder.push({ dots: [dot], width: 1, height: 1, depth: dot.depth });
        }
      }
    }
  }

  for (const b of buildingHolder) {
    addTile(s, b.dots, b.width, b.height, 'building', b.depth);
  }
  sortCubes(s);
}

function moveItems(items, dx, dy, gridWidth, gridHeight, startX, endX, startY, endY) {
  for (const it of items) {
    it.x += dx;
    it.y += dy;
    if (it.x > endX) it.x -= gridWidth;
    if (it.x < startX) it.x += gridWidth;
    if (it.y > endY) it.y -= gridHeight;
    if (it.y < startY) it.y += gridHeight;
  }
}

async function initCity(container, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const gl = canvas.getContext('webgl2') || canvas.getContext('experimental-webgl2');
  if (!gl) return null;

  gl.enable(gl.SCISSOR_TEST);
  const shaderProgram = createShaderProgram(gl, vertexCode, fragmentCode);
  const buffers = {
    positionAttributeLocation: gl.getAttribLocation(shaderProgram, 'a_position'),
    texcoordAttributeLocation: gl.getAttribLocation(shaderProgram, 'a_texcoord'),
    resolutionUniformLocation: gl.getUniformLocation(shaderProgram, 'u_resolution'),
    layerAttributeLocation: gl.getAttribLocation(shaderProgram, 'a_layer')
  };
  gl.enableVertexAttribArray(buffers.positionAttributeLocation);
  gl.enableVertexAttribArray(buffers.texcoordAttributeLocation);
  gl.enableVertexAttribArray(buffers.layerAttributeLocation);

  const cityState = { gl, canvas, shaderProgram, buffers, border: { left: 1, top: 1, right: w, bottom: h } };
  await createTextures(gl, cityState);
  cityState.buffers.textureUniformLocation = gl.getUniformLocation(shaderProgram, 'u_textureArray');
  addGrid(cityState);
  container.appendChild(canvas);
  return cityState;
}

function ensureCanvasOrder(container, mode, webglCanvas, engineCanvas) {
  const target = mode === 'city' ? webglCanvas : engineCanvas;
  if (container.lastElementChild !== target) container.appendChild(target);
}

async function initForest(w, h) {
  const forestState = { border: { left: 1, top: 1, right: w, bottom: h }, lastW: w, lastH: h };
  await createPineTrees(forestState);
  await addPineTrees(forestState);
  return forestState;
}

function updatePointer(shared) {
  const targetX = shared.pointerInitialPos.x + Math.sin(Date.now() * 0.001) * 50;
  const targetY = shared.pointerInitialPos.y + Math.cos(Date.now() * 0.0008) * 50;
  shared.pointer.x += (targetX - shared.pointer.x) / 100;
  shared.pointer.y += (targetY - shared.pointer.y) / 100;
}

function getAudioHeightScale(audio) {
  if (!audio) return 0;
  return Math.min(1.5, ((audio.bass ?? 0) * 0.7 + (audio.kick ?? 0) * 0.6 + (audio.mid ?? 0) * 0.25) * 1.2);
}

function getAudioHeightScaleForest(audio) {
  if (!audio) return 0;
  return Math.min(1.8, ((audio.bass ?? 0) * 0.7 + (audio.kick ?? 0) * 0.6 + (audio.mid ?? 0) * 0.25) * 1.4);
}

function drawCity(city, shared, options, audio) {
  const gl = city.gl;
  const w = shared.w;
  const h = shared.h;
  const center = shared.center;
  const speed = (options?.speed ?? 1) * 0.025;
  const dx = (shared.pointer.x - center.x) * -speed;
  const dy = (shared.pointer.y - center.y) * -speed;
  const heightScale = getAudioHeightScale(audio);

  moveItems(city.dotsHolder, dx, dy, city.gridWidth, city.gridHeight, city.gridStartPositionX, city.gridEndPositionX, city.gridStartPositionY, city.gridEndPositionY);

  gl.viewport(0, 0, w, h);
  gl.scissor(shared.border.left, shared.border.top, shared.border.right - shared.border.left, shared.border.bottom - shared.border.top);

  const webgl = { vertices: [], faces: [], uvs: [], layers: [] };
  const inside = (x, y) => isTileInsideRectangle(x, y, city.gridStartPositionX, city.gridEndPositionX, city.gridStartPositionY, city.gridEndPositionY, city.gridTileSize);

  for (const street of city.gridStreetHolder) {
    const v0 = street.face[0], v1 = street.face[1];
    if (inside(v0.x, v1.y)) {
      const v2 = street.face[2], v3 = street.face[3];
      projectPoint(v0, center);
      projectPoint(v1, center);
      projectPoint(v2, center);
      projectPoint(v3, center);
      drawFace(v0, v1, v2, v3, street.uvCoords, street.faceLayer, webgl);
    }
  }

  sortCubes(city);

  for (const cube of city.gridCubeHolder) {
    if (!inside(cube.topLeftBack.x, cube.topLeftBack.y)) continue;
    const d = cube.baseDepth * (1 + heightScale);
    cube.topLeftFront.x = cube.topLeftBack.x;
    cube.topLeftFront.y = cube.topLeftBack.y;
    cube.topLeftFront.z = cube.topLeftBack.z - d;
    cube.topRightFront.x = cube.topRightBack.x;
    cube.topRightFront.y = cube.topRightBack.y;
    cube.topRightFront.z = cube.topRightBack.z - d;
    cube.bottomRightFront.x = cube.bottomRightBack.x;
    cube.bottomRightFront.y = cube.bottomRightBack.y;
    cube.bottomRightFront.z = cube.bottomRightBack.z - d;
    cube.bottomLeftFront.x = cube.bottomLeftBack.x;
    cube.bottomLeftFront.y = cube.bottomLeftBack.y;
    cube.bottomLeftFront.z = cube.bottomLeftBack.z - d;

    for (let j = cube.faces.length - 1; j >= 0; j--) {
      if (!cube.drawFaces[j]) continue;
      const face = cube.faces[j];
      projectPoint(face[0], center);
      projectPoint(face[1], center);
      projectPoint(face[2], center);
      projectPoint(face[3], center);
      drawFace(face[0], face[1], face[2], face[3], cube.uvCoords[j], cube.faceLayers[j], webgl);
    }
  }

  if (webgl.vertices.length === 0) return;

  gl.useProgram(city.shaderProgram);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, city.textureArray);
  gl.uniform1i(city.buffers.textureUniformLocation, 0);

  const posBuf = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(webgl.vertices), gl.STATIC_DRAW);
  const uvBuf = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(webgl.uvs), gl.STATIC_DRAW);
  const layerBuf = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(webgl.layers), gl.STATIC_DRAW);
  const idxBuf = createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(webgl.faces), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.vertexAttribPointer(city.buffers.positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
  gl.vertexAttribPointer(city.buffers.texcoordAttributeLocation, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, layerBuf);
  gl.vertexAttribPointer(city.buffers.layerAttributeLocation, 1, gl.FLOAT, false, 0, 0);
  gl.uniform2f(city.buffers.resolutionUniformLocation, w, h);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
  gl.drawElements(gl.TRIANGLES, webgl.faces.length, gl.UNSIGNED_INT, 0);
}

function drawForest(forest, shared, ctx, options, audio) {
  const w = shared.w;
  const h = shared.h;
  const center = shared.center;
  const speed = (options?.speed ?? 1) * 0.025;
  const dx = (shared.pointer.x - center.x) * -speed;
  const dy = (shared.pointer.y - center.y) * -speed;
  const heightScale = getAudioHeightScaleForest(audio);

  moveItems(forest.pineTreeHolder, dx, dy, forest.gridWidth, forest.gridHeight, forest.gridStartPositionX, forest.gridEndPositionX, forest.gridStartPositionY, forest.gridEndPositionY);
  sortForestTrees(forest);

  ctx.clearRect(0, 0, w, h);

  for (const pineTree of forest.pineTreeHolder) {
    const inside = pineTree.x > forest.gridStartPositionX + pineTree.radius &&
      pineTree.x < forest.gridEndPositionX - pineTree.radius &&
      pineTree.y > forest.gridStartPositionY + pineTree.radius &&
      pineTree.y < forest.gridEndPositionY - pineTree.radius;

    if (inside) {
      const sizeScale = 1 + heightScale;
      const m = pineTree.layers.length;
      for (let j = 0; j < m; j++) {
        const layer = pineTree.layers[j];
        const z = m - j * pineTreeLayerDistance + pineTree.z;
        const scale = FOREST_FOV / (FOREST_FOV + z);
        const x2d = pineTree.x * scale + center.x;
        const y2d = pineTree.y * scale + center.y;
        const size = pineTree.size * sizeScale;
        const x = x2d - pineTree.radius * sizeScale;
        const y = y2d - pineTree.radius * sizeScale;
        if (layer.complete) ctx.drawImage(layer, 0, 0, pineTree.size, pineTree.size, x, y, size, size);
      }
    }
  }
}

export function render(canvas, ctx, audio, container, options = {}) {
  const state = container.visualizerState;
  const w = canvas.width;
  const h = canvas.height;
  if (!w || !h) return;

  const mode = options.mode || 'city';

  if (!state.initialized) {
    state.initialized = true;
    state.shared = {
      w, h, center: { x: w / 2, y: h / 2 },
      border: { left: 1, top: 1, right: w, bottom: h },
      pointer: { x: w / 2 + 25, y: h / 2 - 25 },
      pointerInitialPos: { x: w / 2 + 25, y: h / 2 - 25 }
    };
    state.initPromise = Promise.all([
      initCity(container, w, h),
      initForest(w, h)
    ]).then(([city, forest]) => {
      state.city = city;
      state.forest = forest;
    });
  }

  if (!state.city || !state.forest) return;

  const shared = state.shared;
  shared.w = w;
  shared.h = h;
  shared.center = { x: w / 2, y: h / 2 };
  shared.border = { left: 1, top: 1, right: w, bottom: h };

  ensureCanvasOrder(container, mode, state.city.canvas, canvas);

  updatePointer(shared);

  if (mode === 'city') {
    if (state.city.canvas.width !== w || state.city.canvas.height !== h) {
      state.city.canvas.width = w;
      state.city.canvas.height = h;
      state.city.border = shared.border;
      addGrid(state.city);
    }
    drawCity(state.city, shared, options, audio);
  } else {
    if (state.forest.lastW !== w || state.forest.lastH !== h) {
      state.forest.border = shared.border;
      state.forest.lastW = w;
      state.forest.lastH = h;
      addPineTrees(state.forest).catch(() => {});
    }
    drawForest(state.forest, shared, ctx, options, audio);
  }
}

export function cleanup(canvas, container, slot) {
  const state = container.visualizerState;
  if (!state?.initialized) return;
  if (state.city?.canvas?.parentElement) container.removeChild(state.city.canvas);
  if (!container.contains(canvas)) container.appendChild(canvas);
  Object.keys(state).forEach((k) => delete state[k]);
}
