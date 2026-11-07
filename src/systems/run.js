// Run simulation: the single source of gameplay truth.
// It owns entities and rules, knows nothing about canvases, audio or the DOM,
// and is fully deterministic for a given seed. Renderer, audio, UI and the
// autoplay bot all observe it through the `on` event map.

import { Rng } from '../core/rng.js';
import { SKILL_ACTIONS, actionDuration } from './skill-animation.js';
import { Emitter } from '../core/events.js';
import { clamp, dist, dist2, angle, TAU, lerp, damp, weightedIndex, mulberry32 } from '../core/math.js';

/**
 * Global multiplier on every skill hitbox (see the `area` line in executeSkill).
 * 0.85 = 15% smaller radii and widths, for all cats equally. Because these are
 * radii, the covered *area* falls by more than 15%: that is the point — tight
 * aim should pay off instead of being optional.
 */
const SKILL_HITBOX = 0.85;

/**
 * Hard cap on a single incoming hit, as a share of the player's full health.
 * 0.5 = two clean hits can kill, one never can. See damagePlayer().
 */
const MAX_HIT_SHARE = 0.5;
import { CAT_BY_ID } from '../data/cats.js';
import { SKILL_BY_ID, skillValues, skillScaling } from '../data/skills.js';
import { ENEMY_BY_ID, ELITE_MODS, MINIBOSS_BY_ID, BOSS_BY_ID } from '../data/enemies.js';
import { UPGRADES, UPGRADE_BY_ID } from '../data/upgrades.js';
import { wavePlan, actForNight, bossForNight } from '../data/acts.js';
import { buildStats, emptyMods, computeDamage, computeIncoming, xpForLevel, difficultyScale } from './stats.js';
import { PERK_TIERS } from '../data/perks.js';

// The playfield was widened from 1180 to 1570 (+33%) so the camera has somewhere
// to pan: at 1180 the visible slice was most of the arena, so backing into a
// corner left nowhere to retreat to and every fight happened in the same spot.
// Height is unchanged — the brief asks for a larger playable area, and extra
// depth would only add empty floor between the horizon and the fight band.
export const ARENA = { x: 0, y: 0, w: 1570, h: 660 };
export const GROUND_Y = 512;
const PLAY = { left: 96, right: ARENA.w - 96, top: 250, bottom: GROUND_Y - 6 };

// Dash tuning lives here so the cost is identical on the input gate, the
// spend, and the HUD hint.
export const DASH_COST = 18;
export const DASH_CD = 0.62;

export const RUN_STATE = { INTRO: 'intro', FIGHT: 'fight', LEVELUP: 'levelup', REWARD: 'reward', PAUSE: 'pause', DEAD: 'dead', VICTORY: 'victory' };

export class Run {
  /**
   * @param {object} opts { catId, skills:[4], perks, seed, difficulty, statsRecorder }
   */
  constructor({ catId, skills = [], perks = {}, seed = 1, difficulty = 'normal', profile = null }) {
    this.cat = CAT_BY_ID[catId] || CAT_BY_ID.tabby;
    this.difficulty = difficulty;
    this.seed = seed >>> 0;
    this.rng = new Rng(seed);
    this.shuffleRng = new Rng(seed ^ 0x9e3779b9);
    this.events = new Emitter();
    this.profile = profile;
    this.built = buildStats(this.cat, { perks, level: 1, catLevel: profile?.cats?.[this.cat.id]?.level || 1 });
    this.stats = this.built.stats;
    this.mods = this.built.mods;

    this.hp = this.stats.hpMax;
    this.playerSlow = null;   // { amount, time } — set by elite/thorn hits
    this.playerRoot = 0;      // seconds of heavy movement damping
    this.energy = this.stats.energyMax;
    this.level = 1;
    this.xp = 0;
    this.xpNeed = xpForLevel(1);
    this.gold = 0;
    this.kills = 0;
    this.elites = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestStreak = 0;

    this.time = 0;
    this.night = 1;
    this.wave = 1;
    this.act = actForNight(1);
    this.state = RUN_STATE.INTRO;
    this.stateTimer = 1.15;
    this.paused = false;
    this.speed = 1;

    this.player = {
      x: ARENA.w / 2, y: GROUND_Y, vx: 0, vy: 0, facing: 1,
      radius: 17, attackCd: 0, comboIndex: 0, invuln: 0, dashTime: 0,
      hurtFlash: 0, moveDirX: 0, moveDirY: 0, held: { x: 1, y: 0 },
      aim: 0, alive: true, reviveUsed: false, shield: 0, shieldTime: 0,
      buffs: [], moveSpeedMul: 1,
    };

    this.skillQueue = [];
    this.slots = [0, 1, 2, 3].map((i) => {
      const id = skills[i];
      const def = id ? SKILL_BY_ID[id] : null;
      return def ? this.makeSlot(def, i) : null;
    });

    this.enemies = [];
    this.projectiles = [];
    this.hazards = [];
    this.pickups = [];
    this.minions = [];
    this.floating = [];
    this.traps = [];
    this.zones = [];
    this.obstacles = [];
    this.uid = 1;
    this.enemySpawnTimer = 0;
    this.pendingSpawns = [];
    this.discoveredKeys = new Set();
    this.waveEnemiesLeft = 0;
    this.waveSpawned = 0;
    this.waveBudget = 0;
    this.boss = null;
    this.miniBoss = null;
    this.offers = [];
    this.pendingLevelUps = 0;
    this.rewards = [];
    this.statsTotals = { damage: 0, healing: 0, minions: 0, casts: 0 };
    this.log = [];
    this.achievedFlags = new Set();
    this.autoShieldTimer = 0;
    this.stormTimer = 0;
    this.moonPactTimer = 0;
    this.attackCounter = 0;
    this.soulDamageBonus = 0; // additive damage earned by Soul Siphon during this run
    this.hitCounter = 0;
    this.comboWindow = 2.4;
    this.shrineUsed = 0;
    this.chestPending = false;
    this.bot = null;
  }

  makeSlot(def, index) {
    return {
      def, index, id: def.id, rank: 1, cd: 0, charges: Math.max(1, def.params?.charges || 1),
      maxCharges: Math.max(1, def.params?.charges || 1),
      branch: null, recharge: 0, rechargeDuration: 0, reserved: 0,
    };
  }

  /* ── lifecycle ─────────────────────────────────────────────────────────── */
  start() {
    this.emit('run:start', { cat: this.cat });
    if (this.cat && this.cat.id) this.discover(`cat:${this.cat.id}`);
    // The loadout is reported from start(), not from the constructor: the game
    // subscribes to codex:unlock after building the Run, so anything announced
    // during construction would be shouted into an empty room.
    for (const slot of this.slots) if (slot && slot.def) this.discover(`skill:${slot.def.id}`);
    // These are rules the player has now experienced, so the codex may explain
    // them. They are not "achievements" — the codex is a manual, and a manual
    // that withholds basic rules until you have already died to them is worse
    // than no manual.
    this.discover('world:night');
    this.discover('world:terrace');
    this.beginWave(1);
    this.setState(RUN_STATE.INTRO);
  }

  setState(next) {
    if (this.state === next) return;
    if ([RUN_STATE.INTRO, RUN_STATE.REWARD, RUN_STATE.DEAD, RUN_STATE.VICTORY].includes(next)) {
      this.cancelSkillQueue();
      if (this.dashQueue) this.dashQueue.length = 0;
      this.player.dashTime = 0;
    }
    this.state = next;
    this.emit('state', { state: next, previous: this.state });
  }

  emit(type, payload) { this.events.emit(type, payload); }

  /**
   * Record that the player has now MET something.
   *
   * The codex only reveals entries the player has actually encountered, so
   * discovery is reported from the run rather than being inferred later from a
   * save diff. The run does not know about the profile: it emits a key and the
   * game decides what to persist, which keeps the combat layer free of
   * persistence concerns and makes the codex testable without a save file.
   */
  discover(key) {
    if (!key) return;
    // Lazy init: the skill slots are built in the constructor before this set
    // exists, and they already want to report themselves.
    if (!this.discoveredKeys) this.discoveredKeys = new Set();
    if (this.discoveredKeys.has(key)) return;
    this.discoveredKeys.add(key);
    this.emit('codex:unlock', { key });
  }
  on(type, fn) { return this.events.on(type, fn); }

  /* ── waves ─────────────────────────────────────────────────────────────── */
  beginWave(wave) {
    this.wave = wave;
    // Entering a boss gate always leaves the player with one emergency answer.
    if (wave === 5) {
      this.heal(this.stats.hpMax * 0.22, { silent: true });
      this.energy = this.stats.energyMax;
      for (const slot of this.slots) {
        if (!slot) continue;
        const defensive = slot.def.category === 'defense' || slot.def.category === 'heal' || slot.def.category === 'mobility';
        slot.recharge = defensive ? 0 : slot.recharge * 0.5;
        slot.cd = defensive ? 0 : slot.cd * 0.5;
        if (defensive) slot.charges = Math.max(0, slot.maxCharges - (slot.reserved || 0));
      }
    }
    const plan = wavePlan(this.night, wave);
    this.act = plan.act;
    // A boss or miniboss from the PREVIOUS wave must never stand in this one.
    //
    // Wave 4 is a miniboss and wave 5 is the boss, so a player who out-damages
    // the miniboss into the next wave was fighting `grub_mother` and
    // `moon_devourer` at the same time — reported as "the boss fight has 2
    // bosses". The wave-clear check requires `!this.miniBoss`, but
    // `beginWave` was reachable with one still standing, and boss and miniboss
    // are tracked by different fields, so neither cleared the other.
    if (this.boss) { this.boss.dead = true; this.boss = null; }
    if (this.miniBoss) { this.miniBoss.dead = true; this.miniBoss = null; }
    // From night 10 the campaign keeps going and the boss roster rotates; below
    // that this is exactly the authored act boss.
    this.actBoss = bossForNight(this.night, plan.act);
    this.waveBudget = plan.budget;
    this.waveEnemiesLeft = 0;
    this.waveSpawned = 0;
    this.pendingSpawns.length = 0;
    this.setState(RUN_STATE.FIGHT);
    this.emit('wave:begin', { night: this.night, wave, plan });

    if (plan.isBoss) {
      this.spawnBoss(this.actBoss || this.act.boss);
      return;
    }
    if (plan.isMini) {
      this.spawnMiniBoss(this.act.miniBoss);
      return;
    }
    // Regular wave: build a queue of spawns from the act table.
    const count = Math.round(3 + plan.budget * (wave <= 2 ? 0.35 : 0.55));
    const eliteChance = clamp(0.03 + (this.night - 1) * 0.035 + wave * 0.01, 0, 0.28);
    const entries = [];
    for (let i = 0; i < count; i++) {
      const idx = weightedIndex(this.act.table, () => this.rng.float());
      const id = this.act.table[Math.max(0, idx)].id;
      entries.push({ id, elite: this.rng.chance(eliteChance) });
    }
    this.pendingSpawns = entries;
    this.waveEnemiesLeft = entries.length;
    this.waveSpawnTimer = 0.35;
  }

  /**
   * Choose a spot on the arena edge that is far enough from the player to be
   * fair, preferring the side facing away from where they are looking.
   * Evidence for fairness: the brief forbids enemies appearing on top of the
   * player, and this is the one function that decides where they appear.
   */
  pickSpawnPoint() {
    const p = this.player;
    const pad = 70;
    const top = PLAY.top + 18;
    const bottom = PLAY.bottom - 6;
    const lanes = 3;

    // Choose the wall explicitly rather than scoring candidates.
    //
    // Scoring looked tidier but kept collapsing onto one wall: with the player
    // near the middle, every candidate is roughly equidistant, so a small
    // "arrive from behind" bonus decided the whole thing and enemies always
    // entered from the same side — the widened half of the arena never saw a
    // single spawn.
    //
    // Now: usually come from the wall the player is furthest from (so arrivals
    // are readable and never in their lap), occasionally from the near wall (so
    // it does not become predictable). A same-wall spawn is only allowed when it
    // is comfortably far away.
    const centre = ARENA.w / 2;

    // Distance-band spawn.
    //
    // Wall spawns are fair but slow on a wide map: the enemy has to cross the
    // whole arena, and the player spends that time walking toward a fight that
    // has not started. When there is room, spawn at a readable distance
    // (420-620px, i.e. half a screen to a screen away) in the direction the
    // player is least likely to be looking. The wall path stays as the fallback
    // so a player camping a corner never gets a spawn in their face.
    //
    // Weighted 60/40: enough band spawns that fights start promptly, enough wall
    // spawns that enemies still walk in from the edges and the whole map is used.
    if (p && this.rng.chance(0.6)) {
      const lo = 420;
      const hi = 620;
      for (let attempt = 0; attempt < 6; attempt++) {
        const a = Math.PI + this.rng.range(-1.15, 1.15); // mostly behind
        const r = this.rng.range(lo, hi);
        const bx = p.x + Math.cos(a) * r;
        const by = clamp(p.y + Math.sin(a) * r * 0.45, top, bottom);
        if (bx > PLAY.left + 12 && bx < PLAY.right - 12) {
          const d = Math.hypot(bx - p.x, by - p.y);
          if (d >= lo * 0.9) return { x: bx, y: by };
        }
      }
    }

    const farSide = p ? (p.x < centre ? 1 : -1) : (this.rng.chance(0.5) ? 1 : -1);
    const side = this.rng.chance(0.72) ? farSide : -farSide;
    const lane = Math.floor(this.rng.float() * lanes);
    const jx = this.rng.range(0, 90);
    const y = clamp(
      top + ((bottom - top) * (lane + 0.5)) / lanes + this.rng.range(-16, 16),
      top,
      bottom,
    );

    // A wall spawn is only unfair if it lands near the player; distance is not
    // the metric, proximity is. Rejecting on distance alone made the near wall
    // unusable whenever the player stood in a corner, which made arrivals
    // perfectly predictable. So: take the sampled wall unless it is close to the
    // player, and slide the spawn furthest along that wall instead of jumping to
    // the opposite one.
    const wallX = (s) => (s > 0 ? ARENA.w - pad - jx : pad + jx);
    let x = wallX(side);
    if (p && Math.hypot(x - p.x, y - p.y) < 260) {
      // try the other two lanes on the same wall before abandoning it
      let best = null;
      let bestD = -1;
      for (let k = 0; k < lanes; k++) {
        const cy = clamp(top + ((bottom - top) * (k + 0.5)) / lanes, top, bottom);
        const d = Math.hypot(x - p.x, cy - p.y);
        if (d > bestD) { bestD = d; best = cy; }
      }
      if (bestD >= 260) {
        return { x: clamp(x, PLAY.left - 20, PLAY.right + 20), y: best };
      }
      x = wallX(-side);
    }
    return { x: clamp(x, PLAY.left - 20, PLAY.right + 20), y };
  }

  spawnBoss(bossId) {
    if ((this.boss && !this.boss.dead) || (this.miniBoss && !this.miniBoss.dead)) return null;
    const def = BOSS_BY_ID[bossId];
    const scale = difficultyScale(this.night, this.wave);
    const boss = this.makeEnemy(def, {}, { boss: true, scale });
    // Spawn INSIDE the playfield. GROUND_Y (512) is the floor line and sits below
    // PLAY.bottom (506); the first tick used to clamp it, which showed up as a
    // boss that was 1px out of bounds on spawn.
    boss.x = ARENA.w * 0.66;
    boss.y = (PLAY.top + PLAY.bottom) / 2;
    boss.hp = boss.hpMax = def.hp * (this.difficulty === 'hard' ? 1.25 : 1);
    this.enemies.push(boss);
    this.boss = boss;
    this.emit('boss:spawn', { enemy: boss, def });
  }

  spawnMiniBoss(id) {
    if ((this.boss && !this.boss.dead) || (this.miniBoss && !this.miniBoss.dead)) return null;
    const def = MINIBOSS_BY_ID[id];
    const scale = difficultyScale(this.night, this.wave);
    const e = this.makeEnemy(def, {}, { elite: 1, scale, mini: true });
    e.x = ARENA.w * 0.68;
    e.y = GROUND_Y;
    e.hp = e.hpMax = def.hp * scale.hp * (this.difficulty === 'hard' ? 1.2 : 1);
    this.enemies.push(e);
    this.miniBoss = e;
    this.waveEnemiesLeft = 1;
    this.emit('miniboss:spawn', { enemy: e, def });
  }

  makeEnemy(def, mod, opts = {}) {
    // Single choke point for every enemy that enters the arena, so the codex
    // learns about a creature the moment it appears rather than when it dies.
    // Meeting something and surviving is itself the achievement.
    if (def && def.id) this.discover(opts.boss || opts.mini ? `boss:${def.id}` : `enemy:${def.id}`);
    const scale = opts.scale || difficultyScale(this.night, this.wave);
    const eliteMod = opts.elite ? ELITE_MODS[Math.floor(this.rng.float() * ELITE_MODS.length)] : null;
    let hp = def.hp * scale.hp;
    if (eliteMod) hp *= eliteMod.hp;
    if (opts.boss) hp = def.hp;
    const dmg = def.damage * scale.dmg * (eliteMod ? eliteMod.dmg : 1) * (opts.boss ? 1 : 1);
    const e = {
      uid: this.uid++,
      id: def.id, def, name: def.name,
      x: 0, y: GROUND_Y, vx: 0, vy: 0, z: 0,
      facing: -1,
      radius: def.radius * (eliteMod ? eliteMod.scale : 1),
      hp, hpMax: hp,
      dmg,
      speed: def.speed * scale.speed * (eliteMod?.speed || 1),
      xp: def.xp * scale.xp * (eliteMod ? 2.2 : 1),
      gold: def.gold * scale.gold,
      tier: def.tier,
      behaviour: def.behaviour,
      state: 'idle',
      attackCd: this.rng.range(0.4, 1.6),
      windup: 0,
      windupTime: def.windup || 0.4,
      tellCount: 0,
      hurt: 0, dead: false, deathT: 0,
      slow: 0, slowTime: 0, poison: 0, poisonTime: 0, bleed: 0, bleedTime: 0,
      stun: 0, mark: 0, markTime: 0, root: 0,
      elite: !!opts.elite, eliteMod, boss: !!opts.boss, mini: !!opts.mini,
      phase: 0, attackIndex: 0, attackTimer: 1.4, telegraph: null,
      orbitDir: 1, orbitBias: 0,
      shield: def.shields ? Math.round(hp * 0.35) : 0,
      spawnT: 0, leapT: 0, leash: 0,
    };
    if (opts.boss) {
      e.phases = def.phases;
      e.speed = def.speed;
      e.dmg = def.damage * (this.difficulty === 'hard' ? 1.2 : 1);
    }
    return e;
  }

  /* ── main tick ─────────────────────────────────────────────────────────── */
  update(dt, input) {
    if (this.paused) return;
    this.time += dt;
    if (this.state === RUN_STATE.INTRO) {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) this.setState(RUN_STATE.FIGHT);
      this.updatePlayer(dt, input);
      this.updateEffects(dt);
      return;
    }
    if (this.state === RUN_STATE.DEAD || this.state === RUN_STATE.VICTORY) {
      this.updateEffects(dt);
      return;
    }
    if (this.state === RUN_STATE.LEVELUP || this.state === RUN_STATE.REWARD) {
      this.updateEffects(dt, false);
      return;
    }

    this.updatePlayer(dt, input);
    this.resolveWallCollisions();
    this.updateDash(dt);
    this.updatePhantomStep(dt);
    this.updateSkillCooldowns(dt);
    this.updateMinionShields(dt);
    this.updateEnemies(dt);
    this.updateBosses(dt);
    this.updateProjectiles(dt);
    this.updateHazards(dt);
    this.updateMinions(dt);
    this.updatePickups(dt);
    this.updateZones(dt);
    this.updateEffects(dt);
    this.updateSpawns(dt);
    this.updatePassiveEffects(dt);
    this.updateSkillAction(dt);
    this.updateBuffs(dt);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) { this.combo = 0; this.emit('combo:end', {}); }
    }
    if (this.hp <= 0) this.playerDeath();

    // wave completion
    const stragglers = this.enemies.some((e) => !e.dead);
    if (this.waveEnemiesLeft <= 0 && this.pendingSpawns.length === 0 && !this.boss && !this.miniBoss && !stragglers) {
      if (this.state === RUN_STATE.FIGHT && !this.waveCleared) {
        this.waveCleared = true;
        this.onWaveClear();
      }
    }
  }

  // The renderer needs sub-tick motion; the bot needs the same API. Clamp dt.
  step(dt, input) {
    if (dt > 0.08) dt = 0.08;
    this.update(dt, input);
  }

  /* ── player ────────────────────────────────────────────────────────────── */
  /** Keep the player (and enemies) out of solid crystal walls. */
  resolveWallCollisions() {
    const walls = this.zones.filter((z) => z.kind === 'wall');
    if (!walls.length) return;
    const p = this.player;
    for (const w of walls) {
      const dx = p.x - w.x;
      const dy = p.y - w.y;
      const d = Math.hypot(dx, dy);
      const minD = w.radius + p.radius * 0.55;
      if (d >= minD) continue;
      // Exact-centre case: the direction vector is undefined, so dividing by a
      // floored epsilon pushed the player 0.001 * minD pixels (i.e. nowhere) and
      // they stayed inside the wall. Pick a deterministic outward direction.
      if (d < 0.001) {
        p.x = clamp(w.x + minD, PLAY.left, PLAY.right);
        p.y = w.y;
        continue;
      }
      p.x = clamp(w.x + (dx / d) * minD, PLAY.left, PLAY.right);
      p.y = clamp(w.y + (dy / d) * minD, PLAY.top, PLAY.bottom);
    }
    for (const e of this.enemies) {
      if (e.dead || e.boss || e.mini) continue;
      for (const w of walls) {
        const dx = e.x - w.x;
        const dy = e.y - w.y;
        const d = Math.hypot(dx, dy);
        const minD = w.radius + e.radius * 0.5;
        if (d >= minD) continue;
        if (d < 0.001) { e.x = w.x + minD; continue; }
        e.x = w.x + (dx / d) * minD;
        e.y = w.y + (dy / d) * minD;
      }
    }
  }

  updatePlayer(dt, input) {
    const p = this.player;
    p.dashTime = Math.max(0, (p.dashTime || 0) - dt);
    if (!p.alive) return;
    const moving = !!(input && (input.moveX || input.moveY));
    const mvx = input?.moveX || 0;
    const mvy = input?.moveY || 0;
    const len = Math.hypot(mvx, mvy) || 1;
    // Debuffs actually apply. playerSlow was set by elite venom/warded hits and
    // playerRoot by thorn attacks, but nothing read either field, so both were
    // cosmetic: the effect fired, the aura drew, and the player moved at full
    // speed anyway.
    if (this.playerSlow && this.playerSlow.time > 0) {
      this.playerSlow.time -= dt;
      if (this.playerSlow.time <= 0) this.playerSlow = null;
    }
    if (this.playerRoot > 0) this.playerRoot -= dt;
    const slowMul = this.playerSlow ? clamp(1 - this.playerSlow.amount, 0.25, 1) : 1;
    const rootMul = this.playerRoot > 0 ? 0.25 : 1;
    const speed = this.stats.move * (p.moveSpeedMul || 1) * (1 + this.buffValue('move')) * slowMul * rootMul;
    if (moving) {
      p.vx = (mvx / len) * speed;
      p.vy = (mvy / len) * speed * 0.62; // vertical movement is compressed on the ground plane
      if (Math.abs(mvx) > 0.08) p.facing = mvx > 0 ? 1 : -1;
      p.held.x = mvx / len;
      p.held.y = mvy / len;
      p.walkT = (p.walkT || 0) + dt * (6 + speed * 0.02);
    } else {
      p.vx *= Math.pow(0.0015, dt);
      p.vy *= Math.pow(0.0015, dt);
    }
    // Movement integration. (Earlier revisions clamped here, which silently
    // pinned the player whenever a stale velocity was applied while idle — the
    // sim now always integrates with the current intent.)
    p.x = clamp(p.x + p.vx * dt, PLAY.left, PLAY.right);
    p.y = clamp(p.y + p.vy * dt, PLAY.top, PLAY.bottom);
    p.moving = moving;
    p.invuln = Math.max(0, p.invuln - dt);
    p.hurtFlash = Math.max(0, p.hurtFlash - dt * 3.2);

    // aim toward the held stick direction, else toward the nearest enemy
    if (moving && len > 0.15) p.aim = Math.atan2(p.held.y * 0.62, p.held.x);
    else {
      const target = this.nearestEnemy(p.x, p.y, 520);
      if (target) p.aim = angle(p.x, p.y, target.x, target.y);
    }

    // Attacks are manual: the player chooses when to use a skill.

    // dodge / dash input. Energy lives on the Run (the HUD reads run.energy),
    // so gate on this.energy — reading p.energy silently disabled the dash.
    if (input?.dodge && p.dashCd == null) p.dashCd = 0;
    if (input?.dodge && (p.dashCd || 0) <= 0 && this.energy >= DASH_COST) {
      this.discover('world:dodge');
      this.dashPlayer();
    }
    p.dashCd = Math.max(0, (p.dashCd || 0) - dt);

    // energy regen
    this.energy = Math.min(this.stats.energyMax, this.energy + (this.stats.energyRegen * this.buffValue('energyRegen', 1) + this.buffValue('energyRegenFlat')) * dt);
    // passive regen (never while downed — see heal())
    if (this.stats.regen && this.hp > 0) this.heal(this.stats.regen * dt, { silent: true });
    if (this.cat.passive.id === 'second_wind' && this.hp > 0 && this.hp / this.stats.hpMax < 0.4) {
      this.heal(this.stats.hpMax * 0.012 * dt, { silent: true });
    }
    // auto shield
    if (this.mods.autoShield > 0) {
      this.autoShieldTimer -= dt;
      if (this.autoShieldTimer <= 0) {
        this.autoShieldTimer = this.mods.autoShieldCd || 20;
        this.applyShield(this.stats.hpMax * this.mods.autoShield, 10);
      }
    }
    if (p.shieldTime > 0) {
      p.shieldTime -= dt;
      if (p.shieldTime <= 0) {
        p.shield = 0; p.shieldEffect = null;
        p.buffs = p.buffs.filter(b => !b.reflectProjectiles);
      }
    }
  }

  skillsBusy() {
    return this.state !== RUN_STATE.FIGHT && this.state !== RUN_STATE.INTRO;
  }

  dashTo(p, dx, dy, targetX, targetY, impact = null) {
    // Keep simultaneous dash effects in order. The next starts from the actual
    // end of the previous one rather than overriding its path from an old origin.
    this.dashQueue = this.dashQueue || [];
    if (!impact && this.dashQueue.length) return; // do not accumulate bot manoeuvres
    this.dashQueue.push({
      offsetX: targetX - p.x, offsetY: targetY - p.y, started: false,
      t: 0, duration: impact?.duration || 0.14, impact, hitIds: new Set(), trailTimer: 0,
    });
    if (this.dashQueue.length === 1) {
      p.dashTime = Math.max(p.dashTime, impact?.duration || 0.14);
      if (dx) p.facing = dx > 0 ? 1 : -1;
    }
  }

  updateDash(dt) {
    if (!this.dashQueue || !this.dashQueue.length) return;
    const p = this.player;
    let remaining = dt;
    while (remaining > 1e-9 && this.dashQueue.length) {
      const d = this.dashQueue[0];
      if (!d.started) {
        d.started = true; d.fromX = p.x; d.fromY = p.y;
        d.toX = clamp(p.x + d.offsetX, PLAY.left, PLAY.right);
        d.toY = clamp(p.y + d.offsetY, PLAY.top, PLAY.bottom);
        if (d.offsetX) p.facing = d.offsetX > 0 ? 1 : -1;
        if (d.impact?.invuln) p.invuln = Math.max(p.invuln, d.impact.invuln);
      }
      const slice = Math.min(remaining, d.duration - d.t);
      const oldX = p.x, oldY = p.y;
      d.t += slice; remaining -= slice;
      const k = Math.min(1, d.t / d.duration);
      const ease = 1 - Math.pow(1 - k, 3);
      p.x = d.fromX + (d.toX - d.fromX) * ease;
      p.y = d.fromY + (d.toY - d.fromY) * ease;
      if (d.impact) {
        const vx = p.x - oldX, vy = p.y - oldY;
        const len2 = vx * vx + vy * vy;
        for (const e of this.enemies) {
          if (e.dead || d.hitIds.has(e.uid)) continue;
          const u = len2 ? clamp(((e.x - oldX) * vx + (e.y - oldY) * vy) / len2, 0, 1) : 0;
          const ex = oldX + vx * u, ey = oldY + vy * u;
          if (dist2(ex, ey, e.x, e.y) > (d.impact.radius + e.radius) ** 2) continue;
          d.hitIds.add(e.uid);
          this.skillHit(e, d.impact.def, d.impact.power, d.impact.rv, Math.atan2(d.toY - d.fromY, d.toX - d.fromX));
          if (d.impact.def.id === 'thunder_step') {
            this.applyStatus(e, 'burn', this.skillDamage(d.impact.def, d.impact.power) * 0.08, 2);
          }
          this.emit('fx:impact', { x: e.x, y: e.y, radius: 28, color: d.impact.def.icon.tint });
        }
        d.trailTimer -= slice;
        if (d.trailTimer <= 0) {
          d.trailTimer = 0.045;
          this.emit('fx:dashTrail', { x: p.x, y: p.y, color: d.impact.def.icon.tint });
          if (d.impact.rv.trail) this.zones.push({ kind: 'fire', x: p.x, y: p.y, radius: 20,
            time: 0.8, t: 0, dps: this.skillDamage(d.impact.def, d.impact.power * 0.25),
            source: 'dashTrail', tint: '#ff8f4d' });
        }
      }
      if (k >= 1) this.dashQueue.shift();
    }
    const active = this.dashQueue[0];
    p.dashTime = active ? Math.max(0, active.duration - active.t) : 0;
  }

  updatePhantomStep(dt) {
    const ghost = this.phantomStep;
    if (!ghost) return;
    ghost.t += dt;
    if (ghost.t + 1e-9 < ghost.delay) return;
    const p = this.player;
    this.phantomStep = null;
    this.emit('fx:blink', { x: p.x, y: p.y, x2: ghost.x, y2: ghost.y, color: ghost.def.icon.tint });
    if (ghost.rv.decoy || ghost.rv.decoyBoom) {
      this.arcDamage(ghost.originX, ghost.originY, 74, 74, p.facing, TAU, ghost.def,
        ghost.power * (ghost.rv.decoyBoom ? 1 : ghost.rv.decoy), {}, true);
      this.emit('fx:nova', { x: ghost.originX, y: ghost.originY, radius: 74, color: ghost.def.icon.tint });
    }
    p.x = ghost.x; p.y = ghost.y;
    p.invuln = Math.max(p.invuln, ghost.rv.invuln || ghost.def.params.invuln || 0.2);
  }

  dashPlayer() {
    const p = this.player;
    const dirX = p.held.x || p.facing;
    const dirY = p.moving ? p.held.y : 0;
    p.invuln = Math.max(p.invuln, 0.24);
    p.dashTime = 0.18;
    p.vx = dirX * this.stats.move * 3.4;
    p.vy = dirY * this.stats.move * 2.1;
    this.energy = Math.max(0, this.energy - DASH_COST);
    p.dashCd = DASH_CD;
    this.emit('player:dash', { x: p.x, y: p.y, dir: Math.atan2(dirY, dirX) });
  }

  basicAttack(target) {
    const p = this.player;
    const stats = this.stats;
    p.facing = target.x >= p.x ? 1 : -1;
    p.attackCd = 1 / Math.max(0.4, stats.atkSpeed * 2.4);
    p.attackAnim = 1;
    this.attackCounter++;
    const a = angle(p.x, p.y, target.x, target.y);
    let critRoll = this.rng.float();
    const forceCrit = this.consumeForceCrit();
    const res = computeDamage({
      base: stats.atk, atk: 1, crit: this.effectiveCrit(), critDmg: stats.critDmg,
      roll: critRoll, forceCrit, execute: this.mods.execute, backstab: this.mods.backstab,
      targetHpFrac: target.hp / target.hpMax, roll02: 0.5,
    });
    let dmg = res.damage;
    if (this.attackCounter % 3 === 0 && this.mods.everyThird > 0) dmg *= 1 + this.mods.everyThird;
    if (this.mods.bleedEvery > 0 && this.attackCounter % this.mods.bleedEvery === 0) {
      this.applyStatus(target, 'bleed', 6, 3);
    }
    if (this.mods.slowOnHit > 0) this.applyStatus(target, 'slow', this.mods.slowOnHit, 1.5);
    if (this.mods.stunChance > 0 && this.rng.chance(this.mods.stunChance)) this.applyStatus(target, 'stun', 0.5);
    if (this.cat.passive.id === 'first_blood' && target.hp >= target.hpMax) dmg *= stats.critDmg;
    if (this.cat.passive.id === 'combo_flow') p.comboFlow = Math.min(0.4, (p.comboFlow || 0) + 0.04);
    if (this.cat.passive.id === 'marked_prey') {
      if (p.lastTarget === target.uid) dmg *= 1 + Math.min(0.5, (p.preyStacks || 0) * 0.08);
      p.preyStacks = p.lastTarget === target.uid ? (p.preyStacks || 0) + 1 : 1;
      p.lastTarget = target.uid;
    }
    if (this.mods.moonPact > 0 && this.moonPactReady) { dmg *= 3; this.moonPactReady = false; this.moonPactTimer = this.mods.moonPact; }
    this.hitEnemy(target, dmg, { source: 'basic', crit: res.isCrit, x: target.x, y: target.y - (target.def.radius || 14) });
    // tiny slash fx
    this.emit('fx:slash', { x: p.x, y: p.y - 20, facing: p.facing, crit: res.isCrit });
    if (this.mods.ricochet > 0) {
      const near = this.enemies.find((e) => !e.dead && e !== target && dist2(e.x, e.y, target.x, target.y) < 200 * 200);
      if (near) this.hitEnemy(near, dmg * this.mods.ricochet, { source: 'ricochet' });
    }
  }

  effectiveCrit() { return clamp(this.stats.crit + this.buffValue('crit'), 0, 0.85); }

  consumeForceCrit() {
    if (this.forceCrit) { this.forceCrit = false; return true; }
    return false;
  }

  /* ── skills ────────────────────────────────────────────────────────────── */
  updateSkillCooldowns(dt) {
    for (const slot of this.slots) {
      if (!slot) continue;
      const availableCap = slot.maxCharges - (slot.reserved || 0);
      if (slot.charges < availableCap && slot.recharge > 0) {
        slot.recharge -= dt;
        while (slot.recharge <= 0 && slot.charges < availableCap) {
          slot.charges++;
          this.emit('skill:ready', { slot: slot.index, id: slot.id });
          if (slot.charges < availableCap) slot.recharge += slot.rechargeDuration;
          else slot.recharge = 0;
        }
      }
      slot.cd = slot.charges > 0 ? 0 : Math.max(0, slot.recharge);
    }
  }

  canCast(slot) {
    if (!slot || this.state !== RUN_STATE.FIGHT) return false;
    const def = slot.def;
    if (slot.charges <= 0 || slot.cd > 0) return false;
    if (this.energy < def.cost) return false;
    if (def.params?.facing && !this.nearestEnemy(this.player.x, this.player.y, 999)) return false;
    return true;
  }

  // Reservations keep an accepted buffered input valid even if the player
  // dodges or spends energy before recovery ends. A short bounded FIFO prevents
  // unbounded tap spam while preserving the order of real inputs.
  cancelSkillQueue() {
    for (const queued of this.skillQueue) {
      const slot = this.slots[queued.index];
      if (!slot) continue;
      slot.reserved = Math.max(0, slot.reserved - 1);
      slot.charges = Math.min(slot.maxCharges - slot.reserved, slot.charges + 1);
      if (slot.charges === slot.maxCharges) slot.recharge = 0;
      slot.cd = slot.charges > 0 ? 0 : Math.max(0, slot.recharge);
      this.energy = Math.min(this.stats.energyMax, this.energy + queued.cost);
    }
    this.skillQueue.length = 0;
    this.player.skillAction = null;
  }

  updateSkillAction(dt) {
    const action = this.player.skillAction;
    if (action) {
      action.elapsed += dt;
      if (action.elapsed < action.duration) return;
      this.player.skillAction = null;
    }
    if (this.skillQueue.length && !this.player.skillAction && !this.dashQueue?.length && this.state === RUN_STATE.FIGHT) {
      const queued = this.skillQueue.shift();
      this.castSlot(queued.index, { reserved: true });
    }
  }

  castSlot(index, options = {}) {
    const slot = this.slots[index];
    if (!slot) return { ok: false, reason: 'empty' };
    if (!options.reserved && !this.canCast(slot)) {
      const reason = this.energy < slot.def.cost ? 'energy' : 'cooldown';
      this.emit('skill:denied', { slot: index, reason });
      return { ok: false, reason };
    }
    const def = slot.def;
    if (!options.reserved && (this.player.skillAction || this.dashQueue?.length)) {
      if (this.skillQueue.length >= 4) {
        this.emit('skill:denied', { slot: index, reason: 'queue' });
        return { ok: false, reason: 'queue' };
      }
      this.energy -= def.cost;
      slot.charges--;
      slot.reserved++;
      this.skillQueue.push({ index, cost: def.cost });
      this.emit('skill:queued', { slot: index, id: slot.id });
      return { ok: true, queued: true };
    }
    const values = skillValues(def, slot.rank, slot.branch ? this.branchMods(slot) : {});
    if (options.reserved) slot.reserved = Math.max(0, slot.reserved - 1);
    else this.energy -= def.cost;
    const animation = SKILL_ACTIONS[def.id];
    if (animation) this.player.skillAction = { id: def.id, elapsed: 0, duration: actionDuration(animation) };
    const casts = this.rng.chance(this.mods.echo) ? 2 : 1;
    // Powerful instant skills wind up briefly. Skills with their own impact
    // telegraph (meteor, beam, volley) already have a longer built-in delay.
    const windup = animation?.windup ?? ((def.rarity === 'epic' || def.rarity === 'mythic') &&
      !['meteor', 'beam', 'volley'].includes(def.pattern) ? 0.25 : 0);
    for (let i = 0; i < casts; i++) {
      if (windup) {
        this.emit('fx:skill', { id: def.id, pattern: def.pattern, glyph: def.icon.glyph,
          tint: def.icon.tint, x: this.player.x, y: this.player.y - 22, ultimate: def.rarity === 'epic' || def.rarity === 'mythic' });
        (this.slotsTimeouts ||= []).push({ at: this.time + windup, fn: () => this.executeSkill(slot, values, i) });
      } else this.executeSkill(slot, values, i);
    }
    const cooldown = Math.max(0.1, values.cd * (1 - clamp(this.stats.cdr + this.buffValue('cdr'), 0, 0.6)) / Math.sqrt(this.stats.atkSpeed * (1 + this.buffValue('atkSpeed'))));
    if (!options.reserved) slot.charges = Math.max(0, slot.charges - 1);
    if (slot.recharge <= 0) { slot.recharge = cooldown; slot.rechargeDuration = cooldown; }
    slot.cd = slot.charges > 0 ? 0 : slot.recharge;
    this.statsTotals.casts++;
    if (this.cat.passive.id === 'starlit') this.energy = Math.min(this.stats.energyMax, this.energy + 8);
    if (this.cat.passive.id === 'scheme') {
      if (this.lastCastSlot != null && this.lastCastSlot !== index) this.forceCrit = true;
      this.lastCastSlot = index;
    }
    this.emit('skill:cast', { slot: index, id: slot.id, values, x: this.player.x, y: this.player.y });
    return { ok: true };
  }

  branchMods(slot) {
    const branch = slot.def.branch?.options?.find((o) => o.id === slot.branch);
    return branch?.mods || {};
  }

  executeSkill(slot, values, castIndex = 0) {
    const def = slot.def;
    const p = this.player;
    const target = this.pickSkillTarget(def, values);
    const emitCast = (extra = {}) => this.emit('fx:skill', {
      id: def.id, pattern: def.pattern, glyph: def.icon.glyph, tint: def.icon.tint,
      x: p.x, y: p.y - 22, target, values, castIndex, ...extra,
    });
    const rv = values.rankValues || {};
    const baseDamage = typeof rv.damage === 'number' ? rv.damage : (def.params.damage ?? def.params.dmg ?? 1);
    const power = values.dmg * baseDamage;
    const potency = this.skillPotency(def);
    // Base skill hitbox size. Areas were wide enough that damage landed on
    // enemies the player never aimed at; this trims every pattern by the same
    // factor, then adds the player's own skillArea upgrades on top so the perk
    // still reads as a gain. Done here, once, so no pattern can be missed.
    const area = SKILL_HITBOX * (1 + this.mods.skillArea);
    switch (def.pattern) {
      case 'melee': {
        emitCast();
        const arcR = values.range * area;
        // Extended claw reach can exceed the generic targeting assist. Prefer a
        // reachable foe so an area upgrade never makes hits land behind the cat.
        const meleeTarget = def.id === 'claw_slash'
          ? this.nearestEnemy(p.x, p.y, Infinity, e => Math.hypot((e.x - p.x) * 0.9, e.y - p.y) <= arcR + e.radius) || target
          : target;
        const facing = meleeTarget ? (meleeTarget.x >= p.x ? 1 : -1) : p.facing;
        p.facing = facing; p.attackAnim = 1;
        const hits = rv.hits || def.params.hits || 1;
        for (let h = 0; h < hits; h++) {
          const swingDir = facing > 0 ? 0 : Math.PI;
          this.emit('fx:slash', { x: p.x, y: p.y - 24, facing, crit: false, skill: true, angle: swingDir, radius: arcR, strokes: def.id === 'claw_slash' ? 1 : 3 });
          this.arcDamage(p.x, p.y, arcR, arcR, facing, def.params.arc || 1.2, def, power, rv, false, 'skill', def.id === 'claw_slash');
        }
        break;
      }
      case 'combo': {
        emitCast();
        const count = rv.count || def.params.hits || 3;
        const radius = values.range * area;
        for (let i = 0; i < count; i++) {
          (this.slotsTimeouts ||= []).push({ at: this.time + i * (def.params.gap || 0.12), fn: () => {
            p.attackAnim = 1;
            const hit = this.arcDamage(p.x, p.y, radius, radius, p.facing, TAU, def, power,
              { ...rv, knock: i === count - 1 ? rv.knock : 0 }, true);
            this.emit('fx:nova', { x: p.x, y: p.y, radius, color: def.icon.tint });
            this.emit('fx:slash', { x: p.x, y: p.y - 24, facing: p.facing, skill: true,
              angle: (p.facing > 0 ? 0 : Math.PI) + (i - 1) * 0.4, radius, strokes: 1 });
            if (hit && rv.energyOnHit) this.energy = Math.min(this.stats.energyMax, this.energy + rv.energyOnHit);
          } });
        }
        break;
      }
      case 'dash': {
        emitCast();
        const dir = target ? angle(p.x, p.y, target.x, target.y) : { x: p.facing };
        const dx = target ? Math.cos(dir) : p.facing;
        const dy = target ? Math.sin(dir) * 0.4 : 0;
        p.invuln = Math.max(p.invuln, def.params.invuln ? 0.35 : 0.1);
        const impact = { def, power, rv, radius: (def.id === 'pounce' ? 30 : 78) * area, duration: def.params.duration, invuln: def.params.invuln ? 0.35 : 0.1 };
        this.dashTo(p, dx, dy, p.x + dx * values.range * area * potency, p.y + dy * values.range * area * potency, impact);
        this.emit('fx:dashTrail', { x: p.x, y: p.y, color: def.icon.tint });
        break;
      }
      case 'blink': {
        emitCast();
        let dx = p.held.x, dy = p.held.y;
        if (!dx && !dy) dx = p.facing;
        const len = Math.hypot(dx, dy) || 1;
        if (dx) p.facing = dx > 0 ? 1 : -1;
        const nx = clamp(p.x + (dx / len) * values.range * area * potency, PLAY.left, PLAY.right);
        const ny = clamp(p.y + (dy / len) * values.range * area * potency * 0.6, PLAY.top, PLAY.bottom);
        if (def.id === 'phantom_step') {
          this.phantomStep = { x: nx, y: ny, originX: p.x, originY: p.y, t: 0, delay: 1, def, power, rv };
          this.emit('fx:phantom', { x: nx, y: ny, color: def.icon.tint });
          break;
        }
        this.emit('fx:blink', { x: p.x, y: p.y, x2: nx, y2: ny, color: def.icon.tint });
        p.x = nx; p.y = ny;
        p.invuln = Math.max(p.invuln, rv.invuln || def.params.invuln || 0.2);
        if (rv.damage || rv.decoyBoom) {
          const radius = 86 * area;
          this.arcDamage(p.x, p.y, radius, radius, p.facing, TAU, def, power, rv, true);
          this.emit('fx:nova', { x: p.x, y: p.y, radius, color: def.icon.tint });
        }
        break;
      }
      case 'fish':
      case 'projectile': {
        emitCast();
        const count = rv.count || def.params.count || 1;
        // Aim at the hitbox centre with the same vertical compression as flight.
        // The other projectile families retain their existing tuning for now.
        const accurateAim = def.pattern === 'fish' || def.id === 'arcane_paw';
        const base = target ? (accurateAim
          ? Math.atan2((target.y - 12 - (p.y - 22)) / 0.72, target.x - p.x)
          : angle(p.x, p.y - 22, target.x, target.y)) : p.aim;
        if (accurateAim && Math.abs(Math.cos(base)) > 0.01) p.facing = Math.cos(base) > 0 ? 1 : -1;
        for (let i = 0; i < count; i++) {
          const spread = this.dataSpread(def, count, i, rv);
          this.spawnProjectile({
            x: p.x, y: p.y - 22, angle: base + spread,
            speed: def.params.speed, damage: this.skillDamage(def, power),
            radius: def.params.explode ? 9 : 6,
            pierce: Math.max(rv.pierce || def.params.pierce || 0, values.mods.pierce || 0) + this.mods.skillPierce,
            homing: def.params.homing || 0,
            explode: def.params.explode ? (def.params.blast || def.params.explode) * (rv.blast || 1) * (values.mods.blast || 1) * area : 0,
            burnDps: def.id === 'fireball' ? this.skillDamage(def, power) * 0.12 : 0,
            burn: !!rv.burnZone, tint: def.icon.tint, shape: def.icon.glyph,
            source: 'skill', owner: 'player', life: 2.6, knock: def.params.knock || (def.pattern === 'fish' ? 220 : 0),
            bounces: rv.bounce ? 1 : 0, onHitBlast: rv.explode ? 50 * area : 0, onHitBlastScale: rv.explode || 0,
          });
        }
        break;
      }
      case 'nova': {
        emitCast();
        const repeats = rv.repeats || def.params.repeats || 1;
        for (let i = 0; i < repeats; i++) {
          const t = this.slotsTimeouts = this.slotsTimeouts || [];
          t.push({ at: this.time + i * 0.22, fn: () => {
            const R = values.radius * area * (1 + i * 0.08);
            this.arcDamage(p.x, p.y, R, R, p.facing, TAU, def, power, rv, true);
            this.emit('fx:nova', { x: p.x, y: p.y, radius: R, color: def.icon.tint, delay: i });
            if (def.params.knock) this.knockbackArea(p.x, p.y, R, def.params.knock * (1 + this.mods.knock));
            if (rv.shards) {
              for (let shard = 0; shard < rv.shards; shard++) {
                const a = shard * TAU / rv.shards;
                this.spawnProjectile({ x: p.x + Math.cos(a) * 22, y: p.y - 22 + Math.sin(a) * 16,
                  angle: a, speed: 340, damage: this.skillDamage(def, power * 0.18), radius: 4,
                  tint: def.icon.tint, shape: 'shard', source: 'skill', owner: 'player', life: 0.65 });
              }
            }
          } });
        }
        break;
      }
      case 'chain': {
        emitCast();
        const jumps = rv.jumps || def.params.jumps || 2;
        let current = this.nearestEnemy(p.x, p.y, values.range * area);
        const visited = new Set();
        const points = [{ x: p.x, y: p.y - 22 }];
        // Jumps are bounces after the first impact; never hit the same foe twice.
        for (let i = 0; i <= jumps && current; i++) {
          visited.add(current.uid);
          points.push({ x: current.x, y: current.y - 18 });
          const hit = computeDamage({ base: this.skillDamage(def, power * (1 - i * 0.12)), atk: 1,
            crit: this.effectiveCrit(), critDmg: this.stats.critDmg, roll: this.rng.float(),
            forceCrit: this.consumeForceCrit(), execute: this.mods.execute, targetHpFrac: current.hp / current.hpMax });
          this.hitEnemy(current, hit.damage, { source: 'skill', crit: hit.isCrit });
          if (rv.stun) this.applyStatus(current, 'stun', rv.stun * potency);
          current = this.nearestEnemy(current.x, current.y, def.params.jumpRange || 180, (e) => !visited.has(e.uid));
        }
        this.emit('fx:chain', { points, color: def.icon.tint });
        break;
      }
      case 'meteor': {
        const count = rv.count || 1;
        for (let i = 0; i < count; i++) {
          const tx = target ? target.x + (i ? this.rng.range(-70, 70) : 0) : p.x + p.facing * 140;
          const ty = target ? target.y + (i ? this.rng.range(-24, 24) : 0) : p.y;
          const delay = (rv.delay || def.params.delay) + i * 0.12;
          this.hazards.push({ kind: 'meteor', x: tx, y: ty, radius: (def.params.radius) * area * (rv.radius || 1), delay, t: 0, damage: this.skillDamage(def, power), def, tint: def.icon.tint });
          this.emit('fx:telegraph', { x: tx, y: ty, radius: (def.params.radius) * area * (rv.radius || 1), delay, kind: 'meteor' });
        }
        emitCast();
        break;
      }
      case 'volley': {
        const count = rv.count || def.params.count;
        for (let i = 0; i < count; i++) {
          const tx = p.x + this.rng.range(-def.params.spread, def.params.spread) * (rv.spread || 1);
          const ty = clamp(p.y + this.rng.range(-def.params.spread, def.params.spread) * 0.5, PLAY.top, PLAY.bottom);
          this.hazards.push({
            kind: 'star', x: tx, y: ty, radius: def.params.radius * area, delay: def.params.delay + i * 0.08,
            t: 0, damage: this.skillDamage(def, power), def, tint: def.icon.tint,
            stun: i === count - 1 ? rv.stun : 0,
          });
        }
        emitCast();
        break;
      }
      case 'beam': {
        emitCast();
        const a2 = target ? angle(p.x, p.y - 22, target.x, target.y) : p.aim;
        const length = def.params.length * area;
        const width = def.params.width * area * (rv.width || 1);
        const repeats = rv.repeats || 1;
        for (let r = 0; r < repeats; r++) {
          this.hazards.push({ kind: 'beam', x: p.x, y: p.y - 22, angle: a2, length, width, delay: def.params.delay + r * 0.18, t: 0, damage: this.skillDamage(def, power), def, tint: def.icon.tint, slow: rv.slow });
        }
        break;
      }
      case 'shockwave': {
        emitCast();
        const count = rv.count || 1;
        for (let i = 0; i < count; i++) {
          this.spawnProjectile({
            x: p.x, y: p.y - 20, angle: (target ? angle(p.x, p.y, target.x, target.y) : p.aim) + i * 0.16,
            speed: def.params.speed, damage: this.skillDamage(def, power), radius: def.params.width * 0.4 * area * (rv.width || 1),
            pierce: rv.pierce ? 99 : 1, shape: 'wave', tint: def.icon.tint, source: 'skill', owner: 'player',
            life: 0.7, wide: true, knock: 90,
          });
        }
        break;
      }
      case 'teleportStrike': {
        const tgt = this.nearestEnemy(p.x, p.y, values.range * area);
        emitCast();
        if (!tgt) break;
        const back = tgt.facing > 0 ? -34 : 34;
        this.emit('fx:blink', { x: p.x, y: p.y, x2: tgt.x + back, y2: tgt.y, color: def.icon.tint });
        p.x = clamp(tgt.x + back, PLAY.left, PLAY.right);
        p.y = tgt.y;
        p.facing = tgt.x >= p.x ? 1 : -1;
        p.invuln = Math.max(p.invuln, 0.3);
        const forced = this.consumeForceCrit();
        const hit = computeDamage({ base: this.skillDamage(def, power), atk: 1, crit: this.effectiveCrit(),
          critDmg: this.stats.critDmg, roll: this.rng.float(), forceCrit: forced || !!rv.forceCrit,
          execute: this.mods.execute, targetHpFrac: tgt.hp / tgt.hpMax });
        this.hitEnemy(tgt, hit.damage, { source: 'skill', crit: hit.isCrit });
        this.emit('fx:slash', { x: tgt.x, y: tgt.y - 18, facing: p.facing, skill: true });
        if (rv.refundKill && tgt.dead) this.energy = Math.min(this.stats.energyMax, this.energy + def.cost);
        break;
      }
      case 'execute': {
        emitCast();
        const tgt = this.nearestEnemy(p.x, p.y, values.range * area);
        if (!tgt) break;
        const threshold = rv.threshold || def.params.threshold;
        const frac = tgt.hp / tgt.hpMax;
        const baseDamage = this.skillDamage(def, power);
        const weakened = frac <= threshold;
        // Bosses and minibosses cannot be deleted as a fraction of their HP.
        // They instead take the existing sixfold finisher hit at the threshold.
        const execute = weakened && !tgt.boss && !tgt.mini && baseDamage > 0;
        const dmg = execute ? tgt.hp : baseDamage * (weakened ? 6 : 1);
        this.hitEnemy(tgt, dmg, { source: 'skill', crit: true, execute });
        this.emit('fx:execute', { x: tgt.x, y: tgt.y - 20, kill: tgt.dead });
        if (rv.resetKill && tgt.dead) { slot.cd = 0; slot.charges = slot.maxCharges; slot.recharge = 0; }
        break;
      }
      case 'mark': {
        // A mark has no projectile or hitbox to enforce the declared range.
        // Do not use pickSkillTarget's generous 1.4x aim-assist range here.
        const tgt = this.nearestEnemy(p.x, p.y, values.range * (1 + this.mods.skillArea));
        emitCast({ target: tgt });
        if (!tgt) break;
        if (tgt.x !== p.x) p.facing = tgt.x > p.x ? 1 : -1;
        tgt.mark = (rv.amp || def.params.amp) * potency;
        tgt.markTime = def.params.time;
        tgt.markDps = rv.tick ? this.skillDamage(def, power * 0.25) : 0;
        this.emit('fx:mark', { x: tgt.x, y: tgt.y - 24, color: def.icon.tint });
        if (rv.spread) {
          const spreadRadius = rv.spread * (1 + this.mods.skillArea);
          for (const e of this.enemies) {
            if (!e.dead && e !== tgt && dist2(e.x, e.y, tgt.x, tgt.y) < spreadRadius * spreadRadius) {
              e.mark = tgt.mark; e.markTime = tgt.markTime; e.markDps = tgt.markDps;
              this.emit('fx:mark', { x: e.x, y: e.y - 24, color: def.icon.tint });
            }
          }
        }
        break;
      }
      case 'zone': {
        emitCast();
        const radius = (def.params.radius || 90) * area * (rv.radius || 1);
        const zx = target ? target.x : p.x + p.facing * 120;
        const zy = target ? target.y : p.y;
        this.zones.push({
          kind: 'zone', x: zx, y: zy, radius, time: rv.time || def.params.time, t: 0,
          slow: clamp((rv.slow ?? def.params.slow ?? 0) * potency, 0, 0.9), dps: this.skillDamage(def, power * ((def.params.dps || 0) + (rv.dps || 0))), pull: rv.pull || 0,
          tint: def.icon.tint, def, damagePerTick: this.skillDamage(def, power),
        });
        break;
      }
      case 'banana': {
        emitCast();
        const count = rv.count || 1;
        const radius = def.params.radius * area;
        // Face a nearby target while idle; held movement still controls the throw.
        if (!p.moving && target && target.x !== p.x) p.facing = target.x > p.x ? 1 : -1;
        const room = p.facing > 0 ? PLAY.right - p.x : p.x - PLAY.left;
        const spacing = Math.max(48, 2 * radius + 8);
        const sideways = count > 1 && room < 65 + (count - 1) * spacing;
        // Near an edge, fan along the playable vertical axis instead of clamping
        // several peels to one point and triggering all of them simultaneously.
        const yStep = sideways ? Math.min(spacing, (PLAY.bottom - PLAY.top) / (count - 1)) : 0;
        const yStart = sideways ? clamp(p.y - (count - 1) * yStep / 2, PLAY.top, PLAY.bottom - (count - 1) * yStep) : p.y;
        for (let i = 0; i < count; i++) {
          const x = clamp(p.x + p.facing * (65 + (sideways ? 0 : i * spacing)), PLAY.left, PLAY.right);
          this.traps.push({ x, y: sideways ? yStart + i * yStep : p.y,
            radius, root: (rv.root || def.params.root) * potency,
            time: def.params.time, t: 0, damage: this.skillDamage(def, power), tint: def.icon.tint, banana: true });
        }
        break;
      }
      case 'trap': {
        emitCast();
        const count = rv.count || 1;
        const radius = def.params.radius * area * (rv.radius || 1);
        const aim = p.moving ? p.aim : target ? angle(p.x, p.y, target.x, target.y) : p.aim;
        for (let i = 0; i < count; i++) {
          const side = (i - (count - 1) / 2) * (radius * 2 + 16);
          const tx = clamp(p.x + Math.cos(aim) * 110 * area - Math.sin(aim) * side, PLAY.left, PLAY.right);
          const ty = clamp(p.y + Math.sin(aim) * 110 * area + Math.cos(aim) * side, PLAY.top, PLAY.bottom);
          this.traps.push({ x: tx, y: ty, radius, root: (rv.root || def.params.root) * potency,
            time: def.params.time, t: 0, damage: rv.damage ? this.skillDamage(def, values.dmg) : 0,
            tint: def.icon.tint, revealTime: 3 });
        }
        break;
      }
      case 'orbit': {
        emitCast();
        const count = rv.count || def.params.count;
        for (let i = 0; i < count; i++) {
          this.minions.push({
            kind: 'orb', x: p.x, y: p.y, angle: (i / count) * TAU, radius: def.params.radius * area * (rv.radius || 1),
            damage: this.skillDamage(def, power), time: rv.time || def.params.time, t: 0,
            hitCd: new Map(), tint: def.icon.tint, slow: 0, def,
            shoot: !!rv.shoot, bleed: !!rv.bleed, burnTrail: !!rv.burnTrail, trailCd: 0,
          });
        }
        this.statsTotals.minions += count;
        break;
      }
      case 'summon': {
        emitCast();
        const count = rv.count || def.params.count;
        const power2 = 1 + this.mods.summonPower + (rv.power ? rv.power - 1 : 0);
        const baseType = def.params.kind;
        for (let i = 0; i < count; i++) {
          const kind = baseType === 'kitten' ? 'kitten' : baseType === 'spirit' ? 'spirit' : 'lion';
          this.minions.push({
            kind, x: p.x + this.rng.range(-40, 40), y: p.y, t: 0,
            life: (rv.time || def.params.duration),
            cd: 0.2, damage: this.skillDamage(def, power * (kind === 'kitten' ? 0.33 : 0.5)) * power2, hp: 40 * power2 * potency,
            maxHp: 40 * power2 * potency, attackCd: 0, facing: p.facing,
            power: power2, ranged: !!rv.ranged, taunt: !!rv.taunt, area: !!rv.aura && rv.aura === 'heal',
            moveMult: rv.speed || 1, healOnHit: rv.heal || 0,
            tint: def.icon.tint, def,
          });
          this.statsTotals.minions++;
        }
        break;
      }
      case 'buff': {
        emitCast({ buff: true });
        const time = rv.time || def.params.time;
        // Reapplying the veil refreshes it without detonating the old copy.
        if (def.id === 'night_veil') this.endNightVeil(false);
        this.addBuff({
          id: def.id, time,
          atkSpeed: (rv.atkSpeed ?? def.params.atkSpeed ?? 0) * potency,
          move: (rv.move ?? def.params.move ?? 0) * potency,
          armor: (rv.armor ?? def.params.armor ?? 0) * potency,
          reflect: (rv.reflect ?? def.params.reflect ?? 0) * potency,
          crit: (rv.crit ?? def.params.crit ?? 0) * potency,
          fortune: (rv.fortune ?? def.params.fortune ?? 0) * potency,
          goldGain: (rv.gold || 0) * potency,
          teamCrit: rv.team ? (rv.crit ?? def.params.crit ?? 0) * potency : 0,
          energyRegenFlat: rv.regen ? def.params.regen || 6 : 0,
          onHitHeal: (rv.onHitHeal || 0) * potency,
          reflectSplash: !!rv.splash,
          drawback: rv.noDrawback ? 0 : def.params.drawback || 0,
          forceCrit: !!rv.forceCrit,
          stealth: def.id === 'night_veil',
          veilBoom: def.id === 'night_veil' && rv.boom ? this.skillDamage(def, 1) : 0,
          stoneAura: def.id === 'stone_stance' && rv.thorns ? this.skillDamage(def, 0.4) : 0,
          stoneHeal: def.id === 'stone_stance' ? (rv.heal || 0) * potency : 0,
          stoneX: p.x, stoneY: p.y,
          trail: !!rv.trail,
          trailDamage: rv.trail ? this.skillDamage(def, power * 0.25) : 0,
          trailCooldown: 0, trailX: p.x, trailY: p.y,
          noKnockback: def.id === 'stone_stance' || !!rv.knockImmune,
          tint: def.icon.tint,
        });
        if (rv.forceCrit) this.forceCrit = true;
        break;
      }
      case 'shield': {
        emitCast({ buff: true });
        const amount = this.stats.hpMax * (def.params.shield || 0.3) * (rv.shield || 1) * potency;
        const shieldEffect = {
          id: def.id,
          breakHeal: rv.heal ? this.stats.hpMax * rv.heal * this.skillCoefficient(def) : 0,
          breakInvuln: rv.invuln || 0,
          breakBlast: rv.boom && def.id === 'purr_shield' ? { radius: 95 * area, damage: this.skillDamage(def, 0.8), tint: def.icon.tint } : null,
        };
        const duration = rv.time || def.params.time || 7;
        this.applyShield(amount, duration, shieldEffect);
        if (def.id === 'purr_shield' && rv.team) {
          const fraction = (def.params.shield || 0.3) * (rv.shield || 1) * potency;
          for (const m of this.minions) {
            if (m.kind === 'orb' || !(m.hp > 0) || !(m.life > 0) || !(m.maxHp > 0)) continue;
            if (dist2(m.x, m.y, p.x, p.y) > 180 * 180) continue;
            this.applyMinionShield(m, m.maxHp * fraction, duration, shieldEffect.breakBlast);
          }
        }
        if (def.params.reflectProjectiles) this.addBuff({ id: def.id, time: rv.time || def.params.time || 7,
          reflectProjectiles: true, reflectBlast: rv.boom ? 55 * area : 0 });
        if (def.params.reviveWard) { this.reviveWard = true; this.reviveWardTime = def.params.time || 8; }
        this.emit('fx:shield', { x: p.x, y: p.y, color: def.icon.tint });
        break;
      }
      case 'heal': {
        emitCast({ buff: true });
        const amount = this.stats.hpMax * (rv.heal ?? def.params.heal ?? 0.2) * this.skillCoefficient(def);
        this.heal(amount);
        if (rv.cleanse) this.playerSlow = null;
        if (rv.team) {
          const fraction = (rv.heal ?? def.params.heal ?? 0.2) * this.skillCoefficient(def);
          for (const m of this.minions) {
            if (m.kind === 'orb' || !(m.hp > 0) || !(m.life > 0) || !(m.maxHp > 0)) continue;
            if (dist2(m.x, m.y, p.x, p.y) <= 180 * 180) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * fraction);
          }
        }
        this.energy = Math.min(this.stats.energyMax, this.energy + ((rv.energy ?? def.params.energy) || 0) * potency);
        if (rv.overTime) {
          // Echo repeats the immediate heal, but refreshes one HoT rather than
          // multiplying a persistent buff. Subsequent casts replace its rate.
          const id = def.id + '_hot';
          const hot = p.buffs.find(b => b.id === id);
          if (hot) { hot.time = 5; hot.max = 5; hot.regen = amount / 5; }
          else this.addBuff({ id, time: 5, regen: amount / 5, tint: def.icon.tint });
        }
        if (rv.cdr) this.addBuff({ id: def.id + '_cdr', time: 8, cdr: rv.cdr, tint: def.icon.tint });
        this.emit('fx:heal', { x: p.x, y: p.y, color: def.icon.tint });
        break;
      }
      case 'drain': {
        emitCast();
        const tgt = this.nearestEnemy(p.x, p.y, values.range * area);
        if (!tgt) break;
        const hit = computeDamage({ base: this.skillDamage(def, power), atk: 1, crit: this.effectiveCrit(),
          critDmg: this.stats.critDmg, roll: this.rng.float(), forceCrit: this.consumeForceCrit(),
          execute: this.mods.execute, targetHpFrac: tgt.hp / tgt.hpMax });
        const dmg = hit.damage;
        const hpBefore = tgt.hp;
        const dealt = this.hitEnemy(tgt, dmg, { source: 'skill', crit: hit.isCrit });
        let effectiveDamage = Math.min(hpBefore, dealt);
        if (rv.area) {
          const nearby = this.enemies.filter(e => e !== tgt && !e.dead && dist2(e.x, e.y, tgt.x, tgt.y) < 100 * 100)
            .sort((a, b) => dist2(a.x, a.y, tgt.x, tgt.y) - dist2(b.x, b.y, tgt.x, tgt.y)).slice(0, 2);
          for (const e of nearby) {
            const hpBefore = e.hp;
            const dealt = this.hitEnemy(e, dmg * 0.35, { source: 'drain' });
            effectiveDamage += Math.min(hpBefore, dealt);
            this.emit('fx:drain', { x: p.x, y: p.y - 24, x2: e.x, y2: e.y - 20, color: def.icon.tint });
          }
        }
        this.heal(effectiveDamage * (rv.leech || def.params.leech || 0.6));
        this.emit('fx:drain', { x: p.x, y: p.y - 24, x2: tgt.x, y2: tgt.y - 20, color: def.icon.tint });
        break;
      }
      case 'aura': {
        emitCast({ buff: true });
        this.addBuff({
          id: def.id, time: def.params.time || 7, aura: def.icon.tint,
          radius: (def.params.radius || 100) * area * (rv.radius || 1),
          heal: (rv.heal || def.params.heal || 0) * potency, armor: (rv.armor || def.params.armor || 0) * potency,
          burn: (rv.burn || def.params.burn || 0) * potency, tint: def.icon.tint,
        });
        break;
      }
      case 'timeSlow': {
        emitCast();
        const radius = (def.params.radius || 220) * area * (rv.radius || 1);
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (dist2(e.x, e.y, p.x, p.y) < radius * radius) {
            this.applyStatus(e, 'slow', clamp((rv.slow || def.params.slow) * potency, 0, 0.9), rv.time || def.params.time);
            if (rv.amp) {
              const duration = (rv.time || def.params.time) * (e.boss ? 0.6 : e.mini ? 0.75 : e.elite ? 0.8 : 1);
              e.timeAmp = Math.max(e.timeAmp || 0, rv.amp);
              e.timeAmpTime = Math.max(e.timeAmpTime || 0, duration);
            }
          }
        }
        this.emit('fx:timeSlow', { x: p.x, y: p.y, radius, color: def.icon.tint });
        break;
      }
      case 'pull': {
        emitCast();
        const radius = (def.params.radius || 104) * area * (rv.radius || 1);
        this.zones.push({ kind: 'void', x: target ? target.x : p.x + p.facing * 150, y: target ? target.y : p.y, radius, time: def.params.pullTime, t: 0, pull: 1, tint: def.icon.tint, damagePerTick: this.skillDamage(def, power), bomb: this.skillDamage(def, power * 1.4), slow: rv.slow || 0, lifesteal: rv.lifesteal || 0, def });
        break;
      }
      case 'soul': {
        emitCast();
        const tgt = this.nearestEnemy(p.x, p.y, values.range * area);
        if (!tgt) break;
        const frac = tgt.hp / tgt.hpMax;
        const baseDamage = this.skillDamage(def, power);
        const execute = !tgt.boss && !tgt.mini && baseDamage > 0 &&
          frac <= clamp(rv.threshold || def.params.threshold, 0, 0.8);
        this.hitEnemy(tgt, execute ? tgt.hp : baseDamage, { source: 'skill', crit: true, execute });
        if (tgt.dead) {
          this.heal(this.stats.hpMax * (rv.heal || def.params.heal || 0.08) * this.skillCoefficient(def));
          this.soulDamageBonus += rv.stack || 0;
          this.emit('fx:soul', { x: tgt.x, y: tgt.y - 20, color: def.icon.tint });
        }
        break;
      }
      case 'boomerang': {
        emitCast();
        const count = rv.count || 1;
        const baseA = target ? angle(p.x, p.y - 22, target.x, target.y) : p.aim;
        for (let i = 0; i < count; i++) {
          this.spawnProjectile({
            x: p.x, y: p.y - 22, angle: baseA + this.dataSpread(def, count, i),
            speed: def.params.speed, damage: this.skillDamage(def, power), radius: 8,
            shape: def.icon.glyph, tint: def.icon.tint, source: 'skill', owner: 'player',
            boomerang: true, travel: def.params.dist * area, pierce: rv.pierce ? 3 : 1,
            root: rv.root || 0, life: 3, lifesteal: rv.lifesteal || 0,
            turnBlast: rv.trailBoom ? 55 * area : 0,
          });
        }
        break;
      }
      case 'barrage': {
        emitCast();
        const count = rv.count || def.params.count;
        for (let i = 0; i < count; i++) {
          const td = this.slotsTimeouts = this.slotsTimeouts || [];
          td.push({ at: this.time + i * (def.params.duration / Math.max(1, count - 1)), fn: () => {
            const tgt = this.nearestEnemy(p.x, p.y, def.range * area);
            const a2 = tgt ? angle(p.x, p.y - 22, tgt.x, tgt.y) : p.aim;
            this.spawnProjectile({
              x: p.x, y: p.y - 22, angle: a2 + this.rng.range(-def.params.spread / 2, def.params.spread / 2) * 0.5,
              speed: def.params.speed, damage: this.skillDamage(def, power), radius: 4,
              pierce: rv.pierce || 0, shape: 'needle', tint: def.icon.tint, source: 'skill', owner: 'player', life: 1.4,
            });
          } });
        }
        break;
      }
      default:
        emitCast();
        this.arcDamage(p.x, p.y, 90, 90, p.facing, TAU, def, power, rv, true);
    }
  }

  dataSpread(def, count, i, rv = {}) {
    if (count <= 1) return 0;
    const span = rv.spreadWide || def.params.spreadWide ? 0.7 : def.params.spread || 0.18;
    return (i - (count - 1) / 2) * span;
  }

  pickSkillTarget(def, values = null) {
    const p = this.player;
    const range = (values?.range || def.range || 200) * 1.4;
    return this.nearestEnemy(p.x, p.y, range) || null;
  }

  skillCoefficient(def) {
    const key = { health: 'skillScaleHealth', speed: 'skillScaleSpeed', armor: 'skillScaleArmor', damage: 'skillScaleDamage' }[skillScaling(def)];
    const value = this.profile?.settings?.[key];
    return Number.isFinite(value) ? clamp(value, 0, 3) : 1;
  }

  skillPotency(def) {
    const base = { health: this.stats.hpMax / 90, speed: this.stats.move / 210,
      armor: 1 + this.stats.def * 2, damage: this.stats.atk / 9 }[skillScaling(def)];
    return Math.max(0, base) * this.skillCoefficient(def);
  }

  skillDamage(def, power) {
    let mult = power;
    if (this.cat.passive.id === 'raw_channel' && (def.category === 'magic')) {
      mult *= 1 + (this.energy / Math.max(1, this.stats.energyMax)) * 0.35;
    }
    if (this.mods.goldenFur > 0 && this.hp / this.stats.hpMax > 0.7) mult *= 1 + this.mods.goldenFur;
    if (this.mods.lastStand > 0 && this.hp / this.stats.hpMax < 0.25) mult *= 1.3;
    return 9 * this.skillPotency(def) * mult;
  }

  applyShield(amount, time, effect = null) {
    const p = this.player;
    // Shields share one pool, not separate layers. Only a shield that actually
    // replaces the pool owns its break effect; weaker shields cannot steal it.
    if (amount > 0 && amount >= p.shield) p.shieldEffect = effect;
    p.shield = Math.max(p.shield, amount);
    p.shieldMax = Math.max(p.shieldMax || 0, amount);
    p.shieldTime = time;
    this.emit('fx:shield', { x: p.x, y: p.y, amount });
  }

  applyMinionShield(minion, amount, duration, breakBlast = null) {
    if (!(amount > 0)) return;
    if (amount >= (minion.shield || 0)) minion.shieldBlast = breakBlast;
    minion.shield = Math.max(minion.shield || 0, amount);
    minion.shieldMax = Math.max(minion.shieldMax || 0, amount);
    minion.shieldTime = duration;
    this.emit('fx:shield', { x: minion.x, y: minion.y, amount });
  }

  updateMinionShields(dt) {
    for (const m of this.minions) {
      if (!(m.shieldTime > 0)) continue;
      m.shieldTime = Math.max(0, m.shieldTime - dt);
      if (m.shieldTime === 0) { m.shield = 0; m.shieldMax = 0; m.shieldBlast = null; }
    }
  }

  damageMinion(target, amount) {
    if (!(target.hp > 0) || !(target.life > 0) || !(amount > 0)) return;
    let remaining = amount;
    if (target.shield > 0 && target.shieldTime > 0) {
      const absorbed = Math.min(target.shield, remaining);
      target.shield -= absorbed;
      remaining -= absorbed;
      this.emit('fx:shieldHit', { x: target.x, y: target.y, amount: absorbed });
      if (target.shield <= 0) {
        const burst = target.shieldBlast;
        target.shieldBlast = null;
        target.shieldTime = 0;
        target.shieldMax = 0;
        if (burst) this.blast({ x: target.x, y: target.y - 12, explode: burst.radius, damage: burst.damage, tint: burst.tint }, null, 1);
      }
    }
    target.hp = Math.max(0, target.hp - remaining);
  }

  addBuff(buff) {
    this.player.buffs.push({ ...buff, max: buff.time });
    this.emit('buff:add', buff);
  }

  buffValue(key, fallback = 0) {
    let v = 0;
    for (const b of this.player.buffs) if (b[key]) v = Math.max(v, b[key]);
    return v || fallback;
  }

  isVeiled() { return this.player.buffs.some((b) => b.stealth && b.time > 0); }

  endNightVeil(detonate = true) {
    const p = this.player;
    let damage = 0;
    for (let i = p.buffs.length - 1; i >= 0; i--) {
      if (p.buffs[i].id !== 'night_veil') continue;
      damage = Math.max(damage, p.buffs[i].veilBoom || 0);
      p.buffs.splice(i, 1);
    }
    if (detonate && damage > 0) this.blast({ x: p.x, y: p.y - 12, explode: 90, damage, tint: '#8b90b8' }, null, 1);
  }

  updateBuffs(dt) {
    const p = this.player;
    let emittedSprintTrail = false;
    let stoneHeal = 0, stoneDamage = 0;
    for (let i = p.buffs.length - 1; i >= 0; i--) {
      const b = p.buffs[i];
      const activeDt = Math.max(0, Math.min(dt, b.time));
      b.time -= dt;
      if (b.id === 'stone_stance') {
        const still = !p.moving && Math.hypot(p.x - b.stoneX, p.y - b.stoneY) < 0.01;
        if (still) stoneHeal = Math.max(stoneHeal, b.stoneHeal * activeDt);
        stoneDamage = Math.max(stoneDamage, b.stoneAura * activeDt);
        b.stoneX = p.x; b.stoneY = p.y;
      }
      if (b.regen || b.heal) this.heal(((b.regen || 0) + (b.heal || 0)) * activeDt, { silent: true });
      if (b.trail) {
        b.trailCooldown = Math.max(0, b.trailCooldown - dt);
        const moved = Math.hypot(p.x - b.trailX, p.y - b.trailY) > 0.01;
        if (b.time > 0 && p.moving && moved && b.trailCooldown <= 0) {
          if (!emittedSprintTrail) {
            this.zones.push({ kind: 'fire', x: p.x, y: p.y, radius: 20, time: 0.8, t: 0,
              dps: b.trailDamage, source: 'sprintTrail', tint: '#ff8f4d' });
            emittedSprintTrail = true;
          }
          b.trailCooldown = 0.25;
        }
        b.trailX = p.x; b.trailY = p.y;
      }
      if (b.burn) {
        for (const e of this.enemies) if (!e.dead && dist2(e.x, e.y, p.x, p.y) < (b.radius || 100) ** 2) this.hitEnemy(e, b.burn * dt, { source: 'aura', silent: true, tick: true });
      }
      if (b.time <= 0) {
        if (b.stealth) this.endNightVeil();
        else p.buffs.splice(i, 1);
      }
    }
    if (stoneHeal) this.heal(stoneHeal, { silent: true });
    if (stoneDamage) for (const e of this.enemies) {
      if (!e.dead && dist2(e.x, e.y, p.x, p.y) < (70 + e.radius) ** 2)
        this.hitEnemy(e, stoneDamage, { source: 'stance', tick: true, silent: true });
    }
  }

  /* ── attacks ───────────────────────────────────────────────────────────── */
  arcDamage(x, y, rx, ry, facing, arc, def, power, rv = {}, radial = false, source = 'skill', areaScaled = false) {
    // Some callers have already applied the skill-area upgrade to rx.
    const reach = areaScaled ? 1 : 1 + this.mods.skillArea;
    const list = this.enemies.filter((e) => !e.dead);
    let hitAny = false;
    for (const e of list) {
      const dx = e.x - x;
      const dy = e.y - y;
      const distE = Math.hypot(dx * 0.9, dy);
      if (distE > rx * reach + e.radius) continue;
      if (!radial) {
        const a = Math.atan2(dy, dx * facing);
        if (Math.abs(a) > arc / 2) continue;
      }
      hitAny = true;
      if (source === 'minion') this.hitEnemy(e, power, { source: 'minion' });
      else this.skillHit(e, def, power, rv);
    }
    if (!hitAny) this.emit('fx:whiff', { x, y });
    return hitAny;
  }

  skillHit(e, def, power, rv = {}, knockAngle = null) {
    const res = computeDamage({
      base: def ? this.skillDamage(def, power) : power, atk: 1, crit: this.effectiveCrit(), critDmg: this.stats.critDmg,
      roll: this.rng.float(), forceCrit: this.consumeForceCrit(),
      execute: this.mods.execute,
      targetHpFrac: e.hp / e.hpMax,
    });
    const hpBefore = e.hp;
    const dealt = this.hitEnemy(e, res.damage, { source: 'skill', crit: res.isCrit, silent: false });
    if (rv.status === 'bleed' || def?.params?.status === 'bleed') {
      // Claw's rank-five bleed scales with the same damage stat and coefficient
      // as its hit, but does not roll a second crit or on-hit effect.
      const bleed = def?.id === 'claw_slash' ? this.skillDamage(def, power) * 0.55 : 7;
      if (bleed > 0) this.applyStatus(e, 'bleed', bleed, rv.bleedTime || 3);
    }
    if (def?.params?.bleed === true) this.applyStatus(e, 'bleed', this.skillDamage(def, power) * 0.12, 3);
    if (def?.id === 'blood_fang' && !e.dead) {
      e.bloodFangStacks = Math.min(3, (e.bloodFangStackTime > 0 ? e.bloodFangStacks || 0 : 0) + 1);
      e.bloodFangStackTime = 6;
      const bleedDps = this.skillDamage(def, power) * 0.12 * (rv.bleed || 1) * e.bloodFangStacks;
      this.applyStatus(e, 'bleed', bleedDps, 6);
      if (rv.spread) for (const other of this.enemies) {
        if (other !== e && !other.dead && dist2(other.x, other.y, e.x, e.y) < 100 * 100) {
          this.applyStatus(other, 'bleed', bleedDps * 0.5, 2);
        }
      }
    }
    if (rv.stun || rv.freeze || def?.params?.freeze) this.applyStatus(e, 'stun', (rv.stun || rv.freeze || def.params.freeze) * (def ? this.skillPotency(def) : 1));
    if (def?.params?.slow) this.applyStatus(e, 'slow', clamp(def.params.slow * this.skillPotency(def), 0, 0.9), def.params.slowTime || 2);
    if (rv.knock) this.knockback(e, rv.knock, knockAngle);
    if (def?.params?.knock) this.knockback(e, def.params.knock * (1 + this.mods.knock), knockAngle);
    const leech = rv.lifesteal || def?.params?.lifesteal || 0;
    if (leech) this.heal(Math.min(hpBefore, dealt) * leech, { silent: true });
    if (rv.execute && (e.hp / e.hpMax) < rv.execute && !e.boss && !e.mini) this.hitEnemy(e, e.hp + 1, { source: 'execute', silent: true });
  }
  knockback(enemy, force, knockAngle = null) {
    if (enemy.boss || enemy.mini) return;
    const a = knockAngle ?? angle(this.player.x, this.player.y, enemy.x, enemy.y);
    enemy.knockX = (enemy.knockX || 0) + Math.cos(a) * force;
    enemy.knockY = (enemy.knockY || 0) + Math.sin(a) * force * 0.4;
    enemy.knockT = 0.24;
  }

  knockbackArea(x, y, radius, force) {
    for (const e of this.enemies) {
      if (e.dead || e.boss || e.mini) continue;
      if (dist2(e.x, e.y, x, y) < radius * radius) {
        const a = angle(x, y, e.x, e.y);
        e.knockX = (e.knockX || 0) + Math.cos(a) * force;
        e.knockY = (e.knockY || 0) + Math.sin(a) * force * 0.4;
        e.knockT = 0.26;
      }
    }
  }

  /** Single damage funnel. Returns the damage actually dealt. */
  hitEnemy(enemy, amount, opts = {}) {
    if (!enemy || enemy.dead || !(amount > 0)) return 0;
    let dmg = amount * (1 + this.soulDamageBonus);
    // Lucky Paw rank five shares only its own bonus with living summons.
    // Orbiting objects, DoTs, blasts and reflected shots do not roll summon crits.
    const teamCrit = this.buffValue('teamCrit');
    if (opts.source === 'minion' && !opts.tick && teamCrit > 0 && this.rng.chance(clamp(teamCrit, 0, 0.85))) {
      dmg *= this.stats.critDmg;
      opts = { ...opts, crit: true };
    }
    // On-hit upgrades used to trigger only from the removed auto attack.
    // Keep them useful on deliberate skill hits instead.
    if (opts.source === 'skill' && !opts.tick) {
      this.attackCounter++;
      if (this.mods.everyThird > 0 && this.attackCounter % 3 === 0) dmg *= 1 + this.mods.everyThird;
      if (this.mods.slowOnHit > 0) this.applyStatus(enemy, 'slow', this.mods.slowOnHit, 1.5);
      if (this.mods.stunChance > 0 && this.rng.chance(this.mods.stunChance)) this.applyStatus(enemy, 'stun', 0.5);
      if (this.mods.moonPact > 0 && this.moonPactReady) { dmg *= 3; this.moonPactReady = false; this.moonPactTimer = this.mods.moonPact; }
      if (this.stats.lifesteal > 0) this.heal(dmg * this.stats.lifesteal, { silent: true });
    }
    if (enemy.mark || enemy.timeAmp) dmg *= 1 + (enemy.mark || 0) + (enemy.timeAmp || 0);
    if (opts.execute) dmg = enemy.hp;
    if (enemy.mini || enemy.boss) dmg *= 1;
    // Bosses and wardens take reduced damage from summons so a passive build
    // cannot out-tick the encounter's scripted pressure.
    if ((enemy.boss || enemy.mini) && opts.source === 'minion') dmg *= 0.55;
    if ((enemy.boss || enemy.mini) && opts.source === 'orbit') dmg *= 0.7;
    enemy.hp -= dmg;
    enemy.hurt = 1;
    this.statsTotals.damage += dmg;
    if (!opts.tick) {
      this.emit('fx:hit', { x: enemy.x, y: enemy.y - (enemy.def.radius || 14) * 0.9, amount: dmg, crit: !!opts.crit, source: opts.source, enemy });
      this.emit('damage', { amount: dmg, crit: !!opts.crit, x: enemy.x, y: enemy.y - (enemy.def.radius || 14) - 12, target: 'enemy' });
    }
    if (opts.crit && opts.source !== 'minion') this.player.attackAnim = 1;
    if (enemy.hp <= 0) this.killEnemy(enemy, opts);
    if (opts.source === 'skill' && !opts.tick && this.isVeiled()) this.endNightVeil();
    return dmg;
  }

  applyStatus(enemy, type, power, time) {
    if (!enemy || enemy.dead) return;
    if (type === 'bleed') { enemy.bleed = enemy.bleedTime > 0 ? Math.max(enemy.bleed || 0, power) : power; enemy.bleedTime = Math.max(enemy.bleedTime || 0, time); }
    else if (type === 'slow') {
      const cap = enemy.boss ? 0.35 : enemy.mini ? 0.45 : enemy.elite ? 0.6 : 0.9;
      const duration = time * (enemy.boss ? 0.6 : enemy.mini ? 0.75 : enemy.elite ? 0.8 : 1);
      enemy.slow = Math.max(enemy.slow, Math.min(power, cap));
      enemy.slowTime = Math.max(enemy.slowTime, duration);
    } else if (type === 'stun' || type === 'root') {
      // Boss and warden hard control share a lockout; spamming separate skills
      // cannot indefinitely suppress the attack loop. Root restricts movement,
      // but unlike stun it does not interrupt attacks.
      if ((enemy.boss || enemy.mini) && (enemy.controlImmuneUntil || 0) > this.time) return;
      const duration = enemy.boss ? Math.min(power, 0.3) : enemy.mini ? Math.min(power, 0.45) : enemy.elite ? power * 0.65 : power;
      enemy[type] = Math.max(enemy[type] || 0, duration);
      if (enemy.boss || enemy.mini) enemy.controlImmuneUntil = this.time + (enemy.boss ? 2 : 1.5);
    }
    else if (type === 'poison') { enemy.poison = Math.max(enemy.poison, power); enemy.poisonTime = Math.max(enemy.poisonTime, time); }
    else if (type === 'burn') { enemy.burn = Math.max(enemy.burn || 0, power); enemy.burnTime = Math.max(enemy.burnTime || 0, time); }
  }

  killEnemy(enemy, opts = {}) {
    if (enemy.dead) return;
    enemy.dead = true;
    enemy.deathT = 0;
    enemy.hp = 0;
    this.kills++;
    if (enemy.elite) this.elites++;
    this.combo++;
    this.comboTimer = this.comboWindow;
    this.bestStreak = Math.max(this.bestStreak, this.combo);
    this.emit('enemy:death', { enemy, x: enemy.x, y: enemy.y, elite: !!enemy.elite, boss: !!enemy.boss, mini: !!enemy.mini });
    // xp & gold drops
    const xp = Math.round(enemy.xp * (1 + this.mods.xpGain));
    this.spawnPickup(enemy.x, enemy.y, 'xp', xp);
    const fortune = Math.max(0, (this.mods.fortune || 0) + this.buffValue('fortune'));
    const dropChance = (base) => clamp(base * (1 + fortune), 0, 1);
    const goldGain = this.mods.goldGain + this.buffValue('goldGain');
    if (this.rng.chance(dropChance(clamp(enemy.gold, 0.02, 1)))) this.spawnPickup(enemy.x + this.rng.range(-12, 12), enemy.y, 'gold', Math.max(1, Math.round(enemy.gold * 3 * (1 + goldGain))));
    if (this.rng.chance(dropChance(0.035)) && !enemy.boss) this.spawnPickup(enemy.x, enemy.y, 'hp', 0.08);
    // Permanent-upgrade currency drops often enough to make early progress.
    if (enemy.boss || enemy.mini) {
      // Credit boss rewards immediately: the wave can end before loot is collected.
      this.embersFound = (this.embersFound || 0) + (enemy.boss ? 20 : 10);
      this.emit('pickup', { kind: 'ember', x: enemy.x, y: enemy.y, auto: true });
    } else if (this.rng.chance(dropChance(0.18))) this.spawnPickup(enemy.x + 10, enemy.y, 'ember', 2);
    if (this.mods.killHeal) this.heal(this.stats.hpMax * this.mods.killHeal, { silent: true });
    if (this.mods.killBoom) {
      this.arcDamage(enemy.x, enemy.y, 70, 70, 1, TAU, null, this.mods.killBoom, {}, true);
      this.emit('fx:burst', { x: enemy.x, y: enemy.y - 14, color: '#ff5f6d', radius: 70 });
    }
    if (opts.source === 'skill' && this.mods.skillDot > 0) void 0;
    // wave bookkeeping
    if (!enemy.boss && !enemy.mini) this.waveEnemiesLeft = Math.max(0, this.waveEnemiesLeft - 1);
    if (enemy === this.boss) {
      this.boss = null;
      this.onBossDefeated();
    }
    if (enemy === this.miniBoss) {
      this.miniBoss = null;
      this.waveEnemiesLeft = 0;
      this.pendingSpawns.length = 0;
    }
  }

  onBossDefeated() {
    this.gold += 20;
    this.waveEnemiesLeft = 0;
    this.pendingSpawns.length = 0;
    this.emit('boss:defeated', { night: this.night });
  }

  /* ── enemy AI ──────────────────────────────────────────────────────────── */
  updateEnemies(dt) {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead) { e.deathT += dt; continue; }
      e.hurt = Math.max(0, e.hurt - dt * 4);
      if (e.knockT > 0) {
        const step = Math.min(dt, e.knockT);
        e.knockT = Math.max(0, e.knockT - dt);
        e.x = clamp(e.x + (e.knockX || 0) * step, PLAY.left, PLAY.right);
        e.y = clamp(e.y + (e.knockY || 0) * step, PLAY.top, PLAY.bottom);
        if (e.knockT === 0) { e.knockX = 0; e.knockY = 0; }
      }
      if (e.burnTime > 0) {
        const step = Math.min(dt, e.burnTime);
        e.burnTime = Math.max(0, e.burnTime - dt);
        this.hitEnemy(e, e.burn * step, { source: 'burn', tick: true, silent: true });
        if (e.dead) continue;
      }
      if (e.slowTime > 0) { e.slowTime -= dt; if (e.slowTime <= 0) e.slow = 0; }
      if (e.revealTime > 0) e.revealTime = Math.max(0, e.revealTime - dt);
      if (e.poisonTime > 0) { e.poisonTime -= dt; this.hitEnemy(e, e.poison * dt, { tick: true, silent: true }); if (e.dead) continue; }
      if (e.bleedTime > 0) {
        const elapsed = Math.min(dt, e.bleedTime);
        e.bleedTime = Math.max(0, e.bleedTime - dt);
        this.hitEnemy(e, e.bleed * elapsed, { tick: true, silent: true });
        if (e.dead) continue;
      }
      if (e.bloodFangStackTime > 0) { e.bloodFangStackTime -= dt; if (e.bloodFangStackTime <= 0) e.bloodFangStacks = 0; }
      if (e.markTime > 0) {
        const elapsed = Math.min(dt, e.markTime);
        if (e.markDps) this.hitEnemy(e, e.markDps * elapsed, { source: 'mark', tick: true, silent: true });
        e.markTime -= dt;
        if (e.markTime <= 0) { e.mark = 0; e.markDps = 0; }
        if (e.dead) continue;
      }
      if (e.timeAmpTime > 0) { e.timeAmpTime -= dt; if (e.timeAmpTime <= 0) e.timeAmp = 0; }
      // Bosses have a separate brain; their hard-control timers run there only.
      if (e.boss || e.mini || e.behaviour === 'boss') continue;
      if (e.stun > 0) { e.stun -= dt; continue; }
      if (e.root > 0) { e.root -= dt; continue; }
      e.spawnT += dt;
      if (e.behaviour === 'boss') continue; // bosses run their own state machine
      // Summoned minions get a short materialisation window in which they cannot
      // attack. Without it a boss could drop three enemies straight into melee
      // range and they would all hit on the same frame the summon landed, which
      // reads as unavoidable damage rather than a summon the player misplayed.
      if (e.spawnGrace > 0) { e.spawnGrace -= dt; continue; }
      const speedMul = 1 - (e.slow || 0);
      // Lion taunt diverts ordinary touch attackers only; telegraphed ranged
      // attacks and boss AI keep targeting the player.
      let aggroTarget = p;
      if (e.def.attack === 'touch') {
        let best = 210 * 210;
        for (const m of this.minions) {
          if (m.kind !== 'lion' || !m.taunt || m.life <= 0 || m.hp <= 0) continue;
          const distance = dist2(e.x, e.y, m.x, m.y);
          if (distance < best) { best = distance; aggroTarget = m; }
        }
      }
      // Ordinary enemies lose track of a veiled player, but may continue
      // attacking a taunting lion. Existing hazards/projectiles remain live.
      if (aggroTarget === p && this.isVeiled()) {
        e.windupT = 0; e.leash = 0;
        e.attackCd = Math.max(0, e.attackCd - dt);
        if (e.burstT > 0) e.burstT = Math.max(0, e.burstT - dt);
        if (e.leapT > 0) e.leapT = Math.max(0, e.leapT - dt);
        if (e.diveT > 0) e.diveT = Math.max(0, e.diveT - dt);
        continue;
      }
      const tx = aggroTarget.x;
      const ty = aggroTarget.y;
      const d = dist(e.x, e.y, tx, ty);
      const dirToPlayer = angle(e.x, e.y, tx, ty);
      e.facing = tx >= e.x ? 1 : -1;
      let wantX = 0;
      let wantY = 0;

      switch (e.behaviour) {
        case 'chase':
          wantX = Math.cos(dirToPlayer);
          wantY = Math.sin(dirToPlayer) * 0.6;
          break;
        case 'strafe': {
          const orbit = dirToPlayer + Math.PI / 2;
          if (d > 150) { wantX = Math.cos(dirToPlayer); wantY = Math.sin(dirToPlayer) * 0.6; }
          else { wantX = Math.cos(orbit) * 0.9; wantY = Math.sin(orbit) * 0.5; }
          break;
        }
        case 'rush':
          wantX = Math.cos(dirToPlayer) * 1.3;
          wantY = Math.sin(dirToPlayer) * 0.8;
          break;
        case 'keepDistance': {
          const pref = e.def.preferred || 220;
          // Ranged units commit: outside their firing window they close in.
          if (d > pref + 40 || e.attackCd > 1.4) { wantX = Math.cos(dirToPlayer); wantY = Math.sin(dirToPlayer) * 0.6; }
          else if (d < pref - 70) { wantX = -Math.cos(dirToPlayer) * 1.1; wantY = -Math.sin(dirToPlayer) * 0.7; }
          else { wantX = Math.cos(dirToPlayer + Math.PI / 2) * 0.35; wantY = Math.sin(dirToPlayer + Math.PI / 2) * 0.25; }
          break;
        }
        case 'orbit': {
          const orbit = this.time * 0.7 + e.uid;
          wantX = Math.cos(orbit) * 0.8 + Math.cos(dirToPlayer) * 0.35;
          wantY = Math.sin(orbit) * 0.4 + Math.sin(dirToPlayer) * 0.25;
          break;
        }
        case 'leap':
          if (e.leapT > 0) {
            e.leapT -= dt;
            wantX = Math.cos(e.leapDir) * 1.6;
            wantY = Math.sin(e.leapDir) * 1.0;
          } else if (e.attackCd <= 0 && d < 320) {
            e.leapT = e.def.leapTime;
            e.leapDir = dirToPlayer;
            e.attackCd = 2.4;
            this.emit('enemy:leap', { enemy: e });
          } else if (d > 90) { wantX = Math.cos(dirToPlayer) * 0.5; wantY = Math.sin(dirToPlayer) * 0.3; }
          break;
        case 'phaseStalk': {
          // Fades, closes the gap from behind, then snaps solid and strikes.
          // Counter-play is lateral movement: it commits to a straight line.
          e.fade = clamp(1 - Math.max(0, d - e.def.strikeRange) / (e.def.fadeRange || 260), 0.18, 1);
          const strikeRange = e.def.strikeRange || 96;
          if (d > strikeRange) {
            const side = Math.sin(this.time * 1.1 + e.uid) * 0.5;
            wantX = Math.cos(dirToPlayer + side) * 1.25;
            wantY = Math.sin(dirToPlayer + side) * 0.8;
          } else {
            wantX = Math.cos(dirToPlayer) * 1.9;
            wantY = Math.sin(dirToPlayer) * 1.1;
          }
          break;
        }
        case 'advance': {
          // Slow armoured advance. Never stops, never speeds up: you route around
          // it rather than outrun it.
          wantX = Math.cos(dirToPlayer);
          wantY = Math.sin(dirToPlayer) * 0.62;
          break;
        }
        case 'diveBomb': {
          // Airborne: circles high, then commits to a curved dive. The curve is
          // what makes it different from the leaper's straight jump.
          e.diveCd = (e.diveCd || 0) - dt;
          if (e.diveT > 0) {
            e.diveT -= dt;
            const bend = 1.5 * Math.sin(e.diveT * 6);
            wantX = Math.cos(e.diveDir + bend) * 1.9;
            wantY = Math.sin(e.diveDir + bend) * 1.1;
          } else if (e.diveCd <= 0 && d < 380) {
            e.diveT = 0.55;
            e.diveDir = dirToPlayer;
            e.diveCd = e.def.diveCd || 2.2;
            this.emit('enemy:dive', { enemy: e });
          } else {
            const orbit = this.time * 1.3 + e.uid;
            wantX = Math.cos(orbit) * 0.7 + Math.cos(dirToPlayer) * 0.3;
            wantY = Math.sin(orbit) * 0.5 + Math.sin(dirToPlayer) * 0.2;
          }
          break;
        }
        case 'creep': {
          // Bobs toward the player, then PLANTS while its bomb arms.
          //
          // It originally kept creeping through the fuse, so the blast detonated
          // wherever the player had been forced to — the swell telegraph said
          // "a circle is coming here" while the slime quietly walked the circle
          // onto you, and walking away did not help. Rooting it makes the
          // telegraph mean what it says and gives the fuse a real answer: leave.
          if (e.burstT > 0) {
            wantX = 0;
            wantY = 0;
          } else {
            wantX = Math.cos(dirToPlayer) * 0.95;
            wantY = Math.sin(dirToPlayer) * 0.55;
          }
          break;
        }
        case 'siege': {
          // Holds a long range and keeps still while planting thorns.
          const pref = e.def.preferred || 300;
          if (d > pref + 60) { wantX = Math.cos(dirToPlayer) * 0.9; wantY = Math.sin(dirToPlayer) * 0.55; }
          else if (d < pref - 80) { wantX = -Math.cos(dirToPlayer) * 0.7; wantY = -Math.sin(dirToPlayer) * 0.45; }
          else { wantX = 0; wantY = 0; }
          break;
        }
        case 'stalk':
          e.attackCd -= dt;
          if (e.attackCd > 0) {
            const side = Math.sin(this.time * 0.8 + e.uid) * 0.7;
            wantX = Math.cos(dirToPlayer + side) * 0.6;
            wantY = Math.sin(dirToPlayer + side) * 0.4;
          } else {
            wantX = Math.cos(dirToPlayer) * 2.2;
            wantY = Math.sin(dirToPlayer) * 1.2;
            if (d < 70) { e.attackCd = 2.6; this.enemyTouch(e, 1.2, aggroTarget); }
          }
          break;
        default:
          wantX = Math.cos(dirToPlayer); wantY = Math.sin(dirToPlayer) * 0.6;
      }

      const sp = e.speed * speedMul;
      const prevX = e.x;
      const prevY = e.y;
      e.x += wantX * sp * dt;
      e.y += wantY * sp * dt;
      // Crystal Crawler seeds shards as it walks: a moving area-denial trail
      // rather than a one-off attack.
      if (e.def.drops === 'crystal') {
        e.dropCd = (e.dropCd || 0) - dt;
        const moved = Math.hypot(e.x - prevX, e.y - prevY);
        if (e.dropCd <= 0 && moved > 0.01) {
          e.dropCd = e.def.dropCd || 2.2;
          this.spawnHazardPatch(e.x, e.y, 26, e.dmg * 0.3, 1.2, '#7fd4d8', e);
        }
      }
      e.x = clamp(e.x, PLAY.left - 40, PLAY.right + 40);
      e.y = clamp(e.y, PLAY.top - 20, PLAY.bottom + 10);

      // separation so crowds do not stack into one blob
      for (const o of this.enemies) {
        if (o === e || o.dead) continue;
        const dx = o.x - e.x;
        const dy = (o.y - e.y) * 1.6;
        const dd = dx * dx + dy * dy;
        const minD = (o.radius + e.radius) * 0.8;
        if (dd < minD * minD && dd > 0.01) {
          const len = Math.sqrt(dd);
          const push = (minD - len) * 0.5;
          e.x -= (dx / len) * push;
          e.y -= (dy / len) * push * 0.5;
        }
      }

      // if a unit has been idle too long, it commits to the player
      if (Math.abs(wantX) + Math.abs(wantY) < 0.05) e.leash += dt; else e.leash = 0;
      if (e.leash > 1.1) {
        e.x += Math.cos(dirToPlayer) * e.speed * dt;
        e.y += Math.sin(dirToPlayer) * e.speed * 0.6 * dt;
      }
      // attacks
      if (e.burstT > 0) e.burstT -= dt;
      if (e.windupT > 0) {
        e.windupT -= dt;
        if (e.windupT <= 0) {
          if (e.def.attack === 'touch') {
            if (d < e.radius + (aggroTarget.radius || 22) + 26) this.enemyTouch(e, 1, aggroTarget);
            else this.emit('fx:whiff', { x: e.x, y: e.y });
          }
          e.attackCd = 1.15;
        }
        continue;
      }
      e.attackCd -= dt;
      if (e.attackCd <= 0) {
        if (e.def.attack === 'touch' && d < e.radius + (aggroTarget.radius || 22) + 26) {
          e.windupT = e.def.attack === 'touch' ? (e.def.windup || 0.28) : 0.2;
          this.emit('enemy:tell', { enemy: e, kind: 'melee' });
        } else if (e.def.attack === 'shoot' && d < 420) {
          this.enemyShoot(e);
          e.attackCd = e.def.windup ? 2.1 + e.def.windup : 2.1;
        } else if (e.def.attack === 'slam' && d < e.radius + p.radius + 30) {
          this.enemySlam(e);
          e.attackCd = 2.6;
        } else if (e.def.attack === 'explode' && d < e.radius + p.radius + 24) {
          this.enemyExplode(e);
          e.attackCd = 3;
        } else if (e.def.attack === 'shockwave' && d < 220) {
          this.enemyShockwave(e);
          e.attackCd = 3.4;
        } else if (e.def.attack === 'scream' && d < 360) {
          this.enemyShoot(e);
          e.attackCd = 3.2;
        } else if (e.def.attack === 'lunge' && d < 300) {
          this.enemyShoot(e);
          e.attackCd = 2.2;
        } else if (e.def.attack === 'backstab' && d < (e.def.strikeRange || 96) + 40) {
          // Only strikes from behind. Facing it does not save you from the damage,
          // but the strike is a straight line, so stepping aside does.
          this.enemyBackstab(e);
          e.attackCd = 2.4;
        } else if (e.def.attack === 'burst' && d < e.def.blast * 1.05) {
          // Arm at the OUTER edge of the blast, not 75% of it. At 0.75 the slime
          // was already inside its own radius when the fuse lit: the player had
          // 0.7s to cross a 92px circle from 24px away and could not, so the
          // telegraph was decorative. Arming at the rim gives a full radius of
          // running room — measured: walking away now takes 0 damage.
          this.enemyBurst(e);
          e.attackCd = e.def.burstCd || 4.2;
        } else if (e.def.attack === 'thorns' && d < 520) {
          this.enemyThorns(e);
          e.attackCd = 3.6;
        }
      }
    }
    // remove finished corpses after the death animation
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead && e.deathT > (e.boss ? 2.4 : 0.85)) this.enemies.splice(i, 1);
    }
  }

  enemyTouch(enemy, mult = 1, target = this.player) {
    if (target !== this.player) {
      this.damageMinion(target, enemy.dmg * mult);
      this.emit('enemy:attack', { enemy, kind: 'touch', target });
      this.emit('fx:impact', { x: target.x, y: target.y, radius: 20, color: target.tint });
      return;
    }
    if (enemy.boss || enemy.mini) {
      // Bosses deal no contact damage: every point of damage has a tell you can read.
      if (!this.buffValue('noKnockback')) {
        const a = angle(enemy.x, enemy.y, this.player.x, this.player.y);
        this.player.x += Math.cos(a) * 3;
        this.player.y += Math.sin(a) * 2;
      }
      return;
    }
    this.emit('enemy:attack', { enemy, kind: 'touch' });
    this.damagePlayer(enemy.dmg * mult, enemy);
    if (enemy.eliteMod?.onHit === 'poison') this.playerPoison = 3;
    if (enemy.eliteMod?.slowOnHit) this.playerSlow = { amount: enemy.eliteMod.slowOnHit, time: 2 };
  }

  enemyShoot(enemy) {
    const def = enemy.def;
    const p = this.player;
    this.emit('enemy:tell', { enemy, kind: 'shoot' });
    const count = def.projectileCount || 1;
    for (let i = 0; i < count; i++) {
      const a = angle(enemy.x, enemy.y - 16, p.x, p.y) + (i - (count - 1) / 2) * 0.22;
      this.spawnProjectile({
        x: enemy.x, y: enemy.y - 16, angle: a, speed: def.projectileSpeed || 200,
        damage: enemy.dmg, radius: 6, source: 'enemy', owner: 'enemy', attacker: enemy, tint: enemy.def.eye,
        shape: 'orb', life: 3.4,
      });
    }
    this.emit('enemy:attack', { enemy, kind: 'shoot' });
  }

  enemySlam(enemy) {
    this.hazards.push({ kind: 'slam', x: enemy.x, y: enemy.y, radius: 74, delay: 0.42, t: 0, damage: enemy.dmg * 1.4, source: 'enemy', attacker: enemy, tint: '#9fe0c8' });
    this.emit('enemy:attack', { enemy, kind: 'slam' });
  }

  enemyExplode(enemy) {
    this.emit('enemy:explode', { enemy, radius: enemy.def.blast || 74 });
    if (dist(enemy.x, enemy.y, this.player.x, this.player.y) < (enemy.def.blast || 74) * 0.70) {
      this.damagePlayer(enemy.dmg, enemy);
    }
    this.killEnemy(enemy, { source: 'self' });
  }

  enemyShockwave(enemy) {
    this.hazards.push({ kind: 'ring', x: enemy.x, y: enemy.y, radius: enemy.def.blast || 96, delay: 0.5, t: 0, damage: enemy.dmg, source: 'enemy', attacker: enemy, tint: '#a8ffe0' });
    this.emit('enemy:attack', { enemy, kind: 'shockwave' });
  }

  /* ── attacks for the second-wave enemies ──────────────────────────────── */

  /**
   * Shadow Stalker strike. Delivered after a 0.5s tell that snaps it solid.
   * It commits to a straight line, so sidestepping avoids it entirely.
   */
  enemyBackstab(enemy) {
    this.emit('enemy:tell', { enemy, kind: 'backstab' });
    const a = angle(enemy.x, enemy.y, this.player.x, this.player.y);
    this.hazards.push({
      kind: 'lance', x: enemy.x, y: enemy.y, angle: a, length: 170, width: 26,
      delay: 0.5, t: 0, damage: enemy.dmg, source: 'enemy', attacker: enemy, tint: enemy.def.eye,
    });
    // It flickers as it lunges: readable, and tells the player it has committed.
    this.emit('fx:blink', { x: enemy.x, y: enemy.y, x2: enemy.x + Math.cos(a) * 60, y2: enemy.y + Math.sin(a) * 60, color: enemy.def.eye });
  }

  /**
   * Explosive Slime burst. Two stages: it swells in place (wind-up), then the
   * blast lands as a telegraphed circle, then it leaves a short caustic pool.
   * The slime survives its own blast — otherwise it is just a bomber clone.
   */
  enemyBurst(enemy) {
    const blast = enemy.def.blast || 92;
    const fuse = enemy.def.windup || 0.9;
    enemy.burstT = fuse;
    this.emit('enemy:tell', { enemy, kind: 'burst', radius: blast });
    this.hazards.push({
      kind: 'blast', x: enemy.x, y: enemy.y, radius: blast, delay: fuse, t: 0,
      damage: enemy.dmg, source: 'enemy', attacker: enemy, tint: '#b6ff6a',
      onLand: () => this.spawnHazardPatch(enemy.x, enemy.y, blast * 0.62, enemy.dmg * 0.22, 2.2, '#8ad14b', enemy),
    });
  }

  /**
   * Thorn Beast: roots a thorn field at the player's feet. Deliberately aimed at
   * where they ARE, not where they will be — it is area denial, not a snipe.
   */
  enemyThorns(enemy) {
    const p = this.player;
    const r = enemy.def.thornRadius || 62;
    this.emit('enemy:tell', { enemy, kind: 'thorns', x: p.x, y: p.y, radius: r });
    this.emit('fx:telegraph', { x: p.x, y: p.y, radius: r, delay: 0.85, kind: 'thorns' });
    this.hazards.push({
      kind: 'thorns', x: p.x, y: p.y, radius: r, delay: 0.85, t: 0,
      damage: enemy.dmg, source: 'enemy', attacker: enemy, tint: '#9ad14b', root: 0.8,
    });
  }

  /** Short-lived ground patch (crystal shards, caustic slime). Purely positional. */
  spawnHazardPatch(x, y, radius, dps, life, tint, attacker = null) {
    this.zones.push({ kind: 'hazard', x, y, radius, time: life, t: 0, dps, tint, source: 'enemy', attacker });
    this.emit('fx:patch', { x, y, radius, tint });
  }

  updateBosses(dt) {
    // Minibosses run the SAME brain. They are stored in `miniBoss`, not `boss`,
    // and this function used to bail out when `boss` was null — so during a
    // miniboss wave nothing drove it: Stone Warden never moved, never attacked
    // and never reached a phase, which is exactly "the thạch vệ hộ doesn't
    // work". Boss first, otherwise the miniboss.
    const b = (this.boss && !this.boss.dead) ? this.boss
      : (this.miniBoss && !this.miniBoss.dead) ? this.miniBoss
        : null;
    if (!b) return;
    const def = b.def;
    b.tellCount += dt;
    // phase transitions
    const frac = b.hp / b.hpMax;
    // Minibosses are authored without phases: they have one behaviour, so the
    // phase list is empty rather than missing. Guarding here keeps the shared
    // brain usable by both kinds instead of crashing on the first tick.
    const phases = def.phases || [];
    const nextPhase = phases.findIndex((ph, i) => frac <= ph.at && i > b.phase);
    if (nextPhase > b.phase) {
      b.phase = nextPhase;
      b.attackTimer = 0.9;
      this.emit('boss:phase', { enemy: b, phase: nextPhase });
      b.stun = Math.min(b.stun, 0.2);
      b.attackTimer = 1.2;
    }
    // Stun and root apply to bosses too. updateEnemies() handles these for
    // regular enemies, but the boss never went through that path, so a "stun"
    // from a skill only drew an aura while the boss kept attacking.
    if (b.stun > 0) { b.stun -= dt; b.attackTimer = Math.max(b.attackTimer, 0.15); return; }
    const rooted = b.root > 0;
    if (rooted) b.root = Math.max(0, b.root - dt);

    // A phaseless miniboss runs on its base numbers; a boss runs on the phase
    // it is in. One shared line each, so neither kind can be silently skipped.
    const phase = phases.length ? phases[Math.min(b.phase, phases.length - 1)] : {};
    b.speed = def.speed * (phase.speed || 1);
    b.dmg = (def.damage ?? def.dmg ?? 0) * (phase.dmgMult || 1) * (this.difficulty === 'hard' ? 1.2 : 1);
    // movement: drift toward mid-range, keep the player in view
    const p = this.player;
    const d = dist(b.x, b.y, p.x, p.y);
    const dirA = angle(b.x, b.y, p.x, p.y);
    b.facing = p.x >= b.x ? 1 : -1;

    // ── Boilerplate: where does the boss want to be?
    //
    // The old version *added* a velocity and then clamped it, so when the
    // retreat vector pointed into a wall the clamp silently ate the whole
    // movement. With the player cornered, d converged to 0: the boss stood
    // exactly on top of the player, unable to retreat (wall) and unable to
    // approach (already touching), and the fight stalled until an attack
    // happened to relocate it. Same story at d === 0, where both branches
    // multiply by a zero direction vector.
    //
    // Now the intent is expressed as a target point, the step is clamped to the
    // playfield per-axis, and any distance lost to the clamp is made up by
    // sliding along the wall.
    const step = (rooted ? 0 : b.speed * (1 - (b.slow || 0))) * dt;
    let tx = b.x;
    let ty = b.y;
    // ── Movement style changes the fight, not just the numbers.
    //
    // `phase.style` was declared in the boss data and read by nothing, so the
    // Void Predator's "stops retreating and hunts" phase was purely cosmetic —
    // a placeholder pretending to be a mechanic. Style is now real: a hunting
    // boss never backs off, it commits and closes. The answer changes from
    // "keep your distance" to "move sideways", which is the whole point of a
    // phase-two shift.
    const style = phase.style || 'skirmish';
    const hunts = style === 'hunt';
    // standoff: how close this style wants to live. A zoning boss keeps a wide
    // ring so her walls and rain have room; a shatter boss wants to be close
    // enough to punish while still able to rebuild. The orbit branch below used
    // to hard-code 195px for every boss, which made all three styles identical
    // in practice.
    const standoff = style === 'shatter' ? 150 : style === 'zone' ? 235 : hunts ? 110 : 195;
    if (d > 240) {
      // close the gap
      tx = b.x + Math.cos(dirA) * step;
      ty = b.y + Math.sin(dirA) * step * 0.5;
    } else if (d < 150 && d > 1 && style !== 'hunt') {
      // back off, but never out of the arena
      tx = b.x - Math.cos(dirA) * step * 0.7;
      ty = b.y - Math.sin(dirA) * step * 0.35;
    } else if (d <= 1) {
      // Degenerate: the boss is on top of the player. Pick a deterministic side
      // so it always peels away instead of dividing a zero vector.
      const away = b.facing >= 0 ? 1 : -1;
      tx = b.x - away * step;
      ty = b.y;
    } else {
      // Strafe AROUND the player, not back and forth along a line.
      //
      // The old version moved along cos(time) / sin(time), which oscillates:
      // the boss reversed direction every few seconds and was momentarily
      // motionless at each turn, so a perfectly healthy boss read as "stuck".
      // Moving perpendicular to the player keeps it circling at a constant
      // speed and always presents a changing silhouette.
      const side = (b.orbitDir ?? 1) * (b.orbitBias ? Math.sign(b.orbitBias) : 1);
      const perp = dirA + (Math.PI / 2) * side;
      if (hunts) {
        // Close the distance at full speed with a lateral bias, instead of
        // holding a ring. This is what makes phase 2 a different fight.
        const sway = Math.sin(this.time * 1.7 + (b.uid || 0)) * 0.4;
        tx = b.x + Math.cos(dirA + sway) * step * 1.05;
        ty = b.y + Math.sin(dirA + sway) * step * 0.6;
      } else {
        // Radial correction toward THIS style's preferred ring, so a zoning boss
        // really does keep her distance and a shatter boss really does press in.
        const radial = (d - standoff) * 0.004;
        tx = b.x + (Math.cos(perp) + Math.cos(dirA) * radial) * step;
        ty = b.y + (Math.sin(perp) + Math.sin(dirA) * radial) * step * 0.55;
      }
    }

    const nx = clamp(tx, PLAY.left, PLAY.right);
    const ny = clamp(ty, PLAY.top, PLAY.bottom);
    const lostX = Math.abs(tx - nx);
    const lostY = Math.abs(ty - ny);
    // Did the boss actually try to go anywhere this frame? A zoning boss that
    // deliberately holds its ground is not stuck and must never be relocated.
    b._wantedMove = (b._wantedMove || 0) + Math.hypot(tx - b.x, ty - b.y);
    b.x = nx;
    b.y = ny;
    // Slide the leftover movement along the free axis so a wall never costs the
    // boss its whole step (that loss is what made cornered bosses creep).
    const lost = lostX + lostY;
    if (lost > 0.01) {
      const freeX = nx <= PLAY.left + 0.5 || nx >= PLAY.right - 0.5 ? 0 : 1;
      const freeY = ny <= PLAY.top + 0.5 || ny >= PLAY.bottom - 0.5 ? 0 : 1;
      if (freeY) b.y = clamp(ny + (Math.sin(dirA) >= 0 ? -lost : lost) * 0.6, PLAY.top, PLAY.bottom);
      else if (freeX) b.x = clamp(nx + (Math.cos(dirA) >= 0 ? -lost : lost) * 0.6, PLAY.left, PLAY.right);
    }
    // Hard separation: a boss may touch the player, never occupy the same pixel.
    // Record where the boss got to under its OWN locomotion before the shove
    // below — the anti-stuck watchdog must not count that correction as progress.
    b._locoX = b.x;
    b._locoY = b.y;
    const sep = (b.radius || 40) * 0.55 + (p.radius || 17) * 0.3;
    if (d < sep) {
      const a2 = d > 0.01 ? Math.atan2(b.y - p.y, b.x - p.x) : (b.facing >= 0 ? 0 : Math.PI);
      b.x = clamp(p.x + Math.cos(a2) * sep, PLAY.left, PLAY.right);
      b.y = clamp(p.y + Math.sin(a2) * sep * 0.6, PLAY.top, PLAY.bottom);
    }

    // ── Anti-stuck watchdog ────────────────────────────────────────────────
    // If the boss needs to move but cannot, give it a fresh orbit bias and, as
    // a last resort after repeated failures, nudge it to open ground away from
    // the player — never in front of them, never on top of them.
    // Measure progress under the boss's own power. A boss pinned against the
    // player is pushed out a few pixels by the separation rule every frame; if
    // that counts as movement the watchdog can never fire, and a boss that
    // genuinely cannot move sits there for the whole fight (reproduced with
    // speed 0: 240 frames, zero rescuers). The shove is not locomotion.
    // Judge displacement over a window, not per frame.
    //
    // Per-frame thresholds failed in both directions. The original one disabled
    // itself at speed 0 (`moved < 0` is never true), and a per-frame speed floor
    // flagged healthy bosses whenever an orbit correction slowed them, so it
    // relocated bosses mid-fight. Instead: remember where the boss was ~0.75s
    // ago (pre-separation, so the push-off shove cannot fake progress) and ask
    // whether it has actually gone anywhere since.
    const WINDOW = 45;
    b._stuckSample = b._stuckSample || { x: b._locoX ?? b.x, y: b._locoY ?? b.y, n: 0 };
    b._stuckSample.n++;
    const travelled = Math.hypot((b._locoX ?? b.x) - b._stuckSample.x, (b._locoY ?? b.y) - b._stuckSample.y);
    const needTravel = Math.max(step * 0.25, 4);
    if (b._stuckSample.n >= WINDOW) {
      // Stuck means: it wanted to travel and got nowhere. A boss that chose to
      // hold its ground asked for nothing and must not be teleported for it.
      // The exception is a boss with no movement capability at all (speed < 1,
      // e.g. fully crippled): it wants nothing because it *can* do nothing, and
      // standing on the player is the only outcome — that still needs rescuing.
      const wanted = b._wantedMove || 0;
      const immobile = b.speed < 1;
      const asked = !rooted && (wanted > step * 0.5 || immobile);
      if (asked && travelled < needTravel) b.stuckCount = (b.stuckCount || 0) + 1;
      else b.stuckCount = 0;
      b._stuckSample = { x: b._locoX ?? b.x, y: b._locoY ?? b.y, n: 0 };
      b._wantedMove = 0;
    }
    if (b.stuckCount > 0) {                        // one 0.75s window without progress
      b.stuckCount = 0;
      b.stuckT = 0;
      b.orbitBias = (b.orbitBias || 0) + Math.PI * 0.6;
      b.stuckAttempts = (b.stuckAttempts || 0) + 1;
      if (b.stuckAttempts >= 2) {
        // Pick the open side: the direction that puts the most arena between the
        // boss and the nearest wall, biased away from the player.
        b.stuckAttempts = 0;
        const away = b.facing >= 0 ? -1 : 1;
        const targetX = clamp(b.x + away * 170, PLAY.left, PLAY.right);
        const targetY = clamp(b.y + (b.y < (PLAY.top + PLAY.bottom) / 2 ? 90 : -90), PLAY.top, PLAY.bottom);
        this.emit('fx:blink', { x: b.x, y: b.y, x2: targetX, y2: targetY, color: '#a48bff' });
        b.x = targetX;
        b.y = targetY;
        b._lastX = b.x;
        b._lastY = b.y;
      }
    }

    b.attackTimer -= dt;
    if (b.attackTimer <= 0) {
      const attack = this.chooseBossAttack(b, phase);
      this.runBossAttack(b, attack);
      b.attackTimer = attack === 'enrage' ? 5.2 : 2.1 + this.rng.float() * 1.0;
    }
  }

  /**
   * Pick the next attack from the current phase, using distance and phase —
   * not a fixed cycle.
   *
   * The brief asks for attacks chosen by distance / player position / phase /
   * cooldown rather than pure randomness, and for no attack spam. Cycling meant
   * a boss standing next to you could "choose" a long-range rain attack, and a
   * boss across the arena could try to claw you. Entries may be plain strings
   * (the three original bosses) or { id, tag } objects (the two new ones); both
   * go through the same rules so nothing changed for the existing fights.
   */
  chooseBossAttack(b, phase) {
    // Minibosses declare a single `attack` on the definition instead of a phase
    // attack list, so without this fallback every miniboss chose `null` and
    // stood there swinging at nothing. Bosses are unchanged: their phase list
    // still wins whenever it exists.
    const list = (phase && phase.attacks && phase.attacks.length)
      ? phase.attacks
      : (b.def && b.def.attack ? [b.def.attack] : null);
    if (!list || !list.length) return null;
    const norm = list.map((a) => (typeof a === 'string' ? { id: a, tag: null } : a));
    const p = this.player;
    const d = dist(b.x, b.y, p.x, p.y);

    // Preferred band per tag. null = always acceptable.
    const band = {
      melee: [0, 150],
      ambush: [0, 999],
      dash: [90, 520],
      ring: [0, 260],
      nova: [0, 320],
      beam: [140, 999],
      rain: [0, 999],
      // A zoning boss puts her wall between herself and the player, which is
      // meaningful at ANY range — at 0 she is fencing the player away from her,
      // at 500 she is cutting the arena in half. The old 120 minimum quietly
      // excluded the attack for most of the fight (measured: 0 walls built in
      // 44s even though the selector would have picked it).
      spikes: [0, 999],
      wall: [0, 999],
      shatter: [0, 999],
      summon: [0, 999],
      leap: [100, 520],
    };

    const fits = (a) => {
      const r = a.tag ? band[a.tag] : null;
      if (!r) return true;
      return d >= r[0] && d <= r[1];
    };

    // Never repeat the same attack twice in a row — that is what "spam" looks
    // like from the player's side, even when the RNG picked it fairly.
    const notLast = (a) => a.id !== b.lastAttack;
    // Avoid any attack used in the previous two slots where there is a choice.
    const fresh = (a) => !(b.recentAttacks || []).includes(a.id);

    let pool = norm.filter((a) => fits(a) && notLast(a));
    if (!pool.length) pool = norm.filter((a) => fits(a));
    if (!pool.length) pool = norm.filter(notLast);
    if (!pool.length) pool = norm;

    const preferred = pool.filter(fresh);
    let usePool = preferred.length ? preferred : pool;

    // Shuffle bag rather than a fresh random pick every time.
    //
    // Plain random selection turned out to cost real balance: the bot sweep
    // dropped from 25.7 to 24.1 average depth because a 1-in-4 roll lets the
    // single most damaging attack of a phase land far more often than the old
    // fixed cycle did. A bag holds every eligible attack once, dealt in random
    // order and refilled when empty, so the mix stays surprising while each
    // attack still appears exactly once per cycle — the fairness of the cycle
    // without its predictability.
    b.attackBag = (b.attackBag || []).filter((id) => usePool.some((a) => a.id === id));
    if (!b.attackBag.length) {
      b.attackBag = usePool.map((a) => a.id);
      // Fisher-Yates so the order is not the declaration order.
      for (let i = b.attackBag.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng.float() * (i + 1));
        [b.attackBag[i], b.attackBag[j]] = [b.attackBag[j], b.attackBag[i]];
      }
    }
    const wantId = b.attackBag.shift();
    const pick = usePool.find((a) => a.id === wantId) || usePool[0];

    b.lastAttack = pick.id;
    b.recentAttacks = [pick.id, ...(b.recentAttacks || [])].slice(0, 2);
    b.attackIndex = (b.attackIndex + 1) % norm.length;
    return pick.id;
  }

  runBossAttack(boss, attack) {
    const p = this.player;
    const dirA = angle(boss.x, boss.y - 40, p.x, p.y);
    this.emit('boss:attack', { enemy: boss, attack });
    const pushHazard = (hz) => this.hazards.push({ t: 0, source: 'enemy', attacker: boss, tint: '#ff8f4d', warn: hz.delay, ...hz });
    switch (attack) {
      case 'fanShot': {
        this.emit('enemy:tell', { enemy: boss, kind: 'fan', color: '#c9a8ff' });
        for (let i = -3; i <= 3; i++) {
          this.spawnProjectile({ x: boss.x, y: boss.y - 40, angle: dirA + i * 0.22, speed: 175, damage: boss.dmg * 0.62, radius: 7, source: 'enemy', attacker: boss, owner: 'enemy', tint: '#c9a8ff', shape: 'orb', life: 2.6 });
        }
        this.emit('fx:castTell', { x: boss.x, y: boss.y - 40, color: '#c9a8ff' });
        break;
      }
      case 'telepounce':
        this.emit('enemy:tell', { enemy: boss, kind: 'leap', color: '#c9a8ff' });
        pushHazard({ kind: 'pounceTelegraph', x: p.x, y: p.y, radius: 84, delay: 0.9, damage: boss.dmg * 1.05, color: '#c9a8ff', warn: 0.9 });
        boss.attackTimer = 0.4;
        break;
      case 'summonMoths':
        this.emit('enemy:tell', { enemy: boss, kind: 'summon', color: '#a48bff' });
        for (let i = 0; i < 3; i++) {
          const e = this.makeEnemy(ENEMY_BY_ID.wisp, {}, { scale: difficultyScale(this.night, this.wave) });
          e.x = boss.x + this.rng.range(-70, 70);
          e.y = boss.y + this.rng.range(-30, 30);
          e.spawnT = 0;
          e.spawnGrace = 0.7;
          this.enemies.push(e);
        }
        this.emit('fx:summonRing', { x: boss.x, y: boss.y, color: '#a48bff' });
        break;
      case 'eclipse':
        this.emit('enemy:tell', { enemy: boss, kind: 'nova', color: '#a48bff' });
        pushHazard({ kind: 'nova', x: boss.x, y: boss.y, radius: 220, delay: 1.15, damage: boss.dmg * 1.15, color: '#a48bff', warn: 1.15 });
        break;
      case 'moonBeam':
        // This had no telegraph at all: three beams swept in with a 0.7s fuse
        // and nothing on screen to say so. A 0.7s fuse the player cannot see is
        // not a dodge window, it is a coin flip.
        this.emit('enemy:tell', { enemy: boss, kind: 'beam', color: '#ffe8a8' });
        for (let i = 0; i < 3; i++) {
          const a = dirA + (i - 1) * 0.4;
          this.hazards.push({ kind: 'beam', x: boss.x, y: boss.y - 40, angle: a, length: 620, width: 34, delay: 0.7 + i * 0.18, t: 0, damage: boss.dmg * 1.2, source: 'enemy', attacker: boss, tint: '#ffe8a8' });
        }
        break;
      case 'emberRain':
        this.emit('enemy:tell', { enemy: boss, kind: 'rain', color: '#ff8f4d' });
        for (let i = 0; i < 7; i++) {
          const tx = clamp(p.x + this.rng.range(-170, 170), PLAY.left, PLAY.right);
          const ty = clamp(p.y + this.rng.range(-60, 60), PLAY.top, PLAY.bottom);
          pushHazard({ kind: 'meteor', x: tx, y: ty, radius: 52, delay: 0.9 + i * 0.1, damage: boss.dmg * 0.8, color: '#ff8f4d' });
        }
        break;
      case 'dashSlash':
        this.emit('enemy:tell', { enemy: boss, kind: 'dash', color: '#ff8f4d' });
        this.emit('boss:dash', { enemy: boss, x: p.x, y: p.y });
        pushHazard({ kind: 'line', x: boss.x, y: boss.y, x2: p.x, y2: p.y, width: 44, delay: 0.62, damage: boss.dmg * 1.6 });
        boss.x = p.x - 60 * Math.sign(p.x - boss.x || 1);
        break;
      case 'lanternNova':
        this.emit('enemy:tell', { enemy: boss, kind: 'nova', color: '#ff8f4d' });
        pushHazard({ kind: 'nova', x: boss.x, y: boss.y, radius: 260, delay: 1.1, damage: boss.dmg * 1.2, color: '#ff8f4d', warn: 1.1 });
        for (let i = 0; i < 8; i++) {
          this.spawnProjectile({ x: boss.x, y: boss.y - 40, angle: (i / 8) * TAU, speed: 190, damage: boss.dmg * 0.6, radius: 6, source: 'enemy', attacker: boss, owner: 'enemy', tint: '#ffc966', life: 4 });
        }
        break;
      case 'summonImps':
        this.emit('enemy:tell', { enemy: boss, kind: 'summon', color: '#ff8f4d' });
        for (let i = 0; i < 3; i++) {
          const e = this.makeEnemy(ENEMY_BY_ID.bomber, {}, { scale: difficultyScale(this.night, this.wave) });
          e.x = boss.x + this.rng.range(-80, 80); e.y = boss.y;
          e.spawnGrace = 0.7;
          this.enemies.push(e);
        }
        break;
      case 'blinkClaw':
        this.emit('enemy:tell', { enemy: boss, kind: 'blink', color: '#3fd6a8' });
        this.emit('fx:blink', { x: boss.x, y: boss.y, x2: p.x + 80, y2: p.y, color: '#3fd6a8' });
        boss.x = p.x + (this.rng.chance(0.5) ? 80 : -80);
        boss.y = p.y;
        pushHazard({ kind: 'nova', x: boss.x, y: boss.y, radius: 120, delay: 0.35, damage: boss.dmg * 1.1, color: '#3fd6a8' });
        break;
      case 'echoRing':
        this.emit('enemy:tell', { enemy: boss, kind: 'ring', color: '#3fd6a8' });
        for (let i = 0; i < 3; i++) pushHazard({ kind: 'ring', x: boss.x, y: boss.y, radius: 140 + i * 80, delay: 0.6 + i * 0.35, damage: boss.dmg * 0.7, color: '#3fd6a8' });
        break;
      case 'summonShades':
        this.emit('enemy:tell', { enemy: boss, kind: 'summon', color: '#3fd6a8' });
        for (let i = 0; i < 2; i++) {
          const e = this.makeEnemy(ENEMY_BY_ID.stalker, {}, { scale: difficultyScale(this.night, this.wave) });
          e.x = boss.x + this.rng.range(-100, 100); e.y = boss.y;
          e.spawnGrace = 0.7;
          this.enemies.push(e);
        }
        break;
      case 'nineLash':
        this.emit('enemy:tell', { enemy: boss, kind: 'lash', color: '#3fd6a8' });
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * TAU + this.time;
          pushHazard({ kind: 'line', x: boss.x, y: boss.y - 30, x2: boss.x + Math.cos(a) * 620, y2: boss.y + Math.sin(a) * 380, width: 26, delay: 0.5 + i * 0.05, damage: boss.dmg * 0.55, color: '#3fd6a8' });
        }
        break;
      case 'ringSlam':
        for (let i = 0; i < (boss.def.ringCount || 8); i++) {
          this.spawnProjectile({ x: boss.x, y: boss.y - 20, angle: (i / (boss.def.ringCount || 8)) * TAU, speed: 170, damage: boss.dmg * 0.8, radius: 7, source: 'enemy', attacker: boss, owner: 'enemy', tint: '#9fe0c8', life: 5 });
        }
        break;
      case 'screamPlus': {
        pushHazard({ kind: 'nova', x: boss.x, y: boss.y, radius: boss.def.blast || 170, delay: 0.9, damage: boss.dmg * 1.2, color: '#ff8fa8' });
        for (let i = 0; i < (boss.def.projectileCount || 8); i++) {
          this.spawnProjectile({ x: boss.x, y: boss.y - 30, angle: (i / (boss.def.projectileCount || 8)) * TAU, speed: 160, damage: boss.dmg * 0.5, radius: 6, source: 'enemy', attacker: boss, owner: 'enemy', tint: '#ff8fa8', life: 4 });
        }
        break;
      }
      case 'spawner':
        for (let i = 0; i < (boss.def.spawnCount || 3); i++) {
          const e = this.makeEnemy(ENEMY_BY_ID[boss.def.spawn || 'grub'], {}, { scale: difficultyScale(this.night, this.wave) });
          e.x = boss.x + this.rng.range(-60, 60); e.y = boss.y;
          this.enemies.push(e);
        }
        break;
      /* ── The Void Predator ──────────────────────────────────────────────
         Mobility and ambush. Every attack resolves to a place the player can
         physically leave; the dash in particular commits to a line. */

      case 'shadowDash': {
        // Telegraphs the corridor, then crosses it. Sidestep, do not backpedal.
        this.emit('enemy:tell', { enemy: boss, kind: 'dash', color: '#b06bff' });
        const dist2 = Math.min(520, Math.max(200, dist(boss.x, boss.y, p.x, p.y) + 90));
        pushHazard({ kind: 'line', x: boss.x, y: boss.y, x2: boss.x + Math.cos(dirA) * dist2, y2: boss.y + Math.sin(dirA) * dist2, width: 40, delay: 0.6, damage: boss.dmg * 1.5, color: '#b06bff' });
        this.emit('fx:blink', { x: boss.x, y: boss.y, x2: boss.x + Math.cos(dirA) * dist2, y2: boss.y + Math.sin(dirA) * dist2, color: '#b06bff' });
        boss.x = clamp(boss.x + Math.cos(dirA) * dist2 * 0.55, PLAY.left, PLAY.right);
        boss.y = clamp(boss.y + Math.sin(dirA) * dist2 * 0.55, PLAY.top, PLAY.bottom);
        break;
      }
      case 'tripleClaw': {
        // Three crescents in sequence, each aimed at where the player IS at the
        // moment of its own telegraph — so standing still stacks all three.
        this.emit('enemy:tell', { enemy: boss, kind: 'melee', color: '#b06bff' });
        for (let i = 0; i < 3; i++) {
          const a2 = dirA + (i - 1) * 0.5;
          const hz = { kind: 'lance', x: boss.x, y: boss.y, angle: a2, length: 150, width: 30, delay: 0.42 + i * 0.22, damage: boss.dmg * 0.62, color: '#d79bff' };
          pushHazard(hz);
        }
        break;
      }
      case 'shadowRing': {
        // Expanding rings with gaps. Three waves, each dodgeable.
        this.emit('enemy:tell', { enemy: boss, kind: 'ring', color: '#b06bff' });
        for (let i = 0; i < 3; i++) {
          pushHazard({ kind: 'ring', x: boss.x, y: boss.y, radius: 120 + i * 90, delay: 0.7 + i * 0.42, damage: boss.dmg * 0.65, color: '#b06bff' });
        }
        break;
      }
      case 'vanishStrike': {
        // Vanishes, then reappears behind the player with a committed nova.
        this.emit('enemy:tell', { enemy: boss, kind: 'blink', color: '#d24aff' });
        this.emit('fx:blink', { x: boss.x, y: boss.y, x2: p.x + 90, y2: p.y, color: '#d24aff' });
        boss.x = clamp(p.x + (this.rng.chance(0.5) ? 96 : -96), PLAY.left, PLAY.right);
        boss.y = clamp(p.y + this.rng.range(-26, 26), PLAY.top, PLAY.bottom);
        pushHazard({ kind: 'nova', x: boss.x, y: boss.y, radius: 104, delay: 0.55, damage: boss.dmg * 1.15, color: '#d24aff' });
        break;
      }
      case 'eclipse2': {
        this.emit('enemy:tell', { enemy: boss, kind: 'nova', color: '#b06bff' });
        pushHazard({ kind: 'nova', x: boss.x, y: boss.y, radius: 235, delay: 1.05, damage: boss.dmg * 1.2, color: '#b06bff' });
        break;
      }

      /* ── The Crystal Queen ──────────────────────────────────────────────
         Zoning. She wants the arena covered in hazards and the player pinned
         between walls; the counters are to move early and keep a lane open. */

      case 'crystalRain': {
        this.emit('enemy:tell', { enemy: boss, kind: 'rain', color: '#7fd4d8' });
        // Rain falls in a ring around the player, never directly on them: it
        // shapes where they can stand instead of being an unavoidable hit.
        for (let i = 0; i < 8; i++) {
          const a2 = (i / 8) * TAU + this.rng.range(-0.2, 0.2);
          const rr = this.rng.range(70, 190);
          const tx = clamp(p.x + Math.cos(a2) * rr, PLAY.left, PLAY.right);
          const ty = clamp(p.y + Math.sin(a2) * rr * 0.7, PLAY.top, PLAY.bottom);
          pushHazard({ kind: 'meteor', x: tx, y: ty, radius: 44, delay: 0.85 + i * 0.09, damage: boss.dmg * 0.7, color: '#7fd4d8' });
        }
        break;
      }
      case 'groundSpikes': {
        // A row of spikes that walks toward the player. Dodge along the row axis.
        this.emit('enemy:tell', { enemy: boss, kind: 'spikes', color: '#7fe8e0' });
        const perp = dirA + Math.PI / 2;
        for (let i = -3; i <= 3; i++) {
          const sx = p.x + Math.cos(perp) * i * 56;
          const sy = p.y + Math.sin(perp) * i * 34;
          if (sx < PLAY.left || sx > PLAY.right) continue;
          pushHazard({ kind: 'thorns', x: sx, y: sy, radius: 40, delay: 0.75, damage: boss.dmg * 0.8, color: '#7fe8e0', root: 0.5 });
        }
        break;
      }
      case 'crystalWall': {
        // A physical wall of crystal: real cover that blocks the corridor for a
        // while. It is destructible so it can never soft-lock the arena.
        this.emit('enemy:tell', { enemy: boss, kind: 'wall', color: '#7fd4d8' });
        const perp = dirA + Math.PI / 2;
        const midX = (boss.x + p.x) / 2;
        const midY = (boss.y + p.y) / 2;
        const blocks = [];
        for (let i = -2; i <= 2; i++) {
          const wx = clamp(midX + Math.cos(perp) * i * 54, PLAY.left, PLAY.right);
          const wy = clamp(midY + Math.sin(perp) * i * 34, PLAY.top, PLAY.bottom);
          const wall = { kind: 'wall', x: wx, y: wy, radius: 34, time: 7.5, t: 0, hp: Math.max(1, boss.dmg * 1.6), tint: '#7fd4d8', boss };
          this.zones.push(wall);
          blocks.push(wall);
        }
        this.crystalWalls = blocks;
        break;
      }
      case 'shatterWall': {
        // Phase-2 behaviour change: her own walls burst into spikes. The arena
        // gets more hostile rather than her numbers getting bigger.
        this.emit('enemy:tell', { enemy: boss, kind: 'shatter', color: '#ffffff' });
        const walls = (this.zones || []).filter((z) => z.kind === 'wall');
        for (const w of walls) {
          this.hazards.push({ kind: 'blast', x: w.x, y: w.y, radius: 66, delay: 0.5, t: 0, damage: boss.dmg * 0.85, source: 'enemy', attacker: boss, tint: '#e8ffff' });
          this.emit('fx:impact', { x: w.x, y: w.y, radius: 66, color: '#e8ffff' });
        }
        this.zones = this.zones.filter((z) => z.kind !== 'wall');
        this.crystalWalls = [];
        break;
      }
      case 'energyBeam': {
        // A slow sweeping beam: readable, and it sweeps, so standing still fails
        // while moving with the sweep succeeds.
        this.emit('enemy:tell', { enemy: boss, kind: 'beam', color: '#ffffff' });
        const sweep = boss.beamDir || 1;
        boss.beamDir = -sweep;
        for (let i = 0; i < 4; i++) {
          this.hazards.push({
            kind: 'beam', x: boss.x, y: boss.y - 40, angle: dirA + sweep * i * 0.16,
            length: 760, width: 30, delay: 0.7 + i * 0.16, t: 0, damage: boss.dmg * 0.7,
            source: 'enemy', attacker: boss, tint: '#bfefff',
          });
        }
        break;
      }
      case 'summonMinions': {
        this.emit('enemy:tell', { enemy: boss, kind: 'summon', color: '#7fd4d8' });
        this.emit('fx:summonRing', { x: boss.x, y: boss.y, color: '#7fd4d8' });
        const kinds = ['crystal_crawler', 'arcane_bat', 'explosive_slime'];
        for (let i = 0; i < 3; i++) {
          const def = ENEMY_BY_ID[kinds[(i + this.wave) % kinds.length]];
          if (!def) continue;
          const e = this.makeEnemy(def, {}, { scale: difficultyScale(this.night, this.wave) });
          e.x = clamp(boss.x + this.rng.range(-100, 100), PLAY.left, PLAY.right);
          e.y = clamp(boss.y + this.rng.range(-40, 40), PLAY.top, PLAY.bottom);
          e.spawnT = 0;
          e.spawnGrace = 0.8;
          this.enemies.push(e);
        }
        break;
      }

      case 'enrage':
        this.emit('boss:enrage', { enemy: boss });
        this.emit('enemy:tell', { enemy: boss, kind: 'enrage', color: '#ff4f5e' });
        pushHazard({ kind: 'nova', x: boss.x, y: boss.y, radius: 300, delay: 0.8, damage: boss.dmg * 1.2, color: '#ff4f5e' });
        break;
      default:
        break;
    }
  }

  /* ── projectiles / hazards / zones ─────────────────────────────────────── */
  spawnProjectile(opt) {
    const p = {
      x: opt.x, y: opt.y, angle: opt.angle, speed: opt.speed || 300,
      damage: opt.damage ?? 1, radius: opt.radius || 6, life: opt.life || 2.4,
      t: 0, owner: opt.owner || 'player', source: opt.source || 'skill', attacker: opt.attacker || null,
      pierce: opt.pierce || 0, hits: new Set(), tint: opt.tint || '#ffffff',
      shape: opt.shape || 'orb', homing: opt.homing || 0, explode: opt.explode || 0,
      boomerang: !!opt.boomerang, travel: opt.travel || 0, phase: 0,
      root: opt.root || 0, lifesteal: opt.lifesteal || 0, wide: !!opt.wide,
      knock: opt.knock || 0, burn: !!opt.burn, burnDps: opt.burnDps || 0, alive: true,
      bounces: opt.bounces || 0, onHitBlast: opt.onHitBlast || 0, onHitBlastScale: opt.onHitBlastScale || 0,
      turnBlast: opt.turnBlast || 0,
    };
    this.projectiles.push(p);
    return p;
  }

  updateProjectiles(dt) {
    const p = this.player;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.t += dt;
      pr.life -= dt;
      if (pr.homing && pr.owner === 'player') {
        let tgt = pr.homingTarget;
        if (!tgt || tgt.dead || pr.hits.has(tgt.uid)) {
          tgt = null;
          let closest = 260 * 260;
          for (const e of this.enemies) {
            if (e.dead || pr.hits.has(e.uid)) continue;
            const d = dist2(pr.x, pr.y, e.x, e.y - 12);
            if (d < closest) { closest = d; tgt = e; }
          }
        }
        pr.homingTarget = tgt;
        if (tgt) {
          const want = Math.atan2((tgt.y - 12 - pr.y) / 0.72, tgt.x - pr.x);
          let dA = want - pr.angle;
          dA = Math.atan2(Math.sin(dA), Math.cos(dA));
          pr.angle += clamp(dA, -pr.homing * 60 * dt, pr.homing * 60 * dt);
        }
      }
      if (pr.boomerang) {
        pr.phase += dt;
        const back = pr.phase * pr.speed >= pr.travel;
        if (back && !pr.returning) this.turnBoomerang(pr, p);
        if (pr.returning) {
          const want = Math.atan2((p.y - 20 - pr.y) / 0.72, p.x - pr.x);
          let dA = want - pr.angle;
          dA = Math.atan2(Math.sin(dA), Math.cos(dA));
          pr.angle += clamp(dA, -6 * dt, 6 * dt);
          if (dist(pr.x, pr.y, p.x, p.y) < 26) { this.projectiles.splice(i, 1); continue; }
        }
      }
      pr.x += Math.cos(pr.angle) * pr.speed * dt;
      pr.y += Math.sin(pr.angle) * pr.speed * dt * 0.72;
      const outX = pr.x < 0 || pr.x > ARENA.w;
      const outY = pr.y < 0 || pr.y > ARENA.h;
      if ((outX || outY) && pr.boomerang && !pr.returning && pr.life > 0) {
        pr.x = clamp(pr.x, 0, ARENA.w); pr.y = clamp(pr.y, 0, ARENA.h);
        this.turnBoomerang(pr, p);
      } else if ((outX || outY) && pr.bounces > 0 && pr.life > 0) {
        pr.x = clamp(pr.x, 0, ARENA.w); pr.y = clamp(pr.y, 0, ARENA.h);
        if (outX) pr.angle = Math.PI - pr.angle;
        if (outY) pr.angle = -pr.angle;
        pr.bounces--; pr.hits.clear();
      } else if (outX || outY || pr.life <= 0) {
        if (pr.explode && pr.owner === 'player') this.blast(pr);
        this.projectiles.splice(i, 1);
        continue;
      }
      if (pr.owner === 'player') {
        for (const e of this.enemies) {
          if (e.dead || pr.hits.has(e.uid)) continue;
          if (dist2(pr.x, pr.y, e.x, e.y - 12) < (pr.radius + e.radius) ** 2) {
            pr.hits.add(e.uid);
            const res = pr.source === 'minion' || pr.source === 'orbit' || pr.source === 'reflect'
              ? { damage: pr.damage, isCrit: false }
              : computeDamage({ base: pr.damage, atk: 1, crit: this.effectiveCrit(), critDmg: this.stats.critDmg, roll: this.rng.float(), targetHpFrac: e.hp / e.hpMax, forceCrit: this.consumeForceCrit(), execute: this.mods.execute });
            const hpBefore = e.hp;
            const dealt = this.hitEnemy(e, res.damage, { source: pr.source, crit: res.isCrit });
            if (pr.burnDps > 0) this.applyStatus(e, 'burn', pr.burnDps, 3);
            if (pr.root) this.applyStatus(e, 'root', pr.root);
            if (pr.lifesteal) this.heal(Math.min(hpBefore, dealt) * pr.lifesteal, { silent: true });
            if (pr.knock) this.knockback(e, pr.knock);
            if (pr.onHitBlast) this.blast({ ...pr, explode: pr.onHitBlast, burn: false }, e.uid, pr.onHitBlastScale);
            if (pr.explode && pr.hits.size > pr.pierce) { this.blast(pr); this.projectiles.splice(i, 1); break; }
            if (pr.hits.size > pr.pierce) {
              if (pr.boomerang && !pr.returning) this.turnBoomerang(pr, p);
              else this.projectiles.splice(i, 1);
              break;
            }
          }
        }
      } else {
        if (dist2(pr.x, pr.y, p.x, p.y - 20) < (pr.radius + p.radius) ** 2) {
          if (p.shield > 0 && this.buffValue('reflectProjectiles')) {
            // A reflected projectile still consumes the shield as an incoming
            // hit; it is then redirected rather than duplicated.
            const reflectBlast = this.buffValue('reflectBlast');
            this.damagePlayer(pr.damage, null, pr);
            const target = this.nearestEnemy(pr.x, pr.y, 520);
            pr.owner = 'player'; pr.source = 'reflect'; pr.homing = 0;
            if (reflectBlast) pr.explode = reflectBlast;
            pr.angle = target ? Math.atan2((target.y - 12 - pr.y) / 0.72, target.x - pr.x) : pr.angle + Math.PI;
            pr.life = Math.max(pr.life, 1.5); pr.hits.clear();
          } else {
            this.damagePlayer(pr.damage, null, pr);
            this.projectiles.splice(i, 1);
          }
        }
      }
    }
  }

  turnBoomerang(pr, player) {
    pr.returning = true;
    pr.hits.clear(); // one hit per target on each leg
    pr.angle = Math.atan2((player.y - 20 - pr.y) / 0.72, player.x - pr.x);
    // Yarn's last upgrade adds one small burst at the turnaround, even at a wall.
    if (pr.turnBlast) this.blast({ ...pr, explode: pr.turnBlast, burn: false }, null, 0.55);
  }

  blast(pr, excludeUid = null, damageScale = 0.7) {
    this.emit('fx:blast', { x: pr.x, y: pr.y, radius: pr.explode, color: pr.tint });
    for (const e of this.enemies) {
      if (e.dead || e.uid === excludeUid) continue;
      if (dist2(pr.x, pr.y, e.x, e.y - 12) < (pr.explode + e.radius) ** 2) {
        this.hitEnemy(e, pr.damage * damageScale, { source: 'blast' });
        if (pr.burnDps > 0) this.applyStatus(e, 'burn', pr.burnDps, 3);
      }
    }
    if (pr.burn) this.zones.push({ kind: 'fire', x: pr.x, y: pr.y, radius: pr.explode * 0.8, time: 2.6, t: 0, dps: pr.damage * 0.5, tint: '#ff8f4d' });
  }

  updateHazards(dt) {
    const p = this.player;
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const hz = this.hazards[i];
      hz.t += dt;
      if (hz.t < hz.delay) continue;
      const age = hz.t - hz.delay;
      if (hz.kind === 'slam' || hz.kind === 'nova' || hz.kind === 'ring' || hz.kind === 'meteor' || hz.kind === 'star' || hz.kind === 'pounceTelegraph') {
        if (!hz.resolved) {
          hz.resolved = true;
          this.emit('fx:impact', { x: hz.x, y: hz.y, radius: hz.radius, color: hz.tint || hz.color });
          if (hz.source === 'enemy') {
            if (dist(hz.x, hz.y, p.x, p.y) < hz.radius * 0.92) this.damagePlayer(hz.damage, null, null, hz.attacker);
          } else {
            for (const e of this.enemies) if (!e.dead && dist(e.x, e.y, hz.x, hz.y) < hz.radius) this.hitEnemy(e, hz.damage, { source: 'skill' });
          }
          if (hz.stun && hz.source !== 'enemy') for (const e of this.enemies) if (!e.dead && dist(e.x, e.y, hz.x, hz.y) < hz.radius) this.applyStatus(e, 'stun', hz.stun);
        }
        if (age > 0.5) this.hazards.splice(i, 1);
      } else if (hz.kind === 'beam') {
        if (!hz.resolved) {
          hz.resolved = true;
          this.emit('fx:beam', { x: hz.x, y: hz.y, angle: hz.angle, length: hz.length, width: hz.width, color: hz.tint });
          if (hz.source === 'enemy') {
            if (this.linesHit(hz, p.x, p.y - 20, hz.width * 0.6 + p.radius)) this.damagePlayer(hz.damage, null, null, hz.attacker);
          } else {
            for (const e of this.enemies) {
              if (e.dead) continue;
              if (this.linesHit(hz, e.x, e.y - 12, hz.width * 0.6 + e.radius)) {
                this.hitEnemy(e, hz.damage, { source: 'skill' });
                if (hz.slow) this.applyStatus(e, 'slow', hz.slow, 2);
              }
            }
          }
        }
        if (age > 0.35) this.hazards.splice(i, 1);
      } else if (hz.kind === 'lance' || hz.kind === 'blast' || hz.kind === 'thorns') {
        // Second-wave enemy attacks. All three resolve on the same principle:
        // one damage tick when the telegraph expires, then a short readable
        // aftermath. They used to fall through to the final `else` below, which
        // simply spliced them out — the telegraph drew, then nothing happened.
        if (!hz.resolved) {
          hz.resolved = true;
          const px = p.x;
          const py = p.y;
          let hit = false;
          if (hz.kind === 'lance') {
            // a committed straight line: side-stepping avoids it entirely
            hit = this.linesHit(hz, px, py - 18, hz.width * 0.5 + p.radius);
            this.emit('fx:lineStrike', { x: hz.x, y: hz.y, x2: hz.x + Math.cos(hz.angle) * hz.length, y2: hz.y + Math.sin(hz.angle) * hz.length, width: hz.width, color: hz.tint });
          } else {
            hit = dist(hz.x, hz.y, px, py) < hz.radius + p.radius * 0.35;
            this.emit('fx:impact', { x: hz.x, y: hz.y, radius: hz.radius, color: hz.tint });
          }
          if (hit) {
            this.damagePlayer(hz.damage, null, null, hz.attacker);
            if (hz.root) this.playerRoot = Math.max(this.playerRoot || 0, hz.root);
          }
          if (hz.onLand) hz.onLand();
          if (hz.kind === 'thorns') this.emit('fx:patch', { x: hz.x, y: hz.y, radius: hz.radius * 0.8, tint: hz.tint });
        }
        if (age > 0.45) this.hazards.splice(i, 1);
      } else if (hz.kind === 'line') {
        if (!hz.resolved) {
          hz.resolved = true;
          this.emit('fx:lineStrike', { x: hz.x, y: hz.y, x2: hz.x2, y2: hz.y2, width: hz.width, color: hz.tint || hz.color });
          if (this.linesHit({ x: hz.x, y: hz.y, angle: angle(hz.x, hz.y, hz.x2, hz.y2), length: dist(hz.x, hz.y, hz.x2, hz.y2) }, p.x, p.y - 20, hz.width * 0.5 + p.radius)) {
            if (hz.source === 'enemy') this.damagePlayer(hz.damage, null, null, hz.attacker);
          }
        }
        if (age > 0.4) this.hazards.splice(i, 1);
      } else {
        this.hazards.splice(i, 1);
      }
    }
  }

  linesHit(hz, px, py, radius) {
    const ex = hz.x + Math.cos(hz.angle) * hz.length;
    const ey = hz.y + Math.sin(hz.angle) * hz.length;
    return pointLineDistance(px, py, hz.x, hz.y, ex, ey) < radius;
  }

  updateZones(dt) {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.t += dt;
      if (z.kind === 'void') {
        for (const e of this.enemies) {
          if (e.dead) continue;
          const d = dist(e.x, e.y, z.x, z.y);
          if (!e.boss && !e.mini && d < z.radius * 2.4 && d > 4) {
            const a = angle(e.x, e.y, z.x, z.y);
            const pull = 110 * (1 - d / (z.radius * 2.4));
            e.x += Math.cos(a) * pull * dt;
            e.y += Math.sin(a) * pull * dt * 0.6;
          }
          if (d < z.radius && z.t > z.time) {
            const hpBefore = e.hp;
            const dealt = this.hitEnemy(e, z.bomb || z.damagePerTick, { source: 'skill' });
            if (z.lifesteal) this.heal(Math.min(hpBefore, dealt) * z.lifesteal);
            if (z.slow && !e.dead) this.applyStatus(e, 'slow', z.slow, 1.4);
          }
        }
      } else if (z.kind === 'wall') {
        // Solid cover. Handled here (not in the damage paths below) because a
        // wall must not hurt anything — it only blocks movement, and it expires
        // on its own so it can never trap the player permanently.
        if (z.t > z.time) { this.zones.splice(i, 1); continue; }
      } else if (z.source === 'enemy') {
        // Enemy hazard patches (crystal shards, caustic slime) damage the PLAYER.
        // Without this branch they fell into the enemy-damage path below, where
        // an enemy-owned patch hurt nobody at all — a telegraph that promised
        // damage it never delivered.
        const p = this.player;
        if (dist(p.x, p.y, z.x, z.y) < z.radius + p.radius * 0.4) {
          z.dmgTick = (z.dmgTick || 0) - dt;
          if (z.dmgTick <= 0 && z.dps) {
            z.dmgTick = 0.45;
            this.damagePlayer(z.dps * 0.45, null, null, z.attacker);
          }
        }
      } else {
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (dist(e.x, e.y, z.x, z.y) < z.radius + e.radius * 0.4) {
            if (z.pull && !e.boss && !e.mini) {
              const a = angle(e.x, e.y, z.x, z.y);
              e.x += Math.cos(a) * z.pull * dt;
              e.y += Math.sin(a) * z.pull * dt * 0.6;
            }
            // New movement trails only deal damage for the part of this step
            // during which they are alive, even at coarse frame rates.
            const trail = z.source === 'dashTrail' || z.source === 'sprintTrail';
            const activeDt = trail ? Math.max(0, Math.min(dt, z.time - (z.t - dt))) : dt;
            if (z.dps && activeDt > 0) this.hitEnemy(e, z.dps * activeDt, { source: z.source, tick: true, silent: true });
            if (z.slow) this.applyStatus(e, 'slow', z.slow, 0.4);
          }
        }
      }
      if (!z.tick) z.tick = 0;
      z.tick -= dt;
      if (z.tick <= 0) {
        z.tick = 0.4;
        this.emit('fx:zonePulse', { x: z.x, y: z.y, radius: z.radius, color: z.tint, kind: z.kind });
      }
      if (z.t > z.time) this.zones.splice(i, 1);
    }
    // traps
    for (let i = this.traps.length - 1; i >= 0; i--) {
      const tr = this.traps[i];
      tr.t += dt;
      if (tr.t >= tr.time) { this.traps.splice(i, 1); continue; }
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (dist(e.x, e.y, tr.x, tr.y) < tr.radius) {
          this.applyStatus(e, tr.banana ? 'stun' : 'root', tr.root);
          if (tr.revealTime) e.revealTime = Math.max(e.revealTime || 0, tr.revealTime);
          if (tr.damage) this.hitEnemy(e, tr.damage, { source: 'trap' });
          this.emit('fx:trap', { x: tr.x, y: tr.y, color: tr.tint });
          this.traps.splice(i, 1);
          break;
        }
      }
    }
  }

  updateMinions(dt) {
    const p = this.player;
    for (let i = this.minions.length - 1; i >= 0; i--) {
      const m = this.minions[i];
      m.t += dt;
      if (m.kind === 'orb') {
        const activeDt = Math.max(0, Math.min(dt, m.time));
        m.angle += activeDt * 2.4;
        m.x = p.x + Math.cos(m.angle) * m.radius;
        m.y = p.y - 24 + Math.sin(m.angle) * m.radius * 0.55;
        m.time -= dt;
        if (m.burnTrail && m.time > 0) {
          m.trailCd -= dt;
          if (m.trailCd <= 0) {
            m.trailCd += 0.6;
            this.zones.push({ kind: 'fire', x: m.x, y: m.y + 12, radius: 20, time: 0.8,
              t: 0, dps: m.damage * 0.2, tint: m.tint, source: 'orbit' });
          }
        }
        for (const e of this.enemies) {
          if (activeDt <= 0 || e.dead) continue;
          const last = m.hitCd.get(e.uid) ?? -Infinity;
          if (this.time - last < 0.55) continue;
          if (dist2(m.x, m.y, e.x, e.y - 12) < (e.radius + 16) ** 2) {
            m.hitCd.set(e.uid, this.time);
            this.hitEnemy(e, m.damage, { source: 'orbit' });
            if (m.bleed) this.applyStatus(e, 'bleed', m.damage * 0.18 * (e.boss || e.mini ? 0.7 : 1), 2);
            if (m.shoot && !e.dead) {
              const a = Math.atan2((e.y - 12 - m.y) / 0.72, e.x - m.x);
              this.spawnProjectile({ x: m.x, y: m.y, angle: a, speed: 360, damage: m.damage * 0.25,
                radius: 4, life: 0.6, source: 'orbit', owner: 'player', tint: m.tint, shape: 'orb' });
            }
          }
        }
        if (m.time <= 0) this.minions.splice(i, 1);
      } else {
        m.life -= dt;
        if (m.life <= 0 || m.hp <= 0) { this.minions.splice(i, 1); continue; }
        const tgt = this.nearestEnemy(m.x, m.y, 480);
        if (tgt) {
          const a = angle(m.x, m.y, tgt.x, tgt.y);
          const sp = m.kind === 'lion' ? 0 : 150 * (m.moveMult || 1);
          const distT = dist(m.x, m.y, tgt.x, tgt.y);
          if (distT > (m.ranged ? 180 : m.kind === 'lion' ? 120 : 26)) {
            m.x += Math.cos(a) * sp * dt;
            m.y += Math.sin(a) * sp * dt * 0.7;
            m.facing = Math.cos(a) >= 0 ? 1 : -1;
          }
          m.attackCd -= dt;
          if (m.attackCd <= 0 && distT < (m.ranged ? 280 : m.kind === 'lion' ? 170 : 46)) {
            m.attackCd = m.kind === 'kitten' ? 0.7 : m.kind === 'spirit' ? 1.0 : 1.6;
            if (m.kind === 'lion') {
              this.arcDamage(m.x, m.y, 110, 110, 1, TAU, null, m.damage * 1.4, {}, true, 'minion');
              this.emit('fx:impact', { x: m.x, y: m.y, radius: 110, color: '#ffc966' });
            } else if (m.ranged) {
              const aim = Math.atan2((tgt.y - 12 - (m.y - 20)) / 0.72, tgt.x - m.x);
              this.spawnProjectile({ x: m.x, y: m.y - 20, angle: aim, speed: 380, damage: m.damage,
                radius: 6, life: 1.5, source: 'minion', owner: 'player', tint: m.tint, shape: 'orb' });
            } else {
              this.hitEnemy(tgt, m.damage, { source: 'minion' });
              if (m.healOnHit && this.time >= (this.kittenHealReadyAt || 0)) {
                this.heal(m.healOnHit, { silent: true });
                this.kittenHealReadyAt = this.time + 2;
              }
            }
            this.emit('fx:minionHit', { x: tgt.x, y: tgt.y - 16, color: m.tint, kind: m.kind });
          }
        } else {
          // follow the player
          const a = angle(m.x, m.y, p.x + (m.kind === 'kitten' ? 50 : -50), p.y);
          m.x = lerp(m.x, p.x + Math.cos(a) * 40, damp(3, dt));
          m.y = lerp(m.y, p.y, damp(3, dt));
        }
        if (m.area && m.life > 0) this.heal(0.6 * dt, { silent: true });
      }
    }
  }

  updatePickups(dt) {
    const p = this.player;
    const range = 74 + (this.mods.pickup || 0);
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.t += dt;
      const d = dist(pk.x, pk.y, p.x, p.y - 20);
      if (d < range) {
        const a = angle(pk.x, pk.y, p.x, p.y - 20);
        const pull = 200 + (1 - d / range) * 520;
        pk.x += Math.cos(a) * pull * dt;
        pk.y += Math.sin(a) * pull * dt;
      }
      if (d < 22) {
        this.collect(pk);
        this.pickups.splice(i, 1);
      }
      if (pk.t > 26 && pk.kind !== 'chest') {
        this.collect(pk, true);
        this.pickups.splice(i, 1);
      }
    }
  }

  spawnPickup(x, y, kind, value) {
    this.pickups.push({ x, y, kind, value, t: 0, vx: this.rng.range(-40, 40), vy: this.rng.range(-90, -30), land: 0 });
  }

  collect(pk, auto = false) {
    if (pk.kind === 'xp') {
      this.addXp(pk.value);
      this.emit('pickup', { kind: 'xp', x: pk.x, y: pk.y, auto });
    } else if (pk.kind === 'gold') {
      this.gold += pk.value;
      this.emit('pickup', { kind: 'gold', x: pk.x, y: pk.y, auto });
    } else if (pk.kind === 'hp') {
      this.heal(this.stats.hpMax * pk.value);
      this.emit('pickup', { kind: 'hp', x: pk.x, y: pk.y, auto });
    } else if (pk.kind === 'chest') {
      this.openChest();
    } else if (pk.kind === 'ember') {
      this.embersFound = (this.embersFound || 0) + pk.value;
      this.emit('pickup', { kind: 'ember', x: pk.x, y: pk.y, auto });
    }
  }

  openChest() {
    this.emit('chest:open', { x: this.player.x, y: this.player.y });
    this.pendingLevelUps++;
    this.queueOffers();
  }

  addXp(amount) {
    this.xp += amount;
    this.emit('xp', { amount, xp: this.xp, need: this.xpNeed });
    while (this.xp >= this.xpNeed) {
      this.xp -= this.xpNeed;
      this.level++;
      this.xpNeed = xpForLevel(this.level);
      this.pendingLevelUps++;
      this.emit('levelup', { level: this.level });
      // stat growth per level
      this.stats.hpMax += 3 + (this.cat.base.hp / 100) * 1.4;
      this.stats.atk *= 1.018;
      this.heal(6);
    }
    if (this.pendingLevelUps > 0) this.queueOffers();
  }

  /* ── upgrades ──────────────────────────────────────────────────────────── */
  queueOffers() {
    if (this.state === RUN_STATE.LEVELUP && this.offers.length) return;
    const offers = this.rollOffers();
    if (!offers.length) { this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1); return; }
    this.offers = offers;
    this.setState(RUN_STATE.LEVELUP);
    this.emit('offers', { offers, level: this.level });
  }

  rollOffers() {
    const pool = [];
    for (const up of UPGRADES) {
      const have = this.upgradeLevel(up.id);
      if (have >= up.max) continue;
      pool.push({ ...up, level: have });
    }
    // rank-ups for equipped skills are the strongest kind of pick
    const skillUps = this.slots.filter((s) => s && s.rank < (s.def.ranks?.length || 1));
    const picks = [];
    const rand = this.shuffleRng;
    if (skillUps.length && rand.chance(0.45)) {
      const slot = skillUps[Math.floor(rand.float() * skillUps.length)];
      const nextRank = slot.rank + 1;
      if (!slot.branch && slot.def.branch?.rank === nextRank) {
        for (const option of slot.def.branch.options.slice(0, 2)) {
          picks.push({ type: 'skillup', skillId: slot.id, slot: slot.index, rank: nextRank,
            branch: option.id, id: `skillup:${slot.id}:${option.id}` });
        }
      } else {
        picks.push({ type: 'skillup', skillId: slot.id, slot: slot.index, rank: nextRank, id: 'skillup:' + slot.id });
      }
    }
    const shuffled = rand.shuffle(pool);
    const used = new Set(picks.map((p) => p.id));
    const rarityWeight = { common: 100, rare: 46, epic: 17, mythic: 5 };
    for (const up of shuffled) {
      if (picks.length >= 3) break;
      if (used.has(up.id)) continue;
      const w = rarityWeight[up.rarity] || 40;
      const bonus = up.tags?.some((tg) => this.buildTagMatch(tg)) ? 1.25 : 1;
      if (rand.float() * w * bonus > 22) continue;
      picks.push(up);
      used.add(up.id);
    }
    while (picks.length < 3) {
      const fallback = shuffled.find((u) => !used.has(u.id));
      if (!fallback) break;
      picks.push(fallback);
      used.add(fallback.id);
    }
    return picks.slice(0, 3);
  }

  buildTagMatch(tag) {
    const has = this.slots.some((s) => s && s.def.category === tag);
    if (tag === 'summon') return has || this.minions.length > 0;
    if (tag === 'heal') return this.hp < this.stats.hpMax * 0.6;
    if (tag === 'offense') return this.slots.some((s) => s && (s.def.category === 'physical' || s.def.category === 'magic'));
    return has;
  }

  upgradeLevel(id) {
    return this.upgradeLevels?.[id] || 0;
  }

  chooseOffer(index) {
    const offer = this.offers[index];
    if (!offer) return false;
    this.discover('world:levelup');
    if (offer.type === 'skillup') {
      const slot = this.slots[offer.slot];
      if (!slot || slot.id !== offer.skillId || offer.rank !== slot.rank + 1 || offer.rank > (slot.def.ranks?.length || 1)) return false;
      if (!slot.branch && slot.def.branch?.rank === offer.rank) {
        if (!slot.def.branch.options.some(option => option.id === offer.branch)) return false;
        slot.branch = offer.branch;
      } else if (offer.branch) return false;
      slot.rank = offer.rank;
      const maxCharges = Math.max(1, slot.def.params?.charges || 1, skillValues(slot.def, slot.rank).rankValues.charges || 1);
      if (maxCharges > slot.maxCharges) slot.charges += maxCharges - slot.maxCharges;
      slot.maxCharges = maxCharges;
      if (slot.charges > 0) slot.cd = 0;
    } else {
      this.applyUpgrade(offer);
      this.upgradeLevels = this.upgradeLevels || {};
      this.upgradeLevels[offer.id] = (this.upgradeLevels[offer.id] || 0) + 1;
      this.discover(`upgrade:${offer.id}`);
    }
    this.emit('upgrade:chosen', { offer });
    this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1);
    this.offers = [];
    if (this.pendingLevelUps > 0) {
      // Chain the next card without leaving the level-up state.
      const next = this.rollOffers();
      if (next.length) {
        this.offers = next;
        this.emit('offers', { offers: next, level: this.level });
      } else {
        this.pendingLevelUps = 0;
        this.setState(RUN_STATE.FIGHT);
      }
    } else {
      this.setState(RUN_STATE.FIGHT);
    }
    return true;
  }

  applyUpgrade(up) {
    const m = this.mods;
    const a = up.apply || {};
    if (a.atk) m.atk += a.atk;
    if (a.hpMult) {
      const before = this.stats.hpMax;
      m.hpMult += a.hpMult;
      this.stats.hpMax = Math.max(20, this.stats.hpMax * (1 + a.hpMult));
      this.hp = clamp(this.hp + Math.max(0, this.stats.hpMax - before), 1, this.stats.hpMax);
    }
    if (a.crit) this.stats.crit = clamp(this.stats.crit + a.crit, 0, 0.85);
    if (a.critDmg) this.stats.critDmg += a.critDmg;
    if (a.atkSpeed) this.stats.atkSpeed = clamp(this.stats.atkSpeed * (1 + a.atkSpeed), 0.4, 4);
    if (a.move) this.stats.move *= 1 + a.move;
    if (a.def) this.stats.def = clamp(this.stats.def + a.def, 0, 0.78);
    if (a.dodge) this.stats.dodge = clamp(this.stats.dodge + a.dodge, 0, 0.6);
    if (a.regen) this.stats.regen += a.regen;
    if (a.energy) this.stats.energyMax += a.energy;
    if (a.energyRegen) this.stats.energyRegen *= 1 + a.energyRegen;
    if (a.lifesteal) this.stats.lifesteal += a.lifesteal;
    if (a.thorns) this.stats.thorns += a.thorns;
    if (a.cdr) this.stats.cdr = clamp(this.stats.cdr + a.cdr, 0, 0.6);
    for (const key of ['execute', 'ricochet', 'backstab', 'skillDot', 'skillArea', 'skillPierce', 'echo', 'movingArmor', 'lastStand', 'killHeal', 'killBoom', 'goldGain', 'xpGain', 'pickup', 'burnAura', 'slowOnHit', 'stunChance', 'knock', 'summonPower', 'summonExtra', 'autoShield', 'autoShieldCd', 'bleedEvery', 'everyThird', 'fortune', 'dodgeEnergy', 'moonPact', 'stormCall', 'goldenFur', 'revive']) {
      if (a[key] != null) {
        if (key === 'moonPact' || key === 'stormCall') m[key] = a[key];
        else m[key] = (m[key] || 0) + a[key];
      }
    }
    if (a.permanentCompanion) {
      for (let i = 0; i < a.permanentCompanion; i++) {
        this.minions.push({ kind: 'spirit', x: this.player.x, y: this.player.y, t: 0, life: 9999, cd: 0, damage: this.stats.atk * 0.35, hp: 40, maxHp: 40, attackCd: 0, facing: 1, power: 1, tint: '#a48bff' });
        this.statsTotals.minions++;
      }
    }
    if (a.revive) { this.reviveUsed = false; m.revive = a.revive; }
    if (a.moonPact) this.moonPactReady = true;
    this.mods = m;
  }

  updatePassiveEffects(dt) {
    const p = this.player;
    // burn aura
    if (this.mods.burnAura > 0) {
      for (const e of this.enemies) {
        if (!e.dead && dist2(e.x, e.y, p.x, p.y) < 96 * 96) this.hitEnemy(e, this.mods.burnAura * dt, { tick: true, silent: true });
      }
    }
    // storm call
    if (this.mods.stormCall > 0) {
      this.stormTimer -= dt;
      if (this.stormTimer <= 0) {
        this.stormTimer = this.mods.stormCall;
        const target = this.nearestEnemy(p.x, p.y, 420);
        if (target) {
          const n = 1 + (this.upgradeLevels?.storm_call || 1) - 1;
          for (let i = 0; i < n; i++) {
            const e = i === 0 ? target : this.nearestEnemy(target.x, target.y, 200);
            if (e) {
              this.hitEnemy(e, this.stats.atk * 1.4, { source: 'storm' });
              this.emit('fx:lightning', { x: e.x, y: e.y - 20, x2: e.x, y2: 0 });
            }
          }
        }
      }
    }
    if (this.mods.moonPact > 0 && !this.moonPactReady) {
      this.moonPactTimer -= dt;
      if (this.moonPactTimer <= 0) { this.moonPactReady = true; this.emit('moonpact:ready', {}); }
    }
    // scheduled skill callbacks
    if (this.slotsTimeouts && this.slotsTimeouts.length) {
      for (let i = this.slotsTimeouts.length - 1; i >= 0; i--) {
        if (this.time >= this.slotsTimeouts[i].at) {
          const job = this.slotsTimeouts[i];
          this.slotsTimeouts.splice(i, 1);
          job.fn();
        }
      }
    }
    // revive ward timing
    if (this.reviveWard) {
      this.reviveWardTime -= dt;
      if (this.reviveWardTime <= 0) this.reviveWard = false;
    }
  }

  /* ── damage to player ──────────────────────────────────────────────────── */
  damagePlayer(raw, source, projectile, attacker = null) {
    const p = this.player;
    if (!p.alive) return;
    if (p.invuln > 0) return;
    const res = computeIncoming({
      raw, def: this.stats.def, armor: this.buffValue('armor'), movingArmor: this.mods.movingArmor,
      moving: p.moving, lastStand: this.mods.lastStand, hpFrac: this.hp / this.stats.hpMax,
      roll: this.rng.float(), dodge: this.stats.dodge,
      dodgeable: !!source && !source.boss && !source.mini,
    });
    if (res.dodged) {
      p.invuln = 0.25;
      this.emit('player:dodge', { x: p.x, y: p.y });
      if (this.mods.dodgeEnergy) this.energy = Math.min(this.stats.energyMax, this.energy + this.mods.dodgeEnergy);
      return;
    }
    let dmg = res.damage * (1 + this.buffValue('drawback'));
    // No single hit may take more than this share of a full health bar.
    //
    // Enemy damage scales hard with depth (night 10 multiplies it by ~4.8x)
    // while the player's health pool grows mostly through level-ups and perks,
    // so late boss attacks were arriving at 100%+ of max HP. A hit that removes
    // the whole bar is not difficulty, it is an unwinnable coin flip: there is
    // no dodge, no shield and no revive window worth playing around. Clamping
    // the per-hit share keeps the fight dangerous — three of these still kill —
    // while guaranteeing the player always gets to see the attack that killed
    // them and react.
    const maxHit = this.stats.hpMax * MAX_HIT_SHARE;
    if (dmg > maxHit) dmg = maxHit;
    // Skill reflection is based on the mitigated hit, including shield absorption.
    const reflectedBasis = dmg;
    // Shield-break effects belong to the pool that was actually depleted.
    let brokenShield = null;
    if (p.shield > 0) {
      const absorbed = Math.min(p.shield, dmg);
      p.shield -= absorbed;
      dmg -= absorbed;
      this.emit('fx:shieldHit', { x: p.x, y: p.y, amount: absorbed });
      if (absorbed > 0 && p.shield <= 0) {
        brokenShield = p.shieldEffect; p.shieldEffect = null;
        p.buffs = p.buffs.filter(b => !b.reflectProjectiles);
      }
    }
    this.hp -= dmg;
    p.invuln = 0.62;
    p.hurtFlash = 1;
    this.combo = 0;
    this.emit('player:hurt', { amount: dmg, x: p.x, y: p.y, source, projectile });
    this.emit('damage', { amount: dmg, x: p.x, y: p.y - 40, target: 'player' });
    // Track attack ownership separately from `source`: changing `source` would
    // make formerly undodgeable projectile/area attacks dodgeable. A projectile
    // or telegraph may still land after its creator dies, but cannot reflect to
    // that dead creator. Existing passive thorns retain their HP-loss semantics.
    const reflectSource = source || projectile?.attacker || attacker;
    const reflectBuff = this.buffValue('reflect');
    if (reflectSource && !reflectSource.dead) {
      const passive = source ? dmg * this.stats.thorns : 0;
      const returned = passive + reflectedBasis * reflectBuff;
      if (returned > 0) this.hitEnemy(reflectSource, returned, { source: 'thorns' });
    }
    if (reflectedBasis > 0 && this.buffValue('reflectSplash')) {
      const splash = reflectedBasis * reflectBuff * 0.5;
      for (const enemy of this.enemies) {
        if (enemy !== reflectSource && !enemy.dead && dist2(enemy.x, enemy.y, p.x, p.y) < (90 + enemy.radius) ** 2) {
          this.hitEnemy(enemy, splash, { source: 'thorns' });
        }
      }
    }
    if (brokenShield?.breakBlast) {
      const b = brokenShield.breakBlast;
      this.blast({ x: p.x, y: p.y - 12, explode: b.radius, damage: b.damage, tint: b.tint }, null, 1);
    }
    let revived = false;
    if (this.hp <= 0) {
      if (this.reviveWard) {
        this.reviveWard = false; this.hp = 1; this.player.invuln = 1.2; revived = true;
        this.emit('player:reviveWard', {});
      } else if (this.mods.revive > 0 && !this.reviveUsed) {
        this.reviveUsed = true;
        this.hp = this.stats.hpMax * this.mods.revive;
        this.player.invuln = 1.6; revived = true;
        this.emit('player:revive', {});
      } else this.playerDeath();
    }
    if (p.alive && this.hp > 0) {
      if (brokenShield?.breakHeal) this.heal(brokenShield.breakHeal);
      if (brokenShield?.breakInvuln) p.invuln = Math.max(p.invuln, brokenShield.breakInvuln);
      if (!revived && this.buffValue('onHitHeal') > 0) this.heal(this.buffValue('onHitHeal'));
    }
  }

  heal(amount, opts = {}) {
    if (!this.player.alive) return 0;
    const before = this.hp;
    // A heal must never resurrect: once hp has hit 0 the run is over, and
    // passive regen would otherwise tick the corpse back above zero before the
    // death check runs at the end of update().
    if (before <= 0) return 0;
    this.hp = Math.min(this.stats.hpMax, this.hp + amount);
    const gained = this.hp - before;
    if (gained > 0.05 && !opts.silent) {
      this.statsTotals.healing += gained;
      this.emit('heal', { amount: gained, x: this.player.x, y: this.player.y - 40 });
    }
    return gained;
  }

  playerDeath() {
    if (this.state === RUN_STATE.DEAD) return;
    // Clamp at the moment of death. The overkill amount has no meaning once the
    // run is over, and it leaked into the results screen as a negative number
    // (seen in the QA sweep: hp -20.6 on a 620 HP cat).
    if (this.hp < 0) this.hp = 0;
    this.player.alive = false;
    this.setState(RUN_STATE.DEAD);
    this.emit('run:defeat', { night: this.night, wave: this.wave, kills: this.kills, level: this.level, time: this.time, gold: this.gold });
  }

  onWaveClear() {
    this.emit('wave:clear', { night: this.night, wave: this.wave });
    if (this.wave >= 5) {
      if (this.night >= 9) {
        this.setState(RUN_STATE.VICTORY);
        this.emit('run:victory', { night: this.night, kills: this.kills, level: this.level, time: this.time, gold: this.gold });
        return;
      }
      this.night++;
      this.emit('night:begin', { night: this.night, act: actForNight(this.night) });
      this.rewards = this.rollRewards();
      this.setState(RUN_STATE.REWARD);
      return;
    }
    this.waveCleared = false;
    this.beginWave(this.wave + 1);
  }

  rollRewards() {
    const rng = this.shuffleRng;
    const pool = [
      { id: 'heal', label: { vi: 'Hồi 40% máu', en: 'Heal 40%' }, icon: 'heart', apply: () => this.heal(this.stats.hpMax * 0.4) },
      { id: 'maxhp', label: { vi: '+12% máu tối đa', en: '+12% max health' }, icon: 'shield', apply: () => { this.mods.hpMult += 0.12; this.stats.hpMax *= 1.12; this.hp += this.stats.hpMax * 0.12; } },
      { id: 'energy', label: { vi: '+20 năng lượng', en: '+20 energy' }, icon: 'orb', apply: () => { this.stats.energyMax += 20; this.energy += 20; } },
      { id: 'gold', label: { vi: '+40 xu', en: '+40 coins' }, icon: 'coin', apply: () => { this.gold += 40; } },
      { id: 'ember', label: { vi: '+8 tro than', en: '+8 embers' }, icon: 'ember', apply: () => { this.embersFound = (this.embersFound || 0) + 8; } },
      { id: 'crit', label: { vi: '+6% chí mạng', en: '+6% crit' }, icon: 'target', apply: () => { this.stats.crit = clamp(this.stats.crit + 0.06, 0, 0.85); } },
    ];
    const picks = rng.shuffle(pool).slice(0, 3);
    return picks;
  }

  chooseReward(index) {
    const reward = this.rewards[index];
    if (!reward) return false;
    reward.apply();
    this.emit('reward:chosen', { reward });
    this.rewards = [];
    this.pendingLevelUps += 1;
    this.setState(RUN_STATE.FIGHT);
    this.waveCleared = false;
    // a new night starts with a fresh shrine wave
    this.beginWave(1);
    this.queueOffers();
    return true;
  }

  /* ── spawning & fx bookkeeping ─────────────────────────────────────────── */
  updateSpawns(dt) {
    this.waveSpawnTimer -= dt;
    if (this.pendingSpawns.length && this.waveSpawnTimer <= 0) {
      const perBatch = Math.min(this.pendingSpawns.length, 1 + Math.floor(this.wave / 2));
      for (let i = 0; i < perBatch; i++) {
        const entry = this.pendingSpawns.shift();
        if (!entry) break;
        const def = ENEMY_BY_ID[entry.id];
        const e = this.makeEnemy(def, {}, { elite: entry.elite });
        // Spawn from a lane rather than uniformly across a half of the arena.
        // Uniform placement dropped enemies into the space the player happened
        // to be standing in, so they materialised on top of the cat instead of
        // walking in; the lanes keep arrivals readable and off the player.
        const sp = this.pickSpawnPoint();
        e.x = sp.x;
        e.y = sp.y;
        e.spawnT = 0;
        this.enemies.push(e);
        this.emit('enemy:spawn', { enemy: e, x: e.x, y: e.y });
      }
      this.waveSpawnTimer = Math.max(0.24, 0.9 - this.wave * 0.05);
    }
  }

  updateEffects(dt, includeTimers = true) {
    const p = this.player;
    if (p.attackAnim) p.attackAnim = Math.max(0, p.attackAnim - dt * 4.4);
    if (p.hurtFlash) p.hurtFlash = Math.max(0, p.hurtFlash - dt * 2.6);
    if (includeTimers) {
      for (let i = this.floating.length - 1; i >= 0; i--) {
        const f = this.floating[i];
        f.t += dt;
        if (f.t > f.life) this.floating.splice(i, 1);
      }
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      // handled in updateProjectiles; nothing to do here
    }
  }

  nearestEnemy(x, y, maxRange = 9999, filter = null) {
    let best = null;
    let bestD = maxRange * maxRange;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (filter && !filter(e)) continue;
      const d = dist2(x, y, e.x, e.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  enemiesInRadius(x, y, r) {
    const out = [];
    for (const e of this.enemies) if (!e.dead && dist2(e.x, e.y, x, y) < r * r) out.push(e);
    return out;
  }

  /** Run summary for the results screen and profile stats. */
  summary() {
    return {
      cat: this.cat.id,
      night: this.night,
      wave: this.wave,
      depth: (this.night - 1) * 5 + this.wave,
      kills: this.kills,
      elites: this.elites,
      level: this.level,
      time: this.time,
      gold: this.gold,
      embers: this.embersFound || 0,
      damage: Math.round(this.statsTotals.damage),
      healing: Math.round(this.statsTotals.healing),
      minions: this.statsTotals.minions,
      casts: this.statsTotals.casts,
      bestStreak: this.bestStreak,
      victory: this.state === RUN_STATE.VICTORY,
      upgrades: this.upgradeLevels || {},
      seed: this.seed,
    };
  }
}

export function pointLineDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 0.0001) return dist(px, py, x1, y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = clamp(t, 0, 1);
  return dist(px, py, x1 + dx * t, y1 + dy * t);
}

export function autoplayInput(run) {
  const p = run.player;
  const target = run.nearestEnemy(p.x, p.y, 900);
  let moveX = 0;
  let moveY = 0;
  if (target) {
    const d = dist(p.x, p.y, target.x, target.y);
    const a = angle(p.x, p.y, target.x, target.y);
    const want = run.slots.some((s) => s && s.def.category === 'physical') ? 62 : 210;
    const dir = d > want + 20 ? 1 : d < want - 30 ? -1 : 0;
    moveX = Math.cos(a) * dir;
    moveY = Math.sin(a) * dir;
    // gentle strafing so the bot does not look robotic
    const strafe = Math.sin(run.time * 1.3) * 0.5;
    moveX += Math.cos(a + Math.PI / 2) * strafe;
    moveY += Math.sin(a + Math.PI / 2) * strafe * 0.6;
  }
  const input = { moveX, moveY, dodge: false };
  void mulberry32;
  return input;
}

export { PLAY, PERK_TIERS };
