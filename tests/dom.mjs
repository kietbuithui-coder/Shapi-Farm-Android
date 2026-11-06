// Minimal browser shim so the real Game class can be driven in Node without
// Playwright (no browser is downloadable in this sandbox). Only the handful of
// globals the game actually touches are provided; everything else is real.
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';

/**
 * Headless font registration — the one place where the test environment has to
 * simulate something the browser does natively.
 *
 * The game ships @font-face rules with `unicode-range`, so "đ ơ ư ộ" are drawn
 * from the Vietnamese subset and "Ê â" from the latin one. @napi-rs/canvas has
 * no unicode-range support: registering both files under the same family makes
 * the later one win and halves the alphabet (this is what made screenshots read
 * "D I" instead of "DƯỚI").
 *
 * Fix: register each subset under its own single-word family, then rewrite every
 * `ctx.font` assignment so the real family expands to a fallback LIST. A list is
 * the only form this renderer resolves per glyph. The rewrite is skipped for any
 * family we did not register, so it cannot mask a genuinely missing font.
 *
 * render.sh does NOT do this (it is page-side code); verify with tools/verify-fonts.mjs,
 * which checks the shipped @font-face rules against the real font tables.
 */
let fontsReady = false;
const FAMILIES = new Map();     // "Display"/"UI" -> per-weight subset names
const WEIGHTS = new Set([400, 500, 600, 700]);

function registerFonts() {
  if (fontsReady) return;
  fontsReady = true;
  const reg = (path, name) => { try { GlobalFonts.registerFromPath(path, name); return true; } catch { return false; } };
  // Lora has no be-vietnam-style 400; the game only asks for 600/700.
  for (const w of [600, 700]) {
    reg(`node_modules/@fontsource/lora/files/lora-latin-${w}-normal.woff`, `LoraL${w}`);
    reg(`node_modules/@fontsource/lora/files/lora-vietnamese-${w}-normal.woff`, `LoraV${w}`);
  }
  for (const w of [400, 500, 600, 700]) {
    reg(`node_modules/@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-${w}-normal.woff`, `BvpL${w}`);
    reg(`node_modules/@fontsource/be-vietnam-pro/files/be-vietnam-pro-vietnamese-${w}-normal.woff`, `BvpV${w}`);
  }
  FAMILIES.set('lora', (w) => {
    const x = WEIGHTS.has(Number(w)) && Number(w) >= 600 ? w : 600;
    return `LoraV${x}, LoraL${x}`;
  });
  FAMILIES.set('be vietnam pro', (w) => {
    const x = WEIGHTS.has(Number(w)) ? w : 400;
    return `BvpV${x}, BvpL${x}`;
  });
}

/** Expand a CSS font shorthand so subset fallback happens per glyph. */
export function expandFont(shorthand) {
  if (typeof shorthand !== 'string') return shorthand;
  return shorthand.replace(/([\d.]+)px\s+(.+)$/, (all, size, rest) => {
    let families = rest;
    for (const [name, pick] of FAMILIES) {
      const re = new RegExp(`["']?${name}["']?|(^|,\\s*)${name}(?=,|$)`, 'i');
      if (!new RegExp(name, 'i').test(families)) continue;
      // keep any fallbacks the caller appended
      families = families.replace(new RegExp(`["']?${name}["']?`, 'gi'), pick(size));
    }
    return `${size}px ${families}`;
  });
}

/** Route every 2D context's font through expandFont(). */
export function patchFonts(canvas) {
  const ctx = canvas.getContext('2d');
  let proto = Object.getPrototypeOf(ctx);
  while (proto && !Object.getOwnPropertyDescriptor(proto, 'font')) proto = Object.getPrototypeOf(proto);
  const desc = proto && Object.getOwnPropertyDescriptor(proto, 'font');
  if (!desc || !desc.get || !desc.set) return false;
  if (proto.__fontPatched) return true;
  Object.defineProperty(proto, 'font', {
    configurable: true,
    enumerable: desc.enumerable,
    get() { return desc.get.call(this); },
    set(v) { desc.set.call(this, expandFont(v)); },
  });
  proto.__fontPatched = true;
  return true;
}

/**
 * Install the shim and boot a Game.
 * @returns {{canvas, game, step, click, rects, flushFade, clock}}
 */
export async function bootGame({ width = 1280, height = 720, localStorageSeed = null } = {}) {
  registerFonts();
  const canvas = createCanvas(width, height);
  patchFonts(canvas);
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
  /** Advance n frames. `draw: false` skips rasterisation (and hit-rect
   *  collection) for long fast-forwards — call `draw()` once before clicking. */
  function step(n = 1, { draw = true } = {}) {
    for (let i = 0; i < n; i++) {
      clock += dt * 1000;
      game.last = clock - dt * 1000;
      game.frame(clock);
      if (draw) game.draw();
    }
  }
  /** Render one frame so hit rects reflect the current scene. */
  function draw() { game.draw(); }
  function rects() {
    return game.scene === 'run' ? (game.hitRects || []) : (game._cachedRects || []);
  }
  function click(id) {
    const r = rects().find((x) => x.id === id);
    if (!r) return false;
    game.click(id, r.x + r.w / 2, r.y + r.h / 2);
    return true;
  }
  function flushFade() { step(22); } // > TRANSITION (0.26s)

  return { canvas, game, step, draw, click, rects, flushFade, localStorage: globalThis.localStorage };
}
