/**
 * Intrusive thoughts — the message library.
 *
 * The library has two strictly separated pools:
 *
 * - `twister`: personal intrusive thoughts. They may be anxious, guilty,
 *   self-critical or financially pressured, and are ONLY shown when a real
 *   Twister creature is attached to the window.
 * - `system`: liminal desktop observations, dream fragments and broken scripts.
 *   They are strange and technical, never personal attacks, and are ONLY shown
 *   without a Twister.
 *
 * Stable IDs live here and never change with the language: the Portuguese text
 * in js/i18n/pt.js is the canonical source, and every other language is a
 * translation of the same key. Append a message by adding an entry here plus
 * the two keys (`thought.<ID>.title`, `thought.<ID>.body`) to all four
 * dictionaries. Give every new entry its `pool` — that is what keeps the two
 * voices from mixing.
 *
 * The text is fictional. Nothing here claims to read the visitor's thoughts,
 * private information or real circumstances.
 */
export const THOUGHT_CATEGORIES = ["cryptic", "doubt", "error"];

const entry = (id, pool, category, action) => ({
  id,
  pool,
  category,
  action,
  titleKey: `thought.${id}.title`,
  bodyKey: `thought.${id}.body`,
});

export const THOUGHTS = [
  /* ------------------------------------------- personal Twister intrusions */
  entry("DOUBT_01", "twister", "doubt", "ok"),
  entry("DOUBT_02", "twister", "doubt", "dismiss"),
  entry("DOUBT_03", "twister", "doubt", "later"),
  entry("DOUBT_04", "twister", "doubt", "ok"),
  entry("DOUBT_05", "twister", "doubt", "continue"),
  entry("DOUBT_06", "twister", "doubt", "ignore"),
  entry("DOUBT_07", "twister", "doubt", "later"),
  entry("DOUBT_08", "twister", "doubt", "dismiss"),
  entry("DOUBT_09", "twister", "doubt", "ok"),
  entry("DOUBT_10", "twister", "doubt", "ignore"),
  entry("DOUBT_11", "twister", "doubt", "ok"),
  entry("DOUBT_12", "twister", "doubt", "later"),
  entry("DOUBT_13", "twister", "doubt", "dismiss"),
  entry("DOUBT_14", "twister", "doubt", "continue"),

  /* --------------------------------- liminal system / dream observations */
  entry("CRYPTIC_01", "system", "cryptic", "ok"),
  entry("CRYPTIC_02", "system", "cryptic", "dismiss"),
  entry("CRYPTIC_03", "system", "cryptic", "later"),
  entry("CRYPTIC_04", "system", "cryptic", "ok"),
  entry("CRYPTIC_05", "system", "cryptic", "continue"),
  entry("CRYPTIC_06", "system", "cryptic", "ignore"),
  entry("CRYPTIC_07", "system", "cryptic", "ok"),
  entry("CRYPTIC_08", "system", "cryptic", "dismiss"),
  entry("CRYPTIC_09", "system", "cryptic", "ok"),
  entry("CRYPTIC_10", "system", "cryptic", "continue"),

  /* ----------------------------------------- broken scripts / system errors */
  entry("ERROR_01", "system", "error", "ok"),
  entry("ERROR_02", "system", "error", "continue"),
  entry("ERROR_03", "system", "error", "dismiss"),
  entry("ERROR_04", "system", "error", "ok"),
  entry("ERROR_05", "system", "error", "later"),
  entry("ERROR_06", "system", "error", "ignore"),
  entry("ERROR_07", "system", "error", "ok"),
  entry("ERROR_08", "system", "error", "later"),
];

export const THOUGHT_BY_ID = new Map(THOUGHTS.map((message) => [message.id, message]));

/** The scheduler asks for one of these pools; it never mixes their contents. */
export const THOUGHT_POOLS = Object.freeze({
  twister: Object.freeze(THOUGHTS.filter((message) => message.pool === "twister")),
  system: Object.freeze(THOUGHTS.filter((message) => message.pool === "system")),
});

/**
 * Short mascot replies. Two per category, so consecutive events cannot repeat
 * the same line. Never explains the Twisters — that story is told elsewhere.
 */
export const THOUGHT_REACTIONS = {
  cryptic: ["mascot.react.cryptic.1", "mascot.react.cryptic.2"],
  doubt: ["mascot.react.doubt.1", "mascot.react.doubt.2"],
  error: ["mascot.react.error.1", "mascot.react.error.2"],
};

/**
 * Scheduler tuning. Frequencies are adjustable here without touching the
 * implementation. All values are milliseconds of *visible* time.
 */
export const THOUGHT_CONFIG = {
  /* Nobody gets interrupted on arrival: the first message waits 50–100 s. */
  firstDelayMin: 50_000,
  firstDelayMax: 100_000,
  /* Then one message every 75–160 s, never back to back. */
  intervalMin: 75_000,
  intervalMax: 160_000,
  /* A short retry when a message had to be held back (drag in progress…). */
  retryMs: 8_000,
  tickMs: 1_000,
  /* A hard ceiling per visit, so a long session cannot become a stream. */
  maxPerSession: 12,
  /* How many recent messages to skip once the whole library has been seen. */
  repeatAfter: 8,
  /* How long the mascot keeps its reaction before going quiet again. */
  mascotHoldMs: 9_000,
};
