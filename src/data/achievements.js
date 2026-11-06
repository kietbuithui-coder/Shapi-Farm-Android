// Achievements double as a soft tutorial: they describe a tactic in one line
// and pay embers, the permanent currency.

export const ACHIEVEMENTS = [
  { id: 'first_pounce', name: { vi: 'Bước Đầu', en: 'First Steps' }, desc: { vi: 'Hoàn thành đêm đầu tiên.', en: 'Clear the first night.' }, embers: 40, check: (s) => s.stats.bestDepth >= 1 },
  { id: 'hundred', name: { vi: 'Trăm Con', en: 'Hundred Foes' }, desc: { vi: 'Hạ gục 100 kẻ địch.', en: 'Defeat 100 enemies.' }, embers: 30, check: (s) => s.stats.kills >= 100 },
  { id: 'thousand', name: { vi: 'Nghìn Con', en: 'Thousand Foes' }, desc: { vi: 'Hạ gục 1000 kẻ địch.', en: 'Defeat 1000 enemies.' }, embers: 90, check: (s) => s.stats.kills >= 1000 },
  { id: 'elite_slayer', name: { vi: 'Săn Tinh Anh', en: 'Elite Hunter' }, desc: { vi: 'Hạ gục 25 kẻ địch tinh anh.', en: 'Slay 25 elite enemies.' }, embers: 70, check: (s) => s.stats.elites >= 25 },
  { id: 'boss_break', name: { vi: 'Phá Chủ', en: 'Boss Breaker' }, desc: { vi: 'Đánh bại một chủ nhân đêm.', en: 'Defeat a night boss.' }, embers: 120, check: (s) => s.stats.bosses >= 1 },
  { id: 'deep_six', name: { vi: 'Sáu Đêm', en: 'Six Nights' }, desc: { vi: 'Vượt qua đêm thứ sáu.', en: 'Reach the sixth night.' }, embers: 160, check: (s) => s.stats.bestDepth >= 6 },
  { id: 'win', name: { vi: 'Bình Minh', en: 'Daybreak' }, desc: { vi: 'Sống qua cả chín đêm.', en: 'Survive all nine nights.' }, embers: 400, check: (s) => s.stats.wins >= 1 },
  { id: 'collector', name: { vi: 'Sưu Tầm', en: 'Collector' }, desc: { vi: 'Mở khóa 5 giống mèo.', en: 'Unlock five cats.' }, embers: 100, check: (s) => Object.values(s.cats || {}).filter((c) => c.unlocked).length >= 5 },
  { id: 'menagerie', name: { vi: 'Cả Đàn', en: 'Menagerie' }, desc: { vi: 'Mở khóa cả 10 giống mèo.', en: 'Unlock all ten cats.' }, embers: 300, check: (s) => Object.values(s.cats || {}).filter((c) => c.unlocked).length >= 10 },
  { id: 'skill_hoarder', name: { vi: 'Bậc Thầy Kỹ Năng', en: 'Skill Hoarder' }, desc: { vi: 'Mở khóa 20 kỹ năng.', en: 'Unlock twenty skills.' }, embers: 150, check: (s) => Object.values(s.skills || {}).filter((c) => c.unlocked).length >= 20 },
  { id: 'summoner', name: { vi: 'Kẻ Gọi Đàn', en: 'Caller of Packs' }, desc: { vi: 'Triệu hồi 100 đồng minh.', en: 'Summon 100 companions.' }, embers: 60, check: (s) => s.stats.minions >= 100 },
  { id: 'combo_king', name: { vi: 'Vũ Điệu', en: 'Dance of Claws' }, desc: { vi: 'Đạt chuỗi hạ gục 100.', en: 'Reach a 100 kill streak.' }, embers: 80, check: (s) => (s.stats.bestRunKills || 0) >= 100 },
  { id: 'frugal', name: { vi: 'Tiết Kiệm', en: 'Frugal' }, desc: { vi: 'Tích lũy 500 tro than.', en: 'Bank 500 embers.' }, embers: 0, check: (s) => s.embers >= 500 },
];
export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
