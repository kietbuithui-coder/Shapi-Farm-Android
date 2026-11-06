import { Run } from '../src/systems/run.js';
import { BotBrain } from '../src/systems/bot.js';
import { CATS } from '../src/data/cats.js';
import { STARTER_SKILLS } from '../src/data/skills.js';
const cat = CATS.find(c => c.id === (process.argv[2] || 'sphynx'));
const skills = [...cat.skills];
for (const id of STARTER_SKILLS) { if (skills.length >= 4) break; if (!skills.includes(id)) skills.push(id); }
const run = new Run({ catId: cat.id, skills, seed: Number(process.argv[3] || 3) });
const bot = new BotBrain(run);
run.start();
for (let i = 0; i < 60 * 30; i++) {
  if (run.state === 'levelup') { bot.chooseOffer(); continue; }
  const input = bot.update(1/60);
  if (i % 120 === 0) {
    const t = run.nearestEnemy(run.player.x, run.player.y, 900);
    console.log(`t=${run.time.toFixed(1)} p=(${run.player.x.toFixed(0)},${run.player.y.toFixed(0)}) in=(${input.moveX.toFixed(2)},${input.moveY.toFixed(2)}) target=${t? t.id+'@'+t.x.toFixed(0)+','+t.y.toFixed(0) : '-'} stun=${run.enemies.filter(e=>!e.dead&&e.stun>0).length} hp=${run.hp.toFixed(0)}`);
  }
  run.step(1/60, input);
  if (run.state === 'dead') break;
}
