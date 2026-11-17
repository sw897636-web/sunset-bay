// On-foot combat: fists and a pistol. Punching is quiet-ish, shooting is
// loud and the whole street notices. Hits are hitscan against pedestrians,
// foot cops and cars; a tracer line shows where the shot went.
import * as THREE from 'three';
import { PLAYER, dist2 } from './config.js';

export function createCombat(scene, world) {
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
  let tracer = null;
  let tracerLife = 0;
  let punchCooldown = 0;
  let shootCooldown = 0;
  let reloadTimer = 0;

  function showTracer(from, to) {
    if (tracer) scene.remove(tracer);
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    tracer = new THREE.Line(geo, tracerMat);
    scene.add(tracer);
    tracerLife = 0.08;
  }

  function nearestTarget(x, z, dirX, dirZ, maxDist, includePeds) {
    // The closest thing roughly in front of the shot.
    let best = null;
    let bestD = maxDist;
    const consider = (tx, tz, obj) => {
      const dx = tx - x;
      const dz = tz - z;
      const d = Math.hypot(dx, dz);
      if (d > bestD || d < 0.5) return;
      const dot = (dx * dirX + dz * dirZ) / d;
      if (dot < 0.86) return;
      bestD = d;
      best = { obj, d };
    };
    if (includePeds) for (const ped of world.peds) if (!ped.down) consider(ped.x, ped.z, ped);
    for (const car of world.cars) consider(car.x, car.z, car);
    return best;
  }

  return {
    get ammo() { return world.player.ammo; },
    get reloading() { return reloadTimer > 0; },
    update(dt) {
      punchCooldown = Math.max(0, punchCooldown - dt);
      shootCooldown = Math.max(0, shootCooldown - dt);
      if (reloadTimer > 0) {
        reloadTimer -= dt;
        if (reloadTimer <= 0) {
          world.player.ammo = 12;
          world.audio.pickup();
        }
      }
      if (tracer) {
        tracerLife -= dt;
        if (tracerLife <= 0) {
          scene.remove(tracer);
          tracer = null;
        }
      }
    },
    punch() {
      if (punchCooldown > 0) return;
      punchCooldown = 0.45;
      const p = world.player;
      const dirX = Math.sin(p.heading);
      const dirZ = Math.cos(p.heading);
      world.audio.punch();
      // Swing the arm for feedback.
      p.punchAnim = 0.25;
      let hitAnything = false;
      for (const ped of world.peds) {
        if (ped.down) continue;
        const d2 = dist2(p.x, p.z, ped.x, ped.z);
        if (d2 < PLAYER.punchRange * PLAYER.punchRange) {
          ped.knockDown();
          hitAnything = true;
          world.police.addWanted(1);
          world.police.commitCrime(p.x, p.z);
          world.toast('You decked a pedestrian. The street saw that.');
        }
      }
      if (!hitAnything) {
        // Whiff: still a little noise, no crime.
      }
    },
    shoot() {
      if (shootCooldown > 0 || reloadTimer > 0) return;
      const p = world.player;
      if (!p.hasPistol) {
        world.toast('No pistol yet — finish the Sunset Run to earn one.');
        shootCooldown = 0.4;
        return;
      }
      if (p.ammo <= 0) {
        world.toast('Magazine empty — press R to reload.');
        shootCooldown = 0.4;
        return;
      }
      shootCooldown = 0.28;
      p.ammo -= 1;
      const dirX = Math.sin(p.heading);
      const dirZ = Math.cos(p.heading);
      const from = new THREE.Vector3(p.x, 1.5, p.z);
      const target = nearestTarget(p.x, p.z, dirX, dirZ, 70, true);
      const end = target
        ? new THREE.Vector3(target.obj.x, 1.2, target.obj.z)
        : new THREE.Vector3(p.x + dirX * 70, 1.5, p.z + dirZ * 70);
      showTracer(from, end);
      world.audio.shoot();
      world.police.addWanted(2);
      world.police.commitCrime(p.x, p.z);
      if (target) {
        if (target.obj.health !== undefined && target.obj.mesh) {
          // A car: damage it until it smokes and stalls.
          target.obj.health -= 34;
          if (target.obj.health <= 0) {
            target.obj.speed = 0;
            target.obj.traffic = false;
            world.toast('You disabled that car.');
          }
        } else if (target.obj.knockDown) {
          target.obj.knockDown();
          world.toast('Target down.');
        }
      }
    },
    reload() {
      const p = world.player;
      if (!p.hasPistol || p.ammo === 12 || reloadTimer > 0) return;
      reloadTimer = 1.1;
      world.toast('Reloading…');
    },
  };
}
