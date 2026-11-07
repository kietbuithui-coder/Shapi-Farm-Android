import test from 'node:test';
import assert from 'node:assert/strict';
import { Run, RUN_STATE, PLAY } from '../src/systems/run.js';
import { addTrainingDummy } from './harness.mjs';

function setup(skills,ranks=[]){const r=new Run({catId:'tabby',skills,seed:93});r.state=RUN_STATE.FIGHT;r.waveEnemiesLeft=999;
  r.player.x=700;r.player.y=380;r.player.invuln=999;r.stats.crit=0;r.stats.regen=0;
  ranks.forEach((rank,i)=>r.slots[i].rank=rank);return r;}
function enemy(r,dx=60,dy=0){const e=addTrainingDummy(r,dx);e.x=r.player.x+dx;e.y=r.player.y+dy;
  e.hp=e.hpMax=100000;e.speed=0;e.attackCd=999;return e;}
function release(r){r.time+=.11;r.updatePassiveEffects(0);}
function tick(r,seconds,input={}){for(let t=0;t+1e-9<seconds;t+=1/60)r.step(1/60,input);}
function near(a,b,eps=1e-6){assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);}

test('banana ranks increase stun, damage and the number of independent traps',()=>{
  let baseDamage;
  for(const rank of [1,2,3,4,5]){
    const r=setup(['banana_peel'],[rank]);r.castSlot(0);const count=rank>=5?3:rank>=4?2:1;
    assert.equal(r.traps.length,count);const first=r.traps[0];near(first.root,(rank>=2?1.8:1.2)*r.skillPotency(r.slots[0].def));
    near(first.time,9);if(rank===1)baseDamage=first.damage;if(rank>=3)near(first.damage/baseDamage,1.25);
    for(let i=0;i<count;i++)for(let j=i+1;j<count;j++){
      assert.ok(Math.hypot(r.traps[i].x-r.traps[j].x,r.traps[i].y-r.traps[j].y)>2*first.radius);
    }
    const targets=r.traps.map(tr=>{const e=enemy(r);e.x=tr.x;e.y=tr.y;return e;});r.updateZones(.01);
    assert.equal(r.traps.length,0);for(const e of targets){near(e.hpMax-e.hp,first.damage);near(e.stun,first.root);assert.equal(e.root,0);}
  }
});

test('banana peels face a nearby target while idle, but held direction takes priority',()=>{
  for(const side of [-1,1]){
    const r=setup(['banana_peel'],[5]);const e=enemy(r,side*80);r.player.facing=-side;r.castSlot(0);
    assert.equal(r.player.facing,side);assert.ok(r.traps.every(t=>Math.sign(t.x-r.player.x)===side));assert.ok(e.hp===e.hpMax);
  }
  const r=setup(['banana_peel'],[4]);enemy(r,-80);r.player.moving=true;r.player.facing=1;r.castSlot(0);
  assert.equal(r.player.facing,1);assert.ok(r.traps.every(t=>t.x>r.player.x));
});

test('three banana peels remain separate and usable at every arena corner',()=>{
  for(const x of [PLAY.left,PLAY.right])for(const y of [PLAY.top,PLAY.bottom]){
    const r=setup(['banana_peel'],[5]);r.player.x=x;r.player.y=y;r.player.facing=x===PLAY.left?-1:1;r.castSlot(0);
    assert.equal(r.traps.length,3);for(const tr of r.traps){assert.ok(tr.x>=PLAY.left&&tr.x<=PLAY.right);assert.ok(tr.y>=PLAY.top&&tr.y<=PLAY.bottom);}
    for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){
      assert.ok(Math.hypot(r.traps[i].x-r.traps[j].x,r.traps[i].y-r.traps[j].y)>2*r.traps[i].radius,`${x},${y}`);
    }
    const target=enemy(r);target.x=r.traps[0].x;target.y=r.traps[0].y;const hp=target.hp;r.updateZones(.01);
    near(hp-target.hp,r.skillDamage(r.slots[0].def,1.2*1.25));assert.equal(r.traps.length,2);
  }
});

test('banana echo creates separate casts, and expired peels never trigger',()=>{
  const r=setup(['banana_peel'],[4]);r.mods.echo=1;r.castSlot(0);assert.equal(r.traps.length,4);
  for(const tr of r.traps)tr.t=tr.time-.01;const e=enemy(r);e.x=r.traps[0].x;e.y=r.traps[0].y;
  r.updateZones(.02);assert.equal(r.traps.length,0);near(e.hp,e.hpMax);assert.equal(e.stun,0);
});

test('banana stun damages a real boss but obeys boss control lockout',()=>{
  const r=setup(['banana_peel'],[5]);r.spawnBoss('moon_devourer');const b=r.boss;b.x=r.player.x+65;b.y=r.player.y;
  r.castSlot(0);const tr=r.traps[0];b.x=tr.x;b.y=tr.y;const hp=b.hp;r.updateZones(.01);
  assert.ok(b.hp<hp);near(b.stun,.3);b.stun=0;r.applyStatus(b,'root',2);near(b.root,0);
});

test('fish ranks increase the count and damage of actual projectiles while retaining knockback',()=>{
  let baseDamage;
  for(const rank of [1,2,3,4,5]){
    const r=setup(['flying_fish'],[rank]);enemy(r,120);r.castSlot(0);assert.equal(r.projectiles.length,0);release(r);
    assert.equal(r.projectiles.length,rank>=5?3:rank>=3?2:1);assert.ok(r.projectiles.every(p=>p.shape==='fish'&&p.knock===220));
    if(rank===1)baseDamage=r.projectiles[0].damage;
    near(r.projectiles[0].damage,baseDamage*(rank>=4?1.25*1.3:rank>=2?1.25:1));
  }
});

test('fish genuinely strikes diagonal targets on both sides and faces its throw',()=>{
  for(const side of [-1,1])for(const dy of [-95,95]){
    const r=setup(['flying_fish'],[1]),e=enemy(r,side*260,dy);r.player.facing=-side;r.castSlot(0);release(r);
    assert.equal(r.player.facing,side);for(let i=0;i<90&&r.projectiles.length;i++)r.updateProjectiles(1/60);
    assert.ok(e.hp<e.hpMax,`${side},${dy}`);assert.ok(Math.sign(e.knockX)===side);
  }
});

test('both fish of rank three can hit a lone distant target rather than straddling it',()=>{
  for(const side of [-1,1]){
    const r=setup(['flying_fish'],[3]),e=enemy(r,side*300,0);let hits=0;r.on('fx:hit',h=>{if(h.enemy===e)hits++;});
    r.castSlot(0);tick(r,1);assert.equal(hits,2,`side ${side}`);assert.ok(e.hp<e.hpMax);
  }
});

test('fish echo, crit and on-hit effects apply per actual projectile collision',()=>{
  const r=setup(['flying_fish'],[1]),e=enemy(r,80);r.mods.echo=1;r.mods.slowOnHit=.25;r.forceCrit=true;
  const hits=[];r.on('fx:hit',h=>{if(h.enemy===e)hits.push(h);});r.castSlot(0);release(r);assert.equal(r.projectiles.length,2);
  for(let i=0;i<60&&r.projectiles.length;i++)r.updateProjectiles(1/60);
  assert.equal(hits.length,2);assert.equal(hits.filter(x=>x.crit).length,1);assert.equal(r.forceCrit,false);
  assert.equal(r.attackCounter,2);near(e.slow,.25);
});

test('fish hits an actual boss without knocking it away',()=>{
  const r=setup(['flying_fish'],[5]);r.spawnBoss('moon_devourer');const b=r.boss;b.x=r.player.x+130;b.y=r.player.y;const x=b.x,hp=b.hp;
  r.castSlot(0);release(r);for(let i=0;i<40&&r.projectiles.length;i++)r.updateProjectiles(1/60);
  assert.ok(b.hp<hp);near(b.x,x);assert.equal(b.knockT||0,0);
});

test('banana throws immediately and fish winds up, both allow movement and queue follow-ups',()=>{
  for(const id of ['banana_peel','flying_fish']){
    const r=setup([id,'claw_slash']);enemy(r,140);const casts=[];r.on('skill:cast',({id})=>casts.push(id));r.castSlot(0);
    assert.equal(r.traps.length,id==='banana_peel'?1:0);assert.equal(r.projectiles.length,0);
    assert.deepEqual(r.castSlot(1),{ok:true,queued:true});const x=r.player.x;tick(r,.05,{moveX:1});
    assert.ok(r.player.x>x);if(id==='flying_fish')assert.equal(r.projectiles.length,0);
    tick(r,.6);assert.deepEqual(casts,[id,'claw_slash']);assert.equal(r.skillQueue.length,0);
  }
});
