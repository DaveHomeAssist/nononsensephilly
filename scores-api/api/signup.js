import { boundedHandler } from '../lib/request-budget.js';
// Drop-list signups. POST {email, source, event, website} from the site; GET ?format=csv with the
// admin token exports the list (the weekly sheet export reads this).
import { cors, redis, redisReady, clientIp, firstIn, adminGate, body, clip, tag, EMAIL_RE, sendEmail, wrapEmail, csv } from '../lib/shared.js';

import { SIGNUPS as KEY, CONFIRM_TTL, digest, newToken, tokenKey, consentStatus } from '../lib/signup-consent.js';

export default boundedHandler(async function handler(req, res) {
  cors(req, res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!redisReady()) return res.status(503).json({ error: 'signups not configured' });
  try {
    if (req.method === 'GET') {
      if (!(await adminGate(req, res))) return;
      const all = (await redis(['HGETALL', KEY])) || [];
      const rows = [];
      for (let i = 0; i < all.length; i += 2) { const record = JSON.parse(all[i + 1]); rows.push({ email: all[i], ...record, consent: consentStatus(record) }); }
      rows.sort((a, b) => String(b.first).localeCompare(String(a.first)));
      if (req.query && req.query.format === 'csv') { res.setHeader('Content-Type', 'text/csv; charset=utf-8'); return res.status(200).send(csv(rows, ['email', 'source', 'event', 'first', 'last', 'count', 'consent', 'confirmedAt', 'mailingListSyncedAt'])); }
      return res.status(200).json({ count: rows.length, signups: rows });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

    const b = body(req);
    if (clip(b.website, 200)) return res.status(200).json({ ok: true, emailed: false }); // honeypot: bots fill every field
    const email = clip(b.email, 200).toLowerCase();
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'enter a valid email address' });
    if (!(await firstIn(`nn:signup:rl:${clientIp(req)}`, 10))) return res.status(429).json({ error: 'slow down' });

    // Do not reveal whether an address is already subscribed, and bound unsolicited mail.
    if (!process.env.RESEND_API_KEY) return res.status(503).json({ error: 'confirmation email unavailable' });
    if (!(await firstIn(`nn:signup:email:${digest(email)}`, 3600))) return res.status(200).json({ ok: true, pending: true });
    const now = new Date().toISOString();
    const token = newToken();
    const pending = { email, source: tag(b.source), event: tag(b.event || '') === 'direct' ? '' : tag(b.event), requestedAt: now };
    await redis(['SET', tokenKey(token), JSON.stringify(pending), 'EX', String(CONFIRM_TTL)]);
    // A fragment avoids sending the token in URL request logs or referrer headers.
    const link = `https://nononsense-scores.vercel.app/confirm.html#${token}`;
    const emailed = await sendEmail({
      to: email,
      subject: 'Confirm your No Nonsense drop-list signup',
      idempotencyKey: `signup-confirm-${digest(token)}`,
      html: wrapEmail('Confirm your signup.', `<p>Someone requested show announcements, on-sale alerts, and location drops for this address.</p><p><a href="${link}">Review and confirm your signup</a></p><p>This link expires in 24 hours. Nothing is added to the mailing list by this request. If you did not request it, ignore this email.</p>`),
      text: `Confirm your No Nonsense drop-list signup: ${link}\nThe link expires in 24 hours. You must press Confirm on the page to join. If you did not request this, ignore this email.`
    });
    if (!emailed) {
      await redis(['DEL', tokenKey(token), `nn:signup:email:${digest(email)}`]);
      return res.status(503).json({ error: 'confirmation email unavailable' });
    }
    return res.status(200).json({ ok: true, pending: true });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.status ? e.message : 'signup unavailable' });
  }
});
