import * as THREE from "three";
import { makeHuman, animateHuman, collideCircle, HumanMesh } from "./humans";
import type { Box, Circle } from "./world";

// ---------------------------------------------------------------- weapons

export interface WeaponDef {
  id: string;
  name: string;
  melee: boolean;
  damage: number;
  rate: number; // seconds between shots
  range: number;
  pellets: number;
  spread: number;
  clip: number;
  twoHanded: boolean;
  price: number;
  ammoPrice: number;
  icon: string; // inline SVG path data drawn for this game
}

export const WEAPONS: WeaponDef[] = [
  { id: "punhos", name: "Punhos", melee: true, damage: 34, rate: 0.45, range: 1.7, pellets: 1, spread: 0, clip: 0, twoHanded: false, price: 0, ammoPrice: 0,
    icon: "M14 30c0-6 4-10 9-10h10c5 0 9 4 9 9v7c0 5-4 9-9 9H22c-5 0-8-4-8-9zM20 20v-6a3 3 0 016 0v6M27 20v-7a3 3 0 016 0v7M34 20v-6a3 3 0 016 0v7" },
  { id: "taco", name: "Taco", melee: true, damage: 60, rate: 0.7, range: 2.3, pellets: 1, spread: 0, clip: 0, twoHanded: true, price: 0, ammoPrice: 0,
    icon: "M10 46l4 4 30-30c3-3 3-8 0-11s-8-3-11 0z" },
  { id: "pistola", name: "Pistola", melee: false, damage: 34, rate: 0.28, range: 60, pellets: 1, spread: 0.012, clip: 15, twoHanded: false, price: 0, ammoPrice: 150,
    icon: "M8 18h36v8H26l-2 4h-6l-2 14H8l4-18H8z" },
  { id: "sub", name: "Submetralhadora", melee: false, damage: 22, rate: 0.085, range: 55, pellets: 1, spread: 0.03, clip: 30, twoHanded: true, price: 1500, ammoPrice: 300,
    icon: "M6 18h44v8H34v14h-6V26h-6l-2 8h-6l1-8H6z" },
  { id: "escopeta", name: "Escopeta", melee: false, damage: 18, rate: 0.85, range: 30, pellets: 7, spread: 0.07, clip: 6, twoHanded: true, price: 2500, ammoPrice: 350,
    icon: "M4 22h50v5H24l-4 10H8l4-10H4z" },
  { id: "fuzil", name: "Fuzil", melee: false, damage: 40, rate: 0.12, range: 120, pellets: 1, spread: 0.01, clip: 30, twoHanded: true, price: 5000, ammoPrice: 500,
    icon: "M2 20h52v6h-8v4h-8v-4H30l-3 12h-7l2-12H12l-4 8H2l2-8z" },
];

export class Arsenal {
  owned: boolean[];
  ammo: number[];
  slot = 0;
  cool = 0;
  lastShot = 0;
  constructor(saved?: { owned: boolean[]; ammo: number[] }) {
    this.owned = saved?.owned ?? WEAPONS.map((w) => w.price === 0);
    this.ammo = saved?.ammo ?? WEAPONS.map((w) => (w.id === "pistola" ? 60 : 0));
  }
  get w() {
    return WEAPONS[this.slot];
  }
  get armed() {
    return !this.w.melee;
  }
  select(i: number) {
    if (this.owned[i]) this.slot = i;
  }
}

// Simple gun/bat models parented to the right hand.
export function makeWeaponMesh(id: string) {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x1b1d20, metalness: 0.7, roughness: 0.35 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a4a24, roughness: 0.7 });
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    b.castShadow = true;
    g.add(b);
  };
  if (id === "taco") {
    const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.018, 0.85, 10), wood);
    bat.position.y = 0.38;
    g.add(bat);
  } else if (id === "pistola") {
    box(0.035, 0.05, 0.19, 0, 0.03, 0.06, metal);
    box(0.03, 0.1, 0.045, 0, -0.03, 0, metal);
  } else if (id === "sub") {
    box(0.045, 0.07, 0.36, 0, 0.03, 0.1, metal);
    box(0.03, 0.12, 0.04, 0, -0.05, 0.05, metal);
    box(0.03, 0.09, 0.04, 0, -0.03, -0.04, metal);
  } else if (id === "escopeta") {
    box(0.04, 0.05, 0.75, 0, 0.03, 0.22, metal);
    box(0.045, 0.07, 0.28, 0, -0.01, -0.2, wood);
    box(0.05, 0.05, 0.16, 0, -0.01, 0.3, wood);
  } else if (id === "fuzil") {
    box(0.045, 0.07, 0.7, 0, 0.03, 0.2, metal);
    box(0.035, 0.14, 0.05, 0, -0.07, 0.12, metal);
    box(0.04, 0.08, 0.22, 0, 0.0, -0.22, metal);
    box(0.02, 0.04, 0.1, 0, 0.09, 0.15, metal);
  }
  return g;
}

// ---------------------------------------------------------------- weapon wheel UI

export function createWheel(root: HTMLElement, onPick: (i: number) => void) {
  const el = document.createElement("div");
  el.id = "wheel";
  const R = 130;
  const items = WEAPONS.map((w, i) => {
    const a = (i / WEAPONS.length) * Math.PI * 2 - Math.PI / 2;
    const b = document.createElement("button");
    b.className = "slot";
    b.style.left = `calc(50% + ${Math.cos(a) * R}px)`;
    b.style.top = `calc(50% + ${Math.sin(a) * R}px)`;
    b.innerHTML = `<svg viewBox="0 0 56 56"><path d="${w.icon}" fill="currentColor"/></svg><span class="nm">${w.name}</span><span class="am"></span>`;
    b.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      onPick(i);
    });
    el.appendChild(b);
    return b;
  });
  const center = document.createElement("div");
  center.className = "center";
  el.appendChild(center);
  root.appendChild(el);
  return {
    open(arsenal: Arsenal) {
      items.forEach((b, i) => {
        const w = WEAPONS[i];
        b.classList.toggle("sel", i === arsenal.slot);
        b.classList.toggle("locked", !arsenal.owned[i]);
        (b.querySelector(".am") as HTMLElement).textContent = !arsenal.owned[i] ? `🔒 R$ ${w.price}` : w.melee ? "" : String(arsenal.ammo[i]);
      });
      center.innerHTML = `<b>${arsenal.w.name}</b><small>toque para escolher</small>`;
      el.classList.add("on");
    },
    close() {
      el.classList.remove("on");
    },
    get isOpen() {
      return el.classList.contains("on");
    },
  };
}

// ---------------------------------------------------------------- effects

export class Effects {
  scene: THREE.Scene;
  tracers: { line: THREE.Line; life: number }[] = [];
  flashes: { m: THREE.Mesh; life: number }[] = [];
  tracerMat = new THREE.LineBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.9 });
  flashMat = new THREE.MeshBasicMaterial({ color: 0xffc04d, transparent: true, opacity: 0.95, depthWrite: false });
  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }
  shot(from: THREE.Vector3, to: THREE.Vector3) {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, to]), this.tracerMat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.06 });
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), this.flashMat);
    f.position.copy(from);
    this.scene.add(f);
    this.flashes.push({ m: f, life: 0.05 });
  }
  update(dt: number) {
    for (const t of this.tracers) {
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
      }
    }
    this.tracers = this.tracers.filter((t) => t.life > 0);
    for (const f of this.flashes) {
      f.life -= dt;
      if (f.life <= 0) this.scene.remove(f.m);
    }
    this.flashes = this.flashes.filter((f) => f.life > 0);
  }
}

// Ray vs. vertical capsule-ish sphere targets: returns the nearest hit.
export function raycastTargets<T>(origin: THREE.Vector3, dir: THREE.Vector3, range: number, targets: { obj: T; center: THREE.Vector3; r: number }[]) {
  let best: { obj: T; dist: number } | null = null;
  for (const t of targets) {
    const oc = t.center.clone().sub(origin);
    const along = oc.dot(dir);
    if (along < 0 || along > range) continue;
    const closest = origin.clone().addScaledVector(dir, along);
    if (closest.distanceTo(t.center) < t.r && (!best || along < best.dist)) best = { obj: t.obj, dist: along };
  }
  return best;
}

// Distance at which a ray first enters a building box (for bullets hitting walls).
export function rayBoxes(origin: THREE.Vector3, dir: THREE.Vector3, range: number, boxes: Box[]) {
  let best = range;
  for (const b of boxes) {
    let t0 = 0,
      t1 = best;
    for (const [o, d, mn, mx] of [
      [origin.x, dir.x, b.minX, b.maxX],
      [origin.z, dir.z, b.minZ, b.maxZ],
    ] as const) {
      if (Math.abs(d) < 1e-6) {
        if (o < mn || o > mx) {
          t0 = Infinity;
          break;
        }
        continue;
      }
      let a = (mn - o) / d,
        c = (mx - o) / d;
      if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, c);
      if (t0 > t1) {
        t0 = Infinity;
        break;
      }
    }
    if (t0 < best && origin.y + dir.y * t0 < 40) best = t0;
  }
  return best;
}

// ---------------------------------------------------------------- armed NPCs (police on foot, gangs)

export class Gunman {
  mesh: HumanMesh;
  gun: THREE.Group;
  pos = new THREE.Vector3();
  heading = 0;
  phase = 0;
  health = 100;
  dead = false;
  deadT = 0;
  fireT = 1 + Math.random();
  kind: "cop" | "thug";
  holdRange: number;
  accuracy: number;
  home = new THREE.Vector3();

  constructor(scene: THREE.Scene, kind: "cop" | "thug", seed: number) {
    this.kind = kind;
    this.mesh =
      kind === "cop"
        ? makeHuman(seed, { shirt: 0x1f2a44, pants: 0x1a1f2b, cap: 0x111111, female: false })
        : makeHuman(seed, { shirt: [0xd62828, 0x111111, 0x6a4c93][seed % 3], pants: 0x222222, female: false });
    this.gun = makeWeaponMesh(kind === "cop" ? "pistola" : seed % 2 ? "sub" : "pistola");
    this.gun.position.y = -0.3;
    this.gun.rotation.x = -Math.PI / 2;
    this.mesh.rFore.add(this.gun);
    scene.add(this.mesh.group);
    this.holdRange = kind === "cop" ? 10 + Math.random() * 8 : 7 + Math.random() * 10;
    this.accuracy = kind === "cop" ? 0.32 : 0.25;
  }

  update(dt: number, t: number, target: THREE.Vector3, targetMoving: boolean, colliders: Box[], circles: Circle[], onShoot: (from: THREE.Vector3, hit: boolean) => void) {
    if (this.dead) {
      this.deadT += dt;
      this.mesh.group.rotation.x = Math.max(-Math.PI / 2, this.mesh.group.rotation.x - dt * 5);
      this.mesh.group.position.y = 0.3;
      return;
    }
    const to = target.clone().sub(this.pos).setY(0);
    const d = to.length();
    this.heading = Math.atan2(to.x, to.z);
    let moving = 0;
    if (d > this.holdRange) {
      this.pos.addScaledVector(to.normalize(), 4.2 * dt);
      moving = 2;
    }
    collideCircle(this.pos, 0.4, colliders, circles);
    this.phase += dt * 10 * (moving ? 1 : 0);
    animateHuman(this.mesh, this.phase, moving, t);
    // aim pose: arm straight at the target
    this.mesh.rArm.rotation.x = -1.45;
    this.mesh.rFore.rotation.x = -0.05;
    this.mesh.group.position.copy(this.pos);
    this.mesh.group.rotation.y = this.heading;
    this.fireT -= dt;
    if (d < 45 && this.fireT <= 0) {
      this.fireT = 0.9 + Math.random() * 0.9;
      const p = this.accuracy * (targetMoving ? 0.6 : 1) * (d < 12 ? 1.4 : 1);
      const from = this.pos.clone().add(new THREE.Vector3(Math.sin(this.heading) * 0.5, 1.45, Math.cos(this.heading) * 0.5));
      onShoot(from, Math.random() < p);
    }
  }

  hit(dmg: number) {
    if (this.dead) return false;
    this.health -= dmg;
    if (this.health <= 0) {
      this.dead = true;
      return true;
    }
    return false;
  }

  remove(scene: THREE.Scene) {
    scene.remove(this.mesh.group);
  }
}
