// Sunset Bay engine: game state, player on foot and driving, wanted system,
// combat, pickups, camera, save/load and the mission wiring.
import * as THREE from 'three';
import { buildCity, WORLD } from './city.js';
import { TrafficCar, spawnParkedCars, makeCarMesh } from './cars.js';
import { Pedestrian, spawnPedestrians, makePersonMesh } from './people.js';
import { PoliceCar, wantedStars, policeCountFor } from './cops.js';
import { MissionManager, MISSIONS, GARAGE } from './story.js';
import { SoundEngine } from './sound.js';
import { HUD } from './interface.js';
import { Input } from './controls.js';
import { mulberry32, clamp, lerp, angleLerp, angleDiff, dist2, resolveCircleBox } from './util.js';

const SAVE_KEY = 'sunsetbay-save-v1';
const SEED = 20261117;

export class Game {
constructor(canvas) {
this.canvas = canvas;
this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
this.renderer.setSize(window.innerWidth, window.innerHeight);
this.scene = new THREE.Scene();
this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 4000);
this.city = buildCity(this.scene, SEED);
this.rng = mulberry32(SEED + 5);
this.sound = new SoundEngine();
this.hud = new HUD({
onStart: () => this.startGame(),
onResume: () => this.resume(),
onRestart: () => this.restart(),
onMute: () => this.toggleMute(),
});
this.input = new Input(canvas);
this.input.onShoot = () => this.shoot();
this.input.onAction = (kind) => this.handleAction(kind);
this.input.onPause = () => this.togglePause();
this.missions = new MissionManager(this.scene);
this.missions.onBanner = (t, s) => this.hud.banner(t, s);
this.missions.onObjective = (t, d) => this.hud.setObjective(t, d);
this.missions.onReward = (amount) => this.addCash(amount, true);
this.missions.onFail = (reason) => this.missionFailed(reason);
this.state = 'menu';
this.time = 0;
this.frames = 0;
this.cash = 250;
this.health = 100;
this.ammo = 12;
this.reloadTimer = 0;
this.heat = 0;
this.stars = 0;
this.lastCrime = -99;
this.lastDamage = -99;
this.bustedTimer = 0;
this.camYaw = Math.PI;
this.camPitch = 0.32;
this.camMode = 'follow';
this.cinematicYaw = 0;
this.player = null;
this.playerCar = null;
this.traffic = [];
this.parked = [];
this.peds = [];
this.police = [];
this.pickups = [];
this.effects = [];
this.pendingNext = 0;
this.pendingRetry = 0;
this.raycaster = new THREE.Raycaster();
this.muzzle = new THREE.PointLight(0xffc46b, 0, 14);
this.scene.add(this.muzzle);
this.tracer = null;
this.saveData = this.loadSave();
this.buildWorld();
this.hud.setSave(!!this.saveData, this.saveData ? this.saveData.cash : 0, this.saveData ? this.saveData.mission : 0);
this.hud.show('start-screen');
window.addEventListener('resize', () => this.onResize());
}
buildWorld() {
const rng = mulberry32(SEED + 11);
this.player = {
mesh: makePersonMesh(mulberry32(7)),
x: -120, z: -60, heading: 0, speed: 0, walkPhase: 0,
};
this.player.mesh.position.set(-120, 0, -60);
this.scene.add(this.player.mesh);
for (let i = 0; i < 14; i++) {
const car = new TrafficCar(this.scene, rng, this.city);
car.hp = 100;
car.mesh.userData.owner = car;
this.traffic.push(car);
}
this.parked = spawnParkedCars(this.scene, rng, 10);
for (const c of this.parked) c.mesh.userData.owner = c;
this.peds = spawnPedestrians(this.scene, rng, 24);
for (const p of this.peds) p.mesh.userData.owner = p;
for (let i = 0; i < 12; i++) {
const g = new THREE.Group();
const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.7), new THREE.MeshLambertMaterial({ color: 0x2ea85a, emissive: 0x1a6a34, emissiveIntensity: 0.7 }));
g.add(box);
const band = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.16, 0.74), new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }));
g.add(band);
const rx = WORLD.roads[Math.floor(rng() * WORLD.roads.length)];
const rz = WORLD.roads[Math.floor(rng() * WORLD.roads.length)];
g.position.set(rx + (rng() < 0.5 ? -14 : 14), 0.6, rz + (rng() < 0.5 ? -14 : 14));
this.scene.add(g);
this.pickups.push({ mesh: g, x: g.position.x, z: g.position.z, taken: false });
}
}
loadSave() {
try {
const raw = localStorage.getItem(SAVE_KEY);
return raw ? JSON.parse(raw) : null;
} catch (e) { return null; }
}
saveGame() {
try {
localStorage.setItem(SAVE_KEY, JSON.stringify({ cash: this.cash, mission: this.missions.index, muted: this.sound.muted }));
} catch (e) { /* ignore */ }
}
startGame() {
this.sound.unlock();
this.cash = this.saveData ? this.saveData.cash : 250;
this.health = 100;
this.heat = 0;
this.stars = 0;
this.missions.index = this.saveData ? this.saveData.mission : 0;
this.missions.step = 0;
this.missions.active = false;
this.player.x = -120;
this.player.z = -60;
this.player.heading = Math.PI / 2;
this.camYaw = Math.PI / 2;
this.state = 'playing';
this.hud.show('none');
this.hud.setCash(this.cash);
this.hud.feed('Welcome to Sunset Bay. Find work, stay free.');
this.missions.start(this.missions.index);
}
restart() {
this.saveData = null;
try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
for (const p of this.police) p.remove(this.scene);
this.police = [];
if (this.playerCar) {
this.scene.remove(this.playerCar.mesh);
this.playerCar = null;
}
this.player.mesh.visible = true;
this.startGame();
}
togglePause() {
if (this.state === 'playing') {
this.state = 'paused';
this.hud.show('pause-screen');
this.saveGame();
} else if (this.state === 'paused') {
this.resume();
}
}
resume() {
if (this.state !== 'paused') return;
this.state = 'playing';
this.hud.show('none');
}
toggleMute() {
this.sound.setMuted(!this.sound.muted);
this.hud.feed(this.sound.muted ? 'Sound muted [M]' : 'Sound on [M]');
}
gameOver(kind) {
this.state = 'over';
this.sound.setSiren(false);
this.sound.setEngine(0, false);
const overTitle = document.getElementById('over-title');
const overSub = document.getElementById('over-sub');
if (kind === 'busted') {
overTitle.textContent = 'BUSTED';
overSub.textContent = 'The Bay PD took you in. Mama Lou bailed you out \u2014 for a fee.';
this.cash = Math.max(0, this.cash - 150);
} else {
overTitle.textContent = 'WASTED';
overSub.textContent = 'Jax is down. The city keeps moving without you.';
this.cash = Math.max(0, this.cash - 100);
}
this.hud.setCash(this.cash);
this.saveGame();
this.hud.show('over-screen');
}
addCash(amount, isReward) {
this.cash += amount;
this.hud.setCash(this.cash);
if (isReward) {
this.sound.jingle();
this.hud.feed('+$' + amount + ' \u2014 job paid.');
this.pendingNext = 3;
}
this.saveGame();
}
addHeat(n) {
this.heat = clamp(this.heat + n, 0, 100);
this.lastCrime = this.time;
const s = wantedStars(this.heat);
if (s > this.stars) this.hud.feed('Wanted level up: ' + s + (s > 1 ? ' stars!' : ' star!'));
this.stars = s;
}
setWanted(n) {
this.heat = n * 20 + 5;
this.stars = wantedStars(this.heat);
this.lastCrime = this.time;
this.hud.setStars(this.stars);
}
damagePlayer(amount) {
if (this.state !== 'playing') return;
this.health -= amount;
this.lastDamage = this.time;
this.hud.flash();
if (this.health <= 0) {
this.health = 0;
this.gameOver('wasted');
}
}
handleAction(kind) {
if (this.state !== 'playing') return;
if (kind === 'reload') {
if (this.ammo < 12 && this.reloadTimer <= 0) {
this.reloadTimer = 1.6;
this.hud.feed('Reloading\u2026');
}
return;
}
if (kind === 'mute') { this.toggleMute(); return; }
if (this.playerCar) {
this.exitCar();
} else {
this.tryEnterCar();
}
}
nearestCar(maxDist) {
let best = null;
let bestD = maxDist;
const px = this.player.x;
const pz = this.player.z;
for (const c of this.parked) {
const d = dist2(px, pz, c.x, c.z);
if (d < bestD) { bestD = d; best = c; }
}
for (const t of this.traffic) {
if (t.speed > 1.5) continue;
const d = dist2(px, pz, t.mesh.position.x, t.mesh.position.z);
if (d < bestD) { bestD = d; best = t; }
}
return best;
}
tryEnterCar() {
const car = this.nearestCar(4.6);
if (!car) return;
if (car.parked !== undefined && car.parked) {
this.parked = this.parked.filter((c) => c !== car);
} else {
this.traffic = this.traffic.filter((c) => c !== car);
}
this.playerCar = { mesh: car.mesh, hp: car.hp || 100, speed: 0, heading: car.heading !== undefined ? car.heading : car.mesh.rotation.y, x: car.mesh.position.x, z: car.mesh.position.z, kind: car.kind || 'sedan' };
this.player.mesh.visible = false;
this.addHeat(12);
this.hud.feed('You stole a car. The owner will not be pleased.');
this.sound.blip(520);
}
exitCar() {
if (!this.playerCar) return;
const c = this.playerCar;
const fx = Math.sin(c.heading);
const fz = Math.cos(c.heading);
this.player.x = c.x - fz * 3;
this.player.z = c.z + fx * 3;
this.player.heading = c.heading;
this.player.mesh.position.set(this.player.x, 0, this.player.z);
this.player.mesh.visible = true;
this.parked.push({ mesh: c.mesh, x: c.x, z: c.z, heading: c.heading, kind: c.kind, hp: c.hp, parked: true });
this.playerCar = null;
this.sound.blip(420);
}
shoot() {
if (this.state !== 'playing' || this.playerCar || this.reloadTimer > 0) return;
if (this.ammo <= 0) {
this.reloadTimer = 1.6;
this.hud.feed('Reloading\u2026');
return;
}
this.ammo--;
this.hud.setAmmo(this.ammo);
this.sound.shot();
this.addHeat(6);
const origin = this.camera.position.clone();
const dir = new THREE.Vector3();
this.camera.getWorldDirection(dir);
this.raycaster.set(origin, dir);
this.raycaster.far = 140;
const targets = [];
for (const p of this.peds) if (p.state !== 'dead') targets.push(p.mesh);
for (const t of this.traffic) targets.push(t.mesh);
for (const c of this.parked) targets.push(c.mesh);
for (const p of this.police) targets.push(p.mesh);
const hits = this.raycaster.intersectObjects(targets, true);
let end = origin.clone().add(dir.clone().multiplyScalar(120));
if (hits.length) {
end = hits[0].point.clone();
let obj = hits[0].object;
while (obj && !obj.userData.owner) obj = obj.parent;
if (obj && obj.userData.owner) {
const owner = obj.userData.owner;
if (owner instanceof Pedestrian) {
owner.die();
this.addHeat(34);
this.hud.feed('Pedestrian down. The city saw that.');
} else if (owner instanceof TrafficCar) {
owner.hp -= 34;
this.addHeat(14);
if (owner.hp <= 0) {
owner.baseSpeed = 0;
owner.speed = 0;
this.hud.feed('That car is done for.');
}
} else if (owner instanceof PoliceCar) {
this.addHeat(20);
this.hud.feed('You shot at the police!');
} else {
owner.hp = (owner.hp || 100) - 34;
if (owner.hp <= 0) this.hud.feed('That car is wrecked.');
}
}
}
this.muzzle.position.copy(origin).add(dir.clone().multiplyScalar(1.5));
this.muzzle.intensity = 4;
if (this.tracer) this.scene.remove(this.tracer);
const tracerGeo = new THREE.BufferGeometry().setFromPoints([origin, end]);
this.tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color: 0xffe28a, transparent: true, opacity: 0.9 }));
this.scene.add(this.tracer);
this.tracerTimer = 0.07;
}
spawnExplosion(x, z) {
const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.9 }));
m.position.set(x, 1.2, z);
this.scene.add(m);
this.effects.push({ mesh: m, t: 0, dur: 0.6, kind: 'boom' });
const light = new THREE.PointLight(0xff9030, 6, 30);
light.position.set(x, 3, z);
this.scene.add(light);
this.effects.push({ mesh: light, t: 0, dur: 0.5, kind: 'light' });
this.sound.crash();
}
update(dt) {
dt = dt > 0 ? Math.min(dt, 0.05) : 0;
this.time += dt;
this.frames++;
const look = this.input.consumeLook();
this.camYaw -= look.dx * 0.0032;
this.camPitch = clamp(this.camPitch + look.dy * 0.0024, 0.08, 1.1);
if (this.state === 'menu') {
this.cinematicYaw += dt * 0.05;
this.camera.position.set(Math.sin(this.cinematicYaw) * 260, 90, Math.cos(this.cinematicYaw) * 260);
this.camera.lookAt(0, 20, 0);
this.renderer.render(this.scene, this.camera);
return;
}
if (this.state !== 'playing') {
this.renderer.render(this.scene, this.camera);
return;
}
if (this.reloadTimer > 0) {
this.reloadTimer -= dt;
if (this.reloadTimer <= 0) {
this.ammo = 12;
this.hud.setAmmo(this.ammo);
}
}
if (this.muzzle.intensity > 0) this.muzzle.intensity = Math.max(0, this.muzzle.intensity - dt * 30);
if (this.tracer) {
this.tracerTimer -= dt;
if (this.tracerTimer <= 0) {
this.scene.remove(this.tracer);
this.tracer.geometry.dispose();
this.tracer = null;
}
}
this.updatePlayer(dt);
this.updateTraffic(dt);
this.updatePeds(dt);
this.updatePickups(dt);
this.updateWanted(dt);
this.updateEffects(dt);
this.missions.update(dt, {
px: this.playerCar ? this.playerCar.x : this.player.x,
pz: this.playerCar ? this.playerCar.z : this.player.z,
inCar: !!this.playerCar,
wanted: this.stars,
time: this.time,
setWanted: (n) => this.setWanted(n),
});
if (this.pendingNext > 0) {
this.pendingNext -= dt;
if (this.pendingNext <= 0) this.missions.startNext();
}
if (this.pendingRetry > 0) {
this.pendingRetry -= dt;
if (this.pendingRetry <= 0) this.missions.start(this.missions.index);
}
if (this.time - this.lastDamage > 10 && this.health > 0 && this.health < 100) {
this.health = Math.min(100, this.health + 2 * dt);
}
this.updateCamera(dt);
this.hud.setStars(this.stars);
this.hud.setHealth(this.health);
this.hud.setSpeed(this.playerCar ? this.playerCar.speed : 0, !!this.playerCar);
this.hud.setCrosshair(!this.playerCar && this.input.locked);
this.hud.drawMinimap(this.city, this.playerCar ? { x: this.playerCar.x, z: this.playerCar.z } : this.player, this.traffic, this.police, this.missions.active || this.missions.index < MISSIONS.length ? this.missions.marker() : null, this.camYaw);
const speed01 = this.playerCar ? clamp(Math.abs(this.playerCar.speed) / 40, 0, 1) : 0;
this.sound.setEngine(speed01, !!this.playerCar);
this.sound.setSiren(this.police.length > 0);
this.renderer.render(this.scene, this.camera);
}
updatePlayer(dt) {
const input = this.input;
if (this.playerCar) {
const c = this.playerCar;
const fwd = input.isDown('KeyW') || input.isDown('ArrowUp');
const back = input.isDown('KeyS') || input.isDown('ArrowDown');
const left = input.isDown('KeyA') || input.isDown('ArrowLeft');
const right = input.isDown('KeyD') || input.isDown('ArrowRight');
const brake = input.isDown('Space');
const maxSpeed = c.kind === 'sport' ? 46 : 38;
if (fwd) c.speed += 24 * dt;
if (back) c.speed -= c.speed > 0.5 ? 30 * dt : 12 * dt;
if (!fwd && !back) c.speed -= Math.sign(c.speed) * 8 * dt;
if (brake) c.speed -= Math.sign(c.speed) * 34 * dt;
if (Math.abs(c.speed) < 0.2 && !fwd && !back) c.speed = 0;
c.speed = clamp(c.speed, -13, maxSpeed);
const steer = (left ? 1 : 0) - (right ? 1 : 0);
const grip = brake ? 1.7 : 1;
c.heading += steer * c.speed * 0.042 * grip * dt;
if (brake) c.speed *= Math.max(0, 1 - 1.6 * dt);
c.x += Math.sin(c.heading) * c.speed * dt;
c.z += Math.cos(c.heading) * c.speed * dt;
c.mesh.position.set(c.x, 0, c.z);
c.mesh.rotation.y = c.heading;
for (const w of c.mesh.userData.wheels) w.rotation.x += (c.speed * dt) / 0.38;
let hit = false;
for (const b of this.city.colliders) {
if (resolveCircleBox(c, 2.2, b)) hit = true;
}
if (hit) {
if (Math.abs(c.speed) > 9) {
this.sound.crash();
c.hp -= 9;
this.damagePlayer(4);
}
c.speed *= 0.45;
}
c.x = clamp(c.x, -592, 592);
c.z = clamp(c.z, -592, 592);
for (const t of this.traffic) {
const d = dist2(c.x, c.z, t.mesh.position.x, t.mesh.position.z);
if (d < 4.4 && d > 0.01) {
const push = (4.4 - d) / 2;
const nx = (c.x - t.mesh.position.x) / d;
const nz = (c.z - t.mesh.position.z) / d;
c.x += nx * push;
c.z += nz * push;
if (Math.abs(c.speed) > 8) {
this.sound.crash();
t.speed *= 0.4;
c.speed *= 0.7;
this.addHeat(3);
}
}
}
for (const p of this.peds) {
if (p.state === 'dead') continue;
const d = dist2(c.x, c.z, p.mesh.position.x, p.mesh.position.z);
if (d < 2.2 && Math.abs(c.speed) > 2) {
p.die();
this.addHeat(30);
this.sound.crash();
this.hud.feed('Pedestrian down. The city saw that.');
}
}
if (c.hp <= 0) {
this.spawnExplosion(c.x, c.z);
this.scene.remove(c.mesh);
this.player.x = c.x;
this.player.z = c.z;
this.player.mesh.visible = true;
this.player.mesh.position.set(this.player.x, 0, this.player.z);
this.playerCar = null;
this.damagePlayer(25);
this.hud.feed('Your car blew up!');
}
this.player.x = c.x;
this.player.z = c.z;
this.player.heading = c.heading;
return;
}
const fwd = (input.isDown('KeyW') || input.isDown('ArrowUp') ? 1 : 0) - (input.isDown('KeyS') || input.isDown('ArrowDown') ? 1 : 0);
const strafe = (input.isDown('KeyD') || input.isDown('ArrowRight') ? 1 : 0) - (input.isDown('KeyA') || input.isDown('ArrowLeft') ? 1 : 0);
const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
const speed = sprint ? 9.5 : 6;
const sin = Math.sin(this.camYaw);
const cos = Math.cos(this.camYaw);
let mx = sin * fwd + cos * strafe;
let mz = cos * fwd - sin * strafe;
const ml = Math.sqrt(mx * mx + mz * mz);
if (ml > 0.01) {
mx /= ml;
mz /= ml;
this.player.heading = angleLerp(this.player.heading, Math.atan2(mx, mz), clamp(12 * dt, 0, 1));
this.player.x += mx * speed * dt;
this.player.z += mz * speed * dt;
this.player.walkPhase += dt * speed * 1.6;
} else {
this.player.walkPhase = lerp(this.player.walkPhase, Math.round(this.player.walkPhase / Math.PI) * Math.PI, clamp(8 * dt, 0, 1));
}
const p = { x: this.player.x, z: this.player.z };
for (const b of this.city.colliders) resolveCircleBox(p, 0.7, b);
this.player.x = clamp(p.x, -592, 592);
this.player.z = clamp(p.z, -592, 592);
for (const c of this.parked) {
const d = dist2(this.player.x, this.player.z, c.x, c.z);
if (d < 2.4 && d > 0.01) {
const push = 2.4 - d;
this.player.x += (this.player.x - c.x) / d * push;
this.player.z += (this.player.z - c.z) / d * push;
}
}
this.player.mesh.position.set(this.player.x, 0, this.player.z);
this.player.mesh.rotation.y = this.player.heading;
const s = Math.sin(this.player.walkPhase) * (ml > 0.01 ? 0.5 : 0);
const parts = this.player.mesh.userData.parts;
if (parts) {
parts.legL.rotation.x = s;
parts.legR.rotation.x = -s;
parts.armL.rotation.x = -s * 0.7;
parts.armR.rotation.x = s * 0.7;
}
}
updateTraffic(dt) {
const threat = { x: this.playerCar ? this.playerCar.x : this.player.x, z: this.playerCar ? this.playerCar.z : this.player.z };
for (const t of this.traffic) t.update(dt, this.rng, this.traffic);
}
updatePeds(dt) {
const threat = { x: this.playerCar ? this.playerCar.x : this.player.x, z: this.playerCar ? this.playerCar.z : this.player.z };
const threatActive = !!this.playerCar && Math.abs(this.playerCar.speed) > 8;
for (const p of this.peds) p.update(dt, this.rng, threatActive ? threat : null);
}
updatePickups(dt) {
for (const pk of this.pickups) {
if (pk.taken) continue;
pk.mesh.rotation.y += dt * 1.5;
pk.mesh.position.y = 0.6 + Math.sin(this.time * 2 + pk.x) * 0.15;
const d = dist2(this.player.x, this.player.z, pk.x, pk.z);
if (d < 2.6) {
pk.taken = true;
this.scene.remove(pk.mesh);
this.cash += 50;
this.hud.setCash(this.cash);
this.sound.blip(1320);
this.hud.feed('Found a cash stash: +$50.');
}
}
}
updateWanted(dt) {
if (this.time - this.lastCrime > 8) {
let nearCop = false;
for (const p of this.police) {
if (dist2(p.mesh.position.x, p.mesh.position.z, this.player.x, this.player.z) < 45) { nearCop = true; break; }
}
if (!nearCop && this.heat > 0) {
this.heat = Math.max(0, this.heat - 2.5 * dt);
this.stars = wantedStars(this.heat);
}
}
const want = policeCountFor(this.stars);
while (this.police.length < want) {
const a = this.rng() * Math.PI * 2;
const rx = clamp(this.player.x + Math.sin(a) * 75, -560, 560);
const rz = clamp(this.player.z + Math.cos(a) * 75, -560, 560);
const cop = new PoliceCar(this.scene, rx, rz);
cop.mesh.userData.owner = cop;
this.police.push(cop);
if (this.police.length === 1) this.hud.feed('Bay PD is on you. Lose them!');
}
while (this.police.length > want) {
const cop = this.police.pop();
cop.remove(this.scene);
}
for (const cop of this.police) {
const d = cop.update(dt, { x: this.player.x, z: this.player.z }, this.city.colliders, (dist) => {
if (this.playerCar) {
this.playerCar.speed *= 0.82;
this.playerCar.hp -= 4;
this.damagePlayer(2);
this.sound.crash();
}
});
if (!this.playerCar && d < 5.5) {
this.bustedTimer += dt;
if (this.bustedTimer > 2.5) this.gameOver('busted');
} else {
this.bustedTimer = Math.max(0, this.bustedTimer - dt);
}
}
}
updateEffects(dt) {
for (let i = this.effects.length - 1; i >= 0; i--) {
const e = this.effects[i];
e.t += dt;
if (e.t >= e.dur) {
this.scene.remove(e.mesh);
this.effects.splice(i, 1);
continue;
}
const k = e.t / e.dur;
if (e.kind === 'boom') {
e.mesh.scale.setScalar(1 + k * 9);
e.mesh.material.opacity = 0.9 * (1 - k);
} else if (e.kind === 'light') {
e.mesh.intensity = 6 * (1 - k);
}
}
}
updateCamera(dt) {
const target = this.playerCar
? { x: this.playerCar.x, y: 2.2, z: this.playerCar.z }
: { x: this.player.x, y: 1.8, z: this.player.z };
if (this.camMode === 'cinematic') {
this.cinematicYaw += dt * 0.07;
const dist = 30;
const tx = target.x + Math.sin(this.cinematicYaw) * dist;
const tz = target.z + Math.cos(this.cinematicYaw) * dist;
this.camera.position.x = lerp(this.camera.position.x, tx, clamp(2 * dt, 0, 1));
this.camera.position.y = lerp(this.camera.position.y, 13, clamp(2 * dt, 0, 1));
this.camera.position.z = lerp(this.camera.position.z, tz, clamp(2 * dt, 0, 1));
this.camera.lookAt(target.x, target.y, target.z);
return;
}
const dist = this.playerCar ? 13 : 10.5;
const height = this.playerCar ? 5.2 : 3.6;
const fx = Math.sin(this.camYaw);
const fz = Math.cos(this.camYaw);
const px = Math.sin(this.camPitch);
const wantX = target.x - fx * Math.cos(this.camPitch) * dist;
const wantY = target.y + px * dist + height * 0.35;
const wantZ = target.z - fz * Math.cos(this.camPitch) * dist;
const k = clamp(10 * dt, 0, 1);
this.camera.position.x = lerp(this.camera.position.x, wantX, k);
this.camera.position.y = lerp(this.camera.position.y, wantY, k);
this.camera.position.z = lerp(this.camera.position.z, wantZ, k);
this.camera.lookAt(target.x, target.y, target.z);
}
missionFailed(reason) {
this.hud.banner('JOB FAILED', reason);
this.hud.feed(reason + ' Retrying the job\u2026');
this.pendingRetry = 3;
}
onResize() {
this.camera.aspect = window.innerWidth / window.innerHeight;
this.camera.updateProjectionMatrix();
this.renderer.setSize(window.innerWidth, window.innerHeight);
}
teleport(x, z, heading, inCar, carKind) {
if (inCar) {
if (this.playerCar) this.scene.remove(this.playerCar.mesh);
const mesh = makeCarMesh(0xd86a2e, carKind || 'sport');
mesh.position.set(x, 0, z);
mesh.rotation.y = heading;
this.scene.add(mesh);
this.playerCar = { mesh, hp: 100, speed: 0, heading, x, z, kind: carKind || 'sport' };
this.player.mesh.visible = false;
} else {
if (this.playerCar) {
this.scene.remove(this.playerCar.mesh);
this.playerCar = null;
}
this.player.mesh.visible = true;
this.player.x = x;
this.player.z = z;
this.player.heading = heading;
this.player.mesh.position.set(x, 0, z);
this.player.mesh.rotation.y = heading;
}
this.player.x = x;
this.player.z = z;
this.player.heading = heading;
this.camYaw = heading;
this.camera.position.set(x - Math.sin(heading) * 12, 6, z - Math.cos(heading) * 12);
this.camera.lookAt(x, 2, z);
}
spawnPolice(n) {
for (let i = 0; i < n; i++) {
const a = Math.PI + (i - n / 2) * 0.5;
const cop = new PoliceCar(this.scene, this.player.x + Math.sin(a) * 45, this.player.z + Math.cos(a) * 45);
cop.mesh.userData.owner = cop;
this.police.push(cop);
}
}
startMission(i, opts) {
this.missions.start(i);
if (opts && opts.skipIntro) {
this.hud.banner('JOB: ' + (MISSIONS[i] ? MISSIONS[i].name : ''), 'Objective on the HUD and minimap.');
}
}
setCameraMode(mode) {
this.camMode = mode;
if (mode === 'cinematic') this.cinematicYaw = this.camYaw;
}
getState() {
return {
state: this.state,
x: Math.round(this.player.x),
z: Math.round(this.player.z),
speed: this.playerCar ? Math.round(this.playerCar.speed) : 0,
inCar: !!this.playerCar,
wanted: this.stars,
cash: this.cash,
mission: this.missions.index,
missionActive: this.missions.active,
frames: this.frames,
police: this.police.length,
traffic: this.traffic.length,
peds: this.peds.length,
};
}
}
