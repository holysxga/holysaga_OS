/**
 * M.I.L.O.'s first-contact sequence.
 *
 * This is deliberately a small narrative layer, not a new persistence system:
 * - `progression.tutorials` records that first contact was presented, so a
 *   refresh or an early close never repeats it;
 * - `progression.events` records that the visitor reached the end, leaving a
 *   clear hook for later narrative events;
 * - the existing mascot renders the steps and the existing dialogue/thought
 *   schedulers are held while it is open.
 *
 * The two step definitions are stable IDs. Future events should check the
 * tutorial/event IDs and build on this flow rather than editing the intro.
 */
import { progression } from "./progression.js";

export const FIRST_CONTACT = Object.freeze({
  tutorialId: "milo-first-contact",
  eventId: "milo-first-contact",
  holdReason: "milo-first-contact",
  titleKey: "mascot.intro.title",
  steps: Object.freeze([
    Object.freeze({
      bodyKey: "mascot.intro.step1",
      actionKey: "mascot.intro.continue",
    }),
    Object.freeze({
      bodyKey: "mascot.intro.step2",
      actionKey: "mascot.intro.finish",
    }),
  ]),
});

export function createFirstContact(options = {}) {
  const mascot = options.mascot;
  const dialogue = options.dialogue || null;
  const thoughts = options.thoughts || null;
  const store = options.store || progression;
  const delayMs = Number.isFinite(options.delayMs)
    ? Math.max(0, options.delayMs)
    : 600;

  let timer = null;
  let active = false;
  let started = false;
  let finished = false;
  let exiting = false;
  let exitPromise = null;

  function hasSeen() {
    try {
      return Boolean(
        (typeof store.hasSeenTutorial === "function" &&
          store.hasSeenTutorial(FIRST_CONTACT.tutorialId)) ||
          (typeof store.hasEvent === "function" &&
            store.hasEvent(FIRST_CONTACT.eventId)),
      );
    } catch {
      return false;
    }
  }

  function holdSchedulers() {
    dialogue?.hold?.(FIRST_CONTACT.holdReason);
    thoughts?.hold?.(FIRST_CONTACT.holdReason);
  }

  function releaseSchedulers() {
    dialogue?.release?.(FIRST_CONTACT.holdReason);
    thoughts?.release?.(FIRST_CONTACT.holdReason);
  }

  function markTutorial() {
    try {
      store.markTutorialShown?.(FIRST_CONTACT.tutorialId);
    } catch (error) {
      console.warn("[first-contact] could not record the introduction", error);
    }
  }

  function markCompleted() {
    try {
      store.completeEvent?.(FIRST_CONTACT.eventId);
    } catch (error) {
      console.warn("[first-contact] could not record completion", error);
    }
  }

  function end() {
    active = false;
    exiting = false;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    releaseSchedulers();
  }

  /**
   * Play the return flight and only then hand the desktop back to the idle
   * schedulers. `active` stays true during the exit so nothing can interrupt
   * the scene halfway through.
   */
  function leaveScene(reason = "finish") {
    if (exiting) return exitPromise;
    exiting = true;

    let result;
    try {
      result =
        typeof mascot.exitIntro === "function"
          ? mascot.exitIntro(reason)
          : (mascot.hide(reason), Promise.resolve());
    } catch (error) {
      console.warn("[first-contact] could not leave the intro scene", error);
      if (typeof mascot.cancelIntro === "function") mascot.cancelIntro(reason);
      else mascot.hide(reason);
      result = Promise.resolve();
    }

    exitPromise = Promise.resolve(result)
      .catch((error) => {
        console.warn("[first-contact] intro exit failed", error);
        if (typeof mascot.cancelIntro === "function") mascot.cancelIntro(reason);
      })
      .finally(() => {
        exiting = false;
        exitPromise = null;
        active = false;
        releaseSchedulers();
      });

    return exitPromise;
  }

  function finish() {
    if (finished || exiting) return;
    finished = true;
    markCompleted();
    leaveScene("finish");
  }

  function openStep(index) {
    const step = FIRST_CONTACT.steps[index];
    if (!step) {
      end();
      return false;
    }

    const opened = mascot.showDialog({
      titleKey: FIRST_CONTACT.titleKey,
      bodyKey: step.bodyKey,
      actionKey: step.actionKey,
      onAction: () => {
        if (!active || exiting) return;
        if (index < FIRST_CONTACT.steps.length - 1) {
          if (!openStep(index + 1)) leaveScene("unavailable");
        } else {
          finish();
        }
      },
      onClose: () => {
        if (finished || exiting) return;
        leaveScene("close");
      },
    });

    if (!opened) return false;
    if (index === 0) markTutorial();
    active = true;
    return true;
  }

  function begin() {
    timer = null;
    if (active || finished) return;
    active = true;

    let entering;
    try {
      entering =
        typeof mascot.enterIntro === "function"
          ? mascot.enterIntro()
          : Promise.resolve();
    } catch (error) {
      console.warn("[first-contact] could not enter the intro scene", error);
      end();
      return;
    }

    Promise.resolve(entering)
      .then(() => {
        if (!active || finished || exiting) return;
        if (!openStep(0)) leaveScene("unavailable");
      })
      .catch((error) => {
        console.warn("[first-contact] intro entrance failed", error);
        if (typeof mascot.cancelIntro === "function") mascot.cancelIntro("error");
        end();
      });
  }

  /**
   * Schedule the welcome after the desktop has had a paint. Holding before the
   * delay also prevents an idle/context line from sneaking in during boot.
   * @returns {boolean} true when this visit scheduled the sequence.
   */
  function start() {
    if (started || active || finished || hasSeen()) return false;
    started = true;
    holdSchedulers();
    timer = setTimeout(begin, delayMs);
    if (timer && typeof timer.unref === "function") timer.unref();
    return true;
  }

  function destroy() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    if (active) {
      finished = true;
      if (typeof mascot.cancelIntro === "function") mascot.cancelIntro("destroy");
      else mascot.hide("destroy");
    }
    active = false;
    exiting = false;
    exitPromise = null;
    releaseSchedulers();
  }

  return {
    start,
    destroy,
    isActive: () => active,
    // Scheduled but not yet on screen (the short beat before the scene opens):
    // the desktop is already reserved, so nothing else may start there.
    isScheduled: () => timer !== null,
    isFinished: () => finished,
    hasSeen,
  };
}
