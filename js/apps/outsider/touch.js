/**
 * OUTSIDER.EXE — on-screen controls for touch screens.
 *
 * Two independent pointers share the game viewport:
 *   - the stick in the lower left drives movement, continuously, for as long
 *     as it is held away from its neutral position;
 *   - the right half of the view is a look pad: finger travel turns the view.
 *
 * Each gesture tracks its own pointer id and captures its own pointer, so a
 * thumb on the stick and a thumb on the look pad work at the same time. Nothing
 * here is attached to the document: a touch that starts outside the viewport,
 * on the pause button or on the HUD is never captured by the game.
 *
 * The control surface is touch-only and does not exist for mouse players; the
 * maze's desktop input lives entirely in engine.js.
 */
import { el } from "../../core/dom.js";
import { t } from "../../i18n/index.js";

/* Fraction of the stick radius that is treated as "no movement". */
const DEAD_ZONE = 0.16;
/* Knob travel in CSS px; the CSS keeps the base at twice this value. */
const TRAVEL = 46;

export function createTouchControls(options = {}) {
  const onMove = typeof options.onMove === "function" ? options.onMove : () => {};
  const onLook = typeof options.onLook === "function" ? options.onLook : () => {};
  const onPause = typeof options.onPause === "function" ? options.onPause : () => {};

  const knob = el("span", { class: "outsider__stick-knob", "aria-hidden": "true" });
  const stick = el(
    "div",
    {
      class: "outsider__stick",
      role: "application",
      "aria-label": t("outsider.touchMove"),
    },
    [
      el("span", { class: "outsider__stick-ring", "aria-hidden": "true" }),
      knob,
    ],
  );

  const look = el("div", {
    class: "outsider__look",
    role: "application",
    "aria-label": t("outsider.touchLook"),
  });

  const pauseButton = el(
    "button",
    {
      class: "outsider__touch-pause raised",
      type: "button",
      text: "❙❙",
      "aria-label": t("outsider.pauseButton"),
    },
    [],
  );

  const hint = el("p", { class: "outsider__touch-hint", text: t("outsider.touchHint") });
  const rotate = el("p", { class: "outsider__rotate", text: t("outsider.rotateHint") });

  const root = el("div", { class: "outsider__touch" }, [look, stick, pauseButton, hint, rotate]);

  let stickPointer = null;
  let lookPointer = null;

  /* ------------------------------------------------------------------ stick */

  function placeKnob(dx, dy) {
    const distance = Math.hypot(dx, dy);
    const scale = distance > TRAVEL ? TRAVEL / distance : 1;
    knob.style.transform = `translate(${Math.round(dx * scale)}px, ${Math.round(
      dy * scale,
    )}px)`;
  }

  function applyStick(event) {
    const rect = stick.getBoundingClientRect();
    if (rect.width < 1) return;
    const centreX = rect.left + rect.width / 2;
    const centreY = rect.top + rect.height / 2;
    const radiusX = rect.width / 2;
    const radiusY = rect.height / 2;
    let dx = event.clientX - centreX;
    let dy = event.clientY - centreY;
    const distance = Math.hypot(dx, dy);
    const limit = Math.min(radiusX, radiusY);
    if (distance > limit) {
      dx = (dx / distance) * limit;
      dy = (dy / distance) * limit;
    }
    placeKnob(dx, dy);
    // Screen down is +dy; the engine takes the keyboard's convention, where a
    // forward push is negative (W walks along -z at yaw 0).
    const strafe = limit > 0 ? dx / limit : 0;
    const forward = limit > 0 ? dy / limit : 0;
    const strength = Math.hypot(strafe, forward);
    if (strength < DEAD_ZONE) {
      onMove(0, 0);
      return;
    }
    // Rescale so leaving the dead zone starts from zero, not from a jolt.
    const scaled = (strength - DEAD_ZONE) / (1 - DEAD_ZONE);
    onMove((strafe / strength) * scaled, (forward / strength) * scaled);
  }

  function releaseStick() {
    stickPointer = null;
    knob.style.transform = "";
    onMove(0, 0);
  }

  stick.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;
    event.preventDefault();
    stickPointer = event.pointerId;
    try {
      stick.setPointerCapture(event.pointerId);
    } catch {
      /* capture is a nicety; the pad also follows the finger */
    }
    applyStick(event);
  });

  stick.addEventListener("pointermove", (event) => {
    if (event.pointerId !== stickPointer) return;
    event.preventDefault();
    applyStick(event);
  });

  const endStick = (event) => {
    if (event.pointerId !== stickPointer) return;
    try {
      stick.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    releaseStick();
  };
  stick.addEventListener("pointerup", endStick);
  stick.addEventListener("pointercancel", endStick);
  stick.addEventListener("lostpointercapture", endStick);

  /* ------------------------------------------------------------------- look */

  let lastLookX = 0;
  let lastLookY = 0;

  look.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;
    if (lookPointer !== null) return;
    event.preventDefault();
    lookPointer = event.pointerId;
    lastLookX = event.clientX;
    lastLookY = event.clientY;
    try {
      look.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
  });

  look.addEventListener("pointermove", (event) => {
    if (event.pointerId !== lookPointer) return;
    event.preventDefault();
    const dx = event.clientX - lastLookX;
    const dy = event.clientY - lastLookY;
    lastLookX = event.clientX;
    lastLookY = event.clientY;
    if (!dx && !dy) return;
    onLook(dx, dy);
  });

  const endLook = (event) => {
    if (event.pointerId !== lookPointer) return;
    lookPointer = null;
    try {
      look.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
  };
  look.addEventListener("pointerup", endLook);
  look.addEventListener("pointercancel", endLook);
  look.addEventListener("lostpointercapture", endLook);

  /* ------------------------------------------------------------------ pause */

  pauseButton.addEventListener("click", (event) => {
    event.stopPropagation();
    release();
    onPause();
  });

  /* A game that leaves the screen must never keep a held direction. */
  const onWindowBlur = () => release();
  const onVisibility = () => {
    if (document.hidden) release();
  };
  window.addEventListener("blur", onWindowBlur);
  document.addEventListener("visibilitychange", onVisibility);

  function release() {
    if (stickPointer !== null) {
      try {
        stick.releasePointerCapture(stickPointer);
      } catch {
        /* ignore */
      }
    }
    if (lookPointer !== null) {
      try {
        look.releasePointerCapture(lookPointer);
      } catch {
        /* ignore */
      }
    }
    lookPointer = null;
    releaseStick();
  }

  function refreshLabels() {
    stick.setAttribute("aria-label", t("outsider.touchMove"));
    look.setAttribute("aria-label", t("outsider.touchLook"));
    pauseButton.setAttribute("aria-label", t("outsider.pauseButton"));
    hint.textContent = t("outsider.touchHint");
    rotate.textContent = t("outsider.rotateHint");
  }

  return {
    root,
    release,
    refreshLabels,
    destroy() {
      release();
      window.removeEventListener("blur", onWindowBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      root.remove();
    },
  };
}
