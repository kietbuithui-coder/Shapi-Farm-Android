import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { Run, RUN_STATE, PLAY } from '../src/systems/run.js';
import { drawEnemyActor } from '../src/art/actors.js';
import { addTrainingDummy } from './harness.mjs';

function setup(id, rank = 1) {
  const r = new Run({ catId:'tabby', skills:[id], seed:26 });
  r.state = RUN_STATE.FIGHT; r.waveEnemiesLeft = 999; r.player.x = 785; r.player.y = 380;
  r.player.invuln = 999; r.slots[0].rank = rank; r.stats.crit = 0; return r;
}
function enemy(r, dx=70, dy=0) {
  const e = addTrainingDummy(r, dx); e.y += dy; e.hp = e.hpMax = 100000; e.speed=0; e.attackCd=999; return e;
}
function tick(r, n) { for(let i=0;i<n;i++) r.step(1/60,{}); }
function release(r) { r.time += 0.14; r.updatePassiveEffects(0); }

test('banana trips with stun instead of root, respecting elite and boss control limits', () => {
  for(const kind of ['normal','elite','mini','boss']) {
    const r = setup('banana_peel',2), e=enemy(r);
    if(kind!=='normal') e[kind]=true;
    r.castSlot(0); const tr=r.traps[0]; e.x=tr.x; e.y=tr.y;
    r.updateZones(0.01); assert.ok(e.stun>0); assert.equal(e.root,0); assert.ok(e.hp<e.hpMax);
    if(kind==='elite') assert.ok(e.stun < 1.3);
    if(kind==='mini') assert.ok(e.stun <= 0.45);
    if(kind==='boss') assert.ok(e.stun <= 0.3);
    assert.equal(r.traps.length,0);
  }
});

test('moonlit traps are placed predictably ahead, separated at rank three, and clamped', () => {
  const r = setup('moonlit_trap',3); r.player.aim=0; r.castSlot(0); release(r);
  assert.equal(r.traps.length,2); const [a,b]=r.traps;
  assert.ok(a.x>r.player.x && b.x>r.player.x);
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y) >= 2*a.radius, 'traps do not overlap on open ground');
  const edge=setup('moonlit_trap',3); edge.player.x=PLAY.right; edge.player.y=PLAY.bottom; edge.player.aim=0; edge.castSlot(0); release(edge);
  assert.ok(edge.traps.every(tr => tr.x>=PLAY.left && tr.x<=PLAY.right && tr.y>=PLAY.top && tr.y<=PLAY.bottom));
});

test('moonlit trap roots and tracks its target for three seconds without marking damage', () => {
  const r=setup('moonlit_trap',5), e=enemy(r); r.castSlot(0); release(r); const tr=r.traps[0];
  e.x=tr.x; e.y=tr.y; const hp=e.hp; r.updateZones(0.01);
  assert.ok(e.root>1); assert.equal(e.revealTime,3); assert.equal(e.mark||0,0); assert.ok(e.hp<hp);
  r.updateEnemies(2.9); assert.ok(e.revealTime>0); r.updateEnemies(0.2); assert.equal(e.revealTime,0);
});

test('revealed target reticle follows actor and differs visibly without transient VFX', () => {
  const r=setup('moonlit_trap'), e=enemy(r); e.x=100; e.y=120;
  function frame(reveal) {
    e.revealTime=reveal; const c=createCanvas(220,180),ctx=c.getContext('2d');
    drawEnemyActor(ctx,e,0); return ctx.getImageData(0,0,220,180).data;
  }
  const normal=frame(0), tracked=frame(3); let diff=0;
  for(let i=0;i<normal.length;i++) if(normal[i]!==tracked[i]) diff++;
  assert.ok(diff>200,`reticle changes ${diff} image components`);
});

test('expired traps cannot trigger or accidentally remove another trap', () => {
  const r=setup('banana_peel'), e=enemy(r); r.castSlot(0); const tr=r.traps[0];
  e.x=tr.x;e.y=tr.y;tr.time=0.02;tr.t=0.019;
  const other={...tr,x:tr.x+500,time:10,t:0};r.traps.unshift(other);
  const hp=e.hp; r.updateZones(0.01);
  assert.equal(e.hp,hp); assert.equal(e.stun,0); assert.equal(r.traps.length,1); assert.equal(r.traps[0],other);
});

test('banana stun and lunar root share boss lockout instead of chaining hard control', () => {
  const r=setup('moonlit_trap'),boss=(()=>{r.spawnBoss('moon_devourer');return r.boss;})();
  boss.x=r.player.x+70;boss.y=r.player.y; r.castSlot(0);release(r);const tr=r.traps[0];boss.x=tr.x;boss.y=tr.y;
  r.updateZones(0.01); assert.ok(boss.root>0); boss.stun=0;
  r.traps.push({x:boss.x,y:boss.y,radius:30,root:1.8,time:9,t:0,damage:1,banana:true});
  r.updateZones(0.01); assert.equal(boss.stun,0); assert.ok(boss.controlImmuneUntil>r.time);
});

test('gravity well rank three pull does not secretly amplify its slow', () => {
  const values=[];
  for(const rank of [2,3]) { const r=setup('gravity_well',rank);r.castSlot(0);tick(r,18);values.push(r.zones[0].slow); }
  assert.equal(values[0],values[1]);
});

test('trap and ground casts wind up visibly, preserve movement, and queue follow-up', () => {
  for(const id of ['moonlit_trap','rending_ground']) {
    const r=new Run({catId:'tabby',skills:[id,'claw_slash'],seed:26});
    r.state=RUN_STATE.FIGHT;r.waveEnemiesLeft=999;r.player.x=785;r.player.y=380;r.player.invuln=999;
    enemy(r,250);const casts=[];r.on('skill:cast',({id})=>casts.push(id));const start=r.player.x;
    assert.ok(r.castSlot(0).ok);assert.deepEqual(r.castSlot(1),{ok:true,queued:true});
    for(let i=0;i<3;i++) r.step(1/60,{moveX:1});
    assert.ok(r.player.x>start);assert.equal(r.traps.length+r.zones.length,0);
    tick(r,32);assert.deepEqual(casts,[id,'claw_slash']);assert.equal(r.skillQueue.length,0);
    assert.ok(id==='moonlit_trap'?r.traps.length>0:r.zones.length>0);
  }
});
