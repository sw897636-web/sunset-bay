// Sunset Bay vehicles: car mesh factory, grid traffic AI and parked cars.
// Every car faces +Z when rotation.y is 0; forward is (sin heading, 0, cos heading).
import * as THREE from 'three';
import { mulberry32, pick, range, clamp } from './util.js';
import { WORLD } from './city.js';

const CAR_COLORS = [0xc23b2e, 0x2e6fc2, 0xd8a020, 0x3a9a5a, 0x8a5fc2, 0xd8d8d8, 0x222226, 0x7a4a2e, 0x4aa8a0];

export function makeCarMesh(color, kind) {
const group = new THREE.Group();
const bodyMat = new THREE.MeshLambertMaterial({ color });
const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a1d22 });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x2a3a4a });
const isTruck = kind === 'truck';
const len = kind === 'sport' ? 4.1 : isTruck ? 5.4 : 4.4;
const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.72, len), bodyMat);
body.position.y = 0.62;
group.add(body);
const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.62, isTruck ? 1.4 : 2.1), glassMat);
cabin.position.set(0, 1.24, isTruck ? 0.9 : -0.2);
group.add(cabin);
if (isTruck) {
const bed = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 2.2), darkMat);
bed.position.set(0, 1.05, -1.4);
group.add(bed);
}
const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
wheelGeo.rotateZ(Math.PI / 2);
const wheels = [];
for (const [wx, wz] of [[-0.95, len / 2 - 0.8], [0.95, len / 2 - 0.8], [-0.95, -len / 2 + 0.8], [0.95, -len / 2 + 0.8]]) {
const wheel = new THREE.Mesh(wheelGeo, darkMat);
wheel.position.set(wx, 0.38, wz);
group.add(wheel);
wheels.push(wheel);
}
const headMat = new THREE.MeshLambertMaterial({ color: 0xfff2c0, emissive: 0xffedb0, emissiveIntensity: 0.7 });
for (const hx of [-0.6, 0.6]) {
const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.08), headMat);
head.position.set(hx, 0.66, len / 2 + 0.01);
group.add(head);
}
const tailMat = new THREE.MeshLambertMaterial({ color: 0xaa1414, emissive: 0x881111, emissiveIntensity: 0.6 });
for (const hx of [-0.6, 0.6]) {
const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), tailMat);
tail.position.set(hx, 0.68, -len / 2 - 0.01);
group.add(tail);
}
if (kind === 'police') {
const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.5), darkMat);
barBase.position.set(0, 1.62, -0.2);
group.add(barBase);
const red = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.18, 0.5), new THREE.MeshLambertMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 1 }));
red.position.set(-0.28, 1.62, -0.2);
group.add(red);
const blue = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.18, 0.5), new THREE.MeshLambertMaterial({ color: 0x2040ff, emissive: 0x2040ff, emissiveIntensity: 1 }));
blue.position.set(0.28, 1.62, -0.2);
group.add(blue);
group.userData.lightRed = red;
group.userData.lightBlue = blue;
}
if (kind === 'taxi') {
const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), new THREE.MeshLambertMaterial({ color: 0xffe94a, emissive: 0xccaa00, emissiveIntensity: 0.5 }));
sign.position.set(0, 1.66, -0.2);
group.add(sign);
}
group.userData.wheels = wheels;
group.userData.length = len;
return group;
}

export function makePoliceCarMesh() {
return makeCarMesh(0x181a1e, 'police');
}

function roadHeading(axis, dir) {
if (axis === 'x') return dir > 0 ? Math.PI / 2 : -Math.PI / 2;
return dir > 0 ? 0 : Math.PI;
}

export class TrafficCar {
constructor(scene, rng, city) {
this.kind = pick(rng, ['sedan', 'sedan', 'sport', 'truck', 'taxi']);
this.mesh = makeCarMesh(pick(rng, CAR_COLORS), this.kind);
this.axis = rng() < 0.5 ? 'x' : 'z';
this.dir = rng() < 0.5 ? 1 : -1;
this.road = pick(rng, WORLD.roads);
this.lane = (rng() < 0.5 ? -4.5 : 4.5) * this.dir;
this.coord = range(rng, -560, 560);
this.baseSpeed = range(rng, 11, 17);
this.speed = this.baseSpeed;
this.lastTurnCoord = 9999;
this.stopped = false;
scene.add(this.mesh);
this.syncMesh();
}
syncMesh() {
if (this.axis === 'x') {
this.mesh.position.set(this.coord, 0, this.road + this.lane);
} else {
this.mesh.position.set(this.road + this.lane, 0, this.coord);
}
this.mesh.rotation.y = roadHeading(this.axis, this.dir);
const spin = this.speed * 0.016 / 0.38;
for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
}
update(dt, rng, others) {
let target = this.baseSpeed;
// Stop for a car ahead on the same lane.
for (const o of others) {
if (o === this || o.axis !== this.axis || o.road !== this.road || Math.abs(o.lane - this.lane) > 2) continue;
const ahead = (o.coord - this.coord) * this.dir;
if (ahead > 0 && ahead < 13) { target = 0; break; }
}
this.speed += clamp(target - this.speed, -26 * dt, 14 * dt);
this.coord += this.dir * this.speed * dt;
// Maybe turn at an intersection.
if (this.speed > 4) {
for (const r of WORLD.roads) {
if (Math.abs(this.coord - r) < 2.5 && Math.abs(this.coord - this.lastTurnCoord) > 60 && rng() < 0.22) {
this.lastTurnCoord = r;
this.axis = this.axis === 'x' ? 'z' : 'x';
this.road = r;
this.dir = rng() < 0.5 ? 1 : -1;
this.lane = (rng() < 0.5 ? -4.5 : 4.5) * this.dir;
this.coord = this.axis === 'x' ? this.mesh.position.x : this.mesh.position.z;
break;
}
}
}
if (this.coord > 590) this.coord = -590;
if (this.coord < -590) this.coord = 590;
this.syncMesh();
}
}

export function spawnParkedCars(scene, rng, count) {
const cars = [];
const spots = [];
for (const lot of [{ x: 420, z: -180 }, { x: -180, z: 420 }]) {
for (let i = 0; i < 6; i++) spots.push({ x: lot.x - 40 + i * 16, z: lot.z - 20, heading: 0 });
}
for (const r of WORLD.roads) {
if (rng() < 0.6) spots.push({ x: r + 14, z: range(rng, -400, 400), heading: Math.PI / 2 });
}
for (let i = 0; i < count && spots.length; i++) {
const s = spots.splice(Math.floor(rng() * spots.length), 1)[0];
const kind = pick(rng, ['sedan', 'sedan', 'sport', 'truck']);
const mesh = makeCarMesh(pick(rng, CAR_COLORS), kind);
mesh.position.set(s.x, 0, s.z);
mesh.rotation.y = s.heading;
scene.add(mesh);
cars.push({ mesh, x: s.x, z: s.z, heading: s.heading, kind, hp: 100, parked: true, speed: 0 });
}
return cars;
}
