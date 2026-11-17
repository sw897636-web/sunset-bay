// Sunset Bay: the wanted system — stars, police pursuit cars, sirens,
// losing the tail, and getting busted.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeRng, range, pick, clamp } from './random.js';
import { makeCarMesh, makeCarRecord } from './vehicles.js';
import { roadLines, resolveCircleCollision } from './world.js';

export class PoliceSystem {
constructor(scene, world, seed) {
this.scene = scene;
this.world = world;
this.rng = makeRng(seed + 303);
this.wanted = 0;
this.crimeTimer = 0;
this.decayTimer = 0;
this.bustedTimer = 0;
this.cars = [];
this.lines = roadLines();
this.sirenPhase = 0;
this.sirenLight = null;
}
addWanted(stars) {
this.wanted = clamp(this.wanted + stars, 0, 5);
this.crimeTimer = 0;
this.decayTimer = 0;
}
setWanted(stars) {
this.wanted = clamp(stars, 0, 5);
this.crimeTimer = 0;
this.decayTimer = 0;
}
spawnPoliceCar(x, z) {
const mesh = makeCarMesh(0x1a1a1a, 'police');
const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.2, 1.2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
stripe.position.set(0, 0.62, 0.4);
mesh.add(stripe);
const car = makeCarRecord(mesh, 'police', 0x1a1a1a);
car.x = x;
car.z = z;
car.heading = this.rng() * Math.PI * 2;
car.speed = 0;
car.cruiseSpeed = 20;
this.scene.add(mesh);
this.cars.push(car);
return car;
}
nearestSpawn(px, pz) {
const angle = this.rng() * Math.PI * 2;
const dist = range(this.rng, 90, 130);
let x = px + Math.cos(angle) * dist;
let z = pz + Math.sin(angle) * dist;
x = clamp(x, -CONFIG.cityHalf + 10, CONFIG.cityHalf - 10);
z = clamp(z, -CONFIG.cityHalf + 10, CONFIG.cityHalf - 10);
const lines = this.lines;
let bestX = x;
let bestD = Infinity;
for (const v of lines) {
const d = Math.abs(x - v);
if (d < bestD) { bestD = d; bestX = v; }
}
return { x: bestX, z };
}
update(dt, player) {
this.crimeTimer += dt;
if (this.wanted > 0 && this.crimeTimer > CONFIG.wantedDecaySeconds) {
this.decayTimer += dt;
if (this.decayTimer > 10) {
this.decayTimer = 0;
this.wanted = Math.max(0, this.wanted - 1);
}
}
const want = this.wanted === 0 ? 0 : Math.min(2 + this.wanted, CONFIG.policeMax);
while (this.cars.length < want) {
const s = this.nearestSpawn(player.x, player.z);
this.spawnPoliceCar(s.x, s.z);
}
while (this.cars.length > want) {
const car = this.cars.pop();
this.scene.remove(car.mesh);
}
let nearest = Infinity;
for (const car of this.cars) {
const dx = player.x - car.x;
const dz = player.z - car.z;
const dist = Math.sqrt(dx * dx + dz * dz);
if (dist < nearest) nearest = dist;
const desired = car.staged ? car.heading : Math.atan2(dx, dz);
let diff = desired - car.heading;
while (diff > Math.PI) diff -= Math.PI * 2;
while (diff < -Math.PI) diff += Math.PI * 2;
car.heading += clamp(diff, -2.4 * dt, 2.4 * dt);
const topSpeed = car.staged ? (player.car ? player.car.speed : 0) : 15 + this.wanted * 2.2;
car.speed += clamp(topSpeed - car.speed, -10 * dt, 8 * dt);
const nx = car.x + Math.sin(car.heading) * car.speed * dt;
const nz = car.z + Math.cos(car.heading) * car.speed * dt;
const pos = { x: nx, z: nz };
resolveCircleCollision(pos, 1.7, this.world.colliders);
car.x = pos.x;
car.z = pos.z;
car.mesh.position.set(car.x, 0, car.z);
car.mesh.rotation.y = car.heading;
const bar = car.mesh.children.find((c) => c.geometry && c.geometry.parameters && c.geometry.parameters.width === 1.1);
if (bar) {
this.sirenPhase += dt * 6;
bar.material.color.setHex(Math.sin(this.sirenPhase) > 0 ? 0xff2222 : 0x2244ff);
}
}
if (this.wanted > 0 && player.onFoot && nearest < 4) {
this.bustedTimer += dt;
} else {
this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2);
}
return { nearestPolice: nearest, busted: this.bustedTimer >= CONFIG.bustedSeconds };
}
clearAll() {
for (const car of this.cars) this.scene.remove(car.mesh);
this.cars = [];
this.wanted = 0;
this.bustedTimer = 0;
}
}
