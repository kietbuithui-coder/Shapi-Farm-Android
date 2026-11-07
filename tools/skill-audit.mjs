// Repeatable, deliberately synthetic skill audit. Run before and after changes:
// node tools/skill-audit.mjs docs/skill-audit/before.json
// All targets are immortal stationary test dummies. A zero is not a verdict on
// a skill's utility; see the markdown report for assumptions and limitations.
import { writeFileSync } from 'node:fs';
import { SKILLS, skillScaling } from '../src/data/skills.js';
import { Run, RUN_STATE } from '../src/systems/run.js';
// Older baselines predate body-animation definitions.
const { SKILL_ACTIONS } = await import('../src/systems/skill-animation.js').catch(() => ({ SKILL_ACTIONS: {} }));

const out = process.argv[2];
if (!out) throw new Error('Specify an output JSON path');
const DT = 1 / 60, DURATION = 12;
const positions = [[70, 0], [92, 18], [92, -18], [-70, 0], [0, 55]];
const hp = 1e7;
const dummyDef = { id: 'audit_dummy', tier: 'basic', shape: 'grub', hp, speed: 0, damage: 0, radius: 16, xp: 0, gold: 0, behaviour: 'idle', attack: 'none', windup: 9, color: '#888888', color2: '#555555', eye: '#ffffff' };
const round = (v) => Number(v.toFixed(2));

function trial(skill, scenario) {
  const run = new Run({ catId: 'tabby', skills: [skill.id], seed: 73 });
  run.state = RUN_STATE.FIGHT;
  run.waveEnemiesLeft = 999; run.player.x = 785; run.player.y = 380;
  run.player.invuln = 999; run.stats.crit = 0; run.energy = run.stats.energyMax;
  const size = scenario === 'group' ? 5 : 1;
  const enemies = [];
  for (let i = 0; i < size; i++) {
    const e = run.makeEnemy(dummyDef, {}, { scale: { hp: 1, dmg: 1, speed: 1, xp: 1, gold: 1 }, elite: scenario === 'elite' });
    e.x = run.player.x + positions[i][0]; e.y = run.player.y + positions[i][1];
    e.hp = e.hpMax = hp; e.speed = 0; e.attackCd = 1e9;
    if (scenario === 'boss') e.boss = true;
    run.enemies.push(e); enemies.push(e);
  }
  let firstHit = null, maxHit = 0, burst = 0;
  const hitEnemy = run.hitEnemy.bind(run);
  run.hitEnemy = (enemy, amount, opts = {}) => {
    const dealt = hitEnemy(enemy, amount, opts);
    if (dealt > 0) {
      if (firstHit === null) firstHit = run.time;
      maxHit = Math.max(maxHit, dealt);
      if (run.time <= 1) burst += dealt;
    }
    return dealt;
  };
  const cast = run.castSlot(0);
  for (let i = 0; i < DURATION / DT; i++) {
    // Stand-in for a stationary target: AI has no movement, but knockback and
    // pulls are deliberately allowed so the measurement includes missed hits.
    run.player.invuln = 999;
    run.step(DT, scenario === 'moving' ? { moveX: -0.35 } : {});
    if (run.state !== RUN_STATE.FIGHT) break;
  }
  const damage = run.statsTotals.damage;
  return { cast: cast.ok, damage: round(damage), burst1s: round(burst), maxHit: round(maxHit), firstHit: firstHit === null ? null : round(firstHit), targetsHit: enemies.filter(e => e.hp < hp).length, normalizedDamagePerCooldown: round(damage / skill.cd) };
}

const roles = { melee: 'single / frontal', combo: 'AoE sustained', dash: 'mobility / hybrid', blink: 'mobility', projectile: 'single / projectile', fish: 'single / knockback', nova: 'AoE / control', chain: 'chain / multi', meteor: 'delayed burst / AoE', volley: 'delayed AoE', beam: 'line burst', shockwave: 'line projectile', teleportStrike: 'reposition / single', execute: 'single / execute', mark: 'utility / synergy', zone: 'sustained / control', trap: 'control / trap', banana: 'control / trap', orbit: 'sustained / summon', summon: 'summon', buff: 'utility / defensive', shield: 'defensive', heal: 'healing / utility', drain: 'single / healing', aura: 'defensive / sustain', timeSlow: 'crowd control', pull: 'AoE / pull', soul: 'execute / sustain', boomerang: 'projectile / hybrid', barrage: 'sustained / projectile' };
const controlKeys = ['stun', 'freeze', 'slow', 'slowTime', 'root', 'knock', 'pull', 'pullTime'];
const report = {
  methodology: { seed: 73, character: 'tabby', rank: 1, crit: 0, seconds: DURATION, fixedStep: DT, scenario: 'Single cast, unlimited-health stationary dummies 70px away; group includes 5 near and behind; moving uses moveX -0.35 after cast; input is normalized to full movement speed. Damage per cooldown is a theoretical ratio, not actual rotation DPS.', warning: 'TargetsHit counts only damage, not control. Intentional healing/shields/mobility can have zero damage; temporary utility and counterplay require separate tests. Dummy boss/elite are flags, not real boss AI. No human playtest.' },
  skills: SKILLS.map(s => ({
    id: s.id, name: s.name, category: s.category, role: roles[s.pattern] || 'hybrid', pattern: s.pattern, rarity: s.rarity,
    damageMultiplier: s.params.damage ?? s.params.dmg ?? null, cooldown: s.cd, range: s.range, energy: s.cost, parameters: s.params, ranks: s.ranks,
    scaling: skillScaling(s), count: s.params.count ?? s.params.hits ?? 1, declaredEffects: s.desc,
    control: Object.fromEntries(Object.entries(s.params).filter(([k]) => controlKeys.includes(k))),
    declaredDelay: s.id === 'phantom_step' ? 1 : (['meteor', 'volley', 'beam'].includes(s.pattern) ? s.params.delay : ['epic', 'mythic'].includes(s.rarity) ? 0.25 : 0),
    animation: SKILL_ACTIONS[s.id] ? `authored body pose: startup ${SKILL_ACTIONS[s.id].startup}s, active ${SKILL_ACTIONS[s.id].active}s, recovery ${SKILL_ACTIONS[s.id].recovery}s` : 'shared cast glyph/ring and pattern FX; no per-skill body-animation timing contract',
    recovery: SKILL_ACTIONS[s.id] ? `${SKILL_ACTIONS[s.id].recovery}s with buffered skill input` : 'not implemented as an explicit lock',
    trials: Object.fromEntries(['single', 'group', 'elite', 'boss', 'moving'].map(scenario => [scenario, trial(s, scenario)])),
  }))
};
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(`Wrote ${report.skills.length} skills to ${out}`);
