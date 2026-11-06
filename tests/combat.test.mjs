// Combat engine invariants. These are the rules that, if broken, make the game
// unfair or unplayable — so they are asserted rather than eyeballed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRun, advance, autoplay, DT, addTrainingDummy } from './harness.mjs';
import { RUN_STATE, GROUND_Y, PLAY } from '../src/systems/run.js';
import { SKILLS } from '../src/data/skills.js';

test('run starts in intro and reaches fight', () => {
  const run = makeRun();
  run.start();
  assert.equal(run.state, RUN_STATE.INTRO, 'starts with a short intro beat');
  advance(run, 2);
  assert.equal(run.state, RUN_STATE.FIGHT);
});

test('player can move in every direction', () => {
  const run = makeRun();
  run.start();
  advance(run, 1.5); // clear intro
  run.player.x = 590;
  run.player.y = (PLAY.top + PLAY.bottom) / 2;
  const x0 = run.player.x;
  const y0 = run.player.y;
  advance(run, 0.4, { moveX: 1, moveY: 0 });
  assert.ok(run.player.x > x0 + 10, 'moves right');
  advance(run, 0.4, { moveX: -1, moveY: 0 });
  assert.ok(run.player.x < x0 + 30, 'moves left');
  advance(run, 0.4, { moveX: 0, moveY: 1 });
  assert.ok(run.player.y > y0, 'moves down');
  advance(run, 0.4, { moveX: 0, moveY: -1 });
  assert.ok(run.player.y < y0 + 40, 'moves up');
});

test('player stays inside the playable rectangle', () => {
  const run = makeRun();
  run.start();
  advance(run, 1.5);
  for (const dir of [{ moveX: -1 }, { moveX: 1 }, { moveX: 0, moveY: -1 }, { moveX: 0, moveY: 1 }]) {
    advance(run, 3, dir);
    assert.ok(run.player.x >= PLAY.left - 0.5 && run.player.x <= PLAY.right + 0.5, 'x in bounds after ' + JSON.stringify(dir));
    assert.ok(run.player.y >= PLAY.top - 0.5 && run.player.y <= PLAY.bottom + 0.5, 'y in bounds after ' + JSON.stringify(dir));
  }
});

test('dash grants brief invulnerability and costs energy', () => {
  const run = makeRun();
  run.start();
  advance(run, 1.5);
  const e0 = run.energy;
  run.step(DT, { dodge: true });
  assert.ok(run.player.invuln > 0.1, 'i-frames on dash');
  assert.ok(run.energy < e0, 'dash spends energy');
});

test('enemies never deal contact damage through i-frames', () => {
  const run = makeRun();
  run.start();
  advance(run, 1.5);
  // surround the player with a damage source and check i-frames hold
  run.player.invuln = 1.0;
  const hp0 = run.hp;
  const foe = run.enemies.find((e) => !e.dead);
  if (foe) {
    foe.x = run.player.x;
    foe.y = run.player.y;
    advance(run, 0.5, {});
  }
  assert.equal(run.hp, hp0, 'invulnerable player takes no damage');
});

test('damage scales with night but never spikes past a fair multiple', () => {
  const a = makeRun();
  const b = makeRun();
  b.night = 9;
  const ea = a.makeEnemy(a.rng ? { id: 'x', hp: 10, speed: 10, damage: 10, radius: 10, xp: 1, gold: 1, tier: 0, behaviour: 'melee', windup: 0.3 } : {}, null);
  const eb = b.makeEnemy({ id: 'x', hp: 10, speed: 10, damage: 10, radius: 10, xp: 1, gold: 1, tier: 0, behaviour: 'melee', windup: 0.3 }, null);
  assert.ok(eb.dmg > ea.dmg, 'later nights hit harder');
  assert.ok(eb.dmg / ea.dmg < 6, `night 9 damage is ${(eb.dmg / ea.dmg).toFixed(2)}x night 1 — must stay bounded`);
});

test('skills cannot be cast without energy or off cooldown', () => {
  const run = makeRun();
  run.start();
  advance(run, 1.5);
  addTrainingDummy(run);
  // claw_slash and magic_bolt cost 0 by design (they are basic attacks), so the
  // energy gate has to be proven on a slot that actually charges for casting.
  const slot = run.slots.find((s) => s && s.def.cost > 0);
  assert.ok(slot, 'loadout has at least one paid skill');
  run.energy = 0;
  const res = run.castSlot(slot.index);
  assert.equal(res.ok, false, 'no energy → no cast');
  assert.equal(res.reason, 'energy', 'denial reason reports energy');
  run.energy = run.stats.energyMax;
  const first = run.castSlot(slot.index);
  assert.equal(first.ok, true, 'casts with energy');
  const second = run.castSlot(slot.index);
  assert.equal(second.ok, false, 'second cast blocked by cooldown');
});

test('every equipped skill can actually fire in combat', () => {
  // 42 skills exist; a broken pattern would silently do nothing. This drives all
  // of them through the engine and requires a visible effect or a hit.
  const ids = SKILLS.map((s) => s.id);
  const failures = [];
  for (const id of ids) {
    const run = makeRun({ skills: [id, 'claw_slash', 'pounce', 'nine_lives'], seed: 3 });
    run.start();
    advance(run, 1.5, {}, { autoResolve: true });
    addTrainingDummy(run, 70);
    run.energy = run.stats.energyMax;
    const slot = run.slots[0];
    slot.cd = 0;
    slot.charges = slot.maxCharges;
    const before = { fx: 0, dmg: run.statsTotals.damage, proj: run.projectiles.length, minions: run.minions.length, zones: run.zones.length };
    let seen = { fx: 0 };
    run.on('fx:slash', () => seen.fx++);
    run.on('fx:skill', () => seen.fx++);
    run.on('fx:projectile', () => seen.fx++);
    run.on('skill:cast', () => seen.fx++);
    const res = run.castSlot(0);
    advance(run, 1.2, { moveX: 0.4 });
    const produced = seen.fx > 0
      || run.statsTotals.damage > before.dmg
      || run.projectiles.length > before.proj
      || run.minions.length > before.minions
      || run.zones.length > before.zones;
    if (!res.ok || !produced) failures.push(`${id} (cast ${res.ok ? 'ok' : res.reason}, effect ${produced})`);
  }
  assert.deepEqual(failures, [], 'skills with no observable effect: ' + failures.join(', '));
});

test('a bot can play a full run without crashing or stalling', () => {
  // The bot is strong enough to sometimes outlive the whole budget, so the
  // invariant is "it keeps making progress", not "it must die". A stall would
  // show up as a run that neither ends nor advances past the first few nights.
  const { run, time } = autoplay(makeRun({ seed: 11 }), 900);
  assert.ok(time > 30, `bot played ${time.toFixed(0)}s`);
  const ended = [RUN_STATE.DEAD, RUN_STATE.VICTORY].includes(run.state);
  assert.ok(ended || run.night >= 4, `bot stalled at night ${run.night} (${run.state})`);
  assert.ok(run.kills > 0, 'bot killed enemies');
  assert.ok(run.level > 1, 'bot levelled up');
});

test('waves advance: a run never soft-locks on an empty wave', () => {
  const run = makeRun({ seed: 5 });
  run.start();
  advance(run, 1.5);
  const seen = new Set();
  for (let i = 0; i < 60 * 240; i++) {
    // Progress now requires deliberate attacks; clear live enemies explicitly
    // so this test continues to isolate wave bookkeeping from combat AI.
    for (const enemy of run.enemies) if (!enemy.dead) run.hitEnemy(enemy, enemy.hp + 1, { source: 'skill' });
    run.step(DT, {});
    while (run.state === RUN_STATE.LEVELUP) run.chooseOffer(0);
    while (run.state === RUN_STATE.REWARD) run.chooseReward(0);
    seen.add(`${run.night}.${run.wave}`);
    if (run.state === RUN_STATE.DEAD || run.state === RUN_STATE.VICTORY) break;
  }
  assert.ok(seen.size >= 3, 'progressed through multiple waves: ' + [...seen].join(' '));
});

test('boss fights start and end cleanly', () => {
  const run = makeRun({ seed: 9 });
  run.start();
  advance(run, 1.5);
  run.spawnBoss('moon_devourer');
  assert.ok(run.boss, 'boss spawned');
  assert.ok(run.boss.hp > 0);
  assert.ok(run.boss.phases?.length >= 2, 'boss has phases');
  // kill it outright: the wave must clear rather than hang
  run.boss.hp = 0;
  run.killEnemy(run.boss, {});
  advance(run, 1.2);
  assert.equal(run.boss, null, 'boss removed');
});

test('player death resolves to a summary', () => {
  const run = makeRun();
  run.start();
  advance(run, 1.5);
  run.hp = 0;
  advance(run, 2);
  assert.equal(run.state, RUN_STATE.DEAD);
  const s = run.summary();
  assert.equal(typeof s.depth, 'number');
  assert.equal(typeof s.kills, 'number');
});

test('ground level is consistent for every actor', () => {
  const run = makeRun();
  run.start();
  advance(run, 6);
  for (const e of run.enemies) {
    assert.ok(e.y <= GROUND_Y + 20, 'enemy stays on the ground plane');
    assert.ok(e.y >= PLAY.top - 40, 'enemy stays in the playfield');
  }
});
