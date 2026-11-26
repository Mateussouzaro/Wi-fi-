import * as THREE from "three";
import type { Box, Circle } from "./world";
import { sign } from "./textures";

export type CarKind = "sedan" | "hatch" | "suv" | "taxi" | "police" | "sport";

interface Spec {
  len: number; width: number; wheelR: number; wzf: number; wzr: number;
  sill: number; bumperY: number; hoodY: number; beltY: number; trunkY: number; roofY: number;
  ws: number; roofF: number; roofR: number; rear: number; cab: number; hatchback: boolean;
}

// Dimensions in metres; x of the side profile runs from the tail (−) to the nose (+).
const SPECS: Record<"sedan" | "hatch" | "suv" | "sport", Spec> = {
  sedan: { len: 4.62, width: 1.78, wheelR: 0.33, wzf: 1.42, wzr: 1.3, sill: 0.3, bumperY: 0.58, hoodY: 0.86, beltY: 0.98, trunkY: 0.97, roofY: 1.46, ws: 0.92, roofF: 0.22, roofR: -0.98, rear: -1.62, cab: 0.86, hatchback: false },
  hatch: { len: 3.98, width: 1.72, wheelR: 0.31, wzf: 1.3, wzr: 1.15, sill: 0.3, bumperY: 0.56, hoodY: 0.84, beltY: 0.96, trunkY: 0.96, roofY: 1.47, ws: 0.78, roofF: 0.12, roofR: -1.62, rear: -1.92, cab: 0.86, hatchback: true },
  suv: { len: 4.68, width: 1.88, wheelR: 0.39, wzf: 1.45, wzr: 1.35, sill: 0.42, bumperY: 0.75, hoodY: 1.08, beltY: 1.2, trunkY: 1.2, roofY: 1.78, ws: 1.02, roofF: 0.42, roofR: -2.05, rear: -2.28, cab: 0.88, hatchback: true },
  sport: { len: 4.45, width: 1.9, wheelR: 0.34, wzf: 1.38, wzr: 1.35, sill: 0.24, bumperY: 0.45, hoodY: 0.7, beltY: 0.82, trunkY: 0.86, roofY: 1.22, ws: 0.66, roofF: -0.02, roofR: -0.82, rear: -1.75, cab: 0.8, hatchback: false },
};

const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x0c1218, metalness: 0.1, roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0.86 });
const tireMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
const rimMat = new THREE.MeshStandardMaterial({ color: 0xd4d7dc, metalness: 0.95, roughness: 0.22 });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 1, roughness: 0.12 });
const trimMat = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.55 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 });
const discMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.8, roughness: 0.45 });
let policeSign: THREE.Texture | null = null;
const plateTex: THREE.Texture[] = [];

// Brazilian Mercosur licence plate.
function plate(seed: number) {
  if (plateTex[seed % 6]) return plateTex[seed % 6];
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 84;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f7f7f7";
  g.fillRect(0, 0, 256, 84);
  g.fillStyle = "#1e4fa3";
  g.fillRect(0, 0, 256, 20);
  g.fillStyle = "#fff";
  g.font = "bold 14px sans-serif";
  g.textAlign = "center";
  g.fillText("BRASIL", 128, 15);
  g.fillStyle = "#009c3b";
  g.fillRect(226, 4, 20, 12);
  g.fillStyle = "#ffdf00";
  g.beginPath();
  g.moveTo(236, 5);
  g.lineTo(245, 10);
  g.lineTo(236, 15);
  g.lineTo(227, 10);
  g.fill();
  const L = "ABCDEFGHJKLMNPRSTUVWXYZ";
  const code = `${L[(seed * 7) % 23]}${L[(seed * 13) % 23]}${L[(seed * 5 + 3) % 23]}${seed % 10}${L[(seed * 3) % 23]}${(seed * 7) % 10}${(seed * 3 + 1) % 10}`;
  g.fillStyle = "#111";
  g.font = "bold 50px monospace";
  g.fillText(code, 128, 72);
  g.strokeStyle = "#111";
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, 253, 81);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  plateTex[seed % 6] = t;
  return t;
}

function extrudeShape(s: THREE.Shape, depth: number, bevel: number, segs = 4) {
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: segs, curveSegments: 10 });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2); // shape x (length) → world +z forward, shape depth → world x
  return g;
}

// Lower body: side silhouette with real wheel-arch cut-outs, curved bumpers and hood.
const BEVEL = 0.12;
function bodyShape(spec: Spec) {
  // the extrude bevel grows the outline by BEVEL everywhere, so draw it that much smaller
  const B = BEVEL;
  const sp = { ...spec, sill: spec.sill + B, hoodY: spec.hoodY - B, beltY: spec.beltY - B, trunkY: spec.trunkY - B };
  const h = spec.len / 2 - B;
  const s = new THREE.Shape();
  const rA = sp.wheelR + 0.07 + B;
  const a0 = Math.asin(THREE.MathUtils.clamp((sp.sill - sp.wheelR) / rA, -0.99, 0.99));
  const arch = (cx: number) => {
    s.lineTo(cx - rA * Math.cos(a0), sp.sill);
    s.absarc(cx, sp.wheelR, rA, Math.PI - a0, a0, true);
  };
  s.moveTo(-h + 0.14, sp.sill);
  arch(-sp.wzr);
  arch(sp.wzf);
  s.lineTo(h - 0.14, sp.sill);
  s.quadraticCurveTo(h + 0.02, sp.sill, h + 0.02, sp.sill + 0.16);
  s.lineTo(h + 0.02, sp.bumperY);
  s.quadraticCurveTo(h, sp.hoodY, h - 0.3, sp.hoodY + 0.01);
  s.quadraticCurveTo(sp.ws + 0.55, sp.beltY - 0.02, sp.ws, sp.beltY);
  s.lineTo(sp.rear, sp.beltY);
  if (sp.hatchback) {
    s.quadraticCurveTo(-h - 0.02, sp.beltY, -h - 0.02, sp.beltY - 0.18);
  } else {
    s.quadraticCurveTo(sp.rear - 0.35, sp.trunkY + 0.02, -h + 0.28, sp.trunkY);
    s.quadraticCurveTo(-h - 0.02, sp.trunkY - 0.01, -h - 0.02, sp.trunkY - 0.22);
  }
  s.lineTo(-h - 0.02, sp.sill + 0.16);
  s.quadraticCurveTo(-h - 0.02, sp.sill, -h + 0.14, sp.sill);
  return s;
}

function cabinShape(sp: Spec, inset = 0) {
  const s = new THREE.Shape();
  s.moveTo(sp.ws + 0.04, sp.beltY - 0.04);
  s.quadraticCurveTo(sp.roofF + 0.32, sp.roofY - 0.08 - inset, sp.roofF, sp.roofY - inset);
  s.lineTo(sp.roofR, sp.roofY - inset);
  s.quadraticCurveTo(sp.rear + 0.12, sp.roofY - 0.12 - inset, sp.rear - 0.02, sp.beltY - 0.04);
  s.closePath();
  return s;
}

// pillar/bar from a→b on both sides of the cabin
function bar(a: [number, number], b: [number, number], halfW: number, mat: THREE.Material, parent: THREE.Object3D, thick = 0.07) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  for (const sx of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, thick, len), mat);
    m.position.set(sx * halfW, (a[1] + b[1]) / 2, (a[0] + b[0]) / 2);
    m.rotation.x = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    parent.add(m);
  }
}

export const CAR_COLORS = [0xb3001b, 0x1d3557, 0xf1f1f1, 0x222222, 0x8d99ae, 0x2a9d8f, 0xe9c46a, 0x6a040f, 0x3a5a40, 0xc0c0c0, 0x14213d, 0xff7b00];
let carSeed = 1;
let contactTex: THREE.Texture | null = null;
// Soft blurred ambient-occlusion blob under the car.
function contactShadow() {
  if (contactTex) return contactTex;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.filter = "blur(10px)";
  g.fillStyle = "rgba(0,0,0,0.55)";
  g.fillRect(14, 14, 36, 100);
  contactTex = new THREE.CanvasTexture(c);
  return contactTex;
}

function makeWheel(r: number, side: number) {
  const spin = new THREE.Group();
  // rounded tyre profile turned around the axle
  const pts: THREE.Vector2[] = [];
  const w = 0.23;
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI;
    pts.push(new THREE.Vector2(r * 0.66 + Math.sin(a) * r * 0.34, (Math.cos(a) * w) / 2));
  }
  const tg = new THREE.LatheGeometry(pts, 28);
  tg.rotateZ(Math.PI / 2);
  const tire = new THREE.Mesh(tg, tireMat);
  tire.castShadow = true;
  spin.add(tire);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.5, r * 0.5, 0.03, 20), discMat);
  disc.rotation.z = Math.PI / 2;
  disc.position.x = -side * 0.04;
  spin.add(disc);
  const face = side * 0.1;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.68, r * 0.68, 0.2, 24, 1, true), rimMat);
  barrel.rotation.z = Math.PI / 2;
  spin.add(barrel);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.16, r * 0.18, 0.06, 12), rimMat);
  hub.rotation.z = Math.PI / 2;
  hub.position.x = face;
  spin.add(hub);
  for (let k = 0; k < 5; k++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.035, r * 0.56, 0.075), rimMat);
    sp.position.set(face - side * 0.01, 0, 0);
    sp.geometry.translate(0, r * 0.35, 0);
    sp.rotation.x = (k / 5) * Math.PI * 2;
    spin.add(sp);
  }
  return spin;
}

export function makeCarMesh(kind: CarKind, color: number) {
  const sp = SPECS[kind === "taxi" || kind === "police" ? "sedan" : kind];
  const seed = carSeed++;
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const paint = new THREE.MeshPhysicalMaterial({
    color: kind === "taxi" ? 0xf2c300 : kind === "police" ? 0xf6f6f6 : color,
    metalness: 0.6,
    roughness: 0.28,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
  });
  const W = sp.width;
  const h = sp.len / 2;
  const shell = new THREE.Mesh(extrudeShape(bodyShape(sp), W - 2 * BEVEL, BEVEL), paint);
  shell.castShadow = true;
  shell.receiveShadow = true;
  body.add(shell);
  // wheel-well liners so the arches read as dark cavities
  for (const z of [sp.wzf, -sp.wzr]) {
    const liner = new THREE.Mesh(new THREE.BoxGeometry(W - 0.32, sp.wheelR * 1.3, sp.wheelR * 2.3), darkMat);
    liner.position.set(0, sp.wheelR + 0.12, z);
    body.add(liner);
  }
  // greenhouse: tinted glass, painted roof panel and pillars
  const cabW = W * sp.cab;
  const glass = new THREE.Mesh(extrudeShape(cabinShape(sp, 0.05), cabW - 0.08, 0.04, 2), glassMat);
  body.add(glass);
  const roofS = new THREE.Shape();
  roofS.moveTo(sp.roofF + 0.06, sp.roofY - 0.035);
  roofS.lineTo(sp.roofF + 0.02, sp.roofY + 0.015);
  roofS.lineTo(sp.roofR - 0.02, sp.roofY + 0.015);
  roofS.lineTo(sp.roofR - 0.06, sp.roofY - 0.035);
  roofS.closePath();
  const roof = new THREE.Mesh(extrudeShape(roofS, cabW - 0.02, 0.03, 2), paint);
  roof.castShadow = true;
  body.add(roof);
  const pillar = kind === "sport" ? trimMat : paint;
  bar([sp.ws + 0.04, sp.beltY - 0.02], [sp.roofF, sp.roofY - 0.01], cabW / 2 + 0.005, pillar, body, 0.08);
  bar([sp.rear - 0.02, sp.beltY - 0.02], [sp.roofR, sp.roofY - 0.01], cabW / 2 + 0.005, pillar, body, sp.hatchback ? 0.16 : 0.12);
  const bx = (sp.ws + sp.rear) / 2 + 0.1;
  bar([bx, sp.beltY], [bx - 0.04, sp.roofY - 0.01], cabW / 2 + 0.006, trimMat, body, 0.09);
  // window frames along the belt + chrome strip
  bar([sp.ws, sp.beltY + 0.005], [sp.rear, sp.beltY + 0.005], cabW / 2 + 0.008, chromeMat, body, 0.025);

  // door seams, handles, side skirt
  const seamZ = sp.hatchback && kind === "sport" ? [sp.ws - 0.05, sp.rear + 0.25] : [sp.ws - 0.05, bx + 0.02, sp.rear + 0.15];
  for (const sx of [-1, 1]) {
    for (const z of seamZ) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.012, sp.beltY - sp.sill - 0.18, 0.012), darkMat);
      seam.position.set(sx * (W / 2 + 0.004), (sp.beltY + sp.sill) / 2 + 0.04, z);
      body.add(seam);
    }
    for (const z of [bx + 0.45, bx - 0.25].slice(0, seamZ.length - 1)) {
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.035, 0.18), chromeMat);
      handle.position.set(sx * (W / 2 + 0.012), sp.beltY - 0.12, z);
      body.add(handle);
    }
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, sp.wzf + sp.wzr - sp.wheelR * 2.4), trimMat);
    skirt.position.set(sx * (W / 2 - 0.01), sp.sill + 0.05, (sp.wzf - sp.wzr) / 2);
    body.add(skirt);
    // mirror on a short arm
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.13, 0.11), paint);
    mirror.position.set(sx * (W / 2 + 0.05), sp.beltY + 0.06, sp.ws - 0.12);
    const glassM = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.1), chromeMat);
    glassM.position.set(sx * (W / 2 + 0.05), sp.beltY + 0.06, sp.ws - 0.18);
    glassM.rotation.y = Math.PI;
    body.add(mirror, glassM);
  }

  // front: grille, headlights, bumper lip, plate
  const head = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3d6, emissiveIntensity: 0.6, roughness: 0.1 });
  const tail = new THREE.MeshStandardMaterial({ color: 0x5a0000, emissive: 0xff1a1a, emissiveIntensity: 0.5, roughness: 0.2 });
  const grille = new THREE.Mesh(new THREE.BoxGeometry(W * 0.46, (sp.hoodY - sp.bumperY) * 0.6, 0.05), trimMat);
  grille.position.set(0, (sp.hoodY + sp.bumperY) / 2 - 0.03, h + 0.02);
  const gbar = new THREE.Mesh(new THREE.BoxGeometry(W * 0.46, 0.025, 0.02), chromeMat);
  gbar.position.set(0, grille.position.y + 0.02, h + 0.05);
  body.add(grille, gbar);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(W - 0.3, 0.07, 0.1), trimMat);
  lip.position.set(0, sp.sill + 0.06, h - 0.02);
  body.add(lip);
  for (const sx of [-1, 1]) {
    const bez = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.13, 0.05), chromeMat);
    bez.position.set(sx * (W / 2 - 0.32), sp.hoodY - 0.08, h - 0.02);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.09, 0.04), head);
    lens.position.set(sx * (W / 2 - 0.32), sp.hoodY - 0.08, h + 0.005);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.05), tail);
    const ty = (sp.hatchback ? sp.beltY - 0.12 : sp.trunkY - 0.1);
    tl.position.set(sx * (W / 2 - 0.3), ty, -h - 0.005);
    const wrap = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.22), tail);
    wrap.position.set(sx * (W / 2 - 0.04), ty, -h + 0.12);
    body.add(bez, lens, tl, wrap);
  }
  const plateMat = new THREE.MeshStandardMaterial({ map: plate(seed), roughness: 0.5 });
  const pf = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.13), plateMat);
  pf.position.set(0, sp.bumperY - 0.1, h + 0.035);
  const pr = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.13), plateMat);
  pr.position.set(0, (sp.hatchback ? sp.bumperY : sp.trunkY - 0.28), -h - 0.035);
  pr.rotation.y = Math.PI;
  body.add(pf, pr);
  // exhaust
  const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.18, 10), chromeMat);
  ex.rotation.x = Math.PI / 2;
  ex.position.set(W / 2 - 0.45, sp.sill + 0.02, -h + 0.02);
  body.add(ex);

  let siren: THREE.MeshStandardMaterial[] = [];
  if (kind === "taxi") {
    for (const sx of [-1, 1]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.11, sp.len * 0.62), new THREE.MeshStandardMaterial({ color: 0x1e5fb4, roughness: 0.4 }));
      band.position.set(sx * (W / 2 + 0.006), sp.beltY - 0.25, -0.05);
      body.add(band);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.17, 0.22), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.4 }));
    top.position.set(0, sp.roofY + 0.1, (sp.roofF + sp.roofR) / 2);
    body.add(top);
  }
  if (kind === "police") {
    const doorMat = new THREE.MeshPhysicalMaterial({ color: 0x0e0e0e, metalness: 0.5, roughness: 0.3, clearcoat: 1 });
    policeSign ??= sign("POLÍCIA", "#0e0e0e", "#ffffff");
    const sm = new THREE.MeshStandardMaterial({ map: policeSign });
    for (const sx of [-1, 1]) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.012, sp.beltY - sp.sill - 0.22, sp.ws - sp.rear - 0.2), doorMat);
      d.position.set(sx * (W / 2 + 0.006), (sp.beltY + sp.sill) / 2 + 0.02, (sp.ws + sp.rear) / 2);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.34), sm);
      p.position.set(sx * (W / 2 + 0.014), (sp.beltY + sp.sill) / 2 + 0.02, (sp.ws + sp.rear) / 2);
      p.rotation.y = (sx * Math.PI) / 2;
      body.add(d, p);
    }
    const red = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff0000, emissiveIntensity: 0 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x000055, emissive: 0x1a4dff, emissiveIntensity: 0 });
    siren = [red, blue];
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.3), trimMat);
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, 0.26), red);
    l.position.set(-0.3, 0.08, 0);
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, 0.26), blue);
    r.position.set(0.3, 0.08, 0);
    const lb = new THREE.Group();
    lb.add(base, l, r);
    lb.position.set(0, sp.roofY + 0.04, sp.roofF - 0.28);
    body.add(lb);
  }

  // wheels
  const wheels: THREE.Group[] = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const w = new THREE.Group();
    w.add(makeWheel(sp.wheelR, sx));
    w.position.set(sx * (W / 2 - 0.16), sp.wheelR, sz > 0 ? sp.wzf : -sp.wzr);
    g.add(w);
    wheels.push(w);
  }
  // soft contact shadow under the car
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.5, sp.len + 0.6), new THREE.MeshBasicMaterial({ map: contactShadow(), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  g.add(shadow);
  return { group: g, body, wheels, prof: { len: sp.len, width: W, wheelR: sp.wheelR }, head, tail, siren, paint };
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
