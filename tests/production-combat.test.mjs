import test from 'node:test';
import assert from 'node:assert/strict';
import { Run, RUN_STATE } from '../src/systems/run.js';
import { UPGRADE_BY_ID } from '../src/data/upgrades.js';
import { addTrainingDummy } from './harness.mjs';

function setup(skill='claw_slash') {const r=new Run({catId:'tabby',skills:[skill],seed:42});r.state=RUN_STATE.FIGHT;r.waveEnemiesLeft=999;r.player.x=700;r.player.y=380;r.player.invuln=999;r.stats.crit=0;return r;}
function dummy(r,dx=30){const e=addTrainingDummy(r,0);e.x=r.player.x+dx;e.y=r.player.y;e.hp=e.hpMax=100000;e.attackCd=999;return e;}
function near(a,b,eps=1e-6){assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);}

test('thorned magic applies the described fraction of real direct damage over two seconds',()=>{
  for(const ranks of [1,2,3,4])for(const dt of [1/60,.08]){
    const r=setup(),e=dummy(r);for(let i=0;i<ranks;i++)r.applyUpgrade(UPGRADE_BY_ID.thorned_magic);
    e.mark=.5;r.soulDamageBonus=.2;r.hitEnemy(e,100,{source:'skill'});near(e.hpMax-e.hp,180);
    near(e.thornDps,180*.2*ranks/2);const hp=e.hp;let t=0;while(t<2){const step=Math.min(dt,2-t);r.updateEnemies(step);t+=step;}
    near(hp-e.hp,180*.2*ranks,1e-5);near(e.thornTime,0,1e-8);
    const after=e.hp;r.updateEnemies(.08);near(e.hp,after);assert.equal(r.attackCounter,1);
  }
});

test('thorn effect snapshots amplification, refreshes strongest and cannot recursively trigger on-hit',()=>{
  const r=setup(),e=dummy(r);r.applyUpgrade(UPGRADE_BY_ID.thorned_magic);r.stats.lifesteal=.1;r.hp=1;
  r.hitEnemy(e,100,{source:'skill'});near(e.thornDps,10);r.updateEnemies(.5);
  r.hitEnemy(e,50,{source:'skill'});near(e.thornDps,10);near(e.thornTime,2);
  const health=r.hp,counter=r.attackCounter,hp=e.hp;e.mark=4;r.soulDamageBonus=4;
  r.updateEnemies(.08);near(hp-e.hp,.8);near(r.hp,health);assert.equal(r.attackCounter,counter);
  r.hitEnemy(e,100,{source:'skill'});near(e.thornDps,250);near(e.thornTime,2);
});

test('thorn does not apply to minions, blasts, ticks, or an enemy killed by the hit',()=>{
  for(const opts of [{source:'minion'},{source:'blast'},{source:'skill',tick:true},{source:'thorn',fixed:true,tick:true}]){
    const r=setup(),e=dummy(r);r.applyUpgrade(UPGRADE_BY_ID.thorned_magic);r.hitEnemy(e,10,opts);assert.ok(!e.thornTime);
  }
  const r=setup(),e=dummy(r);e.hp=1;r.applyUpgrade(UPGRADE_BY_ID.thorned_magic);r.hitEnemy(e,10,{source:'skill'});assert.ok(e.dead);assert.ok(!e.thornTime);
});

test('passive lifesteal uses actual post-mark damage and cannot heal from overkill',()=>{
  const r=setup(),e=dummy(r);r.stats.lifesteal=.1;r.hp=1;e.mark=.5;r.hitEnemy(e,100,{source:'skill'});near(r.hp,16);
  const e2=dummy(r);e2.hp=20;e2.mark=5;r.hp=1;r.hitEnemy(e2,100,{source:'skill'});near(r.hp,3);assert.ok(e2.dead);
  const e3=dummy(r);r.hp=1;r.hitEnemy(e3,100,{source:'minion'});near(r.hp,1);r.hitEnemy(e3,100,{source:'skill',tick:true});near(r.hp,1);
});

test('poison final tick is bounded by the remaining duration',()=>{
  const r=setup(),e=dummy(r);r.applyStatus(e,'poison',10,.03);const hp=e.hp;r.updateEnemies(.08);near(hp-e.hp,.3);near(e.poisonTime,0);
});

test('attack upgrades actually change live damage and stack additively',()=>{
  const r=setup(),e=dummy(r),baseAtk=r.stats.atk,def=r.slots[0].def,base=r.skillDamage(def,1);
  r.applyUpgrade(UPGRADE_BY_ID.keen_edge);near(r.stats.atk,baseAtk*1.14);near(r.skillDamage(def,1),base*1.14);
  r.applyUpgrade(UPGRADE_BY_ID.keen_edge);near(r.stats.atk,baseAtk*1.28);near(r.skillDamage(def,1),base*1.28);
  r.applyUpgrade(UPGRADE_BY_ID.glass_fang);near(r.stats.atk,baseAtk*1.56);near(r.skillDamage(def,1),base*1.56);assert.ok(e.hp>0);
});

test('bleeding tempo triggers every fourth direct hit, each pick increasing the bleed',()=>{
  const r=setup(),e=dummy(r);r.applyUpgrade(UPGRADE_BY_ID.tempo_bleed);r.applyUpgrade(UPGRADE_BY_ID.tempo_bleed);
  assert.equal(r.mods.bleedEvery,4);for(let i=0;i<3;i++)r.hitEnemy(e,1,{source:'skill'});assert.equal(e.bleedTime,0);
  r.hitEnemy(e,1,{source:'skill'});near(e.bleed,12);near(e.bleedTime,3);
});

test('skill area is applied once for combo and nova and matches the displayed effect',()=>{
  for(const id of ['triple_scratch','whirling_claws','frost_nova']){
    const r=setup(id);assert.ok(r.slots[0],id);r.mods.skillArea=.5;
    let radius;const hit=[];r.on('fx:nova',fx=>{radius??=fx.radius;});r.on('fx:hit',fx=>hit.push(fx.enemy));
    // Measure effect first, then recast with targets just inside/outside its rim.
    r.castSlot(0);for(let i=0;i<40;i++)r.step(1/60,{});assert.ok(radius>0,`${id} effect`);
    r.enemies=[];r.slots[0].cd=0;r.slots[0].charges=1;r.player.skillAction=null;
    const inside=dummy(r,(radius+18-1)/.9),outside=dummy(r,(radius+18+1)/.9);
    r.castSlot(0);for(let i=0;i<40;i++)r.step(1/60,{});
    assert.ok(hit.includes(inside),`${id} misses inside`);assert.ok(!hit.includes(outside),`${id} hits outside visual radius`);
  }
});

test('kill burst and summon hitboxes do not inherit skill-area or skill on-hit upgrades',()=>{
  const r=setup(),dead=dummy(r),inside=dummy(r,50),outside=dummy(r,130);r.mods.skillArea=1;r.mods.killBoom=10;r.mods.skillDot=.2;
  dead.hp=1;r.hitEnemy(dead,10,{source:'skill'});assert.ok(inside.hp<inside.hpMax);assert.equal(outside.hp,outside.hpMax);
  assert.ok(!inside.thornTime);assert.equal(r.attackCounter,1);
  const m=setup(),inRange=dummy(m,80),outRange=dummy(m,180);m.mods.skillArea=1;m.arcDamage(m.player.x,m.player.y,110,110,1,Math.PI*2,null,10,{},true,'minion');
  assert.ok(inRange.hp<inRange.hpMax);assert.equal(outRange.hp,outRange.hpMax);
});

test('night max-health reward never exceeds maximum or grants more than the new capacity',()=>{
  const r=setup(),before=r.stats.hpMax;r.hp=before;r.shuffleRng.shuffle=pool=>pool;r.rollRewards().find(x=>x.id==='maxhp').apply();near(r.hp,r.stats.hpMax);near(r.stats.hpMax,before*1.12);
  const r2=setup();r2.hp=1;const old=r2.stats.hpMax;r2.shuffleRng.shuffle=pool=>pool;r2.rollRewards().find(x=>x.id==='maxhp').apply();near(r2.hp,1+old*.12);
});

test('upgrade offers are deterministic, distinct, respect caps and favor common over mythic per card',()=>{
  const a=setup(),b=setup();a.slots=[];b.slots=[];const counts={keen_edge:0,thorned_magic:0,twin_souls:0};
  for(let i=0;i<12000;i++){
    const aa=a.rollOffers(),bb=b.rollOffers();assert.deepEqual(aa.map(o=>o.id),bb.map(o=>o.id));assert.equal(new Set(aa.map(o=>o.id)).size,3);
    for(const o of aa)if(Object.hasOwn(counts,o.id))counts[o.id]++;
  }
  assert.ok(counts.keen_edge>counts.thorned_magic*1.6,JSON.stringify(counts));
  assert.ok(counts.thorned_magic>counts.twin_souls*5,JSON.stringify(counts));
  a.upgradeLevels={keen_edge:UPGRADE_BY_ID.keen_edge.max};for(let i=0;i<100;i++)assert.ok(!a.rollOffers().some(o=>o.id==='keen_edge'));
});

test('backstab applies only to direct skill hits when the player stands behind a facing enemy',()=>{
  for(const facing of [-1,1])for(const behind of [false,true]){
    const r=setup(),e=dummy(r,facing*(behind?30:-30));e.facing=facing;r.applyUpgrade(UPGRADE_BY_ID.backstab);
    const hp=e.hp;r.hitEnemy(e,100,{source:'skill'});near(hp-e.hp,behind?145:100);
    const before=e.hp;r.hitEnemy(e,100,{source:'minion'});near(before-e.hp,100);
  }
});

test('ricochet finds one nearby enemy, applies its mark once, and never chains on-hit effects',()=>{
  const r=setup(),a=dummy(r,30),b=dummy(r,120),c=dummy(r,180);a.mark=.5;b.mark=.25;r.soulDamageBonus=.5;
  r.applyUpgrade(UPGRADE_BY_ID.ricochet);r.applyUpgrade(UPGRADE_BY_ID.thorned_magic);r.stats.lifesteal=.1;r.hp=1;
  const hpA=a.hp,hpB=b.hp,hpC=c.hp;r.hitEnemy(a,100,{source:'skill'});
  near(hpA-a.hp,225);near(hpB-b.hp,75);near(hpC-c.hp,0);near(r.hp,23.5);assert.equal(r.attackCounter,1);
  assert.ok(a.thornTime>0);assert.ok(!b.thornTime);assert.ok(!c.thornTime);
});

test('vampiric aura heals only for kills within its stated 180-unit radius',()=>{
  for(const [dx,heal] of [[179,true],[181,false]]){const r=setup(),e=dummy(r,dx);r.applyUpgrade(UPGRADE_BY_ID.vampiric_aura);r.hp=1;e.hp=1;r.hitEnemy(e,10,{source:'skill'});near(r.hp,1+(heal?r.stats.hpMax*.03:0));}
});

test('second skin keeps its stated 20-second interval when upgraded repeatedly',()=>{
  const r=setup();for(let i=0;i<3;i++)r.applyUpgrade(UPGRADE_BY_ID.second_skin);
  near(r.mods.autoShieldCd,20);near(r.mods.autoShield,.6);r.updatePlayer(.01,{});near(r.autoShieldTimer,20);
  near(r.player.shield,r.stats.hpMax*.6);r.updatePlayer(19.99,{});assert.ok(r.autoShieldTimer>0);r.updatePlayer(.02,{});near(r.autoShieldTimer,20);
});
