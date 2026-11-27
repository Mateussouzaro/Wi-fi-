import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { Water } from "three/examples/jsm/objects/Water.js";

// Ilha da Bruma: terrain, sea, sky, village, port, cave and the lighthouse.

// ------------------------------------------------------------------ noise
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

// ------------------------------------------------------------------ places
export const P = {
  dockStart: new THREE.Vector3(4, 0, 92),
  dockEnd: new THREE.Vector3(4, 0, 128),
  house: new THREE.Vector3(-34, 0, 38), // grandfather's house (door faces +z)
  houseDoor: new THREE.Vector3(-34, 0, 43.2),
  shed: new THREE.Vector3(24, 0, 84),
  shedDoor: new THREE.Vector3(24, 0, 78.6),
  oldBoat: new THREE.Vector3(-14, 0, 99),
  cave: new THREE.Vector3(22, 0, -40), // cave entrance
  caveIn: new THREE.Vector3(22, 0, -50),
  generator: new THREE.Vector3(19.5, 0, -53.2),
  grandpa: new THREE.Vector3(25, 0, -52.5),
  light: new THREE.Vector3(42, 0, -72), // lighthouse base
  lightDoor: new THREE.Vector3(42, 0, -66.6),
  bento: new THREE.Vector3(-6, 0, 96),
};
const TOWER_H = 19;

export function heightAt(x: number, z: number) {
  const r = Math.hypot(x * 0.92, z * 1.08);
  const island = smooth(132, 82, r + (fbm(x * 0.02, z * 0.02) - 0.5) * 30);
  let h = -9 + island * (11 + fbm(x * 0.012 + 3, z * 0.012) * 12);
  // the lighthouse hill
  h += 21 * Math.exp(-((x - 42) ** 2 + (z + 70) ** 2) / (2 * 30 * 30));
  // flat village and port terraces
  const flat = (cx: number, cz: number, rad: number, lvl: number) => {
    const k = smooth(rad + 10, rad, Math.hypot(x - cx, z - cz));
    h = h * (1 - k) + lvl * k;
  };
  flat(-30, 42, 18, 4.2);
  flat(22, 82, 12, 1.6);
  flat(P.light.x, P.light.z, 8, h > 0 ? 0 : 0); // keeps the shape; replaced below
  // lighthouse platform
  const kp = smooth(12, 7, Math.hypot(x - P.light.x, z - P.light.z));
  h = h * (1 - kp) + 24 * kp;
  // cave mouth notch
  const kc = smooth(9, 4, Math.hypot(x - P.cave.x, z - P.cave.z - 2));
  h = h * (1 - kc) + Math.min(h, 7.5) * kc;
  return h;
}

// tileable normal map for the sea, built from summed waves
function waterNormals(size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const img = g.createImageData(size, size);
  const H = (x: number, y: number) => {
    let h = 0;
    const T = Math.PI * 2;
    const waves = [
      [1, 0, 1], [0, 1, 1], [1, 1, 0.7], [2, -1, 0.5], [3, 2, 0.35], [-2, 3, 0.3], [5, 1, 0.2], [1, 6, 0.18], [7, -4, 0.12], [-6, -5, 0.1], [9, 8, 0.07],
    ];
    for (const [a, b, amp] of waves) h += amp * Math.sin(T * (a * x + b * y) + a * 1.7 + b * 2.3);
    return h;
  };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size,
        e = 1 / size;
      const dx = (H(u + e, v) - H(u - e, v)) * 0.6,
        dy = (H(u, v + e) - H(u, v - e)) * 0.6;
      const n = new THREE.Vector3(-dx, -dy, 1).normalize();
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

// grey detail texture that breaks up flat colours on terrain, rock and wood
function detailTex(size = 256, scale = 0.08, contrast = 0.35) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      // tileable by sampling a torus
      const a = (x / size) * Math.PI * 2,
        b = (y / size) * Math.PI * 2;
      const n = fbm(Math.cos(a) * size * scale * 0.16 + 50, Math.sin(a) * size * scale * 0.16 + Math.cos(b) * size * scale * 0.16 + 30, 5);
      const v = 255 * (1 - contrast + contrast * 2 * n);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.min(255, v);
      img.data[i + 3] = 255;
      void b;
    }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface Collider {
  x: number;
  z: number;
  hw: number; // half extents (axis aligned)
  hd: number;
}

export interface World {
  scene: THREE.Scene;
  sky: Sky;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  water: { update: (dt: number) => void; setSun: (v: THREE.Vector3) => void; mesh: THREE.Object3D; tint: (c: number) => void };
  colliders: Collider[];
  windows: THREE.MeshStandardMaterial[];
  lamp: { glass: THREE.MeshStandardMaterial; beam: THREE.Group; light: THREE.SpotLight; on: boolean; top: number };
  caveLights: THREE.PointLight[];
  genMesh: THREE.Group;
  fuel: THREE.Object3D;
  fuse: THREE.Object3D;
  key: THREE.Object3D;
  radio: THREE.Object3D;
  boat: THREE.Group; // Bento's boat for the arrival
  fishing: THREE.Group; // Caio's boat out at sea
  pierZone: (x: number, z: number) => boolean;
  inCave: (x: number, z: number) => boolean;
  update: (dt: number, t: number) => void;
}

export function buildWorld(quality: "alta" | "baixa"): World {
  const hi = quality === "alta";
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x9fb3c0, 0.0045);

  // ---------------------------------------------------------------- sky + light
  const sky = new Sky();
  sky.scale.setScalar(4500);
  const su = sky.material.uniforms;
  su.turbidity.value = 8;
  su.rayleigh.value = 2.2;
  su.mieCoefficient.value = 0.006;
  su.mieDirectionalG.value = 0.85;
  scene.add(sky);
  const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x5a4a32, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2b8, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(hi ? 2048 : 1024, hi ? 2048 : 1024);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -60;
  sc.right = sc.top = 60;
  sc.near = 1;
  sc.far = 400;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  // ---------------------------------------------------------------- terrain
  const SIZE = 380,
    SEG = hi ? 200 : 130;
  const tg = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  tg.rotateX(-Math.PI / 2);
  const pos = tg.attributes.position as THREE.BufferAttribute;
  const cols = new Float32Array(pos.count * 3);
  const sand = new THREE.Color(0xd6c29a),
    wetSand = new THREE.Color(0x9c8a68),
    grass = new THREE.Color(0x5d7f3a),
    grass2 = new THREE.Color(0x7c8f45),
    rock = new THREE.Color(0x7d776e),
    dirt = new THREE.Color(0x8a6c4a),
    seabed = new THREE.Color(0x4d5a52);
  const tmpC = new THREE.Color();
  // dirt paths between places
  const paths: THREE.Vector3[][] = [
    [P.dockStart, new THREE.Vector3(-4, 0, 78), new THREE.Vector3(-20, 0, 58), P.houseDoor],
    [new THREE.Vector3(-4, 0, 78), new THREE.Vector3(16, 0, 80), P.shedDoor],
    [new THREE.Vector3(-20, 0, 58), new THREE.Vector3(-6, 0, 20), new THREE.Vector3(10, 0, -18), P.cave],
    [new THREE.Vector3(10, 0, -18), new THREE.Vector3(30, 0, -30), new THREE.Vector3(46, 0, -48), P.lightDoor],
  ];
  const segDist = (x: number, z: number) => {
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
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    // slope from neighbours
    const e = 1.5;
    const sl = Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
    const n = fbm(x * 0.08, z * 0.08);
    if (h < -0.6) tmpC.copy(seabed).lerp(wetSand, smooth(-5, -0.6, h));
    else if (h < 0.4) tmpC.copy(wetSand);
    else if (h < 2.2) tmpC.copy(sand).lerp(grass, smooth(1.4, 2.2, h + n * 0.8));
    else tmpC.copy(grass).lerp(grass2, n);
    if (h > 1 && sl > 0.55) tmpC.lerp(rock, smooth(0.55, 0.9, sl));
    if (h > 0.8) tmpC.lerp(dirt, smooth(2.6, 1.2, segDist(x, z)) * 0.85);
    tmpC.multiplyScalar(0.85 + n * 0.3);
    cols[i * 3] = tmpC.r;
    cols[i * 3 + 1] = tmpC.g;
    cols[i * 3 + 2] = tmpC.b;
  }
  tg.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  tg.computeVertexNormals();
  const det = detailTex(256, 0.12, 0.22);
  det.repeat.set(60, 60);
  const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, map: det, roughness: 0.95 }));
  terrain.receiveShadow = true;
  scene.add(terrain);

  // ---------------------------------------------------------------- sea
  let water: World["water"];
  const wn = waterNormals(256);
  if (hi) {
    const w = new Water(new THREE.PlaneGeometry(3000, 3000), {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: wn,
      sunDirection: new THREE.Vector3(0.3, 0.5, 0.2),
      sunColor: 0xffffff,
      waterColor: 0x0b3346,
      distortionScale: 3.2,
      fog: true,
    });
    w.rotation.x = -Math.PI / 2;
    w.position.y = 0;
    (w.material as THREE.ShaderMaterial).uniforms.size.value = 3.5;
    scene.add(w);
    water = {
      mesh: w,
      update: (dt) => ((w.material as THREE.ShaderMaterial).uniforms.time.value += dt * 0.6),
      setSun: (v) => (w.material as THREE.ShaderMaterial).uniforms.sunDirection.value.copy(v).normalize(),
      tint: (c) => (w.material as THREE.ShaderMaterial).uniforms.waterColor.value.set(c),
    };
  } else {
    wn.repeat.set(120, 120);
    const m = new THREE.MeshStandardMaterial({ color: 0x0f3c52, roughness: 0.18, metalness: 0.3, normalMap: wn, normalScale: new THREE.Vector2(0.6, 0.6), transparent: true, opacity: 0.94 });
    const w = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), m);
    w.rotation.x = -Math.PI / 2;
    scene.add(w);
    water = {
      mesh: w,
      update: (dt) => {
        wn.offset.x += dt * 0.004;
        wn.offset.y += dt * 0.0025;
      },
      setSun: () => {},
      tint: (c) => m.color.set(c),
    };
  }
  // surf foam ring along the shore
  {
    const foamG = new THREE.RingGeometry(1, 1, 1, 1);
    void foamG;
  }

  // ---------------------------------------------------------------- materials
  const rockTex = detailTex(256, 0.25, 0.45);
  const woodTex = detailTex(128, 0.5, 0.3);
  woodTex.repeat.set(1, 4);
  const plaster = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, map: detailTex(128, 0.3, 0.15) });
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.85, map: woodTex });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x3d2a1a, roughness: 0.9, map: woodTex });
  const roofTile = new THREE.MeshStandardMaterial({ color: 0x9a4a2a, roughness: 0.8, map: detailTex(128, 0.6, 0.35) });
  const tin = new THREE.MeshStandardMaterial({ color: 0x7d858c, roughness: 0.5, metalness: 0.6 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6f6a62, roughness: 0.95, map: rockTex, flatShading: true });
  const colliders: Collider[] = [];
  const windows: THREE.MeshStandardMaterial[] = [];
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, ry = 0, shadow = true) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    b.rotation.y = ry;
    b.castShadow = shadow;
    b.receiveShadow = true;
    scene.add(b);
    return b;
  };

  // ---------------------------------------------------------------- houses
  const house = (x: number, z: number, w: number, d: number, wallC: number, ry = 0, lit = true) => {
    const g = new THREE.Group();
    const y0 = heightAt(x, z);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 3.2, d), plaster(wallC));
    wall.position.y = 1.6;
    wall.castShadow = wall.receiveShadow = true;
    // pitched roof from an extruded triangle
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2 - 0.4, 0);
    sh.lineTo(w / 2 + 0.4, 0);
    sh.lineTo(0, 1.8);
    sh.lineTo(-w / 2 - 0.4, 0);
    const rg = new THREE.ExtrudeGeometry(sh, { depth: d + 0.8, bevelEnabled: false });
    rg.translate(0, 0, -(d + 0.8) / 2);
    const roof = new THREE.Mesh(rg, roofTile);
    roof.position.y = 3.2;
    roof.castShadow = true;
    const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.6, d + 0.3), rockMat);
    base.position.y = 0;
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.1, 0.08), darkWood);
    door.position.set(0, 1.05, d / 2 + 0.03);
    g.add(wall, roof, base, door);
    const winM = new THREE.MeshStandardMaterial({ color: 0x1c232b, emissive: 0xffb050, emissiveIntensity: 0, roughness: 0.2, metalness: 0.4 });
    if (lit) windows.push(winM);
    for (const sx of [-1, 1]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.06), winM);
      win.position.set(sx * (w / 2 - 1.1), 1.8, d / 2 + 0.03);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 0.04), plaster(0xf2efe6));
      frame.position.set(win.position.x, 1.8, d / 2 + 0.01);
      const shut = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.0, 0.05), new THREE.MeshStandardMaterial({ color: 0x2e6f6a, roughness: 0.8 }));
      shut.position.set(win.position.x - 0.75, 1.8, d / 2 + 0.05);
      g.add(frame, win, shut);
    }
    g.position.set(x, y0, z);
    g.rotation.y = ry;
    scene.add(g);
    const c = Math.abs(Math.cos(ry)) > 0.5;
    colliders.push({ x, z, hw: (c ? w : d) / 2 + 0.3, hd: (c ? d : w) / 2 + 0.3 });
    return g;
  };
  house(P.house.x, P.house.z, 7, 6, 0xe9dcc3, 0); // grandfather's
  house(-50, 52, 6, 5, 0xbcd4e6, 0.5);
  house(-14, 30, 6, 5, 0xf0c9a0, -0.3);
  house(-46, 22, 5.5, 5, 0xe5e5d8, 0.9, false);
  // grandfather's porch, table and radio inside the porch
  box(7.4, 0.15, 2.4, wood, P.house.x, heightAt(P.house.x, P.house.z) + 0.35, P.house.z + 4.3);
  const table = box(1.2, 0.08, 0.8, wood, P.house.x + 2, heightAt(P.house.x, P.house.z) + 1.2, P.house.z + 4.4);
  for (const [dx, dz] of [[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3]]) box(0.06, 0.8, 0.06, darkWood, table.position.x + dx, table.position.y - 0.42, table.position.z + dz);
  const radio = new THREE.Group();
  const rb = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.2), new THREE.MeshStandardMaterial({ color: 0x2a2a28, roughness: 0.6 }));
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12), new THREE.MeshStandardMaterial({ color: 0xc0a060, metalness: 0.8, roughness: 0.3 }));
  dial.rotation.x = Math.PI / 2;
  dial.position.set(0.12, 0, 0.11);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.5), tin);
  ant.position.set(-0.15, 0.36, 0);
  ant.rotation.z = 0.3;
  radio.add(rb, dial, ant);
  radio.position.set(table.position.x - 0.25, table.position.y + 0.17, table.position.z);
  scene.add(radio);
  const key = new THREE.Group();
  const kr = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 8, 16), new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 1, roughness: 0.25 }));
  const ks = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.02), kr.material);
  ks.position.x = 0.11;
  key.add(kr, ks);
  key.position.set(table.position.x + 0.3, table.position.y + 0.06, table.position.z + 0.1);
  key.rotation.x = Math.PI / 2;
  scene.add(key);

  // ---------------------------------------------------------------- port: pier, shed, boats
  const pierY = 1.25;
  for (let z = P.dockStart.z; z <= P.dockEnd.z; z += 0.6) box(3, 0.1, 0.55, wood, P.dockStart.x, pierY, z, 0, false);
  for (let z = P.dockStart.z; z <= P.dockEnd.z; z += 3) for (const sx of [-1.4, 1.4]) box(0.22, 4, 0.22, darkWood, P.dockStart.x + sx, pierY - 1.8, z);
  const pierZone = (x: number, z: number) => Math.abs(x - P.dockStart.x) < 1.45 && z > P.dockStart.z - 2 && z < P.dockEnd.z + 0.3;
  // shed (galpão)
  {
    const y0 = heightAt(P.shed.x, P.shed.z);
    const g = new THREE.Group();
    const walls = new THREE.Mesh(new THREE.BoxGeometry(9, 4, 9), new THREE.MeshStandardMaterial({ color: 0x8c9399, roughness: 0.55, metalness: 0.55, map: detailTex(128, 0.8, 0.25) }));
    walls.position.y = 2;
    walls.castShadow = walls.receiveShadow = true;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.15, 9.6), tin);
    roof.position.y = 4.1;
    roof.rotation.x = 0.06;
    const door = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 0.1), new THREE.MeshStandardMaterial({ color: 0x8b2e1e, roughness: 0.7, metalness: 0.4 }));
    door.position.set(0, 1.5, -4.52);
    g.add(walls, roof, door);
    g.position.set(P.shed.x, y0, P.shed.z);
    scene.add(g);
    colliders.push({ x: P.shed.x, z: P.shed.z, hw: 4.8, hd: 4.8 });
    // drums outside
    for (let i = 0; i < 3; i++) {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.9, 16), new THREE.MeshStandardMaterial({ color: [0x1f4e79, 0x7a1f1f, 0x2f5d2f][i], roughness: 0.6, metalness: 0.4 }));
      d.position.set(P.shed.x - 3 + i * 0.8, y0 + 0.45, P.shed.z - 5.6);
      d.castShadow = true;
      scene.add(d);
    }
  }
  const fuel = new THREE.Group();
  {
    const can = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.45, 0.18), new THREE.MeshStandardMaterial({ color: 0xb3261e, roughness: 0.45, metalness: 0.3 }));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 10), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    cap.position.set(0.1, 0.26, 0);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 12, Math.PI), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    handle.position.set(-0.05, 0.23, 0);
    fuel.add(can, cap, handle);
    fuel.position.set(P.shedDoor.x + 1.2, heightAt(P.shedDoor.x, P.shedDoor.z) + 0.23, P.shedDoor.z - 0.8);
    fuel.traverse((o) => (o.castShadow = true));
    scene.add(fuel);
  }
  // boats: hull from a lathe-like loft
  const boatMesh = (len: number, hullC: number, trim: number) => {
    const g = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(-len / 2, 0.6);
    shape.quadraticCurveTo(-len / 2 + 0.4, -0.2, -len / 2 + 1.2, -0.3);
    shape.lineTo(len / 2 - 1.6, -0.3);
    shape.quadraticCurveTo(len / 2 - 0.2, -0.1, len / 2, 0.9);
    shape.lineTo(-len / 2, 0.9);
    const hg = new THREE.ExtrudeGeometry(shape, { depth: len * 0.36, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.25, bevelSegments: 3 });
    hg.translate(0, 0, -len * 0.18);
    // taper the bow
    const p = hg.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const k = THREE.MathUtils.clamp((x - len * 0.15) / (len * 0.35), 0, 1);
      p.setZ(i, p.getZ(i) * (1 - k * 0.85));
    }
    hg.computeVertexNormals();
    const hull = new THREE.Mesh(hg, new THREE.MeshStandardMaterial({ color: hullC, roughness: 0.6, map: woodTex }));
    hull.castShadow = true;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(len * 0.8, 0.12, len * 0.37), new THREE.MeshStandardMaterial({ color: trim, roughness: 0.6 }));
    stripe.position.set(-0.2, 0.75, 0);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(len * 0.25, 1.2, len * 0.24), plaster(0xf2efe6));
    cabin.position.set(-len * 0.18, 1.5, 0);
    cabin.castShadow = true;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.2), darkWood);
    mast.position.set(len * 0.1, 2.4, 0);
    void stripe;
    g.add(hull, cabin, mast);
    return g;
  };
  const boat = boatMesh(7, 0x2b4c7e, 0xd62828);
  boat.position.set(P.dockEnd.x + 2.8, 0, P.dockEnd.z - 4);
  boat.rotation.y = Math.PI / 2;
  scene.add(boat);
  const oldBoat = boatMesh(5.5, 0x6a4e2e, 0x2e6f6a);
  oldBoat.position.set(P.oldBoat.x, heightAt(P.oldBoat.x, P.oldBoat.z) + 0.2, P.oldBoat.z);
  oldBoat.rotation.set(0.05, 0.6, 0.18);
  scene.add(oldBoat);
  colliders.push({ x: P.oldBoat.x, z: P.oldBoat.z, hw: 2.2, hd: 2.2 });
  const fuse = new THREE.Group();
  {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 14), new THREE.MeshStandardMaterial({ color: 0xe8e0c8, roughness: 0.4 }));
    body.rotation.z = Math.PI / 2;
    const capM = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 1, roughness: 0.3 });
    for (const sx of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 14), capM);
      c.rotation.z = Math.PI / 2;
      c.position.x = sx * 0.12;
      body.add(c);
    }
    const tbox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.35), new THREE.MeshStandardMaterial({ color: 0x3a5f3a, roughness: 0.6, metalness: 0.3 }));
    tbox.position.y = -0.14;
    fuse.add(tbox, body);
    fuse.position.set(P.oldBoat.x + 2.6, heightAt(P.oldBoat.x + 2.6, P.oldBoat.z + 1.2) + 0.28, P.oldBoat.z + 1.2);
    scene.add(fuse);
  }
  const fishing = boatMesh(8, 0xe8e2d0, 0x1d5fa8);
  fishing.position.set(-160, 0, -260);
  scene.add(fishing);

  // ---------------------------------------------------------------- vegetation
  const rand = (() => {
    let s = 1234567;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  })();
  const nearPath = (x: number, z: number) => {
    for (const p of [P.house, P.shed, P.light, P.cave, P.dockStart]) if (Math.hypot(x - p.x, z - p.z) < 13) return true;
    return segDist(x, z) < 3.5;
  };
  // pines
  const nPine = hi ? 220 : 110;
  const trunkG = new THREE.CylinderGeometry(0.12, 0.2, 1, 6);
  const coneG = new THREE.ConeGeometry(1, 1, 7);
  const trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 1 }), nPine);
  const cones = new THREE.InstancedMesh(coneG, new THREE.MeshStandardMaterial({ color: 0x2f4d2a, roughness: 0.95, flatShading: true }), nPine * 3);
  const m4 = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    sV = new THREE.Vector3(),
    pV = new THREE.Vector3();
  let placed = 0;
  for (let k = 0; k < 4000 && placed < nPine; k++) {
    const x = (rand() - 0.5) * 240,
      z = (rand() - 0.5) * 240;
    const h = heightAt(x, z);
    if (h < 3 || nearPath(x, z) || fbm(x * 0.03, z * 0.03) < 0.42) continue;
    const H = 5 + rand() * 6;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6);
    trunks.setMatrixAt(placed, m4.compose(pV.set(x, h + H * 0.25, z), q, sV.set(1, H * 0.5, 1)));
    for (let j = 0; j < 3; j++) {
      const r = (1.9 - j * 0.5) * (H / 8);
      cones.setMatrixAt(placed * 3 + j, m4.compose(pV.set(x, h + H * (0.42 + j * 0.2), z), q, sV.set(r, H * 0.38, r)));
    }
    cones.setColorAt(placed * 3, new THREE.Color().setHSL(0.27 + rand() * 0.05, 0.35, 0.2 + rand() * 0.06));
    cones.setColorAt(placed * 3 + 1, new THREE.Color().setHSL(0.27 + rand() * 0.05, 0.35, 0.22 + rand() * 0.06));
    cones.setColorAt(placed * 3 + 2, new THREE.Color().setHSL(0.27 + rand() * 0.05, 0.35, 0.24 + rand() * 0.06));
    colliders.push({ x, z, hw: 0.35, hd: 0.35 });
    placed++;
  }
  trunks.count = placed;
  cones.count = placed * 3;
  trunks.castShadow = cones.castShadow = true;
  cones.receiveShadow = true;
  scene.add(trunks, cones);
  // coconut palms near the beach
  const palms = new THREE.Group();
  const leafG = new THREE.PlaneGeometry(0.7, 3.2, 1, 4);
  leafG.translate(0, 1.6, 0);
  {
    const p = leafG.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setZ(i, -Math.pow(p.getY(i) / 3.2, 2) * 1.4);
    leafG.computeVertexNormals();
  }
  const leafM = new THREE.MeshStandardMaterial({ color: 0x4f7a2e, side: THREE.DoubleSide, roughness: 0.8 });
  const trunkM = new THREE.MeshStandardMaterial({ color: 0x7a6248, roughness: 1, map: woodTex });
  let palmsN = 0;
  for (let k = 0; k < 2000 && palmsN < (hi ? 40 : 22); k++) {
    const x = (rand() - 0.5) * 230,
      z = (rand() - 0.5) * 230;
    const h = heightAt(x, z);
    if (h < 0.9 || h > 3.2 || nearPath(x, z) || pierZone(x, z)) continue;
    const g = new THREE.Group();
    const H = 5 + rand() * 3;
    const lean = (rand() - 0.5) * 0.5;
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, H, 7, 4), trunkM);
    tr.position.y = H / 2;
    tr.castShadow = true;
    g.add(tr);
    const crown = new THREE.Group();
    crown.position.y = H;
    for (let i = 0; i < 9; i++) {
      const lf = new THREE.Mesh(leafG, leafM);
      lf.rotation.set(-1.1 - rand() * 0.4, (i / 9) * Math.PI * 2, 0, "YXZ");
      lf.castShadow = true;
      crown.add(lf);
    }
    g.add(crown);
    g.rotation.z = lean;
    g.position.set(x, h - 0.2, z);
    palms.add(g);
    colliders.push({ x, z, hw: 0.3, hd: 0.3 });
    palmsN++;
  }
  scene.add(palms);
  // grass tufts
  const nGrass = hi ? 9000 : 2500;
  const bladeG = new THREE.ConeGeometry(0.06, 0.55, 3);
  bladeG.translate(0, 0.27, 0);
  const grassI = new THREE.InstancedMesh(bladeG, new THREE.MeshStandardMaterial({ color: 0x6d8f3c, roughness: 0.9 }), nGrass);
  let gN = 0;
  for (let k = 0; k < nGrass * 4 && gN < nGrass; k++) {
    const x = (rand() - 0.5) * 220,
      z = (rand() - 0.5) * 220;
    const h = heightAt(x, z);
    if (h < 2 || segDist(x, z) < 1.6) continue;
    q.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.5, rand() * 6, (rand() - 0.5) * 0.5));
    const s = 0.6 + rand() * 0.9;
    grassI.setMatrixAt(gN, m4.compose(pV.set(x, h - 0.05, z), q, sV.set(s, s * (0.8 + rand() * 0.6), s)));
    grassI.setColorAt(gN, new THREE.Color().setHSL(0.2 + rand() * 0.08, 0.4, 0.28 + rand() * 0.12));
    gN++;
  }
  grassI.count = gN;
  scene.add(grassI);
  // boulders
  const bG = new THREE.DodecahedronGeometry(1, 1);
  {
    const p = bG.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i);
      v.multiplyScalar(0.8 + fbm(v.x * 2 + 9, v.y * 2 + v.z) * 0.5);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    bG.computeVertexNormals();
  }
  const nB = hi ? 120 : 60;
  const boulders = new THREE.InstancedMesh(bG, rockMat, nB);
  let bN = 0;
  for (let k = 0; k < 3000 && bN < nB; k++) {
    const x = (rand() - 0.5) * 260,
      z = (rand() - 0.5) * 260;
    const h = heightAt(x, z);
    if (h < -1.5 || nearPath(x, z) || pierZone(x, z)) continue;
    const s = 0.5 + rand() * (h < 1 ? 2.6 : 1.4);
    q.setFromEuler(new THREE.Euler(rand() * 3, rand() * 3, rand() * 3));
    boulders.setMatrixAt(bN, m4.compose(pV.set(x, h + s * 0.2, z), q, sV.set(s * 1.3, s, s)));
    if (s > 0.9) colliders.push({ x, z, hw: s * 0.9, hd: s * 0.9 });
    bN++;
  }
  boulders.count = bN;
  boulders.castShadow = boulders.receiveShadow = true;
  scene.add(boulders);

  // ---------------------------------------------------------------- cave under the lighthouse hill
  const caveLights: THREE.PointLight[] = [];
  const genMesh = new THREE.Group();
  const caveFloor = heightAt(P.cave.x, P.cave.z);
  const inCave = (x: number, z: number) => x > P.cave.x - 6 && x < P.cave.x + 6 && z < P.cave.z + 1 && z > P.cave.z - 16;
  {
    const g = new THREE.Group();
    const wallM = rockMat;
    // walls and ceiling made of lumpy rocks
    const lump = (x: number, y: number, z: number, s: number) => {
      const m = new THREE.Mesh(bG, wallM);
      m.position.set(x, y, z);
      m.scale.set(s * 1.4, s, s * 1.2);
      m.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
    };
    for (let z = 0; z >= -15; z -= 1.6) {
      for (const sx of [-1, 1]) {
        lump(sx * 5.6, 1.2, z, 2.2);
        lump(sx * 5.2, 3.6, z, 2);
      }
      lump(-2.2, 5.4, z, 2.4);
      lump(2.2, 5.4, z, 2.4);
    }
    for (const sx of [-4, -1.5, 1.5, 4]) lump(sx, 2.5, -16.4, 2.6);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 17), new THREE.MeshStandardMaterial({ color: 0x4a4540, roughness: 1, map: rockTex }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.05, -7.5);
    floor.receiveShadow = true;
    g.add(floor);
    // broken wooden stair down the back wall (where grandfather slipped)
    for (let i = 0; i < 5; i++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.5), wood);
      st.position.set(4.4, 0.4 + i * 0.6, -12 - i * 0.5);
      st.rotation.z = i === 2 ? 0.5 : 0;
      st.castShadow = true;
      g.add(st);
    }
    // generator
    const gb = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.9), new THREE.MeshStandardMaterial({ color: 0x3e6b3a, roughness: 0.55, metalness: 0.5 }));
    gb.position.y = 0.5;
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.3, 16), new THREE.MeshStandardMaterial({ color: 0xa33a2a, roughness: 0.5, metalness: 0.4 }));
    tank.rotation.z = Math.PI / 2;
    tank.position.set(0, 1.2, 0);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.12), new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.7, roughness: 0.35 }));
    panel.position.set(0.95, 0.9, 0.2);
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.05), new THREE.MeshStandardMaterial({ color: 0xd62828 }));
    lever.position.set(-0.95, 0.9, 0.3);
    lever.name = "lever";
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2), tin);
    pipe.position.set(-0.5, 1.5, -0.2);
    genMesh.add(gb, tank, panel, lever, pipe);
    genMesh.traverse((o) => (o.castShadow = true));
    genMesh.position.set(P.generator.x - P.cave.x, 0, P.generator.z - P.cave.z);
    g.add(genMesh);
    // bulbs that light up with the generator
    for (const [x, z] of [[-3, -4], [3, -9], [0, -14]]) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xffc46b, emissiveIntensity: 0 }));
      bulb.position.set(x, 4.2, z);
      bulb.name = "bulb";
      g.add(bulb);
      const l = new THREE.PointLight(0xffc46b, 0, 12, 1.6);
      l.position.copy(bulb.position);
      g.add(l);
      caveLights.push(l);
    }
    g.position.set(P.cave.x, caveFloor, P.cave.z);
    scene.add(g);
    // walls as colliders
    colliders.push({ x: P.cave.x - 5.4, z: P.cave.z - 8, hw: 1.2, hd: 8.5 });
    colliders.push({ x: P.cave.x + 5.4, z: P.cave.z - 8, hw: 1.2, hd: 8.5 });
    colliders.push({ x: P.cave.x, z: P.cave.z - 16.6, hw: 6, hd: 1 });
    colliders.push({ x: P.generator.x, z: P.generator.z, hw: 0.9, hd: 0.6 });
    // dark entrance shroud so the hill reads as solid
    const hood = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5a5650, roughness: 1, map: rockTex, side: THREE.BackSide }));
    hood.scale.set(0.75, 0.75, 1.05);
    hood.position.set(P.cave.x, caveFloor - 0.5, P.cave.z - 8);
    hood.receiveShadow = true;
    scene.add(hood);
  }

  // ---------------------------------------------------------------- lighthouse
  const ly = heightAt(P.light.x, P.light.z);
  const lamp = { glass: null as unknown as THREE.MeshStandardMaterial, beam: new THREE.Group(), light: new THREE.SpotLight(0xfff2cc, 0, 600, 0.12, 0.4, 0.6), on: false, top: ly + TOWER_H };
  {
    const g = new THREE.Group();
    const prof: THREE.Vector2[] = [];
    for (let i = 0; i <= 20; i++) {
      const y = (i / 20) * TOWER_H;
      prof.push(new THREE.Vector2(3.0 - (i / 20) * 1.1, y));
    }
    prof.unshift(new THREE.Vector2(0, 0));
    const tg2 = new THREE.LatheGeometry(prof, 32);
    // red and white bands as vertex colours
    const tp = tg2.attributes.position as THREE.BufferAttribute;
    const tc = new Float32Array(tp.count * 3);
    for (let i = 0; i < tp.count; i++) {
      const band = Math.floor(tp.getY(i) / (TOWER_H / 5)) % 2 === 1;
      const c = band ? new THREE.Color(0xb8261c) : new THREE.Color(0xf1eee6);
      tc.set([c.r, c.g, c.b], i * 3);
    }
    tg2.setAttribute("color", new THREE.BufferAttribute(tc, 3));
    const tower = new THREE.Mesh(tg2, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, map: detailTex(128, 0.4, 0.18) }));
    tower.castShadow = tower.receiveShadow = true;
    g.add(tower);
    const gallery = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.25, 32), new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.6, metalness: 0.6 }));
    gallery.position.y = TOWER_H;
    g.add(gallery);
    const rail = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.04, 6, 48), gallery.material);
    rail.rotation.x = Math.PI / 2;
    rail.position.y = TOWER_H + 1.0;
    g.add(rail);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1), gallery.material);
      post.position.set(Math.cos(a) * 3, TOWER_H + 0.5, Math.sin(a) * 3);
      g.add(post);
    }
    lamp.glass = new THREE.MeshStandardMaterial({ color: 0x9fb8c0, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.45, emissive: 0xfff0c0, emissiveIntensity: 0 });
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.2, 16, 1, true), lamp.glass);
    lantern.position.y = TOWER_H + 1.25;
    g.add(lantern);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.55, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8b2a1e, roughness: 0.45, metalness: 0.5 }));
    dome.position.y = TOWER_H + 2.35;
    dome.castShadow = true;
    g.add(dome);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.2), darkWood);
    door.position.set(0, 1.1, 2.95);
    g.add(door);
    // lamp + rotating beam (two opposite cones)
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), new THREE.MeshStandardMaterial({ color: 0x555555, emissive: 0xfff3d0, emissiveIntensity: 0 }));
    bulb.position.y = TOWER_H + 1.2;
    bulb.name = "bulb";
    g.add(bulb);
    const beamM = new THREE.MeshBasicMaterial({ color: 0xfff1c8, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    for (const s of [1, -1]) {
      const cg = new THREE.ConeGeometry(9, 160, 24, 1, true);
      cg.translate(0, -80, 0);
      cg.rotateZ((s * Math.PI) / 2);
      const cone = new THREE.Mesh(cg, beamM);
      lamp.beam.add(cone);
    }
    lamp.beam.position.y = TOWER_H + 1.2;
    lamp.beam.visible = false;
    g.add(lamp.beam);
    lamp.light.position.set(0, TOWER_H + 1.2, 0);
    g.add(lamp.light, lamp.light.target);
    lamp.light.target.position.set(100, TOWER_H - 6, 0);
    g.position.set(P.light.x, ly, P.light.z);
    scene.add(g);
    colliders.push({ x: P.light.x, z: P.light.z, hw: 3, hd: 3 });
    // keeper's hut beside the tower
    house(P.light.x - 8, P.light.z + 2, 4.5, 4, 0xf1eee6, Math.PI / 2, true);
  }

  // ---------------------------------------------------------------- update
  let T = 0;
  function update(dt: number, t: number) {
    T = t;
    water.update(dt);
    // the fishing boat bobs on the swell
    fishing.position.y = Math.sin(T * 1.1) * 0.35 - 0.1;
    fishing.rotation.z = Math.sin(T * 0.9) * 0.08;
    fishing.rotation.x = Math.sin(T * 0.7 + 1) * 0.05;
    boat.position.y = Math.sin(T * 1.3) * 0.12 - 0.1;
    boat.rotation.x = Math.sin(T * 1.1) * 0.025;
    if (lamp.on) lamp.beam.rotation.y += dt * 0.9;
    lamp.light.target.position.set(Math.cos(-lamp.beam.rotation.y) * 100, TOWER_H - 6, Math.sin(-lamp.beam.rotation.y) * 100);
    key.rotation.z += dt;
    fuse.rotation.y = Math.sin(T) * 0.2;
  }

  return { scene, sky, sun, hemi, water, colliders, windows, lamp, caveLights, genMesh, fuel, fuse, key, radio, boat, fishing, pierZone, inCave, update };
}

export { TOWER_H };
