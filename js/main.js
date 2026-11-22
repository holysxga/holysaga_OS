/**
 * HOLYSAGA_oS — entry point.
 * Wires the language, the window manager, shortcuts, taskbar and Start menu.
 */
import "./core/complete-preview.js";
import { APPS, APP_BY_ID } from "./apps/registry.js";
import { createWindowManager } from "./core/window-manager.js";
import { progression } from "./core/progression.js";
import { eventQueue } from "./core/event-queue.js";
import { listening } from "./core/listening.js";
import { player } from "./core/player.js";
import { readPref, writePref } from "./core/storage.js";
import { createShortcuts } from "./ui/shortcuts.js";
import { createMascot } from "./ui/mascot.js";
import { mountTwisterPreview } from "./ui/twister.js";
import { createIntrusiveThoughts } from "./core/intrusive-thoughts.js";
import { createTwisterEncounters } from "./core/twister-encounters.js";
import { createMascotDialogue } from "./core/mascot-dialogue.js";
import { createFirstContact } from "./core/first-contact.js";
import { createDesktopCorruption } from "./core/desktop-corruption.js";
import { createSacredDigital } from "./core/sacred-digital.js";
import { createHorizon } from "./core/horizon.js";
import { createTwisters } from "./core/twisters.js";
import { createOutsiderStory } from "./core/outsider.js";
import { createTritonStory } from "./core/triton.js";
import { createSignalsStory } from "./core/signals.js";
import { createLiberation } from "./core/liberation.js";
import { createDesktopFiles } from "./ui/desktop-files.js";
import { createCleaningBrush } from "./ui/cleaning-brush.js";
import { createTaskbar } from "./ui/taskbar.js";
import { createStartMenu } from "./ui/start-menu.js";
import {
  getLocale,
  isLocale,
  localeTag,
  onLocaleChange,
  setLocale,
  t,
} from "./i18n/index.js";

const LOCALE_KEY = "locale";

function boot() {
  // One timer for the whole site, shared by every program.
  progression.startActiveTime();

  // Unique listening coverage is credited wherever audio plays, even with the
  // MUSIC PLAYER closed, so the shared tracker watches the desktop-wide player.
  listening.start();

  const stored = readPref(LOCALE_KEY, null);
  if (typeof stored === "string" && isLocale(stored)) setLocale(stored);

  const desktop = document.getElementById("desktop");
  const layer = document.getElementById("window-layer");
  const shortcutsRoot = document.getElementById("shortcuts");

  layer.setAttribute("aria-label", t("system.windowLayerLabel"));
  desktop.setAttribute("aria-label", t("system.desktopLabel"));

  // M.I.L.O. is created before the windows: programs receive him through the
  // window context, so a gallery can ask him to come and look at something.
  // A tutorial blocks the desktop: the schedulers have to stay quiet until it
  // is acknowledged, so nothing opens behind the shield.
  let thoughtsRef = null;
  const mascot = createMascot({
    root: document.getElementById("mascot-root"),
    onTutorialChange: (active) => {
      if (active) {
        thoughtsRef?.hold("tutorial");
        mascotDialogue?.hold("tutorial");
      } else {
        thoughtsRef?.release("tutorial");
        mascotDialogue?.release("tutorial");
      }
    },
  });

  // Apps receive desktop services through the window context. The horizon
  // controller is attached after its dialogue dependencies exist, before any
  // viewer can be opened.
  const managerServices = { mascot };
  const manager = createWindowManager({ layer, services: managerServices });

  let mascotDialogue = null;
  let firstContact = null;
  let sacredDigital = null;
  let horizon = null;
  let liberation = null;

  // A shared gate for narrative controllers: two discoveries must never open
  // a dialogue behind each other, and LIBERATION owns the desktop while its
  // event layer is present.
  const sceneBlocked = () =>
    Boolean(firstContact?.isActive()) ||
    Boolean(sacredDigital?.isActive()) ||
    Boolean(tritonStory?.isGlitching?.()) ||
    Boolean(mascot.isTutorial?.()) ||
    Boolean(liberation?.isActive()) ||
    document.body.classList.contains("is-liberating");

  // A desktop is busy while any window, dialogue or scripted scene owns the
  // visitor's attention. The shared event queue keeps every deferred event
  // ACTIVE until this is false again, so two events can never compete.
  const eventBusy = () =>
    Boolean(mascot.isSpeaking?.()) ||
    Boolean(mascot.isTutorial?.()) ||
    Boolean(thoughts?.isOpen?.()) ||
    // The welcome scene reserves the desktop the moment it is scheduled.
    Boolean(firstContact?.isScheduled?.()) ||
    sceneBlocked();

  // Traces a Twister leaves on the desktop, and the items they unlock. Both
  // are desktop layers: the corruption sits under the icons, so nothing the
  // visitor needs is ever covered.
  const desktopCorruption = createDesktopCorruption({
    root: desktop,
    layer: document.getElementById("corruption-layer"),
  });

  const desktopFiles = createDesktopFiles({
    root: desktop,
    // Unlocked tools mount into the taskbar strip, not onto the wallpaper.
    toolHost: () => taskbar?.toolSlot,
    onToolActivate: () => sacredDigital?.toggleBrush(),
  });
  // OUTSIDER grants its collectible after escaping; the app reaches the same
  // desktop-file service every other discovery uses.
  managerServices.files = desktopFiles;

  const brush = createCleaningBrush({
    root: desktop,
    onClean: (point) => desktopCorruption.cleanAt(point),
  });
  // Programs with damaged content can register an in-window cleaning surface.
  // The Sacred Digital brush remains the only cleaning tool and still cleans
  // the desktop exactly as before when the pointer is not over such a surface.
  managerServices.brush = brush;

  const openApp = (id) => {
    // LIBERATION.EXE is not a window: the completed event plays again, and
    // its development preview (?liberation) uses the same entry.
    if (id === "liberation") {
      liberation?.open?.();
      return;
    }
    const app = APP_BY_ID.get(id);
    if (!app) return;
    manager.open(app);
    // DREAM LOG's contextual explanation may own this opening. The generic
    // "you opened a program" line would otherwise replace it a moment later.
    const dreamsExplanation =
      id === "dreams" && Boolean(sacredDigital?.wantsDreamlogExplanation?.());
    // SIGNALS owns a dedicated first-open reaction. A generic "you opened a
    // program" line would race it and could suppress the discovery dialogue.
    if (id !== "signals" && !dreamsExplanation) mascotDialogue?.noteAppOpened(id);
    if (id === "dreams") sacredDigital?.onDreamlogOpened?.();
  };

  let taskbar = null;

  const startMenu = createStartMenu({
    root: document.getElementById("start-menu-root"),
    apps: APPS,
    onOpenApp: openApp,
    onSelectLocale: (code) => {
      setLocale(code);
      writePref(LOCALE_KEY, getLocale());
    },
    onOpenChange: (open) => taskbar?.setStartExpanded(open),
  });

  taskbar = createTaskbar({
    root: document.getElementById("taskbar-root"),
    manager,
    onStartToggle: () => startMenu.toggle(),
  });

  const shortcutsUi = createShortcuts({
    root: shortcutsRoot,
    apps: APPS,
    onOpen: openApp,
  });

  // Twisters ride on intrusive thoughts. The controller only decides and
  // presents: the thought scheduler keeps owning timing, text and dismissal.
  const twisterEncounters = createTwisterEncounters({
    mascot,
    store: progression,
    // A deferred encounter opens its own window once M.I.L.O. has finished.
    openEncounter: (token) => thoughts.openEncounter(token),
    // The message window is the clock: opening starts the grace period,
    // closing stops it and may begin the first discovery scene.
    onOpen: (encounter, context) => {
      // Only a real encounter reaches this hook, and the alert's box is what
      // confines the traces to its neighbourhood.
      if (encounter) desktopCorruption.startEncounter({ window: context?.window });
    },
    onClose: (encounter) => {
      desktopCorruption.stopEncounter();
      // A message swept away by LIBERATION must not start a new scene mid-event.
      if (
        !liberation?.isActive() &&
        !document.body.classList.contains("is-liberating")
      ) {
        sacredDigital?.onEncounterClosed(encounter);
      }
    },
  });

  // Intrusive thoughts: system-style messages that interrupt exploration.
  // They wait for a visible stretch before the first one, so boot stays quiet.
  const thoughts = createIntrusiveThoughts({
    manager,
    mascot,
    decide: twisterEncounters.decide,
    present: twisterEncounters.present,
    // A deferred event owns the desktop while it is presented: the ambient
    // thought scheduler must not open a message over it.
    isBusy: () =>
      Boolean(eventQueue.getActive()) || Boolean(mascot.isSpeaking?.()),
  });
  thoughts.start();
  thoughtsRef = thoughts;

  // Mascot dialogue stays quiet while a thought dialog is open, and only counts
  // visible time. Context reactions are wired to the window manager below.
  mascotDialogue = createMascotDialogue({
    mascot,
    isBusy: () =>
      thoughts.isOpen() ||
      Boolean(firstContact?.isActive()) ||
      Boolean(sacredDigital?.isActive()) ||
      Boolean(liberation?.isActive()),
  });
  mascotDialogue.start();

  // First contact is a one-time narrative beat. It holds both schedulers while
  // open, then hands the desktop back without opening or unlocking anything.
  firstContact = createFirstContact({
    mascot,
    dialogue: mascotDialogue,
    thoughts,
    store: progression,
  });
  firstContact.start();

  // Sacred Digital: the first-discovery scene, the collectible .wav and the
  // cleaning tool. It only reacts to the store, so a reload restores exactly
  // what was collected.
  sacredDigital = createSacredDigital({
    mascot,
    store: progression,
    corruption: desktopCorruption,
    files: desktopFiles,
    brush,
    // The scene owns the desktop for a moment: no new alert may interrupt it.
    quiet: (on) => {
      if (on) {
        thoughts.hold("sacred-digital");
        mascotDialogue?.hold("sacred-digital");
      } else {
        thoughts.release("sacred-digital");
        mascotDialogue?.release("sacred-digital");
      }
    },
  });
  sacredDigital.start();

  // HORIZON's photograph discovery and listening reflection. It records the
  // same stable `horizon` track / `sunset-frame` event the viewer already used,
  // and keeps its understanding independent from Sacred Digital.
  horizon = createHorizon({ mascot, store: progression, files: desktopFiles });
  managerServices.horizon = horizon;
  horizon.start();

  // OUTSIDER's listening reflection. The maze's private soundtrack is never
  // seen by the shared tracker, so only the full collectible reaches 70%.
  const outsiderStory = createOutsiderStory({ mascot, store: progression });
  outsiderStory.start();

  // TRITON's chain: the Hotel + Fields connection, its desktop file, the
  // post-70% glitch, and the SIGNALS shortcut. It reuses the shared player,
  // listening tracker, file-drop flow and shortcut component; no alternate
  // audio or progression system is introduced.
  const tritonStory = createTritonStory({
    mascot,
    store: progression,
    files: desktopFiles,
    shortcuts: shortcutsUi,
    mascotRoot: document.getElementById("mascot-root"),
    desktop,
    isBlocked: sceneBlocked,
    quiet: (on) => {
      if (on) {
        thoughts.hold("triton-glitch");
        mascotDialogue?.hold("triton-glitch");
      } else {
        thoughts.release("triton-glitch");
        mascotDialogue?.release("triton-glitch");
      }
    },
  });
  tritonStory.start();

  // SIGNALS opens through the shortcut the TRITON story granted. The app is
  // registered for the window manager but not in the boot shortcut list; this
  // controller owns its first-open reaction and the one-time SIGNALS.wav file.
  const signalsStory = createSignalsStory({
    mascot,
    store: progression,
    files: desktopFiles,
    player,
    isBlocked: sceneBlocked,
  });
  managerServices.signals = signalsStory;
  signalsStory.start();

  // TWISTERS: the second real Twister leaves its audio fragment on the desktop.
  // The encounter controller still owns spawning; this only watches the count
  // and reuses the same file, collection, listening and dialogue systems.
  const twisters = createTwisters({
    mascot,
    store: progression,
    files: desktopFiles,
    isBlocked: sceneBlocked,
  });
  twisters.start();

  // LIBERATION: the final realization and its desktop event. It reads the
  // same six track and six dream records as the rest of the archive, writes
  // only stable event IDs, and never registers a window or a collectible
  // track. M.I.L.O. speaks through the shared dialogue component.
  // Development aid: ?liberation makes the sequence testable before the
  // archive is complete. It is opt-in and never records progress.
  const liberationPreview = new URLSearchParams(window.location.search).has(
    "liberation",
  );
  liberation = createLiberation({
    mascot,
    store: progression,
    audioPlayer: player,
    root: desktop,
    allowPreview: liberationPreview,
    onBeforeStart: () => startMenu.close(),
    // The sequence owns the desktop: the intrusive-thought scheduler stops and
    // restarts with a fresh interval, so no Twister or alert can interrupt it
    // and none is queued up to burst afterwards.
    onSequenceStart: () => {
      thoughts.suspend("liberation-sequence");
      // No tutorial ring, tooltip or helper may float above the event.
      sacredDigital?.suspendGuidance?.();
    },
    onSequenceEnd: () => thoughts.resume("liberation-sequence"),
    canSpeak: () =>
      Boolean(firstContact?.hasSeen?.()) &&
      !firstContact?.isActive() &&
      !thoughts.isOpen() &&
      !sacredDigital?.isActive() &&
      !tritonStory?.isGlitching?.() &&
      !mascot.isTutorial?.() &&
      !mascot.isSpeaking?.(),
    quiet: (on) => {
      if (on) {
        thoughts.hold("liberation");
        mascotDialogue?.hold("liberation");
      } else {
        thoughts.release("liberation");
        mascotDialogue?.release("liberation");
      }
    },
  });
  liberation.start();

  // LIBERATION.EXE — the replay shortcut appears only after the original event
  // has been completed, uses the same shortcut component, and never duplicates.
  const ensureLiberationShortcut = ({ fresh = false } = {}) => {
    const available =
      liberation?.isComplete?.() || liberation?.isPreviewAllowed?.();
    if (!document.body.classList.contains("is-liberating") && available) {
      shortcutsUi.addShortcut(
        {
          id: "liberation",
          titleKey: "app.liberation.title",
          icon: "assets/icons/liberation.svg",
        },
        { fresh },
      );
    }
  };
  ensureLiberationShortcut();
  progression.subscribe((state, change) => {
    if (change?.type === "events:add" && change.id === "liberation-complete") {
      ensureLiberationShortcut({ fresh: true });
    }
  });

  // One coordinator for every deferred desktop event (comprehension lines,
  // Twister encounters, discovery remarks). The schedulers above only register
  // their events; this decides which one may be presented, one at a time.
  eventQueue.configure({
    player,
    isMusicPlaying: () => player.getState().status === "playing",
    isBusy: eventBusy,
  });
  eventQueue.start();

  // Twisters are visual entities only for now. The query-string preview is a
  // development aid: it never records an encounter or touches progression.
  mountTwisterPreview({ root: document.getElementById("twister-layer") });

  let openIds = new Set();
  /* The dock follows the active program, whichever it is. Alerts are not in
     this snapshot, so they never steal M.I.L.O. from the window he watches. */
  let activeWindowId = null;
  let dockRequest = 0;

  manager.subscribe((snapshot) => {
    taskbar.renderTasks(snapshot);
    const current = new Set(snapshot.map((item) => item.id));
    for (const id of openIds) {
      if (!current.has(id)) mascotDialogue?.noteAppClosed(id, current.size);
    }
    openIds = current;

    const active = snapshot.find((item) => item.active) || null;
    const nextActiveId = active?.id || null;
    if (nextActiveId === activeWindowId) return;
    activeWindowId = nextActiveId;

    const request = ++dockRequest;
    if (!nextActiveId) {
      mascot.leaveDock();
      return;
    }

    const target = manager.windowFor(nextActiveId);
    if (!target) return;
    mascot.dockBeside(target).then((arrived) => {
      // A quick window switch may have made this flight stale.
      if (!arrived || request !== dockRequest) return;
      target.dispatchEvent(new CustomEvent("mascot:docked"));
    });
  });

  const refreshSystemText = () => {
    document.documentElement.lang = localeTag();
    document.title = t("system.pageTitle");
    desktop.setAttribute("aria-label", t("system.desktopLabel"));
    layer.setAttribute("aria-label", t("system.windowLayerLabel"));
  };

  refreshSystemText();
  onLocaleChange(refreshSystemText);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
