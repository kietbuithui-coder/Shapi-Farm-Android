# CAT LEGENDS — Chín Đêm Dưới Ánh Trăng

A nine-night action roguelite starring ten cats. Vanilla ES modules, Canvas 2D,
**zero runtime dependencies**, and it ships as one self-contained HTML file that
works offline.

> **Play it:** open `index.html` in any modern browser. No server, no build step
> needed — every font and every byte of JavaScript is inlined.

---

## Play

You pick a cat, pick four skills, and fight through nine nights of a moonlit
terrace. Waves get heavier, elites appear mid-run, and each night ends with a
boss. Die and you keep the **embers** you earned, which buy permanent upgrades
and new cats/skills for the next attempt.

### Controls

| Action | Keyboard | Touch / gamepad |
| --- | --- | --- |
| Move | `WASD` / arrow keys | left virtual stick, left analogue stick |
| Dash (i-frames) | `Space` / `Shift` | dash button, `A` (`LB`/`RT` also work) |
| Cast slot 1–4 | `1` `2` `3` `4` | four skill buttons, `X` `B` `Y` `RB` |
| Pause | `Esc` / `P` | pause button in the HUD, `Start`/`Select` |
| Basic attack | automatic | automatic |

`AUTO` in the bottom-left hands the run to the bot — useful to watch how a build
plays out.

### The loop

1. **Home** → `Mèo` (cats), `Kỹ Năng` (skills), `Cường Hóa` (upgrades), `Bộ Sưu Tập` (collection), `Cài Đặt` (settings).
2. Choose a cat and fill all four skill slots, then `Xuất Phát` to start.
3. Clear five waves per night. Level-ups offer three cards; boss nights add a
   reward pick after the kill.
4. Death or victory → **results** with embers. Spend them in `Cường Hóa` and on
   locked cats/skills.

The skill screen pages when the pool does not fit (`Trang 1/3`), so all 52
skills are reachable at any window size.

### Language

Bilingual Vietnamese/English, switchable in `Cài Đặt`. Vietnamese is the default
and the fonts carry the full diacritic set (`đ ơ ư ộ ậ ế …`).

---

## Develop

```bash
npm install          # dev-only: esbuild, @napi-rs/canvas, two font families
npm start            # static server on 0.0.0.0:8080
```

Then open <http://localhost:8080/>. The server serves the built `index.html`;
`src/` is only used by the tooling, not by the page.

### Commands

| Command | What it does |
| --- | --- |
| `npm start` | Serve the repo on port 8080 (`node scripts/serve.mjs [port]`) |
| `npm test` | Full suite (48 tests) — engine, progression, audio, input, bundle |
| `npm run build:web` | Bundle `src/` + inline fonts → `index.html` |
| `npm run verify` | Self-containment + placeholder check on `index.html` |
| `npm run art` | Re-render the art sheets into `public/art-check/` |
| `node tools/_boot.mjs` | Headless full-flow boot → `public/art-check/boot-*.png` |
| `node tools/verify-fonts.mjs` | Prove every Vietnamese character resolves to an inlined glyph |
| `node tools/render-scene.mjs <n>` | Render one gameplay scene for art review |
| `node tools/tune.mjs` / `node tools/deathlog.mjs <cat> <seed>` | Balance passes |

`tools/` and `tests/` are developer-only; nothing in either ships.

### Architecture

```
src/
  main.js              entry: boots Game on #game, splash, error fallback
  game.js              Game shell — scenes, transitions, overlays, profile,
                       pause, run lifecycle (startRun/finishRun), clicks
  systems/
    run.js             the engine: Run class, arena, waves, combat, skills,
                       cooldowns, energy, dash, spawning, night scaling
    bot.js             autoplayer (also drives the AUTO button and balance tests)
    stats.js           stat assembly from cat + perks + in-run upgrades
    presentation.js    event bus → particles, camera shake, audio, numbers
    pool.js            object pooling for projectiles/particles
  ui/
    scenes.js          every menu screen + the shared layout helpers
    hud.js             in-run HUD (bars, skill slots, wave banner)
    theme.js           text/panel/button primitives, roundRect, meters
    touch.js           virtual stick + buttons
  art/
    renderer.js        camera, DPR, world draw order, arena fit
    env.js             sky, garden, town, terrace, playfield surface
    actors.js          cats and creatures
    catart.js          the ten cat portraits
    creatureart.js     enemy/boss art
    fx.js              slashes, rings, impacts
    icons.js           the vector icon set
  data/
    cats.js skills.js perks.js upgrades.js achievements.js enemies.js acts.js
    palette.js strings.js
  core/
    save.js            ProfileStore: versioned schema, sanitize, backup/recovery
    rng.js math.js events.js clock.js camera.js
  audio/audio.js       Web Audio synth — no audio files
```

#### Design notes worth knowing before you change things

- **The engine is headless.** `Run` never touches the DOM, so the same code runs
  in the browser, in tests and in the bots.
- **Energy lives on the `Run`, not the player** (`run.energy`). Anything that
  gates on energy must read it there.
- **Death is sticky.** `heal()` refuses to revive a downed player and passive
  regen stops at 0 HP, because the death check runs at the end of the tick.
- **`finishRun()` must stay idempotent.** The results fade calls into it every
  frame; a second call would reset the fade and stall the transition.
- **Pause is intent-based** — `togglePause(true|false)`, never a bare toggle.
- **Fonts need `unicode-range`.** Latin and Vietnamese are separate subsets; a
  face without the right range renders `đ ơ ư` as blanks.

### Testing

```
tests/combat.test.mjs       13 engine invariants — movement, bounds, i-frames,
                            energy/cooldown gating, all 42 skills fire, bot runs,
                            waves, bosses, death, ground plane
tests/progression.test.mjs  13 — save round-trip, corrupt/backup recovery,
                            sanitize hostile data, perk/cat/skill purchase,
                            achievements, payout, skill-grid reachability
tests/audio.test.mjs        10 — silent-when-unavailable, gain graph, every cue
                            audible, music timers, level-up/victory arpeggios
tests/input.test.mjs         6 — gamepad dash/skills with a centred stick, held
                            buttons don't repeat, dead zone, keyboard one-shots
tests/bundle.test.mjs        6 — boots the built index.html in a VM, asserts it
                            paints, loads nothing from the network, no console
                            noise, fonts cover Vietnamese
```

`tests/dom.mjs` provides the DOM/canvas shim used by the progression and boot
harness. It also fixes a headless-renderer quirk: `@napi-rs/canvas` has no
`unicode-range` support, so it registers the subsets separately and rewrites
`ctx.font` to a fallback list. **The shipped page does not need this** — browsers
handle `unicode-range` natively; `tools/verify-fonts.mjs` checks the real rules.

There is no Playwright in this environment (browser downloads are blocked), so
`tests/bundle.test.mjs` runs the actual bundle in a `node:vm` context with a
canvas shim instead. It is a real regression net for the shipped artifact, not a
substitute for a human looking at it.

### Build output

`index.html` is ~528 KB (294 KB of JS + 11 inlined WOFF faces). `npm run verify`
enforces that:

- no `<script src>`, no external stylesheet, no `http(s)://` URL
- no `data:image/` payloads (all art is drawn with Canvas 2D)
- at least 8 inlined `@font-face` blocks
- no `TODO` / `FIXME` / `lorem ipsum` / replacement characters

### Balance

`node tools/tune.mjs` runs the bot across cats and seeds and reports depth
reached. Current spread sits around **avg depth 25 / 45** on a fresh profile.

---

## Credits

Art, code, sound synthesis and text are original to this project. Typefaces:
[Lora](https://fonts.google.com/specimen/Lora) and
[Be Vietnam Pro](https://fonts.google.com/specimen/Be+Vietnam+Pro), both SIL Open
Font License, subsetted and inlined at build time.
