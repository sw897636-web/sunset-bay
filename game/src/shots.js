// Screenshot staging behind ?shot=start|drive|chase|mission (with &seed=N).
// Each scene is the real game, not a mock: the world is built, a job is
// running, and a small autopilot plays it forward for a few simulated
// seconds, so the frame is what a short game really looks like. The caller
// renders each frame and screenshots once window.__shotReady is set.
import { WORLD } from './config.js';
import { makeVehicle } from './vehicles.js';
import { walkCycle } from './models.js';

function foldAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Put the hero in a car without the E key, for the driving scenes.
function seatHero(world, car) {
  world.playerCar = car;
  car.traffic = false;
  world.player.mesh.visible = false;
  world.player.x = car.x;
  world.player.z = car.z;
  world.player.heading = car.heading;
}

// Autopilot: hold W and keep the hero's car centred on its road, driving
// straight down it. The road grid is axis-aligned, so the pilot snaps the
// car's starting heading to the nearest cardinal direction and steers
// against the sideways drift off the road's centre line. (Steering at the
// nearest intersection instead would turn the car across blocks and into
// buildings.)
function roadCentre(coord) {
  const first = -WORLD.edge + WORLD.street / 2;
  const i = Math.max(0, Math.min(WORLD.blocksPerSide, Math.round((coord - first) / WORLD.step)));
  return first + i * WORLD.step;
}

function drivePilot(world) {
  const car = world.playerCar;
  const snapped = Math.round(car.heading / (Math.PI / 2)) * (Math.PI / 2);
  const base = snapped > Math.PI ? snapped - Math.PI * 2 : snapped;
  const alongZ = Math.abs(Math.sin(base)) < 0.5;
  return {
    update(dt) {
      const car = world.playerCar;
      if (!car) return;
      let desired = base;
      if (alongZ) {
        const centre = roadCentre(car.x);
        desired = base - Math.cos(base) * (car.x - centre) * 0.03;
      } else {
        const centre = roadCentre(car.z);
        desired = base + Math.sin(base) * (car.z - centre) * 0.03;
      }
      const diff = foldAngle(desired - car.heading);
      world.input.hold('w');
      if (diff > 0.12) { world.input.hold('a'); world.input.release('d'); }
      else if (diff < -0.12) { world.input.hold('d'); world.input.release('a'); }
      else { world.input.release('a'); world.input.release('d'); }
    },
  };
}

// Two cop cars pinned in the oncoming lane just ahead of the hero, so the
// chase is always in frame (the camera looks forward from behind the car).
// A free-driving cop would cut corners into the blocks on a turn.
function stageChaseCops(world) {
  const car = world.playerCar;
  const cops = [];
  for (const ahead of [26, 40]) {
    const cop = makeVehicle(world.scene, {
      x: car.x - 7, z: car.z + ahead, heading: Math.PI, police: true,
    });
    cop.traffic = false;
    cop.speed = 15;
    world.cars.push(cop);
    cops.push(cop);
  }
  return {
    update(dt) {
      const car = world.playerCar;
      cops.forEach((cop, i) => {
        const gap = i === 0 ? 15 : 24;
        const fx = Math.sin(car.heading);
        const fz = Math.cos(car.heading);
        const rx = -Math.cos(car.heading);
        const rz = Math.sin(car.heading);
        cop.x = car.x + fx * gap + rx * 7;
        cop.z = car.z + fz * gap + rz * 7;
        cop.heading = car.heading + Math.PI;
        cop.speed = 15;
        cop.mesh.position.set(cop.x, 0, cop.z);
        cop.mesh.rotation.y = cop.heading;
        for (const wheel of cop.mesh.userData.wheels) wheel.rotation.x += cop.speed * dt * 1.4;
        if (cop.mesh.userData.lightBar) {
          cop.mesh.userData.lightBar.material.color.setHex(Math.floor(world.time * 4) % 2 === 0 ? 0xff2222 : 0x2266ff);
        }
      });
    },
  };
}

function pickParkedCar(world) {
  for (const car of world.cars) {
    if (!car.traffic && !car.police && !car.isGold) return car;
  }
  return world.cars[0];
}

export function stageShot(world, name, ui) {
  if (name === 'start') {
    // Title screen over the living city; the orbit camera is the shot.
    return { pilot: { update() {} }, state: 'title', readyAfter: 2 };
  }

  ui.startGame(false);
  // A north–south road near the middle of town, heading south into the sun.
  const roadX = -WORLD.edge + WORLD.street / 2 + 4 * WORLD.step;
  const roadZ = -WORLD.edge + WORLD.street / 2 + 2 * WORLD.step;

  if (name === 'chase') {
    const car = pickParkedCar(world);
    car.x = roadX + 3.5;
    car.z = roadZ;
    car.heading = 0;
    car.speed = 0;
    seatHero(world, car);
    world.missions.start(3); // The Corner Job: a getaway in progress
    world.police.setWanted(3);
    const cops = stageChaseCops(world);
    const drive = drivePilot(world);
    return {
      pilot: { update(dt) { drive.update(dt); cops.update(dt); } },
      state: 'playing',
      readyAfter: 8,
    };
  }

  if (name === 'mission') {
    // On foot at the pier, walking to the package for Job 2.
    world.missions.start(1);
    const px = -WORLD.edge + 30;
    const pz = WORLD.edge + 22;
    world.player.x = px;
    world.player.z = pz;
    world.player.heading = 0;
    world.player.mesh.position.set(px, 0, pz);
    const target = world.missions.marker();
    return {
      pilot: {
        update(dt) {
          if (!target) return;
          const dx = target.x - world.player.x;
          const dz = target.z - world.player.z;
          const d = Math.hypot(dx, dz);
          if (d > 4) {
            const step = 4.5 * dt;
            world.player.x += (dx / d) * step;
            world.player.z += (dz / d) * step;
            world.player.heading = Math.atan2(dx, dz);
            world.player.walkPhase += dt * 8;
            walkCycle(world.player.mesh, world.player.walkPhase, 1);
            world.player.mesh.position.set(world.player.x, 0, world.player.z);
            world.player.mesh.rotation.y = world.player.heading;
          }
        },
      },
      state: 'playing',
      readyAfter: 5,
    };
  }

  // Default: 'drive' — Job 1, already in a stolen car, cruising downtown.
  const car = pickParkedCar(world);
  car.x = roadX + 3.5;
  car.z = roadZ;
  car.heading = 0;
  car.speed = 0;
  seatHero(world, car);
  world.missions.interact(true); // the theft that starts Job 1
  return { pilot: drivePilot(world), state: 'playing', readyAfter: 5 };
}
