/**
 * SIGNALS — display data.
 *
 * The portrait is the exact supplied SIGNALS_AVATAR.png. It is displayed as an
 * image, not reconstructed as ASCII. The app reads this object directly; the
 * framed image lives at `[data-portrait-slot="signals-portrait"]`.
 *
 * The transmission is deterministic so the same damaged carrier page is
 * reconstructed every time the window opens. Its recognizable anchor is the
 * corrupted process identifier `soul_trapped`, embedded as command output.
 */

export const SIGNALS_IDENTIFIER = "soul_trapped";
export const SIGNALS_COMMAND = "process://soul_trapped.exe";

export const SIGNALS_PORTRAIT = Object.freeze({
  src: "assets/signals/portrait.png",
  source: "SIGNALS_AVATAR.png",
  width: 416,
  height: 536,
});

const GLYPHS = Object.freeze([
  "7F0A:://",
  "000101101",
  "9X0_",
  "⟁⟁⟁",
  "█▒░",
  "4̷̗̍̕2̶̫̐",
  "01001011",
  "𐌗𐌗𐌗",
  "001101",
  "▚▞▚",
  "::/::",
  "0x7F",
  "▒▓█",
  "̶̷̸",
  "1010",
  "//",
  "7A:0F",
  "0110",
  "▓▒░",
  "⟁",
  "9X0",
  "00",
  "FF",
]);

const NUMBERS = Object.freeze([
  "0001011010110",
  "0100101110010",
  "1100101001101",
  "0011010110001",
  "1010010010110",
  "0111010100011",
  "1110001001011",
  "0001110100100",
  "1001011100010",
  "0101011011100",
  "0010010111011",
  "1101000101101",
]);

const BREAKS = Object.freeze([" ", "  ", " ", "   ", " ", "    "]);

/* The damaged carrier keeps returning to the same process reference. */
const ANCHORS = Object.freeze([
  "soul_trapped.exe",
  "process://soul_trapped",
  "memory_reference: soul_trapped",
]);

/** Small deterministic PRNG: the same transmission is reconstructed every open. */
function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

function makeLine(random, index) {
  const target = 82 + Math.floor(random() * 26);
  const anchor = ANCHORS[Math.floor(index / 8) % ANCHORS.length];
  let line = index % 8 === 0 ? `${anchor} ` : "";
  while (line.length < target) {
    const roll = random();
    if (line.length > 28 && roll < 0.028) {
      line += `${ANCHORS[Math.floor(random() * ANCHORS.length)]} `;
    } else if (roll < 0.46) {
      line += NUMBERS[Math.floor(random() * NUMBERS.length)];
    } else if (roll < 0.88) {
      line += GLYPHS[Math.floor(random() * GLYPHS.length)];
    } else {
      line += `7F0A:${Math.floor(random() * 0xffff)
        .toString(16)
        .toUpperCase()
        .padStart(4, "0")}`;
    }
    line += BREAKS[Math.floor(random() * BREAKS.length)];
  }
  return line.slice(0, target);
}

function makeTransmission() {
  const random = makeRandom(0x5a17c0de);
  const main = Array.from({ length: 48 }, (_, index) => makeLine(random, index));

  // A second, clipped field sits a few pixels off the first one. It repeats
  // fragments rather than sentences, so the interference stays illegible.
  const ghostRandom = makeRandom(0x7f0a115a);
  const ghost = Array.from({ length: 30 }, (_, index) => {
    const seed = main[(index * 3 + 1) % main.length];
    const cut = Math.floor(ghostRandom() * 26);
    return `${seed.slice(cut, cut + 58)}  ${GLYPHS[index % GLYPHS.length]}`;
  });

  return Object.freeze({
    main: Object.freeze(main),
    ghost: Object.freeze(ghost),
  });
}

export const SIGNALS_TRANSMISSION = makeTransmission();
