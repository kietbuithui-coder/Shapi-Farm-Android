// Smoke test for the shipped artifact.
//
// There is no browser in this sandbox, so instead of Playwright we run the real
// bundle from index.html inside a VM context with a DOM/canvas shim. That
// catches the failure modes that only appear after bundling: a missing export,
// a top-level crash, an IIFE that never boots, a canvas that never gets drawn.
//
// It also enforces the self-containment contract (no network, no placeholders)
// so `npm test` fails if someone reintroduces an external asset.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';

const HTML_PATH = new URL('../index.html', import.meta.url);
const html = existsSync(HTML_PATH) ? readFileSync(HTML_PATH, 'utf8') : null;

function registerFonts() {
  try {
    for (const w of [600, 700]) {
      GlobalFonts.registerFromPath(`node_modules/@fontsource/lora/files/lora-latin-${w}-normal.woff`, 'Lora');
    }
    for (const w of [400, 500, 600, 700]) {
      for (const sub of ['latin', 'vietnamese']) {
        GlobalFonts.registerFromPath(`node_modules/@fontsource/be-vietnam-pro/files/be-vietnam-pro-${sub}-${w}-normal.woff`, 'Be Vietnam Pro');
      }
    }
  } catch { /* fonts are cosmetic for this test */ }
}

/** Extract the single inline <script> body that carries the game bundle. */
function extractBundle(source) {
  const scripts = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  const body = scripts.map((m) => m[1]).filter((js) => js.length > 1000);
  assert.equal(body.length, 1, 'exactly one large inline script');
  return body[0];
}

function makeEnv() {
  registerFonts();
  const canvas = createCanvas(1280, 720);
  const listeners = new Map();
  const addL = (t, fn) => { if (!listeners.has(t)) listeners.set(t, []); listeners.get(t).push(fn); };
  const animFrames = [];

  const canvasEl = canvas;
  canvasEl.id = 'game';
  canvasEl.addEventListener = addL;
  canvasEl.removeEventListener = () => {};
  canvasEl.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1280, height: 720, right: 1280, bottom: 720 });
  canvasEl.style = {};
  canvasEl.clientWidth = 1280;
  canvasEl.clientHeight = 720;
  canvasEl.classList = { add() {}, remove() {}, contains: () => false };

  const bootEl = {
    classList: { added: [], add(c) { this.added.push(c); }, remove() {}, contains: () => false },
    remove() { this.removed = true; },
    innerHTML: '',
  };

  const mem = new Map();
  const sandbox = {
    console,
    setTimeout: (fn, t) => setTimeout(fn, t),
    clearTimeout: (h) => clearTimeout(h),
    setInterval: (fn, t) => setInterval(fn, t),
    clearInterval: (h) => clearInterval(h),
    performance: { now: () => Date.now() },
    devicePixelRatio: 1,
    innerWidth: 1280,
    innerHeight: 720,
    requestAnimationFrame: (fn) => { animFrames.push(fn); return animFrames.length; },
    cancelAnimationFrame: () => {},
    addEventListener: addL,
    removeEventListener: () => {},
    localStorage: {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
    },
    navigator: { maxTouchPoints: 0, getGamepads: () => [], vibrate: () => {} },
    document: {
      readyState: 'complete',
      hidden: false,
      documentElement: { lang: 'vi', dataset: {} },
      getElementById: (id) => (id === 'game' ? canvasEl : id === 'boot' ? bootEl : null),
      querySelector: (sel) => (sel === '#game' || sel === 'canvas' ? canvasEl : sel === '#boot' ? bootEl : null),
      createElement: () => createCanvas(1, 1),
      addEventListener: addL,
      removeEventListener: () => {},
    },
    AudioContext: undefined,
    Image: class {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  return { sandbox, canvas, bootEl, animFrames };
}

test('index.html exists and looks like a single-file game', () => {
  assert.ok(html, 'index.html is built (run `npm run build:web`)');
  assert.ok(html.length > 100_000, `bundle is substantial (${(html.length / 1024).toFixed(0)} KB)`);
  assert.match(html, /<canvas[^>]+id=["']game["']/i, 'has the game canvas');
});

test('the built page loads nothing from the network', () => {
  const stripped = html.replace(/base64,[A-Za-z0-9+/=]+/g, '');
  assert.ok(!/<script[^>]+src=/i.test(stripped), 'no external <script src>');
  assert.ok(!/<link[^>]+rel=["']?stylesheet/i.test(stripped), 'no external stylesheet');
  assert.ok(!/https?:\/\//i.test(stripped), 'no http(s) URLs');
  assert.ok(!/url\(\s*['"]?(?:https?:)?\/\//i.test(stripped), 'no remote url() in CSS');
  // images must be vector/canvas drawn, never fetched
  assert.ok(!/src=["']data:image/i.test(stripped), 'no raster images embedded as required assets');
});

test('fonts are embedded, including the Vietnamese subset', () => {
  const faces = [...html.matchAll(/@font-face\s*{[^}]*}/gi)].map((m) => m[0]);
  assert.ok(faces.length >= 8, `${faces.length} @font-face blocks`);
  assert.ok(faces.every((f) => /base64,/.test(f)), 'every face is inlined');
  // The Vietnamese face is identified by its diacritic range rather than by name
  // (the build drops the @fontsource source comment). U+1EA0-1EF9 is the
  // Vietnamese block — without it, "Mèo" would fall back to a system font.
  const viFaces = faces.filter((f) => /U\+1EA0-1EF9/.test(f));
  assert.ok(viFaces.length >= 4, `${viFaces.length} faces cover Vietnamese diacritics`);
  const latinFaces = faces.filter((f) => /U\+0000-00FF/.test(f));
  assert.ok(latinFaces.length >= 4, `${latinFaces.length} faces cover latin`);
  assert.ok(faces.every((f) => /unicode-range/.test(f)), 'unicode-range set so the browser picks a subset per glyph');
  assert.ok(!faces.some((f) => /[^A-Za-z]sans-serif'?\s*;\s*$/.test(f) && !/unicode-range/.test(f)), 'no un-subset face');
});

test('the bundle boots the real game and draws a frame', () => {
  const { sandbox, canvas, animFrames } = makeEnv();
  const code = extractBundle(html);
  assert.doesNotThrow(() => vm.runInNewContext(code, sandbox, { timeout: 20_000, filename: 'index.bundle.js' }), 'bundle evaluates without throwing');

  const game = sandbox.__catLegends;
  assert.ok(game, 'globalThis.__catLegends was set by src/main.js');
  assert.equal(game.scene, 'home', 'boots into the home screen');

  // run the first animation frames the page asked for
  assert.ok(animFrames.length > 0, 'the game requested an animation frame');
  for (let i = 0; i < 6; i++) {
    const fn = animFrames.shift();
    if (!fn) break;
    assert.doesNotThrow(() => fn(1000 + i * 16), 'animation frame runs');
  }

  // the canvas must contain actual painted pixels, not just a cleared surface
  const ctx = canvas.getContext('2d');
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const seen = new Set();
  for (let i = 0; i < data.length; i += 4 * 997) {
    seen.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
  }
  assert.ok(seen.size > 8, `canvas has a painted scene (${seen.size} distinct sampled colours)`);
});

test('the bundle never logs to the console during a normal boot', () => {
  const { sandbox } = makeEnv();
  const logs = [];
  sandbox.console = {
    ...console,
    log: (...a) => logs.push(['log', a.join(' ')]),
    warn: (...a) => logs.push(['warn', a.join(' ')]),
    error: (...a) => logs.push(['error', a.join(' ')]),
  };
  vm.runInNewContext(extractBundle(html), sandbox, { timeout: 20_000, filename: 'index.bundle.js' });
  assert.deepEqual(logs, [], `expected a silent boot, got: ${logs.map((l) => l.join(': ')).join(' | ')}`);
});

test('the bundle carries no placeholder copy', () => {
  // Strip base64 first: random font bytes contain words like "TODO".
  const stripped = html.replace(/base64,[A-Za-z0-9+/=]+/g, '');
  for (const bad of ['TODO', 'FIXME', 'lorem ipsum', '\uFFFD']) {
    assert.ok(!stripped.includes(bad), `no "${bad}" in the shipped bundle`);
  }
});
