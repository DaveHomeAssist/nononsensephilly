# No Nonsense Collective site

Source for [nononsensephilly.com](https://nononsensephilly.com): Philadelphia after-hours events, DJ, sound and lighting rentals, and artist booking from No Nonsense Collective. It is a static site served by GitHub Pages from `main`, with a small Vercel service for the forms and the day-of address drop.

## Layout

| Path | Contents |
| --- | --- |
| `index.html`, `404.html` | Home page and not-found page |
| `artists/`, `events/` | Artist and event pages |
| `rentals/`, `gear/` | DJ, sound and lighting rentals, and the gear explorer |
| `flyer-kit/` | Flyer Kit Studio |
| `ford/` | PCV job console (internal; not indexed) |
| `media/` | Shared images and media |
| `privacy/` | Privacy page |
| `find.js`, `data/` | Site search and its data |
| `scores-api/` | Source of the `nononsense-scores` Vercel service (below) |
| `tools/`, `docs/` | Maintenance scripts and notes; start with `docs/updating-the-site.md` |
| `tests/` | Checks for search, signup consent and the confirmation page |

`CNAME` sets the custom domain. `.nojekyll` turns off Jekyll processing, so files are served as they are.

## The scores service

`scores-api/` is a separate Vercel project, `nononsense-scores`. The site's forms call it for:

- Drop-list signups. A confirmation email goes out, and a contact is added only after the recipient presses Confirm.
- Contact and rental requests, which go to the crew inbox.
- The day-of address drop. The address is stored outside this repo and shown only after the reveal time.

Admin pages and exports need a token set in Vercel. Tokens never go in this repo. `docs/updating-the-site.md` has the details.

## Checks

The `site-check.yml` workflow runs on GitHub. The scripts in `tests/` can be run with Node:

```sh
node tests/search.mjs
node tests/signup-consent.mjs
node tests/confirmation-page.mjs
```

## Publishing

Pushing to `main` publishes the site; there is no build step. `scores-api/` runs on Vercel, not on GitHub Pages. Moving or renaming this repo changes the Pages setup, so do neither without a redirect plan.

## For agents

Read [AGENTS.md](AGENTS.md) first.
