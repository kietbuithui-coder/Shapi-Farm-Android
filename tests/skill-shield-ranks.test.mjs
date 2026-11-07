import test from 'node:test';
import assert from 'node:assert/strict';
import { Run, RUN_STATE } from '../src/systems/run.js';
import { addTrainingDummy } from './harness.mjs';

function setup(skills, ranks = []) {
  const r = new Run({ catId: 'tabby', skills, seed: 61 });
  r.state = RUN_STATE.FIGHT; r.waveEnemiesLeft = 999; r.player.x = 785; r.player.y = 380;
  r.stats.dodge = 0; r.stats.def = 0; r.stats.crit = 0;
  ranks.forEach((rank, i) => { r.slots[i].rank = rank; });
  return r;
}
function tick(r, seconds) { for (let i=0; i<Math.ceil(seconds*60); i++) r.step(1/60, {}); }
function cast(r, i = 0) { r.castSlot(i); tick(r, 0.3); r.player.invuln = 0; }
function dummy(r, x, y = r.player.y) {
  const e = addTrainingDummy(r, 0); e.x = x; e.y = y; e.speed = 0; e.attackCd = 999;
  e.hp = e.hpMax = 100000; return e;
}

test('nine lives heals and grants invulnerability only on an actual shield break', () => {
  for (const rank of [2, 3, 5]) {
    const r = setup(['nine_lives'], [rank]); r.hp = 60; cast(r);
    const hp = r.hp; r.player.shield = 1; r.damagePlayer(2, null);
    const expected = rank >= 3 ? r.stats.hpMax * 0.2 * r.skillCoefficient(r.slots[0].def) : 0;
    assert.ok(Math.abs(r.hp - (hp - 1 + expected)) < 1e-6);
    assert.ok(r.player.invuln >= (rank === 5 ? 1 : 0.62));
    assert.equal(r.player.shieldEffect, null);
  }
});

test('nine lives ward resolves lethal overflow before break heal, never revives without ward', () => {
  const r = setup(['nine_lives'], [5]); cast(r); r.hp = 1; r.player.shield = 1;
  r.damagePlayer(10, null); assert.ok(r.player.alive); assert.equal(r.reviveWard, false);
  assert.ok(Math.abs(r.hp - (1 + r.stats.hpMax * 0.2)) < 1e-6); assert.ok(r.player.invuln >= 1.2);
  const noWard = setup(['nine_lives'], [5]); cast(noWard); noWard.reviveWard = false;
  noWard.hp = 1; noWard.player.shield = 1; noWard.damagePlayer(10, null);
  assert.equal(noWard.player.alive, false); assert.equal(noWard.hp, 0);
});

test('purr shield rank three bursts once when broken, not on expiry or lower ranks', () => {
  for (const rank of [2, 3]) {
    const r = setup(['purr_shield'], [rank]); const near = dummy(r, r.player.x + 30);
    const far = dummy(r, r.player.x + 250); cast(r); r.forceCrit = true; r.attackCounter = 0;
    let bursts = 0; r.on('fx:blast', () => bursts++); r.player.shield = 1; r.damagePlayer(2, null);
    assert.equal(bursts, rank === 3 ? 1 : 0); assert.equal(near.hp < near.hpMax, rank === 3);
    assert.equal(far.hp, far.hpMax); assert.equal(r.forceCrit, true); assert.equal(r.attackCounter, 0);
    r.player.invuln = 0; r.damagePlayer(2, null); assert.equal(bursts, rank === 3 ? 1 : 0);
  }
  const expiring = setup(['purr_shield'], [3]); cast(expiring); let bursts = 0;
  expiring.on('fx:blast', () => bursts++); expiring.player.shieldTime = 0.01;
  expiring.updatePlayer(0.02, {}); assert.equal(bursts, 0); assert.equal(expiring.player.shieldEffect, null);
});

test('shared shield pool preserves the effect of its strongest shield and clears it on replacement', () => {
  const r = setup(['purr_shield'], [3]); cast(r); const effect = r.player.shieldEffect;
  r.applyShield(r.player.shield - 1, 7); assert.equal(r.player.shieldEffect, effect);
  r.applyShield(r.player.shield + 20, 7); assert.equal(r.player.shieldEffect, null);
  let bursts = 0; r.on('fx:blast', () => bursts++); r.player.shield = 1; r.damagePlayer(2, null);
  assert.equal(bursts, 0);
});

test('mirror rank five reflects an explosive projectile without consuming forced crit or on-hit', () => {
  for (const rank of [4, 5]) {
    const r = setup(['mirror_paw'], [rank]); const target = dummy(r, r.player.x + 60);
    const nearby = dummy(r, r.player.x + 60, r.player.y + 35); cast(r);
    r.forceCrit = true; r.attackCounter = 0;
    const pr = r.spawnProjectile({ x: r.player.x + 8, y: r.player.y - 20, angle: Math.PI,
      speed: 80, damage: 5, owner: 'enemy', source: 'enemy' });
    r.updateProjectiles(0.02); assert.equal(pr.source, 'reflect');
    assert.equal(pr.explode > 0, rank === 5);
    for (let i=0; i<120 && r.projectiles.length; i++) r.updateProjectiles(1/60);
    assert.ok(target.hp < target.hpMax); assert.equal(nearby.hp < nearby.hpMax, rank === 5);
    assert.equal(r.forceCrit, true); assert.equal(r.attackCounter, 0);
  }
});

test('mirror reflection cannot persist after its shield breaks or expires', () => {
  for (const mode of ['break', 'expire']) {
    const r = setup(['mirror_paw'], [5]); cast(r);
    if (mode === 'break') { r.player.shield = 1; r.damagePlayer(2, null); }
    else { r.player.shieldTime = 0.01; r.updatePlayer(0.02, {}); }
    assert.equal(r.buffValue('reflectProjectiles'), 0);
    r.applyShield(20, 5); r.player.invuln = 0;
    const pr = r.spawnProjectile({ x: r.player.x + 8, y: r.player.y - 20, angle: Math.PI,
      speed: 80, damage: 5, owner: 'enemy', source: 'enemy' });
    r.updateProjectiles(0.02); assert.equal(pr.owner, 'enemy'); assert.equal(r.projectiles.length, 0);
  }
});
