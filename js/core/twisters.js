/**
 * TWISTERS — the music fragment left behind by the second Twister.
 *
 * Twister appearances belong to js/core/twister-encounters.js. This module
 * only watches the lifetime counter that `present()` writes when a real
 * creature is attached to a thought window; ordinary intrusive thoughts and
 * the development preview never increment it.
 *
 * Sequence:
 *   1. the first appearance is ignored;
 *   2. on the second, `TWISTERS.wav` is placed on the desktop exactly once;
 *   3. the track is NOT collected here. The visitor uses the drag-and-drop
 *      flow they already know and drops the file on its MUSIC PLAYER slot;
 *   4. once the shared listening tracker marks the track understood, M.I.L.O.
 *      offers the one-time reflection on repetition and human nature.
 *
 * Stable state:
 *   event                 twisters-fragment      second appearance happened and
 *                                                 the desktop file was granted
 *   track                 twisters               collected by a real drop
 *   tutorial              twisters-fragment-intro the discovery remark was shown
 *   tutorial              twisters-understood     the comprehension was shown
 *   understood            twisters               reached 70% unique coverage
 *
 * The discovery remark is an ordinary dialogue bubble, not another tutorial:
 * the visitor already learned how to import audio with Sacred Digital, so the
 * line only mentions the fragment and the file. No tool, other track or
 * encounter policy is touched here.
 */
import { progression } from "./progression.js";
import { comprehension } from "./comprehension.js";
import { EVENT_PRIORITY } from "./event-queue.js";

export const TWISTERS = Object.freeze({
  trackId: "twisters",
  eventId: "twisters-fragment",
  fileId: "twisters-wav",
  fileNameKey: "twisters.file.name",
  introKey: "mascot.twisters.discovery",
  understoodKey: "mascot.twisters.understood",
  actionKey: "mascot.tutorial.next",
  introTutorialId: "twisters-fragment-intro",
  understoodTutorialId: "twisters-understood",
  /* The discovery belongs to the second real appearance, never the first. */
  appearance: 2,
});

export function createTwisters(options = {}) {
  const mascot = options.mascot || null;
  const store = options.store || progression;
  const files = options.files || null;
  const blocked = typeof options.isBlocked === "function" ? options.isBlocked : () => false;
  /* Comprehension lines wait for a visitor-requested pause (shared rule). */
  const gate = options.gate || comprehension;
  const config = { ...TWISTERS, ...(options.config || {}) };

  let started = false;
  const stops = [];

  function read(method, id) {
    try {
      return typeof store[method] === "function" ? Boolean(store[method](id)) : false;
    } catch {
      return false;
    }
  }

  function record(method, id) {
    try {
      return store[method]?.(id);
    } catch (error) {
      console.warn(`[twisters] ${method} failed`, error);
      return false;
    }
  }

  function appearances() {
    try {
      return Number(store.twisterCount?.()) || 0;
    } catch {
      return 0;
    }
  }

  const fileOptions = () => ({
    id: config.fileId,
    trackId: config.trackId,
    nameKey: config.fileNameKey,
  });

  /** The file exists until the matching drop collects it; never afterwards. */
  function ensureFile() {
    if (read("hasTrack", config.trackId)) return null;
    return files?.addFile?.(fileOptions()) || null;
  }

  /** A tutorial or a scripted scene owns M.I.L.O.; wait instead of cutting in. */
  function hardBlocked() {
    if (mascot?.isTutorial?.()) return true;
    try {
      return Boolean(blocked());
    } catch {
      return false;
    }
  }

  function closeIntro() {
    mascot?.hide?.("twisters-fragment");
  }

  /**
   * The discovery remark is one-time and non-blocking, and it is registered
   * with the shared queue: it can never replace a dialogue that is already on
   * screen, and a busy M.I.L.O. simply keeps it queued.
   */
  function announceIntro() {
    if (read("hasSeenTutorial", config.introTutorialId)) return true;
    if (!mascot || typeof mascot.showDialog !== "function") return false;
    if (hardBlocked() || mascot.isSpeaking?.()) return false;

    const opened = Boolean(
      mascot.showDialog({
        bodyKey: config.introKey,
        actionKey: config.actionKey,
        onAction: closeIntro,
      }),
    );
    if (!opened) return false;
    record("markTutorialShown", config.introTutorialId);
    return true;
  }

  /** The discovery is a contextual remark, behind any track reflection. */
  function queueIntro() {
    if (read("hasSeenTutorial", config.introTutorialId)) return;
    gate.whenPaused(announceIntro, {
      id: "twisters:fragment-intro",
      priority: EVENT_PRIORITY.CONTEXT,
      ready: () => !read("hasSeenTutorial", config.introTutorialId),
    });
  }

  function closeUnderstood() {
    mascot?.hide?.("twisters-understood");
  }

  /** The post-listening reflection stays completely independent of the tool. */
  function announceUnderstood() {
    if (read("hasSeenTutorial", config.understoodTutorialId)) return true;
    if (!mascot || typeof mascot.showDialog !== "function") return false;
    // The LIBERATION event owns the desktop; nothing else opens over it.
    if (typeof document !== "undefined" && document.body.classList.contains("is-liberating")) {
      return false;
    }
    if (hardBlocked() || mascot.isSpeaking?.()) return false;

    const opened = Boolean(
      mascot.showDialog({
        bodyKey: config.understoodKey,
        actionKey: config.actionKey,
        onAction: closeUnderstood,
      }),
    );
    if (!opened) return false;
    record("markTutorialShown", config.understoodTutorialId);
    return true;
  }

  /**
   * Understanding is recorded by the shared tracker while the track is still
   * playing. The reflection only appears on the next manual pause, and if
   * M.I.L.O. is busy it stays ready for the pause after that.
   */
  function queueUnderstood() {
    if (!read("hasUnderstood", config.trackId)) return;
    if (read("hasSeenTutorial", config.understoodTutorialId)) return;
    gate.whenPaused(announceUnderstood, {
      id: "twisters:understood",
      ready: () =>
        read("hasUnderstood", config.trackId) &&
        !read("hasSeenTutorial", config.understoodTutorialId),
    });
  }

  /** The second real appearance: grant the file and speak, once. */
  function discover() {
    if (read("hasEvent", config.eventId)) return false;
    record("completeEvent", config.eventId);
    ensureFile();
    queueIntro();
    return true;
  }

  function restore() {
    if (read("hasEvent", config.eventId)) {
      ensureFile();
      if (!read("hasSeenTutorial", config.introTutorialId)) queueIntro();
    } else if (appearances() >= config.appearance) {
      // A save made before this feature already has met enough Twisters.
      discover();
    }

    if (
      read("hasUnderstood", config.trackId) &&
      !read("hasSeenTutorial", config.understoodTutorialId)
    ) {
      queueUnderstood();
    }
  }

  function start() {
    if (started) return;
    started = true;
    restore();

    stops.push(
      store.subscribe((state, change) => {
        if (change?.type === "twisters:add") {
          if (appearances() >= config.appearance) discover();
          return;
        }
        if (change?.type !== "understood:add") return;
        if (change.id !== config.trackId) return;
        queueUnderstood();
      }),
    );
  }

  return {
    start,
    destroy() {
      for (const stop of stops) stop();
      stops.length = 0;
      started = false;
    },
  };
}
