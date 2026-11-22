/**
 * SIGNALS
 *
 * The program behind the SIGNALS desktop shortcut. It is deliberately not part
 * of the boot shortcut list: the TRITON story grants the shortcut once, and
 * `js/apps/registry.js` exposes this descriptor to the window manager only.
 *
 * The window is a dark carrier readout: the supplied creator portrait on the
 * left and a dense, deterministic corruption field around the process
 * identifier `soul_trapped` on the right. Nothing in the message is an
 * explanation; the visible content is data-like fragments, not prose.
 *
 * Opening is a short CSS glitch, repeated on every open because it belongs to
 * the experience. While the window is open, the portrait also tears and blinks
 * at irregular intervals. The one-time discovery state (first open, M.I.L.O.
 * reaction, collectible file) lives in js/core/signals.js and the shared
 * progression store, never in this view.
 */
import { el } from "../core/dom.js";
import { onLocaleChange, t } from "../i18n/index.js";
import {
  SIGNALS_COMMAND,
  SIGNALS_IDENTIFIER,
  SIGNALS_PORTRAIT,
  SIGNALS_TRANSMISSION,
} from "../data/signals.js";

const ARRIVAL_MS = 1_250;
const BURST_FIRST_DELAY_MS = 1_900;
const BURST_DELAY_MIN_MS = 1_500;
const BURST_DELAY_SPREAD_MS = 3_600;
const BURST_HOLD_MIN_MS = 150;
const BURST_HOLD_SPREAD_MS = 210;

export const signalsApp = {
  id: "signals",
  titleKey: "app.signals.title",
  icon: "assets/icons/signals.svg",
  size: { w: 760, h: 548 },

  mount(body, ctx) {
    const root = el("div", { class: "app app--signals is-arriving" });
    const reduceMotion = Boolean(
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
    );
    let arrivalTimer = null;
    let burstTimer = null;
    let burstEndTimer = null;
    let disposed = false;

    function scheduleBurst(minDelay = BURST_DELAY_MIN_MS) {
      if (disposed || reduceMotion || burstTimer !== null) return;
      const delay = minDelay + Math.random() * BURST_DELAY_SPREAD_MS;
      burstTimer = window.setTimeout(() => {
        burstTimer = null;
        if (disposed) return;
        const portrait = root.querySelector(".signals__portrait");
        if (!portrait) {
          scheduleBurst();
          return;
        }

        const variants = ["a", "b", "c"];
        portrait.style.setProperty(
          "--signals-burst-x",
          `${(2 + Math.random() * 8).toFixed(1)}px`,
        );
        portrait.style.setProperty(
          "--signals-burst-y",
          `${(1 + Math.random() * 4).toFixed(1)}px`,
        );
        portrait.classList.add(
          "is-bursting",
          `is-burst-${variants[Math.floor(Math.random() * variants.length)]}`,
        );

        const hold = BURST_HOLD_MIN_MS + Math.random() * BURST_HOLD_SPREAD_MS;
        burstEndTimer = window.setTimeout(() => {
          burstEndTimer = null;
          portrait.classList.remove(
            "is-bursting",
            "is-burst-a",
            "is-burst-b",
            "is-burst-c",
          );
          scheduleBurst();
        }, hold);
      }, delay);
    }

    const render = () => {
      root.replaceChildren();

      const portrait = el(
        "figure",
        {
          class: "signals__portrait",
          "data-portrait-slot": "signals-portrait",
          "aria-label": t("signals.portrait.label"),
        },
        [
          el("figcaption", { class: "signals__portrait-meta" }, [
            el("span", { text: "PORTRAIT // 00" }),
            el("span", {
              class: "signals__portrait-source",
              text: SIGNALS_PORTRAIT.source,
            }),
          ]),
          el("div", { class: "signals__portrait-media" }, [
            el("img", {
              class: "signals__portrait-image",
              src: SIGNALS_PORTRAIT.src,
              alt: "",
              "data-portrait-image": "source",
              decoding: "async",
              draggable: "false",
            }),
            el("img", {
              class: "signals__portrait-ghost signals__portrait-ghost--a",
              src: SIGNALS_PORTRAIT.src,
              alt: "",
              "aria-hidden": "true",
              decoding: "async",
              draggable: "false",
            }),
            el("img", {
              class: "signals__portrait-ghost signals__portrait-ghost--b",
              src: SIGNALS_PORTRAIT.src,
              alt: "",
              "aria-hidden": "true",
              decoding: "async",
              draggable: "false",
            }),
            el("span", { class: "signals__portrait-scan", "aria-hidden": "true" }),
          ]),
          el("div", {
            class: "signals__portrait-foot",
            "aria-hidden": "true",
            text: `0x00 // 7F0A // ${SIGNALS_IDENTIFIER} // 001101`,
          }),
        ],
      );

      const transmission = el(
        "div",
        {
          class: "signals__transmission",
          role: "img",
          "aria-label": t("signals.transmission.label"),
        },
        [
          el("pre", {
            class: "signals__noise signals__noise--main",
            "aria-hidden": "true",
            text: SIGNALS_TRANSMISSION.main.join("\n"),
          }),
          el("pre", {
            class: "signals__noise signals__noise--ghost",
            "aria-hidden": "true",
            text: SIGNALS_TRANSMISSION.ghost.join("\n"),
          }),
          el(
            "div",
            {
              class: "signals__command",
              "aria-hidden": "true",
              "data-signals-identifier": SIGNALS_IDENTIFIER,
            },
            [
              el("span", {
                class: "signals__command-prompt",
                text: "root@7f0a:~$",
              }),
              el("span", {
                class: "signals__command-text",
                text: SIGNALS_COMMAND,
              }),
              el("span", {
                class: "signals__command-cursor",
                "aria-hidden": "true",
              }),
            ],
          ),
          el("span", { class: "signals__scan", "aria-hidden": "true" }),
        ],
      );

      root.append(
        el("div", { class: "signals__shell" }, [
          el("div", { class: "signals__head" }, [
            el("span", { text: "RX // 7F0A:001" }),
            el("span", {
              class: "signals__head-state",
              text: `⟁ 7F0A::${SIGNALS_IDENTIFIER}::001101`,
            }),
          ]),
          el("div", { class: "signals__body" }, [portrait, transmission]),
          el("div", { class: "signals__foot" }, [
            el("span", {
              text: `01001011... ${SIGNALS_IDENTIFIER} ... 𐌗𐌗𐌗 ... 001101`,
            }),
            el("span", { text: "0x7F // ▒░" }),
          ]),
        ]),
      );
    };

    render();
    body.append(root);

    arrivalTimer = window.setTimeout(() => {
      arrivalTimer = null;
      root.classList.remove("is-arriving");
    }, ARRIVAL_MS);
    scheduleBurst(BURST_FIRST_DELAY_MS);

    // The controller owns persistence and the one-time reaction/file. Calling
    // it here only reports that the real window mounted.
    ctx.signals?.opened?.();

    const stop = onLocaleChange(render);

    return () => {
      disposed = true;
      stop();
      if (arrivalTimer !== null) window.clearTimeout(arrivalTimer);
      if (burstTimer !== null) window.clearTimeout(burstTimer);
      if (burstEndTimer !== null) window.clearTimeout(burstEndTimer);
      arrivalTimer = null;
      burstTimer = null;
      burstEndTimer = null;
      root.remove();
    };
  },
};
