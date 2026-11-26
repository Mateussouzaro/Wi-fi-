import * as THREE from "three";
import type { Box, Circle } from "./world";
import { sign } from "./textures";

export type CarKind = "sedan" | "hatch" | "suv" | "taxi" | "police" | "sport";

interface Profile { pts: [number, number][]; glass: [number, number][]; len: number; wheelZ: number; wheelR: number; width: number }

const PROFILES: Record<"sedan" | "hatch" | "suv" | "sport", Profile> = {
  sedan: {
    len: 4.6, wheelZ: 1.42, wheelR: 0.34, width: 1.62,
    pts: [[-2.3, 0.32], [2.3, 0.32], [2.36, 0.72], [2.2, 0.92], [0.95, 1.04], [0.25, 1.46], [-0.95, 1.46], [-1.62, 1.06], [-2.25, 1.0], [-2.36, 0.74]],
    glass: [[0.97, 1.05], [0.26, 1.49], [-0.96, 1.49], [-1.66, 1.07]],
  },
  hatch: {
    len: 3.95, wheelZ: 1.25, wheelR: 0.32, width: 1.56,
    pts: [[-1.95, 0.32], [1.98, 0.32], [2.02, 0.7], [1.88, 0.9], [0.75, 1.02], [0.1, 1.45], [-1.55, 1.45], [-1.92, 1.0], [-2.0, 0.72]],
    glass: [[0.77, 1.03], [0.11, 1.48], [-1.53, 1.48], [-1.9, 1.05]],
  },
  suv: {
    len: 4.7, wheelZ: 1.5, wheelR: 0.42, width: 1.74,
    pts: [[-2.35, 0.45], [2.35, 0.45], [2.4, 0.95], [2.25, 1.15], [1.0, 1.25], [0.45, 1.82], [-2.0, 1.82], [-2.3, 1.3], [-2.4, 0.95]],
    glass: [[1.02, 1.26], [0.46, 1.85], [-1.98, 1.85], [-2.27, 1.33]],
  },
  sport: {
    len: 4.4, wheelZ: 1.4, wheelR: 0.34, width: 1.78,
    pts: [[-2.2, 0.28], [2.25, 0.28], [2.32, 0.55], [2.1, 0.72], [0.7, 0.86], [0.0, 1.2], [-0.9, 1.2], [-1.85, 0.9], [-2.25, 0.85], [-2.3, 0.6]],
    glass: [[0.72, 0.87], [0.01, 1.23], [-0.88, 1.23], [-1.83, 0.92]],
  },
};

const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x10161c, metalness: 0.2, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.88 });
const tireMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.85 });
const rimMat = new THREE.MeshStandardMaterial({ color: 0xc9ccd1, metalness: 0.9, roughness: 0.25 });
const trimMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 });
const tireG = new THREE.CylinderGeometry(1, 1, 0.24, 20);
tireG.rotateZ(Math.PI / 2);
const rimG = new THREE.CylinderGeometry(0.62, 0.62, 0.25, 10);
rimG.rotateZ(Math.PI / 2);
let policeSign: THREE.Texture | null = null;

function extrude(pts: [number, number][], depth: number, bevel: number) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2); // shape x (length) → world +z forward
  return g;
}

export const CAR_COLORS = [0xb3001b, 0x1d3557, 0xf1f1f1, 0x222222, 0x8d99ae, 0x2a9d8f, 0xe9c46a, 0x6a040f, 0x3a5a40, 0xc0c0c0, 0x14213d, 0xff7b00];

export function makeCarMesh(kind: CarKind, color: number) {
  const prof = PROFILES[kind === "taxi" || kind === "police" ? "sedan" : kind];
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const paint = new THREE.MeshPhysicalMaterial({
    color: kind === "taxi" ? 0xf5c518 : kind === "police" ? 0xf4f4f4 : color,
    metalness: 0.55,
    roughness: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
  });
  const shell = new THREE.Mesh(extrude(prof.pts, prof.width - 0.16, 0.08), paint);
  shell.castShadow = true;
  shell.receiveShadow = true;
  body.add(shell);
  // Glass: the cabin outline pushed slightly outward so it shows over the windscreen
  // and through the sides, but stays under the painted roof.
  const roofY = prof.glass[1][1] - 0.03;
  const cxm = prof.glass.reduce((a, p) => a + p[0], 0) / 4,
    cym = prof.glass.reduce((a, p) => a + p[1], 0) / 4;
  const gpts = prof.glass.map(([x, y]) => {
    const dx = x - cxm,
      dy = y - cym;
    const l = Math.hypot(dx, dy);
    return [x + (dx / l) * 0.03, Math.min(roofY - 0.02, y + (dy / l) * 0.03)] as [number, number];
  });
  const glass = new THREE.Mesh(extrude(gpts, prof.width - 0.02, 0), glassMat);
  body.add(glass);
  // bumpers + side skirt
  const fr = new THREE.Mesh(new THREE.BoxGeometry(prof.width - 0.05, 0.22, 0.2), trimMat);
  fr.position.set(0, prof.pts[0][1] + 0.12, prof.len / 2 + 0.03);
  const rr = fr.clone();
  rr.position.z = -prof.len / 2 - 0.03;
  body.add(fr, rr);
  // lights
  const head = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3d6, emissiveIntensity: 0.6 });
  const tail = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1a1a, emissiveIntensity: 0.5 });
  const fy = prof.pts[2][1] - 0.08;
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.13, 0.06), head);
    h.position.set(s * (prof.width / 2 - 0.3), fy, prof.len / 2 + 0.02);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.06), tail);
    t.position.set(s * (prof.width / 2 - 0.28), fy + 0.05, -prof.len / 2 - 0.02);
    body.add(h, t);
  }
  // mirrors
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.1), paint);
    m.position.set(s * (prof.width / 2 + 0.05), prof.glass[0][1] + 0.05, prof.glass[0][0] - 0.15);
    body.add(m);
  }
  let siren: THREE.MeshStandardMaterial[] = [];
  if (kind === "taxi") {
    const band = new THREE.Mesh(new THREE.BoxGeometry(prof.width + 0.01, 0.12, prof.len * 0.6), new THREE.MeshStandardMaterial({ color: 0x1e5fb4, roughness: 0.4 }));
    band.position.y = 0.78;
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.25), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.4 }));
    top.position.set(0, prof.glass[1][1] + 0.12, -0.3);
    body.add(band, top);
  }
  if (kind === "police") {
    const doors = new THREE.Mesh(new THREE.BoxGeometry(prof.width + 0.01, 0.5, 1.9), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.4 }));
    doors.position.set(0, 0.68, -0.15);
    policeSign ??= sign("POLÍCIA", "#111111", "#ffffff");
    const sm = new THREE.MeshStandardMaterial({ map: policeSign, transparent: true });
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.38), sm);
      p.position.set(s * (prof.width / 2 + 0.02), 0.7, -0.15);
      p.rotation.y = s * Math.PI / 2;
      body.add(p);
    }
    const red = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff0000, emissiveIntensity: 0 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x000055, emissive: 0x1a4dff, emissiveIntensity: 0 });
    siren = [red, blue];
    const bar = new THREE.Group();
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.28), red);
    l.position.x = -0.3;
    const rgt = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.28), blue);
    rgt.position.x = 0.3;
    bar.add(l, rgt);
    bar.position.set(0, prof.glass[1][1] + 0.1, -0.35);
    body.add(doors, bar);
  }
  // wheels
  const wheels: THREE.Group[] = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const w = new THREE.Group();
    const spin = new THREE.Group();
    const tire = new THREE.Mesh(tireG, tireMat);
    tire.scale.set(1, prof.wheelR, prof.wheelR);
    tire.castShadow = true;
    const rim = new THREE.Mesh(rimG, rimMat);
    rim.scale.set(1, prof.wheelR, prof.wheelR);
    rim.position.x = sx * 0.01;
    spin.add(tire, rim);
    w.add(spin);
    w.position.set(sx * (prof.width / 2 - 0.12), prof.wheelR, sz * prof.wheelZ);
    g.add(w);
    wheels.push(w);
  }
  return { group: g, body, wheels, prof, head, tail, siren, paint };
}

export interface CarInput { throttle: number; steer: number; handbrake: boolean }

const tmp = new THREE.Vector3();

export class Car {
  kind: CarKind;
  mesh: ReturnType<typeof makeCarMesh>;
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  heading = 0;
  steer = 0;
  wheelSpin = 0;
  health = 100;
  driver: "player" | "ai" | "police" | null = null;
  radius: number;
  hornT = 0;
  roll = 0;
  pitch = 0;
  lastImpact = 0;
  maxSpeed: number;
  accel: number;

  constructor(kind: CarKind, color: number, scene: THREE.Scene) {
    this.kind = kind;
    this.mesh = makeCarMesh(kind, color);
    scene.add(this.mesh.group);
    this.radius = this.mesh.prof.len / 2 - 0.4;
    this.maxSpeed = kind === "sport" ? 58 : kind === "police" ? 50 : kind === "suv" ? 40 : 44;
    this.accel = kind === "sport" ? 16 : kind === "police" ? 14 : 11;
  }

  get forward() {
    return tmp.set(Math.sin(this.heading), 0, Math.cos(this.heading)).clone();
  }
  get speed() {
    return this.vel.dot(this.forward);
  }

  update(dt: number, inp: CarInput, colliders: Box[], circles: Circle[]) {
    const fwd = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
    let vf = this.vel.dot(fwd);
    let vl = this.vel.dot(right);
    // engine / brakes
    if (inp.throttle > 0) {
      if (vf < -0.5) vf += 28 * inp.throttle * dt;
      else vf += this.accel * inp.throttle * (1 - Math.max(0, vf) / this.maxSpeed) * dt;
    } else if (inp.throttle < 0) {
      if (vf > 0.5) vf += 30 * inp.throttle * dt;
      else vf = Math.max(-11, vf + 8 * inp.throttle * dt);
    } else {
      vf -= Math.sign(vf) * Math.min(Math.abs(vf), 3.2 * dt);
    }
    vf *= 1 - 0.06 * dt;
    if (inp.handbrake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 9 * dt);
    // steering: lower lock at speed
    const target = inp.steer * (0.62 - 0.4 * Math.min(1, Math.abs(vf) / 40));
    this.steer += (target - this.steer) * Math.min(1, dt * 8);
    const yaw = (vf / 2.7) * Math.tan(this.steer) * (inp.handbrake ? 1.35 : 1);
    this.heading += yaw * dt;
    // tyre grip kills sideways velocity; the handbrake lets the tail slide
    const grip = inp.handbrake ? 1.6 : 9;
    vl *= Math.exp(-grip * dt);
    const nf = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const nr = new THREE.Vector3(nf.z, 0, -nf.x);
    this.vel.copy(nf).multiplyScalar(vf).addScaledVector(nr, vl);
    this.pos.addScaledVector(this.vel, dt);
    this.lastImpact = this.collide(colliders, circles);

    // visuals
    this.roll += ((-yaw * vf) * 0.004 - this.roll) * Math.min(1, dt * 6);
    this.pitch += ((inp.throttle > 0 ? -0.012 : inp.throttle < 0 && vf > 1 ? 0.03 : 0) - this.pitch) * Math.min(1, dt * 5);
    this.sync(dt, vf);
    this.mesh.tail.emissiveIntensity = inp.throttle < 0 && vf > 0.5 ? 2.5 : 0.5;
  }

  sync(dt: number, vf = this.speed) {
    const m = this.mesh;
    m.group.position.copy(this.pos);
    m.group.rotation.y = this.heading;
    m.body.rotation.set(this.pitch, 0, THREE.MathUtils.clamp(this.roll, -0.08, 0.08));
    this.wheelSpin += (vf / m.prof.wheelR) * dt;
    m.wheels.forEach((w, i) => {
      w.children[0].rotation.x = this.wheelSpin;
      if (i < 2) w.rotation.y = this.steer;
    });
  }

  // Three circles along the body vs. building boxes and round props.
  collide(colliders: Box[], circles: Circle[]) {
    const fwd = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    let impact = 0;
    for (const off of [-this.radius * 0.7, 0, this.radius * 0.7]) {
      const cx = this.pos.x + fwd.x * off,
        cz = this.pos.z + fwd.z * off;
      const rr = 1.05;
      for (const b of colliders) {
        if (cx < b.minX - rr || cx > b.maxX + rr || cz < b.minZ - rr || cz > b.maxZ + rr) continue;
        const px = THREE.MathUtils.clamp(cx, b.minX, b.maxX);
        const pz = THREE.MathUtils.clamp(cz, b.minZ, b.maxZ);
        let dx = cx - px,
          dz = cz - pz;
        let d = Math.hypot(dx, dz);
        if (d >= rr) continue;
        if (d < 1e-4) {
          // centre inside the box: push out along the shallowest axis
          const ox = Math.min(cx - b.minX, b.maxX - cx),
            oz = Math.min(cz - b.minZ, b.maxZ - cz);
          if (ox < oz) { dx = cx - b.minX < b.maxX - cx ? -1 : 1; dz = 0; } else { dz = cz - b.minZ < b.maxZ - cz ? -1 : 1; dx = 0; }
          d = 0;
        } else { dx /= d; dz /= d; }
        const push = rr - d;
        this.pos.x += dx * push;
        this.pos.z += dz * push;
        const vn = this.vel.x * dx + this.vel.z * dz;
        if (vn < 0) {
          impact = Math.max(impact, -vn);
          this.vel.x -= 1.35 * vn * dx;
          this.vel.z -= 1.35 * vn * dz;
          this.vel.multiplyScalar(0.8);
        }
      }
      for (const c of circles) {
        const dx = cx - c.x,
          dz = cz - c.z;
        const d = Math.hypot(dx, dz);
        const min = c.r + rr;
        if (d >= min || d < 1e-4) continue;
        const nx = dx / d,
          nz = dz / d;
        this.pos.x += nx * (min - d);
        this.pos.z += nz * (min - d);
        const vn = this.vel.x * nx + this.vel.z * nz;
        if (vn < 0) {
          impact = Math.max(impact, -vn);
          this.vel.x -= 1.3 * vn * nx;
          this.vel.z -= 1.3 * vn * nz;
          this.vel.multiplyScalar(0.75);
        }
      }
    }
    if (impact > 3) this.health = Math.max(0, this.health - impact * 0.8);
    return impact;
  }
}

// Simple impulse between two cars (circle vs circle using the body centre).
export function carVsCar(a: Car, b: Car) {
  const dx = b.pos.x - a.pos.x,
    dz = b.pos.z - a.pos.z;
  const d = Math.hypot(dx, dz);
  const min = 2.3;
  if (d >= min || d < 1e-4) return 0;
  const nx = dx / d,
    nz = dz / d;
  const push = (min - d) / 2;
  a.pos.x -= nx * push;
  a.pos.z -= nz * push;
  b.pos.x += nx * push;
  b.pos.z += nz * push;
  const rv = (b.vel.x - a.vel.x) * nx + (b.vel.z - a.vel.z) * nz;
  if (rv < 0) {
    const j = -rv * 0.65;
    a.vel.x -= j * nx;
    a.vel.z -= j * nz;
    b.vel.x += j * nx;
    b.vel.z += j * nz;
    if (-rv > 4) {
      a.health = Math.max(0, a.health + rv * 0.6);
      b.health = Math.max(0, b.health + rv * 0.6);
    }
    return -rv;
  }
  return 0;
}
