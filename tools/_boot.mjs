// Boots the real Game class against a minimal DOM shim in Node, drives it through
// every scene, and dumps PNGs. This is the closest thing to a browser smoke test.
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';

// Font setup is shared with the test suite: it registers the latin and
// vietnamese subsets separately and rewrites ctx.font to a fallback list, which
// is the only way @napi-rs/canvas can draw "đ ơ ư" and "Ê" in the same string.
const { patchFonts } = await import('../tests/dom.mjs');

const W = 1280, H = 720;
const canvas = createCanvas(W, H);
patchFonts(canvas);
const listeners = new Map();
const addL = (t, fn) => { if (!listeners.has(t)) listeners.set(t, []); listeners.get(t).push(fn); };
globalThis.addEventListener = addL;
globalThis.removeEventListener = () => {};
globalThis.innerWidth = W;
globalThis.innerHeight = H;
globalThis.devicePixelRatio = 1;
globalThis.performance = globalThis.performance || { now: () => Date.now() };
let rafQueue = [];
globalThis.requestAnimationFrame = (fn) => { rafQueue.push(fn); return rafQueue.length; };
globalThis.document = {
  hidden: false,
  documentElement: { lang: 'vi', dataset: {} },
  createElement: () => createCanvas(1, 1),
  addEventListener: addL,
};
canvas.addEventListener = addL;
canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: W, height: H, right: W, bottom: H });
canvas.style = {};
canvas.clientWidth = W;
canvas.clientHeight = H;
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
  setItem(k, v) { this._m.set(k, String(v)); },
  removeItem(k) { this._m.delete(k); },
};
Object.defineProperty(globalThis, 'navigator', {
  value: { maxTouchPoints: 0, getGamepads: () => [], vibrate: () => {} },
  configurable: true,
});
globalThis.AudioContext = undefined;

const { Game } = await import('../src/game.js');
const game = new Game(canvas);
game.profile.embers = 5000;

let clock = 1000;
function step(n = 1, dt = 1 / 60) {
  for (let i = 0; i < n; i++) {
    clock += dt * 1000;
    game.last = clock - dt * 1000;
    game.frame(clock);
    game.draw();
  }
}
function shot(name) {
  writeFileSync(`public/art-check/boot-${name}.png`, canvas.toBuffer('image/png'));
  const list = game.scene === 'run' ? game.hitRects : (game._cachedRects || []);
  console.log('shot', name, '| scene', game.scene, '| overlay', game.overlay, '| rects', (list || []).map((r) => r.id).join(','));
}
function click(id) {
  const list = game.scene === 'run' ? game.hitRects : (game._cachedRects || []);
  const r = list.find((x) => x.id === id);
  if (!r) { console.log('!! no rect for', id, 'in', game.scene, list.map((x) => x.id).slice(0, 12)); return false; }
  game.click(id, r.x + r.w / 2, r.y + r.h / 2);
  return true;
}
function flushFade() { step(40); }

step(3); shot('home');
for (const id of ['cats', 'skills', 'upgrades', 'collection', 'settings']) {
  click(id); flushFade(); step(2); shot(id);
  click('back'); flushFade(); step(2);
}
click('cats'); flushFade(); step(2);
click('cat:black'); step(2); shot('cats-black');
click('unlock'); step(2); shot('cats-unlocked');
click('equip'); step(2);
click('start'); flushFade(); step(90); shot('run');
console.log('run state', game.run?.state, 'hp', Math.round(game.run?.hp), 'enemies', game.run?.enemies.length);

for (let i = 0; i < 40 && game.overlay === 'levelup'; i++) { click('offer:0'); step(2); }
if (game.run) { game.run.addXp(game.run.xpNeed * 4); step(4); shot('levelup'); }
if (game.overlay === 'levelup') { click('offer:0'); step(2); }

// clear the level-up overlay, then test the pause menu
for (let i = 0; i < 40 && game.overlay === 'levelup'; i++) { click('offer:0'); step(2); }
console.log('overlay before pause', game.overlay);
game.togglePause(); step(2); shot('pause');
console.log('pause rects', (game.hitRects || []).map((r) => r.id).join(','));
click('resume'); step(2);
console.log('resumed overlay', game.overlay, 'paused', game.paused);

// death → results
if (game.run) game.run.hp = 0;
for (let i = 0; i < 400 && game.scene === 'run'; i++) {
  step(1);
  if (i < 3 || i === 100 || i === 200 || i === 399) console.log('  die', i, 'hp', game.run?.hp?.toFixed(1), 'state', game.run?.state, 'overlay', game.overlay, 'timer', (game.deathTimer ?? -1).toFixed(2), 'paused', game.paused, 'scene', game.scene, 'fade', game.fade.toFixed(2));
}
console.log('after death: scene', game.scene, 'summary?', !!game.summary, 'stats', JSON.stringify(game.profile.stats).slice(0, 120));
flushFade(); step(4); shot('results');
console.log('results rects', (game._cachedRects || []).map((r) => r.id).join(','));
click('home'); flushFade(); step(3); shot('home-again');
