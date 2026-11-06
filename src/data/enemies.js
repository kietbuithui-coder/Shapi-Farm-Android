// Enemy roster. Every entry owns a distinct silhouette (`shape`), movement
// profile (`behaviour`) and attack tell. Nothing here is a recoloured twin.

export const ENEMIES = [
  {
    id: 'grub', tier: 'basic', shape: 'grub', hp: 20, speed: 46, damage: 7, radius: 15,
    xp: 4, gold: 0.14, behaviour: 'chase', attack: 'touch', windup: 0.12,
    color: '#7d6ea8', color2: '#332a52', eye: '#ffb84d',
  },
  {
    id: 'darter', tier: 'fast', shape: 'rat', hp: 13, speed: 92, damage: 6, radius: 12,
    xp: 4, gold: 0.12, behaviour: 'strafe', attack: 'touch', windup: 0.08,
    color: '#a8794f', color2: '#4a2c1e', eye: '#ff6b6b',
  },
  {
    id: 'brute', tier: 'tank', shape: 'golem', hp: 74, speed: 30, damage: 16, radius: 23,
    xp: 11, gold: 0.34, behaviour: 'chase', attack: 'slam', windup: 0.55,
    color: '#6e7a6a', color2: '#2e352f', eye: '#9fe0c8',
  },
  {
    id: 'spitter', tier: 'ranged', shape: 'spitter', hp: 22, speed: 34, damage: 8, radius: 14,
    xp: 8, gold: 0.22, behaviour: 'keepDistance', preferred: 220, attack: 'shoot', windup: 0.45, projectileSpeed: 210,
    color: '#5f9a7a', color2: '#20402f', eye: '#e8ffb0',
  },
  {
    id: 'wisp', tier: 'caster', shape: 'wisp', hp: 18, speed: 58, damage: 9, radius: 13,
    xp: 9, gold: 0.24, behaviour: 'orbit', attack: 'shoot', windup: 0.7, projectileSpeed: 170, projectileCount: 3,
    color: '#8fb6ff', color2: '#3a4d86', eye: '#dff0ff',
  },
  {
    id: 'leaper', tier: 'fast', shape: 'frog', hp: 24, speed: 40, damage: 11, radius: 15,
    xp: 7, gold: 0.2, behaviour: 'leap', attack: 'touch', windup: 0.35, leapTime: 0.42, leapSpeed: 380,
    color: '#7fa85c', color2: '#2d3c1e', eye: '#ffe066',
  },
  {
    id: 'bomber', tier: 'suicide', shape: 'mushroom', hp: 16, speed: 74, damage: 26, radius: 13,
    xp: 6, gold: 0.18, behaviour: 'rush', attack: 'explode', windup: 0.5, blast: 74,
    color: '#c96a5e', color2: '#4a1c1a', eye: '#ffd9a8',
  },
  {
    id: 'warden', tier: 'support', shape: 'turtle', hp: 48, speed: 26, damage: 9, radius: 18,
    xp: 10, gold: 0.3, behaviour: 'chase', attack: 'shockwave', windup: 0.6, blast: 96, shields: true,
    color: '#5d8f8a', color2: '#1f3a38', eye: '#a8ffe0',
  },
  {
    id: 'banshee', tier: 'caster', shape: 'banshee', hp: 34, speed: 40, damage: 14, radius: 16,
    xp: 12, gold: 0.32, behaviour: 'keepDistance', preferred: 260, attack: 'scream', windup: 0.85, blast: 130,
    color: '#b8b0d8', color2: '#4a4364', eye: '#ff8fa8',
  },
  {
    id: 'stalker', tier: 'eliteish', shape: 'cat_shade', hp: 60, speed: 66, damage: 15, radius: 17,
    xp: 15, gold: 0.4, behaviour: 'stalk', attack: 'lunge', windup: 0.45, lunge: 300,
    color: '#3c3358', color2: '#171228', eye: '#ff4f5e',
  },

  /* ── second wave of enemies ───────────────────────────────────────────────
     Added for the update brief. Each one is a different PROBLEM for the player,
     not a reskin: a flanker that refuses to be outrun, a slow wall you have to
     route around, a flyer that ignores your spacing, a walking bomb that makes
     you leave the spot you wanted, and a siege unit that punishes turtling. */

  {
    // Fades to near-invisible, then commits from behind. The counter is to keep
    // moving sideways; standing still inside its ring is what gets you hit.
    id: 'shadow_stalker', tier: 'eliteish', shape: 'shadowstalker', hp: 46, speed: 74, damage: 14, radius: 16,
    xp: 14, gold: 0.36, behaviour: 'phaseStalk', attack: 'backstab', windup: 0.5,
    fadeRange: 260, strikeRange: 96, color: '#2f2a48', color2: '#0d0b18', eye: '#b06bff',
  },
  {
    // Slow, armoured, and it leaves crystal shards where it walks. You route
    // around it instead of through it.
    // 88 hp made this the single biggest damage source in the game (18.9% of all
    // damage taken, ~3x the next enemy): a slow, bulky body keeps the player in
    // contact range far longer than a fast one does, so its contact attack
    // landed repeatedly while it refused to die. Lowered hp and damage; the
    // threat it is designed to pose (area denial from walk-dropped shards) is
    // unchanged.
    id: 'crystal_crawler', tier: 'tank', shape: 'crystalcrawler', hp: 62, speed: 24, damage: 9, radius: 20,
    xp: 12, gold: 0.3, behaviour: 'advance', attack: 'touch', windup: 0.34,
    drops: 'crystal', dropCd: 2.6, color: '#7fd4d8', color2: '#1d4a52', eye: '#e8ffff',
  },
  {
    // Flying, so it ignores the ground spacing the player has been winning with.
    // Dives along a curved path rather than a straight line.
    id: 'arcane_bat', tier: 'fast', shape: 'arcanebat', hp: 22, speed: 96, damage: 10, radius: 12,
    xp: 8, gold: 0.2, behaviour: 'diveBomb', attack: 'touch', windup: 0.22, diveCd: 2.2,
    color: '#6a5fa8', color2: '#241d3f', eye: '#ffd24a',
  },
  {
    // A delayed fuse. The explosion is telegraphed with a growing ring, and it
    // leaves a short-lived pool, so the safe answer is "leave", not "trade".
    id: 'explosive_slime', tier: 'suicide', shape: 'slime', hp: 34, speed: 56, damage: 26, radius: 16,
    xp: 9, gold: 0.24, behaviour: 'creep', attack: 'burst', windup: 0.9, blast: 84,
    burstCd: 4.2, color: '#8ad14b', color2: '#2a4416', eye: '#f6ffb0',
  },
  {
    // Area denial. Roots a thorn patch under the player, so hiding in a corner
    // stops working and the fight keeps moving.
    id: 'thorn_beast', tier: 'ranged', shape: 'thornbeast', hp: 66, speed: 30, damage: 16, radius: 20,
    xp: 13, gold: 0.34, behaviour: 'siege', attack: 'thorns', windup: 0.85,
    preferred: 300, thornRadius: 62, color: '#5c7a3a', color2: '#22300f', eye: '#ffb84d',
  },
];

export const ENEMY_BY_ID = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));

/** Elite modifiers roll onto a base enemy; each is visibly telegraphed. */
export const ELITE_MODS = [
  { id: 'armored', name: { vi: 'Bọc Giáp', en: 'Armored' }, hp: 2.1, dmg: 1.0, scale: 1.16, tint: '#9fb0c9', aura: 'plate' },
  { id: 'feral', name: { vi: 'Cuồng Nộ', en: 'Feral' }, hp: 1.25, dmg: 1.5, scale: 1.08, speed: 1.24, tint: '#ff6b6b', aura: 'rage' },
  { id: 'venom', name: { vi: 'Nọc Độc', en: 'Venomous' }, hp: 1.5, dmg: 1.2, scale: 1.05, tint: '#9ad14b', aura: 'venom', onHit: 'poison' },
  { id: 'swift', name: { vi: 'Nhanh Nhẹn', en: 'Swift' }, hp: 1.1, dmg: 1.0, scale: 0.92, speed: 1.5, tint: '#5fd6ff', aura: 'wind' },
  { id: 'warded', name: { vi: 'Trì Hoãn', en: 'Warded' }, hp: 1.8, dmg: 1.1, scale: 1.12, tint: '#b48bff', aura: 'rune', slowOnHit: 0.35 },
];

/** Mini-bosses appear at fixed wave milestones and guard a heal shrine. */
export const MINIBOSSES = [
  {
    id: 'grub_mother', name: { vi: 'Mẹ Mọt Bóng', en: 'Broodmother' }, shape: 'broodmother',
    hp: 420, speed: 34, damage: 14, radius: 34, xp: 90, gold: 3,
    behaviour: 'boss', attack: 'spawner', windup: 0.9, spawn: 'grub', spawnCount: 4, spawnCd: 4.4,
    color: '#8a6fb8', color2: '#2c2350', eye: '#ffb84d',
  },
  {
    id: 'stone_warden', name: { vi: 'Thạch Vệ', en: 'Stone Warden' }, shape: 'wardenbig',
    hp: 560, speed: 28, damage: 20, radius: 36, xp: 110, gold: 4,
    behaviour: 'boss', attack: 'ringSlam', windup: 0.8, blast: 150, ringCount: 8,
    color: '#79856f', color2: '#2c332b', eye: '#9fe0c8',
  },
  {
    id: 'siren', name: { vi: 'Nàng Sương', en: 'The Mist Siren' }, shape: 'siren',
    hp: 640, speed: 46, damage: 18, radius: 30, xp: 130, gold: 5,
    behaviour: 'boss', attack: 'screamPlus', windup: 1.0, blast: 170, projectileCount: 10,
    color: '#b0bee0', color2: '#3f4a74', eye: '#ff8fa8',
  },
];

/** Three-stage act bosses. Phases swap patterns; every attack has a tell. */
export const BOSSES = [
  {
    id: 'moon_devourer', name: { vi: 'Kẻ Nuốt Trăng', en: 'The Moon Devourer' }, title: { vi: 'Chủ Nhân Đêm Đầu', en: 'Master of the First Night' },
    shape: 'devourer', hp: 1380, speed: 40, damage: 22, radius: 52, xp: 420, gold: 18, act: 1,
    color: '#5b4a8f', color2: '#1c1633', eye: '#ffd24a', glow: '#a48bff',
    phases: [
      { at: 1.0, attacks: ['fanShot', 'telepounce', 'summonMoths'] },
      { at: 0.6, attacks: ['fanShot', 'eclipse', 'summonMoths', 'telepounce'], speed: 1.12 },
      { at: 0.28, attacks: ['eclipse', 'moonBeam', 'enrage'], speed: 1.24, dmgMult: 1.2 },
    ],
  },
  {
    id: 'lantern_king', name: { vi: 'Vua Đèn Lồng', en: 'The Lantern King' }, title: { vi: 'Kẻ Đốt Hồn', en: 'Soulburner' },
    shape: 'lanternking', hp: 2100, speed: 36, damage: 26, radius: 54, xp: 520, gold: 24, act: 2,
    color: '#b86a3a', color2: '#2b150f', eye: '#ffe066', glow: '#ff8f4d',
    phases: [
      { at: 1.0, attacks: ['emberRain', 'dashSlash', 'summonImps'] },
      { at: 0.62, attacks: ['emberRain', 'dashSlash', 'lanternNova', 'summonImps'], speed: 1.1 },
      { at: 0.3, attacks: ['lanternNova', 'emberRain', 'dashSlash', 'enrage'], speed: 1.22, dmgMult: 1.22 },
    ],
  },
  {
    id: 'hollow_ninth', name: { vi: 'Mạng Thứ Chín', en: 'The Hollow Ninth' }, title: { vi: 'Điều Còn Lại', en: 'What Remains' },
    shape: 'hollow', hp: 3000, speed: 44, damage: 30, radius: 56, xp: 680, gold: 34, act: 3,
    color: '#4a5566', color2: '#0d1119', eye: '#3fd6a8', glow: '#3fd6a8',
    phases: [
      { at: 1.0, attacks: ['blinkClaw', 'echoRing', 'summonShades'] },
      { at: 0.65, attacks: ['blinkClaw', 'echoRing', 'nineLash', 'summonShades'], speed: 1.14 },
      { at: 0.35, attacks: ['nineLash', 'echoRing', 'blinkClaw', 'enrage'], speed: 1.3, dmgMult: 1.26 },
      { at: 0.12, attacks: ['nineLash', 'echoRing', 'enrage'], speed: 1.4, dmgMult: 1.4, finale: true },
    ],
  },
];

export const BOSS_BY_ID = Object.fromEntries(BOSSES.map((b) => [b.id, b]));
export const MINIBOSS_BY_ID = Object.fromEntries(MINIBOSSES.map((b) => [b.id, b]));
