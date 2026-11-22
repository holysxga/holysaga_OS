/**
 * Cleaning brush — the cursor tool unlocked by Sacred Digital.
 *
 * It draws its own ring, follows the pointer over the desktop and asks the
 * caller to clean at each point it passes. It never removes anything itself:
 * the corruption layer owns its patches, so the brush cannot touch a window, an
 * icon or an image. Dragging paints; a single click cleans one spot.
 *
 * Inactive by default. `setActive()` is the only switch, so unlocking never
 * takes over the pointer without a click.
 *
 * While armed it also owns the press: desktop icons, filenames and text cannot
 * be selected or dragged out from under a cleaning stroke, and no native
 * selection/drag starts. Everything is registered for the armed window only,
 * so a deactivated brush leaves ordinary desktop interaction untouched.
 *
 * In-window surfaces can register with `registerSurface({ root, cleanAt })`.
 * The brush then cleans that content only while the pointer is actually over
 * its root, respecting the window stacking order. Unregistered windows remain
 * completely protected, so the established desktop behaviour is unchanged.
 */
import { el } from "../core/dom.js";

export const BRUSH_CONFIG = Object.freeze({
  /* Minimum distance, in px, between two cleaning samples while dragging. */
  stepPx: 8,
  /* The visible ring is slightly larger than the cleaned spot. */
  ringPx: 56,
  /* Reach used by registered in-window surfaces. */
  cleanRadiusPx: 42,
});

/** Never clean while the pointer is over something interactive. */
const INTERACTIVE = ".window, .mascot, .shortcut, .deskfile";
/** Desktop chrome that stays inert while the brush is armed. */
const DESKTOP_ITEMS = ".shortcut, .deskfile, .shortcut-item, .deskfile-item";

export function createCleaningBrush(options = {}) {
  const root = options.root || null;
  const config = { ...BRUSH_CONFIG, ...(options.config || {}) };
  const onClean = typeof options.onClean === "function" ? options.onClean : () => 0;
  const onActiveChange =
    typeof options.onActiveChange === "function" ? options.onActiveChange : null;

  const ring = el("span", { class: "brush__ring", "aria-hidden": "true" });
  const core = el("span", {
    class: "brush__core",
    "aria-hidden": "true",
    text: "⌫",
  });
  const brush = el(
    "div",
    { class: "brush", "aria-hidden": "true", hidden: true },
    [ring, core],
  );

  const surfaces = new Set();

  let active = false;
  let painting = false;
  let lastPoint = null;
  let destroyed = false;
  let moveFrame = null;
  let pending = null;

  function bounds() {
    if (!root) return { left: 0, top: 0, width: 1024, height: 700 };
    const rect = root.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  }

  function place(clientX, clientY) {
    const area = bounds();
    const x = clientX - area.left;
    const y = clientY - area.top;
    brush.style.left = `${Math.round(x)}px`;
    brush.style.top = `${Math.round(y)}px`;
    brush.hidden = false;
    return { x, y };
  }

  function visibleSurface(surface) {
    if (!surface || !surface.root || !surface.root.isConnected) return null;
    const rect = surface.root.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return null;
    const style = getComputedStyle(surface.root);
    if (style.display === "none" || style.visibility === "hidden") return null;
    return rect;
  }

  /**
   * Find the registered cleaning surface under the pointer. The topmost window
   * wins: a surface in a window hidden behind another window must not be
   * cleaned through it.
   */
  function surfaceAt(clientX, clientY) {
    if (!surfaces.size) return null;
    const top = document.elementFromPoint?.(clientX, clientY) || null;
    for (const surface of [...surfaces].reverse()) {
      const rect = visibleSurface(surface);
      if (!rect) continue;
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        continue;
      }
      const ownerWindow = surface.root.closest?.(".window") || null;
      const topWindow = top?.closest?.(".window") || null;
      if (ownerWindow && topWindow && ownerWindow !== topWindow) continue;
      if (top?.closest?.(".mascot")) continue;
      return { surface, rect };
    }
    return null;
  }

  function isWithinSurface(target) {
    if (!target || !surfaces.size) return false;
    for (const surface of surfaces) {
      if (surface.root && surface.root.contains(target)) return true;
    }
    return false;
  }

  /** Clean a registered in-window surface, or fall back to the desktop layer. */
  function clean(clientX, clientY) {
    const hit = surfaceAt(clientX, clientY);
    if (hit) {
      const { surface, rect } = hit;
      surface.cleanAt({
        x: clientX - rect.left,
        y: clientY - rect.top,
        radius: config.cleanRadiusPx,
      });
      return;
    }
    const area = bounds();
    onClean({ x: clientX - area.left, y: clientY - area.top });
  }

  function onPointerMove(event) {
    if (destroyed) return;
    const point = { x: event.clientX, y: event.clientY };
    if (moveFrame !== null) cancelAnimationFrame(moveFrame);
    moveFrame = requestAnimationFrame(() => {
      moveFrame = null;
      place(point.x, point.y);
    });
    if (!painting || !active) return;
    if (lastPoint) {
      const travel = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
      if (travel < config.stepPx) return;
    }
    lastPoint = point;
    clean(point.x, point.y);
  }

  function isInteractive(target) {
    return Boolean(target && target.closest && target.closest(INTERACTIVE));
  }

  function isDesktopItem(target) {
    return Boolean(target && target.closest && target.closest(DESKTOP_ITEMS));
  }

  function onPointerDown(event) {
    if (!active || event.button !== 0) return;
    const hit = surfaceAt(event.clientX, event.clientY);
    if (isInteractive(event.target) && !hit) {
      // Icons stay inert: a cleaning press must not focus, select or drag them.
      if (isDesktopItem(event.target)) event.preventDefault();
      return;
    }
    painting = true;
    lastPoint = { x: event.clientX, y: event.clientY };
    clean(event.clientX, event.clientY);
    // The stroke owns the press: no text selection, focus ring or native drag.
    if (event.cancelable) event.preventDefault();
    // Registered surfaces are cleaning targets, not window controls.
    if (hit) event.stopPropagation();
  }

  /* Windows keep their own text interactions; registered surfaces do not. */
  function textAllowed(target) {
    if (isWithinSurface(target)) return false;
    return Boolean(target && target.closest && target.closest(".window"));
  }

  function onMouseDown(event) {
    if (!active || event.button !== 0 || textAllowed(event.target)) return;
    if (event.cancelable) event.preventDefault();
  }

  function onSelectStart(event) {
    if (!active || textAllowed(event.target)) return;
    if (event.cancelable) event.preventDefault();
  }

  function onDragStart(event) {
    if (!active) return;
    if (event.cancelable) event.preventDefault();
  }

  /* A brush click is a cleaning click: never a selection or a double-click open. */
  function onDesktopClick(event) {
    if (!active || !isDesktopItem(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function endPaint() {
    painting = false;
    lastPoint = null;
  }

  function onPointerLeave() {
    endPaint();
    if (!active) brush.hidden = true;
  }

  function onKeyDown(event) {
    if (event.key === "Escape" && active) setActive(false);
  }

  function listen(activeNow) {
    if (!root || typeof root.addEventListener !== "function") return;
    if (activeNow) {
      root.addEventListener("pointermove", onPointerMove, { passive: true });
      root.addEventListener("pointerdown", onPointerDown, { capture: true });
      root.addEventListener("pointerleave", onPointerLeave, { passive: true });
      root.addEventListener("mousedown", onMouseDown, { capture: true });
      root.addEventListener("selectstart", onSelectStart, { capture: true });
      root.addEventListener("dragstart", onDragStart, { capture: true });
      root.addEventListener("click", onDesktopClick, { capture: true });
      root.addEventListener("dblclick", onDesktopClick, { capture: true });
      window.addEventListener("pointerup", endPaint);
      window.addEventListener("pointercancel", endPaint);
      document.addEventListener("keydown", onKeyDown);
    } else {
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerdown", onPointerDown, { capture: true });
      root.removeEventListener("pointerleave", onPointerLeave);
      root.removeEventListener("mousedown", onMouseDown, { capture: true });
      root.removeEventListener("selectstart", onSelectStart, { capture: true });
      root.removeEventListener("dragstart", onDragStart, { capture: true });
      root.removeEventListener("click", onDesktopClick, { capture: true });
      root.removeEventListener("dblclick", onDesktopClick, { capture: true });
      window.removeEventListener("pointerup", endPaint);
      window.removeEventListener("pointercancel", endPaint);
      document.removeEventListener("keydown", onKeyDown);
    }
  }

  function setActive(next) {
    const value = Boolean(next);
    if (value === active || destroyed) return active;
    active = value;
    root?.classList.toggle("is-brush-active", active);
    brush.classList.toggle("is-armed", active);
    if (!active) {
      endPaint();
      brush.hidden = true;
    }
    listen(active);
    onActiveChange?.(active);
    return active;
  }

  brush.style.setProperty("--brush-ring", `${config.ringPx}px`);
  if (root) root.append(brush);

  return {
    setActive,
    toggle: () => setActive(!active),
    isActive: () => active,
    registerSurface(surface) {
      if (!surface || !surface.root || typeof surface.cleanAt !== "function") {
        return () => {};
      }
      surfaces.add(surface);
      return () => surfaces.delete(surface);
    },
    destroy() {
      destroyed = true;
      setActive(false);
      surfaces.clear();
      if (moveFrame !== null) cancelAnimationFrame(moveFrame);
      brush.remove();
    },
  };
}
