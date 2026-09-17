# PBUI Trainer

A study companion for the [Personal Body Unit Index](https://cwandt.com/products/personal-body-unit-index) poster by CW&T. The poster lists 17 ways to measure things with your body (your fathom, your cubit, your span…) and you write your own numbers on it. This app recreates the poster on screen, walks you through entering your measurements, then quizzes you until every number is committed to memory, so you can size things up when you're nowhere near the wall.

**Use it:** https://jamesstern.github.io/pbui/

Unofficial. The poster design and artwork are © CW&T; buy the real thing, it's great on a wall.

## How it works

1. **Measure.** Step through the 17 units. Each step shows the row of the poster with the dimension you're measuring lit up, plus a plain-language how-to. Type inches any way you like: `18 1/2`, `18.5`, `7'9"` or `47 cm`.
2. **Poster.** Your index, filled in by hand, as on the wall.
3. **Quiz.** Each unit climbs through four levels: 2 choices, 3 choices, 4 choices that crowd the true value, then type it from memory. A correct answer without hints moves it up a level; a miss drops it one. Typing it right in two separate rounds commits the unit to memory. Wrong answers come back later in the same round. There's always a hint button (range, then whole inches, then the answer), and hints cost points.
4. **Progress.** Per-unit levels, rounds, points, best streak.

Everything is stored on the device. Export/Import moves your index between devices.

## Install on iPhone (works offline afterwards)

1. Open the link above in **Safari** (online this one time).
2. Tap **Share ⇧ → Add to Home Screen → Add**.
3. Open it **from the new icon once while still online** so the app saves every file to the phone.
4. Done. It opens with or without signal from then on. When a new version is published, the app shows an update toast on launch.

On Android/Chrome, use the browser's **Install app** prompt.

## Development

No build step, no dependencies.

```bash
python3 -m http.server 8765        # then open http://localhost:8765/
node tests/tests.js                # parsing, quiz engine, and build guards
python3 tools/extract_figures.py   # regenerate assets/figures/ from photos (needs the Source Images folder, not in the repo)
python3 tools/make_icons.py        # regenerate icons/
```

### Deploying an update

1. Bump `VERSION` in `sw.js` **and** `APP_VERSION` in `js/version.js` (the tests fail if they disagree).
2. `node tests/tests.js`
3. Commit and push to `main`; GitHub Pages redeploys in a minute or two.

## Layout

```
index.html            app shell + iOS meta tags
manifest.webmanifest  PWA manifest
sw.js                 service worker: precache everything, cache-first
css/style.css         the app and the poster styles
js/units.js           the 17 units: labels, poster geometry (1000 x 1900 = 10" x 19"), how-to text
js/measure.js         parse + format inches (fractions, decimals, feet, cm)   [pure]
js/quiz.js            levels, scheduling, distractors, scoring, hints          [pure]
js/store.js           localStorage, export/import
js/poster.js          builds the poster SVG; fill values, spotlight, crop to a row
js/ui.js              screens, routing, service worker registration
assets/figures/       the line drawings, lifted from photos of the print
assets/fonts/         self-hosted Space Mono + Caveat
icons/                PWA icons
tools/                figure extraction and icon generators
tests/tests.js        node tests
```
