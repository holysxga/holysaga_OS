/**
 * Desktop corruption — the small traces a Twister leaves behind.
 *
 * Policy (all timings live in DESKTOP_CORRUPTION, so they can be tuned without
 * touching this file):
 * - nothing is tracked until a Twister's message window is open (an ordinary
 *   thought never starts the clock);
 * - the window's position and size are recorded when it opens, and every patch
 *   of that encounter stays inside a moderate ring around that spot
 *   (`anchorPadding`), clamped to the visible workspace. Dragging the window
 *   later does not move the corruption: it belongs to the encounter's area;
 * - the first patch waits for a grace period, and closing the window stops the
 *   schedule immediately — a visitor who dismisses the thought is never
 *   punished;
 * - patches then arrive one at a time at randomized intervals, so the desktop
 *   gets dirtier gradually instead of all at once;
 * - coverage is capped at a fraction of the workspace, and each patch is a
 *   small, opaque, hard-edged block of missing texture rather than a soft
 *   overlay or a full-screen failure;
 * - nothing ever covers the shortcut column, an open window or M.I.L.O., and
 *   the whole layer sits under the icons (z-index 2), so no label, control or
 *   hit area is lost.
 *
 * Patch positions come from a generator seeded once per encounter: an encounter
 * keeps a stable layout while it is on screen, but a later one looks different.
 *
 * Persistence: patches live in memory only. A reload leaves the desktop clean,
 * which is deliberate — a saved corrupted state could strand a visitor without
 * the brush. The brush itself is persisted by the progression store.
 *
 * API:
 *   createDesktopCorruption({ root, layer, document, config, timers, now })
 *     .startEncounter() / .stopEncounter() / .isTracking() *   .spawnPatch({ reason, scale }) → immediate patch (the discovery beat)
 *     .cleanAt({ x, y, radius })   → number of patches dissolved
 *     .cleanAll()
 *     .count() / .getCoverage() / .subscribe(listener) / .destroy()
 */
import { el } from "./dom.js";

export const DESKTOP_CORRUPTION = Object.freeze({
  /* How long a Twister window may stay open before the first trace appears. */
  graceMs: 30_000,
  /* Then one small patch every few seconds, randomized per patch. */
  intervalMinMs: 4_500,
  intervalMaxMs: 8_000,
  /* Never more than this share of the visible workspace, and never more
     patches than this, so the mess stays quick to clean. */
  maxCoverage: 0.08,
  maxPatches: 14,
  /* How far around the alert a trace may appear, in CSS pixels. */
  anchorPadding: 110,
  /* Patch footprint in CSS pixels (height is derived from the width). */
  sizeMin: 70,
  sizeMax: 140,
  /* Side of one texture block, in CSS pixels. Every shape is quantised to it,
     so the pattern stays grid-aligned and hard-edged. */
  cellPx: 9,
  /* Planning estimate of how much of a patch's box the blocks will paint. */
  fillFactor: 0.72,
  /* Brush radius used when the cleaner is dragged across the desktop. */
  brushRadius: 46,
  /* A hidden tab does not keep a lost visitor company: retry later. */
  hiddenRetryMs: 1_500,
  recoverMs: 620,
});

const PLACEMENT_ATTEMPTS = 18;
/** Never place a patch on top of something the visitor needs. */
const PROTECTED_SELECTOR = [
  ".shortcut-item",

  ".deskfile",
  ".window",
  ".mascot",
].join(", ");
const PROTECTED_PAD = 10;

/** Deterministic generator, so one encounter's layout never jumps around. */
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
  const text = String(seed ?? "desktop-corruption");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const DEFAULT_TIMERS = {
  setTimeout: (handler, delay) => setTimeout(handler, delay),
  clearTimeout: (id) => clearTimeout(id),
};

export function createDesktopCorruption(options = {}) {
  const root = options.root || null;
  const doc =
    options.document || (typeof document === "undefined" ? null : document);
  const config = { ...DESKTOP_CORRUPTION, ...(options.config || {}) };
  const timers = options.timers || DEFAULT_TIMERS;
  const random = options.random || Math.random;
  const now = options.now || (() => Date.now());

  let layer = options.layer || null;
  const patches = new Map();
  const listeners = new Set();
  let seq = 0;
  let sessionSeed = 0;
  /* Where the Twister's alert was when this encounter started, layer-relative. */
  let anchor = null;
  let graceTimer = null;
  let patchTimer = null;
  let tracking = false;
  let destroyed = false;

  function mountLayer() {
    if (layer && layer.isConnected) return layer;
    if (!root) return null;
    layer = el("div", {
      class: "corruption-layer",
      "aria-hidden": "true",
      dataset: { corruptionLayer: "desktop" },
    });
    root.append(layer);
    return layer;
  }

  function snapshot() {
    return {
      count: patches.size,
      coverage: coverage(),
      tracking,
    };
  }

  function emit(type, patch = null) {
    const state = snapshot();
    for (const listener of [...listeners]) {
      try {
        listener(state, { type, patch });
      } catch (error) {
        console.error("[corruption] listener failed", error);
      }
    }
  }

  /* ------------------------------------------------------------- placement */

  function layerRect() {
    const node = mountLayer();
    if (!node) return { width: 1024, height: 700 };
    const rect = node.getBoundingClientRect();
    return {
      width: rect.width || (root ? root.clientWidth : 1024) || 1024,
      height: rect.height || (root ? root.clientHeight : 700) || 700,
    };
  }

  /** Boxes a patch must not touch: icons, tools, windows, M.I.L.O. */
  function protectedBoxes() {
    if (!root || !layer) return [];
    const base = layer.getBoundingClientRect();
    const boxes = [];
    for (const node of root.querySelectorAll(PROTECTED_SELECTOR)) {
      if (node.closest(".deskfile.is-collected")) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      boxes.push({
        left: rect.left - base.left - PROTECTED_PAD,
        top: rect.top - base.top - PROTECTED_PAD,
        right: rect.right - base.left + PROTECTED_PAD,
        bottom: rect.bottom - base.top + PROTECTED_PAD,
      });
    }
    return boxes;
  }

  function overlaps(a, b) {
    return (
      a.x < b.right && a.x + a.w > b.left && a.y < b.bottom && a.y + a.h > b.top
    );
  }

  /**
   * The band a trace may use: the recorded alert expanded by `anchorPadding`,
   * clamped to the workspace. Without an anchor (the scripted discovery trace)
   * the whole desktop is available, exactly as before.
   */
  function encounterRegion() {
    const area = layerRect();
    const bound = {
      left: 8,
      top: 8,
      right: Math.max(8, area.width - 8),
      bottom: Math.max(8, area.height - 8),
    };
    if (!anchor) return bound;
    const pad = Math.max(0, config.anchorPadding);
    return {
      left: Math.max(bound.left, anchor.left - pad),
      top: Math.max(bound.top, anchor.top - pad),
      right: Math.min(bound.right, anchor.right + pad),
      bottom: Math.min(bound.bottom, anchor.bottom + pad),
    };
  }

  /**
   * Brush the encounter's band, honouring the coverage ceiling. Patch centres
   * stay inside the band; a patch's visual bloom may soften its own edge, but
   * the layer clips anything that would leave the workspace.
   */
  function nextGeometry(scale = 1) {
    const area = layerRect();
    const rnd = makeRandom(sessionSeed ^ Math.imul(seq + 1, 0x9e3779b1));
    const boxes = protectedBoxes();
    const floor = Math.max(1, area.width * area.height);
    const factor = Number.isFinite(scale) && scale > 0 ? scale : 1;
    const region = encounterRegion();
    const maxW = Math.max(28, region.right - region.left);
    const maxH = Math.max(22, region.bottom - region.top);
    const attempts = anchor ? 26 : PLACEMENT_ATTEMPTS;

    // A window that fills most of the band leaves a thin ring; a second pass
    // with smaller traces finds a spot instead of giving up.
    for (const shrink of [1, 0.72]) {
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const wanted =
          (config.sizeMin + rnd() * (config.sizeMax - config.sizeMin)) *
          factor *
          shrink;
        const w = Math.min(wanted, maxW);
        const h = Math.min(w * (0.52 + rnd() * 0.5), maxH);
        const x = region.left + rnd() * Math.max(0, maxW - w);
        const y = region.top + rnd() * Math.max(0, maxH - h);
        const rect = { x, y, w, h };
        if (boxes.some((box) => overlaps(rect, box))) continue;
        const added = (w * h * config.fillFactor) / floor;
        if (coverage() + added > config.maxCoverage) continue;
        return rect;
      }
    }
    return null;
  }

  /* ---------------------------------------------------------------- patches */

  /**
   * The missing-texture pattern: rectangular chunks of an opaque pixel grid,
   * with notches and one stray fragment. Every shape is aligned to `cellPx`, so
   * the silhouette steps instead of feathering.
   */
  function buildBlocks(cols, rows, rnd) {
    const on = new Set();
    const chunks = 2 + Math.floor(rnd() * 3);
    for (let index = 0; index < chunks; index += 1) {
      const cw = Math.max(2, Math.round(cols * (0.3 + rnd() * 0.5)));
      const ch = Math.max(2, Math.round(rows * (0.3 + rnd() * 0.55)));
      const x0 = Math.floor(rnd() * Math.max(1, cols - cw + 1));
      const y0 = Math.floor(rnd() * Math.max(1, rows - ch + 1));
      for (let y = y0; y < Math.min(rows, y0 + ch); y += 1) {
        for (let x = x0; x < Math.min(cols, x0 + cw); x += 1) {
          on.add(y * cols + x);
        }
      }
    }

    // Bite a couple of notches out, so it is not just a rectangle.
    const notches = 1 + Math.floor(rnd() * 3);
    for (let index = 0; index < notches; index += 1) {
      const nw = 1 + Math.floor(rnd() * 2);
      const nh = 1 + Math.floor(rnd() * 2);
      const x0 = Math.floor(rnd() * cols);
      const y0 = Math.floor(rnd() * rows);
      for (let y = y0; y < y0 + nh; y += 1) {
        for (let x = x0; x < x0 + nw; x += 1) on.delete(y * cols + x);
      }
    }

    // One detached fragment: damaged data, not a panel.
    const strayX = Math.floor(rnd() * cols);
    const strayY = Math.floor(rnd() * rows);
    on.add(strayY * cols + strayX);
    if (rnd() > 0.4 && strayX + 1 < cols) on.add(strayY * cols + strayX + 1);
    if (!on.size) on.add(Math.floor(rows / 2) * cols + Math.floor(cols / 2));

    const cells = [];
    for (const index of [...on].sort((a, b) => a - b)) {
      const x = index % cols;
      const y = Math.floor(index / cols);
      // A two-tone checker is the base; brighter cells are the damaged pixels.
      const checker = (x + y) % 2 === 0;
      let color = checker ? "#071917" : "#04100e";
      const roll = rnd();
      if (roll > 0.9) color = "#7bd2cb";
      else if (roll > 0.76) color = "#2f8b81";
      else if (roll > 0.58) color = "#164a44";
      else if (roll > 0.46) color = "#0d2b27";
      cells.push({ x, y, color, live: rnd() < 0.05 });
    }
    // A couple of guaranteed bright details make it read as broken memory.
    if (cells.length > 6) {
      cells[Math.floor(cells.length * 0.25)].color = "#7bd2cb";
      cells[Math.floor(cells.length * 0.72)].color = "#2f8b81";
    }
    return cells;
  }

  /**
   * Add one patch now. Used by the timer and, once, by the discovery beat.
   * @returns {null | {id: string, el: HTMLElement, rect: DOMRect, cleanup: Function}}
   */
  function spawnPatch({ reason = "timer", scale = 1 } = {}) {
    if (destroyed) return null;
    const node = mountLayer();
    if (!node) return null;
    const geometry = nextGeometry(scale);
    if (!geometry) return null;

    seq += 1;
    const id = `patch-${seq}`;
    const unit = Math.max(4, Math.round(config.cellPx));
    const cols = Math.max(3, Math.round(geometry.w / unit));
    const rows = Math.max(2, Math.round(geometry.h / unit));
    const width = cols * unit;
    const height = rows * unit;
    // The grid is quantised, so keep the whole block inside the band.
    const band = encounterRegion();
    const left = Math.min(
      Math.max(geometry.x, band.left),
      Math.max(band.left, band.right - width),
    );
    const top = Math.min(
      Math.max(geometry.y, band.top),
      Math.max(band.top, band.bottom - height),
    );

    const patchEl = el("div", {
      class: "corrupt-patch pixel-patch",
      dataset: { patchId: id, reason },
      "aria-hidden": "true",
    });
    patchEl.style.left = `${Math.round(left)}px`;
    patchEl.style.top = `${Math.round(top)}px`;
    patchEl.style.width = `${width}px`;
    patchEl.style.height = `${height}px`;

    const rnd = makeRandom(hashSeed(`${sessionSeed}:${id}:blocks`));
    const cells = [];
    for (const block of buildBlocks(cols, rows, rnd)) {
      const blockEl = el("span", {
        class: "pixel-patch__cell",
        "aria-hidden": "true",
      });
      blockEl.style.left = `${block.x * unit}px`;
      blockEl.style.top = `${block.y * unit}px`;
      blockEl.style.width = `${unit}px`;
      blockEl.style.height = `${unit}px`;
      blockEl.style.backgroundColor = block.color;
      if (block.live) blockEl.classList.add("is-live");
      patchEl.append(blockEl);
      cells.push({
        el: blockEl,
        x: block.x * unit + unit / 2,
        y: block.y * unit + unit / 2,
      });
    }
    node.append(patchEl);

    const patch = {
      id,
      el: patchEl,
      cells,
      area: cells.length * unit * unit,
      cleanup() {
        patchEl.remove();
      },
    };
    patches.set(id, patch);
    root?.classList.add("is-corrupted");
    emit("patch:add", patch);
    return patch;
  }

  function coverage() {
    const area = layerRect();
    const floor = Math.max(1, area.width * area.height);
    let painted = 0;
    for (const patch of patches.values()) painted += patch.area;
    return Math.min(1, painted / floor);
  }

  /* --------------------------------------------------------------- schedule */

  function clearGrace() {
    if (graceTimer !== null) {
      timers.clearTimeout(graceTimer);
      graceTimer = null;
    }
  }

  function clearSchedule() {
    if (patchTimer !== null) {
      timers.clearTimeout(patchTimer);
      patchTimer = null;
    }
  }

  function scheduleNext(delay) {
    clearSchedule();
    if (!tracking || destroyed) return;
    patchTimer = timers.setTimeout(() => {
      patchTimer = null;
      if (!tracking || destroyed) return;
      if (doc && doc.visibilityState === "hidden") {
        scheduleNext(config.hiddenRetryMs);
        return;
      }
      if (patches.size < config.maxPatches) spawnPatch({ reason: "timer" });
      scheduleNext(
        config.intervalMinMs + random() * (config.intervalMaxMs - config.intervalMinMs),
      );
    }, Math.max(0, delay));
    if (patchTimer && typeof patchTimer.unref === "function") patchTimer.unref();
  }

  /**
   * A Twister's message window is open: remember where it is and start the
   * countdown. Without a window there is no area to corrupt, so this refuses —
   * an ordinary thought, which never calls this at all, cannot start it.
   *
   * @param {{window?: Element}} [options]
   */
  function startEncounter({ window: windowEl } = {}) {
    if (destroyed || tracking) return;
    const node = mountLayer();
    const rect = windowEl && windowEl.getBoundingClientRect
      ? windowEl.getBoundingClientRect()
      : null;
    if (!node || !rect || rect.width < 1 || rect.height < 1) return;
    const base = node.getBoundingClientRect();
    anchor = {
      left: rect.left - base.left,
      top: rect.top - base.top,
      right: rect.right - base.left,
      bottom: rect.bottom - base.top,
    };
    tracking = true;
    sessionSeed = (hashSeed(`${now()}:${Math.floor(random() * 1e9)}`) >>> 0) || 1;
    emit("encounter:start");
    clearGrace();
    graceTimer = timers.setTimeout(() => {
      graceTimer = null;
      scheduleNext(0);
    }, Math.max(0, config.graceMs));
    if (graceTimer && typeof graceTimer.unref === "function") {
      graceTimer.unref();
    }
  }

  /** The window closed: no further corruption, ever, from that encounter. */
  function stopEncounter() {
    if (!tracking && graceTimer === null && patchTimer === null) return;
    tracking = false;
    clearGrace();
    clearSchedule();
    // The encounter is over; its band no longer applies. Patches stay for the
    // brush, and the scripted discovery trace falls back to the free desktop.
    anchor = null;
    emit("encounter:stop");
  }

  /* --------------------------------------------------------------- cleaning */

  /**
   * Erase the texture block by block, nearest the brush first. Whole cells are
   * removed (never faded), so the original desktop surface shows through
   * between the remaining blocks as they go.
   */
  function dissolve(patch, point = null) {
    if (!patch || !patches.has(patch.id)) return;
    patches.delete(patch.id);
    patch.el.classList.add("is-cleaning");
    const originX = point ? Number(point.x) - patch.el.offsetLeft : null;
    const originY = point ? Number(point.y) - patch.el.offsetTop : null;
    const span = Math.max(1, patch.el.offsetWidth, patch.el.offsetHeight);
    const height = Math.max(1, patch.el.offsetHeight);
    for (const cell of patch.cells) {
      const distance =
        originX === null || originY === null
          ? cell.y / height
          : Math.hypot(cell.x - originX, cell.y - originY) / span;
      cell.el.style.setProperty(
        "--erase-delay",
        `${Math.round(Math.min(1, distance) * config.recoverMs)}ms`,
      );
      cell.el.classList.add("is-gone");
    }
    timers.setTimeout(() => patch.el.remove(), config.recoverMs + 260)?.unref?.();
    if (!patches.size) root?.classList.remove("is-corrupted");
    emit("patch:remove", patch);
  }

  /**
   * Clean only what the brush actually touches.
   * @param {{x: number, y: number, radius?: number}} point layer-relative
   * @returns {number} patches dissolved
   */
  function cleanAt({ x, y, radius = config.brushRadius } = {}) {
    if (destroyed) return 0;
    const reach = Math.max(6, Number(radius) || config.brushRadius) * 0.85;
    let cleaned = 0;
    for (const patch of [...patches.values()]) {
      const left = patch.el.offsetLeft;
      const top = patch.el.offsetTop;
      const width = patch.el.offsetWidth;
      const height = patch.el.offsetHeight;
      const nearestX = Math.min(Math.max(x, left), left + width);
      const nearestY = Math.min(Math.max(y, top), top + height);
      if (Math.hypot(x - nearestX, y - nearestY) > reach) continue;
      dissolve(patch, { x, y });
      cleaned += 1;
    }
    return cleaned;
  }

  function cleanAll() {
    const cleaned = patches.size;
    for (const patch of [...patches.values()]) dissolve(patch);
    return cleaned;
  }

  return {
    startEncounter,
    stopEncounter,
    isTracking: () => tracking,
    // Diagnostic: the recorded alert box for the running encounter, if any.
    getAnchor: () => (anchor ? { ...anchor } : null),
    spawnPatch,
    cleanAt,
    cleanAll,
    count: () => patches.size,
    getCoverage: coverage,
    getPatches: () =>
      [...patches.values()].map((patch) => ({ id: patch.id, el: patch.el })),
    subscribe(listener) {
      if (typeof listener !== "function") return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      destroyed = true;
      tracking = false;
      clearGrace();
      clearSchedule();
      for (const patch of [...patches.values()]) patch.cleanup();
      patches.clear();
      listeners.clear();
      root?.classList.remove("is-corrupted");
      if (layer && layer.dataset.corruptionLayer === "desktop") layer.remove();
      layer = null;
    },
  };
}
