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
npm test            # unit tests
npm run test:rules  # Firestore rules on the emulator (Java 21)
```
Both use file globs, because a bare `node --test test/` directory run reports a
spurious aggregate failure while every individual test passes.

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

## Planner setup
`/planner` is an unlisted planning page (robots noindex). Google sign-in, Firestore
on the Firebase Spark plan, and security rules in `firestore.rules` are the only
enforcement. Day-to-day use needs no setup; these steps are one-time.

1. **Firebase project** (personal Gmail): create the project, enable
   Authentication with the Google provider, add `sunnyandtrupti.com` to the
   authorised domains, create a Firestore database, and register App Check with
   a reCAPTCHA v3 key (start in monitoring mode). Put the web config into
   `js/firebase-init.js` and the site key into its App Check call, and set
   `HELP_WHATSAPP` in `js/planner/planner-config.js`.

   Sign-in runs on `sunnyandtrupti.com` (`authDomain`), so self-host the Firebase
   auth helpers: copy `handler`, `handler.js`, `experiments.js`, `iframe` and
   `iframe.js` from `https://<project-id>.firebaseapp.com/__/auth/` into `__/auth/`
   in this repo. After the push, verify `https://sunnyandtrupti.com/__/auth/handler`
   renders. GitHub Pages may serve the extensionless `handler` and `iframe` as
   downloads; if so, also save copies as `handler.html` and `iframe.html` (Pages
   resolves `/handler` to `handler.html`). Add
   `https://sunnyandtrupti.com/__/auth/handler` to the Google OAuth client's
   authorised redirect URIs.

   Deleting a label queries `in` plus `array-contains`, which may need a composite
   index. If so, Firestore returns a create-index link on the first label delete;
   open it and create the index.
2. **Rules:** run `npm test` and `npm run test:rules` (needs Java 21), then
   `npx firebase deploy --only firestore:rules --project <project-id>`.
3. **Starter labels:**
   `ACCESS_TOKEN=$(gcloud auth print-access-token) node test/rules/seed-labels.mjs <project-id>`.
   Creates the 20 starter labels; re-running skips labels that already exist,
   so renames and recolours are kept.
4. **Owners:** Sunny and Trupti each open `/planner`, sign in, and press
   Request access. In the Firebase console, create `members/<uid>` for each
   (copy the uid from their `access_requests` doc) with `role: "owner"`,
   `side: "groom"` or `"bride"`, and `email`, `name`, `photoURL`,
   `approvedAt` (timestamp), `approvedBy: "console"`. Then delete both
   `access_requests` docs. Adding a further Owner works the same way; the page
   can never create or edit an Owner.
5. **Everyone else** signs in and requests access; an Owner approves them from
   the Access tab in Full mode, as a Reader or as an Editor on the Owner's own
   side.

Local development: `npx firebase emulators:start --only firestore,auth --project demo-wedding`,
then `node test/rules/seed-dev.mjs` and serve the site on `localhost`. The page
talks to the emulators on localhost; seed users sign in with email and password
`password` from the browser console (there is no password UI in the page).

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
