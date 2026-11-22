/**
 * HOLYSAGA_oS — pixel icon generator
 *
 * Icons are authored as 16x16 character maps and exported as crisp SVG files.
 * Run with:  node tools/make-icons.mjs
 *
 * The preview sheet (tools/.icon-preview.png) is only a development aid.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "assets", "icons");

const PALETTE = {
  ".": null,
  k: "#000000",
  n: "#000080",
  t: "#008080",
  T: "#4a8a80",
  g: "#808080",
  G: "#a8a8a8",
  l: "#c0c0c0",
  e: "#dfdfdf",
  w: "#ffffff",
  y: "#d8b84a",
  Y: "#f2e3a8",
  s: "#20302c",
};

/* A single eighth note: MUSIC PLAYER */
const music = [
  "................",
  "................",
  "..........kkkk..",
  ".........kwwwwk.",
  ".........kwkkkk.",
  ".........kwk....",
  ".........kwk....",
  ".........kwk....",
  "....kkkkkwk.....",
  "...kwwwwwkk.....",
  "...kwwwwwk......",
  "...kwwwwwk......",
  "...kwwwwwk......",
  "....kkkkk.......",
  "................",
  "................",
];

/* Framed landscape: IMAGE DUMP */
const images = [
  "................",
  "................",
  "..kkkkkkkkkkkk..",
  "..kwwwwwwwwwwk..",
  "..kwtttttyytwk..",
  "..kwttttyyttwk..",
  "..kwttttttttwk..",
  "..kwtttttgttwk..",
  "..kwttttgggtwk..",
  "..kwtttgggggttk.",
  "..kwttggggggggtk",
  "..kwgggggggggggk",
  "..kwwwwwwwwwwk..",
  "..kkkkkkkkkkkk..",
  "................",
  "................",
];

/* Bound book with a gold emblem: DREAM LOG */
const dreams = [
  "................",
  "................",
  "...kkkkkkkkkk...",
  "...kwwwwwwwwk...",
  "...kwkkkkkkwk...",
  "...kwknnnnkwk...",
  "...kwknnynkwk...",
  "...kwknyynkwk...",
  "...kwknyynkwk...",
  "...kwknnynkwk...",
  "...kwkkkkkkwk...",
  "...kwwwwwwwwk...",
  "...kkkkkkkkkk...",
  "................",
  "................",
  "................",
];

/* Lined page: NOTES.TXT */
const notes = [
  "................",
  "................",
  "..kkkkkkkkkkkk..",
  "..kwwwwwwwwwwk..",
  "..kwkkkkkkkkwk..",
  "..kwwwwwwwwwwk..",
  "..kwkkkkkkkkwk..",
  "..kwwwwwwwwwwk..",
  "..kwkkkkkkkkwk..",
  "..kwwwwwwwwwwk..",
  "..kwkkkkkkkkwk..",
  "..kwwwwwwwwwwk..",
  "..kkkkkkkkkkkk..",
  "................",
  "................",
  "................",
];

/* Monitor: start button / favicon */
const monitor = [
  "................",
  "................",
  "..kkkkkkkkkkkk..",
  "..kllllllllllk..",
  "..klkkkkkkkklk..",
  "..klkttttttttk..",
  "..klktwwtttttk..",
  "..klkttttttttk..",
  "..klkttttttttk..",
  "..klkttttttttk..",
  "..klkkkkkkkklk..",
  "..kllllllllllk..",
  "..kkkkkkkkkkkk..",
  "....k......k....",
  "...kkkkkkkkkk...",
  "................",
];

/* ---------------------------------------------------------------------------
 * Maze icon — generated with a fixed seed so the art never changes.
 * ------------------------------------------------------------------------- */
function makeMaze() {
  const CELLS = 5;
  const grid = Array.from({ length: CELLS }, () =>
    Array.from({ length: CELLS }, () => ({ n: true, e: true, s: true, w: true, seen: false })),
  );
  let seed = 20261029;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const stack = [{ x: 0, y: 0 }];
  grid[0][0].seen = true;
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const options = [
      { dx: 0, dy: -1, wall: "n", back: "s" },
      { dx: 1, dy: 0, wall: "e", back: "w" },
      { dx: 0, dy: 1, wall: "s", back: "n" },
      { dx: -1, dy: 0, wall: "w", back: "e" },
    ].filter(({ dx, dy }) => {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      return nx >= 0 && nx < CELLS && ny >= 0 && ny < CELLS && !grid[ny][nx].seen;
    });
    if (!options.length) {
      stack.pop();
      continue;
    }
    const pick = options[Math.floor(rand() * options.length)];
    const nx = cur.x + pick.dx;
    const ny = cur.y + pick.dy;
    grid[cur.y][cur.x][pick.wall] = false;
    grid[ny][nx][pick.back] = false;
    grid[ny][nx].seen = true;
    stack.push({ x: nx, y: ny });
  }

  // 5 cells * 2px + 6 walls * 1px = 16px
  const px = Array.from({ length: 16 }, () => Array(16).fill("T"));
  const at = (x, y, c) => {
    if (x >= 0 && x < 16 && y >= 0 && y < 16) px[y][x] = c;
  };
  // cell interiors
  for (let cy = 0; cy < CELLS; cy += 1) {
    for (let cx = 0; cx < CELLS; cx += 1) {
      const x0 = 1 + cx * 3;
      const y0 = 1 + cy * 3;
      for (let y = 0; y < 2; y += 1) for (let x = 0; x < 2; x += 1) at(x0 + x, y0 + y, "e");
    }
  }
  // walls
  const wall = (x, y) => at(x, y, "k");
  for (let cy = 0; cy < CELLS; cy += 1) {
    for (let cx = 0; cx < CELLS; cx += 1) {
      const cell = grid[cy][cx];
      const x0 = 1 + cx * 3;
      const y0 = 1 + cy * 3;
      if (cell.n) for (let x = 0; x < 3; x += 1) wall(x0 - 1 + x, y0 - 1);
      if (cell.w) for (let y = 0; y < 3; y += 1) wall(x0 - 1, y0 - 1 + y);
      if (cx === CELLS - 1 && cell.e) for (let y = 0; y < 3; y += 1) wall(x0 + 2, y0 - 1 + y);
      if (cy === CELLS - 1 && cell.s) for (let x = 0; x < 3; x += 1) wall(x0 - 1 + x, y0 + 2);
    }
  }
  // entrance + a small pale marker inside the maze
  at(0, 1, "e");
  at(0, 2, "e");
  at(13, 13, "w");
  return px.map((row) => row.join(""));
}

const ICONS = { music, images, dreams, notes, monitor, maze: makeMaze() };

/* ---------------------------------------------------------------------------
 * SVG output (merges horizontal runs of the same colour)
 * ------------------------------------------------------------------------- */
function validate(name, rows) {
  if (rows.length !== 16) throw new Error(`${name}: expected 16 rows, got ${rows.length}`);
  rows.forEach((row, i) => {
    if (row.length !== 16) throw new Error(`${name}: row ${i} has ${row.length} columns`);
    for (const ch of row) {
      if (!(ch in PALETTE)) throw new Error(`${name}: unknown colour "${ch}" on row ${i}`);
    }
  });
}

function toSvg(rows) {
  const parts = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < 16) {
      const ch = row[x];
      const color = PALETTE[ch];
      if (!color) {
        x += 1;
        continue;
      }
      let run = 1;
      while (x + run < 16 && row[x + run] === ch) run += 1;
      parts.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${color}"/>`);
      x += run;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" shape-rendering="crispEdges" role="img" aria-hidden="true">${parts.join("")}</svg>\n`;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, rows] of Object.entries(ICONS)) {
  validate(name, rows);
  writeFileSync(join(OUT_DIR, `${name}.svg`), toSvg(rows));
}

/* ---------------------------------------------------------------------------
 * Development preview sheet (PNG, no dependencies)
 * ------------------------------------------------------------------------- */
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const SCALE = 6;
const GAP = 8;
const names = Object.keys(ICONS);
const cell = 16 * SCALE;
const sheetW = names.length * cell + (names.length + 1) * GAP;
const sheetH = cell + GAP * 2;
const pixels = Buffer.alloc(sheetW * sheetH * 4);
const hexToRgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];
const bg = hexToRgb("#2e6b61");
for (let i = 0; i < sheetW * sheetH; i += 1) {
  pixels[i * 4] = bg[0];
  pixels[i * 4 + 1] = bg[1];
  pixels[i * 4 + 2] = bg[2];
  pixels[i * 4 + 3] = 255;
}
names.forEach((name, index) => {
  const offsetX = GAP + index * (cell + GAP);
  const offsetY = GAP;
  ICONS[name].forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = PALETTE[ch];
      if (!color) return;
      const [r, g, b] = hexToRgb(color);
      for (let dy = 0; dy < SCALE; dy += 1) {
        for (let dx = 0; dx < SCALE; dx += 1) {
          const px = offsetX + x * SCALE + dx;
          const py = offsetY + y * SCALE + dy;
          const i = (py * sheetW + px) * 4;
          pixels[i] = r;
          pixels[i + 1] = g;
          pixels[i + 2] = b;
          pixels[i + 3] = 255;
        }
      }
    });
  });
});
writeFileSync(join(ROOT, "tools", ".icon-preview.png"), encodePng(sheetW, sheetH, pixels));

console.log(`wrote ${names.length} icons to assets/icons: ${names.join(", ")}`);
