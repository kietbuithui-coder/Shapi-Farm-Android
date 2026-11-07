// 54 active skills. `pattern` selects an effect in systems/run.js.
//
// Fields
//  category  : 10 gameplay families (drives UI grouping + upgrade pools)
//  pattern   : effect implementation
//  cost      : energy, cd: seconds, range: px (arena is 960x540 logical)
//  ranks     : 5 growth steps; `note` is the only text the player reads
//  branch    : optional rank-3 fork; both outcomes are mechanically different

export const SKILL_CATEGORIES = {
  physical: { vi: 'Vật Lý', en: 'Physical', color: '#ffb27a' },
  magic: { vi: 'Phép Thuật', en: 'Magic', color: '#b48bff' },
  projectile: { vi: 'Tầm Xa', en: 'Projectile', color: '#5fd6ff' },
  aoe: { vi: 'Diện Rộng', en: 'Area', color: '#ff8f4d' },
  summon: { vi: 'Triệu Hồi', en: 'Summon', color: '#7ce0b0' },
  defense: { vi: 'Phòng Thủ', en: 'Defense', color: '#9fb0c9' },
  mobility: { vi: 'Cơ Động', en: 'Mobility', color: '#7ce0c8' },
  control: { vi: 'Khống Chế', en: 'Control', color: '#8fa0c8' },
  heal: { vi: 'Hồi Phục', en: 'Healing', color: '#67e8a0' },
  utility: { vi: 'Chiến Thuật', en: 'Utility', color: '#ffc966' },
};

const R = (dmg, note, extra = {}) => ({ dmg, note, ...extra });

export const SKILLS = [
  // ── PHYSICAL ───────────────────────────────────────────────────────────────
  {
    id: 'claw_slash', category: 'physical', rarity: 'common', pattern: 'melee',
    name: { vi: 'Vuốt Sắc', en: 'Claw Slash' },
    desc: { vi: 'Vuốt một đường phía trước.', en: 'A single claw slash ahead.' },
    cost: 0, cd: 0.34, range: 86, ranks: [R(1, 'Một đường vuốt'), R(1, 'Sát thương +15%', { mult: 1.15 }), R(1, 'Xa hơn', { range: 100 }), R(1, 'Sát thương +20%', { mult: 1.2 }), R(1, 'Chảy máu', { status: 'bleed' })],
    params: { arc: 1.5, hits: 1, facing: true }, icon: { glyph: 'claw', tint: '#ffb27a' }, starter: true,
  },
  {
    id: 'triple_scratch', category: 'physical', rarity: 'common', pattern: 'combo',
    name: { vi: 'Liên Vuốt', en: 'Triple Scratch' },
    desc: { vi: 'Ba nhát quét diện rộng quanh mèo, áp dụng hiệu ứng đòn đánh.', en: 'Three wide sweeps around the cat that apply on-hit effects.' },
    cost: 12, cd: 4.1, range: 140, ranks: [R(1, 'Ba nhát'), R(1, 'Sát thương +20%', { mult: 1.2 }), R(1, 'Nhát cuối đẩy lùi', { knock: 210 }), R(1, 'Bốn nhát', { count: 4 }), R(1, 'Mỗi nhát hồi năng lượng', { energyOnHit: 4 })],
    params: { hits: 3, gap: 0.12, lastKnock: 0 }, icon: { glyph: 'claw3', tint: '#ffc08f' }, starter: true,
  },
  {
    id: 'pounce', category: 'mobility', rarity: 'common', pattern: 'dash',
    name: { vi: 'Vồ Mồi', en: 'Pounce' },
    desc: { vi: 'Lao tới, húc văng kẻ địch trên đường.', en: 'Leap forward, shoving anything in the path.' },
    cost: 20, cd: 4.5, range: 170, ranks: [R(1, 'Lao và miễn thương'), R(1, 'Sát thương +25%', { mult: 1.25 }), R(1, 'Xa hơn', { range: 210 }), R(1, 'Choáng khi trúng', { stun: 0.5 }), R(1, 'Hai lần dùng', { charges: 2 })],
    params: { damage: 1.15, duration: 0.2, invuln: true, knock: 180 }, icon: { glyph: 'pounce', tint: '#ffb27a' }, starter: true,
  },
  {
    id: 'whirling_claws', category: 'aoe', rarity: 'rare', pattern: 'nova',
    name: { vi: 'Vuốt Xoáy', en: 'Whirling Claws' },
    desc: { vi: 'Xoay người, chém mọi thứ quanh mình.', en: 'Spin, carving everything around you.' },
    cost: 28, cd: 5, range: 118, ranks: [R(1, 'Một vòng xoáy'), R(1, 'Bán kính +12%', { radius: 132 }), R(1, 'Sát thương +20%', { mult: 1.2 }), R(1, 'Hai vòng', { repeats: 2 }), R(1, 'Đẩy lùi mạnh', { knock: 260 })],
    params: { damage: 1.3, knock: 150 }, icon: { glyph: 'whirl', tint: '#ffb27a' },
  },
  {
    id: 'brutal_bite', category: 'physical', rarity: 'rare', pattern: 'melee',
    name: { vi: 'Cắn Tàn Bạo', en: 'Brutal Bite' },
    desc: { vi: 'Cú cắn nặng khiến mục tiêu chảy máu.', en: 'A heavy bite that leaves the target bleeding.' },
    cost: 22, cd: 3.4, range: 84, ranks: [R(1, 'Gây chảy máu'), R(1, 'Sát thương +30%', { mult: 1.3 }), R(1, 'Chảy máu lâu hơn', { bleedTime: 4.5 }), R(1, 'Hút máu', { lifesteal: 0.25 }), R(1, 'Hạ gục địch yếu (trừ boss)', { execute: 0.18 })],
    params: { arc: 1.2, damage: 1.7, status: 'bleed', lifesteal: 0.12 }, icon: { glyph: 'fang', tint: '#ff9b7a' },
  },
  {
    id: 'shadow_strike', category: 'physical', rarity: 'rare', pattern: 'teleportStrike',
    name: { vi: 'Đâm Bóng', en: 'Shadow Strike' },
    desc: { vi: 'Lướt sau lưng mục tiêu và đâm hiểm.', en: 'Slip behind a target and stab deep.' },
    cost: 26, cd: 6, range: 260, ranks: [R(1, 'Dịch chuyển sau mục tiêu'), R(1, 'Sát thương +25%', { mult: 1.25 }), R(1, 'Tầm xa hơn', { range: 320 }), R(1, 'Hoàn năng lượng khi hạ gục', { refundKill: true }), R(1, 'Chí mạng chắc chắn', { forceCrit: true })],
    params: { damage: 2.0 }, icon: { glyph: 'dagger', tint: '#a48bff' },
  },
  {
    id: 'rending_wave', category: 'physical', rarity: 'epic', pattern: 'shockwave',
    name: { vi: 'Sóng Vuốt', en: 'Rending Wave' },
    desc: { vi: 'Một nhát chém phóng ra thành sóng xung kích.', en: 'A slash that travels as a shockwave.' },
    cost: 30, cd: 6.5, range: 300, ranks: [R(1, 'Sóng thẳng'), R(1, 'Rộng hơn', { width: 1.3 }), R(1, 'Sát thương +30%', { mult: 1.3 }), R(1, 'Xuyên thấu mục tiêu', { pierce: true }), R(1, 'Hai sóng', { count: 2 })],
    params: { damage: 1.6, speed: 620, width: 54 }, icon: { glyph: 'wave', tint: '#ffb27a' },
  },
  {
    id: 'executioner', category: 'physical', rarity: 'epic', pattern: 'execute',
    name: { vi: 'Đao Phủ', en: 'Executioner' },
    desc: { vi: 'Xử tử địch thường ít máu; boss chịu đòn mạnh thay thế.', en: 'Execute weakened regular foes; bosses take a heavy hit instead.' },
    cost: 34, cd: 9, range: 92, ranks: [R(1, 'Hạ gục dưới 20% máu'), R(1, 'Ngưỡng 25%', { threshold: 0.25 }), R(1, 'Sát thương +30%', { mult: 1.3 }), R(1, 'Dùng lại ngay khi hạ gục', { resetKill: true }), R(1, 'Ngưỡng 35%', { threshold: 0.35 })],
    params: { damage: 2.4, threshold: 0.2 }, icon: { glyph: 'skull', tint: '#ff8f9b' },
  },
  {
    id: 'phantom_step', category: 'mobility', rarity: 'rare', pattern: 'blink',
    name: { vi: 'Bước Ma', en: 'Phantom Step' },
    desc: { vi: 'Tạo bóng ma tại điểm đến, dịch chuyển sau 1 giây.', en: 'Leave a ghost at the destination and blink there after 1 second.' },
    cost: 18, cd: 5.5, range: 200, ranks: [R(1, 'Dịch chuyển sau 1 giây'), R(1, 'Bỏ lại ảo ảnh gây sát thương', { decoy: 0.6 }), R(1, 'Khoảng trống ngắn hơn', { cdCut: 1 }), R(1, 'Bất tử thoáng chốc', { invuln: 0.8 }), R(1, 'Ảo ảnh nổ tung', { decoyBoom: true })],
    params: { damage: 0.7, invuln: 0.28 }, icon: { glyph: 'foot', tint: '#7ce0c8' }, starter: true,
  },

  // ── MAGIC ──────────────────────────────────────────────────────────────────
  {
    id: 'arcane_paw', category: 'magic', rarity: 'common', pattern: 'projectile',
    name: { vi: 'Vuốt Ảo Ảnh', en: 'Arcane Paw' },
    desc: { vi: 'Bắn một dấu chân phép hướng về mục tiêu.', en: 'Hurl a glowing sigil at your target.' },
    cost: 0, cd: 0.52, range: 420, ranks: [R(1, 'Đạn phép cơ bản'), R(1, 'Sát thương +15%', { mult: 1.15 }), R(1, 'Xuyên một mục tiêu', { pierce: 1 }), R(1, 'Thêm một đạn', { count: 2 }), R(1, 'Nổ khi trúng', { explode: 0.5 })],
    params: { speed: 520, damage: 1.0, homing: 0.06, spread: 0.09 }, icon: { glyph: 'sigil', tint: '#b48bff' }, starter: true,
  },
  {
    id: 'fireball', category: 'magic', rarity: 'rare', pattern: 'projectile',
    name: { vi: 'Cầu Lửa', en: 'Fireball' },
    desc: { vi: 'Cầu lửa phát nổ và gây cháy nhẹ trong 3 giây.', en: 'A fireball explodes and burns foes lightly for 3 seconds.' },
    cost: 26, cd: 3.2, range: 400, ranks: [R(1, 'Nổ và bắt lửa'), R(1, 'Bán kính nổ +15%', { blast: 1.15 }), R(1, 'Sát thương +25%', { mult: 1.25 }), R(1, 'Thêm một cầu lửa', { count: 2 }), R(1, 'Để lại vùng cháy', { burnZone: true })],
    branch: { rank: 3, options: [
      { id: 'explosive', name: { vi: 'Nổ Tung', en: 'Explosive' }, note: { vi: 'Bán kính nổ +40%', en: '+40% blast radius' }, mods: { blast: 1.4 } },
      { id: 'piercing', name: { vi: 'Xuyên Phá', en: 'Piercing' }, note: { vi: 'Xuyên 3 mục tiêu', en: 'Pierces 3 targets' }, mods: { pierce: 3 } },
    ] },
    params: { speed: 400, damage: 1.8, blast: 82, explode: 0.85 }, icon: { glyph: 'flame', tint: '#ff8f4d' }, starter: true,
  },
  {
    id: 'frost_nova', category: 'control', rarity: 'rare', pattern: 'nova',
    name: { vi: 'Băng Tân', en: 'Frost Nova' },
    desc: { vi: 'Sóng băng làm chậm và đóng băng kẻ địch.', en: 'A cold ring that chills and freezes.' },
    cost: 30, cd: 7, range: 150, ranks: [R(1, 'Làm chậm'), R(1, 'Bán kính +14%', { radius: 168 }), R(1, 'Đóng băng lâu hơn', { freeze: 1.2 }), R(1, 'Sát thương +30%', { mult: 1.3 }), R(1, 'Mảnh băng văng ra', { shards: 6 })],
    params: { damage: 0.7, radius: 150, slow: 0.45, slowTime: 2.6, freeze: 0.6 }, icon: { glyph: 'snow', tint: '#7fd6ff' }, starter: true,
  },
  {
    id: 'thunder_purr', category: 'magic', rarity: 'rare', pattern: 'chain',
    name: { vi: 'Sấm Gừ Gừ', en: 'Thunder Purr' },
    desc: { vi: 'Tia sét nhảy giữa các mục tiêu gần nhau.', en: 'Lightning that leaps between targets.' },
    cost: 28, cd: 5.5, range: 300, ranks: [R(1, 'Nhảy 2 lần'), R(1, 'Nhảy 3 lần', { jumps: 3 }), R(1, 'Sát thương +25%', { mult: 1.25 }), R(1, 'Choáng ngắn', { stun: 0.3 }), R(1, 'Nhảy 5 lần', { jumps: 5 })],
    params: { damage: 1.15, jumps: 2, jumpRange: 180 }, icon: { glyph: 'bolt', tint: '#ffe066' },
  },
  {
    id: 'meteor_paw', category: 'aoe', rarity: 'epic', pattern: 'meteor',
    name: { vi: 'Thiên Thạch Mèo', en: 'Meteor Paw' },
    desc: { vi: 'Gọi một thiên thạch rơi xuống điểm chỉ định.', en: 'Call a meteor onto a marked spot.' },
    cost: 40, cd: 10, range: 340, ranks: [R(1, 'Rơi sau 0.7 giây'), R(1, 'Bán kính +15%', { radius: 1.15 }), R(1, 'Sát thương +30%', { mult: 1.3 }), R(1, 'Rơi nhanh hơn', { delay: 0.5 }), R(1, 'Hai thiên thạch', { count: 2 })],
    params: { damage: 4.0, radius: 96, delay: 0.7 }, icon: { glyph: 'meteor', tint: '#ff8f4d' },
  },
  {
    id: 'lunar_beam', category: 'magic', rarity: 'epic', pattern: 'beam',
    name: { vi: 'Tia Trăng', en: 'Lunar Beam' },
    desc: { vi: 'Chùm sáng trăng xuyên thẳng hàng địch.', en: 'A moonlit lance through a line of foes.' },
    cost: 38, cd: 9, range: 420, ranks: [R(1, 'Chùm sáng dài'), R(1, 'Rộng hơn', { width: 1.3 }), R(1, 'Sát thương +30%', { mult: 1.3 }), R(1, 'Làm mù (chậm)', { slow: 0.5 }), R(1, 'Chùm sáng thứ hai', { repeats: 2 })],
    params: { damage: 3.2, length: 460, width: 46, delay: 0.18 }, icon: { glyph: 'moonbeam', tint: '#cfe4ff' },
  },
  {
    id: 'void_maw', category: 'magic', rarity: 'mythic', pattern: 'pull',
    name: { vi: 'Miệng Hố Đen', en: 'Void Maw' },
    desc: { vi: 'Mở hố đen hút kẻ địch vào rồi nuốt chửng.', en: 'A singularity drags foes in, then eats them.' },
    cost: 52, cd: 14, range: 320, ranks: [R(1, 'Hút rồi nổ'), R(1, 'Bán kính +15%', { radius: 1.15 }), R(1, 'Sát thương +35%', { mult: 1.35 }), R(1, 'Làm chậm sau nổ', { slow: 0.5 }), R(1, 'Hồi máu theo sát thương', { lifesteal: 0.3 })],
    params: { damage: 2.6, radius: 104, pullTime: 1.0, core: true }, icon: { glyph: 'void', tint: '#a48bff' },
  },
  {
    id: 'hex_brand', category: 'utility', rarity: 'rare', pattern: 'mark',
    name: { vi: 'Ấn Nguyền', en: 'Hex Brand' },
    desc: { vi: 'Đóng ấn lên mục tiêu: nó nhận thêm sát thương.', en: 'Brand a target: it takes extra damage.' },
    cost: 20, cd: 8, range: 360, ranks: [R(1, 'Mục tiêu nhận +18% sát thương'), R(1, '+24%', { amp: 0.24 }), R(1, 'Lan sang mục tiêu gần', { spread: 110 }), R(1, 'Ấn gây sát thương theo thời gian', { tick: true }), R(1, '+36%', { amp: 0.36 })],
    params: { amp: 0.18, time: 7 }, icon: { glyph: 'hex', tint: '#b48bff' },
  },
  {
    id: 'gravity_well', category: 'control', rarity: 'epic', pattern: 'zone',
    name: { vi: 'Giếng Trọng Lực', en: 'Gravity Well' },
    desc: { vi: 'Vùng không gian níu chân mọi kẻ địch bên trong.', en: 'A field that pins anything inside.' },
    cost: 32, cd: 9, range: 320, ranks: [R(1, 'Làm chậm mạnh'), R(1, 'Bán kính +15%', { radius: 1.15 }), R(1, 'Kéo nhẹ kẻ địch vào', { pull: 40 }), R(1, 'Sát thương theo thời gian', { dps: 0.5 }), R(1, 'Lâu hơn', { time: 4.5 })],
    params: { radius: 100, time: 3.2, slow: 0.6, dps: 0 }, icon: { glyph: 'well', tint: '#8fa0c8' },
  },

  // ── PROJECTILE ─────────────────────────────────────────────────────────────
  {
    id: 'hairball_cannon', category: 'projectile', rarity: 'common', pattern: 'projectile',
    name: { vi: 'Đại Bác Búi Lông', en: 'Hairball Cannon' },
    desc: { vi: 'Phun loạt búi lông nặng.', en: 'Spit a heavy wad of fur.' },
    cost: 16, cd: 2.2, range: 340, ranks: [R(1, 'Đạn nặng, đẩy lùi'), R(1, 'Sát thương +20%', { mult: 1.2 }), R(1, 'Thêm một búi', { count: 2 }), R(1, 'Nảy tường', { bounce: true }), R(1, 'Bắn tỏa 5 búi', { count: 5, spreadWide: true })],
    params: { speed: 460, damage: 1.25, knock: 120, spread: 0.1 }, icon: { glyph: 'hairball', tint: '#c9b08a' },
  },
  {
    id: 'magic_yarn', category: 'projectile', rarity: 'rare', pattern: 'boomerang',
    name: { vi: 'Cuộn Len Phép', en: 'Magic Yarn' },
    desc: { vi: 'Cuộn len bay đi rồi quay lại, trói kẻ địch.', en: 'Yarn flies out, returns, and binds foes.' },
    cost: 22, cd: 4.4, range: 300, ranks: [R(1, 'Bay và quay lại'), R(1, 'Trói 0.6 giây', { root: 0.6 }), R(1, 'Sát thương +25%', { mult: 1.25 }), R(1, 'Hai cuộn', { count: 2 }), R(1, 'Vẽ vòng len gây sát thương', { trailBoom: true })],
    params: { damage: 1.3, speed: 430, dist: 300 }, icon: { glyph: 'yarn', tint: '#ff9bd0' },
  },
  {
    id: 'paw_boomerang', category: 'projectile', rarity: 'rare', pattern: 'boomerang',
    name: { vi: 'Vuốt Hồi Lực', en: 'Paw Boomerang' },
    desc: { vi: 'Chiếc vuốt phép xoay về phía bạn, cắt cả đường về.', en: 'A spinning claw cuts both ways.' },
    cost: 24, cd: 4.8, range: 330, ranks: [R(1, 'Cắt cả đi và về'), R(1, 'Sát thương +25%', { mult: 1.25 }), R(1, 'Xuyên mục tiêu', { pierce: true }), R(1, 'Ba chiếc', { count: 3 }), R(1, 'Hút máu', { lifesteal: 0.2 })],
    params: { damage: 1.45, speed: 480, dist: 330 }, icon: { glyph: 'boomerang', tint: '#ffc966' },
  },
  {
    id: 'spirit_orbs', category: 'projectile', rarity: 'epic', pattern: 'orbit',
    name: { vi: 'Cầu Hồn', en: 'Spirit Orbs' },
    desc: { vi: 'Ba linh cầu xoay quanh bạn, tự đâm kẻ lại gần.', en: 'Three orbs circle you and strike intruders.' },
    cost: 30, cd: 8, range: 120, ranks: [R(1, 'Ba cầu, 6 giây'), R(1, 'Bốn cầu', { count: 4 }), R(1, 'Sát thương +25%', { mult: 1.25 }), R(1, 'Bán kính rộng hơn', { radius: 1.2 }), R(1, 'Cầu bắn tia khi lướt qua địch', { shoot: true })],
    params: { damage: 0.65, count: 3, radius: 78, time: 6 }, icon: { glyph: 'orb', tint: '#7ce0b0' },
  },
  {
    id: 'needle_barrage', category: 'projectile', rarity: 'rare', pattern: 'barrage',
    name: { vi: 'Mưa Kim', en: 'Needle Barrage' },
    desc: { vi: 'Xả một loạt kim nhỏ về phía mục tiêu.', en: 'Unload a spray of fine needles.' },
    cost: 26, cd: 4.6, range: 380, ranks: [R(1, '7 kim'), R(1, '9 kim', { count: 9 }), R(1, 'Sát thương +20%', { mult: 1.2 }), R(1, 'Xuyên một mục tiêu', { pierce: 1 }), R(1, '12 kim', { count: 12 })],
    params: { count: 7, damage: 0.4, speed: 700, spread: 0.5, duration: 0.35 }, icon: { glyph: 'needle', tint: '#cfe4ff' },
  },
  {
    id: 'starfall_volley', category: 'projectile', rarity: 'epic', pattern: 'volley',
    name: { vi: 'Mưa Sao', en: 'Starfall Volley' },
    desc: { vi: 'Gọi một chùm sao rơi xuống quanh khu vực.', en: 'A cluster of stars rains down nearby.' },
    cost: 36, cd: 9.5, range: 360, ranks: [R(1, '5 sao rơi'), R(1, '7 sao', { count: 7 }), R(1, 'Sát thương +25%', { mult: 1.25 }), R(1, 'Vùng rơi rộng hơn', { spread: 1.3 }), R(1, 'Sao cuối cùng choáng', { stun: 0.6 })],
    params: { count: 5, damage: 1.0, radius: 62, spread: 150, delay: 0.9 }, icon: { glyph: 'star', tint: '#ffe066' },
  },

  // ── AREA / SUMMON ──────────────────────────────────────────────────────────
  {
    id: 'kitten_army', category: 'summon', rarity: 'epic', pattern: 'summon',
    name: { vi: 'Bầy Mèo Con', en: 'Kitten Army' },
    desc: { vi: 'Triệu hồi ba mèo con lao vào kẻ địch.', en: 'Summon three kittens that swarm foes.' },
    cost: 34, cd: 12, range: 260, ranks: [R(1, 'Ba mèo con'), R(1, 'Mèo con mạnh hơn', { power: 1.25 }), R(1, 'Bốn mèo con', { count: 4 }), R(1, 'Mèo con hồi máu cho bạn', { heal: 4 }), R(1, 'Năm mèo con', { count: 5 })],
    params: { count: 3, duration: 9, kind: 'kitten' }, icon: { glyph: 'kitten', tint: '#7ce0b0' },
  },
  {
    id: 'spirit_cat', category: 'summon', rarity: 'epic', pattern: 'summon',
    name: { vi: 'Linh Miêu', en: 'Spirit Cat' },
    desc: { vi: 'Một linh miêu lớn chiến đấu bên bạn.', en: 'A great spectral cat fights beside you.' },
    cost: 42, cd: 16, range: 260, ranks: [R(1, 'Một linh miêu'), R(1, 'Linh miêu nhanh hơn', { speed: 1.15 }), R(1, 'Sát thương +25%', { power: 1.25 }), R(1, 'Linh miêu phóng phép', { ranged: true }), R(1, 'Kéo dài', { time: 16 })],
    params: { count: 1, duration: 11, kind: 'spirit' }, icon: { glyph: 'spirit', tint: '#a48bff' },
  },
  {
    id: 'guardian_lion', category: 'summon', rarity: 'epic', pattern: 'summon',
    name: { vi: 'Sư Tử Hộ Mệnh', en: 'Guardian Lion' },
    desc: { vi: 'Sư tử đá đứng chắn và đè bẹp kẻ địch.', en: 'A stone lion guards the ground.' },
    cost: 44, cd: 18, range: 220, ranks: [R(1, 'Sư tử đá đứng yên'), R(1, 'Sư tử đá đập mạnh hơn', { power: 1.3 }), R(1, 'Sư tử đá hút đòn hộ bạn', { taunt: true }), R(1, 'Lâu hơn', { time: 14 }), R(1, 'Linh khí hồi máu quanh nó', { aura: 'heal' })],
    params: { count: 1, duration: 10, kind: 'lion' }, icon: { glyph: 'lion', tint: '#ffc966' },
  },
  {
    id: 'ghost_paw', category: 'summon', rarity: 'rare', pattern: 'orbit',
    name: { vi: 'Vuốt Ma', en: 'Ghost Paw' },
    desc: { vi: 'Những bàn chân ma xoay quanh bạn và tự chém.', en: 'Ghost paws orbit you and slash for you.' },
    cost: 26, cd: 9, range: 110, ranks: [R(1, 'Hai vuốt ma'), R(1, 'Ba vuốt', { count: 3 }), R(1, 'Sát thương +25%', { mult: 1.25 }), R(1, 'Bán kính rộng hơn', { radius: 1.25 }), R(1, 'Vuốt ma gây chảy máu', { bleed: true })],
    params: { damage: 0.5, count: 2, radius: 66, time: 5.5 }, icon: { glyph: 'paw', tint: '#8fb0ff' },
  },
  {
    id: 'rending_ground', category: 'aoe', rarity: 'rare', pattern: 'zone',
    name: { vi: 'Đất Rách', en: 'Rending Ground' },
    desc: { vi: 'Xé mặt đất thành vùng gai nhọn.', en: 'Tear the ground into thorned ruin.' },
    cost: 28, cd: 8, range: 260, ranks: [R(1, 'Vùng gai 3 giây'), R(1, 'Bán kính +15%', { radius: 1.15 }), R(1, 'Sát thương +25%', { mult: 1.25 }), R(1, 'Gai làm chậm', { slow: 0.4 }), R(1, 'Lâu hơn', { time: 5 })],
    params: { radius: 90, time: 3, dps: 1.1, slow: 0 }, icon: { glyph: 'spikes', tint: '#c98b6b' },
  },
  {
    id: 'catnip_frenzy', category: 'utility', rarity: 'rare', pattern: 'buff',
    name: { vi: 'Bạc Hà Điên', en: 'Catnip Frenzy' },
    desc: { vi: 'Tăng tốc đánh nhưng nhận thêm sát thương; nâng cấp tăng tốc chạy.', en: 'Gain attack speed at a cost; upgrades add movement speed.' },
    cost: 18, cd: 14, range: 0, ranks: [R(1, '+35% tốc đánh, 6 giây'), R(1, '+45%', { atkSpeed: 0.45 }), R(1, '+30% tốc chạy', { move: 0.3 }), R(1, 'Hồi năng lượng liên tục', { regen: true }), R(1, 'Không còn nhận thêm sát thương', { noDrawback: true })],
    params: { time: 6, atkSpeed: 0.35, move: 0, drawback: 0.15, regen: 0 }, icon: { glyph: 'leaf', tint: '#9ad14b' },
  },
  {
    id: 'moonlit_trap', category: 'utility', rarity: 'rare', pattern: 'trap',
    name: { vi: 'Bẫy Trăng', en: 'Moonlit Trap' },
    desc: { vi: 'Đặt bẫy sáng: kẻ chạm vào bị trói và lộ vị trí.', en: 'Place a radiant snare that roots and reveals.' },
    cost: 24, cd: 7, range: 220, ranks: [R(1, 'Bẫy trói 1.2 giây'), R(1, 'Bẫy nổ sát thương', { damage: true }), R(1, 'Hai bẫy', { count: 2 }), R(1, 'Bẫy dính cả kẻ địch xa', { radius: 1.3 }), R(1, 'Trói lâu hơn', { root: 2 })],
    params: { radius: 88, root: 1.2, time: 18, damage: 0 }, icon: { glyph: 'trap', tint: '#cfe4ff' },
  },

  // ── DEFENSE / HEAL ─────────────────────────────────────────────────────────
  {
    id: 'nine_lives', category: 'defense', rarity: 'epic', pattern: 'shield',
    name: { vi: 'Chín Mạng', en: 'Nine Lives' },
    desc: { vi: 'Lá chắn giữ lại mạng bạn trong một đòn chí tử.', en: 'A ward that survives one killing blow.' },
    cost: 30, cd: 22, range: 0, ranks: [R(1, 'Hấp thụ một đòn'), R(1, 'Lá chắn dày hơn', { shield: 1.3 }), R(1, 'Hồi máu khi vỡ', { heal: 0.2 }), R(1, 'Thêm hồi chiêu nhanh', { cdCut: 3 }), R(1, 'Bất tử 1 giây khi vỡ', { invuln: 1 })],
    params: { shield: 0.4, time: 8, reviveWard: true }, icon: { glyph: 'lives', tint: '#9fe0c8' }, starter: true,
  },
  {
    id: 'iron_fur', category: 'defense', rarity: 'common', pattern: 'buff',
    name: { vi: 'Lông Sắt', en: 'Iron Fur' },
    desc: { vi: 'Lông cứng như thép trong thời gian ngắn.', en: 'Fur hardens like steel for a time.' },
    cost: 20, cd: 12, range: 0, ranks: [R(1, '-35% sát thương nhận'), R(1, '-45%', { armor: 0.45 }), R(1, 'Phản đòn', { reflect: 0.2 }), R(1, 'Lâu hơn', { time: 8 }), R(1, 'Hồi máu khi nhận đòn', { onHitHeal: 1 })],
    params: { time: 5, armor: 0.35, reflect: 0 }, icon: { glyph: 'shield', tint: '#9fb0c9' },
  },
  {
    id: 'purr_shield', category: 'defense', rarity: 'rare', pattern: 'shield',
    name: { vi: 'Khiên Gừ', en: 'Purr Shield' },
    desc: { vi: 'Tiếng gừ tạo khiên hấp thụ sát thương.', en: 'A purring barrier soaks up damage.' },
    cost: 24, cd: 10, range: 0, ranks: [R(1, 'Khiên 30% máu tối đa'), R(1, 'Khiên +25%', { shield: 1.25 }), R(1, 'Nổ khi vỡ', { boom: true }), R(1, 'Khiên lan sang đồng minh gần', { team: true }), R(1, 'Nhanh hơn', { cdCut: 2 })],
    params: { shield: 0.3, time: 7 }, icon: { glyph: 'bubble', tint: '#8fe0ff' },
  },
  {
    id: 'reflective_claws', category: 'defense', rarity: 'rare', pattern: 'buff',
    name: { vi: 'Vuốt Phản Chiến', en: 'Reflective Claws' },
    desc: { vi: 'Phản một phần sát thương sau giảm trừ về kẻ tấn công.', en: 'Reflect part of mitigated damage back to the attacker.' },
    cost: 26, cd: 13, range: 0, ranks: [R(1, 'Phản 40% sát thương'), R(1, 'Phản 55%', { reflect: 0.55 }), R(1, 'Lâu hơn', { time: 6 }), R(1, 'Giảm sát thương nhận 20%', { armor: 0.2 }), R(1, 'Phản đòn lan ra xung quanh', { splash: true })],
    params: { time: 4, reflect: 0.4, armor: 0 }, icon: { glyph: 'spikes', tint: '#ffb27a' },
  },
  {
    id: 'guardian_aura', category: 'defense', rarity: 'epic', pattern: 'aura',
    name: { vi: 'Hào Quang Hộ Vệ', en: 'Guardian Aura' },
    desc: { vi: 'Vùng ấm áp quanh bạn giảm sát thương và hồi máu.', en: 'A warm field that mends and protects.' },
    cost: 32, cd: 16, range: 110, ranks: [R(1, 'Hồi 2 máu/giây trong vùng'), R(1, 'Giảm sát thương 15%', { armor: 0.15 }), R(1, 'Vùng rộng hơn', { radius: 1.3 }), R(1, 'Hồi 3.5 máu/giây', { heal: 3.5 }), R(1, 'Đốt kẻ địch trong vùng', { burn: 0.8 })],
    params: { time: 7, radius: 100, heal: 2, armor: 0, burn: 0 }, icon: { glyph: 'aura', tint: '#ffd9a8' }, starter: true,
  },
  {
    id: 'stone_stance', category: 'defense', rarity: 'rare', pattern: 'buff',
    name: { vi: 'Thế Đá', en: 'Stone Stance' },
    desc: { vi: 'Đứng vững như tượng: miễn đẩy lùi, giảm sát thương.', en: 'Stand firm: knockback immunity and damage reduction.' },
    cost: 22, cd: 14, range: 0, ranks: [R(1, 'Chống đẩy, giảm 20% sát thương'), R(1, '-40% sát thương', { armor: 0.4 }), R(1, 'Sát thương quanh bạn', { thorns: true }), R(1, 'Lâu hơn', { time: 6 }), R(1, 'Hồi máu khi đứng yên', { heal: 2 })],
    params: { time: 4, armor: 0.2 }, icon: { glyph: 'stone', tint: '#a8b0c0' },
  },
  {
    id: 'healing_purr', category: 'heal', rarity: 'common', pattern: 'heal',
    name: { vi: 'Gừ Chữa Lành', en: 'Healing Purr' },
    desc: { vi: 'Hồi máu tức thời; nâng cấp để hồi theo thời gian.', en: 'Heal instantly; upgrade to heal over time.' },
    cost: 26, cd: 9, range: 0, ranks: [R(1, 'Hồi 22% máu'), R(1, 'Hồi 28%', { heal: 0.28 }), R(1, 'Hồi thêm theo thời gian', { overTime: true }), R(1, 'Hồi cả đồng minh', { team: true }), R(1, 'Loại bỏ làm chậm', { cleanse: true })],
    params: { heal: 0.22, time: 0 }, icon: { glyph: 'heart', tint: '#67e8a0' }, starter: true,
  },
  {
    id: 'life_drain', category: 'heal', rarity: 'rare', pattern: 'drain',
    name: { vi: 'Hút Sinh Lực', en: 'Life Drain' },
    desc: { vi: 'Rút máu mục tiêu chuyển thành của bạn.', en: 'Steal a target\'s vitality for yourself.' },
    cost: 24, cd: 8, range: 220, ranks: [R(1, 'Hút 60% sát thương'), R(1, 'Hút 75%', { leech: 0.75 }), R(1, 'Sát thương +25%', { mult: 1.25 }), R(1, 'Tầm xa hơn', { range: 280 }), R(1, 'Hút thêm kẻ địch gần', { area: true })],
    params: { damage: 1.6, leech: 0.6, time: 1.0 }, icon: { glyph: 'drain', tint: '#b48bff' },
  },
  {
    id: 'blood_fang', category: 'physical', rarity: 'rare', pattern: 'melee',
    name: { vi: 'Nanh Máu', en: 'Blood Fang' },
    desc: { vi: 'Nhát cắn hút máu và cộng dồn chảy máu.', en: 'A leeching bite that stacks bleeding.' },
    cost: 20, cd: 5, range: 80, ranks: [R(1, 'Hút 15% sát thương'), R(1, 'Chảy máu mạnh hơn', { bleed: 1.3 }), R(1, 'Sát thương +25%', { mult: 1.25 }), R(1, 'Hút 25%', { lifesteal: 0.25 }), R(1, 'Lây chảy máu sang kẻ gần', { spread: true })],
    params: { damage: 1.5, arc: 1.2, lifesteal: 0.15, bleed: 1 }, icon: { glyph: 'fang', tint: '#ff5f6d' },
  },
  {
    id: 'lucky_paw', category: 'utility', rarity: 'rare', pattern: 'buff',
    name: { vi: 'Chân May Mắn', en: 'Lucky Paw' },
    desc: { vi: 'Vận may tăng chí mạng và may mắn rơi đồ.', en: 'Luck raises crit chance and loot drops.' },
    cost: 18, cd: 15, range: 0, ranks: [R(1, '+12% chí mạng, 8 giây'), R(1, '+12% rơi đồ', { fortune: 0.12 }), R(1, '+20% chí mạng', { crit: 0.2 }), R(1, 'Nhận thêm vàng', { gold: 0.3 }), R(1, 'Chí mạng lan sang đồng minh', { team: true })],
    params: { time: 8, crit: 0.12, fortune: 0 }, icon: { glyph: 'clover', tint: '#ffc966' },
  },
  {
    id: 'mana_snack', category: 'utility', rarity: 'common', pattern: 'heal',
    name: { vi: 'Bánh Năng Lượng', en: 'Mana Snack' },
    desc: { vi: 'Ăn một miếng, hồi ngay năng lượng.', en: 'A bite restores a chunk of energy.' },
    cost: 0, cd: 16, range: 0, ranks: [R(1, 'Hồi 40 năng lượng'), R(1, 'Hồi 55', { energy: 55 }), R(1, 'Giảm 12% hồi chiêu trong 8 giây', { cdr: 0.12 }), R(1, 'Hồi cả máu', { heal: 0.1 }), R(1, 'Hồi chiêu nhanh hơn', { cdCut: 4 })],
    params: { heal: 0, energy: 40 }, icon: { glyph: 'snack', tint: '#ffc966' },
  },
  {
    id: 'time_fur', category: 'control', rarity: 'mythic', pattern: 'timeSlow',
    name: { vi: 'Lông Thời Gian', en: 'Time Fur' },
    desc: { vi: 'Bẻ cong thời gian: kẻ địch gần như đứng hình.', en: 'Bend time: enemies crawl to a halt.' },
    cost: 48, cd: 20, range: 220, ranks: [R(1, 'Làm chậm 50% trong 3 giây'), R(1, 'Chậm 65%', { slow: 0.65 }), R(1, 'Vùng rộng hơn', { radius: 1.3 }), R(1, 'Sát thương +25% trong lúc chậm', { amp: 0.25 }), R(1, 'Lâu hơn', { time: 4.5 })],
    params: { radius: 220, time: 3, slow: 0.5, amp: 0 }, icon: { glyph: 'clock', tint: '#8fe0ff' },
  },
  {
    id: 'night_veil', category: 'utility', rarity: 'rare', pattern: 'buff',
    name: { vi: 'Màn Đêm', en: 'Night Veil' },
    desc: { vi: 'Ẩn khỏi quái thường đến khi đánh trúng; boss và đòn cũ vẫn nguy hiểm.', en: 'Hide from ordinary enemies until a direct hit; bosses and existing attacks remain dangerous.' },
    cost: 22, cd: 13, range: 0, ranks: [R(1, 'Tàng hình 2 giây'), R(1, 'Chí mạng chắc chắn sau tàng hình', { forceCrit: true }), R(1, 'Lâu hơn', { time: 3 }), R(1, 'Tốc chạy +20%', { move: 0.2 }), R(1, 'Nổ sát thương khi hiện hình', { boom: true })],
    params: { time: 2, move: 0 }, icon: { glyph: 'veil', tint: '#8b90b8' },
  },
  {
    id: 'mirror_paw', category: 'defense', rarity: 'epic', pattern: 'shield',
    name: { vi: 'Vuốt Gương', en: 'Mirror Paw' },
    desc: { vi: 'Lá chắn gương phản lại đòn tấn công tầm xa.', en: 'A mirror ward throws ranged attacks back.' },
    cost: 28, cd: 12, range: 0, ranks: [R(1, 'Phản đạn tầm xa'), R(1, 'Lá chắn dày hơn', { shield: 1.25 }), R(1, 'Lâu hơn', { time: 7 }), R(1, 'Phản cả phép', { magic: true }), R(1, 'Phản đòn nổ tung', { boom: true })],
    params: { shield: 0.25, time: 5, reflectProjectiles: true }, icon: { glyph: 'mirror', tint: '#b8e0ff' },
  },
  {
    id: 'wind_sprint', category: 'mobility', rarity: 'common', pattern: 'buff',
    name: { vi: 'Chạy Gió', en: 'Wind Sprint' },
    desc: { vi: 'Bứt tốc và lướt qua đòn đánh.', en: 'Burst forward, slipping through attacks.' },
    cost: 14, cd: 7, range: 0, ranks: [R(1, '+45% tốc chạy, 3 giây'), R(1, 'Miễn đẩy lùi', { knockImmune: true }), R(1, '+60% tốc', { move: 0.6 }), R(1, 'Đòn đánh trong lúc chạy nhanh hơn', { atkSpeed: 0.2 }), R(1, 'Để lại vệt sát thương', { trail: true })],
    params: { time: 3, move: 0.45, atkSpeed: 0, trail: false }, icon: { glyph: 'wind', tint: '#7ce0c8' },
  },
  {
    id: 'blink_paw', category: 'mobility', rarity: 'rare', pattern: 'blink',
    name: { vi: 'Vuốt Dịch Chuyển', en: 'Blink Paw' },
    desc: { vi: 'Dịch chuyển tức thời theo hướng vừa chọn.', en: 'Blink instantly in the chosen direction.' },
    cost: 16, cd: 6, range: 230, ranks: [R(1, 'Dịch chuyển 200px'), R(1, 'Xa hơn', { range: 260 }), R(1, 'Nổ nhỏ khi xuất hiện', { damage: 0.8 }), R(1, 'Hai lần dùng', { charges: 2 }), R(1, 'Miễn thương khi lướt', { invuln: 0.6 })],
    params: { damage: 0, invuln: 0.2 }, icon: { glyph: 'blink', tint: '#a48bff' },
  },
  {
    id: 'double_leap', category: 'mobility', rarity: 'common', pattern: 'dash',
    name: { vi: 'Nhảy Đôi', en: 'Double Leap' },
    desc: { vi: 'Hai cú nhảy dài, cắt ngang đội hình địch.', en: 'Two long leaps that cut through the pack.' },
    cost: 18, cd: 6, range: 150, ranks: [R(1, 'Hai lần nhảy'), R(1, 'Sát thương +20%', { mult: 1.2 }), R(1, 'Xa hơn', { range: 180 }), R(1, 'Choáng khi trúng', { stun: 0.4 }), R(1, 'Để lại vệt lửa', { trail: true })],
    params: { damage: 0.9, charges: 2, knock: 90 }, icon: { glyph: 'leap', tint: '#7ce0c8' },
  },
  {
    id: 'thunder_step', category: 'mobility', rarity: 'epic', pattern: 'dash',
    name: { vi: 'Bước Sấm', en: 'Thunder Step' },
    desc: { vi: 'Lao đi trong tia điện, đốt cháy kẻ trên đường.', en: 'Dash on a lightning trail, scorching the path.' },
    cost: 30, cd: 8, range: 210, ranks: [R(1, 'Lao điện, sát thương cao'), R(1, 'Sát thương +25%', { mult: 1.25 }), R(1, 'Xa hơn', { range: 250 }), R(1, 'Choáng ngắn', { stun: 0.35 }), R(1, 'Hai lần dùng', { charges: 2 })],
    params: { damage: 1.5, duration: 0.16, knock: 60, elec: true }, icon: { glyph: 'boltstep', tint: '#ffe066' },
  },
  {
    id: 'blood_moon', category: 'aoe', rarity: 'mythic', pattern: 'nova',
    name: { vi: 'Trăng Máu', en: 'Blood Moon' },
    desc: { vi: 'Mặt trăng máu mọc lên: kẻ địch xung quanh mất máu.', en: 'A blood moon rises; foes around you bleed.' },
    cost: 46, cd: 18, range: 200, ranks: [R(1, 'Sóng máu 2 vòng'), R(1, 'Bán kính +15%', { radius: 1.15 }), R(1, 'Sát thương +30%', { mult: 1.3 }), R(1, 'Hồi máu theo sát thương', { lifesteal: 0.25 }), R(1, 'Ba vòng', { repeats: 3 })],
    params: { damage: 1.1, radius: 190, knock: 120, bleed: true, repeats: 2 }, icon: { glyph: 'bloodmoon', tint: '#ff5f6d' },
  },
  {
    id: 'soul_siphon', category: 'summon', rarity: 'rare', pattern: 'soul',
    name: { vi: 'Hút Linh Hồn', en: 'Soul Siphon' },
    desc: { vi: 'Diệt địch yếu để hồi máu; nâng cấp cộng dồn sát thương. Boss không bị xử tử.', en: 'Slay weak foes to heal; upgrade to stack damage. Bosses cannot be executed.' },
    cost: 28, cd: 11, range: 260, ranks: [R(1, 'Kết liễu hồi 8% máu'), R(1, 'Hồi 12%', { heal: 0.12 }), R(1, 'Cộng dồn +4% sát thương', { stack: 0.04 }), R(1, 'Ngưỡng máu cao hơn', { threshold: 0.35 }), R(1, 'Cộng dồn +7%', { stack: 0.07 })],
    params: { threshold: 0.25, heal: 0.08, dmg: 2.2 }, icon: { glyph: 'soul', tint: '#b48bff' },
  },
  {
    id: 'blaze_orbit', category: 'aoe', rarity: 'epic', pattern: 'orbit',
    name: { vi: 'Lửa Quỹ Đạo', en: 'Blaze Orbit' },
    desc: { vi: 'Ba quả cầu lửa quay quanh, đốt mọi thứ.', en: 'Three fire orbs circle you, scorching all.' },
    cost: 34, cd: 10, range: 100, ranks: [R(1, 'Ba cầu lửa'), R(1, 'Bốn cầu', { count: 4 }), R(1, 'Sát thương +25%', { mult: 1.25 }), R(1, 'Để lại vệt cháy', { burnTrail: true }), R(1, 'Lâu hơn', { time: 8 })],
    params: { damage: 0.8, count: 3, radius: 72, time: 6, burn: true }, icon: { glyph: 'fireorbit', tint: '#ff8f4d' },
  },
  // Two playful skills are free to equip, with different, usable mechanics.
  {
    id: 'banana_peel', category: 'control', rarity: 'common', pattern: 'banana',
    name: { vi: 'Vỏ Chuối Phản Chủ', en: 'Banana Peel' },
    desc: { vi: 'Thả vỏ chuối làm địch trượt chân và choáng.', en: 'Drop a banana peel to trip and stun enemies.' },
    cost: 12, cd: 5, range: 130, ranks: [R(1, 'Trượt chân'), R(1, 'Choáng lâu hơn', { root: 1.8 }), R(1, 'Sát thương +25%', { mult: 1.25 }), R(1, 'Hai vỏ chuối', { count: 2 }), R(1, 'Ba vỏ chuối', { count: 3 })],
    params: { radius: 38, root: 1.2, time: 9, damage: 1.2 }, icon: { glyph: 'banana', tint: '#ffe066' }, starter: true,
  },
  {
    id: 'flying_fish', category: 'projectile', rarity: 'rare', pattern: 'fish',
    name: { vi: 'Cá Bay Tới Công Chuyện', en: 'Flying Fish' },
    desc: { vi: 'Ném cá vào mặt địch, gây sát thương và đẩy lùi.', en: 'Throw a fish at a foe, dealing damage and knocking it back.' },
    cost: 14, cd: 3, range: 360, ranks: [R(1, 'Cá bay'), R(1, 'Cá đau hơn', { mult: 1.25 }), R(1, 'Hai con cá', { count: 2 }), R(1, 'Sát thương +30%', { mult: 1.3 }), R(1, 'Ba con cá', { count: 3 })],
    params: { speed: 420, damage: 1.5, spread: 0.1 }, icon: { glyph: 'fish', tint: '#77d9ff' }, starter: true,
  },
];

// Every family declares which character stat drives its power.
export const SKILL_SCALING = {
  physical: 'damage', magic: 'damage', projectile: 'damage', aoe: 'damage',
  mobility: 'speed', defense: 'armor', control: 'armor', heal: 'health',
  summon: 'health', utility: 'speed',
};
export const skillScaling = (skill) => skill.scaling || SKILL_SCALING[skill.category] || 'damage';

export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
export const STARTER_SKILLS = SKILLS.filter((s) => s.starter).map((s) => s.id);

export function skillName(skill, lang = 'vi') { return skill.name[lang] || skill.name.vi; }

/** Highest rank index (0-based) the run may reach. */
export function maxRank(skill) { return (skill.ranks?.length || 1) - 1; }

/** Effective numbers for a skill at a given rank (1-based rank = 1..5). */
export function skillValues(skill, rank = 1, mods = {}) {
  const idx = Math.max(0, Math.min((skill.ranks?.length || 1) - 1, rank - 1));
  let dmg = 1; let range = skill.range; let radius = skill.params.radius ?? skill.range;
  let count = skill.params.count ?? 1;
  let cost = skill.cost; let cd = skill.cd;
  const rankValues = {};
  for (let i = 1; i <= idx; i++) {
    const r = skill.ranks?.[i];
    if (!r) continue;
    for (const [key, value] of Object.entries(r)) {
      if (!['note', 'dmg', 'mult'].includes(key)) rankValues[key] = value;
    }
    if (r.mult) dmg *= r.mult;
    if (r.count) count = r.count;
    if (r.range) range = r.range;
    if (r.radius) radius = r.radius < 4 ? (skill.params.radius ?? skill.range) * r.radius : r.radius;
    if (r.cdCut) cd -= r.cdCut;
  }
  if (mods.blast) radius *= mods.blast;
  cd = Math.max(0.1, cd);
  return { dmg, range, radius, count, cost, cd, rankValues, mods };
}
