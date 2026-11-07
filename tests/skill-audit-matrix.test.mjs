// Broad crash/invariant coverage, not a human playtest or balance certification.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Run, RUN_STATE } from '../src/systems/run.js';
import { SKILLS } from '../src/data/skills.js';
import { ENEMIES } from '../src/data/enemies.js';
import { addTrainingDummy } from './harness.mjs';

const dt = 1 / 60;
function makeScenario(id, scenario) {
  const other = id === 'hex_brand' ? 'claw_slash' : 'hex_brand';
  const run = new Run({ catId: 'tabby', skills: [id, other], seed: 95 });
  run.state = RUN_STATE.FIGHT; run.waveEnemiesLeft = 999;
  run.player.x = 700; run.player.y = 380; run.player.invuln = 999; run.stats.crit = 0;
  if (scenario === 'boss') {
    run.spawnBoss('moon_devourer'); run.boss.x = 770; run.boss.y = 380;
    run.boss.hp = run.boss.hpMax = 100000;
  } else if (scenario === 'elite') {
    const e = run.makeEnemy(ENEMIES[0], {}, { elite: true, scale: { hp: 1, dmg: 1, speed: 1, xp: 1, gold: 1 } });
    e.x = 770; e.y = 380; e.hp = e.hpMax = 100000; run.enemies.push(e);
  } else {
    const count = scenario === 'group' ? 5 : 1;
    for (let i = 0; i < count; i++) {
      const e = addTrainingDummy(run, 70 + i * 16); e.y += (i - 2) * 12;
      e.hp = e.hpMax = 100000; e.speed = 0; e.attackCd = 999;
    }
  }
  return run;
}
function simulate(run, seconds, moving = false) {
  for (let i = 0; i < Math.ceil(seconds / dt); i++) {
    run.player.invuln = 999;
    run.step(dt, moving ? { moveX: -1 } : {});
    assert.equal(run.state, RUN_STATE.FIGHT);
  }
}
for (const skill of SKILLS) {
  test(`skill matrix: ${skill.id}`, () => {
    for (const scenario of ['single', 'group', 'elite', 'boss', 'moving', 'chain', 'combo']) {
      const run = makeScenario(skill.id, scenario);
      assert.ok(run.castSlot(0).ok, `${scenario}: first cast`);
      if (scenario === 'combo') {
        run.energy = run.stats.energyMax;
        assert.ok(run.castSlot(1).ok, `${scenario}: second skill`);
      }
      if (scenario === 'chain') {
        // Natural recharge (no cooldown reset); top up energy to isolate recharge.
        simulate(run, skill.cd + 1);
        run.energy = run.stats.energyMax;
        assert.ok(run.castSlot(0).ok, `${scenario}: cast after cooldown`);
      }
      simulate(run, 2, scenario === 'moving');
      for (const v of [run.hp, run.energy, run.player.x, run.player.y, run.statsTotals.damage]) {
        assert.ok(Number.isFinite(v), `${scenario}: finite run state`);
      }
      for (const e of run.enemies) {
        for (const v of [e.hp, e.x, e.y]) assert.ok(Number.isFinite(v), `${scenario}: finite enemy state`);
      }
    }
  });
}
