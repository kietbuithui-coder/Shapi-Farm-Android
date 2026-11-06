// Stat derivation + damage math. Pure functions only: no DOM, no timers, so the
// whole combat model is unit-testable in Node.

import { clamp } from '../core/math.js';
import { perkBonuses } from '../data/perks.js';

export const BASE = {
  atk: 10, hp: 100, def: 0.05, crit: 0.05, critDmg: 1.5,
  atkSpeed: 1, move: 210, cdr: 0, dodge: 0.03,
  energy: 100, energyRegen: 8, lifesteal: 0, thorns: 0,
};

/** Run-level modifiers (from upgrades + skills) start at zero. */
export function emptyMods() {
  return {
    atk: 0, hpMult: 0, def: 0, crit: 0, critDmg: 0, atkSpeed: 0, move: 0, cdr: 0,
    dodge: 0, energy: 0, energyRegen: 0, lifesteal: 0, thorns: 0, regen: 0,
    skillArea: 0, skillPierce: 0, execute: 0, ricochet: 0, backstab: 0,
    killHeal: 0, killBoom: 0, goldGain: 0, xpGain: 0, pickup: 0,
    burnAura: 0, slowOnHit: 0, stunChance: 0, knock: 0, echo: 0,
    movingArmor: 0, lastStand: 0, revive: 0, moonPact: 0, stormCall: 0,
    goldenFur: 0, dodgeEnergy: 0, summonPower: 0, summonExtra: 0,
    permanentCompanion: 0, autoShield: 0, autoShieldCd: 20, bleedEvery: 0, everyThird: 0,
    skillDot: 0, fortune: 0,
  };
}

/**
 * Build the player's effective stats.
 * @param {object} cat  cat definition
 * @param {object} opts { perks, mods, level, catLevel }
 */
/**
 * Global power trim, applied to every cat equally.
 *
 * Ten percent off offence and survivability, in one place, so no single cat can
 * drift out of line with the rest. Deliberately NOT applied to move speed, attack
 * speed or crit damage: those are pacing and multiplier semantics, where a 10%
 * cut stops being a 10% nerf (slower cats read as sluggish, and a crit of
 * 1.35x barely differs from an unmodified hit).
 */
const CAT_POWER = 0.9;

export function buildStats(cat, { perks = {}, mods = emptyMods(), level = 1, catLevel = 1 } = {}) {
  const pb = perkBonuses(perks);
  const b = cat.base;
  const m = { ...emptyMods(), ...mods };
  const hpMult = 1 + m.hpMult + pb.hp;
  const stats = {
    atk: BASE.atk * b.atk * (1 + m.atk + pb.atk) * CAT_POWER,
    hpMax: BASE.hp * (b.hp / 100) * hpMult * CAT_POWER,
    def: clamp((b.def + m.def + pb.def + (level - 1) * 0.004) * CAT_POWER, 0, 0.78),
    crit: clamp((b.crit + m.crit + pb.crit) * CAT_POWER, 0, 0.85),
    critDmg: b.critDmg + m.critDmg,
    atkSpeed: clamp(b.atkSpeed * (1 + m.atkSpeed), 0.4, 4),
    move: BASE.move * b.move * (1 + m.move + pb.move),
    cdr: clamp(b.cdr + m.cdr + pb.cdr + (catLevel - 1) * 0.01, 0, 0.6),
    dodge: clamp((b.dodge + m.dodge) * CAT_POWER, 0, 0.6),
    energyMax: (b.energy || 100) * (1 + pb.energy) + m.energy,
    energyRegen: (b.energyRegen || 8) * (1 + (m.energyRegen || 0)) * (1 + pb.energy * 0.5),
    lifesteal: m.lifesteal,
    thorns: m.thorns,
    regen: m.regen,
  };
  return { stats, mods: m, perks: pb };
}

/** Deterministic-ish damage roll. `roll` is injected for testability. */
export function computeDamage({
  base, atk, crit = 0, critDmg = 1.5, forceCrit = false, amp = 0,
  execute = 0, targetHpFrac = 1, backstab = 0, roll = 0.5,
  variance = 0.06, defense = 0, penetration = 0,
}) {
  const isCrit = forceCrit || roll < crit;
  if (!(base > 0) || !(atk > 0)) return { damage: 0, isCrit };
  let dmg = base * atk;
  // execute bonus ramps in below 40% health
  if (execute > 0 && targetHpFrac < 0.4) {
    const t = clamp((0.4 - targetHpFrac) / 0.4, 0, 1);
    dmg *= 1 + execute * t;
  }
  if (backstab > 0) dmg *= 1 + backstab;
  dmg *= 1 + amp;
  if (isCrit) dmg *= critDmg;
  const jitter = 1 + (roll - 0.5) * 2 * variance;
  dmg *= jitter;
  const mitigation = clamp(defense - penetration, 0, 0.85);
  dmg *= 1 - mitigation;
  return { damage: Math.max(1, dmg), isCrit };
}

/** Damage dealt to the player, after armor, dodge and situational rules. */
export function computeIncoming({
  raw, def = 0, armor = 0, movingArmor = 0, moving = false,
  lastStand = 0, hpFrac = 1, roll = 0.5, dodge = 0, dodgeable = true,
}) {
  if (dodgeable && roll < dodge) return { damage: 0, dodged: true, blocked: false };
  let dmg = raw;
  let mitigation = clamp(def + armor, 0, 0.82);
  if (moving && movingArmor > 0) mitigation = clamp(mitigation + movingArmor, 0, 0.86);
  let blocked = false;
  if (lastStand > 0 && hpFrac < 0.25) { mitigation = clamp(mitigation + 0.2, 0, 0.88); blocked = true; }
  dmg *= 1 - mitigation;
  return { damage: Math.max(1, dmg), dodged: false, blocked };
}

/** Armour curve used by enemies (kept flat & readable). */
export const enemyArmor = (tier) => (tier === 'tank' ? 0.18 : tier === 'eliteish' ? 0.1 : 0.02);

/**
 * XP needed for the next level.
 *
 * Levelling was coming too fast to feel like progress, so every requirement is
 * scaled by PACE — the amount of XP asked for goes up, the curve keeps its
 * shape. This is a tuning constant on purpose: nothing in the UI quotes a
 * level-up rate, so the change is felt as a slower climb rather than read as
 * a number that moved.
 */
const XP_PACE = 1.35;

export function xpForLevel(level) {
  return Math.floor((11 + level * 9 + Math.pow(level, 1.72) * 2.4) * XP_PACE);
}

/** Difficulty ramp for enemy stat scaling by night + wave. */
export function difficultyScale(night, wave) {
  const t = (night - 1) * 5 + wave;
  const act = Math.max(0, Math.floor((night - 1) / 3));
  return {
    hp: (1 + t * 0.19 + Math.pow(t, 1.5) * 0.016) * (1 + act * 0.12),
    dmg: 1 + t * 0.072 + act * 0.06,
    speed: 1 + Math.min(0.4, t * 0.012),
    xp: 1 + t * 0.06,
    gold: 1 + t * 0.05,
  };
}
