# holysaga_oS

A personal website shaped like a computer from the late 1990s: a teal desktop,
a taskbar, five Start-menu programs, SIGNALS and four languages. Most of the
rooms are built; a few of them are still waiting for later work.

No build step, no dependencies, no backend, no API keys.

## Run it

```bash
npm run serve                     # then open http://localhost:3000
```

`npm run serve` is a dependency-free Node server that answers HTTP Range
requests, which the real Sacred Digital master needs for seeking. Plain
`python3 -m http.server` serves the site, but cannot seek inside that WAV. Any
static host works (GitHub Pages, Netlify, Cloudflare Pages…): upload the folder
as it is. There is nothing to compile.

## What works

- Desktop with five program shortcuts. Double-click opens them; on touch a
  single tap opens; Enter/Space works on the keyboard. The TRITON chain adds a
  sixth shortcut, SIGNALS, once its event has finished; that shortcut opens the
  real SIGNALS program.
- Windows: drag by the title bar, minimize, restore, close, bring to front with
  correct stacking, no duplicate copies, and they cannot be dragged off screen.
- Taskbar with a Start button, one button per open window (click the focused
  one to minimize it) and a live clock.
- Start menu with the five programs and the language selector.
- Four languages (Portuguese by default, English, Spanish, Russian) that switch
  instantly without closing windows. The choice is remembered in `localStorage`.
- MUSIC PLAYER as an album collection: one slot per known track, each showing
  the artist `HOLYSAGA` and the track's own name in the form `HOLYSAGA — Horizon`. An empty slot waits for its .wav file, the matching file fills
  it with a short animation, and a wrong file is refused. All six tracks ship
  with their real masters, so collecting one enables the transport.
  The transport has a working volume slider, mute, click-or-drag seeking and a
  waveform computed from the real file (with a plain bar as fallback). Its
  visualizer opens as its own window and never interrupts playback.
- Listening comprehension: collecting a track only makes it playable. A track
  must be heard for 70% of its unique duration before its contents are
  understood. Only genuinely played seconds count — paused time, seeks and
  replays do not pad coverage — and coverage persists across refreshes.
  Understood tracks turn antique gold and gain a decoded mark; unread ones stay
  desaturated blue-grey.
- Intrusive thoughts: small system-style alerts drift in after a long stretch
  of visible exploration, one at a time, with a mascot reaction. The library is
  split into personal Twister intrusions and liminal system observations, and
  the two voices never cross. Dismissing one changes nothing else; the history
  is kept so the same line does not loop.
- Twister encounters: the first intrusive thought always brings a Twister, and
  every later one has a 30% chance. The creature hangs onto the alert's lower
  corner, the alert surface is infected with the shared corruption treatment,
  and M.I.L.O. is visibly uncomfortable the first time while he explains what
  they are.
- Corruption with consequences: a Twister's message starts a 30-second grace
  period. Stay past it and small, opaque blocks of missing texture appear
  around that alert until the window is closed; a message without a Twister
  never starts the clock. The blocks live under the icons, never cover a window
  or a label, and are capped at 8% of the workspace.
- Sacred Digital: the first Twister's message ends with one scripted trace,
  M.I.L.O. flies to it and explains what happens when you feed distorted
  thoughts, then `Sacred Digital.wav` lands on the desktop and he says, in
  bold, that it has to be dragged into its matching MUSIC PLAYER slot. Drag it
  onto that slot to collect the track; the brush is **not** unlocked yet. After
  the track has really been heard for 70% of its duration, M.I.L.O. opens a
  persistent explanation of what was decoded and then the cleaning brush
  appears as a highlighted Win98-style button in the taskbar, right after
  Start. He flies to that button while the explanation waits for NEXT, so the
  new tool is easy to find. Dragging the brush over the blocks wipes only what
  it touches, and the desktop returns to normal.
- The TRITON chain: after THE EMPTY HOTEL and THE FLOODING FIELDS are both
  read, M.I.L.O. names the connection and leaves `TRITON.wav` on the desktop
  for the normal manual drop. Its 70% listening gate starts a severe, temporary
  mascot glitch — different from a Twister — and when it resolves the `SIGNALS`
  shortcut appears. That shortcut opens the SIGNALS carrier window: the supplied
  dot-matrix portrait, a dense corrupted transmission around the process
  identifier `soul_trapped`, a short arrival glitch plus randomized portrait
  tears, M.I.L.O.   reactions and the collectible `SIGNALS.wav`. Everything is
  persisted.
- LIBERATION: when all six tracks have been collected and all six dream records
  read, M.I.L.O.'s four-stage realization begins. The final message offers
  YES — BEGIN / NOT NOW. NOT NOW returns to the desktop and leaves a small
  taskbar mark; YES plays `assets/audio/liberation.wav` and opens a temporary
  window event over the desktop. Nature, natural forces, internet culture, the
  SIGNALS portrait, multi-window messages and a clean resolution are all
  synchronized to the supplied track. Completion is permanent and a refresh
  never replays it.
- OUTSIDER.EXE: a complete first-person 3D maze inside the existing window.
  The fixed Poolrooms route takes roughly two minutes: pale tiled rooms and
  turquoise pools, soft ceiling light, then a dark final hall with a narrow
  bridge over almost-black water and a lit exit door. WASD and mouse look,
  collision on every wall and pool edge, pointer capture only while playing,
  separate soundtrack and footsteps/effects sliders, and a pause screen that
  releases the mouse. The drumless downsampled `OUTSIDER` mix is private to the
  maze: it starts with the walk, pauses without losing its position, stops at
  the door or when the window closes, and never enters MUSIC PLAYER or the 70%
  listening gate. Escaping leaves `OUTSIDER.wav` on the desktop for the normal
  manual drop into its matching slot. Completion, first-visit dialogue, the
  collection and the listening reflection all persist.
- Tutorials block: the Twister explanation and the Sacred Digital warning are
  persistent. A shield swallows clicks aimed at anything behind the bubble, the
  close control is hidden, and only their NEXT button moves them forward. The
  ordinary idle and contextual lines never block anything.
- Damaged content (notes, dream records, flagged image frames) uses the shared
  corruption surface described below.
- Mascot: a compact cream robot in the lower-right corner, drawn in inline SVG
  from the approved reference. It speaks in a dismissible retro bubble, with
  ten idle lines and quiet reactions to opening programs, returning to the
  desktop and exploring for a while. All dialogue is translated into the four
  languages and paced by visible time only.
- Responsive: windows shrink to the viewport, shortcuts and the Start menu fit
  small screens.

## What is a placeholder (and says so)

| App | Now | Later |
| --- | --- | --- |
| MUSIC PLAYER | Album slots for the six tracks; all six have real audio, real waveform, volume/mute and seeking; listening coverage and understood state are persisted; placeholder visualizer window | Per-track visuals |
| Intrusive thoughts | 32 local messages in two strictly separated pools — 14 personal Twister intrusions and 18 liminal system/dream/error observations — scheduled one at a time; the mascot answers with a short line | Scripted reactions tied to later events |
| Twisters | First encounter guaranteed and always leaves the scripted corruption; later ones have 30% per message and a 30 s grace period for small traces capped at 8%; Sacred Digital discovery, collectible file, listening gate and brush; second appearance leaves the TWISTERS fragment | The third-encounter event |
| IMAGE DUMP | The creator's photos in a thumbnail grid with a full viewer | Sunset frame grants `Horizon.wav`; corrupted frames repaired with the Sacred brush |
| DREAM LOG | Six localized dream records, all damaged; the Sacred brush cleans six cells per record, partial progress and first-reading reactions persist; reading THE EMPTY HOTEL and THE FLOODING FIELDS grants the TRITON chain | — |
| SIGNALS | Real carrier window with the supplied portrait, randomized portrait tears, a deterministic corrupted transmission around `soul_trapped`, a one-time first-open M.I.L.O. reaction, a pause-gated post-listening reaction, and `SIGNALS.wav` discovery; the same portrait reappears during LIBERATION, still unexplained | Deliberately unresolved |
| NOTES.TXT | Read-only notepad, reserved and corrupted blocks | Real notes, unlocks based on time on the site |

Nothing pretends to work: a track without audio keeps the transport disabled,
and any unavailable content is labelled as unavailable.

## Progress state

`js/core/progression.js` exports a single shared `progression` object. Every
program imports the same store, and the site owns exactly one active timer.

```js
import { progression } from "../core/progression.js";

progression.unlockTrack("track-01");          // false if it was already known
progression.hasTrack("track-01");             // true
progression.addListening("track-01", 12, 19); // genuine playback only
progression.getListeningSeconds("track-01");  // unique seconds, never doubled
progression.unlockUnderstanding("track-01");  // the track has been understood
progression.hasUnderstood("track-01");        // drives the gold archive state
progression.unlockDream("dream-001");
progression.markDreamFragment("dream-002", "shard-3");
progression.getDreamCleaning("dream-002");     // ["shard-3"]
progression.unlockNote("note-03");
progression.unlockTool("sacred-digital-brush");
progression.hasTool("sacred-digital-brush");    // the brush survives a refresh
progression.completeEvent("sunset-frame");    // once only; false afterwards
progression.recordTwister();                  // returns the new total
progression.recordMascotLine("MASCOT_IDLE_03");
progression.getMascotLines();                 // recent line IDs, oldest first
progression.markTutorialShown("music-intro");
progression.getActiveTimeMs();                // accumulated, in milliseconds
progression.subscribe((state, change) => {    // future UI can react
  // change = { type: "tracks:add", id: "track-01" }
});
```

State is saved to `localStorage` under `holysaga:progression` on every change
and every ten seconds for time. Missing, malformed or older saved data is
repaired field by field instead of thrown away, so a corrupted blob cannot
break the desktop. To start over as a new visitor, remove that key (or run
`localStorage.clear()` in the console).

The timer counts only while the page is visible, is shared by the whole site
(switching programs cannot double count), and credits at most one minute per
tick so a sleeping laptop cannot inflate it. `js/main.js` starts it once.

IDs are stable content keys (`track-01`, `dream-001`, `note-02`), never positions
or translated titles, so reordering content or switching language is safe.

## Where to edit things

```
index.html              page shell (desktop, window layer, mounts)
css/base.css            colours, fonts, 3D borders, scrollbars
css/window.css          window chrome and shared window furniture
css/corruption.css      the corrupted-memory surface (one treatment, all apps)
css/desktop.css         desktop, shortcuts, taskbar, Start menu
css/apps.css            the inside of each program
js/main.js              boot: language → window manager → UI
js/core/window-manager.js  open/close/minimize/drag/stacking
js/core/progression.js  shared progress state + the site-wide active timer
js/core/player.js       shared audio element, volume/mute/seeking (outlives every window)
js/core/listening.js    unique listening coverage + the 70% understanding gate
js/core/waveform.js     real peaks from the audio file (WAV parser, decode fallback)
js/core/intrusive-thoughts.js  prompt scheduler, alert dialogs, mascot reaction
js/core/twister-encounters.js  spawn policy, infected alert, attached Twister, M.I.L.O.'s reaction
js/core/mascot-dialogue.js  mascot scheduler: visible time, idle + context lines
js/core/first-contact.js    one-time M.I.L.O. intro; tutorial/event IDs
js/ui/mascot.js         mascot robot SVG, bubble, active-window docking and flight
js/ui/twister.js        Twister SVG, visual states, placement and dev preview
js/core/desktop-corruption.js  grace period, patch schedule, coverage cap, cleaning
js/core/sacred-digital.js      first discovery scene, file/tool restore, brush toggle
js/core/horizon.js      sunset discovery, file restore, listening reflection
js/core/twisters.js     second-Twister fragment and listening reflection
js/core/outsider.js     OUTSIDER listening reflection, once after 70%
js/core/liberation.js  final four-stage realization, YES/NOT NOW, audio-driven desktop event
js/data/liberation.js  final dialogue keys, image catalogue, cue timeline, event IDs
css/liberation.css     the temporary event layer, windows and taskbar entry
assets/liberation/     curated nature / force / internet-culture images + CREDITS.md
js/ui/desktop-files.js  collectible .wav icon, pointer drag-and-drop, the taskbar tool button
js/ui/cleaning-brush.js cursor brush; cleans desktop traces and registered in-window surfaces
js/ui/corruption.js     reusable corruption surface + recovery transition
js/core/dom.js          tiny element helper
js/core/storage.js      localStorage wrapper
js/apps/*.js            one module per program (registry.js lists them)
js/apps/outsider/*.js   fixed maze level, WebGL renderer, movement, private audio
js/data/*.js            YOUR CONTENT lives here
js/data/thoughts.js     intrusive-thought library + scheduling defaults
js/data/mascot-dialogue.js  mascot lines, stable IDs, pacing defaults
js/i18n/{pt,en,es,ru}.js  interface strings
js/i18n/index.js        t(), setLocale(), LOCALES
js/i18n/apply.js        data-i18n attribute binding
tools/make-icons.mjs    pixel icons → assets/icons/*.svg
tools/check-i18n.mjs    verifies the four dictionaries share the same keys
tools/corruption-preview.html  all corruption intensities + the recover transition
```

### Images

Edit `js/data/images.js`. Each entry is either a CSS placeholder or a real
image:

```js
{ id: "frame-07", colors: ["#31594f", "#7f9d90"], src: null, captionKey: null }
```

Drop your file in `assets/photos/`, set `src: "assets/photos/sunset.jpg"`, and
the tile shows the photo instead of the placeholder. Captions can be a plain
string (`caption: "…"`) or a translation key (`captionKey: "images.item.sky"`)
added to all four dictionaries.

### Dreams and notes

`js/data/dreams.js` holds six stable records. Their titles and bodies live in
the four dictionaries, split into paragraphs by blank lines. Each record starts
with six damaged cells; `js/apps/dreams.js` renders the readable text beneath
shared corruption canvases and registers that surface with the one Sacred
Digital brush. Cleaning a cell stores its stable shard ID in
`progression.dreamCleaning`; cleaning the sixth unlocks the record in
`progression.dreams` and shows that record's M.I.L.O. reaction once, recorded as
a `dream-read:<id>` event.

`js/data/notes.js` remains an array of slots. Set `status: "read"` and put your
lines in `text: [...]` to publish one; other slots stay labelled as reserved,
corrupted or locked.

### Music

`js/data/music.js` lists the six known entries — Twisters, Horizon, Sacred
Digital, Outsider, Triton and Signals — with stable IDs and the shared display
artist `HOLYSAGA`.
The slot list and the now-playing line render `HOLYSAGA — <track title>`, while
`title` itself keeps its established capitalization for internal use and the
visualizer. Sacred Digital, HORIZON, Twisters and Outsider point at their real
masters: `assets/audio/sacred-digital.wav` (48 kHz, 24-bit stereo, 3:12),
`assets/audio/horizon.wav` (48 kHz, 24-bit stereo, 2:44),
`assets/audio/twisters.wav` (48 kHz, 24-bit stereo, 2:59),
`assets/audio/outsider.wav` (48 kHz, 24-bit stereo, 2:43),
`assets/audio/triton.wav` (48 kHz, 24-bit stereo, 3:09) and
`assets/audio/signals.wav` (48 kHz, 24-bit stereo, 2:53). Cover art and the
final album order are still absent.

- Discovery is read from the shared progression store. A track is playable
  only after `progression.unlockTrack("<id>")` is called somewhere; a file on
disk never collects itself. Unlocking elsewhere updates the open window
  immediately.
- `src` and collection are independent: the audio is installed, but MUSIC
  PLAYER keeps every track locked until its desktop `.wav` is dropped into the
  matching slot. Sacred Digital's file comes from its intro; `Horizon.wav` from
  the sunset discovery; `TWISTERS.wav` from the second Twister; `OUTSIDER.wav`
  from escaping the maze. No file on disk collects itself.
- To connect real audio, drop a file in `assets/audio/` and set `src` on the
  entry. The shared player then enables play/pause, the volume slider, mute,
  the progress readout and seeking. With `src: null` the transport stays
  disabled and the window says the audio is not installed.
- Listening: each entry may set `understandAt` (default `0.7`, its share of
  the total duration). `js/core/listening.js` watches the shared player and
  credits only forward steps under 1.5 s; seeks bump `seekCount` and reset the
  baseline, and pausing stops it. `js/core/progression.js` merges the heard
  ranges, so replaying a section never raises unique coverage twice. Reaching
  the threshold calls `unlockUnderstanding(id)`. Both coverage and the flag are
  saved in `holysaga:progression`; nothing resets when the window closes.
- `js/core/player.js` owns volume and mute too (`holysaga:volume`,
  `holysaga:muted`), so the chosen level follows the visitor between windows
  and reloads. Moving the slider above zero unmutes.
- HORIZON's sequence lives in `js/core/horizon.js`. Opening the full
  `sunset.png` viewer (not the gallery) records the stable `sunset-frame`
  event, places `Horizon.wav` on the desktop through the shared file layer,
  and shows `mascot.horizon.discovery` as a persistent NEXT tutorial. The
  dialogue is marked as displayed immediately, so refreshing or reopening the
  image does not repeat it. The track stays locked until the visitor drags that
  file onto its matching MUSIC PLAYER slot; only that successful drop calls
  `unlockTrack("horizon")`. If the file has not been collected, it is restored
  on reload. Once the shared 70% unique-listening gate marks the track
  understood, the one-time `mascot.horizon.understood` reflection appears. Its
  antique-gold state comes from the same `is-understood` classes as every other
  track. This controller never touches Sacred Digital, the brush or any other
  track.
- Twisters' fragment lives in `js/core/twisters.js`. It subscribes to the
  lifetime encounter counter that `twister-encounters.js` writes only when a
  real creature is attached, so ordinary intrusive thoughts and the preview
  page never count. The first appearance is ignored; the second records
  `twisters-fragment`, places `TWISTERS.wav` on the desktop and shows one short,
  non-blocking remark — no repeated import tutorial. The track stays locked
  until the file is dropped on its slot. If uncollected, the file is restored
  on reload. At the shared 70% unique-listening gate, the one-time reflection
  appears and the slot uses the normal understood state. Twister probability,
  corruption and Sacred Digital are untouched.
- OUTSIDER's reward and reflection live apart on purpose.
  `js/apps/outsider/audio.js` owns a private `Audio` element for the
  downsampled maze mix, so it is never handed to the shared player or the
  listening tracker. `js/apps/outsider.js` records
  `outsider-maze-complete`, restores a missing `OUTSIDER.wav` after a refresh
  and never repeats the completion dialogue or file grant. The full master is
  the only collectible; `js/core/outsider.js` watches the shared store and
  shows `mascot.outsider.understood` once after the normal 70% gate.
- The waveform comes from the file itself: `js/core/waveform.js` parses RIFF/WAV
  peaks directly (no second decoded copy of the master) and falls back to
  `decodeAudioData` for compressed formats. If neither works, the plain
  progress bar stays; no decorative waveform is ever invented.
- Playback lives in `js/core/player.js`, not in a window. Closing or minimizing
  MUSIC PLAYER or the VISUALIZER does not stop the audio; only the stop button
  or selecting another track resets it.
- The VISUALIZER opens from the player's button as its own window and shows a
  deterministic placeholder signal per track. It is not a desktop shortcut or
  a Start menu entry, and closing it never touches playback.

### TRITON, the connection and SIGNALS

`js/core/triton.js` owns this chain and nothing else. It reads the shared
dream, event, track, listening, file and shortcut state, so no second store or
player exists.

1. `dream-003` (THE EMPTY HOTEL) and `dream-006` (THE FLOODING FIELDS) must both
   be cleaned and read. Either order works. `dream-connection` is recorded once
   and M.I.L.O. names both records; only after that line does `TRITON.wav`
   appear in the desktop file column. The file is restored on reload if it was
   never collected, and the MUSIC PLAYER slot stays locked before discovery.
2. The visitor must drag `TRITON.wav` onto its matching slot. Nothing is
   auto-collected or auto-played, and the normal shared player and unique
   listening tracker handle the rest. The track is in
   `assets/audio/triton.wav` and uses the same 70% `understandAt` threshold.
3. At 70% unique coverage, `triton-glitch` begins. It is a temporary mascot and
   overlay state: duplicated SVG positions, stepped frame cuts, fragmented
   lines and short holds, removed in `finally`. It does not use a Twister, does
   not corrupt the desktop, does not close windows and does not touch files or
   progress. The four lines make the escalation explicit: M.I.L.O. reaches an
   unfamiliar boundary, says he has reached the edge of the human unconscious,
   cannot process it, and is afraid. A final line resolves the state, and only
   a subtle `is-triton-scarred` filter remains.
4. `signals-comment` follows: `SIGNALS` is added through
   `createShortcuts().addShortcut()` with `fresh: true`, so it uses the ordinary
   shortcut look and arrives once. Existing state passes `fresh: false`, so a
   refresh neither replays the animation nor creates a duplicate. The shortcut
   opens the real SIGNALS carrier window; the program is intentionally absent
   from `APPS` so no second boot shortcut or Start-menu entry is created.
   M.I.L.O.'s one comment says he noticed it after the event, does not know what
   it does, and does not know whether it is connected to TRITON.

The chain is deliberately independent of Twister counts, Sacred Digital, the
brush and the other track discoveries. `TRITON_STORY` in
`js/core/triton.js` holds the stable IDs and event names.

### SIGNALS

`js/apps/signals.js` is the real program behind the granted shortcut. It is
registered in `APP_BY_ID` but not in `APPS`: the window manager can open it,
while the desktop and Start menu cannot create a premature duplicate. The
window is a dark carrier readout, not a message box:

- the left column displays the supplied dot-matrix portrait image exactly as
  received in `assets/signals/portrait.png` (416×536), inside the tagged
  `data-portrait-slot="signals-portrait"` frame;
- the right column is a deterministic 48-line corruption field with a clipped
  second field and scanlines. The recognizable anchor is `soul_trapped`,
  repeated as `soul_trapped.exe`, `process://soul_trapped` and
  `memory_reference: soul_trapped`. A normal-size terminal line at the bottom
  shows `process://soul_trapped.exe`; it uses the same monospace face, size and
  spacing as the surrounding data. The text is generated from stable numbers,
  hexadecimal, combining marks and Unicode symbols, never ordinary explanatory
  prose;
- a short stepped arrival animation tears the portrait, flickers the data and
  interrupts the command line. After it settles, irregular random bursts tear,
  drop and duplicate the portrait for a fraction of a second. The interval and
  variant are chosen in `js/apps/signals.js`; CSS supplies the interrupted
  frames. `prefers-reduced-motion` removes both the arrival and the random
  bursts but leaves the content visible.

`js/core/signals.js` owns only the discovery state. The first real mount records
`signals-opened`; after the opening animation M.I.L.O. says
`mascot.signals.opened` once and that records `signals-reaction`. Only then does
`SIGNALS.wav` join the desktop through the shared file layer. The reaction and
file are restored after a reload until the track is collected. The file uses the
normal `SIGNALS` MUSIC PLAYER slot, so collecting, playback, unique coverage,
70% comprehension and persistence are all the existing systems.

At 70% unique coverage the shared tracker marks `signals` understood and the
controller records `signals-listening-ready`, but says nothing while the track
keeps playing. Only a visitor-requested pause of the SIGNALS track opens
`mascot.signals.trapped`; `signals-listening-reaction` then makes it permanent.
The controller never calls play or pause, so reaching the threshold, seeking or
letting the track run cannot interrupt playback. If M.I.L.O. is busy at that
pause the line stays ready for the next manual pause.

### LIBERATION (final sequence)

`js/core/liberation.js` owns the last narrative. It deliberately adds no app,
no shortcut, no collectible track and no second progression store.

The gate is the authoritative archive: every entry in `tracks`
(`js/data/music.js`) must satisfy `progression.hasTrack(id)`, and every entry in
`dreamPages` (`js/data/dreams.js`) must satisfy `progression.hasDream(id)`.
Notes are still reserved slots, and images are always available, so neither is
a gate. The event IDs are stable:

- `liberation-dialogue-1` … `liberation-dialogue-4` — one stage each, written
  only after the visitor presses CONTINUAR;
- `liberation-choice-ready` — the final message has been shown; this also
  restores the taskbar entry after NOT NOW or a refresh;
- `liberation-complete` — the sequence really finished. It is written once.

Stages use the existing `mascot.showDialog({ persistent: true })`, so they are
manual, localised and covered by the existing shield. The final message adds a
secondary action (`AGORA NÃO` / `NOT NOW`) through the same component. NOT NOW
closes the dialogue and leaves the small `✦` taskbar entry; clicking it later
reopens only the final message and choice, never the four-stage realization.

YES starts one dedicated `Audio` element with `assets/audio/liberation.wav`.
It is not the shared collectible player, so it cannot unlock listening
coverage or add a MUSIC PLAYER file. If the shared player was playing, it is
paused with reason `"liberation"` (which does not increment the SIGNALS pause
gate) and resumed after the event. All visible cues are in `LIBERATION_TIMELINE`
in `js/data/liberation.js`; they are fired from `audio.currentTime`, not a
separate timer, so the escalation, peak and quiet ending cannot drift from the
soundtrack.

Each cue creates a temporary `.window` inside `.liberation-layer`. These
windows are not registered with the window manager: they never appear in the
taskbar, never change an open program and are all removed on completion. The
event reads the same `assets/signals/portrait.png` as SIGNALS and never invents
a second face. `lib-word` windows are independent title-bar windows; a
composition splits the localised sentence into one window per word.

A refresh during the sequence leaves no lock: the layer is in-memory only and
the next visit gets the normal desktop plus the taskbar entry. Completion is
recorded only by the audio reaching its end (or the bounded fallback), never by
simply opening the event. Image licences and sources are listed in
`assets/liberation/CREDITS.md`.

Preview the sequence during development with `/?liberation`: the
`LIBERATION.EXE` shortcut and the `✦` taskbar entry appear without a single
collected fragment, and starting it plays the same event — soundtrack, cues and
final screen — without writing an event ID, unlocking a track or adding
listening coverage. Without the parameter the normal progression gate applies.

### Intrusive thoughts

`js/data/thoughts.js` holds 32 messages in two strictly separated pools, each
entry declared explicitly:

- `twister` — 14 personal intrusive thoughts about money, rent, time,
  productivity, unfinished work, guilt, appearance, comparison and the fear of
  not being enough. They can only appear on a window that really carries a
  Twister. Their category label is the localized `thought.category.doubt`,
  now “intrusive thought”.
- `system` — 18 liminal observations, dream fragments and broken scripts about
  memory, files, rooms, time and the desktop. They never contain personal
  criticism, financial pressure or productivity judgments, and can only appear
  without a Twister. `CRYPTIC_*` are observations and `ERROR_*` are technical
  failures; the latter keep code-like English terminology in every language.

Each entry only references two translation keys; the Portuguese text in `pt.js`
is the canonical source and the other three languages carry natural
translations. To add a message, append the entry with its `pool` and the two
keys in all four dictionaries — nothing else changes.

`js/core/intrusive-thoughts.js` runs one scheduler for the whole desktop:

- the first message waits 50–100 s of visible time, then one appears every
  75–160 s, never more than one at a time and never more than 12 per visit;
- the countdown only advances while the tab is visible, so background time
  cannot queue a burst;
- unseen messages are preferred, and the last 8 are skipped once the library
  has been seen; the trail is saved in `progression` as `thoughts`;
- the encounter roll happens once, as before, and then chooses the voice: a
  Twister window is replaced with a `twister`-pool message, while an ordinary
  window is replaced with a `system`-pool message. The temporary scheduler pick
  cannot leak one pool into the other;
- `hold("minigame")` / `release("minigame")` silence it while a tutorial,
  minigame or cleanup mechanic is open;
- dismissing a message records only its ID. It never unlocks a track, records
  a Twister encounter or completes a narrative event.

The alert is a real window-manager dialog: same frame, dragging and clamping,
but no taskbar button, no minimize control and no automatic keyboard focus.
Closing it with X, Escape or its button is equivalent. Alerts are not in the
app registry, so no sixth desktop shortcut or Start menu entry was added.

Frequency lives in `THOUGHT_CONFIG` in the same data file. The mascot's six
replies are `mascot.react.*` keys; `react()` on the mascot component is the
same hook future scripted dialogue can use.

Titles and bodies resolve through `thought.<ID>.title` and `thought.<ID>.body`.
A missing translation falls back to Portuguese, and an unknown or broken entry
shows the localized `thought.fallback.*` system error. Visible text is never a
dictionary key or an internal ID.

### Twister encounters

Twisters ride on intrusive thoughts. `js/core/twister-encounters.js` decides and
presents; it never schedules, never writes message text and never opens a second
dialog system.

- The first intrusive thought always brings one. Afterwards every new message
  rolls once, independently: 30% chance. A successful roll uses a personal
  `twister`-pool message; a failed roll uses a liminal `system`-pool message,
  with no creature and no corruption.
- Two stable IDs in the shared progression store make that survive a refresh:
  `events` records `twister-first-encounter` (the guarantee is spent) and
  `tutorials` records `twister-intro` (the explanation was shown), both written
the moment the creature appears. `twisters` keeps the lifetime count.
- The creature is the existing SVG from `js/ui/twister.js`, placed flush against
  the alert's lower corner with `placeTwister()` and kept there while the dialog
  is dragged. Only 8px of the coil overlaps the frame, so no text is hidden, and
  a dialog on M.I.L.O.'s side gets the creature on its left.
- The alert keeps its layout and voice, but the frame goes dark and
  `applyCorruption()` covers it with the shared surface at `subtle`, masked away
  from the centre so the message stays readable.
- M.I.L.O.'s first reaction is one class on the dock (`.is-uneasy`): raised
  inner brows, a small downturned mouth and a held fidget. His ordinary look is
  untouched — the expression is drawn once and stays transparent at rest. Two
  dialogue steps then explain the Twisters and warn about giving them attention.
- The first encounter's corruption is scripted, not rolled: closing its alert
  always runs `js/core/sacred-digital.js` once, which places the opaque trace
  before M.I.L.O. explains it (recorded as `sacred-digital-discovery`, so it can
  never repeat). Later encounters keep the randomized timer-based traces above;
  an ordinary thought never starts either of them.
- Later encounters use one of three short `mascot.twister.again.*` lines and
  never repeat the explanation or the fear animation.

Deliberately absent: the third-encounter event, and any corruption that survives
a reload.

### Sacred Digital

`js/core/desktop-corruption.js` owns the traces a Twister leaves behind:

- nothing is tracked until an infected message window is open;
- `DESKTOP_CORRUPTION.graceMs` (30 s) is the grace period, then
  `intervalMinMs`–`intervalMaxMs` (4.5–8 s) add one small patch at a time;
- closing the window stops the schedule immediately, and a reload starts clean —
  a saved corrupted state could strand a visitor without the brush;
- each patch is an opaque missing-texture grid: 9 px cells in dark teal,
  near-black and muted cyan (with a few bright flecks), snapped to `cellPx`, so
  its silhouette steps instead of feathering. No gradient, blur, mask or
  transparency is involved. Placement skips the icon columns, M.I.L.O., the
  tool and every open window, with a 10 px margin, and the layer sits under the
  icons so nothing clickable is covered;
- an encounter is anchored to its alert: the alert's box is recorded when the
  message opens, and every trace of that encounter stays within
  `anchorPadding` (110 px) of that spot, clamped to the workspace. Dragging the
  window afterwards does not move the corruption — it belongs to the area where
  the encounter happened. A message without a Twister never calls this at all;
- coverage is capped by `maxCoverage` (8% of the workspace) and `maxPatches`
  (14), measured on each patch's painted area rather than its bounding box;
- positions come from a generator seeded once per encounter, so one encounter
  keeps a stable layout while the next one looks different.

`js/core/sacred-digital.js` runs the first-discovery scene: it writes
`sacred-digital-discovery` before the first patch exists (so a reload mid-scene
cannot replay it), spawns one patch, flies M.I.L.O. to it with the existing
`dockBeside()`, shows `mascot.sacred.discovery` as a blocking tutorial, then
gives `Sacred Digital.wav` and records `sacred-digital-file`. Back at his
corner he then says `mascot.sacred.drag` — a non-blocking line, because the
visitor has to be able to drag the file. The `**…**` markers in any dialogue
become `<strong>` elements in his bubble; a translation is never parsed as HTML.

Tutorial dialogues pass `persistent: true` to `mascot.showDialog()`. That mode
hides the close control, ignores every `hide()`/`showLine()` from other modules,
and places a `.tutorial-shield` between the bubble and the desktop, so windows,
icons, the taskbar and the Start menu cannot be used until the final NEXT. The
blocking state is released by `endTutorial()`, which the owning controller also
calls from `destroy()` and around its action handler — an interrupted or broken
step can never leave the desktop locked.

`js/ui/desktop-files.js` renders the file in its own icon column, drags it with
a pointer-tracked ghost, and dispatches `holysaga:file-drop` on whatever
collection slot is under the pointer. A slot accepts by calling
`preventDefault()`. Payloads carry the stable track ID, so a renamed file is
still judged by identity. MUSIC PLAYER's slots then call
`progression.unlockTrack()` — that alone unlocks nothing. Once
`js/core/listening.js` reports 70% unique coverage and the store emits
`understood:add`, the sacred controller opens the new explanation as a
persistent tutorial, then unlocks `sacred-digital-brush`, which is what adds
the brush button to the taskbar's `.taskbar__tools` strip. That strip is a fixed
flex slot between the Start button and the window buttons, so the tool can
never overlap Start, the tasks or the clock, and it stays visible while windows
are open. The moment the button exists, M.I.L.O. uses the shared `dockBeside()`
flight to stop beside it and stays there while the explanation is on screen.
NEXT ends the tutorial and releases the desktop; the tool itself was already
unlocked and never resets. The button is a 26 × 24 raised Win98 control whose
only label is a 16 px pixel-art brush (`shape-rendering: crispEdges`); pressing
it toggles the existing brush and shows the active state as a sunken, dithered
face with `aria-pressed="true"`.

The first unlock adds a six-beat, 5.4 s stepped cyan edge highlight
(`.is-fresh`) — never a badge — then returns to ordinary chrome, or stops early
on the first click. A restored button passes `fresh: false`, so a refresh keeps
the tool but does not replay the introduction. Unlocking alone never arms the
brush.

`js/ui/cleaning-brush.js` follows the pointer, ignores anything interactive
(`.window`, `.mascot`, `.shortcut`, `.deskfile`) and asks the corruption layer
to clean at each sample point. Cleaning removes whole texture cells, nearest
the pointer first. With the desktop clean the brush puts itself away; the tool
stays available for the next encounter.

While armed, the brush also takes priority over desktop selection: it cancels
`mousedown`, `selectstart` and `dragstart` on the wallpaper, and a capture-phase
click/double-click swallows presses on icons and filenames. A stroke therefore
never selects, focuses, opens or drags a desktop item, and no text-selection
rectangle can start. Windows keep their own text selection (`.window` is
exempt). The CSS side matches: `.desktop.is-brush-active` sets `user-select:
None` and its icons lose `-webkit-user-drag`. Every listener is added on arming
and removed on deactivation, so ordinary desktop interaction — and the taskbar
and Start menu, which live outside `.desktop` — is untouched while idle.

Adding a future file: append the track to `js/data/music.js` (it gets a slot
automatically), call `desktopFiles.addFile({ id, trackId })` when its file is
found, and drop it in — nothing in the player is per-track.

### Corrupted memory

`js/ui/corruption.js` is one reusable surface for anything explicitly damaged:
corrupted notes, corrupted dream records, corrupted image frames and (later)
unavailable memory fragments. No program draws its own glitch style.

```js
import {
  applyCorruption,
  createCorruptionBlock,
} from "../ui/corruption.js";

// Cover content that already exists (adds .corrupt-host for positioning).
const overlay = applyCorruption(host, { intensity: "heavy", seed: item.id });

// Or drop a standalone damaged panel with a localized caption.
const { el, controller } = createCorruptionBlock({
  intensity: "medium",        // "subtle" | "medium" | "heavy"
  caption: t("dreams.corruptedBody"),
  height: 52,
  seed: page.id,
});
```

Three layers make up the surface: a very dark teal field, a scattered glyph
layer, and CRT dressing. The glyphs are drawn into a canvas as ragged clusters
rather than a grid — character fragments, short horizontal and vertical line
stubs, dot groups, small grid boxes, 1px bits and occasional oversized
fragments, in muted teal to pale cyan at varied opacity, including the edges
and corners. Over them sit fine horizontal scanlines, faint interference lines
that drift a few pixels, grain, a slow flicker of the whole field and a rare
short tear. Glyphs are painted only on mount and resize, so the effect costs
nothing per frame, and seeded randomness keeps each block identical across
redraws. A second canvas holds a subset of the glyphs that steps down and back
up in opacity, so small groups flicker without repainting anything.

`controller.recover({ duration })` is the recovery transition: the glyph field
is erased from the top down while it fades, revealing whatever sits underneath
— damaged data being reconstructed, not a loading spinner. The Sacred brush
calls it when a patch is scrubbed away, and any future repair mechanic can do
the same. With `prefers-reduced-motion: reduce` the flicker and the dissolve are
skipped and the field is removed at once.

Current integrations: DREAM LOG's six-cell damaged records (`medium`/`heavy`,
cleaned in place by the Sacred brush), NOTES.TXT corrupted blocks (`subtle`) and
IMAGE DUMP frames marked `status: "corrupted"` (`heavy`).
Call `controller.destroy()` when rebuilding a list so its `ResizeObserver` is
released. `tools/corruption-preview.html` shows all three intensities and a
recover button during development.

### Twisters

`js/ui/twister.js` is the reusable visual only: a spherical head fused to the
widest coil of a spring that tapers to a narrow point below, with low-opacity
smoke and CSS motion.
It never reads or writes progression, so previewing one cannot record an
encounter, unlock “Twisters” or touch thought history. Real encounter logic
should decide when to spawn it and call `progression.recordTwister()` itself.

States are visual: `first` (arrival), `idle`, `thought` (paler, near an
alert), `unsettling` (darker, heavier smoke). The mascot stays a separate
component — its existing `react()` hook is where a nervous or afraid reaction
should live later.

Preview one during development by adding a query parameter — no shortcut, no
menu entry:

```
/?twister=idle
/?twister=first
/?twister=thought
/?twister=unsettling
```

The preview is clamped inside the desktop layer and the layer is
`pointer-events: none`, so it cannot cover shortcuts, windows or the taskbar.
For an encounter beside a window, create one with `createTwister({ state })`
and append it to the container you want; `placeTwister()` clamps it.

### Translations

Add a key to `js/i18n/pt.js`, then the same key to `en.js`, `es.js` and `ru.js`.
Use it from HTML with `data-i18n="group.key"` (also `data-i18n-title`,
`data-i18n-aria-label`) or from JavaScript with `t("group.key")`.
`npm run check` fails if the dictionaries drift or a value is empty.

The five Start-menu program names (`MUSIC PLAYER`, `IMAGE DUMP`, `DREAM LOG`,
`OUTSIDER.EXE`, `NOTES.TXT`) are kept as program names in every language, but
they are still dictionary entries — change `app.*.title` in the four files if
you would rather translate them. `SIGNALS` is a sixth program, deliberately
absent from the Start menu, and is also a dictionary entry
(`app.signals.title`).

### Icons

Icons are 16×16 character maps in `tools/make-icons.mjs`. Edit a map, run
`npm run icons`, and the SVGs in `assets/icons/` are rewritten. The runtime
SIGNALS icon is a standalone 16×16 pixel SVG rather than a generated character
map, because its shortcut is granted by the story instead of booting with the
five Start-menu programs.

### Desktop look and the mascot

The wallpaper (woven teal, grain, vignette) and the circular shortcut medallions
live in `css/desktop.css`. Shortcut labels use `--font-label` from
`css/base.css` at a small fixed size, not an image font, so they still follow
the translation dictionaries.

`js/ui/mascot.js` draws the robot inline (cream square body, black feet, teal
antenna and screen) and owns the bubble. At rest the dock sits at z-index 8,
below every window and the taskbar, so it never covers a program. The root layer
is click-through; only the robot and bubble accept the pointer.

When a program is active, the dock follows it: the window manager publishes the
active window and `dockBeside()` measures that element's live rectangle and its
title-bar controls. The robot stops 12px outside the right edge, 14px below the
top, with the bubble 12px further right. A side dock is used only when the
complete robot-plus-bubble stack fits outside the window; otherwise it mirrors
to the left shoulder. The bubble narrows to the measured free space, down to
120px. The measured controls box, including the X button, is kept clear by an
additional 8px, so clamping can never put either the robot or his dialogue over
the close control. If neither shoulder can hold the minimum stack, he returns
to the normal desktop corner instead of overlapping the title bar, with the
bubble opening inward and upward as needed. A bubble near the lower edge is
anchored to the robot's feet, and long lines scroll inside the bubble.
The docked root raises itself above the window layer (400); a speaking bubble
uses the existing 9999 layer. Switching, minimizing or closing windows moves
the dock to the next most recent program, and closing the last one sends it
home. Both the initial dock flight and the return home use the same
`setDockOffset()` transform transition and eased curve, so the destination is
never applied without motion. One `ResizeObserver` plus one `MutationObserver`
per active window, coalesced into a single animation frame, handle drags, live
resizes and restoring; viewport resizes invalidate the cached target bounds so
the home corner is remeasured too. Observer startup and style-only callbacks are ignored
so they cannot cut a flight short. A genuine drag or resize retargets with a
short 180ms eased move from the currently rendered position, never a jump.
No second animation timer is introduced.

The robot floats 6px on a 3.6-second ease-in-out loop, and its screen blinks
with a 150ms shutter at irregular 3–7-second intervals. The float is CSS on the
SVG, so the button box and desktop layout never move; the blink is scheduled in
JavaScript and pauses with the tab. Both are disabled by
`prefers-reduced-motion: reduce`, and no animation library is used.

On a browser's first visit, M.I.L.O. introduces himself in two steps and holds
idle dialogue and intrusive thoughts until the visitor finishes or closes the
introduction. The sequence uses the mascot's existing bubble, with one localized
Continue/Finish button. `progression.tutorials` records `milo-first-contact` as
soon as it opens (so a refresh or early close never repeats it), while
`progression.events` records the same ID only when the visitor finishes. Later
narrative events can read those two records without coupling to the intro.

Dialogue is split in three so content stays editable without touching layout:

- `js/data/mascot-dialogue.js` — the 10 idle lines and 6 context lines, each
  with a stable ID and an i18n key, plus `MASCOT_DIALOGUE_CONFIG` (first delay
  22–38 s, later gaps 80–150 s, context cooldown 2 min, 45% chance, 10–14 s
  hold, exploration marks at 3 and 10 minutes).
- `js/core/mascot-dialogue.js` — one scheduler. It counts only visible time,
  pauses while the tab is hidden or a thought dialog is open, refuses to open a
  second bubble, avoids the previous line and unseen lines first, and stores
  shown IDs in the `mascot` collection of the progression store.
- `js/ui/mascot.js` — renders `t(key)` into the bubble; clicking the × or the
  robot dismisses it. It also keeps `showLine({ key, tone, holdMs })` and the
  original `say` / `react` hooks used by intrusive thoughts.

`js/main.js` calls `noteAppOpened(id)` for the five Start-menu shortcuts, and
`noteAppClosed(id, remaining)` from the window-manager subscription when a
window closes back to an empty desktop. SIGNALS is deliberately excluded from
the generic opened line so its dedicated first-open reaction has priority.
Future story beats can call
`mascotDialogue.speak("mascot.event.twister.first")` (add that key to all four
dictionaries) without changing the scheduler; no event dialogue is implemented
yet.

## Adding a future mechanic

1. Add an app module in `js/apps/` exporting `{ id, titleKey, icon, size, mount }`.
2. Register it in `js/apps/registry.js`.
3. That is enough for a shortcut, a Start menu entry and a taskbar button —
   `mount(body, { close, focus })` owns everything inside the window.

Track unlocks, notifications, the mascot, twisters and visualizers can all be
separate modules opened through the same window manager; the desktop never
needs to be rewritten.
