/**
 * SIGNALS — discovery state.
 *
 * The SIGNALS view reports its first real mount here. This controller owns the
 * one-time sequence and writes only stable IDs to the shared progression:
 *
 *   signals-opened            the visitor opened the real SIGNALS window
 *   signals-reaction          M.I.L.O. has said his first reaction
 *   signals-listening-ready   at least 70% unique coverage was reached
 *   signals-listening-reaction M.I.L.O. has said the post-listening line
 *
 * Only after the first reaction is shown does SIGNALS.wav join the desktop
 * through the shared file layer. If the window is closed or the page reloads
 * between those steps, the next tick resumes exactly where it stopped. The
 * file is restored until the shared MUSIC PLAYER collection records `signals`;
 * a collected track is never spawned again.
 *
 * The listening reaction is intentionally pause-gated. The shared listening
 * tracker marks the track understood at 70% unique coverage; this controller
 * then records the ready event but stays silent. Only a visitor-requested pause
 * of the SIGNALS track may show the line. Reaching the threshold, seeking,
 * resuming, or the passage of time never triggers it, and this module never
 * calls play or pause on the shared player.
 *
 * No audio element, player, file layer or shortcut is created here. Those are
 * all the existing shared services.
 */

export const SIGNALS_STORY = Object.freeze({
  openedEvent: "signals-opened",
  reactionEvent: "signals-reaction",
  trackId: "signals",
  fileId: "signals-wav",
  fileNameKey: "signals.file.name",
  reactionKey: "mascot.signals.opened",
  reactionHoldMs: 26_000,
  listeningReadyEvent: "signals-listening-ready",
  listeningReactionEvent: "signals-listening-reaction",
  listeningReactionKey: "mascot.signals.trapped",
  listeningReactionHoldMs: 28_000,
  retryMs: 1_800,
  reactionDelayMs: 1_350,
});

export function createSignalsStory(options = {}) {
  const mascot = options.mascot || null;
  const store = options.store || null;
  const files = options.files || null;
  const audio = options.player || null;
  const isBlocked =
    typeof options.isBlocked === "function" ? options.isBlocked : () => false;
  const config = { ...SIGNALS_STORY, ...(options.config || {}) };

  let ticker = null;
  let started = false;
  let destroyed = false;
  let openedAt = null;
  let stopPlayer = null;
  let stopStore = null;
  let lastPauseCount = 0;

  function read(method, ...args) {
    if (!store || typeof store[method] !== "function") return false;
    try {
      return store[method](...args);
    } catch (error) {
      console.warn(`[signals] ${method} failed`, error);
      return false;
    }
  }

  function hasEvent(id) {
    return read("hasEvent", id);
  }

  function completeEvent(id) {
    return read("completeEvent", id);
  }

  function canSpeak() {
    if (destroyed || !mascot || typeof mascot.showLine !== "function") return false;
    if (isBlocked()) return false;
    if (typeof mascot.isSpeaking === "function" && mascot.isSpeaking()) return false;
    return true;
  }

  function ensureFile() {
    if (destroyed) return false;
    if (!hasEvent(config.reactionEvent)) return false;
    if (read("hasTrack", config.trackId)) return false;
    if (!files || typeof files.addFile !== "function") return false;
    if (typeof files.hasFile === "function" && files.hasFile(config.fileId)) {
      return false;
    }
    return Boolean(
      files.addFile({
        id: config.fileId,
        trackId: config.trackId,
        nameKey: config.fileNameKey,
      }),
    );
  }

  function maybeReact() {
    if (destroyed || !hasEvent(config.openedEvent)) return false;
    if (hasEvent(config.reactionEvent)) return false;
    if (
      openedAt !== null &&
      Date.now() - openedAt < config.reactionDelayMs
    ) {
      return false;
    }
    if (!canSpeak()) return false;

    const shown = mascot.showLine({
      key: config.reactionKey,
      tone: "event",
      holdMs: config.reactionHoldMs,
      uneasy: true,
    });
    if (!shown) return false;

    completeEvent(config.reactionEvent);
    ensureFile();
    return true;
  }

  /** The threshold is persistent, but nothing is shown until a pause. */
  function markListeningReady() {
    if (destroyed) return false;
    if (!read("hasUnderstood", config.trackId)) return false;
    if (hasEvent(config.listeningReadyEvent)) return false;
    return completeEvent(config.listeningReadyEvent);
  }

  function maybeListeningReact() {
    if (destroyed) return false;
    if (!read("hasUnderstood", config.trackId)) return false;
    if (!hasEvent(config.listeningReadyEvent)) return false;
    if (hasEvent(config.listeningReactionEvent)) return false;
    if (!canSpeak()) return false;

    const shown = mascot.showLine({
      key: config.listeningReactionKey,
      tone: "event",
      holdMs: config.listeningReactionHoldMs,
      uneasy: true,
    });
    if (!shown) return false;

    completeEvent(config.listeningReactionEvent);
    return true;
  }

  /**
   * A visitor-requested pause is the only path into the listening reaction.
   * `pauseCount` is bumped by the shared player's explicit pause action, not
   * by track changes, stop, natural end or this controller. A line that could
   * not be shown because M.I.L.O. was busy stays ready for the next pause.
   */
  function onPlayerState(state) {
    if (destroyed || !state) return;
    const count = Number(state.pauseCount);
    if (!Number.isFinite(count)) return;
    const manualPause = count > lastPauseCount;
    lastPauseCount = count;
    if (!manualPause) return;
    if (state.trackId !== config.trackId || state.status !== "paused") return;
    markListeningReady();
    maybeListeningReact();
  }

  function tick() {
    if (hasEvent(config.reactionEvent)) ensureFile();
    markListeningReady();
    maybeReact();
  }

  function opened() {
    if (destroyed) return false;
    const isNew = !hasEvent(config.openedEvent) && completeEvent(config.openedEvent);
    if (isNew) openedAt = Date.now();
    tick();
    return isNew;
  }

  function start() {
    if (started || destroyed) return;
    started = true;
    tick();
    ticker = setInterval(tick, config.retryMs);
    if (ticker && typeof ticker.unref === "function") ticker.unref();

    if (audio && typeof audio.subscribe === "function") {
      const current = typeof audio.getState === "function" ? audio.getState() : null;
      lastPauseCount = Number(current?.pauseCount) || 0;
      stopPlayer = audio.subscribe(onPlayerState);
    }

    if (store && typeof store.subscribe === "function") {
      stopStore = store.subscribe((_snapshot, change) => {
        if (change?.type === "understood:add" && change.id === config.trackId) {
          markListeningReady();
        }
      });
    }
  }

  function destroy() {
    destroyed = true;
    if (ticker !== null) clearInterval(ticker);
    ticker = null;
    stopPlayer?.();
    stopStore?.();
    stopPlayer = null;
    stopStore = null;
    started = false;
    openedAt = null;
  }

  return {
    start,
    opened,
    tick,
    ensureFile,
    destroy,
    isOpened: () => hasEvent(config.openedEvent),
    hasReacted: () => hasEvent(config.reactionEvent),
    isListeningReady: () => hasEvent(config.listeningReadyEvent),
    hasReactedToListening: () => hasEvent(config.listeningReactionEvent),
  };
}
