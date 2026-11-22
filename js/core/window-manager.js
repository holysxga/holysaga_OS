/**
 * Window manager — owns window creation, stacking, dragging, minimizing and
 * the connection to the taskbar. Applications stay unaware of all of it; they
 * only mount their content into the window body.
 *
 * To add a future mechanic (unlock notifications, visualizer windows, a maze),
 * create another app descriptor and call manager.open(app). Nothing here needs
 * to change.
 */
import { el } from "./dom.js";
import { onLocaleChange, t } from "../i18n/index.js";

const MARGIN = 10;
const MIN_WIDTH = 290;
const MIN_HEIGHT = 170;
const CASCADE_STEP = 28;
const CASCADE_LIMIT = 6;

export function createWindowManager({ layer, services = {} }) {
  const records = new Map();
  const listeners = new Set();
  let activeId = null;
  let topZ = 100;
  let cascade = 0;

  function list() {
    return [...records.values()]
      // Alerts are not programs: they never get a taskbar button.
      .filter((rec) => rec.app.kind !== "dialog")
      .map((rec) => ({
      id: rec.app.id,
      title: t(rec.app.titleKey),
      icon: rec.app.icon,
        minimized: rec.minimized,
        active: rec.app.id === activeId,
      }));
  }

  function notify() {
    const snapshot = list();
    for (const listener of [...listeners]) listener(snapshot);
  }

  function subscribe(listener) {
    listeners.add(listener);
    listener(list());
    return () => listeners.delete(listener);
  }

  function layerSize() {
    const rect = layer.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }

  /** Keep a window fully reachable: inside the layer when it fits, pinned otherwise. */
  function clampRecord(rec) {
    if (rec.minimized) return;
    const { width, height } = layerSize();
    const w = rec.win.offsetWidth || Math.min(rec.pref.w, width || rec.pref.w);
    const h = rec.win.offsetHeight || Math.min(rec.pref.h, height || rec.pref.h);
    const maxLeft = Math.max(0, width - w);
    const maxTop = Math.max(0, height - h);
    rec.left = Math.round(Math.max(0, Math.min(rec.left, maxLeft)));
    rec.top = Math.round(Math.max(0, Math.min(rec.top, maxTop)));
    rec.win.style.left = `${rec.left}px`;
    rec.win.style.top = `${rec.top}px`;
  }

  /** Fit the window to the layer, then keep it on screen. */
  function layout(rec) {
    if (rec.minimized) return;
    const { width, height } = layerSize();
    const maxW = Math.max(MIN_WIDTH, width - MARGIN * 2);
    const maxH = Math.max(MIN_HEIGHT, height - MARGIN * 2);
    rec.win.style.width = `${Math.min(rec.pref.w, maxW)}px`;
    rec.win.style.height = `${Math.min(rec.pref.h, maxH)}px`;
    clampRecord(rec);
  }

  function layoutAll() {
    for (const rec of records.values()) layout(rec);
  }

  function setActive(id) {
    activeId = id;
    for (const rec of records.values()) {
      const isActive = rec.app.id === id;
      rec.win.classList.toggle("is-inactive", !isActive);
      if (isActive) rec.win.style.zIndex = String(++topZ);
    }
  }

  function startDrag(event, rec) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.target.closest("button")) return;
    event.preventDefault();

    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = rec.left;
    const startTop = rec.top;

    document.documentElement.classList.add("is-dragging");

    const onMove = (moveEvent) => {
      rec.left = startLeft + (moveEvent.clientX - startX);
      rec.top = startTop + (moveEvent.clientY - startY);
      clampRecord(rec);
    };

    const onEnd = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      document.documentElement.classList.remove("is-dragging");
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  }

  function build(app) {
    const { width: layerW, height: layerH } = layerSize();
    const isDialog = app.kind === "dialog";
    const idBase = `win-${app.id}`;
    const titleId = `${idBase}-title`;

    const title = el("h2", {
      class: "window__title",
      id: titleId,
      text: t(app.titleKey),
    });

    const minimizeBtn = el("button", {
      class: "window__btn window__btn--min",
      type: "button",
      title: t("window.minimize"),
      "aria-label": t("window.minimize"),
      on: {
        click: (event) => {
          event.stopPropagation();
          minimize(app.id);
        },
      },
    });

    const closeBtn = el("button", {
      class: "window__btn window__btn--close",
      type: "button",
      title: t("window.close"),
      "aria-label": t("window.close"),
      on: {
        click: (event) => {
          event.stopPropagation();
          close(app.id);
        },
      },
    });

    const titlebar = el(
      "header",
      { class: "window__titlebar" },
      [
        el("img", {
          class: "window__icon",
          src: app.icon,
          alt: "",
          width: 16,
          height: 16,
          draggable: "false",
        }),
        title,
        el(
          "div",
          { class: "window__controls" },
          // A dialog has nothing to minimize to: only its close control.
          isDialog ? [closeBtn] : [minimizeBtn, closeBtn],
        ),
      ],
    );

    const body = el("div", { class: "window__body" });

    const win = el(
      "section",
      {
        class: ["window", "is-inactive", isDialog ? "window--dialog" : "", app.variant ? `window--${app.variant}` : ""]
          .filter(Boolean)
          .join(" "),
        role: "dialog",
        "aria-labelledby": titleId,
        dataset: { appId: app.id },
      },
      [titlebar, body],
    );

    // Desktop placement: centered-ish on wide screens, stacked on narrow ones.
    const prefW = app.size.w;
    const prefH = app.size.h;
    const width = Math.min(prefW, Math.max(MIN_WIDTH, layerW - MARGIN * 2));
    const height = Math.min(prefH, Math.max(MIN_HEIGHT, layerH - MARGIN * 2));
    const narrow = layerW < 640;
    let left;
    let top;

    if (app.placement) {
      // The caller chose a spot (alerts scatter); clamping still applies.
      left = app.placement.left;
      top = app.placement.top;
    } else {
      const step = (cascade % CASCADE_LIMIT) * CASCADE_STEP;
      cascade += 1;
      left = narrow ? MARGIN : Math.round((layerW - width) / 2) - 72 + step;
      top = narrow ? MARGIN + Math.round(step / 2) : Math.round((layerH - height) / 2) - 56 + step;
    }

    const rec = {
      app,
      win,
      body,
      title,
      minimizeBtn,
      closeBtn,
      pref: { w: prefW, h: prefH },
      left: Math.max(0, left),
      top: Math.max(0, top),
      minimized: false,
      cleanup: null,
    };

    titlebar.addEventListener("pointerdown", (event) => {
      focus(app.id);
      startDrag(event, rec);
    });
    win.addEventListener("pointerdown", () => focus(app.id), { capture: true });

    layer.append(win);
    layout(rec);
    rec.win.style.zIndex = String(++topZ);

    try {
      const result = app.mount(body, {
        close: () => close(app.id),
        focus: () => focus(app.id),
        // Lets an app open a companion window not listed in the registry
        // (the MUSIC PLAYER uses it for its visualizer, IMAGE DUMP for its
        // viewer).
        openWindow: (target) => open(target),
        // Desktop-wide services an app may need without importing boot code
        // (currently the M.I.L.O. dock).
        ...services,
      });
      if (typeof result === "function") rec.cleanup = result;
      else if (result && typeof result.destroy === "function") rec.cleanup = result.destroy;
    } catch (error) {
      console.error(`[window] failed to mount "${app.id}"`, error);
      body.append(
        el("p", { class: "window__error", text: "This program failed to start." }),
      );
    }

    return rec;
  }

  function raise(id) {
    const rec = records.get(id);
    if (rec) rec.win.style.zIndex = String(++topZ);
  }

  function open(app) {
    const existing = records.get(app.id);
    if (existing) {
      // No duplicates: reopen the running copy instead.
      focus(app.id);
      return existing;
    }
    const rec = build(app);
    records.set(app.id, rec);
    if (app.kind === "dialog") {
      // Appear above, but do not steal the active-program state.
      raise(app.id);
      return rec;
    }
    setActive(app.id);
    notify();
    return rec;
  }

  function close(id) {
    const rec = records.get(id);
    if (!rec) return;
    if (typeof rec.cleanup === "function") rec.cleanup();
    rec.win.remove();
    records.delete(id);
    if (activeId === id) {
      activeId = null;
      const next = [...records.values()]
        .filter((item) => !item.minimized && item.app.kind !== "dialog")
        .sort((a, b) => Number(b.win.style.zIndex) - Number(a.win.style.zIndex))[0];
      if (next) setActive(next.app.id);
    }
    notify();
  }

  function focus(id) {
    const rec = records.get(id);
    if (!rec) return;
    if (rec.minimized) {
      rec.minimized = false;
      rec.win.classList.remove("is-minimized");
    }
    setActive(id);
    notify();
  }

  function minimize(id) {
    const rec = records.get(id);
    if (!rec || rec.minimized) return;
    rec.minimized = true;
    rec.win.classList.add("is-minimized");
    if (activeId === id) {
      activeId = null;
      const next = [...records.values()]
        .filter((item) => !item.minimized && item.app.kind !== "dialog")
        .sort((a, b) => Number(b.win.style.zIndex) - Number(a.win.style.zIndex))[0];
      if (next) setActive(next.app.id);
      else notify();
    }
    notify();
  }

  /** Taskbar behavior: focused window minimizes, anything else comes forward. */
  function toggle(id) {
    const rec = records.get(id);
    if (!rec) return;
    if (!rec.minimized && rec.app.id === activeId) minimize(id);
    else focus(id);
  }

  function minimizeAll() {
    for (const rec of records.values()) {
      rec.minimized = true;
      rec.win.classList.add("is-minimized");
    }
    activeId = null;
    notify();
  }

  const stopLocale = onLocaleChange(() => {
    for (const rec of records.values()) {
      rec.title.textContent = t(rec.app.titleKey);
      rec.minimizeBtn.title = t("window.minimize");
      rec.minimizeBtn.setAttribute("aria-label", t("window.minimize"));
      rec.closeBtn.title = t("window.close");
      rec.closeBtn.setAttribute("aria-label", t("window.close"));
    }
    notify();
  });

  const onResize = () => layoutAll();
  window.addEventListener("resize", onResize);

  return {
    open,
    close,
    focus,
    minimize,
    minimizeAll,
    toggle,
    subscribe,
    isOpen: (id) => records.has(id),
    /** The real element for an open program, so desktop services can follow it. */
    windowFor: (id) => records.get(id)?.win || null,
    destroy() {
      stopLocale();
      window.removeEventListener("resize", onResize);
    },
  };
}
