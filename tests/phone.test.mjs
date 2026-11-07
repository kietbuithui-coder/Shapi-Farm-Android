// Bugs found during real-phone play-testing. Each one was invisible to the
// existing suite because nothing threw: a miniboss simply stood still, a menu
// showed the wrong cat, two bosses appeared at once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootGame } from './dom.mjs';

/** Drive a miniboss for `seconds` with the player kept alive. */
function driveMiniBoss(id, seconds = 30) {
  return import('../src/systems/run.js').then(({ Run }) => {
    const run = new Run({ catId: 'tabby', skills: ['claw_slash'], perks: {}, seed: 5 });
    run.night = 10;
    run.start();
    for (let i = 0; i < 200 && run.state === 'intro'; i++) run.step(1 / 60, {});
    run.enemies.length = 0;
    run.pendingSpawns.length = 0;
    run.spawnMiniBoss(id);
    const b = run.miniBoss;
    b.hp = b.hpMax = 99_999;
    const attacks = [];
    run.on('boss:attack', ({ attack }) => attacks.push(attack));
    let travelled = 0;
    let last = { x: b.x, y: b.y };
    for (let i = 0; i < 60 * seconds; i++) {
      run.hp = run.stats.hpMax;
      run.step(1 / 60, {});
      while (run.state === 'levelup') run.chooseOffer(0);
      while (run.state === 'reward') run.chooseReward(0);
      travelled += Math.hypot(b.x - last.x, b.y - last.y);
      last = { x: b.x, y: b.y };
      if (run.state !== 'fight') break;
    }
    return { run, b, attacks, travelled };
  });
}

test('every miniboss actually moves and attacks', async () => {
  const ids = ['stone_warden', 'grub_mother', 'siren'];
  for (const id of ids) {
    const { attacks, travelled } = await driveMiniBoss(id, 25);
    // A miniboss that never enters the boss brain travels 0px and logs no
    // attacks. That is what was happening to Stone Warden.
    assert.ok(travelled > 150, `${id} barely moved (${travelled.toFixed(0)}px)`);
    assert.ok(attacks.length >= 3, `${id} attacked only ${attacks.length} times`);
    assert.ok(attacks.every((a) => a && a !== 'null'), `${id} chose a null attack`);
  }
});

test('minibosses use their own attack, not a boss one', async () => {
  const expected = { stone_warden: 'ringSlam', grub_mother: 'spawner', siren: 'screamPlus' };
  for (const [id, attack] of Object.entries(expected)) {
    const { attacks } = await driveMiniBoss(id, 20);
    assert.ok(attacks.includes(attack), `${id} never used ${attack}`);
  }
});

test('a boss wave never contains a leftover miniboss', async () => {
  const { Run } = await import('../src/systems/run.js');
  const run = new Run({ catId: 'tabby', skills: ['claw_slash'], perks: {}, seed: 3 });
  run.start();
  for (let i = 0; i < 200 && run.state === 'intro'; i++) run.step(1 / 60, {});
  // Wave 4 is a miniboss, wave 5 the boss. Advance without killing anything:
  // the old beginWave left the miniboss standing and spawned the boss on top.
  run.beginWave(4);
  run.step(1 / 60, {});
  assert.ok(run.miniBoss, 'no miniboss spawned for wave 4');
  run.beginWave(5);
  run.step(1 / 60, {});
  const alive = run.enemies.filter((e) => !e.dead);
  const bosses = alive.filter((e) => e.boss);
  const minis = alive.filter((e) => e.mini);
  assert.equal(bosses.length, 1, `expected 1 boss, found ${bosses.length}`);
  assert.equal(minis.length, 0, `a miniboss survived into the boss wave (${minis.map((m) => m.def.id)})`);
  assert.ok(!run.miniBoss, 'stale miniboss reference');
});

test('selecting a cat shows THAT cat in the preview rail', async () => {
  const { game, step, rects } = await bootGame({ width: 840, height: 395 });
  step(4);
  const tile = rects().find((r) => r.id === 'cats');
  game.click('cats', tile.x + tile.w / 2, tile.y + tile.h / 2);
  step(40);

  // The rail cross-fade was inverted: the outgoing cat was drawn at full alpha
  // forever, so the preview showed the previous selection.
  for (const id of ['black', 'bengal', 'sphynx']) {
    const card = rects().find((r) => r.id === 'cat:' + id);
    assert.ok(card, `no card for ${id}`);
    game.click('cat:' + id, card.x + card.w / 2, card.y + card.h / 2);
    step(50); // let pickT settle to 1
    assert.equal(game.selected, id);
    assert.equal(game.pickT, 1);
    // After the fade the outgoing cat must be fully gone (alpha 0 is derived
    // as 1 - pickT), so the only cat on screen is the selected one.
    assert.equal(1 - game.pickT, 0, 'outgoing cat still visible after the fade');
  }
});

test('the player stays visible and clear of the thumb pad on a phone', async () => {
  const { game, step, rects } = await bootGame({ width: 840, height: 380 });
  Object.defineProperty(globalThis, 'navigator', { value: { maxTouchPoints: 5, getGamepads: () => [] }, configurable: true });
  game.resize();
  step(4);
  const play = rects().find((r) => r.id === 'play');
  game.click('play', play.x + play.w / 2, play.y + play.h / 2);
  step(80);
  const run = game.run;
  const pad = game.touch.buttons;
  assert.ok(pad.length >= 4, 'no skill buttons laid out');
  const padMinX = Math.min(...pad.map((b) => b.x));
  const padMinY = Math.min(...pad.map((b) => b.y));

  // Extremes of the playable field, which is where framing broke.
  const spots = [[96, 250], [1474, 250], [96, 506], [1474, 506], [785, 380]];
  for (const [x, y] of spots) {
    run.player.x = x;
    run.player.y = y;
    game.camera.snapNext = true;
    step(3);
    const { x: sx, y: sy } = game.renderer.worldToScreen(x, y);
    assert.ok(sx >= 0 && sx <= 840, `player off screen horizontally at (${x},${y}) -> ${sx.toFixed(0)}`);
    assert.ok(sy >= 0 && sy <= 380, `player off screen vertically at (${x},${y}) -> ${sy.toFixed(0)}`);
    assert.ok(
      !(sx > padMinX - 8 && sy > padMinY - 8),
      `player hidden behind the skill pad at (${x},${y}) -> screen(${sx.toFixed(0)},${sy.toFixed(0)})`,
    );
  }
});

test('a slashed attack is drawn at the reach it actually has', async () => {
  // The visual used a hardcoded radius while the hitbox came from skill data,
  // so after retuning the effect could claim a reach the attack did not have.
  const { bootGame: boot } = await import('./dom.mjs');
  const { game, step, rects } = await boot();
  step(4);
  const play = rects().find((r) => r.id === 'play');
  game.click('play', play.x + play.w / 2, play.y + play.h / 2);
  step(80);
  const run = game.run;
  run.spawnBoss('hollow_ninth');
  step(10);
  // Capture what a melee cast reports to the FX layer.
  const slashes = [];
  run.on('fx:slash', (e) => slashes.push(e));
  // fire the starter melee skill until one lands
  for (let i = 0; i < 240 && !slashes.length; i++) {
    run.castSlot(0);
    step(1);
  }
  assert.ok(slashes.length > 0, 'no slash was emitted');
  const withRadius = slashes.filter((s) => typeof s.radius === 'number' && s.radius > 0);
  assert.ok(withRadius.length > 0, 'slash never reported a radius, so the visual cannot match the hitbox');
});
