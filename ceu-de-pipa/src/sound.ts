// Synthesised sounds: wind bed, line zip when pulling, spool ratchet, cut snap, combo whoosh.

export class Sound {
  ctx: AudioContext | null = null;
  master!: GainNode;
  wind!: GainNode;
  windF!: BiquadFilterNode;
  zip!: GainNode;
  zipF!: BiquadFilterNode;
  clickT = 0;

  start() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(ctx.destination);
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const loop = (gain: GainNode, f: BiquadFilterNode) => {
      const s = ctx.createBufferSource();
      s.buffer = noise;
      s.loop = true;
      s.connect(f).connect(gain).connect(this.master);
      s.start();
    };
    this.windF = ctx.createBiquadFilter();
    this.windF.type = "lowpass";
    this.windF.frequency.value = 400;
    this.wind = ctx.createGain();
    this.wind.gain.value = 0.12;
    loop(this.wind, this.windF);
    this.zipF = ctx.createBiquadFilter();
    this.zipF.type = "bandpass";
    this.zipF.frequency.value = 2500;
    this.zipF.Q.value = 3;
    this.zip = ctx.createGain();
    this.zip.gain.value = 0;
    loop(this.zip, this.zipF);
  }

  update(dt: number, t: number, o: { pulling: boolean; speed: number; releasing: boolean; reeling: boolean; height: number }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    this.wind.gain.setTargetAtTime(0.08 + Math.sin(t * 0.4) * 0.03 + Math.min(0.08, o.height / 2000), now, 0.5);
    this.windF.frequency.setTargetAtTime(300 + Math.sin(t * 0.7) * 120, now, 0.5);
    this.zip.gain.setTargetAtTime(o.pulling ? Math.min(0.2, 0.04 + o.speed * 0.01) : 0, now, 0.04);
    this.zipF.frequency.setTargetAtTime(1800 + o.speed * 90, now, 0.05);
    if (o.releasing || o.reeling) {
      this.clickT -= dt;
      if (this.clickT <= 0) {
        this.clickT = o.releasing ? 0.035 : 0.06;
        this.blip(now, o.releasing ? 3200 : 2200, 0.02, 0.05);
      }
    }
  }

  private blip(t: number, f: number, dur: number, vol: number, type: OscillatorType = "square") {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private burst(t: number, dur: number, vol: number, from: number, to: number) {
    const ctx = this.ctx!;
    const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource();
    s.buffer = b;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
  }

  cut(combo: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.burst(t, 0.12, 0.6, 5000, 1200);
    this.blip(t + 0.02, 880, 0.12, 0.12, "triangle");
    this.blip(t + 0.1, 1320, 0.2, 0.12, "triangle");
    if (combo >= 5) this.burst(t + 0.05, 0.6, 0.4, 300, 2500);
  }

  lost() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.burst(t, 0.15, 0.5, 4000, 800);
    [440, 370, 311, 262].forEach((f, i) => this.blip(t + 0.1 + i * 0.15, f, 0.25, 0.1, "sawtooth"));
  }

  catch() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [988, 1319, 1568].forEach((f, i) => this.blip(t + i * 0.07, f, 0.15, 0.1, "square"));
  }
}
