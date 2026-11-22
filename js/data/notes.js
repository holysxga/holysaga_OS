/**
 * NOTES.TXT — fragments recovered from the creator's note archive.
 *
 * These are not interface copy: they are artifacts found inside the system.
 * Their text lives in the four dictionaries under `notes.note.NN`, so the same
 * fragment keeps its identity and its saved cleaning state in every language.
 *
 * The archive is deliberately damaged. Every entry is an independent fragment:
 * unfinished sentences, system-like observations, references to files and
 * directories, messages that seem to be trying to reach someone. Some entries
 * begin readable; others are corrupted records that have to be cleaned with the
 * Sacred Digital brush.
 *
 *   { id, key, corrupted, shards }
 *
 * `id` comes from the language-independent key, so a note keeps the same
 * identity — and therefore the same saved cleaning state — in every language
 * and every time the notepad picks it again. Nothing here is generated at
 * runtime: the page shows a random selection from this fixed archive.
 */

/** Damaged cells a corrupted note carries before it can be read. */
export const NOTE_SHARDS = 6;

const NOTE_POOL = [
  /* ------------------------------------------------- still readable */
  { key: "notes.note.01" },
  { key: "notes.note.02", corrupted: true },
  { key: "notes.note.03" },
  { key: "notes.note.04" },
  { key: "notes.note.05", corrupted: true },
  { key: "notes.note.06" },
  { key: "notes.note.07" },
  { key: "notes.note.08", corrupted: true },
  { key: "notes.note.09" },
  { key: "notes.note.10" },
  { key: "notes.note.11", corrupted: true },
  { key: "notes.note.12", corrupted: true },
  { key: "notes.note.13" },
  { key: "notes.note.14" },
  { key: "notes.note.15", corrupted: true },
  { key: "notes.note.16" },

  /* ------------------------------------------------- damaged records */
  { key: "notes.note.17", corrupted: true },
  { key: "notes.note.18" },
  { key: "notes.note.19" },
  { key: "notes.note.20", corrupted: true },
  { key: "notes.note.21" },
  { key: "notes.note.22" },
  { key: "notes.note.23", corrupted: true },
  { key: "notes.note.24" },
  { key: "notes.note.25" },
  { key: "notes.note.26", corrupted: true },
  { key: "notes.note.27" },
  { key: "notes.note.28" },
  { key: "notes.note.29", corrupted: true },
  { key: "notes.note.30", corrupted: true },
];

const ENTRIES = NOTE_POOL.map((entry) => ({
  id: entry.key.replace("notes.note.", "note-"),
  key: entry.key,
  corrupted: Boolean(entry.corrupted),
  shards: entry.corrupted ? NOTE_SHARDS : 0,
}));

export const NOTE_BY_ID = new Map(ENTRIES.map((entry) => [entry.id, entry]));

function shuffle(list, random) {
  const pool = [...list];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [pool[index], pool[swap]] = [pool[swap], pool[index]];
  }
  return pool;
}

/**
 * Pick one page of notes. A different combination comes up every time the
 * application opens, without repeating an entry inside the same page, and
 * every page carries at least one damaged record to clean.
 *
 * @param {{count?: number, random?: () => number}} [options]
 * @returns {Array<{id: string, key: string, corrupted: boolean, shards: number}>}
 */
export function pickNotes(options = {}) {
  const requested = Number(options.count) || 7;
  const count = Math.max(3, Math.min(ENTRIES.length, requested));
  const random = typeof options.random === "function" ? options.random : Math.random;

  const shuffled = shuffle(ENTRIES, random);
  const picked = shuffled.slice(0, count);

  // A page without a damaged record would hide the brush's whole purpose.
  if (!picked.some((entry) => entry.corrupted)) {
    const damaged = shuffle(
      ENTRIES.filter((entry) => entry.corrupted),
      random,
    )[0];
    if (damaged) picked[picked.length - 1] = damaged;
  }

  return picked.map((entry) => ({ ...entry }));
}
