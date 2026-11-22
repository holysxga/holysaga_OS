/**
 * Event queue — one coordinator for every deferred desktop event.
 *
 * Several systems have to wait: a comprehension reflection is ready but the
 * track is still playing, a Twister encounter was rolled during music, a
 * discovery line is owed behind another dialogue. Before this module each of
 * them watched the player on its own, so one pause released all of them at
 * once: M.I.L.O. started talking while a Twister window opened on top of him.
 *
 * Now every deferred event is registered here and started one at a time. The
 * queue owns the sequencing, never the presentation: each event keeps its own
 * component (M.I.L.O.'s bubble, the thought dialog, the corruption surface).
 *
 * Lifecycle of one event:
 *   PENDING   registered, waiting for music to stop and the desktop to be free
 *   READY     conditions are satisfied; it is the event about to start
 *   ACTIVE    presented to the visitor; nothing else may open
 *   COMPLETED the interaction is over and the desktop is quiet again
 *   REMOVED   taken out of the queue (dismissed, cancelled or obsolete)
 *
 * An event is not complete because its window was hidden or covered: it stays
 * ACTIVE until its own `isComplete()` (when supplied) reports true *and* the
 * injected `isBusy()` says the desktop is quiet again. That is what makes a
 * multi-part M.I.L.O. dialogue, a persistent tutorial, or an open Twister
 * window hold the queue until the visitor has actually finished with it.
 *
 * Ordering is deterministic: higher `priority` first, then registration order.
 * Track comprehension outranks a Twister encounter, exactly because the line is
 * about the track the visitor just listened to.
 *
 * The queue never calls play, pause, seek or stop. While music is playing it
 * simply keeps its entries pending.
 */

export const EVENT_STATE = Object.freeze({
  PENDING: "pending",
  READY: "ready",
  ACTIVE: "active",
  COMPLETED: "completed",
  REMOVED: "removed",
});

/**
 * Priority bands. Only the relative order matters; numbers inside a band keep
 * their registration order.
 */
export const EVENT_PRIORITY = Object.freeze({
  /* A reflection about the track the visitor was listening to. */
  TRACK_REFLECTION: 300,
  /* A creature that was rolled during playback. */
  TWISTER: 200,
  /* Contextual lines and any other event without a defined priority. */
  CONTEXT: 100,
});

/** How often a live event is checked for completion. */
const TICK_MS = 300;

function safeCheck(check, fallback, label) {
  if (typeof check !== "function") return fallback;
  try {
    return Boolean(check());
  } catch (error) {
    // Fail safe: pretending the desktop is busy is better than opening two
    // windows because a predicate threw (for example during boot wiring).
    console.warn(`[events] ${label} check failed`, error);
    return fallback;
  }
}

export function createEventQueue(options = {}) {
  const entries = new Map();
  /* Injected by boot: these are the only questions the queue asks about the
     desktop. The queue itself stays free of DOM, player and progression. */
  const services = {
    isMusicPlaying:
      typeof options.isMusicPlaying === "function" ? options.isMusicPlaying : () => false,
    isBusy: typeof options.isBusy === "function" ? options.isBusy : () => false,
    player: options.player || null,
  };

  let active = null;
  let order = 0;
  let enabled = false;
  let pumping = false;
  let timer = null;
  let stopPlayer = null;

  /**
   * Point the queue at the live desktop. Called once by boot, after the
   * schedulers exist; a missing or throwing check is treated as "busy".
   */
  function configure(next = {}) {
    if (typeof next.isMusicPlaying === "function") {
      services.isMusicPlaying = next.isMusicPlaying;
    }
    if (typeof next.isBusy === "function") services.isBusy = next.isBusy;
    if (next.player && typeof next.player.subscribe === "function") {
      services.player = next.player;
      stopPlayer?.();
      stopPlayer = next.player.subscribe(() => {
        // Playback changed: a pause may release the front of the queue.
        if (!enabled) return;
        pump();
      }) || null;
    }
    return api;
  }

  function playing() {
    return safeCheck(services.isMusicPlaying, true, "music");
  }

  function busy() {
    return safeCheck(services.isBusy, true, "desktop");
  }

  function isLive(entry) {
    return (
      entry &&
      entry.state !== EVENT_STATE.COMPLETED &&
      entry.state !== EVENT_STATE.REMOVED
    );
  }

  function remove(entry, state) {
    if (!entry) return;
    entry.state = state;
    entries.delete(entry.id);
    if (active === entry) active = null;
  }

  /** Pick the next event: priority first, then the order it was registered. */
  function candidates() {
    const ready = [];
    for (const entry of entries.values()) {
      if (entry.state !== EVENT_STATE.PENDING) continue;
      if (entry.ready && !safeCheck(entry.ready, false, `"${entry.id}" ready`)) {
        continue;
      }
      ready.push(entry);
    }
    ready.sort((a, b) => b.priority - a.priority || a.order - b.order);
    return ready;
  }

  /** Start the best pending event, if anything may run right now. */
  function pump() {
    if (!enabled || pumping || active) return false;
    if (playing() || busy()) return false;

    const [entry] = candidates();
    if (!entry) return false;

    pumping = true;
    entry.state = EVENT_STATE.READY;
    active = entry;
    let started = false;
    try {
      started = entry.start({
        id: entry.id,
        // Both helpers are bound to this exact entry, so a late callback can
        // never complete or cancel a different event.
        done: () => complete(entry.id),
        cancel: () => cancel(entry.id),
      }) !== false;
    } catch (error) {
      console.warn(`[events] "${entry.id}" failed to start`, error);
      started = false;
    } finally {
      pumping = false;
    }

    if (!started) {
      // Busy after all (a scheduler hold, a suspended dialog): keep it queued
      // and try again on the next tick. Nothing is discarded.
      active = null;
      entry.state = EVENT_STATE.PENDING;
      return false;
    }

    entry.state = EVENT_STATE.ACTIVE;
    return true;
  }

  /** Is the live event over, including the visitor's last interaction? */
  function settled(entry) {
    if (entry.isComplete && !safeCheck(entry.isComplete, false, `"${entry.id}" complete`)) {
      return false;
    }
    return !busy();
  }

  /**
   * One beat of the lifecycle. A live event is observed, never assumed done
   * because its window closed; then the next eligible event is started.
   */
  function tick() {
    if (!enabled) return;
    if (active) {
      if (!isLive(active) || !settled(active)) return;
      remove(active, EVENT_STATE.COMPLETED);
    }
    pump();
  }

  /**
   * Register an event. Registering the same id twice never duplicates it: the
   * first registration wins, so repeated playback updates cannot stack events.
   *
   * @param {object} spec
   * @param {string} spec.id stable, unique per event
   * @param {number} [spec.priority] EVENT_PRIORITY band, defaults to CONTEXT
   * @param {() => boolean|void} spec.start presentation; return false to keep
   *   the event pending for the next attempt
   * @param {() => boolean} [spec.ready] eligibility checked before starting
   * @param {() => boolean} [spec.isComplete] interaction finished?
   * @returns {boolean} whether the event was added
   */
  function enqueue(spec) {
    if (!spec || typeof spec.id !== "string" || !spec.id) return false;
    if (typeof spec.start !== "function") return false;
    if (entries.has(spec.id)) return false;

    entries.set(spec.id, {
      id: spec.id,
      priority: Number.isFinite(spec.priority) ? spec.priority : EVENT_PRIORITY.CONTEXT,
      order: ++order,
      state: EVENT_STATE.PENDING,
      start: spec.start,
      ready: typeof spec.ready === "function" ? spec.ready : null,
      isComplete: typeof spec.isComplete === "function" ? spec.isComplete : null,
    });
    pump();
    return true;
  }

  /** The event reports that its interaction is over. */
  function complete(id) {
    const entry = entries.get(id);
    if (!entry || !isLive(entry)) return false;
    const wasActive = active === entry;
    remove(entry, EVENT_STATE.COMPLETED);
    if (wasActive) pump();
    return true;
  }

  /** Drop an event that will never be shown (not a normal completion). */
  function cancel(id) {
    const entry = entries.get(id);
    if (!entry) return false;
    remove(entry, EVENT_STATE.REMOVED);
    return true;
  }

  function has(id) {
    return entries.has(id);
  }

  function getState(id) {
    return entries.get(id)?.state || null;
  }

  function list() {
    return [...entries.values()]
      .sort((a, b) => b.priority - a.priority || a.order - b.order)
      .map(({ id, state, priority }) => ({ id, state, priority }));
  }

  function start() {
    if (enabled) return stop;
    enabled = true;
    timer = setInterval(tick, TICK_MS);
    if (timer && typeof timer.unref === "function") timer.unref();
    // An event registered before boot finished may already be eligible.
    pump();
    return stop;
  }

  function stop() {
    enabled = false;
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function destroy() {
    stop();
    stopPlayer?.();
    stopPlayer = null;
    entries.clear();
    active = null;
  }

  const api = {
    configure,
    enqueue,
    start,
    stop,
    destroy,
    pump,
    tick,
    complete,
    cancel,
    has,
    getState,
    list,
    size: () => entries.size,
    getActive: () => (active ? { id: active.id, state: active.state } : null),
    // Kept for parity with the old gate: an explicit, harmless hook.
    notify: pump,
  };

  return api;
}

/** The single queue every deferred desktop event is registered with. */
export const eventQueue = createEventQueue();
