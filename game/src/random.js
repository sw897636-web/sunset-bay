// Deterministic dice for Sunset Bay: the city, the traffic and the staged
// screenshot scenes all draw from one seeded stream, so ?seed=1 always
// builds the same Bay while a fresh visit rolls a new one. sfc32, a small
// fast generator with a long period for a game like this.
export function makeDice(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  let b = (a ^ 0x85ebca6b) >>> 0;
  let c = (b ^ 0xc2b2ae35) >>> 0;
  let d = (c ^ 0x27d4eb2f) >>> 0;
  function next() {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  }
  return {
    next,
    between(low, high) { return low + next() * (high - low); },
    whole(low, high) { return Math.floor(low + next() * (high - low + 1)); },
    choose(list) { return list[Math.floor(next() * list.length)]; },
    maybe(p) { return next() < p; },
  };
}
