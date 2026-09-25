// Day-of location drop. The address lives in Upstash, never in the public repo, and this
// endpoint only returns it once revealAt has passed on the server's clock.
//
//   GET    /api/drop  public: { active:false } | { active, revealed:false, event, revealAt }
//                     | { active, revealed:true, event, revealAt, venue, address, mapX, mapY }
//   POST   /api/drop  admin: set the drop (JSON body, see clean())
//   DELETE /api/drop  admin: clear it
//
// Admin requests send `Authorization: Bearer <DROP_ADMIN_TOKEN>`. Crew notes (load-in door,
// truck path, power) only come back to the admin token or DROP_CREW_TOKEN, never publicly.
import { timingSafeEqual } from 'node:crypto';

const KEY = 'nn:drop';
const ORIGINS = ['https://nononsensephilly.com', 'https://www.nononsensephilly.com'];
const env = process.env;
const URL_ = env.nononsense_scores_KV_REST_API_URL || env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
const TOKEN = env.nononsense_scores_KV_REST_API_TOKEN || env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
const HOUR = 3600 * 1000;

async function redis(cmd) {
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return (await r.json()).result;
}

function bearer(req) { return String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim(); }
function matches(got, want) {
  if (!got || !want) return false;
  const a = Buffer.from(got), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

function text(v, max, required, name) {
  if (v == null || v === '') { if (required) throw new Error(`${name} is required`); return ''; }
  const s = String(v).trim();
  if (s.length > max) throw new Error(`${name} is longer than ${max} characters`);
  return s;
}
function coord(v, max, name) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max) throw new Error(`${name} must be between 0 and ${max}`);
  return Math.round(n);
}
function clean(body) {
  const event = text(body.event, 80, true, 'event');
  if (!/^[a-z0-9-]+$/.test(event)) throw new Error('event must be the event slug, like afterbreak-2026');
  const reveal = new Date(body.revealAt);
  if (Number.isNaN(reveal.getTime())) throw new Error('revealAt must be a date and time');
  const now = Date.now();
  if (reveal.getTime() < now - 48 * HOUR || reveal.getTime() > now + 60 * 24 * HOUR) throw new Error('revealAt must be within the next 60 days');
  const expires = body.expiresAt ? new Date(body.expiresAt) : new Date(reveal.getTime() + 36 * HOUR);
  if (Number.isNaN(expires.getTime()) || expires <= reveal) throw new Error('expiresAt must be after revealAt');
  const crew = body.crew || {};
  return {
    event,
    revealAt: reveal.toISOString(),
    expiresAt: expires.toISOString(),
    venue: text(body.venue, 120, true, 'venue'),
    address: text(body.address, 200, true, 'address'),
    mapX: coord(body.mapX, 2000, 'mapX'),
    mapY: coord(body.mapY, 1600, 'mapY'),
    crew: { loadIn: text(crew.loadIn, 200, false, 'loadIn'), truckPath: text(crew.truckPath, 200, false, 'truckPath'), power: text(crew.power, 200, false, 'power') },
    updatedAt: new Date(now).toISOString()
  };
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (ORIGINS.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin || '')) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!URL_ || !TOKEN) return res.status(503).json({ error: 'drop not configured' });

  const token = bearer(req);
  const admin = matches(token, env.DROP_ADMIN_TOKEN);
  const crew = admin || matches(token, env.DROP_CREW_TOKEN);

  try {
    if (req.method === 'GET') {
      const raw = await redis(['GET', KEY]);
      if (!raw) return res.status(200).json({ active: false });
      const d = JSON.parse(raw);
      const revealed = Date.now() >= new Date(d.revealAt).getTime();
      if (admin) return res.status(200).json({ active: true, revealed, ...d });
      if (!revealed) return res.status(200).json({ active: true, revealed: false, event: d.event, revealAt: d.revealAt });
      const out = { active: true, revealed: true, event: d.event, revealAt: d.revealAt, venue: d.venue, address: d.address, mapX: d.mapX, mapY: d.mapY };
      if (crew) out.crew = d.crew;
      return res.status(200).json(out);
    }
    if (req.method !== 'POST' && req.method !== 'DELETE') return res.status(405).json({ error: 'method not allowed' });
    if (!env.DROP_ADMIN_TOKEN) return res.status(503).json({ error: 'DROP_ADMIN_TOKEN is not set on the server' });
    if (!admin) {
      const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
      // One wrong guess per IP every 5 seconds.
      const first = await redis(['SET', `nn:drop:fail:${ip}`, '1', 'EX', '5', 'NX']);
      if (first !== 'OK') return res.status(429).json({ error: 'slow down' });
      return res.status(401).json({ error: 'wrong or missing admin token' });
    }
    if (req.method === 'DELETE') { await redis(['DEL', KEY]); return res.status(200).json({ active: false }); }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    let d;
    try { d = clean(body); } catch (e) { return res.status(400).json({ error: e.message }); }
    const ttl = Math.max(60, Math.ceil((new Date(d.expiresAt).getTime() - Date.now()) / 1000));
    await redis(['SET', KEY, JSON.stringify(d), 'EX', String(ttl)]);
    return res.status(200).json({ active: true, revealed: Date.now() >= new Date(d.revealAt).getTime(), ...d });
  } catch (e) {
    return res.status(500).json({ error: 'drop unavailable' });
  }
}
