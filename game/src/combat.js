// Sunset Bay: combat — hitscan shooting with tracers and muzzle flash,
// car damage, smoke, and explosions.

import * as THREE from 'three';
import { CONFIG } from './config.js';

export class CombatSystem {
constructor(scene) {
this.scene = scene;
this.raycaster = new THREE.Raycaster();
this.effects = [];
this.tracerMat = new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 });
this.flashLight = new THREE.PointLight(0xffc860, 0, 14);
this.scene.add(this.flashLight);
this.explosions = [];
}
shoot(origin, direction, shootables, onHitPed, onHitCar) {
this.raycaster.set(origin, direction);
this.raycaster.far = CONFIG.shotRange;
const hits = this.raycaster.intersectObjects(shootables, true);
let end = origin.clone().add(direction.clone().multiplyScalar(CONFIG.shotRange));
let hitSomething = null;
if (hits.length > 0) {
const hit = hits[0];
end = hit.point.clone();
hitSomething = hit;
}
const geo = new THREE.BufferGeometry().setFromPoints([origin.clone(), end]);
const tracer = new THREE.Line(geo, this.tracerMat.clone());
this.scene.add(tracer);
this.effects.push({ mesh: tracer, life: 0.09, max: 0.09, kind: 'tracer' });
this.flashLight.position.copy(origin);
this.flashLight.intensity = 60;
this.flashTimer = 0.05;
if (!hitSomething) return null;
let obj = hitSomething.object;
while (obj && !obj.userData.shootable) obj = obj.parent;
if (!obj) return { point: end, kind: 'world' };
if (obj.userData.shootable === 'ped') {
if (onHitPed) onHitPed(obj.userData.ref, end);
return { point: end, kind: 'ped' };
}
if (obj.userData.shootable === 'car') {
if (onHitCar) onHitCar(obj.userData.ref, end);
return { point: end, kind: 'car' };
}
return { point: end, kind: 'world' };
}
explode(position, onDone) {
const geo = new THREE.SphereGeometry(1, 16, 12);
const mat = new THREE.MeshBasicMaterial({ color: 0xff7722, transparent: true, opacity: 0.95 });
const ball = new THREE.Mesh(geo, mat);
ball.position.copy(position);
ball.position.y = 1.2;
this.scene.add(ball);
const light = new THREE.PointLight(0xff8830, 120, 40);
light.position.copy(position);
light.position.y = 2;
this.scene.add(light);
this.explosions.push({ mesh: ball, light, life: 0.7, max: 0.7, onDone });
}
spawnSmoke(position) {
const geo = new THREE.SphereGeometry(0.9, 8, 6);
const mat = new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.55 });
const puff = new THREE.Mesh(geo, mat);
puff.position.copy(position);
puff.position.y = 1.6;
this.scene.add(puff);
this.effects.push({ mesh: puff, life: 1.4, max: 1.4, kind: 'smoke' });
}
update(dt) {
if (this.flashTimer !== undefined && this.flashTimer > 0) {
this.flashTimer -= dt;
if (this.flashTimer <= 0) this.flashLight.intensity = 0;
}
for (let i = this.effects.length - 1; i >= 0; i--) {
const e = this.effects[i];
e.life -= dt;
if (e.life <= 0) {
this.scene.remove(e.mesh);
if (e.mesh.geometry) e.mesh.geometry.dispose();
this.effects.splice(i, 1);
continue;
}
if (e.kind === 'tracer') {
e.mesh.material.opacity = 0.9 * (e.life / e.max);
} else if (e.kind === 'smoke') {
e.mesh.position.y += dt * 1.5;
const s = 1 + (1 - e.life / e.max) * 2;
e.mesh.scale.setScalar(s);
e.mesh.material.opacity = 0.55 * (e.life / e.max);
}
}
for (let i = this.explosions.length - 1; i >= 0; i--) {
const ex = this.explosions[i];
ex.life -= dt;
const t = 1 - ex.life / ex.max;
ex.mesh.scale.setScalar(1 + t * 9);
ex.mesh.material.opacity = 0.95 * (1 - t);
ex.light.intensity = 120 * (1 - t);
if (ex.life <= 0) {
this.scene.remove(ex.mesh);
this.scene.remove(ex.light);
this.explosions.splice(i, 1);
if (ex.onDone) ex.onDone();
}
}
}
}
