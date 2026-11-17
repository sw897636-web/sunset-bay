// Pedestrians: they stroll the sidewalks, cross at corners, and run away
// screaming (well, fleeing) when a crime happens nearby. Knocking one down
// is a crime, and the police notice.
import * as THREE from 'three';
import { CITY, clamp, dist2 } from './config.js';
import { createPerson, animateWalk } from './models.js';

const JACKETS = [0x3a7bd8, 0xe8c33a, 0xd83a7b, 0x3ad8a0, 0x8a5fbf, 0xf2f2f2, 0x5a6b7a, 0xff9a5c];

export function createPedestrian(scene, world, x, z) {
  const mesh = createPerson({
    jacket: JACKETS[Math.floor(world.random.next() * JACKETS.length)],
    pants: 0x2e3a5c,
    skin: [0xe8b98a, 0xc98d5f, 0x8a5a3b, 0xf0c8a0][Math.floor(world.random.next() * 4)],
    hair: [0x2a1c12, 0x111111, 0x6a4a2a, 0x999999][Math.floor(world.random.next() * 4)],
  });
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  const ped = {
    mesh, x, z,
    heading: world.random.range(0, Math.PI * 2),
    speed: world.random.range(1.2, 2.2),
    walkPhase: world.random.range(0, 6),
    target: null,
    fleeing: 0,
    down: false,
    downTimer: 0,
    pickTarget() {
      const node = world.city.randomNode();
      // Walk to a nearby corner, then pick another.
      this.target = { x: node.x + world.random.range(-6, 6), z: node.z + world.random.range(-6, 6) };
    },
    scare(fromX, fromZ) {
      const d2 = dist2(this.x, this.z, fromX, fromZ);
      if (d2 < 900) {
        this.fleeing = 4;
        this.heading = Math.atan2(this.x - fromX, this.z - fromZ);
      }
    },
    update(dt, world) {
      if (this.down) {
        this.downTimer -= dt;
        this.mesh.rotation.x = -Math.PI / 2;
        if (this.downTimer <= 0) {
          this.down = false;
          this.mesh.rotation.x = 0;
          this.mesh.position.y = 0;
          this.fleeing = 5;
        }
        return;
      }
      if (this.fleeing > 0) this.fleeing -= dt;
      if (!this.target) this.pickTarget();
      const dx = this.target.x - this.x;
      const dz = this.target.z - this.z;
      const d = Math.hypot(dx, dz);
      if (d < 2) { this.pickTarget(); return; }
      const want = Math.atan2(dx, dz);
      let diff = want - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += clamp(diff, -2.4 * dt, 2.4 * dt);
      const speed = this.fleeing > 0 ? 5.5 : this.speed;
      this.x += Math.sin(this.heading) * speed * dt;
      this.z += Math.cos(this.heading) * speed * dt;
      this.x = clamp(this.x, -CITY.half, CITY.half);
      this.z = clamp(this.z, -CITY.half, CITY.beachZ);
      this.walkPhase += dt * speed * 2.2;
      animateWalk(this.mesh, this.walkPhase, this.fleeing > 0 ? 1 : 0.7);
      this.mesh.position.set(this.x, this.mesh.position.y, this.z);
      this.mesh.rotation.y = this.heading;
    },
    knockDown() {
      this.down = true;
      this.downTimer = 6;
    },
  };
  ped.pickTarget();
  return ped;
}

export function spawnPedestrians(scene, world, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const node = world.city.randomNode();
    peds.push(createPedestrian(scene, world,
      node.x + world.random.range(-20, 20),
      node.z + world.random.range(-20, 20)));
  }
  return peds;
}
