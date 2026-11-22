/**
 * Comprehension gate — when a track crosses its listening threshold, the
 * matching M.I.L.O. line becomes *ready* but is never spoken over the music.
 *
 * The shared listening tracker still marks the track understood the moment the
 * threshold is reached. This gate only decides when the reaction may be shown:
 *
 *   - a line is delivered once playback has stopped (a visitor pause or a track
 *     that ended on its own), never over the audio;
 *   - if the visitor pauses before the threshold, nothing is queued and nothing
 *     is shown;
 *   - delivery is delegated to the shared event queue, so a comprehension line
 *     and a pending Twister encounter can never open at the same time. A line
 *     that cannot be shown yet stays queued instead of forcing itself on top of
 *     another dialogue;
 *   - nothing here ever calls play, pause, seek or stop.
 *
 * The gate is shared like the player, so every collectible track follows the
 * same rule without duplicating the pause bookkeeping.
 */
import { player } from "./player.js";
import { eventQueue, EVENT_PRIORITY } from "./event-queue.js";

export function createComprehensionGate(options = {}) {
  const audio = options.player || player;
  const queue = options.queue || eventQueue;
  let local = 0;

  function readState() {
    try {
      return typeof audio.getState === "function" ? audio.getState() : null;
    } catch {
      return null;
    }
  }

  function readStatus() {
    return readState()?.status || "idle";
  }

  function isPlaying() {
    return readStatus() === "playing";
  }

  /**
   * Register `callback` for the next moment the queue can present it.
   *
   * The callback is the presentation itself: returning false means "could not
   * speak yet" and keeps the event queued for a later attempt. Everything is
   * serialized by the shared queue, so two pause-gated reactions can never open
   * together.
   *
   * @param {() => boolean|void} callback
   * @param {{id?: string, priority?: number, ready?: () => boolean}} [settings]
   *   `id` deduplicates repeated registrations of the same narrative line;
   *   `ready` re-checks eligibility right before the event starts.
   * @returns {boolean} whether a new entry was registered
   */
  function whenPaused(callback, settings = {}) {
    if (typeof callback !== "function") return false;
    const id = settings.id || `comprehension:${++local}`;
    return queue.enqueue({
      id,
      priority: Number.isFinite(settings.priority)
        ? settings.priority
        : EVENT_PRIORITY.TRACK_REFLECTION,
      ready: settings.ready,
      start: () => {
        let shown = false;
        try {
          shown = callback() !== false;
        } catch (error) {
          console.warn("[comprehension] reaction failed", error);
          shown = false;
        }
        return shown;
      },
    });
  }

  return {
    // The queue owns the subscription; kept so callers can no-op safely.
    start: () => () => {},
    whenPaused,
    isPlaying,
    isQueued: () => queue.size() > 0,
    destroy: () => {},
  };
}

/** The shared gate. Delivery is serialized by the shared event queue. */
export const comprehension = createComprehensionGate();
