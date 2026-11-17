// Sunset Bay itself: a procedural coastal city made of boxes, planes and
// a canvas window texture. It also owns the road graph (every crossing and
// the streets between them) that traffic, police and the job autopilot
// drive on, and the list of solid boxes everything bumps into.
import * as THREE from 'three';
import { WORLD } from './config.js';

const WALL_TINTS = [0xffb36b, 0xffe08a, 0xff8fa3, 0x7fd4c1, 0x8ecae6, 0xf4a261, 0xe07a5f, 0x90be6d, 0xf9c74f, 0x577590];
const ROOF_TINTS = [0x3d405b, 0x6d6875, 0x8d99ae, 0x2b2d42];

function windowsTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  // A pale base so the pastel wall colour survives the multiply; windows
  // read as dark glass, a few of them warmly lit.
  g.fillStyle = '#dfe3ee';
  g.fillRect(0, 0, 128, 256);
  for (let y = 10; y < 246; y += 22) {
    for (let x = 10; x < 118; x += 20) {
      const lit = Math.random() < 0.45;
      g.fillStyle = lit ? '#ffd98a' : '#33415e';
      g.fillRect(x, y, 12, 14);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function sunTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 240, 200, 1)');
  grad.addColorStop(0.35, 'rgba(255, 180, 90, 0.9)');
  grad.addColorStop(1, 'rgba(255, 120, 60, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

export function buildCity(dice) {
  const group = new THREE.Group();
  const solids = []; // building footprints: { minX, maxX, minZ, maxZ }
  const glassTex = windowsTexture();
  const unitBox = new THREE.BoxGeometry(1, 1, 1);

  // Ground: warm scrub under everything, big enough to hide the horizon.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.edge * 2 + 420, WORLD.edge * 2 + 420),
    new THREE.MeshLambertMaterial({ color: 0x9aa06b }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 40);
  group.add(ground);

  // Streets: one dark plane per street line, a pale sidewalk strip beside
  // each, and dashed centre lines down the middle.
  const asphalt = new THREE.MeshLambertMaterial({ color: 0x2e2e38 });
  const pavement = new THREE.MeshLambertMaterial({ color: 0x8a8a92 });
  const paint = new THREE.MeshBasicMaterial({ color: 0xd8c25a });
  const dashes = [];
  for (let i = 0; i <= WORLD.blocksPerSide; i += 1) {
    const centre = -WORLD.edge + WORLD.street / 2 + i * WORLD.step;
    for (const across of [true, false]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.edge * 2 + WORLD.street, WORLD.street), asphalt);
      strip.rotation.x = -Math.PI / 2;
      if (across) {
        strip.position.set(0, 0.01, centre);
      } else {
        strip.rotation.z = Math.PI / 2;
        strip.position.set(centre, 0.01, 0);
      }
      group.add(strip);
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.edge * 2 + WORLD.street, 3), pavement);
      walk.rotation.x = -Math.PI / 2;
      if (across) {
        walk.position.set(0, 0.02, centre + WORLD.street / 2 + 1.5);
      } else {
        walk.rotation.z = Math.PI / 2;
        walk.position.set(centre + WORLD.street / 2 + 1.5, 0.02, 0);
      }
      group.add(walk);
      for (let d = -WORLD.edge; d < WORLD.edge; d += 12) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.5), paint);
        dash.rotation.x = -Math.PI / 2;
        if (across) {
          dash.position.set(d, 0.03, centre);
        } else {
          dash.rotation.z = Math.PI / 2;
          dash.position.set(centre, 0.03, d);
        }
        dashes.push(dash);
      }
    }
  }
  for (const dash of dashes) group.add(dash);

  // Sand and sea on the south edge (+z), with a wooden pier at the west end.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.edge * 2 + 200, 30),
    new THREE.MeshLambertMaterial({ color: 0xe8cf9a }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, WORLD.edge + 15);
  group.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.edge * 2 + 400, 200),
    new THREE.MeshLambertMaterial({ color: 0x2a6f8f }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.08, WORLD.sea);
  group.add(sea);
  const plankMat = new THREE.MeshLambertMaterial({ color: 0x8a6b4a });
  for (let z = WORLD.edge + 8; z < WORLD.edge + 62; z += 3) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(10, 0.4, 2.6), plankMat);
    plank.position.set(-WORLD.edge + 30, 0.6, z);
    group.add(plank);
  }
  for (const railX of [-WORLD.edge + 25.5, -WORLD.edge + 34.5]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.1, 54), plankMat);
    rail.position.set(railX, 1.1, WORLD.edge + 35);
    group.add(rail);
  }

  // Buildings: one or two per block, sunset pastel walls with the lit-window
  // texture, flat roofs with a darker cap. A few blocks hold the story's
  // fixed spots, named as landmarks.
  const landmarks = {};
  for (let bx = 0; bx < WORLD.blocksPerSide; bx += 1) {
    for (let bz = 0; bz < WORLD.blocksPerSide; bz += 1) {
      const centreX = -WORLD.edge + WORLD.street + WORLD.block / 2 + bx * WORLD.step;
      const centreZ = -WORLD.edge + WORLD.street + WORLD.block / 2 + bz * WORLD.step;
      const howMany = dice.maybe(0.3) ? 1 : 2;
      for (let k = 0; k < howMany; k += 1) {
        const w = dice.between(14, 24);
        const d = dice.between(14, 24);
        const h = dice.maybe(0.16) ? dice.between(30, 52) : dice.between(8, 26);
        const ox = howMany === 1 ? 0 : (k === 0 ? -9 : 9);
        const oz = howMany === 1 ? 0 : (k === 0 ? -8 : 9);
        const x = centreX + ox;
        const z = centreZ + oz;
        const tint = dice.choose(WALL_TINTS);
        const tex = glassTex.clone();
        tex.needsUpdate = true;
        tex.repeat.set(Math.max(1, Math.round(w / 10)), Math.max(1, Math.round(h / 12)));
        const tower = new THREE.Mesh(unitBox, new THREE.MeshLambertMaterial({ color: tint, map: tex }));
        tower.scale.set(w, h, d);
        tower.position.set(x, h / 2, z);
        group.add(tower);
        const cap = new THREE.Mesh(unitBox, new THREE.MeshLambertMaterial({ color: dice.choose(ROOF_TINTS) }));
        cap.scale.set(w + 0.6, 0.8, d + 0.6);
        cap.position.set(x, h + 0.4, z);
        group.add(cap);
        solids.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
        if (bx === 3 && bz === 3 && k === 0) landmarks.tower = { x, z, label: 'Sunset Tower' };
        if (bx === 0 && bz === 6 && k === 0) landmarks.garage = { x: centreX, z: centreZ, label: "Mara's Garage" };
        if (bx === 6 && bz === 0 && k === 0) landmarks.store = { x, z, label: 'Coral Corner Store' };
      }
    }
  }
  // The hideout garage: a low wide building with a big orange door, always
  // in the south-west block so the jobs can always find it.
  const gx = -WORLD.edge + WORLD.street + WORLD.block / 2;
  const gz = WORLD.edge - WORLD.street - WORLD.block / 2;
  const shed = new THREE.Mesh(unitBox, new THREE.MeshLambertMaterial({ color: 0x5a5f7a }));
  shed.scale.set(30, 9, 18);
  shed.position.set(gx, 4.5, gz);
  group.add(shed);
  const door = new THREE.Mesh(unitBox, new THREE.MeshLambertMaterial({ color: 0xff7a2e, emissive: 0x662200 }));
  door.scale.set(16, 6, 0.6);
  door.position.set(gx, 3, gz - 9.2);
  group.add(door);
  solids.push({ minX: gx - 15, maxX: gx + 15, minZ: gz - 9, maxZ: gz + 9 });
  landmarks.garage = { x: gx, z: gz - 14, label: "Mara's Garage" };
  landmarks.tower = landmarks.tower || { x: 0, z: 0, label: 'Sunset Tower' };
  landmarks.store = landmarks.store || { x: WORLD.edge - 60, z: -WORLD.edge + 60, label: 'Coral Corner Store' };
  // Marina on the beach at the east end, with the last job's boat.
  landmarks.marina = { x: WORLD.edge - 60, z: WORLD.edge + 18, label: 'Sunset Marina' };
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(unitBox, new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
  hull.scale.set(3.4, 1.2, 9);
  hull.position.y = 0.4;
  boat.add(hull);
  const wheelhouse = new THREE.Mesh(unitBox, new THREE.MeshLambertMaterial({ color: 0x2a6f8f }));
  wheelhouse.scale.set(2.4, 1.4, 3.4);
  wheelhouse.position.set(0, 1.6, -0.5);
  boat.add(wheelhouse);
  boat.position.set(landmarks.marina.x, 0.1, landmarks.marina.z + 8);
  group.add(boat);

  // Street props: palms and lamps along the roads.
  const barkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a3a });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2f9e5f });
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x333340 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = 0; i <= WORLD.blocksPerSide; i += 1) {
    const centre = -WORLD.edge + WORLD.street / 2 + i * WORLD.step;
    for (let d = -WORLD.edge + 20; d < WORLD.edge; d += 60) {
      const px = centre + WORLD.street / 2 + 4;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 6), barkMat);
      trunk.position.set(px, 3.5, d);
      group.add(trunk);
      for (let f = 0; f < 5; f += 1) {
        const frond = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3.4, 4), frondMat);
        const a = (f / 5) * Math.PI * 2;
        frond.position.set(px + Math.cos(a) * 1.1, 7.2, d + Math.sin(a) * 1.1);
        frond.rotation.z = Math.cos(a) * 0.9;
        frond.rotation.x = -Math.sin(a) * 0.9;
        group.add(frond);
      }
      const lx = centre - WORLD.street / 2 - 4;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), poleMat);
      pole.position.set(lx, 3, d + 30);
      group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), bulbMat);
      bulb.position.set(lx, 6.2, d + 30);
      group.add(bulb);
    }
  }

  // Sunset: a low orange sun sprite hanging over the sea.
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTexture(), transparent: true, depthWrite: false }));
  sun.scale.set(120, 120, 1);
  sun.position.set(-220, 42, 320);
  group.add(sun);

  // Road graph: a node at every street crossing, edges to its neighbours.
  const nodes = [];
  const lookup = new Map();
  for (let ix = 0; ix <= WORLD.blocksPerSide; ix += 1) {
    for (let iz = 0; iz <= WORLD.blocksPerSide; iz += 1) {
      const x = -WORLD.edge + WORLD.street / 2 + ix * WORLD.step;
      const z = -WORLD.edge + WORLD.street / 2 + iz * WORLD.step;
      lookup.set(`${ix},${iz}`, nodes.length);
      nodes.push({ x, z, ix, iz });
    }
  }
  function neighbours(node) {
    const out = [];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const key = `${node.ix + dx},${node.iz + dz}`;
      if (lookup.has(key)) out.push(nodes[lookup.get(key)]);
    }
    return out;
  }
  function nearestNode(x, z) {
    let best = nodes[0];
    let bestD = Infinity;
    for (const node of nodes) {
      const d = (node.x - x) * (node.x - x) + (node.z - z) * (node.z - z);
      if (d < bestD) { bestD = d; best = node; }
    }
    return best;
  }
  function randomNode() {
    return nodes[Math.floor(dice.next() * nodes.length)];
  }

  return { group, solids, nodes, neighbours, nearestNode, randomNode, landmarks };
}

// Push a circle (x, z, radius) out of every solid it overlaps. Returns true
// when a push happened, so callers can kill speed on impact.
export function collideCircle(solids, pos, radius) {
  let hit = false;
  for (const s of solids) {
    const cx = Math.max(s.minX, Math.min(pos.x, s.maxX));
    const cz = Math.max(s.minZ, Math.min(pos.z, s.maxZ));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      } else {
        // Dead centre: shove out along the least-penetrated side.
        const west = pos.x - s.minX + radius;
        const east = s.maxX - pos.x + radius;
        const north = pos.z - s.minZ + radius;
        const south = s.maxZ - pos.z + radius;
        const least = Math.min(west, east, north, south);
        if (least === west) pos.x = s.minX - radius;
        else if (least === east) pos.x = s.maxX + radius;
        else if (least === north) pos.z = s.minZ - radius;
        else pos.z = s.maxZ + radius;
      }
    }
  }
  return hit;
}
