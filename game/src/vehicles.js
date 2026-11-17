// Cars: the player's drivable car (arcade handling, handbrake, collisions)
// and the traffic that cruises the road graph, brakes for the car ahead and
// honks when it gets stuck.
import * as THREE from 'three';
import { CAR, CITY, clamp, angleLerp, dist2 } from './config.js';
import { createCar, randomCarColor } from './models.js';
import { collideCircle } from './city.js';

export function createVehicle(scene, { x, z, heading = 0, color, isPolice = false, traffic = false } = {}) {
  const mesh = createCar(color, isPolice);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  return {
    mesh,
    x, z, heading,
    speed: 0,
    isPolice,
    traffic,
    health: 100,
    stuckTime: 0,
    targetNode: null,
    // Traffic state: which graph node it is driving to.
    node: null,
    // The car the player drives is flagged by main.js; traffic cars steer
    // themselves, police cars are steered by police.js.
    update(dt, world) {
      if (this.traffic) this.updateTraffic(dt, world);
      this.mesh.position.set(this.x, 0, this.z);
      this.mesh.rotation.y = this.heading;
      for (const wheel of this.mesh.userData.wheels) wheel.rotation.x += this.speed * dt * 1.4;
    },
    updateTraffic(dt, world) {
      if (!this.node) {
        this.node = world.city.nearestNode(this.x, this.z);
        this.targetNode = pickNext(world, this.node);
      }
      const tx = this.targetNode.x;
      const tz = this.targetNode.z;
      const dx = tx - this.x;
      const dz = tz - this.z;
      const d = Math.hypot(dx, dz);
      if (d < 4) {
        this.node = this.targetNode;
        this.targetNode = pickNext(world, this.node);
        return;
      }
      const want = Math.atan2(dx, dz);
      this.heading = angleLerp(this.heading, want, Math.min(1, dt * 2.2));
      // Brake for a slow car right ahead.
      let targetSpeed = 10;
      for (const other of world.cars) {
        if (other === this) continue;
        const ox = other.x - this.x;
        const oz = other.z - this.z;
        const ahead = ox * Math.sin(this.heading) + oz * Math.cos(this.heading);
        const side = Math.abs(ox * Math.cos(this.heading) - oz * Math.sin(this.heading));
        if (ahead > 0 && ahead < 9 && side < 2.6) { targetSpeed = 0; break; }
      }
      this.speed += clamp(targetSpeed - this.speed, -14 * dt, 8 * dt);
      const nx = this.x + Math.sin(this.heading) * this.speed * dt;
      const nz = this.z + Math.cos(this.heading) * this.speed * dt;
      const oldX = this.x;
      const oldZ = this.z;
      this.x = nx;
      this.z = nz;
      if (collideCircle(world.city.solids, this, CAR.radius)) {
        this.x = oldX;
        this.z = oldZ;
        this.speed = 0;
        this.targetNode = pickNext(world, this.node);
      }
      this.x = clamp(this.x, -CITY.half - 4, CITY.half + 4);
      this.z = clamp(this.z, -CITY.half - 4, CITY.half + 4);
    },
    // Arcade driving for the car the player sits in.
    drive(dt, input, world) {
      const fwd = input.state.forward;
      const back = input.state.back;
      if (fwd) this.speed += CAR.accel * dt;
      else if (back) {
        if (this.speed > 0.5) this.speed -= CAR.brake * dt;
        else this.speed -= CAR.reverseAccel * dt;
      } else {
        this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 10 * dt);
      }
      if (input.state.brake) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 40 * dt);
      this.speed = clamp(this.speed, -CAR.maxReverse, CAR.maxSpeed);
      const steer = (input.state.left ? 1 : 0) - (input.state.right ? 1 : 0);
      const steerFactor = clamp(Math.abs(this.speed) / 8, 0, 1);
      this.heading += steer * CAR.turnRate * steerFactor * Math.sign(this.speed) * dt;
      const nx = this.x + Math.sin(this.heading) * this.speed * dt;
      const nz = this.z + Math.cos(this.heading) * this.speed * dt;
      const oldX = this.x;
      const oldZ = this.z;
      this.x = nx;
      this.z = nz;
      if (collideCircle(world.city.solids, this, CAR.radius)) {
        if (Math.abs(this.speed) > 8) {
          world.onCrash(Math.abs(this.speed));
        }
        this.x = oldX;
        this.z = oldZ;
        this.speed *= -0.25;
      }
      this.x = clamp(this.x, -CITY.half - 4, CITY.half + 40);
      this.z = clamp(this.z, -CITY.half - 4, CITY.beachZ + 4);
      // Bumping traffic cars shoves them aside and slows both down.
      for (const other of world.cars) {
        if (other === this || other.traffic === false) continue;
        const d2 = dist2(this.x, this.z, other.x, other.z);
        if (d2 < 12.5 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = (3.6 - d) / 2;
          const ux = (other.x - this.x) / d;
          const uz = (other.z - this.z) / d;
          other.x += ux * push;
          other.z += uz * push;
          this.x -= ux * push * 0.5;
          this.z -= uz * push * 0.5;
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
}

function pickNext(world, node) {
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
    const car = createVehicle(scene, {
      x: node.x + world.random.range(-3, 3),
      z: node.z + world.random.range(-3, 3),
      heading,
      color: randomCarColor(world.random),
      traffic: true,
    });
    car.node = node;
    car.targetNode = next;
    cars.push(car);
  }
  return cars;
}
