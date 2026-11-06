// Pure math helpers. No game state, no DOM — safe to unit-test in Node.

export const TAU = Math.PI * 2;
export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
export const saturate = (v) => clamp(v, 0, 1);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
export const dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
export const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));
export const angle = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);

/** Frame-rate independent exponential smoothing factor. */
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

/** Smoothstep eased 0..1. */
export const smooth = (t) => { const x = saturate(t); return x * x * (3 - 2 * x); };

/** Shortest signed angular difference from a to b, in (-PI, PI]. */
export function angleDelta(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
export const approachAngle = (a, b, maxStep) => a + clamp(angleDelta(a, b), -maxStep, maxStep);

/** Deterministic 32-bit hash for stable pseudo-random visuals. */
export function hash32(n) {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = x ^ (x >>> 16);
  return x >>> 0;
}
export const hash01 = (n) => hash32(n) / 4294967295;

/** Lerp between two [r,g,b] triplets. */
export const lerpRGB = (a, b, t) => [
  Math.round(lerp(a[0], b[0], t)),
  Math.round(lerp(a[1], b[1], t)),
  Math.round(lerp(a[2], b[2], t)),
];
export const rgbCss = (c, a = 1) =>
  a >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`;
export function shade(c, f) {
  const target = f < 0 ? 0 : 255;
  const p = Math.abs(f);
  return [lerp(c[0], target, p) | 0, lerp(c[1], target, p) | 0, lerp(c[2], target, p) | 0];
}

/** Mulberry32 — small deterministic RNG. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Weighted pick. `items` = [{ weight, ...}]. Returns index or -1. */
export function weightedIndex(items, rand = Math.random) {
  let total = 0;
  for (const it of items) total += Math.max(0, it.weight || 0);
  if (total <= 0) return -1;
  let roll = rand() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= Math.max(0, items[i].weight || 0);
    if (roll <= 0) return i;
  }
  return items.length - 1;
}

/** Push-out helper: keeps a circle inside a rect ring, returns {x,y}. */
export function clampToArena(x, y, r, arena) {
  const cx = arena.x + arena.w / 2;
  const cy = arena.y + arena.h / 2;
  const hw = arena.w / 2 - r;
  const hh = arena.h / 2 - r;
  return { x: clamp(x, cx - hw, cx + hw), y: clamp(y, cy - hh, cy + hh) };
}
