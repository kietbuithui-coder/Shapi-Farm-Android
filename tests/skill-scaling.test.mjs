import test from 'node:test';
import assert from 'node:assert/strict';
import { Run, RUN_STATE } from '../src/systems/run.js';
import { SKILLS, SKILL_BY_ID, skillScaling, skillValues } from '../src/data/skills.js';
import { sanitizeSettings, SAVE_KEY } from '../src/core/save.js';
import { addTrainingDummy, advance } from './harness.mjs';
import { bootGame } from './dom.mjs';

const make = (skills = ['claw_slash'], profile = null) => {
  const run = new Run({ catId: 'tabby', skills, seed: 3, profile });
  run.start(); advance(run, 1.3); run.pendingSpawns.length = 0;
  run.enemies.length = 0; run.waveEnemiesLeft = 1;
  return run;
};

test('no basic attack happens without a skill input', () => {
  const run = make(); const dummy = addTrainingDummy(run, 45);
  advance(run, 1);
  assert.equal(dummy.hp, dummy.hpMax);
  assert.equal(run.statsTotals.damage, 0);
  assert.equal(run.castSlot(0).ok, true);
  assert.ok(dummy.hp < dummy.hpMax);
});

test('every skill has a stat family and those stats and coefficients affect power', () => {
  const run = make();
  for (const skill of SKILLS) assert.ok(['damage', 'health', 'speed', 'armor'].includes(skillScaling(skill)), skill.id);
  for (const [id, stat, field] of [['claw_slash', 'atk', 'skillScaleDamage'], ['pounce', 'move', 'skillScaleSpeed'], ['healing_purr', 'hpMax', 'skillScaleHealth'], ['frost_nova', 'def', 'skillScaleArmor']]) {
    const skill = SKILL_BY_ID[id];
    run.profile = { settings: { [field]: 1 } };
    const base = run.skillDamage(skill, 1);
    run.profile.settings[field] = 2;
    assert.ok(Math.abs(run.skillDamage(skill, 1) / base - 2) < 1e-8, id);
    run.profile.settings[field] = 1;
    run.stats[stat] += stat === 'def' ? 0.2 : 10;
    assert.ok(run.skillDamage(skill, 1) > base, id);
  }
});

test('melee damage and healing really respond to the hidden coefficients', () => {
  const measureMelee = (mult) => { const run = make(['claw_slash'], { settings: { skillScaleDamage: mult } }); const dummy = addTrainingDummy(run, 40); run.castSlot(0); return dummy.hpMax - dummy.hp; };
  assert.ok(measureMelee(2) > measureMelee(1) * 1.9);
  const run = make(['healing_purr'], { settings: { skillScaleHealth: 2 } });
  run.hp = run.stats.hpMax / 4; const before = run.hp; run.castSlot(0);
  assert.ok(Math.abs(run.hp - before - run.stats.hpMax * 0.44) < 1e-6);
});

test('strong instant skills wait briefly and the tell fires before impact', () => {
  const run = make(['executioner']); const dummy = addTrainingDummy(run, 40);
  let tells = 0; run.on('fx:skill', () => tells++);
  run.castSlot(0); assert.ok(tells > 0); assert.equal(dummy.hp, dummy.hpMax);
  advance(run, 0.15); assert.equal(dummy.hp, dummy.hpMax);
  advance(run, 0.2); assert.ok(dummy.hp < dummy.hpMax);
});

test('funny skills have real distinct effects and ranks accumulate', () => {
  const run = make(['banana_peel', 'flying_fish']);
  run.castSlot(0); assert.ok(run.traps.some((t) => t.banana && t.damage > 0));
  assert.deepEqual(run.castSlot(1), { ok: true, queued: true }); advance(run, 0.4);
  assert.ok(run.projectiles.some((p) => p.shape === 'fish' && p.knock > 0));
  assert.equal(skillValues(SKILL_BY_ID.banana_peel, 5).rankValues.root, 1.8);
  assert.equal(skillValues(SKILL_BY_ID.banana_peel, 5).rankValues.count, 3);
});

test('at most one boss or miniboss can be spawned at a time', () => {
  const run = make(); run.spawnMiniBoss('grub_mother');
  run.spawnMiniBoss('stone_warden'); run.spawnBoss('moon_devourer');
  assert.equal(run.enemies.filter((e) => !e.dead && (e.mini || e.boss)).length, 1);
  run.beginWave(5);
  assert.equal(run.enemies.filter((e) => !e.dead && e.boss).length, 1);
  assert.equal(run.enemies.filter((e) => !e.dead && e.mini).length, 0);
});

test('defeating a miniboss drops upgrade currency', () => {
  const run = make(); run.spawnMiniBoss('grub_mother');
  run.hitEnemy(run.miniBoss, run.miniBoss.hp + 1);
  assert.ok(run.embersFound >= 10, 'boss currency is credited even if the wave ends immediately');
});

test('hidden settings open on seven taps, save and reach the live run', async () => {
  const { game, step, rects } = await bootGame({ width: 840, height: 380 });
  step(2); game.click('settings', 0, 0); step(30);
  assert.equal(game.scene, 'settings');
  for (let i = 0; i < 7; i++) game.click('secretScale', 0, 0);
  step(30); assert.equal(game.scene, 'skillScaling');
  for (const key of ['skillScaleHealth', 'skillScaleSpeed', 'skillScaleArmor', 'skillScaleDamage']) {
    const row = rects().find((r) => r.id === key); assert.ok(row, key);
    game.click(key, row.x + row.w * 2 / 3, row.y + 5);
    assert.equal(game.profile.settings[key], 2);
  }
  assert.equal(JSON.parse(localStorage.getItem(SAVE_KEY)).settings.skillScaleDamage, 2);
  assert.equal(sanitizeSettings({ skillScaleDamage: 99 }).skillScaleDamage, 3);
  assert.equal(sanitizeSettings({}).skillScaleDamage, 1);
  game.click('back', 0, 0); step(30); assert.equal(game.scene, 'settings');
});

test('zone damage, trap upgrades, and skill-on-hit upgrades are functional', () => {
  const run = make(['rending_ground', 'moonlit_trap', 'claw_slash']);
  const dummy = addTrainingDummy(run, 50);
  run.castSlot(0); advance(run, 0.32);
  assert.ok(run.zones[0].dps > 0);
  dummy.x = run.player.x + 400;
  run.slots[1].rank = 2; run.castSlot(1); advance(run, 0.15);
  assert.ok(run.traps[0].damage > 0);
  run.mods.slowOnHit = 0.3;
  dummy.x = run.player.x + 50; run.castSlot(2); advance(run, 0.2);
  assert.equal(dummy.slow, 0.3);
});

test('changing hidden scaling during a paused run preserves that run', async () => {
  const { game, step, rects } = await bootGame({ width: 840, height: 380 });
  step(3); game.click('play', 0, 0); step(40);
  const run = game.run; run.stats.atk = 20;
  const skill = SKILL_BY_ID.claw_slash;
  const before = run.skillDamage(skill, 1);
  game.togglePause(true); game.click('settings', 0, 0); step(30);
  for (let i = 0; i < 7; i++) game.click('secretScale', 0, 0);
  step(30);
  const row = rects().find((r) => r.id === 'skillScaleDamage');
  game.click(row.id, row.x + row.w * 2 / 3, row.y + 4);
  assert.ok(Math.abs(run.skillDamage(skill, 1) / before - 2) < 1e-9);
  game.click('back', 0, 0); step(30);
  game.click('back', 0, 0); step(30);
  assert.equal(game.scene, 'run'); assert.equal(game.run, run); assert.equal(game.paused, true);
});

test('guardian aura heals and blink damage upgrade is not zero', () => {
  const run = make(['guardian_aura', 'blink_paw']);
  run.hp = run.stats.hpMax / 2;
  run.castSlot(0); advance(run, 0.4);
  const before = run.hp; advance(run, 1);
  assert.ok(run.hp > before, 'guardian aura heals over time');
  const dummy = addTrainingDummy(run, 190);
  run.slots[1].rank = 3;
  run.castSlot(1);
  assert.ok(dummy.hp < dummy.hpMax, 'rank three blink deals damage');
});
