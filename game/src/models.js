// Low-poly people and cars, assembled from boxes so the game needs no art
// files. One builder each: the hero (orange jacket, easy to spot at a
// glance), pedestrians in varied colours, cars with a cabin, wheels and
// lights, and the glowing beacon that marks where the next job is.
import * as THREE from 'three';

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitBall = new THREE.SphereGeometry(1, 10, 8);
const tyreGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);

function block(mat, w, h, d, x, y, z) {
  const mesh = new THREE.Mesh(unitBox, mat);
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y, z);
  return mesh;
}

function lambert(color) {
  return new THREE.MeshLambertMaterial({ color });
}

export function buildPerson({ jacket = 0xff7a2e, pants = 0x2e3a5c, skin = 0xe8b98a, hair = 0x2a1c12 } = {}) {
  const group = new THREE.Group();
  const coat = lambert(jacket);
  const legs = lambert(pants);
  const flesh = lambert(skin);
  const hairMat = lambert(hair);
  const leftLeg = block(legs, 0.22, 0.8, 0.24, -0.14, 0.4, 0);
  const rightLeg = block(legs, 0.22, 0.8, 0.24, 0.14, 0.4, 0);
  const chest = block(coat, 0.62, 0.72, 0.34, 0, 1.16, 0);
  const leftArm = block(coat, 0.18, 0.66, 0.2, -0.42, 1.14, 0);
  const rightArm = block(coat, 0.18, 0.66, 0.2, 0.42, 1.14, 0);
  const skull = new THREE.Mesh(unitBall, flesh);
  skull.scale.set(0.26, 0.28, 0.26);
  skull.position.set(0, 1.72, 0);
  const mop = block(hairMat, 0.5, 0.16, 0.5, 0, 1.92, 0);
  group.add(leftLeg, rightLeg, chest, leftArm, rightArm, skull, mop);
  group.userData.limbs = { leftLeg, rightLeg, leftArm, rightArm };
  return group;
}

// A simple walk cycle: limbs swing with the stride, the body bobs a little.
export function walkCycle(person, phase, amount) {
  const limbs = person.userData.limbs;
  if (!limbs) return;
  const swing = Math.sin(phase) * 0.55 * amount;
  limbs.leftLeg.rotation.x = swing;
  limbs.rightLeg.rotation.x = -swing;
  limbs.leftArm.rotation.x = -swing * 0.8;
  limbs.rightArm.rotation.x = swing * 0.8;
  person.position.y = Math.abs(Math.sin(phase)) * 0.06 * amount;
}

const PAINTS = [0xd83a3a, 0x3a7bd8, 0xe8c33a, 0x3ad8a0, 0xf2f2f2, 0x2a2a33, 0xb03ad8, 0xd86a1e];

export function buildCar(paint = 0xd83a3a, police = false) {
  const group = new THREE.Group();
  const shell = lambert(police ? 0x1c2f5e : paint);
  const trim = lambert(0x1a2530);
  const glass = lambert(0x9fd4e8);
  const rubber = lambert(0x111111);
  const body = block(shell, 2.0, 0.62, 4.4, 0, 0.55, 0);
  const cabinGlass = block(glass, 1.7, 0.55, 2.1, 0, 1.12, -0.2);
  const roof = block(shell, 1.7, 0.1, 2.0, 0, 1.42, -0.2);
  group.add(body, cabinGlass, roof);
  if (police) {
    const band = block(lambert(0xf2f2f2), 2.02, 0.2, 4.42, 0, 0.62, 0);
    group.add(band);
    const bar = block(new THREE.MeshBasicMaterial({ color: 0xff2222 }), 1.1, 0.16, 0.4, 0, 1.56, -0.2);
    group.add(bar);
    group.userData.lightBar = bar;
  }
  const headlight = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const taillight = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  group.add(block(headlight, 0.34, 0.16, 0.08, -0.7, 0.55, 2.21));
  group.add(block(headlight, 0.34, 0.16, 0.08, 0.7, 0.55, 2.21));
  group.add(block(taillight, 0.34, 0.16, 0.08, -0.7, 0.55, -2.21));
  group.add(block(taillight, 0.34, 0.16, 0.08, 0.7, 0.55, -2.21));
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(tyreGeo, rubber);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  group.userData.wheels = wheels;
  return group;
}

export function pickCarPaint(dice) {
  return PAINTS[Math.floor(dice.next() * PAINTS.length)];
}

// A floating job marker: a tall glowing column, a spinning diamond above
// it, and a ring on the ground so it reads from across the city.
export function buildBeacon(color = 0xffd23c) {
  const group = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.6, 26, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  shaft.position.y = 13;
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.0),
    new THREE.MeshBasicMaterial({ color }),
  );
  gem.position.y = 5.5;
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(1.8, 2.4, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.15;
  group.add(shaft, gem, halo);
  group.userData.gem = gem;
  return group;
}
