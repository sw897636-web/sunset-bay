// Sunset Bay police: pursuit cars that chase the player, ram, and flash lights.
import * as THREE from 'three';
import { clamp, angleLerp, angleDiff, resolveCircleBox, dist2 } from './util.js';
import { makePoliceCarMesh } from './cars.js';

export class PoliceCar {
constructor(scene, x, z) {
this.mesh = makePoliceCarMesh();
this.mesh.position.set(x, 0, z);
this.heading = 0;
this.speed = 0;
this.reverseTimer = 0;
this.stuckTimer = 0;
this.flash = Math.random() * 2;
scene.add(this.mesh);
}
update(dt, target, colliders, onRam) {
const dx = target.x - this.mesh.position.x;
const dz = target.z - this.mesh.position.z;
const dist = Math.sqrt(dx * dx + dz * dz);
const desired = Math.atan2(dx, dz);
if (this.reverseTimer > 0) {
this.reverseTimer -= dt;
this.speed = Math.max(this.speed - 20 * dt, -9);
this.heading += 0.8 * dt;
} else {
const steer = clamp(angleDiff(this.heading, desired), -1, 1);
this.heading = angleLerp(this.heading, this.heading + steer, clamp(2.4 * dt, 0, 1));
const want = dist > 60 ? 36 : dist > 18 ? 32 : 26;
this.speed += clamp(want - this.speed, -30 * dt, 16 * dt);
}
const fx = Math.sin(this.heading);
const fz = Math.cos(this.heading);
this.mesh.position.x += fx * this.speed * dt;
this.mesh.position.z += fz * this.speed * dt;
this.mesh.rotation.y = this.heading;
const before = { x: this.mesh.position.x, z: this.mesh.position.z };
let hit = false;
for (const b of colliders) {
if (resolveCircleBox(this.mesh.position, 2.2, b)) hit = true;
}
if (hit) {
this.speed *= 0.55;
this.stuckTimer += dt;
if (this.stuckTimer > 0.9) {
this.stuckTimer = 0;
this.reverseTimer = 0.8;
this.heading += 1.1;
}
} else {
this.stuckTimer = 0;
}
this.mesh.position.x = clamp(this.mesh.position.x, -590, 590);
this.mesh.position.z = clamp(this.mesh.position.z, -590, 590);
this.flash += dt * 6;
const on = Math.sin(this.flash) > 0;
const red = this.mesh.userData.lightRed;
const blue = this.mesh.userData.lightBlue;
if (red && blue) {
red.material.emissiveIntensity = on ? 1.6 : 0.15;
blue.material.emissiveIntensity = on ? 0.15 : 1.6;
}
const wheels = this.mesh.userData.wheels;
if (wheels) for (const w of wheels) w.rotation.x += (this.speed * dt) / 0.38;
if (dist < 4.6 && this.speed > 6 && onRam) onRam(dist);
return dist;
}
remove(scene) {
scene.remove(this.mesh);
}
}

export function wantedStars(heat) {
if (heat < 20) return 0;
if (heat < 40) return 1;
if (heat < 60) return 2;
if (heat < 80) return 3;
if (heat < 95) return 4;
return 5;
}

export function policeCountFor(stars) {
if (stars <= 0) return 0;
if (stars === 1) return 1;
if (stars === 2) return 2;
if (stars === 3) return 2;
if (stars === 4) return 3;
return 4;
}
