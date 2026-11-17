// Sunset Bay: cars — the box-built models, the traffic that drives the
// avenues, and the arcade driving physics for the player's car.

import * as THREE from 'three';
import { CONFIG, CAR_COLORS } from './config.js';
import { makeRng, range, rangeInt, pick, clamp, angleLerp } from './random.js';
import { roadLines, resolveCircleCollision } from './world.js';

export function makeCarMesh(color, kind) {
const group = new THREE.Group();
const paint = new THREE.MeshLambertMaterial({ color });
const dark = new THREE.MeshLambertMaterial({ color: 0x181818 });
const glass = new THREE.MeshLambertMaterial({ color: 0x2a3d4d });
const isSport = kind === 'sport';
const isTaxi = kind === 'taxi';
const bodyLen = isSport ? 4.6 : 4.2;
const bodyW = 1.9;
const bodyH = isSport ? 0.62 : 0.78;
const body = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, bodyLen), isTaxi ? new THREE.MeshLambertMaterial({ color: 0xf1c40f }) : paint);
body.position.y = 0.55;
group.add(body);
const cabin = new THREE.Mesh(new THREE.BoxGeometry(bodyW - 0.3, 0.6, bodyLen * 0.46), glass);
cabin.position.set(0, 1.05, isSport ? -0.2 : -0.1);
group.add(cabin);
const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
wheelGeo.rotateZ(Math.PI / 2);
for (const sx of [-1, 1]) {
for (const sz of [-1, 1]) {
const wheel = new THREE.Mesh(wheelGeo, dark);
wheel.position.set(sx * 0.95, 0.36, sz * (bodyLen / 2 - 0.7));
group.add(wheel);
}
}
const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
for (const sx of [-1, 1]) {
const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), lightMat);
head.position.set(sx * 0.62, 0.62, bodyLen / 2 + 0.01);
group.add(head);
const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
tail.position.set(sx * 0.62, 0.62, -bodyLen / 2 - 0.01);
group.add(tail);
}
if (isTaxi) {
const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0x111111 }));
sign.position.set(0, 1.45, -0.1);
group.add(sign);
}
if (kind === 'police') {
const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.4), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
bar.position.set(0, 1.42, -0.1);
group.add(bar);
}
group.userData.bodyLen = bodyLen;
return group;
}

export function makeCarRecord(mesh, kind, color) {
return {
mesh,
kind,
color,
heading: 0,
speed: 0,
steer: 0,
health: CONFIG.carHealth,
smoking: false,
dead: false,
x: 0,
z: 0,
};
}

export class TrafficSystem {
constructor(scene, world, seed) {
this.scene = scene;
this.world = world;
this.rng = makeRng(seed + 101);
this.cars = [];
this.lines = roadLines();
for (let i = 0; i < CONFIG.trafficCount; i++) {
const kind = this.rng() < 0.12 ? 'taxi' : (this.rng() < 0.2 ? 'sport' : 'sedan');
const color = pick(this.rng, CAR_COLORS);
const mesh = makeCarMesh(color, kind);
const car = makeCarRecord(mesh, kind, color);
this.placeOnRoad(car, true);
car.speed = range(this.rng, 7, 13);
scene.add(mesh);
this.cars.push(car);
}
}
placeOnRoad(car, randomHeading) {
const alongX = this.rng() < 0.5;
const line = pick(this.rng, this.lines);
const lane = 4;
const along = range(this.rng, -CONFIG.cityHalf + 20, CONFIG.cityHalf - 20);
if (alongX) {
car.x = along;
car.z = line + lane * (this.rng() < 0.5 ? 1 : -1);
car.heading = randomHeading ? (this.rng() < 0.5 ? 0 : Math.PI) : 0;
} else {
car.x = line + lane * (this.rng() < 0.5 ? 1 : -1);
car.z = along;
car.heading = randomHeading ? (this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : Math.PI / 2;
}
car.mesh.position.set(car.x, 0, car.z);
car.mesh.rotation.y = car.heading;
}
nearestAhead(car, maxDist) {
let best = null;
let bestD = maxDist;
for (const other of this.cars) {
if (other === car || other.dead) continue;
const dx = other.x - car.x;
const dz = other.z - car.z;
const forward = Math.sin(car.heading) * dx + Math.cos(car.heading) * dz;
const side = Math.cos(car.heading) * dx - Math.sin(car.heading) * dz;
if (forward > 0 && forward < bestD && Math.abs(side) < 3) {
best = other;
bestD = forward;
}
}
return best;
}
update(dt, playerCar) {
for (const car of this.cars) {
if (car.dead) continue;
const ahead = this.nearestAhead(car, 14);
if (!car.cruiseSpeed) car.cruiseSpeed = range(this.rng, 7, 13);
const cruise = car.cruiseSpeed;
let target = cruise;
if (ahead) {
target = Math.max(0, cruise - (14 - this.carGap(car, ahead)) * 1.2);
}
car.speed += clamp(target - car.speed, -8 * dt, 5 * dt);
const nx = car.x + Math.sin(car.heading) * car.speed * dt;
const nz = car.z + Math.cos(car.heading) * car.speed * dt;
const pos = { x: nx, z: nz };
resolveCircleCollision(pos, 1.6, this.world.colliders);
car.x = pos.x;
car.z = pos.z;
const lines = this.lines;
let nearLine = false;
for (const v of lines) {
if (Math.abs(car.x - v) < 9 || Math.abs(car.z - v) < 9) { nearLine = true; break; }
}
if (nearLine && this.rng() < dt * 0.12) {
const turns = [0, Math.PI / 2, -Math.PI / 2];
car.heading += pick(this.rng, turns);
}
if (Math.abs(car.x) > CONFIG.cityHalf + 10 || Math.abs(car.z) > CONFIG.cityHalf + 10) {
this.placeOnRoad(car, true);
}
car.mesh.position.set(car.x, 0, car.z);
car.mesh.rotation.y = car.heading;
}
}
carGap(a, b) {
const dx = b.x - a.x;
const dz = b.z - a.z;
return Math.sqrt(dx * dx + dz * dz);
}
nearestCar(x, z, maxDist, exclude) {
let best = null;
let bestD = maxDist;
for (const car of this.cars) {
if (car === exclude || car.dead) continue;
const dx = car.x - x;
const dz = car.z - z;
const d = Math.sqrt(dx * dx + dz * dz);
if (d < bestD) { bestD = d; best = car; }
}
return best;
}
remove(car) {
car.dead = true;
this.scene.remove(car.mesh);
}
}

export function drivePlayerCar(car, input, dt, colliders, onHit) {
const forward = input.forward ? 1 : 0;
const back = input.back ? 1 : 0;
const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
const handbrake = input.handbrake ? 1 : 0;
if (forward) car.speed += CONFIG.carAccel * dt;
if (back) {
if (car.speed > 0.5) car.speed -= CONFIG.carBrake * dt;
else car.speed -= CONFIG.carReverseAccel * dt;
}
if (!forward && !back) {
const drag = 6 * dt;
if (Math.abs(car.speed) < drag) car.speed = 0;
else car.speed -= Math.sign(car.speed) * drag;
}
if (handbrake) {
car.speed *= Math.max(0, 1 - 3.2 * dt);
}
car.speed = clamp(car.speed, -CONFIG.carMaxReverse, CONFIG.carMaxSpeed);
const speedFactor = clamp(Math.abs(car.speed) / 12, 0, 1);
car.heading += steerInput * CONFIG.carTurnRate * speedFactor * Math.sign(car.speed || 1) * dt * (handbrake ? 1.5 : 1);
const nx = car.x + Math.sin(car.heading) * car.speed * dt;
const nz = car.z + Math.cos(car.heading) * car.speed * dt;
const before = { x: car.x, z: car.z };
const pos = { x: nx, z: nz };
resolveCircleCollision(pos, 1.7, colliders);
const hitWall = Math.abs(pos.x - nx) > 0.01 || Math.abs(pos.z - nz) > 0.01;
if (hitWall) {
const impact = Math.abs(car.speed);
car.speed *= 0.4;
if (impact > 12 && onHit) onHit(impact);
}
car.x = pos.x;
car.z = pos.z;
if (Math.abs(car.x) > CONFIG.worldHalf || Math.abs(car.z) > CONFIG.worldHalf) {
car.x = before.x;
car.z = before.z;
car.speed *= 0.3;
}
car.mesh.position.set(car.x, 0, car.z);
car.mesh.rotation.y = car.heading;
const wheels = car.mesh.children.filter((c) => c.geometry && c.geometry.parameters && c.geometry.parameters.radiusTop === 0.36);
for (const w of wheels) w.rotation.x += (car.speed * dt) / 0.36;
}
