// Bundles the whole game into ONE self-contained index.html:
//   · all ES modules bundled by esbuild into a single IIFE
//   · the two brand webfonts inlined as base64 (latin + Vietnamese subsets)
//   · no network requests of any kind after load, works from file://
//
//   node tools/build-web.mjs           → index.html
//   node tools/build-web.mjs --serve   → build, then serve on :8080
import { build } from 'esbuild';
import { readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const OUT = resolve(root, 'index.html');

/* ── fonts ─────────────────────────────────────────────────────────────── */
const FONT_FILES = [
  ['Lora', 600, 'normal', 'lora/files/lora-latin-600-normal.woff'],
  ['Lora', 700, 'normal', 'lora/files/lora-latin-700-normal.woff'],
  ['Lora', 600, 'italic', 'lora/files/lora-latin-600-italic.woff'],
  ['Be Vietnam Pro', 400, 'normal', 'be-vietnam-pro/files/be-vietnam-pro-latin-400-normal.woff'],
  ['Be Vietnam Pro', 400, 'normal', 'be-vietnam-pro/files/be-vietnam-pro-vietnamese-400-normal.woff'],
  ['Be Vietnam Pro', 500, 'normal', 'be-vietnam-pro/files/be-vietnam-pro-latin-500-normal.woff'],
  ['Be Vietnam Pro', 500, 'normal', 'be-vietnam-pro/files/be-vietnam-pro-vietnamese-500-normal.woff'],
  ['Be Vietnam Pro', 600, 'normal', 'be-vietnam-pro/files/be-vietnam-pro-latin-600-normal.woff'],
  ['Be Vietnam Pro', 600, 'normal', 'be-vietnam-pro/files/be-vietnam-pro-vietnamese-600-normal.woff'],
  ['Be Vietnam Pro', 700, 'normal', 'be-vietnam-pro/files/be-vietnam-pro-latin-700-normal.woff'],
  ['Be Vietnam Pro', 700, 'normal', 'be-vietnam-pro/files/be-vietnam-pro-vietnamese-700-normal.woff'],
];

function fontCss() {
  const base = resolve(root, 'node_modules/@fontsource');
  const faces = [];
  for (const [family, weight, style, rel] of FONT_FILES) {
    const file = resolve(base, rel);
    if (!existsSync(file)) continue;
    const data = readFileSync(file).toString('base64');
    // unicode-range keeps the browser from using the Vietnamese file for ASCII
    const vi = rel.includes('vietnamese');
    const range = vi
      ? 'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB'
      : 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
    faces.push(`@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};font-display:swap;src:url(data:font/woff;base64,${data}) format('woff');unicode-range:${range};}`);
  }
  return faces.join('\n');
}

/* ── bundle ────────────────────────────────────────────────────────────── */
const result = await build({
  entryPoints: [resolve(root, 'src/main.js')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  minify: true,
  legalComments: 'none',
  write: false,
  logLevel: 'error',
});
const js = result.outputFiles[0].text;

const html = `<!doctype html>
<html lang="vi" data-lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#070a16">
<meta name="description" content="CAT LEGENDS — nine nights under the moon. An action roguelite starring ten cats.">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>CAT LEGENDS</title>
<style>
${fontCss()}
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0;height:100%;overflow:hidden;background:#05060d;color:#f4ecd8;
  font-family:"Be Vietnam Pro","Segoe UI",system-ui,sans-serif;
  -webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;
  overscroll-behavior:none;touch-action:none}
#game{display:block;width:100%;height:100%;touch-action:none;cursor:default}
#boot{position:fixed;inset:0;display:grid;place-items:center;background:#05060d;z-index:5;transition:opacity .35s ease}
#boot.gone{opacity:0;pointer-events:none}
#boot .mark{font-family:"Lora",serif;font-size:clamp(22px,5vw,40px);letter-spacing:.34em;color:#ffe8a8;
  text-indent:.34em;opacity:.9;animation:breathe 2.4s ease-in-out infinite}
#boot .paw{width:54px;height:54px;margin:0 auto 18px;border-radius:50%;
  background:radial-gradient(circle at 50% 42%,#ffd98a,#c9871f 70%,#7a4f0c);
  box-shadow:0 0 42px rgba(255,201,102,.35)}
@keyframes breathe{0%,100%{opacity:.55}50%{opacity:1}}
@media (prefers-reduced-motion:reduce){#boot .mark{animation:none}}
</style>
</head>
<body>
<canvas id="game" width="960" height="540" aria-label="CAT LEGENDS"></canvas>
<div id="boot"><div><div class="paw"></div><div class="mark">CAT LEGENDS</div></div></div>
<script>
/* Failure net. Registered BEFORE the game bundle so it also catches a bundle
   that fails to parse — a try/catch inside the bundle cannot see that. Without
   this, any failure leaves the splash spinning forever with no explanation. */
(function () {
  var shown = false;
  function fail(detail) {
    if (shown) return;
    shown = true;
    var boot = document.getElementById('boot');
    if (!boot) { boot = document.createElement('div'); boot.id = 'boot'; document.body.appendChild(boot); }
    boot.className = '';
    boot.style.opacity = '1';
    boot.style.pointerEvents = 'auto';
    boot.innerHTML =
      '<div style="text-align:center;padding:24px;max-width:560px">' +
        '<div style="font-family:Lora,serif;font-size:26px;color:#ffe8a8;letter-spacing:.2em">CAT LEGENDS</div>' +
        '<div style="margin-top:14px;font-size:13px;line-height:1.7;color:#9aa8c8">' +
          'The game could not start in this browser.<br>' +
          'Try a recent Chrome, Safari, Firefox or Edge — and make sure JavaScript is enabled.' +
        '</div>' +
        (detail ? '<div style="margin-top:12px;font-size:11px;color:#5c6785;word-break:break-word">' + detail + '</div>' : '') +
        '<div style="margin-top:16px"><button onclick="location.reload()" style="font:inherit;font-size:13px;padding:9px 18px;border-radius:10px;border:1px solid rgba(255,201,102,.4);background:rgba(255,201,102,.12);color:#ffe8a8;cursor:pointer">Try again</button></div>' +
      '</div>';
  }
  window.addEventListener('error', function (e) {
    // Ignore errors that are not about the game failing to come up.
    if (document.getElementById('boot')) fail(e && e.message ? String(e.message) : '');
  });
  window.addEventListener('unhandledrejection', function () {
    if (document.getElementById('boot')) fail('');
  });
  // If the splash is still up after 15s, something stalled silently.
  setTimeout(function () {
    if (document.getElementById('boot')) fail('Timed out while loading.');
  }, 15000);
})();
</script>
<script>${js}</script>
</body>
</html>
`;

writeFileSync(OUT, html, 'utf8');
const kb = (statSync(OUT).size / 1024).toFixed(0);
console.log(`index.html  ${kb} KB  (js ${(js.length / 1024).toFixed(0)} KB, fonts inline)`);
