// Renders a live fight (renderer + presentation + actors) to a PNG so the world
// layer can be judged without a browser. Usage: node tools/render-scene.mjs [night]
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
globalThis.document = { createElement: () => createCanvas(1, 1) };

GlobalFonts.registerFromPath('node_modules/@fontsource/lora/files/lora-latin-600-normal.woff', 'Lora');
GlobalFonts.registerFromPath('node_modules/@fontsource/lora/files/lora-latin-700-normal.woff', 'Lora');
for (const w of [400, 500, 600, 700]) {
  GlobalFonts.registerFromPath(`node_modules/@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-${w}-normal.woff`, 'Be Vietnam Pro');
  GlobalFonts.registerFromPath(`node_modules/@fontsource/be-vietnam-pro/files/be-vietnam-pro-vietnamese-${w}-normal.woff`, 'Be Vietnam Pro');
}

const { Renderer } = await import('../src/art/renderer.js');
const { Presentation } = await import('../src/systems/presentation.js');
const { Camera } = await import('../src/core/camera.js');
const { Run, ARENA } = await import('../src/systems/run.js');
const { BotBrain } = await import('../src/systems/bot.js');
const { setIconRenderer } = await import('../src/ui/theme.js');
const { drawIcon } = await import('../src/art/icons.js');
setIconRenderer(drawIcon);

const shots = Number(process.argv[2] || 3);
const W = 1180, H = 660;

const canvas = createCanvas(W, H);
canvas.style = {};
const renderer = new Renderer(canvas);
renderer.resize(W, H, 1);
const camera = new Camera();

const run = new Run({ catId: 'tabby', skills: ['claw_slash', 'pounce', 'whirling_claws', 'nine_lives'], perks: { claws: 2 }, seed: 11 });
const pres = new Presentation(run, { camera, settings: { shake: 0, damageNumbers: true, reduceMotion: true } });
const bot = new BotBrain(run);
run.bot = bot;
run.start();
run.state = 'fight';
run.stateTimer = 0;

// Let the sim produce a real mid-fight moment.
const dt = 1 / 60;
let t = 0;
for (let step = 0; step < 60 * 26; step++) {
  const input = bot.update(dt);
  run.update(dt, input);
  pres.update(dt);
  camera.update(dt, t, { x: run.player.x, y: run.player.y - 60, worldW: 1180, worldH: 660 }, 1180, 660);
  t += dt;
  if (run.state === 'levelup') run.chooseOffer(0);
  if (run.state === 'reward') run.chooseReward(0);
  if (run.state === 'dead' || run.state === 'victory') break;
}

console.log('night', run.night, 'wave', run.wave, 'state', run.state,
  'enemies', run.enemies.length, 'hp', Math.round(run.hp), 'particles', pres.particles?.count ?? pres.particles?.pool?.length);

renderer.fitArena(camera);
renderer.begin();
try {
  renderer.drawWorld(run, pres, camera, t, { quality: 'high' });
} catch (err) {
  console.error('DRAW FAIL\n' + err.stack);
  process.exitCode = 1;
}
writeFileSync(`public/art-check/scene-${shots}.png`, canvas.toBuffer('image/png'));
console.log('wrote scene-' + shots + '.png');
void ARENA;
