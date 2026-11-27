import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { buildWorld, roadX, roadZ, NX, NZ, BEACH_ROAD, ROAD, World } from "./world";
import { Car, CarKind, CAR_COLORS, carVsCar } from "./car";
import { Driver } from "./traffic";
import { makeHuman, animateHuman, collideCircle, Pedestrian } from "./humans";
import { createInput } from "./input";
import { GameAudio } from "./audio";

// ---------------------------------------------------------------- persistence (best effort)
const store = {
  get(k: string, d: number) {
    try {
      const v = localStorage.getItem("rotasul." + k);
      return v === null ? d : Number(v);
    } catch {
      return d;
    }
  },
  set(k: string, v: number | string) {
    try {
      localStorage.setItem("rotasul." + k, String(v));
    } catch {
      /* private mode */
    }
  },
};

let quality: "alta" | "baixa" = store.get("quality", /Android|iPhone|iPad/i.test(navigator.userAgent) ? 0 : 1) ? "alta" : "baixa";
const $ = (id: string) => document.getElementById(id)!;
const qBtns = [$("quality"), $("quality2")];
const showQ = () => qBtns.forEach((b) => (b.textContent = `Gráficos: ${quality.toUpperCase()}`));
showQ();
qBtns.forEach((b) =>
  b.addEventListener("click", () => {
    quality = quality === "alta" ? "baixa" : "alta";
    store.set("quality", quality === "alta" ? 1 : 0);
    showQ();
    location.reload();
  })
);

// ---------------------------------------------------------------- renderer
const app = $("app");
const renderer = new THREE.WebGLRenderer({ antialias: quality === "alta", powerPreference: "high-performance" });
renderer.domElement.id = "gl";
renderer.setPixelRatio(Math.min(devicePixelRatio, quality === "alta" ? 1.75 : 1));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = quality === "alta" ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 4000);

let world: World;
let composer: EffectComposer | null = null;
let bloom: UnrealBloomPass | null = null;

// ---------------------------------------------------------------- game state
const input = createInput(app);
const audio = new GameAudio();
const cars: Car[] = [];
const drivers = new Map<Car, Driver>();
const peds: Pedestrian[] = [];
const police: Driver[] = [];

const player = {
  mesh: makeHuman(7, { shirt: 0xffdf00, pants: 0x1d3557, skin: 0xa0673a, cap: 0x009c3b, female: false }),
  pos: new THREE.Vector3(),
  heading: 0,
  phase: 0,
  car: null as Car | null,
  money: store.get("money", 500),
  wanted: 0,
  wantedT: 0,
  bustT: 0,
};
let camYaw = 0,
  camPitch = 0.22,
  camIdle = 0;
const camPos = new THREE.Vector3();

// ---------------------------------------------------------------- HUD helpers
const hud = {
  money: $("money"),
  stars: $("stars"),
  clock: $("clock"),
  big: $("big"),
  speed: $("speed"),
  hint: $("hint"),
  toast: $("toast"),
  mission: $("mission"),
  health: $("health"),
  mm: ($("minimap") as HTMLCanvasElement).getContext("2d")!,
};
let bigT = 0,
  toastT = 0;
function bigMsg(text: string, sub = "", color = "#ffd36b", secs = 3) {
  hud.big.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ""}`;
  hud.big.style.color = color;
  hud.big.style.opacity = "1";
  bigT = secs;
}
function toast(t: string) {
  hud.toast.textContent = t;
  hud.toast.style.opacity = "1";
  toastT = 3;
}
function addMoney(v: number) {
  player.money = Math.max(0, player.money + v);
  store.set("money", player.money);
  if (v > 0) audio.cash();
}
function setWanted(n: number) {
  player.wanted = THREE.MathUtils.clamp(n, 0, 5);
  player.wantedT = 0;
}

// ---------------------------------------------------------------- missions
interface Mission {
  name: string;
  start: THREE.Vector3;
  reward: number;
  steps: { pos: THREE.Vector3; text: string; car?: boolean }[];
  time: number;
  needsCar?: boolean;
  wanted?: number;
}
const inter = (i: number, j: number, dx = 0, dz = 0) => new THREE.Vector3(roadX[i] + dx, 0, roadZ[j] + dz);
const MISSIONS: Mission[] = [
  {
    name: "Entrega Expressa",
    start: inter(2, 4, 20, 0),
    reward: 1500,
    time: 95,
    steps: [
      { pos: inter(5, 1, 0, 25), text: "Pegue a encomenda na padaria" },
      { pos: inter(0, 3, 0, -25), text: "Entregue no Morro antes do tempo acabar" },
    ],
  },
  {
    name: "Corrida na Orla",
    start: inter(1, 5, -20, 0),
    reward: 2500,
    time: 70,
    needsCar: true,
    steps: [
      { pos: inter(3, 5), text: "Corra pela orla! Checkpoint 1/5" },
      { pos: inter(6, 5), text: "Checkpoint 2/5" },
      { pos: inter(6, 2), text: "Checkpoint 3/5" },
      { pos: inter(3, 2), text: "Checkpoint 4/5" },
      { pos: inter(1, 5), text: "Chegada!" },
    ],
  },
  {
    name: "Fuga da Polícia",
    start: inter(4, 1, 0, 20),
    reward: 3000,
    time: 120,
    needsCar: true,
    wanted: 3,
    steps: [{ pos: new THREE.Vector3(), text: "Despiste a polícia! (perca todas as estrelas)" }],
  },
];
let mission: Mission | null = null;
let mStep = 0,
  mTime = 0,
  mCooldown = 0;
const markerGeo = new THREE.CylinderGeometry(2.2, 2.2, 3, 32, 1, true);
const markerMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
const goalMat = new THREE.MeshBasicMaterial({ color: 0x3fa9ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
const startMarkers = MISSIONS.map((m) => {
  const mk = new THREE.Mesh(markerGeo, markerMat);
  mk.position.copy(m.start).setY(1.5);
  scene.add(mk);
  return mk;
});
const goal = new THREE.Mesh(markerGeo, goalMat);
goal.scale.set(1.6, 4, 1.6);
goal.visible = false;
scene.add(goal);

// money pickups
const cashGeo = new THREE.BoxGeometry(0.9, 0.5, 0.15);
const cashMat = new THREE.MeshStandardMaterial({ color: 0x3fbf5f, emissive: 0x1a8f3a, emissiveIntensity: 0.6 });
const pickups: THREE.Mesh[] = [];

function startMission(m: Mission) {
  if (m.needsCar && !player.car) {
    hint("Essa missão precisa de um carro 🚗", 2.5);
    return;
  }
  mission = m;
  mStep = 0;
  mTime = m.time;
  if (m.wanted) setWanted(m.wanted);
  bigMsg(m.name, "Missão iniciada", "#ffd36b", 2.5);
  goal.visible = !m.wanted;
  if (!m.wanted) goal.position.copy(m.steps[0].pos).setY(6);
}
function endMission(ok: boolean) {
  if (!mission) return;
  if (ok) {
    addMoney(mission.reward);
    bigMsg("MISSÃO COMPLETA", `+ R$ ${mission.reward.toLocaleString("pt-BR")}`, "#7CFC7C", 3.5);
  } else bigMsg("MISSÃO FALHOU", "O tempo acabou", "#ff5e62", 3);
  mission = null;
  goal.visible = false;
  mCooldown = 6;
}

let hintT = 0;
function hint(t: string, secs = 0.2) {
  hud.hint.textContent = t;
  hud.hint.style.opacity = "1";
  hintT = Math.max(hintT, secs);
}

// ---------------------------------------------------------------- spawning
function spawnTraffic(n: number) {
  const kinds: CarKind[] = ["sedan", "hatch", "hatch", "suv", "taxi", "sedan", "sport"];
  for (let k = 0; k < n; k++) {
    const car = new Car(kinds[k % kinds.length], CAR_COLORS[k % CAR_COLORS.length], scene);
    car.driver = "ai";
    const d = new Driver(car);
    d.place(Math.floor(Math.random() * (NX + 1)), Math.floor(Math.random() * (NZ + 1)), Math.floor(Math.random() * 4));
    cars.push(car);
    drivers.set(car, d);
  }
}

function spawnPolice() {
  // appear at an intersection 90–160 m away from the player
  const ref = player.car ? player.car.pos : player.pos;
  let best: [number, number] = [0, 0];
  for (let tries = 0; tries < 30; tries++) {
    const i = Math.floor(Math.random() * (NX + 1)),
      j = Math.floor(Math.random() * (NZ + 1));
    const d = Math.hypot(roadX[i] - ref.x, roadZ[j] - ref.z);
    best = [i, j];
    if (d > 90 && d < 170) break;
  }
  const car = new Car("police", 0xffffff, scene);
  car.driver = "police";
  const d = new Driver(car, true);
  d.place(best[0], best[1], Math.floor(Math.random() * 4));
  cars.push(car);
  drivers.set(car, d);
  police.push(d);
}

function removeCar(car: Car) {
  scene.remove(car.mesh.group);
  cars.splice(cars.indexOf(car), 1);
  const d = drivers.get(car);
  drivers.delete(car);
  if (d) police.splice(police.indexOf(d), 1);
}

// ---------------------------------------------------------------- player helpers
function enterOrExit() {
  if (player.car) {
    const c = player.car;
    if (Math.abs(c.speed) > 6) return;
    const left = new THREE.Vector3(Math.cos(c.heading), 0, -Math.sin(c.heading));
    player.pos.copy(c.pos).addScaledVector(left, 1.6).setY(0.25);
    collideCircle(player.pos, 0.4, world.colliders, world.circles);
    c.driver = null;
    player.car = null;
    player.heading = c.heading;
    scene.add(player.mesh.group);
    input.setCarMode(false);
    return;
  }
  let best: Car | null = null,
    bd = 4.2;
  for (const c of cars) {
    const d = c.pos.distanceTo(player.pos);
    if (d < bd && c.kind !== "police") {
      bd = d;
      best = c;
    }
  }
  if (!best) return;
  if (best.driver === "ai") {
    // carjacking: the driver runs off
    const ped = peds[Math.floor(Math.random() * peds.length)];
    ped.pos.copy(best.pos).add(new THREE.Vector3(1.6, 0.25, 0));
    ped.state = "walk";
    ped.mesh.group.rotation.set(0, 0, 0);
    ped.scare(player.pos);
    drivers.delete(best);
    if (police.some((p) => p.car.pos.distanceTo(player.pos) < 60)) setWanted(Math.max(player.wanted, 1));
    toast("Carro roubado 😬");
  }
  best.driver = "player";
  player.car = best;
  scene.remove(player.mesh.group);
  input.setCarMode(true);
  toast(`📻 ${audio.stations[audio.station]}`);
}

function busted() {
  audio.bust();
  const fine = Math.min(player.money, 1000);
  addMoney(-fine);
  bigMsg("PRESO!", `Multa de R$ ${fine.toLocaleString("pt-BR")}`, "#ff5e62", 4);
  if (player.car) {
    player.car.driver = null;
    player.car = null;
    scene.add(player.mesh.group);
    input.setCarMode(false);
  }
  player.pos.set(roadX[3] + 10, 0.25, roadZ[2] + 10);
  setWanted(0);
  if (mission) endMission(false);
  for (const p of [...police]) removeCar(p.car);
}

// ---------------------------------------------------------------- minimap
const MM_RANGE = 220;
function drawMinimap(focus: THREE.Vector3, heading: number) {
  const g = hud.mm;
  const S = 300;
  g.save();
  g.clearRect(0, 0, S, S);
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
  g.clip();
  const scale = (S / (MM_RANGE * 2)) * 1;
  const src = world.minimapCanvas;
  const pxPerM = src.width / 1400;
  const sx = (focus.x + 700) * pxPerM - MM_RANGE * pxPerM,
    sz = (focus.z + 700) * pxPerM - MM_RANGE * pxPerM;
  g.drawImage(src, sx, sz, MM_RANGE * 2 * pxPerM, MM_RANGE * 2 * pxPerM, 0, 0, S, S);
  const toMM = (p: THREE.Vector3) => [S / 2 + (p.x - focus.x) * scale, S / 2 + (p.z - focus.z) * scale] as const;
  const dot = (p: THREE.Vector3, col: string, r: number, label?: string) => {
    let [x, y] = toMM(p);
    const dx = x - S / 2,
      dy = y - S / 2,
      l = Math.hypot(dx, dy);
    if (l > S / 2 - 12) {
      x = S / 2 + (dx / l) * (S / 2 - 12);
      y = S / 2 + (dy / l) * (S / 2 - 12);
    }
    g.fillStyle = col;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    if (label) {
      g.fillStyle = "#111";
      g.font = "bold 16px sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(label, x, y + 1);
    }
  };
  if (!mission && mCooldown <= 0) MISSIONS.forEach((m) => dot(m.start, "#ffd23f", 11, "M"));
  if (mission && goal.visible) dot(goal.position, "#3fa9ff", 9);
  for (const p of police) {
    const [x, y] = toMM(p.car.pos);
    if (Math.hypot(x - S / 2, y - S / 2) < S / 2) dot(p.car.pos, Math.floor(performance.now() / 250) % 2 ? "#ff3b3b" : "#3b6bff", 6);
  }
  // player arrow
  g.translate(S / 2, S / 2);
  g.rotate(-heading + Math.PI);
  g.fillStyle = "#fff";
  g.strokeStyle = "#000";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, -12);
  g.lineTo(8, 9);
  g.lineTo(0, 4);
  g.lineTo(-8, 9);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
}

// ---------------------------------------------------------------- init
function init() {
  world = buildWorld(scene, renderer, quality);
  if (quality === "alta") {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.35, 0.6, 0.85);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }
  spawnTraffic(quality === "alta" ? 22 : 14);
  for (let k = 0; k < (quality === "alta" ? 26 : 12); k++) {
    const ped = new Pedestrian(k + 1, scene);
    if (quality === "baixa") ped.mesh.group.traverse((o) => (o.castShadow = false));
    peds.push(ped);
  }
  // the player's own red sports car, parked on the beach avenue
  const mine = new Car("sport", 0xc1121f, scene);
  mine.pos.set(roadX[2] + 12, 0, BEACH_ROAD - ROAD / 2 + 3.2);
  mine.heading = Math.PI / 2;
  mine.sync(0);
  cars.push(mine);
  player.pos.set(roadX[2] + 12, 0.25, BEACH_ROAD - ROAD / 2 + 0.6);
  player.heading = Math.PI / 2;
  scene.add(player.mesh.group);
  camYaw = player.heading;
  for (let k = 0; k < 24; k++) {
    const m = new THREE.Mesh(cashGeo, cashMat);
    m.position.set(roadX[Math.floor(Math.random() * (NX + 1))] + (Math.random() - 0.5) * 6, 1.1, roadZ[0] + Math.random() * (roadZ[NZ] - roadZ[0]));
    if (Math.random() < 0.5) m.position.set(roadX[0] + Math.random() * (roadX[NX] - roadX[0]), 1.1, roadZ[Math.floor(Math.random() * (NZ + 1))] + (Math.random() - 0.5) * 6);
    m.castShadow = true;
    scene.add(m);
    pickups.push(m);
  }
  (window as unknown as Record<string, unknown>).__rs = {
    player,
    cars,
    police,
    setWanted,
    world: () => world,
    drive,
    step: (dt: number) => step(dt),
    enter: () => enterOrExit(),
    spawnPolice: () => spawnPolice(),
    big: (a: string, b: string) => bigMsg(a, b, "#ffd36b", 2.5),
    play: () => {
      $("title").style.display = "none";
      $("hud").classList.add("on");
      document.body.classList.add("playing");
      paused = false;
    },
  };
  $("loading").style.display = "none";
  $("menu").style.display = "flex";
  // first frame behind the title, so the menu shows the city
  updateCamera(0.016, true);
  render();
}

function render() {
  if (composer) composer.render();
  else renderer.render(scene, camera);
}

// ---------------------------------------------------------------- camera
function updateCamera(dt: number, snap = false) {
  const st = input.state;
  const target = player.car ? player.car.pos.clone() : player.pos.clone();
  if (st.camDX || st.camDY) camIdle = 0;
  else camIdle += dt;
  camYaw -= st.camDX;
  camPitch = THREE.MathUtils.clamp(camPitch + st.camDY, -0.1, 1.0);
  st.camDX = st.camDY = 0;
  const followHeading = player.car ? player.car.heading : player.heading;
  const moving = player.car ? Math.abs(player.car.speed) > 2 : Math.abs(st.moveY) + Math.abs(st.moveX) > 0.1;
  if (camIdle > 1.2 && moving) {
    let d = followHeading - camYaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    camYaw += d * Math.min(1, dt * (player.car ? 3 : 1.5));
  }
  const dist = player.car ? 7.6 : 4.6;
  const h = player.car ? 2.4 : 1.7;
  const back = new THREE.Vector3(-Math.sin(camYaw) * Math.cos(camPitch), Math.sin(camPitch), -Math.cos(camYaw) * Math.cos(camPitch));
  const want = target.clone().add(new THREE.Vector3(0, h, 0)).addScaledVector(back, dist);
  want.y = Math.max(want.y, 0.6);
  if (snap) camPos.copy(want);
  else camPos.lerp(want, Math.min(1, dt * (player.car ? 7 : 9)));
  camera.position.copy(camPos);
  camera.lookAt(target.x, target.y + (player.car ? 1.2 : 1.4), target.z);
  const spd = player.car ? Math.abs(player.car.speed) : 0;
  camera.fov = 62 + Math.min(14, spd * 0.28);
  camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------- main loop
let last = performance.now();
let time = 0;
let paused = true;
let shake = 0;

// Capture mode (#capture in the URL): no real-time loop; a recorder drives step(dt)
// frame by frame and can script the controls through `drive`.
const CAPTURE = location.hash.includes("capture");
const drive: { moveX?: number; moveY?: number; handbrake?: boolean; sprint?: boolean; camDX?: number } = {};

function loop(now: number) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (paused || !world || CAPTURE) return;
  step(dt);
}

function step(dt: number) {
  time += dt;
  input.poll();
  const st = input.state;
  if (CAPTURE) {
    if (drive.moveX !== undefined) st.moveX = drive.moveX;
    if (drive.moveY !== undefined) st.moveY = drive.moveY;
    if (drive.handbrake !== undefined) st.handbrake = drive.handbrake;
    if (drive.sprint !== undefined) st.sprint = drive.sprint;
    if (drive.camDX) st.camDX += drive.camDX;
  }

  if (st.pressed.has("enter")) enterOrExit();
  if (st.pressed.has("radio") && player.car) toast(`📻 ${audio.nextStation()}`);
  st.pressed.clear();

  // ---- player
  if (player.car) {
    const c = player.car;
    const dead = c.health <= 0;
    c.update(dt, { throttle: dead ? 0 : st.moveY, steer: -st.moveX, handbrake: st.handbrake }, world.colliders, world.circles);
    if (c.lastImpact > 6) {
      audio.crash(c.lastImpact);
      shake = Math.min(0.6, c.lastImpact * 0.03);
    }
    if (dead) hint("O motor morreu 💥 Saia e pegue outro carro", 0.3);
  } else {
    const cy = camYaw;
    const fwd = new THREE.Vector3(Math.sin(cy), 0, Math.cos(cy));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const mv = fwd.multiplyScalar(st.moveY).addScaledVector(right, st.moveX);
    const amt = Math.min(1, mv.length());
    const spd = st.sprint ? 6.4 : 2.4;
    if (amt > 0.05) {
      mv.normalize();
      let d = Math.atan2(mv.x, mv.z) - player.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      player.heading += d * Math.min(1, dt * 12);
      player.pos.addScaledVector(mv, spd * amt * dt);
    }
    collideCircle(player.pos, 0.4, world.colliders, world.circles);
    player.pos.x = THREE.MathUtils.clamp(player.pos.x, world.bounds.minX, world.bounds.maxX);
    player.pos.z = THREE.MathUtils.clamp(player.pos.z, world.bounds.minZ, world.bounds.maxZ + 8);
    player.pos.y = 0.25;
    player.phase += dt * (st.sprint ? 11 : 6.5) * amt;
    animateHuman(player.mesh, player.phase, amt * (st.sprint ? 2 : 1), time);
    player.mesh.group.position.copy(player.pos);
    player.mesh.group.rotation.y = player.heading;
    // nearby car hint
    const near = cars.find((c) => c.kind !== "police" && c.pos.distanceTo(player.pos) < 4.2);
    if (near) hint(input.touch ? "Toque em 🚗 para entrar" : "Aperte E para entrar no carro");
  }
  const focus = player.car ? player.car.pos : player.pos;
  if (player.car) {
    player.car.pos.x = THREE.MathUtils.clamp(player.car.pos.x, world.bounds.minX, world.bounds.maxX);
    if (player.car.pos.z > world.bounds.maxZ) {
      player.car.pos.z = world.bounds.maxZ;
      player.car.vel.z = Math.min(0, player.car.vel.z);
    }
  }

  // ---- AI traffic + police
  const obstacles = cars.map((c) => ({ pos: c.pos, r: 1 }));
  obstacles.push({ pos: player.pos, r: 0.5 });
  for (const p of peds) if (p.state !== "down") obstacles.push({ pos: p.pos, r: 0.4 });
  for (const [car, d] of drivers) {
    if (car === player.car) continue;
    // far-away civilian cars skip physics every other frame to save CPU
    if (!d.police && car.pos.distanceTo(focus) > 260 && Math.floor(time * 60) % 2) continue;
    d.update(dt, obstacles.filter((o) => o.pos !== car.pos), world.colliders, world.circles, d.police ? focus : undefined);
    if (d.police) {
      const on = Math.floor(time * 6) % 2;
      car.mesh.siren[0].emissiveIntensity = on ? 5 : 0.2;
      car.mesh.siren[1].emissiveIntensity = on ? 0.2 : 5;
    }
  }
  // parked / abandoned cars settle
  for (const c of cars) if (!c.driver) c.update(dt, { throttle: 0, steer: 0, handbrake: true }, world.colliders, world.circles);
  // car-car collisions
  for (let a = 0; a < cars.length; a++)
    for (let b = a + 1; b < cars.length; b++) {
      const imp = carVsCar(cars[a], cars[b]);
      if (imp > 4 && (cars[a] === player.car || cars[b] === player.car)) {
        audio.crash(imp);
        shake = Math.min(0.6, imp * 0.04);
        const other = cars[a] === player.car ? cars[b] : cars[a];
        if (other.kind === "police") setWanted(Math.max(player.wanted, 1) + (imp > 8 ? 1 : 0));
      }
    }

  // ---- pedestrians
  for (const p of peds) {
    if (p.pos.distanceTo(focus) > 200 && Math.floor(time * 60) % 3) continue;
    p.update(dt, time, world.colliders, world.circles);
    for (const c of cars) {
      const d = c.pos.distanceTo(p.pos);
      const spd = c.vel.length();
      if (d < 2.2 && spd > 4) {
        if (p.knockDown(c.pos, spd) && c === player.car) {
          setWanted(player.wanted + 1);
          shake = 0.3;
        }
      } else if (d < 9 && spd > 8 && c === player.car) p.scare(c.pos);
    }
  }

  // ---- wanted level
  if (player.wanted > 0) {
    const want = Math.min(6, player.wanted + (player.wanted > 2 ? 1 : 0));
    if (police.length < want && Math.random() < dt * 0.8) spawnPolice();
    const near = police.some((p) => p.car.pos.distanceTo(focus) < 70);
    player.wantedT = near ? 0 : player.wantedT + dt;
    if (player.wantedT > 11) {
      setWanted(player.wanted - 1);
      if (player.wanted === 0) toast("Você despistou a polícia 😎");
    }
    // busted check
    const close = police.some((p) => p.car.pos.distanceTo(focus) < (player.car ? 6.5 : 5));
    const slow = player.car ? Math.abs(player.car.speed) < 2 : true;
    player.bustT = close && slow ? player.bustT + dt : Math.max(0, player.bustT - dt);
    if (player.bustT > (player.car ? 3 : 2.2)) {
      player.bustT = 0;
      busted();
    }
  } else {
    // police leave once they are far away
    for (const p of [...police]) if (p.car.pos.distanceTo(focus) > 150) removeCar(p.car);
    for (const p of police) {
      p.car.mesh.siren[0].emissiveIntensity = 0;
      p.car.mesh.siren[1].emissiveIntensity = 0;
    }
  }

  // ---- missions
  mCooldown -= dt;
  startMarkers.forEach((mk, i) => {
    mk.visible = !mission && mCooldown <= 0;
    mk.scale.y = 1 + Math.sin(time * 3 + i) * 0.1;
    if (mk.visible && mk.position.distanceTo(focus.clone().setY(1.5)) < 3.5) startMission(MISSIONS[i]);
  });
  if (mission) {
    mTime -= dt;
    const m = mission;
    if (m.wanted) {
      if (player.wanted === 0 && mTime < m.time - 2) endMission(true);
    } else {
      const s = m.steps[mStep];
      goal.position.set(s.pos.x, 6, s.pos.z);
      if (Math.hypot(focus.x - s.pos.x, focus.z - s.pos.z) < 5.5) {
        mStep++;
        audio.cash();
        if (mStep >= m.steps.length) endMission(true);
      }
    }
    if (mission && mTime <= 0) endMission(false);
    if (mission) {
      hud.mission.style.display = "block";
      (hud.mission.querySelector(".t") as HTMLElement).textContent = `${m.name} • ${Math.ceil(mTime)}s`;
      (hud.mission.querySelector(".d") as HTMLElement).textContent = m.wanted ? m.steps[0].text : m.steps[mStep].text;
    }
  } else hud.mission.style.display = "none";

  // ---- pickups
  for (const pk of pickups) {
    if (!pk.visible) continue;
    pk.rotation.y = time * 2;
    pk.position.y = 1.1 + Math.sin(time * 3 + pk.id) * 0.15;
    if (pk.position.distanceTo(focus.clone().setY(1.1)) < 2.6) {
      pk.visible = false;
      addMoney(100 + Math.floor(Math.random() * 4) * 50);
      setTimeout(() => (pk.visible = true), 60000);
    }
  }

  // ---- world, camera, audio
  world.update(dt, time, focus);
  if (bloom) bloom.strength = world.isNight() ? 0.5 : 0.25;
  updateCamera(dt);
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    shake = Math.max(0, shake - dt * 1.5);
  }
  const sirenNear = police.length && player.wanted > 0 ? Math.max(0, 1 - Math.min(...police.map((p) => p.car.pos.distanceTo(focus))) / 120) : 0;
  audio.update(time, {
    inCar: !!player.car,
    rpm: player.car ? Math.min(1, Math.abs(player.car.speed) / player.car.maxSpeed) : 0,
    throttle: player.car ? Math.abs(st.moveY) : 0,
    siren: sirenNear,
    horn: !!player.car && st.horn,
  });
  for (const c of cars) c.mesh.head.emissiveIntensity = world.isNight() ? 3 : 0.6;

  // ---- HUD
  hud.money.textContent = `R$ ${player.money.toLocaleString("pt-BR")}`;
  hud.stars.innerHTML = Array.from({ length: 5 }, (_, i) => (i < player.wanted ? "<b>★</b>" : "★")).join("");
  hud.stars.classList.toggle("flash", player.wanted > 0 && player.wantedT > 0);
  const hr = world.timeOfDay();
  hud.clock.textContent = `${String(Math.floor(hr)).padStart(2, "0")}:${String(Math.floor((hr % 1) * 60)).padStart(2, "0")}`;
  if (player.car) {
    hud.speed.style.display = "block";
    hud.speed.innerHTML = `${Math.round(Math.abs(player.car.speed) * 3.6)} <small>km/h</small>`;
    hud.health.style.display = "block";
    (hud.health.firstElementChild as HTMLElement).style.width = `${player.car.health}%`;
    (hud.health.firstElementChild as HTMLElement).style.background = player.car.health > 50 ? "#4ade80" : player.car.health > 20 ? "#facc15" : "#ef4444";
  } else {
    hud.speed.style.display = "none";
    hud.health.style.display = "none";
  }
  bigT -= dt;
  if (bigT <= 0) hud.big.style.opacity = "0";
  toastT -= dt;
  if (toastT <= 0) hud.toast.style.opacity = "0";
  hintT -= dt;
  if (hintT <= 0) hud.hint.style.opacity = "0";
  drawMinimap(focus, player.car ? player.car.heading : camYaw);

  render();
}

// ---------------------------------------------------------------- boot
addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  composer?.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});
$("play").addEventListener("click", async () => {
  audio.start();
  $("title").style.display = "none";
  $("hud").classList.add("on");
  document.body.classList.add("playing");
  paused = false;
  last = performance.now();
  bigMsg("BRASIL ROTA SUL", "Bem-vindo a Porto Sol", "#ffd36b", 3);
  try {
    await document.documentElement.requestFullscreen?.();
    await (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.("landscape");
  } catch {
    /* not supported (e.g. iOS) */
  }
});
const setPaused = (p: boolean) => {
  paused = p;
  $("pause").classList.toggle("on", p);
  if (!p) last = performance.now();
};
$("pausebtn").addEventListener("click", () => setPaused(true));
$("resume").addEventListener("click", () => setPaused(false));
addEventListener("keydown", (e) => {
  if (e.code === "Escape" && $("title").style.display === "none") setPaused(!paused);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && $("title").style.display === "none") setPaused(true);
});

setTimeout(() => {
  init();
  requestAnimationFrame(loop);
}, 30);
