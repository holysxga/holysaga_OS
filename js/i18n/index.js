/**
 * Localization runtime.
 *
 * - All interface strings live in js/i18n/<code>.js as flat "group.key" maps.
 * - Components never hardcode text: they use t("group.key") or data-i18n attributes.
 * - Missing keys fall back to Portuguese, then to the key itself (and warn once).
 */
import { pt } from "./pt.js";
import { en } from "./en.js";
import { es } from "./es.js";
import { ru } from "./ru.js";

export const DEFAULT_LOCALE = "pt";

export const LOCALES = [
  { code: "pt", label: "Português", short: "PT", tag: "pt-BR" },
  { code: "en", label: "English", short: "EN", tag: "en" },
  { code: "es", label: "Español", short: "ES", tag: "es" },
  { code: "ru", label: "Русский", short: "RU", tag: "ru" },
];

const DICTIONARIES = { pt, en, es, ru };
const listeners = new Set();
const warned = new Set();

let locale = DEFAULT_LOCALE;

/** Translate a key, with optional {placeholder} values. */
export function t(key, vars) {
  const value = lookup(locale, key) ?? lookup(DEFAULT_LOCALE, key);
  if (value === undefined) {
    if (!warned.has(key)) {
      warned.add(key);
      console.warn(`[i18n] missing key: ${key}`);
    }
    return key;
  }
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (match, name) =>
    name in vars ? String(vars[name]) : match,
  );
}

function lookup(code, key) {
  const dict = DICTIONARIES[code];
  if (!dict) return undefined;
  const value = dict[key];
  return typeof value === "string" ? value : undefined;
}

export function getLocale() {
  return locale;
}

export function isLocale(code) {
  return Object.prototype.hasOwnProperty.call(DICTIONARIES, code);
}

export function localeTag(code = locale) {
  const entry = LOCALES.find((item) => item.code === code);
  return entry ? entry.tag : code;
}

/** Change the interface language and notify every subscriber. */
export function setLocale(code) {
  if (!isLocale(code) || code === locale) return;
  locale = code;
  for (const listener of [...listeners]) listener(locale);
}

export function onLocaleChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Used by tools/check-i18n.mjs to keep the four dictionaries in sync. */
export function dictionaryKeys() {
  return Object.keys(DICTIONARIES).reduce((acc, code) => {
    acc[code] = Object.keys(DICTIONARIES[code]);
    return acc;
  }, {});
}
