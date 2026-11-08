// Menu / meta scenes. Every screen shares one frame:
//   moonlit wash → scene title → content → footer with one primary action.
// Text is limited to names, numbers and the one line that carries real meaning.

import { TAU, clamp, lerp, smooth, hash01 } from '../core/math.js';
import { PALETTE, FONT, RARITY, ELEMENT_COLORS } from '../data/palette.js';
import { UI, roundRect, panel, text, button, meter, heading, divider, iconButton, statChip, easeOut, easeInOut, measure } from './theme.js';
import { drawIcon } from '../art/icons.js';
import { drawCat, drawCatFace } from '../art/catart.js';
import { drawCreature } from '../art/creatureart.js';
import { CATS, CAT_BY_ID } from '../data/cats.js';
import { BOSSES } from '../data/enemies.js';
import { SKILLS, SKILL_BY_ID, SKILL_CATEGORIES, skillScaling } from '../data/skills.js';
import { PERK_LINES, PERK_COST, PERK_TIERS } from '../data/perks.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { localize, t as tr } from '../data/strings.js';

/** Some data strings are plain (already-translated) text, some are {vi,en}. */
const L = (v, lang) => (typeof v === 'string' ? v : localize(v, lang));
import { audio } from '../audio/audio.js';

/* ────────────────────────────── shared frame ────────────────────────────── */
export function drawBackdrop(ctx, w, h, t, accent = PALETTE.lilac, dim = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#080b18');
  g.addColorStop(0.55, '#0d1226');
  g.addColorStop(1, '#070a15');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // moon glow (upper left, consistent with the arena)
  const mg = ctx.createRadialGradient(w * 0.12, h * 0.06, 10, w * 0.12, h * 0.06, Math.max(w, h) * 0.7);
  mg.addColorStop(0, `rgba(255,232,168,${0.13 * dim + 0.05})`);
  mg.addColorStop(0.35, `rgba(164,139,255,${0.06 * dim})`);
  mg.addColorStop(1, 'rgba(8,11,24,0)');
  ctx.fillStyle = mg;
  ctx.fillRect(0, 0, w, h);
  // accent wash bottom right
  const ag = ctx.createRadialGradient(w * 0.92, h * 0.95, 10, w * 0.92, h * 0.95, w * 0.5);
  ag.addColorStop(0, hexA(accent, 0.09));
  ag.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ag;
  ctx.fillRect(0, 0, w, h);
  // drifting motes
  for (let i = 0; i < 28; i++) {
    const x = (hash01(i * 91) * w + t * (6 + hash01(i * 13) * 14)) % w;
    const y = h * (0.1 + hash01(i * 47) * 0.8) + Math.sin(t * 0.5 + i) * 8;
    const a = 0.06 + 0.1 * (0.5 + 0.5 * Math.sin(t * 1.1 + i * 2.1));
    ctx.fillStyle = `rgba(220,230,255,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.8 + hash01(i * 7) * 1.6, 0, TAU);
    ctx.fill();
  }
  // vignette
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.78);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(3,4,10,0.7)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

function hexA(c, a) {
  if (!c) return `rgba(255,255,255,${a})`;
  const v = c.replace('#', '');
  return `rgba(${parseInt(v.slice(0, 2), 16)},${parseInt(v.slice(2, 4), 16)},${parseInt(v.slice(4, 6), 16)},${a})`;
}

export function sceneTitle(ctx, title, subtitle, x, y, opts = {}) {
  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = `600 ${opts.size || 40}px ${FONT.display}`;
  ctx.letterSpacing = `${opts.track ?? 1}px`;
  const g = ctx.createLinearGradient(x, y - 30, x, y + 8);
  g.addColorStop(0, '#fff8e6');
  g.addColorStop(1, '#e8c98f');
  ctx.fillStyle = g;
  ctx.fillText(title, x, y);
  ctx.letterSpacing = '0px';
  if (subtitle) {
    ctx.font = `600 11px ${FONT.ui}`;
    ctx.letterSpacing = '3.6px';
    ctx.fillStyle = 'rgba(255,201,102,0.62)';
    ctx.fillText(subtitle.toUpperCase(), x + 1, y + 20);
    ctx.letterSpacing = '0px';
  }
  ctx.restore();
}

export function drawNavBar(ctx, w, safe, items, activeId, hover, lang) {
  const rects = [];
  const barH = 58;
  const x = safe.left + 26;
  const y = safe.top + 18;
  let cx = x;
  for (const item of items) {
    const label = localize(item.label, lang);
    const wd = measure(ctx, label, 13, 700) + 34;
    rects.push({ id: item.id, x: cx, y, w: wd, h: 34 });
    cx += wd + 6;
  }
  return rects;
}

export function paintNav(ctx, rects, activeId, hover, lang, items) {
  for (const r of rects) {
    const item = items.find((i) => i.id === r.id);
    const active = r.id === activeId;
    const isHover = hover === r.id;
    roundRect(ctx, r.x, r.y, r.w, r.h, 17);
    if (active) {
      ctx.fillStyle = 'rgba(255,201,102,0.14)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,201,102,0.42)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else if (isHover) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fill();
    }
    text(ctx, localize(item.label, lang), r.x + r.w / 2, r.y + 22, {
      size: 12.5, weight: 700, align: 'center',
      color: active ? '#ffe8a8' : isHover ? '#e8e2d2' : 'rgba(154,168,200,0.85)',
    });
  }
}

/* ───────────────────────────── menu (home) ───────────────────────────── */
export function drawHome(ctx, { w, h, safe, t, lang, profile, hover, difficulty = 'normal' }) {
  drawBackdrop(ctx, w, h, t, PALETTE.lilac, 1);
  const rects = [];

  // hero cat silhouette: the game's identity, no copy explaining it
  const heroCat = CAT_BY_ID[profile.loadout.cat] || CATS[0];
  const heroX = w * 0.73;
  const heroY = h * 0.88;
  const heroScale = Math.min(w, h) / 250;
  // A short portrait screen uses this space for its menu grid; the decorative
  // cat used to show through the translucent buttons and obscure their labels.
  const showHero = !(h > w && h < 700);
  if (showHero) {
    ctx.save();
    ctx.globalAlpha = 0.92;
    drawCat(ctx, heroCat, { t, gait: 0, lean: 0, tail: t * 0.2, blink: 0, ears: Math.sin(t * 0.8) * 0.12, mouth: 0 }, { x: heroX, y: heroY, scale: heroScale, facing: -1 });
    ctx.restore();
  }
  // moon halo behind the hero
  const halo = ctx.createRadialGradient(heroX, heroY - 190, 10, heroX, heroY - 190, 300);
  halo.addColorStop(0, 'rgba(255,232,168,0.14)');
  halo.addColorStop(0.5, 'rgba(164,139,255,0.07)');
  halo.addColorStop(1, 'rgba(255,232,168,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(heroX - 300, heroY - 490, 600, 600);
  // ground pool
  const pool = ctx.createLinearGradient(0, heroY - 8, 0, heroY + 26);
  pool.addColorStop(0, 'rgba(255,232,168,0.10)');
  pool.addColorStop(1, 'rgba(255,232,168,0)');
  if (showHero) {
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.ellipse(heroX, heroY + 2, 120, 20, 0, 0, TAU);
    ctx.fill();
  }

  // title block
  const portrait = h > w;
  const left = safe.left + (portrait ? 24 : 64);
  const topY = portrait ? Math.max(safe.top + 100, h * 0.22) : h * 0.3;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = `700 ${Math.min(74, w * 0.075)}px ${FONT.display}`;
  ctx.letterSpacing = '2px';
  const tg = ctx.createLinearGradient(left, topY - 60, left, topY + 10);
  tg.addColorStop(0, '#fff8e6');
  tg.addColorStop(0.6, '#f0d6a0');
  tg.addColorStop(1, '#c99b52');
  ctx.fillStyle = tg;
  ctx.fillText(localize({ vi: 'CAT LEGENDS', en: 'CAT LEGENDS' }, lang), left, topY);
  ctx.restore();
  ctx.save();
  ctx.font = `600 ${Math.min(16, w * 0.017)}px ${FONT.ui}`;
  ctx.letterSpacing = '8px';
  ctx.fillStyle = 'rgba(255,201,102,0.72)';
  ctx.fillText(localize({ vi: 'CHÍN ĐÊM DƯỚI ÁNH TRĂNG', en: 'NINE NIGHTS UNDER THE MOON' }, lang), left + 4, topY + 30);
  ctx.restore();

  // primary action: one wide, warm entry point
  // The rail is not the button: the tiles need more horizontal room than the
  // Play button, and the play button's width was being used as the rail width.
  // Room to the hero cat is the real limit; stay clear of it.
  const heroLeftEdge = w * 0.73 - Math.min(w, h) * 0.42;
  const btnW = portrait ? Math.min(300, w - safe.right - left - 24) : Math.min(420, w * 0.34);
  const railW = portrait ? w - safe.right - left - 24
    : Math.max(btnW, Math.min(w - left - 24, heroLeftEdge - left - 18));
  const btnH = 58;
  let by = topY + 74;
  const playR = button(ctx, { x: left, y: by, w: btnW, h: btnH, label: tr(lang, 'play'), icon: 'pounce', primary: true, hover: hover === 'play', font: '19px' });
  rects.push({ id: 'play', ...playR });
  by += btnH + 26;
  // menu rail: five quiet tiles, labelled, no taglines
  const secondaries = [
    { id: 'cats', label: tr(lang, 'cats'), icon: 'paw' },
    { id: 'skills', label: tr(lang, 'skills'), icon: 'sigil' },
    // Short labels: "Cường Hóa" / "Bộ Sưu Tập" do not fit a six-across rail on a
    // phone and were being drawn as "Cuộn…" and "Bộ Sư…". The full names are
    // still used as each screen's title, so nothing is lost — the tile is a
    // signpost, and a signpost that has to be guessed at is worse than a short
    // one.
    { id: 'upgrades', label: L({ vi: 'Cường H.', en: 'Boosts' }, lang), icon: 'ember' },
    { id: 'collection', label: L({ vi: 'Bộ Sưu', en: 'Album' }, lang), icon: 'star' },
    { id: 'codex', label: L({ vi: 'Sổ tay', en: 'Codex' }, lang), icon: 'book' },
    { id: 'settings', label: tr(lang, 'settings'), icon: 'clock' },
  ];
  const gapT = 10;
  // Available height for the rail, so the grid never runs off a short screen.
  const railBottomLimit = h - safe.bottom - 14;
  const availH = Math.max(120, railBottomLimit - by);
  // Six tiles in one row only works if each gets enough width for its label.
  // On a phone that rail is ~340px wide, so each tile got 56px and every label
  // was truncated to "Kỹ Nă…", "Bộ S…" — the menu looked broken. Measure the
  // widest label at the smallest acceptable type size and choose the number of
  // columns from that, so the rail is 1 or 2 rows depending on the screen.
  const minTileW = 104;
  let cols = Math.max(1, Math.min(secondaries.length, Math.floor((railW + gapT) / (minTileW + gapT))));
  let rows = Math.ceil(secondaries.length / cols);
  // Fewer columns is only a win if the extra rows fit. If they do not, go back
  // to a single row and accept narrower tiles rather than clipping the menu.
  const fits = (c, r) => r * 64 + (r - 1) * gapT <= availH;
  if (!fits(cols, rows)) {
    cols = secondaries.length;
    rows = 1;
  }
  const sw = (railW - gapT * (cols - 1)) / cols;
  // Tile height is whatever the budget allows, clamped to a comfortable band.
  const sh = clamp((availH - (rows - 1) * gapT) / rows, 56, 86);
  const tileScale = clamp(Math.min(sw / 108, sh / 86), 0.68, 1.1);
  secondaries.forEach((s, i) => {
    const sx = left + (i % cols) * (sw + gapT);
    const sy = by + Math.floor(i / cols) * (sh + gapT);
    const active = hover === s.id;
    roundRect(ctx, sx, sy, sw, sh, 14);
    ctx.fillStyle = active ? 'rgba(255,255,255,0.075)' : 'rgba(10,14,26,0.66)';
    ctx.fill();
    ctx.strokeStyle = active ? 'rgba(255,201,102,0.45)' : 'rgba(255,201,102,0.15)';
    ctx.lineWidth = 1.1;
    ctx.stroke();
    const iconSize = Math.max(19, 26 * tileScale);
    const labSize = Math.max(9, 9.5 * tileScale);
    drawIcon(ctx, s.icon, sx + sw / 2, sy + sh * 0.36, iconSize, active ? '#ffe8a8' : 'rgba(206,216,238,0.78)');
    text(ctx, trimTo(ctx, s.label, sw - 6, labSize, 700), sx + sw / 2, sy + sh - 12, {
      size: labSize, weight: 700, color: active ? '#ffe8a8' : 'rgba(170,182,210,0.95)', align: 'center',
    });
    rects.push({ id: s.id, x: sx, y: sy, w: sw, h: sh });
  });
  // The rail can now end lower than before; block the next section from
  // overlapping it by advancing `by` past the last row.
  by += rows * sh + (rows - 1) * gapT;

  // ember purse (top-right, always visible)
  const purseW = 116;
  const purseX = w - safe.right - purseW - 26;
  const purseY = safe.top + 20;
  roundRect(ctx, purseX, purseY, purseW, 38, 19);
  ctx.fillStyle = 'rgba(10,14,26,0.78)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,201,102,0.24)';
  ctx.lineWidth = 1;
  ctx.stroke();
  drawIcon(ctx, 'ember', purseX + 22, purseY + 19, 17, '#ffb066', { glow: 'rgba(255,150,80,0.5)' });
  text(ctx, String(profile.embers), purseX + 38, purseY + 24, { size: 15, weight: 700, color: '#ffe8c8' });
  const practice = button(ctx, { x: purseX, y: purseY + 48, w: purseW, h: 36,
    label: t2(lang, 'Thử Boss', 'Boss Practice'), hover: hover === 'bossPractice', font: '10.5px' });
  rects.push({ id: 'bossPractice', ...practice });
  // Difficulty currently changes bosses/minibosses only, not ordinary waves.
  // Say so on the control instead of implying that every enemy is harder.
  const difficultyLabel = difficulty === 'hard' ? t2(lang, 'Boss: Khó', 'Boss: Hard') : t2(lang, 'Boss: Thường', 'Boss: Normal');
  const diffAtTop = portrait && h - safe.bottom - 50 < by + 4;
  const diff = button(ctx, { x: diffAtTop ? left : w - safe.right - 142, y: diffAtTop ? safe.top + 20 : h - safe.bottom - 50, w: 116, h: 36,
    label: difficultyLabel, hover: hover === 'toggleDifficulty', font: '11px' });
  rects.push({ id: 'toggleDifficulty', ...diff });

  // best depth, bottom-left
  const best = profile.stats.bestDepth || 0;
  if (best > 0) {
    text(ctx, `${tr(lang, 'best')} · ${best}`, left, h - safe.bottom - 22, { size: 11, weight: 700, color: 'rgba(255,201,102,0.5)' });
  }
  return rects;
}

/* Standalone boss practice: no campaign rewards, records or wins. */
export function drawBossPractice(ctx, { w, h, safe, t, lang, hover }) {
  drawBackdrop(ctx, w, h, t, PALETTE.vermilion, 0.85);
  const rects = [];
  sceneTitle(ctx, t2(lang, 'Thử Boss', 'Boss Practice'), t2(lang, 'ĐẤU TẬP · KHÔNG CÓ THƯỞNG', 'PRACTICE · NO REWARDS'), safe.left + 24, safe.top + 88, { size: 32, track: 0.8 });
  const portrait = h > w, cols = portrait ? 2 : 5, rows = Math.ceil(BOSSES.length / cols), gap = 10;
  const left = safe.left + 20, top = safe.top + 126, availableW = w - safe.left - safe.right - 40;
  const cardW = (availableW - gap * (cols - 1)) / cols;
  const cardH = Math.min(180, (h - safe.bottom - 20 - top - gap * (rows - 1)) / rows);
  BOSSES.forEach((boss,i) => {
    const x = left + (i % cols) * (cardW + gap), y = top + Math.floor(i / cols) * (cardH + gap), active = hover === 'practice:' + boss.id;
    panel(ctx, x, y, cardW, cardH, { radius: 14 });
    ctx.save(); ctx.beginPath(); ctx.arc(x + cardW/2, y + cardH * 0.38, Math.min(32, cardH * 0.21), 0, TAU);
    ctx.fillStyle = hexA(boss.color, 0.4); ctx.fill(); ctx.strokeStyle = hexA(boss.glow || boss.color, 0.75); ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
    drawIcon(ctx, 'skull', x + cardW / 2, y + cardH * 0.38, Math.min(30, cardH * 0.25), boss.glow || '#ffe8a8');
    const size = cardW < 100 ? 9.5 : 12;
    text(ctx, trimTo(ctx, localize(boss.name, lang), cardW - 12, size, 700), x + cardW / 2, y + cardH * 0.74, { size, weight: 700, align: 'center', color: active ? '#ffe8a8' : '#f4ecd8' });
    rects.push({ id: 'practice:' + boss.id, x, y, w: cardW, h: cardH });
  });
  iconButton(ctx, { x: safe.left + 26, y: safe.top + 26, r: 19, icon: 'back', hover: hover === 'back' });
  rects.push({ id: 'back', x: safe.left + 7, y: safe.top + 7, w: 38, h: 38 });
  return rects;
}

function blinkAt(t, phase) {
  const c = (t * 0.31 + phase) % 1;
  return c > 0.97 ? Math.sin(((c - 0.97) / 0.03) * Math.PI) : 0;
}

/* ───────────────────────────── cat select ───────────────────────────── */
export function drawCatSelect(ctx, { w, h, safe, t, lang, profile, hover, selected, selectedPrev, fadeT = 1, botMode }) {
  if (h > w) return drawPortraitCats(ctx, { w, h, safe, t, lang, profile, hover, selected, botMode });
  drawBackdrop(ctx, w, h, t, PALETTE.ember, 0.9);
  sceneTitle(ctx, tr(lang, 'cats'), t2(lang, 'Chọn Người Bạn Đồng Hành', 'Choose Your Companion'), safe.left + 30, safe.top + 92);
  const rects = [];

  const railW = Math.min(336, w * 0.29);
  const gridX = safe.left + 30;
  const gridTop = safe.top + 150;
  const gridRight = w - safe.right - railW - 40;
  const gridH = h - gridTop - safe.bottom - 34;
  const cols = 4;
  const rows = Math.ceil(CATS.length / cols);
  const gap = 12;
  const cardW = (gridRight - gridX - gap * (cols - 1)) / cols;
  const cardH = Math.min(cardW * 1.34, (gridH - gap * (rows - 1)) / rows);

  CATS.forEach((cat, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = gridX + col * (cardW + gap);
    const y = gridTop + row * (cardH + gap);
    const unlocked = isCatUnlocked(profile, cat);
    const isSel = selected === cat.id;
    const isHover = hover === 'cat:' + cat.id;

    // card surface
    roundRect(ctx, x, y, cardW, cardH, 14);
    const g = ctx.createLinearGradient(x, y, x, y + cardH);
    if (isSel) { g.addColorStop(0, 'rgba(255,201,102,0.14)'); g.addColorStop(1, 'rgba(26,20,14,0.94)'); }
    else { g.addColorStop(0, 'rgba(18,23,42,0.94)'); g.addColorStop(1, 'rgba(9,12,22,0.95)'); }
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = isSel ? 'rgba(255,201,102,0.85)' : isHover ? 'rgba(220,228,248,0.26)' : 'rgba(255,201,102,0.13)';
    ctx.lineWidth = isSel ? 1.8 : 1.1;
    ctx.stroke();

    // portrait sits above a name plate so nothing overlaps
    const plateH = 26;
    ctx.save();
    roundRect(ctx, x, y, cardW, cardH, 14);
    ctx.clip();
    ctx.globalAlpha = unlocked ? 1 : 0.38;
    const artScale = Math.min((cardW - 16) / 46, (cardH - plateH - 12) / 62);
    drawCat(ctx, cat, {
      t: t + i * 0.6, gait: isSel ? 0.25 : 0, tail: t * 0.32 + i * 0.1,
      blink: blinkAt(t, i * 0.13), ears: Math.sin(t * 1.1 + i) * 0.06,
    }, { x: x + cardW * 0.5, y: y + cardH - plateH - 6, scale: artScale, facing: 1 });
    // plate
    ctx.fillStyle = 'rgba(6,8,16,0.82)';
    ctx.fillRect(x, y + cardH - plateH, cardW, plateH);
    ctx.fillStyle = 'rgba(255,201,102,0.1)';
    ctx.fillRect(x, y + cardH - plateH, cardW, 1);
    ctx.restore();
    text(ctx, localize(cat.name, lang), x + cardW / 2, y + cardH - 9, { size: 11.5, weight: 700, align: 'center', color: unlocked ? '#f4ecd8' : 'rgba(244,236,216,0.45)' });

    if (!unlocked) {
      ctx.save();
      roundRect(ctx, x, y, cardW, cardH, 14);
      ctx.fillStyle = 'rgba(5,7,14,0.5)';
      ctx.fill();
      ctx.restore();
      const cw2 = 54;
      const tagX = x + cardW / 2 - cw2 / 2;
      const tagY = y + cardH - 26 - 22;
      roundRect(ctx, tagX, tagY, cw2, 20, 10);
      ctx.fillStyle = 'rgba(8,10,20,0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,157,92,0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();
      drawIcon(ctx, 'ember', tagX + 13, tagY + 10, 10, '#ff9d5c');
      text(ctx, String(cat.unlock.embers), tagX + 24, tagY + 14, { size: 10.5, weight: 700, color: '#ffd0a8' });
    }
    rects.push({ id: 'cat:' + cat.id, x, y, w: cardW, h: cardH });
  });

  /* right rail — the selected cat, drawn large and legible */
  const railX = w - safe.right - railW - 26;
  const railY = safe.top + 88;
  const railH = h - railY - safe.bottom - 26;
  panel(ctx, railX, railY, railW, railH, { radius: 18 });

  const cat = CAT_BY_ID[selected] || CATS[0];
  const unlocked = isCatUnlocked(profile, cat);
  const prevCat = selectedPrev && selectedPrev !== selected ? CAT_BY_ID[selectedPrev] : null;
  // Cross-fade from the OLD cat to the NEW one. `fadeT` ramps 0 -> 1 after a
  // pick, so it is the *outgoing* alpha: the previous cat fades out and the
  // selected one fades in. This was inverted, so choosing a cat drew the
  // previous cat at full opacity and the chosen one at zero — the rail showed
  // the wrong cat forever after the first selection, which is the reported bug.
  const prevA = prevCat ? 1 - clamp(fadeT, 0, 1) : 0;

  ctx.save();
  roundRect(ctx, railX, railY, railW, railH, 18);
  ctx.clip();
  // aura
  const aura = ctx.createRadialGradient(railX + railW / 2, railY + 132, 6, railX + railW / 2, railY + 132, railW * 0.72);
  aura.addColorStop(0, hexA(cat.color, 0.3));
  aura.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = aura;
  ctx.fillRect(railX, railY, railW, railH);
  // full body, grounded, facing the viewer's left — the silhouette does the talking
  const heroScale = Math.min(railW / 70, 3.5);
  if (prevCat) {
    ctx.globalAlpha = prevA;
    drawCat(ctx, prevCat, { t, gait: 0.12, tail: t * 0.3, blink: 1, ears: 0 }, { x: railX + railW * 0.5, y: railY + 238, scale: heroScale, facing: -1 });
  }
  ctx.globalAlpha = 1 - prevA;
  drawCat(ctx, cat, { t: t + 0.4, gait: 0.12, tail: t * 0.3, blink: blinkAt(t, 0.5), ears: Math.sin(t * 0.9) * 0.1 }, { x: railX + railW * 0.5, y: railY + 238, scale: heroScale, facing: -1 });
  // floor shadow transition
  const footG = ctx.createLinearGradient(0, railY + 240, 0, railY + 212);
  footG.addColorStop(0, 'rgba(6,8,16,0.98)');
  footG.addColorStop(0.55, 'rgba(6,8,16,0.6)');
  footG.addColorStop(1, 'rgba(6,8,16,0)');
  ctx.fillStyle = footG;
  ctx.fillRect(railX, railY + 212, railW, 30);
  ctx.restore();

  sceneTitle(ctx, localize(cat.name, lang), localize(cat.title, lang), railX + 22, railY + 286, { size: 23, track: 0.3 });
  text(ctx, localize(cat.tagline, lang), railX + 22, railY + 330, { size: 11.5, color: 'rgba(200,210,232,0.72)', italic: true, font: FONT.display });

  // stat bars
  const stats = [
    { label: { vi: 'Máu', en: 'Health' }, v: cat.base.hp / 170 },
    { label: { vi: 'Sát thương', en: 'Power' }, v: cat.base.atk / 1.25 },
    { label: { vi: 'Tốc độ', en: 'Speed' }, v: cat.base.move / 1.2 },
    { label: { vi: 'Chí mạng', en: 'Crit' }, v: cat.base.crit / 0.18 },
  ];
  stats.forEach((st, i) => {
    const sy = railY + 358 + i * 21;
    text(ctx, localize(st.label, lang), railX + 22, sy + 4, { size: 10, weight: 600, color: 'rgba(154,168,200,0.9)' });
    meter(ctx, railX + 96, sy - 4, railW - 118, 6, clamp(st.v, 0.06, 1), { color: hexA(cat.color, 0.5), color2: cat.color });
  });

  // passive
  const py = railY + 456;
  if (py + 44 < railY + railH) {
    divider(ctx, railX + 18, py - 20, railW - 36);
    drawIcon(ctx, 'sigil', railX + 30, py - 2, 13, '#ffe8a8');
    text(ctx, localize(cat.passive.name, lang), railX + 44, py + 2, { size: 12.5, weight: 700, color: '#ffe8a8' });
    wrapText(ctx, localize(cat.passive.desc, lang), railX + 22, py + 20, railW - 44, 15, { size: 11, color: 'rgba(200,210,232,0.78)' });
  }

  // actions
  const actY = railY + railH - 108;
  if (unlocked) {
    const equipped = selected === profile.loadout.cat;
    const r = button(ctx, { x: railX + 16, y: actY, w: railW - 32, h: 44, label: equipped ? tr(lang, 'equipped') : tr(lang, 'equip'), icon: equipped ? 'kitten' : 'paw', primary: equipped, hover: hover === 'equip', font: '13.5px' });
    rects.push({ id: 'equip', ...r });
    const r2 = button(ctx, { x: railX + 16, y: actY + 52, w: railW - 32, h: 44, label: botMode ? tr(lang, 'spectate') : tr(lang, 'start'), icon: botMode ? 'spirit' : 'play', hover: hover === 'start', font: '14px' });
    rects.push({ id: 'start', ...r2 });
  } else {
    const canBuy = profile.embers >= cat.unlock.embers;
    const r = button(ctx, { x: railX + 16, y: actY + 12, w: railW - 32, h: 46, label: String(cat.unlock.embers), icon: 'ember', primary: canBuy, disabled: !canBuy, hover: hover === 'unlock', font: '15px' });
    rects.push({ id: 'unlock', ...r });
    if (!canBuy) {
      // insufficient-funds read is a number difference, no sentence
      text(ctx, `${profile.embers}`, railX + railW - 24, actY + 82, { size: 11, weight: 700, align: 'right', color: 'rgba(255,157,92,0.55)' });
    }
  }

  // back
  iconButton(ctx, { x: safe.left + 26, y: safe.top + 26, r: 19, icon: 'back', hover: hover === 'back' });
  rects.push({ id: 'back', x: safe.left + 7, y: safe.top + 7, w: 38, h: 38 });
  return rects;
}

// Portrait has no room for a side-by-side grid and detail rail. Stack them
// instead, retaining the same action IDs used by the normal menu.
function drawPortraitCats(ctx, { w, h, safe, t, lang, profile, hover, selected, botMode }) {
  drawBackdrop(ctx, w, h, t, PALETTE.ember, 0.9);
  const rects = [];
  sceneTitle(ctx, tr(lang, 'cats'), t2(lang, 'Chọn Người Bạn Đồng Hành', 'Choose Your Companion'), safe.left + 24, safe.top + 88);
  const x0 = safe.left + 24, width = w - safe.left - safe.right - 48;
  const cols = w < 360 ? 5 : 4, rows = Math.ceil(CATS.length / cols), gap = 8;
  const cw = (width - gap * (cols - 1)) / cols;
  const top = safe.top + 124;
  const ch = Math.min(90, Math.max(56, (h - safe.bottom - top - 210 - gap * (rows - 1)) / rows));
  CATS.forEach((cat, i) => {
    const x = x0 + (i % cols) * (cw + gap), y = top + Math.floor(i / cols) * (ch + gap);
    const unlocked = isCatUnlocked(profile, cat), active = selected === cat.id;
    roundRect(ctx, x, y, cw, ch, 12); ctx.fillStyle = active ? 'rgba(255,201,102,0.12)' : 'rgba(12,16,30,0.9)'; ctx.fill();
    ctx.strokeStyle = active ? 'rgba(255,201,102,0.85)' : 'rgba(255,201,102,0.2)'; ctx.lineWidth = active ? 1.8 : 1; ctx.stroke();
    ctx.save(); ctx.globalAlpha = unlocked ? 1 : 0.4;
    drawCatFace(ctx, cat, x + cw / 2, y + ch * 0.37, Math.min(cw * 0.68, ch * 0.56), { t, blink: blinkAt(t, i * 0.1) });
    ctx.restore();
    const label = unlocked ? trimTo(ctx, localize(cat.name, lang), cw - 6, 9, 700) : String(cat.unlock.embers);
    text(ctx, label, x + cw / 2, y + ch - 9, { size: 9, weight: 700, align: 'center', color: unlocked ? '#f4ecd8' : '#ffb87b' });
    rects.push({ id: 'cat:' + cat.id, x, y, w: cw, h: ch });
  });
  const py = top + rows * ch + (rows - 1) * gap + 16;
  const ph = h - safe.bottom - 20 - py;
  panel(ctx, x0, py, width, ph, { radius: 16 });
  const cat = CAT_BY_ID[selected] || CATS[0], unlocked = isCatUnlocked(profile, cat);
  drawCatFace(ctx, cat, x0 + 45, py + 48, 62, { t, blink: blinkAt(t, 0.5) });
  text(ctx, trimTo(ctx, localize(cat.name, lang), width - 108, 18, 700), x0 + 88, py + 36, { size: 18, weight: 700, color: '#ffe8a8' });
  text(ctx, trimTo(ctx, localize(cat.title, lang), width - 108, 10, 700), x0 + 88, py + 57, { size: 10, weight: 700, color: 'rgba(200,210,232,0.8)' });
  if (ph >= 235) {
    text(ctx, localize(cat.passive.name, lang), x0 + 18, py + 96, { size: 12, weight: 700, color: '#ffe8a8' });
    wrapText(ctx, localize(cat.passive.desc, lang), x0 + 18, py + 115, width - 36, 15, { size: 11, color: 'rgba(200,210,232,0.82)' });
  }
  if (ph >= 310) {
    const stats = [
      [{ vi: 'Máu', en: 'Health' }, cat.base.hp / 170],
      [{ vi: 'Sát thương', en: 'Power' }, cat.base.atk / 1.25],
      [{ vi: 'Tốc độ', en: 'Speed' }, cat.base.move / 1.2],
      [{ vi: 'Chí mạng', en: 'Crit' }, cat.base.crit / 0.18],
    ];
    stats.forEach(([label, value], i) => {
      const sy = py + 168 + i * 20;
      text(ctx, localize(label, lang), x0 + 18, sy + 4, { size: 10, weight: 600, color: 'rgba(154,168,200,0.9)' });
      meter(ctx, x0 + 100, sy - 4, width - 118, 6, clamp(value, 0.06, 1), { color: hexA(cat.color, 0.5), color2: cat.color });
    });
  }
  const actionY = py + ph - 104, bw = (width - 44) / 2;
  if (unlocked) {
    const equipped = selected === profile.loadout.cat;
    rects.push({ id: 'equip', ...button(ctx, { x: x0 + 16, y: actionY + 36, w: bw, h: 44, label: equipped ? tr(lang, 'equipped') : tr(lang, 'equip'), primary: equipped, hover: hover === 'equip', font: '12px' }) });
    rects.push({ id: 'start', ...button(ctx, { x: x0 + 28 + bw, y: actionY + 36, w: bw, h: 44, label: botMode ? tr(lang, 'spectate') : tr(lang, 'start'), hover: hover === 'start', font: '12px' }) });
  } else {
    const canBuy = profile.embers >= cat.unlock.embers;
    rects.push({ id: 'unlock', ...button(ctx, { x: x0 + 16, y: actionY + 36, w: width - 32, h: 44, label: String(cat.unlock.embers), icon: 'ember', primary: canBuy, disabled: !canBuy, hover: hover === 'unlock', font: '14px' }) });
  }
  iconButton(ctx, { x: safe.left + 26, y: safe.top + 26, r: 19, icon: 'back', hover: hover === 'back' });
  rects.push({ id: 'back', x: safe.left + 7, y: safe.top + 7, w: 38, h: 38 });
  return rects;
}

export function wrapText(ctx, str, x, y, maxW, lineH, opts = {}) {
  ctx.save();
  ctx.font = `${opts.weight || 500} ${opts.size || 12}px ${opts.font || FONT.ui}`;
  const words = String(str).split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillStyle = opts.color || UI.text;
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillStyle = opts.color || UI.text;
    ctx.fillText(line, x, yy);
  }
  ctx.restore();
  return yy;
}

function t2(lang, vi, en) { return lang === 'vi' ? vi : en; }

/** Shorten a label to fit `maxW`, with an ellipsis. UI names must never collide. */
export function trimTo(ctx, str, maxW, size = 11, weight = 600, family = FONT.ui) {
  if (measure(ctx, str, size, weight, family) <= maxW) return str;
  let out = str;
  while (out.length > 1 && measure(ctx, out + '…', size, weight, family) > maxW) out = out.slice(0, -1);
  return out + '…';
}

/* ───────────────────────────── skill loadout ───────────────────────────── */

/**
 * Grid geometry for the skill screen. Kept in one place so the click handler's
 * page math can never disagree with what is drawn.
 * @returns {{cols:number, rows:number, perPage:number, pageCount:number, list:Array}}
 */
export function skillGridLayout(pool, w, h, safe) {
  const slotSize = Math.min(78, Math.max(w * 0.075, (Math.min(w - safe.left - safe.right - 96, 420)) / 4 - 10));
  const slotY = safe.top + 140;
  const gridX = safe.left + 34;
  const gridY = slotY + slotSize + 34;
  // The detail rail needs ~320px; a phone has no room for it beside the grid, so
  // the grid takes the full width and drawSkillSelect skips the rail there.
  const narrow = w < 760;
  const gridRight = narrow ? w - safe.right - 20 : w - safe.right - 320;
  const minCardW = narrow ? 92 : 104;
  // Fewer columns on a narrow screen, but never fewer than two or the grid
  // turns into a list with a page per row.
  const cols = Math.max(2, Math.min(7, Math.floor((gridRight - gridX) / minCardW)));
  const cardW = (gridRight - gridX - 12 * (cols - 1)) / cols;
  // Narrow screens stack the pager above a full-width start button, so the grid
  // has to stop higher up or the two overlap.
  const footerRoom = narrow ? 112 : 46;
  const gridBottom = h - safe.bottom - footerRoom;
  const availH = Math.max(48, gridBottom - gridY);
  // Choose the number of rows that keeps cards legible: prefer 2–5 rows of a
  // card no taller than 132px, but shrink the card before dropping to one row.
  const idealRows = Math.max(1, Math.min(5, Math.round(availH / (Math.min(cardW * 1.16, 132) + 12))));
  const rows = Math.max(1, Math.min(5, idealRows));
  const cardH = Math.max(56, Math.min(cardW * 1.16, 132, (availH - 12 * (rows - 1)) / rows));
  const perPage = Math.max(1, cols * rows);
  return { cols, rows, perPage, pageCount: Math.max(1, Math.ceil(pool.length / perPage)), cardW, cardH, gridX, gridY, gridRight, gridBottom, slotSize, slotY };
}

/** How many pages the skill pool needs at this viewport size. */
export function skillPageCount(profile, w, h, safe) {
  return skillGridLayout(skillPoolFor(profile), w, h, safe).pageCount;
}

export function drawSkillSelect(ctx, { w, h, safe, t, lang, profile, hover, selectedSkills, botMode, page = 0 }) {
  drawBackdrop(ctx, w, h, t, PALETTE.lilac, 0.85);
  sceneTitle(ctx, tr(lang, 'skills'), t2(lang, 'Bốn Ô · Bốn Lựa Chọn', 'Four Slots · Four Choices'), safe.left + 30, safe.top + 96);
  const rects = [];

  // slots row (top) — the build at a glance
  // On a phone 7.5% of the width is a 32px chip with an unreadable label; size
  // the four chips off the available row width instead, capped at 78.
  const slotSize = Math.min(78, Math.max(w * 0.075, (Math.min(w - safe.left - safe.right - 96, 420)) / 4 - 10));
  const slotGap = Math.min(14, Math.max(6, slotSize * 0.18));
  const catId = profile.loadout.cat;
  const cat = CAT_BY_ID[catId] || CATS[0];
  const totalW = slotSize * 4 + slotGap * 3;
  const slotX = safe.left + 34;
  const slotY = safe.top + 140;
  for (let i = 0; i < 4; i++) {
    const x = slotX + i * (slotSize + slotGap);
    const id = selectedSkills[i];
    roundRect(ctx, x, slotY, slotSize, slotSize, 14);
    ctx.fillStyle = id ? 'rgba(255,201,102,0.08)' : 'rgba(10,14,26,0.7)';
    ctx.fill();
    ctx.strokeStyle = id ? 'rgba(255,201,102,0.5)' : 'rgba(255,201,102,0.16)';
    ctx.lineWidth = id ? 1.8 : 1.1;
    ctx.stroke();
    if (id) {
      const sk = SKILL_BY_ID[id];
      drawIcon(ctx, sk.icon.glyph, x + slotSize / 2, slotY + slotSize * 0.4, slotSize * 0.36, sk.icon.tint);
      text(ctx, trimTo(ctx, localize(sk.name, lang), slotSize - 8, 8.5, 600), x + slotSize / 2, slotY + slotSize - 9, { size: 8.5, weight: 600, align: 'center', color: 'rgba(244,236,216,0.82)' });
    } else {
      ctx.save();
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.arc(x + slotSize / 2, slotY + slotSize / 2, slotSize * 0.22, 0, TAU);
      ctx.strokeStyle = 'rgba(154,168,200,0.3)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();
    }
    rects.push({ id: 'slot:' + i, x, y: slotY, w: slotSize, h: slotSize });
  }
  // active cat reminder
  if (slotX + totalW + 74 <= w - safe.right) drawCatFace(ctx, cat, slotX + totalW + 52, slotY + slotSize / 2, 44, { t, blink: blinkAt(t, 0.6) });

  // Skill grid. The pool is 52 skills; only a page's worth fits on screen, and
  // silently dropping the rest made 38 skills impossible to equip. The grid is
  // sized to the tallest card that still fits BETWEEN the slots row and the
  // footer, then split into pages with cycle buttons underneath.
  const list = skillPoolFor(profile);
  const layout = skillGridLayout(list, w, h, safe);
  const { gridX, gridY, gridRight, gridBottom, cols, cardW, cardH, perPage, pageCount } = layout;
  const pageIndex = Math.min(pageCount - 1, Math.max(0, Math.floor(page)));
  const start = pageIndex * perPage;
  const visible = list.slice(start, start + perPage);
  visible.forEach((sk, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = gridX + col * (cardW + 12);
    const y = gridY + row * (cardH + 12);
    const equipped = selectedSkills.includes(sk.id);
    const locked = !isSkillUnlocked(profile, sk);
    const isHover = hover === 'skill:' + sk.id;
    roundRect(ctx, x, y, cardW, cardH, 12);
    ctx.fillStyle = equipped ? hexA(sk.icon.tint, 0.14) : 'rgba(12,16,30,0.82)';
    ctx.fill();
    ctx.strokeStyle = equipped ? hexA(sk.icon.tint, 0.85) : isHover ? 'rgba(255,255,255,0.22)' : 'rgba(255,201,102,0.12)';
    ctx.lineWidth = equipped ? 1.8 : 1;
    ctx.stroke();
    ctx.save();
    ctx.globalAlpha = locked ? 0.3 : 1;
    drawIcon(ctx, sk.icon.glyph, x + cardW / 2, y + cardH * 0.36, cardW * 0.36, sk.icon.tint);
    ctx.restore();
    text(ctx, localize(sk.name, lang), x + cardW / 2, y + cardH - 10 - Math.max(0, measure(ctx, localize(sk.name, lang), 10, 700) - (cardW - 14)) * 0.42, { size: 10, weight: 700, align: 'center', color: locked ? 'rgba(244,236,216,0.38)' : '#f4ece0' });
    // cooldown / energy cost as bare numerals in the corners
    if (!locked) {
      const cd = sk.cd >= 1 ? sk.cd.toFixed(sk.cd % 1 ? 1 : 0) : sk.cd.toFixed(2);
      text(ctx, cd, x + 7, y + 14, { size: 9, weight: 700, color: 'rgba(154,168,200,0.72)' });
      if (sk.cost > 0) text(ctx, String(sk.cost), x + cardW - 7, y + 14, { size: 9, weight: 700, color: 'rgba(164,139,255,0.8)', align: 'right' });
    } else {
      drawIcon(ctx, 'ember', x + cardW / 2 - 10, y + cardH * 0.62, 10, 'rgba(255,157,92,0.75)');
      text(ctx, String(sk.unlockEmbers || ''), x + cardW / 2 + 2, y + cardH * 0.62 + 3.5, { size: 10, weight: 700, align: 'left', color: 'rgba(255,160,100,0.85)' });
    }
    rects.push({ id: 'skill:' + sk.id, x, y, w: cardW, h: cardH });
  });

  // pager — only rendered when the pool genuinely overflows one page
  if (pageCount > 1) {
    const by = gridBottom + 8;
    // (gridBottom already reserves the start button on narrow screens)
    const countW = 74;
    const prevW = 40;
    const nextW = 40;
    const totalPagerW = prevW + 8 + countW + 8 + nextW;
    const px = gridX + (gridRight - gridX - totalPagerW) / 2;
    const canPrev = pageIndex > 0;
    const canNext = pageIndex < pageCount - 1;
    const arrow = (ax, dir, enabled, id) => {
      roundRect(ctx, ax, by, prevW, 26, 8);
      ctx.fillStyle = enabled ? 'rgba(255,201,102,0.10)' : 'rgba(255,255,255,0.03)';
      ctx.fill();
      ctx.strokeStyle = enabled ? 'rgba(255,201,102,0.35)' : 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      ctx.stroke();
      const cx = ax + prevW / 2;
      const cy = by + 13;
      // `dir` is the way the arrow points: the tip sits at cx + dir * 3.5.
      ctx.beginPath();
      ctx.moveTo(cx - dir * 3.5, cy - 5);
      ctx.lineTo(cx + dir * 3.5, cy);
      ctx.lineTo(cx - dir * 3.5, cy + 5);
      ctx.strokeStyle = enabled ? '#ffd694' : 'rgba(154,168,200,0.32)';
      ctx.lineWidth = 1.7;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      if (enabled) rects.push({ id, x: ax, y: by, w: prevW, h: 26 });
    };
    arrow(px, -1, canPrev, 'skills:prev');
    text(ctx, t2(lang, `Trang ${pageIndex + 1}/${pageCount}`, `${pageIndex + 1} / ${pageCount}`), px + prevW + 8 + countW / 2, by + 17, { size: 10.5, weight: 600, align: 'center', color: 'rgba(214,222,240,0.72)' });
    arrow(px + prevW + 8 + countW + 8, 1, canNext, 'skills:next');
  } else {
    text(ctx, t2(lang, `${list.length} kỹ năng`, `${list.length} skills`), gridX + (gridRight - gridX) / 2, gridBottom + 24, { size: 10, weight: 500, align: 'center', color: 'rgba(154,168,200,0.5)' });
  }

  // Right rail: skill detail. Skipped on narrow screens, where the grid uses
  // the full width and a hover/first-equipped detail would overlap it.
  const showRail = w >= 760;
  const eq = selectedSkills.filter(Boolean);
  if (showRail) {
    // right rail: selected skill detail or equipped summary
    const railW = Math.min(300, w * 0.26);
    const railX = w - safe.right - railW - 26;
    const railH = h - safe.top - safe.bottom - 240;
    panel(ctx, railX, safe.top + 140, railW, railH, { radius: 16 });
    const detail = hover && String(hover).startsWith('skill:') ? SKILL_BY_ID[String(hover).slice(6)] : SKILL_BY_ID[eq[0]];
    if (detail) {
      const top = safe.top + 140;
      heading(ctx, localize(SKILL_CATEGORIES[detail.category], lang), railX + 20, top + 34, railW - 40);
      // icon in a ring beside the name, not floating alone
      ctx.beginPath();
      ctx.arc(railX + 48, top + 86, 24, 0, TAU);
      ctx.fillStyle = 'rgba(8,11,22,0.8)';
      ctx.fill();
      ctx.strokeStyle = hexA(detail.icon.tint, 0.5);
      ctx.lineWidth = 1.4;
      ctx.stroke();
      drawIcon(ctx, detail.icon.glyph, railX + 48, top + 86, 26, detail.icon.tint);
      sceneTitle(ctx, localize(detail.name, lang), '', railX + 84, top + 82, { size: 17, track: 0.1 });
      // cooldown / cost / range as three bare numerals with glyphs
      const chips = [
        { icon: 'clock', value: detail.cd >= 10 ? Math.round(detail.cd) : Number(detail.cd.toFixed(2)), x: railX + 84 },
        { icon: 'sigil', value: detail.cost, x: railX + 130 },
        { icon: 'target', value: Math.round(detail.range), x: railX + 170 },
      ];
      chips.forEach((c) => {
        drawIcon(ctx, c.icon, c.x, top + 100, 10, 'rgba(154,168,200,0.8)');
        text(ctx, String(c.value), c.x + 9, top + 103.5, { size: 10, weight: 600, color: 'rgba(200,210,232,0.85)' });
      });
      wrapText(ctx, localize(detail.desc, lang), railX + 20, top + 138, railW - 40, 15, { size: 11.5, color: 'rgba(200,210,232,0.8)' });

      const scaleName = { health: t2(lang, 'Máu', 'Health'), speed: t2(lang, 'Tốc độ', 'Speed'), armor: t2(lang, 'Giáp', 'Armor'), damage: t2(lang, 'Sát thương', 'Damage') }[skillScaling(detail)];
      text(ctx, `Scale: ${scaleName}`, railX + 20, top + 164, { size: 10, color: 'rgba(255,201,102,0.85)' });

      // rank ladder — the four upgrades above rank 1. `ranks[0].note` is the base
      // description, already covered by `desc`, so it is not repeated here.
      const ranks = (detail.ranks || []).slice(1);
      const rowH = 30;
      const ladderTop = top + 182;
      divider(ctx, railX + 18, ladderTop - 20, railW - 36);
      ranks.forEach((r, i) => {
        const ry = ladderTop + i * rowH;
        // rank numeral, then the concrete change
        text(ctx, String(i + 2), railX + 24, ry + 4, { size: 9.5, weight: 700, align: 'center', color: hexA(detail.icon.tint, 0.75) });
        text(ctx, trimTo(ctx, L(r.note, lang) || '—', railW - 62, 10.5, 500), railX + 38, ry + 4, { size: 10.5, color: 'rgba(214,222,240,0.82)' });
        // a hairline between rows keeps the ladder readable
        if (i < ranks.length - 1) divider(ctx, railX + 38, ry + 13, railW - 60, 'rgba(255,255,255,0.05)');
      });
      // branch fork, when the skill has one, is the reason rank 3 matters
      if (detail.branch) {
        const by2 = ladderTop + ranks.length * rowH + 6;
        text(ctx, t2(lang, 'RẼ HƯỚNG', 'FORK'), railX + 24, by2, { size: 9, weight: 700, color: 'rgba(255,201,102,0.7)' });
        detail.branch.options.forEach((o, i) => {
          const oy = by2 + 18 + i * 18;
          text(ctx, trimTo(ctx, `${L(o.name, lang)} · ${L(o.note, lang)}`, railW - 48, 10, 500), railX + 24, oy, { size: 10, color: 'rgba(200,210,232,0.72)' });
        });
      }
    }
  }
  // footer actions — pinned to the rail on wide screens, full width on phones
  const actY = h - safe.bottom - 66;
  const actW = showRail ? Math.min(300, w * 0.26) : Math.min(420, w - safe.left - safe.right - 40);
  const actX = showRail ? w - safe.right - actW - 26 : (w - actW) / 2;
  const hasFour = selectedSkills.filter(Boolean).length === 4;
  const saveR = button(ctx, { x: actX, y: actY, w: actW, h: 46, label: tr(lang, 'start'), icon: botMode ? 'spirit' : 'pounce', primary: hasFour, disabled: !hasFour, hover: hover === 'fight', font: '15px' });
  rects.push({ id: 'fight', ...saveR });
  iconButton(ctx, { x: safe.left + 26, y: safe.top + 26, r: 19, icon: 'back', hover: hover === 'back' });
  rects.push({ id: 'back', x: safe.left + 7, y: safe.top + 7, w: 38, h: 38 });
  return rects;
}

/** Starter skills plus anything unlocked; locked entries are shown greyed with a price. */
export function skillPoolFor(profile) {
  return SKILLS.map((sk) => {
    const state = profile.skills?.[sk.id];
    const starter = !!sk.starter;
    const unlocked = starter || !!state?.unlocked;
    return { ...sk, unlockEmbers: unlocked ? 0 : emberCost(sk), locked: !unlocked };
  });
}

export function isSkillUnlocked(profile, sk) {
  return !!sk.starter || !!profile.skills?.[sk.id]?.unlocked;
}
export function emberCost(sk) {
  return { common: 60, rare: 110, epic: 190, mythic: 300 }[sk.rarity] || 80;
}
export function isCatUnlocked(profile, cat) {
  if (cat.unlock.free) return true;
  return !!profile.cats?.[cat.id]?.unlocked;
}

/* ───────────────────────────── upgrades ───────────────────────────── */
export function drawUpgrades(ctx, { w, h, safe, t, lang, profile, hover }) {
  drawBackdrop(ctx, w, h, t, PALETTE.gold, 0.9);
  sceneTitle(ctx, tr(lang, 'upgrades'), t2(lang, 'Chín Nhánh Tro Than', 'Nine Arms of Ember'), safe.left + 30, safe.top + 96);
  const rects = [];
  const cx = safe.left + 34;
  const cy = safe.top + 150;
  const rowH = Math.min(72, (h - safe.top - safe.bottom - 210) / PERK_LINES.length);
  const colW = Math.min(640, w - safe.left - safe.right - 340);
  PERK_LINES.forEach((line, i) => {
    const y = cy + i * rowH;
    const tiers = profile.upgrades[line.id] || 0;
    const isHover = hover === 'perk:' + line.id;
    const maxed = tiers >= PERK_TIERS;
    const cost = PERK_COST[Math.min(PERK_TIERS - 1, tiers)];
    const affordable = !maxed && profile.embers >= cost;
    roundRect(ctx, cx, y, colW, rowH - 8, 12);
    ctx.fillStyle = isHover ? 'rgba(255,255,255,0.055)' : 'rgba(12,16,30,0.72)';
    ctx.fill();
    ctx.strokeStyle = maxed ? hexA(line.color, 0.4) : isHover ? 'rgba(255,201,102,0.35)' : 'rgba(255,201,102,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();
    drawIcon(ctx, line.icon, cx + 28, y + (rowH - 8) / 2, 22, maxed ? line.color : tiers > 0 ? line.color : 'rgba(200,210,232,0.5)');
    // name, then what a tier actually buys (this label was dropped entirely and
    // left the row as a bare name + price)
    text(ctx, localize(line.name, lang), cx + 52, y + (rowH - 8) / 2 - 3, { size: 14, weight: 700, color: '#f4ece0' });
    text(ctx, localize(line.label, lang), cx + 52, y + (rowH - 8) / 2 + 14, { size: 10.5, weight: 500, color: maxed ? hexA(line.color, 0.75) : 'rgba(154,168,200,0.85)' });
    // tier pips, right-aligned before the price block
    const pipsRight = colW - 108;
    for (let k = 0; k < PERK_TIERS; k++) {
      const px = cx + pipsRight - (PERK_TIERS - 1 - k) * 22;
      const py = y + (rowH - 8) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, TAU);
      ctx.fillStyle = k < tiers ? line.color : 'rgba(255,255,255,0.06)';
      ctx.fill();
      ctx.strokeStyle = k < tiers ? hexA(line.color, 0.9) : 'rgba(255,201,102,0.18)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    }
    // price / max
    if (maxed) {
      text(ctx, tr(lang, 'maxed'), cx + colW - 22, y + (rowH - 8) / 2 + 4, { size: 10.5, weight: 700, color: hexA(line.color, 0.9), align: 'right' });
    } else {
      drawIcon(ctx, 'ember', cx + colW - 62, y + (rowH - 8) / 2, 12, affordable ? '#ff9d5c' : 'rgba(255,157,92,0.4)');
      text(ctx, String(cost), cx + colW - 50, y + (rowH - 8) / 2 + 5, { size: 13, weight: 700, color: affordable ? '#ffd0a8' : 'rgba(255,208,168,0.4)' });
    }
    rects.push({ id: 'perk:' + line.id, x: cx, y, w: colW, h: rowH - 8 });
  });

  // right rail: embers + achievements
  const railW = Math.min(300, w * 0.26);
  const railX = w - safe.right - railW - 26;
  panel(ctx, railX, safe.top + 150, railW, h - safe.top - safe.bottom - 240, { radius: 16 });
  drawIcon(ctx, 'ember', railX + 34, safe.top + 190, 24, '#ffb066', { glow: 'rgba(255,150,80,0.5)' });
  text(ctx, String(profile.embers), railX + 58, safe.top + 198, { size: 24, weight: 700, color: '#ffe8c8', font: FONT.display });
  heading(ctx, tr(lang, 'collection'), railX + 20, safe.top + 236, railW - 40);
  ACHIEVEMENTS.slice(0, 6).forEach((a, i) => {
    const done = !!profile.achievements[a.id];
    const ay = safe.top + 258 + i * 26;
    ctx.beginPath();
    ctx.arc(railX + 26, ay - 4, 4, 0, TAU);
    ctx.fillStyle = done ? '#ffe8a8' : 'rgba(255,255,255,0.1)';
    ctx.fill();
    text(ctx, localize(a.name, lang), railX + 40, ay, { size: 11.5, weight: 600, color: done ? '#f4ece0' : 'rgba(244,236,224,0.45)' });
  });
  iconButton(ctx, { x: safe.left + 26, y: safe.top + 26, r: 19, icon: 'back', hover: hover === 'back' });
  rects.push({ id: 'back', x: safe.left + 7, y: safe.top + 7, w: 38, h: 38 });
  return rects;
}

/* ───────────────────────────── collection ───────────────────────────── */
export function drawCollection(ctx, { w, h, safe, t, lang, profile, hover }) {
  drawBackdrop(ctx, w, h, t, PALETTE.jade, 0.85);
  sceneTitle(ctx, tr(lang, 'collection'), t2(lang, 'Những Gì Đã Giữ Lại', 'What Was Kept'), safe.left + 30, safe.top + 96);
  const rects = [];
  const catCount = CATS.filter((c) => isCatUnlocked(profile, c)).length;
  const skillCount = SKILLS.filter((s) => isSkillUnlocked(profile, s)).length;
  const achCount = ACHIEVEMENTS.filter((a) => profile.achievements[a.id]).length;

  const cards = [
    { label: { vi: 'Mèo', en: 'Cats' }, value: `${catCount}/${CATS.length}`, icon: 'paw', color: PALETTE.ember },
    { label: { vi: 'Kỹ Năng', en: 'Skills' }, value: `${skillCount}/${SKILLS.length}`, icon: 'sigil', color: PALETTE.lilac },
    { label: { vi: 'Thành Tựu', en: 'Feats' }, value: `${achCount}/${ACHIEVEMENTS.length}`, icon: 'star', color: PALETTE.jade },
  ];
  const cw = Math.min(220, (w - safe.left - safe.right - 90) / 3);
  cards.forEach((c, i) => {
    const x = safe.left + 34 + i * (cw + 16);
    const y = safe.top + 140;
    panel(ctx, x, y, cw, 92, { radius: 14 });
    drawIcon(ctx, c.icon, x + 34, y + 46, 26, c.color);
    text(ctx, c.value, x + 60, y + 52, { size: 24, weight: 700, color: '#f4ece0', font: FONT.display });
    text(ctx, localize(c.label, lang), x + 60, y + 74, { size: 10.5, weight: 600, color: 'rgba(154,168,200,0.8)' });
  });

  // record list
  const sx = safe.left + 34;
  const sy = safe.top + 268;
  const stats = [
    { label: { vi: 'Đêm sâu nhất', en: 'Deepest night' }, value: profile.stats.bestDepth || 0 },
    { label: { vi: 'Hạ gục', en: 'Defeated' }, value: profile.stats.kills || 0 },
    { label: { vi: 'Tinh anh', en: 'Elites' }, value: profile.stats.elites || 0 },
    { label: { vi: 'Chủ nhân', en: 'Bosses' }, value: profile.stats.bosses || 0 },
    { label: { vi: 'Lượt chơi', en: 'Runs' }, value: profile.stats.runs || 0 },
    { label: { vi: 'Bình minh', en: 'Daybreaks' }, value: profile.stats.wins || 0 },
  ];
  const colW = (w - safe.left - safe.right - 340) / 2;
  stats.forEach((s, i) => {
    const x = sx + (i % 2) * colW;
    const y = sy + Math.floor(i / 2) * 38;
    text(ctx, localize(s.label, lang), x, y, { size: 12, weight: 500, color: 'rgba(154,168,200,0.9)' });
    text(ctx, String(s.value), x + colW - 30, y, { size: 15, weight: 700, color: '#f4ece0', align: 'right' });
    divider(ctx, x, y + 12, colW - 30);
  });

  // feats rail
  const railW = Math.min(320, w * 0.28);
  const railX = w - safe.right - railW - 26;
  panel(ctx, railX, safe.top + 140, railW, h - safe.top - safe.bottom - 230, { radius: 16 });
  // Not tr(lang, 'collection') — that repeated the page's own title.
  heading(ctx, tr(lang, 'achievements'), railX + 20, safe.top + 172, railW - 40);
  ACHIEVEMENTS.forEach((a, i) => {
    const done = !!profile.achievements[a.id];
    const y = safe.top + 200 + i * 34;
    if (y > h - safe.bottom - 110) return;
    ctx.beginPath();
    ctx.arc(railX + 28, y - 4, 6, 0, TAU);
    ctx.fillStyle = done ? PALETTE.gold : 'rgba(255,255,255,0.06)';
    ctx.fill();
    ctx.strokeStyle = done ? 'rgba(255,232,168,0.9)' : 'rgba(255,201,102,0.2)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    text(ctx, localize(a.name, lang), railX + 44, y, { size: 12, weight: 700, color: done ? '#f4ece0' : 'rgba(244,236,224,0.4)' });
    wrapText(ctx, localize(a.desc, lang), railX + 44, y + 14, railW - 70, 13, { size: 10, color: done ? 'rgba(200,210,232,0.7)' : 'rgba(200,210,232,0.3)' });
  });
  iconButton(ctx, { x: safe.left + 26, y: safe.top + 26, r: 19, icon: 'back', hover: hover === 'back' });
  rects.push({ id: 'back', x: safe.left + 7, y: safe.top + 7, w: 38, h: 38 });
  return rects;
}

/* ───────────────────────────── settings ───────────────────────────── */
export function drawSettings(ctx, { w, h, safe, t, lang, profile, hover, confirmReset }) {
  drawBackdrop(ctx, w, h, t, PALETTE.slate, 0.8);
  // The title block is scaled to the viewport: a 96px offset is fine on a 720px
  // desktop window and eats 27% of a 360px-tall landscape phone, which pushed
  // the last settings row off the bottom.
  // On short screens the title drops its subtitle and shrinks, and sits BELOW the
  // back button instead of through it.
  const shortScreen = h < 480;
  const titleY = shortScreen ? safe.top + 78 : safe.top + clamp(h * 0.13, 60, 96);
  sceneTitle(ctx, tr(lang, 'settings'), '', safe.left + 30, titleY, { size: shortScreen ? 26 : 40 });
  const rects = [];
  const sx = safe.left + 34;
  // Seven taps on the title opens the hidden scaling controls.
  rects.push({ id: 'secretScale', x: safe.left + 46, y: titleY - 30, w: Math.min(208, w - safe.left - 66), h: 38 });

  // ── layout, derived from the space that actually exists.
  //
  // This screen holds 16 rows plus the reset button. The original fixed 40px
  // pitch ran to y=646 on a 412px-tall landscape phone: every control below
  // "aim assist" hung off the bottom of the screen — invisible AND unhittable,
  // which a desktop-sized screenshot could never reveal. Instead of hiding
  // settings or shrinking them into unreadable slivers, the column count and the
  // row pitch are both derived from the available box.
  //
  //   · one column while a legible 30px pitch fits;
  //   · otherwise two columns, halving the rows each must carry;
  //   · controls are sized to the column so a button can never push past the
  //     right edge (the HUD mode trio overflowed a 270px column before).
  const railWidth = Math.min(320, w * 0.27);
  const hasRail = w >= 900 && railWidth > 240;
  const contentRight = hasRail ? w - safe.right - railWidth - 52 : w - safe.right - 30;
  const contentW = Math.max(220, contentRight - sx);
  const top0 = titleY + (shortScreen ? 26 : clamp(h * 0.075, 34, 54));
  const bottomLimit = h - Math.max(14, safe.bottom + 12);

  const TOTAL_ROWS = 17; // 16 settings + reset
  const singlePitch = (bottomLimit - top0) / TOTAL_ROWS;
  const cols = singlePitch >= 30 ? 1 : (contentW >= 470 ? 2 : 1);
  const rowsPerCol = Math.ceil(TOTAL_ROWS / cols);
  const colGap = cols > 1 ? 22 : 0;
  const colW = (contentW - colGap * (cols - 1)) / cols;
  const rowH = clamp((bottomLimit - top0) / rowsPerCol, 28, 40);
  const compact = rowH < 34;
  // Hit areas are at most one row tall: overlapping targets made neighbouring
  // toggles steal each other's taps on short landscape phones.
  const hitH = Math.min(28, rowH);

  const labelSize = compact ? 11 : 12.5;
  const labelW = compact ? 104 : 130;
  const ctlW = Math.max(90, colW - labelW - 16);

  let col = 0;
  let row = 0;
  let sy = top0 + rowH * 0.5;
  const colX = () => sx + col * (colW + colGap);

  /** Move to the next cell, wrapping into the next column. */
  const advance = () => {
    row++;
    if (row >= rowsPerCol && col < cols - 1) { col++; row = 0; }
    sy = top0 + rowH * (row + 0.5);
  };
  const rowLabel = (label) => text(ctx, label, colX(), sy + 4, { size: labelSize, weight: 600, color: 'rgba(230,224,208,0.9)' });
  const rowCtlX = (off = 0) => colX() + labelW + off;

  const slider = (id, label, value) => {
    const isHover = hover === id;
    const bx = rowCtlX();
    const bw = ctlW;
    rowLabel(label);
    roundRect(ctx, bx, sy - 4, bw, 8, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fill();
    roundRect(ctx, bx, sy - 4, Math.max(8, bw * value), 8, 4);
    ctx.fillStyle = isHover ? '#ffe8a8' : 'rgba(255,201,102,0.8)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx + bw * value, sy, 7, 0, TAU);
    ctx.fillStyle = '#f4ecd8';
    ctx.fill();
    // The whole row is the hit area: a 7px slider handle is not a thumb target.
    // Height derives from the row pitch so adjacent rows can never overlap.
    rects.push({ id, x: colX(), y: sy - hitH / 2, w: labelW + bw, h: hitH, slider: true });
    advance();
  };

  slider('music', tr(lang, 'music'), profile.settings.music);
  slider('sfx', tr(lang, 'sfx'), profile.settings.sfx);
  slider('voice', tr(lang, 'voice'), profile.settings.voice);
  slider('shake', tr(lang, 'shake'), profile.settings.shake);
  const viewDistance = profile.settings.viewDistance ?? 1.5;
  slider('viewDistance', `${tr(lang, 'viewDistance')} ${Math.round(viewDistance * 100)}%`, viewDistance - 1);

  const toggle = (id, label, on) => {
    const bx = rowCtlX();
    const isHover = hover === id;
    const th = compact ? 22 : 24;
    rowLabel(label);
    roundRect(ctx, bx, sy - th / 2, 46, th, th / 2);
    ctx.fillStyle = on ? 'rgba(124,224,176,0.28)' : 'rgba(255,255,255,0.07)';
    ctx.fill();
    ctx.strokeStyle = on ? 'rgba(124,224,176,0.8)' : 'rgba(255,201,102,0.2)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(bx + (on ? 34 : 12), sy, 8, 0, TAU);
    ctx.fillStyle = isHover ? '#ffe8a8' : '#f4ecd8';
    ctx.fill();
    rects.push({ id, x: colX(), y: sy - hitH / 2, w: labelW + 60, h: hitH });
    advance();
  };
  toggle('damageNumbers', tr(lang, 'damageNumbers'), profile.settings.damageNumbers);
  toggle('reduceMotion', tr(lang, 'reduceMotion'), profile.settings.reduceMotion);
  toggle('aimAssist', tr(lang, 'aimAssist'), profile.settings.aimAssist);
  toggle('qualityLow', t2(lang, 'Hiệu năng cao', 'High performance'), profile.settings.quality === 'low');

  // ── touch HUD: mode trio, sized to the column
  const hudModes = [['compact', 'hudCompact'], ['standard', 'hudStandard'], ['large', 'hudLarge']];
  rowLabel(tr(lang, 'hud'));
  {
    const pw = Math.min(66, (ctlW - 12) / 3);
    hudModes.forEach(([mode, key], i) => {
      const bx = rowCtlX(i * (pw + 5));
      const on = (profile.settings.hudMode || 'standard') === mode;
      roundRect(ctx, bx, sy - 13, pw, 26, 13);
      ctx.fillStyle = on ? 'rgba(255,201,102,0.18)' : 'rgba(255,255,255,0.05)';
      ctx.fill();
      ctx.strokeStyle = on ? 'rgba(255,201,102,0.7)' : 'rgba(255,201,102,0.16)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      text(ctx, tr(lang, key), bx + pw / 2, sy + 5, { size: pw < 54 ? 9 : 10.5, weight: 700, align: 'center', color: on ? '#ffe8a8' : 'rgba(200,210,232,0.7)' });
      rects.push({ id: 'hud:' + mode, x: bx, y: sy - 13, w: pw, h: 26 });
    });
  }
  advance();

  // ── button size: a -/+ stepper works with a thumb and a mouse
  rowLabel(tr(lang, 'hudScale'));
  {
    const scaleVal = typeof profile.settings.hudScale === 'number' ? profile.settings.hudScale : 1;
    const minusR = { x: rowCtlX(), y: sy - 13, w: 28, h: 26 };
    const plusR = { x: rowCtlX(Math.min(134, ctlW - 28)), y: sy - 13, w: 28, h: 26 };
    const stepBtn = (r, label, id, disabled) => {
      roundRect(ctx, r.x, r.y, r.w, r.h, 8);
      ctx.fillStyle = disabled ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.07)';
      ctx.fill();
      ctx.strokeStyle = disabled ? 'rgba(255,201,102,0.08)' : 'rgba(255,201,102,0.3)';
      ctx.lineWidth = 1.1;
      ctx.stroke();
      text(ctx, label, r.x + r.w / 2, r.y + r.h / 2 + 5, { size: 15, weight: 700, align: 'center', color: disabled ? 'rgba(200,210,232,0.28)' : '#ffe8a8' });
      if (!disabled) rects.push({ id, x: r.x, y: r.y, w: r.w, h: r.h });
    };
    stepBtn(minusR, '-', 'hudScaleDown', scaleVal <= 0.71);
    stepBtn(plusR, '+', 'hudScaleUp', scaleVal >= 1.39);
    const trackX = minusR.x + 34;
    const trackW = plusR.x - trackX - 8;
    if (trackW > 14) {
      roundRect(ctx, trackX, sy - 4, trackW, 8, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fill();
      const frac = (scaleVal - 0.7) / 0.7;
      roundRect(ctx, trackX, sy - 4, Math.max(8, trackW * clamp(frac, 0, 1)), 8, 4);
      ctx.fillStyle = 'rgba(255,201,102,0.8)';
      ctx.fill();
      if (!compact) text(ctx, `${Math.round(scaleVal * 100)}%`, trackX + trackW / 2, sy - 11, { size: 9.5, weight: 600, align: 'center', color: 'rgba(200,210,232,0.6)' });
    }
  }
  advance();

  // ── handedness
  rowLabel(tr(lang, 'leftHanded'));
  {
    const bx = rowCtlX();
    const on = !!profile.settings.leftHanded;
    roundRect(ctx, bx, sy - 13, 58, 26, 13);
    ctx.fillStyle = on ? 'rgba(120,220,180,0.2)' : 'rgba(255,255,255,0.05)';
    ctx.fill();
    ctx.strokeStyle = on ? 'rgba(140,230,200,0.7)' : 'rgba(255,201,102,0.16)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(bx + (on ? 44 : 14), sy, 7, 0, TAU);
    ctx.fillStyle = '#f4ecd8';
    ctx.fill();
    rects.push({ id: 'leftHanded', x: bx, y: sy - 13, w: 58, h: 26 });
  }
  advance();

  // ── language
  rowLabel(tr(lang, 'language'));
  ['vi', 'en'].forEach((code, i) => {
    const bw = compact ? 42 : 52;
    const bx = rowCtlX(i * (bw + 6));
    const on = profile.settings.lang === code;
    roundRect(ctx, bx, sy - 13, bw, 26, 13);
    ctx.fillStyle = on ? 'rgba(255,201,102,0.18)' : 'rgba(255,255,255,0.05)';
    ctx.fill();
    ctx.strokeStyle = on ? 'rgba(255,201,102,0.7)' : 'rgba(255,201,102,0.16)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    text(ctx, code.toUpperCase(), bx + bw / 2, sy + 5, { size: 11.5, weight: 700, align: 'center', color: on ? '#ffe8a8' : 'rgba(200,210,232,0.7)' });
    rects.push({ id: 'lang:' + code, x: bx, y: sy - 13, w: bw, h: 26 });
  });
  advance();

  // ── danger zone: the last cell of the grid, never floating off screen
  const danger = button(ctx, {
    x: colX(), y: clamp(sy - rowH * 0.5 + 6, top0, bottomLimit - 40),
    w: Math.min(190, colW), h: 34,
    label: tr(lang, 'resetSave'), danger: true, hover: hover === 'reset', font: '12px',
  });
  rects.push({ id: 'reset', ...danger });

  // Right rail: what the settings screen was leaving as dead space. It carries
  // the two things a player actually wants here — where they stand, and how to
  // play — plus a confirmation for the destructive button.
  const railW = Math.min(320, w * 0.27);
  if (w >= 900 && railW > 240) {
    const railX = w - safe.right - railW - 26;
    const railY = safe.top + 140;
    const railH = h - safe.top - safe.bottom - 200;
    panel(ctx, railX, railY, railW, railH, { radius: 16 });

    const st = profile.stats || {};
    heading(ctx, t2(lang, 'Hồ Sơ', 'Profile'), railX + 20, railY + 34, railW - 40);
    const rows = [
      [t2(lang, 'Lượt chơi', 'Runs'), st.runs || 0],
      [t2(lang, 'Đêm sâu nhất', 'Best night'), `${st.bestDepth || 0}/45`],
      [t2(lang, 'Hạ gục', 'Kills'), st.kills || 0],
      [t2(lang, 'Tro than', 'Embers'), profile.embers || 0],
    ];
    rows.forEach(([label, value], i) => {
      const ry = railY + 62 + i * 26;
      text(ctx, label, railX + 20, ry, { size: 11, color: 'rgba(200,210,232,0.72)' });
      text(ctx, String(value), railX + railW - 20, ry, { size: 12, weight: 700, align: 'right', color: '#ffe8c8' });
    });

    divider(ctx, railX + 18, railY + 176, railW - 36);
    heading(ctx, t2(lang, 'Điều Khiển', 'Controls'), railX + 20, railY + 202, railW - 40);
    const keys = [
      // Keep this short: the action column is right-aligned at 10.5px.
      ['WASD', t2(lang, 'Di chuyển', 'Move')],
      ['Space', t2(lang, 'Lướt né', 'Dash')],
      ['1 2 3 4', t2(lang, 'Bốn kỹ năng', 'Four skills')],
      ['Esc', t2(lang, 'Tạm dừng', 'Pause')],
    ];
    keys.forEach(([key, action], i) => {
      const ky = railY + 230 + i * 22;
      text(ctx, key, railX + 20, ky, { size: 10.5, weight: 700, color: 'rgba(255,201,102,0.85)' });
      text(ctx, action, railX + railW - 20, ky, { size: 10.5, align: 'right', color: 'rgba(200,210,232,0.7)' });
    });

    // Armed-reset warning. The reset button already uses a 2.5 s arm/confirm
    // (game.js `resetArmed`); this is just the copy that explains it.
    if (confirmReset) {
      const cy2 = railY + railH - 58;
      wrapText(ctx, t2(lang, 'Bấm lần nữa để xóa toàn bộ tiến trình.', 'Press again to erase all progress.'), railX + 20, cy2, railW - 40, 15, { size: 11, color: '#ffb0a8' });
    }
  }

  iconButton(ctx, { x: safe.left + 26, y: safe.top + 26, r: 19, icon: 'back', hover: hover === 'back' });
  rects.push({ id: 'back', x: safe.left + 7, y: safe.top + 7, w: 38, h: 38 });
  return rects;
}

/** Secret tuning screen: 0–300% for each stat family. */
export function drawSkillScaling(ctx, { w, h, safe, t, lang, profile, hover }) {
  drawBackdrop(ctx, w, h, t, PALETTE.slate, 0.8);
  const top = safe.top + (h < 480 ? 68 : 94);
  sceneTitle(ctx, t2(lang, 'TỈ LỆ KỸ NĂNG', 'SKILL SCALING'), '', safe.left + 30, top, { size: h < 480 ? 22 : 34 });
  const rects = [];
  const rows = [
    ['skillScaleHealth', t2(lang, 'Máu', 'Health')],
    ['skillScaleSpeed', t2(lang, 'Tốc độ', 'Speed')],
    ['skillScaleArmor', t2(lang, 'Giáp', 'Armor')],
    ['skillScaleDamage', t2(lang, 'Sát thương', 'Damage')],
  ];
  const x = safe.left + 34, width = Math.min(520, w - safe.left - safe.right - 68);
  const pitch = Math.min(54, (h - safe.bottom - top - 90) / 4);
  rows.forEach(([id, label], i) => {
    const y = top + 35 + i * pitch, value = profile.settings[id] ?? 1;
    text(ctx, `${label} ${Math.round(value * 100)}%`, x, y + 4, { size: 12, weight: 600, color: '#f4ecd8' });
    const bx = x + Math.min(145, width * 0.4), bw = width - (bx - x);
    roundRect(ctx, bx, y - 4, bw, 8, 4); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill();
    roundRect(ctx, bx, y - 4, Math.max(1, bw * value / 3), 8, 4); ctx.fillStyle = '#ffc966'; ctx.fill();
    ctx.beginPath(); ctx.arc(bx + bw * value / 3, y, 7, 0, TAU); ctx.fillStyle = '#f4ecd8'; ctx.fill();
    rects.push({ id, x: bx, y: y - 14, w: bw, h: 28, slider: true });
  });
  const grant = button(ctx, { x, y: h - safe.bottom - 48, w: Math.min(width, 220), h: 34, label: t2(lang, '+1.000 tro than', '+1,000 embers'), icon: 'ember', hover: hover === 'devEmbers', font: '12px' });
  rects.push({ id: 'devEmbers', ...grant });
  iconButton(ctx, { x: safe.left + 26, y: safe.top + 26, r: 19, icon: 'back', hover: hover === 'back' });
  rects.push({ id: 'back', x: safe.left + 7, y: safe.top + 7, w: 38, h: 38 });
  return rects;
}

/* ───────────────────────── level-up cards ───────────────────────── */
export function drawLevelUp(ctx, { w, h, safe, t, lang, offers, hover, level }) {
  ctx.save();
  ctx.fillStyle = 'rgba(4,6,14,0.72)';
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  const rects = [];
  const title = t2(lang, 'LÊN CẤP', 'LEVEL UP');
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `600 ${Math.min(38, w * 0.042)}px ${FONT.display}`;
  ctx.letterSpacing = '6px';
  const g = ctx.createLinearGradient(w / 2 - 200, 0, w / 2 + 200, 0);
  g.addColorStop(0, 'rgba(255,232,168,0.2)');
  g.addColorStop(0.5, '#ffe8a8');
  g.addColorStop(1, 'rgba(255,232,168,0.2)');
  ctx.fillStyle = g;
  ctx.fillText(title, w / 2, h * 0.2);
  ctx.letterSpacing = '0px';
  ctx.restore();
  text(ctx, String(level), w / 2, h * 0.2 + 34, { size: 15, weight: 700, align: 'center', color: 'rgba(255,232,168,0.5)' });

  const n = offers.length;
  const gap = 18;
  const portrait = h > w;
  const cardW = portrait ? Math.min(360, w - safe.left - safe.right - 40) : Math.min(240, (w - safe.left - safe.right - 80 - gap * (n - 1)) / n);
  const cardY = portrait ? h * 0.29 : h * 0.34;
  const cardH = portrait ? Math.min(160, (h - safe.bottom - 20 - cardY - 12 * (n - 1)) / Math.max(1, n)) : Math.min(296, h * 0.46);
  const totalW = cardW * n + gap * (n - 1);
  const startX = portrait ? (w - cardW) / 2 : w / 2 - totalW / 2;
  offers.forEach((o, i) => {
    const x = portrait ? startX : startX + i * (cardW + gap);
    const y = cardY + (portrait ? i * (cardH + 12) : 0);
    const isHover = hover === 'offer:' + i;
    const float = portrait ? 0 : Math.sin(t * 1.6 + i * 0.8) * 3;
    drawOfferCard(ctx, { x, y: y + float, w: cardW, h: cardH, offer: o, hover: isHover, t, lang });
    rects.push({ id: 'offer:' + i, x, y, w: cardW, h: cardH });
  });
  return rects;
}

function drawOfferCard(ctx, { x, y, w, h, offer, hover, t, lang }) {
  const isSkill = offer.type === 'skillup';
  const rarity = isSkill ? 'rare' : offer.rarity;
  const rar = RARITY[rarity] || RARITY.common;
  const accent = isSkill ? (SKILL_BY_ID[offer.skillId]?.icon.tint || rar.color) : rar.color;
  const compact = h < 220;
  ctx.save();
  if (hover) {
    ctx.shadowColor = hexA(accent, 0.5);
    ctx.shadowBlur = 28;
  }
  roundRect(ctx, x, y, w, h, 18);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, 'rgba(24,30,52,0.97)');
  g.addColorStop(1, 'rgba(10,13,24,0.98)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = hexA(accent, hover ? 0.9 : 0.42);
  ctx.lineWidth = hover ? 2 : 1.2;
  ctx.stroke();
  // rarity wash at the top
  const wash = ctx.createLinearGradient(x, y, x, y + h * 0.48);
  wash.addColorStop(0, hexA(accent, 0.22));
  wash.addColorStop(1, hexA(accent, 0));
  ctx.save();
  roundRect(ctx, x, y, w, h, 18);
  ctx.clip();
  ctx.fillStyle = wash;
  ctx.fillRect(x, y, w, h * 0.48);
  ctx.restore();

  // Wide portrait cards use a horizontal layout instead of stretching the
  // narrow vertical-card design, leaving readable space for the effect text.
  if (w > h * 1.5) {
    const sk = isSkill ? SKILL_BY_ID[offer.skillId] : null;
    const branch = isSkill && offer.branch ? sk.branch?.options.find(o => o.id === offer.branch) : null;
    const skillName = isSkill ? localize(sk.name, lang) : localize(offer.name, lang);
    const name = branch ? `${skillName} · ${localize(branch.name, lang)}` : skillName;
    const note = isSkill ? L(sk.ranks[offer.rank - 1]?.note, lang) : localize(offer.desc, lang);
    const desc = branch ? `${localize(branch.note, lang)} · ${note}` : note;
    const iconX = x + 44, iconY = y + h / 2, radius = Math.min(26, h * 0.22);
    ctx.beginPath(); ctx.arc(iconX, iconY, radius, 0, TAU); ctx.fillStyle = 'rgba(8,10,20,0.7)'; ctx.fill();
    ctx.strokeStyle = hexA(accent, 0.65); ctx.lineWidth = 1.6; ctx.stroke();
    drawIcon(ctx, isSkill ? sk.icon.glyph : (offer.glyph || 'paw'), iconX, iconY, radius * 1.1, accent);
    const tx = x + 82, tw = w - 96;
    text(ctx, trimTo(ctx, name, tw, 13, 700), tx, y + 26, { size: 13, weight: 700, color: '#f6efdd' });
    ctx.save(); ctx.beginPath(); ctx.rect(tx, y + 34, tw, Math.max(0, h - 58)); ctx.clip();
    wrapText(ctx, desc, tx, y + 48, tw, 15, { size: 11, color: 'rgba(214,222,240,0.86)', weight: 500 }); ctx.restore();
    const progress = isSkill ? `${offer.rank - 2} → ${offer.rank - 1}/${Math.max(0, (sk.ranks?.length || 1) - 1)}`
      : offer.max ? `${offer.level || 0} → ${(offer.level || 0) + 1}/${offer.max}` : '';
    text(ctx, `${localize(rar.label, lang)}  ${progress}`, tx, y + h - 10, { size: 9, weight: 700, color: hexA(accent, 0.85) });
    ctx.restore(); return;
  }

  // icon medallion
  const cx = x + w / 2;
  const iconY = y + h * (compact ? 0.24 : 0.28);
  const iconRadius = compact ? Math.min(w * 0.19, h * 0.18) : w * 0.19;
  const iconSize = compact ? Math.min(w * 0.2, h * 0.19) : w * 0.2;
  ctx.beginPath();
  ctx.arc(cx, iconY, iconRadius, 0, TAU);
  ctx.fillStyle = 'rgba(8,10,20,0.7)';
  ctx.fill();
  ctx.strokeStyle = hexA(accent, 0.65);
  ctx.lineWidth = 1.6;
  ctx.stroke();
  if (isSkill) {
    const sk = SKILL_BY_ID[offer.skillId];
    drawIcon(ctx, sk.icon.glyph, cx, iconY, iconSize, accent);
  } else {
    drawIcon(ctx, offer.glyph || 'paw', cx, iconY, iconSize, accent);
  }
  // Name the fork on the actual level-up card, not only in the skill catalog.
  const branch = isSkill && offer.branch ? SKILL_BY_ID[offer.skillId].branch?.options.find(o => o.id === offer.branch) : null;
  const skillName = isSkill ? localize(SKILL_BY_ID[offer.skillId].name, lang) : localize(offer.name, lang);
  const name = branch ? `${skillName} · ${localize(branch.name, lang)}` : skillName;
  text(ctx, trimTo(ctx, name, w - 20, compact ? 12 : 15, 700), cx, y + h * (compact ? 0.48 : 0.52), { size: compact ? 12 : 15, weight: 700, align: 'center', color: '#f6efdd' });
  // rank pips for skill upgrades
  if (isSkill) {
    const upgradeCount = Math.max(0, (SKILL_BY_ID[offer.skillId].ranks?.length || 1) - 1);
    for (let k = 0; k < upgradeCount; k++) {
      ctx.beginPath();
      ctx.arc(cx - (upgradeCount - 1) * 5 + k * 10, y + h * (compact ? 0.54 : 0.56), 2.4, 0, TAU);
      ctx.fillStyle = k < offer.rank - 1 ? accent : 'rgba(255,255,255,0.14)';
      ctx.fill();
    }
  }
  if (isSkill) {
    const max = Math.max(0, (SKILL_BY_ID[offer.skillId].ranks?.length || 1) - 1);
    text(ctx, `${offer.rank - 2} → ${offer.rank - 1}/${max}`, cx, y + h - (compact ? 22 : 36), { size: compact ? 9 : 10, weight: 600, align: 'center', color: 'rgba(200,210,232,0.7)' });
  }
  // effect line: one sentence that matters
  const rankNote = isSkill ? L(SKILL_BY_ID[offer.skillId].ranks[offer.rank - 1]?.note, lang) : '';
  const desc = branch ? `${localize(branch.name, lang)}: ${localize(branch.note, lang)} · ${rankNote}`
    : isSkill ? rankNote : localize(offer.desc, lang);
  wrapText(ctx, desc, x + 18, y + h * (compact ? 0.62 : 0.66), w - 36, compact ? 13 : 17, { size: compact ? 10 : 12, color: 'rgba(214,222,240,0.86)', weight: 500 });
  // stack indicator for repeatable run upgrades
  if (!isSkill && offer.max) {
    text(ctx, `${offer.level || 0} → ${(offer.level || 0) + 1}/${offer.max}`, cx, y + h - (compact ? 22 : 36), { size: compact ? 9 : 10, weight: 600, align: 'center', color: 'rgba(200,210,232,0.5)' });
  }
  // rarity label
  ctx.save();
  ctx.font = `700 9px ${FONT.ui}`;
  ctx.letterSpacing = '2.4px';
  ctx.fillStyle = hexA(accent, 0.85);
  ctx.textAlign = 'center';
  ctx.fillText(localize(rar.label, lang).toUpperCase(), cx, y + h - (compact ? 8 : 18));
  ctx.restore();
  ctx.restore();
}

/* ───────────────────────── results ───────────────────────── */
export function drawResults(ctx, { w, h, safe, t, lang, summary, hover, victory }) {
  drawBackdrop(ctx, w, h, t, victory ? PALETTE.jade : PALETTE.vermilion, 0.7);
  const rects = [];
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `600 ${Math.min(52, w * 0.055)}px ${FONT.display}`;
  ctx.letterSpacing = '3px';
  const g = ctx.createLinearGradient(w / 2 - 240, 0, w / 2 + 240, 0);
  g.addColorStop(0, hexA(victory ? PALETTE.jade : PALETTE.vermilion, 0.3));
  g.addColorStop(0.5, victory ? '#d8fff0' : '#ffd7dc');
  g.addColorStop(1, hexA(victory ? PALETTE.jade : PALETTE.vermilion, 0.3));
  ctx.fillStyle = g;
  const resultTitle = summary.challengeBoss ? (victory ? t2(lang, 'THỬ THÁCH THÀNH CÔNG', 'PRACTICE COMPLETE') : t2(lang, 'THỬ LẠI', 'TRY AGAIN'))
    : victory ? t2(lang, 'BÌNH MINH', 'DAYBREAK') : t2(lang, 'ĐÊM KÉO DÀI', 'THE NIGHT GROWS LONG');
  ctx.fillText(resultTitle, w / 2, h * 0.22, w - safe.left - safe.right - 20);
  ctx.restore();

  const panelW = Math.min(560, w * 0.6);
  const panelX = w / 2 - panelW / 2;
  const panelY = h * 0.3;
  const panelH = h * 0.38;
  panel(ctx, panelX, panelY, panelW, panelH, { radius: 18 });
  const stats = [
    { label: { vi: 'Đêm', en: 'Night' }, value: `${summary.night}` },
    { label: { vi: 'Cấp', en: 'Level' }, value: `${summary.level}` },
    { label: { vi: 'Hạ gục', en: 'Kills' }, value: `${summary.kills}` },
    { label: { vi: 'Thời gian', en: 'Time' }, value: `${Math.floor(summary.time / 60)}:${String(Math.floor(summary.time % 60)).padStart(2, '0')}` },
  ];
  const colW = (panelW - 48) / 4;
  stats.forEach((s, i) => {
    const x = panelX + 24 + i * colW + colW / 2;
    text(ctx, String(s.value), x, panelY + 62, { size: 30, weight: 700, align: 'center', color: '#f4ece0', font: FONT.display });
    text(ctx, localize(s.label, lang), x, panelY + 84, { size: 10, weight: 700, align: 'center', color: 'rgba(154,168,200,0.85)' });
  });
  divider(ctx, panelX + 24, panelY + 108, panelW - 48);
  // rewards
  text(ctx, summary.challengeBoss ? t2(lang, 'Đấu tập · Không có thưởng', 'Practice · No rewards') : tr(lang, 'rewards'), panelX + 26, panelY + 138, { size: 11, weight: 700, color: 'rgba(255,201,102,0.7)' });
  const embers = summary.embers || 0;
  drawIcon(ctx, 'ember', panelX + 42, panelY + 168, 18, '#ffb066');
  text(ctx, `+${embers}`, panelX + 58, panelY + 174, { size: 17, weight: 700, color: '#ffe8c8' });
  drawIcon(ctx, 'coin', panelX + 150, panelY + 168, 18, '#ffc966');
  text(ctx, `+${summary.gold}`, panelX + 166, panelY + 174, { size: 17, weight: 700, color: '#ffe8c8' });
  if (summary.newBest) {
    text(ctx, tr(lang, 'newBest'), panelX + panelW - 26, panelY + 174, { size: 11, weight: 700, align: 'right', color: PALETTE.jade });
  }

  const btnW = Math.min(200, panelW / 2 - 20);
  const by = h - safe.bottom - 78;
  const again = button(ctx, { x: w / 2 - btnW - 8, y: by, w: btnW, h: 50, label: tr(lang, 'retry'), icon: 'pounce', primary: true, hover: hover === 'again', font: '15px' });
  const home = button(ctx, { x: w / 2 + 8, y: by, w: btnW, h: 50, label: tr(lang, 'toMenu'), icon: 'star', hover: hover === 'home', font: '15px' });
  rects.push({ id: 'again', ...again }, { id: 'home', ...home });
  return rects;
}

/* ───────────────────────── pause ───────────────────────── */
export function drawPause(ctx, { w, h, safe, t, lang, hover, run }) {
  ctx.save();
  ctx.fillStyle = 'rgba(3,5,12,0.74)';
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  const rects = [];
  const pw = Math.min(360, w * (h > w ? 0.9 : 0.42));
  const ph = 330;
  const px = w / 2 - pw / 2;
  const py = h / 2 - ph / 2;
  panel(ctx, px, py, pw, ph, { radius: 20 });
  sceneTitle(ctx, tr(lang, 'pause'), `${tr(lang, 'night')} ${run.night} · ${tr(lang, 'level')} ${run.level}`, px + 26, py + 66, { size: 28 });
  const bw = pw - 52;
  let by = py + 112;
  rects.push({ id: 'resume', ...button(ctx, { x: px + 26, y: by, w: bw, h: 46, label: tr(lang, 'resume'), icon: 'pounce', primary: true, hover: hover === 'resume', font: '15px' }) });
  by += 56;
  rects.push({ id: 'botToggle', ...button(ctx, { x: px + 26, y: by, w: bw, h: 42, label: tr(lang, 'sandbox'), icon: 'spirit', hover: hover === 'botToggle', font: '13px' }) });
  by += 52;
  rects.push({ id: 'settings', ...button(ctx, { x: px + 26, y: by, w: bw, h: 42, label: tr(lang, 'settings'), icon: 'clock', hover: hover === 'settings', font: '13px' }) });
  by += 52;
  rects.push({ id: 'quit', ...button(ctx, { x: px + 26, y: by, w: bw, h: 42, label: tr(lang, 'quit'), danger: true, hover: hover === 'quit', font: '13px' }) });
  return rects;
}

/* ───────────────────────── run setup (diff + bot) ───────────────────────── */
export function drawRunSetup(ctx, { w, h, safe, t, lang, hover, difficulty, botMode, catId, skills }) {
  ctx.save();
  ctx.fillStyle = 'rgba(3,5,12,0.82)';
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  const rects = [];
  const cat = CAT_BY_ID[catId] || CATS[0];
  const pw = Math.min(460, w * 0.5);
  const ph = 400;
  const px = w / 2 - pw / 2;
  const py = h / 2 - ph / 2;
  panel(ctx, px, py, pw, ph, { radius: 22 });
  drawCatFace(ctx, cat, px + pw / 2, py + 82, 92, { t, blink: blinkAt(t, 0.4) });
  sceneTitle(ctx, localize(cat.name, lang), localize(cat.title, lang), px + pw / 2 - measure(ctx, localize(cat.name, lang), 24, 600, FONT.display) / 2, py + 176, { size: 24, track: 0.3 });

  // difficulty segmented control
  const segW = (pw - 52) / 2;
  const segY = py + 210;
  [['normal', tr(lang, 'normal')], ['hard', tr(lang, 'hard')]].forEach(([id, label], i) => {
    const x = px + 26 + i * segW;
    const on = difficulty === id;
    roundRect(ctx, x, segY, segW - 4, 38, 19);
    ctx.fillStyle = on ? 'rgba(255,201,102,0.16)' : 'rgba(255,255,255,0.04)';
    ctx.fill();
    ctx.strokeStyle = on ? 'rgba(255,201,102,0.7)' : 'rgba(255,201,102,0.14)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    text(ctx, label, x + (segW - 4) / 2, segY + 25, { size: 13, weight: 700, align: 'center', color: on ? '#ffe8a8' : 'rgba(200,210,232,0.75)' });
    rects.push({ id: 'diff:' + id, x, y: segY, w: segW - 4, h: 38 });
  });

  // bot toggle: a switch labelled once, not a paragraph
  const botY = segY + 54;
  const on = botMode;
  roundRect(ctx, px + 26, botY, 46, 26, 13);
  ctx.fillStyle = on ? 'rgba(63,214,168,0.3)' : 'rgba(255,255,255,0.06)';
  ctx.fill();
  ctx.strokeStyle = on ? 'rgba(63,214,168,0.85)' : 'rgba(255,201,102,0.18)';
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(px + 26 + (on ? 34 : 12), botY + 13, 9, 0, TAU);
  ctx.fillStyle = on ? '#bff7e4' : '#e8e2d2';
  ctx.fill();
  drawIcon(ctx, 'spirit', px + 92, botY + 13, 18, on ? '#7ce0b0' : 'rgba(200,210,232,0.7)');
  text(ctx, tr(lang, 'sandbox'), px + 110, botY + 18, { size: 13, weight: 600, color: on ? '#d8fff0' : 'rgba(220,224,236,0.8)' });
  rects.push({ id: 'botToggle', x: px + 26, y: botY - 6, w: pw - 52, h: 38 });

  // loadout chips (skill icons only)
  const chipY = botY + 48;
  const chipSize = 44;
  const totalW = chipSize * 4 + 12 * 3;
  skills.forEach((sid, i) => {
    const sk = SKILL_BY_ID[sid];
    const x = px + pw / 2 - totalW / 2 + i * (chipSize + 12);
    roundRect(ctx, x, chipY, chipSize, chipSize, 10);
    ctx.fillStyle = 'rgba(8,11,22,0.8)';
    ctx.fill();
    ctx.strokeStyle = sk ? hexA(sk.icon.tint, 0.55) : 'rgba(255,201,102,0.15)';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    if (sk) drawIcon(ctx, sk.icon.glyph, x + chipSize / 2, chipY + chipSize / 2, 22, sk.icon.tint);
    else text(ctx, '+', x + chipSize / 2, chipY + chipSize / 2 + 7, { size: 20, align: 'center', color: 'rgba(154,168,200,0.4)' });
  });

  const goW = (pw - 52) / 2;
  const goY = py + ph - 66;
  rects.push({ id: 'go', ...button(ctx, { x: px + 26, y: goY, w: goW - 6, h: 46, label: tr(lang, 'enterNight'), icon: 'pounce', primary: true, hover: hover === 'go', font: '14px' }) });
  rects.push({ id: 'cancel', ...button(ctx, { x: px + 26 + goW + 6, y: goY, w: goW - 6, h: 46, label: tr(lang, 'back'), hover: hover === 'cancel', font: '13px' }) });
  return rects;
}

/* ─────────────────────────────── codex / wiki ───────────────────────────────
   A manual, not a second game database. Every entry is built from the live def
   objects by src/data/wiki.js, so nothing here can drift from what the combat
   code actually runs. What this screen adds is the reading experience: which
   tabs exist, what is still locked, and how much of each shelf you have filled.

   Locked entries are shown as sealed tiles rather than hidden rows. A codex
   that silently omits things gives you no sense of what is left to find, which
   is the only reason to open a codex twice.
────────────────────────────────────────────────────────────────────────────── */

export function drawCodex(ctx, { w, h, safe, t, lang, profile, hover, wiki, tab = 0, page = 0 }) {
  drawBackdrop(ctx, w, h, t, PALETTE.lilac, 0.9);
  const rects = [];
  const cats = wiki || [];
  const cat = cats[tab] || cats[0] || { entries: [], label: '', discovered: 0, total: 0 };

  // header
  const left = safe.left + 44;
  const top = safe.top + 26;
  iconButton(ctx, { x: left + 19, y: top + 25, r: 19, icon: 'back', hover: hover === 'back' });
  rects.push({ id: 'back', x: left, y: top + 6, w: 38, h: 38 });
  heading(ctx, L({ vi: 'Sổ Tay', en: 'Codex' }, lang), left + 54, top + 32, 240, { size: 17 });
  const stat = `${cat.discovered} / ${cat.total}`;
  text(ctx, stat, w - safe.right - 44, top + 30, { size: 15, weight: 700, align: 'right', color: 'rgba(255,201,102,0.85)' });

  // Category rail. Eight shelves do not fit across a portrait phone, so the rail
  // wraps into two rows rather than shrinking every tile until the label and the
  // count are drawn on top of each other.
  const gap = 8;
  const railW = Math.min(w - safe.left - safe.right - 88, 8 * 150 + 7 * gap);
  const perRow = railW < 640 ? 4 : 8;
  const rowsN = Math.ceil(cats.length / perRow);
  const railH = 40;
  const railY = top + 56;
  const tileW = (railW - gap * (perRow - 1)) / perRow;
  let rx = left;
  let rowY = railY;
  cats.forEach((c, i) => {
    if (i > 0 && i % perRow === 0) { rx = left; rowY += railH + gap; }
    const active = i === tab;
    const isHover = hover === `codex-tab:${i}`;
    roundRect(ctx, rx, rowY, tileW, railH, 12);
    ctx.fillStyle = active ? 'rgba(255,201,102,0.16)' : isHover ? 'rgba(255,255,255,0.06)' : 'rgba(10,14,26,0.6)';
    ctx.fill();
    ctx.strokeStyle = active ? 'rgba(255,201,102,0.5)' : 'rgba(255,201,102,0.13)';
    ctx.lineWidth = 1.1;
    ctx.stroke();
    // Narrow tiles get a stacked layout instead of a squeezed row. On a 360px-
    // tall phone the eight shelves are ~60px wide each, and label + count on one
    // line ran straight through each other.
    const tight = tileW < 120;
    const countTxt = `${c.discovered}/${c.total}`;
    if (tight) {
      drawIcon(ctx, c.icon || 'star', rx + tileW / 2, rowY + 13, 14, active ? '#ffe8a8' : 'rgba(190,202,228,0.8)');
      text(ctx, trimTo(ctx, c.label, tileW - 6, 8.5, 700), rx + tileW / 2, rowY + 27, {
        size: 8.5, weight: 700, align: 'center', color: active ? '#ffe8a8' : 'rgba(176,188,214,0.92)',
      });
      text(ctx, countTxt, rx + tileW / 2, rowY + 36, {
        size: 8, weight: 700, align: 'center',
        color: c.discovered === c.total ? 'rgba(127,232,176,0.9)' : 'rgba(150,162,190,0.7)',
      });
    } else {
      drawIcon(ctx, c.icon || 'star', rx + 18, rowY + 20, 17, active ? '#ffe8a8' : 'rgba(190,202,228,0.8)');
      const countW = measure(ctx, countTxt, 9.5, 700) + 10;
      text(ctx, trimTo(ctx, c.label, tileW - 44 - countW + 14, 10, 700), rx + 32, rowY + 24, {
        size: 10.5, weight: 700, color: active ? '#ffe8a8' : 'rgba(176,188,214,0.92)',
      });
      text(ctx, countTxt, rx + tileW - 8, rowY + 24, {
        size: 9.5, weight: 700, align: 'right',
        color: c.discovered === c.total ? 'rgba(127,232,176,0.9)' : 'rgba(150,162,190,0.7)',
      });
    }
    rects.push({ id: `codex-tab:${i}`, x: rx, y: rowY, w: tileW, h: railH });
    rx += tileW + gap;
  });

  // entry grid — needs its own scrolling because categories differ in size
  const gridY = railY + rowsN * (railH + gap) + 18;
  // Two columns, not three, when the screen cannot hold a readable title beside
  // the icon: "Sâ..." is worse than showing fewer cards.
  const cols = w > 1100 ? 5 : w > 760 ? 4 : w > 520 ? 3 : 2;
  const cardW = (railW - gap * (cols - 1)) / cols;
  const cardH = 92;
  const rows = Math.ceil(cat.entries.length / cols);
  const perPage = cols * Math.max(1, Math.floor((h - gridY - safe.bottom - 76) / (cardH + gap)));
  const maxPage = Math.max(0, Math.ceil(cat.entries.length / perPage) - 1);
  const pg = clamp(page, 0, maxPage);
  const slice = cat.entries.slice(pg * perPage, pg * perPage + perPage);

  slice.forEach((e, i) => {
    const cx = left + (i % cols) * (cardW + gap);
    const cy = gridY + Math.floor(i / cols) * (cardH + gap);
    const isHover = hover === `codex:${e.id}`;
    roundRect(ctx, cx, cy, cardW, cardH, 13);
    ctx.fillStyle = e.locked ? 'rgba(8,11,20,0.72)' : isHover ? 'rgba(255,255,255,0.075)' : 'rgba(14,19,34,0.82)';
    ctx.fill();
    ctx.strokeStyle = e.locked ? 'rgba(120,132,164,0.16)' : isHover ? 'rgba(255,201,102,0.42)' : 'rgba(255,201,102,0.12)';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    if (e.locked) {
      // sealed: a question-mark sigil, no name, no spoilers
      ctx.save();
      ctx.globalAlpha = 0.5;
      drawIcon(ctx, 'close', cx + cardW / 2, cy + cardH / 2 - 6, 20, 'rgba(150,162,190,0.75)');
      ctx.restore();
      text(ctx, L({ vi: 'Chưa gặp', en: 'Undiscovered' }, lang), cx + cardW / 2, cy + cardH - 18, {
        size: 9.5, weight: 700, align: 'center', color: 'rgba(130,142,172,0.75)',
      });
    } else {
      // Icon disc. Uses the entry's own colour so shelves read at a glance.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(cx + 30, cy + 32, 2, cx + 30, cy + 32, 26);
      g.addColorStop(0, `${e.color}55`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx + 30, cy + 32, 26, 0, TAU);
      ctx.fill();
      ctx.restore();
      drawIcon(ctx, e.icon || 'star', cx + 30, cy + 32, 21, e.color || '#ffe8a8');
      text(ctx, trimTo(ctx, e.title, cardW - 70, 11.5, 700), cx + 52, cy + 26, { size: 11.5, weight: 700, color: '#f4ecd8' });
      text(ctx, trimTo(ctx, e.subtitleText, cardW - 70, 9.5, 600), cx + 52, cy + 43, { size: 9.5, weight: 600, color: 'rgba(154,168,200,0.92)' });
      // first line of body only — the grid is an index, not the article
      const line = e.body && e.body[0] ? e.body[0] : '';
      text(ctx, trimTo(ctx, line, cardW - 24, 9, 500), cx + 12, cy + 68, { size: 9, weight: 500, color: 'rgba(176,188,214,0.8)' });
    }
    if (!e.locked) rects.push({ id: `codex:${e.id}`, x: cx, y: cy, w: cardW, h: cardH });
  });

  // empty shelf
  if (!cat.entries.length) {
    text(ctx, L({ vi: 'Chưa có gì ở đây.', en: 'Nothing here yet.' }, lang), left, gridY + 40, {
      size: 13, weight: 600, color: 'rgba(150,162,190,0.8)',
    });
  }

  // pager
  if (maxPage > 0) {
    const py = h - safe.bottom - 34;
    rects.push({ id: 'codex-page:prev', x: left, y: py, w: 34, h: 30 });
    rects.push({ id: 'codex-page:next', x: left + 42, y: py, w: 34, h: 30 });
    iconButton(ctx, { x: left + 15, y: py + 15, r: 15, icon: 'back', hover: hover === 'codex-page:prev' });
    iconButton(ctx, { x: left + 57, y: py + 15, r: 15, icon: 'play', hover: hover === 'codex-page:next' });
    text(ctx, `${pg + 1} / ${maxPage + 1}`, left + 88, py + 20, { size: 10.5, weight: 700, color: 'rgba(154,168,200,0.9)' });
  }
  return rects;
}

/**
 * Detail panel for one codex entry. Drawn as an overlay above the grid so the
 * shelf stays visible behind it and the player keeps their place.
 */
export function drawCodexDetail(ctx, { w, h, safe, lang, entry, hover, wiki }) {
  if (!entry) return [];
  const rects = [];
  ctx.save();
  ctx.fillStyle = 'rgba(4,6,12,0.72)';
  ctx.fillRect(0, 0, w, h);
  const pw = Math.min(560, w - safe.left - safe.right - 60);
  const ph = Math.min(440, h - safe.top - safe.bottom - 80);
  const x = (w - pw) / 2;
  const y = (h - ph) / 2;
  panel(ctx, x, y, pw, ph, { radius: 20, top: 'rgba(16,21,38,0.99)', bottom: 'rgba(10,14,26,0.99)' });

  drawIcon(ctx, entry.icon || 'star', x + 46, y + 52, 30, entry.color || '#ffe8a8');
  text(ctx, entry.title, x + 78, y + 46, { size: 21, weight: 700, color: '#fff3dc' });
  text(ctx, entry.subtitleText, x + 78, y + 68, { size: 11, weight: 600, color: 'rgba(255,201,102,0.8)' });
  divider(ctx, x + 30, y + 92, pw - 60);

  // wrapText returns the y it finished drawing at, so advance from that rather
  // than guessing a line count (guessing overflowed the panel on long entries).
  let ty = y + 122;
  for (const line of entry.body) {
    ty = wrapText(ctx, line, x + 30, ty, pw - 60, 20, { size: 12.5, weight: 500, color: 'rgba(224,232,248,0.94)' }) + 26;
  }

  // sprite, when the entry has one — this is the whole point of the bestiary
  if (entry.def && entry.shape) {
    ctx.save();
    ctx.globalAlpha = 0.95;
    drawCreature(ctx, entry.def, { t: 0.6, phase: 0 }, { x: x + pw - 92, y: y + ph - 104, scale: 1.4, facing: -1 });
    ctx.restore();
  } else if (entry.catArt) {
    ctx.save();
    ctx.globalAlpha = 0.95;
    drawCat(ctx, entry.catArt, { t: 0.6, gait: 0, lean: 0, tail: 0.3, blink: 0, ears: 0.1, mouth: 0 }, { x: x + pw - 92, y: y + ph - 96, scale: 1.0, facing: -1 });
    ctx.restore();
  }

  const closeR = button(ctx, { x: x + pw - 128, y: y + ph - 52, w: 98, h: 36, label: L({ vi: 'Đóng', en: 'Close' }, lang), hover: hover === 'codex-close' });
  rects.push({ id: 'codex-close', ...closeR });
  ctx.restore();
  void wiki;
  return rects;
}
