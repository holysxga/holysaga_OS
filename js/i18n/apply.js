/**
 * Declarative translation binding.
 *
 * Mark up static text once and let applyI18n() keep it in sync:
 *   data-i18n="key"              -> textContent
 *   data-i18n-title="key"        -> title attribute
 *   data-i18n-aria-label="key"   -> aria-label attribute
 *   data-i18n-placeholder="key"  -> placeholder attribute
 *
 * Dynamic strings (counts, status messages) are set by each app with t().
 */
import { onLocaleChange, t } from "./index.js";

const BINDINGS = [
  ["data-i18n", "textContent"],
  ["data-i18n-title", "title"],
  ["data-i18n-aria-label", "aria-label"],
  ["data-i18n-placeholder", "placeholder"],
];

export function applyI18n(root) {
  if (!root) return;
  const scope = [root, ...root.querySelectorAll("*")];
  for (const node of scope) {
    if (!node.getAttribute) continue;
    for (const [attribute, target] of BINDINGS) {
      const key = node.getAttribute(attribute);
      if (!key) continue;
      const value = t(key);
      if (target === "textContent") {
        if (node.textContent !== value) node.textContent = value;
      } else if (node.getAttribute(target) !== value) {
        node.setAttribute(target, value);
      }
    }
  }
}

/** Apply now and re-apply whenever the language changes. Returns an unsubscribe. */
export function bindI18n(root) {
  applyI18n(root);
  return onLocaleChange(() => applyI18n(root));
}
