// Contact and rental requests. POST from the site's contact form. Rentals get a reference like
// NNC-2026-014. The crew inbox gets the request (reply goes straight to the sender) and the sender
// gets a copy. `notified:false` tells the site to fall back to the visitor's email app.
// GET ?format=csv with the admin token exports every request.
import { cors, redis, redisReady, clientIp, firstIn, isAdmin, body, clip, tag, esc, EMAIL_RE, CREW_INBOX, sendEmail, wrapEmail, csv } from '../lib/shared.js';

const LIST = 'nn:requests';
const SUBJECTS = ['General', 'Booking & Talent', 'Rentals & Production', 'Press & Media', 'Vendor & Sponsorship', 'Room Buyout'];

export default async function handler(req, res) {
  cors(req, res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!redisReady()) return res.status(503).json({ error: 'requests not configured' });
  try {
    if (req.method === 'GET') {
      if (!isAdmin(req)) return res.status(401).json({ error: 'admin token required' });
      const rows = ((await redis(['LRANGE', LIST, '0', '999'])) || []).map((r) => JSON.parse(r));
      if (req.query && req.query.format === 'csv') { res.setHeader('Content-Type', 'text/csv; charset=utf-8'); return res.status(200).send(csv(rows, ['ref', 'at', 'kind', 'subject', 'name', 'email', 'source', 'notified', 'message'])); }
      return res.status(200).json({ count: rows.length, requests: rows });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

    const b = body(req);
    if (clip(b.website, 200)) return res.status(200).json({ ok: true, notified: true }); // honeypot
    const name = clip(b.name, 120), email = clip(b.email, 200).toLowerCase(), message = clip(b.message, 6000);
    const subject = SUBJECTS.includes(b.subject) ? b.subject : 'General';
    if (!name) return res.status(400).json({ error: 'name is required' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'enter a valid email address' });
    if (message.length < 2) return res.status(400).json({ error: 'message is required' });
    if (!(await firstIn(`nn:request:rl:${clientIp(req)}`, 20))) return res.status(429).json({ error: 'slow down' });

    const at = new Date();
    const kind = subject === 'Rentals & Production' ? 'rental' : 'contact';
    let ref = '';
    if (kind === 'rental') {
      const n = await redis(['INCR', `nn:quote:seq:${at.getUTCFullYear()}`]);
      ref = `NNC-${at.getUTCFullYear()}-${String(n).padStart(3, '0')}`;
    }
    const label = ref ? `${subject} · ${name} · ${ref}` : `${subject} · ${name}`;
    const rec = { ref, at: at.toISOString(), kind, subject, name, email, source: tag(b.source), message, notified: false };

    const pre = `<pre style="white-space:pre-wrap;font:14px/1.5 ui-monospace,monospace;background:#14121c;padding:14px;border-radius:10px">${esc(message)}</pre>`;
    rec.notified = await sendEmail({
      to: CREW_INBOX, replyTo: email,
      subject: `[nononsensephilly.com] ${label}`,
      idempotencyKey: `request-crew-${ref || at.getTime() + email}`,
      html: wrapEmail(label, `<p><b>From:</b> ${esc(name)} &lt;${esc(email)}&gt;<br><b>Source:</b> ${esc(rec.source)}</p>${pre}<p>Reply to this email to answer ${esc(name)} directly.</p>`),
      text: `${label}\nFrom: ${name} <${email}>\nSource: ${rec.source}\n\n${message}`
    });
    if (rec.notified) {
      await sendEmail({
        to: email,
        subject: ref ? `We got your rental request (${ref})` : 'We got your message',
        idempotencyKey: `request-copy-${ref || at.getTime() + email}`,
        html: wrapEmail(ref ? `Request ${ref} received.` : 'Message received.', `<p>Thanks, ${esc(name)}. ${ref ? 'We confirm gear, crew, availability, and price in a written quote. Nothing is reserved until you accept it.' : "We'll get back to you soon."} Reply to this email if anything changes.</p><p style="color:#c8c0d4">Your copy:</p>${pre}`),
        text: `${ref ? `Request ${ref} received.` : 'Message received.'} Your copy:\n\n${message}`
      });
    }
    await redis(['LPUSH', LIST, JSON.stringify(rec)]);
    await redis(['LTRIM', LIST, '0', '4999']);
    return res.status(200).json({ ok: true, ref, notified: rec.notified });
  } catch (e) {
    return res.status(500).json({ error: 'requests unavailable' });
  }
}
