/**
 * OUTSIDER — the listening reflection that belongs to the collected track.
 *
 * The maze itself records completion and grants the desktop file. This small
 * controller owns only the moment the shared listening tracker marks the full
 * OUTSIDER track understood: M.I.L.O. reflects on being trapped inside one's
 * own head, once, and the tutorial flag makes that moment survive a refresh.
 *
 * The reflection is pause-gated like every other comprehension line: reaching
 * the threshold only makes it ready. It is spoken after the visitor pauses the
 * track, and never over the audio. If M.I.L.O. is busy, it stays ready for the
 * pause after that.
 *
 * It never touches the downsampled soundtrack (a private <audio> element in
 * OUTSIDER.EXE), so only the full collectible can reach this state.
 */
import { progression } from "./progression.js";
import { comprehension } from "./comprehension.js";

export const OUTSIDER_STORY = Object.freeze({
  trackId: "outsider",
  understoodKey: "mascot.outsider.understood",
  understoodTutorialId: "outsider-understood",
  retryMs: 2_000,
  maxAttempts: 15,
});

export function createOutsiderStory(options = {}) {
  const mascot = options.mascot || null;
  const store = options.store || progression;
  /* Comprehension lines wait for a visitor-requested pause (shared rule). */
  const gate = options.gate || comprehension;
  const config = { ...OUTSIDER_STORY, ...(options.config || {}) };
  const stops = [];
  let destroyed = false;

  function read(method, id) {
    try {
      return typeof store[method] === "function" ? Boolean(store[method](id)) : false;
    } catch {
      return false;
    }
  }

  function ready() {
    return (
      read("hasTrack", config.trackId) &&
      read("hasUnderstood", config.trackId) &&
      !read("hasSeenTutorial", config.understoodTutorialId)
    );
  }

  /** Show the one-time reflection. @returns {boolean} whether it is settled. */
  function announce() {
    if (!ready()) return true;
    if (!mascot || typeof mascot.showLine !== "function") return false;
    // The LIBERATION event owns the desktop; nothing else speaks over it.
    if (typeof document !== "undefined" && document.body.classList.contains("is-liberating")) {
      return false;
    }
    if (mascot.isTutorial?.() || mascot.isSpeaking?.()) return false;
    const shown = mascot.showLine({
      key: config.understoodKey,
      tone: "event",
      holdMs: 34_000,
    });
    if (!shown) return false;
    try {
      store.markTutorialShown(config.understoodTutorialId);
    } catch (error) {
      console.warn("[outsider] could not record the reflection", error);
    }
    return true;
  }

  /**
   * Register at most one pending delivery: the store emits on every listening
   * tick, so the stable id keeps the queue from stacking the same reflection.
   */
  function check() {
    if (destroyed || !ready()) return;
    gate.whenPaused(announce, { id: "outsider:understood", ready });
  }

  function start() {
    if (stops.length) return;
    stops.push(store.subscribe(check));
    check();
  }

  function destroy() {
    destroyed = true;
    while (stops.length) {
      try {
        stops.pop()();
      } catch {
        /* already detached */
      }
    }
  }

  return { start, check, destroy };
}
