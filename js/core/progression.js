/**
 * Shared progression state — one store for the whole desktop.
 *
 * Every program and future mechanic reads and writes the same object, so an
 * unlock made in IMAGE DUMP is visible to MUSIC PLAYER immediately. The state
 * is plain JSON and is saved to localStorage under "holysaga:progression".
 *
 * Stable IDs only: "track-01", "page-03", "note-02", "sunset-frame",
 * "twister-third". Never translated titles and never list positions, so
 * changing the language or reordering content cannot corrupt progress.
 *
 * State shape (version 1):
 *   {
 *     version:   1,
 *     tracks:    ["track-01"],   // discovered track IDs
 *     listening: { "track-01": [[0, 42.5], [60, 91]] }, // unique heard ranges, seconds
 *     understood:["track-01"],   // tracks whose meaning has been understood
 *     dreams:    ["dream-001"],  // fully cleaned dream record IDs
 *     dreamCleaning: { "dream-002": ["shard-1", "shard-2"] },
 *                                 // partially cleaned record fragments
 *     notes:     ["note-01"],    // unlocked note IDs
 *     tools:     ["sacred-digital-brush"], // unlocked desktop tools
 *     twisters:  3,              // total Twister encounters
 *     events:    ["maze-first"], // completed narrative event IDs
 *     tutorials: ["desktop-open"],// explanations already shown
 *     thoughts:  ["CRYPTIC_01"], // intrusive thoughts already seen, oldest first
 *     activeMs:  184000,         // accumulated active time, milliseconds
 *   }
 *
 * Unknown, missing or malformed fields are repaired field by field instead of
 * discarding the visitor's progress. Older schema versions are read the same
 * way: anything that still validates is kept.
 *
 * The active-time tracker is shared by the whole site. It lives here so no
 * application can start a competing timer, and it never counts twice when you
 * switch programs — apps do not tick it at all.
 */
import { readPref, writePref } from "./storage.js";

export const PROGRESS_KEY = "progression";
export const STATE_VERSION = 1;

/** Time between automatic saves of accumulated active time. */
const SAVE_INTERVAL_MS = 10_000;

/**
 * Longest stretch credited to one tick. Without this, a laptop sleeping with
 * the tab visible would credit hours of "active" time in a single step.
 */
const MAX_TICK_MS = 60_000;

const COLLECTIONS = [
  "tracks",
  "understood",
  "dreams",
  "notes",
  "tools",
  "events",
  "tutorials",
  "thoughts",
  "mascot",
];

/** Keep the thought trail useful without letting it grow forever. */
const THOUGHT_HISTORY_LIMIT = 200;

/**
 * Ranges are merged as they arrive, so steady playback collapses into a few
 * long stretches. The cap only matters for a visitor who seeks constantly; the
 * oldest ranges are dropped first.
 */
const LISTENING_RANGE_LIMIT = 400;

/** Save listening coverage at most about once a second, not on every tick. */
const LISTENING_SAVE_MS = 1_200;

/** Only the last few mascot lines matter for "don't repeat" decisions. */
const MASCOT_HISTORY_LIMIT = 40;

export function createEmptyState() {
  return {
    version: STATE_VERSION,
    tracks: [],
    listening: {},
    understood: [],
    dreams: [],
    dreamCleaning: {},
    notes: [],
    noteCleaning: {},
    tools: [],
    twisters: 0,
    events: [],
    tutorials: [],
    thoughts: [],
    mascot: [],
    activeMs: 0,
  };
}

function idOf(value) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object" && typeof value.id === "string") {
    return value.id.trim();
  }
  return "";
}

/** Accept only unique, non-empty string IDs (objects with .id are tolerated). */
function uniqueIds(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const ids = [];
  for (const entry of value) {
    const id = idOf(entry);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function counter(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.floor(amount);
}

/** Merge overlapping or touching [start, end] pairs, in ascending order. */
function mergeRanges(entries) {
  const ranges = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    let start = Number(entry[0]);
    let end = Number(entry[1]);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (start > end) [start, end] = [end, start];
    start = Math.max(0, start);
    end = Math.max(0, end);
    if (end - start < 0.02) continue;
    ranges.push([start, end]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1] + 0.05) {
      last[1] = Math.max(last[1], range[1]);
    } else {
      merged.push([range[0], range[1]]);
    }
  }
  return merged.length > LISTENING_RANGE_LIMIT
    ? merged.slice(-LISTENING_RANGE_LIMIT)
    : merged;
}

/** Repair the per-track coverage map, dropping anything that is not a range. */
function normalizeListening(value) {
  const listening = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return listening;
  for (const [trackId, ranges] of Object.entries(value)) {
    const id = idOf(trackId);
    if (!id) continue;
    const merged = mergeRanges(ranges);
    if (merged.length) listening[id] = merged;
  }
  return listening;
}

/** Repair a "id → cleaned fragment IDs" map, dropping malformed entries. */
function normalizeFragmentMap(value) {
  const cleaning = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return cleaning;
  for (const [ownerId, fragments] of Object.entries(value)) {
    const id = idOf(ownerId);
    if (!id) continue;
    const cleaned = uniqueIds(fragments);
    if (cleaned.length) cleaning[id] = cleaned;
  }
  return cleaning;
}

/** Repair saved data into a valid state. Never throws. */
export function normalizeState(raw) {
  const state = createEmptyState();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return state;
  for (const name of COLLECTIONS) state[name] = uniqueIds(raw[name]);
  state.listening = normalizeListening(raw.listening);
  state.dreamCleaning = normalizeFragmentMap(raw.dreamCleaning);
  // Added after 1.0: a missing map is simply every note untouched.
  state.noteCleaning = normalizeFragmentMap(raw.noteCleaning);
  state.twisters = counter(raw.twisters);
  state.activeMs = counter(raw.activeMs);
  return state;
}

/**
 * @param {object} [options]
 * @param {{load: Function, save: Function}} [options.storage] persistence adapter
 * @param {() => number} [options.now] clock, injectable for tests
 * @param {Document} [options.document] document used for visibility events
 */
export function createProgression(options = {}) {
  const storage = options.storage || {
    load: () => readPref(PROGRESS_KEY, null),
    save: (value) => writePref(PROGRESS_KEY, value),
  };
  const now = options.now || (() => Date.now());
  const doc =
    options.document || (typeof document === "undefined" ? null : document);

  let state = normalizeState(loadRaw());
  const listeners = new Set();
  let mark = null; // start of the current visible stretch, or null when paused
  let ticking = null;
  let listeningTimer = null;
  let started = false;

  function loadRaw() {
    try {
      return storage.load();
    } catch (error) {
      console.warn("[progress] could not read saved state", error);
      return null;
    }
  }

  function snapshot() {
    const copy = { ...state };
    for (const name of COLLECTIONS) copy[name] = [...state[name]];
    copy.listening = {};
    for (const [trackId, ranges] of Object.entries(state.listening)) {
      copy.listening[trackId] = ranges.map((range) => [...range]);
    }
    copy.dreamCleaning = {};
    for (const [dreamId, fragments] of Object.entries(state.dreamCleaning)) {
      copy.dreamCleaning[dreamId] = [...fragments];
    }
    copy.noteCleaning = {};
    for (const [noteId, fragments] of Object.entries(state.noteCleaning)) {
      copy.noteCleaning[noteId] = [...fragments];
    }
    return copy;
  }

  function save() {
    if (listeningTimer !== null) {
      clearTimeout(listeningTimer);
      listeningTimer = null;
    }
    try {
      storage.save(snapshot());
    } catch (error) {
      // Private mode or a full quota: keep working in memory.
      console.warn("[progress] could not save state", error);
    }
  }

  function emit(type, id) {
    const snap = snapshot();
    for (const listener of [...listeners]) {
      try {
        listener(snap, { type, id });
      } catch (error) {
        console.error("[progress] listener failed", error);
      }
    }
  }

  function addTo(collection, id) {
    const value = idOf(id);
    if (!value || state[collection].includes(value)) return false;
    state[collection].push(value);
    save();
    emit(`${collection}:add`, value);
    return true;
  }

  function hasIn(collection, id) {
    const value = idOf(id);
    return value ? state[collection].includes(value) : false;
  }

  /* ---------------------------------------------------------------- state */

  function getState() {
    return snapshot();
  }

  function subscribe(listener) {
    if (typeof listener !== "function") return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  /* --------------------------------------------------------------- tracks */

  /** @returns {boolean} true only the first time, so rewards are not repeated. */
  function unlockTrack(id) {
    return addTo("tracks", id);
  }

  function hasTrack(id) {
    return hasIn("tracks", id);
  }

  function getTracks() {
    return [...state.tracks];
  }

  /* -------------------------------------------------------------- listening */

  /**
   * Credit one genuinely played stretch of a track. Ranges are merged, so
   * hearing the same seconds twice never inflates coverage, and a jump caused
   * by seeking is simply never reported by the caller.
   */
  function addListening(trackId, start, end) {
    const id = idOf(trackId);
    if (!id) return 0;
    const merged = mergeRanges([
      ...(state.listening[id] || []),
      [Number(start), Number(end)],
    ]);
    if (!merged.length) return getListeningSeconds(id);
    state.listening[id] = merged;
    emit("listening:add", id);
    // Frequent small updates are batched: one write per second is plenty.
    if (listeningTimer === null) {
      listeningTimer = setTimeout(() => {
        listeningTimer = null;
        save();
      }, LISTENING_SAVE_MS);
      if (listeningTimer && typeof listeningTimer.unref === "function") {
        listeningTimer.unref();
      }
    }
    return getListeningSeconds(id);
  }

  /** Saved coverage ranges for a track, as copies. */
  function getListening(trackId) {
    const id = idOf(trackId);
    return id ? (state.listening[id] || []).map((range) => [...range]) : [];
  }

  /** Unique seconds genuinely heard, never counted twice. */
  function getListeningSeconds(trackId) {
    const id = idOf(trackId);
    if (!id) return 0;
    return (state.listening[id] || []).reduce(
      (total, [start, end]) => total + Math.max(0, end - start),
      0,
    );
  }

  /** The visitor has understood a track's contents. @returns {boolean} if new. */
  function unlockUnderstanding(trackId) {
    return addTo("understood", trackId);
  }

  function hasUnderstood(trackId) {
    return hasIn("understood", trackId);
  }

  function getUnderstood() {
    return [...state.understood];
  }

  /* --------------------------------------------------------- dreams, notes */

  function unlockDream(id) {
    return addTo("dreams", id);
  }

  function hasDream(id) {
    return hasIn("dreams", id);
  }

  function getDreams() {
    return [...state.dreams];
  }

  /** Remember one cleaned fragment of a damaged dream record. */
  function markDreamFragment(dreamId, fragmentId) {
    const id = idOf(dreamId);
    const fragment = idOf(fragmentId);
    if (!id || !fragment) return false;
    const cleaned = state.dreamCleaning[id] || (state.dreamCleaning[id] = []);
    if (cleaned.includes(fragment)) return false;
    cleaned.push(fragment);
    save();
    emit("dream-cleaning:add", id);
    return true;
  }

  function getDreamCleaning(dreamId) {
    const id = idOf(dreamId);
    return id ? [...(state.dreamCleaning[id] || [])] : [];
  }

  /** Remember one cleaned fragment of a damaged NOTE and keep it per note. */
  function markNoteFragment(noteId, fragmentId) {
    const id = idOf(noteId);
    const fragment = idOf(fragmentId);
    if (!id || !fragment) return false;
    const cleaned = state.noteCleaning[id] || (state.noteCleaning[id] = []);
    if (cleaned.includes(fragment)) return false;
    cleaned.push(fragment);
    save();
    emit("note-cleaning:add", id);
    return true;
  }

  function getNoteCleaning(noteId) {
    const id = idOf(noteId);
    return id ? [...(state.noteCleaning[id] || [])] : [];
  }

  function unlockNote(id) {
    return addTo("notes", id);
  }

  function hasNote(id) {
    return hasIn("notes", id);
  }

  function getNotes() {
    return [...state.notes];
  }

  /* ---------------------------------------------------------------- tools */

  /** Record a desktop tool (the Sacred Digital brush) once. */
  function unlockTool(id) {
    return addTo("tools", id);
  }

  function hasTool(id) {
    return hasIn("tools", id);
  }

  function getTools() {
    return [...state.tools];
  }

  /* ---------------------------------------------- events and explanations */

  /** Record a narrative event once. @returns {boolean} true if it was new. */
  function completeEvent(id) {
    return addTo("events", id);
  }

  function hasEvent(id) {
    return hasIn("events", id);
  }

  function getEvents() {
    return [...state.events];
  }

  /** Remember that a first-time explanation was shown. */
  function markTutorialShown(id) {
    return addTo("tutorials", id);
  }

  function hasSeenTutorial(id) {
    return hasIn("tutorials", id);
  }

  function getTutorials() {
    return [...state.tutorials];
  }

  /* ------------------------------------------------- intrusive thoughts */

  /**
   * Remember a message that was shown, most recent last. Repeating a message
   * moves it to the end instead of duplicating it, which is what the scheduler
   * reads to avoid showing the same text again too soon.
   */
  function recordThought(id) {
    const value = idOf(id);
    if (!value) return false;
    state.thoughts = state.thoughts.filter((entry) => entry !== value);
    state.thoughts.push(value);
    if (state.thoughts.length > THOUGHT_HISTORY_LIMIT) {
      state.thoughts = state.thoughts.slice(-THOUGHT_HISTORY_LIMIT);
    }
    save();
    emit("thoughts:add", value);
    return true;
  }

  function getThoughts() {
    return [...state.thoughts];
  }

  function hasThought(id) {
    return hasIn("thoughts", id);
  }

  /* ---------------------------------------------------- mascot dialogue */

  /** Remember a mascot line, most recent last, without duplicates. */
  function recordMascotLine(id) {
    const value = idOf(id);
    if (!value) return false;
    state.mascot = state.mascot.filter((entry) => entry !== value);
    state.mascot.push(value);
    if (state.mascot.length > MASCOT_HISTORY_LIMIT) {
      state.mascot = state.mascot.slice(-MASCOT_HISTORY_LIMIT);
    }
    save();
    emit("mascot:add", value);
    return true;
  }

  function getMascotLines() {
    return [...state.mascot];
  }

  /* ------------------------------------------------------------- twisters */

  /** @returns {number} the new total encounter count. */
  function recordTwister() {
    state.twisters += 1;
    save();
    emit("twisters:add", null);
    return state.twisters;
  }

  function twisterCount() {
    return state.twisters;
  }

  /* ----------------------------------------------------------- active time */

  function isVisible() {
    return !doc || doc.visibilityState !== "hidden";
  }

  function addElapsed(ms) {
    const amount = Math.floor(ms);
    if (!Number.isFinite(amount) || amount <= 0) return false;
    state.activeMs += amount;
    return true;
  }

  /** Credit the visible stretch that just ended, without double counting. */
  function settle() {
    if (mark === null) return false;
    const current = now();
    const elapsed = current - mark;
    mark = current;
    if (elapsed <= 0) return false;
    return addElapsed(Math.min(elapsed, MAX_TICK_MS));
  }

  function flush() {
    settle();
    save();
  }

  function tick() {
    if (!isVisible()) {
      save();
      return;
    }
    if (settle()) save();
  }

  function onVisibilityChange() {
    if (isVisible()) {
      // Resume from here: the hidden stretch is deliberately not credited.
      mark = now();
      return;
    }
    settle();
    mark = null;
    save();
  }

  /**
   * Accumulated active time. Includes the current visible stretch up to now,
   * which is what a future "time on site" unlock check should read.
   */
  function getActiveTimeMs() {
    if (mark === null) return state.activeMs;
    const live = Math.min(Math.max(0, now() - mark), MAX_TICK_MS);
    return state.activeMs + Math.floor(live);
  }

  /** Start the site-wide timer. Safe to call twice; only one timer exists. */
  function startActiveTime() {
    if (started) return stopActiveTime;
    started = true;
    mark = isVisible() ? now() : null;
    ticking = setInterval(tick, SAVE_INTERVAL_MS);
    // Do not keep a Node test process alive just for the save timer.
    if (ticking && typeof ticking.unref === "function") ticking.unref();
    if (doc) doc.addEventListener("visibilitychange", onVisibilityChange);
    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", flush);
      window.addEventListener("beforeunload", flush);
    }
    return stopActiveTime;
  }

  function stopActiveTime() {
    if (!started) return;
    started = false;
    settle();
    save();
    mark = null;
    if (ticking !== null) {
      clearInterval(ticking);
      ticking = null;
    }
    if (doc) doc.removeEventListener("visibilitychange", onVisibilityChange);
    if (typeof window !== "undefined") {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    }
  }

  return {
    getState,
    subscribe,
    // tracks
    unlockTrack,
    hasTrack,
    getTracks,
    // listening coverage and understanding
    addListening,
    getListening,
    getListeningSeconds,
    unlockUnderstanding,
    hasUnderstood,
    getUnderstood,
    // dreams
    unlockDream,
    hasDream,
    getDreams,
    markDreamFragment,
    getDreamCleaning,
    // notes' own damaged records (independent from the dream cleaning map)
    markNoteFragment,
    getNoteCleaning,
    // notes
    unlockNote,
    hasNote,
    getNotes,
    // tools
    unlockTool,
    hasTool,
    getTools,
    // events
    completeEvent,
    hasEvent,
    getEvents,
    // first-time explanations
    markTutorialShown,
    hasSeenTutorial,
    getTutorials,
    // intrusive thought history
    recordThought,
    hasThought,
    getThoughts,
    // mascot dialogue history
    recordMascotLine,
    getMascotLines,
    // twisters
    recordTwister,
    twisterCount,
    // time on site
    getActiveTimeMs,
    startActiveTime,
    stopActiveTime,
    // maintenance
    save,
  };
}

/** The single shared instance every program should import. */
export const progression = createProgression();
