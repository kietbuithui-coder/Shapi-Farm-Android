import test from 'node:test';
import assert from 'node:assert/strict';
import { Run, RUN_STATE } from '../src/systems/run.js';
import { addTrainingDummy } from './harness.mjs';

function setup(skills, ranks = []) {
  const r = new Run({ catId: 'tabby', skills, seed: 37 });
  r.state = RUN_STATE.FIGHT; r.waveEnemiesLeft = 999; r.player.x = 785; r.player.y = 380;
  r.player.invuln = 999; r.stats.crit = 0; ranks.forEach((rank, i) => { r.slots[i].rank = rank; });
  return r;
}
function enemy(r, dx = 50, dy = 0) {
  const e = addTrainingDummy(r, dx); e.y += dy; e.hp = e.hpMax = 100000; e.speed = 0; e.attackCd = 999; return e;
}
function step(r, sec) { for(let i=0;i<Math.ceil(sec*60);i++) r.step(1/60, {}); }
function release(r) { r.time += 0.2; r.updatePassiveEffects(0); }

test('blood fang bleeds at rank one, increases at rank two, and stacks up to three', () => {
  const baseline = setup(['blood_fang'], [1]); const e0 = enemy(baseline); baseline.castSlot(0); release(baseline);
  const first = e0.bleed; assert.ok(first > 0 && e0.bleedTime > 0);
  const high = setup(['blood_fang'], [2]); const e = enemy(high); high.castSlot(0); release(high);
  assert.ok(Math.abs(e.bleed / first - 1.3) < 1e-6);
  const { def } = high.slots[0]; const power = 1.5;
  high.skillHit(e, def, power, { bleed: 1.3 }); high.skillHit(e, def, power, { bleed: 1.3 });
  high.skillHit(e, def, power, { bleed: 1.3 }); assert.equal(e.bloodFangStacks, 3);
  assert.ok(Math.abs(e.bleed / first - 1.3 * 3) < 1e-6);
  e.bloodFangStackTime = 0.01; high.updateEnemies(0.02); assert.equal(e.bloodFangStacks, 0);
});

test('blood fang rank five spreads reduced bleed to nearby foes, not distant ones', () => {
  const r = setup(['blood_fang'], [5]); const target = enemy(r, 50), close = enemy(r, 50, 60), far = enemy(r, 220);
  r.castSlot(0); release(r); assert.ok(target.bleed > 0); assert.ok(close.bleed > 0); assert.equal(far.bleed || 0, 0);
  assert.ok(Math.abs(close.bleed - target.bleed * 0.5) < 1e-6); assert.equal(close.bloodFangStacks, undefined);
});

test('healing purr rank four heals living nearby summons but not distant, dead or orbs', () => {
  for (const rank of [3, 4]) {
    const r = setup(['healing_purr'], [rank]); r.hp = 50;
    const near = { kind:'kitten', x:r.player.x+40, y:r.player.y, hp:10, maxHp:40, life:5 };
    const far = { kind:'lion', x:r.player.x+250, y:r.player.y, hp:10, maxHp:40, life:5 };
    const dead = { kind:'spirit', x:r.player.x, y:r.player.y, hp:0, maxHp:40, life:5 };
    const orb = { kind:'orb', x:r.player.x, y:r.player.y, hp:10, maxHp:40, life:5 };
    r.minions.push(near, far, dead, orb); r.castSlot(0);
    assert.ok(r.hp > 50); assert.ok(Math.abs(near.hp - (rank === 4 ? 21.2 : 10)) < 1e-6);
    assert.equal(far.hp, 10); assert.equal(dead.hp, 0); assert.equal(orb.hp, 10);
  }
});

test('life drain rank five hits at most two nearby foes and heals only real damage', () => {
  const r = setup(['life_drain'], [5]); const target = enemy(r, 50), a = enemy(r, 75, 20), b = enemy(r, 80, -20);
  const c = enemy(r, 90, 40), far = enemy(r, 250, 150); target.hp = 1; r.hp = 40;
  r.attackCounter = 0; r.castSlot(0); release(r);
  assert.ok(target.dead); assert.ok(a.hp < a.hpMax && b.hp < b.hpMax); assert.equal(c.hp, c.hpMax); assert.equal(far.hp, far.hpMax);
  const expected = (1 + (a.hpMax - a.hp) + (b.hpMax - b.hp)) * 0.75;
  assert.ok(Math.abs(r.hp - 40 - expected) < 1e-6); assert.equal(r.attackCounter, 1);
});

test('shadow strike rank four refunds energy on its own kill only, never resets a different slot', () => {
  const r = setup(['claw_slash', 'shadow_strike'], [1, 4]); const e = enemy(r, 80);
  r.energy = 80; e.hp = 1; r.slots[0].charges = 0; r.slots[0].recharge = 7; r.slots[0].cd = 7;
  r.castSlot(1); release(r); assert.ok(e.dead); assert.equal(r.energy, 80); assert.equal(r.slots[0].charges, 0); assert.equal(r.slots[0].cd, 7);
  const other = setup(['claw_slash', 'shadow_strike'], [1, 4]); const e2 = enemy(other, 80);
  other.energy = 80; other.castSlot(1); release(other); assert.equal(other.energy, 54); other.hitEnemy(e2, e2.hp + 1, { source:'skill' });
  assert.equal(other.energy, 54); assert.equal(other.slots[0].recharge, 0);
});

test('shadow strike rank five is genuinely critical and consumes a forced crit', () => {
  const r = setup(['shadow_strike'], [5]); const e = enemy(r, 80); let result;
  r.forceCrit = true; r.on('fx:hit', hit => { result = hit; }); r.castSlot(0); release(r);
  assert.ok(result.crit); assert.equal(r.forceCrit, false);
  const noncritBase = r.skillDamage(r.slots[0].def, 2 * 1.25);
  assert.ok(result.amount >= noncritBase * r.stats.critDmg * 0.94 - 1e-6);
});

test('blood fang can stack at its normal cooldown and a fully expired bleed does not retain old strength', () => {
  const r = setup(['blood_fang'], [1]); const e = enemy(r, 50); r.castSlot(0); step(r, 0.2); const base = e.bleed;
  step(r, 5.1); assert.ok(r.canCast(r.slots[0])); r.castSlot(0); step(r, 0.2);
  assert.equal(e.bloodFangStacks, 2); assert.ok(Math.abs(e.bleed - base * 2) < 1e-6);
  step(r, 6.1); assert.equal(e.bloodFangStacks, 0); assert.ok(e.bleedTime <= 0);
  r.castSlot(0); step(r, 0.2); assert.equal(e.bloodFangStacks, 1); assert.ok(Math.abs(e.bleed - base) < 1e-6);
});

test('life drain consumes forced crit, deals critical damage, and caps healing on overkill', () => {
  const r = setup(['life_drain'], [2]); const e = enemy(r, 50); r.hp = 50; e.hp = 1;
  r.forceCrit = true; let hit; r.on('fx:hit', x => { hit = x; }); r.castSlot(0); release(r);
  assert.equal(hit.crit, true); assert.equal(r.forceCrit, false);
  assert.ok(hit.amount >= r.skillDamage(r.slots[0].def, 1.6) * r.stats.critDmg * 0.94 - 1e-6);
  assert.ok(Math.abs(r.hp - 50.75) < 1e-6);
});

test('blood fang leech uses actual damage and cannot benefit from overkill', () => {
  const r = setup(['blood_fang'], [1]); const e = enemy(r, 50); e.hp = 1; r.hp = 50;
  r.castSlot(0); release(r); assert.ok(e.dead); assert.ok(Math.abs(r.hp - 50.15) < 1e-6);
});

test('shadow strike never refunds on an out-of-range whiff', () => {
  const r = setup(['shadow_strike'], [5]); enemy(r, 500); r.energy = 80;
  r.castSlot(0); release(r); assert.equal(r.energy, 54);
});

test('blood fang damage over time works against a real boss', () => {
  const r = setup(['blood_fang'], [5]); r.spawnBoss('moon_devourer');
  const boss = r.boss; boss.x = r.player.x + 50; boss.y = r.player.y; boss.attackTimer = 10;
  r.castSlot(0); step(r, 0.15); assert.ok(boss.bleed > 0 && boss.bleedTime > 0);
  const hp = boss.hp; r.updateEnemies(0.1); assert.ok(boss.hp < hp);
});
