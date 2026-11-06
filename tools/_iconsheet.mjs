import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
const { ICON_NAMES, drawIcon } = await import('/home/user/Shapi-Farm-Android/src/art/icons.js');
const cols = 10, cell = 90;
const rows = Math.ceil(ICON_NAMES.length / cols);
const cv = createCanvas(cols * cell, rows * cell);
const ctx = cv.getContext('2d');
ctx.fillStyle = '#101528'; ctx.fillRect(0, 0, cv.width, cv.height);
ICON_NAMES.forEach((n, i) => {
  const x = (i % cols) * cell + cell / 2, y = Math.floor(i / cols) * cell + cell / 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.strokeRect(x - cell/2, y - cell/2, cell, cell);
  drawIcon(ctx, n, x, y - 6, 36, '#ffe8a8');
  ctx.fillStyle = '#8892b0'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(n, x, y + 34);
});
writeFileSync('/home/user/Shapi-Farm-Android/public/art-check/icons.png', cv.toBuffer('image/png'));
console.log(ICON_NAMES.length);
