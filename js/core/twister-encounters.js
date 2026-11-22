/**
 * Twister encounters — decides when a Twister rides on an intrusive thought.
 *
 * Policy, rolled exactly once per *new* message (never on a timer):
 * - the visitor's first intrusive thought always brings one;
 * - every later message has an independent 30% chance;
 * - when the roll fails the message is shown exactly as before, with no
 *   corruption and no creature.
 *
 * Music wins over every encounter. While a MUSIC PLAYER track is actually
 * playing, nothing Twister-related happens at all: the message still appears,
 * but without the creature, no line is spoken and the lifetime counter is not
 * touched. An eligible encounter is registered with the shared event queue,
 * and its window opens only once playback has stopped and every event ahead of
 * it has been completed — music is never paused to trigger it, and the held
 * encounter is never discarded. At most one is held at a time, and a refresh
 * cannot lose it.
 *
 * Persistence uses the shared progression store and two stable IDs:
 * - `twister-first-encounter` in `events` — the guarantee has been spent;
 * - `twister-intro` in `tutorials` — the explanation has been shown.
 * Both are written the moment the creature appears (never on close), so a
 * refresh in the middle of the scene can neither replay nor skip the intro.
 * `progression.recordTwister()` keeps the lifetime count.
 *
 * Presentation reuses what already exists: the Twister SVG and placement
 * helper from js/ui/twister.js, the corruption surface from js/ui/corruption.js
 * and M.I.L.O.'s own bubble. Nothing here draws a new creature, a new glitch
 * style or a new dialogue widget.
 *
 * This module still owns only the creature and M.I.L.O.'s reaction. The two
 * optional hooks, `onOpen` and `onClose`, let boot run the desktop-side effects
 * (the corruption countdown and the first-discovery scene) without either
 * module importing the other: `onClose` fires when the message window closes,
 * before the encounter's DOM is gone, and never on a mere page unload.
 */
import { progression } from "./progression.js";
import { player } from "./player.js";
import { eventQueue, EVENT_PRIORITY } from "./event-queue.js";
import { readPref, writePref } from "./storage.js";
import { createTwister, placeTwister } from "../ui/twister.js";
import { applyCorruption } from "../ui/corruption.js";

export const TWISTER_ENCOUNTER = Object.freeze({
  /* Independent chance for every message after the first encounter. */
  chance: 0.3,
  eventId: "twister-first-encounter",
  tutorialId: "twister-intro",
  /* A short beat so the creature is noticed before M.I.L.O. starts. */
  introDelayMs: 640,
  /* How long a later one-line reaction stays in the bubble. */
  remindHoldMs: 9_000,
  /* The first encounter: what Twisters are, then the warning. */
  introKeys: Object.freeze([
    "mascot.twister.intro.1",
    "mascot.twister.intro.2",
  ]),
  /* Later encounters stay brief, varied and never explain the mechanic. */
  remindKeys: Object.freeze([
    "mascot.twister.again.1",
    "mascot.twister.again.2",
    "mascot.twister.again.3",
  ]),
  /* Stable queue id: one held encounter at a time, and repeated playback
     updates register it only once. */
  queueId: "twister-encounter",
  /* Survives a refresh, so a held encounter can never be lost. */
  pendingPrefKey: "twister-pending",
});

/**
 * Returned by `decide()` when the encounter is real but must not open yet: the
 * thought scheduler opens nothing, keeps its ordinary cadence, and the deferred
 * encounter announces itself through M.I.L.O. instead.
 */
export const TWISTER_DEFERRED = Object.freeze({ deferred: true });

export function createTwisterEncounters(options = {}) {
  const mascot = options.mascot || null;
  const store = options.store || progression;
  const random = options.random || Math.random;
  const isMusicPlaying =
    typeof options.isMusicPlaying === "function"
      ? options.isMusicPlaying
      : () => {
          try {
            return player.getState().status === "playing";
          } catch {
            return false;
          }
        };
  const doc =
    options.document || (typeof document === "undefined" ? null : document);
  const config = { ...TWISTER_ENCOUNTER, ...(options.config || {}) };
  const onOpen = typeof options.onOpen === "function" ? options.onOpen : null;
  const onClose = typeof options.onClose === "function" ? options.onClose : null;

  const openEncounter =
    typeof options.openEncounter === "function" ? options.openEncounter : null;

  let lastReminder = null;
  let introTimer = null;
  let introActive = false;
  let introStep = 0;
  let live = null;
  /* The held encounter's first-ness, or null when nothing is owed. One at a
     time: a second roll while this is held is ignored. */
  let pendingFirst = null;
  const queue = options.queue || eventQueue;

  const isLiberating = () =>
    typeof document !== "undefined" &&
    Boolean(document.body?.classList.contains("is-liberating"));

  function reads(method, id) {
    try {
      return typeof store[method] === "function" ? Boolean(store[method](id)) : false;
    } catch {
      return false;
    }
  }

  function writes(method, id) {
    try {
      store[method]?.(id);
    } catch (error) {
      console.warn(`[twister] could not record ${method}`, error);
    }
  }

  /** Has this visitor already met a Twister? */
  function hasMet() {
    return (
      reads("hasEvent", config.eventId) ||
      reads("hasSeenTutorial", config.tutorialId)
    );
  }

  /* -------------------------------------------------------------- decision */

  /* ------------------------------------------------------ held encounter */

  /** Drop the held token; the encounter itself is counted by `present`. */
  function forgetPending() {
    pendingFirst = null;
    writePref(config.pendingPrefKey, null);
  }

  /**
   * The shared queue reached this event while playback is stopped. Only now may
   * the held encounter become a real window, through the normal presentation
   * path. Nothing is said beforehand, and this never calls play or pause.
   *
   * @returns {boolean} false keeps the event queued for a later attempt
   */
  function openHeld() {
    if (pendingFirst === null) return false;
    if (isMusicPlaying() || isLiberating()) return false;
    let opened = false;
    if (openEncounter) {
      try {
        opened = Boolean(openEncounter({ first: pendingFirst }));
      } catch (error) {
        console.warn("[twister] could not open the held encounter", error);
      }
    }
    // A busy desktop keeps the token: the queue retries, silently.
    if (!opened) return false;
    forgetPending();
    return true;
  }

  /**
   * A real encounter became eligible during music. It is kept entirely
   * silently: no window, no line, no indicator, no notification. Only the roll
   * is remembered, registered with the shared event queue so the window opens
   * after every higher-priority event has been completed.
   */
  function queuePending(first) {
    if (queue.has(config.queueId)) return;
    pendingFirst = first;
    writePref(config.pendingPrefKey, { first, at: Date.now() });
    queue.enqueue({
      id: config.queueId,
      // A comprehension line about the track outranks the creature.
      priority: EVENT_PRIORITY.TWISTER,
      ready: () => pendingFirst !== null,
      start: openHeld,
    });
  }

  /** Re-arm a held encounter after a refresh, without speaking about it. */
  function restorePending() {
    if (pendingFirst !== null || queue.has(config.queueId)) return;
    const saved = readPref(config.pendingPrefKey, null);
    if (!saved || typeof saved !== "object") return;
    queuePending(Boolean(saved.first));
  }

  /**
   * One roll for one new message. Returning null means "ordinary thought":
   * no creature, no corruption, unchanged appearance and behaviour.
   *
   * While any track is playing, an encounter that becomes eligible is held
   * silently and the message opens as an ordinary system thought. Nothing
   * about the Twisters — announcement, hint, warning or creature — appears
   * until playback stops, and the held encounter is never discarded.
   *
   * @param {{id?: string, generic?: boolean}} message
   * @returns {null | {id: string, first: boolean}}
   */
  function decide(message) {
    if (!message || message.generic) return null;
    const first = !hasMet();

    // Music owns the desktop. The message still appears, but with no creature
    // and no Twister commentary; the encounter waits inside this module.
    if (isMusicPlaying()) {
      if (!queue.has(config.queueId)) queuePending(first);
      return null;
    }
    // One held encounter at a time: a new roll would duplicate it.
    if (pendingFirst !== null || queue.has(config.queueId)) return null;

    if (!first && random() >= config.chance) return null;
    return { id: message.id, first };
  }

  /* ------------------------------------------------------------ M.I.L.O. */

  function stepIntro() {
    if (!introActive) return;
    const key = config.introKeys[introStep];
    const last = introStep === config.introKeys.length - 1;
    const opened = mascot?.showDialog?.({
      bodyKey: key,
      // One explicit way forward: NEXT. The bubble cannot be closed, replaced
      // or hidden while this tutorial is open.
      actionKey: "mascot.tutorial.next",
      persistent: true,
      uneasy: true,
      onAction: () => {
        if (!introActive) return;
        if (last) {
          // Acknowledged the final step: only now does the desktop come back.
          mascot?.endTutorial?.({ hide: true });
          finishIntro();
          return;
        }
        introStep += 1;
        stepIntro();
      },
      onClose: () => finishIntro(),
    });
    if (!opened) finishIntro();
  }

  function startIntro() {
    introStep = 0;
    introActive = true;
    mascot?.setUneasy?.(true);
    stepIntro();
  }

  function finishIntro() {
    const wasActive = introActive;
    introActive = false;
    // Safety: an interrupted tutorial must never keep the desktop blocked.
    mascot?.endTutorial?.();
    mascot?.setUneasy?.(false);
    // Closing the bubble runs this through onClose too; hiding is only needed
    // when the encounter is torn down while M.I.L.O. is still talking.
    if (wasActive && mascot?.isSpeaking?.()) mascot.hide("twister");
  }

  /**
   * Later encounters: one short line, never the explanation again. A stale idle
   * line is replaced, exactly as the thought reactions already do; a tutorial
   * dialog owning the bubble makes `showLine` refuse, which is the wanted
   * behaviour — nothing may cut off the first-encounter explanation.
   */
  function startReminder() {
    if (!mascot || typeof mascot.showLine !== "function") return;
    const pool = config.remindKeys.filter((key) => key !== lastReminder);
    const usable = pool.length ? pool : config.remindKeys;
    const index = Math.min(usable.length - 1, Math.floor(random() * usable.length));
    lastReminder = usable[index];
    mascot.showLine({
      key: lastReminder,
      tone: "alert",
      holdMs: config.remindHoldMs,
    });
  }

  function scheduleReaction(first) {
    if (introTimer !== null) clearTimeout(introTimer);
    introTimer = setTimeout(() => {
      introTimer = null;
      if (first) startIntro();
      else startReminder();
    }, Math.max(0, config.introDelayMs));
    if (introTimer && typeof introTimer.unref === "function") introTimer.unref();
  }

  /* ----------------------------------------------------------- attachment */

  /**
   * Attach the creature to the message window: it stands flush against the
   * frame, clear of the text, and follows the dialog while it is dragged.
   */
  function attach(windowEl, state) {
    const layer = doc?.getElementById("twister-layer");
    // Fallback host: never drop the avatar just because the decorative layer is
    // missing from the document. The window layer is still above the wallpaper.
    const host = layer || windowEl?.parentElement || null;
    if (!host || !windowEl) return null;

    const node = createTwister({ state });
    host.append(node);

    const place = () => {
      if (!node.isConnected) return;
      const frame = windowEl.getBoundingClientRect();
      const area = host.getBoundingClientRect();
      const width = node.offsetWidth || 64;
      const height = node.offsetHeight || 102;
      // Only 8px of the coil overlaps the frame, so no message text is hidden.
      const right = frame.right - area.left - 8;
      const left = frame.left - area.left - width + 8;
      const fitsRight = right + width <= area.width - 6;
      const fitsLeft = left >= 6;
      // M.I.L.O. speaks from the lower-right corner, above every layer, so a
      // dialog on that side gets the creature on its left instead.
      const prefersLeft = frame.left + frame.width / 2 > area.width * 0.6;
      const onRight = prefersLeft ? !fitsLeft : fitsRight;
      placeTwister(node, {
        x: onRight ? right : left,
        y: frame.bottom - area.top - height * 0.82,
        container: { width: area.width, height: area.height },
        margin: 6,
      });
    };

    // Coalesce every move into one layout read per frame.
    let frame = null;
    const follow = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        place();
      });
    };

    let observer = null;
    if (typeof MutationObserver === "function") {
      observer = new MutationObserver(follow);
      observer.observe(windowEl, { attributes: true, attributeFilter: ["style"] });
    }
    window.addEventListener("resize", follow);
    place();
    follow();

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", follow);
      if (frame !== null) cancelAnimationFrame(frame);
      node.remove();
    };
  }

  /**
   * Last-resort avatar: if the desktop layer cannot host the creature, the
   * message mounts it inside its own body with the same component, so a real
   * Twister message is never left without its avatar.
   */
  function attachInside(root, state) {
    if (!root) return () => {};
    const node = createTwister({ state, className: "twister--inline" });
    root.append(node);
    return () => node.remove();
  }

  /* ---------------------------------------------------------- presentation */

  /**
   * Called by the intrusive-thoughts dialog while it mounts. Returns the
   * cleanup for everything added here; the dialog disposes it with the rest.
   */
  function present(encounter, context = {}) {
    if (!encounter || !context.root) return null;
    const { message, root } = context;
    const windowEl = context.window || null;

    // Whatever path brought this window here, a pending token is done: the
    // encounter is real now and is counted below, once.
    forgetPending();

    // Recorded on appearance, before a single word is spoken.
    if (encounter.first) {
      writes("completeEvent", config.eventId);
      writes("markTutorialShown", config.tutorialId);
    }
    if (typeof store.recordTwister === "function") {
      try {
        store.recordTwister();
      } catch (error) {
        console.warn("[twister] could not record the encounter", error);
      }
    }

    root.classList.add("thought--twister");
    windowEl?.classList.add("is-twistered");

    const corruption = applyCorruption(root, {
      intensity: "subtle",
      seed: `twister-${message?.id || "thought"}`,
    });

    const detach =
      attach(windowEl, encounter.first ? "first" : "thought") ||
      attachInside(root, encounter.first ? "first" : "thought");
    scheduleReaction(encounter.first);

    // The window is now on screen: the countdown may start.
    if (onOpen) {
      try {
        onOpen(encounter, { window: windowEl, root });
      } catch (error) {
        console.warn("[twister] open hook failed", error);
      }
    }

    live = { detach, corruption };

    return function cleanup() {
      if (introTimer !== null) {
        clearTimeout(introTimer);
        introTimer = null;
      }
      // Reported before teardown, so the scene can still read the encounter.
      if (onClose) {
        try {
          onClose(encounter, { window: windowEl, root });
        } catch (error) {
          console.warn("[twister] close hook failed", error);
        }
      }
      detach();
      corruption?.destroy();
      windowEl?.classList.remove("is-twistered");
      root.classList.remove("thought--twister");
      live = null;
      // An intro already on screen is left to the visitor to finish: closing
      // the message must not swallow the only explanation of the Twisters.
    };
  }

  function destroy() {
    if (introTimer !== null) {
      clearTimeout(introTimer);
      introTimer = null;
    }
    // The event did not end, so a held encounter stays owed: the persisted
    // token is what lets it resume after a reload.
    if (pendingFirst !== null) {
      writePref(config.pendingPrefKey, { first: pendingFirst, at: Date.now() });
    }
    introActive = false;
    mascot?.endTutorial?.();
    mascot?.setUneasy?.(false);
    live?.detach?.();
    live?.corruption?.destroy();
    live = null;
  }

  // A refresh in the middle of a held encounter resumes it. The shared event
  // queue watches playback and opens it the moment the music stops and every
  // higher-priority event has finished.
  restorePending();

  return {
    decide,
    present,
    destroy,
    hasMet,
    // Reads the live store, so a reload is reflected without a restart.
    getChance: () => config.chance,
  };
}
