/**
 * IMAGE DUMP
 *
 * A Windows Explorer-style folder of the creator's photographs: a scrolling
 * grid of thumbnails with filenames, and a double-click-style open into the
 * larger IMAGE VIEWER window (js/apps/viewer.js).
 *
 * The app does three things beyond listing files:
 * - it keeps its gallery reaction when the desktop dock brings M.I.L.O. over;
 * - it keeps the shared corruption surface available for any photo a future
 *   stage marks as damaged (nothing is flagged today);
 * - it opens the viewer, which owns the discovery/unlock logic.
 *
 * No content is invented: filenames and photos come from js/data/images.js.
 */
import { el } from "../core/dom.js";
import { t, onLocaleChange } from "../i18n/index.js";
import { photos } from "../data/images.js";
import { applyCorruption } from "../ui/corruption.js";
import { openPhotoViewer } from "./viewer.js";

/**
 * A photo's thumbnail. A photo marked `status: "corrupted"` (or `corrupted:
 * true`) gets the shared corruption surface over its own pixels — the same
 * treatment as corrupted documents, so no app duplicates the effect.
 */
function thumb(photo, track) {
  const corrupted = photo.status === "corrupted" || photo.corrupted === true;
  const media = el("img", {
    class: "images__art",
    src: photo.thumb || photo.src,
    alt: "",
    loading: "lazy",
    decoding: "async",
    draggable: "false",
  });

  if (!corrupted) return media;

  const wrap = el("div", { class: "images__art-wrap" }, [media]);
  track?.push(applyCorruption(wrap, { intensity: "heavy", seed: photo.id }));
  return wrap;
}

export const imagesApp = {
  id: "images",
  titleKey: "app.images.title",
  icon: "assets/icons/images.svg",
  size: { w: 625, h: 457 },

  mount(body, ctx) {
    const root = el("div", { class: "app app--images" });
    let corruptions = [];

    const render = () => {
      for (const controller of corruptions) controller?.destroy();
      corruptions = [];
      root.replaceChildren();

      const open = (photo) => openPhotoViewer(ctx, photo);

      const grid = el(
        "div",
        {
          class: "images__grid",
          role: "group",
          "aria-label": t("images.gallery"),
        },
        photos.map((photo) =>
          el(
            "button",
            {
              class: "images__tile",
              type: "button",
              title: photo.filename,
              dataset: { photoId: photo.id },
              on: { click: () => open(photo) },
            },
            [
              thumb(photo, corruptions),
              el("span", { class: "images__filename", text: photo.filename }),
            ],
          ),
        ),
      );

      root.append(
        el("div", { class: "app__head" }, [
          el("span", { class: "app__label", text: t("images.gallery") }),
          el("span", { class: "app__meta", text: t("images.count", { n: photos.length }) }),
        ]),
        grid,
        el("p", { class: "app__note", text: t("images.openHint") }),
        el("div", { class: "statusbar" }, [
          el("div", {
            class: "statusbar__cell statusbar__cell--grow sunken",
            text: t("images.count", { n: photos.length }),
          }),
          el("div", {
            class: "statusbar__cell statusbar__cell--tight sunken",
            text: t("images.localOnly"),
          }),
        ]),
      );
    };

    /* ------------------------------------------------------- thumbnail fit */

    // The grid picks the fewest columns that let all twenty pictures fit the
    // window, so a large or maximized gallery shows whole rows instead of a row
    // sliced off at the grid's bottom edge. Pictures are capped at 500x500 and
    // never stretch; below the readable minimum the grid scrolls instead.
    const MIN_TILE = 96;
    /* Still readable, used only when the floor above would not fit every row. */
    const ABS_MIN_TILE = 64;
    const MAX_ART = 500;
    let fitFrame = 0;
    const fitObserver =
      typeof ResizeObserver === "function" ? new ResizeObserver(scheduleFit) : null;

    function fitGrid() {
      const grid = root.querySelector(".images__grid");
      if (!grid) return;
      const tiles = [...grid.children];
      const width = grid.clientWidth;
      const height = grid.clientHeight;
      if (!tiles.length || width < 1 || height < 1) return;

      const art = tiles[0].querySelector(".images__art");
      const chrome =
        tiles[0].getBoundingClientRect().height - art.getBoundingClientRect().height;
      const style = window.getComputedStyle(grid);
      const gap = parseFloat(style.rowGap) || 0;
      const padX =
        (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
      const padY =
        (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);

      // How many columns still hold readable thumbnails; the scroll fallback.
      let readable = 1;
      for (let cols = 1; cols <= tiles.length; cols += 1) {
        const tileW = (width - padX - (cols - 1) * gap) / cols;
        if (tileW < MIN_TILE) break;
        readable = cols;
      }

      // Widest grid whose whole rows fit the window, relaxing the thumbnail
      // floor a little before accepting a scrollbar with a sliced bottom row.
      let columns = readable;
      let fitted = false;
      for (let floor = MIN_TILE; floor >= ABS_MIN_TILE && !fitted; floor -= 8) {
        for (let cols = 1; cols <= tiles.length; cols += 1) {
          const tileW = (width - padX - (cols - 1) * gap) / cols;
          if (tileW < floor) break;
          const rows = Math.ceil(tiles.length / cols);
          const tileH = Math.min(tileW, MAX_ART) + chrome;
          if (rows * tileH + (rows - 1) * gap + padY <= height) {
            columns = cols;
            fitted = true;
            break;
          }
        }
      }
      grid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
    }

    function scheduleFit() {
      if (fitFrame) return;
      fitFrame = requestAnimationFrame(() => {
        fitFrame = 0;
        fitGrid();
      });
    }

    /** Re-measure after a render and whenever the window changes size. */
    function observeGrid() {
      const grid = root.querySelector(".images__grid");
      fitObserver?.disconnect();
      if (fitObserver && grid) fitObserver.observe(grid);
      scheduleFit();
    }

    /* ---------------------------------------------------------- M.I.L.O. */

    // Docking itself belongs to the desktop: the window manager tells the
    // dock which window is active. The gallery keeps its own reaction and
    // plays it once, after M.I.L.O. has actually arrived beside this window.
    const win = body.closest(".window");
    let welcomed = false;
    const onDocked = () => {
      if (welcomed) return;
      welcomed = true;
      // The line is localized; the mascot ignores a missing translation.
      ctx.mascot?.showLine?.({ key: "mascot.context.gallery.01", holdMs: 18_000 });
    };
    win?.addEventListener("mascot:docked", onDocked);

    render();
    body.append(root);
    observeGrid();

    const stopLocale = onLocaleChange(() => {
      render();
      observeGrid();
    });
    return () => {
      stopLocale();
      win?.removeEventListener("mascot:docked", onDocked);
      fitObserver?.disconnect();
      if (fitFrame) cancelAnimationFrame(fitFrame);
      for (const controller of corruptions) controller?.destroy();
      corruptions = [];
    };
  },
};
