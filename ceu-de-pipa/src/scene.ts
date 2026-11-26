import * as THREE from "three";
import * as A from "./art";

// The world: a beach avenue seen in first person. Wind blows toward +z (out to sea),
// so kites fly over the sand and water in front of the player.

export interface Stage {
  update: (t: number) => void;
  flyerSpots: THREE.Vector3[];
  wires: { a: THREE.Vector3; b: THREE.Vector3 }[];
}

export function buildStage(scene: THREE.Scene, quality: "alta" | "baixa"): Stage {
  const r = A.rng(7);

  // sky dome
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { sunDir: { value: new THREE.Vector3(-0.3, 0.55, 0.78).normalize() } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vDir; uniform vec3 sunDir;
      void main(){
        float h = clamp(vDir.y, -0.1, 1.0);
        vec3 zen = vec3(0.0, 0.33, 0.86);
        vec3 hor = vec3(0.55, 0.82, 0.98);
        vec3 col = mix(hor, zen, pow(max(h,0.0), 0.55));
        float s = max(dot(normalize(vDir), sunDir), 0.0);
        col += vec3(1.0,0.95,0.8) * (pow(s, 600.0) * 3.0 + pow(s, 12.0) * 0.18);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), skyMat));

  const sun = new THREE.DirectionalLight(0xfff4e0, 2.6);
  sun.position.set(-60, 120, 160);
  sun.castShadow = quality === "alta";
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, far: 400 });
  scene.add(sun, new THREE.HemisphereLight(0xcfe8ff, 0xd9c08a, 1.0));

  // clouds (billboards high up)
  const cloudMats = [1, 2, 3, 4].map((s) => new THREE.SpriteMaterial({ map: A.cloud(s * 31), transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
  const clouds: THREE.Sprite[] = [];
  for (let i = 0; i < 26; i++) {
    const sp = new THREE.Sprite(cloudMats[i % 4]);
    const a = r() * Math.PI - Math.PI / 2;
    const d = 400 + r() * 900;
    sp.position.set(Math.sin(a) * d, 120 + r() * 380, Math.cos(a) * d * 0.9 + 100);
    sp.scale.set(260 + r() * 300, 90 + r() * 90, 1);
    scene.add(sp);
    clouds.push(sp);
  }

  // road along x, player stands at its edge (z = 0)
  const roadT = A.asphalt();
  roadT.repeat.set(1, 60);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(9, 900), new THREE.MeshStandardMaterial({ map: roadT, roughness: 0.95 }));
  road.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  road.position.set(0, 0, -3.5);
  road.receiveShadow = true;
  scene.add(road);
  const curb = new THREE.Mesh(new THREE.BoxGeometry(900, 0.18, 2.2), new THREE.MeshStandardMaterial({ color: 0xcfc8b8, roughness: 0.9 }));
  curb.position.set(0, 0.09, 2.1);
  curb.receiveShadow = true;
  scene.add(curb);

  // sand and sea
  const sandT = A.sand();
  sandT.repeat.set(80, 30);
  const sandM = new THREE.Mesh(new THREE.PlaneGeometry(1200, 260), new THREE.MeshStandardMaterial({ map: sandT, roughness: 1 }));
  sandM.rotation.x = -Math.PI / 2;
  sandM.position.set(0, 0.02, 3.2 + 130);
  sandM.receiveShadow = true;
  scene.add(sandM);
  const seaMat = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 } },
    vertexShader: `varying vec3 wp; void main(){ vec4 w = modelMatrix * vec4(position,1.0); wp = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying vec3 wp; uniform float t;
      void main(){
        float d = length(wp.xz - cameraPosition.xz);
        float w = sin(wp.x*0.08 + t*0.9)*0.5 + sin(wp.z*0.13 - t*1.3 + wp.x*0.03)*0.5;
        vec3 deep = vec3(0.02,0.36,0.55);
        vec3 shallow = vec3(0.12,0.72,0.72);
        float near = smoothstep(260.0, 120.0, wp.z);
        vec3 col = mix(deep, shallow, near*0.7);
        col += vec3(0.9,0.95,1.0) * smoothstep(0.85, 1.0, w) * 0.25;
        col = mix(col, vec3(0.6,0.85,0.97), smoothstep(400.0, 2200.0, d));
        // foam where the waves break
        float foam = smoothstep(10.0, 0.0, abs(wp.z - 262.0 - sin(wp.x*0.05+t)*3.0));
        col = mix(col, vec3(1.0), foam*0.8);
        gl_FragColor = vec4(col,1.0);
      }`,
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(6000, 3000), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.05, 260 + 1500);
  scene.add(sea);

  // palms
  const trunkG = new THREE.CylinderGeometry(0.16, 0.3, 10, 8, 6);
  const tp = trunkG.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i) + 5;
    tp.setX(i, tp.getX(i) + Math.pow(y / 10, 2) * 1.2); // natural lean
  }
  trunkG.translate(0, 5, 0);
  trunkG.computeVertexNormals();
  const frondG = new THREE.PlaneGeometry(1.1, 5.5, 1, 6);
  const fp = frondG.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < fp.count; i++) {
    const y = fp.getY(i) + 2.75;
    fp.setXYZ(i, fp.getX(i) * (1 - y / 6.2), -0.07 * y * y, y);
  }
  frondG.computeVertexNormals();
  const palmSpots: THREE.Vector3[] = [];
  for (let x = -300; x < 300; x += 16 + r() * 10) if (Math.abs(x) > 14) palmSpots.push(new THREE.Vector3(x, 0, 6 + r() * 3));
  for (let i = 0; i < 70; i++) palmSpots.push(new THREE.Vector3((r() - 0.5) * 500, 0, 20 + r() * 200));
  const trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0x8a7558, roughness: 1 }), palmSpots.length);
  const fronds = new THREE.InstancedMesh(frondG, new THREE.MeshStandardMaterial({ color: 0x2e8b3a, roughness: 0.8, side: THREE.DoubleSide }), palmSpots.length * 11);
  const dm = new THREE.Object3D();
  let f = 0;
  palmSpots.forEach((p, k) => {
    const s = 0.8 + r() * 0.5;
    dm.position.copy(p);
    dm.rotation.set(0, r() * Math.PI * 2, 0);
    dm.scale.setScalar(s);
    dm.updateMatrix();
    trunks.setMatrixAt(k, dm.matrix);
    const top = new THREE.Vector3(1.2, 10, 0).applyEuler(dm.rotation).multiplyScalar(s).add(p);
    for (let q = 0; q < 11; q++) {
      dm.position.copy(top);
      dm.rotation.set(0, (q / 11) * Math.PI * 2 + r() * 0.3, 0);
      dm.scale.setScalar(s * (0.8 + r() * 0.4));
      dm.updateMatrix();
      fronds.setMatrixAt(f++, dm.matrix);
    }
  });
  trunks.castShadow = fronds.castShadow = true;
  scene.add(trunks, fronds);

  // houses with lajes (flat roofs) behind the road, on both sides of the street
  const wallMats = Array.from({ length: 8 }, (_, i) => new THREE.MeshStandardMaterial({ map: A.wall(40 + i * 9), roughness: 0.9 }));
  const slab = new THREE.MeshStandardMaterial({ color: 0x9a968e, roughness: 1 });
  const tank = new THREE.MeshStandardMaterial({ color: 0x2f6fb5, roughness: 0.5 });
  const flyerSpots: THREE.Vector3[] = [];
  for (let x = -260; x < 260; x += 8 + r() * 4) {
    const w = 6 + r() * 3,
      d = 8 + r() * 4,
      h = 3 * (1 + Math.floor(r() * 3));
    const m = wallMats[Math.floor(r() * wallMats.length)];
    const house = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [m, m, slab, slab, m, m]);
    house.position.set(x, h / 2, -12 - d / 2 - r() * 3);
    house.castShadow = true;
    scene.add(house);
    if (r() < 0.5) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.7, 1.2, 12), tank);
      t.position.set(x + (r() - 0.5) * 2, h + 0.6, house.position.z + (r() - 0.5) * 2);
      scene.add(t);
    }
    if (Math.abs(x) > 15 && r() < 0.18) flyerSpots.push(new THREE.Vector3(x, h + 1.5, house.position.z + d / 2 - 1));
  }
  // flyers on the sand too
  for (let i = 0; i < 10; i++) flyerSpots.push(new THREE.Vector3((r() - 0.5) * 240, 1.5, 25 + r() * 70));

  // power poles and wires along the road
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x8d8a83, roughness: 0.9 });
  const wireMat = new THREE.LineBasicMaterial({ color: 0x111111 });
  const wires: Stage["wires"] = [];
  const poles: THREE.Vector3[] = [];
  for (let x = -280; x <= 280; x += 35) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 10, 8), poleMat);
    p.position.set(x, 5, -8.5);
    p.castShadow = true;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2.2), poleMat);
    arm.position.set(x, 9.3, -8.5);
    scene.add(p, arm);
    poles.push(new THREE.Vector3(x, 9.3, -8.5));
  }
  for (let k = 0; k + 1 < poles.length; k++)
    for (const dz of [-0.9, 0, 0.9]) {
      const a = poles[k].clone().add(new THREE.Vector3(0, 0.05, dz));
      const b = poles[k + 1].clone().add(new THREE.Vector3(0, 0.05, dz));
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 16; i++) {
        const u = i / 16;
        pts.push(a.clone().lerp(b, u).add(new THREE.Vector3(0, -Math.sin(u * Math.PI) * 0.9, 0)));
      }
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
      wires.push({ a, b });
    }

  // beach kiosk + a few umbrellas for scale
  const kiosk = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 4), new THREE.MeshStandardMaterial({ color: 0x6a4c93 }));
  kiosk.position.set(-26, 1.5, 12);
  kiosk.castShadow = true;
  scene.add(kiosk);
  const umbCols = [0xe63946, 0xf4a261, 0x2a9d8f, 0xe9c46a, 0xffffff];
  for (let i = 0; i < 40; i++) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 6), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
    pole.position.y = 1.15;
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.5, 12), new THREE.MeshStandardMaterial({ color: umbCols[i % 5], side: THREE.DoubleSide }));
    top.position.y = 2.3;
    g.add(pole, top);
    g.position.set((r() - 0.5) * 300, 0, 30 + r() * 200);
    scene.add(g);
  }

  scene.fog = new THREE.Fog(0xa9dcf5, 300, 2600);

  return {
    flyerSpots,
    wires,
    update: (t) => {
      seaMat.uniforms.t.value = t;
      for (const c of clouds) c.position.x += 0.6 * (1 / 60);
    },
  };
}
