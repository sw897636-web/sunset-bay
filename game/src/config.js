// Sunset Bay tuning: every number the game balances on lives in this one
// file, so the other modules read a single shared truth. Distances are in
// metres; speeds are metres per second; angles are radians.
export const WORLD = {
  blocksPerSide: 7, // blocks along each side of town
  block: 46, // metres of buildings per block
  street: 14, // metres of asphalt between blocks
};
WORLD.step = WORLD.block + WORLD.street;
WORLD.edge = (WORLD.blocksPerSide * WORLD.step + WORLD.street) / 2; // town runs -edge..edge
WORLD.sand = WORLD.edge + 26; // sand strip on the south edge (+z)
WORLD.sea = WORLD.edge + 150; // the ocean plane reaches out to here

export const HERO = {
  stroll: 6,
  sprint: 10,
  girth: 0.55,
  vitality: 100,
  fist: 25,
  reach: 2.2,
};

export const AUTO = {
  push: 22,
  stop: 34,
  backPush: 12,
  top: 34,
  topBack: 10,
  steer: 1.9,
  girth: 1.6,
};

export const COPS = {
  stars: 5,
  coolOff: 22, // quiet seconds before one star fades
  pinTime: 2.2, // seconds pinned by a cop before the bust lands
  chase: 30,
  foot: 7.5,
};

export const SAVE_KEY = 'sunset-bay-save-v1';

export function clampNum(value, low, high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

export function mix(a, b, t) {
  return a + (b - a) * t;
}

export function distSq(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

// Shortest-arc interpolation between two headings.
export function turnToward(from, to, t) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return from + d * t;
}
