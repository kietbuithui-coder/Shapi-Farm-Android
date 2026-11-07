import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { Run, RUN_STATE } from '../src/systems/run.js';
import { drawLevelUp } from '../src/ui/scenes.js';
import { addTrainingDummy } from './harness.mjs';

function setup() {
  const r = new Run({ catId:'tabby', skills:['fireball'], seed:19 });
  r.state = RUN_STATE.FIGHT; r.waveEnemiesLeft = 999; r.player.x = 785; r.player.y = 380;
  r.player.invuln = 999; r.stats.crit = 0; return r;
}
function enemy(r, x, y = 380) {
  const e = addTrainingDummy(r, 0); e.x = x; e.y = y; e.speed = 0; e.attackCd = 999;
  e.hp = e.hpMax = 100000; return e;
}
function offers(r) {
  r.slots[0].rank = 2;
  for (let i=0; i<200; i++) {
    const picks = r.rollOffers(); if (picks.some(o => o.branch)) return picks;
  }
  assert.fail('fork never appeared');
}
function tick(r, n) { for(let i=0; i<n; i++) r.step(1/60, {}); }
function release(r) { r.time += 0.12; r.updatePassiveEffects(0); }

test('rank three offers both fireball forks, validates them, and preserves the chosen branch', () => {
  for (const branch of ['explosive','piercing']) {
    const r = setup(), picks = offers(r); const opts = picks.filter(o => o.type === 'skillup');
    assert.deepEqual(opts.map(o => o.branch), ['explosive','piercing']);
    assert.equal(picks.length, 3);
    r.offers = [{ type:'skillup', skillId:'fireball', slot:0, rank:3, branch:'invalid' }];
    assert.equal(r.chooseOffer(0), false); assert.equal(r.slots[0].rank, 2);
    r.offers = picks; const index = picks.findIndex(o => o.branch === branch);
    assert.equal(r.chooseOffer(index), true); assert.equal(r.slots[0].rank, 3); assert.equal(r.slots[0].branch, branch);
    r.offers = [{ type:'skillup', skillId:'fireball', slot:0, rank:4, id:'skillup:fireball' }];
    assert.equal(r.chooseOffer(0), true); assert.equal(r.slots[0].branch, branch);
  }
});

test('explosive branch expands rank two blast radius by forty percent', () => {
  const radii = [];
  for (const branch of [null, 'explosive']) {
    const r = setup(); r.slots[0].rank = 3; r.slots[0].branch = branch; r.castSlot(0); release(r);
    radii.push(r.projectiles[0].explode);
  }
  assert.ok(Math.abs(radii[1] / radii[0] - 1.4) < 1e-9);
});

test('piercing branch hits three foes before exploding on a fourth', () => {
  const r = setup(); r.slots[0].rank = 3; r.slots[0].branch = 'piercing';
  const foes = [80,150,220,290].map(dx => enemy(r, r.player.x + dx));
  let bursts = 0; r.on('fx:blast', () => bursts++); r.castSlot(0); release(r);
  const pr = r.projectiles[0];
  for (const e of foes) e.y = pr.y + Math.tan(pr.angle) * 0.72 * (e.x - pr.x) + 12;
  tick(r, 22);
  assert.ok(foes[0].hp < foes[0].hpMax && foes[1].hp < foes[1].hpMax);
  assert.equal(bursts, 0, 'no early burst'); tick(r, 60);
  assert.ok(foes.every(e => e.hp < e.hpMax)); assert.equal(bursts, 1); assert.equal(r.projectiles.length, 0);
});

test('both branch cards display their distinct names and effects on the actual level-up UI', () => {
  const r = setup(), picks = offers(r); const canvas = createCanvas(960, 540), ctx = canvas.getContext('2d');
  const seen = []; const fill = ctx.fillText.bind(ctx); ctx.fillText = (text, ...args) => { seen.push(text); fill(text, ...args); };
  const rects = drawLevelUp(ctx, { w:960, h:540, safe:{left:0,right:0,top:0,bottom:0}, t:0, lang:'vi', offers:picks, hover:null, level:3 });
  assert.equal(rects.length, 3); assert.ok(seen.some(t => t.includes('Nổ Tung'))); assert.ok(seen.some(t => t.includes('Xuyên Phá')));
  assert.ok(seen.some(t => t.includes('40%'))); assert.ok(seen.some(t => t.includes('3 mục tiêu')));
});

test('fork selection works through the game level-up overlay on a phone-sized screen', async () => {
  const { bootGame } = await import('./dom.mjs');
  const { game, step, click, rects } = await bootGame({ width:840, height:380 });
  step(3); game.go('run', { catId:'tabby', skills:['fireball'], seed:19 });
  for (let i=0; i<200 && game.scene !== 'run'; i++) step(1);
  const r = game.run; const picks = offers(r); r.offers = picks; r.pendingLevelUps = 1;
  r.setState(RUN_STATE.LEVELUP); step(2); assert.equal(game.overlay, 'levelup');
  const index = picks.findIndex(o => o.branch === 'piercing');
  assert.ok(rects().some(item => item.id === `offer:${index}`));
  assert.ok(click(`offer:${index}`)); assert.equal(r.slots[0].branch, 'piercing'); assert.equal(r.slots[0].rank, 3);
  assert.equal(r.state, RUN_STATE.FIGHT); r.castSlot(0); tick(r, 10);
  assert.ok(r.projectiles.some(p => p.pierce === 3));
});

test('piercing fireball expires in one explosion even if it hits no enemy', () => {
  const r = setup(); r.slots[0].rank = 3; r.slots[0].branch = 'piercing'; let bursts = 0;
  r.on('fx:blast', () => bursts++); r.castSlot(0); tick(r, 180);
  assert.equal(bursts, 1); assert.equal(r.projectiles.length, 0);
});

test('piercing branch can pass through a real boss without consuming the projectile early', () => {
  const r = setup(); r.spawnBoss('moon_devourer'); const boss = r.boss;
  boss.x = r.player.x + 80; boss.y = r.player.y; boss.attackTimer = 999;
  r.slots[0].rank = 3; r.slots[0].branch = 'piercing'; r.castSlot(0); release(r);
  const pr = r.projectiles[0]; boss.y = pr.y + Math.tan(pr.angle) * 0.72 * (boss.x - pr.x) + 12;
  const hp = boss.hp; let bursts = 0; r.on('fx:blast', () => bursts++);
  for(let i=0; i<24; i++) r.updateProjectiles(1/60);
  assert.ok(boss.hp < hp); assert.ok(r.projectiles.includes(pr)); assert.equal(bursts, 0);
});

test('compact branch cards leave description clear of the rank and rarity rows', () => {
  const r = setup(), picks = offers(r), canvas = createCanvas(840, 380), ctx = canvas.getContext('2d');
  const seen = [], draw = ctx.fillText.bind(ctx);
  ctx.fillText = (text, x, y, ...args) => { seen.push({text, x, y}); draw(text, x, y, ...args); };
  const rects = drawLevelUp(ctx, { w:840, h:380, safe:{left:0,right:0,top:0,bottom:0}, t:0, lang:'vi', offers:picks, hover:null, level:3 });
  for (const rect of rects.slice(0,2)) {
    const description = seen.filter(a => Math.abs(a.x - (rect.x + 18)) < 0.01);
    const rank = seen.find(a => Math.abs(a.x - (rect.x + rect.w/2)) < 0.01 && a.text.includes('1 → 2/4'));
    assert.ok(description.length >= 1 && rank);
    assert.ok(Math.max(...description.map(a => a.y)) < rank.y - 9, 'body must not collide with rank row');
  }
});

test('fireball windup remains responsive with a buffered follow-up', () => {
  const r = new Run({ catId:'tabby', skills:['fireball','claw_slash'], seed:19 });
  r.state = RUN_STATE.FIGHT; r.waveEnemiesLeft = 999; r.player.x = 785; r.player.y = 380; r.player.invuln = 999;
  enemy(r, r.player.x + 450);
  const casts = []; r.on('skill:cast', e => casts.push(e.id)); const start = r.player.x;
  r.castSlot(0); assert.deepEqual(r.castSlot(1), { ok:true, queued:true });
  for(let i=0; i<3; i++) r.step(1/60, { moveX:1 });
  assert.ok(r.player.x > start); assert.equal(r.projectiles.length, 0);
  tick(r, 40); assert.deepEqual(casts, ['fireball','claw_slash']);
  assert.ok(r.projectiles.length > 0);
});
