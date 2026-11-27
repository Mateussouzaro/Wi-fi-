import * as THREE from "three";
import { PixelPlayer, Look, crowdTexture, pixelPitch } from "./sprites";
import { makeView, Style } from "./pixel";

// Little in-engine "clips" for the story: the bench, Tião getting hurt, the call-up,
// running on, the scout coming to talk and the mother. Each dialogue line names a shot.

export type Shot =
  | "wide" | "bench" | "coach" | "injury" | "tiao" | "callup"
  | "sub" | "enter"
  | "final" | "scout" | "scout2" | "scout3" | "mae" | "sunset"
  | "ceari" | "ceari2";

interface Actor {
  pix: PixelPlayer;
  pos: THREE.Vector3;
  heading: number;
  speed: number;
  sink: number; // how far the sprite sits into the ground (sitting on the bench)
  down: number; // lying on the ground
  jump: number;
  target?: THREE.Vector3;
}

const L = 56,
  W = 36;
const BENCH_Z = W / 2 + 3;
const UNI = { c1: 0x1e4fa3, c2: 0xffffff };
const FER = { c1: 0xd62828, c2: 0x111111 };

export function startCutscene(host: HTMLElement, style: Style, quality: "alta" | "baixa", me: { look: { skin: number; hair: string; hairColor: number }; number: number } | null, varzea = true) {
  const renderer = new THREE.WebGLRenderer({ antialias: style !== "pixel" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const sky = new THREE.Color(0x8fd0f2);
  scene.background = sky;
  scene.fog = new THREE.Fog(0x8fd0f2, 60, 160);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
  const view = makeView(renderer, scene, camera, style, quality);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a6a40, 1.25);
  const sun = new THREE.DirectionalLight(0xfff1d6, 1.7);
  sun.position.set(-20, 40, 25);
  scene.add(hemi, sun);

  // ground + pitch
  const around = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ color: varzea ? 0x7a5c35 : 0x2f7d34, roughness: 1 }));
  around.rotation.x = -Math.PI / 2;
  around.position.y = -0.02;
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(L, W), new THREE.MeshStandardMaterial({ map: pixelPitch(varzea), roughness: 1 }));
  pitch.rotation.x = -Math.PI / 2;
  scene.add(around, pitch);
  // goals
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff });
  for (const sx of [-1, 1]) {
    const g = new THREE.Group();
    const post = (z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.4, 0.2), white);
      m.position.set(0, 1.2, z);
      g.add(m);
    };
    post(-3.6);
    post(3.6);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 7.4), white);
    bar.position.y = 2.4;
    g.add(bar);
    const net = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 2.4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
    net.rotation.y = Math.PI / 2;
    net.position.set(sx * 1.4, 1.2, 0);
    g.add(net);
    g.position.x = sx * (L / 2);
    scene.add(g);
  }
  // crowd on the far side and behind the bench
  const ct = crowdTexture(UNI.c1, varzea ? FER.c1 : 0xffffff);
  ct.wrapS = THREE.RepeatWrapping;
  ct.repeat.x = 4;
  const crowdMat = new THREE.MeshBasicMaterial({ map: ct, transparent: true, alphaTest: 0.5 });
  const crowdFar = new THREE.Mesh(new THREE.PlaneGeometry(L + 10, 5), crowdMat);
  crowdFar.position.set(0, 2.5, -W / 2 - 5);
  scene.add(crowdFar);
  const crowdNear = new THREE.Mesh(new THREE.PlaneGeometry(L + 10, 5), crowdMat);
  crowdNear.position.set(0, 2.5, BENCH_Z + 6);
  crowdNear.rotation.y = Math.PI;
  scene.add(crowdNear);
  // wooden bench with a tin roof
  const wood = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 1 });
  const bench = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(7, 0.18, 0.7), wood);
  seat.position.y = 0.55;
  const front = new THREE.Mesh(new THREE.BoxGeometry(7, 0.7, 0.1), wood);
  front.position.set(0, 0.35, -0.42);
  const back = new THREE.Mesh(new THREE.BoxGeometry(7, 1.0, 0.12), wood);
  back.position.set(0, 1.0, 0.45);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(8, 0.1, 2.4), new THREE.MeshStandardMaterial({ color: 0x9aa4ad, metalness: 0.3 }));
  roof.position.set(0, 2.7, 0.2);
  roof.rotation.x = -0.12;
  void front;
  bench.add(seat, back, roof);
  for (const x of [-3.8, 3.8]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.7, 0.15), wood);
    p.position.set(x, 1.35, 1.2);
    bench.add(p);
  }
  bench.position.set(-6, 0, BENCH_Z);
  scene.add(bench);
  // trees behind the crowd for the várzea
  if (varzea)
    for (let i = 0; i < 14; i++) {
      const x = -L / 2 - 10 + i * 6.5;
      const t = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 0), new THREE.MeshStandardMaterial({ color: 0x2e8b3a, flatShading: true }));
      t.position.set(x, 6.5 + (i % 3), -W / 2 - 10);
      t.scale.y = 0.7;
      scene.add(t);
    }

  // ---- actors
  const actors: Actor[] = [];
  const add = (L: Look, x: number, z: number, h = 1.95): Actor => {
    const pix = new PixelPlayer(L, h);
    scene.add(pix.group);
    const a: Actor = { pix, pos: new THREE.Vector3(x, 0, z), heading: 0, speed: 0, sink: 0, down: 0, jump: 0 };
    actors.push(a);
    return a;
  };
  const kit = (c: { c1: number; c2: number }, n: number, skin: number, hair: string, hairColor = 0x120c08): Look => ({ skin, hair, hairColor, shirt: c.c1, shirt2: c.c2, shorts: c.c2 === 0xffffff ? 0xffffff : c.c2, socks: c.c1, boots: 0x111111, number: n });
  const SK = [0x5c3a21, 0x8d5524, 0xa0673a, 0xc68642, 0xe0ac69, 0xf1c27d];
  const HR = ["short", "buzz", "afro", "bald", "long"];
  const meLook: Look = me
    ? { skin: me.look.skin, hair: me.look.hair, hairColor: me.look.hairColor, shirt: varzea ? UNI.c1 : 0x111111, shirt2: 0xffffff, shorts: 0xffffff, socks: varzea ? UNI.c1 : 0x111111, boots: 0x111111, number: me.number }
    : { skin: 0x8d5524, hair: "short", hairColor: 0x120c08, shirt: 0xff8c1a, shirt2: 0xffb15c, shorts: 0xffffff, socks: UNI.c1, boots: 0x111111, number: -1 };
  const hero = add(meLook, -6.5, BENCH_Z - 0.1);
  // reserves wear orange bibs
  const bib = (i: number): Look => ({ skin: SK[(i * 2 + 1) % 6], hair: HR[(i + 2) % 5], hairColor: 0x120c08, shirt: 0xff8c1a, shirt2: 0xffb15c, shorts: 0xffffff, socks: UNI.c1, boots: 0x111111, number: -1 });
  const res1 = add(bib(1), -8.6, BENCH_Z - 0.1);
  const res2 = add(bib(2), -4.4, BENCH_Z - 0.1);
  const coach = add({ skin: 0xa0673a, hair: "bald", hairColor: 0x333333, shirt: 0x1e4fa3, shirt2: 0x1e4fa3, shorts: 0x3a3a3a, socks: 0x3a3a3a, boots: 0x222222, number: -1 }, -2.4, BENCH_Z - 1.2, 1.9);
  const tiao = add(kit(UNI, 9, 0x5c3a21, "afro"), 14, 2);
  const players: Actor[] = [];
  for (let i = 0; i < 5; i++) players.push(add(kit(UNI, [2, 4, 6, 8, 10][i], SK[i % 6], HR[i % 5]), -10 + i * 5, (i % 2 ? -1 : 1) * (4 + i * 2)));
  for (let i = 0; i < 6; i++) players.push(add(kit(FER, [1, 3, 5, 7, 11, 4][i], SK[(i + 3) % 6], HR[(i + 1) % 5]), -6 + i * 5, (i % 2 ? 1 : -1) * (3 + i * 2)));
  const scout = add({ skin: 0xe0ac69, hair: "bald", hairColor: 0x222222, shirt: 0x111111, shirt2: 0x111111, shorts: 0x2b2d42, socks: 0x2b2d42, boots: 0x111111, number: -1 }, 30, BENCH_Z + 2, 1.9);
  const mae = add({ skin: 0x8d5524, hair: "long", hairColor: 0x1a1008, shirt: 0xe56b8f, shirt2: 0xe56b8f, shorts: 0x5a3e8a, socks: 0x5a3e8a, boots: 0xffffff, number: -1 }, 30, BENCH_Z + 3, 1.8);
  const ademir = add({ skin: 0xc68642, hair: "short", hairColor: 0x555555, shirt: 0x111111, shirt2: 0xffffff, shorts: 0x111111, socks: 0x111111, boots: 0x111111, number: -1 }, 30, 0, 1.9);
  // a ball for the match in the background
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true }));
  ball.position.set(0, 0.22, 0);
  scene.add(ball);
  const ballVel = new THREE.Vector3();
  let ballOwner: Actor | null = players[0];

  // substitution board (old números pintados à mão)
  const boardCv = document.createElement("canvas");
  boardCv.width = 64;
  boardCv.height = 32;
  const bg = boardCv.getContext("2d")!;
  bg.fillStyle = "#111";
  bg.fillRect(0, 0, 64, 32);
  bg.font = "bold 14px monospace";
  bg.textAlign = "center";
  bg.fillStyle = "#ff3b3b";
  bg.fillText("9", 16, 21);
  bg.fillStyle = "#3bff6b";
  bg.fillText(String(me?.number ?? "?"), 48, 21);
  bg.fillStyle = "#fff";
  bg.fillText("⇄", 32, 21);
  const boardTex = new THREE.CanvasTexture(boardCv);
  boardTex.magFilter = THREE.NearestFilter;
  const board = new THREE.Sprite(new THREE.SpriteMaterial({ map: boardTex }));
  board.scale.set(1.2, 0.6, 1);
  board.visible = false;
  scene.add(board);

  // ---- shots
  let shot: Shot = "wide";
  let st = 0;
  const camPos = new THREE.Vector3(0, 14, 34);
  const camLook = new THREE.Vector3();
  let camFrom = camPos.clone(),
    camTo = camPos.clone(),
    lookFrom = new THREE.Vector3(),
    lookTo = new THREE.Vector3(),
    camDur = 4;
  const move = (fromP: number[], toP: number[], fromL: number[], toL: number[], dur = 5) => {
    camFrom = new THREE.Vector3(...fromP);
    camTo = new THREE.Vector3(...toP);
    lookFrom = new THREE.Vector3(...fromL);
    lookTo = new THREE.Vector3(...toL);
    camDur = dur;
  };
  const sit = (a: Actor, x: number) => {
    a.pos.set(x, 0, BENCH_Z - 0.05);
    a.heading = Math.PI; // facing the pitch (−z)
    a.sink = 0.5;
    a.target = undefined;
  };
  const offstage = (...as: Actor[]) => as.forEach((a) => {
    a.pos.set(60, 0, 60);
    a.target = undefined;
  });
  let matchOn = true;
  let celebrate = false;
  let sunset = 0;

  function setShot(s: Shot) {
    shot = s;
    st = 0;
    board.visible = false;
    celebrate = false;
    switch (s) {
      case "wide":
        matchOn = true;
        sit(hero, -6.5), sit(res1, -8.6), sit(res2, -4.4);
        coach.pos.set(-2.4, 0, BENCH_Z - 1.2);
        offstage(scout, mae, ademir);
        move([-26, 16, 40], [18, 13, 38], [-6, 0, 0], [6, 0, 0], 7);
        break;
      case "bench":
        sit(hero, -6.5), sit(res1, -8.6), sit(res2, -4.4);
        move([-6.5, 2.3, BENCH_Z - 8.5], [-6.5, 2.0, BENCH_Z - 6.8], [-6.5, 1.0, BENCH_Z], [-6.5, 1.0, BENCH_Z], 7);
        break;
      case "coach":
        coach.pos.set(-4.6, 0, BENCH_Z - 1.3);
        coach.heading = 0.6; // towards the bench
        move([1.2, 1.9, BENCH_Z - 1.6], [0.2, 1.8, BENCH_Z - 1.2], [-5.4, 1.1, BENCH_Z - 0.6], [-5.4, 1.1, BENCH_Z - 0.6], 6);
        break;
      case "injury":
        matchOn = false;
        tiao.pos.set(16, 0, 1);
        tiao.target = new THREE.Vector3(19.5, 0, 0.5);
        tiao.down = 0;
        ballOwner = null;
        ball.position.set(10, 3, 4);
        ballVel.set(4.5, 0, -1.6);
        players.forEach((p, i) => p.pos.set(14 + (i % 4) * 2.5, 0, -6 + i * 1.3));
        players[6].pos.set(19.8, 0, 1.6);
        move([8, 3.2, 10], [12, 2.6, 8], [18, 1.4, 0.5], [19, 1, 0.5], 4);
        break;
      case "tiao":
        tiao.pos.set(19.5, 0, 0.5);
        tiao.down = 1;
        tiao.target = undefined;
        players.slice(0, 3).forEach((p, i) => {
          p.pos.set(16 + i * 1.8, 0, -4 - (i % 2));
          p.target = new THREE.Vector3(18.4 + i * 1.1, 0, -1.3);
        });
        move([22.5, 4.2, 6], [21.4, 3.2, 4.6], [19.5, 0.6, 0.5], [19.5, 0.6, 0.5], 5);
        break;
      case "callup":
        sit(hero, -6.5), sit(res1, -8.6), sit(res2, -4.4);
        coach.pos.set(-5, 0, BENCH_Z - 1.4);
        coach.heading = 0;
        move([-6, 2.2, BENCH_Z - 8], [-6, 2.1, BENCH_Z - 6.4], [-6.2, 1.1, BENCH_Z], [-6.2, 1.2, BENCH_Z], 5);
        break;
      case "sub":
        matchOn = false;
        hero.sink = 0;
        hero.pos.set(-3, 0, W / 2 + 0.6);
        hero.heading = Math.PI;
        coach.pos.set(-1.4, 0, W / 2 + 1.2);
        coach.heading = -Math.PI / 2;
        tiao.down = 0;
        tiao.pos.set(1.5, 0, W / 2 - 1.5);
        tiao.target = new THREE.Vector3(3, 0, W / 2 + 1.5);
        board.visible = true;
        move([-2.2, 1.7, W / 2 - 5.5], [-2.2, 1.5, W / 2 - 4.2], [-2.2, 1.3, W / 2 + 0.8], [-2.2, 1.3, W / 2 + 0.8], 6);
        break;
      case "enter":
        matchOn = true;
        hero.sink = 0;
        hero.pos.set(-3, 0, W / 2 + 0.5);
        hero.target = new THREE.Vector3(-4, 0, 6);
        offstage(tiao);
        move([-3, 2.5, W / 2 + 6], [-4, 3.2, 13], [-3, 1, W / 2 - 4], [-4, 0.8, 0], 5);
        break;
      case "final":
        matchOn = false;
        celebrate = true;
        sunset = 1;
        hero.sink = 0;
        hero.pos.set(2, 0, 4);
        hero.target = undefined;
        players.forEach((p, i) => p.pos.set((i < 5 ? 0 : 14) + (i % 5) * 2.2 - 4, 0, (i % 3) * 2.5 + (i < 5 ? 2 : -4)));
        move([-10, 9, 22], [10, 7, 20], [2, 0, 2], [2, 0, 2], 6);
        break;
      case "scout":
        hero.sink = 0;
        hero.pos.set(-1, 0, W / 2 + 0.8);
        hero.heading = 0;
        hero.target = undefined;
        scout.pos.set(7, 0, W / 2 + 2.5);
        scout.target = new THREE.Vector3(0.6, 0, W / 2 + 1.2);
        move([2, 1.7, W / 2 - 5], [0.6, 1.6, W / 2 - 4.2], [1.5, 1.2, W / 2 + 1], [0, 1.2, W / 2 + 1], 5);
        break;
      case "scout2":
        hero.pos.set(-1, 0, W / 2 + 0.8);
        scout.pos.set(0.6, 0, W / 2 + 1.2);
        scout.target = undefined;
        move([-3.6, 1.7, W / 2 - 1.6], [-3.3, 1.6, W / 2 - 1.2], [0.4, 1.4, W / 2 + 1.1], [0.4, 1.4, W / 2 + 1.1], 6);
        break;
      case "scout3":
        hero.pos.set(-1, 0, W / 2 + 0.8);
        scout.pos.set(0.6, 0, W / 2 + 1.2);
        scout.target = undefined;
        move([3.4, 1.7, W / 2 - 1.4], [3.1, 1.6, W / 2 - 1.1], [-1, 1.3, W / 2 + 0.8], [-1, 1.3, W / 2 + 0.8], 6);
        break;
      case "mae":
        hero.pos.set(-1, 0, W / 2 + 0.8);
        scout.target = new THREE.Vector3(6, 0, W / 2 + 3);
        mae.pos.set(-7, 0, W / 2 + 3);
        mae.target = new THREE.Vector3(-1.9, 0, W / 2 + 1.4);
        move([-1, 1.9, W / 2 - 4.5], [-1.5, 1.6, W / 2 - 3.4], [-1.8, 1.2, W / 2 + 1], [-1.5, 1.2, W / 2 + 1], 6);
        break;
      case "sunset":
        sunset = 1;
        move([0, 4, 30], [0, 20, 40], [0, 2, 0], [0, 14, -40], 7);
        break;
      case "ceari":
        matchOn = false;
        hero.sink = 0;
        hero.pos.set(0, 0, 2);
        hero.heading = Math.PI / 2;
        ademir.pos.set(1.6, 0, 2.2);
        ademir.heading = -Math.PI / 2;
        players.forEach((p, i) => {
          p.pos.set(-14 + (i % 6) * 5, 0, -8 + Math.floor(i / 6) * 4);
          p.target = undefined;
        });
        offstage(res1, res2, coach, tiao, scout, mae, ...players.slice(5));
        move([0.8, 1.8, 8], [0.8, 1.6, 6], [0.8, 1.3, 2], [0.8, 1.3, 2], 6);
        break;
      case "ceari2":
        move([-3, 1.7, 1.2], [-2.6, 1.6, 1.4], [1.6, 1.4, 2.2], [1.6, 1.4, 2.2], 6);
        break;
    }
  }

  // ---- loop
  let raf = 0,
    last = performance.now(),
    T = 0;
  const tmp = new THREE.Vector3();
  function tick(now: number) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    st += dt;
    T += dt;
    // background match: the ball moves between players who chase it
    if (matchOn) {
      if (ballOwner) {
        tmp.set(Math.sin(ballOwner.heading), 0, Math.cos(ballOwner.heading)).multiplyScalar(0.6);
        ball.position.copy(ballOwner.pos).add(tmp).setY(0.22);
        if (Math.random() < dt * 0.7) {
          const to = players[Math.floor(Math.random() * players.length)];
          ballVel.copy(to.pos).sub(ball.position).setY(0).normalize().multiplyScalar(11);
          ballOwner = null;
        }
      } else {
        ball.position.addScaledVector(ballVel, dt);
        ballVel.multiplyScalar(Math.exp(-dt * 0.8));
        ball.position.x = THREE.MathUtils.clamp(ball.position.x, -L / 2 + 1, L / 2 - 1);
        ball.position.z = THREE.MathUtils.clamp(ball.position.z, -W / 2 + 1, W / 2 - 1);
        for (const p of players) if (p.pos.distanceTo(ball.position) < 0.8 && ballVel.length() < 9) ballOwner = p;
      }
      players.forEach((p, i) => {
        const chase = i % 4 === Math.floor(T / 3) % 4;
        p.target = chase ? ball.position.clone().setY(0) : new THREE.Vector3(((i * 37) % 40) - 20 + Math.sin(T * 0.3 + i) * 6, 0, ((i * 23) % 26) - 13 + Math.cos(T * 0.4 + i) * 4);
      });
    } else if (shot === "injury") {
      ball.position.addScaledVector(ballVel, dt);
      ball.position.y = Math.max(0.22, 3 - (st - 0.7) * (st - 0.7) * 2.2);
      // jump for the header, then a bad landing
      tiao.jump = st > 0.5 && st < 1.4 ? Math.sin(((st - 0.5) / 0.9) * Math.PI) * 1.3 : 0;
      players[6].jump = st > 0.55 && st < 1.4 ? Math.sin(((st - 0.55) / 0.85) * Math.PI) * 1.1 : 0;
      if (st > 1.4) tiao.down = 1;
    }
    if (celebrate) players.forEach((p, i) => (p.jump = i < 5 ? Math.max(0, Math.sin(T * 7 + i)) * 0.7 : 0));
    // the hero gets up during the call-up
    if (shot === "callup" && st > 1.3) {
      hero.sink = Math.max(0, hero.sink - dt * 1.6);
      if (hero.sink === 0 && st > 2.2) {
        hero.target = new THREE.Vector3(-6.5, 0, BENCH_Z - 2.5);
      }
    }
    if (shot === "sub") board.position.set(coach.pos.x + 0.2, 2.3 + Math.sin(T * 3) * 0.05, coach.pos.z - 0.2);
    // actors walk toward their targets
    for (const a of actors) {
      if (a.target && a.down === 0) {
        tmp.copy(a.target).sub(a.pos).setY(0);
        const d = tmp.length();
        const spd = a === hero && shot === "enter" ? 6 : a === mae ? 4.5 : matchOn && players.includes(a) ? 4.2 : 2.2;
        if (d > 0.15) {
          a.pos.addScaledVector(tmp.normalize(), Math.min(d, spd * dt));
          a.heading = Math.atan2(tmp.x, tmp.z);
          a.speed = spd;
        } else a.speed = 0;
      } else a.speed = 0;
      // talkers face each other
      if (!a.target || a.speed === 0) {
        if ((shot === "scout2" || shot === "scout3" || shot === "mae" || shot === "scout") && (a === hero || a === scout)) {
          const o = a === hero ? scout : hero;
          a.heading = Math.atan2(o.pos.x - a.pos.x, o.pos.z - a.pos.z);
        }
        if (shot === "mae" && a === mae) a.heading = Math.atan2(hero.pos.x - a.pos.x, hero.pos.z - a.pos.z);
        if ((shot === "coach" || shot === "callup") && a === coach) a.heading = Math.atan2(hero.pos.x - a.pos.x, hero.pos.z - a.pos.z);
        if (shot === "sub" && a === hero) a.heading = 0;
        if ((shot === "ceari" || shot === "ceari2") && (a === hero || a === ademir)) a.heading = a === hero ? Math.PI / 2 : -Math.PI / 2;
      }
      a.pix.update(dt, a.heading, a.speed, camera.position, a.pos);
      a.pix.group.position.set(a.pos.x, a.jump - a.sink, a.pos.z);
      (a.pix.sprite.material as THREE.SpriteMaterial).rotation = a.down ? Math.PI / 2 : 0;
      a.pix.shadow.visible = a.sink === 0;
    }
    // golden-hour light for the end of the match
    const k = sunset;
    sky.setRGB(THREE.MathUtils.lerp(0.56, 1.0, k), THREE.MathUtils.lerp(0.82, 0.62, k), THREE.MathUtils.lerp(0.95, 0.42, k));
    (scene.fog as THREE.Fog).color.copy(sky);
    sun.color.setRGB(1, THREE.MathUtils.lerp(0.95, 0.72, k), THREE.MathUtils.lerp(0.84, 0.5, k));
    // camera move with a gentle ease
    const u = Math.min(1, st / camDur);
    const e = u * u * (3 - 2 * u);
    camPos.lerpVectors(camFrom, camTo, e);
    camLook.lerpVectors(lookFrom, lookTo, e);
    camera.position.copy(camPos);
    const portrait = innerHeight > innerWidth;
    camera.fov = portrait ? 62 : 48;
    camera.updateProjectionMatrix();
    if (portrait && !["wide", "final", "sunset", "enter"].includes(shot)) camLook.y -= 0.85;
    camera.lookAt(camLook);
    view.render();
  }
  const onResize = () => view.resize();
  addEventListener("resize", onResize);
  setShot("wide");
  raf = requestAnimationFrame(tick);

  return {
    setShot: (s: Shot) => {
      if (s !== shot || st > 0.5) setShot(s);
    },
    sunset: (v: number) => (sunset = v),
    dispose: () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", onResize);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
