/**
 * Collectible desktop items — the .wav file a visitor finds and the tool it
 * unlocks.
 *
 * A file is a real desktop icon on its own layer: one click selects it,
 * dragging it paints a ghost that follows the pointer over the desktop. Drop it
 * on a matching collection slot and the slot calls preventDefault() on the
 * `holysaga:file-drop` event to accept it; this module then removes the icon so
 * one file can never be collected twice. A rejected slot simply does not accept
 * it, and the icon stays where it was.
 *
 * Touch has no drag: a tap selects the file, and the collection slot's own tap
 * then dispatches the very same `holysaga:file-drop` event, so validation,
 * refusal and progression stay in one place. Selecting a file never collects
 * it; only choosing a slot does.
 *
 * Payloads carry stable IDs, never the visible name, so translations can change
 * without breaking progression.
 *
 * The tool is not a desktop icon: it mounts into the taskbar's tool strip,
 * right after Start, so it belongs to the system chrome and stays clickable
 * while windows are open. It is a button, not a draggable icon.
 */
import { el } from "../core/dom.js";
import { isCoarsePointer } from "../core/input.js";
import { onLocaleChange, t } from "../i18n/index.js";

const DRAG_THRESHOLD = 5;
const COLLECT_ANIMATION_MS = 480;
/* Matches the 6 × 900ms stepped highlight in desktop.css. */
const TOOL_FRESH_MS = 5_400;

export function createDesktopFiles(options = {}) {
  const root = options.root || null;
  const onToolActivate =
    typeof options.onToolActivate === "function" ? options.onToolActivate : null;
  /* Returns the taskbar strip tools mount into, or null before it exists. */
  const toolHost = typeof options.toolHost === "function" ? options.toolHost : null;

  const files = new Map();
  const tools = new Map();
  let filesLayer = null;
  let drag = null;
  let destroyed = false;
  /* The file chosen by a tap, waiting for the visitor to pick a slot. */
  let selectedId = null;

  const iconPath = options.icon || "assets/icons/audio-file.svg";

  /* ------------------------------------------------------------------ files */

  function fileLabel(entry) {
    return t(entry.nameKey);
  }

  /**
   * The file column lives beside the program column, on its own layer: the
   * shortcut list is a fixed-height column that is already full, and an item
   * appended there would fall under the taskbar.
   */
  function fileLayer() {
    if (filesLayer && filesLayer.isConnected) return filesLayer;
    if (!root) return null;
    filesLayer = el("div", {
      class: "desktop-files",
      role: "list",
      "aria-label": t("file.region"),
    });
    root.append(filesLayer);
    return filesLayer;
  }

  function paintFile(entry) {
    const name = fileLabel(entry);
    const hint = isCoarsePointer() ? t("file.tapHint") : t("file.dragHint");
    entry.name.textContent = name;
    entry.button.setAttribute("aria-label", `${name}. ${hint}`);
    entry.button.title = `${name} — ${hint}`;
    const cancelLabel = t("file.cancelSelection");
    entry.cancel.title = cancelLabel;
    entry.cancel.setAttribute("aria-label", `${name}. ${cancelLabel}`);
  }

  /** Visual selection only: choosing a file never collects it. */
  function setSelected(id) {
    selectedId = id && files.has(id) ? id : null;
    for (const entry of files.values()) {
      const active = entry.id === selectedId;
      entry.button.classList.toggle("is-selected", active);
      entry.item.classList.toggle("is-selected", active);
    }
    // MUSIC PLAYER mirrors the chosen file and offers the same cancel action.
    window.dispatchEvent(
      new CustomEvent("holysaga:file-selection", { detail: { id: selectedId } }),
    );
  }

  function addFile({ id, trackId, nameKey = "sacred.file.name" } = {}) {
    if (destroyed || !id || files.has(id)) return files.get(id) || null;
    const host = fileLayer();
    if (!host) return null;

    const name = el("span", { class: "shortcut__label deskfile__label" });
    const badge = el("span", {
      class: "deskfile__badge",
      text: t("file.badgeNew"),
      "aria-hidden": "true",
    });
    const icon = el("span", { class: "shortcut__thumb deskfile__thumb" }, [
      el("img", {
        class: "shortcut__icon",
        src: iconPath,
        alt: "",
        width: 26,
        height: 26,
        draggable: "false",
      }),
      badge,
    ]);
    const button = el(
      "button",
      {
        class: "shortcut deskfile is-new",
        type: "button",
        dataset: { fileId: id, trackId },
      },
      [icon, name],
    );
    const cancel = el(
      "button",
      {
        class: "deskfile__cancel",
        type: "button",
        text: "×",
      },
      [],
    );
    cancel.addEventListener("pointerdown", (event) => {
      // Cancel is its own control: it never starts a drag or chooses the file.
      event.preventDefault();
      event.stopPropagation();
    });
    cancel.addEventListener("click", (event) => {
      event.stopPropagation();
      setSelected(null);
    });

    // Files stack downward in a second column; the first one sits beside the
    // program shortcuts, where nothing can cover it. Compact layouts reflow
    // this list into a strip and override these coordinates in CSS.
    const index = files.size;
    const item = el("div", { class: "deskfile-item", role: "listitem" }, [
      button,
      cancel,
    ]);
    item.style.setProperty("--file-col", String(Math.floor(index / 3)));
    item.style.setProperty("--file-row", String(index % 3));
    host.append(item);

    const entry = { id, trackId, item, button, cancel, name, nameKey };
    files.set(id, entry);
    paintFile(entry);

    button.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      // Touch selects; there is no cursor to carry a ghost, and a finger that
      // slides a little must not start a drag or lose the selection.
      if (event.pointerType === "touch") return;
      beginDrag(entry, event);
    });
    // A click is only a selection; the file has nothing to open yet.
    button.addEventListener("click", () => {
      setSelected(selectedId === entry.id ? null : entry.id);
    });

    return entry;
  }

  function collectFile(id) {
    const entry = files.get(id);
    if (!entry) return false;
    const wasSelected = selectedId === id;
    if (wasSelected) selectedId = null;
    files.delete(id);
    if (wasSelected) {
      window.dispatchEvent(
        new CustomEvent("holysaga:file-selection", { detail: { id: null } }),
      );
    }
    entry.button.classList.add("is-collected");
    entry.button.disabled = true;
    setTimeout(() => {
      entry.item.remove();
    }, COLLECT_ANIMATION_MS);
    return true;
  }

  /* ------------------------------------------------------------------- drag */

  function beginDrag(entry, event) {
    drag = {
      entry,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      ghost: null,
      slot: null,
      moved: false,
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
  }

  function makeGhost(entry) {
    const ghost = el("div", { class: "file-ghost", "aria-hidden": "true" }, [
      el("img", { src: iconPath, alt: "", width: 30, height: 30 }),
      el("span", { class: "file-ghost__label", text: fileLabel(entry) }),
    ]);
    document.body.append(ghost);
    return ghost;
  }

  function highlight(slot) {
    if (!slot) return;
    const payload = drag?.entry;
    if (!payload) return;
    const accepts = slot.dataset.collectionSlot === payload.trackId;
    slot.classList.add(accepts ? "is-drop-compatible" : "is-drop-rejected");
  }

  function clearHighlight(slot) {
    if (!slot) return;
    slot.classList.remove("is-drop-compatible", "is-drop-rejected");
  }

  function onPointerMove(event) {
    if (!drag) return;
    const travelled = Math.hypot(
      event.clientX - drag.startX,
      event.clientY - drag.startY,
    );
    if (!drag.moved && travelled < DRAG_THRESHOLD) return;
    if (!drag.moved) {
      drag.moved = true;
      drag.ghost = makeGhost(drag.entry);
      drag.entry.button.classList.add("is-dragging");
      document.documentElement.classList.add("is-file-dragging");
      window.getSelection?.()?.removeAllRanges?.();
    }
    event.preventDefault();
    if (drag.ghost) {
      drag.ghost.style.left = `${event.clientX}px`;
      drag.ghost.style.top = `${event.clientY}px`;
    }
    const under = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest?.("[data-collection-slot]");
    if (under === drag.slot) return;
    clearHighlight(drag.slot);
    drag.slot = under || null;
    highlight(drag.slot);
  }

  function finishDrag() {
    if (!drag) return;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerCancel);
    drag.entry.button.classList.remove("is-dragging");
    document.documentElement.classList.remove("is-file-dragging");
    clearHighlight(drag.slot);
    const ghost = drag.ghost;
    if (ghost) setTimeout(() => ghost.remove(), 120);
  }

  function onPointerUp(event) {
    if (!drag) return;
    const { entry, slot, moved } = drag;
    if (!moved) {
      finishDrag();
      drag = null;
      return;
    }
    const target = slot;
    const payload = {
      fileId: entry.id,
      trackId: entry.trackId,
      name: fileLabel(entry),
    };
    let accepted = false;
    if (target) {
      const drop = new CustomEvent("holysaga:file-drop", {
        bubbles: true,
        cancelable: true,
        detail: payload,
      });
      accepted = !target.dispatchEvent(drop);
    }
    if (accepted) {
      collectFile(entry.id);
      drag.ghost?.classList.add("is-absorbed");
    } else if (target) {
      target.classList.add("is-drop-denied");
      setTimeout(() => target.classList.remove("is-drop-denied"), 360);
    }
    finishDrag();
    drag = null;
  }

  function onPointerCancel() {
    if (!drag) return;
    finishDrag();
    drag = null;
  }

  /* ------------------------------------------------------------------- tool */

  /** A 16 × 16 pixel brush, squares only, so it stays crisp in the taskbar. */
  function toolIcon() {
    const glyph = el("span", { class: "tasktool__icon", "aria-hidden": "true" });
    glyph.innerHTML = `
      <svg viewBox="0 0 16 16" shape-rendering="crispEdges" focusable="false" role="presentation">
        <rect x="5" y="1" width="6" height="6" fill="#101a18"></rect>
        <rect x="6" y="2" width="4" height="4" fill="#e9e5d2"></rect>
        <rect x="4" y="7" width="8" height="2" fill="#101a18"></rect>
        <rect x="5" y="7" width="6" height="2" fill="#a9b1a8"></rect>
        <rect x="3" y="9" width="10" height="5" fill="#101a18"></rect>
        <rect x="4" y="9" width="8" height="2" fill="#7bd2cb"></rect>
        <rect x="4" y="11" width="8" height="2" fill="#2f8b81"></rect>
        <rect x="2" y="6" width="1" height="1" fill="#bff3ec"></rect>
        <rect x="13" y="3" width="1" height="1" fill="#bff3ec"></rect>
      </svg>`;
    return glyph;
  }

  function toolLabel(active) {
    return t(active ? "sacred.tool.active" : "sacred.tool.idle");
  }

  function paintTool(entry) {
    const name = t(entry.nameKey);
    const label = `${name} — ${toolLabel(entry.active)}`;
    entry.button.title = label;
    entry.button.setAttribute("aria-label", label);
    entry.button.setAttribute("aria-pressed", entry.active ? "true" : "false");
  }

  function addTool({ id, nameKey = "sacred.tool.name", fresh = true } = {}) {
    if (destroyed || !id || tools.has(id)) return tools.get(id) || null;
    const host = toolHost ? toolHost() : null;
    if (!host) return null;

    const button = el(
      "button",
      {
        class: `tasktool raised${fresh ? " is-fresh" : ""}`,
        type: "button",
        dataset: { toolId: id },
      },
      [toolIcon()],
    );
    host.append(button);

    const entry = { id, button, active: false, nameKey, freshTimer: null };
    tools.set(id, entry);
    paintTool(entry);

    // First unlock: a stepped edge highlight, not a notification badge. A
    // restored button passes fresh:false and stays visually normal.
    if (fresh) {
      entry.freshTimer = window.setTimeout(() => {
        entry.freshTimer = null;
        button.classList.remove("is-fresh");
      }, TOOL_FRESH_MS);
    }

    button.addEventListener("click", () => {
      button.classList.remove("is-fresh");
      if (entry.freshTimer !== null) {
        window.clearTimeout(entry.freshTimer);
        entry.freshTimer = null;
      }
      onToolActivate?.(entry.id);
    });

    return entry;
  }

  function setToolActive(id, active) {
    const entry = tools.get(id);
    if (!entry) return false;
    entry.active = Boolean(active);
    entry.button.classList.toggle("is-active", entry.active);
    paintTool(entry);
    return true;
  }

  /**
   * Tap-to-collect: hand the selected file to a collection slot using the same
   * event drag-and-drop uses. The slot decides; a wrong slot refuses exactly as
   * it does for a drop, and the file stays selected and on the desktop.
   *
   * @returns {boolean} whether a selected file was offered (accepted or not)
   */
  function tryCollectOnSlot(slot) {
    const entry = selectedId ? files.get(selectedId) : null;
    if (!entry || !slot || typeof slot.dispatchEvent !== "function") return false;
    const payload = {
      fileId: entry.id,
      trackId: entry.trackId,
      name: fileLabel(entry),
    };
    const drop = new CustomEvent("holysaga:file-drop", {
      bubbles: true,
      cancelable: true,
      detail: payload,
    });
    const accepted = !slot.dispatchEvent(drop);
    if (accepted) {
      collectFile(entry.id);
      setSelected(null);
    } else {
      slot.classList.add("is-drop-denied");
      setTimeout(() => slot.classList.remove("is-drop-denied"), 360);
    }
    return true;
  }

  function hasFile(id) {
    return files.has(id);
  }

  function hasTool(id) {
    return tools.has(id);
  }

  const paintAll = () => {
    for (const entry of files.values()) paintFile(entry);
    for (const entry of tools.values()) paintTool(entry);
  };
  const stopLocale = onLocaleChange(paintAll);

  return {
    addFile,
    collectFile,
    tryCollectOnSlot,
    selectFile: setSelected,
    getSelected: () => (selectedId ? files.get(selectedId) || null : null),
    hasFile,
    addTool,
    setToolActive,
    hasTool,
    getFiles: () => [...files.keys()],
    getTools: () => [...tools.keys()],
    isDragging: () => Boolean(drag && drag.moved),
    destroy() {
      destroyed = true;
      stopLocale();
      for (const entry of files.values()) entry.item.remove();
      files.clear();
      for (const entry of tools.values()) {
        if (entry.freshTimer !== null) window.clearTimeout(entry.freshTimer);
        entry.button.remove();
      }
      tools.clear();
      filesLayer?.remove();
      finishDrag();
      drag = null;
    },
  };
}
