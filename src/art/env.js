// Three arena environments, drawn procedurally with depth layers:
//   sky wash → far silhouettes → mid structures → ground plane → foreground dust
// Everything is cached to offscreen canvases at resize so the per-frame cost is
// a handful of drawImage calls.

import { TAU, clamp, lerp, hash01, shade, rgbCss, smooth } from '../core/math.js';

const cache = new Map();

function offscreen(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

function hex(c) {
  const v = c.replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

/** Sky gradient + moon + stars. Shared by all envs, tinted per act. */
function paintSky(ctx, w, h, act) {
  const top = hex(act.tint2);
  const bottom = hex(act.tint);
  const g = ctx.createLinearGradient(0, 0, 0, h * 0.78);
  g.addColorStop(0, rgbCss(shade(top, -0.18)));
  g.addColorStop(0.45, rgbCss(top));
  g.addColorStop(1, rgbCss(shade(bottom, 0.06)));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // stars
  ctx.save();
  for (let i = 0; i < 130; i++) {
    const x = hash01(i * 8191) * w;
    const y = hash01(i * 3571) * h * 0.62;
    const s = 0.5 + hash01(i * 977) * 1.5;
    const a = 0.14 + hash01(i * 131) * 0.5;
    ctx.fillStyle = `rgba(255,246,220,${a * (1 - y / (h * 0.8))})`;
    ctx.fillRect(x, y, s, s);
  }
  ctx.restore();

  // moon: big, low, partly veiled
  const mx = w * 0.16;
  const my = h * 0.24;
  const mr = Math.min(w, h) * 0.135;
  const glow = ctx.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 5.2);
  glow.addColorStop(0, 'rgba(255,232,168,0.34)');
  glow.addColorStop(0.35, 'rgba(255,214,140,0.12)');
  glow.addColorStop(1, 'rgba(255,214,140,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, TAU);
  const mg = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.35, mr * 0.1, mx, my, mr);
  mg.addColorStop(0, '#fffaf0');
  mg.addColorStop(0.7, '#f6e7c2');
  mg.addColorStop(1, '#dcc79a');
  ctx.fillStyle = mg;
  ctx.fill();
  // craters
  ctx.save();
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, TAU);
  ctx.clip();
  ctx.fillStyle = 'rgba(160,140,110,0.22)';
  for (let i = 0; i < 6; i++) {
    const a = hash01(i * 613) * TAU;
    const r = hash01(i * 271) * mr * 0.7;
    const cr = mr * (0.08 + hash01(i * 41) * 0.16);
    ctx.beginPath();
    ctx.arc(mx + Math.cos(a) * r, my + Math.sin(a) * r, cr, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function paintClouds(ctx, w, h, seed, alpha = 0.14, color = '#8fa0c8') {
  ctx.save();
  for (let i = 0; i < 7; i++) {
    const y = h * (0.16 + hash01(seed + i * 31) * 0.34);
    const x = hash01(seed + i * 77) * w * 1.2 - w * 0.1;
    const rw = w * (0.16 + hash01(seed + i * 13) * 0.3);
    const rh = h * (0.02 + hash01(seed + i * 7) * 0.03);
    const g = ctx.createLinearGradient(x, y - rh, x, y + rh);
    g.addColorStop(0, `rgba(143,160,200,0)`);
    g.addColorStop(0.5, `rgba(${hexColor(color)},${alpha})`);
    g.addColorStop(1, `rgba(143,160,200,0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, rw, rh, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
function hexColor(c) { const v = hex(c); return `${v[0]},${v[1]},${v[2]}`; }

/* ── act 1: ruined moon garden ───────────────────────────────────────────── */
function paintGarden(ctx, w, h, act) {
  const horizon = h * 0.30;
  // far hills
  ctx.fillStyle = 'rgba(30,32,66,0.85)';
  ctx.beginPath();
  ctx.moveTo(0, horizon + 10);
  for (let x = 0; x <= w; x += w / 12) {
    ctx.lineTo(x, horizon - 16 - Math.sin(x * 0.004 + 1.2) * 26 - Math.sin(x * 0.011) * 6);
  }
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  // ruined arches / colonnade
  ctx.fillStyle = 'rgba(21,22,48,0.95)';
  for (let i = 0; i < 5; i++) {
    const x = w * (0.1 + i * 0.2);
    const hh = h * (0.2 + hash01(i * 71) * 0.1);
    const ww = w * 0.05;
    ctx.fillRect(x, horizon - hh, ww, hh);
    ctx.beginPath();
    ctx.arc(x + ww / 2, horizon - hh, ww * 0.62, Math.PI, 0);
    ctx.fill();
    if (i < 4) {
      ctx.strokeStyle = 'rgba(21,22,48,0.9)';
      ctx.lineWidth = h * 0.016;
      ctx.beginPath();
      ctx.moveTo(x + ww * 0.5, horizon - hh - ww * 0.4);
      ctx.quadraticCurveTo(x + w * 0.1, horizon - hh - h * 0.09, x + w * 0.2 + ww * 0.5, horizon - hh - ww * 0.4);
      ctx.stroke();
    }
  }
  // bare trees
  ctx.strokeStyle = 'rgba(14,15,34,0.96)';
  for (let i = 0; i < 4; i++) {
    const bx = w * (0.06 + i * 0.3) + hash01(i * 13) * w * 0.06;
    const bh = h * (0.24 + hash01(i * 29) * 0.14);
    ctx.lineWidth = h * 0.011;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx, horizon + 4);
    ctx.quadraticCurveTo(bx - w * 0.01, horizon - bh * 0.6, bx + w * 0.02, horizon - bh);
    ctx.stroke();
    ctx.lineWidth = h * 0.004;
    for (let k = 0; k < 5; k++) {
      const t = 0.35 + k * 0.14;
      const py = horizon - bh * t;
      const px = bx + w * (0.01 * t);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + (k % 2 ? 1 : -1) * w * 0.03, py - h * 0.03, px + (k % 2 ? 1 : -1) * w * 0.05, py - h * 0.05);
      ctx.stroke();
    }
  }
  paintPlayfield(ctx, w, h, act, horizon);
  // hanging lanterns
  for (let i = 0; i < 3; i++) {
    const lx = w * (0.22 + i * 0.32);
    const ly = h * (0.3 + hash01(i * 53) * 0.1);
    const sway = Math.sin(i * 2.1) * w * 0.004;
    ctx.strokeStyle = 'rgba(255,201,102,0.22)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(lx + sway, 0);
    ctx.lineTo(lx, ly);
    ctx.stroke();
    const lg = ctx.createRadialGradient(lx, ly, 1, lx, ly, h * 0.13);
    lg.addColorStop(0, 'rgba(255,201,102,0.42)');
    lg.addColorStop(1, 'rgba(255,201,102,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(lx - h * 0.13, ly - h * 0.13, h * 0.26, h * 0.26);
    ctx.fillStyle = '#ffd98a';
    ctx.beginPath();
    ctx.ellipse(lx, ly, h * 0.012, h * 0.019, 0, 0, TAU);
    ctx.fill();
  }
  paintForeground(ctx, w, h, 0.9);
  void act;
}

/**
 * The playfield. Actors stand anywhere between PLAY.top (250) and GROUND_Y (512),
 * so this paints a believable stone terrace across that whole band: courses of
 * flagstones that compress toward the horizon, each with an inset highlight and
 * an ink seam, plus scattered rubble and a moonlit sheen. Style varies by act.
 */
function roundStone(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function paintPlayfield(ctx, w, h, act, horizon) {
  const style = act.env;
  const pal = style === 'town'
    ? { deep: '#1d120e', mid: '#20140f', light: '#241812', sheen: '255,164,80' }
    : style === 'terrace'
      ? { deep: '#131a24', mid: '#151d28', light: '#18222d', sheen: '150,240,220' }
      : { deep: '#141c2f', mid: '#162034', light: '#19253a', sheen: '190,205,255' };
  void pal.light;

  // The walkable floor is a receding plane: y from the horizon down to the far
  // lip of the terrace. Perspective is faked with a single vanishing point, so
  // stone joints converge instead of reading as a brick wall.
  const floorBottom = h * 0.80;
  const cx = w * 0.5;

  const base = ctx.createLinearGradient(0, horizon, 0, floorBottom);
  base.addColorStop(0, pal.mid);
  base.addColorStop(0.55, pal.deep);
  base.addColorStop(1, '#04050a');
  ctx.fillStyle = base;
  ctx.fillRect(0, horizon, w, floorBottom - horizon);

  // Joints only: draw hairlines along the perspective grid, never filled tiles.
  // One continuous surface with seams reads as stone; per-tile fills read as a
  // chessboard. Row lines bow very slightly to imply uneven, worn slabs.
  const rows = 12;
  const depthAt = (t) => horizon + Math.pow(t, 1.5) * (floorBottom - horizon);
  const lanes = 14;
  const cx2 = w * 0.5;

  for (let r = 1; r <= rows; r++) {
    const t = r / rows;
    const y = depthAt(t);
    const near = t;
    ctx.beginPath();
    for (let x = 0; x <= w; x += w / 18) {
      const yy = y + Math.sin(x * 0.012 + r * 1.7) * (0.8 + near * 3.2);
      x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
    }
    ctx.strokeStyle = `rgba(2,4,9,${0.14 + near * 0.5})`;
    ctx.lineWidth = 0.8 + near * 2.2;
    ctx.stroke();
    // light catching the near lip of each seam: gives the stone thickness
    ctx.save();
    ctx.translate(0, (0.9 + near * 2.6));
    ctx.strokeStyle = `rgba(${pal.sheen},${0.03 + near * 0.075})`;
    ctx.lineWidth = 0.6 + near * 1.2;
    ctx.stroke();
    ctx.restore();
  }
  // converging joints (the lines running away from the viewer)
  for (let i = 0; i <= lanes; i++) {
    const baseX = (i / lanes) * w;
    const skew = (hash01(i * 53) - 0.5) * w * 0.05;
    ctx.beginPath();
    ctx.moveTo(cx2 + (baseX - cx2) * 0.34, horizon);
    ctx.quadraticCurveTo(cx2 + (baseX - cx2) * (0.62 + hash01(i * 17) * 0.06) + skew * 0.4, horizon + (floorBottom - horizon) * 0.5, baseX + skew, floorBottom);
    ctx.strokeStyle = `rgba(3,5,11,${0.1 + 0.3 * hash01(i * 91)})`;
    ctx.lineWidth = 0.7 + hash01(i * 31) * 1.1;
    ctx.stroke();
  }

  // Scattered rubble + moon sheen strengthen the sense of a real surface.
  for (let i = 0; i < 40; i++) {
    const t = Math.pow(hash01(i * 71), 1.3);
    const y = horizon + 10 + t * (floorBottom - horizon - 14);
    const x = cx + (hash01(i * 131 + 7) - 0.5) * w * (0.4 + t * 1.0);
    const r = 1.2 + t * 4.4;
    ctx.fillStyle = `rgba(3,4,9,${0.2 + t * 0.32})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.9, r * 0.62, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(${pal.sheen},${0.03 + t * 0.05})`;
    ctx.beginPath();
    ctx.ellipse(x - r * 0.4, y - r * 0.34, r * 0.8, r * 0.28, 0, 0, TAU);
    ctx.fill();
  }

  // worn patches: soft blotches that break up any remaining grid rhythm
  for (let i = 0; i < 18; i++) {
    const t = Math.pow(hash01(i * 211), 1.2);
    const y = horizon + 12 + t * (floorBottom - horizon - 20);
    const x = cx + (hash01(i * 307 + 11) - 0.5) * w * (0.5 + t * 1.1);
    const rw = (30 + t * 130) * (0.6 + hash01(i * 41) * 0.8);
    const rh = rw * (0.18 + t * 0.16);
    const grad = ctx.createRadialGradient(x, y, 1, x, y, rw);
    grad.addColorStop(0, `rgba(6,9,18,${0.05 + t * 0.12})`);
    grad.addColorStop(1, 'rgba(6,9,18,0)');
    ctx.save();
    ctx.scale(1, rh / rw);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y / (rh / rw), rw, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // Standing water: shallow pools that mirror the warm lantern light above.
  for (let i = 0; i < 5; i++) {
    const t = 0.3 + hash01(i * 173) * 0.62;
    const y = horizon + t * (floorBottom - horizon);
    const x = cx2 + (hash01(i * 419) - 0.5) * w * 0.92;
    const rx = 42 + t * 120 * (0.6 + hash01(i * 61) * 0.7);
    const ry = rx * 0.16;
    const pg = ctx.createRadialGradient(x, y, 1, x, y, rx);
    pg.addColorStop(0, `rgba(${pal.sheen},${0.05 + t * 0.06})`);
    pg.addColorStop(0.55, `rgba(${pal.sheen},${0.02 + t * 0.03})`);
    pg.addColorStop(1, `rgba(${pal.sheen},0)`);
    ctx.save();
    ctx.scale(1, ry / rx);
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(x, y * (rx / ry), rx, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = `rgba(${pal.sheen},${0.05 + t * 0.05})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y, rx * 0.92, ry * 0.86, 0, 0, TAU);
    ctx.stroke();
  }

  const sheen = ctx.createRadialGradient(cx * 0.85, horizon + (floorBottom - horizon) * 0.45, 10, cx * 0.85, horizon + (floorBottom - horizon) * 0.45, w * 0.42);
  sheen.addColorStop(0, `rgba(${pal.sheen},0.07)`);
  sheen.addColorStop(1, `rgba(${pal.sheen},0)`);
  ctx.fillStyle = sheen;
  ctx.fillRect(0, horizon, w, floorBottom - horizon);

  const haze = ctx.createLinearGradient(0, horizon - 8, 0, horizon + (floorBottom - horizon) * 0.2);
  haze.addColorStop(0, 'rgba(150,168,210,0.2)');
  haze.addColorStop(1, 'rgba(150,168,210,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon - 8, w, (floorBottom - horizon) * 0.22);

  // far lip: the terrace edge, drawn as a lit kerb with darkness below it
  const lip = ctx.createLinearGradient(0, floorBottom - 3, 0, floorBottom + h * 0.14);
  lip.addColorStop(0, `rgba(${pal.sheen},0.10)`);
  lip.addColorStop(0.08, 'rgba(4,5,10,0.9)');
  lip.addColorStop(1, 'rgba(2,3,7,0.98)');
  ctx.fillStyle = lip;
  ctx.fillRect(0, floorBottom - 3, w, h - floorBottom + 3);
  ctx.strokeStyle = `rgba(${pal.sheen},0.16)`;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, floorBottom - 1);
  ctx.lineTo(w, floorBottom - 1);
  ctx.stroke();
}

/** Near-plane silhouettes along the bottom edge — depth without parallax cost. */
function paintForeground(ctx, w, h, density = 1) {
  const base = h - 1;
  ctx.save();
  ctx.fillStyle = 'rgba(5,6,14,0.92)';
  // broken stone lip
  ctx.beginPath();
  ctx.moveTo(0, base);
  for (let x = 0; x <= w; x += w / 14) {
    const lift = 6 + hash01(x * 0.37) * 16;
    ctx.lineTo(x, base - lift);
  }
  ctx.lineTo(w, base);
  ctx.closePath();
  ctx.fill();
  // grass tufts, clustered
  ctx.strokeStyle = 'rgba(8,10,20,0.95)';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  const n = Math.round(26 * density);
  for (let i = 0; i < n; i++) {
    const x = hash01(i * 733) * w;
    const hh = 10 + hash01(i * 311) * 34;
    const lean = (hash01(i * 97) - 0.5) * 14;
    ctx.beginPath();
    ctx.moveTo(x, base - 4);
    ctx.quadraticCurveTo(x + lean * 0.4, base - hh * 0.6, x + lean, base - hh);
    ctx.stroke();
  }
  ctx.restore();
}

/* ── act 2: lantern row town ─────────────────────────────────────────────── */
function paintTown(ctx, w, h, act) {
  const horizon = h * 0.30;
  // distant rooftops
  ctx.fillStyle = 'rgba(46,24,17,0.9)';
  for (let i = 0; i < 14; i++) {
    const x = (i / 13) * w;
    const bw = w * (0.05 + hash01(i * 17) * 0.05);
    const bh = h * (0.07 + hash01(i * 43) * 0.1);
    ctx.fillRect(x, horizon - bh, bw, bh);
  }
  // main street facades
  for (let i = 0; i < 5; i++) {
    const x = w * (0.02 + i * 0.205);
    const bw = w * 0.17;
    const bh = h * (0.3 + hash01(i * 61) * 0.16);
    const base = ['#38201a', '#2c1a17', '#3f241c'][i % 3];
    ctx.fillStyle = base;
    ctx.fillRect(x, horizon - bh, bw, bh);
    // roof
    ctx.beginPath();
    ctx.moveTo(x - w * 0.017, horizon - bh);
    ctx.lineTo(x + bw * 0.5, horizon - bh - h * 0.055);
    ctx.lineTo(x + bw + w * 0.017, horizon - bh);
    ctx.closePath();
    ctx.fillStyle = '#1c110f';
    ctx.fill();
    // windows
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 2; c++) {
        const on = hash01(i * 91 + r * 7 + c * 13) > 0.55;
        const wx = x + bw * (0.2 + c * 0.42);
        const wy = horizon - bh + h * 0.06 + r * h * 0.08;
        ctx.fillStyle = on ? 'rgba(255,196,110,0.86)' : 'rgba(22,14,20,0.9)';
        ctx.fillRect(wx, wy, bw * 0.22, h * 0.045);
        if (on) {
          const wg = ctx.createRadialGradient(wx + bw * 0.11, wy + h * 0.02, 1, wx + bw * 0.11, wy + h * 0.02, h * 0.08);
          wg.addColorStop(0, 'rgba(255,196,110,0.25)');
          wg.addColorStop(1, 'rgba(255,196,110,0)');
          ctx.fillStyle = wg;
          ctx.fillRect(wx - h * 0.06, wy - h * 0.05, h * 0.16, h * 0.14);
        }
      }
    }
    // hanging sign
    ctx.strokeStyle = 'rgba(255,201,102,0.3)';
    ctx.lineWidth = 1;
    const sx = x + bw * (i % 2 ? 0.1 : 0.76);
    ctx.beginPath();
    ctx.moveTo(sx, horizon - bh * 0.6);
    ctx.lineTo(sx, horizon - bh * 0.42);
    ctx.stroke();
  }
  // ground: wet flagstone reflecting the lamps
  paintPlayfield(ctx, w, h, act, horizon);
  for (let i = 0; i < 30; i++) {
    const t = hash01(i * 43);
    const y = horizon + Math.pow(t, 1.5) * (h - horizon);
    ctx.fillStyle = `rgba(255,170,90,${0.03 + (1 - t) * 0.07})`;
    ctx.fillRect(hash01(i * 91) * w, y, w * 0.05, 1.6);
  }
  // street lanterns
  for (let i = 0; i < 4; i++) {
    const lx = w * (0.14 + i * 0.25);
    const ly = h * (0.62);
    ctx.strokeStyle = '#170e0c';
    ctx.lineWidth = h * 0.006;
    ctx.beginPath();
    ctx.moveTo(lx, horizon + h * 0.03);
    ctx.lineTo(lx, ly);
    ctx.stroke();
    const lg = ctx.createRadialGradient(lx, ly, 1, lx, ly, h * 0.18);
    lg.addColorStop(0, 'rgba(255,164,80,0.4)');
    lg.addColorStop(1, 'rgba(255,140,60,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(lx - h * 0.18, ly - h * 0.18, h * 0.36, h * 0.36);
    ctx.fillStyle = '#ffb257';
    ctx.beginPath();
    ctx.ellipse(lx, ly, h * 0.016, h * 0.024, 0, 0, TAU);
    ctx.fill();
  }
  paintForeground(ctx, w, h, 0.7);
  void act;
}

/* ── act 3: full moon terrace ─────────────────────────────────────────────── */
function paintTerrace(ctx, w, h, act) {
  const horizon = h * 0.30;
  // cloud sea below the terrace
  ctx.fillStyle = 'rgba(24,46,48,0.9)';
  ctx.beginPath();
  ctx.moveTo(0, horizon + h * 0.06);
  for (let x = 0; x <= w; x += w / 16) {
    ctx.quadraticCurveTo(x + w / 32, horizon + h * 0.02, x + w / 16, horizon + h * 0.06);
  }
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  // silhouette spires
  ctx.fillStyle = 'rgba(12,26,28,0.96)';
  for (let i = 0; i < 6; i++) {
    const x = w * (0.06 + i * 0.17);
    const bh = h * (0.1 + hash01(i * 33) * 0.16);
    ctx.beginPath();
    ctx.moveTo(x - w * 0.02, horizon + h * 0.05);
    ctx.lineTo(x, horizon - bh);
    ctx.lineTo(x + w * 0.02, horizon + h * 0.05);
    ctx.closePath();
    ctx.fill();
  }
  // terrace floor: dark polished stone with moon reflection
  const gg = ctx.createLinearGradient(0, horizon + h * 0.04, 0, h);
  gg.addColorStop(0, '#16292b');
  gg.addColorStop(0.4, '#101f21');
  gg.addColorStop(1, '#07100f');
  ctx.fillStyle = gg;
  ctx.fillRect(0, horizon + h * 0.04, w, h);
  // reflection
  const rg = ctx.createLinearGradient(w * 0.16, horizon, w * 0.16, h);
  rg.addColorStop(0, 'rgba(246,239,214,0.16)');
  rg.addColorStop(1, 'rgba(246,239,214,0)');
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.moveTo(w * 0.13, horizon + h * 0.05);
  ctx.lineTo(w * 0.19, horizon + h * 0.05);
  ctx.lineTo(w * 0.3, h);
  ctx.lineTo(w * 0.02, h);
  ctx.closePath();
  ctx.fill();
  // railing
  ctx.strokeStyle = 'rgba(120,190,180,0.13)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, horizon + h * 0.05);
  ctx.lineTo(w, horizon + h * 0.05);
  ctx.stroke();
  for (let i = 0; i < 26; i++) {
    const x = (i / 25) * w;
    ctx.beginPath();
    ctx.moveTo(x, horizon + h * 0.05);
    ctx.lineTo(x, horizon + h * 0.075);
    ctx.stroke();
  }
  // glowing runes on the floor
  for (let i = 0; i < 5; i++) {
    const x = hash01(i * 71) * w;
    const y = horizon + h * (0.2 + hash01(i * 29) * 0.3);
    ctx.strokeStyle = `rgba(63,214,168,${0.1 + hash01(i * 13) * 0.12})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(x, y, 10 + hash01(i * 43) * 24, 0, TAU);
    ctx.stroke();
  }
  void act;
}

function build(key, w, h, act) {
  const canvas = offscreen(w, h);
  const ctx = canvas.getContext('2d');
  paintSky(ctx, w, h, act);
  paintClouds(ctx, w, h, key.length * 17 + act.nights * 3, 0.13);
  if (act.env === 'garden') paintGarden(ctx, w, h, act);
  else if (act.env === 'town') paintTown(ctx, w, h, act);
  else paintTerrace(ctx, w, h, act);
  // vignette
  const vg = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.28, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(4,5,12,0.72)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  return canvas;
}

export function getEnvironment(act, w, h, quality = 'high') {
  const key = `${act.id}:${Math.round(w)}x${Math.round(h)}:${quality}`;
  if (cache.has(key)) return cache.get(key);
  if (cache.size > 6) cache.clear();
  const value = build(key, w, h, act);
  cache.set(key, value);
  return value;
}

/** Animated foreground: drifting motes + light shafts. Cheap, additive. */
export function drawAtmosphere(ctx, act, w, h, t, intensity = 1) {
  const moteColor = act.env === 'town' ? '255,190,120' : act.env === 'terrace' ? '120,255,220' : '190,200,255';
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 34; i++) {
    const speed = 0.02 + hash01(i * 31) * 0.05;
    const x = ((hash01(i * 71) * w + t * w * speed) % (w + 80)) - 40;
    const y = h * (0.3 + hash01(i * 13) * 0.7) + Math.sin(t * 0.6 + i) * 12;
    const s = 0.7 + hash01(i * 91) * 1.9;
    const a = (0.1 + 0.24 * (0.5 + 0.5 * Math.sin(t * 1.4 + i * 1.7))) * intensity;
    ctx.fillStyle = `rgba(${moteColor},${a})`;
    ctx.beginPath();
    ctx.arc(x, y, s, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** Soft floor shadow that grounds the whole arena. */
export function drawFloorShade(ctx, w, h, groundY) {
  const g = ctx.createLinearGradient(0, groundY - h * 0.1, 0, groundY + h * 0.16);
  g.addColorStop(0, 'rgba(3,4,10,0)');
  g.addColorStop(0.6, 'rgba(3,4,10,0.3)');
  g.addColorStop(1, 'rgba(3,4,10,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, groundY - h * 0.1, w, h * 0.26);
}

/** Border posts + shrine ring drawn above the environment, below actors. */
export function drawArenaTrim(ctx, arena, t, accent) {
  const { x, y, w, h } = arena;
  ctx.save();
  // inner glow frame
  ctx.strokeStyle = 'rgba(255,232,168,0.06)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 6, y + 6, w - 12, h - 12);
  // corner sigils
  const r = Math.min(28, w * 0.03);
  const pulse = 0.5 + 0.5 * Math.sin(t * 1.2);
  for (const [cx, cy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) {
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.16 + pulse * 0.12;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(0.3) * r, cy - Math.sin(0.3) * r);
    ctx.arc(cx, cy, r, 0.3, 1.2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  void smooth;
  void lerp;
  void clamp;
  void shade;
}
