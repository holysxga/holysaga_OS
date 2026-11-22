/**
 * VISUALIZER — a separate window for the selected track's visual.
 *
 * A deterministic placeholder signal, keyed by the track ID, until real
 * per-track visuals exist. It only reads the shared player: it never starts,
 * stops or resets playback, so closing or minimizing it changes nothing.
 *
 * It is deliberately NOT in js/apps/registry.js — it is opened from the MUSIC
 * PLAYER button, so it adds no desktop shortcut and no Start menu entry.
 */
import { el, clear } from "../core/dom.js";
import { t, onLocaleChange } from "../i18n/index.js";
import { player } from "../core/player.js";

const BAR_COUNT = 28;

function hash(text) {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

/** Stable pseudo-signal so each track keeps its own placeholder shape. */
function barHeights(trackId) {
  let value = hash(trackId || "silence");
  return Array.from({ length: BAR_COUNT }, (_, index) => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    const body = 16 + ((value >>> 16) % 58);
    const arc = Math.sin((index / (BAR_COUNT - 1)) * Math.PI) * 16;
    return Math.max(10, Math.min(92, Math.round(body + arc)));
  });
}

export const visualizerApp = {
  id: "visualizer",
  titleKey: "app.visualizer.title",
  icon: "assets/icons/visualizer.svg",
  size: { w: 485, h: 382 },

  mount(body) {
    const root = el("div", { class: "app app--visualizer" });
    let barsHost = null;
    let titleEl = null;
    let lastTrackId = "__none__";

    function build() {
      clear(root);

      barsHost = el("div", { class: "visualizer__bars", "aria-hidden": "true" });
      titleEl = el("p", { class: "visualizer__title" });

      root.append(
        el("div", { class: "visualizer__screen" }, [
          el("span", { class: "visualizer__signal", text: t("visualizer.signal") }),
          barsHost,
          titleEl,
          el("span", { class: "visualizer__tag", text: t("visualizer.placeholderTag") }),
        ]),
        el("p", { class: "app__note", text: t("visualizer.note") }),
        el("p", { class: "app__note app__note--faint", text: t("visualizer.detached") }),
        el("div", { class: "statusbar" }, [
          el("div", {
            class: "statusbar__cell statusbar__cell--grow sunken",
            text: t("visualizer.placeholderTag"),
          }),
          el("div", {
            class: "statusbar__cell statusbar__cell--tight sunken",
            text: "16×",
          }),
        ]),
      );
    }

    function paint() {
      if (!barsHost || !titleEl) return;
      const state = player.getState();
      if (state.trackId !== lastTrackId) {
        lastTrackId = state.trackId;
        clear(barsHost);
        for (const height of barHeights(state.trackId)) {
          barsHost.append(
            el("span", {
              class: "visualizer__bar",
              style: { height: `${height}%` },
            }),
          );
        }
      }
      titleEl.textContent = state.title || t("visualizer.idle");
    }

    body.append(root);
    build();
    paint();

    const stopPlayer = player.subscribe(paint);
    const stopLocale = onLocaleChange(() => {
      build();
      paint();
    });

    return () => {
      // Never touches playback.
      stopPlayer();
      stopLocale();
    };
  },
};
