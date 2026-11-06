// Minimal browser shim so the real Game class can be driven in Node without
// Playwright (no browser is downloadable in this sandbox). Only the handful of
// globals the game actually touches are provided; everything else is real.
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';

let fontsReady = false;
function registerFonts() {
  if (fontsReady) return;
  fontsReady = true;
  for (const w of [600, 700]) {
    try { GlobalFonts.registerFromPath(`node_modules/@fontsource/lora/files/lora-latin-${w}-normal.woff`, 'Lora'); } catch { /* optional */ }
  }
  for (const w of [400, 500, 600, 700]) {
    for (const sub of ['latin', 'vietnamese']) {
      try { GlobalFonts.registerFromPath(`node_modules/@fontsource/be-vietnam-pro/files/be-vietnam-pro-${sub}-${w}-normal.woff`, 'Be Vietnam Pro'); } catch { /* optional */ }
    }
  }
}

/**
 * Install the shim and boot a Game.
 * @returns {{canvas, game, step, click, rects, flushFade, clock}}
 */
export async function bootGame({ width = 1280, height = 720, localStorageSeed = null } = {}) {
  registerFonts();
  const canvas = createCanvas(width, height);
  const listeners = new Map();
  const addL = (t, fn) => { if (!listeners.has(t)) listeners.set(t, []); listeners.get(t).push(fn); };

  globalThis.addEventListener = addL;
  globalThis.removeEventListener = () => {};
  globalThis.innerWidth = width;
  globalThis.innerHeight = height;
  globalThis.devicePixelRatio = 1;
  globalThis.performance = globalThis.performance || { now: () => Date.now() };
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
  globalThis.document = {
    hidden: false,
    documentElement: { lang: 'vi', dataset: {} },
    createElement: () => createCanvas(1, 1),
    addEventListener: addL,
  };
  canvas.addEventListener = addL;
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width, height, right: width, bottom: height });
  canvas.style = {};
  canvas.clientWidth = width;
  canvas.clientHeight = height;

  const mem = new Map();
  if (localStorageSeed) for (const [k, v] of Object.entries(localStorageSeed)) mem.set(k, v);
  globalThis.localStorage = {
    _m: mem,
    getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
    setItem(k, v) { this._m.set(k, String(v)); },
    removeItem(k) { this._m.delete(k); },
    get length() { return this._m.size; },
    key(i) { return [...this._m.keys()][i] ?? null; },
  };
  // Node 22 makes globalThis.navigator getter-only.
  Object.defineProperty(globalThis, 'navigator', {
    value: { maxTouchPoints: 0, getGamepads: () => [], vibrate: () => {} },
    configurable: true,
    writable: true,
  });
  globalThis.AudioContext = undefined;

  const { Game } = await import('../src/game.js');
  const game = new Game(canvas);

  let clock = 1000;
  const dt = 1 / 60;
  function step(n = 1) {
    for (let i = 0; i < n; i++) {
      clock += dt * 1000;
      game.last = clock - dt * 1000;
      game.frame(clock);
      game.draw();
    }
  }
  function rects() {
    return game.scene === 'run' ? (game.hitRects || []) : (game._cachedRects || []);
  }
  function click(id) {
    const r = rects().find((x) => x.id === id);
    if (!r) return false;
    game.click(id, r.x + r.w / 2, r.y + r.h / 2);
    return true;
  }
  function flushFade() { step(40); }

  return { canvas, game, step, click, rects, flushFade, localStorage: globalThis.localStorage };
}
