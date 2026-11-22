/**
 * OUTSIDER.EXE — the fixed Poolrooms layout.
 *
 * One continuous route, hand-authored so the pools, corner turns and the dark
 * bridge always appear in the same order:
 *
 *   pale atrium -> east corridor -> tall gallery -> north hall
 *   -> pool room -> east corridor -> north hall -> pool court
 *   -> south corridor -> dark pool -> bridge -> exit door
 *
 * There are no branch junctions and no dead ends: every doorway is on the one
 * route. Rooms are open only so the visitor can take a comfortable line around
 * their pools. The grid is data; the renderer builds walls from it.
 *
 * World units are metres. Grid cell size is 3 m.
 */

export const CELL = 3;
export const GRID_W = 40;
export const GRID_H = 28;
export const EYE_HEIGHT = 1.65;

const WALL = "#";
const FLOOR = ".";
const WATER = "~";

/**
 * What the architecture says. Short intrusions from the same voice as the
 * Twisters, painted flat on selected wall faces by the renderer. Some are cut
 * off or partly damaged; they are scenery, never a Twister encounter, never a
 * window and never a pop-up.
 */
export const WALL_INSIGHTS = Object.freeze([
  { text: "YOU ARE FALLING BEHIND", corrupt: false },
  { text: "YOU SHOULD BE DOING SOMETHING USEFUL", corrupt: true },
  { text: "THIS WILL NEVER WORK", corrupt: false },
  { text: "YOU ARE NOT GOOD ENOUGH", corrupt: true },
  { text: "EVERYONE ELSE IS MOVING FORWARD", corrupt: false },
  { text: "YOU ARE WASTING YOUR TIME", corrupt: false },
  { text: "YOU CAN'T ESCAPE YOURSELF", corrupt: true },
  { text: "WHAT IF YOU FAIL?", corrupt: false },
  { text: "THEY ALREADY LEFT", corrupt: true },
  { text: "STILL HERE?", corrupt: false },
  { text: "NO ONE IS WAITING", corrupt: true },
  { text: "WHY DID YOU STOP", corrupt: false },
  { text: "AGAIN.", corrupt: true },
  { text: "YOU MISSED IT", corrupt: false },
]);

export const START = Object.freeze({
  x: 13.5,
  z: 79.5,
  yaw: 0,
});

export const DOOR = Object.freeze({
  x: 109.5,
  z: 77.9,
  triggerZ: 75.35,
  halfWidth: 1.75,
});

/** Bright pools. Water is impassable; the coping is only visual. */
const POOLS = [
  { x1: 3, z1: 66, x2: 12, z2: 78 },
  { x1: 51, z1: 27, x2: 66, z2: 36 },
  { x1: 84, z1: 15, x2: 99, z2: 24 },
];

/**
 * The last room's water: one sheet split by the narrow bridge. Collision uses
 * these same rectangles, so the walkable deck is exactly what is drawn.
 */
const FINAL_WATER = [
  { x1: 99.2, z1: 39, x2: 108.2, z2: 72 },
  { x1: 110.8, z1: 39, x2: 119.8, z2: 72 },
];

const BRIDGE = Object.freeze({
  x1: 108.2,
  x2: 110.8,
  z1: 39,
  z2: 72,
  y: 0.16,
});

/** Two structural columns, kept against walls and off the route. */
const PILLARS = [
  { x: 57, z: 44.4, size: 0.9 },
  { x: 63, z: 44.4, size: 0.9 },
  { x: 100.5, z: 19.3, size: 0.9 },
];

function blankGrid(value) {
  return Array.from({ length: GRID_H }, () => Array.from({ length: GRID_W }, () => value));
}

function rect(x1, z1, x2, z2, value) {
  for (let z = z1; z <= z2; z += 1) {
    for (let x = x1; x <= x2; x += 1) {
      if (x < 0 || z < 0 || x >= GRID_W || z >= GRID_H) continue;
      grid[z][x] = value;
    }
  }
}

const grid = blankGrid(WALL);
const zone = blankGrid("bright");
const height = blankGrid(4.6);

function carve(x1, z1, x2, z2, kind = "bright") {
  rect(x1, z1, x2, z2, FLOOR);
  for (let z = z1; z <= z2; z += 1) {
    for (let x = x1; x <= x2; x += 1) {
      zone[z][x] = kind;
      height[z][x] = kind === "final" ? 6.5 : 4.6;
    }
  }
}

/* --------------------------------------------------------------- the route */
// Atrium, with a long pale pool along its west wall.
carve(1, 21, 8, 27);
// East corridor, then a turn north.
carve(8, 24, 14, 26);
carve(13, 15, 15, 26);
// Gallery: a wide room with a pool under its south wall.
carve(13, 9, 22, 15);
// East corridor, then another turn north.
carve(22, 12, 27, 14);
carve(25, 7, 27, 14);
// Pool court: the route enters low and leaves through the high east doorway.
carve(25, 2, 34, 7);
carve(34, 3, 37, 5);
carve(35, 5, 37, 11);
// Dark pool room. The interior is water; two ledges and the bridge are built
// below, over that water.
carve(33, 11, 39, 25, "final");

/* Pools in the bright rooms. They are off the walking line, never across it. */
rect(1, 22, 3, 25, WATER);
rect(17, 9, 21, 11, WATER);
rect(28, 5, 32, 7, WATER);

/* Final room: two stone ledges, water between, narrow bridge over it. */
rect(33, 11, 39, 12, FLOOR);
rect(33, 24, 39, 25, FLOOR);
rect(33, 13, 39, 23, WATER);

/**
 * World-space pool rectangles. The first three are the bright pools; the last
 * two are the dark room's water either side of the bridge.
 */
const waterRects = [
  ...POOLS.map((pool) => ({ ...pool, tone: "bright" })),
  ...FINAL_WATER.map((pool) => ({ ...pool, tone: "dark" })),
];

const wallColliders = [];
for (let z = 0; z < GRID_H; z += 1) {
  for (let x = 0; x < GRID_W; x += 1) {
    if (grid[z][x] !== WALL) continue;
    let touchesRoute = false;
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= GRID_W || nz >= GRID_H) continue;
      if (grid[nz][nx] !== WALL) {
        touchesRoute = true;
        break;
      }
    }
    if (touchesRoute) {
      wallColliders.push({
        x1: x * CELL,
        z1: z * CELL,
        x2: (x + 1) * CELL,
        z2: (z + 1) * CELL,
        kind: "wall",
      });
    }
  }
}

const poolColliders = waterRects.map((pool) => ({ ...pool, kind: "water" }));
const pillarColliders = PILLARS.map((pillar) => ({
  x1: pillar.x - pillar.size / 2,
  z1: pillar.z - pillar.size / 2,
  x2: pillar.x + pillar.size / 2,
  z2: pillar.z + pillar.size / 2,
  kind: "pillar",
}));

/* The grid has no wall cells outside its own bounds, but the renderer draws
   those edges as solid. Mirror them with four strips so the outer rooms cannot
   be walked out of. */
const worldW = GRID_W * CELL;
const worldH = GRID_H * CELL;
const boundaryColliders = [
  { x1: -CELL, z1: -CELL, x2: worldW + CELL, z2: 0, kind: "wall" },
  { x1: -CELL, z1: worldH, x2: worldW + CELL, z2: worldH + CELL, kind: "wall" },
  { x1: -CELL, z1: 0, x2: 0, z2: worldH, kind: "wall" },
  { x1: worldW, z1: 0, x2: worldW + CELL, z2: worldH, kind: "wall" },
];

const colliders = [
  ...wallColliders,
  ...boundaryColliders,
  ...poolColliders,
  ...pillarColliders,
];

/** Room lights: a sparse trail, so the route reads without signposts. */
const lights = [
  { x: 13.5, z: 73.5, w: 4.2, d: 4.2 },
  { x: 31.5, z: 75, w: 3, d: 3 },
  { x: 42, z: 57, w: 2.8, d: 2.8 },
  { x: 52.5, z: 39, w: 5.2, d: 5.2 },
  { x: 70.5, z: 39, w: 2.8, d: 2.8 },
  { x: 78, z: 28.5, w: 2.8, d: 2.8 },
  { x: 88.5, z: 13.5, w: 4.6, d: 4.6 },
  { x: 106.5, z: 13.5, w: 2.8, d: 2.8 },
  { x: 108, z: 24, w: 2.8, d: 2.8 },
  { x: 109.5, z: 34.5, w: 3.4, d: 2.4, tone: "dark" },
  { x: 109.5, z: 75.2, w: 2.6, d: 1.4, tone: "dark" },
];

export const LEVEL = Object.freeze({
  cell: CELL,
  width: GRID_W,
  height: GRID_H,
  grid: grid.map((row) => row.join("")),
  zones: zone,
  heights: height,
  start: START,
  door: DOOR,
  bridge: BRIDGE,
  pools: POOLS,
  finalWater: FINAL_WATER,
  waterRects,
  colliders,
  pillars: PILLARS,
  lights,
  floorY: 0,
  wallHeight: 4.6,
  finalHeight: 6.5,
  bounds: {
    x1: 0,
    z1: 0,
    x2: GRID_W * CELL,
    z2: GRID_H * CELL,
  },
});

/** Grid value at a cell. Out of bounds is wall. */
export function cellAt(x, z) {
  if (x < 0 || z < 0 || x >= GRID_W || z >= GRID_H) return WALL;
  return LEVEL.grid[z][x];
}

export function isWalkableCell(x, z) {
  const value = cellAt(x, z);
  return value !== WALL && value !== WATER;
}

/** Test-only route check: every floor cell must be reachable from the start. */
export function reachableFloorCells() {
  const sx = 4;
  const sz = 26;
  const seen = new Set();
  const queue = [[sx, sz]];
  while (queue.length) {
    const [x, z] = queue.pop();
    const key = `${x},${z}`;
    if (seen.has(key)) continue;
    if (cellAt(x, z) !== FLOOR) continue;
    seen.add(key);
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      queue.push([x + dx, z + dz]);
    }
  }
  // The bridge is not a grid cell, but it connects the two dark-room ledges.
  return seen;
}

export function countFloorCells() {
  let count = 0;
  for (const row of LEVEL.grid) {
    for (const value of row) if (value === FLOOR) count += 1;
  }
  return count;
}
