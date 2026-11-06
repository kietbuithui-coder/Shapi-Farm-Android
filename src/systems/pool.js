// Object pools. Every projectile, particle and damage number comes from here so
// long runs never grow the heap or trigger GC hitches on mid-range Android.

export class Pool {
  constructor(factory, reset, initial = 0) {
    this.factory = factory;
    this.reset = reset;
    this.free = [];
    this.active = [];
    this.created = 0;
    for (let i = 0; i < initial; i++) this.free.push(this._make());
  }
  _make() { this.created++; return this.factory(); }
  spawn(setup) {
    const item = this.free.pop() || this._make();
    this.reset(item);
    if (setup) setup(item);
    this.active.push(item);
    return item;
  }
  /** Iterate active items; return false from fn to release immediately. */
  each(fn) {
    const list = this.active;
    for (let i = list.length - 1; i >= 0; i--) {
      const item = list[i];
      const keep = fn(item, i);
      if (keep === false) {
        list.splice(i, 1);
        this.free.push(item);
      }
    }
  }
  sweep(predicate) {
    const list = this.active;
    for (let i = list.length - 1; i >= 0; i--) {
      if (predicate(list[i])) {
        const it = list[i];
        list.splice(i, 1);
        this.free.push(it);
      }
    }
  }
  releaseAll() {
    while (this.active.length) this.free.push(this.active.pop());
  }
  get count() { return this.active.length; }
}

/** Ring-buffer particle system with a hard cap (mobile safe). */
export class ParticleSystem {
  constructor(cap = 520) {
    this.cap = cap;
    this.items = new Array(cap);
    for (let i = 0; i < cap; i++) {
      this.items[i] = { live: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, color: '#fff', kind: 'spark', drag: 0.92, grav: 0, rot: 0, spin: 0, alpha: 1 };
    }
    this.cursor = 0;
  }
  emit(opts) {
    // Find the oldest-dead slot first, otherwise overwrite the cursor slot.
    const n = this.items.length;
    for (let k = 0; k < n; k++) {
      const p = this.items[this.cursor];
      this.cursor = (this.cursor + 1) % n;
      if (!p.live) { Object.assign(p, opts, { live: true, max: opts.life || 0.4, life: opts.life || 0.4 }); return p; }
    }
    const p = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % n;
    Object.assign(p, opts, { live: true, max: opts.life || 0.4, life: opts.life || 0.4 });
    return p;
  }
  burst(x, y, count, opts = {}) {
    const spread = opts.spread ?? Math.PI * 2;
    const dir = opts.dir ?? 0;
    for (let i = 0; i < count; i++) {
      const a = dir + (Math.random() - 0.5) * spread;
      const sp = (opts.speed ?? 90) * (0.4 + Math.random() * 0.8);
      this.emit({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp + (opts.up ?? 0),
        life: (opts.life ?? 0.45) * (0.7 + Math.random() * 0.6),
        size: (opts.size ?? 3) * (0.6 + Math.random() * 0.8),
        color: Array.isArray(opts.color) ? opts.color[(Math.random() * opts.color.length) | 0] : (opts.color ?? '#fff'),
        kind: opts.kind ?? 'spark',
        drag: opts.drag ?? 0.9,
        grav: opts.grav ?? 0,
        spin: (Math.random() - 0.5) * 8,
        alpha: opts.alpha ?? 1,
      });
    }
  }
  update(dt) {
    for (const p of this.items) {
      if (!p.live) continue;
      p.life -= dt;
      if (p.life <= 0) { p.live = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.grav * dt;
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d;
      p.vy *= d;
      p.rot += p.spin * dt;
    }
  }
  get liveCount() {
    let n = 0;
    for (const p of this.items) if (p.live) n++;
    return n;
  }
  clear() { for (const p of this.items) p.live = false; }
}
