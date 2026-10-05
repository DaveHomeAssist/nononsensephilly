import test from 'node:test';
import assert from 'node:assert/strict';
process.env.KV_REST_API_URL = 'https://redis.invalid';
process.env.KV_REST_API_TOKEN = 'mock-only';
process.env.RESEND_API_KEY = 'mock-only';
const { default: signup } = await import('../scores-api/api/signup.js');
const { default: confirm } = await import('../scores-api/api/confirm-signup.js');
const { tokenKey, SIGNUPS } = await import('../scores-api/lib/signup-consent.js');
const { csv } = await import('../scores-api/lib/shared.js');
let state, calls, failMail, failContact, existingContact, redisError;
function reset() { state = new Map(); calls = []; failMail = false; failContact = false; existingContact = false; redisError = false; }
function response(status, value) { return { status, ok: status >= 200 && status < 300, json: async () => value }; }
globalThis.fetch = async (url, options) => {
  const payload = JSON.parse(options.body);
  calls.push({ url, method: options.method, payload });
  if (url === 'https://redis.invalid') {
    if (redisError) return response(200, { error: 'sensitive backend detail' });
    const [command, key, field, value, ...rest] = payload;
    let result;
    switch (command) {
      case 'SET':
        if (payload.includes('NX') && state.has(key)) result = null;
        else { state.set(key, field); result = 'OK'; }
        break;
      case 'GET': result = state.get(key) || null; break;
      case 'DEL': payload.slice(1).forEach(k => state.delete(k)); result = 1; break;
      case 'HGET': result = state.get(key)?.get(field) || null; break;
      case 'HSET': if (!state.has(key)) state.set(key, new Map()); state.get(key).set(field, value); result = 1; break;
      case 'HGETALL': result = [...(state.get(key) || new Map())].flat(); break;
      default: throw new Error(`Unexpected command ${command}`);
    }
    return response(200, { result });
  }
  if (url === 'https://api.resend.com/emails') return response(failMail ? 503 : 200, {});
  if (url.startsWith('https://api.resend.com/contacts')) {
    if (failContact) return response(503, {});
    if (options.method === 'PATCH' && !existingContact) return response(404, {});
    existingContact = true;
    return response(200, {});
  }
  throw new Error('Unexpected external request');
};
async function invoke(handler, value, method = 'POST', ip = 'test-ip') {
  const req = { method, headers: { 'x-real-ip': ip, origin: 'https://nononsensephilly.com' }, body: value };
  const res = { code: 200, headers: {}, setHeader(k,v) {this.headers[k]=v;}, status(n){this.code=n;return this;}, json(value){this.value=value;this.ended=true;return this;}, end(){this.ended=true;return this;} };
  await handler(req, res);
  assert.equal(res.ended,true,'Every response path must end');
  return res;
}
function tokenFromMail() {
  const mail = calls.find(c => c.url.endsWith('/emails'));
  return mail.payload.text.match(/confirm\.html#([a-f0-9]{64})/)[1];
}
function contactCalls() { return calls.filter(c => c.url.includes('/contacts')); }

test('a signup only mails a confirmation; explicit POST creates consent and a contact once', async () => {
  reset();
  const result = await invoke(signup, {email:'test@example.com',source:'test'});
  assert.equal(result.code,200); assert.equal(result.value.pending,true);
  assert.equal(state.has(SIGNUPS), false); assert.equal(contactCalls().length,0);
  const token = tokenFromMail();
  const pendingSet = calls.find(c => c.payload[0] === 'SET' && c.payload[1] === tokenKey(token));
  assert.deepEqual(pendingSet.payload.slice(-2), ['EX','86400']);
  assert.ok(![...state.keys()].some(k => k.includes(token)), 'raw token is not a Redis key');
  assert.equal((await invoke(confirm, {token}, 'GET')).code,405);
  assert.equal(contactCalls().length,0);
  const confirmation = await invoke(confirm,{token});
  assert.equal(confirmation.code,200); assert.equal(confirmation.value.confirmed,true);
  const record = JSON.parse(state.get(SIGNUPS).get('test@example.com'));
  assert.equal(record.consentVersion,'double-opt-in-v1'); assert.ok(record.confirmedAt); assert.ok(record.mailingListSyncedAt);
  assert.equal(state.has(tokenKey(token)),false);
  const count = contactCalls().length;
  assert.equal((await invoke(confirm,{token},'POST','other-ip')).code,410);
  assert.equal(contactCalls().length,count);
});

test('per-address cooldown blocks repeated unsolicited email from different IPs', async () => {
  reset(); await invoke(signup,{email:'test@example.com'});
  await invoke(signup,{email:'test@example.com'},'POST','other-ip');
  assert.equal(calls.filter(c=>c.url.endsWith('/emails')).length,1);
  assert.equal(contactCalls().length,0);
});

test('mail failure leaves no subscribable record; malformed, expired and honeypot requests cannot subscribe', async () => {
  reset(); failMail=true;
  assert.equal((await invoke(signup,{email:'test@example.com'})).code,503);
  assert.equal(state.has(SIGNUPS),false); assert.equal([...state.keys()].filter(k=>k.startsWith('nn:signup:confirm:')).length,0);
  assert.equal((await invoke(signup,'{')).code,400);
  assert.equal((await invoke(signup,'null')).code,400);
  assert.equal((await invoke(confirm,{token:'bad'})).code,400);
  assert.equal((await invoke(confirm,{token:'a'.repeat(64)})).code,410);
  assert.equal((await invoke(signup,{email:'bot@example.com',website:'bot'})).code,200);
  assert.equal(contactCalls().length,0);
});

test('legacy entries are preserved without assuming consent; failed contact sync can retry', async () => {
  reset(); state.set(SIGNUPS,new Map([['test@example.com',JSON.stringify({source:'legacy',first:'2020-01-01',count:1})]]));
  await invoke(signup,{email:'test@example.com'});
  assert.equal(JSON.parse(state.get(SIGNUPS).get('test@example.com')).confirmedAt,undefined);
  const token=tokenFromMail();failContact=true;
  assert.equal((await invoke(confirm,{token})).code,503);
  assert.equal(state.has(tokenKey(token)),true);
  const record=JSON.parse(state.get(SIGNUPS).get('test@example.com'));
  assert.equal(record.first,'2020-01-01');assert.ok(record.confirmedAt);assert.equal(record.mailingListSyncedAt,undefined);
  failContact=false; existingContact=true;
  assert.equal((await invoke(confirm,{token},'POST','retry-ip')).code,200);
  assert.ok(JSON.parse(state.get(SIGNUPS).get('test@example.com')).mailingListSyncedAt);
});

test('confirmation lock blocks concurrent mutation and Redis errors do not masquerade as success', async () => {
  reset();await invoke(signup,{email:'test@example.com'});const token=tokenFromMail();state.set(`${tokenKey(token)}:lock`,'1');
  assert.equal((await invoke(confirm,{token})).code,409);assert.equal(contactCalls().length,0);assert.equal(state.has(`${tokenKey(token)}:lock`),true);
  reset();redisError=true;const result=await invoke(signup,{email:'test@example.com'});assert.equal(result.code,500);assert.equal(JSON.stringify(result.value).includes('sensitive'),false);
});

test('CSV treats formulas including leading whitespace as text and quotes carriage returns', () => {
  const output=csv([{v:'=SUM(1,2)'},{v:' \t+1'},{v:'@cmd'},{v:'x\ry'},{v:'plain'}],['v']);
  assert.ok(output.includes('"\'=SUM(1,2)"'));assert.ok(output.includes("' \t+1"));assert.ok(output.includes("'@cmd"));assert.ok(output.includes('"x\ry"'));assert.ok(output.endsWith('plain\n'));
});

test('platform response contract ends method, disabled and timeout paths without hanging', async () => {
  reset();
  assert.equal((await invoke(signup,{},'PUT')).code,405);
  assert.equal((await invoke(confirm,{},'OPTIONS')).code,204);
  delete process.env.RESEND_API_KEY;
  assert.equal((await invoke(signup,{email:'test@example.com'})).code,503);
  process.env.RESEND_API_KEY='mock-only';
  const previousFetch=globalThis.fetch;
  try {
    globalThis.fetch=(_url,options)=>new Promise((resolve,reject)=>{
      const keepAlive=setTimeout(()=>reject(new Error('upstream failed to time out')),5000);
      options.signal.addEventListener('abort',()=>{clearTimeout(keepAlive);reject(options.signal.reason);},{once:true});
    });
    const start=Date.now();const result=await invoke(signup,{email:'test@example.com'});
    assert.equal(result.code,500);assert.ok(Date.now()-start<4500);
  } finally {globalThis.fetch=previousFetch;}
});
