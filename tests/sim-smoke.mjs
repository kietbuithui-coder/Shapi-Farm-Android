import { Run } from '../src/systems/run.js';
import { BotBrain } from '../src/systems/bot.js';
import { SKILLS } from '../src/data/skills.js';
import { CATS } from '../src/data/cats.js';

const run = new Run({ catId: 'tabby', skills: ['claw_slash', 'pounce', 'nine_lives', 'fireball'], perks: {}, seed: 12345 });
const bot = new BotBrain(run);
run.start();
let frames = 0, maxEnemies = 0, errors = [];
run.events.on('error', (e) => errors.push(e));
const t0 = Date.now();
try {
  for (let i = 0; i < 60 * 240 && run.state !== 'dead' && run.state !== 'victory'; i++) {
    const input = bot.update(1 / 60);
    run.step(1 / 60, input);
    maxEnemies = Math.max(maxEnemies, run.enemies.length);
    frames++;
    if (i % 600 === 0) console.log(`${(i/60).toFixed(0)}s night ${run.night} wave ${run.wave} state ${run.state} hp ${run.hp.toFixed(0)}/${run.stats.hpMax.toFixed(0)} lvl ${run.level} enemies ${run.enemies.length} kills ${run.kills}`);
  }
} catch (err) {
  console.error('EXCEPTION', err);
  process.exit(1);
}
console.log('--- done in', Date.now() - t0, 'ms,', frames, 'frames');
console.log('state', run.state, 'night', run.night, 'wave', run.wave, 'kills', run.kills, 'level', run.level, 'maxEnemies', maxEnemies);
console.log('summary', JSON.stringify(run.summary()));
