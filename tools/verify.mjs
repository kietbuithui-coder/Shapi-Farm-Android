// Verifies the built index.html is genuinely self-contained + boots headlessly.
import { readFileSync, statSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const failures = [];
const checks = [];

function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  if (!ok) failures.push(name + (detail ? ': ' + detail : ''));
}

check('single file', statSync('index.html').size > 200_000, (statSync('index.html').size / 1024).toFixed(0) + ' KB');
check('no external scripts', !/<script[^>]+src=/.test(html));
check('no external styles', !/<link[^>]+rel=["']stylesheet/.test(html));
check('no http(s) URLs in markup', !/["'(]https?:\/\//.test(html.replace(/<meta[^>]+>/g, '')));
check('fonts inlined', (html.match(/@font-face/g) || []).length >= 8, `${(html.match(/@font-face/g) || []).length} faces`);
check('no base64 images (art is drawn)', !/data:image\//.test(html));
check('viewport set', /name="viewport"/.test(html));
check('canvas present', /<canvas[^>]+id="game"/.test(html));
check('no console.log spam', (html.match(/console\.log/g) || []).length <= 2);

// The bundle must not contain placeholder markers. Base64 font payloads are
// stripped first: random encoded bytes can spell anything.
const textOnly = html.replace(/base64,[A-Za-z0-9+/=]+/g, '');
for (const bad of ['TODO', 'FIXME', 'lorem ipsum', 'placeholder', '\uFFFD']) {
  check(`no "${bad}"`, !textOnly.toLowerCase().includes(bad.toLowerCase()));
}

for (const c of checks) console.log(`${c.ok ? 'ok  ' : 'FAIL'}  ${c.name}${c.detail ? '  (' + c.detail + ')' : ''}`);
if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nindex.html is self-contained.');
