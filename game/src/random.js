// Sunset Bay: a tiny seeded random generator so the city and the
// staged screenshot scenes are the same every run for a given seed.

export function makeRng(seed) {
let a = (seed >>> 0) || 1;
return function next() {
a |= 0;
a = (a + 0x6d2b79f5) | 0;
let t = Math.imul(a ^ (a >>> 15), 1 | a);
t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
}

export function range(rng, min, max) {
return min + rng() * (max - min);
}

export function rangeInt(rng, min, max) {
return Math.floor(range(rng, min, max + 1));
}

export function pick(rng, list) {
return list[Math.floor(rng() * list.length)];
}

export function shuffle(rng, list) {
const out = list.slice();
for (let i = out.length - 1; i > 0; i--) {
const j = Math.floor(rng() * (i + 1));
const tmp = out[i];
out[i] = out[j];
out[j] = tmp;
}
return out;
}

export function clamp(value, min, max) {
return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
return a + (b - a) * t;
}

export function angleLerp(a, b, t) {
let d = b - a;
while (d > Math.PI) d -= Math.PI * 2;
while (d < -Math.PI) d += Math.PI * 2;
return a + d * t;
}

export function distance2D(ax, az, bx, bz) {
const dx = ax - bx;
const dz = az - bz;
return Math.sqrt(dx * dx + dz * dz);
}
