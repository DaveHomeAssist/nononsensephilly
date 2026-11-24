import assert from 'node:assert/strict';
import test from 'node:test';
import { createPacketStore, MAX_PDF_BYTES } from './packet-store.mjs';

const show = 'pilot';
const lead = 'lead-account';
const crew = 'crew-account';
const pdf = { bytes: 4096, mediaType: 'application/pdf' };
const error = code => ({ name: 'PacketError', code });

function fixture(t) {
  const store = createPacketStore();
  t.after(() => store.close());
  store.createShow(show);
  store.assign(show, lead, 'lead');
  store.assign(show, crew, 'crew');
  return store;
}

function addFile(store, draft, name, kind = 'packet') {
  const file = store.reserveFile(show, lead, draft, { name, kind });
  store.recordVerifiedUpload(show, lead, draft, file.id, pdf);
  return file;
}

test('an interrupted upload is reusable and the prior packet remains current until every file is verified', t => {
  const store = fixture(t);
  assert.equal(store.currentPacket(show, crew), null);
  const first = store.createDraft(show, lead);
  const initial = addFile(store, first, 'Packet A.pdf');
  store.publish(show, lead, first, 'Initial packet');

  const second = store.createDraft(show, lead);
  const replacement = addFile(store, second, 'Packet B.pdf');
  const layout = { name: 'Layout.pdf', kind: 'support' };
  const reserved = store.reserveFile(show, lead, second, layout);
  assert.deepEqual(store.reserveFile(show, lead, second, layout), reserved);
  assert.throws(() => store.publish(show, lead, second, 'New load-in'), error('draft_incomplete'));
  assert.equal(store.currentPacket(show, crew).revisionId, first);
  assert.equal(store.currentFileKey(show, crew, initial.id), initial.objectKey);
  assert.throws(() => store.currentFileKey(show, crew, reserved.id), error('file_unavailable'));

  store.recordVerifiedUpload(show, lead, second, reserved.id, pdf);
  const published = store.publish(show, lead, second, 'New load-in');
  const current = store.currentPacket(show, crew);
  assert.equal(current.eventId, published);
  assert.equal(current.note, 'New load-in');
  assert.deepEqual(current.files.map(file => file.id), [replacement.id, reserved.id]);
  assert.ok(current.files.every(file => !Object.hasOwn(file, 'objectKey')));
  assert.throws(() => store.currentFileKey(show, crew, initial.id), error('file_unavailable'));
  assert.throws(() => store.reserveFile(show, lead, second, layout), error('revision_unavailable'));
});

test('validates upload metadata and requires exactly one verified main packet', t => {
  const store = fixture(t);
  const draft = store.createDraft(show, lead);
  addFile(store, draft, 'Stage.pdf', 'support');
  assert.throws(() => store.publish(show, lead, draft), error('draft_incomplete'));
  for (const name of ['Packet.txt', 'x/a.pdf', 'x\\a.pdf']) {
    assert.throws(() => store.reserveFile(show, lead, draft, { name, kind: 'packet' }), error('invalid_file'));
  }
  const { id } = store.reserveFile(show, lead, draft, { name: 'Packet.pdf', kind: 'packet' });
  assert.throws(() => store.reserveFile(show, lead, draft, { name: 'Other.pdf', kind: 'packet' }),
    error('file_conflict'));
  for (const metadata of [
    { ...pdf, bytes: 0 },
    { ...pdf, bytes: MAX_PDF_BYTES + 1 },
    { ...pdf, mediaType: 'text/plain' }
  ]) {
    assert.throws(() => store.recordVerifiedUpload(show, lead, draft, id, metadata), error('invalid_file'));
  }
  assert.throws(() => store.recordVerifiedUpload(show, lead, draft, 'unknown', pdf), error('file_unavailable'));
  assert.throws(() => store.publish(show, lead, draft), error('draft_incomplete'));
  store.recordVerifiedUpload(show, lead, draft, id, pdf);
  assert.ok(store.publish(show, lead, draft));
});

test('rejects stale competing publishes and records a restore as a new publication', t => {
  const store = fixture(t);
  const first = store.createDraft(show, lead);
  const original = addFile(store, first, 'Original.pdf');
  const initial = store.publish(show, lead, first, 'First packet');
  const anotherLead = 'second-lead';
  store.assign(show, anotherLead, 'lead');
  const winner = store.createDraft(show, lead);
  const stale = store.createDraft(show, anotherLead);
  addFile(store, winner, 'Winner.pdf');
  addFile(store, stale, 'Stale.pdf');
  const updated = store.publish(show, lead, winner, 'Correction');
  assert.throws(() => store.publish(show, anotherLead, stale, 'Another correction'), error('revision_conflict'));
  assert.throws(() => store.restore(show, lead, first, initial), error('revision_conflict'));

  const restored = store.restore(show, lead, first, updated, 'Restore original');
  assert.equal(store.currentPacket(show, crew).eventId, restored);
  assert.equal(store.currentFileKey(show, crew, original.id), original.objectKey);
  assert.deepEqual(store.publicationHistory(show, lead).map(event => [event.id, event.kind]),
    [[initial, 'publish'], [updated, 'publish'], [restored, 'restore']]);
});

test('checks the current show assignment before reading files or changing a packet', t => {
  const store = fixture(t);
  store.createShow('other-show');
  store.assign('other-show', 'other-crew', 'crew');
  store.assign('other-show', lead, 'lead');
  const draft = store.createDraft(show, lead);
  const { id, objectKey } = addFile(store, draft, 'Private.pdf');
  store.publish(show, lead, draft);
  assert.equal(store.currentFileKey(show, crew, id), objectKey);
  assert.throws(() => store.currentFileKey('other-show', lead, id), error('file_unavailable'));
  assert.throws(() => store.createDraft(show, crew), error('forbidden'));
  assert.throws(() => store.publicationHistory(show, crew), error('forbidden'));
  assert.throws(() => store.restore('other-show', lead, draft, null), error('revision_unavailable'));

  store.revoke(show, crew);
  for (const account of [null, 'unassigned', 'other-crew', crew]) {
    assert.throws(() => store.currentPacket(show, account), error('forbidden'));
    assert.throws(() => store.currentFileKey(show, account, id), error('forbidden'));
  }
});
