# CAT LEGENDS — Chín Đêm Dưới Ánh Trăng

A nine-night action roguelite starring ten cats. Vanilla ES modules, Canvas 2D,
**zero runtime dependencies**, and it ships as one self-contained HTML file that
works offline.

> **Play it:** open `index.html` in any modern browser. No server, no build step
> needed — every font and every byte of JavaScript is inlined.

---

## Play

> **Want it on Android?** Read [`APK.md`](APK.md) first. There *is* an APK in
> this repository's Releases, but it wraps an earlier game, not this one. This
> build plays in any browser, and on a phone you can add it to the home screen.

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

1. **Home** → `Mèo` (cats), `Kỹ Năng` (skills), `Cường Hóa` (upgrades), `Bộ Sưu Tập` (collection), `Sổ Tay` (codex), `Cài Đặt` (settings).
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
| `npm test` | Full suite (142 tests) — engine, progression, audio, input, bosses, codex, deploy, bundle |
| `npm run build:web` | Bundle `src/` + inline fonts → `index.html` |
| `npm run verify` | Self-containment + placeholder check on `index.html` |
| `npm run art` | Re-render the art sheets into `public/art-check/` |
| `node tools/_boot.mjs` | Headless full-flow boot → `public/art-check/boot-*.png` |
| `node tools/verify-fonts.mjs` | Prove every Vietnamese character resolves to an inlined glyph |
| `node tools/render-scene.mjs <n>` | Render one gameplay scene for art review |
| `node tools/tune.mjs` | Balance sweep (seeded and reproducible) |
| `node tools/deathlog.mjs <cat> <seed>` | Where and why a run ended |
| `node tools/render-bosses.mjs` | Render both new bosses in-engine, both phases |

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
    actors.js          cats and creatures (incl. summon materialisation)
    catart.js          the ten cat portraits
    creatureart.js     enemy/boss art
    fx.js              slashes, rings, impacts
    icons.js           the vector icon set
  data/
    cats.js skills.js perks.js upgrades.js achievements.js enemies.js acts.js
    palette.js strings.js
    wiki.js            codex: 8 categories derived from the data files above,
                       plus discovery helpers
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
tests/bosses2.test.mjs      17 — the two new bosses: every declared attack is
                            implemented and has an effect, every phase is
                            reachable in a live fight, walls block and expire,
                            no attack repeats twice in a row, every dangerous
                            attack on every boss is telegraphed and reactable,
                            summons cannot hit on their spawn frame, phase 2 is
                            visually distinct
tests/wiki.test.mjs         10 — codex: exactly 8 categories, every category
                            covers its real data, follows a changed stat,
                            nothing revealed without discovery, playing
                            discovers things, icons exist, both languages full
tests/deploy.test.mjs        7 — deploy configs are coherent
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

`index.html` is ~585 KB (349 KB of JS + 11 inlined WOFF faces). `npm run verify`
enforces that:

- no `<script src>`, no external stylesheet, no `http(s)://` URL
- no `data:image/` payloads (all art is drawn with Canvas 2D)
- at least 8 inlined `@font-face` blocks
- no `TODO` / `FIXME` / `lorem ipsum` / replacement characters

### Balance

`node tools/tune.mjs` runs the bot across cats and seeds and reports depth
reached. Current spread sits around **avg depth 15 / 45** on a fresh profile.

That number is deliberately lower than it used to be (27.5). The tuning round
after release applied a 10% cut to cat stats, tightened every attack hitbox to
85% and stretched the XP curve by 35%; measured one at a time, those cost 6.1,
1.6 and 4.5 depth respectively. Each was asked for, and each makes the game
harder — the sweep is reported as it is, not adjusted back to the old figure.

The sweep is **deterministic**: the bot's strafe timer used `Math.random`, which
made two runs of the same build differ by three whole nights and made every
A/B comparison meaningless. It now draws from a local seeded generator that is
kept separate from the run's own RNG stream — drawing bot noise from the main
stream would shift spawns, crits and loot, and you would be measuring the dice
rather than the change.

---

## What is in it

### Roster

**15 enemies** and **5 bosses**, each with its own silhouette, colour and AI. The
five added in this pass are not recolours — each asks a different question:

- **Crystal crawler** — a slow armoured advance that never stops and never
  speeds up. You route around it; you cannot outrun the problem.
- **Explosive slime** — creeps in, then *plants* while its bomb arms. The
  telegraph means exactly what it says, and the answer is to leave the circle.
- **Shadow stalker** — fades, closes from behind, then snaps solid and strikes
  in a straight line. Lateral movement beats it.
- **Thorn beast** — a siege attacker that holds long range and lays thorns. It
  will not come to you, so you have to go to it.
- **Banshee** — keeps its distance and screams, slowing you.

That is five different counter-plays rather than five more hit points.

| Boss | Act | Phases | The shift in phase 2 |
| --- | --- | --- | --- |
| Moon Devourer | 1 | 3 | Gains **eclipse** (a closing ring) in phase 2, then drops the fan shot for **moonBeam** + enrage in phase 3 |
| Lantern King | 2 | 3 | Gains **lanternNova** from phase 2, and phase 3 leads with it while keeping dash pressure |
| Hollow Ninth | 3 | 4 | Gains **nineLash** from phase 2; a fourth phase at 12% drops blink claws and keeps only lash + echo |
| **Void Predator** | 2 | 3 | **Stops retreating and hunts.** Phase 1 is a skirmisher that punishes chasing; phase 2 removes the retreat, so the answer changes from "close the gap" to "keep moving" |
| **Crystal Queen** | 3 | 3 | **Turns her own walls into spikes.** Phase 1 is zoning with real solid cover; phase 2 shatters that cover into hazards and adds an aimed beam. She gains a visible aura and orbiting shards so the change is readable |

From night ten the bosses rotate, so a long run meets all five rather than
repeating the first three.

### Telegraphs

Every dangerous attack warns before it lands, and nothing resolves faster than
a human can react (0.35 s floor, enforced by a test). Delayed hazards draw their
own ground telegraph, so the boss-side tell only has to signal the wind-up.
Summoned minions spend a short materialisation window in which they cannot act,
drawn as a contracting ring — an invisible grace period would just move the
unfairness rather than remove it.

### Codex

Eight categories — bestiary, bosses, skills, cats, embers, upgrades, world,
feats — with every entry **locked until you meet it**. Nothing is copied: the
codex reads the same definition objects the combat code runs, so a balance
change updates the manual with it. Locked entries are shown as sealed tiles
rather than hidden, because a codex that silently omits things gives you no
sense of what is left to find.

Discovery is recorded in `profile.seen` and persists across runs and devices
via the normal save.

### Arena

The playfield is 1570 × 660 with a 96–1474 × 250–506 playable region:
**352,768 px² against 252,928 px² before, +39.5% real floor**. (The arena width
grew 1180 → 1570, which is +33.1%; the playable area grows slightly faster
because the side margins are a fixed 96px rather than a percentage. Both figures
sit inside the requested 25–50% band.) It is real playable
space, not a zoom-out: the camera, the spawn bands, the wall derivation and the
HUD safe areas all follow the new bounds, and the mobile tests assert the
invariants rather than a fixed width.

### On a phone

The HUD is computed from the viewport and the safe-area insets, never from one
global CSS scale, so notched phones and landscape play both lay out correctly.
Touch controls get their own layer with no overlap against the HUD. Fullscreen
uses the real Fullscreen API — on Android the browser may keep its system bars
visible, and the game does not pretend otherwise.

---

## Credits

Art, code, sound synthesis and text are original to this project. Typefaces:
[Lora](https://fonts.google.com/specimen/Lora) and
[Be Vietnam Pro](https://fonts.google.com/specimen/Be+Vietnam+Pro), both SIL Open
Font License, subsetted and inlined at build time.
