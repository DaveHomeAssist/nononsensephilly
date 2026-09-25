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
  const tickets = (ph === 'on-sale' && e.ticketUrl) ? `<a class="btn btn-primary ev-tix" href="${esc(e.ticketUrl)}" target="_blank" rel="noopener noreferrer">Tickets</a>` : '';
  const vids = (e.videos || []).length ? `<span class="ev-has">▶ ${e.videos.length} video${e.videos.length > 1 ? 's' : ''}</span>` : '';
  const sets = (e.nights || []).some((n) => (n.sets || []).length) ? '<span class="ev-has">Set times</span>' : '';
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

const recapItems = [
  ...events.flatMap((e) => (e.videos || []).map((v) => ({ ...v, event: e.slug, eventTitle: e.title }))),
  ...(eventsData.recaps || []).map((v) => ({ ...v, eventTitle: v.note || '' }))
];
blocks['recaps'] = '\n' + recapItems.map((v) => `            <li><button type="button" class="rc-item" data-video="${esc(v.youtube)}" data-video-title="${esc(v.title)}"><img src="https://i.ytimg.com/vi/${esc(v.youtube)}/mqdefault.jpg" alt="" width="320" height="180" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'"><span class="rc-play" aria-hidden="true">▶</span><b>${esc(v.title)}</b><small>${esc(v.eventTitle)}</small></button></li>`).join('\n') + '\n          ';

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
  const addon = c.addon ? `\n              <button type="button" class="case-addon rental-add" data-rental="${esc(c.addon.name)}" data-addon>+ ${esc(c.addon.label)} <span>tech required</span></button>` : '';
  return `            <article class="rental-card" data-rental-cat="${c.zone}"${first ? '' : ' hidden'}>
              <div class="case-top"><span class="case-code" aria-hidden="true">${esc(c.code)}</span><span class="case-ref">${esc(c.ref)}</span></div>
              <h3>${esc(c.name)}</h3>
              <p>${esc(c.blurb)}</p>
              <ul class="case-specs">${c.chips.map((x) => `<li>${esc(x)}</li>`).join('')}<li class="case-spec-li"><button type="button" class="case-spec" data-spec="${esc(c.name)}" aria-label="Full gear list: ${esc(c.name)}">Full spec</button></li></ul>
              <button type="button" class="btn case-add rental-add" data-rental="${esc(c.name)}">Add to manifest</button>${addon}
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
blocks['data'] = `<script type="application/json" id="nn-data">${JSON.stringify(dataForPage).replace(/</g, '\\u003c')}</script>`;

let html = read('index.html');
for (const [name, body] of Object.entries(blocks)) {
  const re = new RegExp(`(<!-- nn:${name} -->)[\\s\\S]*?(<!-- /nn:${name} -->)`);
  if (!re.test(html)) { console.error(`index.html is missing the <!-- nn:${name} --> block`); process.exit(1); }
  html = html.replace(re, (_, a, b) => a + body + b);
}
write('index.html', html);

/* ---------- /events/<slug>/ pages ---------- */
function isoDate(e) { return e.start ? e.start : e.sortDate ? null : null; }
function eventPage(e) {
  const ph = phase(e, now);
  const url = `${SITE}/events/${e.slug}/`;
  const og = fs.existsSync(path.join(ROOT, `media/og/${e.slug}.jpg`)) ? `${SITE}/media/og/${e.slug}.jpg` : `${SITE}/${flyerFull(e)}`;
  const desc = `${e.dateLabel} · ${where(e)}. ${e.summary}${(e.lineup || []).length ? ' Lineup: ' + e.lineup.filter((x) => !/mystery/i.test(x)).join(', ') + '.' : ''}`;
  const ld = isoDate(e) ? {
    '@context': 'https://schema.org', '@type': 'MusicEvent', name: e.title, startDate: e.start, ...(e.end ? { endDate: e.end } : {}),
    eventStatus: 'https://schema.org/' + (ph === 'cancelled' ? 'EventCancelled' : 'EventScheduled'),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: where(e) || 'Philadelphia', address: { '@type': 'PostalAddress', addressLocality: 'Philadelphia', addressRegion: 'PA', addressCountry: 'US', ...(e.venue && e.venue.public && /\d/.test(e.venue.name || '') ? { streetAddress: e.venue.name } : {}) } },
    image: [`${SITE}/${flyerFull(e)}`], description: e.summary,
    organizer: { '@type': 'Organization', name: 'No Nonsense Collective', url: SITE },
    performer: [...new Set(actsOf(e).flatMap((a) => splitAct(a).filter((s) => s.artist).map((s) => artists.find((x) => x.slug === s.artist).name)))].map((n) => ({ '@type': 'PerformingGroup', name: n })),
    ...(e.ticketUrl ? { offers: { '@type': 'Offer', url: e.ticketUrl, availability: 'https://schema.org/' + (ph === 'sold-out' ? 'SoldOut' : 'InStock') } } : {})
  } : null;
  const nights = (e.nights || []).map((n) => `<section class="night"><h2>${esc(n.label)}${n.status === 'cancelled' ? ' <span class="x">Cancelled</span>' : ''}</h2>${n.note ? `<p>${esc(n.note)}</p>` : ''}${(n.sets || []).length ? `<ol class="sets">${n.sets.map((s) => `<li><time>${esc(s[0])}</time><span>${actHTML(s[1], 'page')}</span></li>`).join('')}</ol>` : ''}</section>`).join('');
  const door = e.door || {};
  const doorRows = [['Age', door.age], ['Re-entry', door.reentry], ['Bring', door.bring], ['Floor', door.floor]].filter((r) => r[1]).map((r) => `<dt>${r[0]}</dt><dd>${esc(r[1])}</dd>`).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(e.title)} · No Nonsense Collective</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(e.title)} · No Nonsense Collective">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${og}">
<meta property="og:image:alt" content="${esc(e.title)} flyer">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${og}">
<meta name="theme-color" content="#07060c">
${ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>\n` : ''}<style>
:root{color-scheme:dark;--bg:#07060c;--surface:#14121c;--text:#f4efe6;--muted:#c8c0d4;--amber:#ffb23e;--rose:#ff4f8b;--ice:#8ab8ff;--border:#322c3e}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 system-ui,"Segoe UI",sans-serif}
a{color:var(--amber)}
.wrap{max-width:1040px;margin:0 auto;padding:24px 16px 56px}
.top{display:flex;justify-content:space-between;align-items:center;gap:12px;font:500 12px/1.2 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase}
.top a{color:var(--text);text-decoration:none}
.grid{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:32px;margin-top:24px;align-items:start}
img{display:block;width:100%;height:auto;border-radius:14px;border:1px solid var(--border)}
.kicker{margin:0 0 8px;font:500 12px/1.2 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--rose)}
h1{margin:0 0 8px;font-size:clamp(2rem,1.3rem + 3vw,3.4rem);line-height:1;letter-spacing:-.03em}
.meta{margin:0 0 16px;font:500 13px/1.4 ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--ice)}
.notice{padding:10px 14px;border:1px solid var(--rose);border-radius:10px;color:#ffd0dd}
.btn{display:inline-block;margin:6px 8px 0 0;padding:12px 20px;border-radius:999px;background:var(--amber);color:#1c1204;font-weight:700;text-decoration:none}
.btn.ghost{background:transparent;color:var(--text);border:1px solid var(--border)}
h2{margin:28px 0 10px;font-size:1.05rem;letter-spacing:.02em}
.x{color:var(--rose);font-size:.8em}
.sets{list-style:none;margin:0;padding:0;border-top:1px solid var(--border)}
.sets li{display:grid;grid-template-columns:64px 1fr;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)}
.sets time{font:500 13px/1.6 ui-monospace,monospace;color:var(--amber)}
.lineup{display:flex;flex-wrap:wrap;gap:8px;list-style:none;margin:0;padding:0}
.lineup li{padding:6px 12px;border:1px solid var(--border);border-radius:999px;background:var(--surface);font:500 12px/1.3 ui-monospace,monospace;text-transform:uppercase;letter-spacing:.06em}
.lineup a,.sets a{color:var(--text)}
dl{display:grid;grid-template-columns:max-content 1fr;gap:6px 16px;margin:0}
dt{font:500 12px/1.6 ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
dd{margin:0}
@media (max-width:760px){.grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="wrap">
  <p class="top"><a href="/">No Nonsense Collective</a><a href="/#events">All events</a></p>
  <div class="grid">
    <a href="../../${flyerFull(e)}"><img src="../../${flyerCard(e)}" alt="${esc(e.title)} flyer" width="720" height="900"></a>
    <div>
      <p class="kicker">${CAT[e.category]} · ${STATUS[ph]}</p>
      <h1>${esc(e.title)}</h1>
      <p class="meta">${esc(e.dateLabel)} · ${esc(where(e))}</p>
      ${e.notice ? `<p class="notice">${esc(e.notice)}</p>` : ''}
      <p>${esc(e.summary)}</p>
      ${ph === 'on-sale' && e.ticketUrl ? `<a class="btn" href="${esc(e.ticketUrl)}">Tickets</a>` : ''}<a class="btn ghost" href="/#event/${e.slug}">Open on the site</a>
      ${(e.lineup || []).length ? `<h2>Lineup</h2><ul class="lineup">${e.lineup.map((a) => `<li>${actHTML(a, 'page')}</li>`).join('')}</ul>` : ''}
      ${e.lineupNote ? `<p>${esc(e.lineupNote)}</p>` : ''}
      ${nights ? `<h2>Set times</h2>${nights}` : ''}
      ${doorRows ? `<h2>At the door</h2><dl>${doorRows}</dl>` : ''}
      ${e.production ? `<h2>Production</h2><p>${esc(e.production)}</p>` : ''}
      ${(e.videos || []).length ? `<h2>Video</h2><ul>${e.videos.map((v) => `<li><a href="https://www.youtube.com/watch?v=${esc(v.youtube)}">${esc(v.title)}</a></li>`).join('')}</ul>` : ''}
      ${(e.audio || []).length ? `<h2>Listen</h2><ul>${e.audio.map((t) => `<li><a href="${esc(t.url)}">${esc(t.artist)}: ${esc(t.title)}</a></li>`).join('')}</ul>` : ''}
    </div>
  </div>
</div>
</body>
</html>
`;
}
for (const e of events) write(`events/${e.slug}/index.html`, eventPage(e));

/* ---------- sitemap + robots ---------- */
const today = now.toISOString().slice(0, 10);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc><lastmod>${today}</lastmod></url>
${events.map((e) => `  <url><loc>${SITE}/events/${e.slug}/</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`);
write('robots.txt', `User-agent: *\nAllow: /\nDisallow: /tools/\nDisallow: /scores-api/\n\nSitemap: ${SITE}/sitemap.xml\n`);

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

/* ---------- share images ---------- */
if (args.has('--og')) {
  let chromium;
  try { const mod = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'); chromium = mod.chromium || (mod.default && mod.default.chromium); if (!chromium) throw new Error('no chromium'); }
  catch { console.error('Share images need Playwright. Set PLAYWRIGHT_MODULE to its path or install it.'); process.exit(1); }
  const fontCss = (read('index.html').match(/@font-face\{[^}]+\}/g) || []).join('\n');
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
      .st{position:absolute;top:54px;right:40px;padding:8px 14px;border-radius:999px;font:700 14px/1 "IBM Plex Mono";letter-spacing:.14em;text-transform:uppercase;background:${ph === 'past' ? '#241c33' : '#ffb23e'};color:${ph === 'past' ? '#f4efe6' : '#1c1204'}}
      .r{background:url(${img}) center/cover;border-left:3px solid #ff4f8b}
    </style></head><body><div class="l"><div class="brand">No Nonsense<small>Collective · Philadelphia</small></div><span class="st">${esc(STATUS[ph])}</span><h1>${esc(e.title)}</h1><p class="meta">${esc(e.dateLabel)} · ${esc(where(e))}</p>${acts ? `<p class="acts">${esc(acts)}</p>` : ''}</div><div class="r"></div></body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(ROOT, `media/og/${e.slug}.jpg`), type: 'jpeg', quality: 84 });
  }
  await browser.close();
  for (const e of events) write(`events/${e.slug}/index.html`, eventPage(e));
  console.log(`Share images: ${events.length} written to media/og/`);
}

console.log(`Built ${events.length} events (${upcoming.length} upcoming), ${artists.length} artists, ${rentalsData.cases.length} rental cases.`);
