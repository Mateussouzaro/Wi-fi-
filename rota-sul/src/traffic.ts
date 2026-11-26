import * as THREE from "three";
import { Car, CarInput } from "./car";
import { roadX, roadZ, NX, NZ } from "./world";
import type { Box, Circle } from "./world";

const LANE = 3.4;
const DIRS = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
];

// true right-hand vector for a travel direction (Brazil drives on the right)
const rightOf = (d: THREE.Vector3) => new THREE.Vector3(-d.z, 0, d.x);

export class Driver {
  car: Car;
  i = 0; // target intersection indices
  j = 0;
  dir = DIRS[0].clone();
  cruise = 11;
  stuckT = 0;
  reverseT = 0;
  police: boolean;
  wait = 0;

  constructor(car: Car, police = false) {
    this.car = car;
    this.police = police;
    this.cruise = police ? 24 : 9 + Math.random() * 5;
  }

  // Put the car on a random lane heading to a valid intersection.
  place(i: number, j: number, dirIdx: number) {
    let d = DIRS[dirIdx].clone();
    let ni = i + Math.round(d.x),
      nj = j + Math.round(d.z);
    if (ni < 0 || ni > NX || nj < 0 || nj > NZ) {
      d = d.multiplyScalar(-1);
      ni = i + Math.round(d.x);
      nj = j + Math.round(d.z);
    }
    this.dir = d;
    this.i = ni;
    this.j = nj;
    const from = new THREE.Vector3(roadX[i], 0, roadZ[j]);
    const to = new THREE.Vector3(roadX[ni], 0, roadZ[nj]);
    const p = from.lerp(to, 0.2 + Math.random() * 0.5).addScaledVector(rightOf(d), LANE);
    this.car.pos.copy(p);
    this.car.heading = Math.atan2(d.x, d.z);
    this.car.vel.copy(d).multiplyScalar(this.cruise * 0.6);
    this.car.sync(0);
  }

  laneTarget() {
    return new THREE.Vector3(roadX[this.i], 0, roadZ[this.j]).addScaledVector(rightOf(this.dir), LANE);
  }

  chooseNext(goal?: THREE.Vector3) {
    const opts = DIRS.filter((d) => {
      if (d.dot(this.dir) < -0.5) return false; // no U-turns
      const ni = this.i + Math.round(d.x),
        nj = this.j + Math.round(d.z);
      return ni >= 0 && ni <= NX && nj >= 0 && nj <= NZ;
    });
    if (!opts.length) {
      this.dir.multiplyScalar(-1);
    } else if (goal) {
      // police: pick the street that gets closest to the target
      let best = opts[0],
        bd = Infinity;
      for (const d of opts) {
        const ni = this.i + Math.round(d.x),
          nj = this.j + Math.round(d.z);
        const dd = Math.hypot(roadX[ni] - goal.x, roadZ[nj] - goal.z);
        if (dd < bd) {
          bd = dd;
          best = d;
        }
      }
      this.dir = best.clone();
    } else {
      const straight = opts.find((d) => d.dot(this.dir) > 0.5);
      this.dir = (straight && Math.random() < 0.55 ? straight : opts[Math.floor(Math.random() * opts.length)]).clone();
    }
    this.i += Math.round(this.dir.x);
    this.j += Math.round(this.dir.z);
  }

  update(dt: number, obstacles: { pos: THREE.Vector3; r: number }[], colliders: Box[], circles: Circle[], chase?: THREE.Vector3) {
    const c = this.car;
    let target = this.laneTarget();
    const fwd = new THREE.Vector3(Math.sin(c.heading), 0, Math.cos(c.heading));
    const toT = target.clone().sub(c.pos);
    // reached the intersection: pick the next street
    if (toT.length() < 7 || toT.dot(this.dir) < 0) {
      this.chooseNext(this.police ? chase : undefined);
      target = this.laneTarget();
    }
    let aim = target;
    let speedGoal = this.cruise;
    if (this.police && chase) {
      const d = chase.distanceTo(c.pos);
      if (d < 38) {
        aim = chase; // close enough: go straight for the suspect
        speedGoal = Math.min(this.cruise, 6 + d * 0.8);
      }
    } else {
      // slow down into corners
      const ahead = target.clone().sub(c.pos);
      if (ahead.length() < 20) speedGoal = Math.min(speedGoal, 7);
      // blend the aim point ahead along the lane to smooth the line
      const lane = c.pos.clone().addScaledVector(this.dir, 10);
      const lat = rightOf(this.dir);
      const want = target.clone();
      const off = lane.clone().sub(want).dot(lat);
      lane.addScaledVector(lat, -off);
      aim = ahead.length() > 14 ? lane : target;
    }
    // brake for anything in front
    if (!this.police) {
      for (const o of obstacles) {
        const rel = o.pos.clone().sub(c.pos);
        const along = rel.dot(fwd);
        if (along <= 0 || along > 13) continue;
        const side = Math.abs(rel.dot(new THREE.Vector3(fwd.z, 0, -fwd.x)));
        if (side < 1.6 + o.r) speedGoal = Math.min(speedGoal, Math.max(0, (along - 5) * 0.9));
      }
    }
    const want = aim.clone().sub(c.pos);
    let diff = Math.atan2(want.x, want.z) - c.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const vf = c.speed;
    const inp: CarInput = {
      steer: THREE.MathUtils.clamp(diff * 2.2, -1, 1),
      throttle: THREE.MathUtils.clamp((speedGoal - vf) * 0.35, -1, 1),
      handbrake: this.police && Math.abs(diff) > 1.2 && vf > 12,
    };
    // unstick
    if (this.reverseT > 0) {
      this.reverseT -= dt;
      inp.throttle = -1;
      inp.steer = -inp.steer;
    } else if (Math.abs(vf) < 0.8 && inp.throttle > 0.3) {
      this.stuckT += dt;
      if (this.stuckT > 1.8) {
        this.reverseT = 1.4;
        this.stuckT = 0;
      }
    } else this.stuckT = 0;
    c.update(dt, inp, colliders, circles);
  }
}
