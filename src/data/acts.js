// Act structure: nine nights, three acts, each with a mini-boss gate, a
// campfire rest, and an act boss. `table` entries are weighted enemy spawns.

export const ACTS = [
  {
    id: 'act1',
    name: { vi: 'Đêm Đầu', en: 'First Night' },
    subtitle: { vi: 'Vườn Trăng Tàn', en: 'The Ruined Moon Garden' },
    tint: '#3b3a6b',
    tint2: '#121a33',
    accent: '#a48bff',
    env: 'garden',
    nights: 1,
    miniBoss: 'grub_mother',
    boss: 'moon_devourer',
    table: [
      { id: 'grub', weight: 40 },
      { id: 'darter', weight: 26 },
      { id: 'spitter', weight: 12 },
      { id: 'leaper', weight: 12 },
      { id: 'brute', weight: 10 },
      // Newcomers arrive spread across the three acts rather than all at once:
      // act 1 teaches the bat (airborne, easy to read), act 2 the slime and the
      // crawler, act 3 the stalker and the thorn beast.
      { id: 'arcane_bat', weight: 14 },
      { id: 'explosive_slime', weight: 8 },
    ],
    intro: { vi: 'Đêm nuốt lấy khu vườn. Ngọn đèn đã tắt.', en: 'Night swallows the garden. The lanterns are out.' },
  },
  {
    id: 'act2',
    name: { vi: 'Đêm Thứ Ba', en: 'Third Night' },
    subtitle: { vi: 'Phố Đèn Lồng', en: 'Lantern Row' },
    tint: '#5b3120',
    tint2: '#1d1009',
    accent: '#ff8f4d',
    env: 'town',
    miniBoss: 'stone_warden',
    boss: 'lantern_king',
    table: [
      { id: 'darter', weight: 22 },
      { id: 'bomber', weight: 18 },
      { id: 'brute', weight: 18 },
      { id: 'wisp', weight: 16 },
      { id: 'warden', weight: 12 },
      { id: 'leaper', weight: 14 },
      { id: 'explosive_slime', weight: 12 },
      { id: 'crystal_crawler', weight: 10 },
      { id: 'arcane_bat', weight: 8 },
    ],
    intro: { vi: 'Phố vắng có đèn. Đèn cháy mà không có lửa.', en: 'The street is lit. The lanterns burn without flame.' },
  },
  {
    id: 'act3',
    name: { vi: 'Đêm Thứ Chín', en: 'Ninth Night' },
    subtitle: { vi: 'Sân Thượng Trăng Tròn', en: 'The Full Moon Terrace' },
    tint: '#243a3a',
    tint2: '#0a1516',
    accent: '#3fd6a8',
    env: 'terrace',
    miniBoss: 'siren',
    boss: 'hollow_ninth',
    table: [
      // Act 3 previously ran TEN enemy types at once, which was not "more
      // variety", it was noise: too many simultaneous threat patterns to learn,
      // and the measured wall of the whole game (18 of 30 bot runs died here).
      // Trimmed to a focused set of seven with the newcomers as the identity of
      // the act, and the older crowd thinned rather than deleted.
      { id: 'stalker', weight: 18 },
      { id: 'brute', weight: 16 },
      { id: 'shadow_stalker', weight: 18 },
      { id: 'thorn_beast', weight: 15 },
      { id: 'crystal_crawler', weight: 12 },
      { id: 'explosive_slime', weight: 10 },
      { id: 'banshee', weight: 12 },
    ],
    intro: { vi: 'Trăng tròn như con mắt. Nó đang tìm bạn.', en: 'The moon is an eye. It is looking for you.' },
  },
];

/** Night banner text — one line, no instructions. */
export const NIGHT_LINE = {
  vi: ['Đêm {n}', 'Đêm {n}', 'Đêm {n}'],
  en: ['Night {n}', 'Night {n}', 'Night {n}'],
};

export function actForNight(night) {
  if (night <= 3) return ACTS[0];
  if (night <= 6) return ACTS[1];
  return ACTS[2];
}

/**
 * Boss for a given night.
 *
 * Nights 1-9 keep their authored bosses (nothing about the existing progression
 * changed). From night 10 the game continues and the five bosses rotate — that
 * is where the Void Predator and the Crystal Queen enter the campaign, so they
 * are reachable content rather than data nobody meets.
 */
const ROTATION = ['moon_devourer', 'lantern_king', 'hollow_ninth', 'void_predator', 'crystal_queen'];

export function bossForNight(night, act) {
  if (night <= 9) return act.boss;
  return ROTATION[(night - 10) % ROTATION.length];
}

/** The act's boss table entry for a night, honouring the rotation. */
export function bossTableForNight(night, act) {
  const id = bossForNight(night, act);
  return act.boss === id ? act : { ...act, boss: id };
}

/** Wave composition for a given night and wave index. */
export function wavePlan(night, wave) {
  const act = actForNight(night);
  const t = (night - 1) * 3 + wave; // global difficulty tick
  const budget = 4 + t * 2.15 + Math.pow(t, 1.32) * 0.55;
  const isMini = wave === 4;
  const isBoss = wave === 5;
  return { act, night, wave, budget, isMini, isBoss, tier: night };
}
