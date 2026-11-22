/**
 * LIBERATION — the final narrative controller.
 *
 * It deliberately sits beside the established systems instead of replacing
 * them:
 *
 * - availability is read from the authoritative fragment lists in
 *   js/data/music.js and js/data/dreams.js: every collectible track must be
 *   *understood* through the shared listening tracker and every dream record
 *   must be read before the realization may begin; there is no parallel
 *   counter;
 * - while the sequence plays, the ordinary desktop schedulers are suspended
 *   through the injected hooks so no Twister or system alert can interrupt it;
 * - every dialogue stage, the choice hand-off and the completed event are
 *   stable IDs in the shared progression store, so a refresh resumes at the
 *   right stage and never repeats a finished one;
 * - M.I.L.O. renders the four stages and the final YES / NOT NOW choice through
 *   the existing dialogue component;
 * - the sequence uses one dedicated audio element (not the shared collectible
 *   player) and drives its windows from that audio's playhead;
 * - temporary windows are ordinary .window chrome inside their own event
 *   layer. They are never registered with the window manager, so none of them
 *   appears in the taskbar or touches the visitor's open programs.
 *
 * The result is a scripted desktop event, not a sixth application.
 */
import { el } from "./dom.js";
import { onLocaleChange, t } from "../i18n/index.js";
import { readPref } from "./storage.js";
import { progression } from "./progression.js";
import { player } from "./player.js";
import { tracks } from "../data/music.js";
import { dreamPages } from "../data/dreams.js";
import {
  LIBERATION,
  LIBERATION_ASSETS,
  LIBERATION_MOODBOARD,
  LIBERATION_TIMELINE,
} from "../data/liberation.js";

const MAX_ACTIVE_WINDOWS = 26;
const PRELOAD_TIMEOUT_MS = 1_800;
const CLOSE_ANIMATION_MS = 360;
/* The layer's own fade-out is defined as 1.1s in css/liberation.css. The node
   must outlive that transition, otherwise a teardown that starts the fade is
   removed at partial opacity and the desktop pops back instead of dissolving. */
const OVERLAY_LEAVE_MS = 1200;
/* M.I.L.O.'s one-time thank-you. It is spoken only after the event ended and
   the ordinary desktop is back, and it is recorded so it never repeats. */
const THANKS_EVENT = "liberation-thanks";
const THANKS_DELAY_MS = 1_600;
const THANKS_RETRY_MS = 2_000;

function uniqueSources() {
  const sources = Object.values(LIBERATION_ASSETS).map((asset) => asset.src);
  sources.push(LIBERATION.signalsPortrait);
  return [...new Set(sources)];
}

function allFragmentsUnderstood(store) {
  try {
    // Collecting or opening a track is not enough: the 70% unique-listening
    // threshold (js/core/listening.js) must have marked every one understood.
    const tracksReady = tracks.every((track) => store.hasUnderstood(track.id));
    const dreamsReady = dreamPages.every((dream) => store.hasDream(dream.id));
    return tracksReady && dreamsReady;
  } catch {
    return false;
  }
}

function eventExists(store, id) {
  try {
    return Boolean(store.hasEvent(id));
  } catch {
    return false;
  }
}

function recordEvent(store, id) {
  try {
    return store.completeEvent(id);
  } catch {
    return false;
  }
}

function wait(ms) {
  if (!(ms > 0)) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (timer && typeof timer.unref === "function") timer.unref();
  });
}

export function createLiberation(options = {}) {
  const mascot = options.mascot || null;
  const store = options.store || progression;
  const audioPlayer = options.audioPlayer || player;
  const quiet = typeof options.quiet === "function" ? options.quiet : () => {};
  const canSpeak =
    typeof options.canSpeak === "function" ? options.canSpeak : () => true;
  const onBeforeStart =
    typeof options.onBeforeStart === "function" ? options.onBeforeStart : () => {};
  /* Suspend every ordinary desktop interruption while the event owns the
     desktop, and restore normal spawning when it finishes. */
  const onSequenceStart =
    typeof options.onSequenceStart === "function" ? options.onSequenceStart : () => {};
  const onSequenceEnd =
    typeof options.onSequenceEnd === "function" ? options.onSequenceEnd : () => {};
  const root =
    options.root ||
    (typeof document !== "undefined" ? document.getElementById("desktop") : null);
  /* Development aid: `?liberation` exposes the event before it is earned, so
     the audiovisual sequence can be tested without replaying the whole
     archive. It never writes progression. */
  const allowPreview = Boolean(options.allowPreview);

  let destroyed = false;
  let started = false;
  let active = false;
  let starting = false;
  let finishing = false;
  let completed = false;
  let choiceReady = false;
  let dialogueOpen = false;
  let choiceOpen = false;
  let transitionTimer = null;
  let ticker = null;
  let preloadPromise = null;
  let layer = null;
  let entry = null;
  let audio = null;
  let wasPlaying = false;
  let audioStarted = false;
  let raf = 0;
  let cueIndex = 0;
  let windowSequence = 0;
  let fallbackTimer = null;
  let titleEl = null;
  let suspended = false;
  /* A replay is the same audiovisual event without its narrative framing. */
  let replaying = false;
  let thanksTimer = null;
  let glitchSeed = 0x7f0a;
  const windows = new Map();
  const effectTimers = new Set();
  let stopLocale = null;

  /* ------------------------------------------------------------- preload */

  function preload() {
    if (preloadPromise) return preloadPromise;
    if (typeof Image !== "function") {
      preloadPromise = Promise.resolve();
      return preloadPromise;
    }
    const images = uniqueSources().map(
      (src) =>
        new Promise((resolve) => {
          const image = new Image();
          image.onload = () => resolve(true);
          image.onerror = () => resolve(false);
          image.src = src;
        }),
    );
    preloadPromise = Promise.all(images).then(() => true);
    return preloadPromise;
  }

  /* --------------------------------------------------------------- entry */

  function paintEntry() {
    if (!entry) return;
    const isComplete = completed || eventExists(store, LIBERATION.completeEvent);
    entry.classList.toggle("is-complete", isComplete);
    entry.classList.toggle("is-ready", !isComplete);
    const label = t(
      isComplete ? "liberation.entry.complete" : "liberation.entry.ready",
    );
    entry.title = label;
    entry.setAttribute("aria-label", label);
  }

  function ensureEntry() {
    if (destroyed) return;
    const canShow =
      completed ||
      choiceReady ||
      allowPreview ||
      eventExists(store, LIBERATION.choiceReadyEvent);
    if (!canShow) {
      entry?.remove();
      entry = null;
      return;
    }
    if (entry && entry.isConnected) {
      paintEntry();
      return;
    }
    const tray = document.querySelector(".taskbar__tray");
    if (!tray) return;
    entry = el("button", {
      class: "taskbar__liberation raised",
      type: "button",
      title: t("liberation.entry.ready"),
      "aria-label": t("liberation.entry.ready"),
      dataset: { liberation: "entry" },
      on: {
        click: () => {
          if (active || starting) return;
          if (allowPreview && !completed) {
            preview();
            return;
          }
          if (completed || eventExists(store, LIBERATION.completeEvent)) {
            mascot?.showLine?.({
              key: "liberation.remember",
              tone: "event",
              holdMs: 10_000,
            });
            return;
          }
          openFinalChoice({ force: true });
        },
      },
    });
    entry.append(el("span", { class: "taskbar__liberation-glyph", text: "✦" }));
    tray.prepend(entry);
    paintEntry();
  }

  /* ------------------------------------------------------------- dialogue */

  function nextStageIndex() {
    return LIBERATION.dialogue.findIndex(
      (stage) => !eventExists(store, stage.id),
    );
  }

  function closeDialogue() {
    try {
      if (typeof mascot?.endTutorial === "function") {
        mascot.endTutorial({ hide: true });
      } else {
        mascot?.hide?.("liberation");
      }
    } catch (error) {
      console.warn("[liberation] could not close the dialogue", error);
    }
    dialogueOpen = false;
    choiceOpen = false;
  }

  function openStage(index) {
    if (destroyed || active || starting || !allFragmentsUnderstood(store)) {
      return false;
    }
    if (dialogueOpen || choiceOpen || transitionTimer !== null) return false;
    if (!canSpeak()) return false;
    const stage = LIBERATION.dialogue[index];
    if (!stage) return false;

    const shown = mascot?.showDialog?.({
      titleKey: "mascot.title",
      bodyKey: stage.bodyKey,
      actionKey: stage.actionKey,
      persistent: true,
      onAction: () => {
        if (destroyed || active) return;
        recordEvent(store, stage.id);
        closeDialogue();
        const next = index + 1;
        if (next < LIBERATION.dialogue.length) {
          transitionTimer = setTimeout(() => {
            transitionTimer = null;
            if (!openStage(next)) tick();
          }, 220);
          if (transitionTimer && typeof transitionTimer.unref === "function") {
            transitionTimer.unref();
          }
        } else {
          // A short, quiet pause between the realization and the last message.
          transitionTimer = setTimeout(() => {
            transitionTimer = null;
            if (!openFinalChoice()) tick();
          }, 1_500);
          if (transitionTimer && typeof transitionTimer.unref === "function") {
            transitionTimer.unref();
          }
        }
      },
    });

    if (!shown) return false;
    dialogueOpen = true;
    choiceOpen = false;
    quiet(true);
    preload();
    return true;
  }

  function openFinalChoice({ force = false } = {}) {
    if (
      destroyed ||
      active ||
      starting ||
      dialogueOpen ||
      choiceOpen ||
      transitionTimer !== null
    ) {
      return false;
    }
    if (!allFragmentsUnderstood(store)) return false;
    if (completed || eventExists(store, LIBERATION.completeEvent)) return false;
    /* Automatic hand-offs wait for M.I.L.O. to be free. The taskbar entry is a
       direct request from the visitor, so it may replace a routine line. */
    if (!force && !canSpeak()) return false;

    const shown = mascot?.showDialog?.({
      titleKey: "mascot.title",
      bodyKey: LIBERATION.choice.bodyKey,
      actionKey: LIBERATION.choice.actionKey,
      secondaryActionKey: LIBERATION.choice.secondaryActionKey,
      persistent: true,
      onAction: () => {
        if (destroyed || active) return;
        recordEvent(store, LIBERATION.choiceReadyEvent);
        choiceReady = true;
        choiceOpen = false;
        dialogueOpen = false;
        closeDialogue();
        startSequence();
      },
      onSecondary: () => {
        if (destroyed || active) return;
        recordEvent(store, LIBERATION.choiceReadyEvent);
        choiceReady = true;
        choiceOpen = false;
        dialogueOpen = false;
        closeDialogue();
        quiet(false);
        ensureEntry();
      },
    });

    if (!shown) return false;
    recordEvent(store, LIBERATION.choiceReadyEvent);
    choiceReady = true;
    choiceOpen = true;
    dialogueOpen = false;
    quiet(true);
    ensureEntry();
    preload();
    return true;
  }

  /* --------------------------------------------------------------- event */

  function ensureAudio() {
    if (audio) return audio;
    if (typeof Audio !== "function") return null;
    try {
      const node = new Audio();
      node.preload = "auto";
      node.src = LIBERATION.audio;
      const volume = Number(readPref("volume", 0.7));
      node.volume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.7;
      node.muted = Boolean(readPref("muted", false));
      node.addEventListener("ended", () => {
        if (active || starting) finishSequence();
      });
      node.addEventListener("error", () => {
        if (active || starting) {
          failSequence("liberation.audioError");
        }
      });
      audio = node;
      return node;
    } catch (error) {
      console.warn("[liberation] audio element unavailable", error);
      return null;
    }
  }

  function buildLayer() {
    layer = el("div", {
      class: "liberation-layer",
      role: "presentation",
      "aria-label": "LIBERATION",
    });
    layer.append(
      el("div", { class: "liberation-boot", "aria-hidden": "true" }, [
        el("span", { class: "liberation-boot__title", text: "LIBERATION" }),
        el("span", { class: "liberation-boot__code", text: "0x7F0A // CONNECTING" }),
      ]),
    );
    root?.append(layer);
    /* The entrance fade runs exactly once. Dropping the class when it ends
       frees the layer's animation slot, so the glitch, shift and pulse states
       cannot knock the layer back to transparent and replay the fade. */
    layer.classList.add("is-entering");
    addEffectTimer(() => layer?.classList.remove("is-entering"), 720);
    return layer;
  }

  /** Paint the whole-desktop state without requiring a DOM (tests, SSR). */
  function setLiberating(on) {
    if (typeof document === "undefined" || !document.body) return;
    document.body.classList.toggle("is-liberating", Boolean(on));
  }

  /* ------------------------------------------------------- desktop control */

  /** The event takes the whole desktop: schedulers stop, nothing queues up. */
  function suspendDesktop() {
    if (suspended) return;
    suspended = true;
    // A running OUTSIDER may still own the pointer. The event needs the cursor
    // and the keyboard, so any lock is released even if its window stays open.
    if (typeof document !== "undefined") {
      try {
        document.exitPointerLock?.();
      } catch {
        /* no lock to release */
      }
    }
    try {
      onSequenceStart();
    } catch (error) {
      console.warn("[liberation] could not suspend the desktop", error);
    }
  }

  /** Restore ordinary spawning with a fresh interval, never a backlog. */
  function resumeDesktop() {
    if (!suspended) return;
    suspended = false;
    try {
      onSequenceEnd();
    } catch (error) {
      console.warn("[liberation] could not restore the desktop", error);
    }
  }

  /* ------------------------------------------------------- title and decay */

  function nextSeed() {
    glitchSeed = (Math.imul(glitchSeed, 1664525) + 1013904223) >>> 0;
    return glitchSeed;
  }

  const GLITCH_GLYPHS = "▚▓▒░#@%&01";

  /** Damage a copy of a word without ever touching the real message. */
  function corruptWord(word) {
    const chars = String(word).split("");
    const hits = 1 + (nextSeed() % 2);
    for (let index = 0; index < hits; index += 1) {
      const at = nextSeed() % chars.length;
      chars[at] = GLITCH_GLYPHS[nextSeed() % GLITCH_GLYPHS.length];
    }
    return chars.join("");
  }

  /**
   * The opening title returns at 1:17, centered, with the exact same type as
   * the boot card. It stays behind the crowd that follows.
   */
  function showTitle(cue = {}) {
    if (!layer) return;
    if (cue.off) {
      const current = titleEl;
      titleEl = null;
      if (!current) return;
      current.classList.add("is-leaving");
      addEffectTimer(() => current.remove(), 540);
      return;
    }
    if (titleEl) return;
    titleEl = el("div", { class: "liberation-title", "aria-hidden": "true" }, [
      el("span", {
        class: "liberation-boot__title liberation-title__word",
        text: "LIBERATION",
      }),
      el("span", { class: "liberation-title__code", text: "0x7F0A // RETURN" }),
    ]);
    layer.append(titleEl);
    requestAnimationFrame(() => titleEl?.classList.add("is-open"));
  }

  /**
   * Controlled corruption: a short shake, displaced copies of the title and a
   * momentarily damaged word. `level: "hard"` is used from 1:31 on.
   */
  function glitch(cue = {}) {
    if (!layer) return;
    const hard = cue.level === "hard";
    layer.classList.remove("is-glitch-subtle", "is-glitch-hard");
    // Force a reflow so the same class can restart its animation.
    void layer.offsetWidth;
    layer.classList.add(hard ? "is-glitch-hard" : "is-glitch-subtle");
    const duration = Math.max(200, Math.round((cue.hold || 0.42) * 1000));
    addEffectTimer(() => {
      layer?.classList.remove("is-glitch-subtle", "is-glitch-hard");
    }, duration);

    if (!titleEl) return;
    const word = titleEl.querySelector(".liberation-title__word");
    if (word) {
      const original = "LIBERATION";
      word.textContent = corruptWord(original);
      addEffectTimer(() => {
        if (word.isConnected) word.textContent = original;
      }, Math.max(170, Math.round(duration * 0.55)));
    }

    const copies = hard ? 3 : 1;
    for (let index = 0; index < copies; index += 1) {
      const ghost = el("span", {
        class: "liberation-title__ghost",
        text: nextSeed() % 6 === 0 ? "soul_trapped" : corruptWord("LIBERATION"),
        "aria-hidden": "true",
      });
      ghost.style.setProperty("--gx", `${Math.round((nextSeed() % 140) - 70)}px`);
      ghost.style.setProperty("--gy", `${Math.round((nextSeed() % 44) - 22)}px`);
      ghost.style.setProperty("--g-ink", hard ? "0.72" : "0.4");
      titleEl.append(ghost);
      addEffectTimer(() => ghost.remove(), 190 + (nextSeed() % 260));
    }
  }

  function addEffectTimer(callback, ms) {
    const timer = setTimeout(() => {
      effectTimers.delete(timer);
      callback();
    }, ms);
    effectTimers.add(timer);
    if (timer && typeof timer.unref === "function") timer.unref();
    return timer;
  }

  function closeWindow(win, immediate = false) {
    if (!win || !win.isConnected) return;
    windows.delete(win);
    if (immediate) {
      win.remove();
      return;
    }
    win.classList.remove("is-open");
    win.classList.add("is-closing");
    addEffectTimer(() => win.remove(), CLOSE_ANIMATION_MS);
  }

  function closeAll(immediate = false) {
    for (const win of [...windows.keys()]) closeWindow(win, immediate);
  }

  function closeOldest() {
    const first = windows.keys().next().value;
    if (first) closeWindow(first);
  }

  function titleFor(cue) {
    if (cue.kind === "signals") return cue.variant === "command" ? "soul_trapped" : "SIGNAL_7F0A";
    if (cue.kind === "word") return "WORD";
    if (cue.kind === "phrase" || cue.kind === "finale") return "MESSAGE";
    if (cue.kind === "moodboard") return "MOODBOARD";
    if (cue.kind === "thread") return "THREAD_2049";
    if (cue.kind === "composition") return "WORD";
    const asset = LIBERATION_ASSETS[cue.asset];
    return asset?.label || "ARCHIVE";
  }

  function iconFor(cue) {
    if (cue.kind === "signals") return "assets/icons/signals.svg";
    if (cue.kind === "image" || cue.kind === "culture" || cue.kind === "moodboard") {
      return "assets/icons/images.svg";
    }
    return "assets/icons/monitor.svg";
  }

  function mediaContent(cue) {
    const asset = LIBERATION_ASSETS[cue.asset];
    if (!asset) return el("div", { class: "lib-missing", text: "NO SIGNAL" });
    const figure = el("figure", { class: "lib-media" }, [
      el("img", {
        src: asset.src,
        alt: "",
        draggable: "false",
        loading: "eager",
      }),
      el("figcaption", { class: "lib-media__caption" }, [
        el("span", { text: asset.label }),
        el("span", {
          text: cue.tone === "chaos" ? "FORCE" : cue.kind === "culture" ? "CULTURE" : "EARTH",
        }),
      ]),
    ]);
    if (cue.kind === "culture") {
      figure.append(
        el("span", {
          class: "lib-media__tag",
          text: cue.asset === "netart1" ? "#digital-art" : "#archive",
        }),
      );
    }
    return figure;
  }

  function moodboardContent() {
    const grid = el("div", { class: "lib-mood" });
    for (const key of LIBERATION_MOODBOARD) {
      const asset = LIBERATION_ASSETS[key];
      if (!asset) continue;
      grid.append(
        el("figure", { class: "lib-mood__cell" }, [
          el("img", { src: asset.src, alt: "", draggable: "false" }),
          el("figcaption", { text: asset.label }),
        ]),
      );
    }
    return grid;
  }

  function threadContent(cue) {
    return el("div", { class: "lib-thread" }, [
      el("div", { class: "lib-thread__head" }, [
        el("span", { text: "THREAD // 2049" }),
        el("span", { text: "anon" }),
      ]),
      el("p", { class: "lib-thread__post", text: t(cue.key) }),
      el("p", { class: "lib-thread__line", text: t("liberation.thread.line") }),
      el("div", {
        class: "lib-thread__tags",
        text: t("liberation.thread.tags"),
      }),
    ]);
  }

  function signalContent(cue) {
    const variant = cue.variant || "portrait";
    const children = [
      el("div", { class: "lib-signal__portrait" }, [
        el("img", {
          src: LIBERATION.signalsPortrait,
          alt: "",
          draggable: "false",
        }),
        el("span", { class: "lib-signal__scan", "aria-hidden": "true" }),
      ]),
    ];
    /* The first appearance is just the face. Later appearances add the
       identifier and corrupted transmission so the entity has no need for
       ordinary dialogue. */
    if (variant !== "face") {
      children.push(
        el("div", { class: "lib-signal__read" }, [
          el("span", { class: "lib-signal__id", text: "soul_trapped" }),
          el("span", {
            class: "lib-signal__code",
            text: variant === "command" ? "> SIGNAL ACCEPTED" : "0x7F0A // 0110",
          }),
          el("span", {
            class: "lib-signal__code",
            text: variant === "corrupt" ? "▓▒░ I SEE YOU" : "I SEE YOU",
          }),
        ]),
      );
    }
    return el("div", { class: `lib-signal lib-signal--${variant}` }, children);
  }

  function copyContent(cue) {
    // Machine noise stays literal; every human sentence is a translated key.
    const text = typeof cue.text === "string" ? cue.text : t(cue.key);
    return el("div", { class: `lib-copy${cue.corrupt ? " is-corrupt" : ""}` }, [
      el("p", { class: "lib-copy__text", text }),
      el("span", {
        class: "lib-copy__meta",
        text: cue.meta || "7F0A / LIBERATION",
      }),
    ]);
  }

  function wordContent(cue) {
    const word = el("span", { text: t(cue.key) });
    if (typeof cue.key === "string" && t(cue.key).length >= 9) {
      word.dataset.long = "true";
    }
    return el("div", { class: "lib-word" }, [word]);
  }

  function openWindow(cue, override = {}) {
    if (!layer || destroyed) return null;
    if (windows.size >= MAX_ACTIVE_WINDOWS) closeOldest();

    const kind = override.kind || cue.kind;
    const size = override.size || cue.size || "image";
    const x = override.x ?? cue.x ?? 8;
    const y = override.y ?? cue.y ?? 30;
    const windowTitle = override.title || cue.windowTitle || titleFor(cue);
    const win = el("section", {
      class: `window liberation-window liberation-window--${kind} liberation-window--${size} tone-${cue.tone || "message"}`,
      "aria-hidden": "true",
    });
    // CSS custom properties must go through setProperty: Object.assign on
    // style silently ignores them, which would stack every window at 0,0.
    win.style.setProperty("--x", `${x}%`);
    win.style.setProperty("--y", `${y}%`);
    win.style.zIndex = String(300 + windowSequence + (cue.z || 0));
    windowSequence += 1;

    const titlebar = el("header", { class: "window__titlebar" }, [
      el("img", {
        class: "window__icon",
        src: iconFor(cue),
        alt: "",
        width: 16,
        height: 16,
        draggable: "false",
      }),
      el("h2", {
        class: "window__title",
        text: windowTitle,
      }),
      el("div", { class: "window__controls" }, [
        el("span", { class: "window__btn window__btn--min", "aria-hidden": "true" }),
        el("span", { class: "window__btn window__btn--close", "aria-hidden": "true" }),
      ]),
    ]);

    const body = el("div", { class: "window__body" });
    if (kind === "image" || kind === "culture") body.append(mediaContent(cue));
    else if (kind === "moodboard") body.append(moodboardContent());
    else if (kind === "thread") body.append(threadContent(cue));
    else if (kind === "signals") body.append(signalContent(cue));
    else if (kind === "word") body.append(wordContent(cue));
    else if (kind === "composition") body.append(el("div", { class: "lib-word" }));
    else body.append(copyContent(cue));

    win.append(titlebar, body);
    layer.append(win);
    requestAnimationFrame(() => {
      win.classList.add("is-open");
    });

    const hold = override.hold ?? cue.hold;
    const entryRecord = {
      closeAt: Number.isFinite(hold) ? (override.at ?? cue.at) + hold : null,
    };
    windows.set(win, entryRecord);
    return win;
  }

  function openComposition(cue) {
    const words = t(cue.key)
      .split(/\s+/)
      .map((word) => word.trim())
      .filter(Boolean);
    if (!words.length) return;
    const stagger = Number.isFinite(cue.stagger) ? cue.stagger : 0.28;
    const hold = Number.isFinite(cue.hold) ? cue.hold : 6;
    const spread = 84;
    const wordWidth = 14;
    const denominator = Math.max(1, words.length - 1);
    words.forEach((word, index) => {
      const x =
        words.length === 1
          ? 43
          : 8 + (index * (spread - wordWidth)) / denominator;
      const y = (cue.y || 34) + (index % 2 === 0 ? 0 : 2.4);
      const at = cue.at + index * stagger;
      const open = () => {
        const win = openWindow(
          {
            ...cue,
            kind: "phrase",
            tone: cue.tone || "message",
          },
          {
            kind: "composition",
            size: "word",
            x,
            y,
            at,
            hold,
            title: `WORD_${String(index + 1).padStart(2, "0")}`,
          },
        );
        if (!win) return;
        const body = win.querySelector(".window__body");
        if (!body) return;
        const wordNode = el("span", { text: word });
        // Long localized words (PASSAGEIRO, EXPECTATIONS, РЕАЛЬНОСТЬ) get
        // a smaller face so a single independent window still reads as one
        // word rather than a broken two-line fragment.
        if (word.length >= 9) wordNode.dataset.long = "true";
        body.replaceChildren(el("div", { class: "lib-word" }, [wordNode]));
      };
      // A barrage sentence is assembled word by word: each fragment arrives on
      // its own sixteenth instead of the whole line landing at once. The
      // opening compositions keep their single moment.
      if (cue.rapid && index > 0) {
        addEffectTimer(open, Math.round(index * stagger * 1000));
      } else {
        open();
      }
    });
  }

  function applyEffect(cue) {
    if (!layer) return;
    if (cue.effect === "shift") {
      layer.classList.add("is-shift");
      addEffectTimer(() => layer?.classList.remove("is-shift"), 760);
      return;
    }
    if (cue.effect === "peak") {
      layer.classList.add("is-peak", "is-pulse");
      addEffectTimer(() => {
        layer?.classList.remove("is-peak", "is-pulse");
      }, Math.max(900, (cue.hold || 1.6) * 1000));
      return;
    }
    if (cue.effect === "fade") {
      layer.classList.add("is-resolving");
    }
  }

  function fireCue(cue) {
    switch (cue.kind) {
      case "image":
      case "culture":
      case "phrase":
      case "word":
      case "signals":
      case "moodboard":
      case "thread":
      case "finale":
        openWindow(cue);
        break;
      case "title":
        showTitle(cue);
        break;
      case "glitch":
        glitch(cue);
        break;
      case "composition":
        openComposition(cue);
        break;
      case "effect":
        applyEffect(cue);
        break;
      case "clear":
        closeAll();
        break;
      case "teardown":
        teardownVisuals();
        break;
      default:
        break;
    }
  }

  function step() {
    if (!active || finishing || destroyed) return;
    const time = Number.isFinite(audio?.currentTime) ? audio.currentTime : 0;

    while (cueIndex < LIBERATION_TIMELINE.length) {
      const cue = LIBERATION_TIMELINE[cueIndex];
      if (cue.at > time) break;
      cueIndex += 1;
      fireCue(cue);
    }

    for (const [win, record] of windows) {
      if (record.closeAt !== null && time >= record.closeAt) closeWindow(win);
    }

    raf = requestAnimationFrame(step);
  }

  function teardownVisuals() {
    closeAll();
    layer?.classList.add("is-resolving");
    const current = layer;
    layer = null;
    titleEl = null;
    addEffectTimer(() => {
      current?.remove();
    }, OVERLAY_LEAVE_MS);
  }

  function restorePlayer() {
    if (!wasPlaying) return;
    wasPlaying = false;
    addEffectTimer(() => {
      try {
        audioPlayer.play();
      } catch (error) {
        console.warn("[liberation] could not resume the music player", error);
      }
    }, 500);
  }

  function stopAudio() {
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      /* an unloaded element is allowed to refuse */
    }
  }

  function clearEventState() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (fallbackTimer !== null) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    for (const timer of effectTimers) clearTimeout(timer);
    effectTimers.clear();
    windows.clear();
    layer = null;
    cueIndex = 0;
    windowSequence = 0;
    audioStarted = false;
    finishing = false;
    starting = false;
    active = false;
    titleEl = null;
    setLiberating(false);
  }

  function finishSequence() {
    if (finishing || destroyed) return;
    // A replay never touches progression: it just gives the desktop back.
    if (replaying) {
      endReplay();
      return;
    }
    if (completed || eventExists(store, LIBERATION.completeEvent)) {
      clearEventState();
      quiet(false);
      resumeDesktop();
      return;
    }
    finishing = true;
    active = false;
    starting = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (fallbackTimer !== null) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    closeAll();
    teardownVisuals();
    stopAudio();
    // The desktop class is cleared before the completion event is written: the
    // LIBERATION.EXE shortcut is created by that event, and it refuses to mount
    // while `is-liberating` still marks the desktop as owned by the sequence.
    setLiberating(false);
    recordEvent(store, LIBERATION.completeEvent);
    completed = true;
    audioStarted = false;
    quiet(false);
    resumeDesktop();
    ensureEntry();
    restorePlayer();
    // Only now, with the desktop restored, may M.I.L.O. thank the visitor.
    queueThanks();
    // The temporary effect timers are allowed to finish their cleanup; the
    // shared event layer is already detached from the desktop.
    finishing = false;
  }

  /* -------------------------------------------------- M.I.L.O. thank-you */

  function thanksOwed() {
    try {
      return (
        (completed || eventExists(store, LIBERATION.completeEvent)) &&
        !eventExists(store, THANKS_EVENT)
      );
    } catch {
      return false;
    }
  }

  function closeThanks() {
    mascot?.hide?.(THANKS_EVENT);
  }

  /**
   * The one-time thank-you. It is recorded only once the bubble really opened,
   * so a busy M.I.L.O. delays it instead of losing it, and a replay never
   * triggers it.
   */
  function announceThanks() {
    thanksTimer = null;
    if (destroyed || !thanksOwed()) return;
    if (
      replaying ||
      active ||
      starting ||
      finishing ||
      (typeof document !== "undefined" &&
        document.body?.classList.contains("is-liberating")) ||
      !canSpeak()
    ) {
      queueThanks(THANKS_RETRY_MS);
      return;
    }
    const opened = Boolean(
      mascot?.showDialog?.({
        titleKey: "mascot.title",
        bodyKey: "liberation.thanks.body",
        actionKey: "liberation.thanks.action",
        onAction: closeThanks,
      }),
    );
    if (!opened) {
      queueThanks(THANKS_RETRY_MS);
      return;
    }
    recordEvent(store, THANKS_EVENT);
  }

  function queueThanks(delay = THANKS_DELAY_MS) {
    if (thanksTimer !== null || destroyed) return;
    thanksTimer = setTimeout(() => {
      thanksTimer = null;
      announceThanks();
    }, Math.max(0, delay));
    if (thanksTimer && typeof thanksTimer.unref === "function") {
      thanksTimer.unref();
    }
  }

  function failSequence(key = "liberation.audioError") {
    if (destroyed || completed) return;
    const wasStarted = active || starting;
    active = false;
    starting = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (fallbackTimer !== null) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    closeAll();
    teardownVisuals();
    stopAudio();
    setLiberating(false);
    quiet(false);
    resumeDesktop();
    ensureEntry();
    replaying = false;
    stopReplayKeys();
    if (wasStarted) restorePlayer();
    mascot?.showLine?.({
      key,
      tone: "alert",
      holdMs: 14_000,
    });
  }

  /* ------------------------------------------------------------- replay */

  function stopReplayKeys() {
    if (typeof document === "undefined") return;
    document.removeEventListener("keydown", onReplayKey, true);
  }

  function onReplayKey(event) {
    if (event.key !== "Escape" || !replaying || !active) return;
    event.preventDefault();
    event.stopPropagation();
    endReplay();
  }

  /**
   * Stop a replay early. The shortcut stays available: the completed event is
   * unchanged, so the visitor can open it again whenever they want.
   */
  function endReplay() {
    if (!replaying) return;
    replaying = false;
    finishing = true;
    active = false;
    starting = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (fallbackTimer !== null) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    stopReplayKeys();
    closeAll();
    teardownVisuals();
    stopAudio();
    audioStarted = false;
    cueIndex = 0;
    quiet(false);
    resumeDesktop();
    setLiberating(false);
    ensureEntry();
    restorePlayer();
    finishing = false;
  }

  /** Play the completed event again, from the beginning, with no dialogue. */
  function replay() {
    if (destroyed || active || starting) return false;
    if (!completed && !eventExists(store, LIBERATION.completeEvent)) return false;
    void startSequence({ replay: true });
    return true;
  }

  /**
   * Development preview (`?liberation`): the same event without its narrative
   * framing and without touching progression, available even before the
   * archive has been completed.
   */
  function preview() {
    if (destroyed || active || starting || finishing) return false;
    if (!allowPreview) return false;
    if (completed || eventExists(store, LIBERATION.completeEvent)) {
      return replay();
    }
    void startSequence({ replay: true, preview: true });
    return true;
  }

  async function startSequence({ replay: isReplay = false, preview: isPreview = false } = {}) {
    if (destroyed || active || starting || finishing) return false;
    if (dialogueOpen || choiceOpen) return false;
    const already = completed || eventExists(store, LIBERATION.completeEvent);
    if (isReplay) {
      // Replay exists only after the original event succeeded; the development
      // preview is the one exception and still writes nothing.
      if (!already && !isPreview) return false;
    } else {
      if (already) return false;
      if (!allFragmentsUnderstood(store)) return false;
    }

    replaying = isReplay;
    starting = true;
    active = true;
    try {
      onBeforeStart();
    } catch (error) {
      console.warn("[liberation] could not close the surrounding interface", error);
    }
    mascot?.leaveDock?.();
    // Anything already on screen is dismissed before the event takes over,
    // and is-liberating makes every later line and dialog refuse to open.
    mascot?.endTutorial?.({ hide: true });
    mascot?.hide?.("liberation", false, false, true);
    setLiberating(true);
    buildLayer();
    quiet(true);
    // No Twister, system alert, idle line or subtitle may open from here on.
    suspendDesktop();
    if (isReplay && typeof document !== "undefined") {
      document.addEventListener("keydown", onReplayKey, true);
    }

    const waitForImages = preload();
    const node = ensureAudio();
    if (!node) {
      failSequence("liberation.audioError");
      return false;
    }

    const previous = audioPlayer?.getState?.() || {};
    wasPlaying = previous.status === "playing";
    if (wasPlaying) {
      try {
        audioPlayer.pause("liberation");
      } catch (error) {
        console.warn("[liberation] could not pause the shared player", error);
        wasPlaying = false;
      }
    }

    try {
      await Promise.race([waitForImages, wait(PRELOAD_TIMEOUT_MS)]);
      node.currentTime = 0;
      await node.play();
      if (destroyed) {
        node.pause();
        return false;
      }
    } catch (error) {
      console.warn("[liberation] could not start the soundtrack", error);
      failSequence("liberation.audioError");
      return false;
    }

    starting = false;
    audioStarted = true;
    cueIndex = 0;
    layer?.classList.add("is-live");
    fallbackTimer = setTimeout(() => {
      fallbackTimer = null;
      if (active) finishSequence();
    }, Math.ceil(LIBERATION.duration * 1000) + 8_000);
    if (fallbackTimer && typeof fallbackTimer.unref === "function") {
      fallbackTimer.unref();
    }
    raf = requestAnimationFrame(step);
    return true;
  }

  /* --------------------------------------------------------------- ticker */

  function tick() {
    if (destroyed) return;
    completed = completed || eventExists(store, LIBERATION.completeEvent);
    choiceReady =
      choiceReady || eventExists(store, LIBERATION.choiceReadyEvent);

    if (completed) {
      ensureEntry();
      // A completion restored from a save still owes its one-time thank-you.
      if (!replaying) queueThanks(THANKS_RETRY_MS);
      return;
    }
    if (choiceReady) {
      ensureEntry();
      return;
    }
    // The development preview keeps only its entry: no stage or choice is
    // opened before the visitor asks for the sequence.
    if (allowPreview && !completed) {
      ensureEntry();
      return;
    }
    if (active || starting || dialogueOpen || choiceOpen) return;
    if (transitionTimer !== null) return;
    if (!allFragmentsUnderstood(store)) {
      entry?.remove();
      entry = null;
      return;
    }

    if (!preloadPromise) preload();
    const nextStage = nextStageIndex();
    if (nextStage >= 0) {
      openStage(nextStage);
      return;
    }
    openFinalChoice();
  }

  function start() {
    if (started || destroyed) return;
    started = true;
    tick();
    ticker = setInterval(tick, 1_400);
    if (ticker && typeof ticker.unref === "function") ticker.unref();
    stopLocale = onLocaleChange(paintEntry);
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (ticker !== null) clearInterval(ticker);
    ticker = null;
    if (transitionTimer !== null) clearTimeout(transitionTimer);
    transitionTimer = null;
    if (thanksTimer !== null) clearTimeout(thanksTimer);
    thanksTimer = null;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (fallbackTimer !== null) clearTimeout(fallbackTimer);
    fallbackTimer = null;
    for (const timer of effectTimers) clearTimeout(timer);
    effectTimers.clear();
    closeAll(true);
    stopAudio();
    layer?.remove();
    layer = null;
    if (dialogueOpen || choiceOpen) {
      try {
        mascot?.endTutorial?.({ hide: true });
      } catch {
        /* ignore teardown failures */
      }
    }
    dialogueOpen = false;
    choiceOpen = false;
    replaying = false;
    stopReplayKeys();
    if (wasPlaying) restorePlayer();
    wasPlaying = false;
    setLiberating(false);
    quiet(false);
    resumeDesktop();
    stopLocale?.();
    stopLocale = null;
    entry?.remove();
    entry = null;
    active = false;
    starting = false;
  }

  return {
    start,
    tick,
    destroy,
    // LIBERATION.EXE: the completed sequence again, with no narrative framing.
    replay,
    // The entry's own behaviour: replay once earned, preview while developing.
    open: () => {
      if (completed || eventExists(store, LIBERATION.completeEvent)) {
        return replay();
      }
      return preview();
    },
    preview,
    isPreviewAllowed: () => allowPreview,
    isReplaying: () => replaying,
    isActive: () => active || starting || dialogueOpen || choiceOpen,
    isRunning: () => active,
    isComplete: () => completed || eventExists(store, LIBERATION.completeEvent),
    isChoiceReady: () => choiceReady,
    allFragmentsCollected: () => allFragmentsUnderstood(store),
    preload,
  };
}
