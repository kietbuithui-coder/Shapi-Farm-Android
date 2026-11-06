import { createCanvas } from '@napi-rs/canvas';
globalThis.document = { createElement: () => createCanvas(1, 1) };
const { drawCreature } = await import('../src/art/creatureart.js');
const { drawCat } = await import('../src/art/catart.js');
const { ENEMIES, ENEMY_BY_ID, BOSS_BY_ID } = await import('../src/data/enemies.js');
const cv = createCanvas(10, 10); const ctx = cv.getContext('2d');
// measure drawn extents by intercepting path ops
for (const [label, fn] of [
  ['cat', (c) => drawCat(c, { look: { body: 1, head: 1, fur: 'short', stripes: 0, tail: 'ring', tailLen: 1, ear: 'point', cheek: 0, fluff: 0, earTuft: 0 }, color: '#f2a24b', color2: '#c96a2a', color3: '#ffe0b0', eye: '#7fe0a8' }, {}, { x: 0, y: 0, scale: 1 })],
  ['grub', (c) => drawCreature(c, ENEMY_BY_ID.grub, 0, 0, 1, {})],
  ['rat', (c) => drawCreature(c, ENEMY_BY_ID.darter, 0, 0, 1, {})],
  ['golem', (c) => drawCreature(c, ENEMY_BY_ID.brute, 0, 0, 1, {})],
  ['boss', (c) => drawCreature(c, BOSS_BY_ID.moon_devourer, 0, 0, 1, {})],
]) {
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  const probe = new Proxy(ctx, { get(t, k) { return t[k]; } });
  const track = (x, y) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); };
  ctx.beginPath = () => { }; // noop
  const wrapped = new Proxy(ctx, {
    get(t, k) {
      if (k === 'moveTo' || k === 'lineTo') return (x, y) => track(x, y);
      if (k === 'arc') return (x, y, r) => track(x - r, y - r) || track(x + r, y + r);
      if (k === 'ellipse') return (x, y, rx, ry) => track(x - rx, y - ry) || track(x + rx, y + ry);
      if (k === 'quadraticCurveTo' || k === 'bezierCurveTo' || k === 'arcTo') return (...a) => { for (let i = 0; i + 1 < a.length; i += 2) track(a[i], a[i + 1]); };
      if (k === 'fillRect') return (x, y, w, h) => { track(x, y); track(x + w, y + h); };
      return t[k];
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  fn(wrapped);
  console.log(label.padEnd(6), 'w', Math.round(maxX - minX), 'h', Math.round(maxY - minY), 'yTop', Math.round(minY), 'yBottom', Math.round(maxY));
}
