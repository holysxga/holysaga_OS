/**
 * Mascot dialogue scheduler — one timer for idle lines and light contextual
 * reactions. It owns no DOM: the mascot component renders, this decides when.
 *
 * Rules:
 * - idle lines need three to six minutes of visible, quiet time, first one
 *   included, so they are a rare beat rather than background chatter;
 * - any other M.I.L.O. line — gallery or viewer comment, tutorial, thought —
 *   restarts that wait, and so does real desktop interaction (clicks, keys,
 *   the wheel, dragging a window), so a busy visitor is never interrupted and
 *   never gets an overdue line the moment they stop;
 * - a hidden tab advances nothing, and the countdown survives hiding;
 * - nothing new opens while a bubble is already speaking, while `hold()` is
 *   active, or while `isBusy()` reports an important dialog (the intrusive
 *   thoughts controller is passed in from boot);
 * - context reactions are gated by a cooldown and a chance roll, and only
 *   fire when they cannot interrupt something else;
 * - the dialogue trail is stored in the shared progression manager as `mascot`,
 *   so a reload does not immediately repeat the last line.
 */
import { progression } from "./progression.js";
import { MASCOT_DIALOGUE, MASCOT_DIALOGUE_CONFIG } from "../data/mascot-dialogue.js";

const clampIndex = (index, length) => Math.min(Math.max(index, 0), length - 1);

/* Real interaction with the desktop. Captured so a program that stops
   propagation cannot hide a click from the idle scheduler. */
const ACTIVITY_EVENTS = ["keydown", "wheel", "touchstart", "focusin"];

export function createMascotDialogue(options = {}) {
  const mascot = options.mascot;
  const store = options.store || progression;
  const doc = options.document || (typeof document === "undefined" ? null : document);
  const config = { ...MASCOT_DIALOGUE_CONFIG, ...(options.config || {}) };
  const random = options.random || Math.random;
  const isBusy = typeof options.isBusy === "function" ? options.isBusy : () => false;

  const holds = new Set();
  const timeMarks = new Set();
  const lastContext = { open: 0, close: 0, time: 0 };

  let running = false;
  let timer = null;
  let pendingContext = null;
  let countdown = 0;
  let sessionCount = 0;
  let visibleMs = 0;
  let lastLine = null;
  /* Speech is observed, not subscribed to: a line opened by any other module
     (gallery, viewer, tutorial, thought) restarts the idle wait when it ends. */
  let wasSpeaking = false;
  let pointerDown = false;
  let listening = false;

  function history() {
    try {
      return typeof store.getMascotLines === "function" ? store.getMascotLines() : [];
    } catch {
      return [];
    }
  }

  function isVisible() {
    return !doc || doc.visibilityState !== "hidden";
  }

  /**
   * Is the visitor doing something right now? A held pointer or a window drag
   * both count: idle lines must never pop up mid-gesture.
   */
  function isInteracting() {
    if (pointerDown) return true;
    return Boolean(doc && doc.documentElement.classList.contains("is-dragging"));
  }

  /** Wait the full randomized gap again. */
  function restartWait() {
    countdown = gap(false);
  }

  /**
   * Notice M.I.L.O. starting or finishing any line. Another dialogue is a
   * contextual comment too, so it resets the idle timer in both directions.
   * @returns {boolean} whether the speaking state changed
   */
  function syncSpeech() {
    const now = Boolean(
      mascot && typeof mascot.isSpeaking === "function" && mascot.isSpeaking(),
    );
    if (now === wasSpeaking) return false;
    wasSpeaking = now;
    restartWait();
    return true;
  }

  function onActivity() {
    if (!running) return;
    restartWait();
  }

  function onPointerDown() {
    pointerDown = true;
    onActivity();
  }

  function onPointerUp() {
    pointerDown = false;
  }

  function listenForActivity() {
    if (listening || !doc || typeof doc.addEventListener !== "function") return;
    listening = true;
    // A press both restarts the wait and counts as "busy" until it is released,
    // which covers dragging a window or holding a control down.
    doc.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
    for (const type of ACTIVITY_EVENTS) {
      doc.addEventListener(type, onActivity, { capture: true, passive: true });
    }
    doc.addEventListener("pointerup", onPointerUp, { capture: true, passive: true });
    doc.addEventListener("pointercancel", onPointerUp, { capture: true, passive: true });
  }

  function stopListening() {
    if (!listening || !doc || typeof doc.removeEventListener !== "function") return;
    listening = false;
    pointerDown = false;
    doc.removeEventListener("pointerdown", onPointerDown, { capture: true });
    for (const type of ACTIVITY_EVENTS) {
      doc.removeEventListener(type, onActivity, { capture: true });
    }
    doc.removeEventListener("pointerup", onPointerUp, { capture: true });
    doc.removeEventListener("pointercancel", onPointerUp, { capture: true });
  }

  function gap(first) {
    const min = first ? config.firstDelayMin : config.intervalMin;
    const max = first ? config.firstDelayMax : config.intervalMax;
    return Math.round(min + random() * Math.max(0, max - min));
  }

  function pool(group) {
    return MASCOT_DIALOGUE.filter((entry) => entry.group === group);
  }

  /** Prefer unseen lines, avoid the previous line, then avoid recent ones. */
  function pick(group) {
    const lines = pool(group);
    if (!lines.length) return null;
    const seen = new Set([...history(), lastLine]);
    let candidates = lines.filter((entry) => !seen.has(entry.id));
    if (!candidates.length) {
      const recent = new Set([...history().slice(-config.recentLimit), lastLine]);
      candidates = lines.filter((entry) => !recent.has(entry.id));
    }
    if (!candidates.length) candidates = lines.filter((entry) => entry.id !== lastLine);
    if (!candidates.length) candidates = lines;
    return candidates[clampIndex(Math.floor(random() * candidates.length), candidates.length)];
  }

  function canSpeak() {
    return Boolean(
      running &&
        mascot &&
        typeof mascot.isSpeaking === "function" &&
        !mascot.isSpeaking() &&
        holds.size === 0 &&
        !isBusy() &&
        isVisible(),
    );
  }

  function show(entry, holdMs) {
    if (!entry || !canSpeak()) return false;
    const opened = mascot.showLine({
      key: entry.key,
      tone: entry.group,
      holdMs,
    });
    if (!opened) return false;
    lastLine = entry.id;
    sessionCount += 1;
    countdown = gap(false);
    if (typeof store.recordMascotLine === "function") {
      try {
        store.recordMascotLine(entry.id);
      } catch (error) {
        console.warn("[mascot] could not record dialogue", error);
      }
    }
    return true;
  }

  /** "You have been here a while" moments, at most once per visit each. */
  function checkTime() {
    for (const mark of config.timeMarks) {
      if (visibleMs < mark || timeMarks.has(mark)) continue;
      if (show(pick("time"), config.contextHoldMs)) {
        timeMarks.add(mark);
        lastContext.time = Date.now();
      }
    }
  }

  function tick() {
    if (!running) return;
    // Hidden time is not exploration: neither the mark nor the countdown moves.
    if (!isVisible()) return;
    visibleMs += config.tickMs;
    // Any line M.I.L.O. said in the meantime restarts the idle delay.
    syncSpeech();
    // A click, a drag or an open menu pauses everything instead of queueing a
    // line that would fire the instant the visitor stops.
    if (isInteracting()) return;
    checkTime();
    if (!canSpeak()) return;
    if (sessionCount >= config.maxPerSession) return;
    if (countdown > 0) {
      countdown -= config.tickMs;
      return;
    }
    show(pick("idle"), config.idleHoldMs);
  }

  function queueContext(group) {
    if (!running || !canSpeak()) return;
    if (Date.now() - (lastContext[group] || 0) < config.contextCooldownMs) return;
    if (random() > config.contextChance) return;
    if (pendingContext !== null) clearTimeout(pendingContext);
    // A short pause keeps the reaction from landing on top of the click.
    pendingContext = setTimeout(() => {
      pendingContext = null;
      if (!canSpeak()) return;
      if (show(pick(group), config.contextHoldMs)) lastContext[group] = Date.now();
    }, config.contextDelayMs);
    if (pendingContext && typeof pendingContext.unref === "function") {
      pendingContext.unref();
    }
  }

  function start() {
    if (running) return stop;
    running = true;
    countdown = gap(true);
    wasSpeaking = Boolean(
      mascot && typeof mascot.isSpeaking === "function" && mascot.isSpeaking(),
    );
    listenForActivity();
    timer = setInterval(tick, config.tickMs);
    if (timer && typeof timer.unref === "function") timer.unref();
    return stop;
  }

  function stop() {
    if (!running && timer === null && pendingContext === null) return;
    running = false;
    stopListening();
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    if (pendingContext !== null) {
      clearTimeout(pendingContext);
      pendingContext = null;
    }
  }

  /** Ask for quiet while a tutorial, minigame or event dialogue is active. */
  function hold(reason = "busy") {
    holds.add(String(reason));
  }

  function release(reason = "busy") {
    holds.delete(String(reason));
  }

  /**
   * Future narrative hook: show a dedicated localized line by translation key,
   * outside the idle library. The caller owns the event and its hold time.
   */
  function speak(key, holdMs = config.contextHoldMs) {
    if (!mascot || typeof mascot.showLine !== "function") return false;
    const opened = mascot.showLine({ key, tone: "event", holdMs });
    if (opened) countdown = gap(false);
    return opened;
  }

  function destroy() {
    stop();
    holds.clear();
  }

  return {
    start,
    stop,
    destroy,
    hold,
    release,
    speak,
    // Opening a program is its own small beat; closing only counts when the
    // desktop is empty again, so it reads as "back at the desktop".
    noteAppOpened: () => queueContext("open"),
    noteAppClosed: (id, remaining = 0) => {
      if (remaining === 0) queueContext("close");
    },
    isRunning: () => running,
    getSessionCount: () => sessionCount,
  };
}
