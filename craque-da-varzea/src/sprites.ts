import * as THREE from "three";

// Hand-style pixel-art footballers generated in code: chunky proportions, dark outline,
// team kit with the number on the back. One sheet per player with 3 views × 6 frames.

export interface Look {
  skin: number;
  hair: string; // short | buzz | afro | bald | long
  hairColor: number;
  shirt: number;
  shirt2: number; // sleeves/trim
  shorts: number;
  socks: number;
  boots: number;
  number: number;
  gk?: boolean;
}

const CW = 32,
  CH = 48; // cell size in pixels
export const VIEWS = ["back", "front", "side"] as const;
export const FRAMES = 6; // 0 idle, 1-4 run, 5 kick

const css = (c: number) => "#" + c.toString(16).padStart(6, "0");
const shade = (c: number, k: number) => {
  const r = Math.min(255, Math.max(0, ((c >> 16) & 255) * k)),
    g = Math.min(255, Math.max(0, ((c >> 8) & 255) * k)),
    b = Math.min(255, Math.max(0, (c & 255) * k));
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
};

// 3×5 digits for shirt numbers
const DIG: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"], "1": ["010", "110", "010", "010", "111"], "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"], "4": ["101", "101", "111", "001", "001"], "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"], "7": ["111", "001", "010", "010", "010"], "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
};

function drawCell(g: CanvasRenderingContext2D, ox: number, oy: number, view: (typeof VIEWS)[number], frame: number, L: Look) {
  const px = (x: number, y: number, w: number, h: number, c: number) => {
    g.fillStyle = css(c);
    g.fillRect(ox + x, oy + y, w, h);
  };
  const run = frame >= 1 && frame <= 4;
  const phase = frame - 1; // 0..3
  const bob = run && (phase === 1 || phase === 3) ? 1 : 0;
  const kick = frame === 5;
  const y0 = 2 + bob;
  const skinS = shade(L.skin, 0.8);
  const shirtS = shade(L.shirt, 0.75);
  const shortsS = shade(L.shorts, 0.75);

  if (view === "side") {
    // ---- legs (side): swing forward/back
    const fwd = kick ? 7 : run ? [4, 0, -4, 0][phase] : 0;
    const back = kick ? -3 : -fwd;
    const leg = (dx: number, lift: number, dark: boolean) => {
      const x = 14 + dx;
      px(x, 30 + y0 - 2 - lift, 4, 6, dark ? shade(L.skin, 0.75) : L.skin);
      px(x, 36 + y0 - 2 - lift, 4, 5, dark ? shade(L.socks, 0.75) : L.socks);
      px(x - 1 + (dx > 0 ? 1 : 0), 41 + y0 - 2 - lift, 6, 2, dark ? shade(L.boots, 0.7) : L.boots);
    };
    leg(back, run && back > 0 ? 2 : 0, true);
    leg(fwd, run && fwd > 0 ? 2 : kick ? 4 : 0, false);
    // shorts
    px(11, 24 + y0, 10, 6, L.shorts);
    px(11, 28 + y0, 10, 2, shortsS);
    // torso
    px(11, 12 + y0, 10, 13, L.shirt);
    px(11, 12 + y0, 3, 13, shirtS);
    // arm swinging
    const arm = run ? [-3, 0, 3, 0][phase] : kick ? -4 : 0;
    px(15 + arm, 14 + y0, 4, 5, L.shirt2);
    px(15 + arm, 19 + y0, 4, 5, L.skin);
    // head
    px(11, 1 + y0, 11, 11, L.skin);
    px(11, 9 + y0, 11, 2, skinS);
    px(21, 5 + y0, 2, 2, L.skin); // nose
    px(18, 5 + y0, 1, 2, 0x1a1a1a); // eye
    hair(px, L, "side", y0);
    return;
  }

  // ---- front / back
  const legA = run ? [3, 1, -2, 1][phase] : kick ? 4 : 0; // vertical lift of left leg
  const legB = run ? [-2, 1, 3, 1][phase] : 0;
  const legs = (x: number, lift: number) => {
    px(x, 30 + y0 - Math.max(0, lift), 4, 6, L.skin);
    px(x, 36 + y0 - Math.max(0, lift), 4, 5, L.socks);
    px(x - (x < 16 ? 1 : 0), 41 + y0 - Math.max(0, lift), 5, 2, L.boots);
  };
  legs(11, legA);
  legs(17, legB);
  // shorts
  px(10, 24 + y0, 12, 7, L.shorts);
  px(15, 27 + y0, 2, 4, shortsS);
  // torso + sleeves
  px(9, 12 + y0, 14, 13, L.shirt);
  px(9, 12 + y0, 2, 13, shirtS);
  const armA = run ? [-2, 0, 2, 0][phase] : 0;
  for (const [x, a] of [[5, armA], [23, -armA]] as const) {
    px(x, 13 + y0 + Math.max(0, a), 4, 5, L.shirt2);
    px(x, 18 + y0 + Math.max(0, a), 4, 6 - Math.abs(a) / 2, L.skin);
  }
  if (view === "back" && L.number >= 0) {
    // number on the back
    const n = String(L.number);
    const w = n.length * 4 - 1;
    let x = 16 - Math.ceil(w / 2);
    for (const ch of n) {
      const d = DIG[ch];
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (d[r][c] === "1") px(x + c, 15 + y0 + r, 1, 1, L.shirt2);
      x += 4;
    }
  } else {
    // collar + chest badge
    px(14, 12 + y0, 4, 1, L.shirt2);
    px(18, 15 + y0, 2, 2, L.shirt2);
  }
  // head
  px(10, 1 + y0, 12, 11, L.skin);
  px(10, 9 + y0, 12, 2, skinS);
  px(9, 5 + y0, 1, 3, L.skin);
  px(22, 5 + y0, 1, 3, L.skin); // ears
  if (view === "front") {
    px(12, 6 + y0, 2, 2, 0x1a1a1a);
    px(18, 6 + y0, 2, 2, 0x1a1a1a);
    px(14, 9 + y0, 4, 1, shade(L.skin, 0.6));
  }
  hair(px, L, view, y0);
  if (L.gk) {
    // keeper gloves
    px(5, 22 + y0, 4, 3, 0xf2f2f2);
    px(23, 22 + y0, 4, 3, 0xf2f2f2);
  }
}

function hair(px: (x: number, y: number, w: number, h: number, c: number) => void, L: Look, view: string, y0: number) {
  const h = L.hairColor;
  const hs = shade(h, 0.7);
  if (L.hair === "bald") return;
  if (view === "side") {
    if (L.hair === "afro") px(9, -1 + y0, 13, 7, h);
    else px(10, 0 + y0, 12, L.hair === "buzz" ? 3 : 4, h);
    px(10, 3 + y0, 4, L.hair === "long" ? 10 : 5, hs);
    return;
  }
  if (L.hair === "afro") {
    px(8, -1 + y0, 16, 6, h);
    px(8, 4 + y0, 3, 4, hs);
    px(21, 4 + y0, 3, 4, hs);
    if (view === "back") px(9, 4 + y0, 14, 6, h);
  } else if (L.hair === "long") {
    px(10, 0 + y0, 12, 4, h);
    px(9, 2 + y0, 2, 10, hs);
    px(21, 2 + y0, 2, 10, hs);
    if (view === "back") px(10, 3 + y0, 12, 9, h);
  } else {
    px(10, 0 + y0, 12, L.hair === "buzz" ? 2 : 4, h);
    if (L.hair === "short") px(10, 3 + y0, 2, 2, hs);
    if (view === "back") px(10, 3 + y0, 12, L.hair === "buzz" ? 5 : 7, L.hair === "buzz" ? hs : h);
  }
}

// 1-pixel dark outline around everything drawn (the classic sprite look).
function outline(g: CanvasRenderingContext2D, w: number, h: number) {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const out = new Uint8ClampedArray(d);
  const a = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[(y * w + x) * 4 + 3]);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (a(x, y)) continue;
      if (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1)) {
        const i = (y * w + x) * 4;
        out[i] = 18;
        out[i + 1] = 18;
        out[i + 2] = 24;
        out[i + 3] = 255;
      }
    }
  g.putImageData(new ImageData(out, w, h), 0, 0);
}

export function makeSheet(L: Look) {
  const c = document.createElement("canvas");
  c.width = CW * FRAMES;
  c.height = CH * VIEWS.length;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  VIEWS.forEach((v, vi) => {
    for (let f = 0; f < FRAMES; f++) drawCell(g, f * CW, vi * CH, v, f, L);
  });
  outline(g, c.width, c.height);
  return c;
}

// A billboard sprite that picks its view/frame from heading, camera and motion.
export class PixelPlayer {
  sprite: THREE.Sprite;
  tex: THREE.Texture;
  shadow: THREE.Mesh;
  group = new THREE.Group();
  t = Math.random() * 4;
  kickT = 0;

  constructor(L: Look, height = 2.0) {
    const sheet = makeSheet(L);
    this.tex = new THREE.CanvasTexture(sheet);
    this.tex.magFilter = THREE.NearestFilter;
    this.tex.minFilter = THREE.NearestFilter;
    this.tex.generateMipmaps = false;
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.repeat.set(1 / FRAMES, 1 / VIEWS.length);
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, alphaTest: 0.5 }));
    this.sprite.scale.set((height * CW) / CH, height, 1);
    this.sprite.center.set(0.5, 0.02);
    this.group.add(this.sprite);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.02;
    this.shadow.scale.set(1.2, 0.7, 1);
    this.group.add(this.shadow);
  }

  update(dt: number, heading: number, speed: number, camPos: THREE.Vector3, pos: THREE.Vector3) {
    // angle between where the player faces and where the camera is
    const toCam = Math.atan2(camPos.x - pos.x, camPos.z - pos.z);
    let rel = toCam - heading;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    const a = Math.abs(rel);
    const view = a < Math.PI / 4 ? 1 : a > (3 * Math.PI) / 4 ? 0 : 2;
    const mirror = view === 2 && rel < 0;
    this.t += dt * (0.5 + speed * 1.6);
    this.kickT -= dt;
    const frame = this.kickT > 0 ? 5 : speed > 0.6 ? 1 + (Math.floor(this.t * 1.6) % 4) : 0;
    this.tex.repeat.x = (mirror ? -1 : 1) / FRAMES;
    this.tex.offset.x = (frame + (mirror ? 1 : 0)) / FRAMES;
    this.tex.offset.y = 1 - (view + 1) / VIEWS.length;
  }
}

// Crowd texture made of tiny pixel fans in the home team's colours.
export function crowdTexture(c1: number, c2: number) {
  const W = 256,
    H = 96;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#5b5f73";
  g.fillRect(0, 0, W, H);
  const skins = [0x5c3a21, 0x8d5524, 0xc68642, 0xe0ac69, 0xf1c27d];
  const shirts = [c1, c1, c2, c1, 0xffffff, c2, 0xffd23f, 0xe63946, 0x2ec4b6, 0xf77f00];
  for (let row = 0; row < H / 8; row++) {
    g.fillStyle = row % 2 ? "#6c7085" : "#62667a";
    g.fillRect(0, row * 8 + 6, W, 2);
    for (let col = 0; col < W / 5; col++) {
      if (Math.random() < 0.08) continue;
      const x = col * 5 + (row % 2) * 2,
        y = row * 8;
      g.fillStyle = css(shirts[Math.floor(Math.random() * shirts.length)]);
      g.fillRect(x, y + 3, 4, 3);
      g.fillStyle = css(skins[Math.floor(Math.random() * skins.length)]);
      g.fillRect(x + 1, y, 2, 3);
      if (Math.random() < 0.12) {
        g.fillStyle = css(Math.random() < 0.5 ? c1 : c2);
        g.fillRect(x + (Math.random() < 0.5 ? -1 : 4), y - 2, 1, 4); // raised arm / flag
      }
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

// Crisp striped pitch with nearest filtering (no noise).
export function pixelPitch(varzea: boolean) {
  const W = 304,
    H = 192;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  if (varzea) {
    g.fillStyle = "#a07d4b";
    g.fillRect(0, 0, W, H);
    const pats = ["#8f6d3e", "#6f8f3a", "#7e9c44", "#b28d58"];
    for (let i = 0; i < 160; i++) {
      g.fillStyle = pats[i % 4];
      g.fillRect(Math.floor(Math.random() * W), Math.floor(Math.random() * H), 4 + Math.floor(Math.random() * 14), 2 + Math.floor(Math.random() * 6));
    }
  } else {
    for (let i = 0; i < 16; i++) {
      g.fillStyle = i % 2 ? "#3c9a3f" : "#45ab47";
      g.fillRect(Math.floor((i * W) / 16), 0, Math.ceil(W / 16), H);
    }
  }
  g.fillStyle = "#ffffff";
  const m = 3;
  const line = (x: number, y: number, w: number, h: number) => g.fillRect(x, y, w, h);
  line(m, m, W - 2 * m, 1);
  line(m, H - m - 1, W - 2 * m, 1);
  line(m, m, 1, H - 2 * m);
  line(W - m - 1, m, 1, H - 2 * m);
  line(W / 2, m, 1, H - 2 * m);
  // centre circle drawn pixel by pixel
  for (let a = 0; a < 360; a += 2) {
    const r = 22;
    g.fillRect(Math.round(W / 2 + Math.cos((a * Math.PI) / 180) * r), Math.round(H / 2 + Math.sin((a * Math.PI) / 180) * r), 1, 1);
  }
  for (const side of [0, 1]) {
    const x0 = side ? W - m - 1 - 46 : m;
    line(x0, H / 2 - 48, 47, 1);
    line(x0, H / 2 + 48, 47, 1);
    line(side ? x0 : x0 + 46, H / 2 - 48, 1, 97);
    const x1 = side ? W - m - 1 - 17 : m;
    line(x1, H / 2 - 20, 18, 1);
    line(x1, H / 2 + 20, 18, 1);
    line(side ? x1 : x1 + 17, H / 2 - 20, 1, 41);
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
