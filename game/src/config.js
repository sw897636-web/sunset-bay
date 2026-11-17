// Sunset Bay: every tunable number lives here so the rest of the game reads
// one shared truth. Units are metres, speeds are metres per second.
export const CITY = {
  blocks: 7,          // blocks per side
  blockSize: 46,      // metres of buildings per block
  roadWidth: 14,      // metres of asphalt between blocks
  half: 0,            // filled in by citySize()
};
CITY.pitch = CITY.blockSize + CITY.roadWidth;
CITY.half = (CITY.blocks * CITY.pitch + CITY.roadWidth) / 2; // city spans -half..half
CITY.beachZ = CITY.half + 26;   // sand strip on the south edge (+z)
CITY.oceanZ = CITY.half + 150;  // ocean plane extends to here

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 10,
  radius: 0.55,
  health: 100,
  punchDamage: 25,
  punchRange: 2.2,
};

export const CAR = {
  accel: 22,
  brake: 34,
  reverseAccel: 12,
  maxSpeed: 34,
  maxReverse: 10,
  turnRate: 1.9,
  radius: 1.6,
};

export const POLICE = {
  maxWanted: 5,
  decaySeconds: 22,     // quiet seconds before one star fades
  bustSeconds: 2.2,     // seconds pinned by a cop before the bust lands
  copCarSpeed: 30,
  footCopSpeed: 7.5,
};

export const SAVE_KEY = 'sunset-bay-save-v1';

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
export function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}
export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
