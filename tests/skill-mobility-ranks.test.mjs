import test from 'node:test';
import assert from 'node:assert/strict';
import { Run, RUN_STATE } from '../src/systems/run.js';
import { addTrainingDummy } from './harness.mjs';

function setup(id,rank=1){const r=new Run({catId:'tabby',skills:[id],seed:21});r.state=RUN_STATE.FIGHT;r.waveEnemiesLeft=999;
  r.player.x=600;r.player.y=380;r.player.invuln=999;r.stats.crit=0;r.slots[0].rank=rank;return r;}
function tick(r,n,input={}){for(let i=0;i<n;i++)r.step(1/60,input);}
function release(r){r.time+=.11;r.updatePassiveEffects(0);}
function foe(r,dx=60){const e=addTrainingDummy(r,dx);e.hp=e.hpMax=100000;e.speed=0;e.attackCd=999;return e;}
function near(a,b){assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);}

test('double leap rank five leaves finite damaging fire patches along its real path',()=>{
  for(const rank of [4,5]){const r=setup('double_leap',rank);const start=r.player.x;r.castSlot(0);tick(r,12);
    const trails=r.zones.filter(z=>z.source==='dashTrail');assert.equal(trails.length>0,rank===5);
    if(rank===5){assert.ok(trails.length<=4);assert.ok(trails.every(z=>z.x>start&&z.x<=r.player.x&&z.dps>0&&z.time===.8));
      const tr=trails[0],e=foe(r);e.x=tr.x;e.y=tr.y;const hp=e.hp;r.attackCounter=0;r.updateZones(.1);
      assert.ok(e.hp<hp);assert.equal(r.attackCounter,0);}
  }
});

test('both double leap charges work back-to-back, buffering the second until the first dash ends',()=>{
  const r=setup('double_leap',5);const x=r.player.x;const events=[];r.on('skill:cast',e=>events.push(e.id));
  assert.equal(r.slots[0].charges,2);assert.ok(r.castSlot(0).ok);assert.deepEqual(r.castSlot(0),{ok:true,queued:true});
  tick(r,40);assert.deepEqual(events,['double_leap','double_leap']);assert.equal(r.skillQueue.length,0);
  assert.equal(r.slots[0].charges,0);assert.ok(r.player.x>x+220);assert.equal(r.dashQueue.length,0);
});

test('double leap rank four stuns swept targets while boss resistance still applies',()=>{
  for(const rank of [3,4]){const r=setup('double_leap',rank);const e=foe(r,90);r.castSlot(0);tick(r,8);
    assert.ok(e.hp<e.hpMax);assert.equal(e.stun>0,rank===4);}
  const r=setup('double_leap',4);r.spawnBoss('moon_devourer');const b=r.boss;b.x=690;b.y=380;r.castSlot(0);tick(r,8);
  assert.ok(b.stun>0&&b.stun<=.3);assert.ok(b.controlImmuneUntil>r.time);
});

test('wind sprint activates after startup and rank upgrades speed and cooldown of later casts',()=>{
  for(const rank of [1,2,3,4,5]){const r=setup('wind_sprint',rank);r.castSlot(0);assert.equal(r.player.buffs.length,0);release(r);
    const b=r.player.buffs[0];near(b.move,(rank>=3?.6:.45)*r.skillPotency(r.slots[0].def));
    near(b.atkSpeed,(rank>=4?.2:0)*r.skillPotency(r.slots[0].def));assert.equal(b.trail,rank===5);
    const before=r.player.x;tick(r,10,{moveX:1});assert.ok(r.player.x>before);
  }
});

test('wind sprint rank five emits fire only while actually moving and stops when buff expires',()=>{
  const r=setup('wind_sprint',5);r.castSlot(0);release(r);tick(r,30);assert.equal(r.zones.length,0);
  tick(r,60,{moveX:1});const trails=r.zones.filter(z=>z.source==='sprintTrail');assert.ok(trails.length>=2&&trails.length<=4);
  assert.ok(trails.every(z=>z.dps>0&&z.time===.8));const e=foe(r);e.x=trails[0].x;e.y=trails[0].y;
  const hp=e.hp;r.attackCounter=0;r.updateZones(.1);assert.ok(e.hp<hp);assert.equal(r.attackCounter,0);
  r.player.buffs[0].time=.01;tick(r,2,{moveX:1});assert.equal(r.player.buffs.length,0);
  r.zones.length=0;tick(r,60,{moveX:1});assert.equal(r.zones.filter(z=>z.source==='sprintTrail').length,0);
});

test('echoed sprint buffs do not duplicate trail patches',()=>{
  const r=setup('wind_sprint',5);r.mods.echo=1;r.castSlot(0);release(r);assert.equal(r.player.buffs.length,2);
  tick(r,15,{moveX:1});assert.equal(r.zones.filter(z=>z.source==='sprintTrail').length,1);
});

test('movement trail damage is timestep-independent and cannot outlive its finite duration',()=>{
  for(const source of ['dashTrail','sprintTrail'])for(const dt of [1/60,.08]){
    const r=setup('wind_sprint');const e=foe(r);r.zones.push({kind:'fire',source,x:e.x,y:e.y,radius:20,time:.8,t:0,dps:10});
    for(let t=0;t<1;t+=dt)r.updateZones(dt);near(e.hpMax-e.hp,8);assert.equal(r.zones.length,0);
  }
});

test('wind sprint windup is movable and queues another skill',()=>{
  const r=new Run({catId:'tabby',skills:['wind_sprint','claw_slash'],seed:21});r.state=RUN_STATE.FIGHT;r.waveEnemiesLeft=999;
  r.player.x=600;r.player.y=380;r.player.invuln=999;foe(r);const casts=[];r.on('skill:cast',({id})=>casts.push(id));
  r.castSlot(0);assert.deepEqual(r.castSlot(1),{ok:true,queued:true});const x=r.player.x;tick(r,3,{moveX:1});
  assert.ok(r.player.x>x);assert.equal(r.player.buffs.length,0);tick(r,35);assert.deepEqual(casts,['wind_sprint','claw_slash']);
});
