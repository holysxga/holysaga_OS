/**
 * Mascot dialogue — content only, no DOM and no timers.
 *
 * Stable IDs (`MASCOT_IDLE_01`, `MASCOT_OPEN_01`…) are the keys written to
 * progression history; the visible text lives in the four dictionaries under
 * `mascot.line.*` and `mascot.context.*`. Add a line here plus the same key in
 * all four dictionaries and the scheduler can use it.
 *
 * The robot never speaks about private information, unlocks or Twisters here.
 * Future event dialogue should be passed to `mascotDialogue.speak(key)`.
 */
export const MASCOT_DIALOGUE_CONFIG = {
  /* Idle lines are rare and never interrupt: at least three minutes of quiet,
     visible time, randomized up to six. The first one follows the same rule so
     it cannot land right after the first-contact dialogue. */
  firstDelayMin: 180_000,
  firstDelayMax: 360_000,
  /* Thereafter one idle line every three to six minutes of quiet time. */
  intervalMin: 180_000,
  intervalMax: 360_000,
  tickMs: 1_000,
  /* A hard ceiling for one visit, so the mascot never chatters. */
  maxPerSession: 9,
  /* How many recent lines to avoid once every idle line has been seen. */
  recentLimit: 6,
  /* Context lines are occasional, not every time the same action happens. */
  contextCooldownMs: 120_000,
  contextChance: 0.45,
  contextDelayMs: 1_200,
  idleHoldMs: 14_000,
  contextHoldMs: 10_000,
  /* Subtle "you have been exploring" moments, once per visit each. */
  timeMarks: [180_000, 600_000],
};

export const MASCOT_DIALOGUE = [
  { id: "MASCOT_IDLE_01", group: "idle", key: "mascot.line.idle.01" },
  { id: "MASCOT_IDLE_02", group: "idle", key: "mascot.line.idle.02" },
  { id: "MASCOT_IDLE_03", group: "idle", key: "mascot.line.idle.03" },
  { id: "MASCOT_IDLE_04", group: "idle", key: "mascot.line.idle.04" },
  { id: "MASCOT_IDLE_05", group: "idle", key: "mascot.line.idle.05" },
  { id: "MASCOT_IDLE_06", group: "idle", key: "mascot.line.idle.06" },
  { id: "MASCOT_IDLE_07", group: "idle", key: "mascot.line.idle.07" },
  { id: "MASCOT_IDLE_08", group: "idle", key: "mascot.line.idle.08" },
  { id: "MASCOT_IDLE_09", group: "idle", key: "mascot.line.idle.09" },
  { id: "MASCOT_IDLE_10", group: "idle", key: "mascot.line.idle.10" },

  { id: "MASCOT_OPEN_01", group: "open", key: "mascot.context.open.01" },
  { id: "MASCOT_OPEN_02", group: "open", key: "mascot.context.open.02" },
  { id: "MASCOT_CLOSE_01", group: "close", key: "mascot.context.close.01" },
  { id: "MASCOT_CLOSE_02", group: "close", key: "mascot.context.close.02" },
  { id: "MASCOT_TIME_01", group: "time", key: "mascot.context.time.01" },
  { id: "MASCOT_TIME_02", group: "time", key: "mascot.context.time.02" },
];

export const MASCOT_DIALOGUE_BY_ID = new Map(
  MASCOT_DIALOGUE.map((entry) => [entry.id, entry]),
);
