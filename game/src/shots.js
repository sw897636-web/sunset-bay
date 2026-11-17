// Sunset Bay: staged scenes for the screenshots. ?shot=1..4 stages a
// different moment of the game — driving, on foot, a police chase, a
// mission — then the playtest photographs it. Nothing here is used by
// normal play; it only runs when the URL carries ?shot=.

import { CONFIG } from './config.js';
import { makeCarMesh, makeCarRecord } from './vehicles.js';

export const SHOT_DEFS = [
{ name: '1-cover.jpg', label: 'Sunset drive down the Neon Strip' },
{ name: '2-onfoot.jpg', label: 'On foot on the Marina promenade' },
{ name: '3-chase.jpg', label: 'Three-star police chase' },
{ name: '4-mission.jpg', label: 'First Pickup — meeting Rico' },
];

export function stageShot(game, num) {
const g = game;
g.shotMode = true;
g.state = 'playing';
g.input.autopilot = false;
g.audio.ensure();
const traffic = g.traffic;
const police = g.police;
const peds = g.pedestrians;
if (num === 1) {
const car = g.playerCar;
car.x = -120;
car.z = 0;
car.heading = Math.PI / 2;
car.speed = 26;
car.mesh.position.set(car.x, 0, car.z);
car.mesh.rotation.y = car.heading;
g.enterCar(car);
g.cameraMode = 'drive';
g.input.autopilot = true;
g.input.autoSteer = 0;
for (let i = 0; i < 3; i++) {
const t = traffic.cars[i];
t.x = -120 + (i + 1) * 26;
t.z = (i % 2 === 0 ? 4 : -4);
t.heading = Math.PI / 2;
t.speed = 20;
t.cruiseSpeed = 20;
}
police.setWanted(3);
const pc1 = police.spawnPoliceCar(-90, 4);
pc1.heading = Math.PI / 2;
pc1.speed = 26;
pc1.staged = true;
const pc2 = police.spawnPoliceCar(-75, -4);
pc2.heading = Math.PI / 2;
pc2.speed = 26;
pc2.staged = true;
g.missions.start(0);
g.cash = 1250;
g.hud.showMessage('Neon Strip — head for the Marina marker', 30);
return;
}
if (num === 2) {
g.exitCar();
g.player.x = -372;
g.player.z = 200;
g.player.heading = -Math.PI / 2;
g.player.y = 0;
g.cameraMode = 'foot';
g.cameraYaw = -Math.PI / 2;
g.cameraPitch = 0.3;
for (let i = 0; i < 5; i++) {
const ped = peds.peds[i];
ped.x = -374 + (i - 2) * 2;
ped.z = 188 + i * 6;
ped.targetX = ped.x;
ped.targetZ = ped.z + (i % 2 === 0 ? 30 : -30);
}
g.missions.start(0);
g.hud.showMessage('Marina District — the sun is going down over the bay', 30);
return;
}
if (num === 3) {
const car = g.playerCar;
car.x = 80;
car.z = 120;
car.heading = 0;
car.speed = 30;
car.mesh.position.set(car.x, 0, car.z);
car.mesh.rotation.y = car.heading;
g.enterCar(car);
g.cameraMode = 'drive';
g.input.autopilot = true;
g.startMission(3);
police.setWanted(4);
const pc1 = police.spawnPoliceCar(76, 145);
pc1.heading = 0;
pc1.speed = 30;
pc1.staged = true;
const pc2 = police.spawnPoliceCar(84, 155);
pc2.heading = 0;
pc2.speed = 30;
pc2.staged = true;
const pc3 = police.spawnPoliceCar(72, 165);
pc3.heading = 0;
pc3.speed = 30;
pc3.staged = true;
for (let i = 0; i < 2; i++) {
const t = traffic.cars[i];
t.x = 80 + (i === 0 ? 4 : -4);
t.z = 120 + 30 + i * 18;
t.heading = 0;
t.speed = 12;
}
car.health = 45;
car.smoking = true;
g.combat.spawnSmoke({ x: car.x, y: 1, z: car.z - 2 });
g.cash = 4800;
g.player.health = 82;
g.hud.showMessage('Four stars — lose the tail!', 30);
return;
}
if (num === 4) {
g.exitCar();
g.player.x = -264;
g.player.z = 222;
g.player.heading = -Math.PI / 4;
g.cameraMode = 'foot';
g.cameraYaw = -Math.PI / 4;
g.cameraPitch = 0.1;
g.missions.start(0);
const rico = g.ricoMesh;
if (rico) {
rico.position.set(-272, 0, 232);
rico.visible = true;
}
g.player.cash = 250;
g.hud.showMessage('Rico Delmar: "Mara. You came. Good. First job is simple."', 30);
return;
}
}
