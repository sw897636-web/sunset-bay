// Sunset Bay itself: a procedural coastal city built from boxes, planes and
// a canvas window texture. It also owns the road graph (intersections and the
// streets between them) that traffic, police and the mission autopilot drive,
// and the list of solid boxes everything collides with.
import * as THREE from 'three';
import { CITY } from './config.js';

const PALETTE = [0xffb36b, 0xffe08a, 0xff8fa3, 0x7fd4c1, 0x8ecae6, 0xf4a261, 0xe07a5f, 0x90be6d, 0xf9c74f, 0x577590];
const ROOF_COLORS = [0x3d405b, 0x6d6875, 0x8d99ae, 0x2b2d42];

function makeWindowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  // Light base so the pastel wall colour survives the multiply; windows read
  // as dark glass, a few of them warmly lit.
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

function makeSunTexture() {
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

export function createCity(random) {
  const group = new THREE.Group();
  const solids = [];   // { minX, maxX, minZ, maxZ } building footprints
  const windowTex = makeWindowTexture();

  const scene = group;
  // Ground: warm grass/asphalt base under everything.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2 + 420, CITY.half * 2 + 420),
    new THREE.MeshLambertMaterial({ color: 0x9aa06b }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 40);
  scene.add(ground);

  // Roads: one dark plane per street line, plus sidewalk strips.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e2e38 });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x8a8a92 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8c25a });
  const lines = [];
  for (let i = 0; i <= CITY.blocks; i += 1) {
    const c = -CITY.half + CITY.roadWidth / 2 + i * CITY.pitch;
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2 + CITY.roadWidth, CITY.roadWidth), roadMat);
      road.rotation.x = -Math.PI / 2;
      if (horizontal) { road.position.set(0, 0.01, c); }
      else { road.rotation.z = Math.PI / 2; road.position.set(c, 0.01, 0); }
      scene.add(road);
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2 + CITY.roadWidth, 3), walkMat);
      walk.rotation.x = -Math.PI / 2;
      if (horizontal) { walk.position.set(0, 0.02, c + CITY.roadWidth / 2 + 1.5); }
      else { walk.rotation.z = Math.PI / 2; walk.position.set(c + CITY.roadWidth / 2 + 1.5, 0.02, 0); }
      scene.add(walk);
      // Centre dashes.
      for (let d = -CITY.half; d < CITY.half; d += 12) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.5), lineMat);
        dash.rotation.x = -Math.PI / 2;
        if (horizontal) { dash.position.set(d, 0.03, c); }
        else { dash.rotation.z = Math.PI / 2; dash.position.set(c, 0.03, d); }
        lines.push(dash);
      }
    }
  }
  for (const dash of lines) scene.add(dash);

  // Beach sand and ocean on the south edge (+z), with a wooden pier.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2 + 200, 30),
    new THREE.MeshLambertMaterial({ color: 0xe8cf9a }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, CITY.half + 15);
  scene.add(sand);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2 + 400, 200),
    new THREE.MeshLambertMaterial({ color: 0x2a6f8f }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.08, CITY.oceanZ);
  scene.add(ocean);
  // Pier: planks out to sea at the west end of the beach.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6b4a });
  for (let z = CITY.half + 8; z < CITY.half + 62; z += 3) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(10, 0.4, 2.6), pierMat);
    plank.position.set(-CITY.half + 30, 0.6, z);
    scene.add(plank);
  }
  for (const px of [-CITY.half + 25.5, -CITY.half + 34.5]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.1, 54), pierMat);
    rail.position.set(px, 1.1, CITY.half + 35);
    scene.add(rail);
  }

  // Buildings: one or two per block, sunset pastel walls, lit-window texture,
  // flat roofs with a darker cap. A few named landmarks get fixed spots.
  const landmarks = {};
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let bx = 0; bx < CITY.blocks; bx += 1) {
    for (let bz = 0; bz < CITY.blocks; bz += 1) {
      const blockCX = -CITY.half + CITY.roadWidth + CITY.blockSize / 2 + bx * CITY.pitch;
      const blockCZ = -CITY.half + CITY.roadWidth + CITY.blockSize / 2 + bz * CITY.pitch;
      const count = random.chance(0.3) ? 1 : 2;
      for (let k = 0; k < count; k += 1) {
        const w = random.range(14, 24);
        const d = random.range(14, 24);
        const h = random.chance(0.16) ? random.range(30, 52) : random.range(8, 26);
        const ox = count === 1 ? 0 : (k === 0 ? -9 : 9);
        const oz = count === 1 ? 0 : (k === 0 ? -8 : 9);
        const x = blockCX + ox;
        const z = blockCZ + oz;
        const color = random.pick(PALETTE);
        const tex = windowTex.clone();
        tex.needsUpdate = true;
        tex.repeat.set(Math.max(1, Math.round(w / 10)), Math.max(1, Math.round(h / 12)));
        const mat = new THREE.MeshLambertMaterial({ color, map: tex });
        const building = new THREE.Mesh(boxGeo, mat);
        building.scale.set(w, h, d);
        building.position.set(x, h / 2, z);
        scene.add(building);
        const roof = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: random.pick(ROOF_COLORS) }));
        roof.scale.set(w + 0.6, 0.8, d + 0.6);
        roof.position.set(x, h + 0.4, z);
        scene.add(roof);
        solids.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
        // Landmark names for the story's fixed spots.
        if (bx === 3 && bz === 3 && k === 0) landmarks.tower = { x, z, label: 'Sunset Tower' };
        if (bx === 0 && bz === 6 && k === 0) landmarks.garage = { x: blockCX, z: blockCZ, label: "Mara's Garage" };
        if (bx === 6 && bz === 0 && k === 0) landmarks.store = { x, z, label: 'Coral Corner Store' };
      }
    }
  }
  // The hideout garage: a low wide building with a big orange door, always at
  // the south-west block so missions can always find it.
  const garageX = -CITY.half + CITY.roadWidth + CITY.blockSize / 2;
  const garageZ = CITY.half - CITY.roadWidth - CITY.blockSize / 2;
  const garage = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x5a5f7a }));
  garage.scale.set(30, 9, 18);
  garage.position.set(garageX, 4.5, garageZ);
  scene.add(garage);
  const door = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xff7a2e, emissive: 0x662200 }));
  door.scale.set(16, 6, 0.6);
  door.position.set(garageX, 3, garageZ - 9.2);
  scene.add(door);
  solids.push({ minX: garageX - 15, maxX: garageX + 15, minZ: garageZ - 9, maxZ: garageZ + 9 });
  landmarks.garage = { x: garageX, z: garageZ - 14, label: "Mara's Garage" };
  landmarks.tower = landmarks.tower || { x: 0, z: 0, label: 'Sunset Tower' };
  landmarks.store = landmarks.store || { x: CITY.half - 60, z: -CITY.half + 60, label: 'Coral Corner Store' };
  // Marina on the beach, east end: the final mission's boat.
  landmarks.marina = { x: CITY.half - 60, z: CITY.half + 18, label: 'Sunset Marina' };
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
  hull.scale.set(3.4, 1.2, 9);
  hull.position.y = 0.4;
  boat.add(hull);
  const cabin = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x2a6f8f }));
  cabin.scale.set(2.4, 1.4, 3.4);
  cabin.position.set(0, 1.6, -0.5);
  boat.add(cabin);
  boat.position.set(landmarks.marina.x, 0.1, landmarks.marina.z + 8);
  scene.add(boat);

  // Street props: palm trees, lamps and benches along the roads.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a3a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f9e5f });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x333340 });
  const lampGlow = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = 0; i <= CITY.blocks; i += 1) {
    const c = -CITY.half + CITY.roadWidth / 2 + i * CITY.pitch;
    for (let d = -CITY.half + 20; d < CITY.half; d += 60) {
      // Palm.
      const px = c + CITY.roadWidth / 2 + 4;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 6), trunkMat);
      trunk.position.set(px, 3.5, d);
      scene.add(trunk);
      for (let f = 0; f < 5; f += 1) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3.4, 4), leafMat);
        const a = (f / 5) * Math.PI * 2;
        leaf.position.set(px + Math.cos(a) * 1.1, 7.2, d + Math.sin(a) * 1.1);
        leaf.rotation.z = Math.cos(a) * 0.9;
        leaf.rotation.x = -Math.sin(a) * 0.9;
        scene.add(leaf);
      }
      // Lamp on the opposite side.
      const lx = c - CITY.roadWidth / 2 - 4;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), lampMat);
      pole.position.set(lx, 3, d + 30);
      scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), lampGlow);
      bulb.position.set(lx, 6.2, d + 30);
      scene.add(bulb);
    }
  }

  // Sunset: a low orange sun sprite and warm haze.
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeSunTexture(), transparent: true, depthWrite: false }));
  sun.scale.set(120, 120, 1);
  sun.position.set(-220, 42, 320);
  scene.add(sun);

  // Road graph: intersections at every street crossing, edges to neighbours.
  const nodes = [];
  const nodeIndex = new Map();
  for (let ix = 0; ix <= CITY.blocks; ix += 1) {
    for (let iz = 0; iz <= CITY.blocks; iz += 1) {
      const x = -CITY.half + CITY.roadWidth / 2 + ix * CITY.pitch;
      const z = -CITY.half + CITY.roadWidth / 2 + iz * CITY.pitch;
      nodeIndex.set(`${ix},${iz}`, nodes.length);
      nodes.push({ x, z, ix, iz });
    }
  }
  function neighbours(node) {
    const out = [];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dz] of dirs) {
      const key = `${node.ix + dx},${node.iz + dz}`;
      if (nodeIndex.has(key)) out.push(nodes[nodeIndex.get(key)]);
    }
    return out;
  }
  function nearestNode(x, z) {
    let best = nodes[0];
    let bestD = Infinity;
    for (const n of nodes) {
      const d = (n.x - x) * (n.x - x) + (n.z - z) * (n.z - z);
      if (d < bestD) { bestD = d; best = n; }
    }
    return best;
  }
  function randomNode() {
    return nodes[Math.floor(random.next() * nodes.length)];
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
        // Dead centre: shove out along the smallest penetration axis.
        const pl = pos.x - s.minX + radius;
        const pr = s.maxX - pos.x + radius;
        const pt = pos.z - s.minZ + radius;
        const pb = s.maxZ - pos.z + radius;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) pos.x = s.minX - radius;
        else if (m === pr) pos.x = s.maxX + radius;
        else if (m === pt) pos.z = s.minZ - radius;
        else pos.z = s.maxZ + radius;
      }
    }
  }
  return hit;
}
