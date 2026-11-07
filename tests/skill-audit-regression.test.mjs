import test from 'node:test';
import assert from 'node:assert/strict';
import { Run, RUN_STATE } from '../src/systems/run.js';
import { SKILL_BY_ID } from '../src/data/skills.js';
import { addTrainingDummy } from './harness.mjs';

function setup(id) {
  const run = new Run({ catId: 'tabby', skills: [id], seed: 73 });
  run.state = RUN_STATE.FIGHT; run.waveEnemiesLeft = 999;
  run.player.x = 785; run.player.y = 380; run.player.invuln = 999; run.stats.crit = 0;
  const e = addTrainingDummy(run, 70); e.hp = e.hpMax = 100000; e.speed = 0; e.attackCd = 999;
  return { run, e };
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('meteor and beam resolve once per hazard, independent of timestep', () => {
  for (const [id, expectedPower] of [['meteor_paw', 4], ['lunar_beam', 3.2]]) {
    for (const dt of [1/60, 0.08]) {
      const { run, e } = setup(id); assert.ok(run.castSlot(0).ok);
      for (let t = 0; t < 2; t += dt) run.step(dt, {});
      near(e.hpMax - e.hp, run.skillDamage(SKILL_BY_ID[id], expectedPower));
    }
  }
});

test('mark amplifies melee and projectile hits exactly once', () => {
  for (const id of ['claw_slash', 'hairball_cannon']) {
    const a = setup(id), b = setup(id);
    b.e.mark = 0.18; b.e.markTime = 10;
    assert.ok(a.run.castSlot(0).ok); assert.ok(b.run.castSlot(0).ok);
    for (let i = 0; i < 60; i++) { a.run.step(1/60, {}); b.run.step(1/60, {}); }
    assert.ok(a.e.hp < a.e.hpMax); near(b.e.hpMax - b.e.hp, (a.e.hpMax - a.e.hp) * 1.18);
  }
});

test('guardian lion area damage uses summon resistance and does not trigger on-hit upgrades', () => {
  const { run, e } = setup('guardian_lion'); e.boss = true;
  run.mods.everyThird = 2; run.attackCounter = 2;
  run.arcDamage(e.x, e.y, 110, 110, 1, Math.PI * 2, null, 10, {}, true, 'minion');
  near(e.hpMax - e.hp, 5.5); assert.equal(run.attackCounter, 2);
});

test('returning weapons can hit once on each leg and use their declared distance', () => {
  for (const id of ['magic_yarn', 'paw_boomerang']) {
    const { run, e } = setup(id); let hits = 0;
    run.on('fx:hit', ({ enemy }) => { if (enemy === e) hits++; });
    assert.ok(run.castSlot(0).ok);
    for (let i = 0; i < 120; i++) run.step(1/60, {});
    assert.equal(hits, 2, `${id} should hit going out and coming back`);
  }
});

test('hairball knocks back and rank 3 frost extends freeze', () => {
  const a = setup('hairball_cannon'); a.run.castSlot(0);
  for (let i = 0; i < 20; i++) a.run.step(1/60, {});
  assert.ok(a.e.x > a.run.player.x + 70, 'hairball pushes its target');
  const b = setup('frost_nova'); b.run.slots[0].rank = 3; b.run.castSlot(0);
  for (let i = 0; i < 10; i++) b.run.step(1/60, {});
  assert.ok(b.e.stun > 1, `rank 3 freeze: ${b.e.stun}`);
});

test('control duration and slow are differentiated and boss lockout prevents chaining', () => {
  const { run, e } = setup('frost_nova');
  run.applyStatus(e, 'stun', 1); near(e.stun, 1);
  e.elite = true; e.stun = 0; run.applyStatus(e, 'stun', 1); near(e.stun, 0.65);
  e.elite = false; e.boss = true; e.stun = 0; run.applyStatus(e, 'stun', 1); near(e.stun, 0.3);
  run.time += 0.5; e.stun = 0; run.applyStatus(e, 'root', 2); near(e.root, 0);
  run.applyStatus(e, 'slow', 0.8, 2); near(e.slow, 0.35); near(e.slowTime, 1.2);
  run.time += 2; run.applyStatus(e, 'root', 2); near(e.root, 0.3);
});

test('Void Maw does not displace bosses or wardens, but pulls ordinary enemies', () => {
  for (const kind of ['boss', 'mini', 'normal']) {
    const { run, e } = setup('void_maw'); e.boss = kind === 'boss'; e.mini = kind === 'mini';
    run.zones.push({ kind: 'void', x: e.x + 100, y: e.y, radius: 104, time: 1, t: 0, pull: 1 });
    const x = e.x; run.updateZones(0.1);
    if (kind === 'normal') assert.ok(e.x > x); else assert.equal(e.x, x);
  }
});

test('rank 4 lunar beam applies its slow once to targets in the line', () => {
  const { run, e } = setup('lunar_beam'); run.slots[0].rank = 4; run.castSlot(0);
  for (let i = 0; i < 20; i++) run.step(1/60, {});
  near(e.slow, 0.5); assert.ok(e.slowTime > 1);
});

test('repeated control does not permanently stop an actual boss attack loop', () => {
  const { run } = setup('frost_nova'); run.enemies.length = 0;
  run.spawnBoss('moon_devourer'); const boss = run.boss;
  boss.x = 900; boss.y = 380; boss.hp = boss.hpMax * 0.9; boss.attackTimer = 0.2;
  let attacks = 0; run.on('boss:attack', () => attacks++);
  for (let i = 0; i < 240; i++) {
    run.player.invuln = 999;
    run.applyStatus(boss, 'stun', 3);
    run.step(1/60, {});
  }
  assert.ok(attacks > 0, 'boss attacks between hard-control windows');
  assert.ok(boss.controlImmuneUntil > 0);
});

test('an enemy beam hits the player once and never damages enemies', () => {
  const { run, e } = setup('claw_slash');
  run.player.invuln = 0; const hp = run.hp; const enemyHp = e.hp;
  run.hazards.push({ kind: 'beam', x: 650, y: 360, angle: 0, length: 300, width: 50, delay: 0.05, t: 0, damage: 10, source: 'enemy' });
  run.updateHazards(0.08); const after = run.hp;
  assert.ok(after < hp); assert.equal(e.hp, enemyHp);
  run.player.invuln = 0; run.updateHazards(0.08); assert.equal(run.hp, after);
});
