import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { buildWorld, roadX, roadZ, NX, NZ, BEACH_ROAD, ROAD, World, PIER, DOCK, SEA_Z, districtAt } from "./world";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { Car, CarKind, CAR_COLORS, carVsCar } from "./car";
import { Driver } from "./traffic";
import { makeHuman, animateHuman, collideCircle, Pedestrian } from "./humans";
import { createInput } from "./input";
import { WEAPONS, Arsenal, makeWeaponMesh, createWheel, Effects, raycastTargets, rayBoxes, Gunman } from "./combat";
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
  health: 100,
  hurtT: 0,
};
const arsenal = new Arsenal(
  (() => {
    try {
      const v = localStorage.getItem("rotasul.arsenal");
      return v ? JSON.parse(v) : undefined;
    } catch {
      return undefined;
    }
  })()
);
const saveArsenal = () => {
  try {
    localStorage.setItem("rotasul.arsenal", JSON.stringify({ owned: arsenal.owned, ammo: arsenal.ammo }));
  } catch {
    /* private mode */
  }
};
let heldGun: THREE.Group | null = null;
function equip(i: number) {
  if (!arsenal.owned[i]) {
    hint(`🔒 ${WEAPONS[i].name}: compre na Armaria do Porto`, 2.5);
    return;
  }
  arsenal.select(i);
  if (heldGun) player.mesh.rFore.remove(heldGun);
  heldGun = makeWeaponMesh(arsenal.w.id);
  heldGun.position.y = -0.3;
  heldGun.rotation.x = -Math.PI / 2;
  if (arsenal.w.id === "taco") heldGun.rotation.x = -0.4;
  player.mesh.rFore.add(heldGun);
  toast(`${arsenal.w.name}${arsenal.w.melee ? "" : ` • ${arsenal.ammo[i]} balas`}`);
}
const gunmen: Gunman[] = [];
const fx = new Effects(scene);
const wheel = createWheel(document.body, (i) => {
  equip(i);
  wheel.close();
});
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
interface Step {
  pos: THREE.Vector3;
  text: string;
  car?: boolean;
  kind?: "goto" | "hold" | "kill" | "lose" | "deliver";
  hold?: number;
  onDone?: () => void;
  onStart?: () => void;
}
interface Mission {
  name: string;
  contact?: string;
  intro?: string;
  start: THREE.Vector3;
  reward: number;
  steps: Step[];
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
// GTA-style story jobs (original characters and places)
const STORE = new THREE.Vector3(roadX[1] + 30, 0, BEACH_ROAD + ROAD / 2 + 20);
const GANG = new THREE.Vector3(roadX[0] - 40, 0, roadZ[2] - 10);
const IMPORT = new THREE.Vector3(roadX[5] + 25, 0, roadZ[1] + ROAD / 2 + 4);
const GARAGE = new THREE.Vector3(roadX[1], 0, roadZ[3]);
let holdT = 0;
let importCar: Car | null = null;
const missionThugs: Gunman[] = [];
MISSIONS.push(
  {
    name: "Assalto à Conveniência",
    contact: "Tio Zé",
    intro: "A conveniência da orla tá cheia de grana. Entra armado, rende o caixa e some!",
    start: inter(1, 4, 0, 22),
    reward: 4000,
    time: 150,
    steps: [
      { pos: STORE, text: "Vá até a Conveniência 24h na orla" },
      { pos: STORE, kind: "hold", hold: 5, text: "Renda o caixa! Fique na loja com uma arma de fogo na mão", onDone: () => { addMoney(1200); setWanted(2); toast("💰 Pegou o dinheiro do caixa!"); } },
      { pos: STORE, kind: "lose", text: "Fuja! Despiste a polícia (perca as estrelas)" },
    ],
  },
  {
    name: "Acerto de Contas",
    contact: "Dona Rita",
    intro: "A gangue do Farol tá cobrando pedágio dos meus meninos. Resolve isso pra mim.",
    start: inter(1, 2, -20, 0),
    reward: 5000,
    time: 180,
    steps: [
      { pos: GANG, text: "Vá até o pé do Morro do Farol", onDone: () => spawnThugs(GANG, 5) },
      { pos: GANG, kind: "kill", text: "Derrube a gangue do Farol" },
    ],
  },
  {
    name: "Carro Importado",
    contact: "Baixinho",
    intro: "Tem um esportivo amarelo parado na Vila Coral. Pega e traz pra minha garagem inteiro!",
    start: inter(4, 3, 18, 0),
    reward: 6000,
    time: 160,
    steps: [
      { pos: IMPORT, text: "Roube o esportivo amarelo", kind: "deliver", onStart: () => spawnImport() },
      { pos: GARAGE, text: "Leve o carro até a garagem do Baixinho", kind: "goto", car: true },
    ],
  }
);
function spawnThugs(at: THREE.Vector3, n: number) {
  for (let k = 0; k < n; k++) {
    const g = new Gunman(scene, "thug", 300 + k * 17);
    g.pos.set(at.x + (Math.random() - 0.5) * 16, 0.25, at.z + (Math.random() - 0.5) * 16);
    g.home.copy(g.pos);
    missionThugs.push(g);
    gunmen.push(g);
  }
}
function spawnImport() {
  if (importCar) return;
  importCar = new Car("sport", 0xffc300, scene);
  importCar.pos.copy(IMPORT);
  importCar.heading = Math.PI / 2;
  importCar.sync(0);
  cars.push(importCar);
  spawnThugs(IMPORT.clone().add(new THREE.Vector3(0, 0, 6)), 2);
}
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

// the convenience store robbed in a mission and the gun shop
{
  const shop = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 7), new THREE.MeshStandardMaterial({ color: 0xf1f1f1, roughness: 0.7 }));
  shop.position.copy(STORE).add(new THREE.Vector3(0, 2, 5.5));
  shop.castShadow = true;
  scene.add(shop);
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 96;
  const g = c.getContext("2d")!;
  g.fillStyle = "#d62828";
  g.fillRect(0, 0, 512, 96);
  g.fillStyle = "#fff";
  g.font = "900 56px sans-serif";
  g.textAlign = "center";
  g.fillText("CONVENIÊNCIA 24H", 256, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.6), new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.6 }));
  sg.position.copy(STORE).add(new THREE.Vector3(0, 4.8, 1.98));
  scene.add(sg);
}
const GUNSHOP = new THREE.Vector3(roadX[3] + 16, 0, roadZ[3] - ROAD / 2 - 3);
const shopMarker = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: 0xff4d4d, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
shopMarker.position.copy(GUNSHOP).setY(1.5);
scene.add(shopMarker);
let shopCooldown = 0;
function openShop() {
  paused = true;
  const el = $("shop");
  const list = el.querySelector(".list") as HTMLElement;
  const render = () => {
    list.innerHTML = "";
    WEAPONS.forEach((w, i) => {
      if (w.melee && w.price === 0) return;
      const row = document.createElement("div");
      row.className = "row";
      const owned = arsenal.owned[i];
      row.innerHTML = `<svg viewBox="0 0 56 56"><path d="${w.icon}" fill="currentColor"/></svg><b>${w.name}</b><span>${owned ? `${arsenal.ammo[i]} balas` : ""}</span>`;
      const btn = document.createElement("button");
      btn.className = "tbtn";
      btn.textContent = owned ? `+${w.clip * 3} balas • R$ ${w.ammoPrice}` : `Comprar • R$ ${w.price.toLocaleString("pt-BR")}`;
      btn.onclick = () => {
        const cost = owned ? w.ammoPrice : w.price;
        if (player.money < cost) {
          btn.textContent = "Dinheiro insuficiente";
          return;
        }
        addMoney(-cost);
        if (!owned) {
          arsenal.owned[i] = true;
          arsenal.ammo[i] += w.clip * 2;
        } else arsenal.ammo[i] += w.clip * 3;
        saveArsenal();
        render();
      };
      row.appendChild(btn);
      list.appendChild(row);
    });
    (el.querySelector(".cash") as HTMLElement).textContent = `R$ ${player.money.toLocaleString("pt-BR")}`;
  };
  render();
  el.classList.add("on");
}
$("shopClose").addEventListener("click", () => {
  $("shop").classList.remove("on");
  paused = false;
  last = performance.now();
  shopCooldown = 4;
});

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
  bigMsg(m.name, m.contact ? `${m.contact}: "${m.intro}"` : "Missão iniciada", "#ffd36b", m.contact ? 5 : 2.5);
  goal.visible = !m.wanted;
  holdT = 0;
  m.steps[0].onStart?.();
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
  for (const g of missionThugs) {
    g.remove(scene);
    gunmen.splice(gunmen.indexOf(g), 1);
  }
  missionThugs.length = 0;
  importCar = null;
}

let hintT = 0;
let lastDistrict = "";
let areaT = 0;
function areaCard(name: string) {
  const el = $("area");
  el.textContent = name;
  el.classList.remove("on");
  void el.offsetWidth;
  el.classList.add("on");
  areaT = 3.5;
}
function hint(t: string, secs = 0.2) {
  hud.hint.textContent = t;
  hud.hint.style.opacity = "1";
  hintT = Math.max(hintT, secs);
}

// ---------------------------------------------------------------- spawning
function spawnTraffic(n: number) {
  const kinds: CarKind[] = ["sedan", "hatch", "moto", "hatch", "suv", "taxi", "sedan", "moto", "sport"];
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
    if (c.kind === "jetski") {
      if (c.pos.distanceTo(DOCK) > 12) {
        hint("Volte ao píer para descer do jet ski 🌊", 2.5);
        return;
      }
      player.pos.set(PIER.x, PIER.y, c.pos.z);
    } else {
      const left = new THREE.Vector3(Math.cos(c.heading), 0, -Math.sin(c.heading));
      player.pos.copy(c.pos).addScaledVector(left, 1.6).setY(0.25);
    }
    if (c.mesh.rider) c.mesh.rider.visible = false;
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
    const d = Math.hypot(c.pos.x - player.pos.x, c.pos.z - player.pos.z) + (c.kind === "jetski" ? -1.5 : 0);
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
    toast(best.kind === "moto" ? "Moto roubada 😬" : "Carro roubado 😬");
  }
  best.driver = "player";
  player.car = best;
  if (best.mesh.rider) best.mesh.rider.visible = true;
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

// Cinematic grade in display space: warm highlights, teal shadows, contrast, vignette.
const GRADE = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.299,0.587,0.114));
      c = mix(vec3(l), c, 1.14);                        // saturation
      c = (c - 0.5) * 1.07 + 0.5;                       // contrast
      c += mix(vec3(-0.012,0.006,0.03), vec3(0.035,0.012,-0.025), smoothstep(0.2,0.8,l)); // split tone
      float v = smoothstep(0.95, 0.35, length(vUv - 0.5));
      c *= mix(0.78, 1.0, v);                           // vignette
      gl_FragColor = vec4(clamp(c,0.0,1.0), 1.0);
    }`,
};

// ---------------------------------------------------------------- init
function init() {
  world = buildWorld(scene, renderer, quality);
  if (quality === "alta") {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.35, 0.5, 0.92);
    const ao = new GTAOPass(scene, camera, innerWidth / 2, innerHeight / 2);
    ao.blendIntensity = 0.75;
    composer.addPass(ao);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    composer.addPass(new ShaderPass(GRADE));
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
  const bike = new Car("moto", 0x111111, scene);
  bike.pos.set(roadX[2] + 4, 0, BEACH_ROAD - ROAD / 2 + 3.4);
  bike.heading = Math.PI / 2;
  if (bike.mesh.rider) bike.mesh.rider.visible = false;
  bike.sync(0);
  cars.push(bike);
  const ski = new Car("jetski", 0xff2bd6, scene);
  ski.pos.copy(DOCK);
  ski.heading = 0;
  ski.sync(0);
  cars.push(ski);
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
    equip: (i: number) => equip(i),
    wheel: () => wheel.open(arsenal),
    closeWheel: () => wheel.close(),
    mission: (i: number) => startMission(MISSIONS[i]),
    shop: () => openShop(),
    gunmen,
    arsenal,
    get hp() {
      return player.health;
    },
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

// ---------------------------------------------------------------- combat
function damagePlayer(n: number) {
  if (player.health <= 0) return;
  if (player.car) {
    player.car.health = Math.max(0, player.car.health - n * 0.8);
    n *= 0.35;
  }
  player.health -= n;
  player.hurtT = 0;
  audio.hurt();
  $("hurt").classList.remove("on");
  void $("hurt").offsetWidth;
  $("hurt").classList.add("on");
  if (player.health <= 0) wasted();
}

function wasted() {
  const fee = Math.min(player.money, 800);
  addMoney(-fee);
  bigMsg("APAGOU", `Você acordou no Hospital Central • -R$ ${fee}`, "#ff5e62", 4.5);
  if (player.car) {
    player.car.driver = null;
    player.car = null;
    scene.add(player.mesh.group);
    input.setCarMode(false);
  }
  player.pos.set(roadX[3] + 10, 0.25, roadZ[1] + ROAD / 2 + 3);
  player.health = 100;
  setWanted(0);
  if (mission) endMission(false);
  for (const p of [...police]) removeCar(p.car);
  for (const g of gunmen.filter((g) => g.kind === "cop")) {
    g.remove(scene);
    gunmen.splice(gunmen.indexOf(g), 1);
  }
}

function combatStep(dt: number, st: typeof input.state, focus: THREE.Vector3) {
  arsenal.cool -= dt;
  player.hurtT += dt;
  if (player.hurtT > 5 && player.health < 60) player.health = Math.min(60, player.health + dt * 4);
  fx.update(dt);
  // ---- player attacks (on foot)
  if (!player.car && st.fire && arsenal.cool <= 0 && !wheel.isOpen) {
    const w = arsenal.w;
    arsenal.cool = w.rate;
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    const targets: { obj: Gunman | Pedestrian | Car; center: THREE.Vector3; r: number }[] = [];
    for (const g of gunmen) if (!g.dead) targets.push({ obj: g, center: g.pos.clone().setY(g.pos.y + 1.1), r: 0.55 });
    for (const p of peds) if (p.state !== "down") targets.push({ obj: p, center: p.pos.clone().setY(1.1), r: 0.5 });
    for (const c of cars) if (c !== player.car) targets.push({ obj: c, center: c.pos.clone().setY(0.9), r: 1.4 });
    if (w.melee) {
      arsenal.lastShot = time;
      audio.shot(w.id);
      const front = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
      for (const t of targets) {
        const rel = t.center.clone().setY(0).sub(player.pos.clone().setY(0));
        if (rel.length() < w.range + t.r && rel.normalize().dot(front) > 0.4) {
          applyHit(t.obj, w.damage, player.pos);
          break;
        }
      }
    } else if (arsenal.ammo[arsenal.slot] > 0) {
      arsenal.ammo[arsenal.slot]--;
      arsenal.lastShot = time;
      // aim assist: snap to the target closest to the crosshair
      const eye = player.pos.clone().setY(player.pos.y + 1.45);
      let best: { c: THREE.Vector3; a: number } | null = null;
      for (const t of targets) {
        if (t.obj instanceof Car) continue;
        const v = t.center.clone().sub(eye);
        if (v.length() > w.range) continue;
        const a = v.normalize().angleTo(fwd);
        if (a < 0.28 && (!best || a < best.a)) best = { c: t.center, a };
      }
      const aim = best ? best.c.clone().sub(eye).normalize() : new THREE.Vector3(fwd.x, Math.max(fwd.y, -0.05), fwd.z).normalize();
      player.heading = Math.atan2(aim.x, aim.z);
      const muzzle = eye.clone().addScaledVector(aim, 0.7);
      audio.shot(w.id);
      for (let k = 0; k < w.pellets; k++) {
        const dir = aim.clone().add(new THREE.Vector3((Math.random() - 0.5) * w.spread * 2, (Math.random() - 0.5) * w.spread, (Math.random() - 0.5) * w.spread * 2)).normalize();
        const wall = rayBoxes(muzzle, dir, w.range, world.colliders);
        const hit = raycastTargets(muzzle, dir, wall, targets);
        const end = muzzle.clone().addScaledVector(dir, hit ? hit.dist : wall);
        fx.shot(muzzle, end);
        if (hit) applyHit(hit.obj, w.damage, muzzle);
      }
      // gunfire scares people and draws the police
      for (const p of peds) if (p.pos.distanceTo(player.pos) < 30) p.scare(player.pos);
      if (police.some((p) => p.car.pos.distanceTo(player.pos) < 50)) setWanted(Math.max(player.wanted, 2));
      saveArsenal();
    } else {
      hint("Sem munição! Compre na Armaria do Porto 🔫", 1.5);
      arsenal.cool = 0.4;
    }
  }
  // ---- police get out of their cars from 2 stars
  if (player.wanted >= 2) {
    const cops = gunmen.filter((g) => g.kind === "cop" && !g.dead).length;
    const cap = Math.min(8, player.wanted * 2);
    if (cops < cap && Math.random() < dt * 0.8) {
      const pc = police.find((p) => p.car.pos.distanceTo(focus) < 45);
      if (pc) {
        const g = new Gunman(scene, "cop", Math.floor(Math.random() * 999));
        const side = new THREE.Vector3(Math.cos(pc.car.heading), 0, -Math.sin(pc.car.heading));
        g.pos.copy(pc.car.pos).addScaledVector(side, 1.8).setY(0.25);
        gunmen.push(g);
      }
    }
  }
  // ---- armed NPCs
  const moving = player.car ? Math.abs(player.car.speed) > 5 : input.state.moveY !== 0 || input.state.moveX !== 0;
  for (const g of gunmen) {
    const hostile = g.kind === "cop" ? player.wanted >= 2 : g.pos.distanceTo(focus) < 35 || g.health < 100;
    if (!hostile && !g.dead) {
      // idle: stand around
      g.mesh.group.position.copy(g.pos);
      animateHuman(g.mesh, 0, 0, time);
      continue;
    }
    g.update(dt, time, focus, moving, world.colliders, world.circles, (from, hit) => {
      audio.shot("pistola", true);
      const to = focus.clone().setY(focus.y + 1.1).add(hit ? new THREE.Vector3() : new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 2, (Math.random() - 0.5) * 4));
      fx.shot(from, to);
      if (hit) damagePlayer(g.kind === "cop" ? 9 : 11);
    });
  }
  // cleanup bodies and cops once the heat is gone
  for (const g of [...gunmen]) {
    const gone = (g.dead && g.deadT > 20) || (g.kind === "cop" && player.wanted === 0 && g.pos.distanceTo(focus) > 70);
    if (gone && !missionThugs.includes(g)) {
      g.remove(scene);
      gunmen.splice(gunmen.indexOf(g), 1);
    }
  }
}

function applyHit(obj: Gunman | Pedestrian | Car, dmg: number, from: THREE.Vector3) {
  if (obj instanceof Gunman) {
    const killed = obj.hit(dmg);
    if (obj.kind === "cop") setWanted(Math.max(player.wanted, 2) + (killed ? 1 : 0));
    if (killed && obj.kind === "thug") toast("💥 Gangue derrubada");
  } else if (obj instanceof Car) {
    obj.health = Math.max(0, obj.health - dmg * 0.4);
    if (obj.kind === "police") setWanted(Math.max(player.wanted, 2));
  } else {
    if (obj.knockDown(from, 6)) setWanted(player.wanted + 1);
  }
}

// ---------------------------------------------------------------- main loop
let last = performance.now();
let time = 0;
let paused = true;
let shake = 0;

// Capture mode (#capture in the URL): no real-time loop; a recorder drives step(dt)
// frame by frame and can script the controls through `drive`.
const CAPTURE = location.hash.includes("capture");
const drive: { moveX?: number; moveY?: number; handbrake?: boolean; sprint?: boolean; camDX?: number; fire?: boolean } = {};

function loop(now: number) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (paused || !world || CAPTURE) return;
  step(dt);
}

function step(dt: number) {
  if (wheel.isOpen) dt *= 0.2;
  time += dt;
  input.poll();
  const st = input.state;
  if (CAPTURE) {
    if (drive.moveX !== undefined) st.moveX = drive.moveX;
    if (drive.moveY !== undefined) st.moveY = drive.moveY;
    if (drive.handbrake !== undefined) st.handbrake = drive.handbrake;
    if (drive.sprint !== undefined) st.sprint = drive.sprint;
    if (drive.camDX) st.camDX += drive.camDX;
    if (drive.fire !== undefined) st.fire = drive.fire;
  }

  if (st.pressed.has("enter")) enterOrExit();
  if (st.pressed.has("wheel")) {
    if (wheel.isOpen) wheel.close();
    else if (!player.car) wheel.open(arsenal);
  }
  for (let k = 0; k < WEAPONS.length; k++) if (st.pressed.has("slot" + k)) equip(k);
  if (st.pressed.has("radio") && player.car) toast(`📻 ${audio.nextStation()}`);
  st.pressed.clear();

  // ---- player
  if (player.car) {
    const c = player.car;
    const dead = c.health <= 0;
    const sea = c.kind === "jetski";
    c.update(dt, { throttle: dead ? 0 : st.moveY, steer: -st.moveX, handbrake: st.handbrake }, sea ? [] : world.colliders, world.circles);
    if (sea && c.pos.z < SEA_Z - 6) {
      c.pos.z = SEA_Z - 6;
      c.vel.z = Math.max(0, c.vel.z);
    }
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
    const pierLane = Math.abs(player.pos.x - PIER.x) < PIER.w / 2;
    player.pos.z = THREE.MathUtils.clamp(player.pos.z, world.bounds.minZ, pierLane ? PIER.z1 - 0.5 : world.bounds.maxZ + 8);
    const onPier = Math.abs(player.pos.x - PIER.x) < PIER.w / 2 && player.pos.z > PIER.z0 - 1;
    if (onPier) player.pos.z = Math.min(player.pos.z, PIER.z1 - 0.5);
    player.pos.y = onPier ? PIER.y : 0.25;
    player.phase += dt * (st.sprint ? 11 : 6.5) * amt;
    animateHuman(player.mesh, player.phase, amt * (st.sprint ? 2 : 1), time);
    if (!arsenal.w.melee && (st.fire || time - arsenal.lastShot < 1.2)) {
      player.mesh.rArm.rotation.x = -1.5;
      player.mesh.rFore.rotation.x = -0.05;
      if (arsenal.w.twoHanded) {
        player.mesh.lArm.rotation.x = -1.35;
        player.mesh.lArm.rotation.z = 0.55;
        player.mesh.lFore.rotation.x = -0.4;
      }
    } else if (arsenal.w.id === "taco" && time - arsenal.lastShot < 0.35) {
      player.mesh.rArm.rotation.x = -2.2 + (time - arsenal.lastShot) * 6;
    }
    player.mesh.group.position.copy(player.pos);
    player.mesh.group.rotation.y = player.heading;
    // nearby car hint
    const near = cars.find((c) => c.kind !== "police" && c.pos.distanceTo(player.pos) < 4.2);
    if (near) hint(input.touch ? "Toque em 🚗 para entrar" : "Aperte E para entrar no carro");
  }
  const focus = player.car ? player.car.pos : player.pos;
  if (player.car) {
    player.car.pos.x = THREE.MathUtils.clamp(player.car.pos.x, world.bounds.minX, world.bounds.maxX);
    if (player.car.kind !== "jetski" && player.car.pos.z > world.bounds.maxZ) {
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
  for (const c of cars) if (!c.driver) c.update(dt, { throttle: 0, steer: 0, handbrake: true }, c.kind === "jetski" ? [] : world.colliders, world.circles);
  // district name card, like crossing into a new part of the map
  const dname = districtAt(focus.x, focus.z);
  if (dname !== lastDistrict) {
    lastDistrict = dname;
    areaCard(dname);
  }
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
    player.bustT = close && slow && player.wanted <= 1 ? player.bustT + dt : Math.max(0, player.bustT - dt);
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
      goal.visible = s.kind !== "lose" && s.kind !== "kill";
      let done = false;
      const near = Math.hypot(focus.x - s.pos.x, focus.z - s.pos.z) < 5.5;
      if (s.kind === "hold") {
        if (near && !player.car && arsenal.armed) {
          holdT += dt;
          hint(`Rendendo o caixa… ${Math.max(0, (s.hold ?? 5) - holdT).toFixed(1)}s`, 0.3);
        }
        done = holdT >= (s.hold ?? 5);
      } else if (s.kind === "lose") done = player.wanted === 0;
      else if (s.kind === "kill") done = missionThugs.every((g) => g.dead);
      else if (s.kind === "deliver") done = !!importCar && player.car === importCar;
      else done = near && (!s.car || (player.car !== null && (!importCar || player.car === importCar)));
      if (done) {
        s.onDone?.();
        mStep++;
        holdT = 0;
        audio.cash();
        if (mStep >= m.steps.length) {
          if (importCar && player.car === importCar) m.reward = Math.round(m.reward * (0.4 + 0.6 * importCar.health / 100));
          endMission(true);
        } else m.steps[mStep].onStart?.();
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
  combatStep(dt, st, focus);
  shopCooldown -= dt;
  shopMarker.visible = shopCooldown <= 0;
  if (!player.car && shopCooldown <= 0 && player.pos.distanceTo(GUNSHOP.clone().setY(player.pos.y)) < 3) openShop();
  world.update(dt, time, focus);
  if (bloom) bloom.strength = world.isNight() ? 0.55 : 0.04;
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
  $("weapon").textContent = player.car ? "" : `${arsenal.w.name}${arsenal.w.melee ? "" : ` • ${arsenal.ammo[arsenal.slot]}`}`;
  ($("hp").firstElementChild as HTMLElement).style.width = `${Math.max(0, player.health)}%`;
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
  areaT -= dt;
  if (areaT <= 0) $("area").classList.remove("on");
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
