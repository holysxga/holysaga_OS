/**
 * Start menu: the five programs plus the language selector.
 * Opens above the Start button, closes on outside click or Escape.
 */
import { el } from "../core/dom.js";
import { LOCALES, getLocale, onLocaleChange, t } from "../i18n/index.js";

export function createStartMenu({ root, apps, onOpenApp, onSelectLocale, onOpenChange }) {
  let open = false;
  const panel = el("div", {
    class: "startmenu",
    role: "menu",
    hidden: true,
  });

  function render() {
    panel.replaceChildren();
    panel.setAttribute("aria-label", t("start.menuLabel"));

    const appItems = apps.map((app) =>
      el(
        "li",
        {},
        [
          el(
            "button",
            {
              class: "startmenu__app",
              type: "button",
              role: "menuitem",
              on: {
                click: () => {
                  onOpenApp(app.id);
                  close();
                },
              },
            },
            [
              el("img", {
                class: "startmenu__icon",
                src: app.icon,
                alt: "",
                width: 16,
                height: 16,
                draggable: "false",
              }),
              el("span", { text: t(app.titleKey) }),
            ],
          ),
        ],
      ),
    );

    const current = getLocale();
    const langItems = LOCALES.map((locale) =>
      el(
        "li",
        {},
        [
          el(
            "button",
            {
              class: "startmenu__lang",
              type: "button",
              role: "menuitemradio",
              "aria-checked": locale.code === current ? "true" : "false",
              "data-locale": locale.code,
              on: {
                click: () => {
                  onSelectLocale(locale.code);
                  render();
                },
              },
            },
            [
              el("span", { class: "startmenu__lang-code", text: locale.short }),
              el("span", { class: "startmenu__lang-name", text: locale.label }),
            ],
          ),
        ],
      ),
    );

    panel.append(
      el("div", { class: "startmenu__banner", "aria-hidden": "true" }, [
        el("span", { text: "holysaga_oS" }),
      ]),
      el("div", { class: "startmenu__right" }, [
        el("div", { class: "startmenu__panel" }, [
          el("p", { class: "startmenu__heading", text: t("start.apps") }),
          el("ul", { class: "startmenu__list" }, appItems),
          el("div", { class: "startmenu__sep", "aria-hidden": "true" }),
          el("p", { class: "startmenu__heading", text: t("start.language") }),
          el("ul", { class: "startmenu__list", role: "group", "aria-label": t("system.language") }, langItems),
        ]),
        el("div", { class: "startmenu__footer", text: t("start.footer") }),
      ]),
    );
  }

  function setOpen(next) {
    if (open === next) return;
    open = next;
    panel.hidden = !open;
    if (open) render();
    if (onOpenChange) onOpenChange(open);
  }

  const toggle = () => setOpen(!open);
  const close = () => setOpen(false);

  const onDocumentPointerDown = (event) => {
    if (!open) return;
    if (panel.contains(event.target)) return;
    if (event.target.closest(".taskbar__start")) return;
    close();
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape" && open) {
      close();
      document.querySelector(".taskbar__start")?.focus();
    }
  };

  render();
  root.append(panel);
  document.addEventListener("pointerdown", onDocumentPointerDown);
  document.addEventListener("keydown", onKeyDown);
  const stopLocale = onLocaleChange(() => {
    if (open) render();
  });

  return {
    toggle,
    close,
    isOpen: () => open,
    destroy() {
      stopLocale();
      document.removeEventListener("pointerdown", onDocumentPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      panel.remove();
    },
  };
}
