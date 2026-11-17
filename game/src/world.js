// Sunset Bay: builds the whole city — ground, ocean, beach, roads,
// sidewalks, buildings, palms, streetlights — and the collision boxes
// the cars, the player and the police all push against.

import * as THREE from 'three';
import { CONFIG, PALETTE, BUILDING_COLORS } from './config.js';
import { makeRng, range, rangeInt, pick, clamp } from './random.js';

function makeWindowTexture(rng) {
const canvas = document.createElement('canvas');
canvas.width = 128;
canvas.height = 256;
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#cfc4ae';
ctx.fillRect(0, 0, 128, 256);
ctx.fillStyle = '#8d8272';
ctx.fillRect(0, 0, 128, 10);
for (let row = 0; row < 8; row++) {
for (let col = 0; col < 4; col++) {
const lit = rng() < 0.45;
ctx.fillStyle = lit ? '#ffd98a' : '#5a7080';
ctx.fillRect(10 + col * 30, 22 + row * 28, 20, 18);
}
}
const tex = new THREE.CanvasTexture(canvas);
tex.wrapS = THREE.RepeatWrapping;
tex.wrapT = THREE.RepeatWrapping;
tex.repeat.set(2, 3);
return tex;
}

function makeRoadTexture() {
const canvas = document.createElement('canvas');
canvas.width = 128;
canvas.height = 128;
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#232326';
ctx.fillRect(0, 0, 128, 128);
ctx.fillStyle = '#d8c25a';
ctx.fillRect(62, 0, 4, 128);
ctx.fillStyle = '#3a3a3e';
ctx.fillRect(0, 0, 128, 6);
ctx.fillRect(0, 122, 128, 6);
const tex = new THREE.CanvasTexture(canvas);
tex.wrapS = THREE.RepeatWrapping;
tex.wrapT = THREE.RepeatWrapping;
tex.repeat.set(1, 8);
return tex;
}

function makeGroundTexture() {
const canvas = document.createElement('canvas');
canvas.width = 256;
canvas.height = 256;
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#3d3a33';
ctx.fillRect(0, 0, 256, 256);
for (let i = 0; i < 900; i++) {
const g = 50 + Math.floor(Math.random() * 30);
ctx.fillStyle = 'rgb(' + g + ',' + (g - 4) + ',' + (g - 10) + ')';
ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
}
const tex = new THREE.CanvasTexture(canvas);
tex.wrapS = THREE.RepeatWrapping;
tex.wrapT = THREE.RepeatWrapping;
tex.repeat.set(24, 24);
return tex;
}

export function roadLines() {
const step = CONFIG.blockSize + CONFIG.roadWidth;
const lines = [];
for (let i = 0; i <= CONFIG.gridCount; i++) {
lines.push(-CONFIG.cityHalf + i * step);
}
return lines;
}

export function isOnRoad(x, z) {
const lines = roadLines();
const half = CONFIG.roadWidth / 2 + 1;
for (const v of lines) {
if (Math.abs(x - v) < half || Math.abs(z - v) < half) return true;
}
return false;
}

export function nearestRoadPoint(x, z) {
const lines = roadLines();
let bestX = x;
let bestZ = z;
let bestD = Infinity;
for (const v of lines) {
const d = Math.abs(x - v);
if (d < bestD) { bestD = d; bestX = v; }
}
bestD = Infinity;
for (const v of lines) {
const d = Math.abs(z - v);
if (d < bestD) { bestD = d; bestZ = v; }
}
if (Math.abs(x - bestX) < Math.abs(z - bestZ)) return { x: bestX, z };
return { x, z: bestZ };
}

export function buildWorld(scene, seed) {
const rng = makeRng(seed);
const colliders = [];
const palms = [];
const lamps = [];
const parks = [];

scene.fog = new THREE.Fog(PALETTE.fogColor, 180, 900);
const hemi = new THREE.HemisphereLight(0xffd9a0, 0x3a4a5a, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(PALETTE.sunColor, 1.6);
sun.position.set(-260, 180, 120);
scene.add(sun);
const fill = new THREE.DirectionalLight(0x88aaff, 0.35);
fill.position.set(200, 120, -160);
scene.add(fill);

const ground = new THREE.Mesh(
new THREE.PlaneGeometry(CONFIG.worldHalf * 2, CONFIG.worldHalf * 2),
new THREE.MeshLambertMaterial({ map: makeGroundTexture() }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.set(0, -0.05, 0);
scene.add(ground);

const sand = new THREE.Mesh(
new THREE.PlaneGeometry(70, CONFIG.worldHalf * 2),
new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
);
sand.rotation.x = -Math.PI / 2;
sand.position.set(CONFIG.beachX - 5, 0, 0);
scene.add(sand);

const ocean = new THREE.Mesh(
new THREE.PlaneGeometry(220, CONFIG.worldHalf * 2),
new THREE.MeshLambertMaterial({ color: PALETTE.ocean }),
);
ocean.rotation.x = -Math.PI / 2;
ocean.position.set(CONFIG.oceanX - 90, -0.4, 0);
scene.add(ocean);
const oceanDeep = new THREE.Mesh(
new THREE.PlaneGeometry(400, CONFIG.worldHalf * 2),
new THREE.MeshLambertMaterial({ color: PALETTE.oceanDeep }),
);
oceanDeep.rotation.x = -Math.PI / 2;
oceanDeep.position.set(CONFIG.oceanX - 280, -0.6, 0);
scene.add(oceanDeep);

const roadTex = makeRoadTexture();
const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
const lines = roadLines();
for (const v of lines) {
const roadX = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.roadWidth, CONFIG.cityHalf * 2 + CONFIG.roadWidth), roadMat.clone());
roadX.material.map = roadTex.clone();
roadX.material.map.repeat.set(1, 40);
roadX.material.map.needsUpdate = true;
roadX.rotation.x = -Math.PI / 2;
roadX.position.set(v, 0.02, 0);
scene.add(roadX);
const roadZ = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.cityHalf * 2 + CONFIG.roadWidth, CONFIG.roadWidth), roadMat.clone());
roadZ.material.map = roadTex.clone();
roadZ.material.map.center.set(0.5, 0.5);
roadZ.material.map.rotation = Math.PI / 2;
roadZ.material.map.repeat.set(1, 40);
roadZ.material.map.needsUpdate = true;
roadZ.rotation.x = -Math.PI / 2;
roadZ.position.set(0, 0.02, v);
scene.add(roadZ);
}

const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
const step = CONFIG.blockSize + CONFIG.roadWidth;
for (let ix = 0; ix < CONFIG.gridCount; ix++) {
for (let iz = 0; iz < CONFIG.gridCount; iz++) {
const cx = -CONFIG.cityHalf + CONFIG.roadWidth / 2 + ix * step + CONFIG.blockSize / 2;
const cz = -CONFIG.cityHalf + CONFIG.roadWidth / 2 + iz * step + CONFIG.blockSize / 2;
const walk = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.blockSize + 8, CONFIG.blockSize + 8), walkMat);
walk.rotation.x = -Math.PI / 2;
walk.position.set(cx, 0.03, cz);
scene.add(walk);
}
}

const windowTex = makeWindowTexture(rng);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const boxMat = new THREE.MeshLambertMaterial({ map: windowTex });
const placements = [];
for (let ix = 0; ix < CONFIG.gridCount; ix++) {
for (let iz = 0; iz < CONFIG.gridCount; iz++) {
const bx = -CONFIG.cityHalf + CONFIG.roadWidth / 2 + ix * step;
const bz = -CONFIG.cityHalf + CONFIG.roadWidth / 2 + iz * step;
const roll = rng();
if (roll < 0.12) {
parks.push({ x: bx + CONFIG.blockSize / 2, z: bz + CONFIG.blockSize / 2 });
const treeCount = rangeInt(rng, 4, 7);
for (let t = 0; t < treeCount; t++) {
palms.push({ x: bx + range(rng, 8, CONFIG.blockSize - 8), z: bz + range(rng, 8, CONFIG.blockSize - 8), s: range(rng, 0.8, 1.3) });
}
continue;
}
const count = roll < 0.55 ? 1 : 2;
for (let b = 0; b < count; b++) {
const w = range(rng, 18, 34);
const d = range(rng, 18, 34);
const h = range(rng, 10, 58);
const px = bx + (count === 1 ? CONFIG.blockSize / 2 : (b === 0 ? 18 : CONFIG.blockSize - 18));
const pz = bz + (count === 1 ? CONFIG.blockSize / 2 : (b === 0 ? 20 : CONFIG.blockSize - 20));
const x = px + range(rng, -4, 4) - w / 2;
const z = pz + range(rng, -4, 4) - d / 2;
placements.push({ x, z, w, d, h, color: pick(rng, BUILDING_COLORS) });
colliders.push({ minX: x - 0.5, maxX: x + w + 0.5, minZ: z - 0.5, maxZ: z + d + 0.5 });
}
}
}
const instanced = new THREE.InstancedMesh(boxGeo, boxMat, placements.length);
const matrix = new THREE.Matrix4();
const quat = new THREE.Quaternion();
const pos = new THREE.Vector3();
const scl = new THREE.Vector3();
const col = new THREE.Color();
for (let i = 0; i < placements.length; i++) {
const p = placements[i];
pos.set(p.x + p.w / 2, p.h / 2, p.z + p.d / 2);
scl.set(p.w, p.h, p.d);
matrix.compose(pos, quat, scl);
instanced.setMatrixAt(i, matrix);
col.setHex(p.color);
if (instanced.setColorAt) instanced.setColorAt(i, col);
}
instanced.instanceMatrix.needsUpdate = true;
if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
scene.add(instanced);

const sunDisc = new THREE.Mesh(
new THREE.CircleGeometry(46, 32),
new THREE.MeshBasicMaterial({ color: 0xffe9b0, fog: false }),
);
sunDisc.position.set(-700, 130, 60);
sunDisc.lookAt(0, 60, 0);
scene.add(sunDisc);
const sunGlow = new THREE.Mesh(
new THREE.CircleGeometry(90, 32),
new THREE.MeshBasicMaterial({ color: 0xff9a56, transparent: true, opacity: 0.35, fog: false }),
);
sunGlow.position.set(-702, 130, 58);
sunGlow.lookAt(0, 60, 0);
scene.add(sunGlow);

const skyCanvas = document.createElement('canvas');
skyCanvas.width = 4;
skyCanvas.height = 256;
const skyCtx = skyCanvas.getContext('2d');
const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 256);
skyGrad.addColorStop(0, '#2e4a7a');
skyGrad.addColorStop(0.45, '#c96a5a');
skyGrad.addColorStop(0.72, '#ff9a56');
skyGrad.addColorStop(1, '#ffb37a');
skyCtx.fillStyle = skyGrad;
skyCtx.fillRect(0, 0, 4, 256);
const skyTex = new THREE.CanvasTexture(skyCanvas);
const sky = new THREE.Mesh(
new THREE.SphereGeometry(1200, 24, 16),
new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }),
);
scene.add(sky);

const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 7, 6);
const trunkMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmTrunk });
const leafGeo = new THREE.ConeGeometry(2.2, 3.4, 6);
const leafMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmLeaf });
for (let i = 0; i < 46; i++) {
const alongBeach = i % 2 === 0;
const px = alongBeach ? CONFIG.beachX + 6 + range(rng, -4, 4) : range(rng, -300, 300);
const pz = alongBeach ? range(rng, -420, 420) : pick(rng, lines) + range(rng, 10, 12) * (rng() < 0.5 ? 1 : -1);
palms.push({ x: px, z: pz, s: range(rng, 0.8, 1.4) });
}
for (const p of palms) {
const trunk = new THREE.Mesh(trunkGeo, trunkMat);
trunk.position.set(p.x, 3.5 * p.s, p.z);
trunk.scale.setScalar(p.s);
trunk.rotation.z = range(rng, -0.06, 0.06);
scene.add(trunk);
const leaves = new THREE.Mesh(leafGeo, leafMat);
leaves.position.set(p.x, 7.3 * p.s, p.z);
leaves.scale.setScalar(p.s);
scene.add(leaves);
}

const lampGeo = new THREE.CylinderGeometry(0.12, 0.12, 6, 5);
const lampMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
const lampHeadGeo = new THREE.SphereGeometry(0.35, 8, 6);
const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xffe6a0 });
for (const v of lines) {
for (let k = -2; k <= 2; k++) {
const lx = v + 9;
const lz = k * 130;
const pole = new THREE.Mesh(lampGeo, lampMat);
pole.position.set(lx, 3, lz);
scene.add(pole);
const head = new THREE.Mesh(lampHeadGeo, lampHeadMat);
head.position.set(lx, 6.1, lz);
scene.add(head);
lamps.push({ x: lx, z: lz });
}
}

const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
for (let i = 0; i < 10; i++) {
const plank = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 8), pierMat);
plank.position.set(-360 - i * 7, 0.4, 232);
scene.add(plank);
}

return {
colliders,
palms,
lamps,
parks,
placements,
ocean,
sunDisc,
update(dt, time) {
ocean.position.y = -0.4 + Math.sin(time * 0.5) * 0.15;
},
};
}

export function resolveCircleCollision(pos, radius, colliders) {
for (const c of colliders) {
const cx = clamp(pos.x, c.minX, c.maxX);
const cz = clamp(pos.z, c.minZ, c.maxZ);
const dx = pos.x - cx;
const dz = pos.z - cz;
const d2 = dx * dx + dz * dz;
if (d2 < radius * radius && d2 > 0.0001) {
const d = Math.sqrt(d2);
const push = radius - d;
pos.x += (dx / d) * push;
pos.z += (dz / d) * push;
}
}
}

export function pointInCollider(x, z, colliders) {
for (const c of colliders) {
if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) return true;
}
return false;
}
