// All player-facing text. Short by design — the HUD is icons and numbers.
// Anything a player must read twice is cut.

export const STRINGS = {
  vi: {
    title: 'CAT LEGENDS', subtitle: 'Chín Đêm Dưới Ánh Trăng',
    play: 'Chơi', continueRun: 'Tiếp tục', cats: 'Mèo', skills: 'Kỹ Năng', upgrades: 'Cường Hóa', collection: 'Bộ Sưu Tập', achievements: 'Thành Tựu', settings: 'Cài Đặt',
    back: 'Quay lại', close: 'Đóng', locked: 'Chưa mở', unlock: 'Mở khóa', equip: 'Trang bị', equipped: 'Đang dùng',
    start: 'Xuất Phát', enterNight: 'Vào Đêm', abandon: 'Bỏ Chạy', retry: 'Chơi Lại', toMenu: 'Về Sảnh',
    chooseUpgrade: 'Chọn một', levelUp: 'Cấp', pause: 'Tạm Dừng', resume: 'Tiếp Tục', quit: 'Rời Trận',
    victory: 'Bình Minh', defeat: 'Đêm Kéo Dài', clear: 'Hoàn Thành',
    embers: 'Tro Than', level: 'Cấp', time: 'Thời Gian', kills: 'Hạ Gục',
    rank: 'Bậc', cooldown: 'Hồi', energy: 'Năng Lượng', cost: 'Tiêu Hao', reach: 'Tầm', slots: 'Ô Kỹ Năng',
    passive: 'Nội Tại', active: 'Chủ Động', stats: 'Chỉ Số', damage: 'Sát Thương', health: 'Máu', armor: 'Giáp',
    crit: 'Chí Mạng', speed: 'Tốc Độ', dodge: 'Né', regen: 'Hồi Phục',
    night: 'Đêm', wave: 'Lượt', boss: 'Chủ Nhân', miniBoss: 'Vệ Binh',
    music: 'Nhạc', sfx: 'Hiệu Ứng', voice: 'Giọng', shake: 'Rung', viewDistance: 'Tầm nhìn', damageNumbers: 'Số Sát Thương',
    quality: 'Chất Lượng', reduceMotion: 'Giảm Chuyển Động', aimAssist: 'Hỗ Trợ Nhắm', language: 'Ngôn Ngữ',
    hud: 'Giao Diện Cảm Ứng', hudCompact: 'Gọn', hudStandard: 'Chuẩn', hudLarge: 'Lớn', hudScale: 'Cỡ Nút', leftHanded: 'Tay Trái', fullscreen: 'Toàn Màn Hình',
    resetSave: 'Xóa Tiến Trình', resetConfirm: 'Xóa toàn bộ tiến trình?', yes: 'Xóa', no: 'Giữ',
    difficulty: 'Độ Khó', normal: 'Thường', hard: 'Khó', endless: 'Vô Tận', sandbox: 'Bot Tự Chơi',
    watching: 'Đang Xem', you: 'Bạn', newBest: 'Kỷ Lục Mới',
    unlocked: 'Đã Mở', notEnough: 'Không Đủ Tro Than', maxed: 'Tối Đa',
    hintMove: 'Di chuyển', hintSkill: 'Kỹ năng', hintDodge: 'Lướt', hintPause: 'Tạm dừng',
    botOn: 'Bật Bot', botOff: 'Tắt Bot', spectate: 'Xem Bot', takeover: 'Chơi Tiếp',
    streak: 'Chuỗi', waveClear: 'Sạch Sóng', shrine: 'Đền Ánh Sáng', heal: 'Hồi Máu', rest: 'Nghỉ Ngơi',
    chest: 'Rương', coins: 'Xu', restoratives: 'Bình Máu',
    noSkills: 'Chọn kỹ năng cho cả 4 ô', pickCat: 'Chọn một con mèo', tapToStart: 'Chạm để bắt đầu',
    runSummary: 'Kết Quả', depth: 'Đêm Đạt Được', best: 'Tốt Nhất', rewards: 'Phần Thưởng',
    levelUpChoice: 'Lên Cấp', skillUpChoice: 'Nâng Kỹ Năng', newSkill: 'Kỹ Năng Mới',
    meow: 'Meo',
  },
  en: {
    title: 'CAT LEGENDS', subtitle: 'Nine Nights Under the Moon',
    play: 'Play', continueRun: 'Continue', cats: 'Cats', skills: 'Skills', upgrades: 'Upgrades', collection: 'Collection', achievements: 'Achievements', settings: 'Settings',
    back: 'Back', close: 'Close', locked: 'Locked', unlock: 'Unlock', equip: 'Equip', equipped: 'Equipped',
    start: 'Depart', enterNight: 'Enter the Night', abandon: 'Flee', retry: 'Play Again', toMenu: 'To Hall',
    chooseUpgrade: 'Choose one', levelUp: 'Level', pause: 'Paused', resume: 'Resume', quit: 'Leave Run',
    victory: 'Daybreak', defeat: 'The Night Grows Long', clear: 'Cleared',
    embers: 'Embers', level: 'Level', time: 'Time', kills: 'Kills',
    rank: 'Rank', cooldown: 'Cooldown', energy: 'Energy', cost: 'Cost', reach: 'Reach', slots: 'Skill Slots',
    passive: 'Passive', active: 'Active', stats: 'Stats', damage: 'Damage', health: 'Health', armor: 'Armor',
    crit: 'Crit', speed: 'Speed', dodge: 'Dodge', regen: 'Regen',
    night: 'Night', wave: 'Wave', boss: 'Boss', miniBoss: 'Warden',
    music: 'Music', sfx: 'Effects', voice: 'Voice', shake: 'Shake', viewDistance: 'View', damageNumbers: 'Damage Numbers',
    quality: 'Quality', reduceMotion: 'Reduce Motion', aimAssist: 'Aim Assist', language: 'Language',
    hud: 'Touch HUD', hudCompact: 'Compact', hudStandard: 'Standard', hudLarge: 'Large', hudScale: 'Button Size', leftHanded: 'Left Handed', fullscreen: 'Fullscreen',
    resetSave: 'Erase Progress', resetConfirm: 'Erase all progress?', yes: 'Erase', no: 'Keep',
    difficulty: 'Difficulty', normal: 'Normal', hard: 'Hard', endless: 'Endless', sandbox: 'Bot Play',
    watching: 'Spectating', you: 'You', newBest: 'New Best',
    unlocked: 'Unlocked', notEnough: 'Not Enough Embers', maxed: 'Max',
    hintMove: 'Move', hintSkill: 'Skills', hintDodge: 'Dash', hintPause: 'Pause',
    botOn: 'Bot On', botOff: 'Bot Off', spectate: 'Watch Bot', takeover: 'Take Over',
    streak: 'Streak', waveClear: 'Wave Clear', shrine: 'Shrine', heal: 'Heal', rest: 'Rest',
    chest: 'Chest', coins: 'Coins', restoratives: 'Potions',
    noSkills: 'Fill all four skill slots', pickCat: 'Pick a cat', tapToStart: 'Tap to begin',
    runSummary: 'Summary', depth: 'Depth', best: 'Best', rewards: 'Rewards',
    levelUpChoice: 'Level Up', skillUpChoice: 'Skill Rank', newSkill: 'New Skill',
    meow: 'Meow',
  },
};

export function t(lang, key) {
  const dict = STRINGS[lang] || STRINGS.vi;
  return dict[key] ?? STRINGS.vi[key] ?? key;
}
export const localize = (obj, lang) => (obj ? obj[lang] || obj.vi || '' : '');

/**
 * The document language + font stack follow the in-game setting so the canvas
 * and any DOM chrome never disagree.
 */
export function applyFrame(lang) {
  const code = lang === 'en' ? 'en' : 'vi';
  try {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = code;
      document.documentElement.dataset.lang = code;
    }
  } catch { /* non-DOM host */ }
  return code;
}
