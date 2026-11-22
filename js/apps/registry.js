/**
 * Application registry.
 *
 * Every desktop shortcut, Start menu entry and taskbar button is generated
 * from this list — add a future program here and it appears everywhere.
 *
 * Descriptor:
 *   id        unique string, also the window key
 *   titleKey  translation key for the title
 *   icon      path to a local icon
 *   size      preferred window size in CSS pixels
 *   mount     (body, ctx) => cleanup; ctx = { close, focus }
 */
import { musicApp } from "./music.js";
import { imagesApp } from "./images.js";
import { dreamsApp } from "./dreams.js";
import { outsiderApp } from "./outsider.js";
import { notesApp } from "./notes.js";
import { signalsApp } from "./signals.js";

export const APPS = [musicApp, imagesApp, dreamsApp, outsiderApp, notesApp];

/**
 * SIGNALS is a real program, but not a boot program: its shortcut is granted
 * by the TRITON story. Keeping it out of `APPS` means the desktop and Start
 * menu do not create a second, premature shortcut; `APP_BY_ID` still lets the
 * granted shortcut open the window.
 */
export const APP_BY_ID = new Map(
  [...APPS, signalsApp].map((app) => [app.id, app]),
);
