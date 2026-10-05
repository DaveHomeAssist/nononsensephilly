import { boundedHandler } from '../lib/request-budget.js';
// Confirmation is an explicit POST: link previews and email security scanners cannot subscribe.
import { cors, redis, redisReady, clientIp, firstIn, body, addContact } from '../lib/shared.js';
import { SIGNUPS, tokenKey, validToken } from '../lib/signup-consent.js';

export default boundedHandler(async function handler(req, res) {
  cors(req, res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'confirm using the page button' });
  if (!redisReady()) return res.status(503).json({ error: 'confirmation unavailable' });
  let lock;
  try {
    const token = body(req).token;
    if (!validToken(token)) return res.status(400).json({ error: 'invalid confirmation link' });
    if (!(await firstIn(`nn:signup:confirm-ip:${clientIp(req)}`, 2))) return res.status(429).json({ error: 'please wait a moment and try again' });
    const key = tokenKey(token);
    if (!(await redis(['GET', key]))) return res.status(410).json({ error: 'this link has expired or was already used; request a new one if needed' });
    lock = `${key}:lock`;
    if (!(await firstIn(lock, 90))) { lock = null; return res.status(409).json({ error: 'confirmation is already in progress; try again shortly' }); }
    const raw = await redis(['GET', key]);
    if (!raw) return res.status(410).json({ error: 'this link has expired or was already used' });
    const pending = JSON.parse(raw);
    const prev = await redis(['HGET', SIGNUPS, pending.email]);
    const now = new Date().toISOString();
    const record = { ...(prev ? JSON.parse(prev) : {}), source: pending.source, event: pending.event, last: now, confirmedAt: now, consentVersion: 'double-opt-in-v1' };
    if (prev && JSON.parse(prev).confirmedAt) record.confirmedAt = JSON.parse(prev).confirmedAt;
    record.first ||= pending.requestedAt;
    record.count = (record.count || 0) + 1;
    // Persist the consent evidence before making the address available for broadcasts.
    await redis(['HSET', SIGNUPS, pending.email, JSON.stringify(record)]);
    if (!(await addContact(pending.email))) return res.status(503).json({ error: 'confirmation recorded but mailing-list sync failed; try this button again shortly' });
    record.mailingListSyncedAt = new Date().toISOString();
    await redis(['HSET', SIGNUPS, pending.email, JSON.stringify(record)]);
    await redis(['DEL', key]);
    return res.status(200).json({ ok: true, confirmed: true });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'confirmation unavailable; try again shortly' });
  } finally {
    if (lock) { try { await redis(['DEL', lock]); } catch { /* bounded lease expires without a background task */ } }
  }
});
