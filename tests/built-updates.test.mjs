// These tests exercise the JavaScript embedded in the delivered index.html,
// rather than importing the source Run implementation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootGame } from './dom-built.mjs';
import { addTrainingDummy } from './harness.mjs';
import { SKILLS } from '../src/data/skills.js';

const { game } = await bootGame();
function setup(skills, ranks = []) {
  game.startRun({ catId: 'tabby', skills, seed: 101 });
  const r = game.run; r.state = 'fight'; r.waveEnemiesLeft = 999;
  r.player.x = 700; r.player.y = 380; r.player.invuln = 999; r.stats.crit = 0; r.stats.regen = 0;
  ranks.forEach((rank, i) => { r.slots[i].rank = rank; });
  return r;
}
function foe(r, dx, dy = 0) {
  const e = addTrainingDummy(r, dx); e.x = r.player.x + dx; e.y = r.player.y + dy;
  e.hp = e.hpMax = 100000; e.speed = 0; e.attackCd = 999; return e;
}
function near(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);
}

test('the shipped bundle exposes a body action for all 54 skill casts', () => {
  for (const skill of SKILLS) {
    const r = setup([skill.id]); foe(r, 55);
    assert.equal(r.castSlot(0).ok, true, skill.id);
    assert.equal(r.player.skillAction?.id, skill.id, `${skill.id}: missing body action in built game`);
  }
});

test('shipped claw slash applies the new range and scaling to rank-five bleed', () => {
  const r = setup(['claw_slash'], [5]), e = foe(r, -145); r.mods.skillArea = .6; r.player.facing = 1;
  const before = e.hp; r.castSlot(0);
  assert.ok(e.hp < before); assert.equal(r.player.facing, -1);
  near(e.bleed, r.skillDamage(r.slots[0].def, 1.15 * 1.2) * .55);
  e.bleedTime = .03; const hp = e.hp; r.updateEnemies(.08); near(hp - e.hp, e.bleed * .03);
});

test('shipped hex respects range, and a skill-area upgrade extends it', () => {
  const r = setup(['hex_brand'], [3]), e = foe(r, 370); r.castSlot(0); near(e.mark, 0);
  const boosted = setup(['hex_brand'], [3]), target = foe(boosted, 370);
  boosted.mods.skillArea = .2; boosted.castSlot(0); assert.ok(target.mark > 0);
});

test('shipped healing purr echo doubles the instant heal but not the timed buff', () => {
  const r = setup(['healing_purr'], [3]); r.hp = 1; r.mods.echo = 1; r.castSlot(0);
  const amount = r.stats.hpMax * .28; near(r.hp, 1 + 2 * amount);
  assert.equal(r.player.buffs.filter(b => b.id === 'healing_purr_hot').length, 1);
  const hp = r.hp; r.updateBuffs(6); near(r.hp - hp, amount);
});
