/**
 * Corrupted-memory surface — one reusable visual for damaged content.
 *
 * Three layers, drawn once into canvases (no animation loop):
 *   1. a near-black teal field with faint horizontal interference bands;
 *   2. a scattered glyph layer of character fragments, line stubs, dot groups,
 *      grid boxes and 1px bits at varied sizes, brightness and spacing;
 *   3. CSS-only CRT scanlines, grain, a slow interference drift, group
 *      flicker and a rare short tear.
 *
 * It is visual only: this module never reads progression, never unlocks
 * anything and never decides what is corrupted. Callers label their own
 * content and choose an intensity.
 *
 * API:
 *   createCorruption({ intensity, seed })   → overlay controller
 *   applyCorruption(host, options)          → append an overlay over existing
 *                                             content (host gets .corrupt-host)
 *   createCorruptionBlock({ intensity, caption, height })
 *                                           → standalone damaged panel
 *   CORRUPTION_INTENSITIES                  → ["subtle", "medium", "heavy"]
 *
 * Controller: { el, intensity, setIntensity, recover, destroy }.
 * `recover({ duration })` dissolves the glyph field from the top down, so the
 * real content underneath is reconstructed instead of swapped in. With
 * prefers-reduced-motion the field is removed immediately.
 */
import { el } from "../core/dom.js";

export const CORRUPTION_INTENSITIES = ["subtle", "medium", "heavy"];

/** Glyph spacing, density, brightness, size range and flicker-group ratio. */
const SETTINGS = {
  subtle: { spacing: 13, density: 0.6, alpha: 0.72, size: [7, 11], pulse: 0.14 },
  medium: { spacing: 11.5, density: 0.78, alpha: 0.82, size: [7, 12], pulse: 0.18 },
  heavy: { spacing: 10, density: 0.92, alpha: 0.9, size: [8, 13], pulse: 0.22 },
};

const MONO =
  '"Lucida Console", "Consolas", "DejaVu Sans Mono", "Courier New", monospace';

/** Fragmentary characters, symbols and block pieces — damaged memory, not prose. */
const CHARS = [
  "/", "\\", "|", ":", ".", "=", "+", "#", "*", "%", "$", "&", "~", "^",
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "X", "Z", "n", "k", "µ", "æ", "Ø", "¤", "§", "¶", "¬", "¦", "¾", "¿",
  "Ê", "Ú", "à", "Ë", "Î", "·", "×", "÷", "≈", "¸", "¨", "ª",
  "▐", "░", "▒", "▚", "▞", "■", "□", "▪", "►", "◄",
];

/** Muted teal → pale cyan, weighted so bright flecks stay rare. */
const PALETTE = [
  [44, 102, 94, 3],
  [58, 128, 118, 4],
  [74, 156, 144, 4],
  [96, 182, 168, 3],
  [124, 208, 194, 2],
  [162, 234, 222, 1],
];

/** Deterministic randomness so a redraw never reflows the pattern. */
function makeRandom(seed) {
  let value = seed >>> 0 || 0x9e3779b9;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed) {
  const text = String(seed ?? "corruption");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const reducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function resolveIntensity(value) {
  return CORRUPTION_INTENSITIES.includes(value) ? value : "medium";
}

const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function pickPalette(random) {
  const total = PALETTE.reduce((sum, entry) => sum + entry[3], 0);
  let roll = random() * total;
  for (const entry of PALETTE) {
    roll -= entry[3];
    if (roll <= 0) return entry;
  }
  return PALETTE[0];
}

/**
 * One mark. `kind` decides how it is painted, so a single list can mix text
 * characters with line stubs, dot clusters, grid boxes and loose 1px bits.
 */
function makeMark(random, x, y, config, width, height) {
  const roll = random();
  let kind = "char";
  if (roll > 0.9) kind = "dots";
  else if (roll > 0.795) kind = "hline";
  else if (roll > 0.73) kind = "vline";
  else if (roll > 0.685) kind = "box";
  else if (roll > 0.652) kind = "bits";

  const [minSize, maxSize] = config.size;
  let size = minSize + random() * (maxSize - minSize);
  if (random() < 0.09) size *= 1.55; // a few oversized fragments

  const tint = pickPalette(random);
  let alpha = (0.26 + random() * 0.56) * config.alpha;
  if (random() < 0.08) alpha += 0.14; // rare bright flecks
  alpha = clamp01(alpha);

  const mark = {
    kind,
    x,
    y,
    size,
    color: `rgba(${tint[0]}, ${tint[1]}, ${tint[2]}, ${alpha.toFixed(3)})`,
    threshold: (y / height) * 0.5 + random() * 0.5,
    pulse: random() < config.pulse,
  };

  if (kind === "char") {
    mark.ch = CHARS[Math.floor(random() * CHARS.length)];
  } else if (kind === "hline") {
    mark.w = 5 + random() * 19;
    mark.h = random() < 0.25 ? 2 : 1;
  } else if (kind === "vline") {
    mark.h = 5 + random() * 15;
    mark.w = random() < 0.2 ? 2 : 1;
  } else if (kind === "box") {
    mark.s = 3 + random() * 6;
  } else if (kind === "dots") {
    const columns = 2 + Math.floor(random() * 3);
    const rows = 2 + Math.floor(random() * 2);
    mark.points = [];
    for (let column = 0; column < columns; column += 1) {
      for (let row = 0; row < rows; row += 1) {
        if (random() < 0.7) mark.points.push([column * 4, row * 4, 2]);
      }
    }
  } else {
    const count = 2 + Math.floor(random() * 4);
    mark.points = [];
    for (let index = 0; index < count; index += 1) {
      mark.points.push([random() * 10 - 5, random() * 8 - 4, random() < 0.25 ? 2 : 1]);
    }
  }

  return mark;
}

/**
 * Cluster the marks: damaged data comes in ragged concentrations with voids
 * and stray fragments, not in an even grid. Marks also carry a stable
 * `threshold` used by recovery, so glyphs vanish in a scattered, top-weighted
 * order rather than in a generic fade.
 */
function buildGeometry(width, height, config, seed) {
  const random = makeRandom(seed);
  const target = Math.max(
    24,
    Math.round((width * height) / (config.spacing * config.spacing) * config.density),
  );
  const marks = [];
  const interference = [];

  const bandCount = Math.max(1, Math.round(height / 26));
  for (let index = 0; index < bandCount; index += 1) {
    if (random() < 0.55) {
      interference.push({
        y: random() * height,
        h: random() < 0.3 ? 2 : 1,
        w: 0.3 + random() * 0.7,
      });
    }
  }

  const at = (x, y) =>
    marks.push(
      makeMark(random, clamp(x, 2, width - 2), clamp(y, 3, height - 3), config, width, height),
    );

  // Ragged concentrations.
  const anchors = Math.max(4, Math.round(target / 8));
  for (let index = 0; index < anchors; index += 1) {
    const anchorX = random() * width;
    const anchorY = random() * height;
    const spreadX = 8 + random() * 30;
    const spreadY = 5 + random() * 16;
    const members = 1 + Math.floor(random() * 5);
    for (let member = 0; member < members; member += 1) {
      at(
        anchorX + (random() - 0.5) * spreadX * 2,
        anchorY + (random() - 0.5) * spreadY * 2,
      );
    }
  }

  // Loose fill so nothing is left empty.
  for (let index = marks.length; index < target; index += 1) {
    at(random() * width, random() * height);
  }

  // Deliberate coverage of the edges, including the corners.
  const edgeMarks = Math.max(4, Math.round(target * 0.14));
  for (let index = 0; index < edgeMarks; index += 1) {
    const side = Math.floor(random() * 4);
    const inset = random() * 5;
    let x;
    let y;
    if (side === 0) {
      x = random() * width;
      y = inset;
    } else if (side === 1) {
      x = random() * width;
      y = height - inset;
    } else if (side === 2) {
      x = inset;
      y = random() * height;
    } else {
      x = width - inset;
      y = random() * height;
    }
    at(x, y);
  }

  return {
    base: marks.filter((mark) => !mark.pulse),
    pulse: marks.filter((mark) => mark.pulse),
    interference,
  };
}

function drawMark(ctx, mark) {
  ctx.fillStyle = mark.color;
  switch (mark.kind) {
    case "char":
      ctx.font = `${mark.size.toFixed(1)}px ${MONO}`;
      ctx.fillText(mark.ch, mark.x, mark.y);
      break;
    case "hline":
    case "vline":
      ctx.fillRect(mark.x, mark.y, mark.w, mark.h);
      break;
    case "box":
      ctx.strokeStyle = mark.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(mark.x + 0.5, mark.y + 0.5, mark.s, mark.s);
      break;
    case "dots":
    case "bits":
      for (const [dx, dy, size] of mark.points) {
        ctx.fillRect(mark.x + dx, mark.y + dy, size, size);
      }
      break;
    default:
      break;
  }
}

function drawLayer(canvas, geometry, erase, dpr, layer) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (layer === "base") {
    for (const band of geometry.interference) {
      ctx.fillStyle = "rgba(104, 196, 182, 0.05)";
      ctx.fillRect(0, band.y, width * band.w, band.h);
    }
  }

  const marks = layer === "base" ? geometry.base : geometry.pulse;
  for (const mark of marks) {
    if (mark.threshold < erase) continue;
    drawMark(ctx, mark);
  }
}

/**
 * @param {{
 *   intensity?: "subtle"|"medium"|"heavy",
 *   seed?: string|number,
 *   className?: string,
 * }} [options]
 */
export function createCorruption(options = {}) {
  const intensity = resolveIntensity(options.intensity);
  let config = SETTINGS[intensity];
  const seed = hashSeed(options.seed);

  const field = el("canvas", { class: "corrupt__field", "aria-hidden": "true" });
  const pulse = el("canvas", {
    class: "corrupt__field corrupt__pulse",
    "aria-hidden": "true",
  });

  const overlay = el(
    "div",
    {
      class: ["corrupt", `corrupt--${intensity}`, options.className]
        .filter(Boolean)
        .join(" "),
      dataset: { corruption: intensity },
      "aria-hidden": "true",
    },
    [
      field,
      pulse,
      el("span", { class: "corrupt__interference" }),
      el("span", { class: "corrupt__glitch" }),
      el("span", { class: "corrupt__scan" }),
      el("span", { class: "corrupt__noise" }),
    ],
  );

  let geometry = null;
  let observer = null;
  let erased = 0;
  let destroyed = false;
  let recoveryTimer = null;

  function paint(erase = erased) {
    if (destroyed) return;
    const rect = overlay.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(
      typeof window === "undefined" ? 1 : window.devicePixelRatio || 1,
      2,
    );

    let resized = false;
    for (const canvas of [field, pulse]) {
      const bitmapWidth = Math.round(width * dpr);
      const bitmapHeight = Math.round(height * dpr);
      if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
        canvas.width = bitmapWidth;
        canvas.height = bitmapHeight;
        resized = true;
      }
    }

    if (!geometry || resized) geometry = buildGeometry(width, height, config, seed);
    drawLayer(field, geometry, erase, dpr, "base");
    drawLayer(pulse, geometry, erase, dpr, "pulse");
  }

  // Draw once the surface is laid out; resize only redraws, it never animates.
  if (typeof ResizeObserver === "function") {
    observer = new ResizeObserver(() => {
      if (!overlay.isConnected) return;
      paint();
    });
    observer.observe(overlay);
  }
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => paint());
  } else {
    paint();
  }

  const controller = {
    el: overlay,
    intensity,

    setIntensity(value) {
      const next = resolveIntensity(value);
      if (next === controller.intensity) return;
      overlay.classList.remove(`corrupt--${controller.intensity}`);
      overlay.classList.add(`corrupt--${next}`);
      overlay.dataset.corruption = next;
      controller.intensity = next;
      config = SETTINGS[next];
      geometry = null;
      paint();
    },

    /**
     * Reveal the content underneath. Glyphs dissolve top-down while the field
     * fades, so it reads as damaged data being rebuilt.
     */
    recover({ duration = 900, onDone } = {}) {
      if (destroyed) return;
      const total = reducedMotion() ? 0 : Math.max(0, Number(duration) || 0);
      overlay.classList.add("is-recovering");

      const finish = () => {
        if (destroyed) return;
        overlay.classList.add("is-recovered");
        const remove = () => {
          overlay.remove();
          controller.destroy();
        };
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(() => {
            overlay.style.opacity = "0";
            window.setTimeout(remove, 260);
          });
        } else {
          remove();
        }
        onDone?.();
      };

      if (!total) {
        erased = 1;
        paint(1);
        finish();
        return;
      }

      const started = performance.now();
      const step = () => {
        if (destroyed) return;
        const progress = Math.min(1, (performance.now() - started) / total);
        erased = progress;
        paint(progress);
        overlay.style.opacity = String(1 - progress ** 2);
        if (progress < 1) {
          recoveryTimer = window.setTimeout(step, 70);
        } else {
          finish();
        }
      };
      step();
    },

    destroy() {
      destroyed = true;
      if (recoveryTimer !== null) {
        clearTimeout(recoveryTimer);
        recoveryTimer = null;
      }
      observer?.disconnect();
      observer = null;
      overlay.remove();
    },
  };

  return controller;
}

/**
 * Overlay existing content in place. The host needs a positioning context;
 * `.corrupt-host` provides one, so callers do not have to add CSS.
 */
export function applyCorruption(host, options = {}) {
  if (!host) return null;
  host.classList.add("corrupt-host");
  const controller = createCorruption(options);
  host.append(controller.el);
  return controller;
}

/**
 * A self-contained damaged panel — used for corrupted document blocks and
 * memory fragments where there is nothing readable to cover.
 *
 * @param {{
 *   intensity?: "subtle"|"medium"|"heavy",
 *   caption?: string,
 *   seed?: string|number,
 *   height?: number,
 *   className?: string,
 * }} [options]
 */
export function createCorruptionBlock(options = {}) {
  const block = el("div", {
    class: ["corrupt-block", options.className].filter(Boolean).join(" "),
    dataset: { corruption: resolveIntensity(options.intensity) },
  });
  if (Number.isFinite(options.height) && options.height > 0) {
    block.style.setProperty("--corrupt-height", `${options.height}px`);
  }

  const field = el("div", { class: "corrupt-block__field" });
  block.append(field);

  const controller = createCorruption({
    intensity: options.intensity,
    seed: options.seed,
  });
  field.append(controller.el);

  if (options.caption) {
    block.append(
      el("p", { class: "corrupt-block__caption", text: options.caption }),
    );
  }

  return { el: block, controller };
}
