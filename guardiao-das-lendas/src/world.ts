import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { Water } from "three/examples/jsm/objects/Water.js";

// Ilha das Lendas: village, Mata do Curupira (north), Lagoa da Iara (east),
// Ruínas do Boitatá (west) and the Fazenda do Coronel (south).

function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, y: number) {
  const xi = Math.floor(x),
    yi = Math.floor(y);
  const xf = x - xi,
    yf = y - yi;
  const u = xf * xf * (3 - 2 * xf),
    v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi),
    b = hash(xi + 1, yi),
    c = hash(xi, yi + 1),
    d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, y: number, o = 4) {
  let f = 0,
    amp = 0.5,
    fr = 1;
  for (let i = 0; i < o; i++) {
    f += amp * vnoise(x * fr, y * fr);
    fr *= 2.03;
    amp *= 0.5;
  }
  return f;
}
const smooth = (e0: number, e1: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const V = (x: number, z: number) => new THREE.Vector3(x, 0, z);

export const P = {
  village: V(0, 0),
  vovo: V(-7, -3),
  saci: V(13, -8),
  gameleira: V(16, -12),
  forest: V(0, -100),
  torches: [V(-9, -106), V(9, -106), V(0, -91)],
  lake: V(100, 0),
  island: V(100, 0),
  blocks: [V(56, -9), V(56, 9)],
  plates: [V(64, -5), V(64, 5)],
  bridgeFrom: V(68, 0),
  ruins: V(-105, 0),
  ruinsGate: V(-87, 0),
  chests: [V(-76, -15), V(-76, 15)],
  pillars: [V(-113, -8), V(-113, 8), V(-99, -8), V(-99, 8)],
  fazenda: V(0, 106),
  gate: V(0, 80),
  casarao: V(0, 124),
};
export const LAKE_R = 34,
  ISLAND_R = 8;

export function heightAt(x: number, z: number) {
  const r = Math.hypot(x * 0.95, z * 1.0);
  const island = smooth(168, 138, r + (fbm(x * 0.02, z * 0.02) - 0.5) * 26);
  let h = -8 + island * (10 + fbm(x * 0.015 + 7, z * 0.015) * 6);
  // forest is a little higher, with rolling ground
  h += smooth(-40, -80, z) * (2 + fbm(x * 0.05, z * 0.05) * 3);
  const flat = (cx: number, cz: number, rad: number, lvl: number) => {
    const k = smooth(rad + 12, rad, Math.hypot(x - cx, z - cz));
    h = h * (1 - k) + lvl * k;
  };
  flat(0, 0, 24, 3);
  flat(P.forest.x, P.forest.z, 20, 5);
  flat(-95, 0, 30, 3.5);
  flat(0, 106, 30, 2.6);
  // the lake: a bowl below the water line with an island in the middle
  const dl = Math.hypot(x - P.lake.x, z - P.lake.z);
  const kl = smooth(LAKE_R + 8, LAKE_R - 4, dl);
  h = h * (1 - kl) + -3.5 * kl;
  const ki = smooth(ISLAND_R + 3, ISLAND_R - 1, dl);
  h = h * (1 - ki) + 1.4 * ki;
  // paths are slightly worn down
  return h;
}

function detailTex(size = 256, scale = 0.1, contrast = 0.3) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const a = (x / size) * Math.PI * 2,
        b = (y / size) * Math.PI * 2;
      const n = fbm(Math.cos(a) * size * scale * 0.16 + 50 + Math.sin(b) * 3, Math.sin(a) * size * scale * 0.16 + Math.cos(b) * size * scale * 0.16, 5);
      const v = 255 * (1 - contrast + contrast * 2 * n);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.min(255, v);
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function waterNormals(size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const img = g.createImageData(size, size);
  const T = Math.PI * 2;
  const waves = [[1, 0, 1], [0, 1, 1], [1, 1, 0.7], [2, -1, 0.5], [3, 2, 0.35], [-2, 3, 0.3], [5, 1, 0.2], [1, 6, 0.18], [7, -4, 0.12]];
  const H = (x: number, y: number) => waves.reduce((h, [a, b, amp]) => h + amp * Math.sin(T * (a * x + b * y) + a * 1.7 + b * 2.3), 0);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size,
        e = 1 / size;
      const n = new THREE.Vector3(-(H(u + e, v) - H(u - e, v)) * 0.6, -(H(u, v + e) - H(u, v - e)) * 0.6, 1).normalize();
      const i = (y * size + x) * 4;
      img.data[i] = (n.x * 0.5 + 0.5) * 255;
      img.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      img.data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export interface Box {
  x: number;
  z: number;
  hw: number;
  hd: number;
  id?: string; // removable obstacles (gates, bridge blocker)
  off?: boolean;
}
export interface Circ {
  x: number;
  z: number;
  r: number;
}

export interface World {
  scene: THREE.Scene;
  sky: Sky;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  setTime: (k: "dia" | "tarde" | "noite") => void;
  boxes: Box[];
  circs: Circ[];
  torches: { mesh: THREE.Group; fire: THREE.Mesh; light: THREE.PointLight; lit: boolean }[];
  blocks: { mesh: THREE.Mesh; pos: THREE.Vector3; done: boolean }[];
  plates: THREE.Mesh[];
  bridge: THREE.Mesh[];
  bridgeUp: number; // 0..1
  chests: { mesh: THREE.Group; lid: THREE.Mesh; open: boolean }[];
  ruinGate: THREE.Group;
  farmGate: THREE.Group;
  sunDir: THREE.Vector3;
  onBridge: (x: number, z: number) => boolean;
  update: (dt: number, t: number) => void;
}

export function buildWorld(quality: "alta" | "baixa"): World {
  const hi = quality === "alta";
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xbfd8e0, 0.0028);
  const sky = new Sky();
  sky.scale.setScalar(4500);
  scene.add(sky);
  const hemi = new THREE.HemisphereLight(0xd8ecff, 0x5b4a2e, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(hi ? 2048 : 1024, hi ? 2048 : 1024);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -45;
  sc.right = sc.top = 45;
  sc.near = 1;
  sc.far = 400;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const sunDir = new THREE.Vector3();

  // ---------------------------------------------------------------- terrain
  const SIZE = 420,
    SEG = hi ? 210 : 140;
  const tg = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  tg.rotateX(-Math.PI / 2);
  const pos = tg.attributes.position as THREE.BufferAttribute;
  const cols = new Float32Array(pos.count * 3);
  const C = (h: number) => new THREE.Color(h);
  const sand = C(0xdcc596),
    grass = C(0x4f8a2e),
    grass2 = C(0x86a33a),
    forestFloor = C(0x3c5a26),
    dirt = C(0x9a7246),
    red = C(0xa5552e),
    rock = C(0x857e72),
    seabed = C(0x3e5a54);
  const paths: THREE.Vector3[][] = [
    [V(0, -18), V(-3, -50), V(2, -82)],
    [V(18, 0), V(40, 2), V(60, 0)],
    [V(-18, 0), V(-45, -3), V(-70, 0)],
    [V(0, 18), V(2, 50), V(0, 80)],
  ];
  const pathDist = (x: number, z: number) => {
    let best = 1e9;
    for (const p of paths)
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i],
          b = p[i + 1];
        const abx = b.x - a.x,
          abz = b.z - a.z;
        const t = THREE.MathUtils.clamp(((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz), 0, 1);
        best = Math.min(best, Math.hypot(x - a.x - abx * t, z - a.z - abz * t));
      }
    return best;
  };
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const n = fbm(x * 0.07, z * 0.07);
    const e = 1.5;
    const sl = Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
    if (h < -0.8) c.copy(seabed).lerp(sand, smooth(-4, -0.8, h));
    else if (h < 1.0) c.copy(sand);
    else c.copy(grass).lerp(grass2, n);
    if (z < -45 && h > 1) c.lerp(forestFloor, smooth(-45, -70, z) * 0.8);
    // the ruins sit on red earth; the farm on dry dirt
    const dr = Math.hypot(x + 100, z);
    if (h > 1) c.lerp(red, smooth(42, 26, dr) * 0.75);
    const df = Math.hypot(x, z - 106);
    if (h > 1) c.lerp(dirt, smooth(36, 22, df) * 0.6);
    if (h > 1) c.lerp(dirt, smooth(3, 1.2, pathDist(x, z)) * 0.9);
    if (sl > 0.6) c.lerp(rock, smooth(0.6, 1, sl));
    c.multiplyScalar(0.86 + n * 0.28);
    cols.set([c.r, c.g, c.b], i * 3);
  }
  tg.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  tg.computeVertexNormals();
  const det = detailTex(256, 0.12, 0.22);
  det.repeat.set(70, 70);
  const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, map: det, roughness: 0.95 }));
  terrain.receiveShadow = true;
  scene.add(terrain);

  // ---------------------------------------------------------------- water
  const wn = waterNormals();
  let updWater: (dt: number) => void;
  let tintWater: (c: number) => void;
  let sunWater: (v: THREE.Vector3) => void = () => {};
  if (hi) {
    const w = new Water(new THREE.PlaneGeometry(3000, 3000), { textureWidth: 512, textureHeight: 512, waterNormals: wn, sunDirection: new THREE.Vector3(0.3, 0.6, 0.2), sunColor: 0xffffff, waterColor: 0x0e4a55, distortionScale: 2.6, fog: true });
    w.rotation.x = -Math.PI / 2;
    const u = (w.material as THREE.ShaderMaterial).uniforms;
    u.size.value = 3;
    scene.add(w);
    updWater = (dt) => (u.time.value += dt * 0.5);
    tintWater = (c) => u.waterColor.value.set(c);
    sunWater = (v) => u.sunDirection.value.copy(v).normalize();
  } else {
    wn.repeat.set(140, 140);
    const m = new THREE.MeshStandardMaterial({ color: 0x135866, roughness: 0.15, metalness: 0.35, normalMap: wn, normalScale: new THREE.Vector2(0.6, 0.6), transparent: true, opacity: 0.92 });
    const w = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), m);
    w.rotation.x = -Math.PI / 2;
    scene.add(w);
    updWater = (dt) => {
      wn.offset.x += dt * 0.005;
      wn.offset.y += dt * 0.003;
    };
    tintWater = (c) => m.color.set(c);
  }

  // ---------------------------------------------------------------- shared materials and helpers
  const rockTex = detailTex(256, 0.25, 0.45);
  const woodTex = detailTex(128, 0.5, 0.3);
  woodTex.repeat.set(1, 3);
  const M = (color: number, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });
  const stone = M(0x8a8173, { map: rockTex, flatShading: true });
  const mossStone = M(0x6f7a5c, { map: rockTex, flatShading: true });
  const wood = M(0x6b4a2e, { map: woodTex });
  const darkWood = M(0x3d2a1a, { map: woodTex });
  const boxes: Box[] = [];
  const circs: Circ[] = [];
  const add = (m: THREE.Object3D, shadow = true) => {
    m.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = shadow;
        o.receiveShadow = true;
      }
    });
    scene.add(m);
    return m;
  };
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    return o;
  };
  const rand = (() => {
    let s = 987654;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  })();

  // ---------------------------------------------------------------- village
  const house = (x: number, z: number, w: number, d: number, wall: number, roofC: number, ry: number) => {
    const g = new THREE.Group();
    const y0 = heightAt(x, z);
    g.add(mesh(new THREE.BoxGeometry(w, 3, d), M(wall, { map: detailTex(128, 0.3, 0.15) }), 0, 1.5, 0));
    // thatched/tiled roof as a four-sided pyramid
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, 2.4, 4, 1), M(roofC, { map: detailTex(128, 0.7, 0.4) }));
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
    roof.position.y = 4.2;
    g.add(roof);
    g.add(mesh(new THREE.BoxGeometry(1, 2, 0.1), darkWood, 0, 1, d / 2 + 0.05));
    for (const sx of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.8, 0.8, 0.08), M(0x2e6f6a), sx * (w / 2 - 0.9), 1.8, d / 2 + 0.05));
    g.position.set(x, y0, z);
    g.rotation.y = ry;
    add(g);
    boxes.push({ x, z, hw: (Math.abs(Math.cos(ry)) > 0.5 ? w : d) / 2 + 0.2, hd: (Math.abs(Math.cos(ry)) > 0.5 ? d : w) / 2 + 0.2 });
  };
  house(-9, -9, 6, 5, 0xf0e1c0, 0x9c5a32, 0); // Vovó Benedita
  house(-14, 8, 5, 5, 0xe8b6a0, 0x8a6a3a, Math.PI / 2);
  house(9, 10, 6, 5, 0xbfd8c8, 0xa04a2a, Math.PI);
  house(-2, 17, 5, 4, 0xf4d58d, 0x7a5a30, Math.PI);
  // the giant gameleira tree where the Saci lives
  {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.4, 9, 10, 4), M(0x6a5038, { map: woodTex }));
    trunk.position.y = 4.5;
    g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const root = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.6, 4, 6), trunk.material);
      const a = (i / 6) * Math.PI * 2;
      root.position.set(Math.cos(a) * 2, 0.8, Math.sin(a) * 2);
      root.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
      g.add(root);
    }
    for (let i = 0; i < 9; i++) {
      const bl = new THREE.Mesh(new THREE.IcosahedronGeometry(3.4 + rand() * 1.6, 1), M(0x3f7a2a, { flatShading: true }));
      bl.position.set((rand() - 0.5) * 9, 10 + rand() * 4, (rand() - 0.5) * 9);
      g.add(bl);
    }
    g.position.set(P.gameleira.x, heightAt(P.gameleira.x, P.gameleira.z) - 0.2, P.gameleira.z);
    add(g);
    circs.push({ x: P.gameleira.x, z: P.gameleira.z, r: 2.6 });
  }
  // well in the middle of the village
  {
    const wl = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 1, 14, 1, true), stone);
    wl.position.set(0, heightAt(0, 0) + 0.5, 0);
    (wl.material as THREE.Material).side = THREE.DoubleSide;
    add(wl);
    circs.push({ x: 0, z: 0, r: 1.4 });
  }

  // ---------------------------------------------------------------- vegetation
  const zoneClear = (x: number, z: number) =>
    Math.hypot(x, z) < 26 || Math.hypot(x - P.forest.x, z - P.forest.z) < 22 || Math.hypot(x - P.lake.x, z - P.lake.z) < LAKE_R + 6 || Math.hypot(x + 100, z) < 34 || Math.hypot(x, z - 106) < 34 || pathDist(x, z) < 4;
  const nTree = hi ? 520 : 260;
  const trunkG = new THREE.CylinderGeometry(0.18, 0.32, 1, 6);
  const crownG = new THREE.IcosahedronGeometry(1, 1);
  const trunks = new THREE.InstancedMesh(trunkG, M(0x5a4030), nTree);
  const crowns = new THREE.InstancedMesh(crownG, M(0xffffff, { flatShading: true }), nTree * 2);
  const m4 = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    sv = new THREE.Vector3(),
    pv = new THREE.Vector3();
  let nT = 0;
  for (let k = 0; k < 9000 && nT < nTree; k++) {
    const x = (rand() - 0.5) * 300,
      z = (rand() - 0.5) * 300;
    const h = heightAt(x, z);
    if (h < 1.2 || zoneClear(x, z)) continue;
    const dense = z < -40 ? 1 : 0.35;
    if (rand() > dense) continue;
    const H = 5 + rand() * 7;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6);
    trunks.setMatrixAt(nT, m4.compose(pv.set(x, h + H * 0.3, z), q, sv.set(1, H * 0.6, 1)));
    for (let j = 0; j < 2; j++) {
      const r = (2 + rand() * 1.6) * (j ? 0.75 : 1);
      crowns.setMatrixAt(nT * 2 + j, m4.compose(pv.set(x + (rand() - 0.5), h + H * (0.62 + j * 0.22), z + (rand() - 0.5)), q, sv.set(r, r * 0.8, r)));
      crowns.setColorAt(nT * 2 + j, new THREE.Color().setHSL(0.24 + rand() * 0.08, 0.5, 0.2 + rand() * 0.1));
    }
    circs.push({ x, z, r: 0.5 });
    nT++;
  }
  trunks.count = nT;
  crowns.count = nT * 2;
  trunks.castShadow = crowns.castShadow = true;
  crowns.receiveShadow = true;
  scene.add(trunks, crowns);
  // palms along the shore
  const leafG = new THREE.PlaneGeometry(0.7, 3.4, 1, 4);
  leafG.translate(0, 1.7, 0);
  {
    const p = leafG.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setZ(i, -Math.pow(p.getY(i) / 3.4, 2) * 1.5);
    leafG.computeVertexNormals();
  }
  const leafM = M(0x4f8a2e, { side: THREE.DoubleSide });
  const palmTrunk = M(0x7a6248, { map: woodTex });
  let np = 0;
  for (let k = 0; k < 4000 && np < (hi ? 60 : 30); k++) {
    const x = (rand() - 0.5) * 320,
      z = (rand() - 0.5) * 320;
    const h = heightAt(x, z);
    if (h < 0.9 || h > 3 || zoneClear(x, z)) continue;
    const g = new THREE.Group();
    const H = 5 + rand() * 3;
    g.add(mesh(new THREE.CylinderGeometry(0.15, 0.24, H, 7), palmTrunk, 0, H / 2, 0));
    for (let i = 0; i < 8; i++) {
      const lf = new THREE.Mesh(leafG, leafM);
      lf.position.y = H;
      lf.rotation.set(-1.1 - rand() * 0.4, (i / 8) * Math.PI * 2, 0, "YXZ");
      g.add(lf);
    }
    g.rotation.z = (rand() - 0.5) * 0.4;
    g.position.set(x, h - 0.2, z);
    add(g);
    circs.push({ x, z, r: 0.4 });
    np++;
  }
  // grass and flowers
  const nG = hi ? 9000 : 2600;
  const bladeG = new THREE.ConeGeometry(0.07, 0.6, 3);
  bladeG.translate(0, 0.3, 0);
  const grassI = new THREE.InstancedMesh(bladeG, M(0xffffff), nG);
  let gN = 0;
  for (let k = 0; k < nG * 4 && gN < nG; k++) {
    const x = (rand() - 0.5) * 300,
      z = (rand() - 0.5) * 300;
    const h = heightAt(x, z);
    if (h < 1.3 || pathDist(x, z) < 1.8 || Math.hypot(x + 100, z) < 26) continue;
    q.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.5, rand() * 6, (rand() - 0.5) * 0.5));
    const s = 0.6 + rand();
    grassI.setMatrixAt(gN, m4.compose(pv.set(x, h - 0.05, z), q, sv.set(s, s, s)));
    const flower = rand() < 0.04;
    grassI.setColorAt(gN, flower ? new THREE.Color().setHSL([0, 0.12, 0.8, 0.95][Math.floor(rand() * 4)], 0.8, 0.6) : new THREE.Color().setHSL(0.22 + rand() * 0.08, 0.5, 0.28 + rand() * 0.12));
    gN++;
  }
  grassI.count = gN;
  scene.add(grassI);

  // ---------------------------------------------------------------- Mata do Curupira: three sacred torches
  const torches: World["torches"] = [];
  for (const tp of P.torches) {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.18, 0.25, 2.2, 8), darkWood, 0, 1.1, 0));
    const bowl = mesh(new THREE.CylinderGeometry(0.5, 0.3, 0.4, 10), stone, 0, 2.3, 0);
    g.add(bowl);
    // carved feathers
    for (let i = 0; i < 3; i++) {
      const f = mesh(new THREE.ConeGeometry(0.12, 0.7, 4), M([0xd62828, 0xffd23f, 0x2a9d8f][i]), Math.cos(i * 2.1) * 0.35, 1.8, Math.sin(i * 2.1) * 0.35);
      f.rotation.z = Math.cos(i * 2.1) * 0.6;
      g.add(f);
    }
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.1, 8), new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.9 }));
    fire.position.y = 2.9;
    fire.visible = false;
    g.add(fire);
    const light = new THREE.PointLight(0xff9a40, 0, 14, 1.6);
    light.position.y = 3;
    g.add(light);
    g.position.set(tp.x, heightAt(tp.x, tp.z), tp.z);
    add(g);
    circs.push({ x: tp.x, z: tp.z, r: 0.5 });
    torches.push({ mesh: g, fire, light, lit: false });
  }
  // ring of carved stones around the clearing
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const x = P.forest.x + Math.cos(a) * 19,
      z = P.forest.z + Math.sin(a) * 19;
    if (Math.abs(Math.sin(a) - 1) < 0.15) continue; // opening toward the village (south, +z)
    const s = mesh(new THREE.BoxGeometry(1.2, 2.4 + rand(), 0.8), mossStone, x, heightAt(x, z) + 1.1, z);
    s.rotation.y = -a;
    add(s);
    circs.push({ x, z, r: 0.8 });
  }

  // ---------------------------------------------------------------- Lagoa da Iara: blocks, plates, rising bridge
  const blocks: World["blocks"] = P.blocks.map((b) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), mossStone);
    m.position.set(b.x, heightAt(b.x, b.z) + 0.9, b.z);
    add(m);
    return { mesh: m, pos: b.clone(), done: false };
  });
  const plates = P.plates.map((p) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.16, 20), M(0x5c6b73, { emissive: 0x1aa6b7, emissiveIntensity: 0.15 }));
    m.position.set(p.x, heightAt(p.x, p.z) + 0.08, p.z);
    add(m, false);
    // carved spiral symbol
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.06, 6, 24), M(0x1aa6b7, { emissive: 0x1aa6b7, emissiveIntensity: 0.6 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(p.x, heightAt(p.x, p.z) + 0.18, p.z);
    scene.add(ring);
    return m;
  });
  const bridge: THREE.Mesh[] = [];
  const BR_N = 9;
  for (let i = 0; i < BR_N; i++) {
    const x = P.bridgeFrom.x + i * ((P.island.x - ISLAND_R + 1 - P.bridgeFrom.x) / (BR_N - 1));
    const s = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.6, 3.2), stone);
    s.position.set(x, -2, 0);
    s.rotation.y = (rand() - 0.5) * 0.15;
    add(s);
    bridge.push(s);
  }
  const onBridge = (x: number, z: number) => x > P.bridgeFrom.x - 2 && x < P.island.x - ISLAND_R + 2 && Math.abs(z) < 1.6;
  // lily pads and reeds on the lake
  for (let i = 0; i < 40; i++) {
    const a = rand() * Math.PI * 2,
      r = ISLAND_R + 4 + rand() * (LAKE_R - ISLAND_R - 6);
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.5 + rand() * 0.5, 10), M(0x3f8a3a, { side: THREE.DoubleSide }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(P.lake.x + Math.cos(a) * r, 0.03, P.lake.z + Math.sin(a) * r);
    scene.add(pad);
  }
  // shrine on the island
  {
    const g = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.add(mesh(new THREE.CylinderGeometry(0.3, 0.35, 3, 8), stone, Math.cos(a) * 5, 1.5, Math.sin(a) * 5));
    }
    g.position.set(P.island.x, 1.4, P.island.z);
    add(g);
  }

  // ---------------------------------------------------------------- Ruínas do Boitatá
  const ruinGate = new THREE.Group();
  {
    const cx = P.ruins.x,
      cz = P.ruins.z;
    const y0 = heightAt(cx, cz);
    const wall = (x: number, z: number, w: number, d: number, h = 4) => {
      const m = mesh(new THREE.BoxGeometry(w, h, d), stone, x, y0 + h / 2 - 0.3, z);
      add(m);
      boxes.push({ x, z, hw: w / 2, hd: d / 2 });
      // broken top
      for (let i = 0; i < Math.max(w, d) / 3; i++) {
        const c2 = mesh(new THREE.BoxGeometry(1.2, 0.6 + rand(), 1.2), stone, x + (w > d ? (i - Math.max(w, d) / 6) * 3 : 0), y0 + h + 0.1, z + (d > w ? (i - Math.max(w, d) / 6) * 3 : 0));
        if (rand() < 0.6) add(c2);
      }
    };
    wall(cx, cz - 18, 36, 1.6);
    wall(cx, cz + 18, 36, 1.6);
    wall(cx - 18, cz, 1.6, 36);
    wall(cx + 18, cz - 11, 1.6, 14);
    wall(cx + 18, cz + 11, 1.6, 14);
    // gate with two locks
    const door = mesh(new THREE.BoxGeometry(0.5, 4, 8), M(0x4a3020, { map: woodTex }), 0, 2, 0);
    ruinGate.add(door);
    for (const sz of [-1.6, 1.6]) ruinGate.add(mesh(new THREE.BoxGeometry(0.3, 0.7, 0.6), M(0xc9a227, { metalness: 1, roughness: 0.3 }), 0.4, 2, sz));
    ruinGate.position.set(P.ruinsGate.x, y0 - 0.3, P.ruinsGate.z);
    add(ruinGate);
    boxes.push({ x: P.ruinsGate.x, z: P.ruinsGate.z, hw: 0.6, hd: 4, id: "ruinGate" });
    // the four pillars the Boitatá crashes into
    for (const p of P.pillars) {
      const m = mesh(new THREE.CylinderGeometry(1.1, 1.3, 6, 10), stone, p.x, y0 + 2.8, p.z);
      add(m);
      // carved serpent band
      const band = mesh(new THREE.TorusGeometry(1.2, 0.12, 6, 20), M(0xc96a2a, { emissive: 0x7a2a0a, emissiveIntensity: 0.5 }), p.x, y0 + 3.6, p.z);
      band.rotation.x = Math.PI / 2;
      scene.add(band);
      circs.push({ x: p.x, z: p.z, r: 1.3 });
    }
    // fire bowls at the gate
    for (const sz of [-6, 6]) add(mesh(new THREE.CylinderGeometry(0.6, 0.4, 1.4, 10), stone, P.ruinsGate.x + 2, y0 + 0.5, sz));
  }
  const chests: World["chests"] = P.chests.map((cp) => {
    const g = new THREE.Group();
    const base = mesh(new THREE.BoxGeometry(1.4, 0.8, 0.9), M(0x7a4a22, { map: woodTex }), 0, 0.4, 0);
    const lid = mesh(new THREE.BoxGeometry(1.45, 0.3, 0.95), M(0x8a5a2a, { map: woodTex }), 0, 0.95, 0);
    const band = mesh(new THREE.BoxGeometry(1.5, 0.12, 0.1), M(0xc9a227, { metalness: 1, roughness: 0.3 }), 0, 0.8, 0.46);
    g.add(base, lid, band);
    g.position.set(cp.x, heightAt(cp.x, cp.z), cp.z);
    g.rotation.y = -Math.PI / 2;
    add(g);
    boxes.push({ x: cp.x, z: cp.z, hw: 0.6, hd: 0.8 });
    // little ruined walls around each chest
    for (const s of [-1, 1]) {
      const w = mesh(new THREE.BoxGeometry(6, 2, 0.8), stone, cp.x + 2, heightAt(cp.x, cp.z) + 0.8, cp.z + s * 3.2);
      add(w);
      boxes.push({ x: cp.x + 2, z: cp.z + s * 3.2, hw: 3, hd: 0.4 });
    }
    return { mesh: g, lid, open: false };
  });

  // ---------------------------------------------------------------- Fazenda do Coronel
  const farmGate = new THREE.Group();
  {
    const cx = P.fazenda.x,
      cz = P.fazenda.z;
    const R = 26;
    // fence posts and rails in a ring, open at the gate (north)
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const x = cx + Math.cos(a) * R,
        z = cz + Math.sin(a) * R;
      if (Math.abs(x - P.gate.x) < 4 && z < cz) continue;
      const y = heightAt(x, z);
      const post = mesh(new THREE.BoxGeometry(0.2, 1.8, 0.2), wood, x, y + 0.9, z);
      add(post);
      const a2 = ((i + 1) / 64) * Math.PI * 2;
      const x2 = cx + Math.cos(a2) * R,
        z2 = cz + Math.sin(a2) * R;
      if (Math.abs(x2 - P.gate.x) < 4 && z2 < cz) continue;
      const len = Math.hypot(x2 - x, z2 - z);
      for (const hy of [0.6, 1.3]) {
        const rail = mesh(new THREE.BoxGeometry(len, 0.12, 0.08), wood, (x + x2) / 2, y + hy, (z + z2) / 2);
        rail.rotation.y = -Math.atan2(z2 - z, x2 - x);
        add(rail);
      }
      circs.push({ x, z, r: 1.0 });
    }
    // porteira (gate)
    for (const s of [-1, 1]) {
      const leaf = new THREE.Group();
      for (let k = 0; k < 4; k++) leaf.add(mesh(new THREE.BoxGeometry(3.6, 0.14, 0.1), M(0xd8c8a0, { map: woodTex }), s * 1.8, 0.4 + k * 0.4, 0));
      const diag = mesh(new THREE.BoxGeometry(4, 0.14, 0.1), M(0xd8c8a0), s * 1.8, 1, 0);
      diag.rotation.z = s * 0.38;
      leaf.add(diag);
      leaf.position.x = -s * 3.8;
      leaf.name = s < 0 ? "L" : "R";
      farmGate.add(leaf);
    }
    farmGate.position.set(P.gate.x, heightAt(P.gate.x, P.gate.z), P.gate.z);
    add(farmGate);
    boxes.push({ x: P.gate.x, z: P.gate.z, hw: 4, hd: 0.5, id: "farmGate" });
    // casarão (big farm house) with columns
    const y0 = heightAt(P.casarao.x, P.casarao.z);
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(18, 6, 8), M(0xf3ead8, { map: detailTex(128, 0.3, 0.12) }), 0, 3, 0));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(12, 3.4, 4), M(0x8a3a1e, { map: detailTex(128, 0.7, 0.4) }));
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.1, 1, 0.55);
    roof.position.y = 7.6;
    g.add(roof);
    for (let i = 0; i < 6; i++) g.add(mesh(new THREE.CylinderGeometry(0.28, 0.3, 5, 10), M(0xffffff), -7.5 + i * 3, 2.5, -4.8));
    g.add(mesh(new THREE.BoxGeometry(18, 0.3, 2.4), M(0xd9c9a8), 0, 5.1, -4.8));
    for (let i = 0; i < 5; i++) g.add(mesh(new THREE.BoxGeometry(1.2, 2, 0.1), M(0x2e5a7a), -6 + i * 3, 3, -4.05));
    g.position.set(P.casarao.x, y0, P.casarao.z);
    add(g);
    boxes.push({ x: P.casarao.x, z: P.casarao.z, hw: 9.2, hd: 4.6 });
    // cut tree stumps around the farm (what the Coronel did to the forest)
    for (let i = 0; i < 26; i++) {
      const a = rand() * Math.PI * 2,
        r = 30 + rand() * 22;
      const x = cx + Math.cos(a) * r,
        z = cz + Math.sin(a) * r;
      if (heightAt(x, z) < 1) continue;
      add(mesh(new THREE.CylinderGeometry(0.45, 0.6, 0.6, 9), M(0x8a6a48, { map: woodTex }), x, heightAt(x, z) + 0.2, z));
    }
  }

  // ---------------------------------------------------------------- time of day
  function setTime(k: "dia" | "tarde" | "noite") {
    const u = sky.material.uniforms;
    const cfg = {
      dia: { el: 48, az: 150, turb: 6, ray: 1.6, sun: 2.8, sunC: 0xfff0d6, hemi: 0.95, fog: 0xc4dce4, dens: 0.0026, sea: 0x0e4a55 },
      tarde: { el: 9, az: 250, turb: 9, ray: 2.6, sun: 2.3, sunC: 0xffb070, hemi: 0.7, fog: 0xd6b8a0, dens: 0.003, sea: 0x0c3a48 },
      noite: { el: -5, az: 250, turb: 14, ray: 0.7, sun: 0.35, sunC: 0x7f8fff, hemi: 0.45, fog: 0x232840, dens: 0.0045, sea: 0x071a26 },
    }[k];
    sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - cfg.el), THREE.MathUtils.degToRad(cfg.az));
    u.sunPosition.value.copy(sunDir);
    u.turbidity.value = cfg.turb;
    u.rayleigh.value = cfg.ray;
    u.mieCoefficient.value = 0.005;
    u.mieDirectionalG.value = 0.82;
    sun.intensity = cfg.sun;
    sun.color.set(cfg.sunC);
    hemi.intensity = cfg.hemi;
    (scene.fog as THREE.FogExp2).color.set(cfg.fog);
    (scene.fog as THREE.FogExp2).density = cfg.dens;
    tintWater(cfg.sea);
    sunWater(sunDir.clone().setY(Math.max(0.05, sunDir.y)));
    if (k === "noite") {
      sunDir.set(-0.4, 0.8, 0.3).normalize(); // moonlight from above for shadows
    }
  }
  setTime("dia");

  const W: World = {
    scene,
    sky,
    sun,
    hemi,
    setTime,
    boxes,
    circs,
    torches,
    blocks,
    plates,
    bridge,
    bridgeUp: 0,
    chests,
    ruinGate,
    farmGate,
    sunDir,
    onBridge,
    update: (dt: number, t: number) => {
      updWater(dt);
      for (const tc of torches)
        if (tc.lit) {
          tc.fire.scale.set(1 + Math.sin(t * 13) * 0.1, 1 + Math.sin(t * 17) * 0.18, 1 + Math.cos(t * 11) * 0.1);
          tc.light.intensity = 26 + Math.sin(t * 20) * 4;
        }
      for (let i = 0; i < bridge.length; i++) {
        const k = THREE.MathUtils.clamp(W.bridgeUp * bridge.length - i * 0.6, 0, 1);
        bridge[i].position.y = -2 + k * 2.45;
      }
    },
  };
  return W;
}
