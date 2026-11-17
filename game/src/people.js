// Sunset Bay pedestrians: low-poly walkers on the sidewalks, with flee and fall.
import * as THREE from 'three';
import { mulberry32, pick, range, clamp, angleLerp } from './util.js';
import { WORLD } from './city.js';

const SHIRTS = [0xd84a4a, 0x4a7ad8, 0x4ad87a, 0xd8c84a, 0xffffff, 0x8a4ad8, 0xd87a4a, 0x3a3a3a];
const PANTS = [0x2e3a4a, 0x4a3a2e, 0x3a3a3a, 0x5a6a7a];
const SKINS = [0xe8b88a, 0xc98a5a, 0x8a5a3a, 0xf0c8a0];

export function makePersonMesh(rng) {
const g = new THREE.Group();
const shirt = new THREE.MeshLambertMaterial({ color: pick(rng, SHIRTS) });
const pants = new THREE.MeshLambertMaterial({ color: pick(rng, PANTS) });
const skin = new THREE.MeshLambertMaterial({ color: pick(rng, SKINS) });
const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.55, 0.2), pants);
legL.position.set(-0.13, 0.28, 0);
const legR = legL.clone();
legR.position.x = 0.13;
const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.62, 0.3), shirt);
torso.position.y = 0.86;
const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.14), shirt);
armL.position.set(-0.36, 0.86, 0);
const armR = armL.clone();
armR.position.x = 0.36;
const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skin);
head.position.y = 1.36;
const hair = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: pick(rng, [0x1a1a1a, 0x4a2e1a, 0x8a6a2e, 0x777777]) }));
hair.position.y = 1.4;
g.add(legL, legR, torso, armL, armR, head, hair);
g.userData.parts = { legL, legR, armL, armR, torso, head };
return g;
}

export class Pedestrian {
constructor(scene, rng) {
this.mesh = makePersonMesh(rng);
this.axis = rng() < 0.5 ? 'x' : 'z';
this.dir = rng() < 0.5 ? 1 : -1;
this.road = pick(rng, WORLD.roads);
this.side = rng() < 0.5 ? -12 : 12;
this.coord = range(rng, -560, 560);
this.speed = range(rng, 1.2, 2.2);
this.walkPhase = rng() * 6;
this.state = 'walk';
this.fleeX = 0;
this.fleeZ = 0;
this.deadTimer = 0;
scene.add(this.mesh);
this.syncMesh();
}
syncMesh() {
if (this.axis === 'x') {
this.mesh.position.set(this.coord, 0, this.road + this.side);
this.mesh.rotation.y = this.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
} else {
this.mesh.position.set(this.road + this.side, 0, this.coord);
this.mesh.rotation.y = this.dir > 0 ? 0 : Math.PI;
}
}
update(dt, rng, threat) {
if (this.state === 'dead') {
this.deadTimer += dt;
if (this.deadTimer > 12) this.mesh.visible = false;
return;
}
if (threat) {
const dx = this.mesh.position.x - threat.x;
const dz = this.mesh.position.z - threat.z;
const d = Math.sqrt(dx * dx + dz * dz);
if (d < 16) {
this.state = 'flee';
this.fleeX = dx / (d || 1);
this.fleeZ = dz / (d || 1);
}
}
if (this.state === 'flee') {
this.mesh.position.x += this.fleeX * 7 * dt;
this.mesh.position.z += this.fleeZ * 7 * dt;
this.mesh.rotation.y = Math.atan2(this.fleeX, this.fleeZ);
this.walkPhase += dt * 11;
if (Math.abs(this.mesh.position.x) > 580 || Math.abs(this.mesh.position.z) > 580) this.state = 'walk';
} else {
this.coord += this.dir * this.speed * dt;
if (this.coord > 580) { this.coord = 580; this.dir = -1; }
if (this.coord < -580) { this.coord = -580; this.dir = 1; }
if (Math.abs(this.coord % 120) < 1.5 && rng() < 0.01) {
const oldCoord = this.coord;
this.axis = this.axis === 'x' ? 'z' : 'x';
this.road = Math.round(oldCoord / 120) * 120;
this.coord = this.axis === 'x' ? this.mesh.position.x : this.mesh.position.z;
this.dir = rng() < 0.5 ? 1 : -1;
}
this.walkPhase += dt * this.speed * 4;
this.syncMesh();
}
const s = Math.sin(this.walkPhase) * (this.state === 'flee' ? 0.6 : 0.35);
const p = this.mesh.userData.parts;
p.legL.rotation.x = s;
p.legR.rotation.x = -s;
p.armL.rotation.x = -s * 0.7;
p.armR.rotation.x = s * 0.7;
}
die() {
if (this.state === 'dead') return;
this.state = 'dead';
this.deadTimer = 0;
this.mesh.rotation.x = -Math.PI / 2;
this.mesh.position.y = 0.25;
}
}

export function spawnPedestrians(scene, rng, count) {
const peds = [];
for (let i = 0; i < count; i++) peds.push(new Pedestrian(scene, rng));
return peds;
}
