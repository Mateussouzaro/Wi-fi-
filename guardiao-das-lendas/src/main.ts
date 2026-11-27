import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { buildWorld, heightAt, P, LAKE_R, ISLAND_R, Box } from "./world";
import { makeHuman, animateHuman, HumanMesh } from "./people";
import * as S from "./story";
import { VOICE } from "./voice";
import { initAudio, setLevel, sfx, blip, step as footstep } from "./sound";

const $ = (id: string) => document.getElementById(id)!;

// ------------------------------------------------------------------ renderer
let quality: "alta" | "baixa";
try {
  quality = (localStorage.getItem("lendas.q") as "alta" | "baixa") || (/Android|iPhone|iPad/i.test(navigator.userAgent) ? "baixa" : "alta");
} catch {
  quality = "baixa";
}
const hi = quality === "alta";
const renderer = new THREE.WebGLRenderer({ antialias: hi, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, hi ? 2 : 1.25));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.62;
renderer.outputColorSpace = THREE.SRGBColorSpace;
$("stage").appendChild(renderer.domElement);
const W = buildWorld(quality);
const scene = W.scene;
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 4000);
let composer: EffectComposer | null = null;
if (hi) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.4, 0.5, 0.85));
  composer.addPass(new OutputPass());
}
addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  composer?.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

// ------------------------------------------------------------------ helpers
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(a.x - b.x, a.z - b.z);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const angDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const mat = (color: number, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o });

// ------------------------------------------------------------------ hero
const kaua = makeHuman(5, { female: false, shirt: 0xefe6d2, pants: 0x5a3e2a, skin: 0xa0673a, hair: "short", hairColor: 0x120c08 });
const sword = new THREE.Group();
{
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.95, 0.02), mat(0xdfe6ee, { metalness: 0.9, roughness: 0.2 }));
  blade.position.y = -0.62;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.06), mat(0xc9a227, { metalness: 1, roughness: 0.3 }));
  guard.position.y = -0.13;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.16), mat(0x5a3a22));
  grip.position.y = -0.04;
  sword.add(blade, guard, grip);
  sword.position.set(0, -0.28, 0.04);
  sword.rotation.x = Math.PI / 2.4;
  kaua.rFore.add(sword);
}
const bow = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.025, 6, 20, Math.PI), mat(0x7a4a22));
bow.rotation.set(0, Math.PI / 2, Math.PI / 2);
bow.position.set(0, -0.3, 0.1);
bow.visible = false;
kaua.lFore.add(bow);
kaua.group.traverse((o) => (o.castShadow = true));
scene.add(kaua.group);

const hero = { pos: V(-4, 0, 2), heading: Math.PI, speed: 0, phase: 0, hp: 6, maxHp: 6, inv: 0, atkT: 0, atkHit: false, combo: 0, rollT: 0, rollDir: V(), bowT: 0, knock: V() };

// ------------------------------------------------------------------ NPCs
const vovo = makeHuman(44, { female: true, shirt: 0x9b5de5, pants: 0x6a4c93, skin: 0x5c3a21, hair: "bun", hairColor: 0xdddddd });
vovo.group.position.set(P.vovo.x, heightAt(P.vovo.x, P.vovo.z), P.vovo.z);
vovo.group.rotation.y = 0.3;
scene.add(vovo.group);
const saci = makeHuman(77, { female: false, shirt: 0x3b2416, pants: 0xd62828, skin: 0x3b2416, cap: 0xd62828 });
saci.lLeg.visible = false;
saci.group.scale.setScalar(0.82);
saci.group.position.set(P.saci.x, heightAt(P.saci.x, P.saci.z), P.saci.z);
scene.add(saci.group);
const swirl = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.2, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xd8c8a0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
swirl.rotation.x = Math.PI;
swirl.position.y = 1.1;
saci.group.add(swirl);
[vovo, saci].forEach((h) => h.group.traverse((o) => (o.castShadow = true)));

// ------------------------------------------------------------------ enemies
type Kind = "capanga" | "sombra" | "curupira" | "iara" | "boitata" | "coronel";
interface Enemy {
  kind: Kind;
  h?: HumanMesh;
  obj: THREE.Object3D;
  pos: THREE.Vector3;
  heading: number;
  hp: number;
  maxHp: number;
  t: number;
  state: string;
  hurt: number;
  home: THREE.Vector3;
  dead: boolean;
  phase: number;
  vel: THREE.Vector3;
  boss: boolean;
  segs?: THREE.Mesh[];
  trail?: THREE.Vector3[];
  tag?: string;
}
const enemies: Enemy[] = [];
const bodyMats = new WeakMap<Enemy, THREE.MeshStandardMaterial[]>();
function remember(e: Enemy) {
  const ms: THREE.MeshStandardMaterial[] = [];
  e.obj.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m && "emissive" in m) {
      const c = m.clone();
      (o as THREE.Mesh).material = c;
      ms.push(c);
    }
  });
  bodyMats.set(e, ms);
}
function spawn(kind: Kind, x: number, z: number, tag?: string): Enemy {
  let h: HumanMesh | undefined;
  let obj: THREE.Object3D;
  const hp = { capanga: 3, sombra: 2, curupira: 8, iara: 6, boitata: 6, coronel: 12 }[kind];
  if (kind === "boitata") {
    const g = new THREE.Group();
    obj = g;
    scene.add(g);
  } else {
    if (kind === "capanga") h = makeHuman(100 + enemies.length * 7, { female: false, shirt: [0x6b705c, 0x3d405b, 0x7a4a2b][enemies.length % 3], pants: 0x2b2b2b, cap: [0x222222, 0x5a3e2a, 0x7a1f1f][enemies.length % 3] });
    else if (kind === "sombra") h = makeHuman(200 + enemies.length, { female: false, shirt: 0x120a1e, pants: 0x120a1e, skin: 0x1a1028, hair: "bald" });
    else if (kind === "curupira") h = makeHuman(300, { female: false, shirt: 0x5a7a2a, pants: 0x6b4a22, skin: 0x7a8f3a, hair: "afro", hairColor: 0xff5a00 });
    else if (kind === "iara") h = makeHuman(400, { female: true, shirt: 0x2a9d8f, pants: 0x1aa6b7, skin: 0x8d5524, hair: "long", hairColor: 0x0a0a0a });
    else h = makeHuman(500, { female: false, shirt: 0xf4f1e8, pants: 0xf4f1e8, skin: 0xe0ac69, cap: 0x2b2b2b });
    obj = h.group;
    // weapons and features
    if (kind === "capanga") {
      const mach = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.12), mat(0xbfc5cc, { metalness: 0.8, roughness: 0.3 }));
      mach.position.set(0, -0.5, 0.05);
      h.rFore.add(mach);
    }
    if (kind === "sombra") {
      for (const sx of [-0.04, 0.04]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), new THREE.MeshBasicMaterial({ color: 0xc77dff }));
        eye.position.set(sx, 0.62, 0.1);
        h.torso.add(eye);
      }
    }
    if (kind === "curupira") {
      // the flaming hair glows
      h.group.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (m && m.color && m.color.getHex() === 0xff5a00) {
          m.emissive = new THREE.Color(0xff3c00);
          m.emissiveIntensity = 1.2;
        }
      });
      // backward feet: turn the shins around
      h.lShin.rotation.y = h.rShin.rotation.y = Math.PI;
    }
    if (kind === "iara") {
      h.lLeg.visible = h.rLeg.visible = false;
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.2, 10), mat(0x1aa6b7, { metalness: 0.4, roughness: 0.3, emissive: 0x0a4a55, emissiveIntensity: 0.4 }));
      tail.rotation.x = Math.PI;
      tail.position.y = -0.55;
      h.hips.add(tail);
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.3, 3), tail.material);
      fin.position.y = -1.2;
      fin.scale.z = 0.2;
      h.hips.add(fin);
    }
    if (kind === "coronel") {
      const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 16), mat(0x2b2b2b));
      hat.position.y = 0.78;
      h.torso.add(hat);
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.7), mat(0x3a2a1a));
      gun.position.set(0, -0.45, 0.25);
      h.rFore.add(gun);
      h.group.scale.setScalar(1.08);
    }
    h.group.traverse((o) => (o.castShadow = true));
    if (kind === "sombra")
      h.group.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (m && m.color && m.color.getHex() !== 0xc77dff) {
          m.transparent = true;
          m.opacity = 0.82;
        }
      });
    scene.add(h.group);
  }
  const e: Enemy = { kind, h, obj, pos: V(x, 0, z), heading: 0, hp, maxHp: hp, t: Math.random() * 2, state: "idle", hurt: 0, home: V(x, 0, z), dead: false, phase: 0, vel: V(), boss: ["curupira", "iara", "boitata", "coronel"].includes(kind), tag };
  if (kind === "boitata") {
    e.segs = [];
    e.trail = [];
    for (let i = 0; i < 16; i++) {
      const r = i === 0 ? 1.15 : 0.95 - i * 0.035;
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshStandardMaterial({ color: i === 0 ? 0xffb347 : 0xff6a00, emissive: i === 0 ? 0xff7a00 : 0xff3c00, emissiveIntensity: 1.6 - i * 0.05, roughness: 0.5 }));
      m.castShadow = true;
      obj.add(m);
      e.segs.push(m);
    }
    // eyes
    for (const sx of [-0.45, 0.45]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfff3b0 }));
      eye.position.set(sx, 0.4, 0.9);
      e.segs[0].add(eye);
    }
    const fl = new THREE.PointLight(0xff7a00, 40, 22, 1.5);
    e.segs[0].add(fl);
    for (let i = 0; i < 60; i++) e.trail.push(V(x, 0, z + i * 0.3));
  }
  remember(e);
  enemies.push(e);
  return e;
}
function clearEnemies(filter: (e: Enemy) => boolean) {
  for (const e of enemies) if (filter(e)) {
    e.dead = true;
    e.obj.visible = false;
  }
}

// projectiles
interface Shot {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  hostile: boolean;
}
const shots: Shot[] = [];
const arrowG = new THREE.CylinderGeometry(0.03, 0.03, 0.9, 5);
arrowG.rotateX(Math.PI / 2);
function shoot(from: THREE.Vector3, dir: THREE.Vector3, hostile: boolean, kind: "arrow" | "orb" | "bullet") {
  const m =
    kind === "arrow"
      ? new THREE.Mesh(arrowG, mat(0xd9c9a0))
      : kind === "orb"
        ? new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), new THREE.MeshStandardMaterial({ color: 0x48cae4, emissive: 0x0096c7, emissiveIntensity: 1.2, transparent: true, opacity: 0.85 }))
        : new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
  m.position.copy(from);
  m.lookAt(from.clone().add(dir));
  scene.add(m);
  const sp = kind === "arrow" ? 32 : kind === "orb" ? 12 : 20;
  shots.push({ mesh: m, vel: dir.clone().normalize().multiplyScalar(sp), life: kind === "arrow" ? 1.2 : 3, hostile });
}
// hearts dropped by enemies
const hearts: THREE.Mesh[] = [];
const heartShape = new THREE.Shape();
heartShape.moveTo(0, -0.3);
heartShape.bezierCurveTo(-0.5, 0, -0.35, 0.4, 0, 0.18);
heartShape.bezierCurveTo(0.35, 0.4, 0.5, 0, 0, -0.3);
const heartG = new THREE.ExtrudeGeometry(heartShape, { depth: 0.12, bevelEnabled: false });
function dropHeart(p: THREE.Vector3) {
  const m = new THREE.Mesh(heartG, new THREE.MeshStandardMaterial({ color: 0xe63946, emissive: 0xe63946, emissiveIntensity: 0.6 }));
  m.position.set(p.x, groundY(p.x, p.z) + 0.6, p.z);
  scene.add(m);
  hearts.push(m);
}
// hit sparks
const sparks: { m: THREE.Mesh; v: THREE.Vector3; life: number }[] = [];
const sparkG = new THREE.TetrahedronGeometry(0.1);
function burst(p: THREE.Vector3, color: number, n = 10) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(sparkG, new THREE.MeshBasicMaterial({ color }));
    m.position.copy(p);
    scene.add(m);
    sparks.push({ m, v: V((Math.random() - 0.5) * 8, Math.random() * 6, (Math.random() - 0.5) * 8), life: 0.5 + Math.random() * 0.3 });
  }
}

// ------------------------------------------------------------------ state + save
interface Save {
  step: number;
  bow: boolean;
  amulets: number;
  keys: number;
  chests: boolean[];
  torches: boolean[];
}
let st: Save = { step: 0, bow: false, amulets: 0, keys: 0, chests: [false, false], torches: [false, false, false] };
let busy = true,
  started = false,
  boss: Enemy | null = null;
function persist() {
  try {
    localStorage.setItem("lendas.save", JSON.stringify(st));
  } catch {
    /* ignore */
  }
}
function loadSave(): Save | null {
  try {
    const s = localStorage.getItem("lendas.save");
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ collisions and ground
function boxOff(id: string) {
  for (const b of W.boxes) if (b.id === id) b.off = true;
}
function groundY(x: number, z: number) {
  const h = heightAt(x, z);
  if (W.bridgeUp > 0.98 && W.onBridge(x, z)) return Math.max(h, 0.75);
  return h;
}
function walkable(x: number, z: number) {
  if (W.bridgeUp > 0.98 && W.onBridge(x, z)) return true;
  return heightAt(x, z) > -0.25;
}
function collide(p: THREE.Vector3, r = 0.4) {
  for (const b of W.boxes as Box[]) {
    if (b.off) continue;
    const dx = p.x - b.x,
      dz = p.z - b.z;
    const ox = b.hw + r - Math.abs(dx),
      oz = b.hd + r - Math.abs(dz);
    if (ox > 0 && oz > 0) {
      if (ox < oz) p.x += Math.sign(dx || 1) * ox;
      else p.z += Math.sign(dz || 1) * oz;
    }
  }
  for (const c of W.circs) {
    const dx = p.x - c.x,
      dz = p.z - c.z;
    const d = Math.hypot(dx, dz);
    if (d < c.r + r && d > 1e-4) {
      p.x = c.x + (dx / d) * (c.r + r);
      p.z = c.z + (dz / d) * (c.r + r);
    }
  }
  // pushable blocks are solid
  for (const b of W.blocks) {
    const dx = p.x - b.pos.x,
      dz = p.z - b.pos.z;
    const ox = 0.9 + r - Math.abs(dx),
      oz = 0.9 + r - Math.abs(dz);
    if (ox > 0 && oz > 0) {
      if (ox < oz) p.x += Math.sign(dx || 1) * ox;
      else p.z += Math.sign(dz || 1) * oz;
    }
  }
}

// ------------------------------------------------------------------ input
const ctl = { x: 0, y: 0 };
let jid: number | null = null,
  jx = 0,
  jy = 0;
const stick = $("stick"),
  knob = $("knob");
$("stage").addEventListener("pointerdown", (e) => {
  initAudio();
  if (busy) {
    dlgSkip?.();
    return;
  }
  if (jid === null && e.clientX < innerWidth * 0.55) {
    jid = e.pointerId;
    jx = e.clientX;
    jy = e.clientY;
    stick.style.left = `${jx - 60}px`;
    stick.style.top = `${jy - 60}px`;
    stick.classList.add("on");
  }
});
addEventListener("pointermove", (e) => {
  if (e.pointerId !== jid) return;
  let dx = e.clientX - jx,
    dy = e.clientY - jy;
  const l = Math.hypot(dx, dy);
  if (l > 50) {
    dx = (dx / l) * 50;
    dy = (dy / l) * 50;
  }
  knob.style.transform = `translate(${dx}px,${dy}px)`;
  ctl.x = dx / 50;
  ctl.y = dy / 50;
});
const up = (e: PointerEvent) => {
  if (e.pointerId !== jid) return;
  jid = null;
  ctl.x = ctl.y = 0;
  knob.style.transform = "";
  stick.classList.remove("on");
};
addEventListener("pointerup", up);
addEventListener("pointercancel", up);
const press = (id: string, fn: () => void) =>
  $(id).addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    e.preventDefault();
    initAudio();
    if (!busy) fn();
  });
press("bAtk", attack);
press("bRoll", roll);
press("bBow", fireBow);
press("bAct", () => near?.act());
const keys = new Set<string>();
addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  keys.add(k);
  if (busy) {
    if (k === " " || k === "enter") dlgSkip?.();
    return;
  }
  if (k === "j" || k === " ") attack();
  if (k === "k" || k === "shift") roll();
  if (k === "l") fireBow();
  if (k === "e") near?.act();
});
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

// ------------------------------------------------------------------ actions
function attack() {
  if (hero.atkT > 0.12 || hero.rollT > 0) return;
  hero.combo = hero.atkT > 0 ? (hero.combo + 1) % 3 : 0;
  hero.atkT = 0.32;
  hero.atkHit = false;
  sfx("swish");
}
function roll() {
  if (hero.rollT > 0) return;
  hero.rollT = 0.38;
  const mv = moveDir();
  hero.rollDir.copy(mv.lengthSq() > 0.01 ? mv.normalize() : V(Math.sin(hero.heading), 0, Math.cos(hero.heading)));
  hero.inv = Math.max(hero.inv, 0.4);
}
function fireBow() {
  if (!st.bow || hero.bowT > 0) return;
  hero.bowT = 0.55;
  // auto-aim at the nearest enemy in front
  let dir = V(Math.sin(hero.heading), 0, Math.cos(hero.heading));
  let best = 24;
  for (const e of enemies)
    if (!e.dead && e.obj.visible) {
      const tp = e.kind === "boitata" ? e.segs![0].getWorldPosition(V()) : e.pos;
      const d = flat(tp, hero.pos);
      const a = Math.abs(angDiff(Math.atan2(tp.x - hero.pos.x, tp.z - hero.pos.z), hero.heading));
      if (d < best && a < 0.7) {
        best = d;
        dir = V(tp.x - hero.pos.x, 0, tp.z - hero.pos.z).normalize();
      }
    }
  hero.heading = Math.atan2(dir.x, dir.z);
  shoot(hero.pos.clone().setY(hero.pos.y + 1.3).addScaledVector(dir, 0.6), dir, false, "arrow");
  sfx("arrow");
}
function moveDir() {
  let mx = ctl.x,
    my = ctl.y;
  if (keys.has("w") || keys.has("arrowup")) my = -1;
  if (keys.has("s") || keys.has("arrowdown")) my = 1;
  if (keys.has("a") || keys.has("arrowleft")) mx = -1;
  if (keys.has("d") || keys.has("arrowright")) mx = 1;
  return V(mx, 0, my);
}
function damageHero(n: number, from: THREE.Vector3) {
  if (hero.inv > 0 || busy) return;
  hero.hp -= n;
  hero.inv = 1.1;
  hero.knock.set(hero.pos.x - from.x, 0, hero.pos.z - from.z).normalize().multiplyScalar(9);
  sfx("hurt");
  flashScreen();
  hud();
  if (hero.hp <= 0) died();
}
function flashScreen() {
  $("hurt").classList.remove("on");
  void ($("hurt") as HTMLElement).offsetWidth;
  $("hurt").classList.add("on");
}
function damageEnemy(e: Enemy, n: number, from: THREE.Vector3) {
  if (e.dead || e.hurt > 0.15) return;
  // the Boitatá only gets hurt while stunned; the Iara only above water
  if (e.kind === "boitata" && e.state !== "stun") {
    sfx("hit");
    burst(e.segs![0].getWorldPosition(V()), 0xffd166, 4);
    return;
  }
  if (e.kind === "iara" && e.state !== "up") return;
  e.hp -= n;
  e.hurt = 0.3;
  sfx("hit");
  const hp = e.kind === "boitata" ? e.segs![0].getWorldPosition(V()) : e.pos.clone().setY(e.pos.y + 1.2);
  burst(hp, e.kind === "sombra" ? 0xc77dff : 0xffffff, 8);
  if (!e.boss) e.vel.set(e.pos.x - from.x, 0, e.pos.z - from.z).normalize().multiplyScalar(10);
  if (e.boss) hud();
  if (e.hp <= 0) {
    e.dead = true;
    burst(hp, 0xffe066, 20);
    if (!e.boss) {
      sfx("die");
      e.obj.visible = false;
      if (Math.random() < 0.45) dropHeart(e.pos);
    } else bossDefeated(e);
  }
}

// ------------------------------------------------------------------ dialogue
const voice = new Audio();
let dlgSkip: (() => void) | null = null;
function say(lines: S.Line[]) {
  return new Promise<void>((resolve) => {
    const was = busy;
    busy = true;
    let i = 0;
    const next = () => {
      if (i >= lines.length) {
        $("sub").classList.remove("on");
        dlgSkip = null;
        busy = was && !started ? true : cineOn;
        resolve();
        return;
      }
      const l = lines[i++];
      const c = S.CAST[l.who];
      $("subFace").textContent = c?.face ?? "💬";
      ($("subFace") as HTMLElement).style.borderColor = c?.color ?? "#fff";
      $("subWho").innerHTML = `${l.who === "Vovó" ? "Vovó Benedita" : l.who}${c?.role && l.who !== "Vovó" ? `<small> • ${c.role}</small>` : ""}`;
      ($("subWho") as HTMLElement).style.color = c?.color ?? "#fff";
      $("subText").textContent = l.text;
      $("sub").classList.add("on");
      let done = false,
        timer = 0;
      const go = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        voice.onended = null;
        voice.pause();
        next();
      };
      dlgSkip = go;
      voice.src = VOICE[l.voice] ?? "";
      voice.onended = () => (timer = window.setTimeout(go, 400));
      voice.play().catch(() => (timer = window.setTimeout(go, 1400 + l.text.length * 55)));
      timer = window.setTimeout(go, 3000 + l.text.length * 90);
    };
    next();
  });
}
$("sub").addEventListener("pointerdown", (e) => {
  e.stopPropagation();
  dlgSkip?.();
});

// ------------------------------------------------------------------ camera
let cineOn = false;
let cineCam: { from: THREE.Vector3; to: THREE.Vector3; lf: THREE.Vector3; lt: THREE.Vector3; t: number; dur: number } | null = null;
function cine(from: number[], to: number[], lf: number[], lt: number[], dur: number) {
  cineCam = { from: V(...from), to: V(...to), lf: V(...lf), lt: V(...lt), t: 0, dur };
  cineOn = true;
  busy = true;
  document.body.classList.add("cine");
}
function endCine() {
  cineCam = null;
  cineOn = false;
  busy = false;
  document.body.classList.remove("cine");
}
function fade(on: boolean, ms = 800) {
  $("fade").style.transitionDuration = `${ms}ms`;
  $("fade").classList.toggle("on", on);
  return new Promise<void>((r) => setTimeout(r, ms));
}
function banner(t: string, sub = "") {
  $("banner").innerHTML = `${t}${sub ? `<small>${sub}</small>` : ""}`;
  $("banner").classList.remove("on");
  void ($("banner") as HTMLElement).offsetWidth;
  $("banner").classList.add("on");
}

// ------------------------------------------------------------------ HUD
function hud() {
  let h = "";
  for (let i = 0; i < hero.maxHp; i++) h += `<span class="${i < hero.hp ? "full" : ""}">❤</span>`;
  $("hearts").innerHTML = h;
  let a = "";
  for (let i = 0; i < 3; i++) a += `<span class="${i < st.amulets ? "on" : ""}"></span>`;
  $("amulets").innerHTML = a;
  $("keys").textContent = st.keys > 0 && st.step <= 9 ? `🗝️ ${st.keys}/2` : "";
  $("obj").textContent = S.OBJ[st.step] ?? "";
  $("obj").classList.toggle("on", !!S.OBJ[st.step]);
  $("bBow").classList.toggle("on", st.bow);
  if (boss && !boss.dead) {
    $("boss").classList.add("on");
    $("bossName").textContent = { curupira: "CURUPIRA ENFEITIÇADO", iara: "IARA, A MÃE D'ÁGUA", boitata: "BOITATÁ", coronel: "CORONEL FERRABRÁS", capanga: "", sombra: "" }[boss.kind];
    ($("bossFill") as HTMLElement).style.width = `${(Math.max(0, boss.hp) / boss.maxHp) * 100}%`;
  } else $("boss").classList.remove("on");
}

// ------------------------------------------------------------------ story flow
function setStep(n: number) {
  st.step = n;
  persist();
  hud();
}
async function intro() {
  W.setTime("dia");
  cine([170, 90, 170], [60, 50, 90], [0, 0, 0], [0, 4, 0], 20);
  await fade(false, 1500);
  await say(S.INTRO.slice(0, 3));
  cine([-2, 5, 6], [-3, 4, 4.5], [P.vovo.x, 1.4, P.vovo.z], [P.vovo.x, 1.4, P.vovo.z], 14);
  hero.pos.set(-4.5, 0, -0.5);
  hero.heading = -2.4;
  await say(S.INTRO.slice(3));
  endCine();
  setStep(1);
  spawnOverworld();
  banner("A Ilha das Lendas", "Fale com o Saci");
}
function spawnOverworld() {
  // capangas on the east and west paths; shadows in the forest
  for (const [x, z] of [[34, 4], [40, -3], [-36, 3], [-44, -4], [-50, 5], [4, 46], [-3, 52]]) spawn("capanga", x, z);
  for (const [x, z] of [[-6, -60], [5, -68], [-4, -76], [8, -54]]) spawn("sombra", x, z);
}
async function talkSaci() {
  busy = true;
  cine([P.saci.x - 3, 3, P.saci.z + 5], [P.saci.x - 2, 2.6, P.saci.z + 4], [P.saci.x, 1.2, P.saci.z], [P.saci.x, 1.2, P.saci.z], 10);
  await say(S.SACI1);
  endCine();
  setStep(2);
}
async function startCurupira() {
  setStep(4);
  busy = true;
  const c = spawn("curupira", P.forest.x, P.forest.z - 6);
  boss = c;
  sfx("roar");
  cine([P.forest.x, 8, P.forest.z + 14], [P.forest.x, 6, P.forest.z + 10], [P.forest.x, 1, P.forest.z - 6], [P.forest.x, 1.4, P.forest.z - 6], 6);
  await say(S.CURUPIRA_IN);
  endCine();
  hud();
  setLevel("music", 0.5, 1);
}
async function bossDefeated(e: Enemy) {
  boss = null;
  hud();
  setLevel("music", 0.15, 2);
  busy = true;
  sfx("chest");
  await wait(700);
  if (e.kind === "curupira") {
    e.state = "calm";
    st.bow = true;
    st.amulets = 1;
    setStep(5);
    bow.visible = true;
    await say(S.CURUPIRA_OUT);
    banner("Você ganhou o ARCO", "Toque em 🏹 para atirar");
    e.obj.visible = false;
  } else if (e.kind === "iara") {
    st.amulets = 2;
    setStep(8);
    await say(S.IARA_OUT);
    e.obj.visible = false;
  } else if (e.kind === "boitata") {
    st.amulets = 3;
    setStep(11);
    await say(S.BOITATA_OUT);
    e.obj.visible = false;
    W.setTime("tarde");
  } else if (e.kind === "coronel") {
    await ending();
    return;
  }
  hero.hp = hero.maxHp;
  hud();
  busy = false;
}
function setPlates() {
  W.plates.forEach((p, i) => ((p.material as THREE.MeshStandardMaterial).emissiveIntensity = W.blocks[i].done ? 1.4 : 0.15));
}
async function bridgeRise() {
  busy = true;
  setStep(7);
  sfx("gate");
  cine([P.bridgeFrom.x - 6, 10, 16], [P.bridgeFrom.x + 4, 9, 14], [P.bridgeFrom.x + 10, 0, 0], [P.island.x, 0, 0], 6);
  const t0 = performance.now();
  await new Promise<void>((r) => {
    const tick = () => {
      W.bridgeUp = Math.min(1, (performance.now() - t0) / 4000);
      if (W.bridgeUp < 1) requestAnimationFrame(tick);
      else r();
    };
    tick();
  });
  await say(S.BRIDGE);
  endCine();
}
async function startIara() {
  busy = true;
  const i = spawn("iara", P.island.x + 14, P.island.z);
  boss = i;
  i.state = "up";
  i.t = 0;
  cine([P.island.x - 4, 6, 10], [P.island.x - 2, 5, 8], [P.island.x + 12, 1, 0], [P.island.x + 13, 1.5, 0], 5);
  await say(S.IARA_IN);
  endCine();
  hud();
  setLevel("music", 0.5, 1);
}
async function openChest(k: number) {
  busy = true;
  W.chests[k].open = true;
  st.chests[k] = true;
  W.chests[k].lid.rotation.x = -1.2;
  W.chests[k].lid.position.set(0, 1.1, -0.35);
  sfx("chest");
  st.keys++;
  persist();
  hud();
  await say(S.KEY);
  busy = false;
}
async function openRuinGate() {
  busy = true;
  sfx("gate");
  boxOff("ruinGate");
  const t0 = performance.now();
  await new Promise<void>((r) => {
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / 1500);
      W.ruinGate.position.y = heightAt(P.ruinsGate.x, P.ruinsGate.z) - 0.3 - k * 4.2;
      if (k < 1) requestAnimationFrame(tick);
      else r();
    };
    tick();
  });
  setStep(10);
  busy = false;
}
async function startBoitata() {
  busy = true;
  const b = spawn("boitata", P.ruins.x - 8, P.ruins.z);
  boss = b;
  b.state = "crawl";
  sfx("roar");
  cine([P.ruins.x + 12, 10, P.ruins.z + 12], [P.ruins.x + 10, 8, P.ruins.z + 9], [P.ruins.x - 6, 1, P.ruins.z], [P.ruins.x - 7, 1.5, P.ruins.z], 6);
  await say(S.BOITATA_IN);
  endCine();
  hud();
  setLevel("music", 0.5, 1);
}
async function openFarmGate() {
  if (st.amulets < 3) {
    await say(S.FARM_LOCKED);
    busy = false;
    return;
  }
  busy = true;
  sfx("gate");
  boxOff("farmGate");
  const L = W.farmGate.getObjectByName("L")!,
    R = W.farmGate.getObjectByName("R")!;
  const t0 = performance.now();
  await new Promise<void>((r) => {
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / 1400);
      L.rotation.y = k * 1.6;
      R.rotation.y = -k * 1.6;
      if (k < 1) requestAnimationFrame(tick);
      else r();
    };
    tick();
  });
  setStep(12);
  busy = false;
}
let waveLeft = 0;
let coronel: Enemy | null = null;
async function startFarm() {
  busy = true;
  coronel = spawn("coronel", P.casarao.x, P.casarao.z - 7.5);
  coronel.state = "watch";
  cine([P.fazenda.x + 8, 7, P.fazenda.z - 2], [P.fazenda.x + 5, 6, P.fazenda.z + 2], [P.casarao.x, 1.5, P.casarao.z - 7], [P.casarao.x, 1.8, P.casarao.z - 7], 6);
  await say(S.CORONEL_IN);
  endCine();
  waveLeft = 0;
  for (const [x, z] of [[-10, 108], [10, 108], [-6, 114], [6, 114], [0, 100]]) {
    const e = spawn("capanga", x, z, "wave");
    e.state = "chase";
    waveLeft++;
  }
  setLevel("music", 0.45, 1);
}
async function startCoronel() {
  busy = true;
  setStep(13);
  cine([P.fazenda.x + 6, 5, P.fazenda.z + 6], [P.fazenda.x + 4, 4.5, P.fazenda.z + 8], [coronel!.pos.x, 1.6, coronel!.pos.z], [coronel!.pos.x, 1.6, coronel!.pos.z], 5);
  await say(S.CORONEL_2);
  endCine();
  boss = coronel;
  coronel!.state = "fight";
  hud();
}
async function ending() {
  busy = true;
  await say(S.CORONEL_OUT);
  if (coronel) coronel.obj.visible = false;
  clearEnemies(() => true);
  await fade(true, 1500);
  W.setTime("dia");
  // the forest grows back over the farm
  const grow: THREE.Object3D[] = [];
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2,
      r = 4 + Math.random() * 26;
    const x = P.fazenda.x + Math.cos(a) * r,
      z = P.fazenda.z + Math.sin(a) * r;
    const g = new THREE.Group();
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, 5, 6), mat(0x5a4030));
    tr.position.y = 2.5;
    const cr = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 1), mat(0x3f8a2a, { flatShading: true }));
    cr.position.y = 5.8;
    g.add(tr, cr);
    g.position.set(x, heightAt(x, z), z);
    g.scale.setScalar(0.01);
    scene.add(g);
    grow.push(g);
  }
  cine([P.fazenda.x + 40, 30, P.fazenda.z + 40], [P.fazenda.x + 20, 45, P.fazenda.z - 30], [P.fazenda.x, 2, P.fazenda.z], [P.fazenda.x, 4, P.fazenda.z], 22);
  const t0 = performance.now();
  const growTick = () => {
    const k = Math.min(1, (performance.now() - t0) / 6000);
    grow.forEach((g, i) => g.scale.setScalar(Math.max(0.01, Math.min(1, k * 1.6 - i * 0.015))));
    if (k < 1) requestAnimationFrame(growTick);
  };
  growTick();
  setLevel("music", 0.6, 3);
  await fade(false, 1500);
  await say(S.ENDING.slice(0, 1));
  cine([-3, 4, 7], [-4, 3.5, 5], [P.vovo.x, 1.3, P.vovo.z], [P.vovo.x, 1.3, P.vovo.z], 12);
  hero.pos.set(-4.5, 0, -0.5);
  hero.heading = -2.4;
  saci.group.position.set(-1.5, heightAt(-1.5, -2), -2);
  await say(S.ENDING.slice(1));
  st.step = 14;
  persist();
  $("end").classList.add("on");
}
async function died() {
  busy = true;
  sfx("die");
  await fade(true, 900);
  hero.hp = hero.maxHp;
  hero.inv = 2;
  // back to the start of the current area; a boss fight restarts
  const s = st.step;
  const at = s <= 2 ? V(-4, 0, 2) : s <= 4 ? V(0, 0, -78) : s <= 7 ? V(58, 0, 0) : s <= 10 ? V(-68, 0, 0) : V(0, 0, 74);
  hero.pos.copy(at);
  if (boss) {
    boss.hp = boss.maxHp;
    boss.pos.copy(boss.home);
    boss.state = boss.kind === "boitata" ? "crawl" : boss.kind === "iara" ? "up" : boss.kind === "coronel" ? "fight" : "idle";
    if (boss.trail) boss.trail.forEach((p) => p.copy(boss!.home));
  }
  for (const sh of shots) scene.remove(sh.mesh);
  shots.length = 0;
  hud();
  await fade(false, 700);
  await say(S.DIED);
  busy = false;
}

// ------------------------------------------------------------------ interactions + triggers
interface Spot {
  pos: THREE.Vector3;
  r: number;
  label: string;
  when: () => boolean;
  act: () => void;
}
const spots: Spot[] = [
  { pos: P.saci, r: 3.2, label: "Falar com o Saci", when: () => st.step === 1, act: talkSaci },
  { pos: P.chests[0], r: 2.8, label: "Abrir o baú", when: () => st.step === 9 && !st.chests[0], act: () => openChest(0) },
  { pos: P.chests[1], r: 2.8, label: "Abrir o baú", when: () => st.step === 9 && !st.chests[1], act: () => openChest(1) },
  { pos: P.ruinsGate, r: 4.5, label: "Destrancar o portão", when: () => st.step === 9 && st.keys >= 2, act: openRuinGate },
  { pos: P.gate, r: 5, label: "Abrir a porteira", when: () => st.step === 11, act: openFarmGate },
];
let near: Spot | null = null;
function triggers() {
  const p = hero.pos;
  if (st.step === 2 && flat(p, P.forest) < 21) {
    setStep(3);
    say(S.TORCH_HINT).then(() => (busy = false));
  }
  if (st.step === 3 && st.torches.every(Boolean)) startCurupira();
  if (st.step === 5 && p.x > 50 && Math.abs(p.z) < 30) {
    setStep(6);
    say(S.LAKE_IN).then(() => (busy = false));
  }
  if (st.step === 6 && W.blocks.every((b) => b.done)) bridgeRise();
  if (st.step === 7 && !boss && flat(p, P.island) < ISLAND_R - 1) startIara();
  if (st.step === 8 && p.x < -66 && Math.abs(p.z) < 30) {
    setStep(9);
    for (const c of P.chests) for (const dz of [-1.5, 1.5]) spawn("capanga", c.x + 4, c.z + dz).state = "chase";
    say(S.RUINS_IN).then(() => (busy = false));
  }
  if (st.step === 10 && !boss && p.x < P.ruinsGate.x - 4) startBoitata();
  if (st.step === 12 && !coronel && flat(p, P.fazenda) < 22) startFarm();
  if (st.step === 12 && coronel && waveLeft > 0 && enemies.filter((e) => e.tag === "wave" && !e.dead).length === 0) {
    waveLeft = 0;
    startCoronel();
  }
}
function targetPos(): THREE.Vector3 | null {
  switch (st.step) {
    case 1:
      return P.saci;
    case 2:
      return P.forest;
    case 3:
      return P.torches[st.torches.findIndex((t) => !t)] ?? null;
    case 5:
      return V(56, 0, 0);
    case 6:
      return P.plates[W.blocks.findIndex((b) => !b.done)] ?? null;
    case 7:
      return P.island;
    case 8:
      return V(-70, 0, 0);
    case 9:
      return st.keys >= 2 ? P.ruinsGate : P.chests[st.chests.findIndex((c) => !c)] ?? null;
    case 10:
      return P.ruins;
    case 11:
      return P.gate;
    case 12:
      return P.fazenda;
    default:
      return null;
  }
}
const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 30, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x9effc8, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
scene.add(marker);

// ------------------------------------------------------------------ simulation
function updateHero(dt: number) {
  const mv = moveDir();
  const mag = Math.min(1, mv.length());
  hero.inv -= dt;
  hero.atkT -= dt;
  hero.bowT -= dt;
  let vel = V();
  if (!busy) {
    if (hero.rollT > 0) {
      hero.rollT -= dt;
      vel.copy(hero.rollDir).multiplyScalar(13);
      hero.heading = Math.atan2(hero.rollDir.x, hero.rollDir.z);
    } else if (mag > 0.1) {
      const dir = mv.clone().normalize();
      const want = Math.atan2(dir.x, dir.z);
      if (hero.atkT <= 0) hero.heading += angDiff(want, hero.heading) * Math.min(1, dt * 14);
      const sp = (mag > 0.85 ? 6.2 : 3.2) * mag * (hero.atkT > 0 ? 0.35 : 1);
      vel.copy(dir).multiplyScalar(sp);
    }
  }
  vel.add(hero.knock);
  hero.knock.multiplyScalar(Math.exp(-dt * 8));
  hero.speed = busy ? 0 : Math.hypot(vel.x, vel.z);
  const next = hero.pos.clone().addScaledVector(vel, dt);
  collide(next);
  if (!walkable(next.x, next.z)) next.copy(hero.pos);
  // push the lake stones
  if (st.step === 6)
    for (let i = 0; i < W.blocks.length; i++) {
      const b = W.blocks[i];
      if (b.done) continue;
      const dx = next.x - b.pos.x,
        dz = next.z - b.pos.z;
      const touching = Math.abs(dx) < 1.45 && Math.abs(dz) < 1.45 && mag > 0.3;
      if (touching) {
        const push = Math.abs(dx) > Math.abs(dz) ? V(-Math.sign(dx), 0, 0) : V(0, 0, -Math.sign(dz));
        if (push.dot(mv.clone().normalize()) > 0.6) {
          const np = b.pos.clone().addScaledVector(push, dt * 1.6);
          if (heightAt(np.x, np.z) > 0.2) b.pos.copy(np);
          if (Math.random() < dt * 4) footstep(true);
        }
      }
      const pl = P.plates[i];
      if (flat(b.pos, pl) < 0.9) {
        b.pos.set(pl.x, 0, pl.z);
        b.done = true;
        sfx("torch");
        burst(V(pl.x, heightAt(pl.x, pl.z) + 1, pl.z), 0x48cae4, 16);
        setPlates();
      }
      b.mesh.position.set(b.pos.x, heightAt(b.pos.x, b.pos.z) + 0.9, b.pos.z);
    }
  const moved = flat(next, hero.pos);
  hero.pos.x = next.x;
  hero.pos.z = next.z;
  hero.pos.y += (groundY(hero.pos.x, hero.pos.z) - hero.pos.y) * Math.min(1, dt * 15);
  if (moved > 0.001 && hero.rollT <= 0) {
    hero.phase += moved * 2.2;
    if (Math.floor(hero.phase / Math.PI) !== Math.floor((hero.phase - moved * 2.2) / Math.PI)) footstep(W.onBridge(hero.pos.x, hero.pos.z));
  }
  // sword hit window
  if (hero.atkT > 0 && hero.atkT < 0.2 && !hero.atkHit) {
    hero.atkHit = true;
    const fwd = V(Math.sin(hero.heading), 0, Math.cos(hero.heading));
    for (const e of enemies) {
      if (e.dead || !e.obj.visible) continue;
      const tp = e.kind === "boitata" ? e.segs![0].getWorldPosition(V()) : e.pos;
      const d = flat(tp, hero.pos);
      const a = Math.abs(angDiff(Math.atan2(tp.x - hero.pos.x, tp.z - hero.pos.z), hero.heading));
      if (d < (e.kind === "boitata" ? 3.4 : 2.6) && a < 1.25) damageEnemy(e, hero.combo === 2 ? 2 : 1, hero.pos);
    }
    if (st.step === 3)
      W.torches.forEach((t, i) => {
        if (st.torches[i]) return;
        const tp = P.torches[i];
        if (flat(tp, hero.pos) < 2.8 && Math.abs(angDiff(Math.atan2(tp.x - hero.pos.x, tp.z - hero.pos.z), hero.heading)) < 1.3) {
          st.torches[i] = true;
          t.lit = true;
          t.fire.visible = true;
          sfx("torch");
          burst(V(tp.x, heightAt(tp.x, tp.z) + 2.9, tp.z), 0xffa030, 14);
          persist();
        }
      });
    void fwd;
  }
  // pick up hearts
  for (let i = hearts.length - 1; i >= 0; i--) {
    const hm = hearts[i];
    hm.rotation.y += dt * 3;
    if (flat(hm.position, hero.pos) < 1.3) {
      scene.remove(hm);
      hearts.splice(i, 1);
      hero.hp = Math.min(hero.maxHp, hero.hp + 1);
      blip("pick");
      hud();
    }
  }
}

function updateEnemy(e: Enemy, dt: number, T: number) {
  e.t += dt;
  e.hurt -= dt;
  const toHero = V(hero.pos.x - e.pos.x, 0, hero.pos.z - e.pos.z);
  const dist = toHero.length();
  let move = V();
  let speed = 0;
  const face = (v: THREE.Vector3, k = 10) => {
    if (v.lengthSq() > 1e-4) e.heading += angDiff(Math.atan2(v.x, v.z), e.heading) * Math.min(1, dt * k);
  };
  switch (e.kind) {
    case "capanga":
    case "sombra": {
      const sp = e.kind === "sombra" ? 4.6 : 3.4;
      if (e.state === "idle") {
        if (dist < 13 && !busy) e.state = "chase";
        move.set(Math.sin(e.t * 0.4 + e.home.x), 0, Math.cos(e.t * 0.3 + e.home.z)).multiplyScalar(0.25);
        speed = 1;
      } else if (e.state === "chase") {
        if (dist > 26 && !e.tag) e.state = "idle";
        if (dist < 1.9) {
          e.state = "windup";
          e.t = 0;
        }
        move.copy(toHero).normalize();
        speed = sp;
        face(toHero);
      } else if (e.state === "windup") {
        face(toHero, 6);
        if (e.t > 0.5) {
          e.state = "swing";
          e.t = 0;
          sfx("swish");
          if (dist < 2.4) damageHero(1, e.pos);
        }
      } else if (e.state === "swing") {
        if (e.t > 0.5) e.state = "chase";
      }
      break;
    }
    case "curupira": {
      const c = P.forest;
      if (e.state === "idle" || e.state === "run") {
        e.state = "run";
        const a = e.t * 0.75;
        const want = V(c.x + Math.cos(a) * 9, 0, c.z + Math.sin(a) * 9);
        move.copy(want).sub(e.pos);
        speed = Math.min(8, move.length() * 4);
        move.normalize();
        face(move);
        if (e.t > 4 && dist < 18) {
          e.state = "dash";
          e.t = 0;
          e.vel.copy(toHero).normalize();
          sfx("roar");
        }
      } else if (e.state === "dash") {
        move.copy(e.vel);
        speed = e.t < 0.25 ? 0 : 15;
        face(e.vel, 20);
        if (dist < 1.6) damageHero(1, e.pos);
        if (e.t > 1.1) {
          e.state = "tired";
          e.t = 0;
        }
      } else if (e.state === "tired") {
        if (e.t > 1.6) {
          e.state = "run";
          e.t = 0;
        }
      }
      if (e.state === "run" && dist < 1.4) damageHero(1, e.pos);
      break;
    }
    case "iara": {
      // circles the island in the water; surfaces to throw water orbs
      const a = e.t * 0.25 + e.phase;
      e.pos.x = P.island.x + Math.cos(a) * 14;
      e.pos.z = P.island.z + Math.sin(a) * 14;
      face(toHero, 4);
      if (e.state === "up") {
        e.pos.y += (0.2 - e.pos.y) * Math.min(1, dt * 4);
        if (e.t > 1.2 && Math.floor((e.t - dt) / 0.9) !== Math.floor(e.t / 0.9) && e.t < 3.6) {
          shoot(e.pos.clone().setY(1.5), toHero.clone().normalize().add(V(0, 0.02, 0)), true, "orb");
          sfx("arrow");
        }
        if (e.t > 4.4) {
          e.state = "down";
          e.t = 0;
        }
      } else if (e.state === "down") {
        e.pos.y += (-2.4 - e.pos.y) * Math.min(1, dt * 3);
        e.phase += dt * 0.8;
        if (e.t > 2.4) {
          e.state = "up";
          e.t = 0;
        }
      }
      break;
    }
    case "boitata": {
      const head = e.trail![0];
      if (e.state === "crawl") {
        move.copy(toHero).normalize();
        speed = 3.5;
        face(toHero, 3);
        if (e.t > 3.5) {
          e.state = "wind";
          e.t = 0;
          sfx("roar");
        }
      } else if (e.state === "wind") {
        face(toHero, 6);
        if (e.t > 1) {
          e.state = "charge";
          e.t = 0;
          e.vel.set(Math.sin(e.heading), 0, Math.cos(e.heading));
        }
      } else if (e.state === "charge") {
        move.copy(e.vel);
        speed = 17;
        // crash into a pillar → stunned
        for (const p of P.pillars)
          if (flat(e.pos, p) < 2.6) {
            e.state = "stun";
            e.t = 0;
            sfx("hit");
            burst(e.pos.clone().setY(1.2), 0xffd166, 24);
            banner("TONTO!", "Ataque a cabeça!");
          }
        const inside = Math.abs(e.pos.x - P.ruins.x) < 15.5 && Math.abs(e.pos.z - P.ruins.z) < 15.5;
        if (!inside || e.t > 2.2) {
          e.state = "crawl";
          e.t = 0;
          e.pos.x = THREE.MathUtils.clamp(e.pos.x, P.ruins.x - 15.4, P.ruins.x + 15.4);
          e.pos.z = THREE.MathUtils.clamp(e.pos.z, P.ruins.z - 15.4, P.ruins.z + 15.4);
        }
      } else if (e.state === "stun") {
        if (e.t > 3.6) {
          e.state = "crawl";
          e.t = 0;
        }
      }
      // body follows the head's trail
      if (speed > 0) {
        e.trail!.unshift(head.clone());
        e.trail!.length = 60;
      }
      // touching any segment hurts
      for (let i = 0; i < e.segs!.length; i += 2) {
        const sp = e.trail![Math.min(e.trail!.length - 1, i * 3)];
        if (Math.hypot(sp.x - hero.pos.x, sp.z - hero.pos.z) < 1.2 && e.state !== "stun") damageHero(1, sp);
      }
      break;
    }
    case "coronel": {
      if (e.state === "watch") {
        face(toHero, 4);
        break;
      }
      // keep a distance, fire bursts, then reload
      const want = dist < 8 ? -1 : dist > 13 ? 1 : 0;
      move.copy(toHero).normalize().multiplyScalar(want);
      move.add(V(-toHero.z, 0, toHero.x).normalize().multiplyScalar(Math.sin(e.t * 0.7) * 0.8));
      speed = 3.2;
      face(toHero, 8);
      const cyc = e.t % 4;
      if (cyc < 1.6 && Math.floor((e.t - dt) / 0.4) !== Math.floor(e.t / 0.4)) {
        const d = toHero.clone().normalize();
        d.applyAxisAngle(V(0, 1, 0), (Math.random() - 0.5) * 0.15);
        shoot(e.pos.clone().setY(e.pos.y + 1.3).addScaledVector(d, 0.8), d, true, "bullet");
        sfx("hit");
      }
      if (e.hp <= e.maxHp / 2 && !e.tag) {
        e.tag = "summoned";
        for (const dx of [-3, 3]) spawn("sombra", e.pos.x + dx, e.pos.z + 2).state = "chase";
        sfx("roar");
      }
      if (dist < 1.4) damageHero(1, e.pos);
      break;
    }
  }
  // integrate
  const v = move.multiplyScalar(speed).add(e.vel.clone().multiplyScalar(e.kind === "curupira" || e.kind === "boitata" ? 0 : 1));
  e.vel.multiplyScalar(Math.exp(-dt * 8));
  if (e.kind !== "iara") {
    const np = e.pos.clone().addScaledVector(v, dt);
    if (e.kind !== "boitata") collide(np, 0.35);
    if (walkable(np.x, np.z)) {
      e.pos.x = np.x;
      e.pos.z = np.z;
    }
    e.pos.y = groundY(e.pos.x, e.pos.z);
  }
  // visuals
  if (e.h) {
    e.obj.position.copy(e.pos);
    e.obj.rotation.y = e.heading;
    e.phase += dt * (speed * 2 + 0.5);
    animateHuman(e.h, e.phase, e.kind === "iara" ? 0 : Math.min(2, speed / 3), T);
    if (e.state === "windup") e.h.rArm.rotation.x = -2.4;
    if (e.state === "swing") e.h.rArm.rotation.x = -2.4 + Math.min(1, e.t * 6) * 3;
    if (e.kind === "curupira" && e.state === "tired") e.h.torso.rotation.x = 0.5;
    if (e.kind === "iara") e.h.lArm.rotation.z = e.h.rArm.rotation.z = Math.sin(T * 2) * 0.2;
    if (e.kind === "coronel") e.h.rArm.rotation.x = -1.4;
  } else if (e.segs) {
    e.trail![0].copy(e.pos);
    e.segs.forEach((s, i) => {
      const tp = e.trail![Math.min(e.trail!.length - 1, i * 3)];
      s.position.set(tp.x, groundY(tp.x, tp.z) + 1 + Math.sin(T * 6 - i * 0.6) * 0.15, tp.z);
    });
    e.segs[0].rotation.y = e.heading;
    const glow = e.state === "wind" ? 3 : e.state === "stun" ? 0.4 : 1.6;
    (e.segs[0].material as THREE.MeshStandardMaterial).emissiveIntensity = glow;
    if (e.state === "stun") e.segs[0].position.y += Math.sin(T * 10) * 0.1;
  }
  // flash when hurt
  const ms = bodyMats.get(e);
  if (ms && e.kind !== "boitata")
    for (const m of ms) {
      if (e.hurt > 0) {
        m.emissive.setHex(0xff2020);
        m.emissiveIntensity = 0.8;
      } else if (e.state === "windup") {
        m.emissive.setHex(0xff8800);
        m.emissiveIntensity = 0.25;
      } else if (m.emissive.getHex() === 0xff2020 || m.emissive.getHex() === 0xff8800) {
        m.emissive.setHex(0x000000);
        m.emissiveIntensity = 0;
      }
    }
}

function updateShots(dt: number) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    s.life -= dt;
    s.mesh.position.addScaledVector(s.vel, dt);
    let hit = false;
    if (s.hostile) {
      if (flat(s.mesh.position, hero.pos) < 0.8 && hero.rollT <= 0) {
        damageHero(1, s.mesh.position);
        hit = true;
      }
    } else
      for (const e of enemies) {
        if (e.dead || !e.obj.visible) continue;
        const tp = e.kind === "boitata" ? e.segs![0].getWorldPosition(V()) : e.pos;
        if (flat(s.mesh.position, tp) < (e.kind === "boitata" ? 1.6 : e.kind === "iara" ? 1.4 : 0.9)) {
          damageEnemy(e, 1, hero.pos);
          hit = true;
          break;
        }
      }
    if (hit || s.life <= 0 || s.mesh.position.y < groundY(s.mesh.position.x, s.mesh.position.z) - 0.5) {
      scene.remove(s.mesh);
      shots.splice(i, 1);
    }
  }
  for (let i = sparks.length - 1; i >= 0; i--) {
    const p = sparks[i];
    p.life -= dt;
    p.v.y -= 14 * dt;
    p.m.position.addScaledVector(p.v, dt);
    p.m.rotation.x += dt * 9;
    if (p.life <= 0) {
      scene.remove(p.m);
      sparks.splice(i, 1);
    }
  }
}

// ------------------------------------------------------------------ main loop
let last = performance.now(),
  T = 0;
const camPos = V(),
  camLook = V();
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  T += dt;
  W.update(dt, T);
  if (started) {
    updateHero(dt);
    for (const e of enemies) if (!e.dead || (e.boss && e.obj.visible)) updateEnemy(e, dt, T);
    updateShots(dt);
    if (!busy) triggers();
  }
  // hero visuals
  kaua.group.position.copy(hero.pos);
  kaua.group.rotation.y = hero.heading;
  animateHuman(kaua, hero.phase, Math.min(2, hero.speed / 3.1), T);
  if (hero.rollT > 0) {
    kaua.torso.rotation.x = 1.0;
    kaua.group.position.y -= 0.35;
  }
  if (hero.atkT > 0) {
    const k = 1 - hero.atkT / 0.32;
    const side = hero.combo === 1 ? -1 : 1;
    kaua.rArm.rotation.x = -1.3 - Math.sin(k * Math.PI) * 0.4;
    kaua.rArm.rotation.z = side * (1.4 - k * 2.8);
    kaua.torso.rotation.y = side * (0.6 - k * 1.2);
  } else kaua.rArm.rotation.z = 0;
  if (hero.bowT > 0) {
    kaua.lArm.rotation.x = -1.5;
    kaua.rArm.rotation.x = -1.4;
  }
  kaua.group.visible = hero.inv <= 0 || Math.floor(T * 20) % 2 === 0 || busy;
  animateHuman(vovo, 0, 0, T);
  animateHuman(saci, 0, 0, T + 1);
  saci.group.rotation.y = Math.atan2(hero.pos.x - saci.group.position.x, hero.pos.z - saci.group.position.z);
  swirl.rotation.y += dt * 9;
  saci.group.position.y = heightAt(saci.group.position.x, saci.group.position.z) + Math.abs(Math.sin(T * 3)) * 0.15;
  // camera
  if (cineCam) {
    cineCam.t += dt;
    const u = Math.min(1, cineCam.t / cineCam.dur);
    const e = u * u * (3 - 2 * u);
    camPos.lerpVectors(cineCam.from, cineCam.to, e);
    camLook.lerpVectors(cineCam.lf, cineCam.lt, e);
    camera.position.lerp(camPos, cineCam.t < 0.05 ? 1 : Math.min(1, dt * 5));
    camera.lookAt(camLook);
  } else if (started) {
    const portrait = innerHeight > innerWidth;
    const zoom = (boss ? 1.3 : 1) * (portrait ? 1.35 : 1);
    const want = hero.pos.clone().add(V(0, 10.5 * zoom, 9 * zoom));
    camera.position.lerp(want, Math.min(1, dt * 6));
    camera.lookAt(hero.pos.x, hero.pos.y + 0.8, hero.pos.z - 0.5);
  } else {
    const a = T * 0.04;
    camera.position.set(Math.cos(a) * 190, 70, Math.sin(a) * 190);
    camera.lookAt(0, 5, 0);
  }
  W.sun.position.copy(hero.pos).addScaledVector(W.sunDir, 120);
  W.sun.target.position.copy(hero.pos);
  // marker + action prompt
  const tp = !busy && started ? targetPos() : null;
  marker.visible = !!tp && flat(hero.pos, tp) > 7;
  if (tp) marker.position.set(tp.x, groundY(tp.x, tp.z) + 15, tp.z);
  near = null;
  if (started && !busy) for (const s of spots) if (s.when() && flat(hero.pos, s.pos) < s.r) near = s;
  $("bAct").textContent = near ? `✋ ${near.label}` : "";
  $("bAct").classList.toggle("on", !!near);
  if (composer) composer.render();
  else renderer.render(scene, camera);
}
requestAnimationFrame(frame);
setTimeout(() => fade(false, 1400), 200);

// ------------------------------------------------------------------ restore a save
function applySave(s: Save) {
  st = s;
  bow.visible = s.bow;
  s.torches.forEach((lit, i) => {
    W.torches[i].lit = lit;
    W.torches[i].fire.visible = lit;
  });
  if (s.step >= 7) {
    W.blocks.forEach((b, i) => {
      b.done = true;
      b.pos.set(P.plates[i].x, 0, P.plates[i].z);
      b.mesh.position.set(b.pos.x, heightAt(b.pos.x, b.pos.z) + 0.9, b.pos.z);
    });
    setPlates();
    W.bridgeUp = 1;
  }
  s.chests.forEach((o, i) => {
    if (o) {
      W.chests[i].open = true;
      W.chests[i].lid.rotation.x = -1.2;
      W.chests[i].lid.position.set(0, 1.1, -0.35);
    }
  });
  if (s.step >= 10) {
    boxOff("ruinGate");
    W.ruinGate.position.y -= 4.2;
  }
  if (s.step >= 11) W.setTime("tarde");
  if (s.step >= 12) {
    boxOff("farmGate");
    W.farmGate.getObjectByName("L")!.rotation.y = 1.6;
    W.farmGate.getObjectByName("R")!.rotation.y = -1.6;
  }
  // restart a boss fight from its trigger
  if (s.step === 4) {
    s.step = 3;
  }
  if (s.step === 9) {
    for (let i = 0; i < 2; i++) if (!s.chests[i]) for (const dz of [-1.5, 1.5]) spawn("capanga", P.chests[i].x + 4, P.chests[i].z + dz).state = "chase";
  }
  if (s.step === 13) s.step = 12;
  const at = s.step <= 2 ? V(-4, 0, 2) : s.step <= 4 ? V(0, 0, -78) : s.step <= 7 ? V(58, 0, 0) : s.step <= 10 ? V(-68, 0, 0) : V(0, 0, 74);
  hero.pos.copy(at);
  spawnOverworld();
}

// ------------------------------------------------------------------ title
async function begin(cont: boolean) {
  initAudio();
  setLevel("music", 0.3, 2);
  setLevel("sea", 0.35);
  setLevel("wind", 0.12);
  $("title").classList.remove("on");
  await fade(true, 600);
  started = true;
  $("hud").classList.add("on");
  try {
    (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.("landscape").catch(() => {});
  } catch {
    /* ignore */
  }
  const sv = cont ? loadSave() : null;
  hud();
  if (sv && sv.step >= 1 && sv.step < 14) {
    applySave(sv);
    hud();
    busy = false;
    setLevel("music", 0.15, 3);
    await fade(false, 800);
    banner("Continuando", S.OBJ[st.step] ?? "");
    return;
  }
  await intro();
  setLevel("music", 0.15, 3);
}
$("tNew").onclick = () => begin(false);
$("tCont").onclick = () => begin(true);
if (!loadSave() || (loadSave()?.step ?? 0) < 1 || (loadSave()?.step ?? 0) >= 14) ($("tCont") as HTMLElement).style.display = "none";
$("tQ").textContent = `Gráficos: ${quality.toUpperCase()}`;
$("tQ").onclick = () => {
  try {
    localStorage.setItem("lendas.q", hi ? "baixa" : "alta");
  } catch {
    /* ignore */
  }
  location.reload();
};
$("endBtn").onclick = () => location.reload();
void LAKE_R;
(window as unknown as Record<string, unknown>).__lendas = { get st() { return st; }, hero, enemies, W, get busy() { return busy; }, get boss() { return boss; }, spots, attack, fireBow, roll, applySave };
