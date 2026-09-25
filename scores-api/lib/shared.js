// Helpers shared by the signup and request endpoints (Upstash Redis + Resend).
export const ORIGINS = ['https://nononsensephilly.com', 'https://www.nononsensephilly.com'];
const env = process.env;
const URL_ = env.nononsense_scores_KV_REST_API_URL || env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
const TOKEN = env.nononsense_scores_KV_REST_API_TOKEN || env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
export const CREW_INBOX = env.CREW_INBOX || 'nononsensephl@gmail.com';
export const MAIL_FROM = env.MAIL_FROM || 'No Nonsense Collective <hello@nononsensephilly.com>';
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const redisReady = () => !!(URL_ && TOKEN);
export async function redis(cmd) {
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return (await r.json()).result;
}

export function cors(req, res, methods) {
  const origin = req.headers.origin;
  if (ORIGINS.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin || '')) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
}

export const clientIp = (req) => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';

/** True the first time in `seconds` for this key; false while it's cooling down. */
export async function firstIn(key, seconds) {
  return (await redis(['SET', key, '1', 'EX', String(seconds), 'NX'])) === 'OK';
}

export function isAdmin(req) {
  const want = env.DROP_ADMIN_TOKEN, got = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!want || !got || want.length !== got.length) return false;
  let diff = 0; for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

export function body(req) { return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
export function clip(v, max) { return String(v == null ? '' : v).replace(/\u0000/g, '').trim().slice(0, max); }
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** Source tags are short labels like "instagram" or "afterbreak-2026". */
export const tag = (v) => clip(v, 40).toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'direct';

/** Sends through Resend. Returns true only when Resend accepted the email. */
export async function sendEmail({ to, subject, html, text, replyTo, idempotencyKey }) {
  if (!env.RESEND_API_KEY) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
      body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) })
    });
    return r.ok;
  } catch { return false; }
}

/** Adds a drop-list signup to Resend contacts so broadcasts can reach them. Best effort. */
export async function addContact(email) {
  if (!env.RESEND_API_KEY) return false;
  try {
    const r = await fetch('https://api.resend.com/contacts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, unsubscribed: false })
    });
    return r.ok;
  } catch { return false; }
}

export function wrapEmail(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#07060c;color:#f4efe6;font:16px/1.55 system-ui,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:28px 20px">
<p style="margin:0 0 18px;font:700 18px/1 system-ui;letter-spacing:-.02em;text-transform:uppercase;color:#ffb23e">No Nonsense</p>
<h1 style="margin:0 0 14px;font-size:22px;line-height:1.2">${esc(title)}</h1>
${bodyHtml}
<p style="margin:28px 0 0;font-size:13px;color:#c8c0d4">No Nonsense Collective · Philadelphia · <a href="https://nononsensephilly.com" style="color:#ffb23e">nononsensephilly.com</a></p>
</div></body></html>`;
}

export function csv(rows, cols) {
  const cell = (v) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n') + '\n';
}
