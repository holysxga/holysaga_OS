/**
 * OUTSIDER.EXE — the existing desktop game, now complete.
 *
 * The shortcut, icon, registry entry and window are unchanged. This module
 * hosts the fixed Poolrooms maze, the private soundtrack, and the two rewards
 * that belong to the rest of HOLYSAGA:
 *   - completion records `outsider-maze-complete` and leaves OUTSIDER.wav on
 *     the desktop (never auto-collected);
 *   - the shared listening tracker marks the full track understood at 70%,
 *     and js/core/outsider.js delivers M.I.L.O.'s reflection once.
 *
 * The downsampled maze version is never handed to MUSIC PLAYER and never
 * touches listening progress.
 */
import { el, clear } from "../core/dom.js";
import { t, onLocaleChange } from "../i18n/index.js";
import { progression } from "../core/progression.js";
import { readPref, writePref } from "../core/storage.js";
import { createMazeEngine } from "./outsider/engine.js";
import { createTouchControls } from "./outsider/touch.js";
import { AUDIO_DEFAULTS } from "./outsider/audio.js";
import { isCoarsePointer } from "../core/input.js";

const TRACK_ID = "outsider";
const FILE_ID = "outsider-wav";
const COMPLETE_EVENT = "outsider-maze-complete";
const INTRO_TUTORIAL = "outsider-intro";
const COMPLETE_TUTORIAL = "outsider-complete-dialogue";
const BGM_PREF = "outsider.bgm-volume";
const SFX_PREF = "outsider.sfx-volume";

function numericPref(key, fallback) {
  const value = readPref(key, fallback);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : fallback;
}

export const outsiderApp = {
  id: "outsider",
  titleKey: "app.outsider.title",
  icon: "assets/icons/maze.svg",
  size: { w: 960, h: 640 },

  mount(body, ctx = {}) {
    const store = progression;
    const mascot = ctx.mascot || null;
    const files = ctx.files || null;
    const root = el("div", { class: "app app--outsider" });
    const state = {
      screen: "launcher",
      audio: "idle",
      audioDetail: "",
      completed: store.hasEvent(COMPLETE_EVENT),
      lastPause: "manual",
    };
    let engine = null;
    let controls = null;
    let bgm = numericPref(BGM_PREF, AUDIO_DEFAULTS.bgm);
    let sfx = numericPref(SFX_PREF, AUDIO_DEFAULTS.sfx);
    let destroyed = false;
    const timers = new Set();

    const after = (ms, handler) => {
      const id = setTimeout(() => {
        timers.delete(id);
        if (!destroyed) handler();
      }, ms);
      timers.add(id);
      return id;
    };

    const clearTimers = () => {
      for (const id of timers) clearTimeout(id);
      timers.clear();
    };

    /* ------------------------------------------------------------- markup */

    const launcher = el("section", { class: "outsider__launcher" });
    const game = el("section", { class: "outsider__game", hidden: true });
    const stage = el("div", { class: "outsider__stage" }, [launcher, game]);

    const status = el("div", {
      class: "statusbar__cell statusbar__cell--grow sunken",
      text: t("outsider.status"),
      role: "status",
    });
    const mixerState = el("p", {
      class: "outsider__mixer-state",
      role: "status",
      "aria-live": "polite",
      text: t("outsider.soundIdle"),
    });

    const bgmLabel = el("label", {
      class: "outsider__mixer-label",
      for: "outsider-bgm",
      text: t("outsider.bgm"),
    });
    const sfxLabel = el("label", {
      class: "outsider__mixer-label",
      for: "outsider-sfx",
      text: t("outsider.sfx"),
    });
    const bgmInput = el("input", {
      class: "outsider__slider",
      id: "outsider-bgm",
      type: "range",
      min: "0",
      max: "100",
      step: "1",
      value: String(Math.round(bgm * 100)),
      "aria-label": t("outsider.bgm"),
    });
    const sfxInput = el("input", {
      class: "outsider__slider",
      id: "outsider-sfx",
      type: "range",
      min: "0",
      max: "100",
      step: "1",
      value: String(Math.round(sfx * 100)),
      "aria-label": t("outsider.sfx"),
    });
    const bgmValue = el("span", { class: "outsider__mixer-value", text: `${Math.round(bgm * 100)}%` });
    const sfxValue = el("span", { class: "outsider__mixer-value", text: `${Math.round(sfx * 100)}%` });

    const mixer = el("div", { class: "outsider__mixer", "aria-label": t("outsider.audio") }, [
      el("div", { class: "outsider__mixer-control" }, [
        bgmLabel,
        el("div", { class: "outsider__mixer-row" }, [bgmInput, bgmValue]),
      ]),
      el("div", { class: "outsider__mixer-control" }, [
        sfxLabel,
        el("div", { class: "outsider__mixer-row" }, [sfxInput, sfxValue]),
      ]),
      mixerState,
    ]);

    const applyVolume = () => {
      bgmInput.value = String(Math.round(bgm * 100));
      sfxInput.value = String(Math.round(sfx * 100));
      bgmValue.textContent = `${Math.round(bgm * 100)}%`;
      sfxValue.textContent = `${Math.round(sfx * 100)}%`;
      engine?.setVolumes({ bgm, sfx });
    };

    bgmInput.addEventListener("input", () => {
      bgm = Number(bgmInput.value) / 100;
      writePref(BGM_PREF, bgm);
      applyVolume();
    });
    sfxInput.addEventListener("input", () => {
      sfx = Number(sfxInput.value) / 100;
      writePref(SFX_PREF, sfx);
      applyVolume();
    });

    /* ------------------------------------------------------------ launcher */

    function ensureFile() {
      if (store.hasTrack(TRACK_ID)) return null;
      return files?.addFile?.({
        id: FILE_ID,
        trackId: TRACK_ID,
        nameKey: "outsider.file.name",
      }) || null;
    }

    function renderLauncher() {
      clear(launcher);
      const startButton = el("button", {
        class: "outsider__start raised",
        type: "button",
        text: t("outsider.start"),
        on: {
          click: () => {
            void beginGame();
          },
        },
      });
      const specs = [
        ["outsider.specMode", "outsider.specModeValue"],
        ["outsider.specEngine", "outsider.specEngineValue"],
        ["outsider.specUnlock", "outsider.specUnlockValue"],
      ];
      launcher.append(
        el("div", { class: "outsider__screen" }, [
          el("div", { class: "outsider__intro" }, [
            el("p", { class: "outsider__kicker", text: t("outsider.tagline") }),
            el("h3", { class: "outsider__title", text: t("outsider.title") }),
            el("p", { class: "outsider__desc", text: t("outsider.description") }),
          ]),
          el("div", { class: "outsider__columns" }, [
            el("div", { class: "outsider__panel" }, [
              el("p", { class: "outsider__label", text: t("outsider.specsTitle") }),
              el(
                "dl",
                { class: "outsider__specs" },
                specs.flatMap(([labelKey, valueKey]) => [
                  el("dt", { text: t(labelKey) }),
                  el("dd", { text: t(valueKey) }),
                ]),
              ),
            ]),
            el("div", { class: "outsider__panel" }, [
              el("p", { class: "outsider__label", text: t("outsider.controlsTitle") }),
              el(
                "ul",
                { class: "outsider__controls" },
                touchMode
                  ? [
                      el("li", { text: t("outsider.touchMove") }),
                      el("li", { text: t("outsider.touchLook") }),
                      el("li", { text: t("outsider.pauseButton") }),
                      el("li", { text: t("outsider.controlExit") }),
                    ]
                  : [
                      el("li", { text: t("outsider.controlMove") }),
                      el("li", { text: t("outsider.controlLook") }),
                      el("li", { text: t("outsider.controlPause") }),
                      el("li", { text: t("outsider.controlExit") }),
                    ],
              ),
            ]),
          ]),
          state.completed
            ? el("p", { class: "outsider__escaped-note", text: t("outsider.escapedNote") })
            : null,
          el("div", { class: "outsider__actions" }, [
            startButton,
            el("p", { class: "outsider__start-hint", text: t("outsider.startHint") }),
          ]),
        ]),
      );
    }

    /* ---------------------------------------------------------------- game */

    const canvas = el("canvas", {
      class: "outsider__canvas",
      tabindex: "0",
      "aria-label": t("outsider.canvasLabel"),
    });
    const hudKicker = el("p", { class: "outsider__hud-kicker", text: "OUTSIDER.EXE" });
    const hudHint = el("p", { class: "outsider__hud-hint", text: t("outsider.hint") });
    const crosshair = el("div", { class: "outsider__crosshair", "aria-hidden": "true" });
    const audioBadge = el("p", { class: "outsider__audio-badge", "aria-live": "polite" });

    const pauseTitle = el("h4", { class: "outsider__overlay-title", text: t("outsider.pauseTitle") });
    const pauseBody = el("p", { class: "outsider__overlay-body", text: t("outsider.pauseBody") });
    const resumeButton = el("button", {
      class: "outsider__overlay-button raised",
      type: "button",
      text: t("outsider.resume"),
      on: {
        click: () => {
          if (!engine) return;
          hidePause();
          engine.resume();
        },
      },
    });
    const pauseOverlay = el(
      "div",
      { class: "outsider__overlay outsider__overlay--pause", hidden: true },
      [
        el("div", { class: "outsider__overlay-card" }, [
          el("p", { class: "outsider__overlay-kicker", text: t("outsider.statusPaused") }),
          pauseTitle,
          pauseBody,
          resumeButton,
        ]),
      ],
    );

    const completeTitle = el("h4", { class: "outsider__overlay-title", text: t("outsider.completeTitle") });
    const completeBody = el("p", { class: "outsider__overlay-body", text: t("outsider.completeBody") });
    const completeButton = el("button", {
      class: "outsider__overlay-button raised",
      type: "button",
      text: t("outsider.completeClose"),
      on: {
        click: () => {
          ctx.close?.();
        },
      },
    });
    const completeOverlay = el(
      "div",
      { class: "outsider__overlay outsider__overlay--complete", hidden: true },
      [
        el("div", { class: "outsider__overlay-card" }, [
          el("p", { class: "outsider__overlay-kicker", text: "OUTSIDER.EXE" }),
          completeTitle,
          completeBody,
          completeButton,
        ]),
      ],
    );

    const gameHud = el("div", { class: "outsider__hud" }, [hudKicker, hudHint, audioBadge, crosshair]);
    game.append(canvas, gameHud, pauseOverlay, completeOverlay);

    /* ------------------------------------------------------- touch surface */

    // Touch play is chosen by capability, never by viewport width: a desktop
    // window can be narrow and still have a mouse. A browser that cannot lock
    // the pointer needs the on-screen controls too, otherwise the maze would
    // pause on its first click and stay paused.
    const touchMode =
      isCoarsePointer() || typeof canvas.requestPointerLock !== "function";

    if (touchMode) {
      controls = createTouchControls({
        onMove: (x, y) => engine?.setMoveVector(x, y),
        onLook: (dx, dy) => engine?.lookBy(dx, dy),
        onPause: () => engine?.pause("touch"),
      });
      game.append(controls.root);
    }

    const hintText = () =>
      t(touchMode ? "outsider.touchHint" : "outsider.hint");
    hudHint.textContent = hintText();

    /* -------------------------------------------------------------- status */

    function setStatus(key) {
      status.textContent = t(key);
      status.dataset.key = key;
    }

    function setAudioState(next, detail = "") {
      state.audio = next;
      state.audioDetail = detail;
      let key = "outsider.soundIdle";
      let tone = "";
      if (next === "loading") key = "outsider.soundLoading";
      else if (next === "playing" || next === "ready") key = "outsider.soundReady";
      else if (next === "paused") key = "outsider.soundPaused";
      else if (next === "blocked") {
        key = "outsider.soundBlocked";
        tone = "warn";
      } else if (next === "error") {
        key = "outsider.soundError";
        tone = "error";
      } else if (next === "stopped") key = "outsider.soundStopped";
      else if (next === "off") key = "outsider.soundStopped";
      mixerState.textContent = t(key);
      mixerState.dataset.tone = tone;
      audioBadge.textContent = next === "error" ? t("outsider.audioMissing") : t(key);
      audioBadge.dataset.tone = tone;
      audioBadge.hidden = next === "playing" || next === "ready" || next === "stopped" || next === "off";
    }

    /** The mouse leaving the game asks for a click, not for a manual pause. */
    function pauseBodyKey() {
      return state.lastPause === "pointer" || state.lastPause === "lock"
        ? "outsider.pointerHint"
        : "outsider.pauseBody";
    }

    function showPause(reason) {
      if (state.screen === "complete") return;
      // A pause releases every held direction, stick included.
      controls?.release();
      state.screen = "paused";
      state.lastPause = reason;
      pauseOverlay.hidden = false;
      pauseBody.textContent = t(pauseBodyKey());
      setStatus("outsider.statusPaused");
    }

    function hidePause() {
      pauseOverlay.hidden = true;
      if (state.screen === "paused") state.screen = "playing";
      setStatus("outsider.statusPlaying");
    }

    function closeIntro() {
      // A modal from another program can already own M.I.L.O.; retry quietly.
      if (destroyed || store.hasSeenTutorial(INTRO_TUTORIAL)) return;
      const shown = mascot?.showLine?.({
        key: "mascot.outsider.intro",
        tone: "event",
        holdMs: 28_000,
      });
      if (shown) {
        store.markTutorialShown(INTRO_TUTORIAL);
        return;
      }
      after(2_400, closeIntro);
    }

    let completionTry = 0;
    function announceCompletion() {
      if (destroyed || store.hasSeenTutorial(COMPLETE_TUTORIAL)) return;
      const shown = mascot?.showLine?.({
        key: "mascot.outsider.complete",
        tone: "event",
        holdMs: 32_000,
      });
      completionTry += 1;
      if (shown) {
        store.markTutorialShown(COMPLETE_TUTORIAL);
        return;
      }
      if (completionTry < 10) after(2_000, announceCompletion);
    }

    function finishSequence() {
      if (state.screen === "complete") return;
      state.screen = "complete";
      state.completed = true;
      controls?.release();
      hidePause();
      pauseOverlay.hidden = true;
      completeOverlay.hidden = false;
      setStatus("outsider.statusComplete");
      setAudioState("stopped");

      const first = !store.hasEvent(COMPLETE_EVENT);
      if (first) {
        store.completeEvent(COMPLETE_EVENT);
        ensureFile();
        announceCompletion();
      } else if (!store.hasTrack(TRACK_ID)) {
        // Repair path after an interrupted first completion: no new file,
        // no repeated dialogue, just put the missing reward back.
        ensureFile();
      }
    }

    function showRenderError(message) {
      state.screen = "error";
      pauseOverlay.hidden = true;
      completeOverlay.hidden = true;
      const card = el("div", { class: "outsider__overlay-card" }, [
        el("p", { class: "outsider__overlay-kicker", text: "OUTSIDER.EXE" }),
        el("h4", { class: "outsider__overlay-title", text: t("outsider.mazeError") }),
        el("p", { class: "outsider__overlay-body", text: message || t("outsider.mazeErrorBody") }),
        el("button", {
          class: "outsider__overlay-button raised",
          type: "button",
          text: t("outsider.completeClose"),
          on: { click: () => ctx.close?.() },
        }),
      ]);
      const overlay = el("div", { class: "outsider__overlay outsider__overlay--complete" }, [card]);
      game.append(overlay);
      setStatus("outsider.statusError");
    }

    function makeEngine() {
      engine = createMazeEngine({
        canvas,
        touchMode,
        onComplete: finishSequence,
        onPause: ({ reason }) => showPause(reason),
        onResume: () => {
          hidePause();
        },
        onAudio: ({ state: audioState, detail }) => setAudioState(audioState, detail),
        onError: (error) => showRenderError(error?.message),
      });
      engine.setVolumes({ bgm, sfx });
      engine.setTouchMode(touchMode);
      const debug = new URLSearchParams(window.location.search).has("outsiderDebug");
      if (debug) window.__OUTSIDER__ = { engine };
    }

    async function beginGame() {
      if (destroyed || state.screen === "playing") return;
      state.screen = "playing";
      launcher.hidden = true;
      game.hidden = false;
      pauseOverlay.hidden = true;
      completeOverlay.hidden = true;
      setStatus("outsider.statusPlaying");
      if (!store.hasSeenTutorial(INTRO_TUTORIAL)) {
        after(900, closeIntro);
      }
      if (!engine) makeEngine();
      if (!engine) return;
      engine.start();
      // If audio was already blocked once, a click inside the canvas retries it.
      canvas.focus({ preventScroll: true });
      applyVolume();
    }

    /* -------------------------------------------------------------- wiring */

    root.append(stage, mixer, el("div", { class: "statusbar" }, [status]));
    body.append(root);
    renderLauncher();
    if (state.completed) setStatus("outsider.statusComplete");

    // A completed program still opens; the reward is restored only if it is
    // missing, never added a second time after the fragment is collected.
    if (state.completed && !store.hasTrack(TRACK_ID)) ensureFile();
    if (state.completed && !store.hasSeenTutorial(COMPLETE_TUTORIAL)) {
      completionTry = 0;
      after(1_200, announceCompletion);
    }

    // The intro belongs to opening the program, not to pressing START.
    after(850, closeIntro);

    const stopLocale = onLocaleChange(() => {
      renderLauncher();
      hudKicker.textContent = "OUTSIDER.EXE";
      hudHint.textContent = hintText();
      controls?.refreshLabels();
      canvas.setAttribute("aria-label", t("outsider.canvasLabel"));
      mixer.setAttribute("aria-label", t("outsider.audio"));
      bgmLabel.textContent = t("outsider.bgm");
      sfxLabel.textContent = t("outsider.sfx");
      bgmInput.setAttribute("aria-label", t("outsider.bgm"));
      sfxInput.setAttribute("aria-label", t("outsider.sfx"));
      pauseTitle.textContent = t("outsider.pauseTitle");
      pauseBody.textContent = t(pauseBodyKey());
      resumeButton.textContent = t("outsider.resume");
      completeTitle.textContent = t("outsider.completeTitle");
      completeBody.textContent = t("outsider.completeBody");
      completeButton.textContent = t("outsider.completeClose");
      // Re-apply the current state, not a stale translated string.
      if (state.screen === "paused") setStatus("outsider.statusPaused");
      else if (state.screen === "complete") setStatus("outsider.statusComplete");
      else if (state.screen === "playing") setStatus("outsider.statusPlaying");
      else setStatus(state.completed ? "outsider.statusComplete" : "outsider.status");
      setAudioState(state.audio, state.audioDetail);
    });

    return () => {
      destroyed = true;
      clearTimers();
      stopLocale();
      controls?.destroy();
      controls = null;
      engine?.destroy();
      engine = null;
      if (window.__OUTSIDER__) delete window.__OUTSIDER__;
    };
  },
};
