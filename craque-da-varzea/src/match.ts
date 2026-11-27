import * as THREE from "three";
import { makeView, Style } from "./pixel";
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
  mesh: HumanMesh;
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
}
export interface MatchControls {
  moveX: () => number;
  moveY: () => number;
  sprint: () => boolean;
  shootHeld: () => boolean;
  passPressed: () => boolean;
  tacklePressed: () => boolean;
  callPressed: () => boolean;
  aiming: () => Gesture | null; // finger still down
  released: () => (Gesture & { tap: boolean; long: boolean }) | null; // consumed once
}

export function playMatch(canvasHost: HTMLElement, cfg: MatchCfg, hud: { score: HTMLElement; clock: HTMLElement; banner: (t: string, sub?: string) => void; power: HTMLElement }, controls: MatchControls): Promise<MatchResult> {
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
    const field = new THREE.Mesh(new THREE.PlaneGeometry(L + 4, W + 4), new THREE.MeshStandardMaterial({ map: fieldTexture(varzea), roughness: 1 }));
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
      const standMat = new THREE.MeshStandardMaterial({ map: crowdTex, roughness: 1 });
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
        const mesh = makeHuman(t * 50 + i * 7 + 3, opts);
        scene.add(mesh.group);
        const s = tc.strength / 100;
        const u = cfg.user.attrs;
        const p: P = {
          mesh,
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
          mesh.group.add(ring);
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
      const ty = THREE.MathUtils.clamp(0.25 + (g.dy / 320) * 1.6, 0.2, 3.2);
      return { target: new THREE.Vector3(goalX(userTeam), ty, tz), power, curl: THREE.MathUtils.clamp(g.curl / 90, -1, 1) * ad };
    };
    const gk = (t: number) => players.find((p) => p.team === t && p.role === "GK")!;

    const res: MatchResult = { score: [...cfg.startScore] as [number, number], goals: 0, assists: 0, shots: 0, onTarget: 0, passes: 0, tackles: 0, lost: 0, rating: 6, minutes: 90 - cfg.startMinute };
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
      return dist;
    }

    function dragShot(g: Gesture) {
      const { target, power, curl } = aimFromGesture(g);
      const acc = accuracyAt(g.held);
      // error grows when the ring was not closed, shrinks with the shooting attribute
      const err = (1 - acc) * (1.4 - user.shot) * 3.2;
      target.z += (Math.random() - 0.5) * err * 2;
      target.y = Math.max(0.15, target.y + (Math.random() - 0.4) * err);
      const sp = 17 + 15 * power * (0.75 + user.shot * 0.4);
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

    // ------------------------------------------------------------- loop
    let last = performance.now();
    let raf = 0;
    const tmp = new THREE.Vector3();
    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      step(dt, now / 1000);
      view.render();
    }
    function step(dt: number, t: number) {
      if (ended) return;
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
      if (want.length() > 0.08) user.vel.lerp(want.clone().normalize().multiplyScalar(uSpeed * Math.min(1, want.length())), Math.min(1, dt * 8));
      else user.vel.multiplyScalar(Math.exp(-dt * 8));
      if (live) {
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
      const aim = live && ball.owner === user ? controls.aiming() : null;
      aimRing.visible = aimLine.visible = !!aim && Math.hypot(aim.dx, aim.dy) > 14;
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
        if (p.user) continue;
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
          if (p.think <= 0 && live) {
            p.think = 0.3 + Math.random() * 0.3;
            if (dGoal < 21 && Math.random() < 0.45 + (21 - dGoal) * 0.03) {
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
          pause = 2.8;
          kickoffTeam = 1 - scoringTeam;
          setTimeout(() => kickoff(kickoffTeam), 2600);
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
        } else if (ball.owner !== p) {
          const tb = Math.atan2(ball.pos.x - p.pos.x, ball.pos.z - p.pos.z);
          let d = tb - p.heading;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          p.heading += d * Math.min(1, dt * 4);
        }
        p.phase += dt * sp * 1.9;
        animateHuman(p.mesh, p.phase, Math.min(2, sp / 4), t);
        if (p.role === "GK" && ball.vel.length() > 14 && Math.abs(ball.pos.x - p.pos.x) < 6) {
          p.mesh.lArm.rotation.z = -1.2;
          p.mesh.rArm.rotation.z = 1.2;
        }
        p.mesh.group.position.copy(p.pos);
        p.mesh.group.rotation.y = p.heading;
        if (p.tag) p.tag.position.set(p.pos.x, 2.45, p.pos.z);
      }
      ballM.position.copy(ball.pos);
      ballM.rotation.x += ball.vel.z * dt * 3;
      ballM.rotation.z -= ball.vel.x * dt * 3;

      // ---- camera: behind the user's player, looking toward the attacking goal
      const portrait = innerHeight > innerWidth;
      const focus = user.pos.clone().lerp(ball.pos, portrait ? 0.2 : 0.35);
      const camWant = focus.clone().add(portrait ? new THREE.Vector3(-attackDir * 7.5, 5.2, 0) : new THREE.Vector3(-attackDir * 15, 12, 0));
      camera.position.lerp(camWant, Math.min(1, dt * 4));
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
      let rt = 6 + res.goals * 1.1 + res.assists * 0.7 + res.passes * 0.04 + res.tackles * 0.15 + res.onTarget * 0.15 - res.lost * 0.06;
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
    if (cfg.banner) hud.banner(cfg.banner);
    (window as unknown as Record<string, unknown>).__match = { step: (dt: number) => { step(dt, performance.now() / 1000); view.render(); }, res, ball, players, stop: () => cancelAnimationFrame(raf), skip: () => (minute = 89.95) };
  });
}
