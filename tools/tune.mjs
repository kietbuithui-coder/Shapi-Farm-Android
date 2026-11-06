// Balance sweep: runs the bot for every cat across seeds and prints how deep it gets.
import { Run } from '../src/systems/run.js';
import { BotBrain } from '../src/systems/bot.js';
import { CATS } from '../src/data/cats.js';
import { SKILLS, STARTER_SKILLS } from '../src/data/skills.js';

const seeds = [3, 11, 29];
const perks = JSON.parse(process.argv[2] || '{}');
const rows = [];
for (const cat of CATS) {
  const skills = [...cat.skills];
  for (const id of STARTER_SKILLS) { if (skills.length >= 4) break; if (!skills.includes(id)) skills.push(id); }
  for (const seed of seeds) {
    const run = new Run({ catId: cat.id, skills, perks, seed });
    const bot = new BotBrain(run);
    run.start();
    for (let i = 0; i < 60 * 60 * 22; i++) {
      if (run.state === 'levelup') { bot.chooseOffer(); continue; }
      if (run.state === 'reward') { run.chooseReward(0); continue; }
      const input = bot.update(1 / 60);
      run.step(1 / 60, input);
      if (run.state === 'dead' || run.state === 'victory') break;
    }
    rows.push({ cat: cat.id, seed, night: run.night, wave: run.wave, lvl: run.level, kills: run.kills, min: +(run.time / 60).toFixed(1), end: run.state });
  }
}
console.table(rows);
const avg = rows.reduce((a, r) => a + (r.night - 1) * 5 + r.wave, 0) / rows.length;
console.log('avg depth (of 45):', avg.toFixed(1));
