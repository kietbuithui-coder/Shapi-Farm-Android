// Codex / wiki content, derived from the live game data.
//
// The brief is explicit that the wiki must PULL FROM the systems the game
// already runs, not duplicate them in a second database that can drift. So this
// module holds no monster stats, no skill numbers and no flavour text of its
// own: every entry is built by reading the real definition objects the combat
// code uses. If a skill's damage changes, the wiki changes with it, because
// there is only one number.
//
// What this file does own is the part the game has no concept of: which
// category an entry belongs to, what unlocks it, and what it is called in the
// codex. That is presentation, and it is allowed to be knowledge the data does
// not have.
//
// Everything is locked until discovered. Discovery is recorded in
// profile.seen[key] (a map that already existed in the save schema but was
// never written to), so the codex persists with the save and cannot be
// unlocked by a URL.

import { ENEMIES, MINIBOSSES, BOSSES } from './enemies.js';
import { SKILLS, SKILL_CATEGORIES, skillName, maxRank } from './skills.js';
import { PERK_LINES, PERK_TIERS, PERK_COST } from './perks.js';
import { CATS } from './cats.js';
import { ACHIEVEMENTS } from './achievements.js';
import { UPGRADES, UPGRADE_TAGS } from './upgrades.js';

const L = (vi, en) => ({ vi, en });

/** Category order is the order the codex shows them in. */
export const WIKI_CATEGORIES = [
  { id: 'bestiary', name: L('Sổ Tay Sinh Vật', 'Bestiary'), icon: 'paw', desc: L('Những thứ đã săn bạn.', 'The things that hunted you.') },
  { id: 'bosses', name: L('Trùm', 'Bosses'), icon: 'skull', desc: L('Những kẻ chờ ở cuối mỗi đêm.', 'What waits at the end of each night.') },
  { id: 'skills', name: L('Kỹ Năng', 'Skills'), icon: 'orb', desc: L('Chuyển động bạn có thể học.', 'The moves you can learn.') },
  { id: 'cat', name: L('Mèo', 'Cats'), icon: 'kitten', desc: L('Mỗi con mèo chiến đấu khác nhau.', 'Every cat fights differently.') },
  { id: 'perks', name: L('Tàn Lửa', 'Embers'), icon: 'ember', desc: L('Sức mạnh vĩnh viễn.', 'The power that stays.') },
  { id: 'upgrades', name: L('Nâng Cấp', 'Upgrades'), icon: 'star', desc: L('Những thứ bạn chọn giữa các đợt.', 'What you pick between waves.') },
  { id: 'world', name: L('Thế Giới', 'World'), icon: 'target', desc: L('Sân thượng, các đêm, và luật chơi.', 'The terrace, the nights, and the rules.') },
  { id: 'feats', name: L('Chiến Tích', 'Feats'), icon: 'star', desc: L('Bằng chứng bạn đã ở đó.', 'Proof you were there.') },
];

/* ── helpers ──────────────────────────────────────────────────────────────── */

const hpLine = (n) => L(`${n} máu`, `${n} HP`);
const element = (color) => color || '#cfe4ff';

/** Difficulty tier label from raw stats — description, not a new number. */
function threatOf(def) {
  const hp = def.hp || 0;
  if (def.boss) return L('Trùm', 'Boss');
  if (hp >= 120) return L('Nguy hiểm', 'Dangerous');
  if (hp >= 60) return L('Cứng cáp', 'Sturdy');
  return L('Yếu ớt', 'Frail');
}

/** Human description of what an enemy's AI actually does. */
function behaviourLine(def) {
  const map = {
    chase: L('Lao thẳng vào bạn.', 'Runs straight at you.'),
    darter: L('Phóng tới theo từng nhịp.', 'Darts in bursts.'),
    leaper: L('Nhảy vồ từ xa.', 'Leaps from a distance.'),
    shooter: L('Bắn từ xa, giữ khoảng cách.', 'Shoots from range and keeps its distance.'),
    orbit: L('Lượn quanh bạn.', 'Orbits you.'),
    charger: L('Lấy đà rồi húc.', 'Winds up, then charges.'),
    exploder: L('Phát nổ khi tới gần.', 'Detonates when it reaches you.'),
    summoner: L('Gọi thêm quái.', 'Calls in more.'),
    stalker: L('Rình rồi đánh lén.', 'Stalks, then strikes from behind.'),
    burrow: L('Chui dưới đất rồi trồi lên.', 'Burrows and surfaces under you.'),
    brute: L('Chậm, nặng, đau.', 'Slow, heavy, painful.'),
    boss: L('Chiến đấu theo từng giai đoạn.', 'Fights in phases.'),
  };
  return map[def.behaviour] || L('Tấn công khi lại gần.', 'Attacks when it closes in.');
}

/**
 * Display names for regular enemies.
 *
 * These live here rather than in enemies.js because the game itself never shows
 * a minion's name: enemies are identified by silhouette and colour, which is the
 * whole point of the art direction. Only the codex needs words, so only the
 * codex owns them — adding a name field to the combat data would imply the
 * renderer used it.
 *
 * Anything missing falls back to the id with underscores turned into spaces,
 * so a new enemy still appears in the bestiary (untranslated) instead of
 * silently vanishing from it.
 */
const ENEMY_NAMES = {
  grub: L('Sâu Bùn', 'Mud Grub'),
  darter: L('Kẻ Phóng', 'Darter'),
  brute: L('Mèo Hoang Nặng', 'Heavy Brute'),
  spitter: L('Kẻ Phun', 'Spitter'),
  wisp: L('Đốm Ma', 'Wisp'),
  leaper: L('Kẻ Nhảy', 'Leaper'),
  bomber: L('Kẻ Nổ', 'Bomber'),
  warden: L('Người Gác', 'Warden'),
  banshee: L('Nữ Quỷ', 'Banshee'),
  stalker: L('Kẻ Rình', 'Stalker'),
  shadow_stalker: L('Rình Bóng', 'Shadow Stalker'),
  crystal_crawler: L('Bò Pha Lê', 'Crystal Crawler'),
  arcane_bat: L('Dơi Phép', 'Arcane Bat'),
  explosive_slime: L('Nhớt Nổ', 'Explosive Slime'),
  thorn_beast: L('Thú Gai', 'Thorn Beast'),
};

const prettify = (id) => id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/* ── the entries ──────────────────────────────────────────────────────────── */

function bestiaryEntries() {
  const out = [];
  for (const def of ENEMIES) {
    out.push({
      id: `enemy:${def.id}`,
      key: `enemy:${def.id}`,
      name: ENEMY_NAMES[def.id] || L(prettify(def.id), prettify(def.id)),
      subtitle: threatOf(def),
      icon: 'paw',
      color: element(def.color),
      shape: def.shape,
      def,                                   // live definition, for the sprite
      lines: [
        behaviourLine(def),
        hpLine(def.hp || 0),
        def.damage ? L(`Gây ${def.damage} sát thương mỗi đòn.`, `Deals ${def.damage} damage per hit.`) : null,
      ].filter(Boolean),
    });
  }
  return out;
}

function bossEntries() {
  return [...MINIBOSSES, ...BOSSES].map((def) => {
    // Name the percentage, not just the count: "phase 2 has 4 attacks" does not
    // tell a player when it starts, which is the one thing they need from a
    // boss page.
    const phases = (def.phases || []).map((ph, i) => {
      const names = [...new Set((ph.attacks || []).map((a) => (typeof a === 'string' ? a : a.id)))];
      const pct = Math.round((ph.at ?? 1) * 100);
      // Build both strings directly. Nesting an L() inside another template
      // interpolates the object itself and prints "[object Object]".
      const viAt = i === 0 ? 'từ đầu' : `dưới ${pct}% máu`;
      const enAt = i === 0 ? 'from the start' : `below ${pct}% HP`;
      return L(
        `Giai đoạn ${i + 1} (${viAt}): ${names.length} đòn`,
        `Phase ${i + 1} (${enAt}): ${names.length} attacks`,
      );
    });
    return {
      id: `boss:${def.id}`,
      key: `boss:${def.id}`,
      name: def.name,
      subtitle: def.title || (def.mini ? L('Bán trùm', 'Miniboss') : L('Trùm', 'Boss')),
      icon: 'skull',
      color: element(def.color),
      shape: def.shape,
      def,
      lines: [hpLine(def.hp), ...phases],
    };
  });
}

function skillEntries() {
  return SKILLS.map((def) => {
    const cat = SKILL_CATEGORIES[def.category];
    return {
      id: `skill:${def.id}`,
      key: `skill:${def.id}`,
      name: def.name,
      subtitle: cat ? L(cat.vi, cat.en) : L('Kỹ năng', 'Skill'),
      icon: 'orb',
      color: element(def.icon && def.icon.tint),
      lines: [
        def.desc,
        def.cost ? L(`Tốn ${def.cost} năng lượng.`, `Costs ${def.cost} energy.`) : null,
        def.cd ? L(`Hồi ${def.cd} giây.`, `${def.cd}s cooldown.`) : null,
        L(`Tối đa ${maxRank(def)} cấp.`, `Up to rank ${maxRank(def)}.`),
      ].filter(Boolean),
    };
  });
}

function catEntries() {
  return CATS.map((def) => ({
    id: `cat:${def.id}`,
    key: `cat:${def.id}`,
    name: def.name,
    subtitle: def.title || def.role || L('Mèo', 'Cat'),
    icon: 'kitten',
    color: element(def.color),
    catArt: def,
    lines: [
      def.desc || def.blurb || L('Một chiến binh.', 'A fighter.'),
      def.hp ? hpLine(def.hp) : null,
      def.speed ? L(`Tốc chạy ${Math.round(def.speed)}.`, `Movement ${Math.round(def.speed)}.`) : null,
    ].filter(Boolean),
  }));
}

function perkEntries() {
  return PERK_LINES.map((def) => ({
    id: `perk:${def.id}`,
    key: `perk:${def.id}`,
    name: def.name,
    subtitle: L(`${PERK_TIERS} bậc`, `${PERK_TIERS} tiers`),
    icon: def.icon,
    color: element(def.color),
    lines: [
      def.label,
      L(
        `Bậc kế tiếp tốn ${PERK_COST[0]} tàn lửa.`,
        `The next tier costs ${PERK_COST[0]} embers.`,
      ),
    ],
  }));
}

function upgradeEntries() {
  return UPGRADES.map((def) => {
    const tag = UPGRADE_TAGS && UPGRADE_TAGS[def.tag];
    return {
      id: `upgrade:${def.id}`,
      key: `upgrade:${def.id}`,
      name: def.name,
      subtitle: tag && tag.name ? tag.name : L('Nâng cấp', 'Upgrade'),
      icon: def.icon || 'star',
      color: element(def.color),
      lines: [def.desc].filter(Boolean),
    };
  });
}

/**
 * World entries are hand-written because the "world" is not one data structure,
 * but every rule stated here is enforced by code elsewhere in the game — these
 * are explanations of mechanics, not new mechanics.
 */
const WORLD_ENTRIES = [
  { id: 'world:terrace', key: 'world:terrace', name: L('Sân Thượng', 'The Terrace'), icon: 'target', color: '#8fe0ff',
    lines: [L('Một sân thượng dài, gió thổi qua lan can. Không có chỗ trốn.', 'A long rooftop terrace. The wind moves through the railing. There is nowhere to hide.')] },
  { id: 'world:night', key: 'world:night', name: L('Một Đêm', 'A Night'), icon: 'moonbeam', color: '#b48bff',
    lines: [L('Mỗi đêm có năm đợt. Đợt cuối là một con trùm.', 'Every night has five waves. The last one is a boss.')] },
  { id: 'world:levelup', key: 'world:levelup', name: L('Lên Cấp', 'Level Up'), icon: 'star', color: '#ffc966',
    lines: [L('Chọn một trong ba thẻ khi lên cấp. Các thẻ này chỉ tồn tại trong một lần chạy.', 'Pick one of three cards on level-up. These only last for the run.')] },
  { id: 'world:dodge', key: 'world:dodge', name: L('Né', 'Dodge'), icon: 'wind', color: '#7ce0c8',
    lines: [L('Né cho bạn một khoảng bất tử ngắn. Dùng nó cho đòn có báo trước, không phải để chạy.', 'A dodge grants a brief window of invulnerability. Use it on telegraphed attacks, not to travel.')] },
  { id: 'world:ember', key: 'world:ember', name: L('Tàn Lửa', 'Embers'), icon: 'ember', color: '#e8a23a',
    lines: [L('Kiếm được sau mỗi lần chạy, dù thắng hay thua. Tiêu vào những bậc vĩnh viễn.', 'Earned after every run, win or lose. Spent on permanent tiers.')] },
  { id: 'world:bosses', key: 'world:bosses', name: L('Trùm Cuối Đêm', 'Night Boss'), icon: 'skull', color: '#ff5f6d',
    lines: [L('Từ đêm thứ mười, các trùm luân phiên — bao gồm cả những kẻ không phải của đêm đó.', 'From night ten the bosses rotate, including ones that do not belong to that act.')] },
  { id: 'world:telegraph', key: 'world:telegraph', name: L('Báo Trước', 'Telegraphs'), icon: 'sigil', color: '#ffe8a8',
    lines: [L('Mọi đòn nguy hiểm đều báo trước bằng một vòng sáng. Nếu bạn thấy nó, bạn còn thời gian.', 'Every dangerous attack warns you with a glowing ring. If you can see it, you can still move.')] },
];

function featEntries(profile) {
  return ACHIEVEMENTS.map((def) => {
    const done = !!(profile && profile.achievements && profile.achievements[def.id]);
    return {
      id: `feat:${def.id}`,
      key: `feat:${def.id}`,
      name: def.name,
      subtitle: done ? L('Đã đạt', 'Earned') : L('Chưa đạt', 'Not yet'),
      icon: 'star',
      color: done ? '#ffc966' : '#5a647f',
      lines: [def.desc].filter(Boolean),
    };
  });
}

/**
 * Build every category for the current profile.
 *
 * Entries are always returned in full; `locked` is what the UI hides. That way
 * the codex can show "12 / 15 discovered" without the caller having to know how
 * each category is stored.
 */
export function buildWiki(profile, lang) {
  const seen = (profile && profile.seen) || {};
  const isEn = lang === 'en';
  const tr = (v) => (!v ? '' : typeof v === 'string' ? v : (isEn ? v.en : v.vi) || v.vi || '');

  const raw = {
    bestiary: bestiaryEntries(),
    bosses: bossEntries(),
    skills: skillEntries(),
    cat: catEntries(),
    perks: perkEntries(),
    upgrades: upgradeEntries(),
    world: WORLD_ENTRIES,
    feats: featEntries(profile),
  };

  return WIKI_CATEGORIES.map((cat) => {
    const entries = (raw[cat.id] || []).map((e) => ({
      ...e,
      title: tr(e.name),
      subtitleText: tr(e.subtitle),
      body: (e.lines || []).map(tr).filter(Boolean),
      locked: !seen[e.key],
    }));
    // Feats are never hidden: you are allowed to know what to aim for. The lock
    // only guards things you have not MET yet, so a bestiary entry cannot spoil
    // a boss before you fight it.
    if (cat.id === 'feats') for (const e of entries) e.locked = false;
    const discovered = entries.filter((e) => !e.locked).length;
    return {
      ...cat,
      label: tr(cat.name),
      blurb: tr(cat.desc),
      entries,
      discovered,
      total: entries.length,
    };
  });
}

/** One place decides how a discovered thing is named in the save. */
export function discoveryKeys(profile) {
  return Object.keys((profile && profile.seen) || {});
}

/** Mark one thing as seen. Returns true when this is the first time. */
export function markSeen(profile, key) {
  if (!profile || !key) return false;
  if (!profile.seen) profile.seen = {};
  if (profile.seen[key]) return false;
  profile.seen[key] = true;
  return true;
}
