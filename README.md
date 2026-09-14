# Sunny & Trupti Wedding Invitation

A two-page static invitation site (bilingual Marathi/English, modern with a
traditional Maharashtrian style). Hosted on GitHub Pages at the custom domain in
`CNAME` (sunnyandtrupti.com). No build step.

## Pages
- **`/` (`index.html`): the wedding invitation.** Save-the-date for Sunday,
  24 January 2027 at Laxmi Trimbak Mangal Karyalay, with a live countdown, event
  details, add-to-calendar buttons, and venue directions. Links to the
  engagement page from its footer.
- **`/engagement` (`engagement.html`): the engagement, as a completed memory.**
  Saturday, 4 July 2026 at Davkhar Mangal Karyalay. No countdown; a "happily
  engaged" banner and past-tense copy instead. Links back to the wedding page.

GitHub Pages serves a top-level `foo.html` at the pretty URL `/foo`, so
`engagement.html` is reachable at `/engagement`. Relative asset paths
(`css/...`, `js/...`) resolve correctly from that pretty URL.

## Bilingual
Every visible string carries `data-en` and `data-mr` attributes. `js/i18n.js`
swaps them on toggle and remembers the choice in `localStorage`. The
`html[lang="mr"]` blocks in `css/styles.css` drop the letter-spacing and
uppercasing that break Devanagari conjuncts and matras.

## Run locally
```
python3 -m http.server 8000   # then visit http://localhost:8000
```
Opening `index.html` directly in a browser also works, except the `/engagement`
pretty URL: open `engagement.html` instead when serving from the filesystem.

## Edit
- **Names, dates, times, venues, copy:** plain text (both `data-en` and
  `data-mr`) in `index.html` and `engagement.html`.
- **Countdown target:** the `data-target` attribute on the `.countdown` element
  in `index.html` (ISO 8601 with timezone, e.g. `2027-01-24T00:00:00+05:30`).
  `js/countdown.js` reads it from the DOM, so no code change is needed to move
  the date.
- **Calendar and Maps links:** `href` attributes in the HTML. The wedding
  all-day calendar file is `wedding.ics`.
- **Colours and fonts:** CSS custom properties at the top of `css/styles.css`.
  Every colour and both font stacks are tokens there. `html[lang="mr"]` swaps
  the two font tokens; the `prefers-color-scheme: dark` block at the bottom of
  the file swaps the colour tokens. No component rule needs to know about either,
  so a new element picks up Marathi and dark mode for free.
- **Social share cards:** `img/og-cover.png` (wedding) and
  `img/og-engagement.png` (engagement), 1200x630. Each page references its own
  card from `og:image`, `twitter:image`, and the JSON-LD `image`.

## Tests
```
node --test test/countdown.test.js test/intro.test.js
```
Run the two files explicitly (a bare `node --test test/` directory run reports a
spurious aggregate failure while every individual test passes).

## Fonts
Self-hosted in `fonts/`, declared in `css/fonts.css`. This keeps the critical
path on one origin rather than paying a DNS plus TLS round trip to
`fonts.googleapis.com` and another to `fonts.gstatic.com`. Only the subsets the
pages can render are shipped (Latin for Cormorant and Montserrat, Devanagari for
Tiro, and Tangerine subset to the single `&` glyph): 195 KB across 5 files.

Tiro's Latin subsets are deliberately absent. In Marathi mode the few Latin
strings fall through to Cormorant and Montserrat, which reads better and saves
39 KB.

To regenerate after changing a family or weight range: fetch each Google Fonts
`css2` URL with a browser User-Agent (otherwise you get TTF, not woff2), keep
only the `@font-face` blocks whose subset comment you want, download each
`woff2` into `fonts/`, and rewrite each `src` URL to the local path.

## Deploy
Static site, no build step. Push to `main`; GitHub Pages serves it at the domain
in `CNAME`. After changing a page's OG image or meta, a previously shared link
may still show a cached card: re-scrape it through the Facebook Sharing Debugger
("Scrape Again") to refresh.

## Files
- `index.html` : wedding homepage (hero, note, details, venue, footer)
- `engagement.html` : engagement memory page, served at `/engagement`
- `404.html` : not-found page
- `css/styles.css` : tokens, layout, the `html[lang="mr"]` font swap, dark mode
- `css/animations.css` : intro, scroll reveals, hero petal drift, divider draw
- `css/fonts.css` : `@font-face` declarations for the self-hosted families
- `fonts/` : woff2 files, subset to what the pages actually render
- `js/countdown.js` : live countdown, target read from `.countdown[data-target]`;
  days/hours/minutes only, repainting every 30s. Counts up from zero once the
  intro clears, but always paints the true value if the tween cannot run (hidden
  tab, reduced motion, throttled rAF). Pure `getRemaining`, `formatUnits`,
  `easeOutCubic` and `shouldCountUp` are unit-tested; a safe no-op on pages
  without a countdown
- `js/i18n.js` : Marathi/English toggle with `localStorage` persistence
- `js/intro.js` : cinematic intro, Skip control, reduced-motion gate, scroll
  reveals. Plays once per session (`sessionStorage`), so hopping between the two
  pages does not replay it. Emits `intro:done` on every path so the hero's own
  entrance has one signal to hang off (unit-testable `shouldPlayIntro`)
- `test/countdown.test.js`, `test/intro.test.js` : unit tests
- `img/og-cover.png`, `img/og-engagement.png` : social share cards (1200x630)
- `sitemap.xml`, `robots.txt`, `site.webmanifest` : SEO and PWA metadata
- `wedding.ics` : all-day calendar file for the wedding
- `CNAME` : custom domain for GitHub Pages
