// Sunset Bay story: four chained jobs from fixer Mama Lou, with markers,
// timers, rewards and fail states. Steps are checked against the live game.
import * as THREE from 'three';
import { dist2 } from './util.js';

export const MISSIONS = [
{
name: 'First Wheels',
intro: 'Mama Lou needs wheels. Steal a parked car and bring it to her garage.',
reward: 400,
steps: [
{ type: 'enterCar', text: 'Steal a parked car (walk up and press E)' },
{ type: 'drive', x: -120, z: -120, r: 12, text: 'Drive to Mama Lou\u2019s garage' },
],
},
{
name: 'Dockside Pickup',
intro: 'A package is waiting at the docks. Grab it on foot, then drop it at the Boardwalk.',
reward: 700,
steps: [
{ type: 'drive', x: 480, z: -360, r: 14, text: 'Drive to the docks' },
{ type: 'pickup', x: 480, z: -360, r: 6, text: 'Get out and grab the package' },
{ type: 'drive', x: -420, z: 360, r: 14, text: 'Deliver to the Boardwalk', time: 150 },
],
},
{
name: 'Heat Wave',
intro: 'The Bay PD is all over you. Lose the heat, then reach the safehouse.',
reward: 900,
steps: [
{ type: 'evade', x: 300, z: 420, r: 16, text: 'Shake the cops, then reach the safehouse', time: 90, setWanted: 3 },
],
},
{
name: 'The Big Score',
intro: 'One last job: hit the Meridian Bank, grab the cash, and vanish at the marina.',
reward: 1500,
steps: [
{ type: 'drive', x: 120, z: 120, r: 14, text: 'Drive to Meridian Bank' },
{ type: 'wait', x: 120, z: 120, r: 8, text: 'Crack the vault (stay in the zone)', time: 6 },
{ type: 'evade', x: -520, z: 300, r: 18, text: 'Escape to the marina', time: 120, setWanted: 2 },
],
},
];

export const GARAGE = { x: -120, z: -120 };

function makeBeacon() {
const group = new THREE.Group();
const beam = new THREE.Mesh(
new THREE.CylinderGeometry(1.4, 1.4, 46, 12, 1, true),
new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false })
);
beam.position.y = 23;
group.add(beam);
const ring = new THREE.Mesh(
new THREE.RingGeometry(2.2, 3.2, 24),
new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })
);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.15;
group.add(ring);
const diamond = new THREE.Mesh(
new THREE.OctahedronGeometry(0.9),
new THREE.MeshBasicMaterial({ color: 0xffd24a })
);
diamond.position.y = 6;
group.add(diamond);
group.userData.diamond = diamond;
group.userData.ring = ring;
return group;
}

export class MissionManager {
constructor(scene) {
this.scene = scene;
this.index = 0;
this.step = 0;
this.active = false;
this.stepTimer = 0;
this.waitTimer = 0;
this.beacon = makeBeacon();
this.beacon.visible = false;
scene.add(this.beacon);
this.onBanner = null;
this.onObjective = null;
this.onReward = null;
this.onFail = null;
}
current() { return MISSIONS[this.index] || null; }
currentStep() {
const m = this.current();
return m ? m.steps[this.step] : null;
}
marker() {
const s = this.currentStep();
if (s && s.x !== undefined) return { x: s.x, z: s.z };
return GARAGE;
}
start(index) {
this.index = index;
this.step = 0;
this.active = true;
const m = this.current();
if (!m) return;
this.stepTimer = 0;
this.waitTimer = 0;
this.updateBeacon();
if (this.onBanner) this.onBanner('JOB: ' + m.name, m.intro);
}
startNext() {
if (this.index >= MISSIONS.length) {
this.active = false;
this.beacon.visible = false;
if (this.onBanner) this.onBanner('SUNSET BAY LEGEND', 'Every job done. The city is yours, Jax.');
return;
}
this.start(this.index);
}
updateBeacon() {
const s = this.currentStep();
if (s && s.x !== undefined) {
this.beacon.visible = true;
this.beacon.position.set(s.x, 0, s.z);
} else {
this.beacon.visible = this.active;
this.beacon.position.set(GARAGE.x, 0, GARAGE.z);
}
}
advance() {
this.step++;
this.stepTimer = 0;
this.waitTimer = 0;
const m = this.current();
if (this.step >= m.steps.length) {
const reward = m.reward;
this.active = false;
this.beacon.visible = false;
if (this.onBanner) this.onBanner('JOB DONE: ' + m.name, 'Mama Lou paid you $' + reward + '.');
if (this.onReward) this.onReward(reward);
this.index++;
return 'done';
}
this.updateBeacon();
return 'step';
}
fail(reason) {
this.active = false;
this.beacon.visible = false;
if (this.onFail) this.onFail(reason);
}
update(dt, ctx) {
this.beacon.userData.diamond.rotation.y += dt * 2;
this.beacon.userData.diamond.position.y = 6 + Math.sin(ctx.time * 2.4) * 0.7;
const pulse = 0.65 + Math.sin(ctx.time * 3) * 0.2;
this.beacon.userData.ring.material.opacity = pulse;
if (!this.active) {
if (this.onObjective) this.onObjective('Free roam \u2014 drive to the yellow marker for the next job', Math.round(dist2(ctx.px, ctx.pz, GARAGE.x, GARAGE.z)));
return;
}
const m = this.current();
const s = this.currentStep();
if (!s) return;
if (s.setWanted !== undefined && this.stepTimer === 0 && ctx.setWanted) ctx.setWanted(s.setWanted);
this.stepTimer += dt;
if (s.time && this.stepTimer > s.time) {
this.fail('Out of time on "' + m.name + '". Mama Lou is not happy.');
return;
}
if (this.onObjective) {
const d = s.x !== undefined ? Math.round(dist2(ctx.px, ctx.pz, s.x, s.z)) : 0;
const left = s.time ? ' \u2014 ' + Math.max(0, Math.ceil(s.time - this.stepTimer)) + 's' : '';
this.onObjective(s.text + left, d);
}
if (s.type === 'enterCar') {
if (ctx.inCar) this.advance();
} else if (s.type === 'drive' || s.type === 'pickup') {
if (dist2(ctx.px, ctx.pz, s.x, s.z) < s.r) {
if (s.type === 'pickup' && ctx.inCar) {
if (this.onObjective) this.onObjective('Get out of the car to grab the package', 0);
return;
}
this.advance();
}
} else if (s.type === 'wait') {
if (dist2(ctx.px, ctx.pz, s.x, s.z) < s.r) {
this.waitTimer += dt;
if (this.waitTimer >= s.time) this.advance();
} else {
this.waitTimer = 0;
}
} else if (s.type === 'evade') {
if (ctx.wanted >= 2 && dist2(ctx.px, ctx.pz, s.x, s.z) < s.r) this.advance();
else if (ctx.wanted < 2 && this.stepTimer > 8 && dist2(ctx.px, ctx.pz, s.x, s.z) < s.r) this.advance();
}
}
}
