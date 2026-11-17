// Sunset Bay: the story — five missions for Mara Voss, with markers,
// timers, rewards, and the crew's dialogue.

import * as THREE from 'three';
import { MISSIONS, STORY } from './config.js';
import { distance2D } from './random.js';

export function makeMarkerMesh() {
const group = new THREE.Group();
const beamGeo = new THREE.CylinderGeometry(1.6, 1.6, 40, 12, 1, true);
const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
const beam = new THREE.Mesh(beamGeo, beamMat);
beam.position.y = 20;
group.add(beam);
const gemGeo = new THREE.OctahedronGeometry(1.1);
const gemMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
const gem = new THREE.Mesh(gemGeo, gemMat);
gem.position.y = 6;
group.add(gem);
const ringGeo = new THREE.RingGeometry(2.2, 3.0, 24);
const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
const ring = new THREE.Mesh(ringGeo, ringMat);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.15;
group.add(ring);
group.userData.gem = gem;
group.userData.ring = ring;
group.userData.beam = beam;
return group;
}

export class MissionSystem {
constructor(scene) {
this.scene = scene;
this.index = 0;
this.completed = [];
this.state = 'idle';
this.step = 0;
this.timer = 0;
this.collectTimer = 0;
this.marker = makeMarkerMesh();
this.marker.visible = false;
scene.add(this.marker);
this.targetCar = null;
this.currentTarget = null;
this.message = '';
this.messageTimer = 0;
}
get mission() {
return MISSIONS[this.index] || null;
}
get done() {
return this.index >= MISSIONS.length;
}
start(index) {
this.index = index;
this.step = 0;
this.timer = 0;
this.collectTimer = 0;
const m = this.mission;
if (!m) {
this.state = 'done';
this.marker.visible = false;
return;
}
this.state = 'active';
if (m.kind === 'survive') this.timer = m.timeLimit;
if (m.kind === 'drops') this.timer = m.timeLimit;
this.placeMarker();
this.say(m.name + ' — ' + m.brief, 6);
}
placeMarker() {
const m = this.mission;
if (!m) { this.marker.visible = false; return; }
let target = null;
if (m.kind === 'steal-deliver' && this.step === 0) target = m.target;
else if (m.kind === 'steal-deliver' && this.step === 1) target = m.deliver;
else if (m.kind === 'drops') target = m.drops[Math.min(this.step, m.drops.length - 1)];
else if (m.kind === 'rob-escape' && this.step === 0) target = m.target;
else if (m.kind === 'rob-escape' && this.step === 2) target = m.deliver;
else if (m.target) target = m.target;
if (!target) { this.marker.visible = false; this.currentTarget = null; return; }
this.currentTarget = target;
this.marker.position.set(target.x, 0, target.z);
this.marker.visible = true;
}
say(text, seconds) {
this.message = text;
this.messageTimer = seconds || 4;
}
completeStep(game) {
const m = this.mission;
if (!m) return;
if (m.kind === 'goto') {
this.finish(game, m);
return;
}
if (m.kind === 'steal-deliver') {
if (this.step === 0) {
this.step = 1;
this.placeMarker();
this.say('Got it. Now deliver the coupe to the garage in Old Town.', 5);
} else {
this.finish(game, m);
}
return;
}
if (m.kind === 'drops') {
this.step++;
if (this.step >= m.drops.length) {
this.finish(game, m);
} else {
this.placeMarker();
this.say('Drop ' + (this.step + 1) + ' of ' + m.drops.length + ' — keep moving.', 4);
}
return;
}
if (m.kind === 'rob-escape') {
if (this.step === 0) {
this.step = 1;
this.collectTimer = m.collectSeconds;
this.say('Grab the cash — stay in the bank until the bag is full.', 4);
} else if (this.step === 2) {
this.finish(game, m);
}
return;
}
}
finish(game, m) {
game.cash += m.reward;
this.completed.push(m.id);
this.index++;
this.state = 'idle';
this.marker.visible = false;
this.say('Mission complete: ' + m.name + ' — $' + m.reward + ' earned.', 6);
if (game.audio) game.audio.jingle();
if (this.done) {
game.storyComplete = true;
this.say(STORY.outro, 10);
} else {
const next = this.mission;
if (next) this.say('Next job: ' + next.name + '. Head for the marker.', 6);
}
}
fail(game, reason) {
const m = this.mission;
if (!m) return;
this.state = 'idle';
this.marker.visible = false;
this.say('Job failed: ' + reason + '. Talk to Rico to try again.', 6);
}
update(dt, game) {
if (this.messageTimer > 0) this.messageTimer -= dt;
if (this.state !== 'active' || !this.mission) return;
const m = this.mission;
const px = game.player.x;
const pz = game.player.z;
this.marker.userData.gem.rotation.y += dt * 2;
this.marker.userData.gem.position.y = 6 + Math.sin(performance.now() * 0.003) * 0.6;
this.marker.userData.ring.rotation.z += dt;
if (m.kind === 'survive') {
this.timer -= dt;
if (this.timer <= 0) {
this.finish(game, m);
}
return;
}
if (m.kind === 'drops' || m.kind === 'goto' || m.kind === 'steal-deliver' || m.kind === 'rob-escape') {
if (m.timeLimit && (m.kind === 'drops')) {
this.timer -= dt;
if (this.timer <= 0) {
this.fail(game, 'Out of time.');
return;
}
}
if (m.kind === 'rob-escape' && this.step === 1) {
if (this.currentTarget && distance2D(px, pz, this.currentTarget.x, this.currentTarget.z) < 6) {
this.collectTimer -= dt;
if (this.collectTimer <= 0) {
this.step = 2;
this.placeMarker();
if (game.police) game.police.setWanted(m.wanted);
this.say('Cash secured. Lose the cops and reach the safehouse.', 6);
}
} else {
this.collectTimer = m.collectSeconds;
}
return;
}
if (this.currentTarget && distance2D(px, pz, this.currentTarget.x, this.currentTarget.z) < 6) {
if (m.kind === 'steal-deliver' && this.step === 0) {
if (!game.player.inCar || game.player.car !== this.targetCar) {
return;
}
}
this.completeStep(game);
}
}
}
objectiveText() {
const m = this.mission;
if (this.done) return 'Free roam — Sunset Bay is yours.';
if (this.state !== 'active' || !m) return 'No active job — drive to the yellow marker to start: ' + (MISSIONS[this.index] ? MISSIONS[this.index].name : '');
let text = m.name + ': ' + m.targetLabel;
if (m.kind === 'drops') text += ' (' + (this.step + 1) + '/' + m.drops.length + ')';
if (m.kind === 'survive') text += ' — ' + Math.ceil(this.timer) + 's left';
if (m.kind === 'drops' && m.timeLimit) text += ' — ' + Math.ceil(this.timer) + 's left';
if (m.kind === 'rob-escape' && this.step === 1) text += ' — collecting ' + Math.ceil(this.collectTimer) + 's';
return text;
}
targetDistance(game) {
if (!this.currentTarget) return null;
return Math.round(distance2D(game.player.x, game.player.z, this.currentTarget.x, this.currentTarget.z));
}
}
