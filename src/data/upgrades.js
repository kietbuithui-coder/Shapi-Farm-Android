// Level-up upgrade pool. Each card is a genuine decision: multipliers with a
// trade-off, conditional triggers, or new behaviours — never flat "+1 damage".
// `tags` lets the offer screen avoid duplicates and respect the cat's build.

export const UPGRADES = [
  // Offense
  { id: 'keen_edge', name: { vi: 'Lưỡi Sắc', en: 'Keen Edge' }, desc: { vi: '+14% sát thương đòn đánh.', en: '+14% attack damage.' }, rarity: 'common', tags: ['offense'], max: 6, apply: { atk: 0.14 }, glyph: 'claw' },
  { id: 'bloodlust', name: { vi: 'Khát Máu', en: 'Bloodlust' }, desc: { vi: 'Hồi 1.5% máu mỗi đòn trúng.', en: 'Heal 1.5% health per hit.' }, rarity: 'rare', tags: ['offense', 'heal'], max: 4, apply: { lifesteal: 0.015 }, glyph: 'heart' },
  { id: 'frenzy_clock', name: { vi: 'Nhịp Điên', en: 'Frenzy Clock' }, desc: { vi: '+12% tốc đánh, -4% máu tối đa.', en: '+12% attack speed, -4% max health.' }, rarity: 'common', tags: ['offense'], max: 5, apply: { atkSpeed: 0.12, hpMult: -0.04 }, glyph: 'clock' },
  { id: 'hunters_mark', name: { vi: 'Dấu Thợ Săn', en: "Hunter's Mark" }, desc: { vi: '+8% chí mạng, +12% sát thương chí mạng.', en: '+8% crit chance, +12% crit damage.' }, rarity: 'common', tags: ['offense'], max: 5, apply: { crit: 0.08, critDmg: 0.12 }, glyph: 'target' },
  { id: 'executioners_veil', name: { vi: 'Khăn Đao Phủ', en: "Executioner's Veil" }, desc: { vi: '+35% sát thương lên mục tiêu dưới 35% máu.', en: '+35% damage to enemies below 35% health.' }, rarity: 'rare', tags: ['offense'], max: 3, apply: { execute: 0.35 }, glyph: 'skull' },
  { id: 'ricochet', name: { vi: 'Bật Nảy', en: 'Ricochet' }, desc: { vi: 'Đòn đánh nảy sang một mục tiêu gần đó với 40% sát thương.', en: 'Attacks bounce to a nearby foe for 40%.' }, rarity: 'rare', tags: ['offense'], max: 3, apply: { ricochet: 0.4 }, glyph: 'orb' },
  { id: 'pyre_heart', name: { vi: 'Tim Lửa', en: 'Pyre Heart' }, desc: { vi: 'Đốt cháy kẻ địch xung quanh 8 sát thương/giây.', en: 'Burn nearby enemies for 8 damage per second.' }, rarity: 'rare', tags: ['offense', 'aoe'], max: 4, apply: { burnAura: 8 }, glyph: 'flame' },
  { id: 'glass_fang', name: { vi: 'Nanh Thủy Tinh', en: 'Glass Fang' }, desc: { vi: '+28% sát thương, -8% máu tối đa.', en: '+28% damage, -8% max health.' }, rarity: 'rare', tags: ['offense', 'risk'], max: 3, apply: { atk: 0.28, hpMult: -0.08 }, glyph: 'fang' },
  { id: 'tempo_bleed', name: { vi: 'Nhịp Rỉ Máu', en: 'Bleeding Tempo' }, desc: { vi: 'Mỗi 4 đòn đánh liên tiếp gây thêm một nhát chảy máu.', en: 'Every 4th hit applies a stack of bleed.' }, rarity: 'rare', tags: ['offense'], max: 3, apply: { bleedEvery: 4 }, glyph: 'wave' },
  { id: 'backstab', name: { vi: 'Đâm Sau Lưng', en: 'Backstab' }, desc: { vi: '+45% sát thương khi đánh từ phía sau địch.', en: '+45% damage from behind.' }, rarity: 'epic', tags: ['offense', 'skill'], max: 2, apply: { backstab: 0.45 }, glyph: 'dagger' },

  // Defense
  { id: 'thick_hide', name: { vi: 'Da Dày', en: 'Thick Hide' }, desc: { vi: '+15% máu tối đa.', en: '+15% max health.' }, rarity: 'common', tags: ['defense'], max: 6, apply: { hpMult: 0.15 }, glyph: 'shield' },
  { id: 'nimble_paws', name: { vi: 'Chân Nhẹ', en: 'Nimble Paws' }, desc: { vi: '+6% né tránh.', en: '+6% dodge.' }, rarity: 'common', tags: ['defense'], max: 4, apply: { dodge: 0.06 }, glyph: 'foot' },
  { id: 'thorn_coat', name: { vi: 'Áo Gai', en: 'Thorn Coat' }, desc: { vi: 'Phản 18% sát thương đã nhận.', en: 'Reflect 18% of damage taken.' }, rarity: 'rare', tags: ['defense'], max: 4, apply: { thorns: 0.18 }, glyph: 'spikes' },
  { id: 'second_skin', name: { vi: 'Lớp Da Thứ Hai', en: 'Second Skin' }, desc: { vi: 'Nhận một lá chắn 20% máu mỗi 20 giây.', en: 'Gain a 20% health shield every 20s.' }, rarity: 'rare', tags: ['defense'], max: 3, apply: { autoShield: 0.2, autoShieldCd: 20 }, glyph: 'bubble' },
  { id: 'regen_ember', name: { vi: 'Than Hồng', en: 'Glowing Ember' }, desc: { vi: 'Hồi 1.2 máu mỗi giây.', en: 'Regenerate 1.2 health per second.' }, rarity: 'common', tags: ['defense', 'heal'], max: 5, apply: { regen: 1.2 }, glyph: 'ember' },
  { id: 'last_stand', name: { vi: 'Trụ Cuối', en: 'Last Stand' }, desc: { vi: 'Dưới 25% máu: +30% sát thương, -20% sát thương nhận.', en: 'Below 25% health: +30% damage, -20% damage taken.' }, rarity: 'epic', tags: ['defense', 'risk'], max: 2, apply: { lastStand: 1 }, glyph: 'lives' },

  // Mobility / tempo
  { id: 'quickstep', name: { vi: 'Bước Nhanh', en: 'Quickstep' }, desc: { vi: '+8% tốc chạy.', en: '+8% movement speed.' }, rarity: 'common', tags: ['mobility'], max: 5, apply: { move: 0.08 }, glyph: 'wind' },
  { id: 'slip_stream', name: { vi: 'Dòng Lướt', en: 'Slipstream' }, desc: { vi: 'Nhận 25% ít sát thương hơn khi đang di chuyển.', en: 'Take 25% less damage while moving.' }, rarity: 'rare', tags: ['mobility', 'defense'], max: 3, apply: { movingArmor: 0.25 }, glyph: 'leap' },
  { id: 'double_tap', name: { vi: 'Gõ Đôi', en: 'Double Tap' }, desc: { vi: 'Đòn đánh thứ ba trong chuỗi gây 60% sát thương thêm.', en: 'Every third hit deals +60% damage.' }, rarity: 'rare', tags: ['offense'], max: 3, apply: { everyThird: 0.6 }, glyph: 'claw3' },

  // Skills
  { id: 'cool_head', name: { vi: 'Đầu Lạnh', en: 'Cool Head' }, desc: { vi: '-8% hồi chiêu kỹ năng.', en: '-8% skill cooldowns.' }, rarity: 'common', tags: ['skill'], max: 5, apply: { cdr: 0.08 }, glyph: 'clock' },
  { id: 'deep_well', name: { vi: 'Giếng Sâu', en: 'Deep Well' }, desc: { vi: '+20 năng lượng tối đa, +15% hồi năng lượng.', en: '+20 max energy, +15% energy regen.' }, rarity: 'common', tags: ['skill'], max: 4, apply: { energy: 20, energyRegen: 0.15 }, glyph: 'orb' },
  { id: 'echo_cast', name: { vi: 'Vọng Niệm', en: 'Echo Cast' }, desc: { vi: '15% khả năng kỹ năng được thi triển hai lần.', en: '15% chance a skill casts twice.' }, rarity: 'epic', tags: ['skill'], max: 3, apply: { echo: 0.15 }, glyph: 'sigil' },
  { id: 'piercing_mind', name: { vi: 'Ý Chí Xuyên Thấu', en: 'Piercing Mind' }, desc: { vi: 'Kỹ năng gây sát thương xuyên qua thêm một mục tiêu.', en: 'Damage skills pierce one extra target.' }, rarity: 'rare', tags: ['skill'], max: 2, apply: { skillPierce: 1 }, glyph: 'needle' },
  { id: 'thorned_magic', name: { vi: 'Phép Gai', en: 'Thorned Magic' }, desc: { vi: 'Kỹ năng gây thêm 20% sát thương theo thời gian.', en: 'Skills apply 20% bonus damage over time.' }, rarity: 'rare', tags: ['skill', 'offense'], max: 4, apply: { skillDot: 0.2 }, glyph: 'hex' },
  { id: 'wide_arc', name: { vi: 'Vòng Cung Rộng', en: 'Wide Arc' }, desc: { vi: '+20% phạm vi kỹ năng.', en: '+20% skill area and range.' }, rarity: 'rare', tags: ['skill'], max: 3, apply: { skillArea: 0.2 }, glyph: 'aura' },

  // Summons & companions
  { id: 'litter_bond', name: { vi: 'Tình Bầy', en: 'Litter Bond' }, desc: { vi: 'Đồng minh triệu hồi +25% máu và sát thương.', en: 'Summons gain +25% health and damage.' }, rarity: 'rare', tags: ['summon'], max: 4, apply: { summonPower: 0.25 }, glyph: 'kitten' },
  { id: 'pack_leader', name: { vi: 'Đầu Đàn', en: 'Pack Leader' }, desc: { vi: '+1 mèo con mỗi lần triệu hồi.', en: '+1 kitten per summon.' }, rarity: 'epic', tags: ['summon'], max: 2, apply: { summonExtra: 1 }, glyph: 'paw' },

  // Control
  { id: 'frost_touch', name: { vi: 'Chạm Băng', en: 'Frost Touch' }, desc: { vi: 'Đòn đánh làm chậm 18% trong 1.5 giây.', en: 'Attacks slow by 18% for 1.5s.' }, rarity: 'rare', tags: ['control'], max: 3, apply: { slowOnHit: 0.18 }, glyph: 'snow' },
  { id: 'stagger', name: { vi: 'Loạng Choạng', en: 'Stagger' }, desc: { vi: '8% khả năng choáng kẻ địch 0.5 giây.', en: '8% chance to stun for 0.5s.' }, rarity: 'rare', tags: ['control'], max: 3, apply: { stunChance: 0.08 }, glyph: 'bolt' },
  { id: 'heavy_paws', name: { vi: 'Chân Nặng', en: 'Heavy Paws' }, desc: { vi: '+35% lực đẩy lùi.', en: '+35% knockback force.' }, rarity: 'common', tags: ['control'], max: 3, apply: { knock: 0.35 }, glyph: 'stone' },

  // Economy / utility
  { id: 'greedy_whisker', name: { vi: 'Râu Tham Lam', en: 'Greedy Whisker' }, desc: { vi: '+25% xu nhận được.', en: '+25% coin gain.' }, rarity: 'common', tags: ['utility'], max: 4, apply: { goldGain: 0.25 }, glyph: 'coin' },
  { id: 'scholar', name: { vi: 'Học Giả', en: 'Scholar' }, desc: { vi: '+18% kinh nghiệm nhận được.', en: '+18% experience gained.' }, rarity: 'common', tags: ['utility'], max: 4, apply: { xpGain: 0.18 }, glyph: 'star' },
  { id: 'magnet_paw', name: { vi: 'Chân Nam Châm', en: 'Magnet Paw' }, desc: { vi: 'Hút vật phẩm từ xa hơn nhiều.', en: 'Vastly increased pickup range.' }, rarity: 'common', tags: ['utility'], max: 3, apply: { pickup: 60 }, glyph: 'magnet' },
  { id: 'vampiric_aura', name: { vi: 'Hào Quang Hút', en: 'Vampiric Aura' }, desc: { vi: 'Kẻ địch chết gần bạn hồi 3% máu.', en: 'Enemies dying near you heal 3% health.' }, rarity: 'epic', tags: ['heal', 'offense'], max: 3, apply: { killHeal: 0.03 }, glyph: 'drain' },

  // Rare build-defining
  { id: 'twin_souls', name: { vi: 'Hai Linh Hồn', en: 'Twin Souls' }, desc: { vi: 'Triệu hồi một linh miêu nhỏ đồng hành vĩnh viễn.', en: 'A small spirit cat accompanies you permanently.' }, rarity: 'mythic', tags: ['summon'], max: 1, apply: { permanentCompanion: 1 }, glyph: 'spirit' },
  { id: 'moon_pact', name: { vi: 'Giao Ước Trăng', en: 'Moon Pact' }, desc: { vi: 'Mỗi 10 giây, đòn đánh kế tiếp gây gấp ba sát thương.', en: 'Every 10s your next hit deals triple damage.' }, rarity: 'mythic', tags: ['offense'], max: 1, apply: { moonPact: 10 }, glyph: 'moonbeam' },
  { id: 'ninefold', name: { vi: 'Chín Lần', en: 'Ninefold' }, desc: { vi: 'Khi nhận đòn chí tử, hồi sinh với 30% máu (một lần).', en: 'Revive once at 30% health.' }, rarity: 'mythic', tags: ['defense'], max: 1, apply: { revive: 0.3 }, glyph: 'lives' },
  { id: 'storm_call', name: { vi: 'Gọi Bão', en: 'Storm Call' }, desc: { vi: 'Mỗi 6 giây một tia sét đánh kẻ địch gần nhất.', en: 'A lightning bolt strikes every 6s.' }, rarity: 'epic', tags: ['offense', 'skill'], max: 3, apply: { stormCall: 6 }, glyph: 'bolt' },
  { id: 'golden_fur', name: { vi: 'Lông Hoàng Kim', en: 'Golden Fur' }, desc: { vi: '+12% mọi chỉ số khi còn trên 70% máu.', en: '+12% to all stats above 70% health.' }, rarity: 'epic', tags: ['utility'], max: 2, apply: { goldenFur: 0.12 }, glyph: 'coin' },
  { id: 'swift_shadow', name: { vi: 'Bóng Nhanh', en: 'Swift Shadow' }, desc: { vi: 'Né đòn sẽ hồi 20 năng lượng.', en: 'Dodging restores 20 energy.' }, rarity: 'rare', tags: ['mobility', 'skill'], max: 3, apply: { dodgeEnergy: 20 }, glyph: 'foot' },
  { id: 'butcher', name: { vi: 'Đồ Tể', en: 'Butcher' }, desc: { vi: 'Hạ gục để lại một vụ nổ máu 40 sát thương.', en: 'Kills leave a blood burst for 40 damage.' }, rarity: 'epic', tags: ['offense', 'aoe'], max: 3, apply: { killBoom: 40 }, glyph: 'bloodmoon' },
];

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
export const UPGRADE_TAGS = ['offense', 'defense', 'skill', 'summon', 'control', 'mobility', 'utility', 'heal', 'aoe', 'risk'];
