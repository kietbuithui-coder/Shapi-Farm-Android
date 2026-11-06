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
      { id: 'stalker', weight: 20 },
      { id: 'banshee', weight: 18 },
      { id: 'brute', weight: 20 },
      { id: 'bomber', weight: 16 },
      { id: 'wisp', weight: 14 },
      { id: 'warden', weight: 12 },
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

/** Wave composition for a given night and wave index. */
export function wavePlan(night, wave) {
  const act = actForNight(night);
  const t = (night - 1) * 3 + wave; // global difficulty tick
  const budget = 4 + t * 2.15 + Math.pow(t, 1.32) * 0.55;
  const isMini = wave === 4;
  const isBoss = wave === 5;
  return { act, night, wave, budget, isMini, isBoss, tier: night };
}
