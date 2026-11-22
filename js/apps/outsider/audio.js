/**
 * OUTSIDER.EXE — its own audio, deliberately separate from MUSIC PLAYER.
 *
 * The maze soundtrack is a private <audio> element. It is never given to
 * js/core/player.js and never enters the shared listening tracker, so the
 * downsampled version can never contribute to OUTSIDER's 70% coverage.
 *
 * Footsteps and the door tone are tiny procedural sounds. They use a private
 * Web Audio context that is created on the first click and closed with the
 * window, so nothing keeps running after the program is closed.
 */

const BGM_SRC = "assets/audio/outsider-degraded.wav";

export const AUDIO_DEFAULTS = Object.freeze({
  bgm: 0.3,
  sfx: 0.55,
});

export function createMazeAudio(options = {}) {
  const onState = typeof options.onState === "function" ? options.onState : () => {};
  const element = new Audio();
  element.preload = "auto";
  element.loop = true;
  element.src = BGM_SRC;
  element.volume = AUDIO_DEFAULTS.bgm;

  let state = "loading";
  let bgmVolume = AUDIO_DEFAULTS.bgm;
  let sfxVolume = AUDIO_DEFAULTS.sfx;
  let context = null;
  let noise = null;
  let wanted = false;
  let destroyed = false;
  let fadeTimer = null;

  function report(next, detail = "") {
    state = next;
    onState({ state, detail });
  }

  element.addEventListener("canplaythrough", () => {
    if (state === "loading") report("ready");
  });
  element.addEventListener("playing", () => {
    if (fadeTimer) return;
    report("playing");
  });
  element.addEventListener("waiting", () => {
    if (wanted) report("loading");
  });
  element.addEventListener("error", () => {
    const code = element.error?.code;
    report("error", code ? `media-${code}` : "load");
  });
  element.addEventListener("pause", () => {
    if (wanted && !destroyed && !fadeTimer) report("paused");
  });

  function setBgmVolume(value) {
    bgmVolume = Math.max(0, Math.min(1, Number(value) || 0));
    if (!fadeTimer) element.volume = bgmVolume;
    return bgmVolume;
  }

  function setSfxVolume(value) {
    sfxVolume = Math.max(0, Math.min(1, Number(value) || 0));
    return sfxVolume;
  }

  function ensureContext() {
    if (destroyed) return null;
    if (context) return context;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try {
      context = new Ctor();
    } catch {
      return null;
    }
    const length = Math.floor(context.sampleRate * 0.6);
    noise = context.createBuffer(1, length, context.sampleRate);
    const data = noise.getChannelData(0);
    // A soft brown-ish noise: enough to suggest a step on tile, no hiss.
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.86 + white * 0.14;
      data[i] = last;
    }
    return context;
  }

  function unlockSfx() {
    const ctx = ensureContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
  }

  function begin({ restart = false } = {}) {
    if (destroyed) return;
    wanted = true;
    unlockSfx();
    if (restart) {
      try {
        element.currentTime = 0;
      } catch {
        /* metadata not ready yet: playback will start at zero anyway */
      }
    }
    if (state === "error") {
      report("error", element.error?.code ? `media-${element.error.code}` : "load");
      return;
    }
    if (fadeTimer) {
      clearInterval(fadeTimer);
      fadeTimer = null;
      element.volume = bgmVolume;
    }
    const attempt = element.play();
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch((error) => {
        if (destroyed) return;
        // Autoplay refusal is recoverable: the next click tries again.
        report("blocked", error?.name || "play");
      });
    } else {
      report("playing");
    }
  }

  /** Pause but keep the exact position: returning never restarts the track. */
  function suspend() {
    if (destroyed) return;
    wanted = false;
    element.pause();
    report("paused");
    if (context?.state === "running") context.suspend().catch(() => {});
  }

  function resume() {
    if (destroyed) return;
    begin({ restart: false });
  }

  /** Fade out and stop. Used by completion, not by a temporary pause. */
  function finish() {
    if (destroyed) return;
    wanted = false;
    if (fadeTimer) return;
    const start = element.volume;
    const startedAt = performance.now();
    fadeTimer = setInterval(() => {
      if (destroyed) {
        clearInterval(fadeTimer);
        fadeTimer = null;
        return;
      }
      const t = Math.min(1, (performance.now() - startedAt) / 700);
      element.volume = start * (1 - t);
      if (t >= 1) {
        clearInterval(fadeTimer);
        fadeTimer = null;
        element.pause();
        try {
          element.currentTime = 0;
        } catch {
          /* nothing to reset */
        }
        element.volume = bgmVolume;
        report("stopped");
      }
    }, 40);
    report("stopping");
  }

  function step() {
    if (destroyed || sfxVolume <= 0) return;
    const ctx = ensureContext();
    if (!ctx || !noise || ctx.state !== "running") return;

    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 460 + Math.random() * 160;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08 * sfxVolume, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(now);
    source.stop(now + 0.18);

    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = "sine";
    thump.frequency.setValueAtTime(96 + Math.random() * 12, now);
    thumpGain.gain.setValueAtTime(0.0001, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.055 * sfxVolume, now + 0.012);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    thump.connect(thumpGain);
    thumpGain.connect(ctx.destination);
    thump.start(now);
    thump.stop(now + 0.14);
  }

  function doorTone() {
    if (destroyed || sfxVolume <= 0) return;
    const ctx = ensureContext();
    if (!ctx || ctx.state !== "running") return;
    const now = ctx.currentTime;
    [196, 293.66].forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      const start = now + index * 0.1;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.09 * sfxVolume, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 1.2);
    });
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    wanted = false;
    if (fadeTimer) clearInterval(fadeTimer);
    fadeTimer = null;
    element.pause();
    element.removeAttribute("src");
    element.load();
    if (context) {
      context.close().catch(() => {});
      context = null;
      noise = null;
    }
    report("off");
  }

  return {
    begin,
    suspend,
    resume,
    finish,
    step,
    doorTone,
    setBgmVolume,
    setSfxVolume,
    destroy,
    getState: () => state,
    getElement: () => element,
    source: BGM_SRC,
  };
}
