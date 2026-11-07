import test from 'node:test';
import assert from 'node:assert/strict';
import { Run, RUN_STATE } from '../src/systems/run.js';
import { addTrainingDummy } from './harness.mjs';

function setup(skills,ranks=[]){const r=new Run({catId:'tabby',skills,seed:53});r.state=RUN_STATE.FIGHT;r.waveEnemiesLeft=999;
  r.player.x=700;r.player.y=380;r.player.invuln=0;r.stats.crit=0;r.stats.regen=0;r.stats.dodge=0;
  ranks.forEach((rank,i)=>r.slots[i].rank=rank);return r;}
function foe(r,dx=60,dy=0){const e=addTrainingDummy(r,dx);e.y+=dy;e.hp=e.hpMax=100000;e.speed=0;e.attackCd=999;return e;}
function tick(r,s,dt=1/60,input={}){for(let t=0;t+1e-9<s;t+=dt)r.step(dt,input);}
function jobs(r,t){r.time=t;r.updatePassiveEffects(0);}
function near(a,b,eps=1e-6){assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);}

test('claw slash gains real damage, reach, and bleed at the advertised ranks',()=>{
  const amounts=[];
  for(const rank of [1,2,3,4,5]){
    const r=setup(['claw_slash'],[rank]),e=foe(r,60);let hit;r.on('fx:hit',x=>{if(x.enemy===e)hit=x;});r.castSlot(0);
    assert.ok(hit);amounts.push(hit.amount);assert.equal(e.bleedTime>0,rank>=5);
    if(rank===5){near(e.bleedTime,3);assert.ok(e.bleed>0);}
  }
  near(amounts[1]/amounts[0],1.15);near(amounts[3]/amounts[2],1.2);
  for(const rank of [2,3]){const r=setup(['claw_slash'],[rank]);const e=foe(r,110);r.castSlot(0);assert.equal(e.hp<e.hpMax,rank===3);}
});

test('combo rank damage and number of hits work on multiple targets, with on-hit per target',()=>{
  const hitsByRank=[],single=[];
  for(const rank of [1,2,3,4,5]){
    const r=setup(['triple_scratch'],[rank]);const a=foe(r,60),b=foe(r,-60);r.mods.slowOnHit=.25;
    const hits=[];r.on('fx:hit',h=>hits.push(h));r.castSlot(0);
    for(const t of [0,.121,.241,.361,.5])jobs(r,t);
    const ahits=hits.filter(h=>h.enemy===a),bhits=hits.filter(h=>h.enemy===b);
    assert.equal(ahits.length,rank>=4?4:3);assert.equal(bhits.length,ahits.length);
    assert.equal(r.attackCounter,ahits.length*2);near(a.slow,.25);near(b.slow,.25);
    hitsByRank.push(ahits.length);single.push(ahits[0].amount);
  }
  assert.deepEqual(hitsByRank,[3,3,3,4,4]);near(single[1]/single[0],1.2);
});

test('combo rank three knocks only on its last sweep, with the rank four fourth sweep respected',()=>{
  for(const rank of [2,3,4]){
    const r=setup(['triple_scratch'],[rank]),e=foe(r,60);r.castSlot(0);
    const count=rank>=4?4:3;
    for(let i=0;i<count;i++){
      jobs(r,i*.12+.001);assert.equal(e.knockT>0,rank>=3&&i===count-1,`rank ${rank} swipe ${i}`);
      e.knockT=0;e.knockX=0;e.knockY=0;
    }
  }
});

test('combo rank five refunds energy once per successful sweep, not once per target or on a miss',()=>{
  for(const number of [0,1,3]){
    const r=setup(['triple_scratch'],[5]);r.energy=40;for(let i=0;i<number;i++)foe(r,60,i*10);
    r.castSlot(0);for(const t of [0,.121,.241,.361])jobs(r,t);
    near(r.energy,28+(number?16:0));
  }
  const echo=setup(['triple_scratch'],[5]);echo.energy=40;foe(echo);echo.mods.echo=1;echo.castSlot(0);
  for(const t of [0,.121,.241,.361])jobs(echo,t);near(echo.energy,60);
});

test('pounce upgrades damage, distance, and stuns through real dash collision',()=>{
  let baseDamage;
  for(const rank of [1,2,3,4,5]){
    const r=setup(['pounce'],[rank]),e=foe(r,80),x=r.player.x;let hits=0;r.on('fx:hit',h=>{if(h.enemy===e)hits++;});
    r.castSlot(0);assert.ok(r.player.invuln>=.35);r.updateDash(.2);
    assert.equal(hits,1);assert.ok(e.knockX>0);assert.equal(e.stun>0,rank>=4);
    if(rank>=4)near(e.stun,.5*r.skillPotency(r.slots[0].def));
    near(r.player.x-x,(rank>=3?210:170)*.85*r.skillPotency(r.slots[0].def));
    if(rank===1)baseDamage=e.hpMax-e.hp;if(rank===2)near((e.hpMax-e.hp)/baseDamage,1.25);
  }
});

test('pounce rank three targets enemies inside upgraded targeting range, including left-facing aim',()=>{
  for(const rank of [2,3]){
    const r=setup(['pounce'],[rank]);r.stats.move=420;r.player.facing=1;const e=foe(r,-280);const x=r.player.x;
    r.castSlot(0);r.updateDash(.2);assert.equal(r.player.x<x,rank===3);assert.equal(e.hp<e.hpMax,rank===3);
  }
});

test('pounce stuns an actual boss with resistance and does not knock it back',()=>{
  const r=setup(['pounce'],[4]);r.spawnBoss('moon_devourer');const b=r.boss;b.x=r.player.x+80;b.y=r.player.y;
  const x=b.x,hp=b.hp;r.castSlot(0);r.updateDash(.2);assert.ok(b.hp<hp);near(b.stun,.3);near(b.x,x);assert.equal(b.knockT||0,0);
});

test('combo recovery buffers the next action while movement and timed hits continue',()=>{
  const r=setup(['triple_scratch','claw_slash'],[4,1]);const e=foe(r,60);const casts=[],hits=[];
  r.on('skill:cast',({id})=>casts.push(id));r.on('fx:hit',h=>hits.push(h));r.castSlot(0);
  assert.deepEqual(r.castSlot(1),{ok:true,queued:true});const x=r.player.x;tick(r,.3,1/60,{moveX:1});
  assert.ok(r.player.x>x);assert.deepEqual(casts,['triple_scratch']);assert.ok(hits.length>=3);
  tick(r,.25);assert.deepEqual(casts,['triple_scratch','claw_slash']);assert.ok(e.hp<e.hpMax);
});

test('pounce still travels immediately, buffers its follow-up, and keeps the second charge reserved',()=>{
  const r=setup(['pounce'],[4]);r.offers=[{type:'skillup',skillId:'pounce',slot:0,rank:5}];assert.ok(r.chooseOffer(0));
  const x=r.player.x;r.castSlot(0);assert.ok(r.player.dashTime>0);assert.deepEqual(r.castSlot(0),{ok:true,queued:true});
  assert.equal(r.slots[0].reserved,1);tick(r,.1);assert.ok(r.player.x>x);assert.equal(r.slots[0].reserved,1);
  tick(r,.6);assert.equal(r.slots[0].reserved,0);assert.equal(r.slots[0].charges,0);assert.ok(r.player.x>x+200);
});
