/**
 * OUTSIDER.EXE — a deliberately small WebGL renderer.
 *
 * No 3D library, no build step. Static tiles, wall faces, pool surfaces,
 * ceiling lights and the final door are baked into a handful of interleaved
 * buffers. The frame loop only updates the camera, fog and the water shader.
 *
 * The slightly soft, low-resolution look comes from rendering below the CSS
 * size and letting the edge lines stay simple. There are no shadows, models or
 * post effects to maintain.
 */
import { CELL, WALL_INSIGHTS } from "./level.js";

const SCALE = 0.82;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`OUTSIDER shader: ${log}`);
  }
  return shader;
}

function program(gl) {
  const vs = compile(
    gl,
    gl.VERTEX_SHADER,
    `
      precision highp float;
      attribute vec3 aPosition;
      attribute vec3 aNormal;
      attribute vec2 aUv;
      uniform mat4 uProjection;
      uniform mat4 uView;
      uniform vec3 uCamera;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec2 vUv;
      void main() {
        vWorld = aPosition;
        vNormal = aNormal;
        vUv = aUv;
        gl_Position = uProjection * uView * vec4(aPosition, 1.0);
      }
    `,
  );
  const fs = compile(
    gl,
    gl.FRAGMENT_SHADER,
    `
      precision highp float;
      uniform sampler2D uTexture;
      uniform vec3 uTint;
      uniform vec3 uCamera;
      uniform vec3 uFogColor;
      uniform vec3 uLightDir;
      uniform vec3 uWaterDeep;
      uniform vec3 uWaterShallow;
      uniform vec3 uWaterSky;
      uniform float uAmbient;
      uniform float uEmissive;
      uniform float uWater;
      uniform float uWaterSpec;
      uniform float uDecal;
      uniform float uTime;
      uniform float uFogNear;
      uniform float uFogFar;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec2 vUv;

      void main() {
        vec3 color;
        float alpha = 1.0;
        if (uWater > 0.5) {
          vec2 p = vWorld.xz;
          float a = sin(p.x * 1.17 + uTime * 0.63);
          float b = sin(p.y * 1.43 - uTime * 0.44);
          float c = sin((p.x + p.y) * 0.73 + uTime * 0.29);
          float ripple = a + b + c;
          vec3 normal = normalize(vec3(
            (a * 0.55 + c * 0.25) * 0.045,
            1.0,
            (b * 0.55 - c * 0.2) * 0.045
          ));
          vec3 viewDir = normalize(uCamera - vWorld);
          float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 2.2);
          float mixValue = clamp(0.42 + ripple * 0.085, 0.2, 0.75);
          color = mix(uWaterDeep, uWaterShallow, mixValue);
          color = mix(color, uWaterSky, fresnel * 0.52);
          vec3 reflected = reflect(-normalize(uLightDir), normal);
          float spec = pow(max(dot(reflected, viewDir), 0.0), 38.0);
          color += vec3(spec) * uWaterSpec * (0.75 + 0.25 * c);
        } else {
          vec4 texel = texture2D(uTexture, vUv);
          float diffuse = max(dot(normalize(vNormal), normalize(uLightDir)), 0.0);
          float light = uEmissive > 0.5 ? 1.0 : (uAmbient + diffuse * 0.34);
          color = texel.rgb * uTint * light;
          // Decals are cut out by their own canvas alpha; solid surfaces stay
          // fully opaque exactly as before.
          alpha = uDecal > 0.5 ? texel.a : 1.0;
        }

        float dist = length(vWorld - uCamera);
        float fog = smoothstep(uFogNear, uFogFar, dist);
        if (uEmissive > 0.5) fog *= 0.52;
        color = mix(color, uFogColor, clamp(fog, 0.0, 0.94));
        if (uDecal > 0.5) alpha *= 1.0 - clamp(fog, 0.0, 0.94);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  );
  const p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p);
    gl.deleteProgram(p);
    throw new Error(`OUTSIDER program: ${log}`);
  }
  return p;
}

function canvasTexture(gl, canvas, { repeat = false } = {}) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  if (repeat) {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  } else {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.generateMipmap(gl.TEXTURE_2D);
  return tex;
}

/** A 256 px tile sheet: four by four pale stone tiles with a thin grout. */
function tileCanvas() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#d9dedb";
  ctx.fillRect(0, 0, size, size);
  const n = 4;
  const step = size / n;
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const shade = 246 + ((x * 7 + y * 11) % 4) - 2;
      ctx.fillStyle = `rgb(${shade}, ${shade + 1}, ${shade - 3})`;
      ctx.fillRect(x * step + 1.4, y * step + 1.4, step - 2.8, step - 2.8);
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.fillRect(x * step + 2, y * step + 2, step - 4, 2);
      ctx.fillStyle = "rgba(80,100,96,0.055)";
      ctx.fillRect(x * step + 2, y * step + step - 5, step - 4, 3);
    }
  }
  // Faint mineral speckle and a few damp clouds keep the surface from feeling
  // like a single flat colour at close range.
  for (let i = 0; i < 380; i += 1) {
    const x = (i * 73) % size;
    const y = (i * 151) % size;
    ctx.fillStyle = i % 5 === 0 ? "rgba(82,105,99,0.09)" : "rgba(255,255,255,0.11)";
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.fillStyle = "rgba(103,130,123,0.035)";
  ctx.beginPath();
  ctx.ellipse(62, 178, 40, 16, 0.4, 0, Math.PI * 2);
  ctx.ellipse(202, 70, 27, 12, -0.3, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

/** The exit door: a lit amber seam with a small EXIT plate. */
function doorCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  const bg = ctx.createLinearGradient(0, 0, 0, 512);
  bg.addColorStop(0, "#252722");
  bg.addColorStop(1, "#090b0b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 512);

  ctx.strokeStyle = "#645c3b";
  ctx.lineWidth = 9;
  ctx.strokeRect(20, 20, 216, 472);

  const glow = ctx.createLinearGradient(0, 0, 0, 380);
  glow.addColorStop(0, "rgba(247,226,151,0.78)");
  glow.addColorStop(0.55, "rgba(214,179,88,0.35)");
  glow.addColorStop(1, "rgba(159,120,40,0.05)");
  ctx.fillStyle = glow;
  ctx.fillRect(42, 58, 172, 330);
  ctx.fillStyle = "rgba(255,247,205,0.82)";
  ctx.fillRect(118, 70, 20, 410);
  ctx.fillStyle = "rgba(255,250,224,0.2)";
  ctx.fillRect(54, 60, 148, 8);

  ctx.fillStyle = "#efe4b0";
  ctx.fillRect(51, 33, 154, 39);
  ctx.fillStyle = "#211f16";
  ctx.font = "bold 27px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("EXIT", 128, 53);

  ctx.strokeStyle = "rgba(237,222,166,0.28)";
  ctx.lineWidth = 2;
  ctx.strokeRect(42, 82, 172, 390);
  return canvas;
}

/* ------------------------------------------------------------ wall damage */

const DECAL_W = 512;
const DECAL_H = 256;
const DECAL_UNIT = 16;

function makeHashRandom(seed) {
  let value = seed >>> 0 || 0x9e3779b9;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashFace(face) {
  const text = `${face.x}:${face.z}:${face.side}`;
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function newDecalCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = DECAL_W;
  canvas.height = DECAL_H;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, DECAL_W, DECAL_H);
  return { canvas, ctx };
}

/** Align to the same block grid as the desktop corruption. */
const snap = (value) => Math.round(value / DECAL_UNIT) * DECAL_UNIT;

/**
 * The message itself, painted as if stencilled onto the tiles: hard monospace
 * letters, slight per-letter misalignment, and (for the damaged ones) opaque
 * chunks bitten out of the words and the end of the last line.
 */
function inscriptionCanvas(text, { corrupt = false, dark = false } = {}) {
  const { canvas, ctx } = newDecalCanvas();
  const ink = dark ? "rgba(219, 241, 235, 0.9)" : "rgba(25, 37, 33, 0.92)";
  const blocks = dark
    ? ["#0a1614", "#081110", "#16302c", "#3f6b62"]
    : ["#1a2825", "#0d1b18", "#274a43", "#0a1412"];

  ctx.font = "bold 40px 'Lucida Console', 'DejaVu Sans Mono', monospace";
  ctx.textBaseline = "middle";
  ctx.fillStyle = ink;

  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > DECAL_W - 56) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  const lineHeight = 56;
  const startY = DECAL_H / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((value, index) => {
    let x = 28;
    const y = startY + index * lineHeight;
    for (const ch of value) {
      const wobble = ((ch.charCodeAt(0) * 7 + index * 13) % 5) - 2;
      ctx.fillStyle = ink;
      ctx.fillText(ch, x, y + wobble * 0.7);
      x += ctx.measureText(ch).width + 1.2;
    }
  });

  if (corrupt) {
    const rnd = makeHashRandom(hashFace({ x: text, z: lines.length, side: "ink" }));
    for (let index = 0; index < 8; index += 1) {
      const width = snap(24 + rnd() * 96);
      const height = snap(12 + rnd() * 26);
      ctx.globalAlpha = 0.94;
      ctx.fillStyle = blocks[index % blocks.length];
      ctx.fillRect(snap(rnd() * (DECAL_W - width)), snap(rnd() * (DECAL_H - height)), width, height);
    }
    // The last line simply stops: damaged surface, not a complete sentence.
    ctx.globalAlpha = 1;
    ctx.fillStyle = blocks[0];
    ctx.fillRect(
      DECAL_W - snap(60 + rnd() * 90),
      snap(startY + (lines.length - 1) * lineHeight - 26),
      DECAL_W,
      snap(46),
    );
  }

  return canvas;
}

/**
 * A damaged patch of wall: opaque blocky rectangles on the same grid as the
 * desktop traces, with notches and a few bright pixels where the data leaks.
 */
function wallCorruptionCanvas(seed) {
  const { canvas, ctx } = newDecalCanvas();
  const rnd = makeHashRandom(seed);
  const cols = DECAL_W / DECAL_UNIT;
  const rows = DECAL_H / DECAL_UNIT;
  const cells = new Map();
  const colors = ["#071917", "#04100e", "#164a44", "#0d2b27", "#2f8b81"];

  const chunks = 5 + Math.floor(rnd() * 6);
  for (let index = 0; index < chunks; index += 1) {
    const width = 2 + Math.floor(rnd() * 7);
    const height = 1 + Math.floor(rnd() * 5);
    const x0 = Math.floor(rnd() * Math.max(1, cols - width));
    const y0 = Math.floor(rnd() * Math.max(1, rows - height));
    for (let y = y0; y < y0 + height; y += 1) {
      for (let x = x0; x < x0 + width; x += 1) {
        if (rnd() < 0.18) continue;
        const roll = rnd();
        const color =
          roll > 0.93 ? "#7bd2cb" : roll > 0.82 ? "#2f8b81" : colors[Math.floor(rnd() * colors.length)];
        cells.set(y * cols + x, color);
      }
    }
  }

  for (const [index, color] of cells) {
    ctx.fillStyle = color;
    ctx.fillRect(
      (index % cols) * DECAL_UNIT,
      Math.floor(index / cols) * DECAL_UNIT,
      DECAL_UNIT,
      DECAL_UNIT,
    );
  }
  return canvas;
}

function solidTexture(gl) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([255, 255, 255, 255]),
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return tex;
}

function perspective(out, fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

function normalize(x, y, z) {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

function lookAt(out, eye, forward) {
  const zAxis = normalize(-forward[0], -forward[1], -forward[2]);
  // cross(worldUp, zAxis), with worldUp = (0, 1, 0).
  const xAxis = normalize(zAxis[2], 0, -zAxis[0]);
  const yAxis = [
    zAxis[1] * xAxis[2] - zAxis[2] * xAxis[1],
    zAxis[2] * xAxis[0] - zAxis[0] * xAxis[2],
    zAxis[0] * xAxis[1] - zAxis[1] * xAxis[0],
  ];
  out[0] = xAxis[0];
  out[1] = yAxis[0];
  out[2] = zAxis[0];
  out[3] = 0;
  out[4] = xAxis[1];
  out[5] = yAxis[1];
  out[6] = zAxis[1];
  out[7] = 0;
  out[8] = xAxis[2];
  out[9] = yAxis[2];
  out[10] = zAxis[2];
  out[11] = 0;
  out[12] = -(xAxis[0] * eye[0] + xAxis[1] * eye[1] + xAxis[2] * eye[2]);
  out[13] = -(yAxis[0] * eye[0] + yAxis[1] * eye[1] + yAxis[2] * eye[2]);
  out[14] = -(zAxis[0] * eye[0] + zAxis[1] * eye[1] + zAxis[2] * eye[2]);
  out[15] = 1;
  return out;
}

function makeGroup(name, options) {
  return {
    name,
    data: [],
    mode: options.mode || "tile",
    tint: options.tint || [1, 1, 1],
    ambient: options.ambient ?? 0.68,
    emissive: Boolean(options.emissive),
    water: Boolean(options.water),
    fogNear: options.fogNear ?? 10,
    fogFar: options.fogFar ?? 78,
    ...options,
  };
}

export function createMazeRenderer(canvas, level) {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: true,
    depth: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false,
  });
  if (!gl) throw new Error("WebGL is not available in this browser.");

  const prog = program(gl);
  const attributes = {
    position: gl.getAttribLocation(prog, "aPosition"),
    normal: gl.getAttribLocation(prog, "aNormal"),
    uv: gl.getAttribLocation(prog, "aUv"),
  };
  const uniforms = {};
  for (const name of [
    "uProjection",
    "uView",
    "uCamera",
    "uTexture",
    "uTint",
    "uFogColor",
    "uFogNear",
    "uFogFar",
    "uLightDir",
    "uAmbient",
    "uEmissive",
    "uWater",
    "uDecal",
    "uWaterDeep",
    "uWaterShallow",
    "uWaterSky",
    "uWaterSpec",
    "uTime",
  ]) {
    uniforms[name] = gl.getUniformLocation(prog, name);
  }

  const textures = {
    tile: canvasTexture(gl, tileCanvas(), { repeat: true }),
    door: canvasTexture(gl, doorCanvas()),
    white: solidTexture(gl),
  };

  const groups = {
    brightWall: makeGroup("brightWall", {
      tint: [0.97, 0.98, 0.95],
      ambient: 0.7,
    }),
    brightFloor: makeGroup("brightFloor", {
      tint: [0.91, 0.94, 0.91],
      ambient: 0.75,
    }),
    brightCeil: makeGroup("brightCeil", {
      tint: [0.95, 0.97, 0.94],
      ambient: 0.73,
    }),
    trim: makeGroup("trim", {
      tint: [0.82, 0.88, 0.86],
      ambient: 0.72,
    }),
    brightWater: makeGroup("brightWater", {
      water: true,
      fogNear: 9,
      fogFar: 82,
    }),
    darkWall: makeGroup("darkWall", {
      tint: [0.26, 0.32, 0.34],
      ambient: 0.46,
    }),
    darkFloor: makeGroup("darkFloor", {
      tint: [0.42, 0.46, 0.46],
      ambient: 0.42,
    }),
    darkCeil: makeGroup("darkCeil", {
      tint: [0.16, 0.2, 0.21],
      ambient: 0.34,
    }),
    bridge: makeGroup("bridge", {
      tint: [0.55, 0.59, 0.58],
      ambient: 0.44,
    }),
    darkWater: makeGroup("darkWater", {
      water: true,
      fogNear: 7,
      fogFar: 62,
    }),
    door: makeGroup("door", {
      mode: "door",
      emissive: true,
      tint: [1, 1, 1],
      fogNear: 7,
      fogFar: 72,
    }),
    glow: makeGroup("glow", {
      mode: "white",
      emissive: true,
      tint: [1, 0.99, 0.92],
      fogNear: 12,
      fogFar: 85,
    }),
    darkGlow: makeGroup("darkGlow", {
      mode: "white",
      emissive: true,
      tint: [0.93, 0.8, 0.51],
      fogNear: 7,
      fogFar: 58,
    }),
  };

  /* ---------------------------------------------------- wall inscriptions */
  const faces = [];

  function makeDecalGroup(name, canvas, dark) {
    const key = `decal:${name}`;
    textures[key] = canvasTexture(gl, canvas);
    const group = makeGroup(name, {
      mode: "tile",
      decal: true,
      texture: key,
      tint: [1, 1, 1],
      ambient: dark ? 0.9 : 1.02,
      fogNear: 8,
      fogFar: 74,
    });
    groups[name] = group;
    return group;
  }

  /** The face expressed from inside the room: `from` is its screen-left edge. */
  function facePlane(face, inset) {
    switch (face.side) {
      case "north":
        return { axis: "x", fixed: face.z0 + inset, from: face.x0, to: face.x1, normal: [0, 0, 1] };
      case "south":
        return { axis: "x", fixed: face.z1 - inset, from: face.x1, to: face.x0, normal: [0, 0, -1] };
      case "west":
        return { axis: "z", fixed: face.x0 + inset, from: face.z1, to: face.z0, normal: [1, 0, 0] };
      default:
        return { axis: "z", fixed: face.x1 - inset, from: face.z0, to: face.z1, normal: [-1, 0, 0] };
    }
  }

  function addFaceQuad(group, face, { width, height, bottom, inset = 0.03 }) {
    const plane = facePlane(face, inset);
    const span = Math.abs(plane.to - plane.from);
    const w = Math.min(width, span - 0.2);
    const margin = (span - w) / 2;
    const direction = Math.sign(plane.to - plane.from) || 1;
    const left = plane.from + direction * margin;
    const right = plane.to - direction * margin;
    const y0 = Math.max(0.35, bottom);
    const y1 = y0 + height;
    const point = (along, y) =>
      plane.axis === "x" ? [along, y, plane.fixed] : [plane.fixed, y, along];

    quad(
      group,
      point(left, y0),
      point(right, y0),
      point(right, y1),
      point(left, y1),
      plane.normal,
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    );
  }

  function addTextDecal(face, insight, hash, dark) {
    const group = makeDecalGroup(
      `insight-${hash.toString(16)}`,
      inscriptionCanvas(insight.text, { corrupt: insight.corrupt, dark }),
      dark,
    );
    addFaceQuad(group, face, { width: 2.35, height: 1.18, bottom: 1.22 });
  }

  function addCorruptionDecal(face, hash, dark) {
    const rnd = makeHashRandom(hash ^ 0x5bd1e995);
    const group = makeDecalGroup(
      `wall-damage-${hash.toString(16)}`,
      wallCorruptionCanvas(hash),
      dark,
    );
    addFaceQuad(group, face, {
      width: 1.1 + rnd() * 1.5,
      height: 0.6 + rnd() * 1.1,
      bottom: 0.5 + rnd() * 1.5,
    });
  }

  /**
   * A deterministic, sparse selection of real wall faces. Keeping it derived
   * from the level means every mark is necessarily on architecture, never on a
   * doorway or in mid-air, and a resize or reload paints exactly the same walls.
   */
  function buildInsights() {
    if (!faces.length || !WALL_INSIGHTS.length) return;
    const picked = [];
    for (const face of faces) {
      const hash = hashFace(face);
      if (hash % 9 !== 0) continue;
      picked.push({ face, hash });
    }
    let textIndex = 0;
    picked.slice(0, 30).forEach(({ face, hash }, order) => {
      const dark = level.zones[face.z]?.[face.x] === "final";
      if (order % 4 === 1) {
        addCorruptionDecal(face, hash ^ 0x1234567, dark);
        return;
      }
      addTextDecal(face, WALL_INSIGHTS[textIndex % WALL_INSIGHTS.length], hash, dark);
      textIndex += 1;
    });
    // Damage that carries no text, so the marks read as the room itself.
    picked.slice(0, 5).forEach(({ face, hash }) => {
      addCorruptionDecal(face, hash ^ 0x9e3779b9, level.zones[face.z]?.[face.x] === "final");
    });
  }

  function quad(g, a, b, c, d, normal, uvA = [0, 0], uvB = [1, 0], uvC = [1, 1], uvD = [0, 1]) {
    // Two triangles, counter-clockwise when seen from the normal side.
    const verts = [
      [a, uvA],
      [b, uvB],
      [c, uvC],
      [a, uvA],
      [c, uvC],
      [d, uvD],
    ];
    for (const [p, uv] of verts) {
      g.data.push(p[0], p[1], p[2], normal[0], normal[1], normal[2], uv[0], uv[1]);
    }
  }

  function box(g, x1, y1, z1, x2, y2, z2, uScale = CELL) {
    const uv = (u, v) => [u / uScale, v / uScale];
    // top / bottom
    quad(g, [x1, y2, z1], [x1, y2, z2], [x2, y2, z2], [x2, y2, z1], [0, 1, 0],
      uv(x1, z1), uv(x1, z2), uv(x2, z2), uv(x2, z1));
    quad(g, [x1, y1, z1], [x2, y1, z1], [x2, y1, z2], [x1, y1, z2], [0, -1, 0],
      uv(x1, z1), uv(x2, z1), uv(x2, z2), uv(x1, z2));
    // north / south
    quad(g, [x1, y1, z1], [x1, y2, z1], [x2, y2, z1], [x2, y1, z1], [0, 0, -1],
      uv(x1, y1), uv(x1, y2), uv(x2, y2), uv(x2, y1));
    quad(g, [x1, y1, z2], [x2, y1, z2], [x2, y2, z2], [x1, y2, z2], [0, 0, 1],
      uv(x1, y1), uv(x2, y1), uv(x2, y2), uv(x1, y2));
    // west / east
    quad(g, [x1, y1, z1], [x1, y1, z2], [x1, y2, z2], [x1, y2, z1], [-1, 0, 0],
      uv(z1, y1), uv(z2, y1), uv(z2, y2), uv(z1, y2));
    quad(g, [x2, y1, z1], [x2, y2, z1], [x2, y2, z2], [x2, y1, z2], [1, 0, 0],
      uv(z1, y1), uv(z1, y2), uv(z2, y2), uv(z2, y1));
  }

  const isFinal = (x, z) => level.zones[z] && level.zones[z][x] === "final";
  const heightAt = (x, z) => level.heights[z]?.[x] || level.wallHeight;
  const floorUV = (x, z) => [x / CELL, z / CELL];

  function build() {
    for (let z = 0; z < level.height; z += 1) {
      for (let x = 0; x < level.width; x += 1) {
        const cell = level.grid[z][x];
        if (cell === "#") continue;
        const x0 = x * CELL;
        const x1 = x0 + CELL;
        const z0 = z * CELL;
        const z1 = z0 + CELL;
        const h = heightAt(x, z);
        const final = isFinal(x, z);

        if (cell === ".") {
          const floor = final ? groups.darkFloor : groups.brightFloor;
          const u0 = floorUV(x0, z0);
          const u1 = floorUV(x1, z1);
          quad(
            floor,
            [x0, 0, z0],
            [x0, 0, z1],
            [x1, 0, z1],
            [x1, 0, z0],
            [0, 1, 0],
            [u0[0], u0[1]],
            [u0[0], u1[1]],
            [u1[0], u1[1]],
            [u1[0], u0[1]],
          );
        }

        if (cell === "~" && !final) {
          const u0 = floorUV(x0, z0);
          const u1 = floorUV(x1, z1);
          quad(
            groups.brightWater,
            [x0, -0.22, z0],
            [x0, -0.22, z1],
            [x1, -0.22, z1],
            [x1, -0.22, z0],
            [0, 1, 0],
            [u0[0], u0[1]],
            [u0[0], u1[1]],
            [u1[0], u1[1]],
            [u1[0], u0[1]],
          );
        }

        // Ceiling.
        const ceiling = final ? groups.darkCeil : groups.brightCeil;
        const c0 = floorUV(x0, z0);
        const c1 = floorUV(x1, z1);
        quad(
          ceiling,
          [x0, h - 0.03, z0],
          [x1, h - 0.03, z0],
          [x1, h - 0.03, z1],
          [x0, h - 0.03, z1],
          [0, -1, 0],
          [c0[0], c0[1]],
          [c1[0], c0[1]],
          [c1[0], c1[1]],
          [c0[0], c1[1]],
        );

        // Interior wall faces. A missing neighbour means a solid boundary.
        const wall = final ? groups.darkWall : groups.brightWall;
        const north = z > 0 ? level.grid[z - 1][x] : "#";
        const south = z < level.height - 1 ? level.grid[z + 1][x] : "#";
        const west = x > 0 ? level.grid[z][x - 1] : "#";
        const east = x < level.width - 1 ? level.grid[z][x + 1] : "#";
        if (north === "#") {
          quad(wall, [x0, 0, z0], [x1, 0, z0], [x1, h, z0], [x0, h, z0], [0, 0, 1],
            [x0 / CELL, 0], [x1 / CELL, 0], [x1 / CELL, h / CELL], [x0 / CELL, h / CELL]);
          faces.push({ x, z, side: "north", x0, x1, z0, z1 });
        }
        if (south === "#") {
          quad(wall, [x0, 0, z1], [x0, h, z1], [x1, h, z1], [x1, 0, z1], [0, 0, -1],
            [x0 / CELL, 0], [x0 / CELL, h / CELL], [x1 / CELL, h / CELL], [x1 / CELL, 0]);
          faces.push({ x, z, side: "south", x0, x1, z0, z1 });
        }
        if (west === "#") {
          quad(wall, [x0, 0, z0], [x0, h, z0], [x0, h, z1], [x0, 0, z1], [1, 0, 0],
            [z0 / CELL, 0], [z0 / CELL, h / CELL], [z1 / CELL, h / CELL], [z1 / CELL, 0]);
          faces.push({ x, z, side: "west", x0, x1, z0, z1 });
        }
        if (east === "#") {
          quad(wall, [x1, 0, z1], [x1, h, z1], [x1, h, z0], [x1, 0, z0], [-1, 0, 0],
            [z1 / CELL, 0], [z1 / CELL, h / CELL], [z0 / CELL, h / CELL], [z0 / CELL, 0]);
          faces.push({ x, z, side: "east", x0, x1, z0, z1 });
        }
      }
    }

    // Pale pool coping. The final room has its own bridge edges instead.
    for (let z = 0; z < level.height; z += 1) {
      for (let x = 0; x < level.width; x += 1) {
        if (level.grid[z][x] !== "~" || isFinal(x, z)) continue;
        const x0 = x * CELL;
        const x1 = x0 + CELL;
        const z0 = z * CELL;
        const z1 = z0 + CELL;
        const open = (nx, nz) =>
          nz >= 0 && nx >= 0 && nz < level.height && nx < level.width && level.grid[nz][nx] === ".";
        if (open(x - 1, z)) box(groups.trim, x0 - 0.1, -0.1, z0, x0 + 0.1, 0.12, z1, 1.5);
        if (open(x + 1, z)) box(groups.trim, x1 - 0.1, -0.1, z0, x1 + 0.1, 0.12, z1, 1.5);
        if (open(x, z - 1)) box(groups.trim, x0, -0.1, z0 - 0.1, x1, 0.12, z0 + 0.1, 1.5);
        if (open(x, z + 1)) box(groups.trim, x0, -0.1, z1 - 0.1, x1, 0.12, z1 + 0.1, 1.5);
      }
    }

    // The dark pool: water, then the narrow deck and its low edges.
    for (const pool of level.finalWater) {
      quad(
        groups.darkWater,
        [pool.x1, -0.9, pool.z1],
        [pool.x1, -0.9, pool.z2],
        [pool.x2, -0.9, pool.z2],
        [pool.x2, -0.9, pool.z1],
        [0, 1, 0],
        [pool.x1 / CELL, pool.z1 / CELL],
        [pool.x1 / CELL, pool.z2 / CELL],
        [pool.x2 / CELL, pool.z2 / CELL],
        [pool.x2 / CELL, pool.z1 / CELL],
      );
    }
    const bridge = level.bridge;
    box(groups.bridge, bridge.x1, -0.12, bridge.z1, bridge.x2, bridge.y, bridge.z2, 2.4);
    box(groups.trim, bridge.x1, bridge.y, bridge.z1, bridge.x1 + 0.14, bridge.y + 0.17, bridge.z2, 1.4);
    box(groups.trim, bridge.x2 - 0.14, bridge.y, bridge.z1, bridge.x2, bridge.y + 0.17, bridge.z2, 1.4);

    // Columns.
    for (const pillar of level.pillars) {
      const half = pillar.size / 2;
      box(
        groups.brightWall,
        pillar.x - half,
        0,
        pillar.z - half,
        pillar.x + half,
        level.wallHeight - 0.1,
        pillar.z + half,
        1.5,
      );
      box(
        groups.trim,
        pillar.x - half - 0.08,
        0,
        pillar.z - half - 0.08,
        pillar.x + half + 0.08,
        0.18,
        pillar.z + half + 0.08,
        1.2,
      );
    }

    // Ceiling light panels: simple warm rectangles, brighter in the dark room.
    for (const light of level.lights) {
      const dark = light.tone === "dark";
      const y = dark ? level.finalHeight - 0.08 : level.wallHeight - 0.07;
      const group = dark ? groups.darkGlow : groups.glow;
      const x0 = light.x - light.w / 2;
      const x1 = light.x + light.w / 2;
      const z0 = light.z - light.d / 2;
      const z1 = light.z + light.d / 2;
      quad(group, [x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, -1, 0]);
    }

    // Exit door, frame and threshold.
    const door = level.door;
    const dx = door.x;
    const dz = door.z;
    const half = 1.35;
    const top = 3.25;
    quad(
      groups.door,
      [dx - half, 0.05, dz],
      [dx + half, 0.05, dz],
      [dx + half, top, dz],
      [dx - half, top, dz],
      [0, 0, -1],
      [1, 0],
      [0, 0],
      [0, 1],
      [1, 1],
    );
    box(groups.trim, dx - half - 0.2, 0, dz - 0.06, dx - half, top + 0.2, dz + 0.08, 1.2);
    box(groups.trim, dx + half, 0, dz - 0.06, dx + half + 0.2, top + 0.2, dz + 0.08, 1.2);
    box(groups.trim, dx - half - 0.2, top, dz - 0.06, dx + half + 0.2, top + 0.2, dz + 0.08, 1.2);
    box(groups.darkGlow, dx - 1.5, top + 0.23, dz - 0.03, dx + 1.5, top + 0.35, dz + 0.01, 1);
    box(groups.darkFloor, dx - half - 0.3, -0.03, dz - 1.2, dx + half + 0.3, 0.03, dz + 0.02, 2);

    // Inscriptions and damaged surfaces last: they are separate draw calls
    // with their own transparent textures, blended over the finished walls.
    buildInsights();
  }

  build();

  const buffers = [];
  for (const group of Object.values(groups)) {
    if (!group.data.length) continue;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(group.data), gl.STATIC_DRAW);
    buffers.push({ group, buffer, count: group.data.length / 8 });
    group.data = null;
  }

  let width = 1;
  let height = 1;
  const proj = new Float32Array(16);
  const view = new Float32Array(16);
  const cameraVec = new Float32Array(3);

  function resize() {
    const cssW = Math.max(1, canvas.clientWidth);
    const cssH = Math.max(1, canvas.clientHeight);
    const dpr = Math.min(1, window.devicePixelRatio || 1);
    width = Math.max(1, Math.round(cssW * dpr * SCALE));
    height = Math.max(1, Math.round(cssH * dpr * SCALE));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function environment(camera) {
    const nearFinal = camera.x > 96.5;
    const t = Math.max(0, Math.min(1, (camera.z - 30) / 7));
    const dark = nearFinal ? t * t * (3 - 2 * t) : 0;
    return {
      dark,
      fogColor: [
        0.74 + (0.012 - 0.74) * dark,
        0.83 + (0.025 - 0.83) * dark,
        0.82 + (0.031 - 0.82) * dark,
      ],
      fogNear: 9 + (8 - 9) * dark,
      fogFar: 80 + (96 - 80) * dark,
    };
  }

  function render(camera, time) {
    resize();
    const aspect = width / height;
    perspective(proj, (68 * Math.PI) / 180, aspect, 0.08, 140);
    const cp = Math.cos(camera.pitch || 0);
    const forward = [
      Math.sin(camera.yaw) * cp,
      Math.sin(camera.pitch || 0),
      -Math.cos(camera.yaw) * cp,
    ];
    const eye = [camera.x, camera.y, camera.z];
    lookAt(view, eye, forward);
    const env = environment(camera);
    cameraVec[0] = eye[0];
    cameraVec[1] = eye[1];
    cameraVec[2] = eye[2];

    gl.viewport(0, 0, width, height);
    gl.clearColor(env.fogColor[0], env.fogColor[1], env.fogColor[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(prog);
    gl.uniformMatrix4fv(uniforms.uProjection, false, proj);
    gl.uniformMatrix4fv(uniforms.uView, false, view);
    gl.uniform3fv(uniforms.uCamera, cameraVec);
    gl.uniform3f(uniforms.uLightDir, 0.32, 0.92, 0.22);
    gl.uniform1f(uniforms.uTime, time);
    gl.uniform3fv(uniforms.uFogColor, env.fogColor);

    for (const item of buffers) {
      const g = item.group;
      gl.bindBuffer(gl.ARRAY_BUFFER, item.buffer);
      gl.enableVertexAttribArray(attributes.position);
      gl.vertexAttribPointer(attributes.position, 3, gl.FLOAT, false, 32, 0);
      gl.enableVertexAttribArray(attributes.normal);
      gl.vertexAttribPointer(attributes.normal, 3, gl.FLOAT, false, 32, 12);
      gl.enableVertexAttribArray(attributes.uv);
      gl.vertexAttribPointer(attributes.uv, 2, gl.FLOAT, false, 32, 24);

      const texture = g.texture
        ? textures[g.texture]
        : g.mode === "door"
          ? textures.door
          : g.mode === "white"
            ? textures.white
            : textures.tile;
      if (g.decal) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      } else {
        gl.disable(gl.BLEND);
      }
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(uniforms.uTexture, 0);
      gl.uniform3fv(uniforms.uTint, g.tint);
      gl.uniform1f(uniforms.uAmbient, g.ambient);
      gl.uniform1f(uniforms.uEmissive, g.emissive ? 1 : 0);
      gl.uniform1f(uniforms.uWater, g.water ? 1 : 0);
      gl.uniform1f(uniforms.uDecal, g.decal ? 1 : 0);
      gl.uniform1f(uniforms.uFogNear, env.fogNear);
      gl.uniform1f(uniforms.uFogFar, env.fogFar);

      if (g.water) {
        if (g === groups.darkWater) {
          gl.uniform3f(uniforms.uWaterDeep, 0.007, 0.016, 0.026);
          gl.uniform3f(uniforms.uWaterShallow, 0.018, 0.055, 0.075);
          gl.uniform3f(uniforms.uWaterSky, 0.12, 0.19, 0.22);
          gl.uniform1f(uniforms.uWaterSpec, 0.52);
        } else {
          gl.uniform3f(uniforms.uWaterDeep, 0.095, 0.43, 0.44);
          gl.uniform3f(uniforms.uWaterShallow, 0.47, 0.77, 0.74);
          gl.uniform3f(uniforms.uWaterSky, 0.82, 0.94, 0.91);
          gl.uniform1f(uniforms.uWaterSpec, 0.5);
        }
      }
      gl.drawArrays(gl.TRIANGLES, 0, item.count);
    }
  }

  function destroy() {
    for (const item of buffers) gl.deleteBuffer(item.buffer);
    for (const tex of Object.values(textures)) gl.deleteTexture(tex);
    gl.deleteProgram(prog);
    if (gl.isContextLost()) return;
  }

  return { render, resize, destroy, groups };
}
