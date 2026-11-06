// Audio tests. The game must stay silent-but-alive with no Web Audio (headless,
// old browsers) and must build a correct gain graph when audio is available.
//
// A hand-rolled fake AudioContext lets us assert on the real graph the engine
// builds without a browser.
import test from 'node:test';
import assert from 'node:assert/strict';

class FakeParam {
  constructor(v = 0) { this.value = v; this.setCalls = []; }
  setValueAtTime(v) { this.value = v; this.setCalls.push(v); return this; }
  linearRampToValueAtTime(v) { this.value = v; return this; }
  exponentialRampToValueAtTime(v) { this.value = v; return this; }
  cancelScheduledValues() { return this; }
  setTargetAtTime(v) { this.value = v; return this; }
}

class FakeNode {
  constructor(kind) { this.kind = kind; this.outputs = []; this.params = new Map(); }
  connect(dst) { this.outputs.push(dst); return dst; }
  disconnect() { this.outputs.length = 0; }
  _param(name, v = 0) {
    if (!this.params.has(name)) this.params.set(name, new FakeParam(v));
    return this.params.get(name);
  }
}

class FakeGain extends FakeNode {
  constructor() { super('gain'); this.gain = this._param('gain', 1); }
}
class FakeOsc extends FakeNode {
  constructor() {
    super('osc');
    this.frequency = this._param('frequency', 440);
    this.detune = this._param('detune', 0);
    this.started = 0; this.stopped = 0; this.type = 'sine';
  }
  start(t) { this.started++; this.startAt = t; return this; }
  stop(t) { this.stopped++; this.stopAt = t; return this; }
  setPeriodicWave() { return this; }
}
class FakeBufferSource extends FakeNode {
  constructor() { super('buffer'); this.buffer = null; this.playbackRate = this._param('playbackRate', 1); this.started = 0; }
  start() { this.started++; return this; }
  stop() { return this; }
}
class FakeFilter extends FakeNode {
  constructor() { super('filter'); this.type = 'lowpass'; this.frequency = this._param('frequency', 1000); this.Q = this._param('Q', 1); }
}
class FakeComp extends FakeNode {
  constructor() { super('comp'); this.threshold = this._param('threshold', 0); this.ratio = this._param('ratio', 1); }
}
class FakePanner extends FakeNode {
  constructor() { super('panner'); this.pan = this._param('pan', 0); this.positionX = this._param('positionX', 0); }
}

class FakeAudioContext {
  constructor() {
    this.destination = new FakeNode('destination');
    this.state = 'running';
    this.currentTime = 0;
    this.sampleRate = 48000;
    this.created = [];
  }
  _track(n) { this.created.push(n); return n; }
  createGain() { return this._track(new FakeGain()); }
  createOscillator() { return this._track(new FakeOsc()); }
  createBufferSource() { return this._track(new FakeBufferSource()); }
  createBiquadFilter() { return this._track(new FakeFilter()); }
  createDynamicsCompressor() { return this._track(new FakeComp()); }
  createStereoPanner() { return this._track(new FakePanner()); }
  createBuffer(channels, length, rate) {
    const data = new Float32Array(length);
    return { numberOfChannels: channels, length, sampleRate: rate, getChannelData: () => data };
  }
  createPeriodicWave() { return {}; }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  resume() { this.state = 'running'; return Promise.resolve(); }
}

function withFakeWindow() {
  const ctx = new FakeAudioContext();
  const calls = [];
  globalThis.window = {
    AudioContext: class extends FakeAudioContext {
      constructor() { super(); calls.push(this); }
    },
  };
  return { calls };
}

test('the engine is a no-op instead of a crash when Web Audio is missing', async () => {
  globalThis.window = {};
  const { AudioEngine } = await import('../src/audio/audio.js');
  const a = new AudioEngine();
  assert.doesNotThrow(() => a.unlock());
  assert.equal(a.unlocked, false);

  // every public sound must be safe before unlock
  const methods = ['ui', 'meow', 'hit', 'hurt', 'death', 'pickup', 'levelUp', 'bossWarn', 'victory', 'startMusic', 'stopMusic', 'suspend', 'resume'];
  for (const m of methods) {
    assert.doesNotThrow(() => a[m](), `${m}() is safe with no audio context`);
  }
  assert.doesNotThrow(() => a.setVolumes({ music: 0.1, sfx: 0.2, voice: 0.3 }));
  assert.equal(a.volumes.music, 0.1, 'volumes are stored even when silent');
});

test('unlock builds a master → compressor → destination graph', async () => {
  withFakeWindow();
  const { AudioEngine } = await import('../src/audio/audio.js');
  const a = new AudioEngine();
  a.unlock();
  assert.equal(a.unlocked, true, 'unlocked');
  assert.ok(a.ctx, 'context created');
  assert.ok(a.master && a.bus && a.musicGain && a.sfxGain && a.voiceGain, 'all buses exist');
  assert.equal(a.master.outputs[0], a.ctx.destination, 'master feeds the destination');
  assert.equal(a.musicGain.outputs[0], a.bus, 'music feeds the compressor');
  assert.equal(a.sfxGain.outputs[0], a.bus, 'sfx feeds the compressor');
  assert.equal(a.voiceGain.outputs[0], a.bus, 'voice feeds the compressor');
  assert.equal(a.bus.outputs[0], a.master, 'compressor feeds master');
});

test('setVolumes moves the real gain nodes and clamps nothing silently', async () => {
  withFakeWindow();
  const { AudioEngine } = await import('../src/audio/audio.js');
  const a = new AudioEngine();
  a.unlock();
  a.setVolumes({ music: 0.4, sfx: 0.5, voice: 0.6 });
  assert.equal(a.musicGain.gain.value, 0.4 * 0.5);
  assert.equal(a.sfxGain.gain.value, 0.5);
  assert.equal(a.voiceGain.gain.value, 0.6 * 0.7);
  // non-numbers must be ignored rather than written as NaN
  a.setVolumes({ music: 'loud', sfx: null, voice: undefined });
  assert.equal(a.musicGain.gain.value, 0.4 * 0.5, 'music unchanged');
  assert.equal(a.sfxGain.gain.value, 0.5, 'sfx unchanged');
});

test('every sound effect actually starts and schedules nodes', async () => {
  const { calls } = withFakeWindow();
  const { AudioEngine } = await import('../src/audio/audio.js');
  const a = new AudioEngine();
  a.unlock();
  const ctx = calls[0];
  assert.ok(ctx, 'context instantiated');

  // levelUp/victory are arpeggios scheduled on timers; they are asserted in the
  // dedicated test below rather than here.
  const cases = [
    ['ui', () => a.ui('tap')],
    ['ui-deny', () => a.ui('deny')],
    ['ui-denied-alias', () => a.ui('denied')],
    ['ui-open', () => a.ui('open')],
    ['ui-back', () => a.ui('back')],
    ['ui-pick', () => a.ui('pick')],
    ['meow', () => a.meow(1.2, -0.4)],
    ['hit', () => a.hit('slash', 0.9, 0.3)],
    ['hurt', () => a.hurt()],
    ['death', () => a.death()],
    ['pickup-xp', () => a.pickup('xp')],
    ['pickup-coin', () => a.pickup('coin')],
    ['pickup-hp', () => a.pickup('hp')],
    ['bossWarn', () => a.bossWarn()],
  ];
  for (const [name, fn] of cases) {
    const before = ctx.created.length;
    assert.doesNotThrow(fn, `${name} does not throw`);
    assert.ok(ctx.created.length > before, `${name} built at least one audio node`);
  }

  // oscillators actually get started, not just created
  const oscs = ctx.created.filter((n) => n.kind === 'osc');
  assert.ok(oscs.length > 0, 'oscillators created');
  assert.ok(oscs.every((o) => o.started >= 1), 'every oscillator was started');
  assert.ok(oscs.some((o) => o.stopAt > o.startAt), 'notes have a real duration');

  a.stopMusic();
  assert.equal(a.musicTimer, null, 'music timer cleared');
  a.unlocked = false; // stop the scheduler from re-arming and holding the event loop
});

test('music restarts safely and does not stack timers', async () => {
  withFakeWindow();
  const { AudioEngine } = await import('../src/audio/audio.js');
  const a = new AudioEngine();
  a.unlock();
  a.startMusic('menu');
  const first = a.musicTimer;
  assert.ok(first != null, 'music scheduled');
  a.startMusic('night');           // mood change while playing
  assert.equal(a.currentMood, 'night');
  assert.ok(a.musicTimer != null, 'still scheduled');
  a.startMusic('menu');
  a.stopMusic();
  assert.equal(a.musicTimer, null);
  a.stopMusic();                   // double stop is harmless
  a.unlocked = false;              // release the scheduler
});

test('music actually produces notes once its scheduler runs', async () => {
  const { calls } = withFakeWindow();
  const { AudioEngine } = await import('../src/audio/audio.js');
  const a = new AudioEngine();
  a.unlock();
  const ctx = calls[0];
  const before = ctx.created.length;
  a.startMusic('menu');
  await new Promise((r) => setTimeout(r, 220));   // first bar fires at 60ms
  assert.ok(ctx.created.length > before, 'music scheduled its first bar');
  a.stopMusic();
  a.unlocked = false;
});

test('shipping volume ranges stay inside [0,1]', async () => {
  const { DEFAULT_SETTINGS } = await import('../src/core/save.js');
  for (const k of ['music', 'sfx', 'voice']) {
    assert.ok(DEFAULT_SETTINGS[k] >= 0 && DEFAULT_SETTINGS[k] <= 1, `${k} default in range`);
  }
});

test('every UI cue the game asks for is audible (no silently ignored kinds)', async () => {
  const { calls } = withFakeWindow();
  const { AudioEngine } = await import('../src/audio/audio.js');
  const a = new AudioEngine();
  a.unlock();
  const ctx = calls[0];
  // These are the literal kinds used across src/.
  const kinds = ['tap', 'open', 'back', 'deny', 'pick', 'denied', 'click', 'close'];
  for (const k of kinds) {
    const before = ctx.created.length;
    a.ui(k);
    assert.ok(ctx.created.length > before, `ui('${k}') produces sound`);
  }
});

test('a UI cue never throws on an unknown kind', async () => {
  withFakeWindow();
  const { AudioEngine } = await import('../src/audio/audio.js');
  const a = new AudioEngine();
  a.unlock();
  assert.doesNotThrow(() => a.ui('nonsense-cue'));
  assert.doesNotThrow(() => a.ui(undefined));
});

test('the level-up and victory arpeggios actually fire on their timers', async () => {
  const { calls } = withFakeWindow();
  const { AudioEngine } = await import('../src/audio/audio.js');
  const a = new AudioEngine();
  a.unlock();
  const ctx = calls[0];

  const before = ctx.created.length;
  a.levelUp();
  await new Promise((r) => setTimeout(r, 400));
  assert.ok(ctx.created.length > before, 'level-up played its notes');

  const mid = ctx.created.length;
  a.victory();
  await new Promise((r) => setTimeout(r, 900));
  assert.ok(ctx.created.length > mid, 'victory played its notes');
  const oscs = ctx.created.filter((n) => n.kind === 'osc');
  assert.ok(oscs.every((o) => o.started >= 1), 'scheduled oscillators were started');
});
