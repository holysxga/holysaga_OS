/**
 * Local persistence for interface preferences and progression state.
 * Both are plain JSON under the "holysaga:" prefix; failures are silent so a
 * browser in private mode still gets a working desktop.
 */
const PREFIX = "holysaga:";

export function readPref(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writePref(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* private mode / quota — preferences are a nicety, not a requirement */
  }
}
