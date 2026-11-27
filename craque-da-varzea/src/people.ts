import * as THREE from "three";
export function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const SKINS = [0x5c3a21, 0x8d5524, 0xa0673a, 0xc68642, 0xe0ac69, 0xf1c27d, 0x7a4a2b];
const HAIRS = [0x120c08, 0x1b120c, 0x3b2314, 0x6b4423, 0xc8a165];
const SHIRTS = [0xffdf00, 0x009c3b, 0x002776, 0xffffff, 0xd62828, 0x222222, 0xf77f00, 0x6a4c93, 0x1982c4, 0xe5e5e5, 0xff6fa5, 0x2ec4b6];
const PANTS = [0x1d3557, 0x222222, 0x6b705c, 0x3d405b, 0x8d99ae, 0xdda15e, 0x2b4162];

export interface HumanMesh {
  group: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  lArm: THREE.Group;
  rArm: THREE.Group;
  lLeg: THREE.Group;
  rLeg: THREE.Group;
  lFore: THREE.Group;
  rFore: THREE.Group;
  lShin: THREE.Group;
  rShin: THREE.Group;
}

const geoCache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry) {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}
// tapered limb segment hanging down from its joint
const seg = (r0: number, r1: number, len: number) =>
  cached(`seg${r0}_${r1}_${len}`, () => {
    const g = new THREE.CylinderGeometry(r0, r1, len, 12, 1);
    g.translate(0, -len / 2, 0);
    return g;
  });
const ball = (r: number) => cached(`ball${r}`, () => new THREE.SphereGeometry(r, 14, 10));

// Torso turned from a side profile (hips → waist → chest → shoulders), flattened front-to-back.
function torsoGeo(female: boolean) {
  return cached(`torso${female}`, () => {
    const prof: [number, number][] = female
      ? [[0.0, -0.1], [0.15, -0.09], [0.168, -0.02], [0.13, 0.12], [0.145, 0.26], [0.158, 0.34], [0.16, 0.42], [0.1, 0.5], [0.05, 0.52]]
      : [[0.0, -0.1], [0.14, -0.09], [0.15, -0.02], [0.138, 0.12], [0.16, 0.26], [0.178, 0.38], [0.18, 0.44], [0.11, 0.51], [0.055, 0.53]];
    const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 20);
    g.scale(1, 1, 0.64);
    return g;
  });
}

export interface HumanOpts {
  shirt?: number;
  pants?: number;
  skin?: number;
  cap?: number;
  female?: boolean;
  hair?: string;
  hairColor?: number;
  kit?: boolean; // football kit: tee, shorts, socks and boots
  socks?: number;
}
export function makeHuman(seed: number, opts: HumanOpts = {}): HumanMesh {
  const r = rng(seed * 97 + 11);
  const female = opts.female ?? r() < 0.45;
  const skinC = opts.skin ?? SKINS[Math.floor(r() * SKINS.length)];
  const skin = new THREE.MeshPhysicalMaterial({ color: skinC, roughness: 0.55, sheen: 0.3, sheenColor: new THREE.Color(0xffd0b0) });
  const shirtC = opts.shirt ?? SHIRTS[Math.floor(r() * SHIRTS.length)];
  const shirt = new THREE.MeshStandardMaterial({ color: shirtC, roughness: 0.92 });
  const pants = new THREE.MeshStandardMaterial({ color: opts.pants ?? PANTS[Math.floor(r() * PANTS.length)], roughness: 0.95 });
  const hairC = opts.hairColor ?? HAIRS[Math.floor(r() * HAIRS.length)];
  const hair = new THREE.MeshStandardMaterial({ color: hairC, roughness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.4 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.3 });
  const lips = new THREE.MeshStandardMaterial({ color: new THREE.Color(skinC).multiplyScalar(0.7), roughness: 0.5 });
  // clothing choices
  const top = opts.kit ? "tee" : female ? (r() < 0.35 ? "dress" : r() < 0.5 ? "tank" : "tee") : r() < 0.25 ? "selecao" : r() < 0.45 ? "tank" : "tee";
  const legs = opts.kit ? "shorts" : top === "dress" ? "bare" : r() < 0.55 ? "shorts" : "long";
  const feet = opts.kit ? "tenis" : r() < 0.45 ? "chinelo" : "tenis";
  const hairStyle = opts.hair ?? (opts.cap !== undefined ? "cap" : female ? (r() < 0.25 ? "afro" : r() < 0.6 ? "long" : "bun") : ["short", "buzz", "afro", "short", "bald"][Math.floor(r() * 5)]);
  const selecao = top === "selecao";
  if (selecao) shirt.color.set(0xffdf00);

  const group = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.93;
  group.add(hips);
  const torso = new THREE.Group();
  hips.add(torso);
  const tor = new THREE.Mesh(torsoGeo(female), shirt);
  torso.add(tor);
  if (legs !== "bare") {
    // waistband / pants top over the pelvis
    const pelvis = new THREE.Mesh(cached(`pelvis${female}`, () => {
      const g = new THREE.CylinderGeometry(female ? 0.162 : 0.148, female ? 0.15 : 0.142, 0.16, 18);
      g.scale(1, 1, 0.68);
      return g;
    }), pants);
    pelvis.position.y = -0.04;
    torso.add(pelvis);
  }
  if (selecao) {
    const collar = new THREE.Mesh(cached("collar", () => new THREE.TorusGeometry(0.07, 0.014, 6, 18)), new THREE.MeshStandardMaterial({ color: 0x009c3b }));
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.505;
    collar.scale.set(1, 0.8, 1);
    torso.add(collar);
  }
  if (top === "dress") {
    const skirt = new THREE.Mesh(cached("skirt", () => new THREE.CylinderGeometry(0.16, 0.27, 0.5, 18, 1, true)), new THREE.MeshStandardMaterial({ color: shirtC, roughness: 0.9, side: THREE.DoubleSide }));
    skirt.scale.set(1, 1, 0.75);
    skirt.position.y = -0.33;
    torso.add(skirt);
  }

  // neck + head
  const neck = new THREE.Mesh(seg(0.05, 0.055, 0.1), skin);
  neck.position.y = 0.6;
  torso.add(neck);
  const head = new THREE.Group();
  head.position.y = 0.66;
  torso.add(head);
  const skull = new THREE.Mesh(ball(0.1), skin);
  skull.scale.set(0.92, 1.12, 1.02);
  skull.position.y = 0.06;
  const jaw = new THREE.Mesh(ball(0.075), skin);
  jaw.scale.set(1, 0.9, 1);
  jaw.position.set(0, 0.0, 0.02);
  const nose = new THREE.Mesh(cached("nose", () => new THREE.ConeGeometry(0.018, 0.045, 8)), skin);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.05, 0.103);
  head.add(skull, jaw, nose);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(ball(0.025), skin);
    ear.scale.set(0.5, 1, 0.8);
    ear.position.set(sx * 0.092, 0.06, 0);
    const eye = new THREE.Mesh(ball(0.016), white);
    eye.position.set(sx * 0.036, 0.08, 0.088);
    const iris = new THREE.Mesh(ball(0.009), dark);
    iris.position.set(sx * 0.036, 0.08, 0.101);
    const brow = new THREE.Mesh(cached("brow", () => new THREE.BoxGeometry(0.035, 0.008, 0.01)), hair);
    brow.position.set(sx * 0.037, 0.105, 0.097);
    brow.rotation.z = sx * -0.12;
    head.add(ear, eye, iris, brow);
  }
  const mouth = new THREE.Mesh(cached("mouth", () => new THREE.BoxGeometry(0.04, 0.009, 0.01)), lips);
  mouth.position.set(0, 0.012, 0.09);
  head.add(mouth);
  // hair
  if (hairStyle === "cap") {
    const capMat = new THREE.MeshStandardMaterial({ color: opts.cap, roughness: 0.7 });
    const c = new THREE.Mesh(cached("capdome", () => new THREE.SphereGeometry(0.107, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)), capMat);
    c.position.y = 0.09;
    c.scale.set(0.98, 0.9, 1.04);
    const brim = new THREE.Mesh(cached("brim", () => new THREE.CylinderGeometry(0.075, 0.075, 0.012, 16, 1, false, -Math.PI / 2, Math.PI)), capMat);
    brim.position.set(0, 0.095, 0.08);
    brim.scale.set(1, 1, 1.4);
    head.add(c, brim);
  } else if (hairStyle !== "bald") {
    // hair cap tilted back: hairline above the brows in front, lower at the nape
    const cap = new THREE.Mesh(cached("haircap", () => new THREE.SphereGeometry(0.108, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)), hair);
    cap.position.set(0, 0.085, -0.006);
    cap.scale.set(0.95, hairStyle === "buzz" ? 1.0 : 1.12, 1.06);
    cap.rotation.x = -0.55;
    head.add(cap);
    if (hairStyle === "afro") {
      const a = new THREE.Mesh(ball(0.14), hair);
      a.position.set(0, 0.145, -0.06);
      a.scale.set(1.0, 0.92, 0.88);
      head.add(a);
    } else if (hairStyle === "long") {
      const back = new THREE.Mesh(cached("longhair", () => {
        const g = new THREE.CapsuleGeometry(0.09, 0.2, 4, 10);
        g.scale(1.05, 1, 0.55);
        return g;
      }), hair);
      back.position.set(0, -0.02, -0.06);
      head.add(back);
    } else if (hairStyle === "bun") {
      const bun = new THREE.Mesh(ball(0.045), hair);
      bun.position.set(0, 0.15, -0.07);
      head.add(bun);
    }
  }

  // arms: shoulder → upper arm → elbow → forearm → hand
  const sleeve = top === "tee" || selecao;
  const makeArm = (sx: number) => {
    const arm = new THREE.Group();
    arm.position.set(sx * (female ? 0.175 : 0.19), 0.45, 0);
    const shoulder = new THREE.Mesh(ball(0.055), top === "tank" || top === "dress" ? skin : shirt);
    arm.add(shoulder);
    const upper = new THREE.Mesh(seg(0.047, 0.04, 0.28), skin);
    arm.add(upper);
    if (sleeve) {
      const sl = new THREE.Mesh(seg(0.058, 0.052, 0.13), shirt);
      arm.add(sl);
    }
    const fore = new THREE.Group();
    fore.position.y = -0.28;
    arm.add(fore);
    fore.add(new THREE.Mesh(ball(0.04), skin));
    fore.add(new THREE.Mesh(seg(0.039, 0.03, 0.25), skin));
    const hand = new THREE.Mesh(ball(0.042), skin);
    hand.scale.set(0.7, 1.3, 0.45);
    hand.position.y = -0.29;
    fore.add(hand);
    arm.rotation.z = sx * 0.06;
    return { arm, fore };
  };
  const L = makeArm(-1),
    R = makeArm(1);
  torso.add(L.arm, R.arm);

  // legs: hip → thigh → knee → shin → foot
  const shoeMat = new THREE.MeshStandardMaterial({ color: feet === "chinelo" ? [0x1e88e5, 0x43a047, 0xfdd835, 0xffffff][Math.floor(r() * 4)] : r() < 0.5 ? 0xf2f2f2 : 0x1b1b1b, roughness: 0.6 });
  const makeLeg = (sx: number) => {
    const leg = new THREE.Group();
    leg.position.set(sx * (female ? 0.09 : 0.088), -0.02, 0);
    const thighMat = legs === "bare" ? skin : pants;
    leg.add(new THREE.Mesh(seg(female ? 0.082 : 0.078, 0.058, 0.43), thighMat));
    const shin = new THREE.Group();
    shin.position.y = -0.43;
    leg.add(shin);
    shin.add(new THREE.Mesh(ball(0.056), legs === "long" ? pants : skin));
    const sockMat = opts.kit ? new THREE.MeshStandardMaterial({ color: opts.socks ?? 0xffffff, roughness: 0.9 }) : null;
    shin.add(new THREE.Mesh(seg(0.055, 0.038, 0.42), sockMat ?? (legs === "long" ? pants : skin)));
    if (legs === "shorts") {
      const hem = new THREE.Mesh(seg(0.072, 0.07, 0.08), pants);
      hem.position.y = 0.02;
      shin.add(hem);
    }
    const foot = new THREE.Group();
    foot.position.y = -0.45;
    shin.add(foot);
    if (feet === "chinelo") {
      const sole = new THREE.Mesh(cached("sole", () => new THREE.BoxGeometry(0.095, 0.018, 0.25)), shoeMat);
      sole.position.set(0, -0.02, 0.05);
      const f = new THREE.Mesh(ball(0.042), skin);
      f.scale.set(0.95, 0.5, 2.3);
      f.position.set(0, 0.01, 0.05);
      const strap = new THREE.Mesh(cached("strap", () => new THREE.TorusGeometry(0.035, 0.007, 4, 10, Math.PI)), shoeMat);
      strap.position.set(0, 0.0, 0.08);
      strap.rotation.x = -0.4;
      foot.add(sole, f, strap);
    } else {
      const shoe = new THREE.Mesh(cached("shoe", () => {
        const g = new THREE.CapsuleGeometry(0.048, 0.15, 4, 10);
        g.rotateX(Math.PI / 2);
        g.scale(1, 0.7, 1);
        return g;
      }), shoeMat);
      shoe.position.set(0, 0.0, 0.05);
      foot.add(shoe);
    }
    return { leg, shin };
  };
  const LL = makeLeg(-1),
    RL = makeLeg(1);
  hips.add(LL.leg, RL.leg);
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
  });
  const sc = female ? 0.95 + r() * 0.06 : 0.98 + r() * 0.08;
  group.scale.setScalar(sc);
  return { group, hips, torso, lArm: L.arm, rArm: R.arm, lFore: L.fore, rFore: R.fore, lLeg: LL.leg, rLeg: RL.leg, lShin: LL.shin, rShin: RL.shin };
}

// Procedural walk/run cycle with knees and elbows. amount 0 = idle, 1 = walk, 2 = sprint.
export function animateHuman(h: HumanMesh, phase: number, amount: number, t: number) {
  const a = Math.min(amount, 2);
  const w = Math.min(a, 1);
  const run = Math.max(0, a - 1);
  const swing = 0.5 * w + 0.35 * run;
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  // thighs swing opposite; the knee bends while the leg passes under the body
  h.lLeg.rotation.x = -s * swing;
  h.rLeg.rotation.x = s * swing;
  h.lShin.rotation.x = (0.08 + Math.max(0, c) * (0.75 * w + 0.7 * run)) * (a > 0.05 ? 1 : 0.3);
  h.rShin.rotation.x = (0.08 + Math.max(0, -c) * (0.75 * w + 0.7 * run)) * (a > 0.05 ? 1 : 0.3);
  // arms counter-swing, elbows bent more when running
  h.lArm.rotation.x = s * swing * 0.8;
  h.rArm.rotation.x = -s * swing * 0.8;
  h.lFore.rotation.x = -(0.18 + 0.35 * w + 0.9 * run) - Math.max(0, s) * 0.2 * w;
  h.rFore.rotation.x = -(0.18 + 0.35 * w + 0.9 * run) - Math.max(0, -s) * 0.2 * w;
  // body bob, sway, breathing and forward lean
  h.hips.position.y = 0.93 - Math.abs(s) * 0.025 * w + Math.abs(c) * 0.035 * run + (a < 0.05 ? Math.sin(t * 2) * 0.004 : 0);
  h.hips.rotation.y = s * 0.12 * w;
  h.torso.rotation.y = -s * 0.2 * w;
  h.torso.rotation.x = 0.03 + 0.22 * run;
  h.torso.rotation.z = c * 0.03 * w;
}

