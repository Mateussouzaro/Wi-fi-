import * as THREE from "three";
import type { Box, Circle } from "./world";
import { roadX, roadZ, ROAD, BLOCK, NX, NZ } from "./world";
import { rng } from "./textures";

const SKINS = [0x8d5524, 0xc68642, 0xe0ac69, 0xf1c27d, 0x5c3a21, 0xa0673a];
const SHIRTS = [0xffdf00, 0x009c3b, 0x002776, 0xffffff, 0xd62828, 0x222222, 0xf77f00, 0x6a4c93, 0x1982c4, 0xe5e5e5];
const PANTS = [0x1d3557, 0x222222, 0x6b705c, 0x3d405b, 0x8d99ae, 0xdda15e];

export interface HumanMesh {
  group: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  lArm: THREE.Group;
  rArm: THREE.Group;
  lLeg: THREE.Group;
  rLeg: THREE.Group;
}

const cap = (r: number, l: number) => new THREE.CapsuleGeometry(r, l, 4, 10);

export function makeHuman(seed: number, opts: { shirt?: number; pants?: number; skin?: number; cap?: number } = {}): HumanMesh {
  const r = rng(seed * 97 + 11);
  const skin = new THREE.MeshStandardMaterial({ color: opts.skin ?? SKINS[Math.floor(r() * SKINS.length)], roughness: 0.6 });
  const shirt = new THREE.MeshStandardMaterial({ color: opts.shirt ?? SHIRTS[Math.floor(r() * SHIRTS.length)], roughness: 0.85 });
  const pants = new THREE.MeshStandardMaterial({ color: opts.pants ?? PANTS[Math.floor(r() * PANTS.length)], roughness: 0.9 });
  const shoes = new THREE.MeshStandardMaterial({ color: r() < 0.5 ? 0xffffff : 0x111111, roughness: 0.6 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x1b120c, roughness: 0.9 });

  const group = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.95;
  group.add(hips);

  const torso = new THREE.Group();
  hips.add(torso);
  const chest = new THREE.Mesh(cap(0.2, 0.42), shirt);
  chest.scale.set(1.15, 1, 0.75);
  chest.position.y = 0.32;
  torso.add(chest);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 8), skin);
  neck.position.y = 0.66;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), skin);
  head.scale.set(0.9, 1.1, 1);
  head.position.y = 0.82;
  const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), hair);
  hairM.position.y = 0.84;
  hairM.scale.set(0.92, 1.0, 1.02);
  torso.add(neck, head, hairM);
  if (opts.cap !== undefined) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: opts.cap }));
    c.position.y = 0.86;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.14), c.material);
    brim.position.set(0, 0.86, 0.15);
    torso.add(c, brim);
  }

  const limb = (len: number, rad: number, mat: THREE.Material, lower: THREE.Material, foot?: THREE.Material) => {
    const g = new THREE.Group();
    const up = new THREE.Mesh(cap(rad, len * 0.45), mat);
    up.position.y = -len * 0.25;
    const lo = new THREE.Mesh(cap(rad * 0.85, len * 0.45), lower);
    lo.position.y = -len * 0.72;
    g.add(up, lo);
    if (foot) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.24), foot);
      f.position.set(0, -len - 0.02, 0.05);
      g.add(f);
    }
    g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    return g;
  };
  const lArm = limb(0.62, 0.055, shirt, skin);
  lArm.position.set(-0.27, 0.56, 0);
  const rArm = limb(0.62, 0.055, shirt, skin);
  rArm.position.set(0.27, 0.56, 0);
  torso.add(lArm, rArm);
  const lLeg = limb(0.88, 0.08, pants, pants, shoes);
  lLeg.position.set(-0.11, 0, 0);
  const rLeg = limb(0.88, 0.08, pants, pants, shoes);
  rLeg.position.set(0.11, 0, 0);
  hips.add(lLeg, rLeg);
  group.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return { group, hips, torso, lArm, rArm, lLeg, rLeg };
}

// Procedural walk/run cycle. amount 0 = idle, 1 = walk, 2 = sprint.
export function animateHuman(h: HumanMesh, phase: number, amount: number, t: number) {
  const a = Math.min(amount, 2);
  const swing = 0.55 * Math.min(a, 1) + 0.25 * Math.max(0, a - 1);
  const s = Math.sin(phase);
  h.lLeg.rotation.x = s * swing;
  h.rLeg.rotation.x = -s * swing;
  h.lArm.rotation.x = -s * swing * 0.9;
  h.rArm.rotation.x = s * swing * 0.9;
  h.lArm.rotation.z = -0.08;
  h.rArm.rotation.z = 0.08;
  h.hips.position.y = 0.95 + Math.abs(Math.cos(phase)) * 0.05 * Math.min(a, 1.5) + (a < 0.05 ? Math.sin(t * 2) * 0.006 : 0);
  h.torso.rotation.x = 0.1 * Math.max(0, a - 1);
  h.torso.rotation.y = s * 0.08 * Math.min(a, 1);
}

// Push a circle out of boxes/circles (used by people).
export function collideCircle(p: THREE.Vector3, rad: number, colliders: Box[], circles: Circle[]) {
  for (const b of colliders) {
    if (p.x < b.minX - rad || p.x > b.maxX + rad || p.z < b.minZ - rad || p.z > b.maxZ + rad) continue;
    const px = THREE.MathUtils.clamp(p.x, b.minX, b.maxX),
      pz = THREE.MathUtils.clamp(p.z, b.minZ, b.maxZ);
    const dx = p.x - px,
      dz = p.z - pz;
    const d = Math.hypot(dx, dz);
    if (d >= rad) continue;
    if (d < 1e-4) {
      const ox = Math.min(p.x - b.minX, b.maxX - p.x),
        oz = Math.min(p.z - b.minZ, b.maxZ - p.z);
      if (ox < oz) p.x = p.x - b.minX < b.maxX - p.x ? b.minX - rad : b.maxX + rad;
      else p.z = p.z - b.minZ < b.maxZ - p.z ? b.minZ - rad : b.maxZ + rad;
    } else {
      p.x += (dx / d) * (rad - d);
      p.z += (dz / d) * (rad - d);
    }
  }
  for (const c of circles) {
    const dx = p.x - c.x,
      dz = p.z - c.z;
    const d = Math.hypot(dx, dz);
    if (d < c.r + rad && d > 1e-4) {
      p.x += (dx / d) * (c.r + rad - d);
      p.z += (dz / d) * (c.r + rad - d);
    }
  }
}

// ---------------------------------------------------------------- pedestrians

export class Pedestrian {
  mesh: HumanMesh;
  pos = new THREE.Vector3();
  heading = 0;
  phase = Math.random() * 6;
  state: "walk" | "flee" | "down" = "walk";
  downT = 0;
  // perimeter walking around a block
  bi = 0;
  bj = 0;
  s = 0;
  dir = 1;
  speed = 1.3;
  fleeFrom = new THREE.Vector3();

  constructor(seed: number, scene: THREE.Scene) {
    this.mesh = makeHuman(seed);
    scene.add(this.mesh.group);
    this.respawn(seed);
  }

  respawn(seed: number) {
    const r = rng(seed * 13 + Math.floor(Math.random() * 1000));
    this.bi = Math.floor(r() * NX);
    this.bj = Math.floor(r() * NZ);
    this.s = r() * 4;
    this.dir = r() < 0.5 ? 1 : -1;
    this.speed = 1.1 + r() * 0.6;
    this.state = "walk";
    this.mesh.group.rotation.set(0, 0, 0);
    this.pathPoint(this.s, this.pos);
  }

  // Rectangle 2.2 m inside the block edge; s ∈ [0,4) runs around its four sides.
  pathPoint(s: number, out: THREE.Vector3) {
    const x0 = roadX[this.bi] + ROAD / 2 + 2.2,
      z0 = roadZ[this.bj] + ROAD / 2 + 2.2;
    const L = BLOCK - 4.4;
    const k = ((s % 4) + 4) % 4;
    const side = Math.floor(k),
      f = k - side;
    if (side === 0) out.set(x0 + f * L, 0.25, z0);
    else if (side === 1) out.set(x0 + L, 0.25, z0 + f * L);
    else if (side === 2) out.set(x0 + L - f * L, 0.25, z0 + L);
    else out.set(x0, 0.25, z0 + L - f * L);
    return out;
  }

  update(dt: number, t: number, colliders: Box[], circles: Circle[]) {
    if (this.state === "down") {
      this.downT += dt;
      this.mesh.group.rotation.x = Math.min(Math.PI / 2, this.mesh.group.rotation.x + dt * 6);
      this.mesh.group.position.y = 0.3;
      if (this.downT > 25) this.respawn(Math.floor(t * 100));
      return;
    }
    let moving = 1;
    if (this.state === "flee") {
      const away = this.pos.clone().sub(this.fleeFrom).setY(0).normalize();
      this.heading = Math.atan2(away.x, away.z);
      this.pos.addScaledVector(away, 4.5 * dt);
      collideCircle(this.pos, 0.35, colliders, circles);
      moving = 2;
      if (this.pos.distanceTo(this.fleeFrom) > 30) {
        // settle onto the nearest block perimeter again
        this.bi = THREE.MathUtils.clamp(Math.floor((this.pos.x - roadX[0]) / (BLOCK + ROAD)), 0, NX - 1);
        this.bj = THREE.MathUtils.clamp(Math.floor((this.pos.z - roadZ[0]) / (BLOCK + ROAD)), 0, NZ - 1);
        this.state = "walk";
        this.s = 0;
      }
    } else {
      const L = BLOCK - 4.4;
      this.s += (this.dir * this.speed * dt) / L;
      const target = this.pathPoint(this.s, new THREE.Vector3());
      const d = target.clone().sub(this.pos);
      if (d.length() > 0.01) this.heading = Math.atan2(d.x, d.z);
      this.pos.lerp(target, Math.min(1, dt * 5));
      moving = 1;
    }
    this.phase += dt * (moving > 1 ? 11 : 6.5);
    animateHuman(this.mesh, this.phase, moving, t);
    this.mesh.group.position.copy(this.pos);
    this.mesh.group.rotation.y = this.heading;
  }

  knockDown(from: THREE.Vector3, speed: number) {
    if (this.state === "down") return false;
    this.state = "down";
    this.downT = 0;
    const push = this.pos.clone().sub(from).setY(0).normalize().multiplyScalar(Math.min(6, speed * 0.25));
    this.pos.add(push);
    this.mesh.group.position.copy(this.pos);
    return true;
  }

  scare(from: THREE.Vector3) {
    if (this.state === "walk") {
      this.state = "flee";
      this.fleeFrom.copy(from);
    }
  }
}
