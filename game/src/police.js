// The wanted system and the Bay City Police. Crimes raise stars; stars decide
// how many cop cars hunt you. Cop cars ram and pin you; foot cops chase you
// down on foot. Stay quiet and the heat fades, one star at a time.
import * as THREE from 'three';
import { POLICE, CITY, clamp, angleLerp, dist2 } from './config.js';
import { createVehicle } from './vehicles.js';
import { createPerson, animateWalk } from './models.js';
import { collideCircle } from './city.js';

export function createPolice(scene, world) {
  const cops = [];       // cop cars
  const footCops = [];   // foot cops
  let wanted = 0;
  let quietTime = 0;
  let bustTimer = 0;

  function desiredCars() {
    return wanted === 0 ? 0 : Math.min(wanted, 4);
  }

  function spawnCar() {
    // Appear on a road a little way off, so they drive in rather than pop up
    // on top of the player.
    const px = world.player.x;
    const pz = world.player.z;
    const node = world.city.randomNode();
    let tries = 0;
    let spawn = node;
    while (dist2(spawn.x, spawn.z, px, pz) < 60 * 60 && tries < 20) {
      spawn = world.city.randomNode();
      tries += 1;
    }
    const car = createVehicle(scene, {
      x: spawn.x, z: spawn.z, heading: 0, isPolice: true,
    });
    car.speed = 8;
    cops.push(car);
    world.cars.push(car);
  }

  function spawnFootCop() {
    const px = world.player.x;
    const pz = world.player.z;
    const mesh = createPerson({ jacket: 0x1c2f5e, pants: 0x1c2f5e, skin: 0xe8b98a, hair: 0x111111 });
    mesh.position.set(px + 18, 0, pz + 12);
    scene.add(mesh);
    footCops.push({ mesh, x: px + 18, z: pz + 12, heading: 0, phase: 0 });
  }

  function removeCop(car) {
    scene.remove(car.mesh);
    const i = world.cars.indexOf(car);
    if (i >= 0) world.cars.splice(i, 1);
  }

  return {
    get wanted() { return wanted; },
    setWanted(value) {
      const next = clamp(Math.round(value), 0, POLICE.maxWanted);
      if (next > wanted) quietTime = 0;
      wanted = next;
    },
    addWanted(amount) {
      this.setWanted(wanted + amount);
      quietTime = 0;
    },
    commitCrime(x, z) {
      for (const ped of world.peds) ped.scare(x, z);
    },
    clearAll() {
      for (const car of cops) removeCop(car);
      cops.length = 0;
      for (const cop of footCops) scene.remove(cop.mesh);
      footCops.length = 0;
      wanted = 0;
      bustTimer = 0;
      quietTime = 0;
    },
    update(dt, world) {
      // Fade the heat after a quiet spell.
      if (wanted > 0) {
        quietTime += dt;
        if (quietTime > POLICE.decaySeconds) {
          wanted -= 1;
          quietTime = 0;
        }
      }
      // Match the fleet to the wanted level.
      while (cops.length < desiredCars()) spawnCar();
      while (cops.length > desiredCars()) removeCop(cops[cops.length - 1]);
      while (footCops.length < (wanted >= 3 ? 2 : 0)) spawnFootCop();
      while (footCops.length > (wanted >= 3 ? 2 : 0)) scene.remove(footCops.pop().mesh);

      const player = world.player;
      const inCar = !!world.playerCar;
      // Cop cars chase the player, ramming on contact.
      for (const car of cops) {
        const dx = player.x - car.x;
        const dz = player.z - car.z;
        const d = Math.hypot(dx, dz);
        const want = Math.atan2(dx, dz);
        car.heading = angleLerp(car.heading, want, Math.min(1, dt * 2.6));
        const targetSpeed = d > 60 ? POLICE.copCarSpeed : POLICE.copCarSpeed * 0.8;
        car.speed += clamp(targetSpeed - car.speed, -20 * dt, 14 * dt);
        const nx = car.x + Math.sin(car.heading) * car.speed * dt;
        const nz = car.z + Math.cos(car.heading) * car.speed * dt;
        const ox = car.x;
        const oz = car.z;
        car.x = nx;
        car.z = nz;
        if (collideCircle(world.city.solids, car, 1.6)) {
          // Blocked by a building: swing around it instead of grinding.
          car.x = ox;
          car.z = oz;
          car.heading += 0.9 * dt * 3;
          car.speed *= 0.6;
        }
        car.mesh.position.set(car.x, 0, car.z);
        car.mesh.rotation.y = car.heading;
        for (const wheel of car.mesh.userData.wheels) wheel.rotation.x += car.speed * dt * 1.4;
        if (car.mesh.userData.lightBar) {
          car.mesh.userData.lightBar.material.color.setHex(Math.floor(world.time * 4) % 2 === 0 ? 0xff2222 : 0x2266ff);
        }
        // Ram the player's car or knock the player down.
        if (inCar && world.playerCar) {
          const dd = dist2(car.x, car.z, world.playerCar.x, world.playerCar.z);
          if (dd < 13) {
            world.playerCar.speed *= 0.82;
            world.player.health -= 6 * dt;
            world.onCrash(6);
            const push = 3.2;
            const ux = (world.playerCar.x - car.x) / (Math.sqrt(dd) || 1);
            const uz = (world.playerCar.z - car.z) / (Math.sqrt(dd) || 1);
            world.playerCar.x += ux * push * dt * 4;
            world.playerCar.z += uz * push * dt * 4;
          }
        } else if (d < 2.4) {
          bustTimer += dt;
          if (bustTimer > POLICE.bustSeconds) world.onBusted();
        }
      }
      // Foot cops run the player down on foot.
      for (const cop of footCops) {
        const dx = player.x - cop.x;
        const dz = player.z - cop.z;
        const d = Math.hypot(dx, dz);
        const want = Math.atan2(dx, dz);
        cop.heading = angleLerp(cop.heading, want, Math.min(1, dt * 3));
        const speed = d > 3 ? POLICE.footCopSpeed : 0;
        cop.x += Math.sin(cop.heading) * speed * dt;
        cop.z += Math.cos(cop.heading) * speed * dt;
        if (collideCircle(world.city.solids, cop, 0.55)) {
          cop.x -= Math.sin(cop.heading) * speed * dt;
          cop.z -= Math.cos(cop.heading) * speed * dt;
        }
        cop.phase += dt * speed * 2;
        animateWalk(cop.mesh, cop.phase, 1);
        cop.mesh.position.set(cop.x, cop.mesh.position.y, cop.z);
        cop.mesh.rotation.y = cop.heading;
        if (d < 1.8) {
          player.health -= 14 * dt;
          bustTimer += dt * 0.7;
          if (bustTimer > POLICE.bustSeconds) world.onBusted();
        }
      }
      // Pinned slowly by a car while on foot also builds the bust.
      if (!inCar && wanted > 0) {
        let pinned = false;
        for (const car of cops) {
          if (dist2(car.x, car.z, player.x, player.z) < 16 && car.speed < 4) pinned = true;
        }
        if (pinned) bustTimer += dt;
        else bustTimer = Math.max(0, bustTimer - dt * 2);
      } else if (inCar) {
        bustTimer = Math.max(0, bustTimer - dt * 2);
      }
      return { bustTimer };
    },
  };
}
