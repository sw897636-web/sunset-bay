// Sunset Bay — boot, the one loop, the screens, the camera and the hero.
// The world itself lives in the other modules: city.js builds the streets,
// vehicles.js drives the cars, police.js runs the heat, missions.js tells
// the story. ?seed=N fixes the city. ?shot=start|drive|chase|mission
// stages a screenshot scene and sets window.__shotReady when it is framed.
import * as THREE from 'three';
import { WORLD, HERO, AUTO, SAVE_KEY, clampNum, turnToward, distSq } from './config.js';
import { makeDice } from './random.js';
import { createSound } from './audio.js';
import { createControls } from './input.js';
import { buildCity, collideCircle } from './city.js';
import { buildPerson, walkCycle } from './models.js';
import { makeVehicle, spawnTraffic } from './vehicles.js';
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
const dice = makeDice(seed);

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

const city = buildCity(dice);
scene.add(city.group);

const sound = createSound();
const input = createControls(canvas);
const hud = createHud();

// ---------- the hero ----------
const heroMesh = buildPerson({ jacket: 0xff7a2e, pants: 0x2e3a5c, skin: 0xe8b98a, hair: 0x1c1210 });
scene.add(heroMesh);
const garageSpot = city.landmarks.garage;
const hero = {
  mesh: heroMesh,
  x: garageSpot.x + 4, z: garageSpot.z - 18,
  heading: 0,
  health: HERO.vitality,
  cash: 0,
  hasPistol: false,
  weaponOut: false,
  ammo: 12,
  walkPhase: 0,
  punchAnim: 0,
  moving: false,
};
heroMesh.position.set(hero.x, 0, hero.z);

// ---------- world: the shared handle every module works through ----------
const world = {
  scene, city, random: dice, input, audio: sound, hud,
  player: hero, time: 0,
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
    // A long ram is one crash, not sixty a second.
    if (world.time - (world.lastCrash || -9) < 0.35) return;
    world.lastCrash = world.time;
    sound.crash();
    if (speed > 8) hero.health = Math.max(0, hero.health - (speed - 8) * 0.4);
  },
  onBusted() {
    if (screen !== 'playing') return;
    sound.busted();
    endGame('BUSTED', 'The Bay City Police finally caught up with you. The job is blown — but Mara still has work, if you are willing to try again.');
  },
  onStoryDone() {
    screen = 'done';
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
const goldSedan = makeVehicle(scene, {
  x: city.landmarks.marina.x, z: city.landmarks.marina.z - 6,
  heading: Math.PI / 2, color: 0xffd700,
});
goldSedan.isGold = true;
goldSedan.traffic = false;
world.cars.push(goldSedan);
world.goldCar = goldSedan;

// Parked cars the hero can steal, dotted along the streets.
const parkedPaints = [0xd83a3a, 0x3a7bd8, 0xe8c33a, 0x3ad8a0, 0xf2f2f2, 0xb03ad8];
for (let i = 0; i < 6; i += 1) {
  const node = city.randomNode();
  const parked = makeVehicle(scene, {
    x: node.x + dice.between(-4, 4), z: node.z + dice.between(-4, 4),
    heading: dice.between(0, Math.PI * 2),
    color: parkedPaints[i],
  });
  parked.traffic = false;
  world.cars.push(parked);
}

// ---------- camera ----------
let camYaw = 0;
let camPitch = 0.32;
let lastDragAt = -10;
let orbit = 0;

function updateCamera(dt) {
  const focus = world.playerCar
    ? { x: world.playerCar.x, z: world.playerCar.z, y: 1.6 }
    : { x: hero.x, z: hero.z, y: 1.6 };
  const drag = input.consumeDrag();
  if (drag.x !== 0 || drag.y !== 0) {
    camYaw -= drag.x * 0.005;
    camPitch = clampNum(camPitch + drag.y * 0.003, 0.08, 0.9);
    lastDragAt = world.time;
  }
  if (screen === 'title') {
    orbit += dt * 0.05;
    camera.position.set(Math.sin(orbit) * 90, 55, Math.cos(orbit) * 90);
    camera.lookAt(0, 8, 0);
    return;
  }
  // Driving with no recent drag: ease the camera in behind the car.
  if (world.playerCar && world.time - lastDragAt > 2.5) {
    camYaw = turnToward(camYaw, world.playerCar.heading, Math.min(1, dt * 1.4));
  }
  const dist = world.playerCar ? 13 : 9;
  const height = world.playerCar ? 5.2 : 4.2;
  const cx = focus.x - Math.sin(camYaw) * Math.cos(camPitch) * dist;
  const cz = focus.z - Math.cos(camYaw) * Math.cos(camPitch) * dist;
  const cy = focus.y + Math.sin(camPitch) * dist + height * 0.4;
  camera.position.set(cx, cy, cz);
  camera.lookAt(focus.x, focus.y + 0.8, focus.z);
}

// ---------- getting in and out of cars ----------
function nearestCar(maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of world.cars) {
    if (car === world.playerCar) continue;
    const d2 = distSq(hero.x, hero.z, car.x, car.z);
    if (d2 < bestD) { bestD = d2; best = car; }
  }
  return best;
}

function getIn(car) {
  world.playerCar = car;
  car.traffic = false;
  heroMesh.visible = false;
  hero.x = car.x;
  hero.z = car.z;
  hero.heading = car.heading;
  camYaw = car.heading;
  sound.enterCar();
}

function getOut() {
  const car = world.playerCar;
  if (!car) return;
  world.playerCar = null;
  car.speed = 0;
  hero.x = car.x + Math.cos(car.heading) * 2.4;
  hero.z = car.z - Math.sin(car.heading) * 2.4;
  hero.heading = car.heading;
  heroMesh.visible = true;
  heroMesh.position.set(hero.x, 0, hero.z);
}

// ---------- save and load ----------
function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: hero.cash,
      health: hero.health,
      completedMissions: world.completedMissions,
      hasPistol: hero.hasPistol,
      x: hero.x, z: hero.z,
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
  hero.cash = save.cash || 0;
  hero.health = save.health || HERO.vitality;
  hero.hasPistol = !!save.hasPistol;
  hero.ammo = 12;
  world.completedMissions = save.completedMissions || 0;
  if (typeof save.x === 'number') { hero.x = save.x; hero.z = save.z; }
  heroMesh.position.set(hero.x, 0, hero.z);
}

// ---------- screens ----------
let screen = 'title';
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
    hero.cash = 0;
    hero.health = HERO.vitality;
    hero.hasPistol = false;
    hero.ammo = 12;
    world.completedMissions = 0;
    hero.x = garageSpot.x + 4;
    hero.z = garageSpot.z - 18;
    heroMesh.position.set(hero.x, 0, hero.z);
    world.police.clearAll();
    world.missions.reset();
  }
  showMenu(null);
  hud.show();
  screen = 'playing';
  sound.unlock();
  if (world.completedMissions < world.missions.totalMissions) {
    world.missions.start(world.completedMissions);
  } else {
    world.setMissionText('', 'Free roam — the Bay is yours.', '');
  }
}
function endGame(title, reason) {
  screen = 'end';
  document.getElementById('endTitle').textContent = title;
  document.getElementById('endReason').textContent = reason;
  showMenu('menuEnd');
  hud.hide();
  world.police.clearAll();
  if (world.playerCar) getOut();
  hero.health = HERO.vitality;
}

document.getElementById('btnNew').addEventListener('click', () => startGame(false));
document.getElementById('btnContinue').addEventListener('click', () => startGame(true));
document.getElementById('btnResume').addEventListener('click', () => {
  showMenu(null); hud.show(); screen = 'playing';
});
document.getElementById('btnSave').addEventListener('click', () => {
  saveGame();
  hud.toast('Game saved.');
});
document.getElementById('btnQuit').addEventListener('click', () => {
  saveGame();
  screen = 'title';
  showMenu('menuTitle');
  hud.hide();
});
document.getElementById('btnRetry').addEventListener('click', () => {
  if (world.missions.failed) world.missions.retry();
  else world.missions.start(world.completedMissions);
  showMenu(null); hud.show(); screen = 'playing';
  hero.health = HERO.vitality;
});
document.getElementById('btnFreeRoam').addEventListener('click', () => {
  world.missions.reset();
  world.setMissionText('', 'Free roam — the Bay is yours.', '');
  showMenu(null); hud.show(); screen = 'playing';
  hero.health = HERO.vitality;
});
document.getElementById('btnTitle2').addEventListener('click', () => {
  screen = 'title';
  showMenu('menuTitle');
  hud.hide();
});
document.getElementById('btnKeepPlaying').addEventListener('click', () => {
  screen = 'playing';
  showMenu(null);
  hud.show();
});
// Continue is only meaningful with a save on disk.
document.getElementById('btnContinue').disabled = !loadSave();

// The first gesture unlocks audio (browsers demand it).
window.addEventListener('pointerdown', () => sound.unlock(), { once: true });
window.addEventListener('keydown', () => sound.unlock(), { once: true });

// ---------- per-frame update ----------
function updateHeroOnFoot(dt) {
  const fwd = (input.state.forward ? 1 : 0) - (input.state.back ? 1 : 0);
  const strafe = (input.state.right ? 1 : 0) - (input.state.left ? 1 : 0);
  const fx = Math.sin(camYaw);
  const fz = Math.cos(camYaw);
  const rx = -Math.cos(camYaw);
  const rz = Math.sin(camYaw);
  let mx = fx * fwd + rx * strafe;
  let mz = fz * fwd + rz * strafe;
  const len = Math.hypot(mx, mz);
  hero.moving = len > 0.01;
  if (hero.moving) {
    mx /= len;
    mz /= len;
    const pace = input.state.run ? HERO.sprint : HERO.stroll;
    hero.x += mx * pace * dt;
    hero.z += mz * pace * dt;
    hero.heading = Math.atan2(mx, mz);
    hero.walkPhase += dt * pace * 1.6;
    walkCycle(heroMesh, hero.walkPhase, 1);
  } else {
    walkCycle(heroMesh, hero.walkPhase, 0);
  }
  // Collisions: buildings, city bounds, and a soft push from cars.
  collideCircle(city.solids, hero, HERO.girth);
  hero.x = clampNum(hero.x, -WORLD.edge - 4, WORLD.edge + 4);
  hero.z = clampNum(hero.z, -WORLD.edge - 4, WORLD.sand + 4);
  for (const car of world.cars) {
    const d2 = distSq(hero.x, hero.z, car.x, car.z);
    if (d2 < 3.2 * 3.2 && d2 > 0.01) {
      const d = Math.sqrt(d2);
      hero.x = car.x + ((hero.x - car.x) / d) * 3.2;
      hero.z = car.z + ((hero.z - car.z) / d) * 3.2;
      if (Math.abs(car.speed) > 8) {
        hero.health -= 25;
        world.police.addWanted(1);
        world.police.commitCrime(hero.x, hero.z);
        sound.crash();
      }
    }
  }
  heroMesh.position.set(hero.x, heroMesh.position.y, hero.z);
  heroMesh.rotation.y = hero.heading;
  if (hero.punchAnim > 0) {
    hero.punchAnim -= dt;
    heroMesh.userData.limbs.rightArm.rotation.x = -1.4 * Math.max(0, hero.punchAnim / 0.25);
  }
}

function update(dt) {
  world.time += dt;
  if (screen === 'title') {
    // A living backdrop behind the title screen.
    for (const car of world.cars) if (car.traffic) car.update(dt, world);
    for (const ped of world.peds) ped.update(dt, world);
    updateCamera(dt);
    return;
  }
  if (screen !== 'playing') return;

  // Global keys.
  if (input.wasPressed('p') || input.wasPressed('escape')) {
    screen = 'paused';
    showMenu('menuPause');
    hud.hide();
    return;
  }
  if (input.wasPressed('m')) sound.setMuted(!sound.isMuted());
  if (input.wasPressed('t')) { saveGame(); hud.toast('Game saved.'); }
  if (input.wasPressed('q') && hero.hasPistol) {
    hero.weaponOut = !hero.weaponOut;
    hud.toast(hero.weaponOut ? 'Pistol drawn.' : 'Pistol holstered.');
  }
  if (input.wasPressed('r')) world.combat.reload();
  if (input.wasPressed('enter') && world.missions.failed) world.missions.retry();

  if (world.playerCar) {
    world.playerCar.drive(dt, input, world);
    hero.x = world.playerCar.x;
    hero.z = world.playerCar.z;
    hero.heading = world.playerCar.heading;
    if (input.wasPressed('e')) getOut();
  } else {
    updateHeroOnFoot(dt);
    if (input.wasPressed('f')) world.combat.punch();
    if (hero.weaponOut && input.wasClicked()) world.combat.shoot();
    // Hold E on a job's interact objective.
    if (input.isHeld('e')) world.missions.holdingInteract(dt);
    if (input.wasPressed('e')) {
      const car = nearestCar(4.5);
      if (car) {
        // Get in first: the job's enter-the-gold-sedan step checks the car
        // the hero is sitting in, so it can only pass once seated.
        getIn(car);
        if (world.missions.active) world.missions.interact(true);
        if (!car.isGold) world.police.addWanted(1);
      }
    }
  }

  // Prompts: what E would do right now.
  if (!world.playerCar) {
    const car = nearestCar(4.5);
    const marker = world.missions.marker();
    if (car) hud.setPrompt('Press E — steal the car');
    else if (marker && distSq(hero.x, hero.z, marker.x, marker.z) < 64) hud.setPrompt('Hold E — work the job');
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
  if (world.police.wanted === 0 && hero.health > 0 && hero.health < HERO.vitality) {
    hero.health = Math.min(HERO.vitality, hero.health + 1.5 * dt);
  }
  if (hero.health <= 0) {
    hero.health = 0;
    endGame('WASTED', 'You went down in the streets of Sunset Bay. Mara will wait — she always does. Retry the job or take the city at your own pace.');
    return;
  }
  sound.update(world.playerCar ? Math.abs(world.playerCar.speed) / AUTO.top : 0, world.police.wanted);
  hud.update(world, dt);
  updateCamera(dt);
}

// ---------- screenshot staging ----------
let shotPilot = null;
let shotTime = 0;
let simSeconds = 0;
let stagedReadyAfter = 2;
if (shotName) {
  const staged = stageShot(world, shotName, { startGame, showMenu, hud });
  shotPilot = staged.pilot;
  screen = staged.state;
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
window.__game = { world, get state() { return screen; } };
window.addEventListener('error', (event) => { window.__gameError = String(event.message || event.error); });
