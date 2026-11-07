// Boots the BUILT index.html — the actual shipped artefact — in a canvas-backed
// DOM, so deploy tests exercise what the player downloads rather than the source
// modules. Everything here is deliberately minimal: extract the inline bundle,
// provide the globals it touches, and run it.
import { createCanvas } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';
import { patchFonts, registerFontsForTest } from './dom.mjs';

const ROOT = new URL('..', import.meta.url).pathname;

let built = null;
let bootEl = null;
const rafQueue = [];

function prepare() {
  registerFontsForTest();
  const html = readFileSync(ROOT + 'index.html', 'utf8');

  const canvas = createCanvas(1280, 720);
  patchFonts(canvas);

  const listeners = new Map();
  const addL = (t, fn) => { if (!listeners.has(t)) listeners.set(t, []); listeners.get(t).push(fn); };

  bootEl = {
    id: 'boot',
    className: '',
    innerHTML: '',
    style: {},
    removed: false,
    classList: { add(c) { if (c === 'gone') bootEl.gone = true; } },
    remove() { bootEl.removed = true; },
  };

  globalThis.addEventListener = addL;
  globalThis.removeEventListener = () => {};
  globalThis.innerWidth = 1280;
  globalThis.innerHeight = 720;
  globalThis.devicePixelRatio = 1;
  // Queue, do NOT call synchronously: the game schedules the next frame from
  // inside frame(), so a synchronous rAF recurses until the stack dies.
  let rafId = 0;
  globalThis.requestAnimationFrame = (fn) => { rafQueue.push(fn); return ++rafId; };
  globalThis.cancelAnimationFrame = () => {};
  globalThis.document = {
    hidden: false,
    readyState: 'complete',
    documentElement: { lang: 'vi', dataset: {} },
    createElement: () => createCanvas(1, 1),
    addEventListener: addL,
    getElementById: (id) => (id === 'game' ? canvas : id === 'boot' ? (bootEl.removed ? null : bootEl) : null),
    body: { appendChild() {} },
  };
  globalThis.window = globalThis;
  canvas.addEventListener = addL;
  canvas.getBoundingClientRect = () => {
    const w = parseFloat(canvas.style.width) || 1280, h = parseFloat(canvas.style.height) || 720;
    return { left: 0, top: 0, width: w, height: h, right: w, bottom: h };
  };
  canvas.style = {};
  canvas.clientWidth = 1280;
  canvas.clientHeight = 720;
  canvas.parentElement = null;

  const mem = new Map();
  globalThis.localStorage = {
    _m: mem,
    getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
    setItem(k, v) { this._m.set(k, String(v)); },
    removeItem(k) { this._m.delete(k); },
    get length() { return this._m.size; },
    key(i) { return [...this._m.keys()][i] ?? null; },
  };
  Object.defineProperty(globalThis, 'navigator', {
    value: { maxTouchPoints: 0, getGamepads: () => [], vibrate: () => {} },
    configurable: true, writable: true,
  });
  globalThis.AudioContext = undefined;

  // Extract the LAST inline <script> — that is the game bundle (the failure net
  // is an earlier, separate script).
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  if (!scripts.length) throw new Error('no inline script found in index.html');
  const bundle = scripts[scripts.length - 1];
  const dispatch = (type, event = {}) => { for (const fn of [...(listeners.get(type) || [])]) fn({ preventDefault() {}, ...event }); };
  return { bundle, canvas, dispatch };
}

/** Boot the built bundle. Returns the live game plus boot-screen state. */
export async function bootGame() {
  if (!built) {
    const { bundle, canvas, dispatch } = prepare();
    // eslint-disable-next-line no-new-func
    new Function(bundle)();
    // Run the frames the game queued (boot draws one, then schedules the loop).
    for (let i = 0; i < 3 && rafQueue.length; i++) {
      const batch = rafQueue.splice(0);
      for (const fn of batch) fn(16 * (i + 1));
    }
    built = { canvas, dispatch };
  }
  return {
    game: globalThis.__catLegends,
    canvas: built.canvas,
    dispatch: built.dispatch,
    bootHidden: !!(bootEl && (bootEl.gone || bootEl.removed)),
  };
}

export function canvasSize() {
  return built ? { w: built.canvas.width, h: built.canvas.height } : { w: 0, h: 0 };
}
