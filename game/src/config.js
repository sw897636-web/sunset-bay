// Sunset Bay: every tunable number and all story content in one place.
// Nothing here knows about three.js; the other modules read these values.

export const CONFIG = {
title: 'SUNSET BAY',
version: '1.0.0',
saveKey: 'sunsetbay-save-v1',
blockSize: 64,
roadWidth: 16,
gridCount: 8,
cityHalf: 320,
beachX: -340,
oceanX: -400,
worldHalf: 460,
playerWalkSpeed: 6,
playerRunSpeed: 10,
playerJumpSpeed: 8,
gravity: 22,
carAccel: 14,
carBrake: 26,
carReverseAccel: 8,
carMaxSpeed: 42,
carMaxReverse: 12,
carTurnRate: 1.9,
carGrip: 4.5,
trafficCount: 14,
pedCount: 22,
policeMax: 6,
wantedDecaySeconds: 25,
wantedLoseDistance: 90,
bustedSeconds: 2.5,
maxHealth: 100,
startCash: 250,
shotCooldown: 0.28,
shotRange: 90,
shotDamage: 34,
carHealth: 100,
minimapSize: 184,
};

export const PALETTE = {
skyTop: 0x2e4a7a,
skyBottom: 0xff9a56,
sunColor: 0xffd27a,
fogColor: 0xf2a56b,
ground: 0x3d3a33,
road: 0x232326,
roadLine: 0xd8c25a,
sidewalk: 0x8d8578,
sand: 0xd9b380,
ocean: 0x1d6f8e,
oceanDeep: 0x14506e,
buildingGlass: 0x9fc4d8,
palmTrunk: 0x7a5a38,
palmLeaf: 0x2f7d3a,
};

export const BUILDING_COLORS = [
0xd8c9b0, 0xc9b8a3, 0xb8a88e, 0xe0d4c0, 0xa89a86, 0xd0b49a, 0xbfb49c, 0x9fb4c0,
];

export const CAR_COLORS = [
0xc0392b, 0x2980b9, 0xf1c40f, 0xecf0f1, 0x2c3e50, 0x8e44ad, 0x16a085, 0xe67e22,
0x7f8c8d, 0xd35400, 0x1abc9c, 0x34495e,
];

export const DISTRICTS = [
{ name: 'Marina District', x: -300, z: 240 },
{ name: 'Palm Row', x: -200, z: -40 },
{ name: 'Coral Heights', x: 80, z: -200 },
{ name: 'Dockside', x: -280, z: -240 },
{ name: 'Old Town', x: 40, z: 120 },
{ name: 'Bayfront', x: 200, z: 200 },
{ name: 'Neon Strip', x: 160, z: -40 },
{ name: 'Sunset Plaza', x: 0, z: 0 },
];

export const STORY = {
hero: 'Mara Voss',
contact: 'Rico Delmar',
boss: 'Salvatore Kane',
intro: 'Mara Voss came to Sunset Bay with a duffel bag and a debt. Rico Delmar offered her a way out: five jobs, one crew, and a cut big enough to buy her freedom.',
outro: 'The bay is yours now, Mara. Kane is finished, the crew is paid, and the sun never sets on Sunset Bay.',
};

export const MISSIONS = [
{
id: 'pickup',
name: 'First Pickup',
brief: 'Meet Rico at the Marina. He has your first job and a package with your name on it.',
targetLabel: 'Rico at the Marina',
target: { x: -272, z: 232 },
reward: 100,
kind: 'goto',
},
{
id: 'hotwheels',
name: 'Hot Wheels',
brief: 'Steal the marked coupe on Palm Row and deliver it to the garage in Old Town. Try not to scratch it.',
targetLabel: 'Marked coupe on Palm Row',
target: { x: -180, z: -56 },
deliver: { x: 24, z: 136 },
reward: 300,
kind: 'steal-deliver',
},
{
id: 'beachrun',
name: 'Beach Run',
brief: 'Three drops, one timer. Deliver the packages around the bay before the clock runs out.',
targetLabel: 'Package drops',
drops: [ { x: -240, z: -200 }, { x: 200, z: -160 }, { x: 120, z: 220 } ],
timeLimit: 200,
reward: 500,
kind: 'drops',
},
{
id: 'heat',
name: 'Heat',
brief: 'Kane tipped off the cops. You are at three stars. Survive sixty seconds and lose the tail.',
targetLabel: 'Survive the heat',
timeLimit: 60,
wanted: 3,
reward: 600,
kind: 'survive',
},
{
id: 'bigone',
name: 'The Big One',
brief: 'Hit the Bayfront bank, grab the cash, and get to the safehouse in Coral Heights with the whole city on your tail.',
targetLabel: 'Bayfront bank',
target: { x: 216, z: 184 },
deliver: { x: 96, z: -216 },
collectSeconds: 5,
wanted: 4,
reward: 1500,
kind: 'rob-escape',
},
];

export const CONTROLS = [
['W A S D', 'Move / drive'],
['Mouse drag', 'Look around'],
['Shift', 'Run'],
['Space', 'Jump / handbrake'],
['E', 'Enter / exit car'],
['Click', 'Shoot (on foot)'],
['C', 'Camera distance'],
['M', 'Mute'],
['Esc', 'Pause'],
];

export function districtAt(x, z) {
let best = DISTRICTS[0];
let bestD = Infinity;
for (const d of DISTRICTS) {
const dx = x - d.x;
const dz = z - d.z;
const dd = dx * dx + dz * dz;
if (dd < bestD) { bestD = dd; best = d; }
}
return best.name;
}
