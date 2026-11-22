/**
 * Desktop shortcuts.
 *
 * Programs from the registry form the primary shortcuts. A later narrative
 * discovery can add one more entry through `addShortcut()`; it uses exactly the
 * same markup, selection and activation behavior as the original five.
 *
 * Desktop: single click selects, double click opens (classic behaviour).
 * Touch: a single tap opens — there is no hover to discover a second tap, and
 * a tap that only selected would read as a broken icon. Keyboard: Enter/Space
 * opens. No drag gesture is ever started from a shortcut, so a tap can never
 * move an icon.
 */
import { el } from "../core/dom.js";
import { isCoarsePointer } from "../core/input.js";
import { onLocaleChange, t } from "../i18n/index.js";

const FRESH_MS = 5_000;

export function createShortcuts({ root, apps, onOpen }) {
  const list = el("ul", { class: "shortcuts__list", role: "list" });
  const entries = [];
  const buttons = new Map();
  const timers = new Set();
  let selectedId = null;

  function paintButton(app, button) {
    const label = t(app.titleKey);
    button.querySelector(".shortcut__label").textContent = label;
    button.title = `${t("system.openApp", { name: label })} — ${t("system.shortcutHint")}`;
    button.setAttribute("aria-label", `${label}. ${t("system.shortcutHint")}`);
  }

  function addShortcut(app, { fresh = false } = {}) {
    if (!app || !app.id || buttons.has(app.id)) return false;

    const button = el(
      "button",
      {
        class: "shortcut",
        type: "button",
        "aria-pressed": "false",
        on: {
          click: (event) => {
            select(app.id);
            // Keyboard activation (Enter/Space) reports no click count.
            if (event.detail === 0) {
              onOpen(app.id);
              return;
            }
            // Touch: one tap is the whole gesture. The mouse keeps its
            // select-then-double-click behaviour below.
            if (isCoarsePointer()) onOpen(app.id);
          },
          dblclick: () => onOpen(app.id),
        },
      },
      [
        // Circular medallion around the app's own icon. Decorative: the button
        // already carries the accessible name.
        el("span", { class: "shortcut__thumb", "aria-hidden": "true" }, [
          el("img", {
            class: "shortcut__icon",
            src: app.icon,
            alt: "",
            width: 26,
            height: 26,
            draggable: "false",
          }),
        ]),
        el("span", { class: "shortcut__label", text: t(app.titleKey) }),
      ],
    );

    if (fresh) {
      const item = el("li", { class: "shortcut-item is-new" }, [button]);
      const timer = setTimeout(() => {
        timers.delete(timer);
        item.classList.remove("is-new");
      }, FRESH_MS);
      timers.add(timer);
      list.append(item);
    } else {
      list.append(el("li", { class: "shortcut-item" }, [button]));
    }

    buttons.set(app.id, button);
    entries.push({ app, button });
    paintButton(app, button);
    return true;
  }

  for (const app of apps) addShortcut(app);

  function select(id) {
    selectedId = id;
    for (const [appId, button] of buttons) {
      const isSelected = appId === id;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    }
  }

  const refresh = () => {
    for (const { app, button } of entries) paintButton(app, button);
  };

  root.append(list);
  root.setAttribute("aria-label", t("system.desktopLabel"));
  list.setAttribute("aria-label", t("system.desktopLabel"));
  refresh();
  const stop = onLocaleChange(refresh);

  return {
    addShortcut,
    hasShortcut: (id) => buttons.has(id),
    destroy() {
      stop();
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      list.remove();
    },
  };
}
