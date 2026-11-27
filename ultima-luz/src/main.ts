import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { buildWorld, heightAt, P, TOWER_H, Collider } from "./world";
import { makeHuman, animateHuman, HumanMesh } from "./people";
import * as S from "./story";
import { VOICE } from "./voice";
import { initAudio, setLevel, thunder, blip, step as footstep } from "./sound";

const $ = (id: string) => document.getElementById(id)!;

// ------------------------------------------------------------------ settings
let quality: "alta" | "baixa";
try {
  quality = (localStorage.getItem("luz.q") as "alta" | "baixa") || (/Android|iPhone|iPad/i.test(navigator.userAgent) ? "baixa" : "alta");
} catch {
  quality = "baixa";
}
const hi = quality === "alta";

// ------------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ antialias: hi, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, hi ? 2 : 1.25));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.7;
renderer.outputColorSpace = THREE.SRGBColorSpace;
$("stage").appendChild(renderer.domElement);

const W = buildWorld(quality);
const scene = W.scene;
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 5000);
camera.position.set(80, 40, 160);

let composer: EffectComposer | null = null;
let bloom: UnrealBloomPass | null = null;
if (hi) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.35, 0.6, 0.85);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}
addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  composer?.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

// ------------------------------------------------------------------ weather
type Weather = "tarde" | "crepusculo" | "tempestade" | "amanhecer";
let weather: Weather = "tarde";
const sunDir = new THREE.Vector3();
let storm = 0; // 0..1 drives rain, lightning, flashlight
function setWeather(w: Weather) {
  weather = w;
  const su = W.sky.material.uniforms;
  const cfg = {
    tarde: { elev: 14, az: 230, turb: 9, ray: 2.0, sun: 2.4, sunC: 0xffd9a8, hemi: 0.75, hemiC: 0xcfe0f0, ground: 0x5a4a32, fog: 0xaeb9bd, dens: 0.0021, exp: 0.6, sea: 0x0d3a4a, storm: 0 },
    crepusculo: { elev: 3, az: 245, turb: 12, ray: 3.0, sun: 1.6, sunC: 0xff9a5a, hemi: 0.45, hemiC: 0x9fa9c9, ground: 0x3a3028, fog: 0x7d7480, dens: 0.003, exp: 0.55, sea: 0x0a2a38, storm: 0.25 },
    tempestade: { elev: -8, az: 245, turb: 20, ray: 0.5, sun: 0.0, sunC: 0x8899bb, hemi: 0.5, hemiC: 0x5d6f8a, ground: 0x15181c, fog: 0x161c24, dens: 0.008, exp: 1.1, sea: 0x061620, storm: 1 },
    amanhecer: { elev: 6, az: 100, turb: 4, ray: 2.6, sun: 2.2, sunC: 0xffc7a0, hemi: 0.7, hemiC: 0xf0d8e0, ground: 0x5a4a32, fog: 0xd9c2bb, dens: 0.0018, exp: 0.58, sea: 0x14506a, storm: 0 },
  }[w];
  const phi = THREE.MathUtils.degToRad(90 - cfg.elev),
    th = THREE.MathUtils.degToRad(cfg.az);
  sunDir.setFromSphericalCoords(1, phi, th);
  su.sunPosition.value.copy(sunDir);
  su.turbidity.value = cfg.turb;
  su.rayleigh.value = cfg.ray;
  W.sky.visible = w !== "tempestade";
  scene.background = w === "tempestade" ? new THREE.Color(0x0b1016) : null;
  W.sun.intensity = cfg.sun;
  W.sun.color.set(cfg.sunC);
  W.hemi.intensity = cfg.hemi;
  W.hemi.color.set(cfg.hemiC);
  W.hemi.groundColor.set(cfg.ground);
  (scene.fog as THREE.FogExp2).color.set(cfg.fog);
  (scene.fog as THREE.FogExp2).density = cfg.dens;
  renderer.toneMappingExposure = cfg.exp;
  W.water.setSun(sunDir);
  W.water.tint(cfg.sea);
  storm = cfg.storm;
  for (const m of W.windows) m.emissiveIntensity = w === "tarde" ? 0 : w === "amanhecer" ? 0.3 : 1.4;
  setLevel("sea", w === "tempestade" ? 0.9 : 0.5);
  setLevel("wind", w === "tempestade" ? 0.9 : w === "crepusculo" ? 0.45 : 0.18);
  setLevel("rain", w === "tempestade" ? 0.8 : 0);
  if (bloom) bloom.strength = w === "tempestade" ? 0.7 : 0.3;
}

// rain streaks around the camera
const RAIN_N = hi ? 4000 : 1500;
const rainPos = new Float32Array(RAIN_N * 6);
const rainG = new THREE.BufferGeometry();
rainG.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.LineSegments(rainG, new THREE.LineBasicMaterial({ color: 0x9fb2c4, transparent: true, opacity: 0.35 }));
rain.frustumCulled = false;
scene.add(rain);
const drops: { x: number; y: number; z: number; v: number }[] = [];
for (let i = 0; i < RAIN_N; i++) drops.push({ x: (Math.random() - 0.5) * 60, y: Math.random() * 30, z: (Math.random() - 0.5) * 60, v: 22 + Math.random() * 10 });
let flash = 0,
  nextBolt = 6;

// ------------------------------------------------------------------ characters
const helena = makeHuman(7, { female: true, shirt: 0x9c2f22, pants: 0x2b3a55, skin: 0xc68642, hair: "long", hairColor: 0x2a1a10 });
scene.add(helena.group);
const bento = makeHuman(21, { female: false, shirt: 0xd9d2b5, pants: 0x4a4a3a, skin: 0x8d5524, cap: 0x2d4a6b });
scene.add(bento.group);
const joaquim = makeHuman(33, { female: false, shirt: 0x5d6b7a, pants: 0x3a3226, skin: 0xa0673a, hair: "bald", hairColor: 0xdddddd });
joaquim.group.visible = false;
scene.add(joaquim.group);
[helena, bento, joaquim].forEach((h) => h.group.traverse((o) => (o.castShadow = true)));
// Helena's flashlight
const torch = new THREE.SpotLight(0xfff1d6, 0, 28, 0.45, 0.5, 1.3);
torch.castShadow = hi;
helena.group.add(torch, torch.target);
torch.position.set(0.2, 1.3, 0.3);
torch.target.position.set(0, 0.6, 6);
// a little red/green light on Caio's boat far out at sea
const navLight = new THREE.PointLight(0xff3020, 0, 60, 1.5);
navLight.position.set(0, 3.2, 0);
W.fishing.add(navLight);

// marker pillar over the current objective
const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 40, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
scene.add(marker);

// ------------------------------------------------------------------ state
interface Save {
  step: number;
  fuel: boolean;
  fuse: boolean;
}
let st: Save = { step: 0, fuel: false, fuse: false };
const player = { pos: new THREE.Vector3(), heading: Math.PI, speed: 0, phase: 0, onTop: false };
let busy = true; // dialogue / cutscene
let started = false;
let camYaw = Math.PI,
  camPitch = 0.32;
let cineCam: { from: THREE.Vector3; to: THREE.Vector3; lf: THREE.Vector3; lt: THREE.Vector3; t: number; dur: number } | null = null;

function persist() {
  try {
    localStorage.setItem("luz.save", JSON.stringify(st));
  } catch {
    /* ignore */
  }
}
function loadSave(): Save | null {
  try {
    const s = localStorage.getItem("luz.save");
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ input: joystick (left), camera drag (right), action button
const ctl = { x: 0, y: 0 };
let jid: number | null = null,
  jx = 0,
  jy = 0,
  cid: number | null = null,
  cx = 0,
  cy = 0;
const stick = $("stick"),
  knob = $("knob");
$("stage").addEventListener("pointerdown", (e) => {
  initAudio();
  if (!started || busy) {
    if (busy && dlgSkip) dlgSkip();
    return;
  }
  if (e.clientX < innerWidth * 0.5 && jid === null) {
    jid = e.pointerId;
    jx = e.clientX;
    jy = e.clientY;
    stick.style.left = `${jx - 60}px`;
    stick.style.top = `${jy - 60}px`;
    stick.classList.add("on");
  } else if (cid === null) {
    cid = e.pointerId;
    cx = e.clientX;
    cy = e.clientY;
  }
});
addEventListener("pointermove", (e) => {
  if (e.pointerId === jid) {
    let dx = e.clientX - jx,
      dy = e.clientY - jy;
    const l = Math.hypot(dx, dy);
    if (l > 50) {
      dx = (dx / l) * 50;
      dy = (dy / l) * 50;
    }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    ctl.x = dx / 50;
    ctl.y = -dy / 50;
  } else if (e.pointerId === cid) {
    camYaw -= (e.clientX - cx) * 0.006;
    camPitch = THREE.MathUtils.clamp(camPitch + (e.clientY - cy) * 0.004, -0.15, 1.1);
    cx = e.clientX;
    cy = e.clientY;
  }
});
const up = (e: PointerEvent) => {
  if (e.pointerId === jid) {
    jid = null;
    ctl.x = ctl.y = 0;
    knob.style.transform = "";
    stick.classList.remove("on");
  }
  if (e.pointerId === cid) cid = null;
};
addEventListener("pointerup", up);
addEventListener("pointercancel", up);
const keys = new Set<string>();
addEventListener("keydown", (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key === "e" || e.key === " ") $("act").click();
});
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

// ------------------------------------------------------------------ dialogue with voices
const voice = new Audio();
let dlgSkip: (() => void) | null = null;
function say(lines: S.Line[]) {
  return new Promise<void>((resolve) => {
    busy = true;
    $("act").classList.remove("on");
    let i = 0;
    const next = () => {
      if (i >= lines.length) {
        $("sub").classList.remove("on");
        $("diary").classList.remove("on");
        dlgSkip = null;
        busy = cineCam !== null && cineLock;
        resolve();
        return;
      }
      const l = lines[i++];
      const c = S.CAST[l.who];
      $("subWho").innerHTML = `${l.who}${c?.role ? `<small> • ${c.role}</small>` : ""}`;
      ($("subWho") as HTMLElement).style.color = c?.color ?? "#fff";
      $("subText").textContent = l.text;
      $("sub").classList.add("on");
      $("diary").classList.toggle("on", !!l.diary);
      if (l.diary) $("diaryText").textContent = l.text;
      let done = false;
      let timer = 0;
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
      voice.onended = () => (timer = window.setTimeout(go, 450));
      voice.play().catch(() => (timer = window.setTimeout(go, 1500 + l.text.length * 55)));
      // safety net if audio never ends
      timer = window.setTimeout(go, 3000 + l.text.length * 90);
    };
    next();
  });
}
$("sub").addEventListener("pointerdown", (e) => {
  e.stopPropagation();
  dlgSkip?.();
});

// ------------------------------------------------------------------ cinematic camera helpers
let cineLock = false;
function cine(from: number[], to: number[], lookFrom: number[], lookTo: number[], dur: number) {
  cineCam = { from: new THREE.Vector3(...from), to: new THREE.Vector3(...to), lf: new THREE.Vector3(...lookFrom), lt: new THREE.Vector3(...lookTo), t: 0, dur };
  cineLock = true;
  document.body.classList.add("cine");
}
function endCine() {
  cineCam = null;
  cineLock = false;
  busy = false;
  document.body.classList.remove("cine");
}
function fade(on: boolean, ms = 900) {
  $("fade").style.transitionDuration = `${ms}ms`;
  $("fade").classList.toggle("on", on);
  return new Promise<void>((r) => setTimeout(r, ms));
}
function chapter(title: string) {
  $("chap").textContent = title;
  $("chap").classList.remove("on");
  void ($("chap") as HTMLElement).offsetWidth;
  $("chap").classList.add("on");
}
function objective() {
  $("obj").textContent = S.OBJECTIVES[st.step] ?? "";
  $("obj").classList.toggle("on", !!S.OBJECTIVES[st.step]);
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ placement helpers
function groundY(x: number, z: number) {
  if (player.onTop) return W.lamp.top + 0.13;
  if (W.inCave(x, z)) return heightAt(P.cave.x, P.cave.z);
  const h = heightAt(x, z);
  if (W.pierZone(x, z)) return Math.max(h, 1.3);
  return h;
}
function place(h: HumanMesh, x: number, z: number, heading: number) {
  h.group.position.set(x, groundY(x, z), z);
  h.group.rotation.y = heading;
}
function setPlayer(x: number, z: number, heading: number) {
  player.pos.set(x, 0, z);
  player.pos.y = groundY(x, z);
  player.heading = heading;
  camYaw = heading + Math.PI;
}

// ------------------------------------------------------------------ story flow
async function prologue() {
  st = { step: 0, fuel: false, fuse: false };
  setWeather("tarde");
  chapter(S.CHAPTERS[0]);
  // the boat crossing toward the island
  W.boat.position.set(40, 0, 230);
  W.boat.rotation.y = Math.PI / 2 + 0.3;
  boatTrip = { from: new THREE.Vector3(40, 0, 230), to: new THREE.Vector3(P.dockEnd.x + 2.8, 0, P.dockEnd.z - 4), t: 0, dur: 32 };
  helena.group.visible = true;
  cine([140, 45, 260], [60, 22, 200], [0, 8, 0], [10, 6, 60], 14);
  await fade(false, 1400);
  await say(S.PROLOGUE.slice(0, 2));
  cine([0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], 1); // replaced each frame by the boat follow cam
  boatCam = true;
  await say(S.PROLOGUE.slice(2));
  boatCam = false;
  await fade(true, 800);
  boatTrip = null;
  W.boat.position.set(P.dockEnd.x + 2.8, 0, P.dockEnd.z - 4);
  W.boat.rotation.y = Math.PI / 2;
  setPlayer(P.dockEnd.x, P.dockEnd.z - 3, Math.PI);
  place(bento, P.bento.x, P.bento.z, -0.6);
  endCine();
  st.step = 1;
  persist();
  objective();
  chapter(S.CHAPTERS[1]);
  await fade(false, 900);
}
let boatTrip: { from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number } | null = null;
let boatCam = false;

async function atHouse() {
  busy = true;
  blip("pick");
  cine([P.house.x + 5, heightAt(P.house.x, P.house.z) + 3, P.house.z + 10], [P.house.x + 3.5, heightAt(P.house.x, P.house.z) + 2.4, P.house.z + 7.5], [P.house.x + 1.8, heightAt(P.house.x, P.house.z) + 1.3, P.house.z + 4.4], [P.house.x + 1.8, heightAt(P.house.x, P.house.z) + 1.2, P.house.z + 4.4], 10);
  await say(S.HOUSE.slice(0, 3));
  W.key.visible = false;
  await say(S.HOUSE.slice(3));
  endCine();
  st.step = 2;
  setWeather("crepusculo");
  persist();
  objective();
  chapter(S.CHAPTERS[2]);
}
async function gotFuel() {
  blip("pick");
  W.fuel.visible = false;
  st.fuel = true;
  await say(S.FUEL);
  busy = false;
  afterItems();
}
async function gotFuse() {
  blip("pick");
  W.fuse.visible = false;
  st.fuse = true;
  await say(S.FUSE);
  busy = false;
  afterItems();
}
async function afterItems() {
  persist();
  if (!(st.fuel && st.fuse)) {
    $("obj").textContent = st.fuel ? "Agora pegue o fusível no barco velho da praia" : "Agora pegue o diesel no galpão do porto";
    return;
  }
  busy = true;
  await fade(true, 1200);
  setWeather("tempestade");
  st.step = 3;
  persist();
  navLight.intensity = 30;
  W.fishing.position.set(-150, 0, -240);
  cine([player.pos.x + 30, 30, player.pos.z + 30], [player.pos.x + 10, 18, player.pos.z + 20], [P.light.x, 20, P.light.z], [P.light.x, 22, P.light.z], 9);
  await fade(false, 1200);
  chapter(S.CHAPTERS[3]);
  flash = 1;
  thunder(0.1);
  await say(S.STORM);
  endCine();
  objective();
}
async function atCave() {
  busy = true;
  joaquim.group.visible = true;
  const fy = heightAt(P.cave.x, P.cave.z);
  cine([P.cave.x - 1, fy + 2.2, P.cave.z - 7], [P.cave.x, fy + 1.8, P.cave.z - 9], [P.grandpa.x, fy + 0.4, P.grandpa.z], [P.grandpa.x, fy + 0.5, P.grandpa.z], 9);
  await say(S.CAVE);
  endCine();
  st.step = 4;
  persist();
  objective();
}
async function startGenerator() {
  busy = true;
  await say(S.GEN_TRY);
  blip("clunk");
  const lever = W.genMesh.getObjectByName("lever")!;
  lever.rotation.z = -0.9;
  await wait(500);
  blip("start");
  setLevel("gen", 0.5, 1);
  await wait(900);
  W.caveLights.forEach((l) => (l.intensity = 14));
  scene.traverse((o) => {
    if (o.name === "bulb" && o !== W.lamp.beam && (o as THREE.Mesh).position.y < 6) ((o as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity = 3;
  });
  await say(S.GEN_OK);
  st.step = 5;
  persist();
  objective();
  busy = false;
}
async function climb() {
  busy = true;
  await fade(true, 700);
  player.onTop = true;
  setPlayer(P.light.x, P.light.z + 2.4, 0);
  camPitch = 0.25;
  st.step = 6;
  objective();
  await fade(false, 700);
  busy = false;
}
async function lightLamp() {
  busy = true;
  await say(S.LAMP);
  blip("clunk");
  await wait(600);
  W.lamp.on = true;
  W.lamp.beam.visible = true;
  ((W.lamp.beam.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.14;
  W.lamp.glass.emissiveIntensity = 2.2;
  W.lamp.light.intensity = 4000;
  scene.traverse((o) => {
    if (o.name === "bulb" && (o as THREE.Mesh).position.y > 6) ((o as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity = 8;
  });
  setLevel("music", 0.6, 4);
  const top = W.lamp.top;
  cine([P.light.x + 40, top + 10, P.light.z + 40], [P.light.x + 70, top + 25, P.light.z + 10], [P.light.x, top, P.light.z], [P.light.x - 60, top - 10, P.light.z - 80], 14);
  await say(S.LAMP_ON);
  await wait(1500);
  await fade(true, 1600);
  await epilogue();
}
async function epilogue() {
  st.step = 7;
  persist();
  player.onTop = false;
  setWeather("amanhecer");
  W.lamp.beam.visible = false;
  W.lamp.light.intensity = 0;
  navLight.intensity = 0;
  W.fishing.position.set(P.dockEnd.x - 3.4, 0, P.dockEnd.z - 6);
  W.fishing.rotation.y = -Math.PI / 2;
  setPlayer(P.dockStart.x, P.dockStart.z + 8, 0);
  place(bento, P.dockStart.x + 0.6, P.dockStart.z + 10, Math.PI);
  joaquim.group.visible = false;
  chapter(S.CHAPTERS[7]);
  cine([P.dockEnd.x + 30, 12, P.dockEnd.z + 30], [P.dockEnd.x + 14, 6, P.dockEnd.z + 12], [P.dockEnd.x, 2, P.dockEnd.z - 6], [P.dockEnd.x, 2, P.dockEnd.z - 8], 18);
  await fade(false, 1600);
  await say(S.EPILOGUE);
  cine([P.dockEnd.x + 14, 6, P.dockEnd.z + 12], [P.light.x + 60, 50, P.light.z + 120], [P.dockEnd.x, 2, P.dockEnd.z - 8], [P.light.x, 22, P.light.z], 12);
  await wait(4000);
  $("end").classList.add("on");
}

// ------------------------------------------------------------------ interactions
interface Spot {
  pos: THREE.Vector3;
  r: number;
  label: string;
  when: () => boolean;
  act: () => void;
}
const spots: Spot[] = [
  { pos: P.houseDoor, r: 4.5, label: "Entrar na casa do avô", when: () => st.step === 1, act: atHouse },
  { pos: W.fuel.position, r: 2.6, label: "Pegar o galão de diesel", when: () => st.step === 2 && !st.fuel, act: gotFuel },
  { pos: W.fuse.position, r: 2.6, label: "Pegar o fusível", when: () => st.step === 2 && !st.fuse, act: gotFuse },
  { pos: P.cave, r: 5, label: "Entrar na gruta", when: () => st.step === 3, act: atCave },
  { pos: P.generator, r: 2.8, label: "Ligar o gerador", when: () => st.step === 4, act: startGenerator },
  { pos: P.lightDoor, r: 3.2, label: "Subir a escada do farol", when: () => st.step === 5, act: climb },
  { pos: P.lightDoor, r: 3.2, label: "Porta do farol", when: () => st.step >= 2 && st.step < 5, act: () => say(st.step < 4 ? S.HINT_GEN : S.HINT_GEN).then(() => (busy = false)) },
  { pos: P.light, r: 3.5, label: "Acender a lanterna", when: () => st.step === 6 && player.onTop, act: lightLamp },
];
let near: Spot | null = null;
$("act").addEventListener("pointerdown", (e) => e.stopPropagation());
$("act").addEventListener("click", () => {
  if (near && !busy) {
    $("act").classList.remove("on");
    near.act();
  }
});
function targetPos(): THREE.Vector3 | null {
  switch (st.step) {
    case 1:
      return P.houseDoor;
    case 2:
      return !st.fuel ? W.fuel.position : W.fuse.position;
    case 3:
      return P.cave;
    case 4:
      return P.generator;
    case 5:
      return P.lightDoor;
    default:
      return null;
  }
}

// ------------------------------------------------------------------ movement + collisions
function collide(p: THREE.Vector3, cs: Collider[]) {
  for (const c of cs) {
    const dx = p.x - c.x,
      dz = p.z - c.z;
    const ox = c.hw + 0.3 - Math.abs(dx),
      oz = c.hd + 0.3 - Math.abs(dz);
    if (ox > 0 && oz > 0) {
      if (ox < oz) p.x += Math.sign(dx) * ox;
      else p.z += Math.sign(dz) * oz;
    }
  }
}
let stepAcc = 0;
function movePlayer(dt: number) {
  let mx = ctl.x,
    my = ctl.y;
  if (keys.has("w") || keys.has("arrowup")) my = 1;
  if (keys.has("s") || keys.has("arrowdown")) my = -1;
  if (keys.has("a") || keys.has("arrowleft")) mx = -1;
  if (keys.has("d") || keys.has("arrowright")) mx = 1;
  const mag = Math.min(1, Math.hypot(mx, my));
  if (busy) {
    player.speed = 0;
    return;
  }
  if (mag > 0.08) {
    // camera-relative direction
    const fwd = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const dir = fwd.multiplyScalar(my).add(right.multiplyScalar(mx)).normalize();
    const want = Math.atan2(dir.x, dir.z);
    let d = want - player.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    player.heading += d * Math.min(1, dt * 10);
    const sp = (mag > 0.85 ? 5.2 : 2.4) * mag;
    player.speed = sp;
    const nx = player.pos.x + dir.x * sp * dt,
      nz = player.pos.z + dir.z * sp * dt;
    const next = new THREE.Vector3(nx, 0, nz);
    if (player.onTop) {
      // walk around the gallery ring
      const r = Math.hypot(nx - P.light.x, nz - P.light.z);
      const a = Math.atan2(nz - P.light.z, nx - P.light.x);
      const rr = THREE.MathUtils.clamp(r, 1.75, 2.75);
      next.set(P.light.x + Math.cos(a) * rr, 0, P.light.z + Math.sin(a) * rr);
    } else {
      collide(next, W.colliders);
      const h = heightAt(next.x, next.z);
      if (h < -0.35 && !W.pierZone(next.x, next.z) && !W.inCave(next.x, next.z)) next.copy(player.pos);
      if (Math.abs(next.x) > 170 || Math.abs(next.z) > 170) next.copy(player.pos);
    }
    player.pos.x = next.x;
    player.pos.z = next.z;
    stepAcc += sp * dt;
    if (stepAcc > (sp > 3 ? 1.1 : 0.8)) {
      stepAcc = 0;
      footstep(W.pierZone(player.pos.x, player.pos.z) || player.onTop);
    }
  } else player.speed = 0;
  player.pos.y += (groundY(player.pos.x, player.pos.z) - player.pos.y) * Math.min(1, dt * 14);
}

// ------------------------------------------------------------------ loop
let last = performance.now(),
  T = 0;
const camPos = new THREE.Vector3(),
  camLook = new THREE.Vector3();
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  T += dt;
  W.update(dt, T);
  if (started) movePlayer(dt);
  // characters
  helena.group.position.copy(player.pos);
  helena.group.rotation.y = player.heading;
  player.phase += dt * (player.speed * 2.1 + 0.4);
  animateHuman(helena, player.phase, player.speed / 2.6, T);
  animateHuman(bento, T * 0.4, 0, T + 2);
  if (joaquim.group.visible) {
    // lying on the cave floor, holding his leg
    joaquim.group.position.set(P.grandpa.x, heightAt(P.cave.x, P.cave.z) + 0.18, P.grandpa.z);
    joaquim.group.rotation.set(0, -0.4, Math.PI / 2 - 0.15, "YXZ");
    animateHuman(joaquim, 0, 0, T);
  }
  // boat crossing (prologue)
  if (boatTrip) {
    boatTrip.t += dt;
    const u = Math.min(1, boatTrip.t / boatTrip.dur);
    const e = 1 - Math.pow(1 - u, 2);
    W.boat.position.lerpVectors(boatTrip.from, boatTrip.to, e);
    W.boat.position.y = Math.sin(T * 1.3) * 0.2 - 0.1;
    W.boat.rotation.y = THREE.MathUtils.lerp(Math.PI / 2 + 0.3, Math.PI / 2, e);
    W.boat.rotation.z = Math.sin(T * 0.9) * 0.05;
    // Helena and Bento stand on deck
    const deck = new THREE.Vector3(0.8, 0.95, 0.5).applyMatrix4(W.boat.matrixWorld);
    const deck2 = new THREE.Vector3(-1.8, 0.95, -0.4).applyMatrix4(W.boat.matrixWorld);
    helena.group.position.copy(deck);
    helena.group.rotation.y = W.boat.rotation.y - Math.PI / 2 + Math.PI;
    bento.group.position.copy(deck2);
    bento.group.rotation.y = W.boat.rotation.y + Math.PI / 2;
    player.pos.copy(deck);
    if (boatCam && cineCam) {
      const behind = new THREE.Vector3(-7, 3.2, 4.5).applyMatrix4(W.boat.matrixWorld);
      cineCam.from.copy(behind);
      cineCam.to.copy(behind);
      const lk = new THREE.Vector3(1, 1.6, 0).applyMatrix4(W.boat.matrixWorld);
      cineCam.lf.copy(lk);
      cineCam.lt.copy(lk);
    }
  }
  // camera
  if (cineCam) {
    cineCam.t += dt;
    const u = Math.min(1, cineCam.t / cineCam.dur);
    const e = u * u * (3 - 2 * u);
    camPos.lerpVectors(cineCam.from, cineCam.to, e);
    camLook.lerpVectors(cineCam.lf, cineCam.lt, e);
    camera.position.lerp(camPos, cineCam.t < 0.05 ? 1 : Math.min(1, dt * 4));
    camera.lookAt(camLook);
  } else if (started) {
    const inside = W.inCave(player.pos.x, player.pos.z) || player.onTop;
    const dist = inside ? 3.2 : 5.2;
    const head = player.pos.clone().add(new THREE.Vector3(0, 1.55, 0));
    const want = head.clone().add(new THREE.Vector3(Math.sin(camYaw) * Math.cos(camPitch) * dist, Math.sin(camPitch) * dist, Math.cos(camYaw) * Math.cos(camPitch) * dist));
    if (!player.onTop && !inside) want.y = Math.max(want.y, heightAt(want.x, want.z) + 0.6);
    if (inside && !player.onTop) want.y = Math.min(want.y, heightAt(P.cave.x, P.cave.z) + 3.8);
    // keep the camera out of buildings: pull it toward the player until it is clear
    if (!player.onTop)
      for (let k = 0; k < 8; k++) {
        const hit = W.colliders.some((c) => c.hw > 1.5 && Math.abs(want.x - c.x) < c.hw + 0.2 && Math.abs(want.z - c.z) < c.hd + 0.2);
        if (!hit) break;
        want.lerp(head, 0.2);
      }
    camera.position.lerp(want, Math.min(1, dt * 8));
    camera.lookAt(head);
  } else {
    // title: slow orbit around the island
    const a = T * 0.03;
    camera.position.set(Math.cos(a) * 170, 55, Math.sin(a) * 170);
    camera.lookAt(0, 10, 0);
  }
  // sun follows the area around the camera for crisp shadows
  W.sun.position.copy(camera.position).addScaledVector(sunDir, 150);
  W.sun.target.position.copy(camera.position);
  // storm: rain, lightning, flashlight
  rain.visible = storm > 0.5;
  if (rain.visible) {
    const c = camera.position;
    for (let i = 0; i < RAIN_N; i++) {
      const d = drops[i];
      d.y -= d.v * dt;
      d.x += 5 * dt;
      if (d.y < c.y - 12) {
        d.y = c.y + 18 + Math.random() * 6;
        d.x = c.x + (Math.random() - 0.5) * 60;
        d.z = c.z + (Math.random() - 0.5) * 60;
      }
      rainPos.set([d.x, d.y, d.z, d.x - 0.12, d.y + 0.55, d.z], i * 6);
    }
    rainG.attributes.position.needsUpdate = true;
    nextBolt -= dt;
    if (nextBolt <= 0) {
      nextBolt = 6 + Math.random() * 10;
      flash = 1;
      thunder(Math.random() * 0.7);
    }
  }
  if (flash > 0) {
    flash = Math.max(0, flash - dt * 3);
    W.hemi.intensity = 0.5 + flash * flash * 5;
    W.sky.visible = false;
  } else if (weather === "tempestade") W.hemi.intensity = 0.5;
  torch.intensity = storm > 0.5 && !player.onTop ? 60 : 0;
  // objective marker + action button
  const tp = !busy ? targetPos() : null;
  marker.visible = !!tp && started && Math.hypot(player.pos.x - tp.x, player.pos.z - tp.z) > 9;
  if (tp) marker.position.set(tp.x, groundY(tp.x, tp.z) + 20, tp.z);
  near = null;
  if (started && !busy) {
    for (const s of spots) if (s.when() && Math.hypot(player.pos.x - s.pos.x, player.pos.z - s.pos.z) < s.r) near = s;
    $("act").textContent = near ? `✋ ${near.label}` : "";
    $("act").classList.toggle("on", !!near);
    if (tp) {
      const d = Math.round(Math.hypot(player.pos.x - tp.x, player.pos.z - tp.z));
      $("dist").textContent = `${d} m`;
    } else $("dist").textContent = "";
  }
  if (composer) composer.render();
  else renderer.render(scene, camera);
}
setWeather("tarde");
place(bento, P.bento.x, P.bento.z, -0.6);
setPlayer(P.dockEnd.x, P.dockEnd.z - 3, Math.PI);
requestAnimationFrame(frame);
setTimeout(() => fade(false, 1500), 200);

// ------------------------------------------------------------------ title screen
async function begin(fromSave: boolean) {
  initAudio();
  setLevel("music", 0.35, 2);
  $("title").classList.remove("on");
  await fade(true, 700);
  started = true;
  $("hud").classList.add("on");
  const sv = fromSave ? loadSave() : null;
  if (!sv || sv.step === 0 || sv.step >= 7) {
    W.fuel.visible = W.fuse.visible = W.key.visible = true;
    await prologue();
    busy = false;
    setLevel("music", 0.15, 4);
    return;
  }
  // resume at the chapter checkpoint
  st = sv;
  if (st.step >= 6) st.step = 5;
  W.key.visible = st.step < 2;
  W.fuel.visible = !st.fuel;
  W.fuse.visible = !st.fuse;
  setWeather(st.step <= 1 ? "tarde" : st.step === 2 ? "crepusculo" : "tempestade");
  if (st.step >= 3) {
    navLight.intensity = 30;
    W.fishing.position.set(-150, 0, -240);
  }
  if (st.step >= 4) joaquim.group.visible = true;
  if (st.step >= 5) {
    W.caveLights.forEach((l) => (l.intensity = 14));
    setLevel("gen", 0.5);
  }
  const at = st.step === 1 ? [P.dockEnd.x, P.dockEnd.z - 3] : st.step === 2 ? [P.houseDoor.x, P.houseDoor.z + 3] : st.step === 3 ? [P.shedDoor.x, P.shedDoor.z - 4] : st.step === 4 ? [P.caveIn.x, P.caveIn.z + 2] : [P.generator.x + 2, P.generator.z + 2];
  setPlayer(at[0], at[1], Math.PI);
  objective();
  chapter(S.CHAPTERS[st.step]);
  busy = false;
  setLevel("music", 0.15, 4);
  await fade(false, 900);
}
$("tNew").onclick = () => begin(false);
$("tCont").onclick = () => begin(true);
if (!loadSave() || (loadSave()?.step ?? 0) === 0) ($("tCont") as HTMLButtonElement).style.display = "none";
$("tQ").textContent = `Gráficos: ${quality.toUpperCase()}`;
$("tQ").onclick = () => {
  try {
    localStorage.setItem("luz.q", hi ? "baixa" : "alta");
  } catch {
    /* ignore */
  }
  location.reload();
};
$("endBtn").onclick = () => location.reload();
void TOWER_H;
(window as unknown as Record<string, unknown>).__luz = { get st() { return st; }, player, W, begin, setWeather, spots, get busy() { return busy; } };
