/**
 * TRITON — the dream connection, the audio discovery, M.I.L.O.'s first major
 * glitch, and the appearance of SIGNALS.
 *
 * This controller owns only the new narrative chain. Every visible part reuses
 * an established system:
 *   - DREAM LOG writes the stable `dreams` collection;
 *   - the connection line uses M.I.L.O.'s existing event bubble;
 *   - TRITON is a normal desktop file, dropped into the normal MUSIC PLAYER
 *     slot, played by the shared player and counted by the shared listening
 *     tracker;
 *   - SIGNALS is a normal desktop shortcut added through the existing shortcut
 *     component, with no application mounted behind it.
 *
 * Stable events written by this controller:
 *   dream-connection     both THE EMPTY HOTEL and THE FLOODING FIELDS were read
 *   triton-glitch        the post-70% glitch sequence finished
 *   signals-comment      M.I.L.O. has commented on the shortcut
 *
 * The glitch deliberately does not touch desktop corruption, Twister counters,
 * files or progress. It is a temporary mascot/DOM state, removed in `finally`.
 */
import { el } from "./dom.js";
import { comprehension } from "./comprehension.js";
import { EVENT_PRIORITY } from "./event-queue.js";

export const TRITON_STORY = Object.freeze({
  connectionEvent: "dream-connection",
  glitchEvent: "triton-glitch",
  signalsEvent: "signals-comment",
  hotelId: "dream-003",
  fieldsId: "dream-006",
  trackId: "triton",
  fileId: "triton-wav",
  fileNameKey: "triton.file.name",
  connectionKey: "mascot.dream.connection",
  glitchKeys: Object.freeze([
    "mascot.triton.glitch.1",
    "mascot.triton.glitch.2",
    "mascot.triton.glitch.3",
    "mascot.triton.glitch.4",
  ]),
  resolutionKey: "mascot.triton.after",
  signalsKey: "mascot.signals.appeared",
  signals: Object.freeze({
    id: "signals",
    titleKey: "app.signals.title",
    icon: "assets/icons/signals.svg",
  }),
  retryMs: 1_800,
});

const GLITCH_HOLDS = [4_400, 4_900, 5_100, 5_700];
const GLITCH_PAUSES = [700, 900, 1200, 700];

export function createTritonStory(options = {}) {
  const mascot = options.mascot || null;
  const store = options.store || null;
  const files = options.files || null;
  const shortcuts = options.shortcuts || null;
  const mascotRoot =
    options.mascotRoot ||
    (typeof document === "undefined"
      ? null
      : document.getElementById("mascot-root"));
  const desktop =
    options.desktop ||
    (typeof document === "undefined" ? null : document.getElementById("desktop"));
  const isBlocked =
    typeof options.isBlocked === "function" ? options.isBlocked : () => false;
  const quiet = typeof options.quiet === "function" ? options.quiet : () => {};
  /* The post-understanding glitch waits for a visitor-requested pause. */
  const gate = options.gate || comprehension;
  const config = { ...TRITON_STORY, ...(options.config || {}) };

  const timers = new Set();
  let ticker = null;
  let started = false;
  let destroyed = false;
  let glitching = false;
  /* Understanding makes the glitch ready; only a manual pause arms it. */
  let armed = false;
  let arming = false;
  let ghosts = [];
  let overlay = null;

  function read(method, ...args) {
    if (!store || typeof store[method] !== "function") return false;
    try {
      return store[method](...args);
    } catch (error) {
      console.warn(`[triton] ${method} failed`, error);
      return false;
    }
  }

  function hasEvent(id) {
    return read("hasEvent", id);
  }

  function completeEvent(id) {
    return read("completeEvent", id);
  }

  function wait(ms) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        resolve(!destroyed);
      }, Math.max(0, ms));
      timers.add(timer);
    });
  }

  function canSpeak() {
    if (destroyed || !mascot || typeof mascot.showLine !== "function") return false;
    if (isBlocked()) return false;
    if (typeof mascot.isSpeaking === "function" && mascot.isSpeaking()) return false;
    return true;
  }

  function say(key, holdMs, extra = {}) {
    if (!canSpeak()) return false;
    return mascot.showLine({
      key,
      tone: "event",
      holdMs,
      ...extra,
    });
  }

  /* ---------------------------------------------------------- TRITON file */

  function ensureTritonFile() {
    if (!hasEvent(config.connectionEvent)) return false;
    if (read("hasTrack", config.trackId)) return false;
    if (!files || typeof files.addFile !== "function") return false;
    if (typeof files.hasFile === "function" && files.hasFile(config.fileId)) {
      return false;
    }
    files.addFile({
      id: config.fileId,
      trackId: config.trackId,
      nameKey: config.fileNameKey,
    });
    return true;
  }

  /* --------------------------------------------------------- connection */

  function maybeConnection() {
    if (destroyed || hasEvent(config.connectionEvent)) return false;
    if (!read("hasDream", config.hotelId) || !read("hasDream", config.fieldsId)) {
      return false;
    }
    // Contextual, so it waits behind a track reflection and never opens over
    // another window. The stable id keeps repeated ticks from stacking it.
    return gate.whenPaused(
      () => {
        if (hasEvent(config.connectionEvent)) return true;
        if (!canSpeak()) return false;
        const opened = say(config.connectionKey, 28_000);
        if (!opened) return false;
        completeEvent(config.connectionEvent);
        ensureTritonFile();
        return true;
      },
      {
        id: "triton:connection",
        priority: EVENT_PRIORITY.CONTEXT,
        ready: () => !hasEvent(config.connectionEvent),
      },
    );
  }

  /* ------------------------------------------------------------- glitch */

  function makeOverlay() {
    if (!desktop || overlay) return;
    overlay = el("div", {
      class: "triton-glitch__screen",
      "aria-hidden": "true",
    });
    desktop.append(overlay);
  }

  function beginGlitchVisuals() {
    if (!mascotRoot) return;
    const dock = mascotRoot.querySelector(".mascot");
    const figure = mascotRoot.querySelector(".mascot__figure");
    const svg = figure?.querySelector("svg");
    mascotRoot.classList.add("is-triton-glitch");
    dock?.classList.add("is-glitching");
    makeOverlay();
    if (!figure || !svg) return;

    for (const side of ["a", "b"]) {
      const ghost = el("span", {
        class: `mascot__glitch-ghost mascot__glitch-ghost--${side}`,
        "aria-hidden": "true",
      });
      ghost.innerHTML = svg.outerHTML;
      figure.append(ghost);
      ghosts.push(ghost);
    }
  }

  function endGlitchVisuals() {
    if (mascotRoot) {
      mascotRoot.classList.remove("is-triton-glitch");
      mascotRoot.querySelector(".mascot")?.classList.remove("is-glitching");
    }
    for (const ghost of ghosts) ghost.remove();
    ghosts = [];
    overlay?.remove();
    overlay = null;
  }

  function applyAftermath() {
    if (mascotRoot) mascotRoot.classList.add("is-triton-scarred");
  }

  async function runGlitch() {
    if (glitching || destroyed) return;
    glitching = true;
    quiet(true);
    try {
      beginGlitchVisuals();
      await wait(350);
      for (let index = 0; index < config.glitchKeys.length; index += 1) {
        if (destroyed) return;
        mascot.showLine({
          key: config.glitchKeys[index],
          tone: "event",
          holdMs: GLITCH_HOLDS[index],
          uneasy: true,
        });
        await wait(GLITCH_HOLDS[index] + GLITCH_PAUSES[index]);
      }

      endGlitchVisuals();
      await wait(520);
      if (destroyed) return;

      completeEvent(config.glitchEvent);
      applyAftermath();
      ensureSignals(false);
      say(config.resolutionKey, 15_000, { uneasy: true });
      await wait(4_800);
      if (destroyed) return;

      showSignalsComment();
      await wait(800);
    } catch (error) {
      console.warn("[triton] glitch sequence failed", error);
    } finally {
      endGlitchVisuals();
      quiet(false);
      glitching = false;
    }
  }

  /**
   * Register the one-time glitch after the track is understood. It only runs
   * when no music is playing: the shared gate delivers it on the pause, and the
   * playback check keeps a resumed track safe until it is stopped again.
   */
  function armGlitch() {
    if (armed || arming || glitching || hasEvent(config.glitchEvent)) return;
    if (!read("hasTrack", config.trackId)) return;
    if (!read("hasUnderstood", config.trackId)) return;
    arming = true;
    gate.whenPaused(
      () => {
        arming = false;
        armed = true;
        if (destroyed || glitching || hasEvent(config.glitchEvent)) return true;
        // The shared queue starts this only when the desktop is free; if
        // M.I.L.O. still cannot speak, the event stays queued.
        if (gate.isPlaying() || !canSpeak()) return false;
        runGlitch();
        return true;
      },
      {
        id: "triton:glitch",
        ready: () =>
          read("hasTrack", config.trackId) &&
          read("hasUnderstood", config.trackId) &&
          !hasEvent(config.glitchEvent),
      },
    );
  }

  /* ------------------------------------------------------------ SIGNALS */

  function ensureSignals(fresh) {
    if (!hasEvent(config.glitchEvent) || !shortcuts) return false;
    if (typeof shortcuts.hasShortcut === "function" &&
        shortcuts.hasShortcut(config.signals.id)) {
      return false;
    }
    return Boolean(shortcuts.addShortcut?.(config.signals, { fresh }));
  }

  function showSignalsComment() {
    if (destroyed || hasEvent(config.signalsEvent)) return false;
    if (!hasEvent(config.glitchEvent)) return false;
    ensureSignals(false);
    return gate.whenPaused(
      () => {
        if (hasEvent(config.signalsEvent)) return true;
        if (!canSpeak()) return false;
        const opened = say(config.signalsKey, 22_000, { uneasy: true });
        if (opened) completeEvent(config.signalsEvent);
        return opened;
      },
      {
        id: "triton:signals-comment",
        priority: EVENT_PRIORITY.CONTEXT,
        ready: () => hasEvent(config.glitchEvent) && !hasEvent(config.signalsEvent),
      },
    );
  }

  /* --------------------------------------------------------------- boot */

  function tick() {
    ensureTritonFile();
    if (hasEvent(config.glitchEvent)) {
      ensureSignals(false);
      applyAftermath();
      showSignalsComment();
    }
    maybeConnection();
    armGlitch();
  }

  function start() {
    if (started || destroyed) return;
    started = true;
    tick();
    ticker = setInterval(tick, config.retryMs);
    if (ticker && typeof ticker.unref === "function") ticker.unref();
  }

  function destroy() {
    destroyed = true;
    if (ticker !== null) clearInterval(ticker);
    ticker = null;
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    endGlitchVisuals();
    quiet(false);
    started = false;
    glitching = false;
  }

  return {
    start,
    tick,
    ensureTritonFile,
    ensureSignals,
    showSignalsComment,
    destroy,
    isGlitching: () => glitching,
  };
}
