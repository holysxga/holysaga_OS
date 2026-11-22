/**
 * IMAGE VIEWER
 *
 * The larger view opened by IMAGE DUMP. It is a normal window managed by
 * js/core/window-manager.js, so it can be moved, stacked, minimized and closed
 * like any other program, and the gallery stays behind it.
 *
 * Only one viewer exists at a time: opening another photo updates the open
 * window instead of stacking copies. The window is never listed in the app
 * registry — IMAGE DUMP opens it through `ctx.openWindow`.
 *
 * Discovery: a photo may declare `trackId` / `eventId` in js/data/images.js.
 * The first time it is shown, the matching desktop service records them. The
 * sunset photo is owned by js/core/horizon.js (HORIZON's intro and listening
 * reflection); other photos keep the small generic unlock below. Repeats are
 * ignored, and the store persists to localStorage, so discovery survives a
 * reload. Opening the gallery alone never runs this.
 */
import { el, clear } from "../core/dom.js";
import { progression } from "../core/progression.js";

/** The mounted viewer, so a second photo reuses the same window. */
let activeViewer = null;

function discover(photo, ctx) {
  if (!photo) return;
  // HORIZON owns the sunset sequence; it records the same stable track/event.
  if (ctx?.horizon?.onPhotoOpened?.(photo)) return;
  if (photo.trackId && !progression.hasTrack(photo.trackId)) {
    progression.unlockTrack(photo.trackId);
    if (photo.eventId) progression.completeEvent(photo.eventId);
  }
  if (photo.dialogueKey && ctx?.mascot) {
    ctx.mascot.showLine?.({ key: photo.dialogueKey, holdMs: 14_000 });
  }
}

/**
 * Open (or retarget) the viewer for one photo.
 * @param {{openWindow?: Function}} ctx window context from the gallery
 * @param {object} photo entry from js/data/images.js
 */
export function openPhotoViewer(ctx, photo) {
  if (activeViewer) {
    activeViewer.show(photo);
    return;
  }
  ctx?.openWindow?.(viewerApp(photo));
}

function viewerApp(photo) {
  return {
    id: "viewer",
    titleKey: "app.images.viewer",
    icon: "assets/icons/images.svg",
    size: { w: 700, h: 560 },

    mount(body, ctx) {
      const stage = el("div", { class: "viewer__stage sunken" });
      const image = el("img", {
        class: "viewer__img",
        alt: photo.filename,
        decoding: "async",
      });
      stage.append(image);

      const name = el("span", { class: "viewer__file", text: photo.filename });
      const size = el("span", { class: "viewer__dims" });

      // Closing belongs to the shared title bar only; this window does not get
      // a second, redundant close control in its content area.
      const root = el("div", { class: "app app--viewer" }, [
        el("div", { class: "viewer__bar" }, [
          el("span", { class: "viewer__name" }, [name, size]),
        ]),
        stage,
        el("div", { class: "statusbar" }, [
          el("div", {
            class: "statusbar__cell statusbar__cell--grow sunken",
            text: photo.filename,
          }),
          el("div", {
            class: "statusbar__cell statusbar__cell--tight sunken",
            text: `${photo.width} × ${photo.height}`,
          }),
        ]),
      ]);

      function show(next) {
        if (!next) return;
        photo = next;
        image.src = photo.src;
        image.alt = photo.filename;
        name.textContent = photo.filename;
        size.textContent = `${photo.width} × ${photo.height}`;
        root.querySelector(".statusbar__cell--grow").textContent = photo.filename;
        root.querySelector(".statusbar__cell--tight").textContent =
          `${photo.width} × ${photo.height}`;
        discover(photo, ctx);
      }

      body.append(root);
      show(photo);

      activeViewer = {
        show,
        isOpen: () => body.isConnected,
      };

      return () => {
        if (activeViewer?.show === show) activeViewer = null;
        clear(stage);
        image.removeAttribute("src");
      };
    },
  };
}
