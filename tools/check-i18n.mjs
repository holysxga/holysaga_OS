/**
 * Translation key checker.
 *
 *   node tools/check-i18n.mjs
 *
 * Reads the four dictionaries as text (no imports needed) and reports keys that
 * are missing from, or extra in, any language. Exits non-zero on drift.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOCALES = ["pt", "en", "es", "ru"];

function keysOf(code) {
  const source = readFileSync(join(ROOT, "js", "i18n", `${code}.js`), "utf8");
  const keys = new Set();
  for (const match of source.matchAll(/^\s*"([\w.$-]+)":/gm)) keys.add(match[1]);
  return keys;
}

const dictionaries = Object.fromEntries(LOCALES.map((code) => [code, keysOf(code)]));
const base = dictionaries.pt;
let failures = 0;

for (const code of LOCALES) {
  const keys = dictionaries[code];
  const missing = [...base].filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !base.has(key));
  if (missing.length) {
    failures += 1;
    console.error(`${code}: missing ${missing.length} key(s) — ${missing.join(", ")}`);
  }
  if (extra.length) {
    failures += 1;
    console.error(`${code}: ${extra.length} key(s) not in pt — ${extra.join(", ")}`);
  }
  const empty = [...keys].filter((key) => {
    const source = readFileSync(join(ROOT, "js", "i18n", `${code}.js`), "utf8");
    return new RegExp(`"${key.replace(".", "\\.")}":\\s*""`).test(source);
  });
  if (empty.length) {
    failures += 1;
    console.error(`${code}: empty value(s) — ${empty.join(", ")}`);
  }
}

if (failures) {
  console.error(`\ni18n check failed with ${failures} problem(s).`);
  process.exit(1);
}

console.log(`i18n ok — ${base.size} keys across ${LOCALES.length} languages.`);
