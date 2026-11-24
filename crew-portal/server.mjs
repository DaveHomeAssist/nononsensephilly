import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import { MAX_PDF_BYTES } from './packet-store.mjs';

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const bucket = 'crew-packets';

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function body(request, maxBytes) {
  if (Number(request.headers['content-length']) > maxBytes) {
    request.resume();
    throw new RequestError(413, 'Request exceeds the size limit');
  }
  const chunks = [];
  let bytes = 0;
  let exceeded = false;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxBytes) exceeded = true;
    if (!exceeded) chunks.push(chunk);
  }
  if (exceeded) throw new RequestError(413, 'Request exceeds the size limit');
  return Buffer.concat(chunks);
}

async function json(request) {
  const bytes = await body(request, 16384);
  try {
    const value = JSON.parse(bytes);
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  } catch {
    // The client receives the same response for malformed and non-object JSON.
  }
  throw new RequestError(400, 'Send a JSON object');
}

function jsonResponse(response, value, status = 200) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

async function verifyPdf(bytes) {
  if (bytes.subarray(0, 5).toString() !== '%PDF-') {
    throw new RequestError(415, 'Choose a valid PDF');
  }
  try {
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: true });
    if (!pdf.getPageCount()) throw new Error('Empty PDF');
  } catch {
    throw new RequestError(415, 'Choose a readable, unencrypted PDF');
  }
}

function bearer(key) {
  return key.split('.').length === 3 ? { Authorization: 'Bearer ' + key } : {};
}

export function createPortal({ supabaseUrl, publishableKey, secretKey }) {
  if (!supabaseUrl || !publishableKey || !secretKey) {
    throw new Error('Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SECRET_KEY');
  }
  const base = new URL(supabaseUrl);
  if (base.protocol !== 'https:' &&
      !(base.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname))) {
    throw new Error('Use HTTPS for remote Supabase');
  }

  async function provider(path, { key = publishableKey, token, headers, ...options } = {}) {
    try {
      return await fetch(new URL(path, base), {
        ...options,
        redirect: 'error',
        signal: AbortSignal.timeout(45000),
        headers: {
          apikey: key,
          ...bearer(key),
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
          ...headers
        }
      });
    } catch {
      throw new RequestError(502, 'Crew services are temporarily unavailable');
    }
  }

  const post = (path, data, options = {}) => provider(path, {
    ...options, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  });

  async function account(request) {
    const token = /^Bearer ([^\s]+)$/i.exec(request.headers.authorization ?? '')?.[1];
    if (!token) throw new RequestError(401, 'Sign in to continue');
    const response = await provider('/auth/v1/user', { token });
    if (!response.ok) throw new RequestError(response.status >= 500 ? 502 : 401, 'Session unavailable');
    const user = await response.json();
    if (!uuid.test(user.id ?? '')) throw new RequestError(401, 'Session unavailable');
    return user.id;
  }

  async function rpc(action, show, actor, args) {
    const response = await post('/rest/v1/rpc/crew_packet_action',
      { action, show_slug: show, account_id: actor, args }, { key: secretKey });
    if (!response.ok) {
      const failure = await response.json().catch(() => ({}));
      const status = /^PT(400|403|404|409)$/.exec(failure.code ?? '')?.[1];
      if (status) throw new RequestError(Number(status), failure.message);
      throw new RequestError(502, 'Packet service is temporarily unavailable');
    }
    return response.json();
  }

  const storagePath = (key, authenticated = false) =>
    '/storage/v1/object/' + (authenticated ? 'authenticated/' : '') + bucket + '/' + key;

  async function signIn(path, request, response) {
    const input = await json(request);
    if (typeof input.email !== 'string' || input.email.length > 254 || !email.test(input.email.trim())) {
      throw new RequestError(400, 'Enter a valid email address');
    }
    const address = input.email.trim().toLowerCase();
    if (path === '/auth/code') {
      const sent = await post('/auth/v1/otp', { email: address, create_user: false });
      if (sent.status === 429) throw new RequestError(429, 'Wait before requesting another code');
      if (sent.status >= 500) throw new RequestError(502, 'Sign-in service is temporarily unavailable');
      return jsonResponse(response, { message: 'If your email is invited, a sign-in code is on its way.' }, 202);
    }
    if (typeof input.code !== 'string' || !/^\d{6,10}$/.test(input.code)) {
      throw new RequestError(400, 'Enter the code from your email');
    }
    const checked = await post('/auth/v1/verify', { type: 'email', email: address, token: input.code });
    if (!checked.ok) throw new RequestError(checked.status >= 500 ? 502 : 401, 'Code rejected or expired');
    const { access_token, expires_in } = await checked.json();
    return jsonResponse(response, { access_token, expires_in });
  }

  async function upload(request, response, show, actor, revision, query) {
    if (request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/pdf') {
      throw new RequestError(415, 'Upload a PDF');
    }
    const file = await rpc('reserve', show, actor, { revision, name: query.get('name'), kind: query.get('kind') });
    const bytes = await body(request, MAX_PDF_BYTES);
    await verifyPdf(bytes);
    const saved = await provider(storagePath(file.key), {
      key: secretKey,
      method: 'POST',
      body: bytes,
      headers: { 'Content-Type': 'application/pdf', 'x-upsert': 'false' }
    });
    if (!saved.ok) {
      await saved.body?.cancel();
      // Storage providers return different conflict statuses for immutable keys.
      // A byte-for-byte match is sufficient to complete an interrupted retry.
      const existing = await provider(storagePath(file.key, true), { key: secretKey });
      if (!existing.ok) throw new RequestError(502, 'PDF storage was unavailable. Retry the upload.');
      if (!bytes.equals(Buffer.from(await existing.arrayBuffer()))) {
        throw new RequestError(409, 'This filename already has a different PDF in this draft');
      }
    }
    return jsonResponse(response, await rpc('ready', show, actor, { revision, file: file.fileId }), 201);
  }

  return createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      const url = new URL(request.url, 'http://localhost');
      const path = url.pathname;
      const method = request.method;
      if (method === 'POST' && ['/auth/code', '/auth/verify'].includes(path)) {
        return await signIn(path, request, response);
      }

      const route = /^\/shows\/([a-z0-9]+(?:-[a-z0-9]+)*)\/(current|history|drafts|files\/([^/]+)|drafts\/([^/]+)\/(files|publish|restore))$/.exec(path);
      if (!route) throw new RequestError(404, 'Route unavailable');
      const [, show, action, file, revision, operation] = route;
      if ((file && !uuid.test(file)) || (revision && !uuid.test(revision))) {
        throw new RequestError(404, 'Route unavailable');
      }
      const actor = await account(request);
      if (method === 'GET' && ['current', 'history'].includes(action)) {
        return jsonResponse(response, await rpc(action, show, actor, {}));
      }
      if (method === 'GET' && file) {
        const document = await rpc('download', show, actor, { file });
        const result = await provider(storagePath(document.key, true), { key: secretKey });
        if (!result.ok) throw new RequestError(502, 'Packet file is temporarily unavailable');
        const bytes = Buffer.from(await result.arrayBuffer());
        const name = encodeURIComponent(document.name).replace(/['()*]/g, char =>
          '%' + char.charCodeAt(0).toString(16));
        response.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': "attachment; filename*=UTF-8''" + name
        });
        return response.end(bytes);
      }
      if (method === 'POST' && action === 'drafts') {
        return jsonResponse(response, await rpc('draft', show, actor, {}), 201);
      }
      if (method === 'PUT' && operation === 'files') {
        return await upload(request, response, show, actor, revision, url.searchParams);
      }
      if (method === 'POST' && ['publish', 'restore'].includes(operation)) {
        const { note, expectedEvent } = await json(request);
        if (note !== undefined && (typeof note !== 'string' || note.length > 1000)) {
          throw new RequestError(400, 'Use a revision note of up to 1000 characters');
        }
        if (operation === 'restore' && (!Number.isSafeInteger(expectedEvent) || expectedEvent < 1)) {
          throw new RequestError(400, 'Supply the current publication ID');
        }
        return jsonResponse(response, await rpc(operation, show, actor, { revision, note, expectedEvent }));
      }
      throw new RequestError(405, 'Method unavailable');
    } catch (error) {
      request.resume();
      if (response.headersSent) {
        response.destroy();
      } else {
        jsonResponse(response, { error: error instanceof RequestError ? error.message : 'Request failed' },
          error instanceof RequestError ? error.status : 500);
      }
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, PORT = '8080' } = process.env;
  createPortal({ supabaseUrl: SUPABASE_URL, publishableKey: SUPABASE_PUBLISHABLE_KEY,
    secretKey: SUPABASE_SECRET_KEY }).listen(Number(PORT), '127.0.0.1', () => {
    console.log('Crew portal API is listening on localhost:' + PORT);
  });
}
