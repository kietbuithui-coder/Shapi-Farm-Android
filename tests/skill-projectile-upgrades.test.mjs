import test from 'node:test';
import assert from 'node:assert/strict';
import { Run, RUN_STATE, ARENA } from '../src/systems/run.js';
import { addTrainingDummy } from './harness.mjs';

function setup(id, rank = 1) {
  const r = new Run({ catId: 'tabby', skills: [id], seed: 62 });
  r.state = RUN_STATE.FIGHT; r.waveEnemiesLeft = 999;
  r.player.x = 785; r.player.y = 380; r.player.invuln = 999; r.stats.crit = 0;
  r.slots[0].rank = rank;
  const e = addTrainingDummy(r, 90); e.hp = e.hpMax = 100000; e.speed = 0; e.attackCd = 999;
  return { r, e };
}
function step(r, seconds) { for (let i=0; i<Math.ceil(seconds*60); i++) r.step(1/60, {}); }

test('arcane paw rank five splashes neighbours without consuming its pierce', () => {
  const { r, e } = setup('arcane_paw', 5); const neighbour = addTrainingDummy(r, 90);
  neighbour.y += 35; neighbour.hp = neighbour.hpMax = 100000;
  let blasts = 0; r.on('fx:blast', () => blasts++); r.castSlot(0); step(r, 0.16);
  assert.ok(e.hp < e.hpMax); assert.ok(neighbour.hp < neighbour.hpMax); assert.ok(blasts > 0);
  assert.ok(r.projectiles.some(p => p.hits.has(e.uid)), 'a pierced hit does not delete the projectile');
});

test('hairball rank four bounces once and rank five spreads projectiles', () => {
  const { r } = setup('hairball_cannon', 5); r.castSlot(0); r.time += 0.11; r.updatePassiveEffects(0);
  const shots = r.projectiles; assert.equal(shots.length, 5);
  assert.ok(Math.abs(shots[4].angle - shots[0].angle) > 2.7, 'rank five uses the wide spread');
  const p = shots[0]; r.projectiles = [p]; r.enemies.length = 0;
  p.x = ARENA.w - 1; p.y = 380; p.angle = 0; p.life = 2; r.updateProjectiles(0.05);
  assert.equal(p.bounces, 0); assert.ok(Math.cos(p.angle) < 0); assert.ok(r.projectiles.includes(p));
  p.x = ARENA.w - 1; p.angle = 0; r.updateProjectiles(0.05);
  assert.equal(r.projectiles.length, 0, 'second wall collision removes it');
});

test('frost nova rank five releases six damaging shards and retains freeze', () => {
  const { r, e } = setup('frost_nova', 5); e.x = r.player.x + 125;
  r.castSlot(0); step(r, 0.15);
  const shards = r.projectiles.filter(p => p.shape === 'shard');
  assert.equal(shards.length, 6); assert.ok(shards.every(p => p.damage > 0));
  assert.ok(e.stun > 1); const hp = e.hp; step(r, 0.4);
  assert.ok(e.hp < hp, 'a shard can strike an enemy in its path');
});

function arrangeOrb(r, e) {
  const m = r.minions.find(m => m.kind === 'orb');
  m.angle = -2.4 / 60; m.hitCd.clear();
  e.x = r.player.x + m.radius; e.y = r.player.y - 12; e.hp = e.hpMax = 100000;
  return m;
}

test('rank five spirit orbs fire additional orbit-sourced projectiles', () => {
  const { r, e } = setup('spirit_orbs', 5); r.castSlot(0); step(r, 0.3);
  const m = arrangeOrb(r, e); e.boss = true; r.forceCrit = true; r.attackCounter = 2; r.mods.everyThird = 2;
  r.projectiles.length = 0; r.updateMinions(1/60);
  const pr = r.projectiles.find(p => p.source === 'orbit'); assert.ok(pr);
  assert.equal(pr.damage, m.damage * 0.25);
  r.projectiles = [pr]; const hp = e.hp; r.updateProjectiles(1/60);
  assert.ok(Math.abs((hp - e.hp) - pr.damage * 0.7) < 1e-6);
  assert.equal(r.forceCrit, true); assert.equal(r.attackCounter, 2);
});

test('rank five ghost paws apply bleed and rank four blaze orbit leaves damaging trails', () => {
  const a = setup('ghost_paw', 5); a.r.castSlot(0); arrangeOrb(a.r, a.e); a.r.updateMinions(1/60);
  assert.ok(a.e.bleedTime > 0 && a.e.bleed > 0);
  const b = setup('blaze_orbit', 4); b.r.castSlot(0); step(b.r, 0.3);
  assert.ok(b.r.zones.some(z => z.kind === 'fire' && z.dps > 0 && z.time === 0.8));
  const m = b.r.minions[0]; const n = b.r.zones.length;
  b.r.updateMinions(0.1); assert.equal(b.r.zones.length, n, 'trail generation is rate-limited');
  assert.ok(m.burnTrail);
});

test('orbit trail and ghost bleed honour reduced boss summon damage', () => {
  const a = setup('ghost_paw', 5); a.r.castSlot(0); arrangeOrb(a.r, a.e); a.e.boss = true;
  const m = a.r.minions[0]; a.r.updateMinions(1/60);
  assert.ok(Math.abs(a.e.bleed - m.damage * 0.18 * 0.7) < 1e-6);
  const b = setup('blaze_orbit', 4); b.r.castSlot(0); step(b.r, 0.3);
  const zone = b.r.zones.find(z => z.source === 'orbit'); b.r.zones = [zone];
  b.e.x = zone.x; b.e.y = zone.y; b.e.boss = true; const hp = b.e.hp;
  b.r.updateZones(0.1); assert.ok(Math.abs((hp - b.e.hp) - zone.dps * 0.1 * 0.7) < 1e-6);
});

test('arcane paw rank five does not splash its direct target on an isolated hit', () => {
  const { r, e } = setup('arcane_paw', 5); r.castSlot(0);
  r.projectiles = [r.projectiles[0]]; const pr = r.projectiles[0]; e.boss = true;
  const hits = []; r.on('fx:hit', hit => hits.push(hit));
  step(r, 0.17); assert.equal(hits.length, 1); assert.equal(hits[0].source, 'skill');
  assert.ok(Math.abs((e.hpMax - e.hp) - hits[0].amount) < 1e-6);
  assert.ok(r.projectiles.includes(pr), 'pierce remains after the first hit');
});

test('rank five upgrades do not trigger splash or shots without a hit', () => {
  const a = setup('arcane_paw', 5); a.r.enemies.length = 0; let blasts = 0;
  a.r.on('fx:blast', () => blasts++); a.r.castSlot(0); step(a.r, 1); assert.equal(blasts, 0);
  const b = setup('spirit_orbs', 5); b.r.enemies.length = 0; b.r.castSlot(0); step(b.r, 1);
  assert.equal(b.r.projectiles.filter(p => p.source === 'orbit').length, 0);
});

test('hairball below rank four still disappears at a wall', () => {
  const { r } = setup('hairball_cannon', 3); r.castSlot(0); r.time += 0.11; r.updatePassiveEffects(0);
  const p = r.projectiles[0]; r.projectiles = [p]; r.enemies.length = 0;
  p.x = ARENA.w - 1; p.y = 380; p.angle = 0; r.updateProjectiles(0.05);
  assert.equal(r.projectiles.length, 0);
});
