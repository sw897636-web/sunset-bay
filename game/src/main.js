// Sunset Bay: the game itself — bootstrap, the loop, the player on foot
// and behind the wheel, the camera, crime and consequence, and saving.

import * as THREE from 'three';
import { CONFIG, PALETTE, STORY, MISSIONS, CONTROLS } from './config.js';
import { makeRng, range, clamp, angleLerp, distance2D } from './random.js';
import { buildWorld, resolveCircleCollision, nearestRoadPoint } from './world.js';
import { makeCarMesh, makeCarRecord, TrafficSystem, drivePlayerCar } from './vehicles.js';
import { PedestrianSystem } from './pedestrians.js';
import { PoliceSystem } from './police.js';
import { CombatSystem } from './combat.js';
import { MissionSystem } from './missions.js';
import { Hud } from './hud.js';
import { AudioSys } from './audio.js';
import { Input } from './input.js';
import { stageShot } from './shots.js';

function makePlayerMesh() {
const group = new THREE.Group();
const skin = new THREE.MeshLambertMaterial({ color: 0xc68642 });
const jacket = new THREE.MeshLambertMaterial({ color: 0x9b2c2c });
const jeans = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
const legs = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.82, 0.28), jeans);
legs.position.y = 0.41;
group.add(legs);
const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.64, 0.32), jacket);
torso.position.y = 1.14;
group.add(torso);
const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), skin);
head.position.y = 1.66;
group.add(head);
const hair = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
hair.position.y = 1.7;
group.add(hair);
const armGeo = new THREE.BoxGeometry(0.14, 0.6, 0.14);
const armL = new THREE.Mesh(armGeo, jacket);
armL.position.set(-0.34, 1.12, 0);
group.add(armL);
const armR = new THREE.Mesh(armGeo, jacket);
armR.position.set(0.34, 1.12, 0);
group.add(armR);
group.userData.armL = armL;
group.userData.armR = armR;
group.userData.legs = legs;
return group;
}

function makeRicoMesh() {
const group = new THREE.Group();
const skin = new THREE.MeshLambertMaterial({ color: 0xe0ac69 });
const suit = new THREE.MeshLambertMaterial({ color: 0xf1c40f });
const pants = new THREE.MeshLambertMaterial({ color: 0x222222 });
const legs = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.82, 0.28), pants);
legs.position.y = 0.41;
group.add(legs);
const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.64, 0.32), suit);
torso.position.y = 1.14;
group.add(torso);
const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), skin);
head.position.y = 1.66;
group.add(head);
const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.12, 12), new THREE.MeshLambertMaterial({ color: 0x111111 }));
hat.position.y = 1.86;
group.add(hat);
return group;
}

export class Game {
constructor() {
const params = new URLSearchParams(window.location.search);
this.seed = Number(params.get('seed') || 7);
this.shotNum = Number(params.get('shot') || 0);
this.rng = makeRng(this.seed);
this.state = 'menu';
this.cash = CONFIG.startCash;
this.storyComplete = false;
this.frameCount = 0;
this.shotMode = this.shotNum > 0;
this.cameraMode = 'foot';
this.cameraYaw = Math.PI;
this.cameraPitch = 0.18;
this.cameraDist = 7;
this.shotCooldown = 0;
this.lastDamageAt = 0;
this.lastMissionMessage = '';
this.saveTimer = 0;
this.nextMissionTimer = 0;
this.time = 0;
window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));
this.renderer = new THREE.WebGLRenderer({ antialias: true });
this.renderer.setSize(window.innerWidth, window.innerHeight);
this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
document.getElementById('app').appendChild(this.renderer.domElement);
this.scene = new THREE.Scene();
this.scene.background = new THREE.Color(PALETTE.skyBottom);
this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1500);
this.world = buildWorld(this.scene, this.seed);
this.traffic = new TrafficSystem(this.scene, this.world, this.seed);
this.pedestrians = new PedestrianSystem(this.scene, this.world, this.seed);
this.police = new PoliceSystem(this.scene, this.world, this.seed);
this.combat = new CombatSystem(this.scene);
this.missions = new MissionSystem(this.scene);
this.hud = new Hud();
this.audio = new AudioSys();
this.input = new Input(this.renderer.domElement);
this.playerMesh = makePlayerMesh();
this.scene.add(this.playerMesh);
this.ricoMesh = makeRicoMesh();
this.ricoMesh.position.set(-272, 0, 232);
this.scene.add(this.ricoMesh);
this.targetBeacon = new THREE.Mesh(
new THREE.ConeGeometry(0.9, 2.2, 8),
new THREE.MeshBasicMaterial({ color: 0xffd23e }),
);
this.targetBeacon.visible = false;
this.scene.add(this.targetBeacon);
this.playerCar = this.spawnPlayerCar();
this.player = {
x: 0, z: 240, y: 0, vy: 0, heading: Math.PI,
onFoot: true, inCar: false, car: null, health: CONFIG.maxHealth,
};
this.playerMesh.position.set(this.player.x, 0, this.player.z);
this.loadSave();
this.wireMenu();
window.addEventListener('resize', () => this.onResize());
if (this.shotMode) {
document.getElementById('menu').style.display = 'none';
document.getElementById('overlay').style.display = 'none';
stageShot(this, this.shotNum);
this.afterShotStage();
} else {
this.showMenu();
}
this.clock = new THREE.Clock();
this.loop();
}
spawnPlayerCar() {
const mesh = makeCarMesh(0xc0392b, 'sport');
const car = makeCarRecord(mesh, 'sport', 0xc0392b);
car.x = 6;
car.z = 240;
car.heading = Math.PI;
car.mesh.position.set(car.x, 0, car.z);
car.mesh.rotation.y = car.heading;
this.scene.add(mesh);
return car;
}
afterShotStage() {
if (this.missions.mission && this.missions.mission.kind === 'steal-deliver') {
this.pickTargetCar();
}
}
startMission(index) {
this.missions.start(index);
const m = this.missions.mission;
if (!m) return;
if (m.kind === 'steal-deliver') this.pickTargetCar();
if (m.kind === 'heat') this.police.setWanted(3);
if (m.kind === 'rob-escape') this.police.setWanted(0);
}
pickTargetCar() {
const m = this.missions.mission;
if (!m) return;
let best = null;
let bestD = Infinity;
for (const car of this.traffic.cars) {
if (car.dead) continue;
const d = distance2D(car.x, car.z, m.target.x, m.target.z);
if (d < bestD) { bestD = d; best = car; }
}
if (!best) return;
best.x = m.target.x;
best.z = m.target.z;
best.heading = 0;
best.speed = 0;
best.mesh.position.set(best.x, 0, best.z);
best.mesh.rotation.y = 0;
this.missions.targetCar = best;
}
wireMenu() {
const menu = document.getElementById('menu');
const startBtn = document.getElementById('btn-start');
const continueBtn = document.getElementById('btn-continue');
const controlsEl = document.getElementById('controls-list');
controlsEl.innerHTML = CONTROLS.map((c) => '<div><b>' + c[0] + '</b> — ' + c[1] + '</div>').join('');
const hasSave = !!localStorage.getItem(CONFIG.saveKey);
continueBtn.style.display = hasSave ? 'inline-block' : 'none';
startBtn.textContent = hasSave ? 'New Game' : 'Start Game';
startBtn.onclick = () => {
this.audio.ensure();
this.newGame();
menu.style.display = 'none';
};
continueBtn.onclick = () => {
this.audio.ensure();
this.loadSave();
this.state = 'playing';
menu.style.display = 'none';
this.startMission(this.missions.index);
this.hud.showMessage('Welcome back to Sunset Bay, Mara.', 5);
};
document.getElementById('btn-resume').onclick = () => {
document.getElementById('overlay').style.display = 'none';
if (this.state === 'busted' || this.state === 'wasted') this.respawn();
else this.state = 'playing';
};
document.getElementById('btn-restart').onclick = () => {
document.getElementById('overlay').style.display = 'none';
this.newGame();
};
}
showMenu() {
this.state = 'menu';
document.getElementById('menu').style.display = 'flex';
document.getElementById('menu-story').textContent = STORY.intro;
const progress = this.missions.completed.length;
document.getElementById('menu-progress').textContent = progress > 0 ? 'Jobs done: ' + progress + ' / ' + MISSIONS.length : 'No jobs done yet — five jobs stand between you and freedom.';
}
newGame() {
localStorage.removeItem(CONFIG.saveKey);
this.cash = CONFIG.startCash;
this.player.health = CONFIG.maxHealth;
this.player.x = 0;
this.player.z = 240;
this.player.y = 0;
this.player.vy = 0;
this.player.heading = Math.PI;
this.player.onFoot = true;
this.player.inCar = false;
this.player.car = null;
this.playerMesh.visible = true;
this.playerMesh.position.set(this.player.x, 0, this.player.z);
this.police.clearAll();
this.missions.index = 0;
this.missions.completed = [];
this.missions.state = 'idle';
this.storyComplete = false;
this.state = 'playing';
this.startMission(0);
}
loadSave() {
try {
const raw = localStorage.getItem(CONFIG.saveKey);
if (!raw) return;
const save = JSON.parse(raw);
if (typeof save.cash === 'number') this.cash = save.cash;
if (typeof save.missionIndex === 'number') this.missions.index = Math.min(save.missionIndex, MISSIONS.length);
if (Array.isArray(save.completed)) this.missions.completed = save.completed;
if (save.storyComplete) this.storyComplete = true;
} catch (e) {
window.__errors.push('save load failed: ' + String(e));
}
}
saveGame() {
try {
localStorage.setItem(CONFIG.saveKey, JSON.stringify({
cash: this.cash,
missionIndex: this.missions.index,
completed: this.missions.completed,
storyComplete: this.storyComplete,
}));
} catch (e) {
window.__errors.push('save failed: ' + String(e));
}
}
onResize() {
this.camera.aspect = window.innerWidth / window.innerHeight;
this.camera.updateProjectionMatrix();
this.renderer.setSize(window.innerWidth, window.innerHeight);
}
enterCar(car) {
this.player.inCar = true;
this.player.onFoot = false;
this.player.car = car;
this.playerMesh.visible = false;
this.cameraMode = 'drive';
if (car !== this.playerCar && this.traffic.cars.includes(car)) {
const idx = this.traffic.cars.indexOf(car);
this.traffic.cars.splice(idx, 1);
this.police.addWanted(1);
this.hud.showMessage('You stole a car — the cops noticed.', 4);
this.audio.crash();
}
}
exitCar() {
const car = this.player.car;
if (!car) return;
const side = 2.6;
const px = car.x + Math.cos(car.heading) * side;
const pz = car.z - Math.sin(car.heading) * side;
this.player.x = px;
this.player.z = pz;
this.player.y = 0;
this.player.heading = car.heading;
this.player.inCar = false;
this.player.onFoot = true;
this.player.car = null;
this.playerMesh.visible = true;
this.playerMesh.position.set(px, 0, pz);
this.cameraMode = 'foot';
if (car !== this.playerCar && !this.parkedCars) this.parkedCars = [];
if (car !== this.playerCar) {
this.parkedCars = this.parkedCars || [];
if (!this.parkedCars.includes(car)) this.parkedCars.push(car);
}
}
nearestEnterableCar() {
const px = this.player.x;
const pz = this.player.z;
let best = null;
let bestD = 4.5;
const check = (car) => {
const d = distance2D(px, pz, car.x, car.z);
if (d < bestD) { bestD = d; best = car; }
};
if (!this.playerCar.dead) check(this.playerCar);
for (const car of this.traffic.cars) check(car);
for (const car of (this.parkedCars || [])) check(car);
return best;
}
shoot() {
if (this.shotCooldown > 0 || !this.player.onFoot) return;
this.shotCooldown = CONFIG.shotCooldown;
const origin = this.camera.position.clone();
const dir = new THREE.Vector3();
this.camera.getWorldDirection(dir);
const shootables = [];
for (const ped of this.pedestrians.peds) {
if (ped.down) continue;
ped.mesh.userData.shootable = 'ped';
ped.mesh.userData.ref = ped;
shootables.push(ped.mesh);
}
const carList = [];
if (!this.playerCar.dead) carList.push(this.playerCar);
for (const car of this.traffic.cars) carList.push(car);
for (const car of this.police.cars) carList.push(car);
for (const car of (this.parkedCars || [])) carList.push(car);
for (const car of carList) {
car.mesh.userData.shootable = 'car';
car.mesh.userData.ref = car;
shootables.push(car.mesh);
}
const result = this.combat.shoot(origin, dir, shootables, (ped) => this.onPedShot(ped), (car) => this.onCarShot(car));
this.audio.shot();
this.pedestrians.scare(this.player.x, this.player.z, 30);
}
onPedShot(ped) {
ped.down = true;
ped.downTimer = 8;
ped.mesh.rotation.x = Math.PI / 2;
ped.mesh.position.y = 0.3;
this.police.addWanted(1);
this.hud.showMessage('You shot a pedestrian — wanted level up.', 4);
}
onCarShot(car) {
car.health -= CONFIG.shotDamage;
this.police.addWanted(1);
if (car.health <= 50 && !car.smoking) {
car.smoking = true;
}
if (car.health <= 0 && !car.dead) {
car.dead = true;
const pos = new THREE.Vector3(car.x, 0, car.z);
this.combat.explode(pos, () => {});
this.audio.crash();
if (car === this.player.car) {
this.exitCar();
this.player.health -= 25;
}
if (car.kind === 'police') {
this.police.cars = this.police.cars.filter((c) => c !== car);
}
this.scene.remove(car.mesh);
}
}
damagePlayer(amount) {
if (this.time - this.lastDamageAt < 0.5) return;
this.lastDamageAt = this.time;
this.player.health = Math.max(0, this.player.health - amount);
if (this.player.health <= 0) this.wasted();
}
wasted() {
this.state = 'wasted';
this.audio.crash();
this.showOverlay('WASTED', 'Mara is down. The bay keeps moving without her.');
this.cash = Math.max(0, this.cash - 200);
this.police.clearAll();
if (this.missions.state === 'active') this.missions.fail(this, 'You got wasted.');
this.saveGame();
}
busted() {
this.state = 'busted';
this.showOverlay('BUSTED', 'The Sunset Bay PD caught up with Mara.');
this.cash = Math.max(0, this.cash - 200);
this.police.clearAll();
if (this.missions.state === 'active') this.missions.fail(this, 'You got busted.');
this.saveGame();
}
respawn() {
this.player.health = CONFIG.maxHealth;
this.player.x = 0;
this.player.z = 240;
this.player.y = 0;
this.player.vy = 0;
this.player.heading = Math.PI;
this.player.car = null;
this.player.inCar = false;
this.player.onFoot = true;
this.playerMesh.visible = true;
this.playerMesh.position.set(this.player.x, 0, this.player.z);
this.cameraMode = 'foot';
this.cameraYaw = Math.PI;
this.state = 'playing';
this.hud.showMessage('Back on the streets of Sunset Bay.', 4);
}
showOverlay(title, sub) {
const overlay = document.getElementById('overlay');
document.getElementById('overlay-title').textContent = title;
document.getElementById('overlay-sub').textContent = sub;
overlay.style.display = 'flex';
}
updatePlayer(dt, input) {
const p = this.player;
if (p.inCar && p.car) {
const before = { x: p.car.x, z: p.car.z };
drivePlayerCar(p.car, input, dt, this.world.colliders, (impact) => {
this.damagePlayer(Math.min(20, impact * 0.4));
this.audio.crash();
});
for (const car of this.traffic.cars) {
const d = distance2D(p.car.x, p.car.z, car.x, car.z);
if (d < 3.4) {
const push = 3.4 - d;
const dx = (p.car.x - car.x) / (d || 1);
const dz = (p.car.z - car.z) / (d || 1);
car.x -= dx * push * 0.5;
car.z -= dz * push * 0.5;
p.car.speed *= 0.85;
if (Math.abs(p.car.speed) > 8) {
this.audio.crash();
this.damagePlayer(3);
}
}
}
for (const pc of this.police.cars) {
const d = distance2D(p.car.x, p.car.z, pc.x, pc.z);
if (d < 3.6) {
const dx = (p.car.x - pc.x) / (d || 1);
const dz = (p.car.z - pc.z) / (d || 1);
pc.x -= dx * 1.2;
pc.z -= dz * 1.2;
p.car.speed *= 0.9;
this.damagePlayer(4);
}
}
const hitPeds = this.pedestrians.knockDown(p.car.x, p.car.z, 2.2);
if (hitPeds > 0) {
this.police.addWanted(1);
this.hud.showMessage('You ran someone over — wanted level up.', 4);
}
p.x = p.car.x;
p.z = p.car.z;
p.heading = p.car.heading;
return;
}
const mouse = this.input.consumeMouse();
this.cameraYaw -= mouse.dx * 0.005;
this.cameraPitch = clamp(this.cameraPitch + mouse.dy * 0.003, -0.05, 0.65);
const speed = input.run ? CONFIG.playerRunSpeed : CONFIG.playerWalkSpeed;
const fx = Math.sin(this.cameraYaw);
const fz = Math.cos(this.cameraYaw);
const rx = Math.cos(this.cameraYaw);
const rz = -Math.sin(this.cameraYaw);
let mx = 0;
let mz = 0;
if (input.forward) { mx += fx; mz += fz; }
if (input.back) { mx -= fx; mz -= fz; }
if (input.left) { mx -= rx; mz -= rz; }
if (input.right) { mx += rx; mz += rz; }
const len = Math.sqrt(mx * mx + mz * mz);
if (len > 0) {
mx /= len;
mz /= len;
p.heading = Math.atan2(mx, mz);
}
const nx = p.x + mx * speed * dt;
const nz = p.z + mz * speed * dt;
const pos = { x: nx, z: nz };
resolveCircleCollision(pos, 0.6, this.world.colliders);
p.x = clamp(pos.x, -CONFIG.worldHalf, CONFIG.worldHalf);
p.z = clamp(pos.z, -CONFIG.worldHalf, CONFIG.worldHalf);
if (input.jump && p.y === 0) {
p.vy = CONFIG.playerJumpSpeed;
this.audio.blip(300, 0.1, 'sine', 0.08);
}
if (p.y > 0 || p.vy !== 0) {
p.vy -= CONFIG.gravity * dt;
p.y += p.vy * dt;
if (p.y <= 0) { p.y = 0; p.vy = 0; }
}
const walking = len > 0;
this.playerMesh.position.set(p.x, p.y, p.z);
this.playerMesh.rotation.y = p.heading;
const bob = walking ? Math.abs(Math.sin(this.time * (input.run ? 11 : 8))) * 0.06 : 0;
this.playerMesh.position.y = p.y + bob;
this.playerMesh.userData.armL.rotation.x = walking ? Math.sin(this.time * 10) * 0.5 : 0;
this.playerMesh.userData.armR.rotation.x = walking ? -Math.sin(this.time * 10) * 0.5 : 0;
}
updateCamera(dt) {
const p = this.player;
if (this.cameraMode === 'drive' && p.car) {
const car = p.car;
const backX = -Math.sin(car.heading);
const backZ = -Math.cos(car.heading);
const dist = this.cameraDist + 3.5;
const targetX = car.x + backX * dist;
const targetZ = car.z + backZ * dist;
const targetY = 4.2;
this.camera.position.x += (targetX - this.camera.position.x) * Math.min(1, dt * 5);
this.camera.position.y += (targetY - this.camera.position.y) * Math.min(1, dt * 5);
this.camera.position.z += (targetZ - this.camera.position.z) * Math.min(1, dt * 5);
this.camera.lookAt(car.x + Math.sin(car.heading) * 6, 1.6, car.z + Math.cos(car.heading) * 6);
return;
}
const dist = this.cameraDist;
const cx = p.x - Math.sin(this.cameraYaw) * dist * Math.cos(this.cameraPitch);
const cz = p.z - Math.cos(this.cameraYaw) * dist * Math.cos(this.cameraPitch);
const cy = p.y + 2 + Math.sin(this.cameraPitch) * dist;
this.camera.position.set(cx, cy, cz);
this.camera.lookAt(p.x, p.y + 1.6, p.z);
}
loop() {
requestAnimationFrame(() => this.loop());
const dt = Math.min(this.clock.getDelta(), 0.05);
this.time += dt;
this.frameCount++;
const input = this.input.read();
if (this.input.pressed('KeyM')) {
this.audio.setMuted(!this.audio.muted);
this.hud.showMessage(this.audio.muted ? 'Sound off' : 'Sound on', 2);
}
if (this.input.pressed('KeyC')) {
this.cameraDist = this.cameraDist === 7 ? 11 : 7;
}
const escPressed = this.input.pressed('Escape');
if (escPressed && this.state === 'playing') {
this.state = 'paused';
this.showOverlay('PAUSED', 'Take a breath. The bay will wait.');
} else if (escPressed && this.state === 'paused') {
document.getElementById('overlay').style.display = 'none';
this.state = 'playing';
}
if (this.state === 'playing') {
if (this.shotMode && this.input.autopilot && this.player.car) {
const desired = this.shotNum === 3 ? 0 : Math.PI / 2;
let diff = desired - this.player.car.heading;
while (diff > Math.PI) diff -= Math.PI * 2;
while (diff < -Math.PI) diff += Math.PI * 2;
this.input.autoSteer = clamp(diff * 1.5, -1, 1);
}
this.shotCooldown = Math.max(0, this.shotCooldown - dt);
if (input.enter && this.player.onFoot) {
const car = this.nearestEnterableCar();
if (car) this.enterCar(car);
} else if (input.enter && this.player.inCar) {
this.exitCar();
}
if (input.shoot) this.shoot();
this.updatePlayer(dt, input);
this.traffic.update(dt, this.player.car);
this.pedestrians.update(dt);
const policeResult = this.police.update(dt, this.player);
if (policeResult.busted) this.busted();
this.missions.update(dt, this);
if (this.missions.state === 'idle' && !this.missions.done) {
this.nextMissionTimer += dt;
if (this.nextMissionTimer > 3) {
this.nextMissionTimer = 0;
this.startMission(this.missions.index);
}
}
if (this.missions.targetCar && !this.missions.targetCar.dead) {
const tc = this.missions.targetCar;
this.targetBeacon.visible = this.missions.state === 'active' && this.missions.mission && this.missions.mission.kind === 'steal-deliver' && this.missions.step === 0;
this.targetBeacon.position.set(tc.x, 3.5 + Math.sin(this.time * 3) * 0.3, tc.z);
this.targetBeacon.rotation.y += dt * 2;
} else {
this.targetBeacon.visible = false;
}
this.combat.update(dt);
if (this.player.car && this.player.car.smoking && !this.player.car.dead) {
this.smokeTimer = (this.smokeTimer || 0) + dt;
if (this.smokeTimer > 0.3) {
this.smokeTimer = 0;
this.combat.spawnSmoke({ x: this.player.car.x, y: 1, z: this.player.car.z });
}
}
if (this.player.health < CONFIG.maxHealth && this.time - this.lastDamageAt > 5) {
this.player.health = Math.min(CONFIG.maxHealth, this.player.health + 2 * dt);
}
this.world.update(dt, this.time);
this.audio.update(dt, this);
this.saveTimer += dt;
if (this.saveTimer > 10) {
this.saveTimer = 0;
this.saveGame();
}
}
if (this.state === 'playing' || this.state === 'menu' || this.state === 'paused') {
this.updateCamera(dt);
}
if (this.state === 'menu') {
const t = this.time * 0.08;
this.camera.position.set(Math.sin(t) * 240, 90, Math.cos(t) * 240);
this.camera.lookAt(0, 10, 0);
}
this.hud.setStars(this.police.wanted);
this.hud.setCash(this.cash);
this.hud.setHealth(this.player.health);
this.hud.setObjective(this.missions.objectiveText(), this.missions.targetDistance(this));
this.hud.setSpeed(this.player.inCar && this.player.car ? Math.abs(this.player.car.speed) * 3.6 : 0, this.player.inCar);
this.hud.setDistrict(this.player.x, this.player.z);
this.hud.setCrosshairVisible(this.state === 'playing' && this.player.onFoot && !this.shotMode);
if (this.missions.message && this.missions.message !== this.lastMissionMessage) {
this.lastMissionMessage = this.missions.message;
this.hud.showMessage(this.missions.message, this.missions.messageTimer || 5);
}
this.hud.update(dt, this);
this.renderer.render(this.scene, this.camera);
if (this.frameCount === 2) window.__gameReady = true;
if (this.shotMode && this.frameCount === 45) window.__shotReady = true;
}
}

new Game();
