// Renders the three arena environments in a headless canvas with a DOM shim so
// background art can be reviewed without a browser.
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
globalThis.document = { createElement: (tag) => {
  if (tag !== 'canvas') throw new Error('only canvas supported');
  const c = createCanvas(1, 1);
  return c;
}};
const { getEnvironment, drawAtmosphere } = await import('../src/art/env.js');
const { ACTS } = await import('../src/data/acts.js');
const W = 1180, H = 660;
const sheet = createCanvas(W * 3, H);
const sctx = sheet.getContext('2d');
ACTS.forEach((act, i) => {
  const cv = getEnvironment(act, W, H);
  sctx.drawImage(cv, i * W, 0);
  const c2 = createCanvas(W, H);
  const c2x = c2.getContext('2d');
  c2x.drawImage(cv, 0, 0);
  drawAtmosphere(c2x, act, W, H, 3.2, 1);
  sctx.drawImage(c2, i * W, 0);
  sctx.fillStyle = '#fff'; sctx.font = 'bold 22px sans-serif';
  sctx.fillText(act.name.en + ' — ' + act.subtitle.en, i * W + 28, 40);
});
writeFileSync('public/art-check/env.png', sheet.toBuffer('image/png'));
console.log('ok');
