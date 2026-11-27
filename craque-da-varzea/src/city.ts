import * as THREE from "three";
import { makeView, Style } from "./pixel";
import { PixelPlayer } from "./sprites";
import { makeHuman, animateHuman, HumanMesh, rng } from "./people";

// A short walk around the neighbourhood: fans recognise the player and ask for autographs.

export interface CityCfg {
  look: { skin: number; hair: string; hairColor: number };
  shirt: number;
  fame: number;
  quality: "alta" | "baixa";
  style: Style;
}

interface Fan {
  mesh: HumanMesh | null;
  pix: PixelPlayer | null;
  holder: THREE.Group;
  pos: THREE.Vector3;
  heading: number;
  phase: number;
  state: "walk" | "approach" | "wait" | "happy";
  target: THREE.Vector3;
  bubble: THREE.Sprite;
  t: number;
}

function bubbleSprite(txt: string) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 96;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.beginPath();
  g.roundRect(8, 8, 240, 64, 18);
  g.fill();
  g.beginPath();
  g.moveTo(110, 70);
  g.lineTo(128, 92);
  g.lineTo(146, 70);
  g.fill();
  g.fillStyle = "#111";
  g.font = "900 30px sans-serif";
  g.textAlign = "center";
  g.fillText(txt, 128, 51);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
  s.scale.set(1.8, 0.68, 1);
  s.renderOrder = 5;
  return s;
}

export function walkCity(host: HTMLElement, cfg: CityCfg, io: { moveX: () => number; moveY: () => number; prompt: (show: boolean) => void; done: () => boolean; status: (t: string) => void }, onFan: () => Promise<"sign" | "selfie" | "skip">) {
  return new Promise<{ autographs: number; selfies: number }>((resolve) => {
    const renderer = new THREE.WebGLRenderer({ antialias: cfg.style !== "pixel" });
    renderer.setPixelRatio(Math.min(devicePixelRatio, cfg.quality === "alta" ? 1.75 : 1));
    renderer.setSize(innerWidth, innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = cfg.quality === "alta";
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9fd3f0);
    scene.fog = new THREE.Fog(0x9fd3f0, 60, 160);
    const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);
    const view = makeView(renderer, scene, camera, cfg.style, cfg.quality);
    const onResize = () => view.resize();
    addEventListener("resize", onResize);
    const sun = new THREE.DirectionalLight(0xfff0dd, 2.6);
    sun.position.set(20, 40, 15);
    sun.castShadow = true;
    Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40 });
    scene.add(sun, new THREE.HemisphereLight(0xdfefff, 0x9a8a70, 1));
    const r = rng(21);
    // plaza with a portuguese-stone floor, a fountain, shops around and palm trees
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const fountain = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.4, 0.8, 32), new THREE.MeshStandardMaterial({ color: 0xbfb8a8 }));
    fountain.position.y = 0.4;
    const water = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.1, 32), new THREE.MeshStandardMaterial({ color: 0x3fa9d6, roughness: 0.1, metalness: 0.2 }));
    water.position.y = 0.78;
    scene.add(fountain, water);
    const cols = [0xe9c46a, 0x2a9d8f, 0xe76f51, 0xf4a261, 0x8ab17d, 0x6c91c2, 0xd4a5a5, 0xf2e8cf];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const h = 6 + Math.floor(r() * 3) * 3;
      const b = new THREE.Mesh(new THREE.BoxGeometry(9, h, 7), new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: 0.9 }));
      b.position.set(Math.cos(a) * 34, h / 2, Math.sin(a) * 34);
      b.lookAt(0, h / 2, 0);
      b.castShadow = true;
      scene.add(b);
    }
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.2;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 7, 8), new THREE.MeshStandardMaterial({ color: 0x8a7558 }));
      trunk.position.set(Math.cos(a) * 18, 3.5, Math.sin(a) * 18);
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 0), new THREE.MeshStandardMaterial({ color: 0x2e8b3a, flatShading: true }));
      crown.position.set(trunk.position.x, 7.4, trunk.position.z);
      crown.scale.y = 0.5;
      trunk.castShadow = crown.castShadow = true;
      scene.add(trunk, crown);
    }

    const pixelArt = cfg.style === "pixel";
    const casual = (seed: number, shirt?: number) => {
      const rr = rng(seed);
      const pick = <T,>(a: T[]) => a[Math.floor(rr() * a.length)];
      return new PixelPlayer({
        skin: pick([0x5c3a21, 0x8d5524, 0xa0673a, 0xc68642, 0xe0ac69, 0xf1c27d]),
        hair: pick(["short", "buzz", "afro", "bald", "long"]),
        hairColor: pick([0x120c08, 0x3b2314, 0x6b4423, 0xc8a165]),
        shirt: shirt ?? pick([0xe63946, 0x2ec4b6, 0xffd23f, 0x6a4c93, 0xffffff, 0x1d3557, 0xf77f00]),
        shirt2: 0xffffff,
        shorts: pick([0x1d3557, 0x222222, 0x6b705c, 0xdda15e]),
        socks: 0xffffff,
        boots: pick([0x111111, 0xffffff]),
        number: -1,
      }, 1.85);
    };
    const mePix = pixelArt ? new PixelPlayer({ skin: cfg.look.skin, hair: cfg.look.hair, hairColor: cfg.look.hairColor, shirt: cfg.shirt, shirt2: 0xffffff, shorts: 0x1d3557, socks: 0xffffff, boots: 0x111111, number: -1 }, 1.9) : null;
    const me3d = pixelArt ? null : makeHuman(1, { kit: false, shirt: cfg.shirt, pants: 0x1d3557, skin: cfg.look.skin, hair: cfg.look.hair, hairColor: cfg.look.hairColor, female: false });
    const meHolder = mePix ? mePix.group : me3d!.group;
    scene.add(meHolder);
    const pos = new THREE.Vector3(0, 0, 10);
    let heading = Math.PI;
    let phase = 0;

    const fans: Fan[] = [];
    const nFans = Math.max(3, Math.min(14, Math.round(3 + cfg.fame / 8)));
    for (let i = 0; i < nFans; i++) {
      const pix = pixelArt ? casual(500 + i * 13, i % 3 === 0 ? cfg.shirt : undefined) : null;
      const mesh = pixelArt ? null : makeHuman(500 + i * 13, { shirt: i % 3 === 0 ? cfg.shirt : undefined });
      const holder = pix ? pix.group : mesh!.group;
      scene.add(holder);
      const a = r() * Math.PI * 2,
        d = 10 + r() * 18;
      const f: Fan = { mesh, pix, holder, pos: new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d), heading: 0, phase: r() * 6, state: "walk", target: new THREE.Vector3(), bubble: bubbleSprite(r() < 0.5 ? "AUTÓGRAFO!" : "É ELE!!"), t: r() * 6 };
      f.bubble.visible = false;
      scene.add(f.bubble);
      f.target.set((r() - 0.5) * 50, 0, (r() - 0.5) * 50);
      fans.push(f);
    }

    const anim = (f: Fan, ph: number, amount: number, tt: number, dt: number) => {
      if (f.mesh) animateHuman(f.mesh, ph, amount, tt);
      else f.pix!.update(dt, f.heading, amount * 3, camera.position, f.pos);
    };
    let autographs = 0,
      selfies = 0;
    let busy = false;
    let last = performance.now();
    let raf = 0;
    let finished = false;
    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      if (io.done() && !finished) {
        finished = true;
        cancelAnimationFrame(raf);
        removeEventListener("resize", onResize);
        renderer.dispose();
        renderer.domElement.remove();
        resolve({ autographs, selfies });
        return;
      }
      // player
      const mv = new THREE.Vector3(io.moveX(), 0, -io.moveY());
      const amt = Math.min(1, mv.length());
      if (!busy && amt > 0.08) {
        mv.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), camYaw);
        pos.addScaledVector(mv, 4.2 * amt * dt);
        heading = Math.atan2(mv.x, mv.z);
      }
      pos.x = THREE.MathUtils.clamp(pos.x, -28, 28);
      pos.z = THREE.MathUtils.clamp(pos.z, -28, 28);
      if (pos.length() < 5) pos.setLength(5);
      phase += dt * 6.5 * amt;
      if (me3d) {
        animateHuman(me3d, phase, busy ? 0 : amt, t);
        me3d.group.rotation.y = heading;
      } else mePix!.update(dt, heading, busy ? 0 : amt * 4, camera.position, pos);
      meHolder.position.copy(pos);
      // fans
      let nearest: Fan | null = null;
      for (const f of fans) {
        const d = f.pos.distanceTo(pos);
        if (f.state === "walk") {
          if (d < 14 && Math.random() < dt * 0.7) {
            f.state = "approach";
            f.bubble.visible = true;
          }
          const to = f.target.clone().sub(f.pos);
          if (to.length() < 1) f.target.set((Math.random() - 0.5) * 50, 0, (Math.random() - 0.5) * 50);
          to.normalize();
          f.pos.addScaledVector(to, 1.3 * dt);
          f.heading = Math.atan2(to.x, to.z);
          f.phase += dt * 6;
          anim(f, f.phase, 1, t, dt);
        } else if (f.state === "approach") {
          const to = pos.clone().sub(f.pos).setY(0);
          if (to.length() > 1.6) {
            to.normalize();
            f.pos.addScaledVector(to, 2.8 * dt);
            f.heading = Math.atan2(to.x, to.z);
            f.phase += dt * 9;
            anim(f, f.phase, 1.6, t, dt);
          } else {
            f.state = "wait";
          }
        } else if (f.state === "wait") {
          f.heading = Math.atan2(pos.x - f.pos.x, pos.z - f.pos.z);
          anim(f, 0, 0, t, dt);
          if (f.mesh) f.mesh.rArm.rotation.x = -1.2 + Math.sin(t * 8) * 0.3; // waving
          if (d < 2.6 && (!nearest || d < nearest.pos.distanceTo(pos))) nearest = f;
          if (d > 6) f.state = "approach";
        } else {
          // happy fan jumps and walks away
          f.t += dt;
          f.pos.y = Math.abs(Math.sin(f.t * 8)) * 0.3 * Math.max(0, 1 - f.t / 1.5);
          anim(f, 0, 0, t, dt);
          if (f.mesh) f.mesh.lArm.rotation.x = f.mesh.rArm.rotation.x = -2.8;
          if (f.t > 1.6) {
            f.state = "walk";
            f.t = 0;
            f.pos.y = 0;
          }
        }
        f.holder.position.copy(f.pos);
        if (f.mesh) f.holder.rotation.y = f.heading;
        f.bubble.position.set(f.pos.x, 2.5, f.pos.z);
      }
      io.prompt(!!nearest && !busy);
      if (nearest && !busy && pendingAsk) {
        pendingAsk = false;
        busy = true;
        const fan = nearest;
        onFan().then((kind) => {
          busy = false;
          fan.bubble.visible = false;
          if (kind === "sign") autographs++;
          if (kind === "selfie") selfies++;
          fan.state = kind === "skip" ? "walk" : "happy";
          fan.t = 0;
          io.status(`✍️ ${autographs} autógrafos • 📸 ${selfies} selfies`);
        });
      }
      pendingAsk = false;
      // camera follows behind
      const back = new THREE.Vector3(Math.sin(camYaw), 0, Math.cos(camYaw)).multiplyScalar(7);
      camera.position.lerp(pos.clone().add(back).add(new THREE.Vector3(0, 4.2, 0)), Math.min(1, dt * 5));
      camera.lookAt(pos.x, 1.3, pos.z);
      view.render();
    }
    let camYaw = 0;
    let pendingAsk = false;
    (walkCity as unknown as { ask: () => void }).ask = () => (pendingAsk = true);
    raf = requestAnimationFrame(frame);
    io.status("Ande pela praça: os torcedores vão te reconhecer!");
  });
}
