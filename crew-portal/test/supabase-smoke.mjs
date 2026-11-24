import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID, createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { createPortal } from '../server.mjs';

const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, MAILPIT_URL } = process.env;
for (const origin of [SUPABASE_URL, MAILPIT_URL]) {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname),
    'Run against disposable localhost Supabase and Mailpit instances');
}
const admin = { apikey: SUPABASE_SECRET_KEY, Authorization: 'Bearer ' + SUPABASE_SECRET_KEY };
const prefix = 'pilot-' + randomUUID().slice(0, 8);
const show = '/shows/' + prefix;
const api = createPortal({
  supabaseUrl: SUPABASE_URL, publishableKey: SUPABASE_PUBLISHABLE_KEY, secretKey: SUPABASE_SECRET_KEY
});
api.listen(0, '127.0.0.1');
await once(api, 'listening');
const portal = 'http://127.0.0.1:' + api.address().port;

async function call(base, path, status, { method = 'GET', token, data, headers, bytes } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(data ? { 'Content-Type': 'application/json' } : {}),
      ...(bytes ? { 'Content-Type': 'application/pdf' } : {}),
      ...headers
    },
    body: bytes ?? (data ? JSON.stringify(data) : undefined)
  });
  if (response.status !== status) {
    const detail = await response.json().catch(() => ({}));
    assert.equal(response.status, status, method + ' ' + path + ' ' + (detail.error ?? detail.message ?? ''));
  }
  return response;
}

const post = (base, path, status, data, options) =>
  call(base, path, status, { method: 'POST', data, ...options });

async function recruit(role) {
  const email = prefix + '-' + role + '@example.com';
  const response = await post(SUPABASE_URL, '/auth/v1/admin/users', 200,
    { email, email_confirm: true }, { headers: admin });
  return { email, id: (await response.json()).id };
}

async function signIn(user) {
  await post(portal, '/auth/code', 202, { email: user.email });
  let code;
  for (let attempt = 0; attempt < 25 && !code; attempt++) {
    const inbox = await (await call(MAILPIT_URL, '/api/v1/messages', 200)).json();
    const message = inbox.messages.find(item =>
      item.Subject === 'Your crew portal sign-in code' && item.To.some(to => to.Address === user.email));
    if (message) {
      const body = await (await call(MAILPIT_URL, '/api/v1/message/' + message.ID, 200)).json();
      code = /<strong>(\d{6,10})<\/strong>/.exec(body.HTML ?? '')?.[1];
    }
    if (!code) await delay(200);
  }
  assert.ok(code, 'The sign-in code arrived at the disposable mail inbox');
  const session = await post(portal, '/auth/verify', 200, { email: user.email, code });
  return (await session.json()).access_token;
}

async function pdf(text) {
  const doc = await PDFDocument.create();
  const page = doc.addPage();
  page.drawText(text, { x: 48, y: 720, size: 18, font: await doc.embedFont(StandardFonts.Helvetica) });
  return Buffer.from(await doc.save());
}

const digest = bytes => createHash('sha256').update(bytes).digest('hex');

try {
  const lead = await recruit('lead');
  const crew = await recruit('crew');
  const outside = await recruit('outside');
  await post(SUPABASE_URL, '/rest/v1/rpc/crew_test_setup', 204,
    { show_slug: prefix, lead: lead.id, crew: crew.id, outside_user: outside.id }, { headers: admin });
  const leadToken = await signIn(lead);
  const crewToken = await signIn(crew);
  const outsideToken = await signIn(outside);

  const createDraft = async () => (await (await post(portal, show + '/drafts', 201, {}, { token: leadToken })).json()).revisionId;
  const upload = (revision, bytes, status = 201, name = 'AfterJinx sample.pdf', kind = 'packet') =>
    call(portal, show + '/drafts/' + revision + '/files?' + new URLSearchParams({ name, kind }), status,
      { method: 'PUT', token: leadToken, bytes });
  const publish = (revision, status, note) =>
    post(portal, show + '/drafts/' + revision + '/publish', status, { note }, { token: leadToken });

  const original = await pdf('AfterJinx pilot sample - revision 1');
  const originalDraft = await createDraft();
  const file = await (await upload(originalDraft, original)).json();
  const supportingPdf = await pdf('AfterJinx sample supporting sheet');
  const support = await (await upload(originalDraft, supportingPdf, 201, 'Details.pdf', 'support')).json();
  const repeated = await (await upload(originalDraft, original)).json();
  assert.equal(file.fileId, repeated.fileId);
  await upload(originalDraft, await pdf('different bytes at the same name'), 409);
  await call(portal, show + '/files/' + file.fileId, 404, { token: crewToken });
  await publish(originalDraft, 200, 'First sample');
  const packet = await (await call(portal, show + '/current', 200, { token: crewToken })).json();
  const originalPath = show + '/files/' + packet.files[0].id;
  const download = await call(portal, originalPath, 200, { token: crewToken });
  assert.match(download.headers.get('cache-control'), /no-store/);
  assert.equal(download.headers.get('content-type'), 'application/pdf');
  const downloaded = Buffer.from(await download.arrayBuffer());
  assert.equal(digest(downloaded), digest(original));
  assert.equal(packet.files.length, 2);
  const downloadedSupport = await call(portal, show + '/files/' + support.fileId, 200, { token: crewToken });
  assert.equal(digest(Buffer.from(await downloadedSupport.arrayBuffer())), digest(supportingPdf));
  console.log('Real PDF matched after lead upload, publish, and crew download:', original.length, 'bytes');

  await call(portal, originalPath, 401);
  await call(portal, originalPath, 403, { token: outsideToken });
  await post(portal, show + '/drafts', 403, {}, { token: crewToken });
  await post(SUPABASE_URL, '/rest/v1/rpc/crew_packet_action', 403,
    { action: 'draft', show_slug: prefix, account_id: lead.id, args: {} },
    { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + crewToken } });
  const objectKey = originalDraft + '/' + file.fileId + '.pdf';
  for (const [route, headers] of [
    ['/storage/v1/object/public/crew-packets/', {}],
    ['/storage/v1/object/authenticated/crew-packets/', {
      apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + crewToken
    }]
  ]) {
    const direct = await fetch(SUPABASE_URL + route + objectKey, { headers });
    assert.ok([400, 401, 403, 404].includes(direct.status), 'Storage URL must deny direct reads');
  }

  const revised = await pdf('AfterJinx pilot sample - revision 2');
  const newDraft = await createDraft();
  const stale = await createDraft();
  await upload(newDraft, Buffer.from('%PDF-1.7 bogus'), 415);
  await publish(newDraft, 409, 'Incomplete');
  const stillCurrent = await (await call(portal, show + '/current', 200, { token: crewToken })).json();
  assert.equal(stillCurrent.revisionId, originalDraft);
  await upload(newDraft, revised);
  await upload(stale, original);
  const [publishOne, publishTwo] = await Promise.all([newDraft, stale].map(revision =>
    fetch(portal + show + '/drafts/' + revision + '/publish', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + leadToken },
      body: JSON.stringify({ note: 'Concurrent revision' })
    })));
  assert.deepEqual([publishOne.status, publishTwo.status].sort(), [200, 409]);
  const updated = await (await call(portal, show + '/current', 200, { token: crewToken })).json();
  assert.equal(updated.revisionId, publishOne.ok ? newDraft : stale);
  const currentDownload = await call(portal, show + '/files/' + updated.files[0].id, 200, { token: crewToken });
  assert.equal(digest(Buffer.from(await currentDownload.arrayBuffer())), digest(publishOne.ok ? revised : original));
  await call(portal, originalPath, 404, { token: crewToken });
  await post(portal, show + '/drafts/' + originalDraft + '/restore', 200,
    { expectedEvent: updated.eventId, note: 'Restore the first sample' }, { token: leadToken });
  const history = await (await call(portal, show + '/history', 200, { token: leadToken })).json();
  assert.deepEqual(history.map(item => item.kind), ['publish', 'publish', 'restore']);
  await call(portal, originalPath, 200, { token: crewToken });

  await post(SUPABASE_URL, '/rest/v1/rpc/crew_test_revoke', 204,
    { show_slug: prefix, crew: crew.id }, { headers: admin });
  await call(portal, originalPath, 403, { token: crewToken });
  console.log('Passed direct URL denial, cross-show denial, corrupt upload, concurrent publish, restore, and live-token revocation.');
} finally {
  await new Promise(resolve => api.close(resolve));
}
