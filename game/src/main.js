// Sunset Bay — boot, the one loop, the screens, the camera and the player.
// The world itself lives in the other modules: city.js builds the streets,
// vehicles.js drives the cars, police.js runs the heat, missions.js tells the
// story. ?seed=N fixes the city. ?shot=start|drive|chase|mission stages a
// screenshot scene and sets window.__shotReady when it is framed.
import * as THREE from 'three';
import { CITY, PLAYER, CAR, SAVE_KEY, clamp, angleLerp, dist2 } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { createCity, collideCircle } from './city.js';
import { createPerson, animateWalk, createCar } from './models.js';
import { createVehicle, spawnTraffic } from './vehicles.js';
import { spawnPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const random = createRandom(seed);

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xff8f5e);
scene.fog = new THREE.Fog(0xe8906a, 120, 520);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 40, 90);

const hemi = new THREE.HemisphereLight(0xffe0b8, 0x4a3a5a, 0.95);
scene.add(hemi);
const sunLight = new THREE.DirectionalLight(0xffc890, 1.5);
sunLight.position.set(-120, 180, 220);
scene.add(sunLight);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const city = createCity(random);
scene.add(city.group);

const audio = createAudio();
const input = createInput(canvas);
const hud = createHud();

// ---------- player ----------
const playerMesh = createPerson({ jacket: 0xff7a2e, pants: 0x2e3a5c, skin: 0xe8b98a, hair: 0x1c1210 });
scene.add(playerMesh);
const garage = city.landmarks.garage;
const player = {
  mesh: playerMesh,
  x: garage.x + 4, z: garage.z - 18,
  heading: 0,
  health: PLAYER.health,
  cash: 0,
  hasPistol: false,
  weaponOut: false,
  ammo: 12,
  walkPhase: 0,
  punchAnim: 0,
  moving: false,
};
playerMesh.position.set(player.x, 0, player.z);

// ---------- world object: the shared handle every module works through ----------
const world = {
  scene, city, random, input, audio, hud,
  player, time: 0,
  cars: [],
  peds: [],
  playerCar: null,
  goldCar: null,
  completedMissions: 0,
  police: null,
  missions: null,
  combat: null,
  toast(text) { hud.toast(text); },
  setMissionText(title, text, timer) { hud.setMission(title, text, timer); },
  onCrash(speed) {
    // Throttle the sound: a long ram is one crash, not sixty a second.
    if (world.time - (world.lastCrash || -9) < 0.35) return;
    world.lastCrash = world.time;
    audio.crash();
    if (speed > 8) player.health = Math.max(0, player.health - (speed - 8) * 0.4);
  },
  onBusted() {
    if (state !== 'playing') return;
    audio.busted();
    endGame('BUSTED', 'The Bay City Police finally caught up with you. The job is blown — but Mara still has work, if you are willing to try again.');
  },
  onStoryDone() {
    state = 'done';
    showMenu('menuDone');
    hud.hide();
  },
  saveGame() { saveGame(); },
};
world.police = createPolice(scene, world);
world.missions = createMissions(scene, world);
world.combat = createCombat(scene, world);

// Traffic, pedestrians and the gold sedan.
world.cars = spawnTraffic(scene, world, 10);
world.peds = spawnPedestrians(scene, world, 16);
const goldCar = createVehicle(scene, {
  x: city.landmarks.marina.x, z: city.landmarks.marina.z - 6,
  heading: Math.PI / 2, color: 0xffd700,
});
goldCar.isGold = true;
goldCar.traffic = false;
world.cars.push(goldCar);
world.goldCar = goldCar;

// Parked cars the player can steal, dotted along the streets.
for (let i = 0; i < 6; i += 1) {
  const node = city.randomNode();
  const parked = createVehicle(scene, {
    x: node.x + random.range(-4, 4), z: node.z + random.range(-4, 4),
    heading: random.range(0, Math.PI * 2),
    color: [0xd83a3a, 0x3a7bd8, 0xe8c33a, 0x3ad8a0, 0xf2f2f2, 0xb03ad8][i],
  });
  parked.traffic = false;
  world.cars.push(parked);
}

// ---------- camera ----------
let camYaw = 0;
let camPitch = 0.32;
let lastDragTime = -10;
let orbitAngle = 0;

function updateCamera(dt) {
  const target = world.playerCar
    ? { x: world.playerCar.x, z: world.playerCar.z, y: 1.6 }
    : { x: player.x, z: player.z, y: 1.6 };
  const drag = input.consumeDrag();
  if (drag.x !== 0 || drag.y !== 0) {
    camYaw -= drag.x * 0.005;
    camPitch = clamp(camPitch + drag.y * 0.003, 0.08, 0.9);
    lastDragTime = world.time;
  }
  if (state === 'title') {
    orbitAngle += dt * 0.05;
    const cx = Math.sin(orbitAngle) * 90;
    const cz = Math.cos(orbitAngle) * 90;
    camera.position.set(cx, 55, cz);
    camera.lookAt(0, 8, 0);
    return;
  }
  // When driving with no recent drag, ease the camera behind the car.
  if (world.playerCar && world.time - lastDragTime > 2.5) {
    camYaw = angleLerp(camYaw, world.playerCar.heading, Math.min(1, dt * 1.4));
  }
  const dist = world.playerCar ? 13 : 9;
  const height = world.playerCar ? 5.2 : 4.2;
  const cx = target.x - Math.sin(camYaw) * Math.cos(camPitch) * dist;
  const cz = target.z - Math.cos(camYaw) * Math.cos(camPitch) * dist;
  const cy = target.y + Math.sin(camPitch) * dist + height * 0.4;
  camera.position.set(cx, cy, cz);
  camera.lookAt(target.x, target.y + 0.8, target.z);
}

// ---------- entering and exiting cars ----------
function nearestCar(maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of world.cars) {
    if (car === world.playerCar) continue;
    const d2 = dist2(player.x, player.z, car.x, car.z);
    if (d2 < bestD) { bestD = d2; best = car; }
  }
  return best;
}

function enterCar(car) {
  world.playerCar = car;
  car.traffic = false;
  car.isPolice = car.isPolice || false;
  playerMesh.visible = false;
  player.x = car.x;
  player.z = car.z;
  player.heading = car.heading;
  camYaw = car.heading;
  audio.enterCar();
}

function exitCar() {
  const car = world.playerCar;
  if (!car) return;
  world.playerCar = null;
  car.speed = 0;
  player.x = car.x + Math.cos(car.heading) * 2.4;
  player.z = car.z - Math.sin(car.heading) * 2.4;
  player.heading = car.heading;
  playerMesh.visible = true;
  playerMesh.position.set(player.x, 0, player.z);
}

// ---------- save / load ----------
function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: player.cash,
      health: player.health,
      completedMissions: world.completedMissions,
      hasPistol: player.hasPistol,
      x: player.x, z: player.z,
    }));
  } catch { /* private mode: the save lasts this visit only */ }
}

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function applySave(save) {
  player.cash = save.cash || 0;
  player.health = save.health || PLAYER.health;
  player.hasPistol = !!save.hasPistol;
  player.ammo = 12;
  world.completedMissions = save.completedMissions || 0;
  if (typeof save.x === 'number') { player.x = save.x; player.z = save.z; }
  playerMesh.position.set(player.x, 0, player.z);
}

// ---------- screens ----------
let state = 'title';
function showMenu(id) {
  for (const m of ['menuTitle', 'menuPause', 'menuEnd', 'menuDone']) {
    document.getElementById(m).classList.toggle('hidden', m !== id);
  }
  if (!id) {
    for (const m of ['menuTitle', 'menuPause', 'menuEnd', 'menuDone']) {
      document.getElementById(m).classList.add('hidden');
    }
  }
}
function startGame(fromSave) {
  const save = fromSave ? loadSave() : null;
  if (save) applySave(save);
  else {
    player.cash = 0;
    player.health = PLAYER.health;
    player.hasPistol = false;
    player.ammo = 12;
    world.completedMissions = 0;
    player.x = garage.x + 4;
    player.z = garage.z - 18;
    playerMesh.position.set(player.x, 0, player.z);
    world.police.clearAll();
    world.missions.reset();
  }
  showMenu(null);
  hud.show();
  state = 'playing';
  audio.unlock();
  if (world.completedMissions < world.missions.totalMissions) {
    world.missions.start(world.completedMissions);
  } else {
    world.setMissionText('', 'Free roam — the Bay is yours.', '');
  }
}
function endGame(title, reason) {
  state = 'end';
  document.getElementById('endTitle').textContent = title;
  document.getElementById('endReason').textContent = reason;
  showMenu('menuEnd');
  hud.hide();
  world.police.clearAll();
  if (world.playerCar) exitCar();
  player.health = PLAYER.health;
}

document.getElementById('btnNew').addEventListener('click', () => startGame(false));
document.getElementById('btnContinue').addEventListener('click', () => startGame(true));
document.getElementById('btnResume').addEventListener('click', () => {
  showMenu(null); hud.show(); state = 'playing';
});
document.getElementById('btnSave').addEventListener('click', () => {
  saveGame();
  hud.toast('Game saved.');
});
document.getElementById('btnQuit').addEventListener('click', () => {
  saveGame();
  state = 'title';
  showMenu('menuTitle');
  hud.hide();
});
document.getElementById('btnRetry').addEventListener('click', () => {
  if (world.missions.failed) world.missions.retry();
  else world.missions.start(world.completedMissions);
  showMenu(null); hud.show(); state = 'playing';
  player.health = PLAYER.health;
});
document.getElementById('btnFreeRoam').addEventListener('click', () => {
  world.missions.reset();
  world.setMissionText('', 'Free roam — the Bay is yours.', '');
  showMenu(null); hud.show(); state = 'playing';
  player.health = PLAYER.health;
});
document.getElementById('btnTitle2').addEventListener('click', () => {
  state = 'title';
  showMenu('menuTitle');
  hud.hide();
});
document.getElementById('btnKeepPlaying').addEventListener('click', () => {
  state = 'playing';
  showMenu(null);
  hud.show();
});
// Continue is only meaningful with a save on disk.
document.getElementById('btnContinue').disabled = !loadSave();

// First gesture unlocks audio (browsers demand it).
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
window.addEventListener('keydown', () => audio.unlock(), { once: true });

// ---------- per-frame update ----------
function updatePlayerOnFoot(dt) {
  const fwd = (input.state.forward ? 1 : 0) - (input.state.back ? 1 : 0);
  const strafe = (input.state.right ? 1 : 0) - (input.state.left ? 1 : 0);
  const fx = Math.sin(camYaw);
  const fz = Math.cos(camYaw);
  const rx = -Math.cos(camYaw);
  const rz = Math.sin(camYaw);
  let mx = fx * fwd + rx * strafe;
  let mz = fz * fwd + rz * strafe;
  const len = Math.hypot(mx, mz);
  player.moving = len > 0.01;
  if (player.moving) {
    mx /= len;
    mz /= len;
    const speed = input.state.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    player.x += mx * speed * dt;
    player.z += mz * speed * dt;
    player.heading = Math.atan2(mx, mz);
    player.walkPhase += dt * speed * 1.6;
    animateWalk(playerMesh, player.walkPhase, 1);
  } else {
    animateWalk(playerMesh, player.walkPhase, 0);
  }
  // Collisions: buildings, city bounds, and a soft push from cars.
  if (collideCircle(city.solids, player, PLAYER.radius)) {
    // pushed out by the resolver
  }
  player.x = clamp(player.x, -CITY.half - 4, CITY.half + 4);
  player.z = clamp(player.z, -CITY.half - 4, CITY.beachZ + 4);
  for (const car of world.cars) {
    const d2 = dist2(player.x, player.z, car.x, car.z);
    if (d2 < 3.2 * 3.2 && d2 > 0.01) {
      const d = Math.sqrt(d2);
      player.x = car.x + ((player.x - car.x) / d) * 3.2;
      player.z = car.z + ((player.z - car.z) / d) * 3.2;
      if (Math.abs(car.speed) > 8) {
        player.health -= 25;
        world.police.addWanted(1);
        world.police.commitCrime(player.x, player.z);
        audio.crash();
      }
    }
  }
  playerMesh.position.set(player.x, playerMesh.position.y, player.z);
  playerMesh.rotation.y = player.heading;
  if (player.punchAnim > 0) {
    player.punchAnim -= dt;
    playerMesh.userData.parts.armR.rotation.x = -1.4 * Math.max(0, player.punchAnim / 0.25);
  }
}

function update(dt) {
  world.time += dt;
  if (state === 'title') {
    // A living backdrop behind the title screen.
    for (const car of world.cars) if (car.traffic) car.update(dt, world);
    for (const ped of world.peds) ped.update(dt, world);
    updateCamera(dt);
    return;
  }
  if (state !== 'playing') return;

  // Global keys.
  if (input.wasPressed('p') || input.wasPressed('escape')) {
    state = 'paused';
    showMenu('menuPause');
    hud.hide();
    return;
  }
  if (input.wasPressed('m')) audio.setMuted(!audio.isMuted());
  if (input.wasPressed('t')) { saveGame(); hud.toast('Game saved.'); }
  if (input.wasPressed('q') && player.hasPistol) {
    player.weaponOut = !player.weaponOut;
    hud.toast(player.weaponOut ? 'Pistol drawn.' : 'Pistol holstered.');
  }
  if (input.wasPressed('r')) world.combat.reload();
  if (input.wasPressed('enter') && world.missions.failed) world.missions.retry();

  if (world.playerCar) {
    world.playerCar.drive(dt, input, world);
    player.x = world.playerCar.x;
    player.z = world.playerCar.z;
    player.heading = world.playerCar.heading;
    if (input.wasPressed('e')) exitCar();
  } else {
    updatePlayerOnFoot(dt);
    // Punching and shooting.
    if (input.wasPressed('f')) world.combat.punch();
    if (player.weaponOut && input.wasClicked()) world.combat.shoot();
    // Hold E on a mission interact objective.
    if (input.state.forward || input.state.back || input.state.left || input.state.right) {
      // movement keys held; nothing special
    }
    const keys = input.state;
    if (keys) { /* E is read below via the keys set through wasPressed/hold */ }
    // E is a letter key: check the live set through a held-state helper.
    if (heldKeyE()) world.missions.holdingInteract(dt);
    if (input.wasPressed('e')) {
      const car = nearestCar(4.5);
      if (car) {
        if (world.missions.active && world.missions.interact(true)) {
          enterCar(car);
        } else {
          enterCar(car);
          if (!car.isGold) world.police.addWanted(1);
        }
      }
    }
  }

  // Prompts: what E would do right now.
  if (!world.playerCar) {
    const car = nearestCar(4.5);
    const marker = world.missions.marker();
    if (car) hud.setPrompt('Press E — steal the car');
    else if (marker && dist2(player.x, player.z, marker.x, marker.z) < 64) hud.setPrompt('Hold E — work the job');
    else hud.setPrompt('');
  } else {
    hud.setPrompt('Press E — get out');
  }

  for (const car of world.cars) {
    if (car.traffic && car !== world.playerCar) car.update(dt, world);
  }
  for (const ped of world.peds) ped.update(dt, world);
  world.police.update(dt, world);
  world.missions.update(dt);
  world.combat.update(dt);

  // Slow health regen when the heat is off.
  if (world.police.wanted === 0 && player.health > 0 && player.health < PLAYER.health) {
    player.health = Math.min(PLAYER.health, player.health + 1.5 * dt);
  }
  if (player.health <= 0) {
    player.health = 0;
    endGame('WASTED', 'You went down in the streets of Sunset Bay. Mara will wait — she always does. Retry the job or take the city at your own pace.');
    return;
  }
  audio.update(world.playerCar ? Math.abs(world.playerCar.speed) / CAR.maxSpeed : 0, world.police.wanted);
  hud.update(world, dt);
  updateCamera(dt);
}

// E is tracked separately because the input module only exposes wasPressed
// for the current frame; holding E needs the live key set.
const eHeld = new Set();
window.addEventListener('keydown', (event) => { if (event.key.toLowerCase() === 'e') eHeld.add('e'); });
window.addEventListener('keyup', (event) => { if (event.key.toLowerCase() === 'e') eHeld.delete('e'); });
function heldKeyE() { return eHeld.has('e'); }

// ---------- screenshot staging ----------
let shotPilot = null;
let shotTime = 0;
let simSeconds = 0;
let stagedReadyAfter = 2;
if (shotName) {
  const staged = stageShot(world, shotName, { startGame, showMenu, hud });
  shotPilot = staged.pilot;
  state = staged.state;
  stagedReadyAfter = staged.readyAfter || 2;
  if (staged.state === 'playing') hud.show();
}

// ---------- the loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  if (shotPilot) {
    // Step the world in fixed slices so a screenshot is deterministic.
    shotTime += dt;
    const steps = 6;
    simSeconds += steps * (1 / 60);
    for (let i = 0; i < steps; i += 1) {
      shotPilot.update(1 / 60);
      update(1 / 60);
    }
    renderer.render(scene, camera);
    if (simSeconds >= (stagedReadyAfter || 2) && !window.__shotReady) window.__shotReady = true;
  } else {
    update(dt);
    renderer.render(scene, camera);
  }
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__game = { world, get state() { return state; } };
window.addEventListener('error', (event) => { window.__gameError = String(event.message || event.error); });
