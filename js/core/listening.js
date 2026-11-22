/**
 * Listening comprehension — credits only seconds that were genuinely played.
 *
 * The tracker observes the shared player, never the MUSIC PLAYER window, so
 * closing the program does not stop listening progress. Rules:
 * - a paused element emits no advancing positions, so paused time is never
 *   credited;
 * - a seek is a jump: the player reports it with `seekCount`, and the tracker
 *   resets its baseline instead of crediting the skipped stretch (small
 *   keyboard seeks included);
 * - only forward steps of at most `maxNaturalStep` seconds count, which filters
 *   stalls, tab-sleep gaps and jumps;
 * - the progression store merges ranges, so replaying a section never raises
 *   unique coverage twice;
 * - each track chooses its own threshold through `understandAt` (default 70%).
 *
 * Coverage and the understood flag both live in the shared store, so a refresh
 * or a disabled tab keeps everything already earned.
 */
import { TRACK_BY_ID } from "../data/music.js";
import { progression } from "./progression.js";
import { player } from "./player.js";

export const LISTENING = Object.freeze({
  /* Share of a track's total duration that must be genuinely heard. */
  defaultThreshold: 0.7,
  /* Longer than a normal timeupdate gap: anything bigger is a jump. */
  maxNaturalStep: 1.5,
  /* Ignore sub-frame noise so tiny repeats do not create ranges. */
  minStep: 0.05,
});

export function createListeningTracker(options = {}) {
  const store = options.store || progression;
  const audio = options.player || player;
  const config = { ...LISTENING, ...(options.config || {}) };

  let currentId = null;
  let lastPosition = null;
  let lastSeekCount = null;
  let stop = null;

  function thresholdFor(track) {
    const value = Number(track && track.understandAt);
    return Number.isFinite(value) && value > 0 && value <= 1
      ? value
      : config.defaultThreshold;
  }

  /** Has this track already crossed its own listening requirement? */
  function evaluate(state) {
    const track = TRACK_BY_ID.get(state.trackId);
    if (!track || !(state.duration > 0)) return false;
    if (store.hasUnderstood(track.id)) return false;
    const heard = store.getListeningSeconds(track.id);
    if (heard + 0.05 < thresholdFor(track) * state.duration) return false;
    return store.unlockUnderstanding(track.id);
  }

  /**
   * Coverage of a track at a known duration, clamped to 0..1. Used by the
   * player UI for the per-slot percentage.
   */
  function coverage(trackId, duration) {
    if (!(duration > 0)) return 0;
    return Math.min(1, store.getListeningSeconds(trackId) / duration);
  }

  function onState(state) {
    if (!state || !state.trackId) {
      currentId = null;
      lastPosition = null;
      lastSeekCount = null;
      return;
    }

    if (state.trackId !== currentId) {
      currentId = state.trackId;
      lastPosition = null;
      lastSeekCount = null;
    }

    // A seek (or a stop that zeroed the position) is never listening time.
    if (Number.isFinite(state.seekCount) && state.seekCount !== lastSeekCount) {
      lastSeekCount = state.seekCount;
      lastPosition = state.currentTime;
      return;
    }

    if (state.status !== "playing") {
      lastPosition = state.currentTime;
      // A saved position may already satisfy the threshold (e.g. after an
      // upgrade); honour it the next time the track is selected.
      evaluate(state);
      return;
    }

    const previous = lastPosition;
    lastPosition = state.currentTime;
    if (previous === null) return;

    const delta = state.currentTime - previous;
    if (!(delta > config.minStep) || delta > config.maxNaturalStep) return;

    const track = TRACK_BY_ID.get(state.trackId);
    if (!track || store.hasUnderstood(track.id)) return;

    const end = Math.min(
      state.currentTime,
      state.duration > 0 ? state.duration : state.currentTime,
    );
    if (end > previous) store.addListening(track.id, previous, end);
    evaluate(state);
  }

  function start() {
    if (stop) return stop;
    stop = audio.subscribe(onState);
    onState(audio.getState());
    return () => {
      stop?.();
      stop = null;
    };
  }

  return {
    start,
    coverage,
    thresholdFor,
    // Diagnostic hook for the listening rules; no DOM involved.
    handleState: onState,
    isRunning: () => Boolean(stop),
  };
}

/** The shared tracker, started by boot. */
export const listening = createListeningTracker();
