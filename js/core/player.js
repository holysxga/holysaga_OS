/**
 * Shared audio playback — one element for the whole desktop.
 *
 * Playback deliberately lives outside every window. Closing or minimizing the
 * MUSIC PLAYER or the VISUALIZER only unmounts their DOM; this module keeps
 * playing, and only an explicit stop (or selecting another track) resets it.
 *
 * A track with `src: null` is reported as "unavailable": `play()` returns false
 * and never fakes a running state or a progress timer. Connect a real file by
 * setting `src` in js/data/music.js.
 *
 * Volume and mute are interface preferences, so they are kept in localStorage
 * and survive reopening windows and refreshing the page. Seeking only moves the
 * element's playhead: it never marks a track as heard.
 */
import { readPref, writePref } from "./storage.js";

const VOLUME_KEY = "volume";
const MUTED_KEY = "muted";

const listeners = new Set();

let audio = null;
let track = null;
let status = "idle"; // idle | ready | playing | paused | unavailable | error
let currentTime = 0;
let duration = 0;
/* Every explicit seek bumps this, so the listening tracker can ignore jumps. */
let seekCount = 0;
/* Pauses requested by the visitor, not stops, track changes or natural ends. */
let pauseCount = 0;

function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(1, Math.max(0, number));
}

let volume = clamp01(readPref(VOLUME_KEY, 0.7));
let muted = Boolean(readPref(MUTED_KEY, false));

function snapshot() {
  return {
    trackId: track ? track.id : null,
    title: track ? track.title : null,
    visual: track ? track.visual : null,
    status,
    currentTime,
    duration,
    volume,
    muted,
    seekCount,
    pauseCount,
    hasAudio: Boolean(track && track.src),
  };
}

function emit() {
  const state = snapshot();
  for (const listener of [...listeners]) {
    try {
      listener(state);
    } catch (error) {
      console.error("[player] listener failed", error);
    }
  }
}

export function subscribe(listener) {
  if (typeof listener !== "function") return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState() {
  return snapshot();
}

/**
 * The live playhead, read straight from the element while it is advancing.
 * Windows use this for a smooth indicator without forcing an emit per frame.
 */
export function getPosition() {
  if (audio && status === "playing" && Number.isFinite(audio.currentTime)) {
    return audio.currentTime;
  }
  return currentTime;
}

function readDuration(node) {
  return Number.isFinite(node.duration) && node.duration > 0 ? node.duration : 0;
}

/** Keep the element in sync with the saved volume/mute pair. */
function applyVolume() {
  if (!audio) return;
  try {
    audio.volume = muted ? 0 : volume;
    audio.muted = muted;
  } catch {
    /* an element without a source may refuse; the next real load retries */
  }
}

/** Create the single audio element on first real playback attempt. */
function ensureAudio() {
  if (audio) return audio;
  if (typeof Audio === "undefined") return null;
  try {
    const node = new Audio();
    node.preload = "metadata";
    node.volume = muted ? 0 : volume;
    node.muted = muted;
    node.addEventListener("loadedmetadata", () => {
      duration = readDuration(node);
      emit();
    });
    node.addEventListener("timeupdate", () => {
      currentTime = node.currentTime || 0;
      duration = readDuration(node);
      emit();
    });
    node.addEventListener("play", () => {
      status = "playing";
      emit();
    });
    node.addEventListener("pause", () => {
      if (status === "playing") status = "paused";
      emit();
    });
    node.addEventListener("seeked", () => {
      currentTime = node.currentTime || 0;
      emit();
    });
    node.addEventListener("ended", () => {
      status = track ? "paused" : "idle";
      currentTime = track ? readDuration(node) : 0;
      emit();
    });
    node.addEventListener("error", () => {
      status = "error";
      currentTime = 0;
      duration = 0;
      emit();
    });
    audio = node;
    return node;
  } catch (error) {
    console.warn("[player] audio unavailable", error);
    return null;
  }
}

/** Stop whatever is loaded without emitting, used before changing tracks. */
function halt() {
  if (!audio) return;
  try {
    audio.pause();
    audio.currentTime = 0;
  } catch {
    /* an audio element without a source is allowed to refuse this */
  }
}

/** Select a track without starting it. Safe with a missing audio file. */
export function select(nextTrack) {
  if (!nextTrack || !nextTrack.id) return false;
  if (track && track.id === nextTrack.id) return true;
  halt();
  track = nextTrack;
  currentTime = 0;
  duration = 0;
  status = track.src ? "ready" : "unavailable";
  emit();
  return true;
}

/** @returns {boolean} true only when real audio actually started. */
export function play() {
  if (!track) {
    status = "idle";
    emit();
    return false;
  }
  if (!track.src) {
    status = "unavailable";
    emit();
    return false;
  }
  const node = ensureAudio();
  if (!node) {
    status = "error";
    emit();
    return false;
  }
  if (node.getAttribute("src") !== track.src) {
    node.setAttribute("src", track.src);
    currentTime = 0;
    duration = 0;
  }
  applyVolume();
  // Pressing play at the end starts the track over instead of doing nothing.
  const end = readDuration(node);
  if (end > 0 && (node.currentTime >= end - 0.05 || end - 0.05 <= 0)) {
    try {
      node.currentTime = 0;
      currentTime = 0;
    } catch {
      /* ignore */
    }
  }
  try {
    const result = node.play();
    status = "playing";
    emit();
    if (result && typeof result.catch === "function") {
      result.catch(() => {
        status = "error";
        emit();
      });
    }
    return true;
  } catch (error) {
    console.warn("[player] play failed", error);
    status = "error";
    emit();
    return false;
  }
}

export function pause(reason = "manual") {
  if (!track) return false;
  const wasPlaying = status === "playing" || Boolean(audio && !audio.paused);
  if (audio && !audio.paused) {
    try {
      audio.pause();
    } catch {
      /* ignore */
    }
  }
  // Only a visitor-requested pause advances the SIGNALS gate. Scripted
  // pauses (the LIBERATION sequence) preserve the coverage history.
  if (wasPlaying && reason === "manual") pauseCount += 1;
  status = track.src ? "paused" : "unavailable";
  emit();
  return true;
}

export function stop() {
  halt();
  currentTime = 0;
  duration = 0;
  if (!track) status = "idle";
  else status = track.src ? "ready" : "unavailable";
  emit();
}

export function toggle() {
  return status === "playing" ? pause() : play();
}

/**
 * Move the playhead. Used by the progress bar and the waveform, and by the
 * keyboard. Seeking is never counted as listening: the tracker only credits
 * the small forward steps that real playback produces.
 *
 * @param {number} seconds absolute position, clamped to the track
 * @returns {boolean} whether anything moved
 */
export function seek(seconds) {
  if (!track || !track.src) return false;
  const node = ensureAudio();
  if (!node) return false;
  const total = readDuration(node) || duration;
  if (!(total > 0)) return false;
  const target = Math.min(total, Math.max(0, Number(seconds) || 0));
  try {
    node.currentTime = target;
  } catch {
    return false;
  }
  currentTime = target;
  duration = total;
  seekCount += 1;
  emit();
  return true;
}

/** @returns {number} the volume now in effect, 0..1 */
export function setVolume(next) {
  volume = clamp01(next);
  // Touching the slider is an explicit request to hear something.
  if (volume > 0) muted = false;
  applyVolume();
  writePref(VOLUME_KEY, volume);
  writePref(MUTED_KEY, muted);
  emit();
  return volume;
}

/** @returns {boolean} whether playback is now muted */
export function toggleMute() {
  muted = !muted;
  applyVolume();
  writePref(MUTED_KEY, muted);
  emit();
  return muted;
}

function restoreVolume() {
  volume = clamp01(readPref(VOLUME_KEY, 0.7));
  muted = Boolean(readPref(MUTED_KEY, false));
  applyVolume();
}

restoreVolume();

/** The desktop-wide player. Windows subscribe to it; they do not own it. */
export const player = {
  select,
  play,
  pause,
  stop,
  toggle,
  seek,
  setVolume,
  toggleMute,
  getPosition,
  subscribe,
  getState,
};
