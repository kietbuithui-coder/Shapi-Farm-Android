// Reproducible bot telemetry, not a human playtest or a balance verdict.
import { Run, RUN_STATE } from '../src/systems/run.js';
import { BotBrain } from '../src/systems/bot.js';
import { CATS } from '../src/data/cats.js';
import { STARTER_SKILLS } from '../src/data/skills.js';
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';

export function simulate({ catId = 'tabby', seed = 3, difficulty = 'normal', limit = 1200, assisted = false } = {}) {
  const cat = CATS.find(c => c.id === catId);
  if (!cat) throw Error(`Unknown cat: ${catId}`);
  const skills = [...cat.skills];
  for (const id of STARTER_SKILLS) if (skills.length < 4 && !skills.includes(id)) skills.push(id);
  const run = new Run({ catId, skills, perks: {}, seed, difficulty });
  const bot = new BotBrain(run); run.start();
  let frames = 0, maxEnemies = 0, maxProjectiles = 0, maxHazards = 0, choices = 0;
  const nights = [1], bosses = [], errors = [];
  run.on('night:begin', e => nights.push(e.night));
  run.on('boss:defeated', e => bosses.push(e.night));
  const dt = 1 / 60, maxFrames = Math.ceil(limit / dt);
  while (frames < maxFrames && run.state !== RUN_STATE.DEAD && run.state !== RUN_STATE.VICTORY) {
    if (run.state === RUN_STATE.LEVELUP) {
      const previous = run.offers;
      bot.chooseOffer();
      if (run.state === RUN_STATE.LEVELUP && previous === run.offers) { errors.push('level-up blocked'); break; }
      if (++choices > 1000) { errors.push('too many consecutive choices'); break; }
      continue;
    }
    if (run.state === RUN_STATE.REWARD) {
      if (!run.chooseReward(0)) { errors.push('reward blocked'); break; }
      if (++choices > 1000) { errors.push('too many consecutive choices'); break; }
      continue;
    }
    choices = 0;
    if (assisted) { run.player.invuln = 5; run.hp = run.stats.hpMax; run.energy = run.stats.energyMax; run.stats.atk = Math.max(run.stats.atk, 4000); }
    run.step(dt, bot.update(dt)); frames++;
    maxEnemies = Math.max(maxEnemies, run.enemies.length);
    maxProjectiles = Math.max(maxProjectiles, run.projectiles.length);
    maxHazards = Math.max(maxHazards, run.hazards.length);
    if (frames % 60 === 0) {
      const nums = [run.hp, run.energy, run.time, run.player.x, run.player.y, ...run.enemies.flatMap(e => [e.x,e.y,e.hp])];
      if (!nums.every(Number.isFinite)) { errors.push('non-finite state'); break; }
    }
  }
  return { cat: catId, skills, seed, difficulty, assisted, state: run.state, night: run.night, wave: run.wave,
    seconds: Math.round(run.time * 10) / 10, level: run.level, kills: run.kills, nights, bosses,
    maxEnemies, maxProjectiles, maxHazards, errors };
}

function main() {
  const assisted = process.argv.includes('--assisted');
  const quick = process.argv.includes('--quick');
  const cats = assisted ? ['tabby'] : CATS.map(c => c.id);
  const seeds = assisted ? [3] : quick ? [3] : [3, 11, 29];
  const difficulties = assisted ? ['normal'] : ['normal', 'hard'];
  const results = [];
  for (const difficulty of difficulties) for (const catId of cats) for (const seed of seeds) {
    const row = simulate({ catId, seed, difficulty, limit: assisted ? 3600 : 1200, assisted });
    results.push(row);
    console.log(`${difficulty} ${catId} seed ${seed}: ${row.state} night ${row.night} wave ${row.wave} ${row.seconds}s kills ${row.kills}${row.errors.length ? ' ERR ' + row.errors.join(', ') : ''}`);
  }
  const outputArg = process.argv.indexOf('--output');
  if (outputArg >= 0) {
    if (!process.argv[outputArg + 1]) throw Error('--output requires a file path');
    writeFileSync(process.argv[outputArg + 1], JSON.stringify({ note: assisted ? 'Artificial invulnerability and high attack; progression plumbing only.' : 'Automated bot; not a human playtest or proof of balance.', dt: 1 / 60, results }, null, 2) + '\n');
  }
  if (results.some(r => r.errors.length)) process.exitCode = 1;
  if (assisted && results.some(r => r.state !== RUN_STATE.VICTORY || r.nights.length !== 9)) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
