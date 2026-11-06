// Headless render of every menu screen + HUD so UI art can be reviewed as PNGs.
// Uses @napi-rs/canvas with a DOM shim; no browser required.
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'node:fs';

globalThis.document = {
  createElement: (tag) => {
    if (tag !== 'canvas') throw new Error('only canvas');
    return createCanvas(1, 1);
  },
};

const FONT_DIR = 'node_modules/@fontsource';
GlobalFonts.registerFromPath(`${FONT_DIR}/lora/files/lora-latin-400-normal.woff`, 'Lora');
GlobalFonts.registerFromPath(`${FONT_DIR}/lora/files/lora-latin-600-normal.woff`, 'Lora');
GlobalFonts.registerFromPath(`${FONT_DIR}/lora/files/lora-latin-700-normal.woff`, 'Lora');
for (const w of [400, 500, 600, 700]) {
  GlobalFonts.registerFromPath(`${FONT_DIR}/be-vietnam-pro/files/be-vietnam-pro-latin-${w}-normal.woff`, 'Be Vietnam Pro');
  GlobalFonts.registerFromPath(`${FONT_DIR}/be-vietnam-pro/files/be-vietnam-pro-vietnamese-${w}-normal.woff`, 'Be Vietnam Pro');
}

const { setIconRenderer } = await import('../src/ui/theme.js');
const { drawIcon } = await import('../src/art/icons.js');
setIconRenderer(drawIcon);

const S = await import('../src/ui/scenes.js');
const { Hud } = await import('../src/ui/hud.js');
const { defaultProfile } = await import('../src/core/save.js');
const { CATS } = await import('../src/data/cats.js');
const { STARTER_SKILLS, SKILLS } = await import('../src/data/skills.js');

const W = 1440;
const H = 810;
const safe = { top: 0, bottom: 0, left: 0, right: 0 };
const lang = process.argv[2] === 'en' ? 'en' : 'vi';

const profile = defaultProfile();
profile.embers = 640;
profile.stats.bestDepth = 6;
profile.stats.kills = 412;
profile.stats.runs = 9;
profile.stats.wins = 1;
profile.loadout.cat = 'tabby';
profile.cats.bengal = { unlocked: true };
profile.skills.whirling_claws = { unlocked: true };
profile.upgrades = { claws: 2, heart: 1 };
profile.achievements = { first_pounce: true, hundred: true, boss_break: true };

const scenes = [
  ['home', (ctx) => S.drawHome(ctx, { w: W, h: H, safe, t: 2.2, lang, profile, hover: 'play' })],
  ['cats', (ctx) => S.drawCatSelect(ctx, { w: W, h: H, safe, t: 2.2, lang, profile, hover: 'cat:bengal', selected: 'bengal' })],
  ['skills', (ctx) => S.drawSkillSelect(ctx, { w: W, h: H, safe, t: 2.2, lang, profile, hover: 'skill:whirling_claws', selectedSkills: ['claw_slash', 'pounce', 'whirling_claws', 'nine_lives'] })],
  ['upgrades', (ctx) => S.drawUpgrades(ctx, { w: W, h: H, safe, t: 2.2, lang, profile, hover: 'perk:claws' })],
  ['collection', (ctx) => S.drawCollection(ctx, { w: W, h: H, safe, t: 2.2, lang, profile, hover: null })],
  ['settings', (ctx) => S.drawSettings(ctx, { w: W, h: H, safe, t: 2.2, lang, profile, hover: 'music' })],
  ['results', (ctx) => S.drawResults(ctx, { w: W, h: H, safe, t: 2.2, lang, hover: 'again', victory: false, summary: { night: 4, level: 12, kills: 143, time: 512, embers: 22, gold: 96, depth: 18, newBest: true } })],
  ['setup', (ctx) => S.drawRunSetup(ctx, { w: W, h: H, safe, t: 2.2, lang, hover: 'go', difficulty: 'normal', botMode: true, catId: 'tabby', skills: ['claw_slash', 'pounce', 'whirling_claws', 'nine_lives'] })],
  ['levelup', (ctx) => S.drawLevelUp(ctx, {
    w: W, h: H, safe, t: 1.4, lang, hover: 'offer:1', level: 7,
    offers: [
      { type: 'skillup', skillId: 'whirling_claws', slot: 2, rank: 3, id: 'skillup:whirling_claws' },
      { id: 'keen_edge', name: { vi: 'Lưỡi Sắc', en: 'Keen Edge' }, desc: { vi: '+14% sát thương đòn đánh.', en: '+14% attack damage.' }, rarity: 'common', glyph: 'claw' },
      { id: 'blood_moon', name: { vi: 'Trăng Máu', en: 'Blood Moon' }, desc: { vi: 'Mỗi đòn chí mạng hồi 2 máu.', en: 'Every crit heals 2 health.' }, rarity: 'epic', glyph: 'bloodmoon', max: 4, level: 1 },
    ],
  })],
];

mkdirSync('public/art-check', { recursive: true });
for (const [name, fn] of scenes) {
  const cv = createCanvas(W, H);
  const ctx = cv.getContext('2d');
  try {
    fn(ctx);
  } catch (err) {
    console.error(`FAIL ${name}: ${err.stack.split('\n').slice(0, 4).join('\n')}`);
    process.exitCode = 1;
    continue;
  }
  writeFileSync(`public/art-check/ui-${name}${lang === 'en' ? '-en' : ''}.png`, cv.toBuffer('image/png'));
  console.log(`ok ${name}`);
}

// HUD needs a live run.
const { Run } = await import('../src/systems/run.js');
const run = new Run({ catId: 'tabby', skills: ['claw_slash', 'pounce', 'whirling_claws', 'nine_lives'], perks: { claws: 2 }, seed: 7 });
run.start();
// Render the HUD at the game's own logical resolution (960x540) and upscale,
// so on-screen proportions match what players see.
const GW = 960, GH = 540;
const hud = new Hud();
hud.layout(GW, GH, safe, false);
run.hp = run.stats.hpMax * 0.62;
run.player.shield = 12;
run.xp = Math.round(run.xpNeed * 0.55);
run.combo = 17;
run.comboTimer = 1.2;
run.energy = run.stats.energyMax * 0.7;
run.slots[1].cd = 2.4;
run.slots[2].cd = 0;
hud.update(0.016, run);
hud.showAnnounce('ĐÊM 2', 'Vườn Trăng Tàn', '#ffe8a8', 2);
const gcv = createCanvas(GW, GH);
const gctx = gcv.getContext('2d');
const grd = gctx.createLinearGradient(0, 0, 0, GH);
grd.addColorStop(0, '#101a33');
grd.addColorStop(1, '#070a15');
gctx.fillStyle = grd;
gctx.fillRect(0, 0, GW, GH);
try {
  hud.draw(gctx, run, lang, { t: 2.2, showNight: true, showBot: true, botOn: true });
  const cv = createCanvas(W, H);
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(gcv, 0, 0, W, H);
  writeFileSync(`public/art-check/ui-hud${lang === 'en' ? '-en' : ''}.png`, cv.toBuffer('image/png'));
  console.log('ok hud');
} catch (err) {
  console.error('FAIL hud: ' + err.stack.split('\n').slice(0, 5).join('\n'));
  process.exitCode = 1;
}
void CATS; void STARTER_SKILLS; void SKILLS;
