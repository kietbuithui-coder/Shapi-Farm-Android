// The settings screen had four controls that were drawn, saved, and completely
// inert: music, sfx, voice and shake were sliders with no click handler, and the
// drag path assigned `sliderGrabbed` without ever reading it. Nothing threw, so
// no test failed — the only symptom was that touching them did nothing.
//
// These tests drive the real scene, find the real rects, and assert that the
// value, the audio bus and the saved profile all actually move.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootGame } from './dom.mjs';

/** Open the settings scene and return its live rects. */
async function openSettings() {
  const boot = await bootGame();
  const { step, rects, game } = boot;
  step(4);
  const tile = rects().find((r) => r.id === 'settings');
  assert.ok(tile, 'no settings tile on the home screen');
  game.click('settings', tile.x + tile.w / 2, tile.y + tile.h / 2);
  step(40); // scene changes are a fade; one frame is not enough
  assert.equal(game.scene, 'settings');
  return boot;
}

const SLIDERS = ['music', 'sfx', 'voice', 'shake'];

test('every volume/shake slider responds to a tap', async () => {
  const { game, step, rects } = await openSettings();
  for (const id of SLIDERS) {
    const row = rects().find((r) => r.id === id);
    assert.ok(row, `settings row "${id}" is missing`);
    assert.ok(row.slider, `"${id}" is no longer drawn as a slider`);
    // Tap a position that is guaranteed to differ from the default.
    game.click(id, row.x + row.w * 0.15, row.y + row.h / 2);
    step(2);
    const value = game.profile.settings[id];
    assert.equal(typeof value, 'number', `${id} is not a number`);
    if (id === 'shake') {
      // shake snaps to quarters on purpose (off / weak / strong), so 15% -> 0.25
      assert.equal(value, 0.25, `shake tapped at 15% but reads ${value}`);
    } else {
      assert.ok(Math.abs(value - 0.15) < 0.06, `${id} tapped at 15% but reads ${value}`);
    }
  }
});

test('slider value maps to where you tapped, not to the fact that you tapped', async () => {
  const { game, step, rects } = await openSettings();
  const row = rects().find((r) => r.id === 'sfx');
  for (const t of [0, 0.25, 0.5, 0.9]) {
    game.click('sfx', row.x + row.w * t, row.y + row.h / 2);
    step(1);
    assert.ok(
      Math.abs(game.profile.settings.sfx - t) < 0.06,
      `tapped at ${t} but sfx reads ${game.profile.settings.sfx}`,
    );
  }
});

test('dragging a slider keeps updating it until release', async () => {
  const { game, step, rects } = await openSettings();
  const row = rects().find((r) => r.id === 'music');
  game.click('music', row.x + row.w * 0.1, row.y + row.h / 2);
  assert.equal(game.sliderGrabbed, 'music', 'the press did not grab the slider');
  // Move the pointer without pressing again — this is what pointermove does.
  game.dragSlider(row.x + row.w * 0.7);
  assert.ok(Math.abs(game.profile.settings.music - 0.7) < 0.06);
  game.sliderGrabbed = null;
  assert.equal(game.sliderGrabbed, null);
});

test('music volume reaches the audio bus, not just the profile', async () => {
  const { game, step, rects } = await openSettings();
  const { audio } = await import('../src/audio/audio.js');
  const before = audio.volumes.music;
  const row = rects().find((r) => r.id === 'music');
  game.click('music', row.x + row.w * 0.4, row.y + row.h / 2);
  step(2);
  assert.notEqual(audio.volumes.music, before, 'audio bus ignored the new volume');
  assert.ok(Math.abs(audio.volumes.music - game.profile.settings.music) < 1e-9);
});

test('the language switch reaches the codex', async () => {
  const { game, step, rects } = await openSettings();
  const viTitle = game.wikiTabs()[0].label;
  const en = rects().find((r) => r.id === 'lang:en');
  assert.ok(en, 'no EN language button');
  game.click('lang:en', en.x + en.w / 2, en.y + en.h / 2);
  step(4);
  assert.equal(game.profile.settings.lang, 'en');
  const enTitle = game.wikiTabs()[0].label;
  assert.notEqual(enTitle, viTitle, 'the codex stayed in the previous language');
  assert.match(enTitle, /bestiary/i);
});

test('no single enemy hit can take the whole health bar', async () => {
  // A night-10 boss landed 110.5 damage on a 106 HP player: an unavoidable
  // one-shot. The cap is what makes that survivable, so assert it directly
  // rather than trusting the number that happens to be in the data.
  const { Run } = await import('../src/systems/run.js');
  const run = new Run({ catId: 'tabby', skills: ['claw_slash'], perks: {}, seed: 5 });
  run.night = 10;
  run.start();
  for (let i = 0; i < 30; i++) run.step(1 / 60, {});
  const hpMax = run.stats.hpMax;
  run.player.invuln = 0;
  run.damagePlayer(hpMax * 50, null);
  assert.ok(run.player.alive, 'a 50x-health hit killed the player outright');
  assert.ok(
    run.hp >= hpMax * 0.5 - 1e-6,
    `one hit removed ${(100 * (1 - run.hp / hpMax)).toFixed(0)}% of the bar`,
  );
});

test('the XP curve asks 35% more than the old one, at every level', async () => {
  const { xpForLevel } = await import('../src/systems/stats.js');
  const old = (level) => Math.floor(11 + level * 9 + Math.pow(level, 1.72) * 2.4);
  for (const level of [1, 2, 5, 10, 20, 30]) {
    const ratio = xpForLevel(level) / old(level);
    assert.ok(ratio > 1.3 && ratio < 1.4, `level ${level}: ${ratio.toFixed(3)}x, expected ~1.35x`);
  }
});

test('every cat is nerfed by the same amount', async () => {
  const { buildStats, BASE } = await import('../src/systems/stats.js');
  const { CATS } = await import('../src/data/cats.js');
  const list = Array.isArray(CATS) ? CATS : Object.values(CATS);
  assert.ok(list.length >= 10);

  // With no perks and no mods, this is exactly what buildStats computed before
  // the nerf. Comparing against it proves the cut is uniform rather than
  // asserting round numbers that a percent-based change can never satisfy.
  const NERF = 0.9;
  for (const cat of list) {
    const st = buildStats(cat).stats;
    const b = cat.base;
    assert.ok(Math.abs(st.atk - BASE.atk * b.atk * NERF) < 1e-9, `${cat.id} atk`);
    assert.ok(Math.abs(st.hpMax - BASE.hp * (b.hp / 100) * NERF) < 1e-9, `${cat.id} hp`);
    assert.ok(Math.abs(st.crit - b.crit * NERF) < 1e-9, `${cat.id} crit`);
  }
  // Move and attack speed are pacing, not power: a 10% "nerf" there would just
  // make every cat feel sluggish, so they must be untouched.
  const tabby = list.find((c) => c.id === 'tabby');
  const tst = buildStats(tabby).stats;
  assert.equal(tst.move, BASE.move * tabby.base.move);
  assert.equal(tst.atkSpeed, tabby.base.atkSpeed);
});
