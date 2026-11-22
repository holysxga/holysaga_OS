/**
 * OUTSIDER.EXE — first-person movement, collision, focus and lifecycle.
 *
 * The engine only exists while the maze is running. Closing the app destroys
 * the RAF loop, the WebGL context resources, pointer lock and the private
 * audio element. A blur pauses rather than restarts, so the soundtrack keeps
 * its position across a temporary focus loss.
 */
import { EYE_HEIGHT, LEVEL, START, DOOR } from "./level.js";
import { createMazeRenderer } from "./renderer.js";
import { createMazeAudio, AUDIO_DEFAULTS } from "./audio.js";

const PLAYER_RADIUS = 0.32;
const WALK_SPEED = 2.05;
const LOOK_SENSITIVITY = 0.0022;
const MAX_PITCH = 1.18;
const STEP_DISTANCE = 1.02;
/*
 * Camera input is relative only, and one event may never move the view more
 * than this. A pointer that is re-seated, a synthetic jump or a move emitted
 * while the lock is being (re)acquired is a huge delta; those were the source
 * of the sudden half-turns. Clamping the step makes such an event harmless.
 */
const LOOK_MAX_STEP = 110;

function keyDirection(code) {
  switch (code) {
    case "KeyW":
    case "ArrowUp":
      return [0, -1];
    case "KeyS":
    case "ArrowDown":
      return [0, 1];
    case "KeyA":
    case "ArrowLeft":
      return [-1, 0];
    case "KeyD":
    case "ArrowRight":
      return [1, 0];
    default:
      return null;
  }
}

export function createMazeEngine(options = {}) {
  const canvas = options.canvas;
  const onComplete = typeof options.onComplete === "function" ? options.onComplete : () => {};
  const onPause = typeof options.onPause === "function" ? options.onPause : () => {};
  const onResume = typeof options.onResume === "function" ? options.onResume : () => {};
  const onAudio = typeof options.onAudio === "function" ? options.onAudio : () => {};
  const onError = typeof options.onError === "function" ? options.onError : () => {};

  const camera = {
    x: START.x,
    y: EYE_HEIGHT,
    z: START.z,
    yaw: START.yaw,
    pitch: 0,
  };

  let renderer = null;
  let audio = null;
  let bgmSetting = AUDIO_DEFAULTS.bgm;
  let sfxSetting = AUDIO_DEFAULTS.sfx;
  let running = false;
  let paused = false;
  let completed = false;
  let destroyed = false;
  let raf = 0;
  let lastFrame = 0;
  let stepDistance = 0;
  let bobPhase = 0;
  /* Set when the lock is acquired or lost: the next movement is never applied. */
  let ignoreNextMove = true;
  let lockUnavailable = false;
  const keys = new Set();

  function ensureAudio() {
    if (audio || destroyed) return audio;
    audio = createMazeAudio({ onState: onAudio });
    audio.setBgmVolume(bgmSetting);
    audio.setSfxVolume(sfxSetting);
    return audio;
  }

  function hits(x, z) {
    for (const collider of LEVEL.colliders) {
      const nx = Math.max(collider.x1, Math.min(x, collider.x2));
      const nz = Math.max(collider.z1, Math.min(z, collider.z2));
      const dx = x - nx;
      const dz = z - nz;
      if (dx * dx + dz * dz < PLAYER_RADIUS * PLAYER_RADIUS) return true;
    }
    return false;
  }

  /**
   * Ask the browser for the pointer. Must be called from a user gesture; if it
   * is refused the game pauses and the overlay asks for a click inside.
   */
  function requestLock() {
    if (!canvas || typeof canvas.requestPointerLock !== "function") {
      lockUnavailable = true;
      if (running && !paused && !completed) pause("lock");
      return;
    }
    if (document.pointerLockElement === canvas) return;
    let result;
    try {
      result = canvas.requestPointerLock();
    } catch {
      lockUnavailable = true;
      if (running && !paused && !completed) pause("lock");
      return;
    }
    if (result && typeof result.catch === "function") {
      result.catch(() => {
        lockUnavailable = true;
        if (running && !paused && !completed) pause("lock");
      });
    }
  }

  function releaseLock() {
    if (document.pointerLockElement === canvas) {
      document.exitPointerLock?.();
    }
  }

  function updateLook(dx, dy) {
    camera.yaw += dx * LOOK_SENSITIVITY;
    camera.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, camera.pitch - dy * LOOK_SENSITIVITY));
  }

  function onPointerLockChange() {
    if (destroyed) return;
    // Whatever happened, the old movement baseline is gone.
    ignoreNextMove = true;
    keys.clear();
    if (document.pointerLockElement === canvas) {
      lockUnavailable = false;
      return;
    }
    if (running && !paused && !completed) pause("pointer");
  }

  function onPointerLockError() {
    ignoreNextMove = true;
    lockUnavailable = true;
    if (running && !paused && !completed) pause("lock");
  }

  /**
   * Relative look only. Without the lock there is no camera input at all: the
   * old absolute-coordinate fallback is what let the pointer leave the window
   * and snap the view around when it came back.
   */
  function onMouseMove(event) {
    if (destroyed || paused || completed) return;
    if (document.pointerLockElement !== canvas) return;
    const rawX = Number(event.movementX) || 0;
    const rawY = Number(event.movementY) || 0;
    // A lock transition can emit an empty event first; it must not use up the
    // guard, otherwise the first real movement after re-acquiring is applied.
    if (!rawX && !rawY) return;
    if (ignoreNextMove) {
      ignoreNextMove = false;
      return;
    }
    const dx = Math.max(-LOOK_MAX_STEP, Math.min(LOOK_MAX_STEP, rawX));
    const dy = Math.max(-LOOK_MAX_STEP, Math.min(LOOK_MAX_STEP, rawY));
    if (!dx && !dy) return;
    updateLook(dx, dy);
  }

  function onPointerDown(event) {
    if (!running || paused || completed) return;
    if (event.target !== canvas) return;
    ensureAudio()?.resume();
    if (document.pointerLockElement !== canvas) requestLock();
  }

  function onKeyDown(event) {
    if (!running || paused || completed) return;
    const tag = event.target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (event.code === "Escape") {
      pause("escape");
      return;
    }
    if (!keyDirection(event.code)) return;
    event.preventDefault();
    keys.add(event.code);
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onWindowBlur() {
    if (running && !paused && !completed) pause("blur");
  }

  function onVisibility() {
    if (document.hidden && running && !paused && !completed) pause("hidden");
  }

  function onCanvasClick() {
    if (!running || completed) return;
    ensureAudio()?.resume();
    if (paused) resume();
    else requestLock();
  }

  function addListeners() {
    document.addEventListener("pointerlockchange", onPointerLockChange);
    document.addEventListener("pointerlockerror", onPointerLockError);
    document.addEventListener("mousemove", onMouseMove);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onWindowBlur);
    document.addEventListener("visibilitychange", onVisibility);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("click", onCanvasClick);
  }

  function removeListeners() {
    document.removeEventListener("pointerlockchange", onPointerLockChange);
    document.removeEventListener("pointerlockerror", onPointerLockError);
    document.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onWindowBlur);
    document.removeEventListener("visibilitychange", onVisibility);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("click", onCanvasClick);
  }

  function clampCamera() {
    // Redundant safety against a malformed save or a runaway pointer event.
    if (hits(camera.x, camera.z)) {
      camera.x = START.x;
      camera.z = START.z;
    }
  }

  function update(dt) {
    let forward = 0;
    let strafe = 0;
    for (const code of keys) {
      const dir = keyDirection(code);
      if (!dir) continue;
      forward += dir[1];
      strafe += dir[0];
    }
    if (forward || strafe) {
      const length = Math.hypot(forward, strafe) || 1;
      forward /= length;
      strafe /= length;
      const sin = Math.sin(camera.yaw);
      const cos = Math.cos(camera.yaw);
      // forward = (sin yaw, -cos yaw); right = (cos yaw, sin yaw)
      const dx = (sin * -forward + cos * strafe) * WALK_SPEED * dt;
      const dz = (-cos * -forward + sin * strafe) * WALK_SPEED * dt;
      const startX = camera.x;
      const startZ = camera.z;

      if (!hits(camera.x + dx, camera.z)) camera.x += dx;
      if (!hits(camera.x, camera.z + dz)) camera.z += dz;

      const moved = Math.hypot(camera.x - startX, camera.z - startZ);
      stepDistance += moved;
      bobPhase += moved * 5.6;
      if (stepDistance >= STEP_DISTANCE) {
        stepDistance %= STEP_DISTANCE;
        audio?.step();
      }
      camera.y = EYE_HEIGHT + Math.sin(bobPhase) * 0.026;
    } else {
      camera.y += (EYE_HEIGHT - camera.y) * Math.min(1, dt * 8);
    }

    clampCamera();

    if (
      camera.z >= DOOR.triggerZ &&
      Math.abs(camera.x - DOOR.x) <= DOOR.halfWidth
    ) {
      complete();
    }
  }

  function frame(now) {
    if (!running || paused || completed || destroyed) return;
    const dt = Math.min(0.06, lastFrame ? (now - lastFrame) / 1000 : 0.016);
    lastFrame = now;
    update(dt);
    renderer?.render(camera, now / 1000);
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (destroyed || running) return;
    try {
      renderer = createMazeRenderer(canvas, LEVEL);
    } catch (error) {
      console.error("[outsider] renderer failed", error);
      onError(error);
      return;
    }
    running = true;
    paused = false;
    completed = false;
    camera.x = START.x;
    camera.z = START.z;
    camera.y = EYE_HEIGHT;
    camera.yaw = START.yaw;
    camera.pitch = 0;
    ensureAudio();
    audio.begin({ restart: true });
    addListeners();
    requestLock();
    lastFrame = 0;
    renderer.resize();
    raf = requestAnimationFrame(frame);
  }

  function pause(reason = "manual") {
    if (!running || paused || completed || destroyed) return;
    paused = true;
    keys.clear();
    ignoreNextMove = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    releaseLock();
    audio?.suspend();
    onPause({ reason });
  }

  function resume() {
    if (!running || completed || destroyed) return;
    paused = false;
    ignoreNextMove = true;
    audio?.resume();
    requestLock();
    lastFrame = 0;
    onResume();
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function setVolumes({ bgm, sfx }) {
    if (Number.isFinite(bgm)) bgmSetting = bgm;
    if (Number.isFinite(sfx)) sfxSetting = sfx;
    audio?.setBgmVolume(bgmSetting);
    audio?.setSfxVolume(sfxSetting);
  }

  function complete() {
    if (completed || destroyed) return;
    completed = true;
    paused = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    keys.clear();
    releaseLock();
    audio?.doorTone();
    audio?.finish();
    onComplete();
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    running = false;
    paused = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    removeListeners();
    releaseLock();
    audio?.destroy();
    renderer?.destroy();
    audio = null;
    renderer = null;
  }

  /** Development-only inspection hook (enabled by the app's debug query). */
  function debugSetCamera(x, z, yaw = camera.yaw, pitch = 0) {
    camera.x = x;
    camera.z = z;
    camera.yaw = yaw;
    camera.pitch = pitch;
    renderer?.render(camera, performance.now() / 1000);
  }

  return {
    start,
    pause,
    resume,
    destroy,
    setVolumes,
    getState: () => ({
      running,
      paused,
      completed,
      locked: document.pointerLockElement === canvas,
      lockUnavailable,
      camera: { ...camera },
    }),
    isRunning: () => running,
    debugSetCamera,
  };
}
