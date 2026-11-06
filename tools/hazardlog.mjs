import { Run } from '../src/systems/run.js';
import { BotBrain } from '../src/systems/bot.js';
import { CATS } from '../src/data/cats.js';
import { STARTER_SKILLS } from '../src/data/skills.js';
const cat = CATS.find(c => c.id === (process.argv[2] || 'sphynx'));
const skills = [...cat.skills];
for (const id of STARTER_SKILLS) { if (skills.length >= 4) break; if (!skills.includes(id)) skills.push(id); }
const run = new Run({ catId: cat.id, skills, seed: Number(process.argv[3] || 3) });
const bot = new BotBrain(run);
let last = null;
run.events.on('player:hurt', ({ amount }) => {
  // find the most recent hazard that went off near the player
  const near = run.hazards.filter(h => Math.abs(h.t - h.delay) < 0.25).map(h => h.kind + '@' + Math.round(h.radius || 0));
  console.log(`hurt ${amount.toFixed(0)} t=${run.time.toFixed(1)} at (${run.player.x.toFixed(0)},${run.player.y.toFixed(0)}) hazards=${near.join('|')} active=${run.hazards.length}`);
});
run.start();
for (let i = 0; i < 60 * 60 * 6; i++) {
  if (run.state === 'levelup') { bot.chooseOffer(); continue; }
  const input = bot.update(1/60);
  run.step(1/60, input);
  if (run.state === 'dead') break;
}
