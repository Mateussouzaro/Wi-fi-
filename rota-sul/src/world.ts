import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { Water } from "three/examples/jsm/objects/Water.js";
import * as T from "./textures";

// City layout ---------------------------------------------------------------
// A grid of blocks with roads between them. The southern edge is the beach
// avenue, then the promenade, sand and the sea. A favela hill sits west and a
// big granite "morro" closes the beach to the east.

export const ROAD = 14;
export const BLOCK = 64;
export const PITCH = ROAD + BLOCK;
export const NX = 6;
export const NZ = 5;
export const X0 = -(NX * PITCH) / 2;
export const Z0 = -(NZ * PITCH) / 2;
export const roadX = Array.from({ length: NX + 1 }, (_, i) => X0 + i * PITCH);
export const roadZ = Array.from({ length: NZ + 1 }, (_, j) => Z0 + j * PITCH);
export const BEACH_ROAD = roadZ[NZ];
export const SEA_Z = BEACH_ROAD + 82;

export interface Box { minX: number; maxX: number; minZ: number; maxZ: number }
export interface Circle { x: number; z: number; r: number }

export interface World {
  colliders: Box[];
  circles: Circle[];
  bounds: Box;
  sun: THREE.DirectionalLight;
  update: (dt: number, time: number, focus: THREE.Vector3) => void;
  setTimeOfDay: (h: number) => void;
  timeOfDay: () => number;
  isNight: () => boolean;
  landmarks: { name: string; x: number; z: number }[];
  minimapCanvas: HTMLCanvasElement;
}

// Give a box geometry world-scaled UVs so one material can tile across buildings of any size.
function boxUV(w: number, h: number, d: number, tileW: number, tileH: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  // faces: +x, -x, +y, -y, +z, -z (4 verts each)
  const spans: [number, number][] = [
    [d, h], [d, h], [w, d], [w, d], [w, h], [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    const [su, sv] = spans[f];
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * (su / tileW), uv.getY(i) * (sv / tileH));
    }
  }
  return g;
}

export function buildWorld(scene: THREE.Scene, renderer: THREE.WebGLRenderer, quality: "alta" | "baixa"): World {
  const r = T.rng(2026);
  const colliders: Box[] = [];
  const circles: Circle[] = [];
  const landmarks: World["landmarks"] = [];
  const nightMats: THREE.MeshStandardMaterial[] = [];

  // ---------------------------------------------------------------- sky + light
  const sky = new Sky();
  sky.scale.setScalar(10000);
  scene.add(sky);
  const su = sky.material.uniforms;
  su.turbidity.value = 4;
  su.rayleigh.value = 2.8;
  su.mieCoefficient.value = 0.006;
  su.mieDirectionalG.value = 0.85;

  const sun = new THREE.DirectionalLight(0xffe2b8, 3.2);
  sun.castShadow = true;
  const sm = quality === "alta" ? 2048 : 1024;
  sun.shadow.mapSize.set(sm, sm);
  const sc = sun.shadow.camera;
  sc.left = -90;
  sc.right = 90;
  sc.top = 90;
  sc.bottom = -90;
  sc.near = 1;
  sc.far = 600;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x8a7350, 0.9);
  scene.add(hemi);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const skyScene = new THREE.Scene();
  const skyEnv = new Sky();
  skyEnv.scale.setScalar(1000);
  skyScene.add(skyEnv);
  let envRT: THREE.WebGLRenderTarget | null = null;

  // ---------------------------------------------------------------- ground
  const grassT = T.grass();
  grassT.repeat.set(200, 200);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(3000, 3000),
    new THREE.MeshStandardMaterial({ map: grassT, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---------------------------------------------------------------- roads
  const asph = T.asphalt();
  const roadMat = new THREE.MeshStandardMaterial({ map: asph, roughness: 0.92 });
  const markT = T.roadMarkings();
  const markMat = new THREE.MeshStandardMaterial({ map: markT, transparent: true, roughness: 0.7, depthWrite: false });
  const spanX = NX * PITCH + ROAD;
  const spanZ = NZ * PITCH + ROAD;
  const addRoad = (x: number, z: number, w: number, l: number, alongX: boolean) => {
    const g = new THREE.PlaneGeometry(alongX ? l : w, alongX ? w : l);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * (alongX ? l : w)) / 12, (uv.getY(i) * (alongX ? w : l)) / 12);
    const m = new THREE.Mesh(g, roadMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.01, z);
    m.receiveShadow = true;
    scene.add(m);
    // lane markings
    const mg = new THREE.PlaneGeometry(w, l);
    const muv = mg.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < muv.count; i++) muv.setXY(i, muv.getX(i), (muv.getY(i) * l) / 24);
    const mk = new THREE.Mesh(mg, markMat);
    mk.rotation.x = -Math.PI / 2;
    if (alongX) mk.rotation.z = Math.PI / 2;
    mk.position.set(x, 0.02, z);
    mk.receiveShadow = true;
    scene.add(mk);
  };
  for (const x of roadX) addRoad(x, 0, ROAD, spanZ, false);
  for (const z of roadZ) addRoad(0, z, ROAD, spanX, true);
  // roads leading out of town (east/west/north)
  addRoad(X0 - 200, roadZ[2], ROAD, 400 - ROAD, true);
  addRoad(-X0 + 200, roadZ[2], ROAD, 400 - ROAD, true);
  addRoad(roadX[3], Z0 - 200, ROAD, 400 - ROAD, false);

  // ---------------------------------------------------------------- materials
  const facadeDefs = [
    ["#E8E2D4", 1], ["#D9C7A7", 2], ["#BFC6CC", 3], ["#F1EEE7", 4], ["#C9B79C", 5], ["#9FB3B8", 6], ["#E4D2C2", 7], ["#B7A58E", 8],
  ] as const;
  const facadeMats = facadeDefs.map(([col, s]) => {
    const f = T.facade(s * 13, col);
    const m = new THREE.MeshStandardMaterial({
      map: f.map,
      emissiveMap: f.emissive,
      emissive: new THREE.Color(1, 1, 1),
      emissiveIntensity: 0,
      roughness: 0.75,
      metalness: 0.05,
    });
    nightMats.push(m);
    return m;
  });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x77726a, roughness: 0.95 });
  const sideT = T.sidewalk();
  const sidewalkMat = new THREE.MeshStandardMaterial({ map: sideT, roughness: 0.9 });
  const houseMats = Array.from({ length: 10 }, (_, i) => new THREE.MeshStandardMaterial({ map: T.houseWall(100 + i * 7), roughness: 0.9 }));
  const slabMat = new THREE.MeshStandardMaterial({ color: 0x8d8a83, roughness: 1 });
  const tankMat = new THREE.MeshStandardMaterial({ color: 0x2f6fb5, roughness: 0.5 });

  // ---------------------------------------------------------------- blocks
  const signNames = ["PADARIA", "FARMÁCIA", "AÇAÍ", "BAR DO ZÉ", "LANCHONETE", "MERCADINHO", "BORRACHARIA", "SALÃO", "PASTELARIA", "LOTÉRICA"];
  const signCols = ["#C0392B", "#16A085", "#6C3483", "#D35400", "#2471A3", "#1E8449", "#7B241C", "#AF7AC5", "#B9770E", "#117A65"];
  const addBuilding = (cx: number, cz: number, w: number, d: number, h: number, mat: THREE.Material) => {
    const g = boxUV(w, h, d, 21, 48);
    const m = new THREE.Mesh(g, [mat, mat, roofMat, roofMat, mat, mat]);
    m.position.set(cx, h / 2, cz);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
    // rooftop water tank / antenna
    if (r() < 0.6) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 3), roofMat);
      t.position.set(cx + (r() - 0.5) * w * 0.4, h + 1.2, cz + (r() - 0.5) * d * 0.4);
      t.castShadow = true;
      scene.add(t);
    }
  };

  const addHouse = (cx: number, cz: number, w: number, d: number, floors: number, ground = 0, withSign = false) => {
    const mat = houseMats[Math.floor(r() * houseMats.length)];
    const h = floors * 3;
    const g = boxUV(w, h, d, 6, 3);
    const m = new THREE.Mesh(g, [mat, mat, slabMat, slabMat, mat, mat]);
    m.position.set(cx, ground + h / 2, cz);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    if (r() < 0.55) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.6, 1.1, 10), tankMat);
      tank.position.set(cx + (r() - 0.5) * (w - 2), ground + h + 0.55, cz + (r() - 0.5) * (d - 2));
      tank.castShadow = true;
      scene.add(tank);
    }
    if (withSign) {
      const k = Math.floor(r() * signNames.length);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w - 1, 7), 1.4), new THREE.MeshStandardMaterial({ map: T.sign(signNames[k], signCols[k]), roughness: 0.6 }));
      s.position.set(cx, 3.4, cz + d / 2 + 0.05);
      scene.add(s);
    }
    return m;
  };

  const trees: THREE.Vector3[] = [];
  const palms: THREE.Vector3[] = [];
  const lamps: { x: number; z: number; rot: number }[] = [];

  for (let i = 0; i < NX; i++) {
    for (let j = 0; j < NZ; j++) {
      const x0 = roadX[i] + ROAD / 2,
        z0 = roadZ[j] + ROAD / 2;
      const cx = x0 + BLOCK / 2,
        cz = z0 + BLOCK / 2;
      // raised sidewalk slab with curb
      const sw = new THREE.Mesh(boxUV(BLOCK, 0.25, BLOCK, 4, 4), sidewalkMat);
      sw.position.set(cx, 0.125, cz);
      sw.receiveShadow = true;
      scene.add(sw);
      // lamps along the block edge
      for (let k = 0; k < 4; k++) {
        const t = -BLOCK / 2 + 8 + k * 16;
        lamps.push({ x: cx + t, z: z0 + 1.2, rot: Math.PI }, { x: x0 + 1.2, z: cz + t, rot: -Math.PI / 2 });
      }
      const inner = BLOCK - 8;
      const beachFront = j === NZ - 1;
      const type = beachFront ? "towers" : i === 1 && j === 1 ? "campo" : i === 4 && j === 2 ? "praca" : r() < 0.42 ? "houses" : "towers";
      if (type === "towers") {
        const n = beachFront ? 3 : 2 + Math.floor(r() * 3);
        const slot = inner / n;
        for (let k = 0; k < n; k++) {
          const w = slot - 3 - r() * 3;
          const d = beachFront ? inner - 14 : inner - 4 - r() * 14;
          const h = beachFront ? 36 + r() * 30 : 15 + r() * 40;
          const bx = cx - inner / 2 + slot * (k + 0.5);
          const bz = beachFront ? cz + 5 : cz + (r() - 0.5) * 4;
          addBuilding(bx, bz, w, d, h, facadeMats[Math.floor(r() * facadeMats.length)]);
        }
        if (beachFront) landmarks.push({ name: "Orla", x: cx, z: cz });
      } else if (type === "houses") {
        // rows of 2-3 storey houses with shops facing the street
        const n = 4;
        const s = inner / n;
        for (let a = 0; a < n; a++)
          for (let b = 0; b < n; b++) {
            if ((a === 1 || a === 2) && (b === 1 || b === 2) && r() < 0.6) continue; // back yards
            const hx = cx - inner / 2 + s * (a + 0.5);
            const hz = cz - inner / 2 + s * (b + 0.5);
            const w = s - 1.5,
              d = s - 1.5;
            addHouse(hx, hz, w, d, 1 + Math.floor(r() * 3), 0.25, b === n - 1 && r() < 0.6);
            colliders.push({ minX: hx - w / 2, maxX: hx + w / 2, minZ: hz - d / 2, maxZ: hz + d / 2 });
          }
      } else if (type === "campo") {
        const f = new THREE.Mesh(new THREE.PlaneGeometry(inner - 6, inner), new THREE.MeshStandardMaterial({ map: T.soccerField(), roughness: 1 }));
        f.rotation.x = -Math.PI / 2;
        f.position.set(cx, 0.27, cz);
        f.receiveShadow = true;
        scene.add(f);
        const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
        for (const sgn of [-1, 1]) {
          const goal = new THREE.Group();
          const bar = new THREE.Mesh(new THREE.BoxGeometry(7.3, 0.15, 0.15), postMat);
          bar.position.y = 2.4;
          const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.4, 0.15), postMat);
          p1.position.set(-3.6, 1.2, 0);
          const p2 = p1.clone();
          p2.position.x = 3.6;
          goal.add(bar, p1, p2);
          goal.position.set(cx, 0.25, cz + sgn * (inner / 2 - 1));
          goal.traverse((o) => ((o as THREE.Mesh).castShadow = true));
          scene.add(goal);
        }
        landmarks.push({ name: "Campinho", x: cx, z: cz });
      } else {
        const grassM = new THREE.Mesh(new THREE.PlaneGeometry(inner, inner), new THREE.MeshStandardMaterial({ map: grassT, roughness: 1 }));
        grassM.rotation.x = -Math.PI / 2;
        grassM.position.set(cx, 0.27, cz);
        grassM.receiveShadow = true;
        scene.add(grassM);
        for (let k = 0; k < 14; k++) trees.push(new THREE.Vector3(cx + (r() - 0.5) * (inner - 6), 0.25, cz + (r() - 0.5) * (inner - 6)));
        landmarks.push({ name: "Praça", x: cx, z: cz });
      }
    }
  }

  // ---------------------------------------------------------------- beach
  const calcT = T.calcadao();
  calcT.repeat.set(spanX / 14, 1);
  const prom = new THREE.Mesh(new THREE.BoxGeometry(spanX + 400, 0.25, 12), new THREE.MeshStandardMaterial({ map: calcT, roughness: 0.8 }));
  prom.position.set(0, 0.125, BEACH_ROAD + ROAD / 2 + 6);
  prom.receiveShadow = true;
  scene.add(prom);
  const sandT = T.sand();
  sandT.repeat.set(60, 6);
  const sandM = new THREE.Mesh(new THREE.PlaneGeometry(spanX + 600, 140), new THREE.MeshStandardMaterial({ map: sandT, roughness: 1 }));
  sandM.rotation.x = -Math.PI / 2;
  sandM.position.set(0, 0.02, BEACH_ROAD + ROAD / 2 + 12 + 70);
  sandM.receiveShadow = true;
  scene.add(sandM);
  for (let x = -spanX / 2; x < spanX / 2; x += 14) palms.push(new THREE.Vector3(x + r() * 4, 0.25, BEACH_ROAD + ROAD / 2 + 10.5));

  // beach umbrellas + kiosks
  const umbCols = [0xe63946, 0xf4a261, 0x2a9d8f, 0xe9c46a, 0x457b9d, 0xffffff];
  for (let k = 0; k < 70; k++) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 6), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
    pole.position.y = 1.15;
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.5, 12), new THREE.MeshStandardMaterial({ color: umbCols[k % umbCols.length], roughness: 0.6, side: THREE.DoubleSide }));
    top.position.y = 2.3;
    top.castShadow = true;
    g.add(pole, top);
    g.position.set(-spanX / 2 + r() * spanX, 0, BEACH_ROAD + 30 + r() * 38);
    scene.add(g);
  }
  for (let k = 0; k < 6; k++) {
    const kx = -spanX / 2 + 40 + k * (spanX / 6);
    const kz = BEACH_ROAD + ROAD / 2 + 16;
    const kiosk = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 4), new THREE.MeshStandardMaterial({ color: 0x1d6f42, roughness: 0.7 }));
    kiosk.position.set(kx, 1.5, kz);
    kiosk.castShadow = true;
    scene.add(kiosk);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1), new THREE.MeshStandardMaterial({ map: T.sign("COCO GELADO", "#F2C14E", "#1D3557") }));
    s.position.set(kx, 3.5, kz - 2.01);
    s.rotation.y = Math.PI;
    scene.add(s);
    colliders.push({ minX: kx - 2.5, maxX: kx + 2.5, minZ: kz - 2, maxZ: kz + 2 });
  }
  landmarks.push({ name: "Praia", x: 0, z: BEACH_ROAD + 45 });

  // sea
  const water = new Water(new THREE.PlaneGeometry(4000, 2000), {
    textureWidth: quality === "alta" ? 512 : 256,
    textureHeight: quality === "alta" ? 512 : 256,
    waterNormals: T.waterNormals(),
    sunDirection: new THREE.Vector3(),
    sunColor: 0xffffff,
    waterColor: 0x0b5d78,
    distortionScale: 2.4,
    fog: true,
  });
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.15, SEA_Z + 1000 - 12);
  scene.add(water);
  // foam line
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 3),
    new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, roughness: 0.4 })
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.17, SEA_Z - 11);
  scene.add(foam);

  // ---------------------------------------------------------------- favela hill (west)
  const hillCX = X0 - 120,
    hillCZ = -40,
    hillR = 150,
    hillH = 55;
  const hillY = (x: number, z: number) => {
    const d = Math.hypot(x - hillCX, (z - hillCZ) * 0.8) / hillR;
    return d >= 1 ? 0 : hillH * Math.pow(Math.cos((d * Math.PI) / 2), 1.6);
  };
  const hg = new THREE.PlaneGeometry(hillR * 2.6, hillR * 2.6, 90, 90);
  hg.rotateX(-Math.PI / 2);
  const hp = hg.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < hp.count; i++) {
    const x = hp.getX(i) + hillCX,
      z = hp.getZ(i) + hillCZ;
    hp.setY(i, hillY(x, z) + Math.sin(x * 0.2) * Math.cos(z * 0.17) * 0.6 - 0.1);
  }
  hg.computeVertexNormals();
  const hillGrass = T.grass();
  hillGrass.repeat.set(30, 30);
  const hill = new THREE.Mesh(hg, new THREE.MeshStandardMaterial({ map: hillGrass, color: 0xa58f6a, roughness: 1 }));
  hill.position.set(hillCX, 0, hillCZ);
  hill.receiveShadow = true;
  scene.add(hill);
  // stacked houses following the slope
  const hb = new THREE.BoxGeometry(1, 1, 1);
  hb.translate(0, 0.5, 0);
  const perMat: THREE.Matrix4[][] = houseMats.map(() => []);
  const dummy = new THREE.Object3D();
  for (let k = 0; k < 900; k++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * hillR * 0.92;
    const x = hillCX + Math.cos(a) * d,
      z = hillCZ + (Math.sin(a) * d) / 0.8;
    if (x > X0 - 18) continue; // keep the city edge clear
    const y = hillY(x, z);
    if (y < 1.5 && r() < 0.6) continue;
    const w = 3.5 + r() * 3,
      dd = 3.5 + r() * 3,
      h = 2.8 * (1 + Math.floor(r() * 3));
    dummy.position.set(x, y - 0.8, z);
    dummy.rotation.set(0, Math.round(r() * 4) * (Math.PI / 2) + (r() - 0.5) * 0.2, 0);
    dummy.scale.set(w, h + 0.8, dd);
    dummy.updateMatrix();
    perMat[Math.floor(r() * houseMats.length)].push(dummy.matrix.clone());
  }
  perMat.forEach((list, i) => {
    const im = new THREE.InstancedMesh(hb, houseMats[i], list.length);
    list.forEach((m, k) => im.setMatrixAt(k, m));
    im.castShadow = true;
    im.receiveShadow = true;
    scene.add(im);
  });
  circles.push({ x: hillCX, z: hillCZ, r: hillR * 0.82 });
  landmarks.push({ name: "Morro", x: hillCX + 60, z: hillCZ });

  // ---------------------------------------------------------------- granite morro (east, by the sea)
  const rockT = T.rock();
  rockT.repeat.set(8, 8);
  const mg = new THREE.SphereGeometry(1, 64, 48);
  const mp = mg.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < mp.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(mp, i);
    const n = 1 + 0.05 * Math.sin(v.x * 9) * Math.cos(v.z * 7) + 0.03 * Math.sin(v.y * 13);
    mp.setXYZ(i, v.x * n, Math.max(-0.2, v.y) * n, v.z * n);
  }
  mg.computeVertexNormals();
  const rockMat = new THREE.MeshStandardMaterial({ map: rockT, color: 0x9a948a, roughness: 0.9 });
  const morro = new THREE.Mesh(mg, rockMat);
  morro.scale.set(70, 160, 60);
  morro.position.set(-X0 + 150, 0, BEACH_ROAD + 120);
  morro.castShadow = true;
  scene.add(morro);
  const morro2 = new THREE.Mesh(mg, rockMat);
  morro2.scale.set(55, 90, 50);
  morro2.position.set(-X0 + 60, 0, BEACH_ROAD + 150);
  morro2.castShadow = true;
  scene.add(morro2);
  circles.push({ x: morro.position.x, z: morro.position.z, r: 62 }, { x: morro2.position.x, z: morro2.position.z, r: 48 });
  landmarks.push({ name: "Pedrão", x: morro.position.x, z: morro.position.z });

  // distant green mountains ring
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x3f6a3a, roughness: 1, flatShading: true });
  for (let k = 0; k < 26; k++) {
    const a = (k / 26) * Math.PI * 2;
    if (Math.sin(a) > 0.35) continue; // leave the sea horizon open
    const m = new THREE.Mesh(new THREE.ConeGeometry(120 + r() * 90, 120 + r() * 160, 7), ringMat);
    m.position.set(Math.cos(a) * 900, 40, Math.sin(a) * 800 - 100);
    scene.add(m);
  }

  // ---------------------------------------------------------------- vegetation + street furniture
  // tropical tree
  if (trees.length) {
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.4, 4, 7), new THREE.MeshStandardMaterial({ color: 0x5b4632, roughness: 1 }), trees.length);
    const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(3, 1), new THREE.MeshStandardMaterial({ color: 0x3b7a2a, roughness: 0.9, flatShading: true }), trees.length);
    trees.forEach((p, k) => {
      dummy.position.set(p.x, p.y + 2, p.z);
      dummy.rotation.set(0, r() * 6, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      trunk.setMatrixAt(k, dummy.matrix);
      dummy.position.y = p.y + 5;
      dummy.scale.set(1 + r() * 0.4, 0.8 + r() * 0.3, 1 + r() * 0.4);
      dummy.updateMatrix();
      crown.setMatrixAt(k, dummy.matrix);
      circles.push({ x: p.x, z: p.z, r: 0.6 });
    });
    trunk.castShadow = crown.castShadow = true;
    scene.add(trunk, crown);
  }
  // palms
  {
    const trunkG = new THREE.CylinderGeometry(0.18, 0.32, 9, 7);
    trunkG.translate(0, 4.5, 0);
    const frondG = new THREE.PlaneGeometry(0.9, 5, 1, 4);
    const fp = frondG.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < fp.count; i++) {
      const y = fp.getY(i) + 2.5; // 0..5 along the frond
      fp.setXYZ(i, fp.getX(i) * (1 - y / 6), 0, y);
      fp.setY(i, -0.06 * y * y);
    }
    frondG.computeVertexNormals();
    const trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0x7a6a55, roughness: 1 }), palms.length);
    const fronds = new THREE.InstancedMesh(frondG, new THREE.MeshStandardMaterial({ color: 0x2f7d32, roughness: 0.8, side: THREE.DoubleSide }), palms.length * 9);
    let f = 0;
    palms.forEach((p, k) => {
      const lean = (r() - 0.5) * 0.15;
      dummy.position.copy(p);
      dummy.rotation.set(lean, 0, lean);
      dummy.scale.set(1, 0.9 + r() * 0.3, 1);
      dummy.updateMatrix();
      trunks.setMatrixAt(k, dummy.matrix);
      const top = new THREE.Vector3(0, 9 * dummy.scale.y, 0).applyEuler(dummy.rotation).add(p);
      for (let q = 0; q < 9; q++) {
        dummy.position.copy(top);
        dummy.rotation.set(0, (q / 9) * Math.PI * 2 + r() * 0.3, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        fronds.setMatrixAt(f++, dummy.matrix);
      }
      circles.push({ x: p.x, z: p.z, r: 0.4 });
    });
    trunks.castShadow = fronds.castShadow = true;
    scene.add(trunks, fronds);
  }
  // street lamps
  const lampHeadMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffc070, emissiveIntensity: 0 });
  nightMats.push(lampHeadMat);
  {
    const poleG = new THREE.CylinderGeometry(0.08, 0.12, 7, 6);
    poleG.translate(0, 3.5, 0);
    const headG = new THREE.BoxGeometry(0.5, 0.18, 1.2);
    headG.translate(0, 7, 0.5);
    const poles = new THREE.InstancedMesh(poleG, new THREE.MeshStandardMaterial({ color: 0x55595c, metalness: 0.6, roughness: 0.4 }), lamps.length);
    const heads = new THREE.InstancedMesh(headG, lampHeadMat, lamps.length);
    lamps.forEach((l, k) => {
      dummy.position.set(l.x, 0.25, l.z);
      dummy.rotation.set(0, l.rot, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poles.setMatrixAt(k, dummy.matrix);
      heads.setMatrixAt(k, dummy.matrix);
      circles.push({ x: l.x, z: l.z, r: 0.25 });
    });
    poles.castShadow = true;
    scene.add(poles, heads);
  }

  // ---------------------------------------------------------------- minimap base
  const mm = document.createElement("canvas");
  const MS = 512;
  mm.width = mm.height = MS;
  {
    const g = mm.getContext("2d")!;
    const toPx = (x: number, z: number) => [((x + 700) / 1400) * MS, ((z + 700) / 1400) * MS];
    g.fillStyle = "#4b6b3a";
    g.fillRect(0, 0, MS, MS);
    const [, sy] = toPx(0, SEA_Z - 12);
    g.fillStyle = "#1f6f8f";
    g.fillRect(0, sy, MS, MS - sy);
    const [, by] = toPx(0, BEACH_ROAD + 7);
    g.fillStyle = "#e3cfa2";
    g.fillRect(0, by, MS, sy - by);
    g.fillStyle = "#8a7a5a";
    const [hx, hy] = toPx(hillCX, hillCZ);
    g.beginPath();
    g.ellipse(hx, hy, (hillR / 1400) * MS, (hillR / 0.8 / 1400) * MS, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#c9c4bb";
    for (const b of colliders) {
      const [a1, b1] = toPx(b.minX, b.minZ);
      const [a2, b2] = toPx(b.maxX, b.maxZ);
      g.fillRect(a1, b1, a2 - a1, b2 - b1);
    }
    g.strokeStyle = "#2b2b2b";
    g.lineWidth = (ROAD / 1400) * MS;
    for (const x of roadX) {
      const [px, p1] = toPx(x, Z0);
      const [, p2] = toPx(x, Z0 + NZ * PITCH);
      g.beginPath();
      g.moveTo(px, p1);
      g.lineTo(px, p2);
      g.stroke();
    }
    for (const z of roadZ) {
      const [p1, pz] = toPx(X0 - 400, z);
      const [p2] = toPx(-X0 + 400, z);
      g.beginPath();
      g.moveTo(z === roadZ[2] ? p1 : toPx(X0, z)[0], pz);
      g.lineTo(z === roadZ[2] ? p2 : toPx(-X0, z)[0], pz);
      g.stroke();
    }
    const [nx, n1] = toPx(roadX[3], Z0 - 400);
    const [, n2] = toPx(roadX[3], Z0);
    g.beginPath();
    g.moveTo(nx, n1);
    g.lineTo(nx, n2);
    g.stroke();
  }

  // ---------------------------------------------------------------- time of day
  const fog = new THREE.Fog(0x8899aa, 250, 1400);
  scene.fog = fog;
  let hour = 17.6; // golden hour start
  let envTimer = 0;
  const sunDir = new THREE.Vector3();
  const applyTime = () => {
    // map hour → sun elevation/azimuth; sunset over the sea to the south-west
    const dayT = (hour - 6) / 12; // 0 at sunrise, 1 at sunset
    const elev = Math.sin(dayT * Math.PI) * 62 - 4;
    const azim = 90 + dayT * 180;
    const phi = THREE.MathUtils.degToRad(90 - elev);
    const theta = THREE.MathUtils.degToRad(azim);
    sunDir.setFromSphericalCoords(1, phi, theta);
    su.sunPosition.value.copy(sunDir);
    skyEnv.material.uniforms.sunPosition.value.copy(sunDir);
    for (const k of ["turbidity", "rayleigh", "mieCoefficient", "mieDirectionalG"] as const)
      skyEnv.material.uniforms[k].value = su[k].value;
    (water.material as THREE.ShaderMaterial).uniforms.sunDirection.value.copy(sunDir).normalize();
    const day = THREE.MathUtils.clamp((elev + 4) / 14, 0, 1);
    const warm = 1 - THREE.MathUtils.clamp((elev - 2) / 25, 0, 1);
    sun.intensity = 3.4 * day;
    sun.color.setRGB(1, 0.82 + 0.18 * (1 - warm), 0.62 + 0.38 * (1 - warm));
    hemi.intensity = 0.25 + 0.75 * day;
    hemi.color.setRGB(0.55 + 0.2 * day, 0.6 + 0.25 * day, 0.85 + 0.1 * day);
    const night = 1 - day;
    for (const m of nightMats) m.emissiveIntensity = night * (m === lampHeadMat ? 3 : 0.75);
    renderer.toneMappingExposure = 0.62 + 0.38 * day;
    fog.color.setRGB(0.55 * day + 0.04, 0.6 * day + 0.05, 0.7 * day + 0.09);
  };
  const refreshEnv = () => {
    if (envRT) envRT.dispose();
    envRT = pmrem.fromScene(skyScene as unknown as THREE.Scene);
    scene.environment = envRT.texture;
  };
  applyTime();
  refreshEnv();

  return {
    colliders,
    circles,
    bounds: { minX: X0 - 400, maxX: -X0 + 400, minZ: Z0 - 400, maxZ: SEA_Z - 14 },
    sun,
    landmarks,
    minimapCanvas: mm,
    timeOfDay: () => hour,
    isNight: () => hour > 18.6 || hour < 5.6,
    setTimeOfDay: (h: number) => {
      hour = ((h % 24) + 24) % 24;
      applyTime();
      refreshEnv();
    },
    update: (dt, time, focus) => {
      (water.material as THREE.ShaderMaterial).uniforms.time.value = time * 0.6;
      // a full day takes 16 real minutes; nights pass a bit faster
      const night = hour > 19 || hour < 5;
      hour = (hour + (dt * 24) / (night ? 600 : 1080)) % 24;
      applyTime();
      envTimer += dt;
      if (envTimer > 8) {
        envTimer = 0;
        refreshEnv();
      }
      // shadow camera follows the action
      sun.position.copy(focus).addScaledVector(sunDir, 300);
      sun.target.position.copy(focus);
    },
  };
}
