/**
 * Mascot dock — the small robot in the lower-right corner.
 *
 * The figure follows the approved reference: cream square body, black outline,
 * teal antenna and screen, a beige top panel and black feet. It stays compact
 * and sits below windows, so it never covers a program's controls.
 *
 * Dialogue is rendered here, but scheduling lives in js/core/mascot-dialogue.js
 * and the text lives in js/data/mascot-dialogue.js + the dictionaries. This
 * component never reads progression and never triggers events.
 */
import { el } from "../core/dom.js";
import { dictionaryKeys, onLocaleChange, t } from "../i18n/index.js";

const ROBOT = `
  <svg viewBox="0 0 80 100" role="presentation" focusable="false" shape-rendering="crispEdges">
    <ellipse cx="40" cy="91" rx="25" ry="3" fill="#04120f" opacity="0.32"></ellipse>
    <rect x="34" y="0" width="12" height="7" fill="#7bd2cb" stroke="#081110" stroke-width="2"></rect>
    <rect x="39" y="7" width="2" height="8" fill="#081110"></rect>
    <rect x="7" y="14" width="66" height="64" rx="2" fill="#e9e5da" stroke="#081110" stroke-width="3.5"></rect>
    <rect x="15" y="21" width="50" height="8" fill="#d7d1c2"></rect>
    <rect x="22" y="33" width="36" height="26" fill="#101817" stroke="#081110" stroke-width="2.5"></rect>
    <rect x="28" y="39" width="24" height="14" fill="#72cdc6"></rect>
    <rect class="mascot__glint" x="31" y="41" width="6" height="4" fill="#eaf8f5"></rect>
    <g class="mascot__worry" aria-hidden="true">
      <path class="mascot__brow" d="M31 44.6 L36.6 42.4"></path>
      <path class="mascot__brow" d="M49 44.6 L43.4 42.4"></path>
      <path class="mascot__mouth-uneasy" d="M36.4 50.4 Q40 48.6 43.6 50.4"></path>
    </g>
    <g class="mascot__blink" aria-hidden="true">
      <rect class="mascot__lid mascot__lid--top" x="28" y="39" width="24" height="7" fill="#101817"></rect>
      <rect class="mascot__lid mascot__lid--bottom" x="28" y="46" width="24" height="7" fill="#101817"></rect>
    </g>
    <rect x="33" y="65" width="14" height="3" fill="#081110"></rect>
    <rect x="16" y="78" width="14" height="8" fill="#081110"></rect>
    <rect x="50" y="78" width="14" height="8" fill="#081110"></rect>
  </svg>`;

/* A quick screen shutter: the reference has a display, not drawn eyes. */
const BLINK_MIN_MS = 3000;
const BLINK_MAX_MS = 7000;
const BLINK_MS = 150;

/* First-contact scene timing. The flight is a FLIP transition: the dock is
   placed at its destination first, then translated back to its start and
   eased home, so it works at every viewport size. */
const SCENE_FLIGHT_MS = 880;
const SCENE_RETURN_MS = 760;
const SCENE_FADE_MS = 180;

/* Docking beside a window: same eased flight, but the dock stays where it
   lands until the active window changes. The robot sits just outside the
   window's right edge, its bubble opens to its right, and both are clamped to
   the desktop (which already excludes the taskbar). */
const DOCK_GAP = 12;
const DOCK_BUBBLE_GAP = 12;
const DOCK_BUBBLE_WIDTH = 210;
/* Breathing room between the docked robot and the desktop edges. */
const DOCK_MARGIN = 8;
/* Where the robot's head sits relative to the window's top edge. */
const DOCK_TOP_INSET = 14;
/* The title-bar controls are a protected click target: keep the robot and his
   bubble this far outside their measured box, not merely outside the glass. */
const CONTROL_CLEARANCE = 8;
/* A docked bubble may narrow to the free space beside the window, but not so
   far that the text becomes a single-word column. */
const MIN_DOCK_BUBBLE_WIDTH = 120;
/* How close he stops to something he is inspecting (a corruption trace). */
const NEAR_GAP = 26;
/* A window drag/resize retargets with a short eased move, never a jump. */
const DOCK_FOLLOW_MS = 180;

function unref(timer) {
  if (timer && typeof timer.unref === "function") timer.unref();
  return timer;
}

/**
 * Render a line that may carry `**emphasis**`, as the discovery dialogue does.
 * Only text nodes and <strong> elements are created — a translation is never
 * parsed as HTML, and every other line renders exactly as before.
 */
function renderRich(node, text) {
  node.textContent = "";
  const parts = String(text).split("**");
  parts.forEach((part, index) => {
    if (!part) return;
    if (index % 2 === 1) {
      const strong = document.createElement("strong");
      strong.textContent = part;
      node.append(strong);
      return;
    }
    node.append(part);
  });
}

/** Never let a missing translation surface as a raw key in the bubble. */
function hasTranslation(key) {
  if (typeof key !== "string" || !key) return false;
  return Object.values(dictionaryKeys()).some((keys) => keys.includes(key));
}

export function createMascot({ root, onTutorialChange = null }) {
  const title = el("p", { class: "mascot__bubble-title", text: t("mascot.title") });
  const body = el("p", {
    class: "mascot__bubble-body",
    "aria-live": "polite",
    "aria-atomic": "true",
  });
  const close = el("button", {
    class: "mascot__close",
    type: "button",
    text: "×",
    title: t("mascot.close"),
    "aria-label": t("mascot.close"),
  });

  const secondary = el("button", {
    class: "mascot__action mascot__action--secondary raised",
    type: "button",
    hidden: true,
  });
  const action = el("button", {
    class: "mascot__action raised",
    type: "button",
  });
  const actions = el("div", { class: "mascot__actions", hidden: true }, [secondary, action]);

  const bubble = el(
    "div",
    {
      class: "mascot__bubble",
      role: "status",
      hidden: true,
    },
    [el("div", { class: "mascot__bubble-head" }, [title, close]), body, actions],
  );

  const figure = el("button", {
    class: "mascot__figure",
    type: "button",
    disabled: true,
    "aria-label": t("mascot.area"),
  });
  figure.innerHTML = ROBOT;

  const dock = el("div", { class: "mascot", role: "complementary" }, [bubble, figure]);

  let current = null;
  let speaking = false;
  let hideTimer = null;
  let dialogMode = false;
  let actionHandler = null;
  let secondaryActionHandler = null;
  let secondaryActionKey = null;
  let closeHandler = null;
  /* A blocking tutorial owns the desktop until its last step is acknowledged. */
  let tutorial = false;
  let shield = null;

  function reportTutorial(active) {
    if (typeof onTutorialChange === "function") {
      try {
        onTutorialChange(active);
      } catch (error) {
        console.error("[mascot] tutorial listener failed", error);
      }
    }
  }

  const motionQuery =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;
  let motionAllowed = !(motionQuery && motionQuery.matches);
  let paused = false;
  let blinkTimer = null;
  let blinkEndTimer = null;
  let sceneState = "dock";
  let uneasy = false;
  let sceneTimer = null;
  let exitPromise = null;
  let docked = false;
  /* The window (or trace) the dock is currently looking at. */
  let dockTarget = null;
  let dockNear = false;
  const dockOffset = { x: 0, y: 0 };
  /* One observer pair and one frame for the current window: moving the active
     window must not start an animation per pointer event or per app. */
  let dockResizeObserver = null;
  let dockMutationObserver = null;
  let dockFollowFrame = 0;
  /* Last measured target bounds. Observers fire once on attach and after every
     z-index/class change; only a real geometry change should re-aim the dock. */
  let dockTargetBounds = null;
  /* Invalidates a stale transition completion when a new flight starts. */
  let motionToken = 0;

  function stopBlinking() {
    if (blinkTimer !== null) {
      clearTimeout(blinkTimer);
      blinkTimer = null;
    }
    if (blinkEndTimer !== null) {
      clearTimeout(blinkEndTimer);
      blinkEndTimer = null;
    }
    figure.classList.remove("is-blinking");
  }

  function scheduleBlink() {
    if (!motionAllowed || paused) return;
    if (blinkTimer !== null) clearTimeout(blinkTimer);
    blinkTimer = setTimeout(blink, BLINK_MIN_MS + Math.random() * (BLINK_MAX_MS - BLINK_MIN_MS));
    unref(blinkTimer);
  }

  function blink() {
    blinkTimer = null;
    if (!motionAllowed || paused) return;
    figure.classList.add("is-blinking");
    blinkEndTimer = setTimeout(() => {
      blinkEndTimer = null;
      figure.classList.remove("is-blinking");
      scheduleBlink();
    }, BLINK_MS);
    unref(blinkEndTimer);
  }

  function setPaused(next) {
    if (next === paused) return;
    paused = next;
    figure.classList.toggle("is-paused", paused);
    if (paused) stopBlinking();
    else scheduleBlink();
  }

  function onVisibilityChange() {
    setPaused(document.visibilityState === "hidden");
  }

  function onMotionChange(event) {
    motionAllowed = !event.matches;
    if (!motionAllowed) stopBlinking();
    else if (!paused) scheduleBlink();
  }

  function wait(ms) {
    if (!(ms > 0)) return Promise.resolve();
    return new Promise((resolve) => {
      sceneTimer = setTimeout(() => {
        sceneTimer = null;
        resolve();
      }, ms);
    });
  }

  function clearIntroScene() {
    root.classList.remove("is-intro");
    dock.classList.remove("is-intro");
    bubble.classList.remove("is-leaving");
    dock.style.transition = "";
    dock.style.transform = "";
    sceneState = "dock";
  }

  function animateDock(dx, dy, duration) {
    dock.style.transition = "none";
    dock.style.transform = `translate(${dx}px, ${dy}px)`;
    // Commit the starting position before asking the browser to transition.
    void dock.offsetWidth;
    if (!motionAllowed || duration <= 0) {
      dock.style.transition = "";
      dock.style.transform = "";
      return Promise.resolve();
    }
    dock.style.transition = `transform ${duration}ms cubic-bezier(0.16, 0.84, 0.24, 1)`;
    dock.style.transform = "translate(0, 0)";
    return wait(duration + 30).then(() => {
      dock.style.transition = "";
      dock.style.transform = "";
    });
  }

  /**
   * Translate the dock and leave it there (or send it home). Kept separate
   * from the intro scene, which owns the same transform property.
   */
  function setDockOffset(x, y, duration = 0) {
    dockOffset.x = x;
    dockOffset.y = y;
    const token = ++motionToken;
    const moving = motionAllowed && duration > 0;
    dock.style.transition = moving
      ? `transform ${duration}ms cubic-bezier(0.16, 0.84, 0.24, 1)`
      : "none";
    // Commit the starting transform before asking for a transition.
    void dock.offsetWidth;
    dock.style.transform = x || y ? `translate(${x}px, ${y}px)` : "";
    if (!moving) {
      if (token === motionToken) dock.style.transition = "";
      return Promise.resolve();
    }
    return wait(duration + 30).then(() => {
      // A newer flight owns the transition by now; don't clear its style.
      if (token === motionToken) dock.style.transition = "";
    });
  }

  /** The box the dock may live in: the desktop, above the taskbar. */
  function dockArea() {
    return (root.parentElement || document.body).getBoundingClientRect();
  }

  /** Width of the speech bubble, even while it is hidden. */
  function bubbleWidth() {
    const rect = bubble.getBoundingClientRect();
    if (rect.width > 0) return rect.width;
    const css = parseFloat(window.getComputedStyle(bubble).width);
    return Number.isFinite(css) && css > 0 ? css : DOCK_BUBBLE_WIDTH;
  }

  /**
   * The figure's untransformed home corner, measured from the desktop. Using
   * the root's own inset (rather than the live transformed rect) keeps this
   * correct even while a flight is still in progress.
   */
  function dockHome() {
    const area = dockArea();
    const styles = window.getComputedStyle(root);
    const rightInset = parseFloat(styles.right);
    const bottomInset = parseFloat(styles.bottom);
    const figureRect = figure.getBoundingClientRect();
    const right = area.right - (Number.isFinite(rightInset) ? rightInset : DOCK_MARGIN);
    const bottom = area.bottom - (Number.isFinite(bottomInset) ? bottomInset : DOCK_MARGIN);
    return {
      area,
      left: right - figureRect.width,
      top: bottom - figureRect.height,
      width: figureRect.width,
      height: figureRect.height,
    };
  }

  function setBubbleSide(side) {
    dock.classList.toggle("is-bubble-right", side === "right");
    dock.classList.toggle("is-bubble-left", side === "left");
  }

  /**
   * The bubble hangs off the robot's side. If its lower edge would leave the
   * desktop, it is anchored to the robot's feet instead and grows upward.
   */
  function alignBubble() {
    if (!docked) return;
    dock.classList.remove("is-bubble-up");
    if (!speaking) return;
    const area = dockArea();
    const pad = DOCK_MARGIN;
    const rect = bubble.getBoundingClientRect();
    if (rect.height < 1) return;
    if (rect.bottom > area.bottom - pad) {
      dock.classList.add("is-bubble-up");
      // If even the upward position leaves the top, top alignment is closer.
      if (bubble.getBoundingClientRect().top < area.top + pad) {
        dock.classList.remove("is-bubble-up");
      }
    }
  }

  /**
   * The measured title-bar controls, expanded into a click-safe box. This is
   * intentionally based on the real buttons rather than a guessed title-bar
   * height, so every app and every localized title gets the same protection.
   */
  function controlGuardFor(target) {
    const win = target.closest?.(".window");
    const controls =
      win?.querySelector(".window__titlebar .window__controls") ||
      win?.querySelector(".window__titlebar .window__btn--close");
    if (!controls) return null;
    const rect = controls.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    return {
      left: rect.left - CONTROL_CLEARANCE,
      top: rect.top - CONTROL_CLEARANCE,
      right: rect.right + CONTROL_CLEARANCE,
      bottom: rect.bottom + CONTROL_CLEARANCE,
    };
  }

  function overlaps(a, b) {
    return Boolean(
      a &&
        b &&
        a.left < b.right &&
        a.right > b.left &&
        a.top < b.bottom &&
        a.bottom > b.top,
    );
  }

  function stackBoxes(left, top, side, figureW, figureH, bubbleW, area, pad) {
    const robot = {
      left,
      top,
      right: left + figureW,
      bottom: top + figureH,
    };
    if (bubble.hidden || bubble.getBoundingClientRect().height < 1) {
      return { robot, bubble: null };
    }
    const bubbleH = bubble.getBoundingClientRect().height;
    let bubbleTop = top;
    if (bubbleTop + bubbleH > area.bottom - pad) {
      bubbleTop = top + figureH - bubbleH;
    }
    const bubbleLeft =
      side === "right"
        ? left + figureW + DOCK_BUBBLE_GAP
        : left - DOCK_BUBBLE_GAP - bubbleW;
    return {
      robot,
      bubble: {
        left: bubbleLeft,
        top: bubbleTop,
        right: bubbleLeft + bubbleW,
        bottom: bubbleTop + bubbleH,
      },
    };
  }

  /**
   * Place the robot beside the target's measured bounds and choose the bubble
   * side. The window is never used as a coordinate system: every number comes
   * from its live rect, so moving, resizing or restoring it needs no special
   * app code.
   *
   * A window-side dock is only used when the robot and the bubble both fit
   * completely outside the window. Clamping the robot onto a full-width window
   * used to put him over the title-bar controls; in that case he now returns to
   * the normal desktop corner instead.
   */
  function layoutDock({ animate = true, duration = SCENE_FLIGHT_MS } = {}) {
    if (!docked || !dockTarget || sceneState !== "dock") return Promise.resolve(false);
    const rect = dockTarget.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return Promise.resolve(false);
    dockTargetBounds = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };

    const home = dockHome();
    const area = home.area;
    const pad = DOCK_MARGIN;
    const figureW = home.width;
    // Measure the CSS width first; a previous layout may have narrowed it.
    bubble.style.removeProperty("width");
    const bubbleW = bubbleWidth();
    let bubbleWidthTarget = 0;
    const minTop = area.top + pad;
    const maxTop = Math.max(minTop, area.bottom - pad - home.height);
    const minLeft = area.left + pad;
    const maxLeft = Math.max(minLeft, area.right - pad - figureW);

    let targetLeft;
    let targetTop;
    let bubbleSide;

    if (dockNear) {
      // Stand right beside the trace, reading as a flight towards it. Mirror
      // when the right side would leave the desktop.
      const rightShoulder = rect.right + NEAR_GAP;
      const leftShoulder = rect.left - NEAR_GAP - figureW;
      targetLeft = rightShoulder <= maxLeft ? rightShoulder : leftShoulder;
      targetLeft = Math.min(Math.max(targetLeft, minLeft), maxLeft);
      const leftRoom = targetLeft - DOCK_BUBBLE_GAP - minLeft;
      bubbleSide = leftRoom >= bubbleW ? "left" : "right";
      targetTop = Math.min(
        Math.max(rect.bottom + NEAR_GAP / 2, minTop),
        maxTop,
      );
    } else {
      // The full stack must fit outside the window. A narrow bubble is better
      // than moving the robot onto the title bar; below the minimum, the corner
      // is the only honest place that keeps the controls uncovered.
      const rightSpace =
        area.right - pad - (rect.right + DOCK_GAP) - figureW - DOCK_BUBBLE_GAP;
      const leftSpace =
        rect.left - DOCK_GAP - figureW - DOCK_BUBBLE_GAP - minLeft;
      const fitsRight = rightSpace >= MIN_DOCK_BUBBLE_WIDTH;
      const fitsLeft = leftSpace >= MIN_DOCK_BUBBLE_WIDTH;

      if (fitsRight || fitsLeft) {
        const side = fitsRight && (!fitsLeft || rightSpace >= leftSpace) ? "right" : "left";
        targetLeft =
          side === "right" ? rect.right + DOCK_GAP : rect.left - DOCK_GAP - figureW;
        bubbleSide = side;
        const room = side === "right" ? rightSpace : leftSpace;
        if (room < bubbleW) bubbleWidthTarget = room;
        targetTop = Math.min(
          Math.max(rect.top + DOCK_TOP_INSET, minTop),
          maxTop,
        );
      } else {
        // Preserve the existing desktop-corner fallback. It is below the title
        // bar and the bubble opens away from the window controls.
        targetLeft = home.left;
        targetTop = home.top;
        bubbleSide = "left";
        const room = targetLeft - DOCK_BUBBLE_GAP - minLeft;
        if (room > 0 && room < bubbleW) bubbleWidthTarget = room;
      }
    }

    if (bubbleWidthTarget) bubble.style.width = `${Math.floor(bubbleWidthTarget)}px`;

    // Near targets can sit inside a window, so verify the actual stack against
    // the control guard. If it would intrude, use the first desktop corner that
    // keeps both the robot and the bubble clear of the measured controls.
    const guard = controlGuardFor(dockTarget);
    if (guard) {
      const current = stackBoxes(
        targetLeft,
        targetTop,
        bubbleSide,
        figureW,
        home.height,
        bubbleWidthTarget || bubbleW,
        area,
        pad,
      );
      if (overlaps(current.robot, guard) || overlaps(current.bubble, guard)) {
        const corners = [
          { left: home.left, top: home.top, side: "left" },
          { left: minLeft, top: home.top, side: "right" },
          { left: home.left, top: minTop, side: "left" },
          { left: minLeft, top: minTop, side: "right" },
        ];
        let chosen = null;
        for (const corner of corners) {
          const room =
            corner.side === "left"
              ? corner.left - DOCK_BUBBLE_GAP - minLeft
              : area.right - pad - (corner.left + figureW + DOCK_BUBBLE_GAP);
          const width = Math.max(0, Math.min(bubbleW, room));
          const boxes = stackBoxes(
            corner.left,
            corner.top,
            corner.side,
            figureW,
            home.height,
            width,
            area,
            pad,
          );
          if (!overlaps(boxes.robot, guard) && !overlaps(boxes.bubble, guard)) {
            chosen = { ...corner, width };
            break;
          }
        }
        const corner = chosen || corners[0];
        targetLeft = corner.left;
        targetTop = corner.top;
        bubbleSide = corner.side;
        bubble.style.removeProperty("width");
        if (corner.width) bubble.style.width = `${Math.floor(corner.width)}px`;
      }
    }

    setBubbleSide(bubbleSide);
    const target = dockTarget;
    const dx = targetLeft - home.left;
    const dy = targetTop - home.top;
    return setDockOffset(dx, dy, animate ? duration : 0).then(() => {
      alignBubble();
      return dockTarget === target;
    });
  }

  /** One coalesced re-measure per frame, for drags, resizes and restores. */
  function scheduleDockFollow() {
    if (!docked || !dockTarget || dockFollowFrame) return;
    dockFollowFrame = requestAnimationFrame(() => {
      dockFollowFrame = 0;
      if (!docked || !dockTarget) return;
      const rect = dockTarget.getBoundingClientRect();
      const previous = dockTargetBounds;
      // Ignore the observers' initial callback and style-only changes: the dock
      // is already aimed at these bounds, and re-running with animate:false
      // would cut an in-progress flight short.
      if (
        previous &&
        Math.abs(rect.left - previous.left) < 0.5 &&
        Math.abs(rect.top - previous.top) < 0.5 &&
        Math.abs(rect.width - previous.width) < 0.5 &&
        Math.abs(rect.height - previous.height) < 0.5
      ) {
        return;
      }
      layoutDock({ animate: true, duration: DOCK_FOLLOW_MS });
    });
  }

  /** A viewport resize moves the home corner even when the window is unchanged. */
  function scheduleDockResize() {
    dockTargetBounds = null;
    scheduleDockFollow();
  }

  function stopDockWatch() {
    dockResizeObserver?.disconnect();
    dockResizeObserver = null;
    dockMutationObserver?.disconnect();
    dockMutationObserver = null;
    if (dockFollowFrame) {
      cancelAnimationFrame(dockFollowFrame);
      dockFollowFrame = 0;
    }
  }

  /** Watch only the current target; switching windows replaces both observers. */
  function watchDockTarget(target) {
    stopDockWatch();
    dockTargetBounds = null;
    if (typeof ResizeObserver === "function") {
      dockResizeObserver = new ResizeObserver(scheduleDockFollow);
      dockResizeObserver.observe(target);
    }
    if (typeof MutationObserver === "function") {
      dockMutationObserver = new MutationObserver(scheduleDockFollow);
      dockMutationObserver.observe(target, {
        attributes: true,
        attributeFilter: ["class", "style"],
      });
    }
  }

  /**
   * Fly beside the active window and stay there, looking at it.
   *
   * @param {Element} target window element to sit beside
   * @param {{animate?: boolean, near?: boolean}} [options] `animate: false`
   *   re-places him without a flight (live window drags and viewport resizes);
   *   `near: true` stops him right beside a small target, such as a trace
   * @returns {Promise<boolean>} whether the dock is now beside the target
   */
  function dockBeside(target, { animate = true, near = false } = {}) {
    if (!target || sceneState !== "dock" || exitPromise) return Promise.resolve(false);
    const rect = target.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return Promise.resolve(false);

    const changed = dockTarget !== target;
    docked = true;
    dockTarget = target;
    dockNear = Boolean(near);
    if (changed) dockTargetBounds = null;
    dock.classList.add("is-docked");
    root.classList.add("is-docked");
    figure.classList.add("is-watching");
    if (changed) watchDockTarget(target);
    return layoutDock({ animate });
  }

  /** Re-anchor the bubble after it opens, closes or changes width. */
  function settleDock() {
    if (!docked || !dockTarget) return;
    layoutDock({ animate: true, duration: 180 });
  }

  /** Fly back to the normal desktop corner and stop watching. */
  function leaveDock() {
    if (!docked) return Promise.resolve();
    docked = false;
    dockTarget = null;
    dockTargetBounds = null;
    dockNear = false;
    stopDockWatch();
    figure.classList.remove("is-watching");
    if (speaking) hide("dock", false, true);
    return setDockOffset(0, 0, SCENE_RETURN_MS).then(() => {
      if (docked) return; // already following a new window
      dock.classList.remove("is-docked", "is-bubble-left", "is-bubble-right", "is-bubble-up");
      bubble.style.removeProperty("width");
      root.classList.remove("is-docked");
    });
  }

  /** Move M.I.L.O. from the dock to the centered introduction position. */
  function enterIntro() {
    if (sceneState !== "dock") return Promise.resolve();
    if (docked) {
      docked = false;
      dockTarget = null;
      dockTargetBounds = null;
      dockNear = false;
      stopDockWatch();
      figure.classList.remove("is-watching");
      dock.classList.remove("is-docked", "is-bubble-left", "is-bubble-right", "is-bubble-up");
      bubble.style.removeProperty("width");
      root.classList.remove("is-docked");
      setDockOffset(0, 0, 0);
    }
    sceneState = "entering";
    const start = figure.getBoundingClientRect();
    root.classList.add("is-intro");
    dock.classList.add("is-intro");
    const end = figure.getBoundingClientRect();
    return animateDock(start.left - end.left, start.top - end.top, SCENE_FLIGHT_MS).then(() => {
      if (sceneState === "entering") sceneState = "intro";
    });
  }

  /** Fade the dialog, fly M.I.L.O. home, then restore the normal dock. */
  function exitIntro(reason = "finish") {
    if (sceneState === "dock") {
      hide(reason, false);
      return Promise.resolve();
    }
    if (exitPromise) return exitPromise;

    if (!motionAllowed) {
      hide(reason, false, true);
      clearIntroScene();
      exitPromise = Promise.resolve();
      return exitPromise;
    }

    bubble.classList.add("is-leaving");
    exitPromise = wait(SCENE_FADE_MS)
      .then(() => {
        const start = figure.getBoundingClientRect();
        hide(reason, false, true);
        root.classList.remove("is-intro");
        dock.classList.remove("is-intro");
        const end = figure.getBoundingClientRect();
        return animateDock(start.left - end.left, start.top - end.top, SCENE_RETURN_MS);
      })
      .then(() => {
        clearIntroScene();
        exitPromise = null;
      });
    return exitPromise;
  }

  /** Emergency cleanup for teardown; never leave the dock centered. */
  function cancelIntro(reason = "cancel") {
    if (sceneTimer !== null) {
      clearTimeout(sceneTimer);
      sceneTimer = null;
    }
    exitPromise = null;
    clearIntroScene();
    hide(reason, false);
  }

  /**
   * A worried face and a held fidget, for moments of real discomfort. It only
   * toggles a class, so M.I.L.O.'s ordinary appearance is never rewritten.
   */
  function setUneasy(next) {
    const on = Boolean(next);
    if (on === uneasy) return;
    uneasy = on;
    dock.classList.toggle("is-uneasy", uneasy);
    figure.classList.toggle("is-uneasy", uneasy);
  }

  /**
   * A full-screen shield under the bubble. It swallows clicks aimed at windows,
   * icons, the taskbar and the Start menu, so nothing behind it can dismiss or
   * replace a tutorial. It never covers the bubble: the dock sits above it.
   */
  function tutorialShield() {
    if (shield && shield.isConnected) return shield;
    shield = el("div", { class: "tutorial-shield", "aria-hidden": "true" });
    document.body.append(shield);
    return shield;
  }

  function beginTutorial() {
    if (tutorial) return;
    tutorial = true;
    tutorialShield();
    document.body.classList.add("is-tutorial");
    dock.classList.add("is-tutorial");
    // One way forward: the dialogue's own action button.
    close.hidden = true;
    figure.disabled = true;
    reportTutorial(true);
  }

  /**
   * Release the block. Called when the last step is acknowledged, and as a
   * safety net by owners that are torn down mid-tutorial, so an unexpected
   * state change can never leave the desktop permanently locked.
   */
  function endTutorial({ hide: shouldHide = false } = {}) {
    if (!tutorial) {
      if (shouldHide) hide("tutorial-end");
      return false;
    }
    tutorial = false;
    shield?.remove();
    shield = null;
    document.body.classList.remove("is-tutorial");
    dock.classList.remove("is-tutorial");
    close.hidden = false;
    if (shouldHide) hide("tutorial-end");
    reportTutorial(false);
    return true;
  }

  function requestClose(reason) {
    if (tutorial) return;
    if (sceneState === "leaving" || sceneState === "entering") return;
    if (dialogMode && closeHandler) {
      const handler = closeHandler;
      try {
        handler(reason);
        return;
      } catch (error) {
        console.error("[mascot] dialog close failed", error);
      }
    }
    hide(reason);
  }

  /**
   * Lift the whole dock above the interface. The root lives inside the
   * desktop, which is not a stacking context, so this single z-index beats the
   * window layer (10), taskbar (200) and Start menu (300).
   */
  function raiseDialogue() {
    root.style.zIndex = "9999";
    bubble.style.zIndex = "9999";
  }

  function lowerDialogue() {
    root.style.zIndex = "";
    bubble.style.zIndex = "";
  }

  function clearDialogChrome() {
    bubble.classList.remove("mascot__bubble--dialog");
    body.classList.remove("mascot__bubble-body--dialog");
    actions.hidden = true;
    action.textContent = "";
    action.disabled = false;
    secondary.hidden = true;
    secondary.textContent = "";
    secondary.disabled = true;
    secondaryActionHandler = null;
    secondaryActionKey = null;
    root.classList.remove("is-dialog");
  }

  function armHide(holdMs) {
    if (hideTimer !== null) clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, holdMs);
    if (hideTimer && typeof hideTimer.unref === "function") hideTimer.unref();
  }

  function hide(reason = "dismiss", notify = true, keepScene = false, force = false) {
    // A tutorial is only closed by finishing it; unrelated modules cannot hide it.
    if (tutorial && !force) return;
    if (hideTimer !== null) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    if (!speaking) {
      if (!keepScene && sceneState !== "dock") clearIntroScene();
      return;
    }
    lowerDialogue();
    const notifyHandler = closeHandler;
    speaking = false;
    current = null;
    dialogMode = false;
    closeHandler = null;
    actionHandler = null;
    secondaryActionHandler = null;
    secondaryActionKey = null;
    bubble.hidden = true;
    delete bubble.dataset.tone;
    body.textContent = "";
    figure.disabled = true;
    close.hidden = false;
    figure.setAttribute("aria-label", t("mascot.area"));
    dock.classList.remove("is-alert");
    delete dock.dataset.mood;
    setUneasy(false);
    clearDialogChrome();
    title.textContent = t("mascot.title");
    if (!keepScene && sceneState !== "dock") clearIntroScene();
    // The bubble is gone: put the dock back on its ideal spot beside the window.
    if (docked && dockTarget) dockBeside(dockTarget, { animate: false });
    if (notify && notifyHandler) notifyHandler(reason);
  }

  /**
   * LIBERATION owns the desktop: while its event layer is running, M.I.L.O. is
   * silent. This is the single hard gate every line and dialog passes through,
   * so no scheduler, reaction, subtitle or queued line can speak over it.
   */
  function silencedByEvent() {
    return (
      typeof document !== "undefined" &&
      Boolean(document.body?.classList.contains("is-liberating"))
    );
  }

  function show(line, holdMs) {
    if (silencedByEvent()) return false;
    if (!line || dialogMode || tutorial || sceneState !== "dock") return false;
    if (hideTimer !== null) clearTimeout(hideTimer);
    clearDialogChrome();
    closeHandler = null;
    actionHandler = null;
    secondaryActionHandler = null;
    secondaryActionKey = null;
    current = line;
    speaking = true;
    renderRich(body, line.key ? t(line.key) : String(line.text || ""));
    bubble.hidden = false;
    bubble.dataset.tone = line.tone || "idle";
    title.textContent = t("mascot.title");
    figure.disabled = false;
    figure.setAttribute("aria-label", t("mascot.close"));
    dock.classList.toggle("is-alert", line.tone === "alert");
    setUneasy(Boolean(line.uneasy));
    if (line.mood) dock.dataset.mood = line.mood;
    else delete dock.dataset.mood;
    raiseDialogue();
    // Restart the small stir for each new line.
    bubble.classList.remove("is-stirred");
    void bubble.offsetWidth;
    bubble.classList.add("is-stirred");
    // The bubble just grew upward from his feet; keep the stack on-screen.
    settleDock();
    armHide(holdMs);
    return true;
  }

  /** Show a translated line by key. Returns false if no translation exists. */
  function showLine({ key, tone = "idle", holdMs = 14000, mood = "", uneasy: worried = false } = {}) {
    if (!hasTranslation(key)) return false;
    return show({ key, tone, mood, uneasy: worried }, holdMs);
  }

  /**
   * A persistent tutorial/event dialog: localized title, body and one action.
   * It never auto-hides; the caller owns the step flow and receives both the
   * action and close callbacks. The normal bubble close paths stay available.
   */
  function showDialog({
    titleKey = "mascot.title",
    bodyKey,
    actionKey,
    secondaryActionKey: secondKey = null,
    uneasy: worried = false,
    persistent = false,
    onAction = null,
    onSecondary = null,
    onClose = null,
  } = {}) {
    if (silencedByEvent()) return false;
    if (!hasTranslation(bodyKey) || !hasTranslation(actionKey)) return false;
    const hasSecondary = Boolean(secondKey && hasTranslation(secondKey));
    if (secondKey && !hasSecondary) return false;
    const safeTitle = hasTranslation(titleKey) ? titleKey : "mascot.title";
    // Replace a stale block before taking ownership of the bubble.
    if (tutorial) endTutorial();
    if (hideTimer !== null) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    dialogMode = true;
    speaking = true;
    current = { key: bodyKey, titleKey: safeTitle, actionKey, secondaryActionKey: secondKey };
    closeHandler = typeof onClose === "function" ? onClose : null;
    actionHandler = typeof onAction === "function" ? onAction : null;
    secondaryActionHandler = typeof onSecondary === "function" ? onSecondary : null;
    secondaryActionKey = hasSecondary ? secondKey : null;
    title.textContent = t(safeTitle);
    renderRich(body, t(bodyKey));
    bubble.hidden = false;
    bubble.dataset.tone = "dialog";
    bubble.classList.add("mascot__bubble--dialog");
    body.classList.add("mascot__bubble-body--dialog");
    actions.hidden = false;
    action.textContent = t(actionKey);
    action.disabled = !actionHandler;
    secondary.hidden = !hasSecondary;
    secondary.textContent = hasSecondary ? t(secondKey) : "";
    secondary.disabled = !secondaryActionHandler;
    figure.disabled = false;
    figure.setAttribute("aria-label", t("mascot.close"));
    dock.classList.remove("is-alert");
    delete dock.dataset.mood;
    root.classList.add("is-dialog");
    setUneasy(worried);
    raiseDialogue();
    settleDock();
    if (persistent) beginTutorial();
    return true;
  }

  /** Plain scripted text, kept for future non-localized sequences. */
  function say(text) {
    return show({ text }, 12000);
  }

  /** Short contextual reaction used by the intrusive-thought system. */
  function react({ key, category, holdMs = 9000 } = {}) {
    if (!hasTranslation(key)) return false;
    return show({ key, tone: "alert", mood: category || "" }, holdMs);
  }

  function refresh() {
    title.textContent = t(current?.titleKey || "mascot.title");
    dock.setAttribute("aria-label", t("mascot.area"));
    close.title = t("mascot.close");
    close.setAttribute("aria-label", t("mascot.close"));
    if (speaking && current?.key) renderRich(body, t(current.key));
    if (speaking && current?.actionKey) action.textContent = t(current.actionKey);
    if (speaking && current?.secondaryActionKey) {
      secondary.textContent = t(current.secondaryActionKey);
    }
    figure.setAttribute("aria-label", t(speaking ? "mascot.close" : "mascot.area"));
  }

  close.addEventListener("click", () => requestClose("close"));
  figure.addEventListener("click", () => {
    if (speaking) requestClose("mascot");
  });
  action.addEventListener("click", () => {
    if (!actionHandler) return;
    const handler = actionHandler;
    try {
      handler();
    } catch (error) {
      // A broken step must not lock the desktop forever.
      console.error("[mascot] tutorial step failed", error);
      endTutorial({ hide: true });
    }
  });
  secondary.addEventListener("click", () => {
    if (!secondaryActionHandler) return;
    const handler = secondaryActionHandler;
    try {
      handler();
    } catch (error) {
      console.error("[mascot] secondary step failed", error);
      endTutorial({ hide: true });
    }
  });

  refresh();
  root.append(dock);

  // The float is pure CSS on the SVG, so the button box never moves. Blinking
  // is scheduled here, independently of dialogue, and pauses with the tab.
  paused = document.visibilityState === "hidden";
  if (paused) figure.classList.add("is-paused");
  document.addEventListener("visibilitychange", onVisibilityChange);
  if (motionQuery?.addEventListener) {
    motionQuery.addEventListener("change", onMotionChange);
  }
  if (!paused) scheduleBlink();
  window.addEventListener("resize", scheduleDockResize);

  const stopLocale = onLocaleChange(refresh);

  return {
    showLine,
    showDialog,
    dockBeside,
    leaveDock,
    enterIntro,
    exitIntro,
    cancelIntro,
    say,
    react,
    setUneasy,
    hide,
    endTutorial,
    isTutorial: () => tutorial,
    isSpeaking: () => speaking,
    destroy() {
      endTutorial();
      if (hideTimer !== null) clearTimeout(hideTimer);
      if (docked) {
        docked = false;
        dockTarget = null;
        dockTargetBounds = null;
        dockNear = false;
        stopDockWatch();
        figure.classList.remove("is-watching");
        setDockOffset(0, 0, 0);
      }
      dock.classList.remove("is-docked", "is-bubble-left", "is-bubble-right", "is-bubble-up");
      bubble.style.removeProperty("width");
      root.classList.remove("is-docked");
      window.removeEventListener("resize", scheduleDockResize);
      lowerDialogue();
      if (sceneState !== "dock") cancelIntro("destroy");
      stopBlinking();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (motionQuery?.removeEventListener) {
        motionQuery.removeEventListener("change", onMotionChange);
      }
      stopLocale();
      dock.remove();
    },
  };
}
