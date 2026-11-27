import * as THREE from "three";
import { makeView, Style } from "./pixel";
import { PixelPlayer, crowdTexture, pixelPitch } from "./sprites";
import { makeHuman, animateHuman, HumanMesh, rng } from "./people";

// 7-a-side 3D match. The user controls one player; everyone else is AI.
// Team A attacks +x, team B attacks −x.

export interface TeamCfg {
  name: string;
  short: string;
  c1: number;
  c2: number;
  strength: number; // 30..90
}
export interface UserCfg {
  name: string;
  number: number;
  pos: "ATA" | "MEI" | "ZAG";
  attrs: { chute: number; passe: number; velocidade: number; drible: number; defesa: number; fisico: number };
  look: { skin: number; hair: string; hairColor: number };
  boots: number;
}
export interface MatchCfg {
  home: TeamCfg;
  away: TeamCfg;
  userHome: boolean;
  user: UserCfg;
  startMinute: number;
  startScore: [number, number];
  realSeconds: number; // real duration of the remaining minutes
  stadium: "varzea" | "estadio";
  quality: "alta" | "baixa";
  style: Style;
  banner?: string;
  moments?: number; // "chance moments" mode: the match plays itself, the user decides only in chances
}
export interface Choice {
  id: string;
  label: string;
  icon: string;
}
export interface MatchResult {
  score: [number, number];
  goals: number;
  assists: number;
  shots: number;
  onTarget: number;
  passes: number;
  tackles: number;
  lost: number;
  rating: number;
  minutes: number;
  dribbles: number;
}

const L = 76,
  W = 48,
  GOAL_W = 7,
  GOAL_H = 2.44;
const ROLES = [
  { r: "GK", x: -0.46, z: 0 },
  { r: "DF", x: -0.3, z: -0.22 },
  { r: "DF", x: -0.3, z: 0.22 },
  { r: "MF", x: -0.08, z: -0.28 },
  { r: "MF", x: -0.08, z: 0.28 },
  { r: "FW", x: 0.14, z: -0.13 },
  { r: "FW", x: 0.14, z: 0.13 },
];

interface P {
  mesh: HumanMesh | null; // 3D style
  pix: PixelPlayer | null; // pixel-art style
  holder: THREE.Group;
  team: 0 | 1;
  role: string;
  home: THREE.Vector2;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  heading: number;
  phase: number;
  speed: number;
  shot: number;
  pass: number;
  drib: number;
  tack: number;
  keep: number;
  user: boolean;
  noTouch: number;
  down?: number;
  think: number;
  stamina: number;
  tag?: THREE.Sprite;
}

function textSprite(text: string, color: string) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.font = "900 34px sans-serif";
  g.textAlign = "center";
  g.lineWidth = 7;
  g.strokeStyle = "rgba(0,0,0,.8)";
  g.strokeText(text, 128, 44);
  g.fillStyle = color;
  g.fillText(text, 128, 44);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(2.6, 0.65, 1);
  s.renderOrder = 10;
  return s;
}

function fieldTexture(varzea: boolean) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 648;
  const g = c.getContext("2d")!;
  const r = rng(5);
  if (varzea) {
    g.fillStyle = "#9c7a4a";
    g.fillRect(0, 0, 1024, 648);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${70 + r() * 40},${110 + r() * 50},${40 + r() * 20},${0.25 + r() * 0.35})`;
      g.beginPath();
      g.ellipse(r() * 1024, r() * 648, 6 + r() * 40, 4 + r() * 20, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = r() > 0.5 ? "rgba(255,240,210,0.15)" : "rgba(60,40,20,0.2)";
      g.fillRect(r() * 1024, r() * 648, 2, 2);
    }
  } else {
    for (let i = 0; i < 16; i++) {
      g.fillStyle = i % 2 ? "#3f8f3a" : "#47a141";
      g.fillRect((i * 1024) / 16, 0, 1024 / 16 + 1, 648);
    }
    for (let i = 0; i < 6000; i++) {
      g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)";
      g.fillRect(r() * 1024, r() * 648, 2, 3);
    }
  }
  // lines
  g.strokeStyle = varzea ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.92)";
  g.lineWidth = 5;
  const m = 12;
  g.strokeRect(m, m, 1024 - 2 * m, 648 - 2 * m);
  g.beginPath();
  g.moveTo(512, m);
  g.lineTo(512, 648 - m);
  g.stroke();
  g.beginPath();
  g.arc(512, 324, 80, 0, Math.PI * 2);
  g.stroke();
  for (const sx of [m, 1024 - m]) {
    const dir = sx === m ? 1 : -1;
    g.strokeRect(Math.min(sx, sx + dir * 150), 324 - 160, 150, 320);
    g.strokeRect(Math.min(sx, sx + dir * 55), 324 - 70, 55, 140);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Drag gesture from the right side of the screen: aim + curl, released into a shot.
export interface Gesture {
  dx: number; // screen px, + right
  dy: number; // screen px, + up
  curl: number; // signed sideways bulge of the drag path, px
  held: number; // seconds
  ex?: number; // client px where the finger was lifted
  ey?: number;
}
export interface MatchControls {
  moveX: () => number;
  moveY: () => number;
  sprint: () => boolean;
  shootHeld: () => boolean;
  passPressed: () => boolean;
  tacklePressed: () => boolean;
  callPressed: () => boolean;
  choice: () => string | null; // option picked in a chance moment
  aiming: () => Gesture | null; // finger still down
  spin?: () => { x: number; y: number }; // point touched on the effect ball (−1..1, y up)
  released: () => (Gesture & { tap: boolean; long: boolean }) | null; // consumed once
}

export function playMatch(canvasHost: HTMLElement, cfg: MatchCfg, hud: { score: HTMLElement; clock: HTMLElement; banner: (t: string, sub?: string) => void; power: HTMLElement; choices: (opts: Choice[] | null, title?: string) => void; ticker: (t: string) => void; feed?: (on: boolean) => void; feedLine?: (m: number, txt: string, goal?: boolean) => void; feedFast?: () => boolean; spinUI?: (on: boolean) => void }, controls: MatchControls): Promise<MatchResult> {
  return new Promise((resolve) => {
    const varzea = cfg.stadium === "varzea";
    const renderer = new THREE.WebGLRenderer({ antialias: cfg.style !== "pixel", powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(devicePixelRatio, cfg.quality === "alta" ? 1.75 : 1));
    renderer.setSize(innerWidth, innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = cfg.quality === "alta";
    canvasHost.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(varzea ? 0x9fd3f0 : 0x0b1a2e);
    scene.fog = new THREE.Fog(scene.background as THREE.Color, 120, 320);
    const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 600);
    const view = makeView(renderer, scene, camera, cfg.style, cfg.quality);
    const sun = new THREE.DirectionalLight(0xffffff, varzea ? 2.6 : 1.8);
    sun.position.set(30, 60, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 35, bottom: -35, far: 200 });
    scene.add(sun, new THREE.HemisphereLight(0xdfefff, varzea ? 0x8a6a40 : 0x2a4a2a, varzea ? 1.0 : 0.9));
    if (!varzea) {
      // night game under floodlights
      for (const [x, z] of [[-L / 2 - 6, -W / 2 - 6], [L / 2 + 6, -W / 2 - 6], [-L / 2 - 6, W / 2 + 6], [L / 2 + 6, W / 2 + 6]]) {
        const pl = new THREE.PointLight(0xfff4e0, 900, 140);
        pl.position.set(x, 26, z);
        scene.add(pl);
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 26, 8), new THREE.MeshStandardMaterial({ color: 0x888888 }));
        tower.position.set(x, 13, z);
        const lamps = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 0.6), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffee, emissiveIntensity: 3 }));
        lamps.position.set(x, 26, z);
        lamps.lookAt(0, 0, 0);
        scene.add(tower, lamps);
      }
    }

    // pitch + surroundings
    const field = new THREE.Mesh(new THREE.PlaneGeometry(L + 4, W + 4), new THREE.MeshStandardMaterial({ map: cfg.style === "pixel" ? pixelPitch(varzea) : fieldTexture(varzea), roughness: 1 }));
    field.rotation.x = -Math.PI / 2;
    field.receiveShadow = true;
    scene.add(field);
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: varzea ? 0x8a6c42 : 0x2f6a2c, roughness: 1 }));
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.02;
    scene.add(outer);
    const goalMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const netMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.35 });
    for (const s of [-1, 1]) {
      const gx = (s * L) / 2;
      const g = new THREE.Group();
      for (const z of [-GOAL_W / 2, GOAL_W / 2]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, GOAL_H, 8), goalMat);
        post.position.set(0, GOAL_H / 2, z);
        post.castShadow = true;
        g.add(post);
      }
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, GOAL_W, 8), goalMat);
      bar.rotation.x = Math.PI / 2;
      bar.position.y = GOAL_H;
      g.add(bar);
      const net = new THREE.Mesh(new THREE.BoxGeometry(1.6, GOAL_H, GOAL_W, 3, 4, 8), netMat);
      net.position.set(s * 0.8, GOAL_H / 2, 0);
      g.add(net);
      g.position.x = gx;
      scene.add(g);
    }
    const r = rng(11);
    if (varzea) {
      // fence, trees, little houses and spectators standing on the dirt
      const wood = new THREE.MeshStandardMaterial({ color: 0x6b4f2a, roughness: 1 });
      for (let x = -L / 2 - 6; x <= L / 2 + 6; x += 3) {
        for (const z of [-W / 2 - 5, W / 2 + 5]) {
          const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), wood);
          p.position.set(x, 0.55, z);
          scene.add(p);
        }
      }
      const houseCols = [0xe9c46a, 0x2a9d8f, 0xe76f51, 0xf4a261, 0x8ab17d, 0xd4a5a5];
      for (let i = 0; i < 26; i++) {
        const h = new THREE.Mesh(new THREE.BoxGeometry(6 + r() * 4, 3 + Math.floor(r() * 3) * 3, 6), new THREE.MeshStandardMaterial({ color: houseCols[i % 6], roughness: 0.9 }));
        const a = (i / 26) * Math.PI * 2;
        h.position.set(Math.cos(a) * 75, h.geometry.parameters.height / 2, Math.sin(a) * 52);
        h.lookAt(0, h.position.y, 0);
        scene.add(h);
      }
      for (let i = 0; i < 40; i++) {
        const f = makeHuman(100 + i);
        const side = i % 2 ? 1 : -1;
        f.group.position.set((r() - 0.5) * L, 0, side * (W / 2 + 6.5 + r() * 2));
        f.group.rotation.y = side > 0 ? Math.PI : 0;
        scene.add(f.group);
      }
    } else {
      // stands packed with fans in both teams' colours
      const crowdTex = (() => {
        const c = document.createElement("canvas");
        c.width = 512;
        c.height = 128;
        const g = c.getContext("2d")!;
        g.fillStyle = "#222";
        g.fillRect(0, 0, 512, 128);
        const cols = ["#" + cfg.home.c1.toString(16).padStart(6, "0"), "#" + cfg.home.c2.toString(16).padStart(6, "0"), "#e0ac69", "#8d5524", "#ffffff", "#333"];
        for (let i = 0; i < 2600; i++) {
          g.fillStyle = cols[Math.floor(r() * cols.length)];
          g.fillRect(r() * 512, r() * 128, 3, 4);
        }
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = THREE.RepeatWrapping;
        t.repeat.set(4, 1);
        return t;
      })();
      const ct = cfg.style === "pixel" ? crowdTexture(cfg.home.c1, cfg.home.c2) : crowdTex;
      if (cfg.style === "pixel") ct.repeat.set(3, 1);
      const standMat = new THREE.MeshStandardMaterial({ map: ct, roughness: 1, emissive: 0xffffff, emissiveMap: ct, emissiveIntensity: cfg.style === "pixel" ? 0.35 : 0 });
      for (const [x, z, w, rot] of [[0, -W / 2 - 14, L + 30, 0], [0, W / 2 + 14, L + 30, Math.PI], [-L / 2 - 16, 0, W + 20, Math.PI / 2], [L / 2 + 16, 0, W + 20, -Math.PI / 2]] as const) {
        const st = new THREE.Mesh(new THREE.PlaneGeometry(w, 22), standMat);
        st.position.set(x, 9, z);
        st.rotation.set(-0.6, rot, 0, "YXZ");
        scene.add(st);
      }
      // advertising boards
      const adMat = new THREE.MeshStandardMaterial({ color: 0x1e4fa3, emissive: 0x1e4fa3, emissiveIntensity: 0.6 });
      for (const z of [-W / 2 - 2.5, W / 2 + 2.5]) {
        const ad = new THREE.Mesh(new THREE.BoxGeometry(L, 1, 0.2), adMat);
        ad.position.set(0, 0.5, z);
        scene.add(ad);
      }
    }

    // ball
    const ballTex = (() => {
      const c = document.createElement("canvas");
      c.width = 256;
      c.height = 128;
      const g = c.getContext("2d")!;
      g.fillStyle = "#fff";
      g.fillRect(0, 0, 256, 128);
      g.fillStyle = "#111";
      for (let i = 0; i < 12; i++) {
        g.beginPath();
        const x = (i % 6) * 44 + 20,
          y = i < 6 ? 36 : 92;
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          g.lineTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12);
        }
        g.fill();
      }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const BR = 0.22;
    const ballM = new THREE.Mesh(new THREE.SphereGeometry(BR, 20, 14), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.4 }));
    ballM.castShadow = true;
    scene.add(ballM);
    const ball = { pos: new THREE.Vector3(0, BR, 0), vel: new THREE.Vector3(), owner: null as P | null, lastTouch: null as P | null, lastPasser: null as P | null };

    // players
    const players: P[] = [];
    const teams = [cfg.home, cfg.away];
    const userTeam = cfg.userHome ? 0 : 1;
    const userRole = cfg.user.pos === "ATA" ? 5 : cfg.user.pos === "MEI" ? 3 : 1;
    for (const t of [0, 1] as const) {
      const tc = teams[t];
      const dir = t === 0 ? 1 : -1;
      ROLES.forEach((ro, i) => {
        const isUser = t === userTeam && i === userRole;
        const gk = ro.r === "GK";
        const opts = isUser
          ? { kit: true, shirt: tc.c1, pants: tc.c2, socks: tc.c1, skin: cfg.user.look.skin, hair: cfg.user.look.hair, hairColor: cfg.user.look.hairColor, female: false }
          : { kit: true, shirt: gk ? 0x2b2b2b + t * 0x223300 : tc.c1, pants: gk ? 0x111111 : tc.c2, socks: gk ? 0x111111 : tc.c1, female: false };
        const pixelArt = cfg.style === "pixel";
        const SKINS = [0x5c3a21, 0x8d5524, 0xa0673a, 0xc68642, 0xe0ac69, 0xf1c27d];
        const HAIRS = ["short", "buzz", "afro", "bald", "long", "short"];
        const pix = pixelArt
          ? new PixelPlayer({
              skin: isUser ? cfg.user.look.skin : SKINS[(t * 7 + i * 3) % SKINS.length],
              hair: isUser ? cfg.user.look.hair : HAIRS[(t * 5 + i * 2) % HAIRS.length],
              hairColor: isUser ? cfg.user.look.hairColor : [0x120c08, 0x3b2314, 0x6b4423, 0xc8a165][(i + t) % 4],
              shirt: gk ? (t ? 0xf77f00 : 0x2ec4b6) : tc.c1,
              shirt2: gk ? 0x111111 : tc.c2 === tc.c1 ? 0xffffff : tc.c2,
              shorts: gk ? 0x111111 : tc.c2,
              socks: gk ? 0x111111 : tc.c1,
              boots: isUser ? cfg.user.boots : 0x111111,
              number: isUser ? cfg.user.number : gk ? 1 : [0, 3, 4, 8, 10, 11, 9][i],
              gk,
            })
          : null;
        const mesh = pixelArt ? null : makeHuman(t * 50 + i * 7 + 3, opts);
        const holder = pix ? pix.group : mesh!.group;
        scene.add(holder);
        const s = tc.strength / 100;
        const u = cfg.user.attrs;
        const p: P = {
          mesh,
          pix,
          holder,
          team: t,
          role: ro.r,
          home: new THREE.Vector2(ro.x * L * dir, ro.z * W),
          pos: new THREE.Vector3(ro.x * L * dir, 0, ro.z * W),
          vel: new THREE.Vector3(),
          heading: dir > 0 ? Math.PI / 2 : -Math.PI / 2,
          phase: Math.random() * 6,
          speed: isUser ? 6.2 + u.velocidade * 0.035 : 6 + s * 2.8,
          shot: isUser ? u.chute / 100 : s * 0.9,
          pass: isUser ? u.passe / 100 : s * 0.95,
          drib: isUser ? u.drible / 100 : s * 0.85,
          tack: isUser ? u.defesa / 100 : s * 0.8,
          keep: s,
          user: isUser,
          noTouch: 0,
          think: Math.random() * 0.3,
          stamina: 1,
        };
        if (isUser) {
          p.tag = textSprite(cfg.user.name.toUpperCase(), "#ffd23f");
          scene.add(p.tag);
          // ring under the user
          const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 32), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85 }));
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = 0.03;
          holder.add(ring);
        }
        players.push(p);
      });
    }
    const user = players.find((p) => p.user)!;
    // shrinking timing ring around the player (blue → white when it closes) and a dotted aim line
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x3fa9ff, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
    const aimRing = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48), ringMat);
    aimRing.rotation.x = -Math.PI / 2;
    aimRing.visible = false;
    scene.add(aimRing);
    // Football Legacy style skill ring: closes on the defender, tap when it shuts to beat him
    const skillMat = new THREE.MeshBasicMaterial({ color: 0x3fa9ff, transparent: true, opacity: 0.95, depthTest: false, side: THREE.DoubleSide });
    const skillRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), skillMat);
    skillRing.visible = false;
    skillRing.renderOrder = 10;
    scene.add(skillRing);
    const aimLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xff4d6d, dashSize: 0.5, gapSize: 0.35, transparent: true, opacity: 0.95 }));
    aimLine.visible = false;
    aimLine.frustumCulled = false;
    scene.add(aimLine);
    let ballCurl = 0;
    const SWEET = 0.62; // seconds until the ring is fully closed
    const ringAt = (held: number) => (held < SWEET ? 1.9 - 1.45 * (held / SWEET) : 0.45 + Math.min(1.2, (held - SWEET) * 2.4));
    const accuracyAt = (held: number) => THREE.MathUtils.clamp(1 - Math.abs(held - SWEET) / 0.42, 0, 1);
    // maps a drag to a point in the goal mouth (can miss wide) and a curl amount
    const aimFromGesture = (g: Gesture) => {
      const ad = userTeam === 0 ? 1 : -1;
      const side = THREE.MathUtils.clamp(g.dx / 160, -1.3, 1.3);
      const power = THREE.MathUtils.clamp(Math.hypot(g.dx, g.dy) / 220, 0.35, 1.1);
      const tz = side * ad * (GOAL_W / 2 + 0.6);
      // effect ball: hit the left side → curls right, right side → left; top dips, bottom lifts
      const sp = controls.spin?.() ?? { x: 0, y: 0 };
      const ty = THREE.MathUtils.clamp(0.25 + (g.dy / 320) * 1.6 - sp.y * 0.7, 0.2, 3.4);
      const curl = THREE.MathUtils.clamp(g.curl / 90 + sp.x * 1.1, -1.6, 1.6) * ad;
      return { target: new THREE.Vector3(goalX(userTeam), ty, tz), power, curl, topspin: sp.y };
    };
    const gk = (t: number) => players.find((p) => p.team === t && p.role === "GK")!;

    const res: MatchResult = { score: [...cfg.startScore] as [number, number], goals: 0, assists: 0, shots: 0, onTarget: 0, passes: 0, tackles: 0, lost: 0, rating: 6, minutes: 90 - cfg.startMinute, dribbles: 0 };
    let minute = cfg.startMinute;
    const minPerSec = (90 - cfg.startMinute) / cfg.realSeconds;
    let pause = 1.5;
    let ended = false;
    let charge = 0;
    let kickoffTeam: number = 1 - userTeam;

    function kickoff(team: number) {
      players.forEach((p) => {
        const dir = p.team === 0 ? 1 : -1;
        p.pos.set(p.home.x * 0.95, 0, p.home.y);
        if (p.role === "FW") p.pos.x = Math.min(Math.abs(p.pos.x), 4) * -dir;
        p.vel.set(0, 0, 0);
        p.heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      });
      ball.pos.set(0, BR, 0);
      ball.vel.set(0, 0, 0);
      const taker = players.find((p) => p.team === team && p.role === "FW")!;
      taker.pos.set(team === 0 ? -0.8 : 0.8, 0, 0);
      ball.owner = taker;
      pause = 1.2;
    }
    kickoff(kickoffTeam);

    const goalX = (t: number) => (t === 0 ? L / 2 : -L / 2);

    function kick(p: P, target: THREE.Vector3, speed: number, lift: number) {
      const d = target.clone().sub(ball.pos).setY(0);
      const dist = d.length();
      d.normalize();
      ball.vel.set(d.x * speed, lift, d.z * speed);
      ball.owner = null;
      ball.lastTouch = p;
      p.noTouch = 0.35;
      if (p.pix) p.pix.kickT = 0.25;
      return dist;
    }

    function dragShot(g: Gesture) {
      const { target, power, curl, topspin } = aimFromGesture(g);
      const acc = accuracyAt(g.held);
      // error grows when the ring was not closed, shrinks with the shooting attribute
      const err = (1 - acc) * (1.4 - user.shot) * 3.2;
      target.z += (Math.random() - 0.5) * err * 2;
      target.y = Math.max(0.15, target.y + (Math.random() - 0.4) * err);
      const sp = (17 + 15 * power * (0.75 + user.shot * 0.4)) * (1 + topspin * 0.08);
      const dist = kick(user, target.clone().setZ(target.z - curl * 2.2), sp, 0);
      ball.vel.y = Math.min(8, (target.y + 4.9 * Math.pow(dist / sp, 2)) / Math.max(0.1, dist / sp) - 0.5);
      ballCurl = curl * 7;
      res.shots++;
      if (Math.abs(target.z) < GOAL_W / 2) res.onTarget++;
      hud.banner(acc > 0.92 ? "PERFEITO!" : `${Math.round(acc * 100)}%`);
    }

    function shoot(p: P, power: number) {
      const gxp = goalX(p.team);
      const acc = p.shot * (0.65 + 0.35 * Math.min(1, power));
      // aim toward a corner, with error shrinking as the shooter gets better
      // the user aims with the joystick (left/right on screen); AI picks a random corner
      const ad = p.team === 0 ? 1 : -1;
      const mx = p.user ? controls.moveX() : 0;
      const side = Math.abs(mx) > 0.25 ? Math.sign(mx) * ad : Math.random() < 0.5 ? -1 : 1;
      const err = (1 - acc) * 5.5;
      const tz = side * (GOAL_W / 2 - 0.9) + (Math.random() - 0.5) * err * 2;
      const ty = 0.3 + Math.random() * (1.9 - (1 - acc));
      const target = new THREE.Vector3(gxp, ty, tz);
      const sp = 19 + 13 * Math.min(1, power) * (0.7 + p.shot * 0.5);
      const dist = kick(p, target, sp, 0);
      ball.vel.y = Math.min(7, (ty + 4.9 * Math.pow(dist / sp, 2)) / Math.max(0.1, dist / sp) - 0.5);
      if (p.user) {
        res.shots++;
        if (Math.abs(tz) < GOAL_W / 2) res.onTarget++;
      }
    }

    function bestPass(p: P, prefer?: THREE.Vector3) {
      const dir = p.team === 0 ? 1 : -1;
      let best: P | null = null,
        bs = -Infinity;
      for (const q of players) {
        if (q.team !== p.team || q === p || q.role === "GK") continue;
        const v = q.pos.clone().sub(p.pos);
        const d = v.length();
        if (d < 4 || d > 34) continue;
        let open = 10;
        for (const o of players) if (o.team !== p.team) open = Math.min(open, o.pos.distanceTo(q.pos));
        let sc = open * 1.2 + (q.pos.x - p.pos.x) * dir * 0.35 - d * 0.08;
        if (q.user) sc += 2.5;
        if (prefer) sc += v.normalize().dot(prefer) * 8;
        if (sc > bs) {
          bs = sc;
          best = q;
        }
      }
      return best;
    }

    function pass(p: P, to: P) {
      const lead = to.vel.clone().multiplyScalar(0.45);
      const target = to.pos.clone().add(lead);
      const err = (1 - p.pass) * 3;
      target.x += (Math.random() - 0.5) * err;
      target.z += (Math.random() - 0.5) * err;
      const dist = target.distanceTo(p.pos);
      kick(p, target, Math.min(22, 9 + dist * 0.55), dist > 22 ? 3.5 : 0.4);
      ball.lastPasser = p;
      if (p.user) res.passes++;
    }

    // ------------------------------------------------------------- chance moments
    const M = !!cfg.moments;
    type MState = "feed" | "auto" | "skill" | "incoming" | "choose" | "aim" | "caneta" | "resolve";
    let mState: MState = M ? "feed" : "auto";
    let resolveT = 0;
    let firstTime = false;
    let usedCaneta = false;
    let lastMoment = -99;
    let canetaTarget = new THREE.Vector3();
    const schedule: number[] = [];
    if (M) {
      // plenty of chances, even coming off the bench: at least 4, spread evenly (one per slot)
      const n = Math.max(4, Math.round(((90 - cfg.startMinute) / 90) * cfg.moments!));
      const a = cfg.startMinute + 3,
        span = (88 - a) / n;
      for (let i = 0; i < n; i++) schedule.push(a + i * span + Math.random() * span * 0.7);
      schedule.sort((a, b) => a - b);
    }
    const OPT: Record<string, Choice> = {
      chutar: { id: "chutar", label: "Chutar pro gol", icon: "🥅" },
      passe: { id: "passe", label: "Passe pro gol", icon: "🎯" },
      dominar: { id: "dominar", label: "Dominar a bola", icon: "🦶" },
      caneta: { id: "caneta", label: "Dar caneta", icon: "🪄" },
      primeira: { id: "primeira", label: "Chutar de primeira", icon: "💥" },
    };
    const forceShoot = new Set<P>();
    const markerOf = () => {
      // nearest opponent between the user and the goal
      const ad = userTeam === 0 ? 1 : -1;
      let best: P | null = null,
        bd = 5.5;
      for (const o of players)
        if (o.team !== userTeam && o.role !== "GK") {
          const rel = o.pos.clone().sub(user.pos);
          if (rel.x * ad > 0 && rel.length() < bd) {
            bd = rel.length();
            best = o;
          }
        }
      return best;
    };
    let skillOn: P | null = null;
    let skillT = 0;
    const SKILL_T = 1.25; // seconds for the ring to close
    function presentWithBall(title = "CHANCE DE GOL!") {
      firstTime = false;
      const d = usedCaneta ? null : markerOf();
      if (d) {
        mState = "skill";
        skillOn = d;
        skillT = 0;
        hud.banner(title);
        hud.choices(null, "TOQUE QUANDO O CÍRCULO FECHAR!");
      } else startAim(title);
    }
    function startAim(title = "") {
      mState = "aim";
      skillRing.visible = false;
      if (title) hud.banner(title, "arraste até um companheiro = passe");
      hud.choices(null, "ARRASTE • CURVE • CHUTE");
      hud.spinUI?.(true);
    }
    // tap timing on the skill ring: beat the defender (he goes to ground) or lose the ball
    function resolveSkill(err: number) {
      const d = skillOn!;
      const ad = userTeam === 0 ? 1 : -1;
      skillOn = null;
      skillRing.visible = false;
      usedCaneta = true;
      const acc = THREE.MathUtils.clamp(1 - err / 0.5, 0, 1);
      if (Math.random() < acc * 0.85 + user.drib * 0.3 - d.tack * 0.08) {
        canetaTarget = d.pos.clone().add(new THREE.Vector3(ad * 2.6, 0, (Math.random() - 0.5) * 1.5));
        kick(user, canetaTarget, 9, 0);
        user.noTouch = 0.15;
        d.noTouch = 3;
        d.down = 2.6;
        res.dribbles++;
        hud.banner(acc > 0.85 ? "PERFEITO!" : "PASSOU!", "olé!");
        mState = "caneta";
        resolveT = 2.2;
        hud.choices(null);
      } else {
        ball.owner = d;
        ball.lastTouch = d;
        res.lost++;
        hud.banner("Desarmado!");
        endMoment(1.6);
      }
    }
    // finger lifted while aiming: on a team-mate → pass to him, otherwise a curled shot
    function releaseAim(g: Gesture) {
      if (g.ex !== undefined && g.ey !== undefined) {
        const r = renderer.domElement.getBoundingClientRect();
        let best: P | null = null,
          bd = 70;
        for (const q of players)
          if (q.team === userTeam && !q.user) {
            const v = q.pos.clone().setY(1).project(camera);
            const sx = r.left + ((v.x + 1) / 2) * r.width,
              sy = r.top + ((1 - v.y) / 2) * r.height;
            const dd = Math.hypot(sx - g.ex, sy - g.ey);
            if (v.z < 1 && dd < bd) {
              bd = dd;
              best = q;
            }
          }
        if (best) {
          forceShoot.add(best);
          pass(user, best);
          hud.banner("PASSE!");
          endMoment(3.2);
          return;
        }
      }
      dragShot(g);
      endMoment(3);
    }
    let resolveAge = 0;
    let kickoffWait = false;
    function endMoment(after = 2.2) {
      resolveAge = 0;
      hud.spinUI?.(false);
      hud.choices(null);
      mState = "resolve";
      resolveT = after;
    }
    // Build a chance: the user near the box, a marker, the keeper and a team-mate making a run.
    function setupChance(kind: "withBall" | "incoming") {
      const ad = userTeam === 0 ? 1 : -1;
      const gx = goalX(userTeam);
      const uz = (Math.random() - 0.5) * 16;
      user.pos.set(gx - ad * (11 + Math.random() * 5), 0, uz * 0.7);
      user.vel.set(0, 0, 0);
      user.heading = ad > 0 ? Math.PI / 2 : -Math.PI / 2;
      const opp = players.filter((o) => o.team !== userTeam && o.role !== "GK");
      opp.forEach((o, i) => {
        o.pos.set(gx - ad * (6 + i * 4.5), 0, (i % 2 ? 1 : -1) * (8 + i * 2));
        o.vel.set(0, 0, 0);
      });
      if (Math.random() < 0.5) {
        const m = opp[0];
        m.pos.set(user.pos.x + ad * 3, 0, uz + (Math.random() - 0.5));
      }
      const mate = players.filter((q) => q.team === userTeam && !q.user && q.role !== "GK").sort((a, b) => (a.role === "FW" ? -1 : 1) - (b.role === "FW" ? -1 : 1))[0];
      mate.pos.set(gx - ad * 9, 0, -Math.sign(uz || 1) * (4 + Math.random() * 3));
      const k = gk(1 - userTeam);
      k.pos.set(gx - ad * 1.2, 0, 0);
      usedCaneta = false;
      lastMoment = minute;
      if (kind === "withBall") {
        ball.owner = user;
        ball.lastTouch = user;
        ball.pos.copy(user.pos).setY(BR);
        presentWithBall();
      } else {
        const from = user.pos.clone().add(new THREE.Vector3(-ad * 16, 0, (Math.random() - 0.5) * 14));
        const passer = players.filter((q) => q.team === userTeam && !q.user && q.role === "MF")[0];
        passer.pos.copy(from);
        ball.owner = null;
        ball.pos.copy(from).setY(BR);
        kick(passer, user.pos.clone(), 15, 2.6);
        ball.lastPasser = passer;
        mState = "incoming";
        hud.banner("A BOLA VEM PRA VOCÊ!");
      }
    }
    function pick(id: string) {
      const ad = userTeam === 0 ? 1 : -1;
      if (id === "chutar" || id === "primeira") {
        firstTime = id === "primeira";
        mState = "aim";
        hud.choices(null, "ARRASTE • CURVE • SOLTE");
      } else if (id === "passe") {
        const to = bestPass(user, new THREE.Vector3(ad, 0, 0));
        if (to) {
          forceShoot.add(to);
          pass(user, to);
        }
        endMoment(3.2);
      } else if (id === "dominar") {
        if (Math.random() < 0.5 + user.drib * 0.45) {
          ball.owner = user;
          ball.vel.set(0, 0, 0);
          ball.pos.copy(user.pos).setY(BR);
          hud.banner("DOMINOU!");
          presentWithBall("E AGORA?");
        } else {
          ball.vel.set((Math.random() - 0.5) * 6, 1.5, (Math.random() - 0.5) * 6);
          ball.owner = null;
          user.noTouch = 0.8;
          hud.banner("Escapou…");
          res.lost++;
          endMoment(1.6);
        }
      } else if (id === "caneta") {
        const d = markerOf();
        usedCaneta = true;
        if (d && Math.random() < 0.32 + user.drib * 0.55 - d.tack * 0.2) {
          // ball through the legs, the player runs round to collect it
          canetaTarget = d.pos.clone().add(new THREE.Vector3(ad * 2.6, 0, 0));
          kick(user, canetaTarget, 9, 0);
          user.noTouch = 0.15;
          d.noTouch = 1.6;
          res.dribbles++;
          hud.banner("CANETA!", "olé!");
          mState = "caneta";
          resolveT = 2.2;
          hud.choices(null);
        } else {
          if (d) {
            ball.owner = d;
            ball.lastTouch = d;
          }
          res.lost++;
          hud.banner("Desarmado!");
          endMoment(1.6);
        }
      }
    }

    // ------------------------------------------------------------- live score feed
    // Between chances the match runs as a scoreboard with play-by-play;
    // the pitch only opens for good goal / assist chances.
    const FEED_RATE = 2.6; // match minutes per real second
    const teamName = (t: number) => teams[t].name;
    const FILLER = [
      (t: number) => `Escanteio para o ${teamName(t)}.`,
      (t: number) => `Chute de fora da área do ${teams[t].short}… pra fora!`,
      (t: number) => `Grande defesa do goleiro do ${teams[1 - t].short}!`,
      (t: number) => `Cartão amarelo para um jogador do ${teams[t].short}.`,
      (t: number) => `Falta perigosa a favor do ${teams[t].short}.`,
      (t: number) => `Contra-ataque do ${teams[t].short}, mas a zaga corta.`,
      (t: number) => `Bola na trave do ${teams[t].short}!! Uhhh!`,
      (t: number) => `O ${teams[t].short} troca passes no meio-campo.`,
      (t: number) => `Cruzamento do ${teams[t].short}… o goleiro sai e pega.`,
    ];
    const str = (t: number) => (t === 0 ? cfg.home.strength : cfg.away.strength);
    const goalRate = (t: number) => (1.15 / 90) * THREE.MathUtils.clamp(1 + (str(t) - str(1 - t)) / 28, 0.35, 1.9);
    let nextFiller = cfg.startMinute + 1 + Math.random() * 4;
    let feedOn = false;
    function setFeed(on: boolean) {
      feedOn = on;
      hud.feed?.(on);
    }
    let scoreAtChance = 0;
    function backToFeed() {
      if (res.score[0] + res.score[1] === scoreAtChance) hud.feedLine?.(minute, `😩 Uhh! A chance de ${cfg.user.name} não entrou.`);
      hud.choices(null);
      mState = "feed";
      setFeed(true);
    }
    function feedStep(realDt: number) {
      const dm = realDt * FEED_RATE * (hud.feedFast?.() ? 4 : 1);
      const before = minute;
      minute = Math.min(90, minute + dm);
      for (const t of [0, 1])
        if (Math.random() < goalRate(t) * dm && minute < 89.5) {
          res.score[t]++;
          hud.feedLine?.(minute, t === userTeam ? `⚽ GOL do ${teamName(t)}!` : `⚽ Gol do ${teamName(t)}.`, true);
          if (t === userTeam && navigator.vibrate) navigator.vibrate(60);
        }
      if (minute >= nextFiller) {
        nextFiller = minute + 3 + Math.random() * 6;
        const t = Math.random() < 0.5 ? 0 : 1;
        hud.feedLine?.(minute, FILLER[Math.floor(Math.random() * FILLER.length)](t));
      }
      if (before < 45 && minute >= 45) hud.feedLine?.(45, "⏸️ Fim do primeiro tempo. Começa o segundo!");
      hud.clock.textContent = `${Math.floor(minute)}'`;
      hud.score.innerHTML = `<b>${cfg.home.short}</b> ${res.score[0]} × ${res.score[1]} <b>${cfg.away.short}</b>`;
      setFeed(true);
      if (minute >= 90) {
        hud.feedLine?.(90, "🏁 Fim de jogo!");
        return finish();
      }
      if (schedule.length && minute >= schedule[0] && !kickoffWait) {
        schedule.shift();
        const incoming = Math.random() < 0.25;
        hud.feedLine?.(minute, incoming ? `🔥 Lançamento para ${cfg.user.name}!` : `🔥 ${cfg.user.name} recebe na entrada da área!`);
        scoreAtChance = res.score[0] + res.score[1];
        setFeed(false);
        pause = 0;
        setupChance(incoming ? "incoming" : "withBall");
      }
    }

    // ------------------------------------------------------------- loop
    let last = performance.now();
    let raf = 0;
    const tmp = new THREE.Vector3();
    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      step(dt, now / 1000);
      if (!feedOn || ended) view.render();
    }
    function step(dt: number, t: number) {
      if (ended) return;
      const realDt = dt;
      if (M && mState === "feed") {
        feedStep(realDt);
        return;
      }
      if (M) {
        const c = controls.choice();
        if (c && mState === "choose") pick(c);
        if (mState === "incoming") {
          const d = Math.hypot(ball.pos.x - user.pos.x, ball.pos.z - user.pos.z);
          if (ball.owner === user) presentWithBall();
          else if (d < 2.2) {
            if (Math.random() < 0.55 + user.drib * 0.4) {
              ball.owner = user;
              ball.lastTouch = user;
              ball.vel.set(0, 0, 0);
              ball.pos.copy(user.pos).setY(BR);
              presentWithBall("DOMINOU!");
            } else {
              ball.vel.set((Math.random() - 0.5) * 6, 1.5, (Math.random() - 0.5) * 6);
              ball.owner = null;
              user.noTouch = 0.8;
              hud.banner("Escapou…");
              res.lost++;
              endMoment(1.6);
            }
          } else if (ball.owner) endMoment(1);
        }
        if (mState === "skill" && skillOn) {
          skillT += realDt;
          const ad = userTeam === 0 ? 1 : -1;
          // carry the ball toward the defender; nobody may tackle while the ring is closing
          user.vel.set(ad * user.speed * 0.55, 0, 0);
          for (const o of players) if (o.team !== userTeam) o.noTouch = Math.max(o.noTouch, 0.3);
          const k = Math.max(0, 1 - skillT / SKILL_T);
          skillRing.visible = true;
          skillRing.position.set(skillOn.pos.x, 1.0, skillOn.pos.z);
          skillRing.quaternion.copy(camera.quaternion);
          skillRing.scale.setScalar(0.45 + 1.9 * k);
          skillMat.color.set(Math.abs(skillT - SKILL_T) < 0.14 ? 0xffffff : 0x3fa9ff);
          const g = controls.released();
          if (g && g.tap) resolveSkill(Math.abs(skillT - SKILL_T));
          else if (g && !g.long) {
            skillOn = null;
            skillRing.visible = false;
            releaseAim(g);
          } else if (skillT > SKILL_T + 0.4) resolveSkill(1);
        }
        if (mState === "caneta") {
          resolveT -= realDt;
          const v = canetaTarget.clone().sub(user.pos).setY(0);
          if (v.length() > 0.3) user.vel.copy(v.normalize().multiplyScalar(user.speed * 1.2));
          if (ball.owner === user) startAim();
          else if (resolveT <= 0 || (ball.owner && ball.owner !== user)) endMoment(1);
        }
        if (mState === "resolve") {
          resolveT -= realDt;
          resolveAge += realDt;
          // the play is over (keeper/defence has it, ball dead, or a goal) → straight back to the scoreboard
          const dead = (ball.owner && ball.owner.team !== userTeam) || (!ball.owner && ball.vel.length() < 2 && resolveAge > 0.8);
          if (dead && resolveAge > 0.6) resolveT = Math.min(resolveT, 0.5);
          if (pause > 0) resolveT = Math.min(resolveT, 1.4); // goal celebration / ball out
          if (resolveT <= 0) backToFeed();
        }
        // slow motion while deciding
        dt *= mState === "skill" ? 0.18 : mState === "choose" ? 0.05 : mState === "aim" ? (firstTime ? 0.1 : 0.04) : mState === "incoming" ? 0.6 : 1;
      }
      if (pause > 0) {
        pause -= dt;
      } else {
        minute += dt * minPerSec;
        if (minute >= 90) return finish();
      }
      hud.clock.textContent = `${Math.min(90, Math.floor(minute))}'`;
      hud.score.innerHTML = `<b>${cfg.home.short}</b> ${res.score[0]} × ${res.score[1]} <b>${cfg.away.short}</b>`;
      const live = pause <= 0;

      // ---- user input
      const mx = controls.moveX(),
        my = controls.moveY();
      const attackDir = userTeam === 0 ? 1 : -1;
      // screen up = attacking direction; right = toward −z for team 0 (camera behind)
      const want = new THREE.Vector3(my * attackDir, 0, mx * attackDir);
      const sprint = (controls.sprint() || Math.hypot(mx, my) > 0.9) && user.stamina > 0.05;
      user.stamina = THREE.MathUtils.clamp(user.stamina + (sprint && want.length() > 0.1 ? -dt * 0.18 : dt * 0.1), 0, 1);
      const uSpeed = user.speed * (sprint ? 1.3 : 0.92) * (ball.owner === user ? 0.9 : 1);
      if (!M) {
        if (want.length() > 0.08) user.vel.lerp(want.clone().normalize().multiplyScalar(uSpeed * Math.min(1, want.length())), Math.min(1, dt * 8));
        else user.vel.multiplyScalar(Math.exp(-dt * 8));
      }
      if (live && M && mState === "aim") {
        const g = controls.released();
        for (const o of players) if (o.team !== userTeam) o.noTouch = Math.max(o.noTouch, 0.2);
        if (g && !g.tap && !g.long) releaseAim(g);
      }
      if (live && !M) {
        if (controls.shootHeld() && ball.owner === user) charge = Math.min(1.2, charge + dt * 1.1);
        else if (charge > 0) {
          if (ball.owner === user) shoot(user, charge);
          charge = 0;
        }
        if (controls.passPressed() && ball.owner === user) {
          const to = bestPass(user, want.length() > 0.1 ? want.clone().normalize() : undefined);
          if (to) pass(user, to);
        }
        if (controls.tacklePressed()) {
          const o = ball.owner;
          if (o && o.team !== userTeam && o.pos.distanceTo(user.pos) < 2.2) {
            if (Math.random() < 0.35 + user.tack * 0.5 - o.drib * 0.25) {
              ball.owner = user;
              res.tackles++;
            } else user.noTouch = 0.6;
          } else if (!o && ball.pos.distanceTo(user.pos) < 2.4) user.vel.add(ball.pos.clone().sub(user.pos).setY(0).normalize().multiplyScalar(4));
        }
        if (controls.callPressed()) {
          const o = ball.owner;
          if (o && o.team === userTeam && !o.user) pass(o, user);
        }
        // touch gestures: drag+release = shot, tap = pass (with ball) or tackle (without), long press = ask for it
        const g = controls.released();
        if (g) {
          if (ball.owner === user && !g.tap && !g.long) dragShot(g);
          else if (ball.owner === user) {
            const dirScreen = new THREE.Vector3(my * attackDir, 0, mx * attackDir);
            const to = bestPass(user, dirScreen.length() > 0.1 ? dirScreen.normalize() : undefined);
            if (to) pass(user, to);
          } else if (g.long) {
            const o = ball.owner;
            if (o && o.team === userTeam && !o.user) pass(o, user);
          } else {
            const o = ball.owner;
            if (o && o.team !== userTeam && o.pos.distanceTo(user.pos) < 2.4) {
              if (Math.random() < 0.35 + user.tack * 0.5 - o.drib * 0.25) {
                ball.owner = user;
                res.tackles++;
                hud.banner("DESARMOU!");
              } else user.noTouch = 0.6;
            } else if (!o) user.vel.add(ball.pos.clone().sub(user.pos).setY(0).normalize().multiplyScalar(4));
          }
        }
      }
      // aiming feedback while the finger is down
      const aim = live && (M ? mState === "aim" : ball.owner === user) ? controls.aiming() : null;
      aimRing.visible = aimLine.visible = !!aim && Math.hypot(aim.dx, aim.dy) > 14;
      if (aim) {
        // face the goal while aiming, like lining up a shot
        const goalDir = attackDir > 0 ? Math.PI / 2 : -Math.PI / 2;
        let d = goalDir - user.heading;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        user.heading += d * Math.min(1, dt * 12);
      }
      if (aim && aimRing.visible) {
        const rr = ringAt(aim.held);
        aimRing.scale.setScalar(rr);
        aimRing.position.set(user.pos.x, 0.05, user.pos.z);
        ringMat.color.set(accuracyAt(aim.held) > 0.92 ? 0xffffff : 0x3fa9ff);
        const { target, curl } = aimFromGesture(aim);
        const pts: THREE.Vector3[] = [];
        const a = ball.pos.clone();
        const mid = a.clone().lerp(target, 0.5);
        mid.z += curl * -2.2 * 0.5 + curl * 1.4;
        mid.y = Math.max(mid.y, (target.y + a.y) / 2 + 0.6);
        for (let i = 0; i <= 24; i++) {
          const u = i / 24;
          pts.push(new THREE.Vector3().addScaledVector(a, (1 - u) * (1 - u)).addScaledVector(mid, 2 * u * (1 - u)).addScaledVector(target, u * u));
        }
        aimLine.geometry.setFromPoints(pts);
        aimLine.computeLineDistances();
      }
      hud.power.style.width = `${Math.min(100, (charge / 1.2) * 100)}%`;
      hud.power.parentElement!.style.opacity = charge > 0 ? "1" : "0";

      // ---- AI
      const owner = ball.owner;
      const attTeam = owner ? owner.team : ball.lastTouch ? ball.lastTouch.team : -1;
      for (const p of players) {
        p.noTouch -= dt;
        if (p.down && p.down > 0) {
          p.down -= dt;
          p.vel.multiplyScalar(Math.exp(-dt * 6));
          continue;
        }
        if (p.user && (!M || mState === "choose" || mState === "aim" || mState === "caneta" || mState === "skill")) continue;
        const dir = p.team === 0 ? 1 : -1;
        let target = new THREE.Vector3(p.home.x, 0, p.home.y);
        let spd = p.speed * 0.75;
        if (p.role === "GK") {
          const gx = -goalX(p.team) + dir * 1.2;
          target.set(gx, 0, THREE.MathUtils.clamp(ball.pos.z * 0.45, -GOAL_W / 2 + 0.6, GOAL_W / 2 - 0.6));
          // come out for loose balls in the box
          if (!owner && Math.abs(ball.pos.x - gx) < 9 && Math.abs(ball.pos.z) < 9 && ball.vel.length() < 8) target.copy(ball.pos).setY(0);
          spd = p.speed;
        } else if (owner === p) {
          // ball carrier decides every few tenths of a second
          p.think -= dt;
          const toGoal = new THREE.Vector3(goalX(p.team), 0, 0).sub(p.pos);
          const dGoal = toGoal.length();
          let pressure = 99;
          for (const o of players) if (o.team !== p.team) pressure = Math.min(pressure, o.pos.distanceTo(p.pos));
          if (forceShoot.has(p) && live) {
            forceShoot.delete(p);
            shoot(p, 0.8 + Math.random() * 0.3);
            continue;
          }
          if (p.think <= 0 && live) {
            p.think = 0.3 + Math.random() * 0.3;
            if (!p.user && dGoal < 21 && Math.random() < 0.45 + (21 - dGoal) * 0.03) {
              shoot(p, 0.6 + Math.random() * 0.5);
              continue;
            }
            if (pressure < 3.2 && Math.random() < 0.6) {
              const to = bestPass(p);
              if (to) {
                pass(p, to);
                continue;
              }
            }
            if (Math.random() < 0.12) {
              const to = bestPass(p);
              if (to) {
                pass(p, to);
                continue;
              }
            }
          }
          target = p.pos.clone().add(toGoal.normalize().multiplyScalar(6));
          target.z += Math.sin(t * 1.3 + p.home.y) * 3;
          spd = p.speed * 0.85;
        } else if (attTeam === p.team) {
          // support the attack: push up with the ball
          const push = THREE.MathUtils.clamp(ball.pos.x * dir, -20, 25) * dir;
          target.set(p.home.x + push * 0.7 + (p.role === "FW" ? dir * 6 : 0), 0, p.home.y + (ball.pos.z - p.home.y) * 0.15);
          target.x = THREE.MathUtils.clamp(target.x, -L / 2 + 3, L / 2 - 3);
        } else {
          // defend: shift toward the ball; the nearest one or two press it
          const shift = THREE.MathUtils.clamp(ball.pos.x, -L / 2, L / 2);
          target.set(p.home.x * 0.6 + shift * 0.45, 0, p.home.y * 0.7 + ball.pos.z * 0.3);
        }
        p.pos.y = 0;
        // presser
        if (p.role !== "GK" && owner !== p && (!owner || owner.team !== p.team)) {
          const mates = players.filter((q) => q.team === p.team && !q.user && q.role !== "GK").sort((a, b) => a.pos.distanceTo(ball.pos) - b.pos.distanceTo(ball.pos));
          const rank = mates.indexOf(p);
          if (rank === 0 || (rank === 1 && Math.abs(ball.pos.x - goalX(1 - p.team)) < 25)) {
            target.copy(ball.pos).setY(0).addScaledVector(ball.vel, 0.25);
            spd = p.speed * (owner ? 0.95 : 1.05);
            // AI tackle
            if (owner && owner.team !== p.team && owner.pos.distanceTo(p.pos) < 1.3 && Math.random() < dt * (0.9 + p.tack * 1.6 - owner.drib * 1.1)) {
              ball.owner = null;
              ball.vel.set((Math.random() - 0.5) * 6, 0.5, (Math.random() - 0.5) * 6);
              ball.lastTouch = p;
              owner.noTouch = 0.6;
              if (owner.user) res.lost++;
            }
          }
        }
        const v = target.sub(p.pos).setY(0);
        const d = v.length();
        if (d > 0.4) p.vel.lerp(v.normalize().multiplyScalar(Math.min(spd, d * 2)), Math.min(1, dt * 5));
        else p.vel.multiplyScalar(Math.exp(-dt * 6));
      }

      // ---- integrate players + separation
      for (const p of players) {
        if (live || p.user) p.pos.addScaledVector(p.vel, dt * (live ? 1 : 0.4));
        p.pos.x = THREE.MathUtils.clamp(p.pos.x, -L / 2 - 1, L / 2 + 1);
        p.pos.z = THREE.MathUtils.clamp(p.pos.z, -W / 2 - 1, W / 2 + 1);
      }
      for (let i = 0; i < players.length; i++)
        for (let j = i + 1; j < players.length; j++) {
          const a = players[i],
            b = players[j];
          tmp.copy(b.pos).sub(a.pos).setY(0);
          const d = tmp.length();
          if (d < 0.75 && d > 1e-4) {
            tmp.multiplyScalar((0.75 - d) / d / 2);
            a.pos.sub(tmp);
            b.pos.add(tmp);
          }
        }

      // ---- ball
      if (ball.owner) {
        const o = ball.owner;
        const f = new THREE.Vector3(Math.sin(o.heading), 0, Math.cos(o.heading));
        const want2 = o.pos.clone().addScaledVector(f, 0.62).setY(BR);
        ball.pos.lerp(want2, Math.min(1, dt * 18));
        ball.vel.copy(o.vel);
      } else {
        ball.vel.y -= 9.8 * dt;
        ball.pos.addScaledVector(ball.vel, dt);
        if (ball.pos.y < BR) {
          ball.pos.y = BR;
          if (ball.vel.y < -1.5) ball.vel.y *= -0.45;
          else ball.vel.y = 0;
          ball.vel.x *= Math.exp(-dt * 0.9);
          ball.vel.z *= Math.exp(-dt * 0.9);
        }
        ball.vel.multiplyScalar(Math.exp(-dt * 0.12));
        if (Math.abs(ballCurl) > 0.01 && ball.vel.length() > 6) {
          ball.vel.z += ballCurl * dt;
          ballCurl *= Math.exp(-dt * 1.2);
        } else ballCurl = 0;
        // pick-ups
        if (live)
          for (const p of players) {
            if (p.noTouch > 0) continue;
            const reach = p.role === "GK" ? 1.5 + p.keep * 1.2 : 0.85;
            const d = Math.hypot(p.pos.x - ball.pos.x, p.pos.z - ball.pos.z);
            if (d < reach && ball.pos.y < (p.role === "GK" ? 2.5 : 1.3)) {
              const fast = ball.vel.length() > 14;
              if (p.role === "GK" && fast) {
                // save chance depends on keeper vs. shot speed
                if (Math.random() < 0.35 + p.keep * 0.5) {
                  ball.owner = p;
                  ball.lastTouch = p;
                  hud.banner("DEFENDEU!");
                } else {
                  p.noTouch = 0.5;
                  continue;
                }
              } else if (fast && Math.random() < 0.5) {
                // deflection
                ball.vel.multiplyScalar(-0.3);
                p.noTouch = 0.3;
                continue;
              } else {
                const prevOwner = ball.lastTouch;
                ball.owner = p;
                if (prevOwner && prevOwner.team !== p.team && p.user) res.tackles += 0; // interception
                if (prevOwner && prevOwner.user && prevOwner.team !== p.team) res.lost++;
                ball.lastTouch = p;
              }
              break;
            }
          }
      }
      // goalkeeper clears the ball quickly
      for (const t2 of [0, 1]) {
        const k = gk(t2);
        if (ball.owner === k) {
          k.think -= dt;
          if (k.think <= -0.8) {
            k.think = 0;
            const to = bestPass(k);
            if (to) pass(k, to);
            else kick(k, new THREE.Vector3(0, 0, (Math.random() - 0.5) * 20), 20, 6);
          }
        }
      }

      // ---- goals and out of play
      const bx = ball.pos.x,
        bz = ball.pos.z;
      if (Math.abs(bx) > L / 2 + BR && pause <= 0) {
        const scoringTeam = bx > 0 ? 0 : 1;
        if (Math.abs(bz) < GOAL_W / 2 && ball.pos.y < GOAL_H) {
          res.score[scoringTeam]++;
          const scorer = ball.lastTouch;
          if (scorer && scorer.team === scoringTeam && scorer.user) res.goals++;
          else if (scorer && scorer.team === scoringTeam && ball.lastPasser?.user && ball.lastPasser !== scorer) res.assists++;
          const mine = scoringTeam === userTeam;
          hud.banner(mine ? "GOOOOL!" : "Gol do adversário", scorer?.user ? `${cfg.user.name.toUpperCase()} marca!` : teams[scoringTeam].name);
          if (navigator.vibrate && mine) navigator.vibrate([80, 60, 160]);
          if (M) hud.feedLine?.(minute, scorer?.user ? `⚽ GOOOL de ${cfg.user.name}!!` : mine ? `⚽ GOL do ${teams[scoringTeam].name}!${ball.lastPasser?.user ? ` Assistência de ${cfg.user.name}!` : ""}` : `⚽ Gol do ${teams[scoringTeam].name}.`, true);
          pause = 2.8;
          kickoffTeam = 1 - scoringTeam;
          kickoffWait = true;
          setTimeout(() => {
            kickoffWait = false;
            if (!ended) kickoff(kickoffTeam);
          }, 2600);
        } else {
          // goal kick or corner
          const defending = bx > 0 ? 1 : 0;
          const lastAtt = ball.lastTouch && ball.lastTouch.team !== defending;
          if (lastAtt) {
            const k = gk(defending);
            ball.pos.set(Math.sign(bx) * (L / 2 - 4), BR, 0);
            ball.vel.set(0, 0, 0);
            k.pos.copy(ball.pos).setY(0);
            ball.owner = k;
          } else {
            const att = 1 - defending;
            const taker = players.filter((p) => p.team === att && p.role !== "GK").sort((a, b) => a.pos.distanceTo(ball.pos) - b.pos.distanceTo(ball.pos))[0];
            ball.pos.set(Math.sign(bx) * (L / 2 - 0.3), BR, Math.sign(bz || 1) * (W / 2 - 0.3));
            ball.vel.set(0, 0, 0);
            taker.pos.copy(ball.pos).setY(0);
            ball.owner = taker;
            hud.banner("Escanteio");
          }
          pause = 0.8;
        }
      } else if (Math.abs(bz) > W / 2 + BR && pause <= 0) {
        // throw-in for the other team
        const team = ball.lastTouch ? 1 - ball.lastTouch.team : 0;
        const taker = players.filter((p) => p.team === team && p.role !== "GK").sort((a, b) => a.pos.distanceTo(ball.pos) - b.pos.distanceTo(ball.pos))[0];
        ball.pos.set(THREE.MathUtils.clamp(bx, -L / 2 + 1, L / 2 - 1), BR, Math.sign(bz) * (W / 2 - 0.3));
        ball.vel.set(0, 0, 0);
        taker.pos.copy(ball.pos).setY(0);
        ball.owner = taker;
        pause = 0.6;
      }

      // ---- visuals
      for (const p of players) {
        const sp = Math.hypot(p.vel.x, p.vel.z);
        if (sp > 0.3) {
          let d = Math.atan2(p.vel.x, p.vel.z) - p.heading;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          p.heading += d * Math.min(1, dt * 10);
        } else if (ball.owner === p) {
          const goalDir = p.team === 0 ? Math.PI / 2 : -Math.PI / 2;
          let d = goalDir - p.heading;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          p.heading += d * Math.min(1, dt * 3);
        } else if (ball.owner !== p) {
          const tb = Math.atan2(ball.pos.x - p.pos.x, ball.pos.z - p.pos.z);
          let d = tb - p.heading;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          p.heading += d * Math.min(1, dt * 4);
        }
        p.phase += dt * sp * 1.9;
        if (p.mesh) {
          animateHuman(p.mesh, p.phase, Math.min(2, sp / 4), t);
          if (p.role === "GK" && ball.vel.length() > 14 && Math.abs(ball.pos.x - p.pos.x) < 6) {
            p.mesh.lArm.rotation.z = -1.2;
            p.mesh.rArm.rotation.z = 1.2;
          }
          p.holder.rotation.y = p.heading;
          p.holder.rotation.z = p.down && p.down > 0 ? Math.PI / 2.2 : 0;
        } else if (p.pix) {
          p.pix.update(dt, p.heading, sp, camera.position, p.pos);
          (p.pix.sprite.material as THREE.SpriteMaterial).rotation = p.down && p.down > 0 ? Math.PI / 2 : 0;
        }
        p.holder.position.copy(p.pos);
        if (p.tag) p.tag.position.set(p.pos.x, 2.45, p.pos.z);
      }
      ballM.position.copy(ball.pos);
      ballM.rotation.x += ball.vel.z * dt * 3;
      ballM.rotation.z -= ball.vel.x * dt * 3;

      // ---- camera: behind the user's player, looking toward the attacking goal
      const portrait = innerHeight > innerWidth;
      const focus = user.pos.clone().lerp(ball.pos, portrait ? 0.2 : 0.35);
      const camWant = focus.clone().add(portrait ? new THREE.Vector3(-attackDir * 7.5, 5.2, 0) : new THREE.Vector3(-attackDir * 15, 12, 0));
      // the camera runs on real time so it frames the chance even in slow motion
      camera.position.lerp(camWant, Math.min(1, realDt * (M && mState !== "auto" ? 7 : 4)));
      camera.lookAt(focus.x + attackDir * (portrait ? 11 : 9), portrait ? 0.9 : 0, focus.z);
      const fov = portrait ? 66 : 55;
      if (camera.fov !== fov) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    }

    function finish() {
      ended = true;
      // rating out of 10
      let rt = 6 + res.goals * 1.1 + res.assists * 0.7 + res.passes * 0.04 + res.tackles * 0.15 + res.onTarget * 0.15 + res.dribbles * 0.25 - res.lost * 0.06;
      const diff = res.score[userTeam] - res.score[1 - userTeam];
      rt += diff > 0 ? 0.4 : diff < 0 ? -0.3 : 0;
      res.rating = Math.round(THREE.MathUtils.clamp(rt, 3, 10) * 10) / 10;
      hud.banner("FIM DE JOGO", `${cfg.home.short} ${res.score[0]} × ${res.score[1]} ${cfg.away.short}`);
      setTimeout(() => {
        cancelAnimationFrame(raf);
        removeEventListener("resize", onResize);
        renderer.dispose();
        renderer.domElement.remove();
        resolve(res);
      }, 2600);
    }

    const onResize = () => view.resize();
    addEventListener("resize", onResize);
    camera.position.set(-15, 12, 0);
    raf = requestAnimationFrame(frame);
    if (cfg.banner) M ? hud.feedLine?.(cfg.startMinute, `📣 ${cfg.banner}`) : hud.banner(cfg.banner);
    (window as unknown as Record<string, unknown>).__match = { step: (dt: number) => { step(dt, performance.now() / 1000); view.render(); }, res, ball, players, stop: () => cancelAnimationFrame(raf), skip: () => (minute = 89.95), chance: (k: "withBall" | "incoming") => setupChance(k), get state() { return mState; }, get skillT() { return skillT; } };
  });
}
