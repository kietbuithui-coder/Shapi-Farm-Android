import test from 'node:test';
import assert from 'node:assert/strict';
import { Run, RUN_STATE } from '../src/systems/run.js';
import { addTrainingDummy } from './harness.mjs';

function setup(id, rank = 1) {
  const r = new Run({ catId: 'tabby', skills: [id], seed: 25 });
  r.state = RUN_STATE.FIGHT; r.waveEnemiesLeft = 999;
  r.player.x = 785; r.player.y = 380; r.player.invuln = 999;
  r.slots[0].rank = rank;
  const e = addTrainingDummy(r, 35); e.hp = e.hpMax = 100000;
  e.speed = 0; e.attackCd = 999;
  return { r, e };
}
function step(r, seconds) { for (let i=0; i<Math.ceil(seconds*60); i++) { r.player.invuln = 999; r.step(1/60, {}); } }

test('blood moon performs two waves with bleed; rank five performs three', () => {
  for (const [rank, count] of [[1, 2], [5, 3]]) {
    const { r, e } = setup('blood_moon', rank); let hits = 0;
    r.on('fx:hit', ({ enemy }) => { if (enemy === e) hits++; });
    r.castSlot(0); step(r, 1.1);
    assert.equal(hits, count); assert.ok(e.bleed > 0 && e.bleedTime > 0);
    const hp = e.hp; r.updateEnemies(0.1); assert.ok(e.hp < hp, 'bleed ticks');
  }
});

test('rank four spirit cat fires a real ranged minion projectile with boss resistance', () => {
  const { r, e } = setup('spirit_cat', 4); e.x = r.player.x + 250;
  r.castSlot(0); step(r, 0.3); const m = r.minions.find(x => x.kind === 'spirit');
  assert.ok(m && m.ranged); m.x = r.player.x; m.y = r.player.y; m.attackCd = 0; e.boss = true;
  r.projectiles.length = 0; r.updateMinions(1/60);
  const projectile = r.projectiles.find(p => p.source === 'minion'); assert.ok(projectile);
  const before = e.hp; r.forceCrit = true; r.attackCounter = 2; r.mods.everyThird = 2;
  for (let i=0; i<90 && r.projectiles.length; i++) r.updateProjectiles(1/60);
  assert.ok(Math.abs((before - e.hp) - projectile.damage * 0.55) < 1e-6);
  assert.equal(r.forceCrit, true); assert.equal(r.attackCounter, 2);
});

test('rank two spirit cat actually moves faster than rank one', () => {
  const distances = [];
  for (const rank of [1, 2]) {
    const { r, e } = setup('spirit_cat', rank); e.x = r.player.x + 400;
    r.castSlot(0); step(r, 0.3); const m = r.minions[0]; m.x = r.player.x; m.y = e.y;
    const x = m.x; r.updateMinions(0.1); distances.push(m.x - x);
  }
  assert.ok(distances[1] > distances[0] * 1.14);
});

test('rank three lion diverts nearby normal melee enemies and can take their hits', () => {
  const { r, e } = setup('guardian_lion', 3); r.castSlot(0); step(r, 0.3);
  const lion = r.minions[0]; assert.ok(lion.taunt);
  r.player.x = 600; r.player.invuln = 0; lion.x = 800; lion.y = 380;
  e.x = 835; e.y = 380; e.speed = 40; e.dmg = 10; e.attackCd = 0;
  e.behaviour = 'chase'; e.def = { ...e.def, behaviour: 'chase', attack: 'touch', windup: 0.12 };
  const hp = lion.hp; const playerHp = r.hp; step(r, 0.5);
  assert.ok(lion.hp < hp, 'lion receives the melee hit'); assert.equal(r.hp, playerHp);
  lion.hp = 0; r.updateMinions(1/60); assert.ok(!r.minions.includes(lion));
});

test('rank four kittens heal on hit, sharing a two-second cap', () => {
  const { r, e } = setup('kitten_army', 4); r.hp = r.stats.hpMax / 2;
  r.castSlot(0); step(r, 0.3); assert.equal(r.minions.length, 4);
  for (const m of r.minions) { m.x = e.x - 20; m.y = e.y; m.attackCd = 0; }
  r.kittenHealReadyAt = 0;
  const hp = r.hp; r.updateMinions(1/60);
  assert.ok(Math.abs(r.hp - hp - 4) < 1e-6, 'only one heal across the pack');
  r.updateMinions(1/60); assert.ok(Math.abs(r.hp - hp - 4) < 1e-6);
});

test('lion taunt does not redirect ranged enemies', () => {
  const { r, e } = setup('guardian_lion', 3); r.castSlot(0); step(r, 0.3);
  const lion = r.minions[0]; lion.x = 900; lion.y = 380; r.player.x = 600;
  e.x = 835; e.y = 380; e.speed = 40; e.attackCd = 999; e.behaviour = 'chase';
  e.def = { ...e.def, behaviour: 'chase', attack: 'shoot' };
  const x = e.x; r.updateEnemies(0.05);
  assert.ok(e.x < x, 'ranged enemy still approaches the player, not the lion');
});
