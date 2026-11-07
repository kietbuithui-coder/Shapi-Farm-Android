import test from 'node:test';
import assert from 'node:assert/strict';
import { Run, RUN_STATE, ARENA } from '../src/systems/run.js';
import { addTrainingDummy } from './harness.mjs';

function setup(id, rank = 1) {
  const r = new Run({ catId: 'tabby', skills: [id], seed: 42 });
  r.state = RUN_STATE.FIGHT; r.waveEnemiesLeft = 999; r.player.x = 785; r.player.y = 380;
  r.slots[0].rank = rank; r.stats.dodge = 0; r.stats.def = 0;
  return r;
}
function step(run, seconds) { for (let i=0; i<Math.ceil(seconds*60); i++) run.step(1/60, {}); }
function release(r) { r.time += 0.12; r.updatePassiveEffects(0); }
function enemy(r, dx = 70, dy = 0) {
  const e = addTrainingDummy(r, dx); e.y += dy; e.hp = e.hpMax = 100000; e.speed = 0; e.attackCd = 999; return e;
}

test('yarn rank five bursts once on return and retains outbound and return hits', () => {
  const r = setup('magic_yarn', 5); const e = enemy(r); r.castSlot(0);
  let bursts = 0; r.on('fx:blast', () => bursts++);
  step(r, 1.5); assert.equal(bursts, 2, 'each of the two balls bursts once');
  assert.ok(e.hp < e.hpMax); assert.equal(r.projectiles.length, 0);
  const low = setup('magic_yarn', 4); enemy(low); low.castSlot(0);
  let lowBursts = 0; low.on('fx:blast', () => lowBursts++); step(low, 1.5); assert.equal(lowBursts, 0);
});

test('both boomerangs turn at arena edge instead of disappearing', () => {
  for (const id of ['magic_yarn', 'paw_boomerang']) {
    const r = setup(id, 5); r.player.x = ARENA.w - 90; r.player.aim = 0; r.castSlot(0); release(r);
    const pr = r.projectiles[0]; pr.x = ARENA.w - 1; pr.angle = 0;
    let blasts = 0; r.on('fx:blast', () => blasts++); r.updateProjectiles(1/60);
    assert.ok(pr.returning && r.projectiles.includes(pr), id);
    assert.equal(blasts, id === 'magic_yarn' ? 1 : 0);
    r.updateProjectiles(1/60); assert.ok(pr.x < ARENA.w, 'return moves inward');
  }
});

test('iron fur rank five heals only on valid nonlethal hits, including shielded hits', () => {
  const r = setup('iron_fur', 5); r.hp = 40; r.castSlot(0);
  const b = r.player.buffs.find(b => b.id === 'iron_fur');
  r.player.shield = 50; r.player.invuln = 0; r.damagePlayer(10, null);
  assert.ok(Math.abs(r.hp - (40 + b.onHitHeal)) < 1e-6);
  const hp = r.hp; r.damagePlayer(10, null); assert.equal(r.hp, hp, 'invulnerable hits do not heal');
  r.player.invuln = 0; r.player.shield = 0; r.hp = 1; r.damagePlayer(999, null);
  assert.equal(r.player.alive, false); assert.equal(r.hp, 0, 'heal cannot reverse lethal damage');
  const low = setup('iron_fur', 4); low.hp = 40; low.castSlot(0); low.player.shield = 50;
  low.damagePlayer(10, null); assert.equal(low.hp, 40);
});

test('catnip rank four restores energy rather than health, rank five removes drawback', () => {
  const rank = rank => { const r = setup('catnip_frenzy', rank); r.hp = 60; r.energy = 20; r.castSlot(0); release(r); return r; };
  const low = rank(3), high = rank(4); low.stats.regen = high.stats.regen = 0;
  low.updatePlayer(1, {}); high.updatePlayer(1, {}); low.updateBuffs(1); high.updateBuffs(1);
  assert.ok(Math.abs(high.energy - low.energy - 6) < 1e-6); assert.equal(high.hp, 60);
  const unbuffed = setup('catnip_frenzy'), drawback = rank(4), safe = rank(5);
  for (const r of [unbuffed, drawback, safe]) { r.hp = 80; r.rng = { ...r.rng, float: () => 0.5 }; r.damagePlayer(20, null); }
  assert.ok(drawback.hp < unbuffed.hp); assert.ok(Math.abs(safe.hp - unbuffed.hp) < 1e-6);
});

test('reflective claws only splashes at rank five without doubling the attacker hit', () => {
  for (const rank of [4, 5]) {
    const r = setup('reflective_claws', rank); const attacker = enemy(r, 40), neighbour = enemy(r, -40);
    r.castSlot(0); r.damagePlayer(20, attacker);
    assert.ok(attacker.hp < attacker.hpMax); assert.equal(neighbour.hp < neighbour.hpMax, rank === 5);
    assert.equal(r.attackCounter, 0, 'reflection cannot trigger player on-hit upgrades');
    if (rank === 5) assert.ok(Math.abs((attacker.hpMax - attacker.hp) - 2 * (neighbour.hpMax - neighbour.hp)) < 1e-6);
  }
});

test('yarn turnaround burst damages only nearby targets once without consuming on-hit', () => {
  const r = setup('magic_yarn', 5); const close = enemy(r, 200); const far = enemy(r, 350);
  r.castSlot(0); release(r); const pr = r.projectiles[0]; r.projectiles = [pr];
  pr.x = close.x - 40; pr.y = close.y - 12; pr.phase = pr.travel / pr.speed; pr.angle = 0;
  const hp = close.hp; r.updateProjectiles(1/60);
  assert.ok(Math.abs((hp - close.hp) - pr.damage * 0.55) < 1e-6);
  assert.equal(far.hp, far.hpMax); assert.equal(r.attackCounter, 0);
  const hpAfter = close.hp; r.updateProjectiles(1/60); assert.equal(close.hp, hpAfter);
});
