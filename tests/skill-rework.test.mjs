import test from 'node:test';
import assert from 'node:assert/strict';
import { Run, RUN_STATE } from '../src/systems/run.js';
import { SKILL_BY_ID, skillValues } from '../src/data/skills.js';
import { SAVE_KEY } from '../src/core/save.js';
import { Presentation } from '../src/systems/presentation.js';
import { addTrainingDummy, advance } from './harness.mjs';
import { bootGame } from './dom.mjs';

function ready(id) {
  const run = new Run({ catId: 'tabby', skills: [id], seed: 3 });
  run.start(); advance(run, 1.3);
  run.pendingSpawns.length = 0; run.enemies.length = 0;
  run.waveEnemiesLeft = 100; run.player.x = 785; run.player.y = 380;
  return run;
}
function dummy(run, dx, dy = 0) {
  const e = addTrainingDummy(run, dx); e.x = run.player.x + dx; e.y = run.player.y + dy;
  return e;
}

test('claw slash is a single stroke, with matching left/right facing and increased reach', () => {
  assert.equal(SKILL_BY_ID.claw_slash.range, 86);
  for (const side of [-1, 1]) {
    const run = ready('claw_slash'); const e = dummy(run, side * 78); const pres = new Presentation(run);
    assert.ok(run.castSlot(0).ok); assert.ok(e.hp < e.hpMax);
    const f = pres.fx.find((fx) => fx.kind === 'slash');
    assert.ok(f); assert.equal(f.strokes, 1); assert.equal(run.player.facing, side);
    assert.ok(side > 0 ? Math.cos(f.angle) > 0 : Math.cos(f.angle) < 0);
  }
});

test('triple scratch is a wide multi-hit skill and applies on-hit effects', () => {
  assert.equal(SKILL_BY_ID.triple_scratch.cd, 4.1);
  const run = ready('triple_scratch');
  const left = dummy(run, -70), right = dummy(run, 70);
  run.mods.slowOnHit = 0.25;
  let hits = 0; run.on('fx:hit', () => hits++);
  run.castSlot(0); advance(run, 0.5);
  assert.ok(left.hp < left.hpMax && right.hp < right.hpMax);
  assert.equal(hits, 6); assert.equal(left.slow, 0.25); assert.equal(right.slow, 0.25);
});

test('pounce hits once along its path, knocks enemies forward and animates the dash', () => {
  const run = ready('pounce'); const e = dummy(run, 110);
  e.stun = 1; let hits = 0; run.on('fx:hit', () => hits++);
  const start = run.player.x; const enemyStart = e.x;
  run.castSlot(0); assert.ok(run.player.dashTime > 0); assert.equal(e.hp, e.hpMax);
  advance(run, 0.4);
  assert.ok(run.player.x > start + 80); assert.ok(e.hp < e.hpMax);
  assert.equal(hits, 1); assert.ok(e.x > enemyStart, 'stunned enemy was knocked in the dash direction');
  assert.equal(run.player.dashTime, 0);
});

test('fireball burns all surviving foes in its blast at low continuous DPS', () => {
  const run = ready('fireball'); const e = dummy(run, 140); const nearby = dummy(run, 165, 20);
  run.castSlot(0); advance(run, 0.5);
  assert.ok(e.burnTime > 0 && nearby.burnTime > 0, 'both direct and blast targets burn');
  const before = e.hp, dps = e.burn;
  assert.ok(dps > 0 && dps < run.skillDamage(SKILL_BY_ID.fireball, 1.8) * 0.2);
  run.updateEnemies(0.5);
  assert.ok(Math.abs((before - e.hp) - dps * 0.5) < 1e-6);
  run.updateEnemies(4); const after = e.hp; run.updateEnemies(1);
  assert.equal(e.burnTime, 0); assert.equal(e.hp, after);
});

test('phantom step marks a fixed destination and arrives after one unpaused second', () => {
  const run = ready('phantom_step'); const x = run.player.x;
  run.player.held = { x: 1, y: 0 };
  run.castSlot(0); assert.ok(run.phantomStep); const dest = run.phantomStep.x;
  assert.equal(run.player.x, x);
  advance(run, 0.5); assert.ok(run.phantomStep); assert.equal(run.player.x, x);
  run.paused = true; run.step(0.08, {}); run.paused = false;
  advance(run, 0.45); assert.ok(run.phantomStep);
  advance(run, 0.1); assert.equal(run.phantomStep, null); assert.equal(run.player.x, dest);
});

test('skill rank selections stop at the displayed cap and upgrade counts are current', () => {
  const run = ready('pounce'); const slot = run.slots[0];
  for (let rank = 2; rank <= slot.def.ranks.length; rank++) {
    run.offers = [{ type: 'skillup', skillId: slot.id, slot: 0, rank }];
    assert.equal(run.chooseOffer(0), true); assert.equal(slot.rank, rank);
  }
  assert.equal(slot.maxCharges, 2); assert.equal(slot.charges, 2);
  run.offers = [{ type: 'skillup', skillId: slot.id, slot: 0, rank: slot.rank + 1 }];
  assert.equal(run.chooseOffer(0), false);
  for (let i = 0; i < 100; i++) assert.ok(!run.rollOffers().some((o) => o.type === 'skillup' && o.skillId === slot.id));
  run.upgradeLevels = { keen_edge: 2 };
  for (let i = 0; i < 200; i++) {
    const offer = run.rollOffers().find((o) => o.id === 'keen_edge');
    if (offer) { assert.equal(offer.level, 2); return; }
  }
  assert.fail('never offered keen_edge');
});

test('multiple charges can be used and recover one at a time', () => {
  const run = ready('pounce'); const slot = run.slots[0];
  slot.rank = 4; run.offers = [{ type: 'skillup', skillId: slot.id, slot: 0, rank: 5 }]; run.chooseOffer(0);
  assert.equal(slot.charges, 2); assert.ok(run.castSlot(0).ok);
  assert.equal(slot.charges, 1); assert.equal(slot.cd, 0);
  assert.deepEqual(run.castSlot(0), { ok: true, queued: true }); assert.equal(slot.charges, 0); assert.equal(run.canCast(slot), false);
  advance(run, 0.5); assert.equal(slot.reserved, 0); assert.equal(slot.charges, 0);
  const cd = slot.rechargeDuration;
  run.updateSkillCooldowns(cd + 0.01); assert.equal(slot.charges, 1); assert.equal(run.canCast(slot), true);
  run.updateSkillCooldowns(cd + 0.01); assert.equal(slot.charges, 2); assert.equal(slot.recharge, 0);
});

test('secret button grants and saves 1000 embers on every press', async () => {
  const { game, step, rects } = await bootGame({ width: 840, height: 380 });
  step(3); game.click('settings', 0, 0); step(30);
  for (let i = 0; i < 7; i++) game.click('secretScale', 0, 0);
  step(30); const r = rects().find((r) => r.id === 'devEmbers');
  assert.ok(r && r.x >= 0 && r.y >= 0 && r.x + r.w <= 840 && r.y + r.h <= 380);
  game.click('devEmbers', r.x, r.y); game.click('devEmbers', r.x, r.y);
  assert.equal(game.profile.embers, 2000);
  assert.equal(JSON.parse(localStorage.getItem(SAVE_KEY)).embers, 2000);
});

test('phantom destination and airborne knockback render in the actual game', async () => {
  const { game, step } = await bootGame({ width: 840, height: 380 });
  game.startRun({ catId: 'tabby', skills: ['phantom_step'], seed: 3 });
  game.scene = 'run'; game.run.setState(RUN_STATE.FIGHT);
  game.run.castSlot(0); assert.ok(game.run.phantomStep);
  const e = dummy(game.run, 70); e.knockT = 0.2; e.knockX = 200;
  assert.doesNotThrow(() => game.draw());
  step(3); assert.ok(game.run.phantomStep);
});
