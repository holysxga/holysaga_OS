/**
 * Intrusive thoughts — system-style messages that interrupt exploration.
 *
 * This is deliberately independent from the Twister system: a message can
 * appear with no Twister anywhere on screen, and dismissing one only records
 * that it was seen. It never unlocks a track, never counts a Twister encounter
 * and never completes a narrative event.
 *
 * Timing rules:
 * - The first message waits for a long, visible stretch, so a fresh visit is
 *   never interrupted on arrival.
 * - Afterwards messages are spaced by a randomized interval and only one is on
 *   screen at a time; a hard per-visit ceiling stops any stream.
 * - The countdown only advances while the page is visible, so background time
 *   cannot accumulate messages.
 * - `hold(reason)` / `release(reason)` let a future tutorial, minigame or
 *   cleanup mechanic ask for quiet without knowing anything about this module.
 *
 * The pop-up itself is a real window-manager dialog: same chrome, dragging,
 * clamping and stacking as every program, but no taskbar button and no
 * minimize control. It never takes keyboard focus on its own.
 */
import { el } from "./dom.js";
import { dictionaryKeys, onLocaleChange, t } from "../i18n/index.js";
import {
  THOUGHTS,
  THOUGHT_BY_ID,
  THOUGHT_CONFIG,
  THOUGHT_POOLS,
  THOUGHT_REACTIONS,
} from "../data/thoughts.js";
import { progression } from "./progression.js";

const ACTION_KEYS = {
  ok: "thought.action.ok",
  dismiss: "thought.action.dismiss",
  ignore: "thought.action.ignore",
  continue: "thought.action.continue",
  later: "thought.action.later",
};

const CATEGORY_GLYPH = { cryptic: "?", doubt: "!", error: "×" };

const FALLBACK_TITLE_KEY = "thought.fallback.title";
const FALLBACK_BODY_KEY = "thought.fallback.body";

/**
 * Shown when an ID has no library entry: a generic localized system error.
 * Never the raw ID, a dictionary key or `undefined`.
 */
const GENERIC_MESSAGE = Object.freeze({
  id: "UNKNOWN",
  category: "error",
  action: "ok",
  titleKey: FALLBACK_TITLE_KEY,
  bodyKey: FALLBACK_BODY_KEY,
  generic: true,
});

/**
 * Local key checks built on the long-standing `dictionaryKeys()` export.
 * Deliberately not a new i18n export: a cached older i18n module and a newer
 * copy of this file must still link, otherwise the whole desktop fails to boot
 * and only the wallpaper is left.
 */
function hasTranslation(key) {
  if (typeof key !== "string" || !key) return false;
  return Object.values(dictionaryKeys()).some((keys) => keys.includes(key));
}

/** Translate a key or a fallback key. Never returns a raw key when it can help it. */
function tOr(key, fallbackKey) {
  return t(hasTranslation(key) ? key : fallbackKey);
}

/** Keep a key only if it can actually be rendered; otherwise use the fallback. */
function resolvedKey(key, fallbackKey) {
  return typeof key === "string" && hasTranslation(key) ? key : fallbackKey;
}

/** Resolve both strings up front so no rendering path can show a raw key. */
function normalizeMessage(input) {
  if (!input || typeof input !== "object") return GENERIC_MESSAGE;
  return {
    ...input,
    titleKey: resolvedKey(input.titleKey, FALLBACK_TITLE_KEY),
    bodyKey: resolvedKey(input.bodyKey, FALLBACK_BODY_KEY),
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function createIntrusiveThoughts(options = {}) {
  const manager = options.manager;
  const mascot = options.mascot || null;
  const store = options.store || progression;
  const doc = options.document || (typeof document === "undefined" ? null : document);
  const config = { ...THOUGHT_CONFIG, ...(options.config || {}) };
  const random = options.random || Math.random;
  /* Optional encounter hooks, injected by boot. `decide` is asked once per new
     message and may return a token; `present` decorates the mounted dialog and
     returns its own cleanup. This module stays independent of the Twister
     system: without the hooks every message behaves exactly as before. */
  const decide = typeof options.decide === "function" ? options.decide : null;
  const present = typeof options.present === "function" ? options.present : null;
  /* A deferred event (a dialogue, a held encounter, a scripted scene) owns the
     desktop while it is presented: no ambient message may open over it. */
  const isBusy = typeof options.isBusy === "function" ? options.isBusy : () => false;

  const holds = new Set();
  const shownThisSession = new Set();
  let active = null;
  let running = false;
  let suspended = false;
  let timer = null;
  let countdown = 0;
  let sessionCount = 0;
  let lastReactionKey = null;

  const isVisible = () => !doc || doc.visibilityState !== "hidden";
  const isDragging = () =>
    Boolean(doc && doc.documentElement.classList.contains("is-dragging"));

  function history() {
    try {
      return typeof store.getThoughts === "function" ? store.getThoughts() : [];
    } catch {
      return [];
    }
  }

  /* ------------------------------------------------------------- selection */

  function gap(first) {
    const min = first ? config.firstDelayMin : config.intervalMin;
    const max = first ? config.firstDelayMax : config.intervalMax;
    return Math.round(min + random() * Math.max(0, max - min));
  }

  /**
   * Prefer messages this visitor has never seen. Once the library is exhausted
   * the recent ones stay skipped for a while, so nothing loops back instantly.
   */
  function pick(source = THOUGHTS) {
    const seen = new Set([...history(), ...shownThisSession]);
    let pool = source.filter((message) => !seen.has(message.id));
    if (!pool.length) {
      const recent = new Set([
        ...history().slice(-config.repeatAfter),
        ...shownThisSession,
      ]);
      pool = source.filter((message) => !recent.has(message.id));
    }
    if (!pool.length) pool = source;
    return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
  }

  /* ---------------------------------------------------------------- mascot */

  function react(category) {
    if (!mascot || typeof mascot.react !== "function") return null;
    // A missing translation must not leak a key into the mascot's bubble.
    const keys = (THOUGHT_REACTIONS[category] || []).filter((key) => hasTranslation(key));
    if (!keys.length) return null;
    const pool = keys.filter((key) => key !== lastReactionKey);
    const usable = pool.length ? pool : keys;
    const key = usable[Math.min(usable.length - 1, Math.floor(random() * usable.length))];
    lastReactionKey = key;
    mascot.react({ key, category, holdMs: config.mascotHoldMs });
    return key;
  }

  /* ---------------------------------------------------------------- dialog */

  function mountDialog(body, ctx, message, encounter) {
    const glyph = el("span", {
      class: "thought__glyph",
      text: CATEGORY_GLYPH[message.category] || "!",
      "aria-hidden": "true",
    });
    const category = el("p", { class: "thought__category" });
    const text = el("p", { class: "thought__text", id: `thought-text-${message.id}` });
    const hint = el("p", { class: "thought__hint" });
    const action = el("button", {
      class: "thought__action raised",
      type: "button",
      on: { click: () => ctx.close() },
    });

    const root = el("div", { class: `thought thought--${message.category}` }, [
      el("div", { class: "thought__head" }, [glyph, category]),
      text,
      el("div", { class: "thought__foot" }, [hint, action]),
      el("span", { class: "thought__scan", "aria-hidden": "true" }),
    ]);

    function refresh() {
      category.textContent = tOr(
        `thought.category.${message.category}`,
        "thought.category.error",
      );
      text.textContent = tOr(message.bodyKey, FALLBACK_BODY_KEY);
      hint.textContent = hasTranslation("thought.dismissHint")
        ? t("thought.dismissHint")
        : "";
      const actionKey = ACTION_KEYS[message.action] || ACTION_KEYS.ok;
      action.textContent = tOr(actionKey, ACTION_KEYS.ok);
      action.setAttribute(
        "aria-label",
        `${action.textContent} — ${tOr(message.titleKey, FALLBACK_TITLE_KEY)}`,
      );
      // The title bar belongs to the window manager, but this dialog owns the
      // message: set it here too so a missing translation can never surface as
      // a key on a language switch.
      const shellTitle = body.closest(".window")?.querySelector(".window__title");
      if (shellTitle) {
        shellTitle.textContent = tOr(message.titleKey, FALLBACK_TITLE_KEY);
      }
    }

    refresh();
    body.append(root);
    root.setAttribute("aria-describedby", text.id);

    // An encounter (a Twister on this thought) decorates the message in place
    // and owns its cleanup, which is disposed together with the dialog.
    let extraCleanup = null;
    if (present) {
      try {
        const result = present(encounter, {
          message,
          root,
          window: body.closest(".window"),
        });
        if (typeof result === "function") extraCleanup = result;
        else if (result && typeof result.destroy === "function") {
          extraCleanup = () => result.destroy();
        }
      } catch (error) {
        console.error("[thoughts] could not present the encounter", error);
      }
    }

    const stopLocale = onLocaleChange(refresh);
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        ctx.close();
      }
    };
    root.addEventListener("keydown", onKeyDown);

    // One restrained stutter, only for the messages already framed as errors.
    let glitchTimer = null;
    if (message.category === "error") {
      const shell = body.closest(".window");
      shell?.classList.add("is-glitching");
      glitchTimer = setTimeout(() => shell?.classList.remove("is-glitching"), 460);
    }

    return () => {
      if (glitchTimer !== null) clearTimeout(glitchTimer);
      stopLocale();
      root.removeEventListener("keydown", onKeyDown);
      if (extraCleanup) {
        try {
          extraCleanup();
        } catch (error) {
          console.error("[thoughts] could not clean up the encounter", error);
        }
      }
    };
  }

  function dialogFor(message, encounter) {
    const text = tOr(message.bodyKey, FALLBACK_BODY_KEY);
    const width = clamp(238 + text.length * 1.6, 248, 330);
    const charsPerLine = Math.max(24, Math.floor((width - 78) / 5.3));
    const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
    const height = clamp(112 + lines * 15, 132, 202);

    const layer = doc && doc.getElementById("window-layer");
    const rect = layer ? layer.getBoundingClientRect() : { width: 1024, height: 700 };
    const maxLeft = Math.max(8, rect.width - width - 16);
    const maxTop = Math.max(8, Math.min(rect.height - height - 16, rect.height * 0.58));
    const left = 20 + random() * Math.max(0, maxLeft - 20);
    const top = 30 + random() * Math.max(0, maxTop - 30);

    return {
      id: `thought:${message.id}`,
      kind: "dialog",
      titleKey: message.titleKey,
      icon: "assets/icons/monitor.svg",
      variant: "thought",
      size: { w: Math.round(width), h: Math.round(height) },
      placement: { left: Math.round(left), top: Math.round(top) },
      mount: (body, ctx) => mountDialog(body, ctx, message, encounter),
    };
  }

  /* --------------------------------------------------------------- display */

  /** Show one message now. @returns {boolean} true when a dialog opened. */
  function show(input) {
    if (!manager || suspended || isBusy()) return false;
    // A dialog the visitor closed a moment ago leaves a stale record until the
    // next tick. An explicit show() must not be swallowed by it.
    if (active && !manager.isOpen(active.id)) active = null;
    if (active) return false;
    // An unknown ID (or a stale entry) still gets an honest, localized system
    // error instead of being dropped or printed literally.
    let message = normalizeMessage(
      typeof input === "string" ? THOUGHT_BY_ID.get(input) : input,
    );

    // Exactly one roll per new message, taken before the dialog exists and
    // never re-evaluated while it is open. This keeps the first-encounter
    // guarantee and the encounter chance exactly where they were.
    let encounter = null;
    if (decide) {
      try {
        encounter = decide(message) || null;
      } catch (error) {
        console.warn("[thoughts] encounter decision failed", error);
      }
    }

    // The Twister controller deferred this one (it is talking first). No
    // ordinary window opens here, and nothing is recorded: the encounter will
    // open its own window through openEncounter().
    if (encounter && encounter.deferred) return false;

    // The roll decides which voice owns this window. A Twister always gets a
    // personal intrusion; an ordinary dialog always gets a system observation.
    // The provisional pick only supplied the roll with an ID, so replace it
    // when its pool does not match the outcome.
    if (!message.generic) {
      const poolName = encounter ? "twister" : "system";
      const pool = THOUGHT_POOLS[poolName] || THOUGHTS;
      if (!pool.some((candidate) => candidate.id === message.id)) {
        message = pick(pool);
        if (encounter) encounter = { ...encounter, id: message.id };
      }
    }

    const dialog = dialogFor(message, encounter);
    if (!manager.open(dialog)) return false;

    active = { id: dialog.id, message };
    if (message.generic) return true;

    shownThisSession.add(message.id);
    sessionCount += 1;
    if (typeof store.recordThought === "function") {
      try {
        store.recordThought(message.id);
      } catch (error) {
        console.warn("[thoughts] could not record history", error);
      }
    }
    // A message carrying a Twister tells its own story through the encounter.
    if (!encounter) react(message.category);
    return true;
  }

  /**
   * Open the window for an encounter the controller already owns (the one it
   * deferred during music). The creature is presented exactly as on any other
   * message, so the encounter is counted once, when this window mounts.
   *
   * @param {{first?: boolean}} [token]
   * @returns {boolean} whether the window opened
   */
  function openEncounter(token = {}) {
    if (!manager || suspended || holds.size > 0) return false;
    if (active && !manager.isOpen(active.id)) active = null;
    if (active) return false;
    const pool = THOUGHT_POOLS.twister || THOUGHTS;
    const message = normalizeMessage(pick(pool));
    const encounter = { id: message.id, first: Boolean(token.first) };
    const dialog = dialogFor(message, encounter);
    if (!manager.open(dialog)) return false;

    active = { id: dialog.id, message };
    shownThisSession.add(message.id);
    sessionCount += 1;
    try {
      store.recordThought?.(message.id);
    } catch (error) {
      console.warn("[thoughts] could not record history", error);
    }
    return true;
  }

  /** Close the current message and wait for the next interval. */
  function dismiss() {
    if (!active) return false;
    const { id } = active;
    active = null;
    manager.close(id);
    if (running) startTimer(gap(false));
    return true;
  }

  /** Notice a dialog the visitor closed with its own X button. */
  function syncActive() {
    if (!active) return false;
    if (manager.isOpen(active.id)) return false;
    active = null;
    if (running) startTimer(gap(false));
    return true;
  }

  /* -------------------------------------------------------------- schedule */

  function stopTimer() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function startTimer(delay) {
    stopTimer();
    countdown = Math.max(0, delay);
    timer = setInterval(tick, config.tickMs);
    if (timer && typeof timer.unref === "function") timer.unref();
  }

  function tick() {
    if (!running) return;
    if (syncActive()) return;
    if (active) return;
    // A hidden tab freezes the countdown completely: background time is not
    // exploration and must not queue up a burst of messages.
    if (!isVisible()) return;
    if (holds.size > 0 || isBusy()) return;
    if (sessionCount >= config.maxPerSession) {
      stopTimer();
      return;
    }
    if (countdown > 0) {
      countdown -= config.tickMs;
      return;
    }
    if (isDragging()) {
      countdown = config.retryMs;
      return;
    }
    if (!show(pick())) countdown = config.retryMs;
  }

  function start() {
    if (running) return stop;
    running = true;
    startTimer(gap(true));
    return stop;
  }

  function stop() {
    running = false;
    stopTimer();
  }

  /**
   * Give a scripted desktop event complete control: the scheduler is stopped
   * (not just paused), an alert already on screen is dismissed, and nothing
   * can open until `resume()`. Because the countdown is discarded, no burst of
   * deferred messages appears afterwards.
   */
  function suspend(reason = "event") {
    suspended = true;
    holds.add(String(reason));
    stopTimer();
    if (active) {
      const { id } = active;
      active = null;
      manager?.close(id);
    }
  }

  /** Back to normal spawning: one fresh interval, never a queued backlog. */
  function resume(reason = "event") {
    holds.delete(String(reason));
    if (!suspended) return;
    suspended = false;
    if (running) startTimer(gap(false));
  }

  /** Ask for quiet while an important dialog, tutorial or minigame is open. */
  function hold(reason = "busy") {
    holds.add(String(reason));
  }

  function release(reason = "busy") {
    holds.delete(String(reason));
  }

  function destroy() {
    stop();
    suspended = false;
    holds.clear();
    if (active) {
      const { id } = active;
      active = null;
      manager.close(id);
    }
  }

  return {
    start,
    stop,
    suspend,
    resume,
    destroy,
    show,
    openEncounter,
    dismiss,
    hold,
    release,
    // Reads the live window, so a dialog closed with its own X is immediately
    // reported as closed even before the scheduler's next tick.
    isOpen: () => Boolean(active && manager.isOpen(active.id)),
    getActive: () => (active && manager.isOpen(active.id) ? active.message.id : null),
    getHistory: () => history(),
    getSessionCount: () => sessionCount,
  };
}
