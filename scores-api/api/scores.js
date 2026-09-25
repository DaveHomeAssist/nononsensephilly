// Global arcade leaderboard for the No Nonsense splash game, stored in Upstash Redis.
const KEY = 'nn:crowd:scores';
const ORIGINS = ['https://nononsensephilly.com', 'https://www.nononsensephilly.com'];
const env = process.env;
const URL_ = env.nononsense_scores_KV_REST_API_URL || env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
const TOKEN = env.nononsense_scores_KV_REST_API_TOKEN || env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;

async function redis(cmd) {
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return (await r.json()).result;
}

async function top() {
  const raw = await redis(['ZREVRANGE', KEY, '0', '9', 'WITHSCORES']);
  const out = [];
  for (let i = 0; i < raw.length; i += 2) out.push({ initials: String(raw[i]).split('|')[0], score: Number(raw[i + 1]) });
  return out;
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (ORIGINS.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin || '')) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!URL_ || !TOKEN) return res.status(503).json({ error: 'leaderboard not configured' });

  try {
    if (req.method === 'GET') return res.status(200).json({ scores: await top() });
    if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const initials = String(body.initials || '').toUpperCase();
    const score = Number(body.score);
    const ms = Number(body.ms);
    if (!/^[A-Z0-9]{3}$/.test(initials)) return res.status(400).json({ error: 'initials must be 3 letters or digits' });
    // The game moves at most one cell per 70 ms and needs at least one move per drop.
    if (!Number.isInteger(score) || score < 1 || score > 500 || !(ms > 0) || score > ms / 70) {
      return res.status(400).json({ error: 'score rejected' });
    }
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    const ok = await redis(['SET', `nn:crowd:rl:${ip}`, '1', 'EX', '15', 'NX']);
    if (ok !== 'OK') return res.status(429).json({ error: 'slow down' });

    await redis(['ZADD', KEY, String(score), `${initials}|${Date.now()}|${Math.random().toString(36).slice(2, 7)}`]);
    await redis(['ZREMRANGEBYRANK', KEY, '0', '-101']);
    return res.status(200).json({ scores: await top() });
  } catch (e) {
    return res.status(500).json({ error: 'leaderboard unavailable' });
  }
}
