// Permanent upgrade wheel (embers). Nine arms, four tiers each.
// Multipliers are applied once when a run is built, never stacked per-frame.

export const PERK_LINES = [
  { id: 'claws', name: { vi: 'Vuốt', en: 'Claws' }, icon: 'claw', color: '#ffb27a', per: 0.06, label: { vi: '+6% sát thương', en: '+6% damage' } },
  { id: 'heart', name: { vi: 'Tim', en: 'Heart' }, icon: 'heart', color: '#ff5f6d', per: 0.07, label: { vi: '+7% máu', en: '+7% health' } },
  { id: 'hide', name: { vi: 'Da', en: 'Hide' }, icon: 'shield', color: '#9fb0c9', per: 0.03, label: { vi: '+3% phòng thủ', en: '+3% defense' } },
  { id: 'focus', name: { vi: 'Ý', en: 'Focus' }, icon: 'orb', color: '#b48bff', per: 0.03, label: { vi: '-3% hồi chiêu', en: '-3% cooldowns' } },
  { id: 'step', name: { vi: 'Bước', en: 'Step' }, icon: 'wind', color: '#7ce0c8', per: 0.04, label: { vi: '+4% tốc chạy', en: '+4% movement' } },
  { id: 'luck', name: { vi: 'Vận', en: 'Luck' }, icon: 'clover', color: '#ffc966', per: 0.03, label: { vi: '+3% chí mạng', en: '+3% crit' } },
  { id: 'spirit', name: { vi: 'Linh', en: 'Spirit' }, icon: 'sigil', color: '#8fe0ff', per: 0.05, label: { vi: '+5% năng lượng', en: '+5% energy' } },
  { id: 'greed', name: { vi: 'Tham', en: 'Greed' }, icon: 'coin', color: '#e8a23a', per: 0.05, label: { vi: '+5% xu', en: '+5% coins' } },
  { id: 'lore', name: { vi: 'Tri', en: 'Lore' }, icon: 'star', color: '#a8ffd0', per: 0.05, label: { vi: '+5% kinh nghiệm', en: '+5% experience' } },
];

export const PERK_TIERS = 4;
/** Ember cost of the next tier (index = current tier 0..3). */
export const PERK_COST = [60, 110, 190, 320];

/** Convert unlocked perks into a flat modifier map. */
export function perkBonuses(upgrades = {}) {
  const out = {
    atk: 0, hp: 0, def: 0, cdr: 0, move: 0, crit: 0, energy: 0, goldGain: 0, xpGain: 0,
  };
  const key = { claws: 'atk', heart: 'hp', hide: 'def', focus: 'cdr', step: 'move', luck: 'crit', spirit: 'energy', greed: 'goldGain', lore: 'xpGain' };
  for (const line of PERK_LINES) {
    const tiers = Math.max(0, Math.min(PERK_TIERS, upgrades[line.id] || 0));
    out[key[line.id]] += tiers * line.per;
  }
  return out;
}
