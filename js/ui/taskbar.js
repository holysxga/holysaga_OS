/**
 * Taskbar: Start button, one button per open window and the clock.
 * The window buttons are driven entirely by the window manager snapshot.
 */
import { el } from "../core/dom.js";
import { localeTag, onLocaleChange, t } from "../i18n/index.js";

export function createTaskbar({ root, manager, onStartToggle }) {
  // Quick-launch strip: unlocked desktop tools live here, right after Start,
  // so they stay reachable while windows cover the desktop.
  const tools = el("div", { class: "taskbar__tools", role: "group" });
  const tasks = el("div", { class: "taskbar__tasks" });
  const clock = el("span", { class: "clock" });
  const tray = el("div", { class: "taskbar__tray sunken" }, [clock]);

  const startButton = el(
    "button",
    {
      class: "taskbar__start raised",
      type: "button",
      title: t("system.startTooltip"),
      "aria-haspopup": "true",
      "aria-expanded": "false",
      on: { click: () => onStartToggle() },
    },
    [
      el("img", {
        class: "taskbar__start-icon",
        src: "assets/icons/monitor.svg",
        alt: "",
        width: 16,
        height: 16,
        draggable: "false",
      }),
      el("span", { class: "taskbar__start-label", text: t("system.start") }),
    ],
  );

  const bar = el("div", { class: "taskbar", role: "toolbar" }, [
    startButton,
    el("div", { class: "taskbar__divider", "aria-hidden": "true" }),
    tools,
    tasks,
    tray,
  ]);

  root.append(bar);
  bar.setAttribute("aria-label", t("system.taskbarLabel"));
  tools.setAttribute("aria-label", t("sacred.tool.region"));

  function renderTasks(snapshot) {
    tasks.replaceChildren();
    for (const item of snapshot) {
      const button = el(
        "button",
        {
          class: `task raised${item.active ? " is-active" : ""}${item.minimized ? " is-minimized" : ""}`,
          type: "button",
          title: item.title,
          "aria-pressed": item.active ? "true" : "false",
          dataset: { appId: item.id },
          on: { click: () => manager.toggle(item.id) },
        },
        [
          el("img", {
            class: "task__icon",
            src: item.icon,
            alt: "",
            width: 16,
            height: 16,
            draggable: "false",
          }),
          el("span", { class: "task__label", text: item.title }),
        ],
      );
      tasks.append(button);
    }
    // Keep the taskbar honest when it is empty.
    bar.classList.toggle("is-idle", snapshot.length === 0);
  }

  function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    clock.textContent = `${hours}:${minutes}`;
    clock.title = `${t("system.clockLabel")} — ${now.toLocaleDateString(localeTag(), {
      weekday: "long",
      day: "numeric",
      month: "long",
    })}`;
    clock.setAttribute("aria-label", clock.title);
  }

  function refreshLabels() {
    startButton.title = t("system.startTooltip");
    startButton.querySelector(".taskbar__start-label").textContent = t("system.start");
    bar.setAttribute("aria-label", t("system.taskbarLabel"));
    tools.setAttribute("aria-label", t("sacred.tool.region"));
    updateClock();
  }

  updateClock();
  const timer = window.setInterval(updateClock, 15_000);
  const stopLocale = onLocaleChange(refreshLabels);

  return {
    renderTasks,
    refreshLabels,
    /* Where desktop tools mount: an empty strip until one is unlocked. */
    toolSlot: tools,
    setStartExpanded(expanded) {
      startButton.setAttribute("aria-expanded", expanded ? "true" : "false");
      startButton.classList.toggle("is-pressed", expanded);
    },
    destroy() {
      window.clearInterval(timer);
      stopLocale();
      bar.remove();
    },
  };
}
