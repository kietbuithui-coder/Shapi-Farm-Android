import test from 'node:test';
import assert from 'node:assert/strict';
import { Run, RUN_STATE } from '../src/systems/run.js';
import { addTrainingDummy } from './harness.mjs';

function setup(id='thunder_purr', rank=1) {
  const r=new Run({catId:'tabby',skills:[id],seed:61});r.state=RUN_STATE.FIGHT;r.waveEnemiesLeft=999;
  r.player.x=500;r.player.y=380;r.player.invuln=999;r.stats.crit=0;r.slots[0].rank=rank;return r;
}
function foe(r,x,y=r.player.y) {const e=addTrainingDummy(r,0);e.x=x;e.y=y;e.hp=e.hpMax=100000;e.speed=0;e.attackCd=999;return e;}
function release(r){r.time+=.11;r.updatePassiveEffects(0);}
function near(a,b){assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);}
function tick(r,n){for(let i=0;i<n;i++)r.step(1/60,{});}

test('thunder purr ranks cause the declared bounces after the first target without revisits', () => {
  for(const [rank,bounces] of [[1,2],[2,3],[3,3],[4,3],[5,5]]) {
    const r=setup('thunder_purr',rank),enemies=Array.from({length:7},(_,i)=>foe(r,550+i*75));
    const hits=[];r.on('fx:hit',x=>hits.push(x));r.castSlot(0);release(r);
    assert.equal(hits.length,bounces+1);assert.equal(new Set(hits.map(x=>x.enemy.uid)).size,hits.length);
    assert.equal(enemies.filter(e=>e.hp<e.hpMax).length,bounces+1);
    if(rank>=4) assert.ok(enemies.slice(0,bounces+1).every(e=>e.stun>0));
    else assert.ok(enemies.every(e=>e.stun===0));
  }
});

test('lightning uses nearest unvisited target, respects declared jump range, and continues past a kill', () => {
  const r=setup();const first=foe(r,550),far=foe(r,720),nearer=foe(r,610),out=foe(r,1000);
  first.hp=1;const hit=[];let chain;r.on('fx:hit',x=>hit.push(x.enemy));r.on('fx:chain',x=>chain=x);
  r.castSlot(0);release(r);assert.ok(first.dead);assert.deepEqual(hit,[first,nearer,far]);
  assert.equal(out.hp,out.hpMax);assert.equal(chain.points.length,4);
  const b=setup();const only=foe(b,550),beyond=foe(b,731);b.castSlot(0);release(b);
  assert.ok(only.hp<only.hpMax);assert.equal(beyond.hp,beyond.hpMax);
});

test('lightning respects first-target range and no-target casts leave force-crit unused', () => {
  const r=setup();const e=foe(r,800);r.forceCrit=true;r.castSlot(0);release(r);
  assert.equal(e.hp,e.hpMax);assert.equal(r.forceCrit,true);
});

test('thunder rank three adds 25 percent damage and critical hits have real critical damage', () => {
  function hit(rank,forced=false){const r=setup('thunder_purr',rank),e=foe(r,550);r.forceCrit=forced;let result;
    r.on('fx:hit',x=>result=x);r.castSlot(0);release(r);return {r,e,result};}
  const a=hit(1),b=hit(3),c=hit(1,true);
  near(b.result.amount/a.result.amount,1.25);near(c.result.amount/a.result.amount,c.r.stats.critDmg);
  assert.equal(c.result.crit,true);assert.equal(c.r.forceCrit,false);assert.equal(a.result.crit,false);
});

test('lightning rank four stun obeys real boss shared control lockout', () => {
  const r=setup('thunder_purr',4);r.spawnBoss('moon_devourer');const b=r.boss;b.x=550;b.y=380;
  r.castSlot(0);release(r);assert.ok(b.stun>0&&b.stun<=.3);b.stun=0;
  r.applyStatus(b,'root',2);assert.equal(b.root,0);assert.ok(b.controlImmuneUntil>r.time);
});

test('hairball ranks change projectile count, damage, bounce, and spread', () => {
  const damage=[];for(const rank of [1,2,3,4,5]) {
    const r=setup('hairball_cannon',rank);foe(r,600);r.castSlot(0);release(r);
    const shots=r.projectiles;assert.equal(shots.length,rank>=5?5:rank>=3?2:1);
    assert.ok(shots.every(p=>p.bounces===(rank>=4?1:0)));damage.push(shots[0].damage);
    if(rank===5)assert.ok(shots.at(-1).angle-shots[0].angle>2.7);
  }
  near(damage[1]/damage[0],1.2);near(damage[4],damage[1]);
});

test('new ranged poses release after windup, permit movement, and preserve input buffering', () => {
  for(const id of ['hairball_cannon','thunder_purr']) {
    const r=new Run({catId:'tabby',skills:[id,'claw_slash'],seed:61});r.state=RUN_STATE.FIGHT;r.waveEnemiesLeft=999;
    r.player.x=500;r.player.y=380;r.player.invuln=999;const e=foe(r,560);const casts=[];r.on('skill:cast',({id})=>casts.push(id));
    r.castSlot(0);assert.deepEqual(r.castSlot(1),{ok:true,queued:true});
    const x=r.player.x;for(let i=0;i<3;i++)r.step(1/60,{moveX:1});
    assert.ok(r.player.x>x);assert.equal(e.hp,e.hpMax);assert.equal(r.projectiles.length,0);
    tick(r,35);assert.deepEqual(casts,[id,'claw_slash']);assert.ok(e.hp<e.hpMax);assert.equal(r.skillQueue.length,0);
  }
});
