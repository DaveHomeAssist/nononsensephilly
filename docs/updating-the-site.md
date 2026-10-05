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

## Rental prices
Cases show no price unless you add one. In `data/rentals.json`, give a case `"priceFrom": 450` and optionally `"priceUnit": "per day"`, then run the build. The card, spec sheet, and `/rentals/` then read "From $450 per day". The written quote still sets the final price.

## Artists
Names on lineups link to `data/artists.json` automatically (spelling variants go in `aliases`). The build warns about any lineup name with no record.

## Pages for search engines
The build also writes crawlable pages: `/events/`, one page per event, `/artists/` (plus a page for members, projects, and any guest with two or more shows or a link), `/rentals/` with the full gear list, a `404.html`, `sitemap.xml`, and `site.webmanifest`. Each page carries structured data (event, artist, rental service, and breadcrumb). A page's sitemap date only changes when its content does.

After a deploy, submit `https://nononsensephilly.com/sitemap.xml` once in Google Search Console and Bing Webmaster Tools.

## Signups, contact, and rental requests (Resend)
The drop-list form and the contact form post to the scores service:
- `POST /api/signup` stores a pending confirmation for 24 hours and sends a confirmation link. It does not add a contact. `POST /api/confirm-signup` records consent and syncs the contact only when the recipient explicitly presses Confirm. Links are single-use; merely opening the page does not subscribe. One confirmation email per address per hour limits unsolicited mail.
- `POST /api/request` saves the message. **Rentals & Production** requests get a reference like `NNC-2026-014`. The crew inbox (`CREW_INBOX`, default nononsensephl@gmail.com) gets the request, and replying goes straight to the sender, who also gets a copy.

If email delivery fails, the site prepares a request in the visitor's email app. The visitor still needs to send it; preparing it does not subscribe them. Rental references remain in the subject.

**Exports** (admin token): `GET /api/signup?format=csv` and `GET /api/request?format=csv`. These feed the weekly sheet.

**One-time Resend setup:**
1. In Resend, add the domain `nononsensephilly.com` and add the DNS records it lists at Namecheap. Wait until it shows **Verified**.
2. Create an API key with **Sending access** (full access is needed for adding contacts; use full access or skip contacts).
3. In Vercel → nononsense-scores → Settings → Environment Variables, add `RESEND_API_KEY`. Optional: `MAIL_FROM` (default `No Nonsense Collective <hello@nononsensephilly.com>`) and `CREW_INBOX`.
4. Redeploy nononsense-scores.

## Search regression checks

The search uses a native modal dialog, regular list buttons and text nodes for indexed titles. Arrow keys focus real results, Tab remains inside, Escape restores the opener, and the match count is announced. Signup prompts do not interrupt another open dialog.

Run `npm install --no-save --package-lock=false playwright@1.63.0 axe-core@4.11.0`, `npx playwright install chromium`, then `node tests/search.mjs`. These test-only dependencies do not change the static production build. CI checks phone, landscape and desktop search in both themes, including axe, literal markup, empty results, close/reopen and result destinations.

## Signup consent and runtime verification

`confirm.html` keeps the confirmation token in the email URL fragment, removes it from the address bar on load, and sends it only in an explicit button POST. The server stores a digest key with a 24-hour lifetime. Failed mailing-list sync retains the link for retry; consent is recorded before the contact can be subscribed. Existing contacts are updated only after confirmation, using Resend's [documented update-by-email API](https://resend.com/docs/api-reference/contacts/update-contact).

Existing `nn:signups` rows are preserved. Rows without `confirmedAt` are exported as `legacy_unverified`, not silently converted to confirmed. Do not use those rows for a new broadcast/import without separate consent evidence. Existing Resend contacts created before this fix are not bulk modified; their previous consent remains an operator review item. No migration or mass unsubscribe runs on deployment.

API handlers use the Node request/response contract, Node 24, an eight-second request budget and three-second upstream timeouts inside a ten-second platform cap. Redis, Resend email and contact calls are mocked in `node --test tests/signup-consent.mjs`; browser confirmation tests mock the POST and send no mail. `node tests/confirmation-page.mjs` checks explicit confirmation, retry, token removal, both themes and accessibility. CI runs both.

Release ordering: deploy and verify the API confirmation routes before publishing the homepage's confirmation copy. The API project must ultimately track `main`; a manually deployed source SHA does not correct its Git production-branch setting. A Vercel status reading “Canceled by Ignored Build Step” is not delivery. Actual test-mail receipt and historical-contact review require separate evidence.
