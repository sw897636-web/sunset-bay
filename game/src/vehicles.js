// Cars: the one the player drives (arcade handling, handbrake, collisions)
// and the traffic that cruises the road graph, brakes for the car ahead
// and gets shoved aside when the player barges through.
import * as THREE from 'three';
import { AUTO, WORLD, clampNum, turnToward, distSq } from './config.js';
import { buildCar, pickCarPaint } from './models.js';
import { collideCircle } from './city.js';

export function makeVehicle(scene, { x, z, heading = 0, color, police = false, traffic = false } = {}) {
  const mesh = buildCar(color, police);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  const car = {
    mesh,
    x, z, heading,
    speed: 0,
    police,
    traffic,
    health: 100,
    stuckTime: 0,
    node: null,
    targetNode: null,
    // Traffic cars steer themselves; police cars are steered by police.js;
    // the player's car is driven by drive() below.
    update(dt, world) {
      if (this.traffic) this.cruise(dt, world);
      this.mesh.position.set(this.x, 0, this.z);
      this.mesh.rotation.y = this.heading;
      for (const wheel of this.mesh.userData.wheels) wheel.rotation.x += this.speed * dt * 1.4;
    },
    cruise(dt, world) {
      if (!this.node) {
        this.node = world.city.nearestNode(this.x, this.z);
        this.targetNode = chooseNext(world, this.node);
      }
      const dx = this.targetNode.x - this.x;
      const dz = this.targetNode.z - this.z;
      const d = Math.hypot(dx, dz);
      if (d < 4) {
        this.node = this.targetNode;
        this.targetNode = chooseNext(world, this.node);
        return;
      }
      const want = Math.atan2(dx, dz);
      this.heading = turnToward(this.heading, want, Math.min(1, dt * 2.2));
      // Brake for a slow car right ahead.
      let cruiseSpeed = 10;
      for (const other of world.cars) {
        if (other === this) continue;
        const ox = other.x - this.x;
        const oz = other.z - this.z;
        const ahead = ox * Math.sin(this.heading) + oz * Math.cos(this.heading);
        const side = Math.abs(ox * Math.cos(this.heading) - oz * Math.sin(this.heading));
        if (ahead > 0 && ahead < 9 && side < 2.6) { cruiseSpeed = 0; break; }
      }
      this.speed += clampNum(cruiseSpeed - this.speed, -14 * dt, 8 * dt);
      const oldX = this.x;
      const oldZ = this.z;
      this.x += Math.sin(this.heading) * this.speed * dt;
      this.z += Math.cos(this.heading) * this.speed * dt;
      if (collideCircle(world.city.solids, this, AUTO.girth)) {
        this.x = oldX;
        this.z = oldZ;
        this.speed = 0;
        this.targetNode = chooseNext(world, this.node);
      }
      this.x = clampNum(this.x, -WORLD.edge - 4, WORLD.edge + 4);
      this.z = clampNum(this.z, -WORLD.edge - 4, WORLD.edge + 4);
    },
    // Arcade driving for the car the player sits in.
    drive(dt, input, world) {
      const fwd = input.state.forward;
      const back = input.state.back;
      if (fwd) this.speed += AUTO.push * dt;
      else if (back) {
        if (this.speed > 0.5) this.speed -= AUTO.stop * dt;
        else this.speed -= AUTO.backPush * dt;
      } else {
        this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 10 * dt);
      }
      if (input.state.brake) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 40 * dt);
      this.speed = clampNum(this.speed, -AUTO.topBack, AUTO.top);
      const steer = (input.state.left ? 1 : 0) - (input.state.right ? 1 : 0);
      const grip = clampNum(Math.abs(this.speed) / 8, 0, 1);
      this.heading += steer * AUTO.steer * grip * Math.sign(this.speed) * dt;
      const oldX = this.x;
      const oldZ = this.z;
      this.x += Math.sin(this.heading) * this.speed * dt;
      this.z += Math.cos(this.heading) * this.speed * dt;
      if (collideCircle(world.city.solids, this, AUTO.girth)) {
        if (Math.abs(this.speed) > 8) world.onCrash(Math.abs(this.speed));
        this.x = oldX;
        this.z = oldZ;
        this.speed *= -0.25;
      }
      this.x = clampNum(this.x, -WORLD.edge - 4, WORLD.edge + 4);
      this.z = clampNum(this.z, -WORLD.edge - 4, WORLD.sand + 4);
      // Bumping traffic cars shoves them aside and slows both down.
      for (const other of world.cars) {
        if (other === this || other.traffic === false) continue;
        const d2 = distSq(this.x, this.z, other.x, other.z);
        if (d2 < 12.5 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const shove = (3.6 - d) / 2;
          const ux = (other.x - this.x) / d;
          const uz = (other.z - this.z) / d;
          other.x += ux * shove;
          other.z += uz * shove;
          this.x -= ux * shove * 0.5;
          this.z -= uz * shove * 0.5;
          if (Math.abs(this.speed) > 6) {
            other.speed = Math.max(other.speed, this.speed * 0.4);
            this.speed *= 0.7;
            world.onCrash(Math.abs(this.speed));
          }
        }
      }
      this.mesh.position.set(this.x, 0, this.z);
      this.mesh.rotation.y = this.heading;
      for (const wheel of this.mesh.userData.wheels) wheel.rotation.x += this.speed * dt * 1.4;
    },
  };
  return car;
}

function chooseNext(world, node) {
  const options = world.city.neighbours(node);
  if (options.length === 0) return node;
  return options[Math.floor(world.random.next() * options.length)];
}

export function spawnTraffic(scene, world, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const node = world.city.randomNode();
    const next = world.city.neighbours(node)[0] || node;
    const heading = Math.atan2(next.x - node.x, next.z - node.z);
    const car = makeVehicle(scene, {
      x: node.x + world.random.between(-3, 3),
      z: node.z + world.random.between(-3, 3),
      heading,
      color: pickCarPaint(world.random),
      traffic: true,
    });
    car.node = node;
    car.targetNode = next;
    cars.push(car);
  }
  return cars;
}
