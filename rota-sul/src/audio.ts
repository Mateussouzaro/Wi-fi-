// All sound is synthesised with WebAudio (no files to download).

export class GameAudio {
  ctx: AudioContext | null = null;
  master!: GainNode;
  engOsc!: OscillatorNode;
  engOsc2!: OscillatorNode;
  engGain!: GainNode;
  engFilter!: BiquadFilterNode;
  sirenOsc!: OscillatorNode;
  sirenGain!: GainNode;
  hornGain!: GainNode;
  radioGain!: GainNode;
  radioOn = true;
  station = 0;
  stations = ["Rota FM — Batidão", "Rádio Sol — Bossa", "Rádio Off"];
  nextBeat = 0;
  step = 0;

  start() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(ctx.destination);
    // engine: two detuned saws through a low-pass
    this.engFilter = ctx.createBiquadFilter();
    this.engFilter.type = "lowpass";
    this.engFilter.frequency.value = 600;
    this.engGain = ctx.createGain();
    this.engGain.gain.value = 0;
    this.engOsc = ctx.createOscillator();
    this.engOsc.type = "sawtooth";
    this.engOsc2 = ctx.createOscillator();
    this.engOsc2.type = "square";
    this.engOsc.connect(this.engFilter);
    this.engOsc2.connect(this.engFilter);
    this.engFilter.connect(this.engGain).connect(this.master);
    this.engOsc.start();
    this.engOsc2.start();
    // siren
    this.sirenOsc = ctx.createOscillator();
    this.sirenOsc.type = "triangle";
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain).connect(this.master);
    this.sirenOsc.start();
    // horn
    this.hornGain = ctx.createGain();
    this.hornGain.gain.value = 0;
    for (const f of [392, 494]) {
      const o = ctx.createOscillator();
      o.type = "square";
      o.frequency.value = f;
      o.connect(this.hornGain);
      o.start();
    }
    const hf = ctx.createBiquadFilter();
    hf.frequency.value = 1800;
    this.hornGain.connect(hf).connect(this.master);
    this.radioGain = ctx.createGain();
    this.radioGain.gain.value = 0;
    this.radioGain.connect(this.master);
    this.nextBeat = ctx.currentTime + 0.1;
  }

  update(t: number, o: { inCar: boolean; rpm: number; throttle: number; siren: number; horn: boolean }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const base = 38 + o.rpm * 110;
    this.engOsc.frequency.setTargetAtTime(base, now, 0.05);
    this.engOsc2.frequency.setTargetAtTime(base * 0.5, now, 0.05);
    this.engFilter.frequency.setTargetAtTime(350 + o.throttle * 900 + o.rpm * 700, now, 0.08);
    this.engGain.gain.setTargetAtTime(o.inCar ? 0.05 + 0.06 * o.throttle : 0, now, 0.1);
    // siren wails between 650 and 1300 Hz
    this.sirenOsc.frequency.setTargetAtTime(950 + Math.sin(t * 5) * 320, now, 0.02);
    this.sirenGain.gain.setTargetAtTime(0.06 * o.siren, now, 0.2);
    this.hornGain.gain.setTargetAtTime(o.horn ? 0.08 : 0, now, 0.01);
    const playRadio = o.inCar && this.radioOn && this.station < 2;
    this.radioGain.gain.setTargetAtTime(playRadio ? 0.32 : 0, now, 0.3);
    // schedule the radio a little ahead
    while (this.nextBeat < now + 0.2) {
      this.scheduleStep(this.nextBeat);
      const bpm = this.station === 0 ? 130 : 92;
      this.nextBeat += 60 / bpm / 4;
      this.step = (this.step + 1) % 32;
    }
  }

  nextStation() {
    this.station = (this.station + 1) % this.stations.length;
    return this.stations[this.station];
  }

  private scheduleStep(t: number) {
    const ctx = this.ctx!;
    const s = this.step;
    const out = this.radioGain;
    if (this.station === 0) {
      // "tamborzão"-style pattern: kick, snare claps and a tom groove
      const kick = [0, 3, 6, 10, 16, 19, 22, 26];
      const clap = [4, 12, 20, 28];
      const tom = [7, 14, 15, 23, 30, 31];
      if (kick.includes(s)) this.drum(t, 150, 45, 0.9, 0.28, out);
      if (clap.includes(s)) this.noise(t, 0.12, 0.35, 1800, out);
      if (tom.includes(s)) this.drum(t, 260, 140, 0.35, 0.12, out);
      if (s % 2 === 0) this.noise(t, 0.03, 0.06, 7000, out);
      if (s % 8 === 0) this.tone(t, [110, 110, 98, 131][Math.floor(s / 8)], 0.35, 0.12, "sawtooth", out);
    } else if (this.station === 1) {
      // soft bossa: rim clicks and jazzy chords
      const chords = [[220, 277, 330, 415], [196, 247, 294, 370], [175, 220, 262, 330], [165, 208, 247, 311]];
      if ([0, 3, 6, 10, 13].includes(s % 16)) this.noise(t, 0.02, 0.08, 3500, out);
      if (s % 8 === 0) this.drum(t, 90, 50, 0.4, 0.2, out);
      if (s % 8 === 0 || s % 8 === 3) for (const f of chords[Math.floor(s / 8)]) this.tone(t, f, 0.5, 0.025, "triangle", out);
    }
  }

  private drum(t: number, f0: number, f1: number, vol: number, dur: number, out: AudioNode) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(t: number, dur: number, vol: number, freq: number, out: AudioNode) {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t);
  }

  private tone(t: number, f: number, dur: number, vol: number, type: OscillatorType, out: AudioNode) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  crash(power: number) {
    if (!this.ctx) return;
    this.noise(this.ctx.currentTime, 0.35, Math.min(0.8, power * 0.05), 300, this.master);
  }

  cash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(t, 988, 0.12, 0.15, "square", this.master);
    this.tone(t + 0.09, 1319, 0.3, 0.15, "square", this.master);
  }

  bust() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523, 415, 330, 262].forEach((f, i) => this.tone(t + i * 0.18, f, 0.3, 0.15, "sawtooth", this.master));
  }
}
