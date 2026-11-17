// On-foot combat: fists and a pistol. Punching is quiet-ish, shooting is
// loud and the whole street notices. Shots are hitscan against pedestrians,
// beat cops and cars; a tracer line shows where the shot went.
import * as THREE from 'three';
import { HERO, distSq } from './config.js';

export function createCombat(scene, world) {
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
  let tracer = null;
  let tracerLife = 0;
  let fistWait = 0;
  let shotWait = 0;
  let reloadLeft = 0;

  function drawTracer(from, to) {
    if (tracer) scene.remove(tracer);
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    tracer = new THREE.Line(geo, tracerMat);
    scene.add(tracer);
    tracerLife = 0.08;
  }

  function pickTarget(x, z, dirX, dirZ, maxDist, includePeds) {
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
    get reloading() { return reloadLeft > 0; },
    update(dt) {
      fistWait = Math.max(0, fistWait - dt);
      shotWait = Math.max(0, shotWait - dt);
      if (reloadLeft > 0) {
        reloadLeft -= dt;
        if (reloadLeft <= 0) {
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
      if (fistWait > 0) return;
      fistWait = 0.45;
      const hero = world.player;
      world.audio.punch();
      // Swing the arm for feedback.
      hero.punchAnim = 0.25;
      let landed = false;
      for (const ped of world.peds) {
        if (ped.down) continue;
        if (distSq(hero.x, hero.z, ped.x, ped.z) < HERO.reach * HERO.reach) {
          ped.knockDown();
          landed = true;
          world.police.addWanted(1);
          world.police.commitCrime(hero.x, hero.z);
          world.toast('You decked a pedestrian. The street saw that.');
        }
      }
      if (!landed) {
        // A whiff: a little noise, no crime.
      }
    },
    shoot() {
      if (shotWait > 0 || reloadLeft > 0) return;
      const hero = world.player;
      if (!hero.hasPistol) {
        world.toast('No pistol yet — finish the Sunset Run to earn one.');
        shotWait = 0.4;
        return;
      }
      if (hero.ammo <= 0) {
        world.toast('Magazine empty — press R to reload.');
        shotWait = 0.4;
        return;
      }
      shotWait = 0.28;
      hero.ammo -= 1;
      const dirX = Math.sin(hero.heading);
      const dirZ = Math.cos(hero.heading);
      const from = new THREE.Vector3(hero.x, 1.5, hero.z);
      const hit = pickTarget(hero.x, hero.z, dirX, dirZ, 70, true);
      const end = hit
        ? new THREE.Vector3(hit.obj.x, 1.2, hit.obj.z)
        : new THREE.Vector3(hero.x + dirX * 70, 1.5, hero.z + dirZ * 70);
      drawTracer(from, end);
      world.audio.shoot();
      world.police.addWanted(2);
      world.police.commitCrime(hero.x, hero.z);
      if (hit) {
        if (hit.obj.health !== undefined && hit.obj.mesh) {
          // A car: damage it until it smokes and stalls.
          hit.obj.health -= 34;
          if (hit.obj.health <= 0) {
            hit.obj.speed = 0;
            hit.obj.traffic = false;
            world.toast('You disabled that car.');
          }
        } else if (hit.obj.knockDown) {
          hit.obj.knockDown();
          world.toast('Target down.');
        }
      }
    },
    reload() {
      const hero = world.player;
      if (!hero.hasPistol || hero.ammo === 12 || reloadLeft > 0) return;
      reloadLeft = 1.1;
      world.toast('Reloading…');
    },
  };
}
