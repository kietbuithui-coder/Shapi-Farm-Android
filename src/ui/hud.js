// In-game HUD. Information density is deliberate: vitals top-left, skill ring
// bottom-right, expedition clock top-centre, boss bar only when a boss exists.
// No labels for things a player already understands (no "HP", no "Press 1").

import { clamp, lerp, TAU, smooth } from '../core/math.js';
import { drawIcon } from '../art/icons.js';
import { drawCatFace } from '../art/catart.js';
import { UI, roundRect, text, meter, heading, iconButton, easeOut } from './theme.js';
import { CAT_COLORS, FONT } from '../data/palette.js';
import { localize } from '../data/strings.js';

const SKILL_SIZE = 74;

export class Hud {
  constructor() {
    this.hitRects = [];
    this.hover = -1;
    this.recentDmg = 0;
    this.dmgTimer = 0;
    this.levelFlash = 0;
    this.comboFlash = 0;
    this.skillPulse = [0, 0, 0, 0];
    this.lastLevel = 1;
    this.lastCombo = 0;
    this.announce = null;
    this.announceT = 0;
  }

  layout(w, h, safe, mobile) {
    this.w = w;
    this.h = h;
    this.safe = safe;
    this.mobile = mobile;
    const pad = safe.top + 16;
    const left = safe.left + 20;
    const right = w - safe.right - 20;
    // On narrow screens the bars must stop before the portrait circle and the
    // corner buttons; w*0.28 ran the HP bar under them.
    const narrow = w < 560;
    const barW = narrow ? Math.max(120, w - 74 - 20 - 96) : Math.min(300, w * 0.28);
    this.hpRect = { x: left + 74, y: pad + 16, w: barW, h: 15 };
    this.xpRect = { x: left, y: pad + 62, w: narrow ? Math.min(barW + 40, w - 40) : Math.min(340, w * 0.3), h: 6 };
    this.pauseRect = { x: right - 22, y: pad + 22, r: 19 };
    // Fullscreen sits beside pause on every platform: the brief asks for a
    // visible control, not a keyboard shortcut hidden in documentation.
    this.fsRect = { x: right - 22 - 52, y: pad + 22, r: 19 };
    this.skillRects = [];
    const size = mobile ? 62 : SKILL_SIZE;
    const gap = mobile ? 12 : 16;
    const totalW = size * 4 + gap * 3;
    const startX = right - totalW;
    const sy = h - safe.bottom - size - (mobile ? 18 : 26);
    for (let i = 0; i < 4; i++) {
      this.skillRects.push({ x: startX + i * (size + gap), y: sy, w: size, h: size, index: i });
    }
    this.skillSize = size;
    this.bossBar = { x: w * 0.5 - Math.min(360, w * 0.31), y: safe.top + 27, w: Math.min(720, w * 0.62), h: 11 };
    // Keep AUTO away from the thumb stick and the left-handed skill grid.
    this.botRect = mobile ? { x: left, y: safe.top + 78, w: 112, h: 32 }
      : { x: left, y: h - safe.bottom - 46, w: 112, h: 32 };
  }

  update(dt, run) {
    this.levelFlash = Math.max(0, this.levelFlash - dt * 1.6);
    this.comboFlash = Math.max(0, this.comboFlash - dt * 2);
    this.announceT = Math.max(0, this.announceT - dt);
    for (let i = 0; i < 4; i++) this.skillPulse[i] = Math.max(0, this.skillPulse[i] - dt * 3);
    if (run.level > this.lastLevel) { this.levelFlash = 1; this.lastLevel = run.level; }
    if (run.combo > this.lastCombo + 2) this.comboFlash = 1;
    this.lastCombo = run.combo;
    run.slots.forEach((s, i) => {
      if (s && run.state === 'fight' && s.cd <= 0 && s.charges > 0 && !this._ready?.[i]) {
        this.skillPulse[i] = 1;
      }
    });
    this._ready = run.slots.map((s) => s ? s.cd <= 0 && s.charges > 0 : false);
  }

  showAnnounce(title, sub, color = UI.accent, time = 2.4) {
    this.announce = { title, sub, color };
    this.announceT = time;
    this.announceMax = time;
  }

  draw(ctx, run, lang, opts = {}) {
    const w = this.w;
    const h = this.h;
    const { safe } = this;
    this.hitRects = [];
    const p = run.player;

    // ── vitals
    const faceR = 26;
    const fx = safe.left + 20 + faceR;
    const fy = safe.top + 34;
    ctx.save();
    ctx.beginPath();
    ctx.arc(fx, fy, faceR + 2, 0, TAU);
    ctx.fillStyle = 'rgba(8,11,22,0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,201,102,0.4)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.arc(fx, fy, faceR, 0, TAU);
    ctx.clip();
    drawCatFace(ctx, run.cat, fx, fy + 4, faceR * 2.4, { t: opts.t || 0 });
    ctx.restore();

    // energy wraps the portrait: no extra bar competing with health
    if (run.stats.energyMax > 0) {
      const frac = clamp(run.energy / run.stats.energyMax, 0, 1);
      ctx.beginPath();
      ctx.arc(fx, fy, faceR + 5.5, 0, TAU);
      ctx.strokeStyle = 'rgba(164,139,255,0.16)';
      ctx.lineWidth = 2.6;
      ctx.stroke();
      if (frac > 0.001) {
        ctx.beginPath();
        ctx.arc(fx, fy, faceR + 5.5, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
        ctx.strokeStyle = frac >= 1 ? '#c9b8ff' : '#a48bff';
        ctx.lineWidth = 2.6;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }

    const hpFrac = run.hp / run.stats.hpMax;
    const hpX = fx + faceR + 16;
    const hpY = fy - 13;
    const hpW = Math.min(268, w * 0.25);
    meter(ctx, hpX, hpY, hpW, 15, hpFrac, { color: '#b3202f', color2: '#ff5f6d', shield: p.shield > 0 ? p.shield / run.stats.hpMax : 0 });
    // current health sits on the bar, maximum sits outside it: no ambiguity
    text(ctx, `${Math.ceil(run.hp)}`, hpX + hpW - 7, hpY + 11.8, { size: 11.5, weight: 700, color: '#fff6ec', align: 'right', shadow: true, shadowY: 1 });
    text(ctx, `${Math.round(run.stats.hpMax)}`, hpX + hpW + 7, hpY + 11.8, { size: 10.5, weight: 600, color: 'rgba(255,246,236,0.45)' });

    // level medallion + xp rail
    const lvlY = hpY + 27;
    const lvlCX = hpX + 8;
    ctx.save();
    ctx.translate(lvlCX, lvlY);
    ctx.rotate(Math.PI / 4);
    roundRect(ctx, -8.5, -8.5, 17, 17, 3.5);
    ctx.fillStyle = 'rgba(8,11,22,0.92)';
    ctx.fill();
    ctx.strokeStyle = this.levelFlash > 0 ? '#ffe8a8' : 'rgba(255,201,102,0.5)';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.restore();
    text(ctx, String(run.level), lvlCX, lvlY + 4, { size: 11, weight: 700, color: this.levelFlash > 0 ? '#fff8e6' : '#ffe8a8', align: 'center' });
    const xpX = lvlCX + 14;
    const xpW = hpW - 18;
    meter(ctx, xpX, lvlY - 3.5, xpW, 7, run.xp / run.xpNeed, { color: '#1f6b4f', color2: '#7ce0b0' });
    if (this.levelFlash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = this.levelFlash * 0.6;
      ctx.fillStyle = '#ffe8a8';
      roundRect(ctx, xpX - 2, lvlY - 5.5, xpW + 4, 11, 6);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // ── expedition clock / night
    // Hidden on narrow/portrait screens: the HP bar spans the full width there
    // and the night label printed straight through it.
    const narrowHud = w < 560;
    if (opts.showNight !== false && !narrowHud) {
      const cx = w * 0.5;
      const cy = safe.top + 26;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = `600 11px ${FONT.ui}`;
      ctx.letterSpacing = '3px';
      ctx.fillStyle = 'rgba(255,232,168,0.72)';
      ctx.fillText(localize(run.act.name, lang).toUpperCase(), cx, cy - 4);
      ctx.letterSpacing = '0px';
      text(ctx, `${String(Math.floor(run.time / 60)).padStart(2, '0')}:${String(Math.floor(run.time % 60)).padStart(2, '0')}`, cx, cy + 16, { size: 15, weight: 700, color: 'rgba(244,236,216,0.9)', align: 'center', font: FONT.ui });
      // wave pips: 5 per night, filled = cleared
      const pipY = cy + 26;
      for (let i = 0; i < 5; i++) {
        const filled = i + 1 <= run.wave - 1;
        const current = i + 1 === run.wave;
        const px = cx + (i - 2) * 15;
        ctx.beginPath();
        ctx.arc(px, pipY, current ? 4 : 3, 0, TAU);
        if (filled) { ctx.fillStyle = 'rgba(255,201,102,0.9)'; ctx.fill(); }
        else if (current) { ctx.fillStyle = 'rgba(255,201,102,0.85)'; ctx.fill(); }
        else { ctx.strokeStyle = 'rgba(255,201,102,0.3)'; ctx.lineWidth = 1.2; ctx.stroke(); }
        if (current) {
          ctx.beginPath();
          ctx.arc(px, pipY, 7 + Math.sin((opts.t || 0) * 3) * 1.4, 0, TAU);
          ctx.strokeStyle = 'rgba(255,201,102,0.3)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // ── boss bar
    const boss = run.boss || run.miniBoss;
    if (boss) {
      const b = this.bossBar;
      const frac = clamp(boss.hp / boss.hpMax, 0, 1);
      ctx.save();
      roundRect(ctx, b.x - 3, b.y - 3, b.w + 6, b.h + 6, 9);
      ctx.fillStyle = 'rgba(6,8,16,0.7)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,201,102,0.28)';
      ctx.lineWidth = 1;
      ctx.stroke();
      meter(ctx, b.x, b.y, b.w, b.h, frac, { color: boss.boss ? '#8f2430' : '#6b4a1a', color2: boss.boss ? '#ff5f6d' : '#ffc966' });
      // phase notches for act bosses
      if (boss.phases) {
        boss.phases.forEach((ph, i) => {
          if (i === 0) return;
          const nx = b.x + b.w * ph.at;
          ctx.fillStyle = 'rgba(255,240,214,0.5)';
          ctx.fillRect(nx, b.y - 2, 1.6, b.h + 4);
        });
      }
      const label = localize((boss.name || boss.def.name) || { vi: '', en: '' }, lang);
      text(ctx, label, b.x + b.w / 2, b.y - 8, { size: 12, weight: 700, color: 'rgba(255,240,214,0.92)', align: 'center' });
      ctx.restore();
    }

    // ── combo
    if (run.combo > 2) {
      const cx = w - safe.right - 30;
      const cy = safe.top + 110;
      const pop = 1 + this.comboFlash * 0.22;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(pop, pop);
      text(ctx, `${run.combo}`, 0, 0, { size: 30, weight: 700, color: run.combo >= 25 ? '#ffe066' : '#fff3dc', align: 'right', font: FONT.display });
      ctx.beginPath();
      const cw = 66 * clamp(1 - run.comboTimer / 2.4, 0, 1);
      ctx.strokeStyle = 'rgba(255,201,102,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-cw, 7);
      ctx.lineTo(0, 7);
      ctx.stroke();
      ctx.restore();
    }

    // ── pause + fullscreen.
    // On portrait phones the touch layer owns these (the HUD's corner icons would
    // land on the full-width bars), so the HUD skips drawing them there. Both
    // layers used to draw a pair, which put two pause buttons on screen.
    if (!opts.hideCornerButtons) {
      iconButton(ctx, { x: this.pauseRect.x, y: this.pauseRect.y, r: this.pauseRect.r, icon: 'pause', hover: this.hover === 'pause' });
      this.hitRects.push({ id: 'pause', x: this.pauseRect.x - this.pauseRect.r, y: this.pauseRect.y - this.pauseRect.r, w: this.pauseRect.r * 2, h: this.pauseRect.r * 2 });

      iconButton(ctx, { x: this.fsRect.x, y: this.fsRect.y, r: this.fsRect.r, icon: opts.fullscreen ? 'compress' : 'expand', hover: this.hover === 'fullscreen' });
      this.hitRects.push({ id: 'fullscreen', x: this.fsRect.x - this.fsRect.r, y: this.fsRect.y - this.fsRect.r, w: this.fsRect.r * 2, h: this.fsRect.r * 2 });
    }

    // ── skill slots
    if (!opts.hideSkills) run.slots.forEach((slot, i) => {
      const r = this.skillRects[i];
      this.drawSlot(ctx, r, slot, run, i, lang, opts.t || 0);
    });

    // ── announce banner
    if (this.announce && this.announceT > 0) {
      const k = 1 - this.announceT / this.announceMax;
      const alpha = k < 0.15 ? k / 0.15 : k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      const y = h * 0.3;
      text(ctx, this.announce.title, w / 2, y, { size: 42, weight: 600, color: this.announce.color, align: 'center', font: FONT.display, shadow: true });
      if (this.announce.sub) {
        ctx.font = `600 12px ${FONT.ui}`;
        ctx.letterSpacing = '4px';
        ctx.fillStyle = 'rgba(244,236,216,0.75)';
        ctx.textAlign = 'center';
        ctx.fillText(this.announce.sub.toUpperCase(), w / 2, y + 24);
        ctx.letterSpacing = '0px';
      }
      ctx.restore();
    }

    // ── bot toggle
    if (opts.showBot) {
      const br = this.botRect;
      roundRect(ctx, br.x, br.y, br.w, br.h, br.h / 2);
      ctx.fillStyle = opts.botOn ? 'rgba(63,214,168,0.22)' : 'rgba(14,19,34,0.72)';
      ctx.fill();
      ctx.strokeStyle = opts.botOn ? 'rgba(63,214,168,0.6)' : 'rgba(255,201,102,0.24)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      drawIcon(ctx, 'spirit', br.x + 21, br.y + br.h / 2, 17, opts.botOn ? '#7ce0b0' : '#9aa8c8');
      text(ctx, 'AUTO', br.x + 38, br.y + br.h / 2 + 4.5, { size: 11, weight: 700, color: opts.botOn ? '#bff7e4' : '#8892b0' });
      this.hitRects.push({ id: 'bot', ...br });
    }
  }

  drawSlot(ctx, r, slot, run, i, lang, t) {
    const s = r.w;
    const cx = r.x + s / 2;
    const cy = r.y + s / 2;
    const ready = slot && slot.cd <= 0 && slot.charges > 0 && run.energy >= (slot?.def.cost || 0);
    ctx.save();
    // glass base
    ctx.beginPath();
    ctx.arc(cx, cy, s / 2, 0, TAU);
    ctx.fillStyle = 'rgba(8,11,22,0.82)';
    ctx.fill();
    ctx.strokeStyle = slot ? (ready ? 'rgba(255,201,102,0.7)' : 'rgba(255,201,102,0.24)') : 'rgba(120,130,155,0.22)';
    ctx.lineWidth = ready ? 2 : 1.4;
    ctx.stroke();
    if (!slot) {
      ctx.setLineDash([5, 6]);
      ctx.beginPath();
      ctx.arc(cx, cy, s / 2 - 5, 0, TAU);
      ctx.strokeStyle = 'rgba(150,164,196,0.34)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.setLineDash([]);
      text(ctx, '+', cx, cy + 7, { size: 20, weight: 400, color: 'rgba(170,184,214,0.5)', align: 'center' });
      ctx.restore();
      return;
    }
    const tint = slot.def.icon.tint;
    // icon
    ctx.save();
    ctx.globalAlpha = ready ? 1 : 0.55;
    drawIcon(ctx, slot.def.icon.glyph, cx, cy - 1, s * 0.56, tint, { glow: ready && this.skillPulse[i] > 0 ? tint : null });
    ctx.restore();
    // cooldown sweep
    if (slot.cd > 0) {
      const total = Math.max(0.01, slot.def.cd);
      const frac = clamp(slot.cd / total, 0, 1);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, s / 2 - 1, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
      ctx.closePath();
      ctx.fillStyle = 'rgba(4,6,14,0.66)';
      ctx.fill();
      text(ctx, slot.cd >= 10 ? Math.ceil(slot.cd) : slot.cd.toFixed(1), cx, cy + 6, { size: 16, weight: 700, color: '#f4ecd8', align: 'center' });
    }
    // energy gate
    if (run.energy < slot.def.cost) {
      ctx.beginPath();
      ctx.arc(cx, cy, s / 2 - 1, 0, TAU);
      ctx.fillStyle = 'rgba(10,10,26,0.42)';
      ctx.fill();
    }
    // rank pips around the rim
    const maxRank = Math.max(0, (slot.def.ranks?.length || 1) - 1);
    const used = Math.max(0, slot.rank - 1);
    for (let k = 0; k < maxRank; k++) {
      const a = Math.PI * 0.62 + (k / Math.max(1, maxRank - 1)) * Math.PI * 0.76;
      const px = cx + Math.cos(a) * (s / 2 - 8);
      const py = cy + Math.sin(a) * (s / 2 - 8);
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, TAU);
      ctx.fillStyle = k < used ? '#ffc966' : 'rgba(255,201,102,0.22)';
      ctx.fill();
    }
    // ready pulse ring
    if (ready && this.skillPulse[i] > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, s / 2 + 2 + (1 - this.skillPulse[i]) * 7, 0, TAU);
      ctx.strokeStyle = `rgba(255,232,168,${this.skillPulse[i] * 0.6})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // keybind (desktop only) — a numeral on a dark chip so it never fights the icon
    if (!this.mobile) {
      ctx.beginPath();
      ctx.arc(r.x + 12, r.y + 12, 9, 0, TAU);
      ctx.fillStyle = 'rgba(6,8,16,0.85)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,201,102,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      text(ctx, String(i + 1), r.x + 12, r.y + 16, { size: 10, weight: 700, color: 'rgba(255,232,168,0.85)', align: 'center' });
    }
    // charge pips
    if (slot.maxCharges > 1) {
      for (let k = 0; k < slot.maxCharges; k++) {
        ctx.beginPath();
        ctx.arc(cx - (slot.maxCharges - 1) * 4 + k * 8, r.y + s - 8, 2.4, 0, TAU);
        ctx.fillStyle = k < slot.charges ? '#ffe8a8' : 'rgba(255,232,168,0.2)';
        ctx.fill();
      }
    }
    ctx.restore();
    void lang; void t;
  }

  hitTest(x, y) {
    for (const r of this.hitRects) {
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.id;
    }
    for (const r of this.skillRects) {
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      if (Math.hypot(x - cx, y - cy) <= r.w / 2 + 6) return 'skill' + r.index;
    }
    return null;
  }
}

export { SKILL_SIZE };
void lerp; void smooth; void easeOut; void CAT_COLORS; void heading;
