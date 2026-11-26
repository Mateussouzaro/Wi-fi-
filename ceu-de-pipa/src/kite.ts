import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { kiteTexture } from "./art";

export const WIND = new THREE.Vector3(0.15, 0, 1).normalize();
const UP = new THREE.Vector3(0, 1, 0);
export const LINE_PTS = 30;
export const lineMats: LineMaterial[] = [];

function lineMat(color: number, width: number, vertexColors = false) {
  const m = new LineMaterial({ color: vertexColors ? 0xffffff : color, linewidth: width, vertexColors, transparent: true, depthWrite: false });
  m.resolution.set(innerWidth, innerHeight);
  lineMats.push(m);
  return m;
}

function makeLine(mat: LineMaterial, n: number) {
  const g = new LineGeometry();
  g.setPositions(new Float32Array(n * 3));
  const l = new Line2(g, mat);
  l.frustumCulled = false;
  return l;
}

function setLine(l: Line2, pts: THREE.Vector3[]) {
  const arr: number[] = [];
  for (const p of pts) arr.push(p.x, p.y, p.z);
  (l.geometry as LineGeometry).setPositions(arr);
}

export type KiteState = "flying" | "loose" | "gone";

export class Kite {
  design: number;
  mesh = new THREE.Group();
  line: Line2;
  tail: Line2;
  looseLine: Line2;
  anchor = new THREE.Vector3();
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  L = 60;
  theta = 0;
  spinDir = 1;
  pulling = false;
  releasing = false;
  reeling = false;
  state: KiteState = "flying";
  linePts: THREE.Vector3[] = [];
  tailPts: THREE.Vector3[] = [];
  chain: THREE.Vector3[] = []; // loose line hanging under a cut kite
  chainPrev: THREE.Vector3[] = [];
  damage = 0;
  color: number;
  isPlayer: boolean;
  goneT = 0;
  // AI
  aiTarget = new THREE.Vector3();
  aiT = 0;
  aggression = 0.5;

  constructor(scene: THREE.Scene, design: number, color: number, isPlayer: boolean) {
    this.design = design;
    this.color = color;
    this.isPlayer = isPlayer;
    const S = 1.1;
    const geo = new THREE.PlaneGeometry(S, S);
    geo.rotateZ(Math.PI / 4); // diamond: corner (nose) points +Y
    const face = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: kiteTexture(design), side: THREE.DoubleSide, roughness: 0.7, transparent: true, alphaTest: 0.05 }));
    this.mesh.add(face);
    const spar = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
    const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, S * 1.41, 0.02), spar);
    const s2 = new THREE.Mesh(new THREE.BoxGeometry(S * 1.0, 0.02, 0.02), spar);
    s2.position.y = 0.12;
    this.mesh.add(s1, s2);
    this.mesh.scale.setScalar(isPlayer ? 1.2 : 1.1);
    scene.add(this.mesh);
    this.line = makeLine(lineMat(isPlayer ? 0xffffff : color, isPlayer ? 2.6 : 1.8), LINE_PTS);
    const tm = lineMat(color, isPlayer ? 3.2 : 2.6);
    this.tail = makeLine(tm, 14);
    this.looseLine = makeLine(lineMat(isPlayer ? 0xffffff : color, 1.6), 18);
    this.looseLine.visible = false;
    scene.add(this.line, this.tail, this.looseLine);
    for (let i = 0; i < LINE_PTS; i++) this.linePts.push(new THREE.Vector3());
    for (let i = 0; i < 14; i++) this.tailPts.push(new THREE.Vector3());
  }

  launch(anchor: THREE.Vector3, L: number) {
    this.anchor.copy(anchor);
    this.L = L;
    this.pos.copy(anchor).addScaledVector(WIND, L * 0.6).add(new THREE.Vector3(0, L * 0.75, 0));
    this.pos.sub(anchor).setLength(L * 0.98).add(anchor);
    this.vel.set(0, 0, 0);
    this.state = "flying";
    this.damage = 0;
    this.theta = 0;
    this.mesh.visible = this.line.visible = this.tail.visible = true;
    this.looseLine.visible = false;
    for (const p of this.tailPts) p.copy(this.pos);
  }

  frame() {
    const r = this.pos.clone().sub(this.anchor).normalize();
    const u = UP.clone().addScaledVector(r, -r.dot(UP)).normalize();
    const v = new THREE.Vector3().crossVectors(r, u).normalize();
    const n = u.clone().multiplyScalar(Math.cos(this.theta)).addScaledVector(v, Math.sin(this.theta));
    return { r, u, v, n };
  }

  update(dt: number, t: number) {
    if (this.state === "gone") return;
    if (this.state === "loose") return this.updateLoose(dt, t);
    const { r, n } = this.frame();
    const dist = this.pos.distanceTo(this.anchor);
    const taut = dist > this.L * 0.985;
    const acc = new THREE.Vector3(0, -2.6, 0);
    if (this.releasing) {
      this.L = Math.min(this.L + 16 * dt, 420);
      acc.addScaledVector(WIND, 7).y += 2.5; // slack line: the wind carries the kite away and up
    } else if (this.reeling) {
      this.L = Math.max(10, this.L - 11 * dt);
    }
    // wind window: a kite only has power downwind of the flyer; overhead or behind it
    // loses lift and the wind pushes it back out in front
    const win = THREE.MathUtils.clamp((r.dot(WIND) + 0.15) / 0.85, 0, 1);
    acc.addScaledVector(WIND, 5 * (1 - win));
    if (this.pulling && taut) {
      acc.addScaledVector(n, 26 * (0.2 + 0.8 * win)); // the kite shoots where its nose points
      this.theta += Math.sin(t * 9) * 0.6 * dt; // small wobble
    } else {
      // free kite turns in circles and glides with the wind
      this.theta += this.spinDir * 2.9 * dt;
      acc.y += 1.6;
      acc.addScaledVector(WIND, 2.2);
    }
    this.vel.addScaledVector(acc, dt);
    this.vel.multiplyScalar(Math.exp(-1.3 * dt));
    this.pos.addScaledVector(this.vel, dt);
    const nd = this.pos.distanceTo(this.anchor);
    if (nd > this.L) {
      this.pos.sub(this.anchor).setLength(this.L).add(this.anchor);
      const rr = this.pos.clone().sub(this.anchor).normalize();
      const vr = this.vel.dot(rr);
      if (vr > 0) this.vel.addScaledVector(rr, -vr);
    }
    if (this.pos.y < 1.5) {
      // hit the ground
      this.pos.y = 1.5;
      this.vel.multiplyScalar(0.3);
    }
    // line: quadratic curve that sags when slack, straight under tension
    const slack = Math.max(0, this.L - nd);
    const sag = slack * 0.5 + nd * (this.pulling ? 0.01 : 0.045);
    const mid = this.anchor.clone().add(this.pos).multiplyScalar(0.5).add(new THREE.Vector3(0, -sag, 0)).addScaledVector(WIND, sag * 0.35);
    for (let i = 0; i < LINE_PTS; i++) {
      const s = i / (LINE_PTS - 1);
      const a = (1 - s) * (1 - s),
        b = 2 * (1 - s) * s,
        c = s * s;
      this.linePts[i].set(0, 0, 0).addScaledVector(this.anchor, a).addScaledVector(mid, b).addScaledVector(this.pos, c);
    }
    setLine(this.line, this.linePts);
    this.orient(r, n);
    this.updateTail(dt);
  }

  orient(r: THREE.Vector3, n: THREE.Vector3) {
    const z = r.clone().negate(); // face the flyer
    const y = n.clone();
    const x = new THREE.Vector3().crossVectors(y, z).normalize();
    const m = new THREE.Matrix4().makeBasis(x, y, z);
    this.mesh.quaternion.setFromRotationMatrix(m);
    this.mesh.position.copy(this.pos);
  }

  updateTail(dt: number) {
    // rope that trails behind the kite's bottom corner
    const { n } = this.frame();
    const base = this.pos.clone().addScaledVector(n, -0.75);
    this.tailPts[0].copy(base);
    for (let i = 1; i < this.tailPts.length; i++) {
      const p = this.tailPts[i];
      p.y -= 1.2 * dt;
      p.addScaledVector(WIND, 2.4 * dt);
      const prev = this.tailPts[i - 1];
      const d = p.clone().sub(prev);
      d.setLength(0.42);
      p.copy(prev).add(d);
    }
    setLine(this.tail, this.tailPts);
  }

  // Cut the line at point index k: the kite flies loose dragging what is left of its line.
  cut(k: number) {
    this.state = "loose";
    this.line.visible = false;
    const pts = this.linePts.slice(k);
    this.chain = [];
    for (let i = 0; i < 18; i++) {
      const p = pts[Math.floor((i / 17) * (pts.length - 1))].clone();
      this.chain.push(p);
    }
    this.chain.reverse(); // chain[0] at the kite
    this.chainPrev = this.chain.map((p) => p.clone());
    this.looseLine.visible = true;
    this.spinDir = Math.random() < 0.5 ? 1 : -1;
    this.goneT = 0;
  }

  updateLoose(dt: number, t: number) {
    this.goneT += dt;
    // pipa voada: drifts downwind, slowly sinking and spinning
    const acc = new THREE.Vector3(0, -1.3, 0).addScaledVector(WIND, 2.2);
    acc.x += Math.sin(t * 0.7 + this.design) * 0.6;
    this.vel.addScaledVector(acc, dt).multiplyScalar(Math.exp(-0.9 * dt));
    this.pos.addScaledVector(this.vel, dt);
    this.theta += this.spinDir * 3.5 * dt;
    const { r, n } = this.frame();
    this.orient(r, n);
    this.updateTail(dt);
    // verlet rope: the dangling line
    const seg = 3.2;
    this.chain[0].copy(this.pos);
    for (let i = 1; i < this.chain.length; i++) {
      const p = this.chain[i],
        q = this.chainPrev[i];
      const nx = p.clone().multiplyScalar(2).sub(q).add(new THREE.Vector3(Math.sin(t * 2 + i) * 0.4, -3.0, 0.6).multiplyScalar(dt * dt));
      q.copy(p);
      p.copy(nx);
    }
    for (let it = 0; it < 3; it++)
      for (let i = 1; i < this.chain.length; i++) {
        const a = this.chain[i - 1],
          b = this.chain[i];
        const d = b.clone().sub(a);
        const l = d.length() || 1;
        const corr = d.multiplyScalar((l - seg) / l);
        if (i === 1) b.sub(corr);
        else {
          a.addScaledVector(corr, 0.5);
          b.addScaledVector(corr, -0.5);
        }
      }
    this.chain[0].copy(this.pos);
    setLine(this.looseLine, this.chain);
    if (this.pos.y < 2 || this.goneT > 40) this.vanish();
  }

  vanish() {
    this.state = "gone";
    this.mesh.visible = this.line.visible = this.tail.visible = this.looseLine.visible = false;
  }

  // AI: choose a point in the sky and only pull when the nose points that way (like a real flyer).
  ai(dt: number, playerKite: Kite | null) {
    if (this.state !== "flying") return;
    this.aiT -= dt;
    if (this.aiT <= 0) {
      this.aiT = 2 + Math.random() * 3;
      if (playerKite && playerKite.state === "flying" && Math.random() < this.aggression) {
        // go for the player's line, a little below their kite
        const k = Math.floor(LINE_PTS * (0.6 + Math.random() * 0.3));
        this.aiTarget.copy(playerKite.linePts[k]).add(new THREE.Vector3((Math.random() - 0.5) * 10, 4, 0));
      } else {
        const ang = (Math.random() - 0.5) * 1.6;
        const el = 0.5 + Math.random() * 0.7;
        const dir = new THREE.Vector3(Math.sin(ang) * Math.cos(el), Math.sin(el), Math.cos(ang) * Math.cos(el));
        this.aiTarget.copy(this.anchor).addScaledVector(dir, this.L);
      }
      this.releasing = this.L < 70 && Math.random() < 0.4;
    }
    if (this.releasing && this.L > 110) this.releasing = false;
    const { u, v, n } = this.frame();
    const want = this.aiTarget.clone().sub(this.pos);
    const dir = new THREE.Vector3(want.dot(v), want.dot(u), 0).normalize();
    const nose = new THREE.Vector3(n.dot(v), n.dot(u), 0).normalize();
    const ang = Math.acos(THREE.MathUtils.clamp(dir.dot(nose), -1, 1));
    // keep the kite up: pull when pointing toward the target, or when it is sinking low
    this.pulling = ang < 0.45 || (this.pos.y - this.anchor.y < this.L * 0.25 && nose.y > 0.5);
  }
}

// Closest approach between two polylines: distance, the segment index on each, and the point.
// Allocation-free scalar math because it runs thousands of times per frame on phones.
export function lineContact(a: THREE.Vector3[], b: THREE.Vector3[]) {
  let best = Infinity,
    ia = 0,
    ib = 0,
    px = 0,
    py = 0,
    pz = 0;
  for (let i = 1; i < a.length; i++) {
    const p1 = a[i - 1],
      q1 = a[i];
    const d1x = q1.x - p1.x,
      d1y = q1.y - p1.y,
      d1z = q1.z - p1.z;
    const A = d1x * d1x + d1y * d1y + d1z * d1z;
    for (let j = 1; j < b.length; j++) {
      const p2 = b[j - 1],
        q2 = b[j];
      // quick reject on the y/x extents
      if (Math.max(p1.y, q1.y) + 2 < Math.min(p2.y, q2.y) || Math.max(p2.y, q2.y) + 2 < Math.min(p1.y, q1.y)) continue;
      if (Math.max(p1.x, q1.x) + 2 < Math.min(p2.x, q2.x) || Math.max(p2.x, q2.x) + 2 < Math.min(p1.x, q1.x)) continue;
      const d2x = q2.x - p2.x,
        d2y = q2.y - p2.y,
        d2z = q2.z - p2.z;
      const rx = p1.x - p2.x,
        ry = p1.y - p2.y,
        rz = p1.z - p2.z;
      const E = d2x * d2x + d2y * d2y + d2z * d2z;
      const F = d2x * rx + d2y * ry + d2z * rz;
      const C = d1x * rx + d1y * ry + d1z * rz;
      const B = d1x * d2x + d1y * d2y + d1z * d2z;
      const den = A * E - B * B;
      let sP = den > 1e-8 ? Math.min(1, Math.max(0, (B * F - C * E) / den)) : 0;
      let tP = (B * sP + F) / E;
      if (tP < 0) {
        tP = 0;
        sP = Math.min(1, Math.max(0, -C / A));
      } else if (tP > 1) {
        tP = 1;
        sP = Math.min(1, Math.max(0, (B - C) / A));
      }
      const cx = p1.x + d1x * sP,
        cy = p1.y + d1y * sP,
        cz = p1.z + d1z * sP;
      const ex = p2.x + d2x * tP - cx,
        ey = p2.y + d2y * tP - cy,
        ez = p2.z + d2z * tP - cz;
      const d = ex * ex + ey * ey + ez * ez;
      if (d < best) {
        best = d;
        ia = i;
        ib = j;
        px = cx;
        py = cy;
        pz = cz;
      }
    }
  }
  return { d: Math.sqrt(best), ia, ib, point: new THREE.Vector3(px, py, pz) };
}
