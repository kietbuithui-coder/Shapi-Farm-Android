// Entry point. Boots the game on the canvas in index.html, and degrades with a
// readable message instead of a blank screen if anything fails.
import { Game } from './game.js';

function boot() {
  const canvas = document.getElementById('game');
  const bootEl = document.getElementById('boot');
  if (!canvas) return;
  try {
    const game = new Game(canvas);
    globalThis.__catLegends = game; // debug handle (also used by the test harness)
    if (bootEl) {
      // one frame of real rendering behind the splash, then reveal
      requestAnimationFrame(() => {
        bootEl.classList.add('gone');
        setTimeout(() => bootEl.remove(), 420);
      });
    }
  } catch (err) {
    console.error(err);
    if (bootEl) {
      bootEl.innerHTML =
        '<div style="text-align:center;padding:24px;max-width:520px">' +
        '<div style="font-family:Lora,serif;font-size:26px;color:#ffe8a8;letter-spacing:.2em">CAT LEGENDS</div>' +
        '<div style="margin-top:14px;font-size:13px;line-height:1.6;color:#9aa8c8">' +
        'This browser could not start the game.<br>Try a recent Chrome, Safari, Firefox or Edge.</div>' +
        '<div style="margin-top:12px;font-size:11px;color:#5c6785">' + String(err && err.message ? err.message : err) + '</div>' +
        '</div>';
    }
  }
}

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
