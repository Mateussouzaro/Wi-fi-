// Ambient sound made with WebAudio (no files): sea, wind, rain, thunder,
// generator hum, pickups and a soft music pad.

let ac: AudioContext | null = null;
let master: GainNode;
const loops: Record<string, { g: GainNode; target: number }> = {};

function noiseBuffer(ctx: AudioContext, secs: number, brown: boolean) {
  const b = ctx.createBuffer(1, ctx.sampleRate * secs, ctx.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else d[i] = w;
  }
  return b;
}

function loop(name: string, build: (ctx: AudioContext, out: GainNode) => void) {
  const g = ac!.createGain();
  g.gain.value = 0;
  g.connect(master);
  build(ac!, g);
  loops[name] = { g, target: 0 };
}

export function initAudio() {
  if (ac) {
    if (ac.state === "suspended") ac.resume();
    return;
  }
  try {
    ac = new AudioContext();
  } catch {
    return;
  }
  master = ac.createGain();
  master.gain.value = 0.9;
  master.connect(ac.destination);
  const brown = noiseBuffer(ac, 4, true);
  const white = noiseBuffer(ac, 3, false);
  // sea: brown noise swelling slowly like waves
  loop("sea", (ctx, out) => {
    const s = ctx.createBufferSource();
    s.buffer = brown;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 600;
    const sw = ctx.createGain();
    sw.gain.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.11;
    const lg = ctx.createGain();
    lg.gain.value = 0.4;
    lfo.connect(lg).connect(sw.gain);
    s.connect(f).connect(sw).connect(out);
    s.start();
    lfo.start();
  });
  // wind: band-passed noise with a wandering centre
  loop("wind", (ctx, out) => {
    const s = ctx.createBufferSource();
    s.buffer = white;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 500;
    f.Q.value = 1.4;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = ctx.createGain();
    lg.gain.value = 260;
    lfo.connect(lg).connect(f.frequency);
    const g = ctx.createGain();
    g.gain.value = 0.35;
    s.connect(f).connect(g).connect(out);
    s.start();
    lfo.start();
  });
  // rain: bright hiss
  loop("rain", (ctx, out) => {
    const s = ctx.createBufferSource();
    s.buffer = white;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.value = 0.22;
    s.connect(f).connect(g).connect(out);
    s.start();
  });
  // generator: low saw hum with rattle
  loop("gen", (ctx, out) => {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = 48;
    const o2 = ctx.createOscillator();
    o2.type = "square";
    o2.frequency.value = 24.3;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 380;
    const g = ctx.createGain();
    g.gain.value = 0.12;
    o.connect(f);
    o2.connect(f);
    f.connect(g).connect(out);
    o.start();
    o2.start();
  });
  // music: a slow, sad pad (minor chords)
  loop("music", (ctx, out) => {
    const chords = [
      [220, 261.6, 329.6],
      [174.6, 220, 261.6],
      [196, 246.9, 293.7],
      [164.8, 207.7, 246.9],
    ];
    const oscs: OscillatorNode[] = [];
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    f.connect(g).connect(out);
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      o.type = i === 0 ? "triangle" : "sine";
      o.connect(f);
      o.start();
      oscs.push(o);
    }
    let k = 0;
    const step = () => {
      const c = chords[k++ % chords.length];
      oscs.forEach((o, i) => o.frequency.setTargetAtTime(c[i], ctx.currentTime, 0.8));
    };
    step();
    setInterval(step, 6000);
  });
}

export function setLevel(name: "sea" | "wind" | "rain" | "gen" | "music", v: number, fade = 2) {
  if (!ac || !loops[name]) return;
  const l = loops[name];
  l.target = v;
  l.g.gain.cancelScheduledValues(ac.currentTime);
  l.g.gain.setTargetAtTime(v, ac.currentTime, fade / 3);
}

export function thunder(dist = 0.5) {
  if (!ac) return;
  const s = ac.createBufferSource();
  s.buffer = noiseBuffer(ac, 4, true);
  const f = ac.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 260 + (1 - dist) * 500;
  const g = ac.createGain();
  const t = ac.currentTime + dist * 1.2;
  g.gain.setValueAtTime(0, ac.currentTime);
  g.gain.linearRampToValueAtTime(1.4 * (1 - dist * 0.6), t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.001, t + 3.5);
  s.connect(f).connect(g).connect(master);
  s.start();
  s.stop(t + 4);
}

export function blip(kind: "pick" | "clunk" | "start") {
  if (!ac) return;
  const t = ac.currentTime;
  const o = ac.createOscillator();
  const g = ac.createGain();
  if (kind === "pick") {
    o.type = "sine";
    o.frequency.setValueAtTime(660, t);
    o.frequency.setValueAtTime(990, t + 0.09);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  } else if (kind === "clunk") {
    o.type = "square";
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  } else {
    o.type = "sawtooth";
    o.frequency.setValueAtTime(20, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 1.2);
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + 1.4);
  }
  o.connect(g).connect(master);
  o.start();
  o.stop(t + 1.5);
}

// footsteps: short filtered noise ticks, sand/grass vs wood
export function step(wood: boolean) {
  if (!ac) return;
  const s = ac.createBufferSource();
  s.buffer = noiseBuffer(ac, 0.12, false);
  const f = ac.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = wood ? 900 : 2200;
  f.Q.value = wood ? 3 : 0.8;
  const g = ac.createGain();
  g.gain.value = wood ? 0.16 : 0.05;
  s.connect(f).connect(g).connect(master);
  s.start();
}

// combat effects
export function sfx(kind: "swish" | "hit" | "hurt" | "arrow" | "roar" | "chest" | "gate" | "torch" | "die") {
  if (!ac) return;
  const t = ac.currentTime;
  const g = ac.createGain();
  g.connect(master);
  const noise = (dur: number, type: BiquadFilterType, f0: number, f1: number, vol: number) => {
    const s = ac!.createBufferSource();
    s.buffer = noiseBuffer(ac!, dur, false);
    const f = ac!.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g);
    s.start();
  };
  const tone = (type: OscillatorType, f0: number, f1: number, dur: number, vol: number) => {
    const o = ac!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const og = ac!.createGain();
    og.gain.setValueAtTime(vol, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(og).connect(master);
    o.start();
    o.stop(t + dur + 0.05);
  };
  if (kind === "swish") noise(0.18, "bandpass", 2500, 900, 0.35);
  else if (kind === "hit") {
    noise(0.12, "lowpass", 2000, 300, 0.5);
    tone("square", 180, 60, 0.12, 0.2);
  } else if (kind === "hurt") tone("sawtooth", 300, 90, 0.3, 0.25);
  else if (kind === "arrow") noise(0.25, "highpass", 3000, 6000, 0.25);
  else if (kind === "roar") {
    noise(1.2, "lowpass", 600, 120, 0.6);
    tone("sawtooth", 90, 45, 1.1, 0.25);
  } else if (kind === "chest") {
    tone("sine", 523, 523, 0.15, 0.2);
    setTimeout(() => tone("sine", 659, 659, 0.15, 0.2), 120);
    setTimeout(() => tone("sine", 784, 784, 0.15, 0.2), 240);
    setTimeout(() => tone("sine", 1047, 1047, 0.4, 0.22), 360);
  } else if (kind === "gate") noise(1.0, "lowpass", 400, 80, 0.5);
  else if (kind === "torch") noise(0.6, "bandpass", 800, 300, 0.4);
  else if (kind === "die") tone("triangle", 400, 60, 1.0, 0.3);
}
