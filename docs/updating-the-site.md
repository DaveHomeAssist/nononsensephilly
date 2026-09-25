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
   - Tickets panel tiers (optional): `"tiers": [ { "name": "General Admission", "price": 25, "perks": ["Entry for one night"] } ]`. Use `"price": 0` for a free RSVP. Without `tiers`, the panel shows one button to the sale page and no price. The site never shows a price that isn't in this file.
   - Quiet room: `"venue": { "name": null, "area": "Kensington", "public": false }`. Only the area shows.
   - Door rules: `"door": { "age": "21+ with ID", "reentry": "…", "bring": "…", "floor": "Phone-free floor" }`.
   - Set times: `"nights": [ { "label": "Night 1 · Fri", "sets": [["12:00","Artist"], …] } ]`.
3. Run the build, commit, push. The show leads Home and Events until it ends, then moves to the archive on its own.

Cancelled: set `"status": "cancelled"` and a `"notice"`. For one night of a run, set `"status": "cancelled"` on that night.

## Day-of address drop
The address never goes in this repo. It's stored in Upstash and served by `scores-api/api/drop.js`, which hides it until the reveal time on the server's clock. Before then the site only learns that a drop is coming and when.

**To set a drop:** open `https://nononsense-scores.vercel.app/drop-admin.html`, paste the admin token (the `DROP_ADMIN_TOKEN` value in Vercel → nononsense-scores → Settings → Environment Variables), and fill in the event slug, reveal time, venue, and address. You can do this days ahead: nothing is public until the reveal time. Optional: map X/Y for the pin, and crew notes (load-in door, truck path, power). Crew notes are never public; they only come back to the admin token or `DROP_CREW_TOKEN`.

The drop clears itself 36 hours after the reveal. "Clear drop" removes it early.

From a terminal instead:
```
curl -X POST https://nononsense-scores.vercel.app/api/drop \
  -H "Authorization: Bearer $DROP_ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"event":"afterbreak-2026","revealAt":"2026-10-09T18:00:00-04:00","venue":"…","address":"…"}'
```

## Artists
Names on lineups link to `data/artists.json` automatically (spelling variants go in `aliases`). The build warns about any lineup name with no record.

## Pages for search engines
The build also writes crawlable pages: `/events/`, one page per event, `/artists/` (plus a page for members, projects, and any guest with two or more shows or a link), `/rentals/` with the full gear list, a `404.html`, `sitemap.xml`, and `site.webmanifest`. Each page carries structured data (event, artist, rental service, and breadcrumb). A page's sitemap date only changes when its content does.

After a deploy, submit `https://nononsensephilly.com/sitemap.xml` once in Google Search Console and Bing Webmaster Tools.

## Signups, contact, and rental requests (Resend)
The drop-list form and the contact form post to the scores service:
- `POST /api/signup` saves the email in Upstash with where it came from (first touch: `utm_source`, or Instagram, Linktree, RA, DICE, Google, or the referring site), adds it to Resend contacts, and sends a confirmation.
- `POST /api/request` saves the message. **Rentals & Production** requests get a reference like `NNC-2026-014`. The crew inbox (`CREW_INBOX`, default nononsensephl@gmail.com) gets the request, and replying goes straight to the sender, who also gets a copy.

If Resend isn't set up or an email fails, the site opens the visitor's email app as before, with the reference in the subject, so nothing is lost.

**Exports** (admin token): `GET /api/signup?format=csv` and `GET /api/request?format=csv`. These feed the weekly sheet.

**One-time Resend setup:**
1. In Resend, add the domain `nononsensephilly.com` and add the DNS records it lists at Namecheap. Wait until it shows **Verified**.
2. Create an API key with **Sending access** (full access is needed for adding contacts; use full access or skip contacts).
3. In Vercel → nononsense-scores → Settings → Environment Variables, add `RESEND_API_KEY`. Optional: `MAIL_FROM` (default `No Nonsense Collective <hello@nononsensephilly.com>`) and `CREW_INBOX`.
4. Redeploy nononsense-scores.
