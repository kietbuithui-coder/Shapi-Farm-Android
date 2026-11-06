// Renders the two new act bosses inside a REAL arena scene and in both of their
// behaviour phases, so the check catches what a flat sprite sheet cannot: the
// silhouette against the actual floor, whether the health bar and nameplate
// read, and whether phase 2 looks like a different fight rather than a tint.
import { writeFileSync } from 'node:fs';
import { bootGame } from '../tests/dom.mjs';

const { game, step, canvas } = await bootGame();
const shoot = (name) => {
  writeFileSync(`public/art-check/${name}.png`, canvas.toBuffer('image/png'));
  console.log('shot', name);
};

game.go('run', {
  catId: 'tabby',
  skills: ['claw_slash', 'pounce', 'whirling_claws', 'nine_lives'],
  difficulty: 'normal',
});
for (let i = 0; i < 400 && game.scene !== 'run'; i++) step(1);
for (let i = 0; i < 150; i++) step(1);

const run = game.run;
run.enemies.length = 0;
run.pendingSpawns.length = 0;
run.waveEnemiesLeft = 0;

for (const id of ['void_predator', 'crystal_queen']) {
  run.spawnBoss(id);
  const b = run.boss;
  if (!b) { console.log('!! boss did not spawn:', id); continue; }
  b.hp = b.hpMax;
  b.x = run.player.x + 230;
  b.y = run.player.y - 40;
  for (let i = 0; i < 40; i++) step(1);
  shoot(`boss-${id}-phase1`);

  // Force the second phase and let it act, so the shot shows the new behaviour.
  b.phase = 1;
  b.hp = b.hpMax * 0.5;
  for (let i = 0; i < 150; i++) step(1);
  shoot(`boss-${id}-phase2`);

  run.boss = null;
  run.enemies.length = 0;
  run.hazards.length = 0;
  run.zones.length = 0;
  run.projectiles.length = 0;
}

console.log('done');
process.exit(0);
