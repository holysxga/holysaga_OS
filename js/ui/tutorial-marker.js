/**
 * Tutorial marker — a contextual circular indicator around a real control.
 *
 * It is not decoration: it exists only while M.I.L.O. is pointing at something
 * (the Sacred Digital button, or one corrupted patch), and it always reads the
 * target's live box, so scrolling, window resizing, a taskbar reflow or a
 * language switch keeps the ring exactly on the element. Nothing is positioned
 * from a hard-coded screen coordinate.
 *
 * The ring is drawn in the viewport (`position: fixed`) above the desktop but
 * below M.I.L.O.'s dialogue, and it never intercepts the pointer.
 */

export function createTutorialMarker(options = {}) {
  const doc = options.document || (typeof document === "undefined" ? null : document);
  const className = options.className ? ` ${options.className}` : "";
  const padding = Number.isFinite(options.padding) ? options.padding : 8;
  const root = el("span", {
    class: `tutorial-marker${className}`,
    "aria-hidden": "true",
  });
  const ring = el("span", { class: "tutorial-marker__ring" });
  root.append(ring);

  let target = null;
  let frame = null;
  let destroyed = false;

  function el(tag, attributes = {}) {
    const node = doc.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) {
      if (name === "class") node.className = value;
      else node.setAttribute(name, value);
    }
    return node;
  }

  function place() {
    if (destroyed || !target) return;
    if (!target.isConnected) {
      hide();
      return;
    }
    const rect = target.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const size = Math.max(rect.width, rect.height) + padding * 2;
    root.style.width = `${Math.round(size)}px`;
    root.style.height = `${Math.round(size)}px`;
    root.style.left = `${Math.round(rect.left + rect.width / 2 - size / 2)}px`;
    root.style.top = `${Math.round(rect.top + rect.height / 2 - size / 2)}px`;
  }

  function follow() {
    if (destroyed || !target) return;
    place();
    frame = requestAnimationFrame(follow);
  }

  function start() {
    if (frame !== null || destroyed) return;
    frame = requestAnimationFrame(follow);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
  }

  function stop() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    window.removeEventListener("resize", place);
    window.removeEventListener("scroll", place, true);
  }

  function hide() {
    stop();
    target = null;
    root.classList.remove("is-visible");
    root.remove();
  }

  place();
  if (doc?.body) doc.body.append(root);

  return {
    /** Point the ring at an element. Replaces any previous target. */
    show(nextTarget) {
      if (destroyed || !nextTarget) return false;
      const rect = nextTarget.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return false;
      target = nextTarget;
      if (!root.isConnected) doc.body.append(root);
      place();
      root.classList.add("is-visible");
      start();
      return true;
    },
    hide,
    isVisible: () => Boolean(target && root.classList.contains("is-visible")),
    getTarget: () => target,
    destroy() {
      stop();
      destroyed = true;
      target = null;
      root.remove();
    },
  };
}
