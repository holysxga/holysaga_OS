/**
 * HORIZON — the sunset photograph and its listening discovery.
 *
 * The existing viewer already carries two stable IDs on the sunset entry:
 * `trackId: "horizon"` and `eventId: "sunset-frame"`. This controller follows
 * the Sacred Digital collection pattern:
 *   1. opening the full sunset.png viewer reveals that an audio file is
 *      attached and places `Horizon.wav` on the desktop;
 *   2. HORIZON is NOT collected here. The visitor has to use the existing
 *      drag-and-drop flow and drop the file on the matching MUSIC PLAYER slot;
 *   3. the explanation is a persistent tutorial, so only NEXT releases the
 *      desktop;
 *   4. once the shared listening tracker marks HORIZON understood, M.I.L.O.
 *      reflects on the horizon and the new paths it suggests.
 *
 * State stays in the one shared progression store:
 *   event     sunset-frame              the photograph was discovered and the
 *                                      desktop audio file was granted
 *   track     horizon                   HORIZON was collected by a real drop
 *   tutorial  horizon-sunset-intro      the discovery dialogue was displayed
 *   tutorial  horizon-understood        the comprehension dialogue was displayed
 *   understood horizon                  HORIZON reached its listening threshold
 *
 * No other track, tool or progression state is touched. Sacred Digital's
 * independent understanding/tool flow is deliberately not referenced here.
 */
import { progression } from "./progression.js";
import { comprehension } from "./comprehension.js";

export const HORIZON = Object.freeze({
  photoId: "sunset",
  trackId: "horizon",
  eventId: "sunset-frame",
  fileId: "horizon-wav",
  fileNameKey: "horizon.file.name",
  introKey: "mascot.horizon.discovery",
  understoodKey: "mascot.horizon.understood",
  actionKey: "mascot.tutorial.next",
  introTutorialId: "horizon-sunset-intro",
  understoodTutorialId: "horizon-understood",
  understoodRetryMs: 900,
  restoreDelayMs: 1_200,
});

export function createHorizon(options = {}) {
  const mascot = options.mascot || null;
  const store = options.store || progression;
  const files = options.files || null;
  /* Comprehension lines wait for a visitor-requested pause (shared rule). */
  const gate = options.gate || comprehension;
  const config = { ...HORIZON, ...(options.config || {}) };

  let started = false;
  let introOpen = false;
  const timers = new Set();
  const stops = [];

  function after(ms, handler) {
    const id = setTimeout(() => {
      timers.delete(id);
      handler();
    }, Math.max(0, ms));
    if (id && typeof id.unref === "function") id.unref();
    timers.add(id);
    return id;
  }

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
      console.warn(`[horizon] ${method} failed`, error);
      return false;
    }
  }

  const fileOptions = () => ({
    id: config.fileId,
    trackId: config.trackId,
    nameKey: config.fileNameKey,
  });

  /** Put the audio file on the desktop, but never after it was collected. */
  function ensureFile() {
    if (read("hasTrack", config.trackId)) return null;
    return files?.addFile?.(fileOptions()) || null;
  }

  /** NEXT is the only way out of the discovery explanation. */
  function finishIntro() {
    if (!introOpen) return;
    introOpen = false;
    mascot?.endTutorial?.({ hide: true });
  }

  /**
   * The viewer calls this whenever it shows a photo. Only the stable sunset
   * entry is handled; every other image keeps the viewer's existing behavior.
   * @returns {boolean} whether HORIZON owns this discovery
   */
  function onPhotoOpened(photo) {
    if (!photo || photo.id !== config.photoId) return false;

    // The event means "discovery happened and the desktop file was granted".
    // HORIZON itself stays locked until the visitor drops that file on its slot.
    record("completeEvent", config.eventId);
    ensureFile();

    if (!read("hasSeenTutorial", config.introTutorialId) && !introOpen) {
      const opened = Boolean(
        mascot?.showDialog?.({
          bodyKey: config.introKey,
          actionKey: config.actionKey,
          persistent: true,
          onAction: finishIntro,
        }),
      );
      if (opened) {
        introOpen = true;
        // Mark when it is actually displayed: a refresh then does not repeat
        // the introduction, even if the visitor had not clicked NEXT yet.
        record("markTutorialShown", config.introTutorialId);
      }
    }

    return true;
  }

  function closeUnderstood() {
    mascot?.hide?.("horizon-understood");
  }

  /**
   * Show the comprehension reflection once, after the store has marked the
   * track understood. It is an ordinary dismissible dialog (not another
   * tutorial); if M.I.L.O. is already speaking, it stays ready for the next
   * pause instead of replacing another line.
   */
  function announceUnderstood() {
    if (read("hasSeenTutorial", config.understoodTutorialId)) return true;
    if (!mascot || typeof mascot.showDialog !== "function") return false;
    // The LIBERATION event owns the desktop; nothing else opens over it.
    if (typeof document !== "undefined" && document.body.classList.contains("is-liberating")) {
      return false;
    }

    const busy =
      (typeof mascot.isTutorial === "function" && mascot.isTutorial()) ||
      (typeof mascot.isSpeaking === "function" && mascot.isSpeaking());
    if (busy) return false;

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

  /** Ready at the threshold; spoken only after the visitor pauses the track. */
  function queueUnderstood() {
    if (!read("hasUnderstood", config.trackId)) return;
    if (read("hasSeenTutorial", config.understoodTutorialId)) return;
    gate.whenPaused(announceUnderstood, {
      id: "horizon:understood",
      ready: () =>
        read("hasUnderstood", config.trackId) &&
        !read("hasSeenTutorial", config.understoodTutorialId),
    });
  }

  function start() {
    if (started) return;
    started = true;

    // Restore the desktop file for a discovery that has not been collected.
    // A track already collected through the drop never gets a second file.
    if (read("hasEvent", config.eventId)) ensureFile();

    stops.push(
      store.subscribe((state, change) => {
        if (change?.type !== "understood:add") return;
        if (change.id !== config.trackId) return;
        queueUnderstood();
      }),
    );

    // Covers a refresh between understanding and the one-time line.
    if (
      read("hasUnderstood", config.trackId) &&
      !read("hasSeenTutorial", config.understoodTutorialId)
    ) {
      after(config.restoreDelayMs, queueUnderstood);
    }
  }

  return {
    start,
    onPhotoOpened,
    isIntroOpen: () => introOpen,
    destroy() {
      for (const id of timers) clearTimeout(id);
      timers.clear();
      finishIntro();
      for (const stop of stops) stop();
      stops.length = 0;
      started = false;
    },
  };
}
