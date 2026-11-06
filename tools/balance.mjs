// Headless balance harness: runs the bot across cats and reports pacing.
import { Run } from '../src/systems/run.js';
import { BotBrain } from '../src/systems/bot.js';
import { CATS } from '../src/data/cats.js';
import { SKILLS } from '../src/data/skills.js';

const catId = process.argv[2] || 'tabby';
const seed = Number(process.argv[3] || 7);
const cat = CATS.find(c => c.id === catId);
const skills = [...cat.skills];
for (const s of SKILLS) { if (skills.length >= 4) break; if (!skills.includes(s.id) && s.starter) skills.push(s.id); }
const run = new Run({ catId, skills, perks: {}, seed });
const bot = new BotBrain(run);
run.start();
const marks = [];
let lastNight = 0, lastWave = 0;
for (let i = 0; i < 60 * 60 * 25; i++) {
  const input = bot.update(1 / 60);
  run.step(1 / 60, input);
  if (run.night !== lastNight || run.wave !== lastWave) {
    marks.push({ t: +run.time.toFixed(1), night: run.night, wave: run.wave, hp: Math.round(run.hp), max: Math.round(run.stats.hpMax), lvl: run.level, atk: +run.stats.atk.toFixed(1), kills: run.kills });
    lastNight = run.night; lastWave = run.wave;
  }
  if (run.state === 'dead' || run.state === 'victory') break;
}
console.log('CAT', catId, 'seed', seed, '→', run.state, 'night', run.night, 'wave', run.wave, 'level', run.level, 'kills', run.kills, 'time', run.time.toFixed(0), 's');
console.table(marks);
