/**
 * Twisters — the small spring-bodied creatures that belong to the desktop.
 *
 * This module is visual only. It never reads or writes progression, never
 * records a Twister encounter and never opens a dialog, so a preview cannot be
 * mistaken for a real narrative event. Future encounter logic should decide
 * when to spawn one, then call `progression.recordTwister()` itself.
 *
 * The mascot's reaction is deliberately not handled here: `mascot.react()` is
 * the separate hook that can later make it nervous or afraid.
 *
 * Structure:
 *   createTwister({ state })        → a standalone decorative element
 *   placeTwister(node, { x, y })    → clamp it inside its container
 *   mountTwisterPreview({ root })   → dev preview via ?twister=<state>
 *
 * States are visual only:
 *   first       arrival animation, ordinary palette
 *   idle        baseline mischief
 *   thought     slightly paler, a touch more smoke
 *   unsettling  darker head, muted dusty face, heavier wisps
 */
import { el } from "../core/dom.js";

export const TWISTER_STATES = ["first", "idle", "thought", "unsettling"];

const DEFAULT_WIDTH = 64;
const DEFAULT_HEIGHT = 102;

/** Gradients need unique ids; several Twisters may share one document. */
let instanceCount = 0;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * Nine hoops hanging from the head: the widest coil sits directly under the
 * head, then the spring tapers down to a narrow point.
 */
function coilRings(uid) {
  const rings = [];
  const count = 9;
  for (let index = 0; index < count; index += 1) {
    const t = index / (count - 1);
    const rx = 47 - t * 39;
    const ry = 7.6 - t * 4.2;
    const cy = 74 + t * 94;
    const cx = 60 + (index % 2 === 0 ? -0.7 : 0.7);
    rings.push(
      `<ellipse class="twister__coil-base" cx="${cx.toFixed(1)}" cy="${(cy + 2).toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}"></ellipse>`,
      `<ellipse class="twister__coil" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="none" stroke="url(#twister-coil-${uid})"></ellipse>`,
    );
  }
  return rings.join("\n      ");
}

/**
 * One shared SVG. Ids are prefixed and unique per document because the
 * gradients live in <defs>; several Twisters may share the same paint.
 */
function twisterMarkup(uid) {
  return `
    <svg class="twister__art" viewBox="0 0 120 190" focusable="false" role="presentation">
      <defs>
        <radialGradient id="twister-head-${uid}" cx="36%" cy="27%" r="76%">
          <stop offset="0%" class="twister__head-stop-hi"></stop>
          <stop offset="45%" class="twister__head-stop-mid"></stop>
          <stop offset="100%" class="twister__head-stop-lo"></stop>
        </radialGradient>
        <linearGradient id="twister-coil-${uid}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" class="twister__coil-stop-hi"></stop>
          <stop offset="52%" class="twister__coil-stop-mid"></stop>
          <stop offset="100%" class="twister__coil-stop-lo"></stop>
        </linearGradient>
        <linearGradient id="twister-core-${uid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#12312a" stop-opacity="0.5"></stop>
          <stop offset="100%" stop-color="#020c0a" stop-opacity="0.9"></stop>
        </linearGradient>
      </defs>

      <g class="twister__smoke" aria-hidden="true">
        <path class="twister__wisp twister__wisp--1" d="M17 80 C3 90 19 101 9 111 C3 119 15 127 13 139"></path>
        <path class="twister__wisp twister__wisp--2" d="M103 80 C117 90 101 101 111 111 C117 119 105 127 107 139"></path>
        <path class="twister__wisp twister__wisp--3" d="M86 148 C96 155 88 165 96 172"></path>
      </g>

      <g class="twister__figure">
        <path class="twister__core" d="M13 74 C26 112 44 150 57 176 L63 176 C76 150 94 112 107 74 Z" fill="url(#twister-core-${uid})"></path>
        ${coilRings(uid)}

        <g class="twister__head">
          <circle class="twister__neck" cx="60" cy="68" r="13"></circle>
          <circle class="twister__sphere" cx="60" cy="40" r="32" fill="url(#twister-head-${uid})"></circle>
          <path class="twister__rim" d="M32 23 A32 32 0 0 0 38 65"></path>
          <ellipse class="twister__glint" cx="47" cy="23" rx="8" ry="4.5"></ellipse>
          <g class="twister__face">
            <g class="twister__eyes">
              <path d="M38 33 L51 37 L50 42 L40 38 Z"></path>
              <path d="M82 33 L69 37 L70 42 L80 38 Z"></path>
            </g>
            <path class="twister__mouth-dark" d="M41 50 Q60 67 79 50 Q70 61 60 61 Q50 61 41 50 Z"></path>
            <path class="twister__teeth" d="M43 51 L47 55 L51 50 L55 56 L60 50 L65 56 L69 50 L73 55 L77 51 L74 58 L66 56 L60 61 L54 56 L46 58 Z"></path>
          </g>
        </g>

        <path class="twister__tip" d="M57.5 172 L60 186 L62.5 172 Z"></path>
      </g>
    </svg>`;
}

/**
 * @param {{state?: string, scale?: number, className?: string}} [options]
 * @returns {HTMLDivElement}
 */
export function createTwister({ state = "idle", scale = 1, className = "" } = {}) {
  const resolved = TWISTER_STATES.includes(state) ? state : "idle";
  const root = el("div", {
    class: ["twister", className].filter(Boolean).join(" "),
    dataset: { state: resolved, twister: resolved },
    "aria-hidden": "true",
  });

  const size = Number(scale);
  if (Number.isFinite(size) && size > 0 && size !== 1) {
    root.dataset.scale = String(size);
    root.style.setProperty("--twister-scale", String(size));
  }

  if (resolved === "first") root.classList.add("is-arriving");
  instanceCount += 1;
  root.innerHTML = twisterMarkup(`t${instanceCount}`);
  return root;
}

/**
 * Place a Twister inside a positioned container (the desktop layer, a window
 * body…) without letting its scaled silhouette leave the visible area.
 *
 * @param {HTMLElement} node
 * @param {{x?: number, y?: number, container?: {width: number, height: number}, margin?: number}} [options]
 */
export function placeTwister(node, options = {}) {
  if (!node) return null;
  const margin = Number.isFinite(options.margin) ? options.margin : 10;
  const rect = options.container || {
    width: typeof window === "undefined" ? 1024 : window.innerWidth,
    height: typeof window === "undefined" ? 700 : window.innerHeight,
  };
  const size = Number(node.dataset.scale || 1) || 1;
  const width = (node.offsetWidth || DEFAULT_WIDTH) * size;
  const height = (node.offsetHeight || DEFAULT_HEIGHT) * size;

  const maxLeft = Math.max(margin, (rect.width || 0) - width - margin);
  const maxTop = Math.max(margin, (rect.height || 0) - height - margin);
  const left = clamp(Number.isFinite(options.x) ? options.x : maxLeft, margin, maxLeft);
  const top = clamp(Number.isFinite(options.y) ? options.y : maxTop, margin, maxTop);

  node.style.left = `${Math.round(left)}px`;
  node.style.top = `${Math.round(top)}px`;
  return { left: Math.round(left), top: Math.round(top) };
}

/**
 * Development-only preview. Reads `?twister=idle|first|thought|unsettling`
 * and drops one decorative instance on the desktop. It writes nothing to
 * progression and opens no dialog, so it can never count as an encounter.
 *
 * @param {{root: HTMLElement, search?: string}} options
 */
export function mountTwisterPreview({ root, search } = {}) {
  if (!root) return null;
  const query =
    typeof search === "string"
      ? search
      : typeof window !== "undefined"
        ? window.location.search
        : "";
  const requested = new URLSearchParams(query).get("twister");
  if (!TWISTER_STATES.includes(requested)) return null;

  const node = createTwister({ state: requested });
  root.append(node);

  const position = () => {
    const rect = root.getBoundingClientRect();
    const width = rect.width || (typeof window === "undefined" ? 1024 : window.innerWidth);
    const height = rect.height || (typeof window === "undefined" ? 700 : window.innerHeight);
    placeTwister(node, {
      // Left of the mascot dock, above the bottom edge.
      x: width - 306,
      y: height - 152,
      container: { width, height },
      margin: 14,
    });
  };

  position();
  if (typeof window !== "undefined") window.addEventListener("resize", position);
  return node;
}
