// Sunset Bay: pedestrians — the people walking the sidewalks, who run
// away from gunfire and can be knocked down by a speeding car.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeRng, range, rangeInt, pick, clamp } from './random.js';
import { roadLines, resolveCircleCollision } from './world.js';

const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xecf0f1, 0x34495e];

export function makePedestrianMesh(rng) {
const group = new THREE.Group();
const skin = new THREE.MeshLambertMaterial({ color: pick(rng, SKINS) });
const shirt = new THREE.MeshLambertMaterial({ color: pick(rng, SHIRTS) });
const pants = new THREE.MeshLambertMaterial({ color: pick(rng, [0x2c3e50, 0x7f8c8d, 0x5d4037]) });
const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.8, 0.26), pants);
legs.position.y = 0.4;
group.add(legs);
const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.3), shirt);
torso.position.y = 1.1;
group.add(torso);
const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
head.position.y = 1.62;
group.add(head);
const hair = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: pick(rng, [0x1a1a1a, 0x4a2f18, 0x888888, 0xd8b25a]) }));
hair.position.y = 1.66;
group.add(hair);
group.userData.legs = legs;
group.userData.torso = torso;
group.userData.head = head;
return group;
}

export class PedestrianSystem {
constructor(scene, world, seed) {
this.scene = scene;
this.world = world;
this.rng = makeRng(seed + 202);
this.peds = [];
this.lines = roadLines();
for (let i = 0; i < CONFIG.pedCount; i++) {
const mesh = makePedestrianMesh(this.rng);
const ped = {
mesh,
x: 0,
z: 0,
heading: 0,
speed: range(this.rng, 1.0, 1.9),
targetX: 0,
targetZ: 0,
state: 'walk',
down: false,
downTimer: 0,
panic: 0,
walkPhase: this.rng() * Math.PI * 2,
};
this.placeOnSidewalk(ped);
scene.add(mesh);
this.peds.push(ped);
}
}
placeOnSidewalk(ped) {
const line = pick(this.rng, this.lines);
const along = range(this.rng, -CONFIG.cityHalf + 10, CONFIG.cityHalf - 10);
const side = pick(this.rng, [-1, 1]);
if (this.rng() < 0.5) {
ped.x = along;
ped.z = line + side * 10;
ped.targetX = along + range(this.rng, -90, 90) * (this.rng() < 0.5 ? 1 : -1);
ped.targetZ = ped.z;
} else {
ped.x = line + side * 10;
ped.z = along;
ped.targetX = ped.x;
ped.targetZ = along + range(this.rng, -90, 90) * (this.rng() < 0.5 ? 1 : -1);
}
ped.heading = Math.atan2(ped.targetX - ped.x, ped.targetZ - ped.z);
ped.mesh.position.set(ped.x, 0, ped.z);
ped.mesh.rotation.y = ped.heading;
}
scare(x, z, radius) {
for (const ped of this.peds) {
if (ped.down) continue;
const dx = ped.x - x;
const dz = ped.z - z;
const d = Math.sqrt(dx * dx + dz * dz);
if (d < radius) {
ped.panic = 4;
ped.heading = Math.atan2(dx, dz);
}
}
}
knockDown(x, z, radius) {
let hit = 0;
for (const ped of this.peds) {
if (ped.down) continue;
const dx = ped.x - x;
const dz = ped.z - z;
const d = Math.sqrt(dx * dx + dz * dz);
if (d < radius) {
ped.down = true;
ped.downTimer = 6;
ped.mesh.rotation.x = Math.PI / 2;
ped.mesh.position.y = 0.3;
hit++;
}
}
return hit;
}
nearest(x, z, maxDist) {
let best = null;
let bestD = maxDist;
for (const ped of this.peds) {
if (ped.down) continue;
const dx = ped.x - x;
const dz = ped.z - z;
const d = Math.sqrt(dx * dx + dz * dz);
if (d < bestD) { bestD = d; best = ped; }
}
return best;
}
update(dt) {
for (const ped of this.peds) {
if (ped.down) {
ped.downTimer -= dt;
if (ped.downTimer <= 0) {
ped.down = false;
ped.mesh.rotation.x = 0;
ped.mesh.position.y = 0;
this.placeOnSidewalk(ped);
}
continue;
}
let speed = ped.speed;
if (ped.panic > 0) {
ped.panic -= dt;
speed = 4.2;
}
const dx = ped.targetX - ped.x;
const dz = ped.targetZ - ped.z;
const dist = Math.sqrt(dx * dx + dz * dz);
if (dist < 1.5) {
this.placeOnSidewalk(ped);
continue;
}
ped.heading = Math.atan2(dx, dz);
const nx = ped.x + Math.sin(ped.heading) * speed * dt;
const nz = ped.z + Math.cos(ped.heading) * speed * dt;
const pos = { x: nx, z: nz };
resolveCircleCollision(pos, 0.5, this.world.colliders);
ped.x = pos.x;
ped.z = pos.z;
ped.walkPhase += dt * speed * 4;
const bob = Math.abs(Math.sin(ped.walkPhase)) * 0.05;
ped.mesh.position.set(ped.x, bob, ped.z);
ped.mesh.rotation.y = ped.heading;
ped.mesh.rotation.z = Math.sin(ped.walkPhase) * 0.05;
}
}
}
