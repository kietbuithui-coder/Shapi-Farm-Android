// Procedural audio. Everything — music stings, UI clicks, meows, impacts — is
// synthesised with WebAudio, so the game ships with zero audio files and still
// has a full soundscape. All calls are safe when audio is unavailable.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const SCALE = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  pent: [0, 2, 4, 7, 9],
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.voiceGain = null;
    this.volumes = { music: 0.55, sfx: 0.75, voice: 0.8 };
    this.muted = false;
    this.unlocked = false;
    this.musicTimer = null;
    this.currentMood = 'menu';
    this.nextNoteAt = 0;
    this.step = 0;
    this.noiseBuffer = null;
  }

  unlock() {
    if (this.unlocked) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(c.destination);
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 5;
      comp.connect(this.master);
      this.bus = comp;
      this.musicGain = c.createGain();
      this.musicGain.gain.value = this.volumes.music * 0.5;
      this.musicGain.connect(this.bus);
      this.sfxGain = c.createGain();
      this.sfxGain.gain.value = this.volumes.sfx;
      this.sfxGain.connect(this.bus);
      this.voiceGain = c.createGain();
      this.voiceGain.gain.value = this.volumes.voice * 0.7;
      this.voiceGain.connect(this.bus);
      this.noiseBuffer = this.makeNoise(1.4);
      this.unlocked = true;
      if (c.state === 'suspended') c.resume();
    } catch (err) {
      this.unlocked = false;
      console.warn('[audio] unavailable', err);
    }
  }

  setVolumes({ music, sfx, voice }) {
    if (typeof music === 'number') this.volumes.music = music;
    if (typeof sfx === 'number') this.volumes.sfx = sfx;
    if (typeof voice === 'number') this.volumes.voice = voice;
    if (!this.unlocked) return;
    this.musicGain.gain.value = this.volumes.music * 0.5;
    this.sfxGain.gain.value = this.volumes.sfx;
    this.voiceGain.gain.value = this.volumes.voice * 0.7;
  }

  suspend() { if (this.unlocked && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.unlocked && this.ctx.state === 'suspended') this.ctx.resume(); }

  makeNoise(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Additive voice: layered detuned oscillators through a filter envelope. */
  tone({ freq = 220, dur = 0.2, type = 'sine', vol = 0.3, slideTo = null, attack = 0.008, curve = 2.2, filter = null, pan = 0, bus = 'sfx', detune = 0 }) {
    if (!this.unlocked || this.volumes[bus] <= 0) return;
    const c = this.ctx;
    const t0 = c.currentTime;
    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + attack);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = out;
    if (filter) {
      const f = c.createBiquadFilter();
      f.type = filter.type || 'lowpass';
      f.frequency.setValueAtTime(filter.from || 1800, t0);
      f.frequency.exponentialRampToValueAtTime(Math.max(80, filter.to || 600), t0 + dur);
      f.Q.value = filter.q ?? 1;
      out.connect(f);
      node = f;
    }
    if (pan) {
      const p = c.createStereoPanner ? c.createStereoPanner() : null;
      if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); node.connect(p); node = p; }
    }
    node.connect(bus === 'music' ? this.musicGain : bus === 'voice' ? this.voiceGain : this.sfxGain);
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    if (detune) osc.detune.value = detune;
    osc.connect(out);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise({ dur = 0.2, vol = 0.2, from = 4000, to = 400, q = 0.8, type = 'lowpass', pan = 0 }) {
    if (!this.unlocked || this.volumes.sfx <= 0) return;
    const c = this.ctx;
    const t0 = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(from, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, to), t0 + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const p = c.createStereoPanner ? c.createStereoPanner() : null;
    src.connect(f).connect(g);
    if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(this.sfxGain); }
    else g.connect(this.sfxGain);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /* ── game sounds ──────────────────────────────────────────────────────── */
  // Call sites have historically used several spellings for the same cue
  // ('denied' vs 'deny', 'click' vs 'tap', 'close' vs 'back'). Normalising here
  // keeps every one of them audible instead of silently dropping the sound.
  static UI_ALIASES = { denied: 'deny', click: 'tap', close: 'back', confirm: 'pick', error: 'deny' };

  ui(kind = 'tap') {
    kind = AudioEngine.UI_ALIASES[kind] || kind;
    if (kind === 'tap') this.tone({ freq: 620, dur: 0.07, vol: 0.1, type: 'triangle', slideTo: 900 });
    else if (kind === 'open') { this.tone({ freq: 320, dur: 0.16, vol: 0.1, type: 'sine', slideTo: 520 }); this.tone({ freq: 640, dur: 0.2, vol: 0.05, type: 'sine', slideTo: 780 }); }
    else if (kind === 'back') this.tone({ freq: 420, dur: 0.12, vol: 0.09, type: 'triangle', slideTo: 260 });
    else if (kind === 'deny') { this.tone({ freq: 180, dur: 0.14, vol: 0.14, type: 'square', slideTo: 120 }); }
    else if (kind === 'pick') { this.tone({ freq: 520, dur: 0.18, vol: 0.12, type: 'triangle', slideTo: 780 }); }
  }

  meow(pitch = 1, pan = 0) {
    if (!this.unlocked) return;
    const c = this.ctx;
    const t0 = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    const f = c.createBiquadFilter();
    o.type = 'sawtooth';
    f.type = 'bandpass';
    f.Q.value = 6;
    const base = 420 * pitch;
    o.frequency.setValueAtTime(base * 0.8, t0);
    o.frequency.linearRampToValueAtTime(base * 1.25, t0 + 0.08);
    o.frequency.linearRampToValueAtTime(base * 0.72, t0 + 0.34);
    f.frequency.setValueAtTime(900 * pitch, t0);
    f.frequency.linearRampToValueAtTime(1500 * pitch, t0 + 0.1);
    f.frequency.linearRampToValueAtTime(700 * pitch, t0 + 0.34);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
    const p = c.createStereoPanner ? c.createStereoPanner() : null;
    o.connect(f).connect(g);
    if (p) { p.pan.value = pan; g.connect(p); p.connect(this.voiceGain); }
    else g.connect(this.voiceGain);
    o.start(t0);
    o.stop(t0 + 0.44);
  }

  hit(kind = 'slash', intensity = 0.5, pan = 0) {
    if (kind === 'slash') {
      this.noise({ dur: 0.09 + intensity * 0.05, vol: 0.1 + intensity * 0.12, from: 5200, to: 900, q: 1.4, pan });
      this.tone({ freq: 300 + intensity * 200, dur: 0.07, vol: 0.06, type: 'triangle', slideTo: 140, pan });
    } else if (kind === 'heavy') {
      this.noise({ dur: 0.2, vol: 0.24, from: 900, to: 120, q: 0.9, pan });
      this.tone({ freq: 110, dur: 0.22, vol: 0.2, type: 'sine', slideTo: 46, pan });
    } else if (kind === 'magic') {
      this.tone({ freq: 780, dur: 0.18, vol: 0.1, type: 'sine', slideTo: 1400, pan });
      this.noise({ dur: 0.14, vol: 0.06, from: 7000, to: 2200, q: 2, pan });
    } else if (kind === 'bow') {
      this.tone({ freq: 340, dur: 0.09, vol: 0.09, type: 'triangle', slideTo: 520, pan });
    }
  }

  hurt() {
    this.tone({ freq: 240, dur: 0.24, vol: 0.2, type: 'sawtooth', slideTo: 80 });
    this.noise({ dur: 0.18, vol: 0.16, from: 2200, to: 200 });
  }

  death() {
    this.tone({ freq: 320, dur: 0.5, vol: 0.16, type: 'sine', slideTo: 70 });
    this.tone({ freq: 160, dur: 0.6, vol: 0.12, type: 'triangle', slideTo: 48 });
  }

  pickup(kind = 'xp') {
    if (kind === 'xp') this.tone({ freq: NOTE(76), dur: 0.09, vol: 0.07, type: 'sine', slideTo: NOTE(83) });
    else if (kind === 'coin') { this.tone({ freq: NOTE(88), dur: 0.07, vol: 0.06, type: 'triangle' }); this.tone({ freq: NOTE(93), dur: 0.12, vol: 0.05, type: 'triangle' }); }
    else if (kind === 'hp') this.tone({ freq: NOTE(69), dur: 0.22, vol: 0.09, type: 'sine', slideTo: NOTE(76) });
  }

  levelUp() {
    const notes = [69, 72, 76, 81];
    notes.forEach((n, i) => setTimeout(() => this.tone({ freq: NOTE(n), dur: 0.4, vol: 0.12, type: 'triangle' }), i * 70));
  }

  bossWarn() {
    this.tone({ freq: 62, dur: 1.1, vol: 0.26, type: 'sawtooth', filter: { from: 400, to: 90 } });
    this.noise({ dur: 1.2, vol: 0.1, from: 600, to: 90, q: 0.6 });
  }

  victory() {
    const seq = [69, 72, 76, 81, 84];
    seq.forEach((n, i) => setTimeout(() => {
      this.tone({ freq: NOTE(n), dur: 0.9, vol: 0.14, type: 'triangle' });
      this.tone({ freq: NOTE(n - 12), dur: 0.9, vol: 0.08, type: 'sine' });
    }, i * 130));
  }

  /* ── ambient score ────────────────────────────────────────────────────── */
  startMusic(mood = 'menu') {
    if (!this.unlocked) return;
    this.currentMood = mood;
    if (this.musicTimer) return;
    const tick = () => {
      if (!this.unlocked) return;
      this.scheduleBar();
      this.musicTimer = setTimeout(tick, 900);
    };
    this.musicTimer = setTimeout(tick, 60);
  }

  stopMusic() {
    if (this.musicTimer) { clearTimeout(this.musicTimer); this.musicTimer = null; }
  }

  scheduleBar() {
    if (!this.unlocked || this.volumes.music <= 0) return;
    const mood = this.currentMood;
    const roots = mood === 'battle' ? [50, 50, 48, 46] : mood === 'boss' ? [45, 45, 43, 44] : mood === 'menu' ? [45, 48, 43, 50] : [43, 46, 41, 48];
    const root = roots[Math.floor(this.step / 4) % roots.length];
    const scale = mood === 'menu' ? SCALE.dorian : SCALE.minor;
    const density = mood === 'boss' ? 0.62 : mood === 'battle' ? 0.44 : 0.28;
    const beat = this.step % 4;
    // soft pad on the bar
    if (beat === 0) {
      this.tone({ freq: NOTE(root - 12), dur: 3.4, vol: 0.11, type: 'sine', attack: 0.9, bus: 'music' });
      this.tone({ freq: NOTE(root - 5), dur: 3.2, vol: 0.06, type: 'sine', attack: 1.1, bus: 'music', detune: 4 });
    }
    if (beat === 2) this.tone({ freq: NOTE(root + 3), dur: 2.2, vol: 0.035, type: 'triangle', attack: 0.5, bus: 'music' });
    if (Math.random() < density) {
      const deg = scale[Math.floor(Math.random() * scale.length)];
      const oct = Math.random() < 0.35 ? 12 : 0;
      const n = root + deg + oct + 12;
      const pluck = mood === 'menu' ? 'sine' : 'triangle';
      this.tone({ freq: NOTE(n), dur: mood === 'boss' ? 0.5 : 0.9, vol: mood === 'boss' ? 0.06 : 0.045, type: pluck, attack: 0.01, bus: 'music' });
      if (Math.random() < 0.3) this.tone({ freq: NOTE(n + 7), dur: 1.2, vol: 0.03, type: 'sine', attack: 0.02, bus: 'music' });
    }
    // heartbeat pulse in combat
    if (mood !== 'menu' && mood !== 'result') {
      if (beat === 0 || beat === 2) this.tone({ freq: 54, dur: 0.26, vol: 0.12, type: 'sine', bus: 'music', slideTo: 40 });
      if (mood === 'boss' && beat === 3) this.noise({ dur: 0.16, vol: 0.05, from: 900, to: 200, q: 1.2 });
    }
    this.step++;
  }
}

export const audio = new AudioEngine();
