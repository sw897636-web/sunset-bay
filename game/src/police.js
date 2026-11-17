// The wanted system and the Bay City Police. Crimes raise stars; stars
// decide how many cop cars hunt you. Cop cars ram and pin you; foot cops
// chase you down on foot. Stay quiet and the heat fades, one star at a time.
import { COPS, WORLD, clampNum, turnToward, distSq } from './config.js';
import { makeVehicle } from './vehicles.js';
import { buildPerson, walkCycle } from './models.js';
import { collideCircle } from './city.js';

export function createPolice(scene, world) {
  const cruisers = []; // cop cars
  const beatCops = []; // foot cops
  let stars = 0;
  let quietFor = 0;
  let pinTime = 0;

  function wantedCars() {
    return stars === 0 ? 0 : Math.min(stars, 4);
  }

  function sendCruiser() {
    // Appear on a road a little way off, so they drive in rather than pop
    // up on top of the player.
    const px = world.player.x;
    const pz = world.player.z;
    let spot = world.city.randomNode();
    let tries = 0;
    while (distSq(spot.x, spot.z, px, pz) < 60 * 60 && tries < 20) {
      spot = world.city.randomNode();
      tries += 1;
    }
    const car = makeVehicle(scene, { x: spot.x, z: spot.z, heading: 0, police: true });
    car.speed = 8;
    cruisers.push(car);
    world.cars.push(car);
  }

  function sendBeatCop() {
    const px = world.player.x;
    const pz = world.player.z;
    const mesh = buildPerson({ jacket: 0x1c2f5e, pants: 0x1c2f5e, skin: 0xe8b98a, hair: 0x111111 });
    mesh.position.set(px + 18, 0, pz + 12);
    scene.add(mesh);
    beatCops.push({ mesh, x: px + 18, z: pz + 12, heading: 0, phase: 0 });
  }

  function retireCruiser(car) {
    scene.remove(car.mesh);
    const i = world.cars.indexOf(car);
    if (i >= 0) world.cars.splice(i, 1);
  }

  return {
    get wanted() { return stars; },
    setWanted(value) {
      const next = clampNum(Math.round(value), 0, COPS.stars);
      if (next > stars) quietFor = 0;
      stars = next;
    },
    addWanted(amount) {
      this.setWanted(stars + amount);
      quietFor = 0;
    },
    commitCrime(x, z) {
      for (const ped of world.peds) ped.scare(x, z);
    },
    clearAll() {
      for (const car of cruisers) retireCruiser(car);
      cruisers.length = 0;
      for (const cop of beatCops) scene.remove(cop.mesh);
      beatCops.length = 0;
      stars = 0;
      pinTime = 0;
      quietFor = 0;
    },
    update(dt, world) {
      // Fade the heat after a quiet spell.
      if (stars > 0) {
        quietFor += dt;
        if (quietFor > COPS.coolOff) {
          stars -= 1;
          quietFor = 0;
        }
      }
      // Match the fleet to the wanted level.
      while (cruisers.length < wantedCars()) sendCruiser();
      while (cruisers.length > wantedCars()) retireCruiser(cruisers[cruisers.length - 1]);
      const beatCount = stars >= 3 ? 2 : 0;
      while (beatCops.length < beatCount) sendBeatCop();
      while (beatCops.length > beatCount) scene.remove(beatCops.pop().mesh);

      const hero = world.player;
      const driving = !!world.playerCar;
      // Cruisers chase the player and ram on contact.
      for (const car of cruisers) {
        const dx = hero.x - car.x;
        const dz = hero.z - car.z;
        const d = Math.hypot(dx, dz);
        const want = Math.atan2(dx, dz);
        car.heading = turnToward(car.heading, want, Math.min(1, dt * 2.6));
        const chaseSpeed = d > 60 ? COPS.chase : COPS.chase * 0.8;
        car.speed += clampNum(chaseSpeed - car.speed, -20 * dt, 14 * dt);
        const oldX = car.x;
        const oldZ = car.z;
        car.x += Math.sin(car.heading) * car.speed * dt;
        car.z += Math.cos(car.heading) * car.speed * dt;
        if (collideCircle(world.city.solids, car, 1.6)) {
          // Blocked by a building: swing around it instead of grinding.
          car.x = oldX;
          car.z = oldZ;
          car.heading += 0.9 * dt * 3;
          car.speed *= 0.6;
        }
        car.mesh.position.set(car.x, 0, car.z);
        car.mesh.rotation.y = car.heading;
        for (const wheel of car.mesh.userData.wheels) wheel.rotation.x += car.speed * dt * 1.4;
        if (car.mesh.userData.lightBar) {
          car.mesh.userData.lightBar.material.color.setHex(Math.floor(world.time * 4) % 2 === 0 ? 0xff2222 : 0x2266ff);
        }
        // Ram the hero's car, or pin the hero on foot.
        if (driving && world.playerCar) {
          const dd = distSq(car.x, car.z, world.playerCar.x, world.playerCar.z);
          if (dd < 13) {
            world.playerCar.speed *= 0.82;
            world.player.health -= 6 * dt;
            world.onCrash(6);
            const reach = Math.sqrt(dd) || 1;
            const ux = (world.playerCar.x - car.x) / reach;
            const uz = (world.playerCar.z - car.z) / reach;
            world.playerCar.x += ux * 3.2 * dt * 4;
            world.playerCar.z += uz * 3.2 * dt * 4;
          }
        } else if (d < 2.4) {
          pinTime += dt;
          if (pinTime > COPS.pinTime) world.onBusted();
        }
      }
      // Beat cops run the hero down on foot.
      for (const cop of beatCops) {
        const dx = hero.x - cop.x;
        const dz = hero.z - cop.z;
        const d = Math.hypot(dx, dz);
        const want = Math.atan2(dx, dz);
        cop.heading = turnToward(cop.heading, want, Math.min(1, dt * 3));
        const pace = d > 3 ? COPS.foot : 0;
        cop.x += Math.sin(cop.heading) * pace * dt;
        cop.z += Math.cos(cop.heading) * pace * dt;
        if (collideCircle(world.city.solids, cop, 0.55)) {
          cop.x -= Math.sin(cop.heading) * pace * dt;
          cop.z -= Math.cos(cop.heading) * pace * dt;
        }
        cop.phase += dt * pace * 2;
        walkCycle(cop.mesh, cop.phase, 1);
        cop.mesh.position.set(cop.x, cop.mesh.position.y, cop.z);
        cop.mesh.rotation.y = cop.heading;
        if (d < 1.8) {
          hero.health -= 14 * dt;
          pinTime += dt * 0.7;
          if (pinTime > COPS.pinTime) world.onBusted();
        }
      }
      // Pinned slowly by a car while on foot also builds the bust.
      if (!driving && stars > 0) {
        let pinned = false;
        for (const car of cruisers) {
          if (distSq(car.x, car.z, hero.x, hero.z) < 16 && car.speed < 4) pinned = true;
        }
        if (pinned) pinTime += dt;
        else pinTime = Math.max(0, pinTime - dt * 2);
      } else if (driving) {
        pinTime = Math.max(0, pinTime - dt * 2);
      }
      return { pinTime };
    },
  };
}
