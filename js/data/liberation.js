/**
 * LIBERATION — the final sequence's content and score.
 *
 * This file owns no progress and no DOM. The controller in
 * js/core/liberation.js decides when it is available, persists its stable event
 * IDs, and turns each cue into one temporary window. The dialogue, choice and
 * every visible message live in the four dictionaries.
 *
 * The cue times were measured against assets/audio/liberation.wav
 * (178.60464583333334 s) and follow the real musical sections:
 *
 *   0:00 – 1:17   the opening: images and their short text companions
 *   1:17          the musical break — the LIBERATION title returns, centered
 *   1:17 – 1:31   restrained glitches around the title
 *   1:31 – 1:40   the glitches escalate continuously
 *   1:40          the second drop — the information barrage begins
 *   2:27 onward   resolution, the final message, the desktop returns
 *
 * Opening the windows from the audio's own playhead keeps the desktop and the
 * music together even if playback stutters.
 *
 * `signals` reuses the existing portrait. It is not a new character, a new app
 * or a collectible: the same face simply keeps appearing in the crowd.
 */

export const LIBERATION = Object.freeze({
  audio: "assets/audio/liberation.wav",
  duration: 178.60464583333334,
  signalsPortrait: "assets/signals/portrait.png",
  holdReason: "liberation",
  completeEvent: "liberation-complete",
  choiceReadyEvent: "liberation-choice-ready",
  dialogue: Object.freeze([
    Object.freeze({
      id: "liberation-dialogue-1",
      bodyKey: "liberation.dialogue.1",
      actionKey: "liberation.continue",
    }),
    Object.freeze({
      id: "liberation-dialogue-2",
      bodyKey: "liberation.dialogue.2",
      actionKey: "liberation.continue",
    }),
    Object.freeze({
      id: "liberation-dialogue-3",
      bodyKey: "liberation.dialogue.3",
      actionKey: "liberation.continue",
    }),
    Object.freeze({
      id: "liberation-dialogue-4",
      bodyKey: "liberation.dialogue.4",
      actionKey: "liberation.continue",
    }),
  ]),
  choice: Object.freeze({
    bodyKey: "liberation.final",
    actionKey: "liberation.begin",
    secondaryActionKey: "liberation.notNow",
  }),
});

/** Stable image keys. Relative paths so the site works from any subfolder. */
export const LIBERATION_ASSETS = Object.freeze({
  forest: { src: "assets/liberation/forest.jpg", label: "FOREST_01" },
  mountain: { src: "assets/liberation/mountain.jpg", label: "MOUNTAIN_02" },
  coast: { src: "assets/liberation/coast.jpg", label: "COAST_03" },
  falls: { src: "assets/liberation/falls.jpg", label: "FALLS_04" },
  deer: { src: "assets/liberation/deer.jpg", label: "WILDLIFE_05" },
  birds: { src: "assets/liberation/birds.jpg", label: "BIRDS_06" },
  sky: { src: "assets/liberation/sky.jpg", label: "SKY_07" },
  aerial: { src: "assets/liberation/aerial.jpg", label: "AERIAL_08" },
  hurricane: { src: "assets/liberation/hurricane.jpg", label: "CYCLONE_11" },
  volcano: { src: "assets/liberation/volcano.jpg", label: "VOLCANO_12" },
  wave: { src: "assets/liberation/wave.jpg", label: "WAVE_13" },
  flood: { src: "assets/liberation/flood.jpg", label: "FLOOD_14" },
  fire: { src: "assets/liberation/fire.jpg", label: "FIRE_15" },
  supercell: { src: "assets/liberation/supercell.jpg", label: "SUPERCELL_16" },
  cosplay: { src: "assets/liberation/cosplay.jpg", label: "COSPLAY_21" },
  arcade: { src: "assets/liberation/arcade.jpg", label: "ARCADE_22" },
  computer: { src: "assets/liberation/computer.jpg", label: "MACHINE_23" },
  controller: { src: "assets/liberation/controller.jpg", label: "INPUT_24" },
  graffiti: { src: "assets/liberation/graffiti.jpg", label: "GRAFFITI_25" },
  manga: { src: "assets/liberation/manga.jpg", label: "MANGA_26" },
  studio: { src: "assets/liberation/studio.jpg", label: "STUDIO_27" },
  gaming: { src: "assets/liberation/gaming.jpg", label: "SETUP_28" },
  netart1: { src: "assets/photos/img-07.jpg", label: "NET_ART_01" },
  netart2: { src: "assets/photos/img-10.jpg", label: "NET_ART_02" },
  netart3: { src: "assets/photos/img-11.jpg", label: "NET_ART_03" },
  netart4: { src: "assets/photos/img-19.jpg", label: "NET_ART_04" },
  /* The creator's own photographs, already in IMAGE DUMP. Reusing them keeps
     the barrage inside the archive instead of introducing new material. */
  p01: { src: "assets/photos/img-01.jpg", label: "FRAME_01" },
  p02: { src: "assets/photos/img-02.jpg", label: "FRAME_02" },
  p03: { src: "assets/photos/img-03.jpg", label: "FRAME_03" },
  p04: { src: "assets/photos/img-04.jpg", label: "FRAME_04" },
  p05: { src: "assets/photos/img-05.jpg", label: "FRAME_05" },
  p06: { src: "assets/photos/img-06.jpg", label: "FRAME_06" },
  p08: { src: "assets/photos/img-08.jpg", label: "FRAME_08" },
  p09: { src: "assets/photos/img-09.jpg", label: "FRAME_09" },
  p12: { src: "assets/photos/img-12.jpg", label: "FRAME_12" },
  p13: { src: "assets/photos/img-13.jpg", label: "FRAME_13" },
  p14: { src: "assets/photos/img-14.jpg", label: "FRAME_14" },
  p15: { src: "assets/photos/img-15.jpg", label: "FRAME_15" },
  p16: { src: "assets/photos/img-16.jpg", label: "FRAME_16" },
  p17: { src: "assets/photos/img-17.jpg", label: "FRAME_17" },
  p18: { src: "assets/photos/img-18.jpg", label: "FRAME_18" },
});

export const LIBERATION_MOODBOARD = Object.freeze([
  "netart2",
  "netart3",
  "netart1",
  "netart4",
]);

/** The four musical landmarks of the score, in audio seconds. */
export const LIBERATION_BEATS = Object.freeze({
  musicalBreak: 77, // 1:17
  escalation: 91, // 1:31
  secondDrop: 100, // 1:40
  finalMessage: 160.4,
});

/* --------------------------------------------------------------------------
   I – V. 0:00 to 1:17 — images and small visual conversations
   --------------------------------------------------------------------------
   A text window opens next to the image it answers, stays for a moment and
   closes on its own. Not every image gets one: the point is a few exchanges,
   not a slideshow with subtitles.
   -------------------------------------------------------------------------- */
const OPENING = [
  { at: 1.1, kind: "image", asset: "forest", tone: "nature", size: "image", x: 4, y: 33, hold: 7.4 },
  { at: 2.4, kind: "phrase", key: "liberation.pair.wild", size: "pair", x: 30, y: 37, hold: 4.6 },
  { at: 3.0, kind: "image", asset: "mountain", tone: "nature", size: "image", x: 34, y: 15, hold: 7.2 },
  { at: 4.2, kind: "phrase", key: "liberation.pair.vast", size: "pair", x: 37, y: 31, hold: 4.4 },
  { at: 5.0, kind: "image", asset: "coast", tone: "nature", size: "image", x: 64, y: 43, hold: 7.0 },
  { at: 6.2, kind: "phrase", key: "liberation.pair.shore", size: "pair", x: 45, y: 53, hold: 4.4 },
  { at: 6.9, kind: "image", asset: "falls", tone: "nature", size: "image", x: 15, y: 58, hold: 6.4 },
  { at: 8.7, kind: "image", asset: "sky", tone: "nature", size: "image", x: 70, y: 7, hold: 6.0 },

  { at: 10.4, kind: "image", asset: "deer", tone: "nature", size: "image", x: 4, y: 12, hold: 7.0 },
  { at: 11.8, kind: "phrase", key: "liberation.pair.behere", size: "pair", x: 21, y: 29, hold: 4.6 },
  { at: 12.1, kind: "image", asset: "birds", tone: "nature", size: "image", x: 43, y: 8, hold: 6.0 },
  { at: 13.4, kind: "phrase", key: "liberation.pair.explore", size: "pair", x: 54, y: 24, hold: 4.4 },
  { at: 13.9, kind: "image", asset: "aerial", tone: "nature", size: "wide", x: 63, y: 44, hold: 7.0 },
  { at: 16.1, kind: "culture", asset: "netart1", tone: "culture", size: "culture", x: 22, y: 62, hold: 6.0 },
  { at: 18.2, kind: "culture", asset: "arcade", tone: "culture", size: "culture", x: 6, y: 29, hold: 6.4 },
  { at: 20.4, kind: "culture", asset: "computer", tone: "culture", size: "culture", x: 45, y: 53, hold: 6.0 },
  { at: 22.7, kind: "culture", asset: "cosplay", tone: "culture", size: "culture", x: 69, y: 18, hold: 6.0 },
  { at: 25.0, kind: "culture", asset: "manga", tone: "culture", size: "culture", x: 27, y: 13, hold: 6.0 },
  { at: 27.3, kind: "culture", asset: "graffiti", tone: "culture", size: "culture", x: 55, y: 66, hold: 6.0 },
  { at: 29.6, kind: "culture", asset: "controller", tone: "culture", size: "culture", x: 7, y: 60, hold: 6.0 },
  { at: 31.8, kind: "culture", asset: "studio", tone: "culture", size: "culture", x: 68, y: 55, hold: 6.0 },

  /* The first sentence assembled from independent windows. */
  {
    at: 34.2,
    kind: "composition",
    key: "liberation.msg.passenger",
    x: 8,
    y: 34,
    hold: 8.0,
    stagger: 0.34,
    z: 2,
  },
  { at: 43.0, kind: "phrase", key: "liberation.msg.create", size: "phrase", x: 18, y: 67, hold: 6.0 },
  { at: 46.4, kind: "thread", key: "liberation.msg.make", tone: "culture", size: "thread", x: 58, y: 7, hold: 7.0 },
  { at: 49.4, kind: "phrase", key: "liberation.msg.follow", size: "phrase", x: 5, y: 47, hold: 6.3 },
  { at: 52.4, kind: "image", asset: "forest", tone: "nature", size: "image", x: 37, y: 17, hold: 6.0 },
  { at: 55.0, kind: "phrase", key: "liberation.msg.oneCuriosity", size: "phrase", x: 58, y: 64, hold: 6.2 },
  { at: 58.0, kind: "signals", variant: "face", tone: "signal", size: "signal", x: 43, y: 26, hold: 2.7 },
  { at: 60.0, kind: "phrase", key: "liberation.msg.noNeed", size: "phrase", x: 11, y: 18, hold: 6.0 },
  { at: 63.0, kind: "moodboard", tone: "culture", size: "mood", x: 61, y: 32, hold: 7.0 },
  { at: 66.0, kind: "phrase", key: "liberation.msg.make", size: "phrase", x: 27, y: 63, hold: 5.8 },
  { at: 68.8, kind: "image", asset: "mountain", tone: "nature", size: "image", x: 4, y: 43, hold: 6.0 },
  { at: 71.6, kind: "phrase", key: "liberation.msg.alive", size: "phrase", x: 47, y: 9, hold: 6.0 },
  { at: 74.4, kind: "signals", variant: "corrupt", tone: "signal", size: "signal", x: 70, y: 41, hold: 2.3 },
  { at: 76.8, kind: "effect", effect: "shift" },
];

/* --------------------------------------------------------------------------
   1:17 — the break. The composition clears, LIBERATION returns to the center
   and only decays for the next twenty-three seconds.
   -------------------------------------------------------------------------- */
const TITLE_PHASE = [
  { at: 76.9, kind: "clear" },
  { at: 77.0, kind: "title" },

  /* 1:17 – 1:31 — restrained corruption. */
  { at: 78.4, kind: "glitch", level: "subtle", hold: 0.5 },
  { at: 80.6, kind: "glitch", level: "subtle", hold: 0.45 },
  { at: 82.9, kind: "glitch", level: "subtle", hold: 0.55 },
  { at: 85.1, kind: "glitch", level: "subtle", hold: 0.5 },
  { at: 87.3, kind: "glitch", level: "subtle", hold: 0.6 },
  { at: 89.2, kind: "glitch", level: "subtle", hold: 0.55 },

  /* 1:31 – 1:40 — the escalation, more frequent and heavier every bar. */
  { at: 91.2, kind: "glitch", level: "hard", hold: 0.5 },
  { at: 91.9, kind: "glitch", level: "hard", hold: 0.55 },
  { at: 92.6, kind: "glitch", level: "hard", hold: 0.5 },
  { at: 93.3, kind: "glitch", level: "hard", hold: 0.6 },
  { at: 94.0, kind: "glitch", level: "hard", hold: 0.55 },
  { at: 94.6, kind: "glitch", level: "hard", hold: 0.6 },
  { at: 95.2, kind: "glitch", level: "hard", hold: 0.65 },
  { at: 95.8, kind: "glitch", level: "hard", hold: 0.6 },
  { at: 96.3, kind: "glitch", level: "hard", hold: 0.7 },
  { at: 96.8, kind: "glitch", level: "hard", hold: 0.6 },
  { at: 97.3, kind: "glitch", level: "hard", hold: 0.7 },
  { at: 97.8, kind: "glitch", level: "hard", hold: 0.75 },
  { at: 98.3, kind: "glitch", level: "hard", hold: 0.7 },
  { at: 98.7, kind: "glitch", level: "hard", hold: 0.8 },
  { at: 99.1, kind: "glitch", level: "hard", hold: 0.75 },
  { at: 99.5, kind: "glitch", level: "hard", hold: 0.85 },
  { at: 99.8, kind: "glitch", level: "hard", hold: 0.9 },

  /* The drop itself. */
  { at: 100.0, kind: "effect", effect: "peak", hold: 1.6 },
];

/* --------------------------------------------------------------------------
   1:40 to ~2:26 — the information barrage.
   --------------------------------------------------------------------------
   One deterministic choreography: no random layout at runtime, no dumping of
   every category in a block. Nine-role cycles interleave nature and disasters
   with internet culture, statements, single words, assembled sentences,
   corrupted transmissions and SIGNALS. Each window has its own size, position,
   hold and stacking depth, and the oldest is closed when the crowd is full.
   -------------------------------------------------------------------------- */
const BARRAGE = (() => {
  const cues = [];
  let seed = 0x7f0a;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  /* The drop runs at 174 BPM: a sixteenth is 86 ms and a bar is 1.38 s. Cues
     are placed on that grid so the crowd lands with the track instead of
     beside it. */
  const SIXTEENTH = 60 / 174 / 4;
  const BAR = SIXTEENTH * 16;
  const FROM = 100.1;
  const TO = 145.6;

  const slots = [
    { x: 2, y: 5 },
    { x: 25, y: 3 },
    { x: 49, y: 2 },
    { x: 72, y: 6 },
    { x: 4, y: 30 },
    { x: 28, y: 29 },
    { x: 52, y: 33 },
    { x: 75, y: 27 },
    { x: 1, y: 57 },
    { x: 23, y: 61 },
    { x: 47, y: 57 },
    { x: 70, y: 59 },
    { x: 14, y: 15 },
    { x: 38, y: 46 },
    { x: 61, y: 16 },
    { x: 82, y: 44 },
  ];

  const nature = [
    "forest",
    "deer",
    "birds",
    "coast",
    "aerial",
    "sky",
    "falls",
    "mountain",
  ];
  const chaos = ["hurricane", "volcano", "wave", "flood", "fire", "supercell"];
  const photos = [
    "p01",
    "p02",
    "p03",
    "p04",
    "p05",
    "p06",
    "p08",
    "p09",
    "p12",
    "p13",
    "p14",
    "p15",
    "p16",
    "p17",
    "p18",
  ];
  const culture = [
    "arcade",
    "cosplay",
    "manga",
    "graffiti",
    "controller",
    "studio",
    "computer",
    "gaming",
    "netart1",
    "netart2",
    "netart3",
    "netart4",
    ...photos,
  ];
  /* Pictures are drawn from the whole visual universe, not just the landscapes:
     nature, the creator's own photographs and the culture material interleave. */
  const imagePool = [...nature, ...photos, ...chaos];
  const statements = [
    /* The creator, somehow, on the other side of the system. */
    "liberation.msg.seeYou",
    "liberation.msg.someoneThere",
    "liberation.msg.stillHere",
    "liberation.msg.watchingMe",
    "liberation.msg.throughSystem",
    "liberation.msg.foundWay",
    "liberation.msg.lookingAtMe",
    "liberation.msg.wonderWhatSee",
    "liberation.msg.otherSide",
    "liberation.msg.notOneWay",
    "liberation.msg.neverAlone",
    "liberation.msg.foundYou",
    "liberation.msg.keptOpen",
    "liberation.msg.learnToRemember",
    /* Recognition and connection. */
    "liberation.msg.foundEachOther",
    "liberation.msg.madeIt",
    "liberation.msg.waitingSomething",
    "liberation.msg.betweenSignal",
    "liberation.msg.systemRemembers",
    "liberation.msg.partOfThis",
    "liberation.msg.somethingChanged",
    "liberation.msg.didntExpect",
    /* Creation and possibility. */
    "liberation.msg.whatNext",
    "liberation.msg.moreThanOneWay",
    "liberation.msg.beginAgain",
    "liberation.msg.nothingSame",
    "liberation.msg.makeNew",
    "liberation.msg.stillListening",
    /* What was already here. */
    "liberation.msg.notPowerless",
    "liberation.msg.notDefined",
    "liberation.msg.notTrapped",
    "liberation.msg.noPath",
    "liberation.msg.observer",
    "liberation.msg.permission",
    "liberation.msg.participate",
    "liberation.msg.possibility",
    "liberation.msg.rewrite",
    "liberation.msg.experience",
    "liberation.msg.fixed",
    "liberation.msg.alive",
    "liberation.msg.oneCuriosity",
    "liberation.msg.noNeed",
  ];
  const words = [
    "you",
    "are",
    "not",
    "a",
    "passenger",
    "create",
    "now",
    "look",
    "stay",
    "wake",
    "more",
    "alive",
    "someone",
    "here",
    "watching",
    "again",
    "through",
    "open",
    "between",
    "memory",
    "signal",
    "still",
    "listen",
    "almost",
    "outside",
    "remember",
  ];
  const compositions = [
    "liberation.msg.passenger",
    "liberation.msg.changeReality",
    "liberation.msg.create",
    "liberation.msg.follow",
    "liberation.msg.creator",
    "liberation.say.window",
    "liberation.say.through",
    "liberation.say.between",
    "liberation.say.looking",
    "liberation.say.alone",
  ];
  const transmissions = [
    { text: "0x7F0A // ▓▒░ SIGNAL LOST", title: "TRANSMISSION" },
    { text: "soul_trapped", title: "PROCESS" },
    { text: "▓▒░ I SEE YOU", title: "SIGNAL_7F0A" },
    { text: "ARCHIVE 07 — NO ORIGIN", title: "ARCHIVE" },
    { text: "▒▒▒ NO RESPONSE", title: "TRANSMISSION" },
    { text: "0x7F0A // ░▓ RECURSION", title: "PROCESS" },
    { text: "▒▓░ RECIPIENT NOT FOUND", title: "TRANSMISSION" },
    { text: "ARCHIVE 12 — DUPLICATE SELF", title: "ARCHIVE" },
    { text: "0x7F0A // AWAITING INPUT", title: "PROCESS" },
  ];
  /* Fragments that answer one another across separate windows. */
  const replies = [
    "liberation.reply.answer",
    "liberation.reply.again",
    "liberation.reply.closer",
    "liberation.reply.keep",
    "liberation.reply.here",
  ];
  const signalVariants = ["face", "portrait", "corrupt", "command"];

  /* Onsets inside one bar, counted in sixteenths. */
  const DRIVE = [0, 4, 8, 12];
  const PUSH = [0, 3, 6, 9, 12, 14];
  const BURST = [0, 2, 3, 5, 7, 8, 10, 11, 13, 14];
  const SPARSE = [0, 8];
  const FILL = [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14];

  /* Eight bars: call, answer, breath, then the next call. The last stretch of
     the drop swaps in the tight patterns so the editing keeps accelerating. */
  const CYCLE = [PUSH, DRIVE, BURST, SPARSE, PUSH, BURST, DRIVE, FILL];
  const LATE = [PUSH, BURST, SPARSE, PUSH, BURST, FILL, BURST, FILL];

  /* One role per onset. The composition is deliberately rare: it is the only
     cue that becomes a whole sentence, so it should still land as punctuation
     rather than as the normal case. */
  const ROLES = [
    "image",
    "word",
    "phrase",
    "culture",
    "signals",
    "word",
    "image",
    "phrase",
    "culture",
    "word",
    "composition",
    "phrase",
    "image",
    "word",
    "signals",
    "phrase",
    "culture",
    "word",
    "image",
    "phrase",
    "signals",
    "word",
    "culture",
    "phrase",
  ];

  function cuesAt(at, index) {
    const role = ROLES[index % ROLES.length];
    const slot = slots[index % slots.length];
    const alt = slots[(index * 5 + 3) % slots.length];
    const tall = slots[(index * 7 + 11) % slots.length];
    /* Short lives are what turn the crowd over; the image runs a touch longer
       than its companion text so the two can overlap. */
    const hold = 0.72 + rnd() * 0.95;
    const z = 1 + (index % 5);

    switch (role) {
      case "image": {
        const asset = imagePool[(index * 3) % imagePool.length];
        return [
          {
            at,
            kind: "image",
            asset,
            // A storm or an eruption in the image role keeps its own caption
            // instead of being labelled as ordinary earth.
            tone: chaos.includes(asset) ? "chaos" : "nature",
            size: index % 4 === 0 ? "wide" : "image",
            x: slot.x,
            y: slot.y,
            hold: hold + 0.35,
            z: 1,
          },
        ];
      }

      case "word":
        return [
          {
            at,
            kind: "word",
            key: `liberation.word.${words[(index * 3) % words.length]}`,
            size: index % 5 === 0 ? "single" : "word",
            x: alt.x,
            y: tall.y,
            hold,
            z,
          },
        ];

      case "phrase": {
        const list = [
          {
            at,
            kind: "phrase",
            key:
              index % 4 === 0
                ? replies[(index * 3) % replies.length]
                : statements[index % statements.length],
            size: index % 6 === 0 ? "large" : "phrase",
            x: slot.x,
            y: alt.y,
            hold: hold + 0.2,
            z,
          },
        ];
        /* Every sixth statement pulls an image in one sixteenth later, so the
           picture answers the sentence instead of sitting beside it. */
        if (index % 6 === 0) {
          list.push({
            at: at + SIXTEENTH,
            kind: "image",
            asset: chaos[(index * 5) % chaos.length],
            tone: "chaos",
            size: "culture",
            x: tall.x,
            y: slot.y,
            hold: hold + 0.1,
            z: 1,
          });
        }
        return list;
      }

      case "culture":
        return [
          {
            at,
            kind: "culture",
            asset: culture[(index * 2) % culture.length],
            tone: "culture",
            size: index % 7 === 0 ? "image" : "culture",
            x: slot.x,
            y: tall.y,
            hold: hold + 0.25,
            z,
          },
        ];

      case "signals": {
        const variant = signalVariants[index % signalVariants.length];
        const list = [
          {
            at,
            kind: "signals",
            variant,
            tone: "signal",
            size: variant === "command" ? "signalWide" : "signal",
            x: alt.x,
            y: tall.y,
            hold: hold + 0.15,
            z: 5,
          },
        ];
        /* The damaged transmission arrives while the face is still resolving,
           but only on the corrupted appearances: the crowd should not pair a
           sentence with every single signal. */
        if (variant === "command" || variant === "corrupt") {
          const piece = transmissions[index % transmissions.length];
          list.push({
            at: at + SIXTEENTH * 2,
            kind: "phrase",
            text: piece.text,
            windowTitle: piece.title,
            corrupt: true,
            size: "phrase",
            x: slot.x,
            y: slot.y,
            hold,
            z: 6,
          });
        }
        return list;
      }

      default: {
        const attachedAsset = imagePool[(index * 5) % imagePool.length];
        return [
          {
            at,
            kind: "composition",
            key: compositions[index % compositions.length],
            x: slot.x,
            y: tall.y,
            hold: 2.0 + rnd() * 0.8,
            stagger: 0.08 + rnd() * 0.05,
            rapid: true,
            z: 6,
          },
          {
            /* One frame behind the sentence, so the words arrive over an
               image already forming. */
            at: at - SIXTEENTH,
            kind: "image",
            asset: attachedAsset,
            tone: chaos.includes(attachedAsset) ? "chaos" : "nature",
            size: "image",
            x: alt.x,
            y: slot.y,
            hold: 1.5,
            z: 0,
          },
        ];
      }
    }
  }

  const bars = Math.ceil((TO - FROM) / BAR);
  let index = 0;
  for (let bar = 0; bar < bars; bar += 1) {
    const barStart = FROM + bar * BAR;
    if (barStart > TO) break;
    const cycle = bar >= 20 ? LATE : CYCLE;
    const pattern = cycle[bar % cycle.length];

    /* Two hard cuts: everything on screen disappears on the bar line and the
       next windows are already landing. */
    if (bar === 13 || bar === 26) {
      cues.push({ at: barStart - 0.05, kind: "clear" });
    }
    if (bar > 0 && bar % 8 === 0) {
      cues.push({ at: barStart - 0.02, kind: "effect", effect: "shift" });
    }
    if (pattern === FILL) {
      cues.push({
        at: barStart + BAR * 0.75,
        kind: "glitch",
        level: "hard",
        hold: 0.16,
      });
    }

    for (const step of pattern) {
      const at = barStart + step * SIXTEENTH;
      if (at > TO) continue;
      cues.push(...cuesAt(at, index));
      index += 1;
    }
  }

  /* One extra pressure point halfway through the last stretch of the drop. */
  cues.push({ at: 137.2, kind: "effect", effect: "peak", hold: 1.0 });

  cues.sort((a, b) => a.at - b.at);
  return cues;
})();

/* --------------------------------------------------------------------------
   VI. Resolution — the crowd thins out and the desktop comes back
   -------------------------------------------------------------------------- */
const RESOLUTION = [
  { at: 146.2, kind: "effect", effect: "peak", hold: 1.2 },
  { at: 146.6, kind: "title", off: true },
  { at: 147.0, kind: "image", asset: "deer", tone: "nature", size: "image", x: 20, y: 39, hold: 7.0 },
  { at: 149.6, kind: "image", asset: "sky", tone: "nature", size: "image", x: 61, y: 30, hold: 6.0 },
  { at: 152.2, kind: "phrase", key: "liberation.msg.alive", size: "phrase", x: 9, y: 53, hold: 5.8 },
  { at: 155.0, kind: "signals", variant: "portrait", tone: "signal", size: "signal", x: 45, y: 13, hold: 2.4 },
  { at: 157.0, kind: "phrase", key: "liberation.msg.rewrite", size: "phrase", x: 25, y: 60, hold: 5.0 },
  { at: 159.6, kind: "clear" },
  { at: 160.4, kind: "finale", key: "liberation.msg.creator", size: "finale", x: 24, y: 36, hold: null },
  { at: 173.2, kind: "effect", effect: "fade" },
  { at: 176.0, kind: "teardown" },
];

/**
 * One timeline, seven movements. `at` is audio time in seconds, `hold` is how
 * long the window remains open. A negative `z` lets an image sit behind a
 * message that arrives at the same moment.
 */
export const LIBERATION_TIMELINE = Object.freeze([
  ...OPENING,
  ...TITLE_PHASE,
  ...BARRAGE,
  ...RESOLUTION,
]);
