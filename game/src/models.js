// Low-poly people and cars, built from boxes so the game needs no art files.
// One builder each: the player (orange jacket, easy to spot), pedestrians in
// varied colours, and cars with a cabin, wheels and lights.
import * as THREE from 'three';

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const sphereGeo = new THREE.SphereGeometry(1, 10, 8);
const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);

function box(mat, w, h, d, x, y, z) {
  const m = new THREE.Mesh(boxGeo, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  return m;
}

export function createPerson({ jacket = 0xff7a2e, pants = 0x2e3a5c, skin = 0xe8b98a, hair = 0x2a1c12 } = {}) {
  const g = new THREE.Group();
  const jacketMat = new THREE.MeshLambertMaterial({ color: jacket });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const hairMat = new THREE.MeshLambertMaterial({ color: hair });
  const legL = box(pantsMat, 0.22, 0.8, 0.24, -0.14, 0.4, 0);
  const legR = box(pantsMat, 0.22, 0.8, 0.24, 0.14, 0.4, 0);
  const torso = box(jacketMat, 0.62, 0.72, 0.34, 0, 1.16, 0);
  const armL = box(jacketMat, 0.18, 0.66, 0.2, -0.42, 1.14, 0);
  const armR = box(jacketMat, 0.18, 0.66, 0.2, 0.42, 1.14, 0);
  const head = new THREE.Mesh(sphereGeo, skinMat);
  head.scale.set(0.26, 0.28, 0.26);
  head.position.set(0, 1.72, 0);
  const hairTop = box(hairMat, 0.5, 0.16, 0.5, 0, 1.92, 0);
  g.add(legL, legR, torso, armL, armR, head, hairTop);
  g.userData.parts = { legL, legR, armL, armR, torso };
  return g;
}

// Simple walk cycle: swing the limbs with the stride phase.
export function animateWalk(person, phase, amount) {
  const p = person.userData.parts;
  if (!p) return;
  const swing = Math.sin(phase) * 0.55 * amount;
  p.legL.rotation.x = swing;
  p.legR.rotation.x = -swing;
  p.armL.rotation.x = -swing * 0.8;
  p.armR.rotation.x = swing * 0.8;
  person.position.y = Math.abs(Math.sin(phase)) * 0.06 * amount;
}

const CAR_COLORS = [0xd83a3a, 0x3a7bd8, 0xe8c33a, 0x3ad8a0, 0xf2f2f2, 0x2a2a33, 0xb03ad8, 0xd86a1e];

export function createCar(color = 0xd83a3a, isPolice = false) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: isPolice ? 0x1c2f5e : color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a2530 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fd4e8 });
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const body = box(bodyMat, 2.0, 0.62, 4.4, 0, 0.55, 0);
  const cabin = box(glassMat, 1.7, 0.55, 2.1, 0, 1.12, -0.2);
  const roof = box(bodyMat, 1.7, 0.1, 2.0, 0, 1.42, -0.2);
  g.add(body, cabin, roof);
  if (isPolice) {
    const stripe = box(new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }), 2.02, 0.2, 4.42, 0, 0.62, 0);
    g.add(stripe);
    const lightBar = box(new THREE.MeshBasicMaterial({ color: 0xff2222 }), 1.1, 0.16, 0.4, 0, 1.56, -0.2);
    g.add(lightBar);
    g.userData.lightBar = lightBar;
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  g.add(box(headMat, 0.34, 0.16, 0.08, -0.7, 0.55, 2.21));
  g.add(box(headMat, 0.34, 0.16, 0.08, 0.7, 0.55, 2.21));
  g.add(box(tailMat, 0.34, 0.16, 0.08, -0.7, 0.55, -2.21));
  g.add(box(tailMat, 0.34, 0.16, 0.08, 0.7, 0.55, -2.21));
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    g.add(wheel);
    wheels.push(wheel);
  }
  g.userData.wheels = wheels;
  return g;
}

export function randomCarColor(random) {
  return CAR_COLORS[Math.floor(random.next() * CAR_COLORS.length)];
}

// A floating mission beacon: a tall glowing column plus a spinning diamond.
export function createBeacon(color = 0xffd23c) {
  const g = new THREE.Group();
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.6, 26, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  column.position.y = 13;
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.0),
    new THREE.MeshBasicMaterial({ color }),
  );
  diamond.position.y = 5.5;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.8, 2.4, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  g.add(column, diamond, ring);
  g.userData.diamond = diamond;
  return g;
}
