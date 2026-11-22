/**
 * Sacred Digital — the first discovery scene and the cleaning tool.
 *
 * The order is fixed and follows the story:
 *   1. the first Twister appears and M.I.L.O. explains it (twister-encounters);
 *   2. the visitor closes the thought window (this module is told);
 *   3. a small patch of corruption appears immediately, as a scripted beat;
 *   4. M.I.L.O. flies to it and stops beside it, looking at it;
 *   5. he says what happens when you feed distorted thoughts, in bold where the
 *      Portuguese original puts the emphasis (persistent: only NEXT closes it);
 *   6. `Sacred Digital.wav` lands on the desktop;
 *   7. back at his corner he explains, in one short non-blocking line, that the
 *      file has to be dragged into its matching MUSIC PLAYER slot.
 *
 * Collecting that file in MUSIC PLAYER puts the track in the collection, but
 * that is not enough to decode it: the visitor has to hear a large part of the
 * track (js/core/listening.js) before the archive understands it. Only then
 * does M.I.L.O. reveal what it contained: a persistent NEXT-gated explanation,
 * the cleaning tool in the taskbar, a stepped highlight on its new button, and
 * a flight to that button so the visitor can see where it appeared. This
 * module reacts to the store, so the tool appears exactly once, survives
 * reloads and is never duplicated — and never before understanding.
 *
 * Stable IDs:
 *   event  sacred-digital-discovery   the scene has played (and the first
 *                                     Twister's deterministic corruption)
 *   event  sacred-digital-file        the file has been given
 *   track  sacred-digital             the track is collected
 *   track  sacred-digital (understood) the track has been heard and understood
 *   tutorial sacred-digital-understood M.I.L.O. has explained the discovery
 *   tool   sacred-digital-brush       the brush is unlocked
 *
 * The scene never replays: the discovery event is written before the first
 * patch exists, so closing the tab mid-scene cannot restart it.
 */
import { progression } from "./progression.js";
import { comprehension } from "./comprehension.js";
import { createTutorialMarker } from "../ui/tutorial-marker.js";

export const SACRED_DIGITAL = Object.freeze({
  trackId: "sacred-digital",
  discoveryEvent: "sacred-digital-discovery",
  fileEvent: "sacred-digital-file",
  toolId: "sacred-digital-brush",
  fileId: "sacred-digital-wav",
  dialogueKey: "mascot.sacred.discovery",
  actionKey: "mascot.tutorial.next",
  /* What to do with the file, once it lands. Non-blocking: the visitor has to
     be able to drag it. */
  instructionKey: "mascot.sacred.drag",
  instructionHoldMs: 26_000,
  /* Understanding: the tool is only revealed after this line. The explanation
     stays up until NEXT and points at the taskbar button he flies beside. */
  understoodKey: "mascot.sacred.understood",
  understoodTutorialId: "sacred-digital-understood",
  /* After the unlock, once the explanation has been acknowledged, M.I.L.O.
     mentions that the same brush also works on damaged DREAM LOG records. */
  dreamlogKey: "mascot.sacred.dreamlog",
  dreamlogTutorialId: "sacred-digital-dreamlog",
  dreamlogHoldMs: 26_000,
  dreamlogDelayMs: 1_600,
  /* After the first activation: an actual patch, a flight to it, a ring around
     it, and the instruction. Finished for good by the first successful clean. */
  cleanTutorialId: "sacred-digital-first-clean",
  cleanGuideKey: "mascot.sacred.firstClean",
  cleanGuideHoldMs: 26_000,
  cleanRetryMs: 1_400,
  understoodRevealMs: 420,
  instructionDelayMs: 520,
  /* Small beats: the patch appears, M.I.L.O. notices, then he speaks. */
  noticeDelayMs: 180,
  flightSettleMs: 560,
  fileDelayMs: 640,
  returnDelayMs: 1_100,
});

export function createSacredDigital(options = {}) {
  const mascot = options.mascot || null;
  const store = options.store || progression;
  const corruption = options.corruption || null;
  const files = options.files || null;
  const brush = options.brush || null;
  const doc =
    options.document || (typeof document === "undefined" ? null : document);
  const config = { ...SACRED_DIGITAL, ...(options.config || {}) };
  /* Ask the other schedulers for quiet without importing them. */
  const quiet = typeof options.quiet === "function" ? options.quiet : () => {};
  /* Comprehension lines wait for a visitor-requested pause (shared rule). */
  const gate = options.gate || comprehension;

  let started = false;
  let active = false;
  let finished = false;
  /* The understood explanation owns the desktop until NEXT is clicked. */
  let understoodPending = false;
  let cleanGuideActive = false;
  let cleanGuideAttempts = 0;
  let marker = null;
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

  function wait(ms) {
    return new Promise((resolve) => after(ms, resolve));
  }

  function clearTimers() {
    for (const id of timers) clearTimeout(id);
    timers.clear();
  }

  function record(method, id) {
    try {
      return store[method]?.(id);
    } catch (error) {
      console.warn(`[sacred] ${method} failed`, error);
      return false;
    }
  }

  function read(method, id) {
    try {
      return typeof store[method] === "function" ? Boolean(store[method](id)) : false;
    } catch {
      return false;
    }
  }

  const fileOptions = () => ({
    id: config.fileId,
    trackId: config.trackId,
    nameKey: "sacred.file.name",
  });

  const toolOptions = () => ({
    id: config.toolId,
    nameKey: "sacred.tool.name",
  });

  /** Show everything the saved state says belongs on the desktop. */
  function restore() {
    // Migration and reload path: understanding is what grants the tool.
    // (A save that already had the tool keeps it — progress is never revoked.)
    if (read("hasUnderstood", config.trackId) && !read("hasTool", config.toolId)) {
      record("unlockTool", config.toolId);
    }
    // A restored button is normal taskbar chrome, not a fresh unlock: only a
    // new unlock should replay the stepped highlight.
    if (read("hasTool", config.toolId)) {
      files?.addTool?.({ ...toolOptions(), fresh: false });
    }
    if (read("hasEvent", config.fileEvent) && !read("hasTrack", config.trackId)) {
      files?.addFile?.(fileOptions());
    }
    // A refresh between understanding and M.I.L.O.'s explanation keeps the
    // reaction ready; it still waits for a pause, exactly like a live one.
    if (
      read("hasUnderstood", config.trackId) &&
      !read("hasSeenTutorial", config.understoodTutorialId)
    ) {
      queueUnderstood(config.returnDelayMs);
    }
    // The DREAM LOG remark is no longer automatic: it belongs to the first
    // opening of DREAM LOG after the tool was unlocked (onDreamlogOpened).
  }

  /* --------------------------------------------------------------- sequence */

  function placePatch() {
    // Larger than a timer trace: this one has to be seen to be understood.
    // The first Twister's corruption is scripted, never left to a chance roll,
    // so a placement attempt may be retried rather than silently skipped.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const patch = corruption?.spawnPatch?.({ reason: "discovery", scale: 1.35 });
      if (patch) return patch;
    }
    return null;
  }

  function openDialogue() {
    if (!mascot || typeof mascot.showDialog !== "function") {
      finish();
      return;
    }
    const opened = mascot.showDialog({
      bodyKey: config.dialogueKey,
      actionKey: config.actionKey,
      persistent: true,
      onAction: finish,
      onClose: finish,
    });
    if (!opened) finish();
  }

  function finish() {
    if (finished) return;
    finished = true;
    // Acknowledged: release the block, then let the line end and the file land.
    mascot?.endTutorial?.({ hide: true });
    after(config.fileDelayMs, () => {
      record("completeEvent", config.fileEvent);
      files?.addFile?.(fileOptions());
      after(config.returnDelayMs, () => {
        mascot?.leaveDock?.();
        // Back at his corner, he explains what the new file is for. This line
        // must not block: the visitor needs the desktop to drag it.
        after(config.instructionDelayMs, () => {
          mascot?.showLine?.({
            key: config.instructionKey,
            tone: "event",
            holdMs: config.instructionHoldMs,
          });
          active = false;
          quiet(false);
        });
      });
    });
  }

  /**
   * The visitor closed the first Twister's message. Everything after this is
   * scripted: one patch, one flight, one line, one file.
   */
  function onEncounterClosed(encounter) {
    if (!encounter || !encounter.first) return false;
    if (read("hasEvent", config.discoveryEvent)) return false;
    // Written before anything appears: a reload mid-scene never replays it.
    record("completeEvent", config.discoveryEvent);
    runScene();
    return true;
  }

  async function runScene() {
    active = true;
    quiet(true);
    const patch = placePatch();
    await wait(config.noticeDelayMs);
    if (patch && mascot?.dockBeside) {
      try {
        // Stop beside the trace itself, not at his usual corner.
        await mascot.dockBeside(patch.el, { animate: true, near: true });
      } catch (error) {
        console.warn("[sacred] could not fly to the corruption", error);
      }
    }
    await wait(config.flightSettleMs);
    openDialogue();
  }

  /* ------------------------------------------------------------------- tool */

  /** Make the tool visible and return the taskbar button the dock can aim at. */
  function revealTool() {
    const isNew = Boolean(record("unlockTool", config.toolId));
    const entry = files?.addTool?.({ ...toolOptions(), fresh: isNew }) || null;
    const button =
      entry?.button ||
      doc?.querySelector?.(`.tasktool[data-tool-id="${config.toolId}"]`) ||
      null;
    return { entry, button };
  }

  /** Complete the blocking explanation when NEXT is clicked. */
  function finishUnderstood() {
    if (!understoodPending) return;
    understoodPending = false;
    record("markTutorialShown", config.understoodTutorialId);
    mascot?.endTutorial?.({ hide: true });
    // The pointer has done its job; it never becomes permanent decoration.
    marker?.hide();
    active = false;
    quiet(false);
  }

  /**
   * Queue the comprehension explanation for the next visitor-requested pause.
   * Reaching the threshold marks the track understood, but nothing is said
   * while the track is playing.
   */
  function queueUnderstood(delay = 0) {
    if (!read("hasUnderstood", config.trackId)) return;
    if (read("hasSeenTutorial", config.understoodTutorialId)) return;
    after(delay, () => {
      gate.whenPaused(onUnderstood, {
        id: "sacred-digital:understood",
        ready: () =>
          read("hasUnderstood", config.trackId) &&
          !read("hasSeenTutorial", config.understoodTutorialId),
      });
    });
  }

  /* ------------------------------------------------------ DREAM LOG remark */

  /** The remark only makes sense while DREAM LOG is actually on screen. */
  const dreamlogOpen = () =>
    dreamlogReady() && Boolean(doc?.querySelector?.(".app--dreams"));

  /** The remark needs the tool be unlocked *and* the original line finished. */
  function dreamlogReady() {
    return (
      read("hasTool", config.toolId) &&
      read("hasSeenTutorial", config.understoodTutorialId) &&
      !read("hasSeenTutorial", config.dreamlogTutorialId)
    );
  }

  /**
   * One short, non-blocking line: the same brush also cleans DREAM LOG. It is
   * never spoken before the unlock, never over music, and never twice.
   * @returns {boolean} whether the remark is settled (shown or unnecessary)
   */
  function announceDreamlog() {
    if (!dreamlogReady()) return true;
    if (!mascot || typeof mascot.showLine !== "function") return false;
    // The explanation describes what is on screen: no DREAM LOG, no line.
    if (!dreamlogOpen()) return false;
    if (mascot.isTutorial?.() || mascot.isSpeaking?.()) return false;
    if (gate.isPlaying()) return false;
    // The LIBERATION event owns the desktop; nothing else speaks over it.
    if (typeof document !== "undefined" && document.body.classList.contains("is-liberating")) {
      return false;
    }
    const opened = mascot.showLine({
      key: config.dreamlogKey,
      tone: "event",
      holdMs: config.dreamlogHoldMs,
    });
    if (!opened) return false;
    record("markTutorialShown", config.dreamlogTutorialId);
    return true;
  }

  /**
   * The visitor opened DREAM LOG. Only now does M.I.L.O. explain that the same
   * brush also cleans the damaged dream records. Never before the unlock, never
   * twice, and never over a playing track: if music is running, the line waits
   * for the visitor's next pause and is only shown while the log is open.
   *
   * @returns {boolean} whether the remark is settled
   */
  function onDreamlogOpened() {
    if (!dreamlogReady()) return false;
    if (!doc?.querySelector?.(".app--dreams")) return false;
    if (announceDreamlog()) return true;
    // M.I.L.O. is busy: the shared queue delivers the remark once the desktop
    // is free again, and only while DREAM LOG is still open.
    gate.whenPaused(announceDreamlog, {
      id: "sacred-digital:dreamlog",
      ready: dreamlogOpen,
    });
    return false;
  }

  /**
   * The listening threshold was reached. M.I.L.O. explains what the fragment
   * contained in a blocking dialogue, the brush appears a beat later, and he
   * flies to its taskbar button so the new control is unmistakable. The tool is
   * revealed after understanding, never after a mere collection, and is never
   * activated on its own.
   */
  function onUnderstood() {
    // Already explained (or the visitor refreshed after it): just keep the tool.
    if (read("hasSeenTutorial", config.understoodTutorialId)) {
      revealTool();
      return true;
    }
    if (!mascot || typeof mascot.showDialog !== "function") {
      revealTool();
      return true;
    }
    // The LIBERATION event owns the desktop; nothing else opens over it.
    if (typeof document !== "undefined" && document.body.classList.contains("is-liberating")) {
      return false;
    }
    // A tutorial, another bubble or a scripted scene: stay ready for the next
    // pause instead of cutting into whatever M.I.L.O. is already saying.
    if (mascot.isTutorial?.() || mascot.isSpeaking?.()) return false;

    const opened = Boolean(
      mascot.showDialog({
        bodyKey: config.understoodKey,
        actionKey: config.actionKey,
        uneasy: false,
        persistent: true,
        onAction: finishUnderstood,
      }),
    );
    if (!opened) return false;

    understoodPending = true;
    active = true;
    quiet(true);
    after(config.understoodRevealMs, () => {
      const { button } = revealTool();
      // Mark the exact button on the taskbar, then lead the eye there. The ring
      // reads the live element box, so a resize or a taskbar reflow keeps it
      // centred on the control instead of a fixed screen coordinate.
      if (understoodPending && button) ensureMarker().show(button);
      // The shared dock flight stays smooth and keeps him there while he
      // explains.
      if (understoodPending && button && mascot?.dockBeside) {
        Promise.resolve(mascot.dockBeside(button, { animate: true, near: true })).catch(
          (error) => console.warn("[sacred] could not fly to the tool", error),
        );
      }
    });
    return true;
  }

  function toggleBrush(next) {
    if (!brush) return false;
    const value = typeof next === "boolean" ? next : !brush.isActive();
    brush.setActive(value);
    files?.setToolActive?.(config.toolId, value);
    marker?.hide();
    if (value) startCleanGuide();
    else dismissCleanGuide(false);
    return value;
  }

  /* ------------------------------------------- first-cleaning guidance */

  function ensureMarker() {
    if (!marker) marker = createTutorialMarker({ document: doc });
    return marker;
  }

  function stopCleanTimers() {
    cleanGuideAttempts = 0;
  }

  /** Leave the guidance without recording it: it returns next activation. */
  function dismissCleanGuide(alsoMark = false) {
    if (!cleanGuideActive) return;
    cleanGuideActive = false;
    stopCleanTimers();
    marker?.hide();
    mascot?.hide?.("sacred-clean");
    quiet(false);
    if (alsoMark) record("markTutorialShown", config.cleanTutorialId);
  }

  /** The first successful cleaning is what completes the tutorial. */
  function completeCleanGuide() {
    if (!cleanGuideActive) return;
    cleanGuideActive = false;
    stopCleanTimers();
    marker?.hide();
    record("markTutorialShown", config.cleanTutorialId);
    quiet(false);
  }

  /**
   * After the first activation M.I.L.O. flies to a real corrupted area, the
   * ring marks that exact patch, and he explains the click-and-drag. The
   * guidance ends with the first successful cleaning, never with a timer of
   * its own, and it is recorded so it cannot come back.
   */
  function startCleanGuide() {
    if (cleanGuideActive || !brush) return;
    if (!read("hasTool", config.toolId)) return;
    if (read("hasSeenTutorial", config.cleanTutorialId)) return;
    if (typeof document !== "undefined" && document.body?.classList.contains("is-liberating")) {
      return;
    }

    // Point at an existing patch; create one only if the desktop is clean, so
    // the ring can never surround empty wallpaper.
    let target = (corruption?.getPatches?.() || []).find((patch) => patch.el?.isConnected);
    if (!target) {
      const patch = corruption?.spawnPatch?.({ reason: "clean-tutorial", scale: 1.15 });
      if (patch) target = { id: patch.id, el: patch.el };
    }
    if (!target?.el) return;

    cleanGuideActive = true;
    quiet(true);

    const explain = () => {
      if (!cleanGuideActive) return;
      if (!target.el.isConnected) return;
      ensureMarker().show(target.el);
      const opened = mascot?.showLine?.({
        key: config.cleanGuideKey,
        tone: "event",
        uneasy: true,
        holdMs: config.cleanGuideHoldMs,
      });
      if (!opened) {
        // M.I.L.O. is busy: keep the ring and try again shortly.
        cleanGuideAttempts += 1;
        if (cleanGuideAttempts <= 8) after(config.cleanRetryMs, explain);
      }
    };

    // Fly to the corruption first; the ring appears where he stops.
    Promise.resolve(mascot?.dockBeside?.(target.el, { animate: true, near: true }))
      .catch((error) => console.warn("[sacred] could not fly to the corruption", error))
      .then(() => {
        if (!cleanGuideActive) return;
        after(config.cleanRetryMs, explain);
      });
  }

  function start() {
    if (started) return;
    started = true;
    restore();
    // Collection is what unlocks the tool, and a reload must not lose it.
    stops.push(
      store.subscribe((state, change) => {
        // Collected: the drag instruction has done its job. Collection alone
        // deliberately unlocks nothing — understanding is the gate.
        if (change?.type === "tracks:add" && change.id === config.trackId) {
          mascot?.hide?.("sacred-collected");
        }
        if (change?.type === "understood:add" && change.id === config.trackId) {
          // Ready, but silent until the visitor pauses the track.
          queueUnderstood();
        }
        if (change?.type === "tools:add" && change.id === config.toolId) {
          files?.addTool?.(toolOptions());
        }
      }),
    );
    // A clean desktop puts the brush away by itself; the tool stays clickable.
    if (corruption?.subscribe) {
      stops.push(
        corruption.subscribe((snapshot, change) => {
          // The visitor really cleaned something while being guided: the
          // first-cleaning tutorial is done, permanently.
          if (change?.type === "patch:remove" && cleanGuideActive) completeCleanGuide();
          if (snapshot.count === 0 && brush?.isActive?.()) toggleBrush(false);
        }),
      );
    }
  }

  return {
    start,
    onEncounterClosed,
    // Called by boot when DREAM LOG is opened (see main.js).
    onDreamlogOpened,
    /**
     * True while the first-opening explanation is still owed. Boot uses this to
     * suppress the generic "you opened a program" line, which would otherwise
     * replace the explanation a moment after it appears.
     */
    wantsDreamlogExplanation: () => dreamlogReady(),
    /** A desktop event owns the screen: no tutorial ring may float over it. */
    suspendGuidance() {
      if (!cleanGuideActive && !understoodPending) {
        marker?.hide();
        return;
      }
      cleanGuideActive = false;
      stopCleanTimers();
      marker?.hide();
      mascot?.hide?.("sacred-suspend");
    },
    toggleBrush,
    restore,
    isActive: () => active,
    isRunning: () => active && !finished,
    destroy() {
      mascot?.endTutorial?.();
      understoodPending = false;
      cleanGuideActive = false;
      marker?.destroy();
      marker = null;
      clearTimers();
      for (const stop of stops) stop();
      stops.length = 0;
      brush?.setActive?.(false);
      started = false;
      active = false;
    },
  };
}
