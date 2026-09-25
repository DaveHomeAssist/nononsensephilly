#!/usr/bin/env node
/*
  Rebuilds the generated parts of the site from data/*.json.

    node tools/build.mjs          update index.html, events/<slug>/ pages, sitemap.xml, robots.txt
    node tools/build.mjs --og     also render media/og/<slug>.jpg share images (needs Playwright)
    node tools/build.mjs --check  fail if any published image still carries EXIF data (GPS included)

  index.html stays hand-editable. Only the blocks between <!-- nn:name --> and <!-- /nn:name -->
  are rewritten, so edit the data files, not those blocks.
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://nononsensephilly.com';
const args = new Set(process.argv.slice(2));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, s) => { fs.mkdirSync(path.dirname(path.join(ROOT, p)), { recursive: true }); fs.writeFileSync(path.join(ROOT, p), s); };

const eventsData = JSON.parse(read('data/events.json'));
const artistsData = JSON.parse(read('data/artists.json'));
const rentalsData = JSON.parse(read('data/rentals.json'));

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const CAT = { afterparty: 'Afterparty', club: 'Club Night', outdoor: 'Outdoor', booking: 'Artist Booking', private: 'Private Event' };
const STATUS = { announced: 'Announced', 'on-sale': 'On sale', 'sold-out': 'Sold out', cancelled: 'Cancelled', past: 'Past' };

/* ---------- Events ---------- */
function endOf(e) {
  if (e.end) return new Date(e.end);
  const base = e.start || e.sortDate;
  if (!base) return null;
  const d = new Date(base.length === 10 ? base + 'T12:00:00-05:00' : base);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}
function phase(e, now = new Date()) {
  if (e.status === 'cancelled') return 'cancelled';
  const end = endOf(e);
  if (end && end < now) return 'past';
  return e.status || 'announced';
}
const sortKey = (e) => e.start || e.sortDate || '';
const events = eventsData.events.slice().sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
const yearOf = (e) => (e.start || e.sortDate || '').slice(0, 4);
const where = (e) => (e.venue && e.venue.public && e.venue.name) ? e.venue.name : (e.venue && e.venue.area) || '';
const flyerCard = (e) => `media/flyers/${e.flyer}-card.webp`;
const flyerFull = (e) => `media/flyers/${e.flyer}.webp`;

/* ---------- Artists: names on flyers resolve to one record ---------- */
const artists = artistsData.artists;
const byKey = new Map();
const keyOf = (s) => s.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');
for (const a of artists) {
  byKey.set(keyOf(a.name), a);
  for (const al of a.aliases || []) byKey.set(keyOf(al), a);
}
/* "Acidic Dreams b2b Tethra64" -> [{text:'Acidic Dreams', artist}, {text:' b2b '}, {text:'Tethra64', artist}] */
function splitAct(act) {
  const out = [];
  for (const part of act.split(/(\s+b2b\s+|\s+feat\.\s+|\s+x\s+)/i)) {
    if (!part) continue;
    if (/^\s+(b2b|feat\.|x)\s+$/i.test(part)) { out.push({ text: part }); continue; }
    const m = part.match(/^(.*?)(\s*\(.*\))?$/);
    const a = byKey.get(keyOf(m[1]));
    out.push({ text: m[1], artist: a ? a.slug : null });
    if (m[2]) out.push({ text: m[2] });
  }
  return out;
}
const actsOf = (e) => [...(e.lineup || []), ...((e.nights || []).flatMap((n) => (n.sets || []).map((s) => s[1])))];
const showsByArtist = new Map();
for (const e of events) {
  const seen = new Set();
  for (const act of actsOf(e)) for (const seg of splitAct(act)) if (seg.artist) seen.add(seg.artist);
  for (const slug of seen) { if (!showsByArtist.has(slug)) showsByArtist.set(slug, []); showsByArtist.get(slug).push(e.slug); }
}
/* A project's shows count for its members too. */
for (const a of artists) for (const m of a.members || []) {
  const list = showsByArtist.get(m) || [];
  for (const s of showsByArtist.get(a.slug) || []) if (!list.includes(s)) list.push(s);
  showsByArtist.set(m, list);
}
for (const [slug, list] of showsByArtist) list.sort((x, y) => sortKey(events.find((e) => e.slug === y)).localeCompare(sortKey(events.find((e) => e.slug === x))));
const unknown = new Set();
for (const e of events) for (const act of actsOf(e)) for (const seg of splitAct(act)) if (seg.artist === null && !/^(doors|open decks|close|mystery headliner)$/i.test(seg.text.trim())) unknown.add(seg.text);
const gaps = [];
for (const e of events) {
  if (!e.start) gaps.push(`${e.slug}: no date with a year (start is empty)`);
  if (!(e.lineup || []).length && !e.lineupNote) gaps.push(`${e.slug}: no lineup`);
  if (/more names/i.test(e.lineupNote || '')) gaps.push(`${e.slug}: lineup is partial`);
  if (phase(e) === 'past' && !(e.nights || []).some((n) => (n.sets || []).length)) gaps.push(`${e.slug}: no set times`);
  if (phase(e) === 'on-sale' && !e.ticketUrl) gaps.push(`${e.slug}: on sale but no ticketUrl`);
}
if (gaps.length) console.warn(`Content gaps (${gaps.length}):\n  ` + gaps.join('\n  '));
if (unknown.size) console.warn('Names on lineups with no artist record:', [...unknown].join(', '));

function actHTML(act, linkMode) {
  return splitAct(act).map((seg) => {
    if (!seg.artist) return esc(seg.text);
    if (linkMode === 'page') return `<a href="/#artist/${seg.artist}">${esc(seg.text)}</a>`;
    return `<button type="button" class="nn-artist-link" data-artist="${seg.artist}">${esc(seg.text)}</button>`;
  }).join('');
}

/* ---------- index.html blocks ---------- */
function doorLine(e) {
  return e.door && e.door.age ? `<li>${esc(e.door.age)}</li>` : '';
}
function eventCard(e, ph) {
  const lineupText = (e.lineup || []).filter((x) => !/mystery/i.test(x)).slice(0, 6);
  const more = (e.lineup || []).length > 6 || e.lineupNote;
  const statusPill = ph === 'past' ? '' : `<span class="ev-state ev-state--${ph}">${STATUS[ph]}</span>`;
  const tickets = (ph === 'on-sale' && e.ticketUrl) ? `<a class="btn btn-primary ev-tix" href="${esc(e.ticketUrl)}" target="_blank" rel="noopener noreferrer" data-umami-event="ticket-click" data-umami-event-event="${e.slug}">Tickets</a>` : '';
  const vids = (e.videos || []).length ? `<li class="ev-has">▶ ${e.videos.length} video${e.videos.length > 1 ? 's' : ''}</li>` : '';
  const sets = (e.nights || []).some((n) => (n.sets || []).length) ? '<li class="ev-has">Set times</li>' : '';
  return `            <article class="card" data-cat="${e.category}" data-year="${yearOf(e)}" data-event="${e.slug}" data-phase="${ph}">
              <button type="button" class="card-open" data-event-open="${e.slug}" aria-label="${esc(e.title)}: flyer, lineup, and details"><img class="thumb" src="${flyerCard(e)}" alt="${esc(e.title)} flyer" width="720" height="900" loading="lazy" decoding="async"></button>
              <div class="card-body">
                <p class="badge badge-${e.category}">${CAT[e.category]}</p>${statusPill}
                <h3>${esc(e.title)}</h3>
                <p class="event-meta">${e.start || e.sortDate ? `<time datetime="${esc((e.start || e.sortDate).slice(0, 10))}">${esc(e.dateLabel)}</time>` : esc(e.dateLabel)} · ${esc(where(e))}</p>${e.notice ? `\n                <p class="ev-notice">${esc(e.notice)}</p>` : ''}
                <p>${esc(e.summary)}${lineupText.length ? ` ${esc(lineupText.join(', '))}${more ? ', and more' : ''}.` : ''}</p>
                <ul class="door-chips">${doorLine(e)}${sets}${vids}</ul>
                <div class="card-links">${tickets}<button type="button" class="text-link" data-event-open="${e.slug}">Lineup + details</button><a class="text-link" href="events/${e.slug}/">Event page</a></div>
              </div>
            </article>`;
}

const now = new Date();
const upcoming = events.filter((e) => !['past', 'cancelled'].includes(phase(e, now))).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
const archive = events.filter((e) => !upcoming.includes(e));
const next = upcoming[0] || null;

const blocks = {};
blocks['event-cards'] = '\n' + archive.map((e) => eventCard(e, phase(e, now))).join('\n') + '\n            ';
blocks['upcoming'] = '\n' + (upcoming.length
  ? `          <div class="event-grid ev-up-grid">\n${upcoming.map((e) => eventCard(e, phase(e, now))).join('\n')}\n          </div>`
  : `          <div class="ev-empty"><p><b>Nothing on sale right now.</b> The next show goes to the drop list first, then Instagram.</p><button type="button" class="btn btn-primary" data-open-news>Get the drop</button></div>`) + '\n          ';

const years = [...new Set(archive.map(yearOf).filter(Boolean))].sort().reverse();
blocks['event-years'] = '\n' + [`<option value="all">All years</option>`, ...years.map((y) => `<option value="${y}">${y}</option>`)].map((o) => '              ' + o).join('\n') + '\n            ';

/* Recaps lead; set visuals and streams follow. */
const recapItems = [
  ...(eventsData.recaps || []).map((v) => ({ ...v, eventTitle: v.note || '' })),
  ...events.flatMap((e) => (e.videos || []).map((v) => ({ ...v, event: e.slug, eventTitle: e.title })))
];
blocks['recaps'] = '\n' + recapItems.map((v) => `            <li><button type="button" class="rc-item" data-video="${esc(v.youtube)}" data-video-title="${esc(v.title)}"><img src="https://i.ytimg.com/vi/${esc(v.youtube)}/hqdefault.jpg" alt="" width="480" height="360" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'"><span class="rc-play" aria-hidden="true">▶</span><b>${esc(v.title)}</b><small>${esc(v.eventTitle)}</small></button></li>`).join('\n') + '\n          ';

const members = artists.filter((a) => a.role === 'member');
blocks['members'] = '\n' + members.map((a) => {
  const shows = (showsByArtist.get(a.slug) || []).map((s) => events.find((e) => e.slug === s).title);
  const links = (a.links || []).map((l) => `<a class="text-link" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}</a>`).join('');
  return `            <article class="artist">
              <div class="who"><div class="avatar" aria-hidden="true">${esc(a.initials)}</div><div><div class="name">${esc(a.name.toUpperCase())}</div><div class="role">Collective member</div></div></div>
              <p>${esc(a.bio)}${shows.length ? ` On the bill for ${esc(shows.slice(0, 4).join(', '))}${shows.length > 4 ? `, and ${shows.length - 4} more` : ''}.` : ''}</p>
              <div class="card-links"><button type="button" class="text-link" data-artist="${a.slug}">${shows.length} show${shows.length === 1 ? '' : 's'} + links</button>${links}</div>
            </article>`;
}).join('\n') + '\n          ';
const guests = artists.filter((a) => a.role === 'guest').sort((a, b) => (showsByArtist.get(b.slug) || []).length - (showsByArtist.get(a.slug) || []).length || a.name.localeCompare(b.name));
blocks['guests'] = '\n' + guests.map((a) => {
  const n = (showsByArtist.get(a.slug) || []).length;
  return `              <li><button type="button" data-artist="${a.slug}">${esc(a.name)}<small>${n}</small></button></li>`;
}).join('\n') + '\n            ';

blocks['rental-zones'] = '\n' + rentalsData.zones.map((z, i) => `            <button type="button" class="rig-zone rental-filter" data-rental-filter="${z.id}" aria-pressed="${i === 0}"><span class="ref">${z.ref}</span><b>${esc(z.name)}</b><small>${esc(z.sub)}</small></button>`).join('\n') + '\n          ';
blocks['rental-cases'] = '\n' + rentalsData.cases.map((c) => {
  const first = c.zone === rentalsData.zones[0].id;
  const addon = c.addon ? `\n              <button type="button" class="case-addon rental-add" data-rental="${esc(c.addon.name)}" data-addon data-umami-event="rental-add" data-umami-event-package="${esc(c.addon.name)}">+ ${esc(c.addon.label)} <span>tech required</span></button>` : '';
  return `            <article class="rental-card" data-rental-cat="${c.zone}"${first ? '' : ' hidden'}>
              <div class="case-top"><span class="case-code" aria-hidden="true">${esc(c.code)}</span><span class="case-ref">${esc(c.ref)}</span></div>
              <h3>${esc(c.name)}</h3>
              <p>${esc(c.blurb)}</p>
              <ul class="case-specs">${c.chips.map((x) => `<li>${esc(x)}</li>`).join('')}<li class="case-spec-li"><button type="button" class="case-spec" data-spec="${esc(c.name)}" aria-label="Full gear list: ${esc(c.name)}">Full spec</button></li></ul>
              <button type="button" class="btn case-add rental-add" data-rental="${esc(c.name)}" data-umami-event="rental-add" data-umami-event-package="${esc(c.name)}">Add to manifest</button>${addon}
            </article>`;
}).join('\n') + '\n          ';

/* Hero line and map X, pre-rendered for no-JS visitors. The page re-checks them against the clock. */
blocks['hero-next'] = next
  ? `<p class="nn-next" data-next><i class="nn-next-dot"></i><b>${esc(STATUS[phase(next, now)])}</b> <span>${esc(next.title)} · ${esc(next.dateLabel)} · ${esc(where(next))}</span></p>`
  : `<p class="nn-next is-quiet" data-next><i class="nn-next-dot"></i><b>Next show</b> <span>Announced to the drop list first</span></p>`;

const dataForPage = {
  events: events.map((e) => { const { ...rest } = e; return rest; }),
  recaps: eventsData.recaps || [],
  artists: artists.map((a) => ({ ...a, shows: showsByArtist.get(a.slug) || [] })),
  rentals: rentalsData.cases.map((c) => ({ name: c.name, zone: c.zone, gear: c.gear, circuits: c.circuits, circuitLabel: c.circuitLabel || '', video: !!c.video, provides: c.provides || '', addon: c.addon || null }))
};
blocks['home-ld'] = `<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': `${SITE}/#org`, name: 'No Nonsense Collective', alternateName: 'No Nonsense', url: `${SITE}/`,
      logo: { '@type': 'ImageObject', url: `${SITE}/media/icon-512.png`, width: 512, height: 512 }, image: `${SITE}/media/og-card.jpg`,
      description: 'Philadelphia collective producing after-hours events, renting DJ, sound, lighting, and video gear, and booking artists.',
      foundingDate: '2024', email: 'nononsensephl@gmail.com',
      areaServed: { '@type': 'City', name: 'Philadelphia' },
      sameAs: ['https://instagram.com/nononsensephl', 'https://www.youtube.com/@NoNonsensePHL', 'https://linktr.ee/nononsensephl'],
      member: artists.filter((a) => a.role === 'member').map((a) => ({ '@type': 'MusicGroup', name: a.name, url: `${SITE}/artists/${a.slug}/` })) },
    { '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/`, name: 'No Nonsense Collective', inLanguage: 'en-US', publisher: { '@id': `${SITE}/#org` } },
    ...upcoming.filter((e) => e.start).map((e) => ({ '@type': 'MusicEvent', name: e.title, url: `${SITE}/events/${e.slug}/`, startDate: e.start, eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode', eventStatus: 'https://schema.org/EventScheduled', location: { '@type': 'Place', name: where(e) || 'Philadelphia', address: { '@type': 'PostalAddress', addressLocality: 'Philadelphia', addressRegion: 'PA', addressCountry: 'US' } }, image: [`${SITE}/${flyerFull(e)}`], organizer: { '@id': `${SITE}/#org` } }))
  ]
}).replace(/</g, '\\u003c')}</script>`;
blocks['data'] = `<script type="application/json" id="nn-data">${JSON.stringify(dataForPage).replace(/</g, '\\u003c')}</script>`;

let html = read('index.html');
for (const [name, body] of Object.entries(blocks)) {
  const re = new RegExp(`(<!-- nn:${name} -->)[\\s\\S]*?(<!-- /nn:${name} -->)`);
  if (!re.test(html)) { console.error(`index.html is missing the <!-- nn:${name} --> block`); process.exit(1); }
  html = html.replace(re, (_, a, b) => a + body + b);
}
write('index.html', html);

/* ---------- share images (before pages, so pages can point at them) ---------- */
if (args.has('--og')) {
  let chromium;
  try { const mod = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'); chromium = mod.chromium || (mod.default && mod.default.chromium); if (!chromium) throw new Error('no chromium'); }
  catch { console.error('Share images need Playwright. Set PLAYWRIGHT_MODULE to its path or install it.'); process.exit(1); }
  const font = (n) => 'data:font/woff2;base64,' + fs.readFileSync(path.join(ROOT, `media/fonts/${n}.woff2`)).toString('base64');
  const fontCss = `@font-face{font-family:"Unbounded";font-weight:900;src:url(${font('unbounded-900')})}@font-face{font-family:"IBM Plex Mono";font-weight:400;src:url(${font('plex-mono-400')})}@font-face{font-family:"IBM Plex Mono";font-weight:500;src:url(${font('plex-mono-500')})}`;
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  fs.mkdirSync(path.join(ROOT, 'media/og'), { recursive: true });
  for (const e of events) {
    const ph = phase(e, now);
    const img = 'data:image/webp;base64,' + fs.readFileSync(path.join(ROOT, flyerCard(e))).toString('base64');
    const acts = (e.lineup || []).filter((x) => !/mystery/i.test(x)).slice(0, 5).join(' · ');
    await page.setContent(`<!DOCTYPE html><html><head><style>${fontCss}
      *{box-sizing:border-box;margin:0}
      body{width:1200px;height:630px;background:#07060c;color:#f4efe6;font-family:"IBM Plex Mono",monospace;display:grid;grid-template-columns:1fr 504px;overflow:hidden}
      .l{position:relative;padding:54px 56px;display:flex;flex-direction:column;background:radial-gradient(ellipse at 20% 110%,rgba(255,79,139,.22),transparent 60%),repeating-linear-gradient(0deg,rgba(255,178,62,.05) 0 1px,transparent 1px 28px),repeating-linear-gradient(90deg,rgba(255,178,62,.05) 0 1px,transparent 1px 30px)}
      .brand{font:900 30px/1 Unbounded,sans-serif;letter-spacing:-.03em;text-transform:uppercase;color:#ffb23e}
      .brand small{display:block;margin-top:8px;font:500 14px/1 "IBM Plex Mono";letter-spacing:.3em;color:#8ab8ff}
      h1{margin-top:auto;font:900 ${e.title.length > 26 ? 50 : 66}px/1 Unbounded,sans-serif;letter-spacing:-.045em;text-transform:uppercase}
      .meta{margin-top:20px;font:500 20px/1.3 "IBM Plex Mono";letter-spacing:.12em;text-transform:uppercase;color:#8ab8ff}
      .acts{margin-top:14px;font:500 16px/1.4 "IBM Plex Mono";letter-spacing:.08em;text-transform:uppercase;color:#c8c0d4}
      .st{position:absolute;top:54px;right:40px;padding:8px 14px;border-radius:999px;font:500 14px/1 "IBM Plex Mono";letter-spacing:.14em;text-transform:uppercase;background:${ph === 'past' ? '#241c33' : '#ffb23e'};color:${ph === 'past' ? '#f4efe6' : '#1c1204'}}
      .r{background:url(${img}) center/cover;border-left:3px solid #ff4f8b}
    </style></head><body><div class="l"><div class="brand">No Nonsense<small>Collective · Philadelphia</small></div><span class="st">${esc(STATUS[ph])}</span><h1>${esc(e.title)}</h1><p class="meta">${esc(e.dateLabel)} · ${esc(where(e))}</p>${acts ? `<p class="acts">${esc(acts)}</p>` : ''}</div><div class="r"></div></body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(ROOT, `media/og/${e.slug}.jpg`), type: 'jpeg', quality: 84 });
  }
  await browser.close();
  console.log(`Share images: ${events.length} written to media/og/`);
}

/* ---------- Static pages: /events/, /events/<slug>/, /artists/, /artists/<slug>/, /rentals/, 404 ---------- */
const ORG_ID = `${SITE}/#org`;
const SOCIAL = { instagram: 'https://instagram.com/nononsensephl', youtube: 'https://www.youtube.com/@NoNonsensePHL', linktree: 'https://linktr.ee/nononsensephl', email: 'nononsensephl@gmail.com' };
const eventUrl = (e) => `${SITE}/events/${e.slug}/`;
/* Guests with one show and no links stay in the on-site sheet; a page for them would be thin. */
const hasArtistPage = (a) => a.role !== 'guest' || (showsByArtist.get(a.slug) || []).length >= 2 || (a.links || []).length > 0;
const artistHref = (slug) => { const a = artists.find((x) => x.slug === slug); return a && hasArtistPage(a) ? `/artists/${slug}/` : `/#artist/${slug}`; };
function actLinks(act) {
  return splitAct(act).map((seg) => seg.artist ? `<a href="${artistHref(seg.artist)}">${esc(seg.text)}</a>` : esc(seg.text)).join('');
}
const ldJson = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
function crumbsLd(trail) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: trail.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c[0], item: SITE + c[1] })) };
}
function shell({ title, desc, pathname, image, imageAlt, ld = [], trail, body, noindex = false }) {
  const url = SITE + pathname;
  const img = image || `${SITE}/media/og-card.jpg`;
  const crumbs = trail ? `<nav class="crumbs" aria-label="Breadcrumb"><ol>${trail.map((c, i) => i === trail.length - 1 ? `<li aria-current="page">${esc(c[0])}</li>` : `<li><a href="${c[1]}">${esc(c[0])}</a></li>`).join('')}</ol></nav>` : '';
  const allLd = trail ? [...ld, crumbsLd(trail)] : ld;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${url}">`}
<meta property="og:site_name" content="No Nonsense Collective">
<meta property="og:locale" content="en_US">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${img}">
<meta property="og:image:alt" content="${esc(imageAlt || title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${img}">
<meta name="theme-color" content="#07060c">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/media/icon-192.png" type="image/png">
<link rel="apple-touch-icon" href="/media/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preload" href="/media/fonts/unbounded-900.woff2" as="font" type="font/woff2" crossorigin>
<script defer src="https://cloud.umami.is/script.js" data-website-id="b366ee05-3f6a-4249-87e3-0f11c3f1e50a" data-domains="nononsensephilly.com"></script>
${allLd.map(ldJson).join('\n')}
<style>
@font-face{font-family:"Unbounded";font-weight:900;font-display:swap;src:url("/media/fonts/unbounded-900.woff2") format("woff2")}
@font-face{font-family:"IBM Plex Mono";font-weight:500;font-display:swap;src:url("/media/fonts/plex-mono-500.woff2") format("woff2")}
:root{color-scheme:dark;--bg:#07060c;--surface:#14121c;--text:#f4efe6;--muted:#c8c0d4;--amber:#ffb23e;--rose:#ff4f8b;--ice:#8ab8ff;--border:#322c3e;--mono:"IBM Plex Mono",ui-monospace,monospace;--display:"Unbounded","Arial Narrow",sans-serif}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 system-ui,"Segoe UI",sans-serif}
a{color:var(--amber)}
.bar{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px 20px;max-width:1080px;margin:0 auto;padding:16px}
.bar .brand{font:900 18px/1 var(--display);letter-spacing:-.03em;text-transform:uppercase;color:var(--amber);text-decoration:none}
.bar nav{display:flex;flex-wrap:wrap;gap:4px 18px;font:500 12px/1 var(--mono);letter-spacing:.12em;text-transform:uppercase}
.bar nav a{display:inline-flex;align-items:center;min-height:40px;color:var(--text);text-decoration:none}
.bar nav a[aria-current]{color:var(--amber)}
main{max-width:1080px;margin:0 auto;padding:8px 16px 56px}
.crumbs ol{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 18px;padding:0;list-style:none;font:500 11px/1.4 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.crumbs li+li::before{content:"/";margin-right:6px;color:var(--border)}
.crumbs a{color:var(--muted)}
.kicker{margin:0 0 8px;font:500 12px/1.2 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--rose)}
h1{margin:0 0 10px;font:900 clamp(2rem,1.3rem + 3vw,3.4rem)/1 var(--display);letter-spacing:-.04em;text-transform:uppercase}
h2{margin:32px 0 10px;font:900 1.15rem/1.2 var(--display);letter-spacing:-.02em}
.lede{max-width:64ch;color:var(--muted);font-size:1.05rem}
.meta{margin:0 0 16px;font:500 13px/1.4 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ice)}
.notice{padding:10px 14px;border:1px solid var(--rose);border-radius:10px;color:#ffd0dd}
.btn{display:inline-flex;align-items:center;min-height:44px;margin:6px 8px 0 0;padding:0 20px;border-radius:999px;background:var(--amber);color:#1c1204;font:500 12px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;text-decoration:none}
.btn.ghost{background:transparent;color:var(--text);border:1px solid var(--border)}
.grid{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:32px;align-items:start}
.grid img{display:block;width:100%;height:auto;border-radius:14px;border:1px solid var(--border)}
.x{color:var(--rose);font-size:.8em}
.sets{list-style:none;margin:0;padding:0;border-top:1px solid var(--border)}
.sets li{display:grid;grid-template-columns:64px 1fr;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)}
.sets time{font:500 13px/1.6 var(--mono);color:var(--amber)}
.chips{display:flex;flex-wrap:wrap;gap:8px;list-style:none;margin:0;padding:0}
.chips li{padding:6px 12px;border:1px solid var(--border);border-radius:999px;background:var(--surface);font:500 12px/1.3 var(--mono);text-transform:uppercase;letter-spacing:.06em}
.chips a,.sets a{color:var(--text)}
.chips small{margin-left:6px;color:var(--muted)}
dl{display:grid;grid-template-columns:max-content 1fr;gap:6px 16px;margin:0}
dt{font:500 12px/1.6 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
dd{margin:0}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:16px;margin:0;padding:0;list-style:none}
.tiles a{display:block;height:100%;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--text);text-decoration:none;overflow:hidden}
.tiles a:hover,.tiles a:focus-visible{border-color:var(--amber)}
.tiles img{display:block;width:100%;height:auto;aspect-ratio:4/5;object-fit:cover}
.tiles b{display:block;padding:10px 12px 2px}
.tiles span{display:block;padding:0 12px 12px;font:500 11px/1.4 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.gear{width:100%;border-collapse:collapse;margin:8px 0 0}
.gear th,.gear td{padding:8px 10px 8px 0;border-bottom:1px solid var(--border);text-align:left;vertical-align:top}
.gear th{font:500 11px/1.4 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.gear td:first-child{font:500 13px/1.6 var(--mono);color:var(--amber);white-space:nowrap}
.tag{display:inline-block;margin:2px 4px 0 0;padding:2px 7px;border:1px solid var(--border);border-radius:99px;font:500 10px/1.4 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.case{margin:0 0 8px;padding:18px;border:1px solid var(--border);border-radius:14px;background:var(--surface)}
.case h2{margin-top:0}
.foot{max-width:1080px;margin:0 auto;padding:24px 16px 40px;border-top:1px solid var(--border);display:flex;flex-wrap:wrap;gap:8px 20px;font:500 12px/1 var(--mono);letter-spacing:.1em;text-transform:uppercase}
.foot a{display:inline-flex;align-items:center;min-height:40px;color:var(--muted)}
@media (max-width:760px){.grid{grid-template-columns:1fr}.gear td:last-child{min-width:110px}}
</style>
</head>
<body>
<header class="bar"><a class="brand" href="/">No Nonsense</a><nav aria-label="Primary">${[['Events', '/events/'], ['Rentals', '/rentals/'], ['Artists', '/artists/'], ['Contact', '/#contact']].map(([l, h]) => `<a href="${h}"${pathname.startsWith(h) && h !== '/#contact' ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav></header>
<main>
${crumbs}${body}
</main>
<footer class="foot"><a href="/">Home</a><a href="/events/">Events</a><a href="/rentals/">Rentals</a><a href="/artists/">Artists</a><a href="${SOCIAL.instagram}">Instagram</a><a href="${SOCIAL.youtube}">YouTube</a><a href="mailto:${SOCIAL.email}">${SOCIAL.email}</a></footer>
</body>
</html>
`;
}

/* Pages keep their sitemap date unless their content changes. */
const oldLastmod = new Map();
try { for (const m of read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)) oldLastmod.set(m[1], m[2]); } catch {}
const today = now.toISOString().slice(0, 10);
const sitemap = [];
function writePage(rel, html, pathname, index = true) {
  const file = path.join(ROOT, rel);
  const same = fs.existsSync(file) && fs.readFileSync(file, 'utf8') === html;
  if (!same) write(rel, html);
  if (index) sitemap.push({ loc: SITE + pathname, lastmod: same && oldLastmod.get(SITE + pathname) || today });
}
sitemap.push({ loc: `${SITE}/`, lastmod: today });

function eventLd(e) {
  if (!e.start) return null;
  const ph = phase(e, now);
  const perf = [...new Set(actsOf(e).flatMap((a) => splitAct(a).filter((s) => s.artist).map((s) => s.artist)))].map((slug) => {
    const a = artists.find((x) => x.slug === slug);
    return { '@type': 'MusicGroup', name: a.name, ...(hasArtistPage(a) ? { url: `${SITE}/artists/${slug}/` } : {}) };
  });
  return {
    '@context': 'https://schema.org', '@type': 'MusicEvent', '@id': eventUrl(e) + '#event', name: e.title, url: eventUrl(e),
    startDate: e.start, ...(e.end ? { endDate: e.end } : {}),
    eventStatus: 'https://schema.org/' + (ph === 'cancelled' ? 'EventCancelled' : 'EventScheduled'),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: where(e) || 'Philadelphia', address: { '@type': 'PostalAddress', addressLocality: 'Philadelphia', addressRegion: 'PA', addressCountry: 'US', ...(e.venue && e.venue.public && /^\d/.test(e.venue.name || '') ? { streetAddress: e.venue.name } : {}) } },
    image: [`${SITE}/${flyerFull(e)}`, ...(fs.existsSync(path.join(ROOT, `media/og/${e.slug}.jpg`)) ? [`${SITE}/media/og/${e.slug}.jpg`] : [])],
    description: e.summary,
    organizer: { '@type': 'Organization', '@id': ORG_ID, name: 'No Nonsense Collective', url: `${SITE}/` },
    ...(perf.length ? { performer: perf } : {}),
    ...(e.ticketUrl ? { offers: { '@type': 'Offer', url: e.ticketUrl, availability: 'https://schema.org/' + (ph === 'sold-out' ? 'SoldOut' : 'InStock'), validFrom: e.onSaleFrom || undefined } } : {})
  };
}
function eventPage(e) {
  const ph = phase(e, now);
  const og = fs.existsSync(path.join(ROOT, `media/og/${e.slug}.jpg`)) ? `${SITE}/media/og/${e.slug}.jpg` : `${SITE}/${flyerFull(e)}`;
  const acts = (e.lineup || []).filter((x) => !/mystery/i.test(x));
  const desc = `${e.dateLabel} · ${where(e)}. ${e.summary}${acts.length ? ' Lineup: ' + acts.join(', ') + '.' : ''}`.slice(0, 300);
  const nights = (e.nights || []).map((n) => `<section><h3>${esc(n.label)}${n.status === 'cancelled' ? ' <span class="x">Cancelled</span>' : ''}</h3>${n.note ? `<p>${esc(n.note)}</p>` : ''}${(n.sets || []).length ? `<ol class="sets">${n.sets.map((s) => `<li><time>${esc(s[0])}</time><span>${actLinks(s[1])}</span></li>`).join('')}</ol>` : ''}</section>`).join('');
  const door = e.door || {};
  const doorRows = [['Age', door.age], ['Re-entry', door.reentry], ['Bring', door.bring], ['Floor', door.floor]].filter((r) => r[1]).map((r) => `<dt>${r[0]}</dt><dd>${esc(r[1])}</dd>`).join('');
  const i = events.indexOf(e);
  const near = [events[i - 1], events[i + 1]].filter(Boolean);
  const ld = eventLd(e);
  const body = `<div class="grid">
  <a href="/${flyerFull(e)}"><img src="/${flyerCard(e)}" alt="${esc(e.title)} flyer${acts.length ? ': ' + esc(acts.slice(0, 8).join(', ')) : ''}" width="720" height="900"></a>
  <div>
    <p class="kicker">${CAT[e.category]} · ${STATUS[ph]}</p>
    <h1>${esc(e.title)}</h1>
    <p class="meta">${e.start ? `<time datetime="${esc(e.start)}">${esc(e.dateLabel)}</time>` : esc(e.dateLabel)} · ${esc(where(e))}, Philadelphia</p>
    ${e.notice ? `<p class="notice">${esc(e.notice)}</p>` : ''}
    <p>${esc(e.summary)}${(e.presenters || []).length ? ` With ${esc(e.presenters.join(' and '))}.` : ''}</p>
    ${ph === 'on-sale' && e.ticketUrl ? `<a class="btn" href="${esc(e.ticketUrl)}" data-umami-event="ticket-click" data-umami-event-event="${e.slug}">Tickets</a>` : ''}<a class="btn ghost" href="/#event/${e.slug}">Open on the site</a>
    ${acts.length ? `<h2>Lineup</h2><ul class="chips">${e.lineup.map((a) => `<li>${actLinks(a)}</li>`).join('')}</ul>` : ''}
    ${e.lineupNote ? `<p>${esc(e.lineupNote)}</p>` : ''}
    ${nights ? `<h2>Set times</h2>${nights}` : ''}
    ${doorRows ? `<h2>At the door</h2><dl>${doorRows}</dl>` : ''}
    ${e.production ? `<h2>Production</h2><p>${esc(e.production)}</p>` : ''}
    ${(e.videos || []).length ? `<h2>Video</h2><ul>${e.videos.map((v) => `<li><a href="https://www.youtube.com/watch?v=${esc(v.youtube)}">${esc(v.title)}</a></li>`).join('')}</ul>` : ''}
    ${(e.audio || []).length ? `<h2>Listen</h2><ul>${e.audio.map((t) => `<li><a href="${esc(t.url)}">${esc(t.artist)}: ${esc(t.title)}</a></li>`).join('')}</ul>` : ''}
    ${near.length ? `<h2>More No Nonsense nights</h2><ul>${near.map((n) => `<li><a href="/events/${n.slug}/">${esc(n.title)}</a> · ${esc(n.dateLabel)}</li>`).join('')}</ul>` : ''}
  </div>
</div>`;
  const t = `${e.title} · ${e.dateLabel.replace(/^\w{3}, /, '')}`;
  return shell({ title: t.length > 44 ? `${t} · No Nonsense` : `${t} · No Nonsense Collective`, desc, pathname: `/events/${e.slug}/`, image: og, imageAlt: `${e.title} flyer`, ld: ld ? [ld] : [], trail: [['Home', '/'], ['Events', '/events/'], [e.title, `/events/${e.slug}/`]], body });
}
for (const e of events) writePage(`events/${e.slug}/index.html`, eventPage(e), `/events/${e.slug}/`);

const tile = (e) => `<li><a href="/events/${e.slug}/"><img src="/${flyerCard(e)}" alt="${esc(e.title)} flyer" width="720" height="900" loading="lazy" decoding="async"><b>${esc(e.title)}</b><span>${esc(e.dateLabel)} · ${esc(where(e))}${phase(e, now) === 'past' ? '' : ' · ' + esc(STATUS[phase(e, now)])}</span></a></li>`;
writePage('events/index.html', shell({
  title: 'Events · Philadelphia after hours · No Nonsense Collective',
  desc: `Every No Nonsense Collective night in Philadelphia: afterparties, club nights, and outdoor raves. ${events.length} shows with flyers, lineups, and set times.`,
  pathname: '/events/',
  ld: [{ '@context': 'https://schema.org', '@type': 'ItemList', name: 'No Nonsense Collective events', itemListElement: events.map((e, i) => ({ '@type': 'ListItem', position: i + 1, url: eventUrl(e), name: e.title })) }],
  trail: [['Home', '/'], ['Events', '/events/']],
  body: `<p class="kicker">Events</p><h1>Events we produce</h1><p class="lede">Afterparties, club nights, and outdoor raves in Philadelphia since 2024. Quiet rooms show the neighborhood only; the address drops at 6 PM on show day.</p>
${upcoming.length ? `<h2>Up next</h2><ul class="tiles">${upcoming.map(tile).join('')}</ul>` : `<h2>Up next</h2><p class="lede">Nothing on sale right now. The next show goes to the <a href="/#contact">drop list</a> first, then <a href="${SOCIAL.instagram}">Instagram</a>.</p>`}
<h2>Archive</h2><ul class="tiles">${archive.map(tile).join('')}</ul>`
}), '/events/');

function artistPage(a) {
  const shows = (showsByArtist.get(a.slug) || []).map((s) => events.find((e) => e.slug === s));
  const projects = artists.filter((p) => (p.members || []).includes(a.slug));
  const role = { member: 'Collective member', project: 'Collective project', guest: 'Guest artist' }[a.role];
  const desc = `${a.name}: ${a.bio ? a.bio + ' ' : ''}Played ${shows.length} No Nonsense Collective ${shows.length === 1 ? 'show' : 'shows'} in Philadelphia${shows.length ? ', including ' + shows.slice(0, 3).map((e) => e.title).join(', ') : ''}.`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'MusicGroup', '@id': `${SITE}/artists/${a.slug}/#artist`, name: a.name, url: `${SITE}/artists/${a.slug}/`,
    ...(a.bio ? { description: a.bio } : {}),
    ...((a.links || []).length ? { sameAs: a.links.map((l) => l.url).filter((u) => !/open\.spotify\.com\/track/.test(u)) } : {}),
    ...(a.role === 'member' || a.role === 'project' ? { memberOf: { '@type': 'Organization', '@id': ORG_ID, name: 'No Nonsense Collective' } } : {}),
    ...((a.members || []).length ? { member: a.members.map((m) => ({ '@type': 'MusicGroup', name: artists.find((x) => x.slug === m).name, url: `${SITE}/artists/${m}/` })) } : {}),
    event: shows.filter((e) => e.start).map((e) => ({ '@type': 'MusicEvent', name: e.title, startDate: e.start, url: eventUrl(e), location: { '@type': 'Place', name: where(e) || 'Philadelphia', address: { '@type': 'PostalAddress', addressLocality: 'Philadelphia', addressRegion: 'PA', addressCountry: 'US' } } }))
  };
  const body = `<p class="kicker">${role}</p><h1>${esc(a.name)}</h1>
<p class="lede">${esc(a.bio || `Guest on No Nonsense Collective lineups in Philadelphia.`)}</p>
${(a.members || []).length ? `<p>Members: ${a.members.map((m) => `<a href="${artistHref(m)}">${esc(artists.find((x) => x.slug === m).name)}</a>`).join(' + ')}</p>` : ''}
${projects.length ? `<p>Also plays as ${projects.map((p) => `<a href="${artistHref(p.slug)}">${esc(p.name)}</a>`).join(', ')}.</p>` : ''}
${(a.links || []).length ? `<p>${a.links.map((l) => `<a class="btn ghost" href="${esc(l.url)}">${esc(l.label)}</a>`).join('')}</p>` : ''}
<h2>${shows.length} No Nonsense ${shows.length === 1 ? 'show' : 'shows'}</h2>
<ul class="tiles">${shows.map(tile).join('')}</ul>`;
  return shell({ title: `${a.name} · ${role} · No Nonsense Collective`, desc: desc.slice(0, 300), pathname: `/artists/${a.slug}/`, image: shows[0] && fs.existsSync(path.join(ROOT, `media/og/${shows[0].slug}.jpg`)) ? `${SITE}/media/og/${shows[0].slug}.jpg` : undefined, ld: [ld], trail: [['Home', '/'], ['Artists', '/artists/'], [a.name, `/artists/${a.slug}/`]], body });
}
const paged = artists.filter(hasArtistPage);
for (const a of paged) writePage(`artists/${a.slug}/index.html`, artistPage(a), `/artists/${a.slug}/`);
const chip = (a) => `<li><a href="${artistHref(a.slug)}">${esc(a.name)}</a><small>${(showsByArtist.get(a.slug) || []).length}</small></li>`;
writePage('artists/index.html', shell({
  title: 'Artists · No Nonsense Collective, Philadelphia',
  desc: `The DJs and producers behind No Nonsense Collective (ILLIXIR, Acidic Dreams, Double Vision) and the ${guests.length} guests who have played our Philadelphia rooms.`,
  pathname: '/artists/',
  ld: [{ '@context': 'https://schema.org', '@type': 'ItemList', name: 'No Nonsense Collective artists', itemListElement: paged.map((a, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/artists/${a.slug}/`, name: a.name })) }],
  trail: [['Home', '/'], ['Artists', '/artists/']],
  body: `<p class="kicker">Artists</p><h1>The collective</h1><p class="lede">The members behind No Nonsense, their projects, and every guest who has played our rooms. The number is how many No Nonsense shows they've played.</p>
<h2>Members + projects</h2><ul class="chips">${artists.filter((a) => a.role !== 'guest').map(chip).join('')}</ul>
<h2>Guests</h2><ul class="chips">${guests.map(chip).join('')}</ul>`
}), '/artists/');

const TAGS = { pair: 'Pair', amp: 'Needs an amp', tech: 'Our tech runs it', sourced: 'Sourced per job' };
const gearRows = (gear) => gear.map((g) => `<tr><td>${g.qty ? g.qty + '×' : '—'}</td><td>${esc(g.model)}${g.note ? `<br><small>${esc(g.note)}</small>` : ''}</td><td>${(g.tags || []).map((t) => `<span class="tag">${TAGS[t]}</span>`).join('')}</td></tr>`).join('');
const owned = rentalsData.cases.flatMap((c) => c.gear.filter((g) => !(g.tags || []).includes('sourced') && !/crew|operator|technician|live vj/i.test(g.model)));
writePage('rentals/index.html', shell({
  title: 'DJ, sound & lighting rentals in Philadelphia · No Nonsense Collective',
  desc: 'Rent CDJ-3000s, a DJM-A9, EV ZLX-15BT tops, S181 subs, moving heads, haze, a laser with a tech, and a 3300W generator in Philadelphia. Pickup, delivery, or full setup, confirmed in a written quote.',
  pathname: '/rentals/',
  ld: [{
    '@context': 'https://schema.org', '@type': 'Service', '@id': `${SITE}/rentals/#service`, name: 'DJ, sound, lighting, and video rentals',
    serviceType: 'Event production equipment rental', url: `${SITE}/rentals/`,
    provider: { '@type': 'Organization', '@id': ORG_ID, name: 'No Nonsense Collective', url: `${SITE}/` },
    areaServed: { '@type': 'City', name: 'Philadelphia', containedInPlace: { '@type': 'State', name: 'Pennsylvania' } },
    hasOfferCatalog: { '@type': 'OfferCatalog', name: 'Rental packages', itemListElement: rentalsData.cases.map((c) => ({ '@type': 'OfferCatalog', name: c.name, itemListElement: c.gear.map((g) => ({ '@type': 'Offer', itemOffered: { '@type': 'Product', name: g.model } })) })) }
  }],
  trail: [['Home', '/'], ['Rentals', '/rentals/']],
  body: `<p class="kicker">Production rentals · Philadelphia</p><h1>DJ, sound + lighting rentals</h1>
<p class="lede">The gear we run our own nights on, for your room: Pioneer CDJ-3000s and a DJM-A9, EV tops and 18" subs, moving heads, haze, a laser (always with our tech), projection with live VJ, and a 3300W generator. Pickup, delivery, or delivery with setup. Nothing is reserved until you accept the written quote.</p>
<a class="btn" href="/#rentals" data-umami-event="rentals-page-build">Build a request</a><a class="btn ghost" href="mailto:${SOCIAL.email}?subject=${encodeURIComponent('Rental request')}">Email us</a>
${rentalsData.zones.map((z) => `<h2>${esc(z.ref)} · ${esc(z.name)}</h2>${rentalsData.cases.filter((c) => c.zone === z.id).map((c) => `<section class="case"><h3>${esc(c.name)} <small class="tag">${esc(c.ref)}</small></h3><p>${esc(c.blurb)}</p><table class="gear"><thead><tr><th>Qty</th><th>Gear</th><th>Notes</th></tr></thead><tbody>${gearRows(c.gear)}${c.addon ? gearRows([{ qty: 1, model: c.addon.gear + ' (add-on)', tags: ['tech'], note: 'Only with our laser technician. Beams stay above the crowd unless the venue holds an approved variance.' }]) : ''}</tbody></table><p><small>${c.circuits ? `Draws about ${c.circuits} × 20A circuit${c.circuits > 1 ? 's' : ''}.` : c.provides ? `Provides a ${esc(c.provides)}.` : 'No power draw of its own.'}</small></p></section>`).join('')}`).join('')}
<h2>How it works</h2><ol><li>Build the manifest on the <a href="/#rentals">rentals screen</a>. It adds power, video path, and rider questions to your request.</li><li>We confirm exact gear, crew, delivery, and price in writing.</li><li>You accept the quote and we lock the date.</li></ol>
<p>Full inventory: ${owned.map((g) => esc(g.model)).join(' · ')}.</p>`
}), '/rentals/');

writePage('404.html', shell({
  title: 'Not found · No Nonsense Collective', desc: 'This page moved or never existed.', pathname: '/404.html', noindex: true,
  body: `<p class="kicker">404</p><h1>Wrong room.</h1><p class="lede">This page moved or never existed. The address drops day of show; this one didn't.</p><a class="btn" href="/">Find the rave</a><a class="btn ghost" href="/events/">All events</a>`
}), '/404.html', false);

write('site.webmanifest', JSON.stringify({ name: 'No Nonsense Collective', short_name: 'No Nonsense', start_url: '/', display: 'standalone', background_color: '#07060c', theme_color: '#07060c', icons: [{ src: '/media/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/media/icon-512.png', sizes: '512x512', type: 'image/png' }] }, null, 2) + '\n');

/* ---------- sitemap + robots ---------- */
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemap.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n')}
</urlset>
`);
write('robots.txt', `User-agent: *\nAllow: /\nDisallow: /tools/\nDisallow: /scores-api/\nDisallow: /docs/\n\nSitemap: ${SITE}/sitemap.xml\n`);

/* ---------- EXIF / GPS check ---------- */
function hasExif(file) {
  const b = fs.readFileSync(file);
  if (b[0] === 0xff && b[1] === 0xd8) { // JPEG: look for an APP1 Exif segment
    let i = 2;
    while (i + 4 < b.length && b[i] === 0xff) {
      const marker = b[i + 1], len = b.readUInt16BE(i + 2);
      if (marker === 0xe1 && b.toString('latin1', i + 4, i + 8) === 'Exif') return true;
      if (marker === 0xda) break;
      i += 2 + len;
    }
    return false;
  }
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return b.includes(Buffer.from('EXIF'));
  if (b.toString('latin1', 1, 4) === 'PNG') return b.includes(Buffer.from('eXIf'));
  return false;
}
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]); }
const tagged = walk(path.join(ROOT, 'media')).filter((f) => /\.(jpe?g|webp|png)$/i.test(f) && hasExif(f));
if (tagged.length) {
  console.warn('These images still carry EXIF data (can include GPS). Strip it before publishing:\n  ' + tagged.map((f) => path.relative(ROOT, f)).join('\n  '));
  if (args.has('--check')) process.exit(1);
}

console.log(`Built ${events.length} events (${upcoming.length} upcoming), ${artists.length} artists (${paged.length} with pages), ${rentalsData.cases.length} rental cases, ${sitemap.length} sitemap URLs.`);
