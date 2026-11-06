// The bot: a genuine player stand-in. It reads the same observation the HUD does
// (enemies, hazards, cooldowns), dodges telegraphs, kites, spends skills and
// collects pickups — so "Bot Play" is a real demo mode, not a looping cutscene.
//
// Decision layers, in priority order:
//   1. survive  — leave hazard footprints, dodge lethal projectiles
//   2. engage   — close to the range the equipped kit wants
//   3. spend    — fire the highest-value ready skill
//   4. collect  — drift toward xp / health / gold when safe

import { angle, clamp, dist, dist2, TAU } from '../core/math.js';
import { PLAY } from './run.js';

const WANTS = {
  physical: { near: 54, far: 120 },
  magic: { near: 190, far: 260 },
  projectile: { near: 200, far: 280 },
  aoe: { near: 110, far: 190 },
  summon: { near: 150, far: 220 },
  defense: { near: 100, far: 170 },
  mobility: { near: 90, far: 160 },
  control: { near: 170, far: 230 },
  heal: { near: 120, far: 200 },
  utility: { near: 130, far: 200 },
};

export class BotBrain {
  constructor(run, { skill = 0.85 } = {}) {
    this.run = run;
    this.skill = skill;
    this.state = { x: 0, y: 0, vx: 0 };
    this.reactTimer = 0;
    this.queue = [];
    this.dodgeCd = 0;
    this.strafeDir = 1;
    this.strafeTimer = 0;
    this.lastHazardCount = 0;
  }

  /** Preferred engagement distance for the current loadout. */
  preferredRange() {
    const run = this.run;
    const cats = run.slots.filter((s) => s);
    if (!cats.length) return 80;
    let near = 0;
    let far = 0;
    for (const s of cats) {
      const w = WANTS[s.def.category] || WANTS.physical;
      near += w.near;
      far += w.far;
    }
    return { near: near / cats.length, far: far / cats.length };
  }

  update(dt) {
    const run = this.run;
    const p = run.player;
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.reactTimer = Math.max(0, this.reactTimer - dt);
    this.strafeTimer -= dt;
    if (this.strafeTimer <= 0) { this.strafeTimer = 1.2 + Math.random() * 1.4; this.strafeDir *= -1; }

    const input = { moveX: 0, moveY: 0, dodge: false };
    if (!p.alive) return input;

    const target = this.pickTarget();
    const range = this.preferredRange();
    let ax = 0;
    let ay = 0;

    if (target) {
      const d = dist(p.x, p.y, target.x, target.y);
      const a = angle(p.x, p.y, target.x, target.y);
      let radial = 0;
      const isBoss = !!(target.boss || target.mini);
      if (d > (isBoss ? 78 : range.far)) radial = 1;
      else if (d < range.near * 0.8 && !isBoss) radial = -1;
      ax += Math.cos(a) * radial;
      ay += Math.sin(a) * radial * 0.7;
      if (isBoss) {
        // hug the boss: ranged-only builds would otherwise stall the fight
        ax += Math.cos(a) * (d > 78 ? 1.3 : 0);
        ay += Math.sin(a) * (d > 78 ? 0.9 : 0);
      } else {
        // orbit so the player keeps moving instead of standing in a damage line
        ax += Math.cos(a + Math.PI / 2) * 0.55 * this.strafeDir;
        ay += Math.sin(a + Math.PI / 2) * 0.4 * this.strafeDir;
      }
    }

    // 1. survive: hazard footprints and incoming bolts outrank every other desire
    const danger = this.findDanger();
    if (danger) {
      ax = ax * (danger.urgent ? 0.15 : 0.55) + danger.x * (danger.urgent ? 2.6 : 1.2);
      ay = ay * (danger.urgent ? 0.15 : 0.55) + danger.y * (danger.urgent ? 2.6 : 1.2);
      if (danger.urgent && this.dodgeCd <= 0 && p.energy > 22) {
        input.dodge = true;
        this.dodgeCd = 0.75;
      }
      // a real player rolls out of a red circle, not just walks
      if (danger.urgent && (p.dashCd || 0) <= 0 && p.energy > 24) {
        run.dashTo(p, 0, 0, p.x + danger.x * 130, p.y + danger.y * 90);
      }
    }

    // low health: break off and hunt a health pickup
    const hpFrac = run.hp / run.stats.hpMax;
    const bossFight = !!(run.boss && !run.boss.dead);
    if (hpFrac < 0.35 && !bossFight && !target) {
      const heal = run.pickups.find((k) => k.kind === 'hp');
      if (heal) {
        const a = angle(p.x, p.y, heal.x, heal.y);
        ax += Math.cos(a) * 1.6;
        ay += Math.sin(a) * 1.6;
      } else if (target) {
        const a = angle(target.x, target.y, p.x, p.y);
        ax += Math.cos(a) * 0.9;
        ay += Math.sin(a) * 0.9;
      }
    } else {
      // 4. collect loose value, weighted by proximity
      const pickup = this.bestPickup();
      if (pickup) {
        const a = angle(p.x, p.y, pickup.x, pickup.y);
        ax += Math.cos(a) * 0.45;
        ay += Math.sin(a) * 0.45;
      }
    }

    // keep off the arena edges so it never corners itself
    const edge = this.edgePush(p);
    ax += edge.x;
    ay += edge.y;

    const len = Math.hypot(ax, ay);
    if (len > 0.001) {
      input.moveX = ax / Math.max(1, len);
      input.moveY = ay / Math.max(1, len);
    }

    // 3. spend skills
    this.trySkills(target);
    // emergency: with low health and an unused heal, spend it instead of waiting
    if (hpFrac < 0.4) {
      run.slots.forEach((s, i) => {
        if (s && s.def.category === 'heal' && run.canCast(s)) run.castSlot(i);
      });
    }

    // pick level-up cards
    if (run.state === 'levelup' && run.offers?.length) this.chooseOffer();
    if (run.state === 'reward' && run.rewards?.length) run.chooseReward(0);
    return input;
  }

  pickTarget() {
    const run = this.run;
    const p = run.player;
    const boss = run.boss || run.miniBoss;
    if (boss && !boss.dead) return boss;
    let best = null;
    let bestScore = -Infinity;
    for (const e of run.enemies) {
      if (e.dead) continue;
      const d = dist(p.x, p.y, e.x, e.y);
      let score = 600 - d;
      if (e.elite) score += 120;
      if (e.hp / e.hpMax < 0.3) score += 90;
      if (e.def.behaviour === 'ranged') score += 40;
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  findDanger() {
    const run = this.run;
    const p = run.player;
    let pushX = 0;
    let pushY = 0;
    let urgent = false;
    // hazard telegraphs
    for (const hz of run.hazards) {
      if (hz.t > hz.delay) continue;
      const d = dist(p.x, p.y, hz.x, hz.y);
      const effective = hz.radius || (hz.kind === 'line' ? 60 : 70);
      if (d < effective + 60) {
        const a = angle(hz.x, hz.y, p.x, p.y);
        const w = (1 - d / (effective + 60)) * 2.4;
        pushX += Math.cos(a) * w;
        pushY += Math.sin(a) * w;
        if (d < effective * 0.9) urgent = true;
      }
    }
    // enemy bolts heading at us
    for (const pr of run.projectiles) {
      if (pr.owner === 'player') continue;
      const d = dist(p.x, p.y, pr.x, pr.y);
      if (d > 150) continue;
      const toMe = angle(pr.x, pr.y, p.x, p.y);
      const facing = Math.abs(Math.atan2(Math.sin(toMe - pr.angle), Math.cos(toMe - pr.angle)));
      if (facing < 0.5) {
        const a = pr.angle + Math.PI / 2;
        const side = Math.sin(pr.angle) * (p.x - pr.x) - Math.cos(pr.angle) * (p.y - pr.y) > 0 ? 1 : -1;
        pushX += Math.cos(a) * side * 1.4;
        pushY += Math.sin(a) * side * 1.1;
        if (d < 70) urgent = true;
      }
    }
    // explosive bombers should be kited, not tanked
    for (const e of run.enemies) {
      if (e.dead || e.def.attack !== 'explode') continue;
      const d = dist(p.x, p.y, e.x, e.y);
      if (d < 96) {
        const a = angle(e.x, e.y, p.x, p.y);
        pushX += Math.cos(a) * 1.5;
        pushY += Math.sin(a) * 1.5;
        if (d < 60) urgent = true;
      }
    }
    if (!pushX && !pushY) return null;
    const len = Math.hypot(pushX, pushY) || 1;
    return { x: pushX / len, y: pushY / len, dodge: urgent, urgent };
  }

  bestPickup() {
    const run = this.run;
    const p = run.player;
    let best = null;
    let bestScore = 0;
    for (const k of run.pickups) {
      const d = dist(p.x, p.y, k.x, k.y);
      if (d > 260) continue;
      const value = k.kind === 'hp' ? 3 : k.kind === 'gold' ? 1.2 : k.kind === 'chest' ? 5 : 1;
      const score = (value * 120) / (d + 40);
      if (score > bestScore) { bestScore = score; best = k; }
    }
    return best;
  }

  dashTo(x, y) {
    const p = this.run.player;
    const d = dist(p.x, p.y, x, y);
    if (d < 30) return;
    this.run.dashTo(p, 0, 0, x, y);
  }

  edgePush(p) {
    // Derived from the playfield, not hardcoded to 1180x660: when the arena is
    // resized these numbers used to make the bot steer away from walls that
    // were no longer there (and into ones that were).
    const m = 70;
    const left = PLAY.left - 26;
    const right = PLAY.right + 26;
    const topY = PLAY.top + 30;
    const bottomY = PLAY.bottom - 10;
    let x = 0;
    let y = 0;
    if (p.x < left + m) x += (left + m - p.x) / m;
    if (p.x > right - m) x -= (p.x - (right - m)) / m;
    if (p.y < topY) y += (topY - p.y) / 90;
    if (p.y > bottomY) y -= (p.y - bottomY) / 60;
    return { x: x * 1.4, y: y * 1.4 };
  }

  trySkills(target) {
    const run = this.run;
    if (run.state !== 'fight' || !target) return;
    const p = run.player;
    const d = dist(p.x, p.y, target.x, target.y);
    // priority: a heal when hurt, a defensive skill when in danger, then damage
    const order = run.slots
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s && run.canCast(s))
      .sort((a, b) => this.scoreSkill(b.s, d) - this.scoreSkill(a.s, d));
    if (!order.length) return;
    const hpFrac = run.hp / run.stats.hpMax;
    for (const { s, i } of order) {
      const cat = s.def.category;
      if (cat === 'heal' && hpFrac > 0.55) continue;
      if (cat === 'defense' && !this.threatNear()) continue;
      const want = WANTS[cat] || WANTS.physical;
      if (d > want.far * 1.5) continue;
      run.castSlot(i);
      return;
    }
  }

  scoreSkill(slot, d) {
    const def = slot.def;
    const want = WANTS[def.category] || WANTS.physical;
    const ideal = (want.near + want.far) / 2;
    return 100 - Math.abs(d - ideal) * 0.3 + (def.cost > 0 ? 10 : 0);
  }

  threatNear() {
    const run = this.run;
    const p = run.player;
    for (const e of run.enemies) {
      if (!e.dead && dist(e.x, e.y, p.x, p.y) < 120) return true;
    }
    return run.hazards.some((hz) => hz.t < hz.delay && dist(hz.x, hz.y, p.x, p.y) < (hz.radius || 70));
  }

  chooseOffer() {
    const run = this.run;
    const offers = run.offers || [];
    let bestIdx = 0;
    let bestScore = -Infinity;
    offers.forEach((o, i) => {
      let score = 0;
      if (o.type === 'skillup') score = 70 + (o.rank > 3 ? 25 : 0);
      else {
        const rarity = { common: 10, rare: 22, epic: 38, mythic: 60 }[o.rarity] || 10;
        score = rarity;
        const hpFrac = run.hp / run.stats.hpMax;
        if (o.tags?.includes('defense') || o.tags?.includes('heal')) score += hpFrac < 0.6 ? 26 : 4;
        if (o.tags?.includes('offense')) score += 12;
        if (o.tags?.includes('risk') && hpFrac < 0.5) score -= 18;
        if (o.id === 'ninefold' || o.id === 'second_skin') score += 22;
      }
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    });
    run.chooseOffer(bestIdx);
  }
}

export { WANTS };
void TAU;
void clamp;
void dist2;
