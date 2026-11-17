// Sunset Bay city builder: procedural sun-soaked coastal city.
// Grid of streets, painted ground texture, buildings with lit windows,
// palm trees, lamps, beach and ocean, sunset sky dome and low sun.
import * as THREE from 'three';
import { mulberry32, pick, range, intRange, makeCanvas } from './util.js';

export const WORLD = {
half: 600,
roadEvery: 120,
roadWidth: 18,
beachX: -480,
roads: [-480, -360, -240, -120, 0, 120, 240, 360, 480],
blockCenters: [-420, -300, -180, -60, 60, 180, 300, 420],
};

const BUILDING_COLORS = [0xd9a06b, 0xc98f7a, 0x8fa8a0, 0xe0cfa8, 0xb0705f, 0x7a90a8, 0xd8b48a, 0xa89080];
const ROOF_COLORS = [0x5a4a3e, 0x4a3e36, 0x6b5a48, 0x3e3a34];

function makeFacadeTexture(rng, litRatio) {
const c = makeCanvas(128, 256);
const g = c.getContext('2d');
g.fillStyle = '#a89e8c';
g.fillRect(0, 0, 128, 256);
const cols = 6;
const rows = 12;
for (let y = 0; y < rows; y++) {
for (let x = 0; x < cols; x++) {
const lit = rng() < litRatio;
g.fillStyle = lit ? '#ffd27a' : '#2e3440';
g.fillRect(8 + x * 20, 10 + y * 20, 12, 12);
}
}
const tex = new THREE.CanvasTexture(c);
tex.colorSpace = THREE.SRGBColorSpace;
return tex;
}

function buildGroundTexture(rng, parks, lots) {
const S = 2048;
const scale = S / (WORLD.half * 2);
const c = makeCanvas(S, S);
const g = c.getContext('2d');
const X = (x) => (x + WORLD.half) * scale;
const Z = (z) => (z + WORLD.half) * scale;
g.fillStyle = '#8f8578';
g.fillRect(0, 0, S, S);
// Park blocks.
for (const p of parks) {
g.fillStyle = '#5d7a45';
g.fillRect(X(p.x - 51), Z(p.z - 51), 102 * scale, 102 * scale);
g.fillStyle = '#6d8a52';
for (let i = 0; i < 14; i++) {
g.beginPath();
g.arc(X(p.x - 40 + rng() * 80), Z(p.z - 40 + rng() * 80), 7 * scale, 0, Math.PI * 2);
g.fill();
}
}
// Parking lots.
for (const p of lots) {
g.fillStyle = '#3a3d42';
g.fillRect(X(p.x - 51), Z(p.z - 51), 102 * scale, 102 * scale);
g.strokeStyle = '#d8d8d8';
g.lineWidth = 2;
for (let i = 0; i < 5; i++) {
const x0 = X(p.x - 40 + i * 18);
g.beginPath();
g.moveTo(x0, Z(p.z - 30));
g.lineTo(x0, Z(p.z + 30));
g.stroke();
}
}
// Roads.
g.fillStyle = '#33363d';
for (const r of WORLD.roads) {
g.fillRect(X(r - 9), 0, 18 * scale, S);
g.fillRect(0, Z(r - 9), S, 18 * scale);
}
// Block interiors: vary the concrete tone so the city reads as built-up.
const parkKeys = new Set(parks.map((p) => p.x + ',' + p.z));
const lotKeys = new Set(lots.map((p) => p.x + ',' + p.z));
for (const bx of [-420, -300, -180, -60, 60, 180, 300, 420]) {
for (const bz of [-420, -300, -180, -60, 60, 180, 300, 420]) {
if (parkKeys.has(bx + ',' + bz) || lotKeys.has(bx + ',' + bz)) continue;
const tone = 133 + Math.floor(rng() * 22);
g.fillStyle = 'rgb(' + tone + ',' + (tone - 6) + ',' + (tone - 14) + ')';
g.fillRect(X(bx - 51), Z(bz - 51), 102 * scale, 102 * scale);
}
}
// Lane dashes.
g.fillStyle = '#e8c84a';
for (const r of WORLD.roads) {
for (let t = -WORLD.half + 20; t < WORLD.half; t += 36) {
g.fillRect(X(t), Z(r - 0.7), 18 * scale, 1.4 * scale);
g.fillRect(X(r - 0.7), Z(t), 1.4 * scale, 18 * scale);
}
}
// Crosswalks at intersections.
g.fillStyle = '#d8d8d8';
for (const rx of WORLD.roads) {
for (const rz of WORLD.roads) {
for (let i = -3; i <= 3; i++) {
g.fillRect(X(rx + i * 2.4 - 0.8), Z(rz - 8), 1.6 * scale, 3 * scale);
g.fillRect(X(rx + i * 2.4 - 0.8), Z(rz + 5), 1.6 * scale, 3 * scale);
}
}
}
// Beach sand on the west edge.
const sand = g.createLinearGradient(X(-600), 0, X(-480), 0);
sand.addColorStop(0, '#e8c98f');
sand.addColorStop(1, '#d9b380');
g.fillStyle = sand;
g.fillRect(0, 0, X(-480), S);
g.fillStyle = '#c9a06a';
for (let i = 0; i < 40; i++) {
g.beginPath();
g.arc(rng() * X(-480), rng() * S, 2 + rng() * 4, 0, Math.PI * 2);
g.fill();
}
const tex = new THREE.CanvasTexture(c);
tex.colorSpace = THREE.SRGBColorSpace;
tex.anisotropy = 4;
return tex;
}

function makePalm(rng) {
const group = new THREE.Group();
const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a3a });
const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 7, 6), trunkMat);
trunk.position.y = 3.5;
trunk.rotation.z = (rng() - 0.5) * 0.16;
group.add(trunk);
const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f7a3a });
const foliage = new THREE.Mesh(new THREE.IcosahedronGeometry(2.1, 0), leafMat);
foliage.position.y = 7.2;
foliage.scale.set(1.25, 0.55, 1.25);
group.add(foliage);
for (let i = 0; i < 3; i++) {
const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.0, 4), leafMat);
const a = (i / 3) * Math.PI * 2;
leaf.position.set(Math.cos(a) * 1.5, 7.0, Math.sin(a) * 1.5);
leaf.rotation.z = Math.cos(a) * 1.2;
leaf.rotation.x = -Math.sin(a) * 1.2;
leaf.scale.set(1, 1, 0.28);
group.add(leaf);
}
const nut = new THREE.Mesh(new THREE.SphereGeometry(0.42, 6, 5), new THREE.MeshLambertMaterial({ color: 0x6b4a26 }));
nut.position.y = 6.9;
group.add(nut);
return group;
}

function makeLamp() {
const group = new THREE.Group();
const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6, 6), new THREE.MeshLambertMaterial({ color: 0x2e3238 }));
pole.position.y = 3;
group.add(pole);
const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshLambertMaterial({ color: 0xffe2a0, emissive: 0xffc46b, emissiveIntensity: 0.9 }));
bulb.position.y = 6.1;
group.add(bulb);
return group;
}

export function buildCity(scene, seed) {
const rng = mulberry32(seed);
const colliders = [];
const parks = [{ x: 180, z: 180 }, { x: -300, z: 300 }];
const lots = [{ x: 420, z: -180 }, { x: -180, z: 420 }];
const parkSet = new Set(parks.map((p) => p.x + ',' + p.z));
const lotSet = new Set(lots.map((p) => p.x + ',' + p.z));
// Sky dome with a sunset gradient.
const skyCanvas = makeCanvas(16, 256);
const sg = skyCanvas.getContext('2d');
const grad = sg.createLinearGradient(0, 0, 0, 256);
grad.addColorStop(0, '#1c1445');
grad.addColorStop(0.45, '#7a2d5e');
grad.addColorStop(0.72, '#ff7e4a');
grad.addColorStop(1, '#ffc46b');
sg.fillStyle = grad;
sg.fillRect(0, 0, 16, 256);
const skyTex = new THREE.CanvasTexture(skyCanvas);
skyTex.colorSpace = THREE.SRGBColorSpace;
const sky = new THREE.Mesh(
new THREE.SphereGeometry(1600, 24, 16),
new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })
);
scene.add(sky);
// Low sun in the west.
const sun = new THREE.Mesh(new THREE.CircleGeometry(90, 32), new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false }));
sun.position.set(-1150, 170, 60);
sun.lookAt(0, 60, 0);
scene.add(sun);
const glow = new THREE.Mesh(new THREE.CircleGeometry(190, 32), new THREE.MeshBasicMaterial({ color: 0xff9a4a, transparent: true, opacity: 0.28, fog: false }));
glow.position.set(-1160, 170, 60);
glow.lookAt(0, 60, 0);
scene.add(glow);
// Ocean west of the beach.
const ocean = new THREE.Mesh(new THREE.PlaneGeometry(900, 1500), new THREE.MeshLambertMaterial({ color: 0x2a7ba8 }));
ocean.rotation.x = -Math.PI / 2;
ocean.position.set(-1050, -0.4, 0);
scene.add(ocean);
for (let i = 0; i < 3; i++) {
const foam = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1400), new THREE.MeshBasicMaterial({ color: 0xd8f0f0, transparent: true, opacity: 0.5 }));
foam.rotation.x = -Math.PI / 2;
foam.position.set(-612 - i * 22, -0.2, 0);
scene.add(foam);
}
// Ground with painted streets.
const ground = new THREE.Mesh(
new THREE.PlaneGeometry(WORLD.half * 2, WORLD.half * 2),
new THREE.MeshLambertMaterial({ map: buildGroundTexture(rng, parks, lots) })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
// Lights.
scene.add(new THREE.HemisphereLight(0x8a6bbf, 0x4a3a2e, 1.05));
scene.add(new THREE.AmbientLight(0xffd9b0, 0.4));
const sunLight = new THREE.DirectionalLight(0xffb36b, 1.5);
sunLight.position.set(-400, 500, 250);
scene.add(sunLight);
scene.fog = new THREE.Fog(0xe8905a, 260, 1500);
// Buildings.
const facades = [makeFacadeTexture(rng, 0.35), makeFacadeTexture(rng, 0.5), makeFacadeTexture(rng, 0.25)];
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
for (const bx of WORLD.blockCenters) {
for (const bz of WORLD.blockCenters) {
const key = bx + ',' + bz;
if (parkSet.has(key) || lotSet.has(key)) continue;
const distCenter = Math.sqrt(bx * bx + bz * bz);
const downtown = distCenter < 320 ? 1 : 0;
const n = downtown ? intRange(rng, 2, 4) : intRange(rng, 2, 3);
const cellOffsets = [[-22, -22], [22, -22], [-22, 22], [22, 22]];
for (let i = cellOffsets.length - 1; i > 0; i--) {
const j = Math.floor(rng() * (i + 1));
const tmp = cellOffsets[i];
cellOffsets[i] = cellOffsets[j];
cellOffsets[j] = tmp;
}
const cells = cellOffsets.slice(0, n);
for (const [ox, oz] of cells) {
const w = range(rng, 18, 34);
const d = range(rng, 18, 34);
const h = downtown ? range(rng, 34, 88) : range(rng, 12, 42);
const cx = bx + ox;
const cz = bz + oz;
const tint = pick(rng, BUILDING_COLORS);
const side = new THREE.MeshLambertMaterial({ map: pick(rng, facades), color: tint });
const b = new THREE.Mesh(boxGeo, side);
b.scale.set(w, h, d);
b.position.set(cx, h / 2, cz);
scene.add(b);
colliders.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, h });
if (rng() < 0.4) {
const ac = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 2.4), new THREE.MeshLambertMaterial({ color: 0x9aa0a8 }));
ac.position.set(cx + range(rng, -w / 4, w / 4), h + 0.7, cz + range(rng, -d / 4, d / 4));
scene.add(ac);
}
}
}
}
// Palm trees: beach row, park clusters, a few sidewalk singles.
for (let z = -540; z <= 540; z += 72) {
const palm = makePalm(rng);
palm.position.set(range(rng, -560, -500), 0, z + range(rng, -8, 8));
scene.add(palm);
}
for (const p of parks) {
for (let i = 0; i < 6; i++) {
const palm = makePalm(rng);
palm.position.set(p.x + range(rng, -44, 44), 0, p.z + range(rng, -44, 44));
scene.add(palm);
}
}
// Street lamps at every fourth intersection corner.
for (let i = 0; i < WORLD.roads.length; i += 4) {
for (let j = 0; j < WORLD.roads.length; j += 4) {
const lamp = makeLamp();
lamp.position.set(WORLD.roads[i] + 11, 0, WORLD.roads[j] + 11);
scene.add(lamp);
}
}
// Downtown billboard.
const board = new THREE.Group();
const boardPole = new THREE.Mesh(new THREE.BoxGeometry(2, 26, 2), new THREE.MeshLambertMaterial({ color: 0x3a3d42 }));
boardPole.position.y = 13;
board.add(boardPole);
const boardCanvas = makeCanvas(512, 128);
const bg = boardCanvas.getContext('2d');
bg.fillStyle = '#1c2a4a';
bg.fillRect(0, 0, 512, 128);
bg.fillStyle = '#ffd27a';
bg.font = 'bold 56px sans-serif';
bg.textAlign = 'center';
bg.fillText('SUNSET BAY', 256, 82);
const boardTex = new THREE.CanvasTexture(boardCanvas);
boardTex.colorSpace = THREE.SRGBColorSpace;
const boardFace = new THREE.Mesh(new THREE.PlaneGeometry(26, 6.5), new THREE.MeshBasicMaterial({ map: boardTex }));
boardFace.position.y = 28;
boardFace.rotation.y = Math.PI / 4;
board.add(boardFace);
board.position.set(60, 0, -60);
scene.add(board);
return { colliders, roads: WORLD.roads, parks, lots, sun, ocean };
}
