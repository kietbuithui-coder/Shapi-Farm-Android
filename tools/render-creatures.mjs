import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { drawCreature } from '../src/art/creatureart.js';
import { ENEMIES, MINIBOSSES, BOSSES } from '../src/data/enemies.js';

const cv = createCanvas(1500, 900), ctx = cv.getContext('2d');
ctx.fillStyle = '#0d1226'; ctx.fillRect(0, 0, 1500, 900);
ctx.fillStyle = '#141c38'; ctx.fillRect(0, 700, 1500, 200);
const all = [...ENEMIES, ...MINIBOSSES, ...BOSSES];
all.forEach((e, i) => {
  const col = i % 8, row = Math.floor(i / 8);
  const x = 90 + col * 180, y = 210 + row * 240;
  drawCreature(ctx, e, { t: 0.6, phase: 1 }, { x, y, scale: e.radius > 30 ? 1.5 : 2.0, facing: 1 });
  ctx.fillStyle = '#f4ecd8'; ctx.font = '600 13px sans-serif';
  ctx.fillText(e.name?.en || e.id, x - 60, y + 42);
  ctx.fillStyle = '#7f8db4'; ctx.font = '11px sans-serif';
  ctx.fillText(e.id, x - 60, y + 58);
});
writeFileSync('public/art-check/creatures.png', cv.toBuffer('image/png'));
console.log('ok');
