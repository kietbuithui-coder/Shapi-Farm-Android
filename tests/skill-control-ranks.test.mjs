import test from 'node:test';
import assert from 'node:assert/strict';
import { Run, RUN_STATE } from '../src/systems/run.js';
import { addTrainingDummy } from './harness.mjs';

function setup(skills, ranks) {
  const r = new Run({ catId: 'tabby', skills, seed: 18 });
  r.state = RUN_STATE.FIGHT; r.waveEnemiesLeft = 999; r.player.x = 785; r.player.y = 380;
  r.player.invuln = 999; r.stats.crit = 0;
  ranks.forEach((rank, i) => { r.slots[i].rank = rank; });
  return r;
}
function dummy(r, dx, dy = 0) {
  const e = addTrainingDummy(r, dx); e.y += dy; e.speed = 0; e.attackCd = 999;
  e.hp = e.hpMax = 100000; return e;
}
function step(r, seconds) { for(let i=0; i<Math.ceil(seconds*60); i++) r.step(1/60, {}); }

test('hex rank four damages marked primary and spread targets over time without an extra hit', () => {
  for (const rank of [3, 4]) {
    const r = setup(['hex_brand'], [rank]); const a = dummy(r, 60), b = dummy(r, 100, 25);
    r.castSlot(0); assert.ok(a.mark > 0 && b.mark > 0);
    const hpA = a.hp, hpB = b.hp; r.updateEnemies(0.5);
    assert.equal(a.hp < hpA, rank === 4); assert.equal(b.hp < hpB, rank === 4);
    if (rank === 4) assert.ok(a.markDps > 0 && b.markDps > 0);
  }
});

test('hex mark DoT expires precisely, never poisons later hits, and ticks on a boss', () => {
  const r = setup(['hex_brand'], [4]); const e = dummy(r, 60); e.boss = true;
  r.castSlot(0); const dps = e.markDps, amp = e.mark; e.markTime = 0.05; const hp = e.hp;
  r.updateEnemies(0.1); assert.ok(Math.abs((hp - e.hp) - dps * 0.05 * (1 + amp)) < 1e-6);
  assert.equal(e.mark, 0); assert.equal(e.markDps, 0);
  r.hitEnemy(e, 10, { source: 'skill' }); assert.equal(e.poisonTime, 0);
});

test('time fur vulnerability remains independent from hex, expires with its boss-adjusted slow', () => {
  for (const kind of ['normal', 'elite', 'mini', 'boss']) {
    const r = setup(['hex_brand', 'time_fur'], [4, 5]); const e = dummy(r, 60);
    if (kind !== 'normal') e[kind] = true;
    r.castSlot(0); const amp = e.mark, markTime = e.markTime;
    r.castSlot(1); step(r, 0.55); const factor = { normal: 1, elite: 0.8, mini: 0.75, boss: 0.6 }[kind];
    assert.equal(e.mark, amp); assert.ok(e.markTime < markTime);
    assert.ok(Math.abs(e.timeAmp - 0.25) < 1e-6);
    assert.ok(e.timeAmpTime <= 4.5 * factor && e.timeAmpTime > 4.5 * factor - 0.1);
    const before = e.hp; r.hitEnemy(e, 10, { source: 'test' });
    assert.ok(Math.abs(before - e.hp - 10 * (1 + amp + 0.25)) < 1e-6);
    e.markDps = 0; e.timeAmpTime = 0.01; r.updateEnemies(0.02);
    assert.equal(e.timeAmp, 0); assert.equal(e.mark, amp);
  }
});

test('void maw rank four applies slow on explosion, not during pull', () => {
  const r = setup(['void_maw'], [4]); const e = dummy(r, 80); r.castSlot(0); step(r, 0.3);
  const z = r.zones.find(z => z.kind === 'void'); assert.ok(z); e.x = z.x; e.y = z.y;
  r.updateZones(0.1); assert.equal(e.slow, 0);
  r.updateZones(1); assert.ok(e.slow > 0); assert.ok(e.hp < e.hpMax);
});

test('void maw rank five heals once per target, capped by remaining enemy health', () => {
  const r = setup(['void_maw'], [5]); const a = dummy(r, 70), b = dummy(r, 75, 5);
  r.hp = 40; r.castSlot(0); step(r, 0.3); const z = r.zones.find(z => z.kind === 'void');
  a.x = b.x = z.x; a.y = b.y = z.y; a.hp = 1; const hpA = a.hp, hpB = b.hp;
  const hp = r.hp; r.updateZones(1.1); const lostB = hpB - b.hp;
  assert.ok(Math.abs(r.hp - hp - (hpA + lostB) * 0.3) < 1e-6);
  const after = r.hp; r.updateZones(0.1); assert.equal(r.hp, after, 'explosion cannot heal twice');
});

test('hex and time fur affect a real boss without suppressing its combat loop', () => {
  const r = setup(['hex_brand', 'time_fur'], [4, 5]); r.spawnBoss('moon_devourer');
  const boss = r.boss; boss.x = r.player.x + 70; boss.y = r.player.y; boss.attackTimer = 0.2;
  boss.hp = boss.hpMax * 0.9; r.castSlot(0); r.castSlot(1); step(r, 0.55);
  assert.ok(boss.mark > 0 && boss.markDps > 0 && boss.timeAmp > 0);
  assert.ok(boss.slow > 0 && boss.slow <= 0.35);
  let attacks = 0; r.on('boss:attack', () => attacks++);
  for (let i = 0; i < 240; i++) { r.player.invuln = 999; r.step(1/60, {}); }
  assert.ok(attacks > 0, 'boss still attacks while affected');
});
