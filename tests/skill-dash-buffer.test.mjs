import test from 'node:test';
import assert from 'node:assert/strict';
import { Run, RUN_STATE, PLAY } from '../src/systems/run.js';
import { addTrainingDummy } from './harness.mjs';

function setup(skills){const r=new Run({catId:'tabby',skills,seed:41});r.state=RUN_STATE.FIGHT;r.waveEnemiesLeft=999;
  r.player.x=600;r.player.y=380;r.player.invuln=999;r.stats.crit=0;return r;}
function foe(r,dx=60){const e=addTrainingDummy(r,dx);e.hp=e.hpMax=100000;e.speed=0;e.attackCd=999;return e;}
function tick(r,seconds,dt=1/60,input={}){for(let t=0;t+1e-9<seconds;t+=dt)r.step(dt,input);}
function near(a,b,eps=1e-6){assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);}

test('different dashes no longer override each other: inputs queue and both travel in order',()=>{
  for(const skills of [['pounce','double_leap'],['double_leap','pounce']]){
    const r=setup(skills),casts=[];const start=r.player.x;r.on('skill:cast',({id})=>casts.push(id));
    assert.ok(r.castSlot(0).ok);assert.deepEqual(r.castSlot(1),{ok:true,queued:true});
    assert.equal(r.slots[1].reserved,1);tick(r,.75);assert.deepEqual(casts,skills);assert.equal(r.skillQueue.length,0);
    assert.equal(r.slots[1].reserved,0);assert.equal(r.dashQueue.length,0);
    const potency=r.skillPotency(r.slots[0].def);near(r.player.x-start,(170+150)*.85*potency);
  }
});

test('echoed dashes travel sequentially from the preceding endpoint, independent of timestep',()=>{
  for(const dt of [1/60,.08]){
    const r=setup(['pounce']);r.mods.echo=1;const x=r.player.x;r.castSlot(0);assert.equal(r.dashQueue.length,2);
    tick(r,.5,dt);near(r.player.x-x,2*170*.85*r.skillPotency(r.slots[0].def));assert.equal(r.dashQueue.length,0);
  }
});

test('echoed dashes sweep their own paths without duplicate hits within a single dash',()=>{
  const r=setup(['pounce']);r.mods.echo=1;const a=foe(r,95),b=foe(r,245);a.stun=b.stun=3;
  const hits=[];r.on('fx:hit',({enemy})=>hits.push(enemy.uid));r.castSlot(0);tick(r,.5);
  assert.ok(a.hp<a.hpMax&&b.hp<b.hpMax);assert.ok(hits.filter(uid=>uid===a.uid).length<=2);
  assert.equal(hits.filter(uid=>uid===b.uid).length,1);
});

test('queued follow-up pauses during a paused dash and is refunded on entering rewards',()=>{
  const r=setup(['pounce','double_leap']);r.energy=80;r.castSlot(0);const after=r.energy;
  assert.deepEqual(r.castSlot(1),{ok:true,queued:true});const position=r.player.x;
  r.paused=true;tick(r,.5);assert.equal(r.player.x,position);assert.equal(r.skillQueue.length,1);r.paused=false;
  r.setState(RUN_STATE.REWARD);assert.equal(r.energy,after);assert.equal(r.slots[1].reserved,0);assert.equal(r.slots[1].charges,2);
  assert.equal(r.skillQueue.length,0);assert.equal(r.dashQueue.length,0);assert.equal(r.player.dashTime,0);
  r.setState(RUN_STATE.FIGHT);tick(r,.5);assert.equal(r.player.x,position);
});

test('queued non-dash skills wait until the active pounce finishes',()=>{
  const r=setup(['pounce','claw_slash']);foe(r,200);const casts=[];r.on('skill:cast',({id})=>casts.push(id));
  r.castSlot(0);assert.deepEqual(r.castSlot(1),{ok:true,queued:true});tick(r,.1);assert.deepEqual(casts,['pounce']);
  tick(r,.2);assert.deepEqual(casts,['pounce','claw_slash']);
});

test('queued echo dash respects arena boundaries and does not accumulate bot manoeuvres',()=>{
  const r=setup(['pounce']);r.player.x=PLAY.right-100;r.mods.echo=1;r.castSlot(0);
  for(let i=0;i<10;i++)r.dashTo(r.player,1,0,r.player.x+300,r.player.y);
  assert.equal(r.dashQueue.length,2);tick(r,.6);assert.equal(r.player.x,PLAY.right);assert.equal(r.dashQueue.length,0);
});

test('phantom destination appears immediately, stays fixed while moving, and resolves after one second',()=>{
  const r=setup(['phantom_step']);const origin=r.player.x;r.player.held={x:1,y:0};r.castSlot(0);
  assert.ok(r.phantomStep);const dest=r.phantomStep.x;tick(r,.4,1/60,{moveX:-1});assert.ok(r.player.x<origin);
  assert.equal(r.phantomStep.x,dest);tick(r,.65);assert.equal(r.phantomStep,null);near(r.player.x,dest,5);
});

test('phantom step ranks apply cooldown, stronger decoy burst and post-teleport invulnerability',()=>{
  const results=[];for(const rank of [1,2,3,4,5]){
    const r=setup(['phantom_step']);r.slots[0].rank=rank;const e=foe(r,40);r.player.invuln=0;
    r.castSlot(0);assert.ok(r.phantomStep);r.updatePhantomStep(1);
    results.push(e.hpMax-e.hp);near(r.player.invuln,rank>=4?.8:.28);
    if(rank>=3) assert.ok(r.slots[0].rechargeDuration<5.5);else assert.ok(r.slots[0].rechargeDuration>=5.5);
  }
  assert.equal(results[0],0);assert.ok(results[1]>0);near(results[4]/results[1],1/.6);
});

test('blink rank upgrades increase travel, damage landing target and protect the player',()=>{
  const distances=[];for(const rank of [1,2,3,4,5]){
    const r=setup(['blink_paw']);r.slots[0].rank=rank;r.player.invuln=0;const e=foe(r,200),x=r.player.x;
    r.castSlot(0);distances.push(r.player.x-x);assert.equal(e.hp<e.hpMax,rank>=3);
    near(r.player.invuln,rank>=5?.6:.2);
  }
  assert.ok(distances[1]>distances[0]);near(distances[2],distances[1]);
});

test('blink and phantom keep immediate mobility/telegraph but buffer the next skill',()=>{
  for(const id of ['blink_paw','phantom_step']){
    const r=setup([id,'claw_slash']);foe(r,70);const events=[];r.on('skill:cast',({id})=>events.push(id));
    const x=r.player.x;r.castSlot(0);if(id==='blink_paw')assert.ok(r.player.x>x);else assert.ok(r.phantomStep);
    assert.deepEqual(r.castSlot(1),{ok:true,queued:true});tick(r,.4);assert.deepEqual(events,[id,'claw_slash']);
  }
});


test('blink landing explosion is visibly signalled only after its rank upgrade and faces the chosen direction',()=>{
  for(const rank of [2,3]){
    const r=setup(['blink_paw']);r.slots[0].rank=rank;r.player.held={x:-1,y:0};r.player.facing=1;
    let nova; r.on('fx:nova',event=>{nova=event;});const x=r.player.x;r.castSlot(0);
    assert.ok(r.player.x<x);assert.equal(r.player.facing,-1);assert.equal(!!nova,rank===3);
    if(nova){near(nova.x,r.player.x);near(nova.y,r.player.y);assert.ok(nova.radius>0);}
  }
});
