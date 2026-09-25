// Drop-list signups. POST {email, source, event, website} from the site; GET ?format=csv with the
// admin token exports the list (the weekly sheet export reads this).
import { cors, redis, redisReady, clientIp, firstIn, isAdmin, body, clip, tag, EMAIL_RE, sendEmail, addContact, wrapEmail, csv } from '../lib/shared.js';

const KEY = 'nn:signups';

export default async function handler(req, res) {
  cors(req, res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!redisReady()) return res.status(503).json({ error: 'signups not configured' });
  try {
    if (req.method === 'GET') {
      if (!isAdmin(req)) return res.status(401).json({ error: 'admin token required' });
      const all = (await redis(['HGETALL', KEY])) || [];
      const rows = [];
      for (let i = 0; i < all.length; i += 2) rows.push({ email: all[i], ...JSON.parse(all[i + 1]) });
      rows.sort((a, b) => String(b.first).localeCompare(String(a.first)));
      if (req.query && req.query.format === 'csv') { res.setHeader('Content-Type', 'text/csv; charset=utf-8'); return res.status(200).send(csv(rows, ['email', 'source', 'event', 'first', 'last', 'count'])); }
      return res.status(200).json({ count: rows.length, signups: rows });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

    const b = body(req);
    if (clip(b.website, 200)) return res.status(200).json({ ok: true, emailed: false }); // honeypot: bots fill every field
    const email = clip(b.email, 200).toLowerCase();
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'enter a valid email address' });
    if (!(await firstIn(`nn:signup:rl:${clientIp(req)}`, 10))) return res.status(429).json({ error: 'slow down' });

    const now = new Date().toISOString();
    const prev = await redis(['HGET', KEY, email]);
    const rec = prev ? JSON.parse(prev) : { source: tag(b.source), event: tag(b.event || '') === 'direct' ? '' : tag(b.event), first: now, count: 0 };
    rec.last = now; rec.count += 1;
    await redis(['HSET', KEY, email, JSON.stringify(rec)]);

    let emailed = false;
    if (!prev) {
      await addContact(email);
      emailed = await sendEmail({
        to: email,
        subject: "You're on the No Nonsense drop list",
        idempotencyKey: `signup-${email}`,
        html: wrapEmail("You're on the list.", `<p>Next show announcements, on-sale alerts, and location drops come here first, before Instagram. Only when there's something worth sending.</p><p>Didn't sign up? Ignore this email and you won't hear from us.</p>`),
        text: "You're on the No Nonsense drop list. Show announcements, on-sale alerts, and location drops come here first. Didn't sign up? Ignore this email."
      });
    }
    return res.status(200).json({ ok: true, emailed, returning: !!prev });
  } catch (e) {
    return res.status(500).json({ error: 'signup unavailable' });
  }
}
