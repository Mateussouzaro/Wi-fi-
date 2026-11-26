import * as THREE from "three";
import { buildStage } from "./scene";
import { buildRig } from "./hands";
import { Kite, lineContact, lineMats, LINE_PTS } from "./kite";
import { DESIGNS, kiteTexture } from "./art";
import { Sound } from "./sound";

// ---------------------------------------------------------------- save data (best effort)
const save = {
  get(k: string, d: number) {
    try {
      const v = localStorage.getItem("ceudepipa." + k);
      return v === null ? d : Number(v);
    } catch {
      return d;
    }
  },
  set(k: string, v: number) {
    try {
      localStorage.setItem("ceudepipa." + k, String(v));
    } catch {
      /* private mode */
    }
  },
};
const $ = (id: string) => document.getElementById(id)!;

const PRICES = [0, 0, 300, 500, 800, 1200, 1600, 2500];
const state = {
  coins: save.get("coins", 0),
  best: save.get("best", 0),
  lineLv: save.get("line", 1),
  design: save.get("design", 0),
  owned: save.get("owned", 0b11),
  cuts: 0,
  combo: 0,
  caught: 0,
};
let quality: "alta" | "baixa" = save.get("q", /Android|iPhone|iPad/i.test(navigator.userAgent) ? 0 : 1) ? "alta" : "baixa";

// ---------------------------------------------------------------- renderer + scene
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, quality === "alta" ? 2 : 1.25));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = quality === "alta";
$("app").appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.05, 5000);
camera.position.set(0, 1.65, 0);
scene.add(camera);
const stage = buildStage(scene, quality);
const rig = buildRig(camera);
const sound = new Sound();

// ---------------------------------------------------------------- kites
const LINE_COLORS = [0xff4d6d, 0x4cc9f0, 0xf9c74f, 0x90be6d, 0xb5179e, 0xf3722c, 0x43aa8b, 0x9d4edd];
const hand = new THREE.Vector3();
let player = new Kite(scene, state.design, 0xffffff, true);
const enemies: { kite: Kite; respawn: number }[] = [];
const loose: Kite[] = [];

function spawnEnemy(slot: number) {
  const spots = stage.flyerSpots;
  const k = new Kite(scene, Math.floor(Math.random() * DESIGNS.length), LINE_COLORS[slot % LINE_COLORS.length], false);
  const a = spots[Math.floor(Math.random() * spots.length)];
  k.launch(a, 70 + Math.random() * 80);
  k.aggression = 0.25 + Math.random() * 0.45 + Math.min(0.25, state.cuts * 0.02);
  k.spinDir = Math.random() < 0.5 ? 1 : -1;
  return k;
}
const ENEMIES = quality === "alta" ? 7 : 5;

// ---------------------------------------------------------------- input
const input = { pulling: false, releasing: false, reeling: false, lastX: 0 };
const canvas = renderer.domElement;
canvas.addEventListener("pointerdown", (e) => {
  input.pulling = true;
  input.lastX = e.clientX;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!input.pulling) return;
  // dragging sideways while pulling nudges the kite's nose
  player.theta -= (e.clientX - input.lastX) * 0.012;
  input.lastX = e.clientX;
});
const up = () => (input.pulling = false);
canvas.addEventListener("pointerup", up);
canvas.addEventListener("pointercancel", up);
const holdBtn = (id: string, key: "releasing" | "reeling") => {
  const b = $(id);
  b.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    input[key] = true;
    b.classList.add("down");
  });
  const off = () => {
    input[key] = false;
    b.classList.remove("down");
  };
  b.addEventListener("pointerup", off);
  b.addEventListener("pointerleave", off);
  b.addEventListener("pointercancel", off);
};
holdBtn("release", "releasing");
holdBtn("reel", "reeling");
const keys = new Set<string>();
addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (e.code === "Space") input.pulling = true;
});
addEventListener("keyup", (e) => {
  keys.delete(e.code);
  if (e.code === "Space") input.pulling = false;
});

// ---------------------------------------------------------------- HUD
const hud = {
  combo: $("combo"),
  comboN: $("comboN"),
  cuts: $("cuts"),
  coins: $("coins"),
  msg: $("msg"),
  meter: $("meterFill"),
  meterTxt: $("meterTxt"),
  fx: $("fx"),
};
let msgT = 0;
function message(text: string, color = "#fff", secs = 1.6) {
  hud.msg.textContent = text;
  hud.msg.style.color = color;
  hud.msg.classList.remove("pop");
  void hud.msg.offsetWidth;
  hud.msg.classList.add("pop");
  msgT = secs;
}
function bubbles(n: number) {
  for (let i = 0; i < n; i++) {
    const b = document.createElement("i");
    b.style.left = `${45 + Math.random() * 10}%`;
    b.style.animationDelay = `${Math.random() * 0.3}s`;
    b.style.width = b.style.height = `${4 + Math.random() * 8}px`;
    hud.fx.appendChild(b);
    setTimeout(() => b.remove(), 1600);
  }
}
function refreshHud() {
  hud.comboN.textContent = String(state.combo);
  hud.combo.classList.toggle("fire", state.combo >= 5);
  hud.combo.style.visibility = state.combo > 0 ? "visible" : "hidden";
  hud.cuts.innerHTML = `✂️ ${state.cuts} &nbsp; 🪁 ${state.caught} &nbsp; 🏆 ${state.best}`;
  hud.coins.textContent = `🪙 ${state.coins.toLocaleString("pt-BR")}`;
}
function addCoins(v: number) {
  state.coins += v;
  save.set("coins", state.coins);
}

// sparks where lines rub
const sparkGeo = new THREE.BufferGeometry();
const SP = 40;
sparkGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(SP * 3), 3));
const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0xfff1a8, size: 0.35, transparent: true, depthWrite: false }));
scene.add(sparks);
const sparkVel: THREE.Vector3[] = Array.from({ length: SP }, () => new THREE.Vector3());
let sparkLife = 0;
function emitSparks(p: THREE.Vector3) {
  const arr = sparkGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < SP; i++) {
    arr.setXYZ(i, p.x, p.y, p.z);
    sparkVel[i].set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).multiplyScalar(8);
  }
  arr.needsUpdate = true;
  sparkLife = 0.5;
}

// ---------------------------------------------------------------- game flow
let playerDownT = 0;
function playerLost(text: string) {
  if (playerDownT > 0) return;
  sound.lost();
  message(text, "#ff6b6b", 2.2);
  state.combo = 0;
  playerDownT = 2.6;
  if (navigator.vibrate) navigator.vibrate(200);
}

function relaunchPlayer() {
  if (player.state === "flying") player.vanish();
  if (player.state === "loose") loose.push(player);
  player = new Kite(scene, state.design, 0xffffff, true);
  rig.linePoint(hand);
  player.launch(hand, 45);
  message("Nova pipa no ar! 🪁", "#ffd23f", 1.4);
}

function cutKite(k: Kite, at: number, byPlayer: boolean) {
  k.cut(at);
  loose.push(k);
  if (byPlayer) {
    state.cuts++;
    state.combo++;
    if (state.combo > state.best) {
      state.best = state.combo;
      save.set("best", state.best);
    }
    const gain = Math.round(50 * (1 + state.combo * 0.15));
    addCoins(gain);
    sound.cut(state.combo);
    const words = ["CORTOU!", "VOADA!", "RELOU!"];
    message(state.combo >= 5 ? `🔥 COMBO ${state.combo}! +${gain}` : `${words[Math.floor(Math.random() * 3)]} +${gain}`, state.combo >= 5 ? "#ffb703" : "#ffffff");
    bubbles(state.combo >= 5 ? 14 : 7);
    hud.combo.classList.remove("bump");
    void hud.combo.offsetWidth;
    hud.combo.classList.add("bump");
    if (navigator.vibrate) navigator.vibrate(40);
  }
}

// ---------------------------------------------------------------- camera aim
let yaw = 0,
  pitch = 0.6;
function aimCamera(dt: number) {
  const target = player.state === "flying" ? player.pos : player.state === "loose" ? player.pos : new THREE.Vector3(0, 60, 80);
  const d = target.clone().sub(camera.position);
  const wantYaw = Math.atan2(-d.x, d.z) + Math.PI; // camera looks down −z
  const wantPitch = THREE.MathUtils.clamp(Math.atan2(d.y, Math.hypot(d.x, d.z)) - 0.12, -0.12, 1.25);
  let dy = wantYaw - yaw;
  dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  yaw += dy * Math.min(1, dt * 2.2);
  pitch += (wantPitch - pitch) * Math.min(1, dt * 2.2);
  camera.rotation.set(0, 0, 0);
  camera.rotateY(yaw);
  camera.rotateX(pitch);
}

// ---------------------------------------------------------------- loop
let running = false;
let last = performance.now();
let t = 0;
let frameN = 0;

function loop(now: number) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!running) {
    // idle sky behind the menu
    t += dt;
    yaw += dt * 0.03;
    camera.rotation.set(0, 0, 0);
    camera.rotateY(yaw + Math.PI);
    camera.rotateX(0.55);
    for (const e of enemies) {
      e.kite.ai(dt, null);
      e.kite.update(dt, t);
    }
    stage.update(t);
    renderer.render(scene, camera);
    return;
  }
  t += dt;
  frameN++;

  // controls
  if (keys.has("KeyA") || keys.has("ArrowLeft")) player.theta += 2.4 * dt;
  if (keys.has("KeyD") || keys.has("ArrowRight")) player.theta -= 2.4 * dt;
  const rel = input.releasing || keys.has("KeyW") || keys.has("ArrowUp");
  const reel = input.reeling || keys.has("KeyS") || keys.has("ArrowDown");

  // hands + player kite
  rig.update(dt, input.pulling && player.state === "flying", rel, reel);
  camera.updateMatrixWorld();
  rig.linePoint(hand);
  if (player.state === "flying") {
    player.anchor.copy(hand);
    player.pulling = input.pulling;
    player.releasing = rel;
    player.reeling = reel;
  }
  player.update(dt, t);
  if (player.state === "flying") {
    if (player.pos.y <= 1.6 && !input.pulling) playerLost("A PIPA CAIU NO CHÃO 😩");
    for (const w of stage.wires) {
      const ab = w.b.clone().sub(w.a);
      const s = THREE.MathUtils.clamp(player.pos.clone().sub(w.a).dot(ab) / ab.lengthSq(), 0, 1);
      if (w.a.clone().addScaledVector(ab, s).distanceTo(player.pos) < 1.2) playerLost("ENROSCOU NO FIO! ⚡");
    }
  }
  if (playerDownT > 0) {
    playerDownT -= dt;
    if (playerDownT <= 0) relaunchPlayer();
  }

  // enemies
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (e.kite.state === "flying") {
      e.kite.ai(dt, player.state === "flying" ? player : null);
      e.kite.update(dt, t);
    } else {
      e.respawn -= dt;
      if (e.respawn <= 0) {
        enemies[i] = { kite: spawnEnemy(i), respawn: 0 };
      }
    }
  }
  for (const k of loose) k.update(dt, t);
  for (let i = loose.length - 1; i >= 0; i--) if (loose[i].state === "gone") loose.splice(i, 1);

  // line fights: player vs enemies
  let rubbing = false;
  if (player.state === "flying") {
    const pSpeed = player.vel.length();
    const pPow = (input.pulling ? 1 : 0.22) * (0.6 + pSpeed / 14) * (1 + (state.lineLv - 1) * 0.18);
    for (const e of enemies) {
      const k = e.kite;
      if (k.state !== "flying") continue;
      if (k.pos.distanceTo(player.pos) > k.L + player.L) continue;
      const c = lineContact(player.linePts, k.linePts);
      if (c.d < 0.8 && c.ia > 4 && c.ib > 3) {
        rubbing = true;
        const ePow = (k.pulling ? 0.9 : 0.2) * (0.6 + k.vel.length() / 14);
        k.damage += pPow * dt * 2.4;
        player.damage += ePow * dt * 2.4;
        if (frameN % 6 === 0) emitSparks(c.point);
        if (k.damage >= 1 && k.damage >= player.damage) {
          cutKite(k, c.ib, true);
          e.respawn = 5 + Math.random() * 5;
        } else if (player.damage >= 1) {
          cutKite(player, c.ia, false);
          playerLost("CORTARAM SUA PIPA! ✂️");
        }
        if (player.state !== "flying") break;
      }
    }
    player.damage = Math.max(0, player.damage - dt * 0.35);
  }
  for (const e of enemies) e.kite.damage = Math.max(0, e.kite.damage - dt * 0.35);
  // enemies fight each other sometimes
  if (frameN % 4 === 0)
    for (let a = 0; a < enemies.length; a++)
      for (let b = a + 1; b < enemies.length; b++) {
        const A = enemies[a].kite,
          B = enemies[b].kite;
        if (A.state !== "flying" || B.state !== "flying") continue;
        if (A.pos.distanceTo(B.pos) > 60) continue;
        const c = lineContact(A.linePts, B.linePts);
        if (c.d < 0.8 && c.ia > 3 && c.ib > 3) {
          const lose = Math.random() < 0.5 ? enemies[a] : enemies[b];
          lose.kite.damage += dt * 4 * 1.2;
          if (lose.kite.damage > 1) {
            cutKite(lose.kite, lose === enemies[a] ? c.ia : c.ib, false);
            lose.respawn = 6 + Math.random() * 6;
          }
        }
      }

  // catch loose kites with your line ("aparar")
  if (player.state === "flying")
    for (const k of loose) {
      if (k === player || k.state !== "loose" || k.goneT < 1) continue;
      const c = lineContact(player.linePts, k.chain);
      if (c.d < 1.0 || lineContact(player.linePts, [k.pos, k.pos.clone().add(new THREE.Vector3(0, 0.01, 0))]).d < 1.6) {
        k.vanish();
        state.caught++;
        addCoins(120);
        sound.catch();
        message("APAROU A PIPA! +120 🪁", "#7CFC7C", 1.8);
        bubbles(6);
      }
    }

  // sparks
  if (sparkLife > 0) {
    sparkLife -= dt;
    const arr = sparkGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < SP; i++) {
      sparkVel[i].y -= 9 * dt;
      arr.setXYZ(i, arr.getX(i) + sparkVel[i].x * dt, arr.getY(i) + sparkVel[i].y * dt, arr.getZ(i) + sparkVel[i].z * dt);
    }
    arr.needsUpdate = true;
    (sparks.material as THREE.PointsMaterial).opacity = Math.max(0, sparkLife * 2);
  }

  aimCamera(dt);
  stage.update(t);
  sound.update(dt, t, { pulling: input.pulling, speed: player.vel.length(), releasing: rel && player.state === "flying", reeling: reel && player.state === "flying", height: player.pos.y });

  // HUD
  refreshHud();
  const pct = Math.max(0, 1 - player.L / 420);
  hud.meter.style.height = `${pct * 100}%`;
  hud.meterTxt.textContent = `${Math.round(player.L)} m`;
  $("rub").style.opacity = rubbing ? "1" : "0";
  msgT -= dt;
  if (msgT <= 0) hud.msg.classList.remove("pop");
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------- menu: kite shop + line upgrade
function drawPreview(i: number) {
  const cv = $("preview") as HTMLCanvasElement;
  const g = cv.getContext("2d")!;
  g.clearRect(0, 0, cv.width, cv.height);
  const img = kiteTexture(i).image as HTMLCanvasElement;
  g.drawImage(img, 20, 10, cv.width - 40, cv.height - 40);
  const owned = (state.owned >> i) & 1;
  $("kname").textContent = DESIGNS[i].name;
  $("kbuy").textContent = owned ? (state.design === i ? "✔ Usando" : "Usar esta") : `Comprar 🪙 ${PRICES[i]}`;
  $("lineLv").textContent = `Linha nível ${state.lineLv}`;
  $("lineUp").textContent = state.lineLv >= 6 ? "Linha no máximo" : `Melhorar 🪙 ${state.lineLv * 400}`;
  $("menuCoins").textContent = `🪙 ${state.coins.toLocaleString("pt-BR")}`;
}
let browse = state.design;
$("kprev").addEventListener("click", () => drawPreview((browse = (browse + DESIGNS.length - 1) % DESIGNS.length)));
$("knext").addEventListener("click", () => drawPreview((browse = (browse + 1) % DESIGNS.length)));
$("kbuy").addEventListener("click", () => {
  const owned = (state.owned >> browse) & 1;
  if (!owned) {
    if (state.coins < PRICES[browse]) {
      $("kbuy").textContent = "Moedas insuficientes";
      return;
    }
    addCoins(-PRICES[browse]);
    state.owned |= 1 << browse;
    save.set("owned", state.owned);
  }
  state.design = browse;
  save.set("design", browse);
  drawPreview(browse);
});
$("lineUp").addEventListener("click", () => {
  const cost = state.lineLv * 400;
  if (state.lineLv >= 6 || state.coins < cost) return;
  addCoins(-cost);
  state.lineLv++;
  save.set("line", state.lineLv);
  drawPreview(browse);
});
const qb = $("quality");
qb.textContent = `Gráficos: ${quality.toUpperCase()}`;
qb.addEventListener("click", () => {
  quality = quality === "alta" ? "baixa" : "alta";
  save.set("q", quality === "alta" ? 1 : 0);
  location.reload();
});
$("play").addEventListener("click", () => {
  sound.start();
  $("menu").style.display = "none";
  $("hud").style.display = "block";
  running = true;
  last = performance.now();
  state.combo = 0;
  relaunchPlayer();
  message("Segure a tela para PUXAR 👆", "#fff", 2.5);
});
$("pause").addEventListener("click", () => {
  running = false;
  $("menu").style.display = "flex";
  $("hud").style.display = "none";
  input.pulling = input.releasing = input.reeling = false;
  drawPreview(browse);
});

addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  for (const m of lineMats) m.resolution.set(innerWidth, innerHeight);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && running) $("pause").click();
});

// boot
for (let i = 0; i < ENEMIES; i++) enemies.push({ kite: spawnEnemy(i), respawn: 0 });
player.vanish();
drawPreview(browse);
refreshHud();
(window as unknown as Record<string, unknown>).__pipa = {
  state,
  enemies,
  get player() {
    return player;
  },
  LINE_PTS,
  // dev helper for automated play-tests
  testCut() {
    const e = enemies.find((x) => x.kite.state === "flying");
    if (e) {
      cutKite(e.kite, 15, true);
      e.respawn = 6;
    }
  },
};
requestAnimationFrame(loop);
