import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
globalThis.document = { createElement: () => createCanvas(1, 1) };
const { drawCreature } = await import('../src/art/creatureart.js');
const { drawCat } = await import('../src/art/catart.js');
const { ENEMY_BY_ID, BOSS_BY_ID } = await import('../src/data/enemies.js');
// render each on its own layer, then scan pixels for the ink bounds
function bounds(label, fn, box = 400) {
  const cv = createCanvas(box, box);
  const ctx = cv.getContext('2d');
  ctx.translate(box / 2, box * 0.75);
  fn(ctx);
  const d = ctx.getImageData(0, 0, box, box).data;
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (let y = 0; y < box; y++) for (let x = 0; x < box; x++) {
    if (d[(y * box + x) * 4 + 3] > 24) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  console.log(label.padEnd(7), 'w', maxX - minX, 'h', maxY - minY, 'top', minY - box * 0.75, 'bottom', maxY - box * 0.75);
}
bounds('cat', (c) => drawCat(c, { look: { body: 1, head: 1, fur: 'short', stripes: 0, tail: 'ring', tailLen: 1, ear: 'point', cheek: 0, fluff: 0, earTuft: 0 }, color: '#f2a24b', color2: '#c96a2a', color3: '#ffe0b0', eye: '#7fe0a8' }, { t: 0 }, { x: 0, y: 0, scale: 1 }));
for (const id of ['grub', 'darter', 'brute', 'spitter']) {
  bounds(id, (c) => drawCreature(c, ENEMY_BY_ID[id], 0, 0, 1, { t: 0 }), 300);
}
bounds('boss', (c) => drawCreature(c, BOSS_BY_ID.moon_devourer, 0, 0, 1, { t: 0 }), 600);
