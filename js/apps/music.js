/**
 * MUSIC PLAYER
 *
 * A data-driven collection: the six known tracks come from js/data/music.js,
 * lock state comes from the shared progression store, and playback belongs to
 * js/core/player.js. The window only renders and forwards actions, so closing
 * it never stops audio.
 *
 * The same store holds unique listening coverage. A collected track starts
 * desaturated and only turns antique gold once its `understandAt` share of the
 * track has genuinely been heard; paused time, seeks and replays never fake
 * that coverage. The waveform is computed from the real file by
 * js/core/waveform.js and falls back to the plain bar when it cannot be read.
 */
import { el, clear } from "../core/dom.js";
import { t, onLocaleChange } from "../i18n/index.js";
import { tracks } from "../data/music.js";
import { progression } from "../core/progression.js";
import { player } from "../core/player.js";
import { loadWaveform } from "../core/waveform.js";
import { isCoarsePointer } from "../core/input.js";
import { visualizerApp } from "./visualizer.js";

const STATE_KEYS = {
  playing: "music.statePlaying",
  paused: "music.statePaused",
  ready: "music.stateReady",
  unavailable: "music.stateUnavailable",
  error: "music.stateError",
};

const SEEK_STEP = 5;

/** Track names stay in their own casing; the artist is always uppercase. */
const trackLabel = (track) =>
  track ? `${track.artist || "HOLYSAGA"} — ${track.title}` : "";

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "--:--";
  const total = Math.floor(seconds);
  const minutes = String(Math.floor(total / 60)).padStart(2, "0");
  const rest = String(total % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));

export const musicApp = {
  id: "music",
  titleKey: "app.music.title",
  icon: "assets/icons/music.svg",
  size: { w: 640, h: 560 },

  mount(body, ctx) {
    const root = el("div", { class: "app app--music" });
    const view = { selectedId: null, notice: null };
    const wave = { trackId: null, peaks: null, token: 0, loading: false };
    let refs = null;
    let dragging = false;
    let ticker = null;

    const unlockedTracks = () => tracks.filter((track) => progression.hasTrack(track.id));
    const selectedTrack = () =>
      tracks.find((track) => track.id === view.selectedId) || null;
    const understood = (id) => progression.hasUnderstood(id);

    // Reopen where playback left off, otherwise offer the first discovered track.
    const playingTrack = tracks.find((track) => track.id === player.getState().trackId);
    if (playingTrack && progression.hasTrack(playingTrack.id)) {
      view.selectedId = playingTrack.id;
    } else {
      view.selectedId = unlockedTracks()[0]?.id || null;
    }
    if (view.selectedId && player.getState().trackId !== view.selectedId) {
      player.select(tracks.find((track) => track.id === view.selectedId));
    }

    /** M.I.L.O. explains the listening rule once per collected track. */
    function promptListening(track) {
      if (!track || !track.listenKey) return false;
      if (!progression.hasTrack(track.id) || understood(track.id)) return false;
      const tutorialId = `listen-intro:${track.id}`;
      if (progression.hasSeenTutorial(tutorialId)) return false;
      if (!ctx.mascot || typeof ctx.mascot.showLine !== "function") return false;
      const opened = ctx.mascot.showLine({
        key: track.listenKey,
        tone: "event",
        holdMs: 24_000,
      });
      // Only remember it when it was actually said; a busy M.I.L.O. gets
      // another chance next time the visitor selects or plays the track.
      if (opened) progression.markTutorialShown(tutorialId);
      return opened;
    }

    function choose(track) {
      if (!progression.hasTrack(track.id)) {
        view.notice = "music.lockedHint";
        paint();
        return;
      }
      const wasPlaying = player.getState().status === "playing";
      view.selectedId = track.id;
      view.notice = null;
      if (player.getState().trackId !== track.id) player.select(track);
      if (wasPlaying) player.play();
      paint();
    }

    function promptDrop() {
      // Touch has no drag gesture: explain the tap sequence instead.
      view.notice = isCoarsePointer() ? "music.tapCollectHint" : "music.slotEmptyHint";
      paint();
    }

    function rejectDrop(slot) {
      view.notice = "music.slotWrongFile";
      slot.classList.add("is-drop-denied");
      setTimeout(() => slot.classList.remove("is-drop-denied"), 420);
      paint();
    }

    function step(delta) {
      const list = unlockedTracks();
      if (list.length < 2) {
        view.notice = "music.lockedHint";
        paint();
        return;
      }
      const index = list.findIndex((track) => track.id === view.selectedId);
      const next = list[(index + delta + list.length) % list.length];
      choose(next);
    }

    function startPlayback() {
      const track = selectedTrack();
      if (!track || !progression.hasTrack(track.id)) {
        view.notice = "music.lockedHint";
        paint();
        return;
      }
      if (player.getState().trackId !== track.id) player.select(track);
      const started = player.play();
      view.notice = started
        ? null
        : player.getState().status === "error"
          ? "music.stateError"
          : "music.stateUnavailable";
      if (started) promptListening(track);
      paint();
    }

    /* ------------------------------------------------------------- progress */

    function seekRatio(clientX) {
      if (!refs) return;
      const total = player.getState().duration;
      if (!(total > 0)) return;
      const rect = refs.wave.getBoundingClientRect();
      if (rect.width < 1) return;
      player.seek(clamp01((clientX - rect.left) / rect.width) * total);
      paintProgress();
    }

    function seekBy(delta) {
      const total = player.getState().duration;
      if (!(total > 0)) return;
      player.seek(player.getPosition() + delta);
      paintProgress();
    }

    function makeWave() {
      const base = el("div", { class: "music__wave-bars", "aria-hidden": "true" });
      const played = el("div", {
        class: "music__wave-bars music__wave-bars--played",
        "aria-hidden": "true",
      });
      const head = el("span", { class: "music__wave-head", "aria-hidden": "true" });
      const host = el(
        "div",
        {
          class: "music__wave sunken",
          role: "slider",
          tabindex: "0",
          "aria-label": t("music.waveformLabel"),
          "aria-valuemin": "0",
          "aria-valuemax": "100",
          "aria-valuenow": "0",
        },
        [base, played, head],
      );

      host.addEventListener("pointerdown", (event) => {
        if (!(player.getState().duration > 0)) return;
        event.preventDefault();
        dragging = true;
        try {
          host.setPointerCapture(event.pointerId);
        } catch {
          /* pointer capture is a nicety */
        }
        seekRatio(event.clientX);
      });
      host.addEventListener("pointermove", (event) => {
        if (!dragging) return;
        event.preventDefault();
        seekRatio(event.clientX);
      });
      const release = (event) => {
        if (!dragging) return;
        dragging = false;
        try {
          host.releasePointerCapture(event.pointerId);
        } catch {
          /* ignore */
        }
      };
      host.addEventListener("pointerup", release);
      host.addEventListener("pointercancel", release);
      host.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          seekBy(-SEEK_STEP);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          seekBy(SEEK_STEP);
        } else if (event.key === "Home") {
          event.preventDefault();
          player.seek(0);
          paintProgress();
        } else if (event.key === "End") {
          event.preventDefault();
          const total = player.getState().duration;
          if (total > 0) player.seek(total - 0.1);
          paintProgress();
        }
      });

      return { host, base, played, head };
    }

    function fillBars(host, peaks) {
      clear(host);
      for (const peak of peaks) {
        host.append(
          el("span", {
            class: "music__wave-bar",
            "aria-hidden": "true",
            style: { height: `${Math.max(4, Math.round(peak * 100))}%` },
          }),
        );
      }
    }

    /**
     * Ask for the selected track's real peaks. Module-level caching in
     * waveform.js makes a reopen or a language switch instant.
     */
    function requestWave(track) {
      if (!track || !track.src) {
        wave.trackId = null;
        wave.peaks = null;
        wave.loading = false;
        return;
      }
      if (wave.trackId === track.id && (wave.peaks || wave.loading)) return;
      const token = ++wave.token;
      wave.trackId = track.id;
      wave.peaks = null;
      wave.loading = true;
      loadWaveform(track.src).then((peaks) => {
        if (token !== wave.token) return;
        wave.peaks = peaks;
        wave.loading = false;
        if (refs && peaks) {
          fillBars(refs.waveBase, peaks);
          fillBars(refs.wavePlayed, peaks);
        }
        paintWave();
        paintProgress();
      });
    }

    /* ---------------------------------------------------------------- build */

    function build() {
      refs = null;
      clear(root);
      wave.trackId = null;
      wave.peaks = null;
      wave.loading = false;
      wave.token += 1;

      // One slot per album track: an empty space waiting for its own file.
      const slots = new Map();
      const grid = el("div", {
        class: "music__slots sunken",
        role: "list",
        "aria-label": t("music.slotsLabel"),
      });

      for (const track of tracks) {
        const stateLabel = el("span", { class: "music__slot-state" });
        const decodeMark = el("span", {
          class: "music__slot-decode",
          text: "◈",
          "aria-hidden": "true",
          title: t("music.slotUnderstood"),
        });
        decodeMark.hidden = true;
        const slot = el(
          "button",
          {
            class: "music__slot",
            type: "button",
            dataset: { collectionSlot: track.id, trackId: track.id },
            on: {
              click: () => {
                if (progression.hasTrack(track.id)) {
                  choose(track);
                  return;
                }
                // Touch collection: the file chosen on the desktop is offered
                // to this slot through the existing drop validation. A tap on
                // a slot is the explicit choice; a tap on the file is not.
                if (ctx.files?.tryCollectOnSlot?.(slot)) return;
                promptDrop();
              },
            },
          },
          [
            el("span", { class: "music__slot-mark", "aria-hidden": "true" }),
            el("span", { class: "music__slot-body" }, [
              el("span", { class: "music__slot-name", text: trackLabel(track) }),
              stateLabel,
            ]),
            decodeMark,
            el("span", { class: "music__slot-wave", "aria-hidden": "true" }),
          ],
        );

        // Dropping is the only way a slot fills. The payload carries a stable
        // track ID, so a renamed file is still judged by identity, not title.
        slot.addEventListener("holysaga:file-drop", (event) => {
          const detail = event.detail || {};
          if (detail.trackId !== track.id) {
            rejectDrop(slot);
            return;
          }
          event.preventDefault();
          if (progression.hasTrack(track.id)) {
            paint();
            return;
          }
          view.notice = null;
          progression.unlockTrack(track.id);
          view.selectedId = track.id;
          player.select(track);
          slot.classList.add("is-collecting");
          setTimeout(() => slot.classList.remove("is-collecting"), 1100);
          paint();
          // Collected ≠ understood: explain the listening rule right away.
          promptListening(track);
        });

        slots.set(track.id, { slot, stateLabel, decodeMark });
        grid.append(el("div", { class: "music__cell", role: "listitem" }, [slot]));
      }

      const nowTitle = el("span", { class: "music__now-title" });
      const nowState = el("span", { class: "music__now-state" });
      const now = el("div", { class: "music__now" }, [
        el("span", { class: "app__label", text: t("music.selectedLabel") }),
        nowTitle,
        nowState,
      ]);

      const control = (labelKey, glyph, handler) =>
        el(
          "button",
          {
            class: "music__btn raised",
            type: "button",
            title: t(labelKey),
            "aria-label": t(labelKey),
            on: { click: handler },
          },
          [el("span", { class: "music__glyph", text: glyph, "aria-hidden": "true" })],
        );

      const prev = control("music.ctrlPrev", "◀◀", () => step(-1));
      const play = control("music.ctrlPlay", "▶", startPlayback);
      const pause = control("music.ctrlPause", "❙❙", () => {
        player.pause();
        view.notice = null;
        paint();
      });
      const stop = control("music.ctrlStop", "■", () => {
        player.stop();
        view.notice = null;
        paint();
      });
      const next = control("music.ctrlNext", "▶▶", () => step(1));

      const visualizer = el("button", {
        class: "music__visualizer raised",
        type: "button",
        text: t("music.openVisualizer"),
        title: t("music.openVisualizer"),
        on: { click: () => ctx.openWindow?.(visualizerApp) },
      });

      // Fallback while the real peaks load, and whenever they cannot be read.
      const seekFill = el("span", { class: "music__seek-fill" });
      const seek = el(
        "div",
        {
          class: "music__seek sunken",
          role: "progressbar",
          "aria-label": t("music.seekLabel"),
          "aria-valuemin": "0",
          "aria-valuemax": "100",
          "aria-valuenow": "0",
        },
        [seekFill],
      );
      seek.addEventListener("pointerdown", (event) => {
        const total = player.getState().duration;
        if (!(total > 0)) return;
        const rect = seek.getBoundingClientRect();
        if (rect.width < 1) return;
        event.preventDefault();
        player.seek(clamp01((event.clientX - rect.left) / rect.width) * total);
        paintProgress();
      });

      const waveParts = makeWave();
      const waveHost = waveParts.host;
      waveHost.hidden = true;

      const time = el("span", { class: "music__time", text: "--:--" });

      const volumeRange = el("input", {
        class: "music__volume-range",
        type: "range",
        min: "0",
        max: "100",
        step: "1",
        value: "70",
        "aria-label": t("music.volumeLabel"),
      });
      volumeRange.addEventListener("input", () => {
        player.setVolume(Number(volumeRange.value) / 100);
        paintVolume();
      });

      const volumeValue = el("span", { class: "music__volume-value", text: "70%" });

      const mute = el(
        "button",
        {
          class: "music__mute raised",
          type: "button",
          title: t("music.mute"),
          "aria-label": t("music.mute"),
          "aria-pressed": "false",
          on: {
            click: () => {
              player.toggleMute();
              paintVolume();
            },
          },
        },
        [el("span", { class: "music__glyph", text: "♪", "aria-hidden": "true" })],
      );

      const status = el("div", {
        class: "statusbar__cell statusbar__cell--grow sunken",
      });
      const count = el("div", { class: "app__meta" });
      const unlockedCount = el("div", {
        class: "statusbar__cell statusbar__cell--tight sunken",
      });

      root.append(
        el("div", { class: "app__head" }, [
          el("span", { class: "app__label", text: t("music.library") }),
          count,
        ]),
        el("p", {
          class: "music__grid-hint",
          text: t(isCoarsePointer() ? "music.tapCollectHint" : "music.slotDropHint"),
        }),
        grid,
        now,
        el("div", { class: "music__transport" }, [
          prev,
          play,
          pause,
          stop,
          next,
          visualizer,
        ]),
        el("div", { class: "music__seek-row" }, [waveHost, seek, time]),
        el("div", { class: "music__volume-row" }, [
          el("span", { class: "music__volume-label", text: t("music.volumeLabel") }),
          volumeRange,
          volumeValue,
          mute,
        ]),
        el("p", { class: "app__note", text: t("music.futureNote") }),
        el("div", { class: "statusbar" }, [status, unlockedCount]),
      );

      refs = {
        slots,
        nowTitle,
        nowState,
        prev,
        play,
        pause,
        stop,
        next,
        seek,
        seekFill,
        wave: waveHost,
        waveBase: waveParts.base,
        wavePlayed: waveParts.played,
        waveHead: waveParts.head,
        time,
        volumeRange,
        volumeValue,
        mute,
        status,
        count,
        unlockedCount,
      };
    }

    /* ---------------------------------------------------------------- paint */

    function paintWave() {
      if (!refs) return;
      const ready = Boolean(wave.peaks && wave.peaks.length);
      refs.wave.hidden = !ready;
      refs.seek.hidden = ready;
      refs.wave.classList.toggle(
        "music__wave--understood",
        Boolean(view.selectedId && understood(view.selectedId)),
      );
    }

    function paintVolume() {
      if (!refs) return;
      const playback = player.getState();
      const percent = Math.round(playback.volume * 100);
      refs.volumeRange.value = String(percent);
      refs.volumeValue.textContent = playback.muted ? t("music.mutedValue") : `${percent}%`;
      refs.mute.classList.toggle("is-muted", playback.muted);
      refs.mute.setAttribute("aria-pressed", playback.muted ? "true" : "false");
      const label = t(playback.muted ? "music.unmute" : "music.mute");
      refs.mute.title = label;
      refs.mute.setAttribute("aria-label", label);
    }

    function paintProgress() {
      if (!refs) return;
      const playback = player.getState();
      const total = playback.duration;
      const position = total > 0 ? Math.min(total, Math.max(0, player.getPosition())) : 0;
      const percent = total > 0 ? (position / total) * 100 : 0;

      refs.seekFill.style.width = `${percent}%`;
      refs.seek.setAttribute("aria-valuenow", String(Math.round(percent)));
      refs.wavePlayed.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
      refs.waveHead.style.left = `${percent}%`;
      refs.wave.setAttribute("aria-valuenow", String(Math.round(percent)));
      refs.wave.setAttribute("aria-valuemax", String(Math.round(total || 0)));
      const timeText =
        total > 0
          ? `${formatTime(position)} / ${formatTime(total)}`
          : "--:--";
      refs.time.textContent = timeText;
      refs.wave.setAttribute("aria-valuetext", timeText);
    }

    function paint() {
      if (!refs) return;
      const playback = player.getState();
      const unlocked = unlockedTracks();
      const shown = selectedTrack();
      const duration = playback.trackId === view.selectedId ? playback.duration : 0;

      refs.count.textContent = t("music.trackCount", { n: tracks.length });
      refs.unlockedCount.textContent = t("music.unlockedCount", {
        n: unlocked.length,
        total: tracks.length,
      });

      for (const [id, entry] of refs.slots) {
        const open = progression.hasTrack(id);
        const isSelected = view.selectedId === id;
        const decoded = understood(id);
        entry.slot.classList.toggle("is-collected", open);
        entry.slot.classList.toggle("is-empty", !open);
        entry.slot.classList.toggle("is-selected", isSelected);
        entry.slot.classList.toggle("is-understood", decoded);
        entry.decodeMark.hidden = !decoded;
        entry.slot.setAttribute("aria-pressed", isSelected ? "true" : "false");
        entry.slot.setAttribute("aria-disabled", open ? "false" : "true");
        entry.slot.title = open
          ? decoded
            ? t("music.slotUnderstood")
            : t("music.slotListening")
          : t("music.slotEmptyHint");
        entry.slot.querySelector(".music__slot-mark").textContent = open
          ? isSelected
            ? "▶"
            : "·"
          : "▪";
        if (!open) {
          entry.stateLabel.textContent = t("music.slotWaiting");
        } else if (decoded) {
          entry.stateLabel.textContent = t("music.slotUnderstood");
        } else if (isSelected && duration > 0) {
          const heard = progression.getListeningSeconds(id);
          entry.stateLabel.textContent = t("music.slotHeard", {
            n: Math.min(100, Math.floor((heard / duration) * 100)),
          });
        } else {
          entry.stateLabel.textContent = t("music.slotListening");
        }
      }

      refs.nowTitle.textContent = shown ? trackLabel(shown) : t("music.noneSelected");
      refs.nowState.textContent =
        shown && playback.trackId === shown.id && STATE_KEYS[playback.status]
          ? t(STATE_KEYS[playback.status])
          : "";

      const playable = Boolean(shown && progression.hasTrack(shown.id) && shown.src);
      const playing = playback.status === "playing";
      refs.play.disabled = !playable || playing;
      refs.pause.disabled = !playable || !playing;
      refs.stop.disabled = !playable && !playing;
      refs.prev.disabled = unlocked.length < 2;
      refs.next.disabled = unlocked.length < 2;
      refs.play.title = refs.play.getAttribute("aria-label");
      refs.pause.title = refs.pause.getAttribute("aria-label");

      let statusKey = "music.selectHint";
      if (view.notice) statusKey = view.notice;
      else if (!shown) statusKey = "music.selectHint";
      else if (!progression.hasTrack(shown.id)) statusKey = "music.lockedHint";
      else if (!shown.src) statusKey = "music.stateUnavailable";
      else if (STATE_KEYS[playback.status]) statusKey = STATE_KEYS[playback.status];
      refs.status.textContent = t(statusKey);

      paintVolume();
      paintProgress();
      requestWave(shown);
      paintWave();
      syncTicker();
    }

    /* Keep the playhead smooth between the element's timeupdate events. */
    function syncTicker() {
      const playing = player.getState().status === "playing";
      if (playing && ticker === null) {
        ticker = requestAnimationFrame(function tick() {
          ticker = null;
          if (player.getState().status !== "playing") return;
          paintProgress();
          ticker = requestAnimationFrame(tick);
        });
      } else if (!playing && ticker !== null) {
        cancelAnimationFrame(ticker);
        ticker = null;
      }
    }

    const rerender = () => {
      build();
      paint();
    };

    body.append(root);
    build();
    paint();

    const stopPlayer = player.subscribe(paint);
    const stopProgress = progression.subscribe(() => {
      // A discovery makes any earlier "still locked" message obsolete.
      view.notice = null;
      if (!view.selectedId) {
        const first = unlockedTracks()[0];
        if (first) {
          view.selectedId = first.id;
          player.select(first);
        }
      }
      // Paint, never rebuild: the slot that was just filled must keep running
      // its collection animation instead of being replaced mid-flash, and a
      // listening tick must not reload the waveform.
      paint();
    });
    const stopLocale = onLocaleChange(rerender);

    // A reopened player does not repeat the listening explanation unless it
    // was never actually said.
    if (view.selectedId) {
      const shown = selectedTrack();
      if (shown && !understood(shown.id)) setTimeout(() => promptListening(shown), 700);
    }

    return () => {
      // Playback intentionally survives: the player is desktop-wide.
      if (ticker !== null) cancelAnimationFrame(ticker);
      ticker = null;
      stopPlayer();
      stopProgress();
      stopLocale();
    };
  },
};
