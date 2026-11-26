import * as THREE from "three";
import { spoolLabel, lineWraps } from "./art";

// First-person rig parented to the camera: left hand on the spool (carretel),
// right hand working the line.

const skin = new THREE.MeshPhysicalMaterial({ color: 0x8d5524, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color(0xffc9a0) });
const nail = new THREE.MeshStandardMaterial({ color: 0xd9a58a, roughness: 0.3 });

function finger(len: number, rad: number, curl: number) {
  const g = new THREE.Group();
  let parent: THREE.Object3D = g;
  const segs = [0.45, 0.32, 0.23];
  for (let i = 0; i < 3; i++) {
    const l = len * segs[i];
    const j = new THREE.Group();
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(rad * (1 - i * 0.12), l, 4, 8), skin);
    m.position.y = l / 2;
    j.add(m);
    if (i === 2) {
      const n = new THREE.Mesh(new THREE.SphereGeometry(rad * 0.75, 8, 6), nail);
      n.scale.set(1, 1.3, 0.4);
      n.position.set(0, l * 0.75, rad * 0.55);
      j.add(n);
    }
    j.rotation.x = curl;
    parent.add(j);
    const next = new THREE.Group();
    next.position.y = l;
    j.add(next);
    parent = next;
  }
  return g;
}

function hand(curl: number, mirror: number) {
  const h = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.05, 4, 10), skin);
  palm.scale.set(1.25, 1, 0.55);
  palm.position.y = 0.035;
  h.add(palm);
  const wrist = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.12, 4, 8), skin);
  wrist.scale.set(1.2, 1, 0.8);
  wrist.position.y = -0.07;
  h.add(wrist);
  const lens = [0.075, 0.085, 0.08, 0.065];
  lens.forEach((l, i) => {
    const f = finger(l, 0.0105, curl);
    f.position.set((i - 1.5) * 0.022 * mirror, 0.085, 0);
    h.add(f);
  });
  const thumb = finger(0.06, 0.012, curl * 0.6);
  thumb.position.set(-0.045 * mirror, 0.03, 0.012);
  thumb.rotation.z = 0.9 * mirror;
  h.add(thumb);
  h.traverse((o) => ((o as THREE.Mesh).castShadow = false));
  return h;
}

export function buildRig(camera: THREE.Camera) {
  const rig = new THREE.Group();
  camera.add(rig);

  // spool
  const spool = new THREE.Group();
  const wraps = lineWraps();
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.11, 40, 1, true), new THREE.MeshStandardMaterial({ map: wraps, roughness: 0.6 }));
  spool.add(core);
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: 0.35, metalness: 0.2 });
  const label = new THREE.MeshStandardMaterial({ map: spoolLabel(), roughness: 0.4, metalness: 0.15 });
  for (const s of [-1, 1]) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.012, 48), [rimMat, s > 0 ? label : rimMat, rimMat]);
    disc.position.y = (s * 0.11) / 2 + s * 0.006;
    spool.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.007, 8, 48), rimMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = disc.position.y;
    spool.add(ring);
  }
  // label disc faces the camera-right; spool held low-left, tilted
  spool.rotation.set(0.15, 0.2, -1.25);
  spool.position.set(-0.21, -0.2, -0.5);
  rig.add(spool);
  const left = hand(1.25, 1);
  left.position.set(-0.14, -0.32, -0.47);
  left.rotation.set(-0.3, 0.6, -0.5);
  rig.add(left);

  // closed fist pinching the line, knuckles toward the sky
  const right = hand(1.5, -1);
  const rightBase = new THREE.Vector3(0.19, -0.33, -0.5);
  right.position.copy(rightBase);
  right.rotation.set(-0.5, -0.4, 0.55);
  right.scale.setScalar(0.92);
  rig.add(right);
  const pinch = new THREE.Object3D();
  pinch.position.set(0.0, 0.1, 0.03);
  right.add(pinch);

  // short piece of line from spool to the right hand (in camera space)
  const lm = new THREE.LineBasicMaterial({ color: 0xffffff });
  const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const spoolLine = new THREE.Line(lg, lm);
  rig.add(spoolLine);

  let stroke = 0;
  let spin = 0;
  const tmp = new THREE.Vector3();
  return {
    rig,
    update(dt: number, pulling: boolean, releasing: boolean, reeling: boolean) {
      // pulling: quick hand-over-hand strokes toward the body
      stroke = pulling ? stroke + dt * 7 : Math.max(0, stroke - dt * 3);
      const s = pulling ? (Math.sin(stroke) * 0.5 + 0.5) : 0;
      right.position.set(rightBase.x + s * 0.03, rightBase.y - s * 0.11, rightBase.z + s * 0.12);
      right.rotation.x = -0.5 + s * 0.5;
      spin += (releasing ? 14 : reeling ? -10 : 0) * dt;
      core.rotation.y = spin;
      spool.children.forEach((c) => (c.rotation.y = c === core ? spin : c.rotation.y));
      // line from the top of the spool to the pinch point
      const a = new THREE.Vector3(0.02, 0.0, 0.0);
      spool.localToWorld(a);
      rig.worldToLocal(a);
      pinch.getWorldPosition(tmp);
      const b = tmp.clone();
      rig.worldToLocal(b);
      (spoolLine.geometry as THREE.BufferGeometry).setFromPoints([a, b]);
    },
    // where the kite line leaves the hand, in world space
    linePoint(out: THREE.Vector3) {
      return pinch.getWorldPosition(out);
    },
  };
}
