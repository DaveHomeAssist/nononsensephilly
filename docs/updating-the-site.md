# Updating the site

The site is still one `index.html` on GitHub Pages. Events, artists, and rental gear now live in `data/*.json`, and one script writes them into the page.

```
node tools/build.mjs                  # after any data change
node tools/build.mjs --og             # also redraw share images (needs Playwright)
node tools/build.mjs --check          # fail if an image in media/ has EXIF/GPS data
```

For `--og`, point at Playwright if it isn't installed in the repo: `PLAYWRIGHT_MODULE=/path/to/playwright/index.js`.

## Add a show
1. Put the flyer in `media/flyers/` as `<slug>.webp` (1440×1800) and `<slug>-card.webp` (720×900).
2. Add a record to the top of `data/events.json`. Copy an existing one. For a sale:
   - `"status": "on-sale"` and `"ticketUrl": "https://…"`. That one link feeds the Home button, the Tickets page, the event card, and the event page.
   - Quiet room: `"venue": { "name": null, "area": "Kensington", "public": false }`. Only the area shows.
   - Door rules: `"door": { "age": "21+ with ID", "reentry": "…", "bring": "…", "floor": "Phone-free floor" }`.
   - Set times: `"nights": [ { "label": "Night 1 · Fri", "sets": [["12:00","Artist"], …] } ]`.
3. Run the build, commit, push. The show leads Home and Events until it ends, then moves to the archive on its own.

Cancelled: set `"status": "cancelled"` and a `"notice"`. For one night of a run, set `"status": "cancelled"` on that night.

## Day-of address drop
At drop time, edit `data/drop.json`: set `"active": true`, the event slug, `revealAt`, venue, address, and optionally `mapX`/`mapY` and crew load-in notes. Then push. Nothing shows before `revealAt`. Anyone can read the file once it's pushed, so push at drop time, not earlier. Set `"active": false` after the show.

## Artists
Names on lineups link to `data/artists.json` automatically (spelling variants go in `aliases`). The build warns about any lineup name with no record.
