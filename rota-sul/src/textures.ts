import * as THREE from "three";

// All textures are drawn procedurally so the game ships as one self-contained file.

export function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

function tex(c: HTMLCanvasElement, rx = 1, ry = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function noise(g: CanvasRenderingContext2D, w: number, h: number, n: number, a: number, r: () => number, light = true) {
  for (let i = 0; i < n; i++) {
    const v = light ? 255 : 0;
    g.fillStyle = `rgba(${v},${v},${v},${a * r()})`;
    g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
  }
}

export function asphalt() {
  const [c, g] = canvas(512, 512);
  const r = rng(3);
  g.fillStyle = "#3a3b3d";
  g.fillRect(0, 0, 512, 512);
  noise(g, 512, 512, 9000, 0.08, r);
  noise(g, 512, 512, 9000, 0.12, r, false);
  // patches / cracks
  for (let i = 0; i < 10; i++) {
    g.fillStyle = `rgba(20,20,22,${0.15 + r() * 0.15})`;
    g.beginPath();
    g.ellipse(r() * 512, r() * 512, 20 + r() * 50, 10 + r() * 30, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  return tex(c);
}

// Road segment with lane markings; u runs across the road, v along it.
export function roadMarkings() {
  const [c, g] = canvas(256, 512);
  g.clearRect(0, 0, 256, 512);
  g.fillStyle = "rgba(240,240,235,0.85)";
  g.fillRect(8, 0, 6, 512);
  g.fillRect(242, 0, 6, 512);
  g.fillStyle = "rgba(245,200,40,0.9)";
  for (let y = 0; y < 512; y += 128) {
    g.fillRect(122, y, 5, 70);
    g.fillRect(130, y, 5, 70);
  }
  const t = tex(c);
  return t;
}

// Iconic black/white wave pattern of Brazilian beach promenades (generic Portuguese pavement).
export function calcadao() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = "#EDE8DC";
  g.fillRect(0, 0, 512, 512);
  g.fillStyle = "#26262A";
  for (let band = -1; band < 4; band++) {
    g.beginPath();
    const y0 = band * 128 + 40;
    g.moveTo(0, y0);
    for (let x = 0; x <= 512; x += 8) g.lineTo(x, y0 + Math.sin((x / 512) * Math.PI * 4) * 34);
    for (let x = 512; x >= 0; x -= 8) g.lineTo(x, y0 + 44 + Math.sin((x / 512) * Math.PI * 4) * 34);
    g.closePath();
    g.fill();
  }
  // stone joints
  const r = rng(5);
  g.strokeStyle = "rgba(120,110,100,0.25)";
  for (let i = 0; i < 1800; i++) {
    g.strokeRect(r() * 512, r() * 512, 6 + r() * 4, 6 + r() * 4);
  }
  return tex(c);
}

export function sidewalk() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = "#B9B3A8";
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "rgba(80,75,70,0.35)";
  g.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 256);
    g.moveTo(0, i);
    g.lineTo(256, i);
    g.stroke();
  }
  noise(g, 256, 256, 3000, 0.1, rng(9), false);
  return tex(c);
}

export function sand() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = "#E3CFA2";
  g.fillRect(0, 0, 512, 512);
  const r = rng(13);
  noise(g, 512, 512, 20000, 0.18, r);
  noise(g, 512, 512, 20000, 0.12, r, false);
  for (let i = 0; i < 30; i++) {
    g.strokeStyle = "rgba(170,140,90,0.18)";
    g.lineWidth = 3;
    g.beginPath();
    const y = r() * 512;
    g.moveTo(0, y);
    g.bezierCurveTo(170, y + 20 * r(), 340, y - 20 * r(), 512, y);
    g.stroke();
  }
  return tex(c);
}

export function grass() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = "#4F7A2E";
  g.fillRect(0, 0, 256, 256);
  const r = rng(21);
  for (let i = 0; i < 6000; i++) {
    g.fillStyle = r() > 0.5 ? "rgba(110,150,60,0.6)" : "rgba(40,70,25,0.6)";
    g.fillRect(r() * 256, r() * 256, 1, 2 + r() * 3);
  }
  return tex(c);
}

export function soccerField() {
  const [c, g] = canvas(512, 768);
  for (let i = 0; i < 12; i++) {
    g.fillStyle = i % 2 ? "#3E7F2C" : "#468C33";
    g.fillRect(0, i * 64, 512, 64);
  }
  g.strokeStyle = "rgba(255,255,255,0.9)";
  g.lineWidth = 6;
  g.strokeRect(20, 20, 472, 728);
  g.beginPath();
  g.moveTo(20, 384);
  g.lineTo(492, 384);
  g.stroke();
  g.beginPath();
  g.arc(256, 384, 70, 0, Math.PI * 2);
  g.stroke();
  g.strokeRect(136, 20, 240, 110);
  g.strokeRect(136, 638, 240, 110);
  return tex(c);
}

export interface Facade {
  map: THREE.Texture;
  emissive: THREE.Texture;
}

// Apartment-tower facade: concrete/painted wall with balconies and a window grid.
// The emissive twin lights a random subset of windows at night.
export function facade(seed: number, wall: string, floors = 16, cols = 6): Facade {
  const W = 256,
    H = 512;
  const [c, g] = canvas(W, H);
  const [e, ge] = canvas(W, H);
  const r = rng(seed);
  g.fillStyle = wall;
  g.fillRect(0, 0, W, H);
  noise(g, W, H, 4000, 0.07, r, false);
  ge.fillStyle = "#000";
  ge.fillRect(0, 0, W, H);
  const fh = H / floors,
    cw = W / cols;
  for (let f = 0; f < floors; f++) {
    // balcony slab line
    g.fillStyle = "rgba(255,255,255,0.18)";
    g.fillRect(0, f * fh + fh - 3, W, 3);
    for (let k = 0; k < cols; k++) {
      const x = k * cw + cw * 0.18,
        y = f * fh + fh * 0.2,
        w = cw * 0.64,
        h = fh * 0.58;
      const glass = g.createLinearGradient(x, y, x, y + h);
      glass.addColorStop(0, "#3d5466");
      glass.addColorStop(1, "#1b2630");
      g.fillStyle = glass;
      g.fillRect(x, y, w, h);
      g.fillStyle = "rgba(255,255,255,0.12)";
      g.fillRect(x, y, w * 0.4, h);
      g.strokeStyle = "rgba(40,40,40,0.6)";
      g.strokeRect(x, y, w, h);
      if (r() < 0.38) {
        const warm = r() < 0.8;
        ge.fillStyle = warm ? `rgba(255,${190 + r() * 40},${110 + r() * 40},1)` : "rgba(180,210,255,1)";
        ge.fillRect(x + 1, y + 1, w - 2, h - 2);
      }
      // AC units, a very Brazilian facade detail
      if (r() < 0.12) {
        g.fillStyle = "#d8d8d4";
        g.fillRect(x + w * 0.1, y + h + 1, w * 0.45, fh * 0.14);
      }
    }
  }
  return { map: tex(c), emissive: tex(e) };
}

// Small favela-style house wall: bare brick or painted plaster with a window and door.
export function houseWall(seed: number) {
  const [c, g] = canvas(128, 128);
  const r = rng(seed);
  const brick = r() < 0.45;
  if (brick) {
    g.fillStyle = "#A4502F";
    g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 8) {
      for (let x = (y / 8) % 2 ? -8 : 0; x < 128; x += 16) {
        g.fillStyle = `rgb(${150 + r() * 40},${70 + r() * 25},${40 + r() * 20})`;
        g.fillRect(x + 1, y + 1, 14, 6);
      }
    }
  } else {
    const cols = ["#E9C46A", "#2A9D8F", "#E76F51", "#F4A261", "#8AB17D", "#C8553D", "#6C91C2", "#F2E8CF", "#D4A5A5"];
    g.fillStyle = cols[Math.floor(r() * cols.length)];
    g.fillRect(0, 0, 128, 128);
    noise(g, 128, 128, 1500, 0.15, r, false);
    g.fillStyle = "rgba(0,0,0,0.15)";
    g.fillRect(0, 110, 128, 18);
  }
  g.fillStyle = "#2b2b2b";
  g.fillRect(20, 40, 30, 26);
  g.fillStyle = "#4b3621";
  g.fillRect(78, 60, 26, 68);
  return tex(c);
}

export function waterNormals() {
  const S = 256;
  const [c, g] = canvas(S, S);
  const img = g.createImageData(S, S);
  const h = new Float32Array(S * S);
  const r = rng(77);
  const waves = Array.from({ length: 24 }, () => ({
    kx: Math.round((r() - 0.5) * 16),
    ky: Math.round((r() - 0.5) * 16),
    p: r() * Math.PI * 2,
    a: 0.3 + r(),
  }));
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      let v = 0;
      for (const w of waves) v += w.a * Math.sin(((w.kx * x + w.ky * y) / S) * Math.PI * 2 + w.p);
      h[y * S + x] = v;
    }
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const dx = h[y * S + ((x + 1) % S)] - h[y * S + ((x - 1 + S) % S)];
      const dy = h[((y + 1) % S) * S + x] - h[((y - 1 + S) % S) * S + x];
      const n = new THREE.Vector3(-dx * 0.6, -dy * 0.6, 1).normalize();
      const i = (y * S + x) * 4;
      img.data[i] = (n.x * 0.5 + 0.5) * 255;
      img.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      img.data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  return tex(c, 1, 1, false);
}

export function rock() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = "#5d5a52";
  g.fillRect(0, 0, 256, 256);
  const r = rng(31);
  for (let i = 0; i < 300; i++) {
    g.fillStyle = `rgba(${60 + r() * 60},${60 + r() * 50},${50 + r() * 40},0.5)`;
    g.beginPath();
    g.ellipse(r() * 256, r() * 256, 4 + r() * 20, 2 + r() * 8, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  return tex(c);
}

// Painted text sign texture (shop fronts, bus stops…)
export function sign(text: string, bg: string, fg = "#fff") {
  const [c, g] = canvas(512, 128);
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = fg;
  g.font = "bold 64px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
