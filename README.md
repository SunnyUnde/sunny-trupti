# Sunny & Trupti — Engagement Invitation

A single-page static engagement invitation site (modern + traditional Maharashtrian style) with a live countdown, event details, RSVP, and venue map.

## Run locally
Open `index.html` directly in a browser, or serve it:
```
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Edit
- **Names, date, time, venue, blessing, invite line:** plain text in `index.html`.
- **Countdown target date/time:** the `target` constant in `js/countdown.js`.
- **RSVP form link / Google Maps link:** the `href` attributes in `index.html`.
- **Colours & fonts:** CSS custom properties at the top of `css/styles.css`.

## Tests
`node --test` runs the countdown logic unit tests in `test/`.

## Deploy
Static site — host the folder on GitHub Pages, Netlify, Cloudflare Pages, or any static host. No build step.

## Files
- `index.html` — page markup (6 sections)
- `css/styles.css` — all styling
- `js/countdown.js` — live countdown logic (+ unit-testable `getRemaining`)
- `test/countdown.test.js` — countdown unit tests
