/**
 * Input capability — the single place that answers "is this a touch device?".
 *
 * Desktop behaviour is never inferred from the viewport width: a narrow window
 * on a laptop keeps its mouse, keyboard, double-click and drag-and-drop. The
 * primary pointer decides, which is what `(pointer: coarse)` reports, and the
 * answer is mirrored on the root element so the stylesheet can react to the
 * same fact as the modules.
 *
 * The mode can change at runtime (a tablet with a mouse attached, a phone with
 * a keyboard), so callers that build controls can subscribe instead of reading
 * the value once.
 */

const coarseQuery =
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(pointer: coarse)")
    : null;

const listeners = new Set();
let coarse = Boolean(coarseQuery && coarseQuery.matches);

function paint() {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.pointer = coarse ? "coarse" : "fine";
}

function announce() {
  paint();
  for (const listener of [...listeners]) {
    try {
      listener(coarse);
    } catch (error) {
      console.error("[input] listener failed", error);
    }
  }
}

paint();

if (coarseQuery) {
  const onChange = (event) => {
    coarse = Boolean(event.matches);
    announce();
  };
  if (typeof coarseQuery.addEventListener === "function") {
    coarseQuery.addEventListener("change", onChange);
  } else if (typeof coarseQuery.addListener === "function") {
    coarseQuery.addListener(onChange);
  }
}

/** True while the primary pointer is a finger or a stylus on a touch screen. */
export function isCoarsePointer() {
  return coarse;
}

/** True when the machine can produce touch events at all (hybrids included). */
export function isTouchCapable() {
  if (coarse) return true;
  const points =
    typeof navigator !== "undefined" ? Number(navigator.maxTouchPoints) || 0 : 0;
  return points > 0;
}

/**
 * Subscribe to capability changes.
 * @param {(coarse: boolean) => void} listener
 * @returns {() => void} unsubscribe
 */
export function onPointerModeChange(listener) {
  if (typeof listener !== "function") return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}
