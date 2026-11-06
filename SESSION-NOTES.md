# Session notes — handoff

Written at the end of the build session on **2026-11-06**. Read this first if you
are continuing the project.

---

## Where things stand

The game is **complete and shippable**. `index.html` boots, plays the whole loop
(home → cats → skills → run → level up → pause → death → results → home), and
the full test suite passes.

```
npm test                 # 48/48 pass, ~40 s
npm run verify           # index.html is self-contained
node tools/verify-fonts.mjs   # every Vietnamese glyph resolves
node tools/_boot.mjs     # full flow + screenshots in public/art-check/
```

Live preview: `npm start` → <http://localhost:8080/>.

Deliverable: **`index.html`**, ~528 KB, 294 KB JS, 11 inlined fonts, no network
access at runtime.

---

## Bugs found and fixed in this session

Each of these was a real, player-visible defect. They are listed here because
several were invisible to the test suite until a test was written for them.

### 1. Dash was dead code
`updatePlayer()` gated the dash on `p.energy >= 18`, but energy lives on the
`Run` (`run.energy`); `player.energy` was always `undefined`. **The dash never
fired for anyone.** Fixed to `this.energy >= DASH_COST`, with `DASH_COST` /
`DASH_CD` exported from `run.js` so the cost is defined once.

*Side effect:* the bot got much stronger once it could actually dodge. The
"bot must die within 900 s" assertion became a "bot must make progress"
assertion. Balance re-measured at avg depth 25.2/45 (was 25.5) — unchanged.

### 2. Healing resurrected the dead
`heal()` had no floor, and the death check runs at the *end* of `update()`, so
passive regen ticked a 0-HP corpse back to 0.2 and `playerDeath()` never fired.
`heal()` now returns 0 when `hp <= 0`, and passive regen is skipped while
downed. Death is sticky.

### 3. Every "denied" UI sound was silent
Call sites passed `audio.ui('denied')`, `'click'`, `'close'`, but the engine only
knew `'deny'`, `'tap'`, `'back'`, `'pick'` — unknown strings fell through with no
sound. Normalised at the source (`AudioEngine.UI_ALIASES`) and fixed the call
sites, so the "you can't afford that" feedback is audible.

### 4. 38 of 52 skills were unselectable
`drawSkillSelect` computed a grid from a fixed `cardW * 1.16` height capped at
132px and then did `if (y > h - safe.bottom - 20) return;`. At 1280×720 that
showed **14** skills; at 960×540, **5**. Everything else was silently dropped.
Replaced with `skillGridLayout()` (shared by drawing *and* click handling) plus a
pager: `skills:prev` / `skills:next`, `Trang 1/3`, clamped at both ends, reset on
re-entry. Verified at 8 viewport sizes from 390×844 to 1920×1080.

### 5. Perk rows hid their own effect
`drawUpgrades` never rendered `line.label` ("+6% sát thương"). Every row was a
bare name and a price. Now name + effect line, pips right-aligned before the
price, list widened to 640px.

### 6. Skill pager arrows pointed the wrong way
The arrow path put the tip at `cx - dir * 3.5` and the wings at `+`, so "next"
rendered as `<`. Fixed.

### 7. `sanitize()` let tampered perks through the UI
Perk tiers clamped to 99 instead of `PERK_TIERS`, so a hand-edited save rendered
"99/4". Now clamped at the save boundary.

### 8. `npm test` didn't run
`node --test tests/` treats the directory as a module specifier on Node 22 and
fails with `MODULE_NOT_FOUND`. Script is now `node --test tests/*.test.mjs`
(42 tests instead of 1 failure).

### 9. Three controller bugs made the pad half-useless
- `_pollPad()` returned `null` whenever the stick was centred, so **dash and all
  four skills were dead while standing still**.
- `poll()` built its cast array with `this.pressed.cast[2] || false` — slot 3 had
  no pad fallback, so `Y` did nothing.
- `poll()` only read `this.pressed.dodge` (keyboard), never `pad.dodge`.
- Also: `down(1) === false && false` in the pad cast map was always false, and a
  held dash button now edge-detects instead of re-firing every frame.
Covered by `tests/input.test.mjs`.

### 10. Collection screen printed its own title twice
The page heading and the right-rail heading both used `tr(lang, 'collection')`.
Added a dedicated `achievements` string ("Thành Tựu" / "Achievements") for the
rail. `tests/verify.mjs` does not catch this kind of copy bug — it needs eyes.

### 11. Settings used only the left half of the screen
~55% of the screen was empty background. Added a right rail with profile stats,
the control list, and the armed-reset warning copy. Layout is conditional on
`w >= 900` so it never crowds a small window.

### 12. Missing glyphs in *screenshots* (not in the game)
Screenshots read `CHÍN ÊM D I ÁNH TRĂNG` — `đ ơ ư ộ ậ` were blank. This was
**not** a shipping bug: `@napi-rs/canvas` has no `unicode-range` support, so
registering both subsets under one family name made the later file win, and it
lacks the Vietnamese glyphs. `tools/verify-fonts.mjs` parses the WOFF `cmap`
tables and the shipped `@font-face` rules to prove the real page is correct.

Fix for the harness only: register subsets under separate families and rewrite
`ctx.font` to a fallback list (`tests/dom.mjs` → `patchFonts`). **Do not** add
that to `src/`; browsers do this natively.

---

## Things that look like bugs but are not

- **"Vượt" / "Tim" / "Da"** in the upgrades screen are complete Vietnamese words,
  not truncation. The data uses single-word perk names.
- **Stat labels touching bars** on the cat screen: measured at 1:1, they clear.
  It was an artifact of viewing a downscaled screenshot.
- **The 4th skill slot looks empty** in the skills screenshot: the `triple_scratch`
  icon is dark by design. Zoom before concluding.

---

## Conventions to keep

- `Run` stays headless (no DOM, no audio, no timers). This is what makes the
  tests and bots possible.
- `finishRun()` must stay idempotent (guarded by `this.ending`) — `tick()` calls
  it every frame while the results fade runs.
- Pause is intent-based: `togglePause(true | false)`, never a bare toggle.
- Use `roundRect` from `src/ui/theme.js`, never `ctx.roundRect`.
- `buffValue(kind)` is additive; never multiply movement.
- Strip `base64,[A-Za-z0-9+/=]+` before scanning built HTML for placeholder
  words — random font bytes contain "TODO".
- Layout that both draws and hit-tests must live in one function (see
  `skillGridLayout`), or the two drift apart.
- Any new on-screen string must be checked by `tools/verify-fonts.mjs` for
  diacritic coverage.

## Not available in this environment

- Playwright / any real browser (downloads blocked). `tests/bundle.test.mjs`
  runs the built bundle in `node:vm` with a canvas shim instead.
- Java / Android SDK. The original repo was an Android wrapper; it was removed.
  This is a web build.

## If you pick this up

1. `npm install && npm test` — confirm 48/48 green before changing anything.
2. Look at `public/art-check/boot-*.png`; they regenerate with
   `node tools/_boot.mjs`.
3. Probably worth doing next:
   - **Real device playtest.** Touch layout is verified by geometry only; the
     virtual stick and buttons have never been used by a thumb.
   - **Difficulty pass.** Sphynx dies at depth ~1 on 2 of 3 seeds, and Bengal
     swings between depth 3 and 7. `node tools/tune.mjs` has the table.
   - **`index.html` head polish.** It currently has no `og:` tags or favicon
     beyond what the build inlines. Harmless, but it is the one rough edge on
     the deliverable.
