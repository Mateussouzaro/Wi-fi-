import * as THREE from "three";

// Procedural art: everything is drawn on canvases so the game is one self-contained file.

export function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

export function tex(c: HTMLCanvasElement, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function cloud(seed: number) {
  const [c, g] = canvas(256, 128);
  const r = rng(seed);
  for (let i = 0; i < 22; i++) {
    const x = 40 + r() * 176,
      y = 50 + r() * 40,
      rad = 16 + r() * 30;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, "rgba(255,255,255,0.75)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 128);
  }
  return tex(c);
}

export function sand() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = "#EED9A8";
  g.fillRect(0, 0, 512, 512);
  const r = rng(13);
  for (let i = 0; i < 26000; i++) {
    g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.18)" : "rgba(150,115,60,0.16)";
    g.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2);
  }
  for (let i = 0; i < 40; i++) {
    g.fillStyle = "rgba(90,120,40,0.5)";
    const x = r() * 512,
      y = r() * 512;
    for (let k = 0; k < 7; k++) g.fillRect(x + (r() - 0.5) * 10, y - r() * 12, 1.5, 6 + r() * 8);
  }
  return tex(c);
}

export function asphalt() {
  const [c, g] = canvas(256, 512);
  g.fillStyle = "#56585b";
  g.fillRect(0, 0, 256, 512);
  const r = rng(5);
  for (let i = 0; i < 16000; i++) {
    g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.12)";
    g.fillRect(r() * 256, r() * 512, 1 + r() * 2, 1 + r() * 2);
  }
  // cracks
  g.strokeStyle = "rgba(30,30,30,0.5)";
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    let x = r() * 256,
      y = r() * 512;
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) g.lineTo((x += (r() - 0.5) * 30), (y += r() * 20));
    g.stroke();
  }
  // lane dashes in the middle + edge lines
  g.fillStyle = "rgba(245,245,240,0.9)";
  for (let y = 0; y < 512; y += 128) g.fillRect(124, y, 8, 64);
  g.fillRect(8, 0, 5, 512);
  g.fillRect(243, 0, 5, 512);
  return tex(c);
}

export function wall(seed: number) {
  const [c, g] = canvas(128, 128);
  const r = rng(seed);
  const cols = ["#E9C46A", "#2A9D8F", "#E76F51", "#F4A261", "#8AB17D", "#6C91C2", "#F2E8CF", "#D4A5A5", "#B7B7A4"];
  g.fillStyle = cols[Math.floor(r() * cols.length)];
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = "rgba(0,0,0,0.06)";
    g.fillRect(r() * 128, r() * 128, 2, 2);
  }
  g.fillStyle = "#2b2b2b";
  g.fillRect(18, 34, 32, 30);
  g.fillRect(78, 34, 32, 30);
  g.fillStyle = "rgba(255,255,255,0.15)";
  g.fillRect(18, 34, 12, 30);
  return tex(c);
}

// --------------------------------------------------------------- kites

export interface KiteDesign {
  name: string;
  draw: (g: CanvasRenderingContext2D, S: number) => void;
}

const diamond = (g: CanvasRenderingContext2D, S: number) => {
  g.beginPath();
  g.moveTo(S / 2, 0);
  g.lineTo(S, S / 2);
  g.lineTo(S / 2, S);
  g.lineTo(0, S / 2);
  g.closePath();
};

export const DESIGNS: KiteDesign[] = [
  {
    name: "Brasileirinha",
    draw: (g, S) => {
      g.fillStyle = "#009c3b";
      g.fillRect(0, 0, S, S);
      g.fillStyle = "#ffdf00";
      g.beginPath();
      g.moveTo(S / 2, S * 0.12);
      g.lineTo(S * 0.88, S / 2);
      g.lineTo(S / 2, S * 0.88);
      g.lineTo(S * 0.12, S / 2);
      g.fill();
      g.fillStyle = "#002776";
      g.beginPath();
      g.arc(S / 2, S / 2, S * 0.2, 0, Math.PI * 2);
      g.fill();
    },
  },
  {
    name: "Xadrez",
    draw: (g, S) => {
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        g.fillStyle = (i + j) % 2 ? "#111" : "#f2f2f2";
        g.fillRect((i * S) / 4, (j * S) / 4, S / 4, S / 4);
      }
    },
  },
  {
    name: "Pôr do Sol",
    draw: (g, S) => {
      const gr = g.createLinearGradient(0, 0, 0, S);
      gr.addColorStop(0, "#ff3d77");
      gr.addColorStop(0.5, "#ff8a3d");
      gr.addColorStop(1, "#ffd36b");
      g.fillStyle = gr;
      g.fillRect(0, 0, S, S);
      g.fillStyle = "#fff6c9";
      g.beginPath();
      g.arc(S / 2, S * 0.62, S * 0.18, Math.PI, 0);
      g.fill();
    },
  },
  {
    name: "Caveirinha",
    draw: (g, S) => {
      g.fillStyle = "#1b1b2f";
      g.fillRect(0, 0, S, S);
      g.fillStyle = "#e6e6e6";
      g.beginPath();
      g.arc(S / 2, S * 0.45, S * 0.17, 0, Math.PI * 2);
      g.fill();
      g.fillRect(S * 0.4, S * 0.55, S * 0.2, S * 0.12);
      g.fillStyle = "#1b1b2f";
      g.beginPath();
      g.arc(S * 0.44, S * 0.44, S * 0.045, 0, Math.PI * 2);
      g.arc(S * 0.56, S * 0.44, S * 0.045, 0, Math.PI * 2);
      g.fill();
    },
  },
  {
    name: "Raio",
    draw: (g, S) => {
      g.fillStyle = "#1e4fa3";
      g.fillRect(0, 0, S, S);
      g.fillStyle = "#ffd23f";
      g.beginPath();
      g.moveTo(S * 0.55, S * 0.1);
      g.lineTo(S * 0.3, S * 0.55);
      g.lineTo(S * 0.48, S * 0.55);
      g.lineTo(S * 0.4, S * 0.9);
      g.lineTo(S * 0.72, S * 0.42);
      g.lineTo(S * 0.53, S * 0.42);
      g.closePath();
      g.fill();
    },
  },
  {
    name: "Listrada",
    draw: (g, S) => {
      const cols = ["#e63946", "#f1faee", "#457b9d", "#f1faee"];
      for (let i = 0; i < 8; i++) {
        g.fillStyle = cols[i % 4];
        g.fillRect(0, (i * S) / 8, S, S / 8);
      }
    },
  },
  {
    name: "Coração",
    draw: (g, S) => {
      g.fillStyle = "#ffb3c6";
      g.fillRect(0, 0, S, S);
      g.fillStyle = "#d00000";
      g.beginPath();
      g.moveTo(S / 2, S * 0.75);
      g.bezierCurveTo(S * 0.1, S * 0.45, S * 0.3, S * 0.15, S / 2, S * 0.35);
      g.bezierCurveTo(S * 0.7, S * 0.15, S * 0.9, S * 0.45, S / 2, S * 0.75);
      g.fill();
    },
  },
  {
    name: "Quadriculada Laranja",
    draw: (g, S) => {
      g.fillStyle = "#f77f00";
      g.fillRect(0, 0, S, S);
      g.fillStyle = "#003049";
      g.fillRect(0, 0, S / 2, S / 2);
      g.fillRect(S / 2, S / 2, S / 2, S / 2);
    },
  },
];

const kiteTexCache = new Map<number, THREE.Texture>();
export function kiteTexture(i: number) {
  const k = i % DESIGNS.length;
  if (kiteTexCache.has(k)) return kiteTexCache.get(k)!;
  const S = 256;
  const [c, g] = canvas(S, S);
  g.save();
  diamond(g, S);
  g.clip();
  // draw the design in a square rotated 45° so it reads as a diamond kite
  g.translate(S / 2, S / 2);
  g.rotate(Math.PI / 4);
  g.translate(-S * 0.72, -S * 0.72);
  DESIGNS[k].draw(g, S * 1.44);
  g.restore();
  // paper creases + spars
  g.strokeStyle = "rgba(0,0,0,0.25)";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(S / 2, 2);
  g.lineTo(S / 2, S - 2);
  g.moveTo(2, S / 2);
  g.lineTo(S - 2, S / 2);
  g.stroke();
  g.strokeStyle = "rgba(0,0,0,0.45)";
  g.lineWidth = 4;
  diamond(g, S);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  kiteTexCache.set(k, t);
  return t;
}

// Label on the spool's side disc: original artwork for this game.
export function spoolLabel() {
  const S = 512;
  const [c, g] = canvas(S, S);
  const gr = g.createRadialGradient(S / 2, S / 2, 40, S / 2, S / 2, S / 2);
  gr.addColorStop(0, "#00b4d8");
  gr.addColorStop(0.55, "#0077b6");
  gr.addColorStop(1, "#023e8a");
  g.fillStyle = gr;
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
  g.fill();
  // sun rays
  g.save();
  g.translate(S / 2, S / 2);
  for (let i = 0; i < 16; i++) {
    g.rotate(Math.PI / 8);
    g.fillStyle = i % 2 ? "rgba(255,211,107,0.35)" : "rgba(255,255,255,0.08)";
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(S * 0.5, -S * 0.07);
    g.lineTo(S * 0.5, S * 0.07);
    g.fill();
  }
  g.restore();
  // kite emblem
  g.save();
  g.translate(S / 2, S * 0.4);
  g.rotate(Math.PI / 4);
  g.fillStyle = "#ffd23f";
  g.fillRect(-60, -60, 120, 120);
  g.fillStyle = "#e63946";
  g.fillRect(-60, -60, 60, 60);
  g.fillRect(0, 0, 60, 60);
  g.restore();
  g.strokeStyle = "#fff";
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(S / 2, S * 0.4 + 85);
  g.bezierCurveTo(S * 0.4, S * 0.62, S * 0.62, S * 0.66, S / 2, S * 0.78);
  g.stroke();
  g.fillStyle = "#fff";
  g.font = "italic 900 64px sans-serif";
  g.textAlign = "center";
  g.lineWidth = 10;
  g.strokeStyle = "#03045e";
  g.strokeText("CÉU DE", S / 2, S * 0.72);
  g.fillText("CÉU DE", S / 2, S * 0.72);
  g.strokeText("PIPA", S / 2, S * 0.86);
  g.fillStyle = "#ffd23f";
  g.fillText("PIPA", S / 2, S * 0.86);
  // rim + center hole
  g.strokeStyle = "#e9ecef";
  g.lineWidth = 22;
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - 11, 0, Math.PI * 2);
  g.stroke();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.fillStyle = "#adb5bd";
    g.beginPath();
    g.arc(S / 2 + Math.cos(a) * S * 0.41, S / 2 + Math.sin(a) * S * 0.41, 14, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function lineWraps() {
  const [c, g] = canvas(64, 256);
  g.fillStyle = "#f4f4f2";
  g.fillRect(0, 0, 64, 256);
  for (let y = 0; y < 256; y += 3) {
    g.fillStyle = `rgba(0,0,0,${0.05 + (y % 9 === 0 ? 0.1 : 0)})`;
    g.fillRect(0, y, 64, 1);
  }
  return tex(c, 1, 6);
}
