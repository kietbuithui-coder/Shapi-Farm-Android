import test from 'node:test';
import assert from 'node:assert/strict';
import { Run, RUN_STATE, PLAY } from '../src/systems/run.js';
import { UPGRADE_BY_ID } from '../src/data/upgrades.js';
import { addTrainingDummy } from './harness.mjs';

function setup(skills=['arcane_paw']) {
  const r = new Run({catId:'tabby', skills, seed:73});
  r.state=RUN_STATE.FIGHT; r.waveEnemiesLeft=999; r.player.x=700; r.player.y=380; r.player.invuln=999; r.stats.crit=0;
  return r;
}
function tick(r,seconds) { for(let t=0;t+1e-9<seconds;t+=1/60) r.step(1/60,{}); }
function launch(id, rank, stacks) {
  const r=setup([id]); r.slots[0].rank=rank;
  for(let i=0;i<stacks;i++)r.applyUpgrade(UPGRADE_BY_ID.piercing_mind);
  r.castSlot(0); tick(r,.4); return r;
}

test('piercing upgrade affects every player skill projectile family exactly once',()=>{
  for(const [id,rank] of [['arcane_paw',3],['flying_fish',1],['rending_wave',1],['rending_wave',4],['magic_yarn',1],['paw_boomerang',3],['needle_barrage',4],['frost_nova',5]]) {
    const counts=[0,1,2].map(stacks=>{const r=launch(id,rank,stacks);assert.ok(r.projectiles.length,id);return r.projectiles[0].pierce;});
    assert.deepEqual(counts,[counts[0],counts[0]+1,counts[0]+2],id);
  }
});

test('extra piercing actually reaches additional enemies, but excludes enemy, summon and reflected projectiles',()=>{
  for(const stacks of [0,1,2]){
    const r=setup(); for(let i=0;i<stacks;i++)r.applyUpgrade(UPGRADE_BY_ID.piercing_mind);
    const targets=[100,180,260,340].map(dx=>{const e=addTrainingDummy(r,dx);e.hp=e.hpMax=10000;return e;});
    r.castSlot(0);const shot=r.projectiles[0];shot.homing=0;
    for(const e of targets){if(!r.projectiles.includes(shot))break;shot.x=e.x;shot.y=e.y-12;r.updateProjectiles(0);}
    assert.equal(targets.filter(e=>e.hp<e.hpMax).length,stacks+1);
    for(const [owner,source] of [['enemy','enemy'],['player','minion'],['player','orbit'],['player','reflect']]) {
      const pr=r.spawnProjectile({x:10,y:10,angle:0,owner,source,pierce:1});assert.equal(pr.pierce,1,source);
    }
  }
});

test('boomerang piercing limit applies independently on each leg',()=>{
  const r=launch('magic_yarn',1,1),pr=r.projectiles[0];r.projectiles=[pr];pr.x=900;pr.y=368;
  const enemies=[0,50,100].map(dx=>{const e=addTrainingDummy(r,200+dx);e.hp=e.hpMax=10000;return e;});
  const hit=e=>{pr.x=e.x;pr.y=e.y-12;r.updateProjectiles(0);};
  enemies.forEach(hit);assert.equal(pr.returning,true);assert.equal(pr.hits.size,0);
  const after=enemies.map(e=>e.hp);enemies.forEach(hit);assert.equal(r.projectiles.includes(pr),false);
  for(let i=0;i<3;i++)assert.ok(enemies[i].hp<after[i]);
});

test('wind-up jobs and phantom teleport cancel on terminal or night transition without refunding committed casts',()=>{
  for(const state of [RUN_STATE.INTRO,RUN_STATE.REWARD,RUN_STATE.DEAD,RUN_STATE.VICTORY]){
    const r=setup(['moonlit_trap','phantom_step']);const before=r.energy;r.castSlot(0);assert.ok(r.slotsTimeouts.length);
    const spent=r.energy;r.setState(state);assert.equal(r.slotsTimeouts.length,0);assert.ok(spent<before);assert.equal(r.energy,spent);
    r.setState(RUN_STATE.FIGHT);tick(r,1);assert.equal(r.traps.length,0,state);
    r.player.skillAction=null;r.castSlot(1);assert.ok(r.phantomStep);const x=r.player.x;
    r.setState(state);assert.equal(r.phantomStep,null);r.setState(RUN_STATE.FIGHT);tick(r,1.3);assert.equal(r.player.x,x,state);
  }
});

test('level-up freezes pending wind-up rather than executing immediately after a long choice',()=>{
  const r=setup(['rending_wave']);r.castSlot(0);const when=r.slotsTimeouts[0].at;
  tick(r,.05);const remaining=when-r.time;assert.ok(remaining>.05);
  r.setState(RUN_STATE.LEVELUP);tick(r,3);assert.equal(r.projectiles.length,0);
  assert.ok(Math.abs((r.slotsTimeouts[0].at-r.time)-remaining)<1e-8);
  r.setState(RUN_STATE.FIGHT);tick(r,.05);assert.equal(r.projectiles.length,0);
  tick(r,remaining+.05);assert.ok(r.projectiles.length>0);
});

test('scheduler executes in time order and is safe if a callback ends the wave or adds work',()=>{
  const r=setup(),calls=[];
  r.slotsTimeouts=[{at:.2,fn:()=>calls.push('late')},{at:.1,fn:()=>{calls.push('first');r.slotsTimeouts.push({at:0,fn:()=>calls.push('new')});r.setState(RUN_STATE.REWARD);}}, {at:.1,fn:()=>calls.push('second')}];
  r.time=.3;r.updatePassiveEffects(0);assert.deepEqual(calls,['first']);assert.equal(r.slotsTimeouts.length,0);
  r.setState(RUN_STATE.FIGHT);r.updatePassiveEffects(0);assert.deepEqual(calls,['first']);
});

test('two lunar traps remain separated and inside the arena at edges and corners',()=>{
  for(const x of [PLAY.left,PLAY.right])for(const y of [PLAY.top,PLAY.bottom])for(const aim of [0,Math.PI/4,Math.PI/2,Math.PI,Math.PI*1.5])for(const area of [0,.6]){
    const r=setup(['moonlit_trap']);r.slots[0].rank=3;r.player.x=x;r.player.y=y;r.player.aim=aim;r.player.moving=true;r.mods.skillArea=area;
    r.castSlot(0);tick(r,.2);const [a,b]=r.traps;assert.ok(a&&b);
    for(const tr of r.traps)assert.ok(tr.x>=PLAY.left-1e-7&&tr.x<=PLAY.right+1e-7&&tr.y>=PLAY.top-1e-7&&tr.y<=PLAY.bottom+1e-7);
    assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=2*a.radius,`${x},${y},${aim},${area}`);
  }
});

test('piercing reaches extra targets for each distinct projectile mechanism',()=>{
  for(const [id,rank] of [['flying_fish',1],['rending_wave',1],['magic_yarn',1],['needle_barrage',1],['frost_nova',5]]) for(const stacks of [0,1,2]) {
    const r=launch(id,rank,stacks), shot=r.projectiles[0];r.projectiles=[shot];shot.homing=0;
    const base=shot.pierce-stacks, targets=Array.from({length:base+stacks+2},(_,i)=>{const e=addTrainingDummy(r,160+i*65);e.hp=e.hpMax=10000;return e;});
    for(const e of targets){if(!r.projectiles.includes(shot)||shot.returning)break;shot.x=e.x;shot.y=e.y-12;r.updateProjectiles(0);}
    assert.equal(targets.filter(e=>e.hp<e.hpMax).length,base+stacks+1,`${id} +${stacks}`);
  }
});

test('due work survives an intervening level-up, including jobs already detached by scheduler',()=>{
  const r=setup(),calls=[];r.slotsTimeouts=[{at:0,fn:()=>{calls.push(1);r.setState(RUN_STATE.LEVELUP);}},{at:0,fn:()=>calls.push(2)}];
  r.updatePassiveEffects(0);assert.deepEqual(calls,[1]);assert.equal(r.slotsTimeouts.length,1);
  tick(r,1);r.setState(RUN_STATE.FIGHT);r.updatePassiveEffects(0);assert.deepEqual(calls,[1,2]);
});

import { bootGame } from './dom.mjs';
test('boss difficulty is accessible from home, fits mobile layouts, and applies to campaign and practice',async()=>{
  for(const [width,height] of [[320,568],[390,844],[840,380],[1280,720]]) {
    const {game:g}=await bootGame({width,height});g.draw();const button=g._cachedRects.find(x=>x.id==='toggleDifficulty');assert.ok(button);
    assert.ok(button.x>=0&&button.y>=0&&button.x+button.w<=width&&button.y+button.h<=height);
    for(const other of g._cachedRects.filter(x=>x.id!==button.id)){
      const overlap=button.x<other.x+other.w&&button.x+button.w>other.x&&button.y<other.y+other.h&&button.y+button.h>other.y;
      assert.equal(overlap,false,`${width}x${height} overlaps ${other.id}`);
    }
    g.click('toggleDifficulty');assert.equal(g.difficulty,'hard');g.click('play');g.applyPending();assert.equal(g.run.difficulty,'hard');
    g.scene='home';g.click('bossPractice');g.applyPending();g.click('practice:crystal_queen');g.applyPending();
    assert.equal(g.run.difficulty,'hard');assert.equal(g.run.boss.hpMax,g.run.boss.def.hp*1.25);
    g.scene='home';g.click('toggleDifficulty');assert.equal(g.difficulty,'normal');
  }
});

import { CATS } from '../src/data/cats.js';
import { SKILL_BY_ID } from '../src/data/skills.js';
test('every cat kit references existing unique skills',()=>{
  for(const cat of CATS){assert.equal(new Set(cat.skills).size,cat.skills.length,cat.id);for(const id of cat.skills)assert.ok(SKILL_BY_ID[id],`${cat.id}: missing ${id}`);}
});

test('equipping Black Cat gives four real skills immediately and after reloading the loadout',async()=>{
  const {game:g}=await bootGame();g.scene='cats';g.selected='black';g.profile.cats.black={unlocked:true,level:1};
  g.click('equip');assert.deepEqual(g.selectedSkills.slice(0,3),['shadow_strike','phantom_step','blood_fang']);
  assert.equal(g.selectedSkills.length,4);assert.ok(g.selectedSkills.every(id=>SKILL_BY_ID[id]));
  g.click('start');g.applyPending();assert.equal(g.run.slots.filter(Boolean).length,4);
  g.selectedSkills=[];g.initLoadout();assert.equal(g.selectedSkills.length,4);assert.ok(g.selectedSkills.every(id=>SKILL_BY_ID[id]));
});

test('previewing a locked cat and returning home cannot start it without unlocking',async()=>{
  const {game:g}=await bootGame();g.scene='cats';g.click('cat:black');assert.equal(g.selected,'black');g.draw();assert.ok(!g._cachedRects.some(r=>r.id==='equip'||r.id==='start'));
  g.click('back');g.applyPending();assert.equal(g.selected,'tabby');g.click('play');g.applyPending();assert.equal(g.run.cat.id,'tabby');
});

test('difficulty toggle avoids other menu controls with mobile safe-area insets',async()=>{
  for(const [width,height] of [[320,568],[390,844],[840,380],[640,360]]){
    const {game:g}=await bootGame({width,height});g.safe={left:16,right:16,top:24,bottom:24};g.draw();
    const rects=g._cachedRects,button=rects.find(r=>r.id==='toggleDifficulty');assert.ok(button);
    assert.ok(button.x>=16&&button.y>=24&&button.x+button.w<=width-16&&button.y+button.h<=height-24);
    for(const r of rects.filter(r=>r!==button))assert.ok(!(button.x<r.x+r.w&&button.x+button.w>r.x&&button.y<r.y+r.h&&button.y+button.h>r.y),`${width}x${height}: ${r.id}`);
  }
});
