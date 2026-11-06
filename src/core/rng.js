// Seeded run randomness, kept separate from visual noise so runs are reproducible
// under a fixed seed (used by the simulation tests and daily-run style seeds).
import { mulberry32 } from './math.js';

export class Rng {
  constructor(seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0) {
    this.seed = seed >>> 0;
    this._next = mulberry32(this.seed);
  }
  float() { return this._next(); }
  range(min, max) { return min + this._next() * (max - min); }
  int(min, max) { return Math.floor(this.range(min, max + 1)); }
  chance(p) { return this._next() < p; }
  pick(list) { return list.length ? list[Math.floor(this._next() * list.length)] : undefined; }
  sign() { return this._next() < 0.5 ? -1 : 1; }
  /** Pick a random unit vector. */
  dir() {
    const a = this._next() * Math.PI * 2;
    return { x: Math.cos(a), y: Math.sin(a) };
  }
  shuffle(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this._next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  weighted(entries) {
    let total = 0;
    for (const e of entries) total += e.weight;
    if (total <= 0) return undefined;
    let roll = this._next() * total;
    for (const e of entries) {
      roll -= e.weight;
      if (roll <= 0) return e.value;
    }
    return entries[entries.length - 1].value;
  }
}
