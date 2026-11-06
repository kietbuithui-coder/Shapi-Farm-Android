import { Run } from '../src/systems/run.js';
import { BotBrain } from '../src/systems/bot.js';
import { CATS } from '../src/data/cats.js';
import { STARTER_SKILLS } from '../src/data/skills.js';
const cat = CATS.find(c => c.id === (process.argv[2] || 'sphynx'));
const skills = [...cat.skills];
for (const id of STARTER_SKILLS) { if (skills.length >= 4) break; if (!skills.includes(id)) skills.push(id); }
const run = new Run({ catId: cat.id, skills, seed: Number(process.argv[3] || 3) });
const bot = new BotBrain(run);
let dmgBy = {};
run.events.on('player:hurt', ({ amount, source }) => {
  const k = source ? source.id : 'hazard';
  dmgBy[k] = (dmgBy[k] || 0) + amount;
});
run.start();
for (let i = 0; i < 60 * 60 * 20; i++) {
  if (run.state === 'levelup') { bot.chooseOffer(); continue; }
  if (run.state === 'reward') { run.chooseReward(0); continue; }
  const input = bot.update(1/60);
  run.step(1/60, input);
  if (run.state === 'dead') break;
}
console.log(cat.id, 'died n'+run.night, 'w'+run.wave, 't', run.time.toFixed(0), 'lvl', run.level);
console.log('damage by source:', Object.fromEntries(Object.entries(dmgBy).map(([k,v])=>[k, Math.round(v)])));
console.log('enemies alive at death:', run.enemies.filter(e=>!e.dead).map(e=>e.id).join(','));
console.log('upgrades:', run.upgradeLevels);
