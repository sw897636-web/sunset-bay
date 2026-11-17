// Sunset Bay shared helpers: seeded random numbers, math and collision helpers.
export function mulberry32(seed) {
let a = seed >>> 0;
return function () {
a |= 0;
a = (a + 0x6D2B79F5) | 0;
let t = Math.imul(a ^ (a >>> 15), 1 | a);
t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
}
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function angleLerp(a, b, t) {
let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
return a + d * t;
}
export function angleDiff(a, b) {
return ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
}
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function range(rng, a, b) { return a + rng() * (b - a); }
export function intRange(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }
export function makeCanvas(w, h) {
const c = document.createElement('canvas');
c.width = w;
c.height = h;
return c;
}
export function dist2(ax, az, bx, bz) {
const dx = ax - bx;
const dz = az - bz;
return Math.sqrt(dx * dx + dz * dz);
}
// Push a circle (x, z, radius r) out of an axis-aligned box. Returns true on a hit.
export function resolveCircleBox(p, r, b) {
const cx = clamp(p.x, b.x0, b.x1);
const cz = clamp(p.z, b.z0, b.z1);
let dx = p.x - cx;
let dz = p.z - cz;
const d2 = dx * dx + dz * dz;
if (d2 >= r * r) return false;
if (d2 > 0.0001) {
const d = Math.sqrt(d2);
const push = (r - d) / d;
p.x += dx * push;
p.z += dz * push;
return true;
}
const left = p.x - b.x0;
const right = b.x1 - p.x;
const top = p.z - b.z0;
const bottom = b.z1 - p.z;
const m = Math.min(left, right, top, bottom);
if (m === left) p.x = b.x0 - r;
else if (m === right) p.x = b.x1 + r;
else if (m === top) p.z = b.z0 - r;
else p.z = b.z1 + r;
return true;
}
export function pointInBox(x, z, b, pad) {
return x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad;
}
