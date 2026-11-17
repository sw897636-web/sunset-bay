// The story: five jobs for Mara, the fixer who runs Sunset Bay from her
// garage. Each mission is a short chain of objectives — go here, get in a
// car, pick this up, lose the cops — with a cash reward at the end. The
// manager owns the beacon, the timer and the handoff to the next job.
import * as THREE from 'three';
import { createBeacon } from './models.js';
import { CITY, dist2 } from './config.js';

export function createMissions(scene, world) {
  const L = world.city.landmarks;
  const beacon = createBeacon(0xffd23c);
  beacon.visible = false;
  scene.add(beacon);

  const defs = [
    {
      id: 'first-wheels',
      title: 'Job 1 — First Wheels',
      briefing: 'Mara needs wheels. Steal any car on the street, then bring it to her garage.',
      reward: 200,
      objectives: [
        { kind: 'enterCar', label: 'Steal any car — walk up to one and press E' },
        { kind: 'driveTo', x: L.garage.x, z: L.garage.z, label: "Drive to Mara's Garage", radius: 10 },
      ],
    },
    {
      id: 'sunset-run',
      title: 'Job 2 — The Sunset Run',
      briefing: 'A package is waiting at the end of the pier. Grab it, then get it to Sunset Tower before the buyer walks.',
      reward: 400,
      onComplete(w) { w.player.hasPistol = true; w.toast('Mara slipped you a pistol. Press Q to draw it.'); },
      objectives: [
        { kind: 'interact', x: -CITY.half + 30, z: CITY.half + 35, label: 'Pick up the package at the pier — press E', radius: 6, holdSeconds: 1 },
        { kind: 'timed', x: L.tower.x, z: L.tower.z, label: 'Deliver to Sunset Tower', radius: 12, timeLimit: 100 },
      ],
    },
    {
      id: 'the-pickup',
      title: 'Job 3 — The Pickup',
      briefing: 'Dana is waiting at the marina and the cops already know her face. Bring her to the garage — quietly, if you can.',
      reward: 600,
      objectives: [
        { kind: 'driveTo', x: L.marina.x, z: L.marina.z, label: 'Drive to the Sunset Marina', radius: 10 },
        { kind: 'interact', x: L.marina.x, z: L.marina.z, label: 'Pick up Dana — press E', radius: 7, holdSeconds: 1,
          onDone(w) { w.police.setWanted(2); w.toast('Dana is in. The cops are onto you — 2 stars!'); } },
        { kind: 'driveTo', x: L.garage.x, z: L.garage.z, label: "Get Dana to Mara's Garage", radius: 10 },
      ],
    },
    {
      id: 'corner-job',
      title: 'Job 4 — The Corner Job',
      briefing: 'The Coral Corner Store keeps its till in a drawer, not a safe. Walk in, take it, and be gone before the sirens find you.',
      reward: 900,
      objectives: [
        { kind: 'goto', x: L.store.x, z: L.store.z, label: 'Go to the Coral Corner Store', radius: 10 },
        { kind: 'interact', x: L.store.x, z: L.store.z, label: 'Hold E to empty the till', radius: 8, holdSeconds: 3,
          onDone(w) { w.police.setWanted(2); w.audio.horn(); } },
        { kind: 'driveTo', x: L.garage.x, z: L.garage.z, label: 'Lose the heat — get to the garage', radius: 10 },
      ],
    },
    {
      id: 'gold-sedan',
      title: 'Job 5 — The Gold Sedan',
      briefing: 'One last job: a gold sedan, parked at the marina, belongs to a man who collects debts. Take it, lose three stars of heat, and put it on Mara\'s boat.',
      reward: 1500,
      objectives: [
        { kind: 'goto', x: L.marina.x, z: L.marina.z, label: 'Go to the marina — the gold sedan is waiting', radius: 12 },
        { kind: 'enterGold', label: 'Steal the gold sedan — press E' },
        { kind: 'escape', x: L.marina.x, z: L.marina.z + 8, label: 'Put the sedan on the boat — lose the cops on the way', radius: 10 },
      ],
    },
  ];

  let index = -1;          // -1: no mission running (free roam)
  let step = 0;
  let timer = 0;
  let holdProgress = 0;
  let betweenTimer = 0;    // pause between missions
  let failed = false;

  function current() {
    if (index < 0 || index >= defs.length) return null;
    return defs[index];
  }
  function objective() {
    const m = current();
    if (!m) return null;
    return m.objectives[step] || null;
  }

  function placeBeacon() {
    const o = objective();
    if (!o || o.x === undefined) { beacon.visible = false; return; }
    beacon.visible = true;
    beacon.position.set(o.x, 0, o.z);
  }

  function start(i) {
    index = i;
    step = 0;
    timer = 0;
    holdProgress = 0;
    failed = false;
    const m = current();
    world.toast(m.title);
    world.setMissionText(m.title, m.objectives[0].label, '');
    if (m.objectives[0].kind === 'timed') timer = m.objectives[0].timeLimit;
    placeBeacon();
  }

  function completeMission() {
    const m = current();
    world.player.cash += m.reward;
    world.completedMissions += 1;
    world.audio.missionDone();
    world.toast(`${m.title} — done! +$${m.reward}`);
    if (m.onComplete) m.onComplete(world);
    world.saveGame();
    if (index === defs.length - 1) {
      world.onStoryDone();
      index = -1;
      step = 0;
      beacon.visible = false;
      world.setMissionText('', 'Story complete — free roam. The Bay is yours.', '');
      return;
    }
    index = -1;
    step = 0;
    beacon.visible = false;
    betweenTimer = 4;
    world.setMissionText('', 'Job done. Mara is lining up the next one…', '');
  }

  function failMission(reason) {
    failed = true;
    world.audio.missionFail();
    world.toast(`Job failed — ${reason}. Press Enter to retry.`);
    world.setMissionText(current().title, `Failed: ${reason}. Press Enter to retry.`, '');
    beacon.visible = false;
  }

  return {
    get index() { return index; },
    get active() { return index >= 0 && !failed; },
    get failed() { return failed; },
    get defs() { return defs; },
    get totalMissions() { return defs.length; },
    start,
    placeBeacon,
    // Where the HUD arrow and minimap should point, or null.
    marker() {
      const o = objective();
      if (!o || o.x === undefined || failed) return null;
      return { x: o.x, z: o.z };
    },
    objectiveLabel() {
      const o = objective();
      return o ? o.label : '';
    },
    // Called when the player presses E near a car or a marker.
    interact(isNearCar) {
      if (!this.active) return false;
      const o = objective();
      if (!o) return false;
      if (o.kind === 'enterCar' && isNearCar) { step += 1; placeBeacon(); return true; }
      if (o.kind === 'enterGold' && isNearCar && world.playerCar && world.playerCar.isGold) {
        world.police.setWanted(3);
        world.toast('The gold sedan is yours — and now the whole city knows. 3 stars!');
        step += 1; placeBeacon(); return true;
      }
      return false;
    },
    // True while the player is holding E on an interact objective.
    holdingInteract(dt) {
      const o = objective();
      if (!this.active || !o || o.kind !== 'interact') return false;
      const d2 = dist2(world.player.x, world.player.z, o.x, o.z);
      if (d2 > o.radius * o.radius) { holdProgress = 0; return false; }
      holdProgress += dt;
      world.setMissionText(current().title, `${o.label} (${Math.ceil(o.holdSeconds - holdProgress)}…)`, '');
      if (holdProgress >= o.holdSeconds) {
        holdProgress = 0;
        if (o.onDone) o.onDone(world);
        step += 1;
        placeBeacon();
      }
      return true;
    },
    update(dt) {
      // Spin the beacon diamond.
      if (beacon.visible) {
        beacon.userData.diamond.rotation.y += dt * 2;
        beacon.userData.diamond.position.y = 5.5 + Math.sin(world.time * 2) * 0.4;
      }
      if (failed) return;
      if (index === -1) {
        if (betweenTimer > 0) {
          betweenTimer -= dt;
          if (betweenTimer <= 0) start(world.completedMissions);
        }
        return;
      }
      const m = current();
      const o = objective();
      if (!o) { completeMission(); return; }
      const p = world.player;
      if (o.kind === 'goto' || o.kind === 'driveTo' || o.kind === 'timed' || o.kind === 'escape') {
        if (o.kind !== 'timed' && o.kind !== 'escape') world.setMissionText(m.title, o.label, '');
        const d2 = dist2(p.x, p.z, o.x, o.z);
        if (o.kind === 'timed') {
          timer -= dt;
          world.setMissionText(m.title, o.label, `${Math.max(0, Math.ceil(timer))}s`);
          if (timer <= 0) { failMission('the buyer walked away'); return; }
        } else if (o.kind === 'escape') {
          const w = world.police.wanted;
          world.setMissionText(m.title, o.label, w > 0 ? `${w}★ — lose them!` : 'Heat is off — get to the boat');
        }
        if (d2 < o.radius * o.radius) {
          if (o.kind === 'driveTo' && !world.playerCar) {
            world.setMissionText(m.title, `${o.label} — you need a car!`, '');
            return;
          }
          if (o.kind === 'escape' && world.police.wanted > 0) {
            world.toast('Too hot — lose the cops first! Keep driving.');
            return;
          }
          step += 1;
          if (objective() && objective().kind === 'timed') timer = objective().timeLimit;
          placeBeacon();
          if (!objective()) completeMission();
        }
      } else if (o.kind === 'interact') {
        const d2 = dist2(p.x, p.z, o.x, o.z);
        if (d2 < o.radius * o.radius) {
          world.setMissionText(m.title, `${o.label} — hold E`, '');
        }
      } else if (o.kind === 'enterCar' || o.kind === 'enterGold') {
        world.setMissionText(m.title, o.label, '');
      }
    },
    retry() {
      if (!failed) return;
      start(index);
    },
    // Reset to free roam (after busted / wasted).
    reset() {
      index = -1;
      step = 0;
      failed = false;
      betweenTimer = 0;
      beacon.visible = false;
    },
  };
}
