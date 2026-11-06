// CAT LEGENDS — art direction constants.
// Night-indigo world, lantern-light warmth, vermilion and jade accents.
// All artwork is generated from this palette so every screen stays in-key.

export const PALETTE = {
  // Night sky / environment
  night0: '#070a16',
  night1: '#0b1024',
  night2: '#121a33',
  night3: '#1b2545',
  indigo: '#26315a',
  slate: '#3c4670',
  mist: '#8fa0c8',
  moon: '#f6efd6',
  moonGlow: '#ffe8a8',
  snow: '#e9eef8',

  // Lantern warmth
  ember: '#ff8f4d',
  gold: '#ffc966',
  goldDeep: '#e8a23a',
  candle: '#ffe6a8',

  // Ink outlines
  ink: '#0a0912',
  inkSoft: '#1a1526',

  // Accents
  jade: '#3fd6a8',
  jadeDeep: '#1f8f70',
  vermilion: '#ff4f5e',
  blood: '#b3202f',
  lilac: '#a48bff',
  cyan: '#5fd6ff',

  // UI chrome
  paper: '#f4ecd8',
  paperDim: '#cdc6b4',
  uiDark: 'rgba(9,11,22,0.82)',
  uiEdge: 'rgba(255,201,102,0.28)',
};

export const CAT_COLORS = {
  hp: '#ff5f6d',
  hpDark: '#7a1d2b',
  shield: '#6fd8ff',
  xp: '#7ce0b0',
  gold: '#ffc966',
  energy: '#a48bff',
  danger: '#ff3b52',
  heal: '#67e8a0',
  slow: '#7fb6ff',
  poison: '#9ad14b',
};

export const FONT = {
  display: '"Playfair Display", "Times New Roman", serif',
  ui: '"Be Vietnam Pro", "Segoe UI", system-ui, sans-serif',
};

export const RARITY = {
  common: { label: { vi: 'Thường', en: 'Common' }, color: '#9fb0c9', glow: '#c6d3e6' },
  rare: { label: { vi: 'Hiếm', en: 'Rare' }, color: '#5fd6ff', glow: '#a8ecff' },
  epic: { label: { vi: 'Sử Thi', en: 'Epic' }, color: '#b48bff', glow: '#e0d0ff' },
  mythic: { label: { vi: 'Huyền Thoại', en: 'Mythic' }, color: '#ffb84d', glow: '#ffe6ad' },
};

export const ELEMENT_COLORS = {
  physical: '#ffb27a',
  magic: '#b48bff',
  projectile: '#5fd6ff',
  aoe: '#ff8f4d',
  summon: '#7ce0b0',
  defense: '#9fb0c9',
  mobility: '#7ce0c8',
  control: '#8fa0c8',
  heal: '#67e8a0',
  utility: '#ffc966',
};
