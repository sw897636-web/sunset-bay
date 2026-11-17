// Screenshot staging behind ?shot=start|drive|chase|mission (with &seed=N).
// Each scene is the real game, not a mock: the world is built, a mission is
// running, and a small autopilot plays it forward for a few simulated
// seconds, so the frame is what a short game really looks like. The caller
// renders each frame and screenshots once window.__shotReady is set.
import { CITY } from './config.js';
import { createVehicle } from './vehicles.js';
import { animateWalk } from './models.js';

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Put the player in a car without the E key, for the driving scenes.
function putPlayerInCar(world, car) {
  world.playerCar = car;
  car.traffic = false;
  world.player.mesh.visible = false;
  world.player.x = car.x;
  world.player.z = car.z;
  world.player.heading = car.heading;
}

// Autopilot: hold W and steer the player's car toward the next road node.
function drivePilot(world) {
  return {
    update(dt) {
      const car = world.playerCar;
      if (!car) return;
      const aheadX = car.x + Math.sin(car.heading) * 24;
      const aheadZ = car.z + Math.cos(car.heading) * 24;
      const node = world.city.nearestNode(aheadX, aheadZ);
      const desired = Math.atan2(node.x - car.x, node.z - car.z);
      const diff = wrapAngle(desired - car.heading);
      world.input.hold('w');
      if (diff > 0.12) { world.input.hold('a'); world.input.release('d'); }
      else if (diff < -0.12) { world.input.hold('d'); world.input.release('a'); }
      else { world.input.release('a'); world.input.release('d'); }
    },
  };
}

// Two cop cars pinned in the oncoming lane just ahead of the player, so
// the chase is always in frame (the camera looks forward from behind the
// car). A free-driving cop would cut corners into the blocks on a turn.
function stageChaseCops(world) {
  const car = world.playerCar;
  const cops = [];
  for (const ahead of [26, 40]) {
    const cop = createVehicle(world.scene, {
      x: car.x - 7, z: car.z + ahead, heading: Math.PI, isPolice: true,
    });
    cop.traffic = false;
    cop.speed = 15;
    world.cars.push(cop);
    cops.push(cop);
  }
  return {
    update(dt) {
      const car = world.playerCar;
      // Pin the cops in the oncoming lane just ahead of the player: a
      // fixed offset along the road keeps the chase in frame even through
      // a turn, where a free-driving cop would end up inside a block.
      cops.forEach((cop, i) => {
        const dist = i === 0 ? 15 : 24;
        const fx = Math.sin(car.heading);
        const fz = Math.cos(car.heading);
        const rx = -Math.cos(car.heading);
        const rz = Math.sin(car.heading);
        cop.x = car.x + fx * dist + rx * 7;
        cop.z = car.z + fz * dist + rz * 7;
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
    if (!car.traffic && !car.isPolice && !car.isGold) return car;
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
  const roadX = -CITY.half + CITY.roadWidth / 2 + 4 * CITY.pitch;
  const roadZ = -CITY.half + CITY.roadWidth / 2 + 2 * CITY.pitch;

  if (name === 'chase') {
    const car = pickParkedCar(world);
    car.x = roadX + 3.5;
    car.z = roadZ;
    car.heading = 0;
    car.speed = 0;
    putPlayerInCar(world, car);
    world.missions.start(3);           // The Corner Job: a getaway in progress
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
    const px = -CITY.half + 30;
    const pz = CITY.half + 22;
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
            animateWalk(world.player.mesh, world.player.walkPhase, 1);
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
  putPlayerInCar(world, car);
  world.missions.interact(true); // the theft that starts Job 1
  return { pilot: drivePilot(world), state: 'playing', readyAfter: 5 };
}
