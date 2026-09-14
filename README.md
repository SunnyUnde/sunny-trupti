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
- **Social share cards:** `img/og-cover.png` (wedding) and
  `img/og-engagement.png` (engagement), 1200x630. Each page references its own
  card from `og:image`, `twitter:image`, and the JSON-LD `image`.

## Tests
```
node --test test/countdown.test.js test/intro.test.js
```
Run the two files explicitly (a bare `node --test test/` directory run reports a
spurious aggregate failure while every individual test passes).

## Deploy
Static site, no build step. Push to `main`; GitHub Pages serves it at the domain
in `CNAME`. After changing a page's OG image or meta, a previously shared link
may still show a cached card: re-scrape it through the Facebook Sharing Debugger
("Scrape Again") to refresh.

## Files
- `index.html` : wedding homepage (hero, note, details, venue, footer)
- `engagement.html` : engagement memory page, served at `/engagement`
- `404.html` : not-found page
- `css/styles.css` : all styling, including the `html[lang="mr"]` overrides
- `css/animations.css` : intro and scroll-reveal animation layer
- `js/countdown.js` : live countdown, target read from `.countdown[data-target]`
  (unit-testable `getRemaining`); a safe no-op on pages without a countdown
- `js/i18n.js` : Marathi/English toggle with `localStorage` persistence
- `js/intro.js` : cinematic intro, Skip control, reduced-motion gate, scroll
  reveals (unit-testable `shouldPlayIntro`)
- `test/countdown.test.js`, `test/intro.test.js` : unit tests
- `img/og-cover.png`, `img/og-engagement.png` : social share cards (1200x630)
- `sitemap.xml`, `robots.txt`, `site.webmanifest` : SEO and PWA metadata
- `wedding.ics` : all-day calendar file for the wedding
- `CNAME` : custom domain for GitHub Pages
