/**
 * Development aid: `?complete` boots the desktop with the whole archive
 * already finished, so the later parts of the experience can be tested without
 * replaying every discovery.
 *
 * The progression singleton reads localStorage the moment its module is
 * evaluated, so this file must stay the first import in js/main.js: it merges
 * the finished state into `holysaga:progression` before that singleton exists.
 * Without the query parameter nothing is written and the desktop boots exactly
 * as it always does.
 *
 * The seed only ever adds IDs. Progress the browser already has is kept, so a
 * real save is never downgraded. Because the result is an ordinary save, the
 * parameter can be dropped after the first load.
 */
import { readPref, writePref } from "./storage.js";
import { tracks } from "../data/music.js";
import { dreamPages } from "../data/dreams.js";
import { NOTE_BY_ID } from "../data/notes.js";

// Same key as PROGRESS_KEY in progression.js. Importing that module here would
// create the singleton before the seed has been written.
const PROGRESS_KEY = "progression";
const STATE_VERSION = 1;

const TOOL_ID = "sacred-digital-brush";

/* One generous range per track: the MUSIC PLAYER clamps the percentage, and an
   understood track must not look unheard in the archive. */
const FULL_COVERAGE = [[0, 3600]];

/* Every stable narrative event, including the ones written by cleanup and by
   LIBERATION itself, so the archive is indistinguishable from one finished by
   hand. `liberation-thanks` is included: a completed archive has thanked. */
const EVENTS = [
  "milo-first-contact",
  "twister-first-encounter",
  "twisters-fragment",
  "sacred-digital-discovery",
  "sacred-digital-file",
  "sunset-frame",
  "outsider-maze-complete",
  "dream-connection",
  "triton-glitch",
  "signals-comment",
  "signals-opened",
  "signals-reaction",
  "signals-listening-ready",
  "signals-listening-reaction",
  ...dreamPages.map((dream) => `dream-read:${dream.id}`),
  "liberation-dialogue-1",
  "liberation-dialogue-2",
  "liberation-dialogue-3",
  "liberation-dialogue-4",
  "liberation-choice-ready",
  "liberation-complete",
  "liberation-thanks",
];

/** Union of the saved IDs and the finished ones, in saved order first. */
function mergeIds(saved, additions) {
  const merged = [];
  for (const entry of [...(Array.isArray(saved) ? saved : []), ...additions]) {
    const id =
      typeof entry === "string"
        ? entry.trim()
        : entry && typeof entry === "object" && typeof entry.id === "string"
          ? entry.id.trim()
          : "";
    if (id && !merged.includes(id)) merged.push(id);
  }
  return merged;
}

function seedCompletePreview() {
  const saved = readPref(PROGRESS_KEY, null);
  const base =
    saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};

  const listening = { ...(base.listening || {}) };
  for (const track of tracks) {
    const ranges = listening[track.id];
    if (!Array.isArray(ranges) || ranges.length === 0) {
      listening[track.id] = FULL_COVERAGE.map((range) => [...range]);
    }
  }

  writePref(PROGRESS_KEY, {
    ...base,
    version: STATE_VERSION,
    tracks: mergeIds(base.tracks, tracks.map((track) => track.id)),
    understood: mergeIds(base.understood, tracks.map((track) => track.id)),
    dreams: mergeIds(base.dreams, dreamPages.map((dream) => dream.id)),
    notes: mergeIds(base.notes, [...NOTE_BY_ID.keys()]),
    tools: mergeIds(base.tools, [TOOL_ID]),
    events: mergeIds(base.events, EVENTS),
    twisters: Math.max(Number(base.twisters) || 0, 3),
    listening,
  });
}

if (new URLSearchParams(window.location.search).has("complete")) {
  seedCompletePreview();
}
