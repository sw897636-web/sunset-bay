// Pedestrians: they stroll the sidewalks, cross at corners, and run when
// a crime happens nearby. Knocking one down is a crime, and the police
// notice — the street has eyes.
import { WORLD, clampNum, distSq } from './config.js';
import { buildPerson, walkCycle } from './models.js';

const COATS = [0x3a7bd8, 0xe8c33a, 0xd83a7b, 0x3ad8a0, 0x8a5fbf, 0xf2f2f2, 0x5a6b7a, 0xff9a5c];
const SKINS = [0xe8b98a, 0xc98d5f, 0x8a5a3b, 0xf0c8a0];
const HAIR = [0x2a1c12, 0x111111, 0x6a4a2a, 0x999999];

export function makePedestrian(scene, world, x, z) {
  const mesh = buildPerson({
    jacket: COATS[Math.floor(world.random.next() * COATS.length)],
    pants: 0x2e3a5c,
    skin: SKINS[Math.floor(world.random.next() * SKINS.length)],
    hair: HAIR[Math.floor(world.random.next() * HAIR.length)],
  });
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  const ped = {
    mesh, x, z,
    heading: world.random.between(0, Math.PI * 2),
    speed: world.random.between(1.2, 2.2),
    stride: world.random.between(0, 6),
    target: null,
    fleeing: 0,
    down: false,
    downTimer: 0,
    pickTarget() {
      const node = world.city.randomNode();
      // Walk to a nearby corner, then pick another one.
      this.target = { x: node.x + world.random.between(-6, 6), z: node.z + world.random.between(-6, 6) };
    },
    scare(fromX, fromZ) {
      if (distSq(this.x, this.z, fromX, fromZ) < 900) {
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
      this.heading += clampNum(diff, -2.4 * dt, 2.4 * dt);
      const pace = this.fleeing > 0 ? 5.5 : this.speed;
      this.x += Math.sin(this.heading) * pace * dt;
      this.z += Math.cos(this.heading) * pace * dt;
      this.x = clampNum(this.x, -WORLD.edge, WORLD.edge);
      this.z = clampNum(this.z, -WORLD.edge, WORLD.sand);
      this.stride += dt * pace * 2.2;
      walkCycle(this.mesh, this.stride, this.fleeing > 0 ? 1 : 0.7);
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
    peds.push(makePedestrian(scene, world,
      node.x + world.random.between(-20, 20),
      node.z + world.random.between(-20, 20)));
  }
  return peds;
}
