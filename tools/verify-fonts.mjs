// Verify Vietnamese text renders correctly in the SHIPPED artifact.
//
// index.html inlines 11 woff files and splits them with `unicode-range`, so the
// browser chooses a subset per character. A wrong range silently swaps a letter
// for a blank or a fallback glyph — the exact bug visible in headless
// screenshots ("CHÍN ÊM D I ÁNH TRĂNG" instead of "CHÍN ĐÊM DƯỚI ÁNH TRĂNG").
//
// This tool answers the question the screenshots cannot: for every character the
// game actually draws, is there a @font-face whose unicode-range covers it AND
// whose font file really contains that glyph?
import { readFileSync } from 'node:fs';
import zlib from 'node:zlib';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

/* ── WOFF parsing ────────────────────────────────────────────────────────── */

function parseWoff(buf) {
  const sig = buf.toString('ascii', 0, 4);
  if (sig !== 'wOFF') throw new Error(`not a woff: ${sig}`);
  const numTables = buf.readUInt16BE(12);
  const tables = {};
  for (let i = 0; i < numTables; i++) {
    const off = 44 + i * 20;
    const tag = buf.toString('ascii', off, off + 4);
    const offset = buf.readUInt32BE(off + 4);
    const compLength = buf.readUInt32BE(off + 8);
    const origLength = buf.readUInt32BE(off + 12);
    const raw = buf.subarray(offset, offset + compLength);
    tables[tag] = compLength < origLength ? zlib.inflateSync(raw) : raw;
  }
  return tables;
}

/** Collect the set of code points a font's cmap covers. */
function cmapCodepoints(tables) {
  const cmap = tables.cmap;
  if (!cmap) return new Set();
  const count = cmap.readUInt16BE(2);
  const covered = new Set();
  for (let i = 0; i < count; i++) {
    const rec = 4 + i * 8;
    const platform = cmap.readUInt16BE(rec);
    const encoding = cmap.readUInt16BE(rec + 2);
    const offset = cmap.readUInt32BE(rec + 4);
    const sub = cmap.subarray(offset);
    const format = sub.readUInt16BE(0);
    // Only the unicode subtables matter; (3,1) BMP and (3,10) full are the ones
    // a browser uses for these fonts.
    const isUnicode = (platform === 0) || (platform === 3 && (encoding === 1 || encoding === 10));
    if (!isUnicode) continue;

    if (format === 4) {
      const segX2 = sub.readUInt16BE(6);
      const ends = 14;
      const starts = ends + segX2 + 2;
      for (let s = 0; s < segX2; s += 2) {
        const end = sub.readUInt16BE(ends + s);
        const start = sub.readUInt16BE(starts + s);
        for (let cp = start; cp <= end && cp !== 0xffff; cp++) covered.add(cp);
      }
    } else if (format === 12) {
      const nGroups = sub.readUInt32BE(12);
      for (let g = 0; g < nGroups; g++) {
        const rec = 16 + g * 12;
        const start = sub.readUInt32BE(rec);
        const end = sub.readUInt32BE(rec + 4);
        for (let cp = start; cp <= end; cp++) covered.add(cp);
      }
    }
  }
  return covered;
}

/* ── unicode-range parsing (the browser's subset selector) ───────────────── */

function parseRanges(text) {
  return text.split(',').map((piece) => {
    const p = piece.trim().replace(/^U\+/i, '');
    const [a, b] = p.split('-');
    const lo = parseInt(a, 16);
    const hi = b ? parseInt(b, 16) : lo;
    return [lo, hi];
  });
}

const covers = (ranges, cp) => ranges.some(([lo, hi]) => cp >= lo && cp <= hi);

/* ── gather the shipped faces ────────────────────────────────────────────── */

const faces = [...html.matchAll(/@font-face\s*{([^}]*)}/gi)].map((m) => {
  const body = m[1];
  const family = /font-family:\s*['"]([^'"]+)['"]/i.exec(body)?.[1];
  const weight = /font-weight:\s*(\d+)/i.exec(body)?.[1] || '400';
  const range = /unicode-range:\s*([^;]+)/i.exec(body)?.[1] || '';
  const b64 = /base64,([A-Za-z0-9+/=]+)/.exec(body)?.[1];
  return { family, weight, ranges: parseRanges(range), b64 };
});

const loaded = faces.map((f) => {
  const buf = Buffer.from(f.b64, 'base64');
  let covered = new Set();
  let err = null;
  try { covered = cmapCodepoints(parseWoff(buf)); } catch (e) { err = e.message; }
  return { ...f, covered, err, bytes: buf.length };
});

/* ── the characters the game actually draws ──────────────────────────────── */

// Pull every string literal out of the data modules; those are the only source
// of user-visible Vietnamese text.
import { readdirSync } from 'node:fs';
const dataDir = new URL('../src/data/', import.meta.url);
const sources = readdirSync(dataDir).filter((f) => f.endsWith('.js')).map((f) => readFileSync(new URL(f, dataDir), 'utf8'));
const chars = new Set();
for (const src of sources) {
  for (const m of src.matchAll(/'([^'\\\n]*)'|"([^"\\\n]*)"/g)) {
    for (const ch of (m[1] ?? m[2])) if (ch.codePointAt(0) > 0x7f) chars.add(ch);
  }
}

/* ── the check ───────────────────────────────────────────────────────────── */

const problems = [];
const routed = [];

// CSS font matching: within one family+weight, the LAST declared face whose
// unicode-range covers a character wins. If that winning face has no glyph, the
// browser paints .notdef — it does NOT fall through to another family. So the
// check has to be on the winner, not on "any covering face".
function winnerFor(ch) {
  const cp = ch.codePointAt(0);
  const byFamilyWeight = new Map();
  for (const f of loaded) {
    if (!covers(f.ranges, cp)) continue;
    const key = `${f.family}|${f.weight}`;
    byFamilyWeight.set(key, f);           // later declaration overwrites
  }
  return byFamilyWeight;
}

for (const ch of [...chars].sort()) {
  const cp = ch.codePointAt(0);
  // Which faces does the browser consider for this character?
  const winners = winnerFor(ch);
  if (winners.size === 0) {
    problems.push(`U+${cp.toString(16).toUpperCase().padStart(4, '0')} "${ch}" is outside every unicode-range`);
    continue;
  }
  const missing = [];
  for (const [key, face] of winners) {
    if (!face.covered.has(cp)) missing.push(key);
  }
  if (missing.length) {
    problems.push(`U+${cp.toString(16).toUpperCase().padStart(4, '0')} "${ch}" is routed to a face without that glyph: ${missing.join(', ')}`);
  }
  routed.push([ch, winners]);
}

const total = chars.size;
console.log(`faces: ${loaded.length}`);
for (const f of loaded) {
  console.log(`  ${f.family.padEnd(16)} ${f.weight}  ${String(f.covered.size).padStart(5)} glyphs  ${(f.bytes / 1024).toFixed(0).padStart(4)} KB  ranges=${f.ranges.length}`);
}
console.log(`\nnon-ASCII characters used by the game: ${total}`);
const viChars = [...chars].filter((c) => /[\u1EA0-\u1EF9\u0102\u0103\u0110\u0111\u01A0\u01A1\u01AF\u01B0]/.test(c));
console.log(`Vietnamese-specific characters: ${viChars.length} → ${viChars.join(' ')}`);

// Show the actual subset routing for a handful of diacritics.
const sample = ['đ', 'ơ', 'ư', 'ộ', 'ậ', 'ế', 'Đ', 'Ư'];
for (const ch of sample) {
  if (!chars.has(ch)) continue;
  const w = routed.find((r) => r[0] === ch)?.[1];
  if (!w) { console.log(`  ${ch}  → (unrouted)`); continue; }
  const desc = [...w.entries()].map(([k, f]) => `${k}:${f.covered.has(ch.codePointAt(0)) ? 'glyph' : 'MISSING'}(${(f.bytes / 1024).toFixed(0)}KB)`).join('  ');
  console.log(`  ${ch}  → ${desc}`);
}

if (problems.length) {
  console.error(`\n${problems.length} character(s) would not render:\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log('\nevery character the game draws resolves to an inlined glyph.');
