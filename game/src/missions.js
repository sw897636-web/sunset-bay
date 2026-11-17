// The story: five jobs for Mara, the fixer who runs Sunset Bay out of her
// garage. Each job is a short chain of objectives — go here, get in a car,
// pick this up, shake the cops — with a cash reward at the end. The
// manager owns the beacon, the timer and the handoff to the next job.
import { buildBeacon } from './models.js';
import { WORLD, distSq } from './config.js';

export function createMissions(scene, world) {
  const spots = world.city.landmarks;
  const beacon = buildBeacon(0xffd23c);
  beacon.visible = false;
  scene.add(beacon);

  const jobs = [
    {
      id: 'first-wheels',
      title: 'Job 1 — First Wheels',
      briefing: 'Mara needs wheels. Take any car off the street and bring it round to her garage.',
      reward: 200,
      objectives: [
        { kind: 'enterCar', label: 'Steal any car — walk up to one and press E' },
        { kind: 'driveTo', x: spots.garage.x, z: spots.garage.z, label: "Drive to Mara's Garage", radius: 10 },
      ],
    },
    {
      id: 'sunset-run',
      title: 'Job 2 — The Sunset Run',
      briefing: 'A package waits at the end of the pier. Grab it, then run it to Sunset Tower before the buyer walks away.',
      reward: 400,
      onComplete(w) { w.player.hasPistol = true; w.toast('Mara slipped you a pistol. Press Q to draw it.'); },
      objectives: [
        { kind: 'interact', x: -WORLD.edge + 30, z: WORLD.edge + 35, label: 'Pick up the package at the pier — press E', radius: 6, holdSeconds: 1 },
        { kind: 'timed', x: spots.tower.x, z: spots.tower.z, label: 'Deliver to Sunset Tower', radius: 12, timeLimit: 100 },
      ],
    },
    {
      id: 'the-pickup',
      title: 'Job 3 — The Pickup',
      briefing: 'Dana is waiting at the marina and the cops already know her face. Bring her to the garage — quietly, if you can.',
      reward: 600,
      objectives: [
        { kind: 'driveTo', x: spots.marina.x, z: spots.marina.z, label: 'Drive to the Sunset Marina', radius: 10 },
        { kind: 'interact', x: spots.marina.x, z: spots.marina.z, label: 'Pick up Dana — press E', radius: 7, holdSeconds: 1,
          onDone(w) { w.police.setWanted(2); w.toast('Dana is in. The cops are onto you — 2 stars!'); } },
        { kind: 'driveTo', x: spots.garage.x, z: spots.garage.z, label: "Get Dana to Mara's Garage", radius: 10 },
      ],
    },
    {
      id: 'corner-job',
      title: 'Job 4 — The Corner Job',
      briefing: 'The Coral Corner Store keeps its till in a drawer, not a safe. Walk in, take it, and be gone before the sirens find you.',
      reward: 900,
      objectives: [
        { kind: 'goto', x: spots.store.x, z: spots.store.z, label: 'Go to the Coral Corner Store', radius: 10 },
        { kind: 'interact', x: spots.store.x, z: spots.store.z, label: 'Hold E to empty the till', radius: 8, holdSeconds: 3,
          onDone(w) { w.police.setWanted(2); w.audio.horn(); } },
        { kind: 'driveTo', x: spots.garage.x, z: spots.garage.z, label: 'Lose the heat — get to the garage', radius: 10 },
      ],
    },
    {
      id: 'gold-sedan',
      title: 'Job 5 — The Gold Sedan',
      briefing: 'One last job: a gold sedan, parked at the marina, belongs to a man who collects debts. Take it, lose three stars of heat, and put it on Mara\'s boat.',
      reward: 1500,
      objectives: [
        { kind: 'goto', x: spots.marina.x, z: spots.marina.z, label: 'Go to the marina — the gold sedan is waiting', radius: 12 },
        { kind: 'enterGold', label: 'Steal the gold sedan — press E' },
        { kind: 'escape', x: spots.marina.x, z: spots.marina.z + 8, label: 'Put the sedan on the boat — lose the cops on the way', radius: 10 },
      ],
    },
  ];

  let index = -1; // -1: no job running (free roam)
  let step = 0;
  let timer = 0;
  let holdMade = 0;
  let gapTimer = 0; // breather between jobs
  let failed = false;

  function current() {
    if (index < 0 || index >= jobs.length) return null;
    return jobs[index];
  }
  function objective() {
    const job = current();
    if (!job) return null;
    return job.objectives[step] || null;
  }

  function moveBeacon() {
    const o = objective();
    if (!o || o.x === undefined) { beacon.visible = false; return; }
    beacon.visible = true;
    beacon.position.set(o.x, 0, o.z);
  }

  function start(i) {
    index = i;
    step = 0;
    timer = 0;
    holdMade = 0;
    failed = false;
    const job = current();
    world.toast(job.title);
    world.setMissionText(job.title, job.objectives[0].label, '');
    if (job.objectives[0].kind === 'timed') timer = job.objectives[0].timeLimit;
    moveBeacon();
  }

  function finishJob() {
    const job = current();
    world.player.cash += job.reward;
    world.completedMissions += 1;
    world.audio.missionDone();
    world.toast(`${job.title} — done! +$${job.reward}`);
    if (job.onComplete) job.onComplete(world);
    world.saveGame();
    if (index === jobs.length - 1) {
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
    gapTimer = 4;
    world.setMissionText('', 'Job done. Mara is lining up the next one…', '');
  }

  function failJob(reason) {
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
    get defs() { return jobs; },
    get totalMissions() { return jobs.length; },
    start,
    placeBeacon: moveBeacon,
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
    interact(nearCar) {
      if (!this.active) return false;
      const o = objective();
      if (!o) return false;
      if (o.kind === 'enterCar' && nearCar) { step += 1; moveBeacon(); return true; }
      if (o.kind === 'enterGold' && nearCar && world.playerCar && world.playerCar.isGold) {
        world.police.setWanted(3);
        world.toast('The gold sedan is yours — and now the whole city knows. 3 stars!');
        step += 1; moveBeacon(); return true;
      }
      return false;
    },
    // True while the player holds E on an interact objective.
    holdingInteract(dt) {
      const o = objective();
      if (!this.active || !o || o.kind !== 'interact') return false;
      if (distSq(world.player.x, world.player.z, o.x, o.z) > o.radius * o.radius) {
        holdMade = 0;
        return false;
      }
      holdMade += dt;
      world.setMissionText(current().title, `${o.label} (${Math.ceil(o.holdSeconds - holdMade)}…)`, '');
      if (holdMade >= o.holdSeconds) {
        holdMade = 0;
        if (o.onDone) o.onDone(world);
        step += 1;
        moveBeacon();
      }
      return true;
    },
    update(dt) {
      // Spin the beacon diamond.
      if (beacon.visible) {
        beacon.userData.gem.rotation.y += dt * 2;
        beacon.userData.gem.position.y = 5.5 + Math.sin(world.time * 2) * 0.4;
      }
      if (failed) return;
      if (index === -1) {
        if (gapTimer > 0) {
          gapTimer -= dt;
          if (gapTimer <= 0) start(world.completedMissions);
        }
        return;
      }
      const job = current();
      const o = objective();
      if (!o) { finishJob(); return; }
      const hero = world.player;
      if (o.kind === 'goto' || o.kind === 'driveTo' || o.kind === 'timed' || o.kind === 'escape') {
        if (o.kind !== 'timed' && o.kind !== 'escape') world.setMissionText(job.title, o.label, '');
        if (o.kind === 'timed') {
          timer -= dt;
          world.setMissionText(job.title, o.label, `${Math.max(0, Math.ceil(timer))}s`);
          if (timer <= 0) { failJob('the buyer walked away'); return; }
        } else if (o.kind === 'escape') {
          const heat = world.police.wanted;
          world.setMissionText(job.title, o.label, heat > 0 ? `${heat}★ — lose them!` : 'Heat is off — get to the boat');
        }
        if (distSq(hero.x, hero.z, o.x, o.z) < o.radius * o.radius) {
          if (o.kind === 'driveTo' && !world.playerCar) {
            world.setMissionText(job.title, `${o.label} — you need a car!`, '');
            return;
          }
          if (o.kind === 'escape' && world.police.wanted > 0) {
            world.toast('Too hot — lose the cops first! Keep driving.');
            return;
          }
          step += 1;
          if (objective() && objective().kind === 'timed') timer = objective().timeLimit;
          moveBeacon();
          if (!objective()) finishJob();
        }
      } else if (o.kind === 'interact') {
        if (distSq(hero.x, hero.z, o.x, o.z) < o.radius * o.radius) {
          world.setMissionText(job.title, `${o.label} — hold E`, '');
        }
      } else if (o.kind === 'enterCar' || o.kind === 'enterGold') {
        world.setMissionText(job.title, o.label, '');
      }
    },
    retry() {
      if (!failed) return;
      start(index);
    },
    // Back to free roam (after busted / wasted).
    reset() {
      index = -1;
      step = 0;
      failed = false;
      gapTimer = 0;
      beacon.visible = false;
    },
  };
}
