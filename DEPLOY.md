# Deploying CAT LEGENDS

The game is **one file**. `index.html` contains the HTML, CSS, JavaScript and both
webfonts inlined, and makes **no network requests of any kind after load**. There
is no build step at deploy time, no server, no database, and nothing to install.

That means every host below works, and the instructions are genuinely this short.

---

## Build the file

```bash
npm install          # once, for esbuild + the font packages
npm run build:web    # writes ./index.html  (~542 KB)
```

Verify it before shipping:

```bash
npm run verify       # checks it is self-contained and free of dev leftovers
```

You should see `index.html is self-contained.` If you do, the file will run from
any host — including `file://`, straight off a USB stick.

---

## Option 1 — GitHub Pages

The simplest permanent home for a project like this.

> **Check this before you deploy: Pages may already be occupied.**
>
> In this repository, Pages is **already enabled and serving `main`** at
> `https://kietbuithui-coder.github.io/Shapi-Farm-Android/`. That site is the
> APK-factory README, not this game — `main` does not contain `index.html`.
> Because a repository has exactly one Pages site, you cannot simply "turn on
> Pages" for this build as well: you must either merge it to `main` (replacing
> what is served there) or host it elsewhere. Options 2–4 below avoid the
> conflict entirely.
>
> Verify the current state at any time with
> `gh api repos/<owner>/<repo>/pages`.

> **Read this first if the repository is private.** GitHub Pages for a
> *private* repository requires a paid plan (Pro, Team or Enterprise). On a free
> account the Pages settings will refuse to publish, without a very clear
> explanation. Your options are:
>
> 1. Make the repository **public**, then follow the steps below (free), or
> 2. Keep it private and use **Option 2 (Netlify)** or **Option 3 (Vercel)** —
>    both deploy from a private repo on their free tiers, or
> 3. Keep it private and upload the single `index.html` to any static host, or
> 4. Just open `index.html` from disk (`file://`) — it needs no server at all.
>
> Do not confuse "private repository" with "private site". A public Pages site
> built from a public repo is public to anyone with the URL.

1. Build `index.html` and commit it to the branch you serve from.
   GitHub Pages serves from a branch folder or from Actions; the file version
   needs no workflow at all.
2. In the repository: **Settings → Pages → Build and deployment**
   - *Source*: `Deploy from a branch`
   - *Branch*: `main`, folder `/ (root)`
3. Save. The site appears at `https://<user>.github.io/<repo>/` within a minute.

Notes:

- `.nojekyll` is already committed at the repo root. Without it, GitHub runs
  Jekyll, which strips directories starting with an underscore — harmless today,
  but it silently breaks things the moment an asset is named `_something`.
- This game is deployed at a **sub-path** (`/<repo>/`), not a domain root. The
  build uses only relative, inline resources, so this works with no
  configuration. There are no absolute `/assets/...` paths to break.
- Serving from an `arena/...` feature branch works, but the PR has to be merged
  into `main` first for the normal branch setting to find it. You can point
  Pages at a feature branch to preview without merging.

## Option 2 — Netlify

1. Connect the repo, or drag the folder containing `index.html` onto
   <https://app.netlify.com/drop>.
2. If connecting the repo, set:
   - **Build command**: `npm run build:web`
   - **Publish directory**: `.` (the repo root — `index.html` is generated there)
3. Deploy.

`netlify.toml` is committed and already sets those two values, so no clicking is
required; Netlify reads it on import.

## Option 3 — Vercel

```bash
npx vercel --prod
```

`vercel.json` is committed with `buildCommand` and `outputDirectory`, so the
defaults are correct. Or import the repo at <https://vercel.com/new> and accept
the detected settings.

## Option 4 — any static host

Anything that serves files over HTTP works: S3 + CloudFront, Cloudflare Pages,
Firebase Hosting, nginx, Apache, a Raspberry Pi on your LAN.

Upload `index.html`. That is the entire deployment. Useful headers, if your host
lets you set them:

```
Content-Type: text/html; charset=utf-8
Cache-Control: public, max-age=300
```

A long cache is fine — the file is fully self-contained, so an update is one
atomic file replacement. There are no hashed asset names to keep in sync.

## Option 5 — no host at all

Double-click `index.html`. It runs from `file://` because nothing is fetched.
Useful for sharing over a USB stick or as a local backup copy.

---

## Android

Nothing to install. Open the deployed URL in Chrome.

- The **fullscreen button** (top-right, in the run HUD and in Settings) uses the
  real Fullscreen API. On Android Chrome this hides the browser chrome. It
  **does not and cannot hide the Android system navigation bar or status bar** —
  that is outside what a web page is allowed to control. The button reports
  honestly if the browser refuses (`Fullscreen unavailable here`).
- **Add to Home screen** gives a chromeless launch where the browser UI is gone
  entirely; this is the closest thing to a native install and requires no
  manifest work because the page already declares
  `apple-mobile-web-app-capable` and a `theme-color`.
- The layout is designed for landscape; portrait works but shows less of the
  arena. The game recomputes its framing and HUD from the viewport and safe-area
  insets on every resize and orientation change.

## iOS

Safari on iOS does not allow element fullscreen for anything except `<video>`.
The game detects this and shows *Fullscreen unavailable here* rather than
pretending. Everything else — touch controls, safe-area insets, Add to Home
Screen — works.

---

## Verifying a deployment

Run these against the deployed URL, not localhost:

```bash
# The page must load with a single request and no external assets.
curl -sI https://your-host/ | head -5

# Confirm nothing points outside the file.
curl -s https://your-host/ | grep -oE '(src|href)="[^"]*"' | grep -v 'data:' | head
# → expects no output (the only src/href values are data: URIs)

# Confirm the failure net and the bundle both made it.
curl -s https://your-host/ | grep -c 'requestFullscreen'
```

If you open the page and see the splash spinning for more than a few seconds, the
built-in failure net will replace it with a readable message and a **Try again**
button within 15 seconds. A blank screen with no message means the failure net
itself was stripped — check that your host is serving the `.html` unmodified.

---

## What this build does not do

Stated plainly, because guessing here wastes time:

- **No service worker / offline caching.** It works offline once the single file
  is loaded or saved, but there is no installable PWA shell.
- **No server-side leaderboards or accounts.** Progress is saved in
  `localStorage` per browser, and is not synced across devices.
- **No analytics or telemetry.** Nothing leaves the device.
- **No multi-file build.** `index.html` is the whole deliverable on purpose:
  it survives being emailed, zipped, or dropped behind any static host.
