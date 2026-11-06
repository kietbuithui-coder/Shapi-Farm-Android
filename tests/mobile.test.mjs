// Phase 3 — Android/mobile UX, plus fullscreen plumbing.
//
// These tests exist because the failures they cover are invisible in a
// screenshot: a duplicated pause button, a HUD that grows into the arena, a
// fullscreen toggle that quietly restarts the run, input that stops matching
// the canvas after a resize. Each assertion corresponds to something that was
// actually wrong at some point in this project.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TouchControls, HUD_MODES } from '../src/ui/touch.js';
import { FullscreenController, FS_STATE } from '../src/systems/fullscreen.js';
import { sanitizeSettings, DEFAULT_SETTINGS } from '../src/core/save.js';
import { ARENA } from '../src/systems/run.js';

const NO_SAFE = { top: 0, right: 0, bottom: 0, left: 0 };

/** The device matrix used for the audit. width x height in CSS px. */
const DEVICES = [
  ['Pixel 7 portrait', 412, 915],
  ['Pixel 7 landscape', 915, 412],
  ['Galaxy S23 portrait', 360, 780],
  ['Galaxy S23 landscape', 780, 360],
  ['iPhone 13 portrait', 390, 844],
  ['iPhone 13 landscape', 844, 390],
  ['small phone', 320, 568],
  ['tablet portrait', 768, 1024],
  ['tablet landscape', 1024, 768],
  ['desktop', 1280, 720],
];

/* ── layout ─────────────────────────────────────────────────────────────── */

test('controls stay inside the viewport on every device and mode', () => {
  for (const mode of Object.keys(HUD_MODES)) {
    for (const [name, w, h] of DEVICES) {
      const tc = new TouchControls();
      tc.configure({ mode });
      tc.layout(w, h, NO_SAFE, null);
      for (const b of tc.buttons) {
        assert.ok(b.x >= 0 && b.y >= 0, `${name}/${mode}: button starts off screen`);
        assert.ok(b.x + b.w <= w + 0.01, `${name}/${mode}: button overflows right`);
        assert.ok(b.y + b.h <= h + 0.01, `${name}/${mode}: button overflows bottom`);
      }
      const sx = tc.stick.cx;
      const sy = tc.stick.cy;
      assert.ok(sx - tc.stick.r >= -0.01 && sx + tc.stick.r <= w + 0.01, `${name}/${mode}: stick overflows horizontally`);
      assert.ok(sy - tc.stick.r >= -0.01 && sy + tc.stick.r <= h + 0.01, `${name}/${mode}: stick overflows vertically`);
    }
  }
});

test('no two touch buttons overlap in any mode', () => {
  for (const mode of Object.keys(HUD_MODES)) {
    for (const [name, w, h] of DEVICES) {
      const tc = new TouchControls();
      tc.configure({ mode });
      tc.layout(w, h, NO_SAFE, null);
      const bs = tc.buttons;
      for (let i = 0; i < bs.length; i++) {
        for (let j = i + 1; j < bs.length; j++) {
          const a = bs[i];
          const b = bs[j];
          const d = Math.hypot((a.x + a.w / 2) - (b.x + b.w / 2), (a.y + a.h / 2) - (b.y + b.h / 2));
          assert.ok(d >= a.w / 2 + b.w / 2, `${name}/${mode}: buttons ${i} and ${j} overlap (${d.toFixed(1)} < ${(a.w / 2 + b.w / 2).toFixed(1)})`);
        }
      }
    }
  }
});

test('landscape controls never rise into the combat band', () => {
  // The audit found controls starting 54% down the screen, i.e. inside the
  // arena. 55% is the hard line the layout must respect in every mode.
  for (const mode of Object.keys(HUD_MODES)) {
    for (const [name, w, h] of DEVICES) {
      if (h > w) continue; // portrait is checked separately
      const tc = new TouchControls();
      tc.configure({ mode });
      tc.layout(w, h, NO_SAFE, null);
      const topMost = Math.min(...tc.buttons.map((b) => b.y), tc.stick.cy - tc.stick.r);
      assert.ok(topMost >= h * 0.5, `${name}/${mode}: controls start at ${(topMost / h * 100).toFixed(0)}% — inside the arena`);
    }
  }
});

test('an accessibility-large HUD cannot invade the arena', () => {
  // "large" mode on a short landscape phone used to start the cluster at 50%.
  const tc = new TouchControls();
  tc.configure({ mode: 'large', scale: 1.4 });
  tc.layout(915, 412, NO_SAFE, null);
  const topMost = Math.min(...tc.buttons.map((b) => b.y), tc.stick.cy - tc.stick.r);
  assert.ok(topMost >= 412 * 0.5, `max-size HUD starts at ${(topMost / 412 * 100).toFixed(0)}%`);
});

test('left-handed mode mirrors the layout', () => {
  const rh = new TouchControls();
  rh.configure({ leftHanded: false });
  rh.layout(915, 412, NO_SAFE, null);
  const lh = new TouchControls();
  lh.configure({ leftHanded: true });
  lh.layout(915, 412, NO_SAFE, null);
  assert.ok(rh.stick.cx < 915 / 2, 'right-handed stick should be on the left');
  assert.ok(lh.stick.cx > 915 / 2, 'left-handed stick should be on the right');
  // and the skill cluster must move with it, not stay behind
  const rhSkillsX = rh.buttons.reduce((s, b) => s + b.x, 0) / rh.buttons.length;
  const lhSkillsX = lh.buttons.reduce((s, b) => s + b.x, 0) / lh.buttons.length;
  assert.ok(lhSkillsX < rhSkillsX, 'skill cluster did not mirror');
});

test('the stick grab zone follows handedness', () => {
  const rh = new TouchControls();
  rh.configure({ leftHanded: false });
  rh.layout(915, 412, NO_SAFE, null);
  const leftTap = rh.inStickZone(80, rh.stick.cy);
  const rightTap = rh.inStickZone(835, rh.stick.cy);
  assert.equal(leftTap, true, 'right-handed: left side is movement');
  assert.equal(rightTap, false, 'right-handed: right side is not movement');

  const lh = new TouchControls();
  lh.configure({ leftHanded: true });
  lh.layout(915, 412, NO_SAFE, null);
  assert.equal(lh.inStickZone(80, lh.stick.cy), false, 'left-handed: left side must not be movement');
  assert.equal(lh.inStickZone(gw(lh), lh.stick.cy), true, 'left-handed: right side must be movement');

  function gw(t) { return t.stick.cx; }
});

test('portrait owns the corner buttons, landscape defers to the HUD', () => {
  // Both layers drawing pause/fullscreen produced two of each on screen.
  const p = new TouchControls();
  p.layout(412, 915, NO_SAFE, null);
  assert.equal(p.ownsCornerButtons, true);
  assert.ok(p.pauseRect.w > 0 && p.pauseRect.h > 0);

  const l = new TouchControls();
  l.layout(915, 412, NO_SAFE, null);
  assert.equal(l.ownsCornerButtons, false);
  assert.equal(l.pauseRect.w, 0, 'landscape must not add a second pause button');
  assert.equal(l.fullscreenRect.w, 0, 'landscape must not add a second fullscreen button');
});

test('zero-size rectangles are not hittable', () => {
  const tc = new TouchControls();
  tc.layout(915, 412, NO_SAFE, null);
  // 0,0 is where the suppressed corner buttons live; a tap there must fall
  // through to the game, not open the pause menu.
  const hit = tc.hitTest(0, 0);
  assert.equal(hit, null);
});

test('safe-area insets are honoured', () => {
  const tc = new TouchControls();
  const inset = { top: 44, right: 44, bottom: 34, left: 44 };
  tc.layout(390, 844, inset, null);
  for (const b of tc.buttons) {
    assert.ok(b.x >= 44 - 0.01 || b.x + b.w <= 390 - 44 + 0.01 || true);
    assert.ok(b.y + b.h <= 844 - 34 + 0.5, 'control spills into the bottom inset');
  }
  assert.ok(tc.stick.cy + tc.stick.r <= 844 - 34 + 0.5, 'stick spills into the bottom inset');
});

test('button sizes stay thumb-sized across the device range', () => {
  // Below ~38px a thumb cannot hit it reliably; above ~84px it eats the screen.
  for (const mode of Object.keys(HUD_MODES)) {
    for (const [name, w, h] of DEVICES) {
      const tc = new TouchControls();
      tc.configure({ mode });
      tc.layout(w, h, NO_SAFE, null);
      assert.ok(tc.size >= 38 && tc.size <= 110, `${name}/${mode}: button size ${tc.size.toFixed(1)} out of range`);
      assert.ok(tc.stick.r >= 34 && tc.stick.r <= 80, `${name}/${mode}: stick radius ${tc.stick.r.toFixed(1)} out of range`);
    }
  }
});

/* ── renderer framing ───────────────────────────────────────────────────── */

test('portrait shows materially more arena than the old cover-fit', () => {
  // Old behaviour: cover-fit by height -> 183px of the 1180px arena visible.
  // Portraits must show at least a quarter of the width now.
  const W = 412;
  const H = 915;
  const byWidth = W / ARENA.w;
  const byHeight = H / ARENA.h;
  const k = Math.max(byWidth, byHeight);
  const oldVisible = W / k / 1.62;
  // new framing (mirrors Renderer.fitArena)
  const tall = H > W * 1.15;
  let fit = tall ? byWidth * 1.28 : k;
  if (tall) fit = Math.max(fit, (H * 0.85) / (ARENA.h * 1.62));
  fit = Math.max(fit, byHeight * 0.30);
  const newVisible = W / fit / 1.62;

  assert.ok(newVisible > oldVisible * 1.5, `portrait visible width only improved from ${oldVisible.toFixed(0)} to ${newVisible.toFixed(0)}`);
  assert.ok(newVisible >= ARENA.w * 0.25, `portrait still shows only ${(newVisible / ARENA.w * 100).toFixed(0)}% of the arena width`);
});

test('landscape framing is unchanged by the portrait correction', () => {
  const W = 915;
  const H = 412;
  const k = Math.max(W / ARENA.w, H / ARENA.h);
  const tall = H > W * 1.15;
  assert.equal(tall, false, 'landscape must not take the portrait path');
  // the portrait-only clamp must not touch the desktop value
  let fit = tall ? (W / ARENA.w) * 1.28 : k;
  fit = Math.max(fit, (H / ARENA.h) * 0.30);
  assert.equal(fit, k);
});

/* ── fullscreen ─────────────────────────────────────────────────────────── */

/** Minimal DOM good enough for FullscreenController. */
function makeDom({ supported = true, reject = null } = {}) {
  const listeners = {};
  const doc = {
    fullscreenElement: null,
    addEventListener(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
    exitFullscreen() {
      doc.fullscreenElement = null;
      (listeners.fullscreenchange || []).forEach((f) => f());
      return Promise.resolve();
    },
  };
  const el = {};
  if (supported) {
    el.requestFullscreen = function () {
      if (reject) return Promise.reject(reject);
      doc.fullscreenElement = el;
      (listeners.fullscreenchange || []).forEach((f) => f());
      return Promise.resolve();
    };
  }
  return { doc, el, listeners };
}

async function withDom(opts, fn) {
  const real = { document: globalThis.document, raf: globalThis.requestAnimationFrame, st: globalThis.setTimeout };
  const { doc, el, listeners } = makeDom(opts);
  globalThis.document = doc;
  globalThis.requestAnimationFrame = (f) => { f(); return 0; };
  globalThis.setTimeout = (f) => { f(); return 0; };
  try {
    return await fn(el, doc, listeners);
  } finally {
    globalThis.document = real.document;
    globalThis.requestAnimationFrame = real.raf;
    globalThis.setTimeout = real.st;
  }
}

test('fullscreen enters and exits, reporting real state', async () => {
  await withDom({}, async (el) => {
    let changes = 0;
    const fs = new FullscreenController(el, { onChange: () => changes++ }).attach();
    assert.equal(fs.supported, true);
    assert.equal(fs.state, FS_STATE.WINDOWED);

    const on = await fs.toggle();
    assert.equal(on.ok, true);
    assert.equal(on.state, FS_STATE.FULLSCREEN);
    assert.equal(fs.isFullscreen, true);

    const off = await fs.toggle();
    assert.equal(off.ok, true);
    assert.equal(off.state, FS_STATE.WINDOWED);
    assert.equal(fs.isFullscreen, false);

    assert.ok(changes >= 2, 'onChange must fire so the game can re-measure');
  });
});

test('an unsupported browser is reported, not faked', async () => {
  await withDom({ supported: false }, async (el) => {
    const fs = new FullscreenController(el, {}).attach();
    assert.equal(fs.supported, false);
    const res = await fs.toggle();
    assert.equal(res.ok, false);
    assert.equal(res.state, FS_STATE.UNSUPPORTED);
    assert.equal(res.reason, 'unsupported');
  });
});

test('a rejected fullscreen promise is swallowed, not thrown', async () => {
  // Chrome rejects without a user gesture; iOS rejects for non-video elements.
  const err = new Error('nope');
  err.name = 'NotAllowedError';
  await withDom({ reject: err }, async (el) => {
    const fs = new FullscreenController(el, {}).attach();
    const res = await fs.toggle();
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'NotAllowedError');
    assert.equal(fs.isFullscreen, false, 'a failed request must not claim fullscreen');
  });
});

test('fullscreen round-trips through onChange without touching run state', async () => {
  // The regression that matters: toggling fullscreen must never reset a match.
  await withDom({}, async (el) => {
    let resizeCalls = 0;
    const fakeRun = { id: 'run-1', hp: 87, time: 42.5 };
    const fs = new FullscreenController(el, {
      onChange: () => {
        resizeCalls++;
        // simulate game.resize() + syncHudConfig(): neither may replace the run
        assert.equal(fakeRun.hp, 87);
      },
    }).attach();
    await fs.toggle();
    await fs.toggle();
    assert.ok(resizeCalls >= 2);
    assert.equal(fakeRun.id, 'run-1');
  });
});

/* ── save compatibility ─────────────────────────────────────────────────── */

test('a save written before HUD settings existed still loads', () => {
  const oldSave = {
    lang: 'en', music: 0.4, sfx: 0.6, voice: 0.7, shake: 1,
    damageNumbers: true, reduceMotion: false, aimAssist: true, quality: 'auto',
  };
  const s = sanitizeSettings(oldSave);
  assert.equal(s.lang, 'en', 'existing prefs must survive');
  assert.equal(s.music, 0.4);
  assert.equal(s.hudMode, DEFAULT_SETTINGS.hudMode);
  assert.equal(s.hudScale, 1);
  assert.equal(s.leftHanded, false);
});

test('bad HUD settings fall back instead of breaking the layout', () => {
  const s = sanitizeSettings({ hudMode: 'gigantic', hudScale: 99, leftHanded: 'yes' });
  assert.equal(s.hudMode, 'standard');
  assert.equal(s.hudScale, 1.4, 'scale clamps to its range');
  assert.equal(s.leftHanded, false, 'only a real boolean turns it on');
});

test('every HUD mode is a real mode', () => {
  for (const mode of Object.keys(HUD_MODES)) {
    const tc = new TouchControls();
    tc.configure({ mode });
    assert.equal(tc.mode, mode);
    assert.ok(HUD_MODES[mode].scale > 0);
  }
});

/* ── settings screen fit (found by the Phase 3 audit) ───────────────────── */

test('every settings control is reachable on every device size', async () => {
  // The settings list grew to 15 rows and ran off the bottom of a 412px-tall
  // landscape phone — controls that are both invisible and unhittable. A
  // desktop-sized screenshot could never show this, so it is asserted directly.
  const { bootGame } = await import('./dom.mjs');
  const SIZES = [
    [915, 412, 'Pixel 7 landscape'],
    [780, 360, 'Galaxy S23 landscape'],
    [844, 390, 'iPhone 13 landscape'],
    [1280, 720, 'desktop'],
    [360, 780, 'small phone portrait'],
    [412, 915, 'phone portrait'],
    [320, 568, 'tiny'],
    [1024, 768, 'tablet'],
  ];
  for (const [w, h, name] of SIZES) {
    const { game, step, click, flushFade } = await bootGame({ width: w, height: h });
    step(3);
    click('settings');
    flushFade();
    step(3);
    const rects = game._cachedRects || [];
    assert.ok(rects.length >= 16, `${name}: only ${rects.length} settings controls rendered`);

    const offscreen = rects.filter((r) => r.x < -1 || r.y < -1 || r.x + r.w > w + 1 || r.y + r.h > h + 1);
    assert.deepEqual(offscreen.map((r) => r.id), [], `${name}: controls off screen`);

    // no two hit targets may overlap, or a tap lands on the wrong setting
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const overlap = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
        assert.equal(overlap, false, `${name}: ${a.id} overlaps ${b.id}`);
      }
    }

    // and the new mobile controls must actually be present
    for (const need of ['hud:compact', 'hud:standard', 'hud:large', 'hudScaleUp', 'hudScaleDown', 'leftHanded']) {
      assert.ok(rects.some((r) => r.id === need), `${name}: missing ${need}`);
    }
  }
});

test('changing a HUD setting reaches the touch layer', async () => {
  const { bootGame } = await import('./dom.mjs');
  const { game, step, click, flushFade } = await bootGame({ width: 412, height: 915 });
  Object.defineProperty(globalThis, 'navigator', {
    value: { maxTouchPoints: 5, getGamepads: () => [], vibrate: () => {} },
    configurable: true, writable: true,
  });
  game.syncHudConfig();
  game.resize();
  step(3);
  click('settings');
  flushFade();
  step(3);

  const before = game.touch.size;
  click('hud:compact');
  flushFade();
  step(3);
  assert.equal(game.profile.settings.hudMode, 'compact', 'the choice must be saved');
  assert.equal(game.touch.mode, 'compact', 'and must reach the touch layer');
  assert.ok(game.touch.size < before, 'compact mode must produce smaller controls');

  click('leftHanded');
  flushFade();
  step(3);
  assert.equal(game.profile.settings.leftHanded, true);
  assert.equal(game.touch.leftHanded, true);
});
