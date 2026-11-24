import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export const MAX_PDF_BYTES = 50 * 1024 * 1024;

export class PacketError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PacketError';
    this.code = code;
  }
}

const schema = `
  CREATE TABLE shows (
    slug TEXT PRIMARY KEY,
    current_event INTEGER REFERENCES publication_events(id)
  );
  CREATE TABLE memberships (
    show_slug TEXT NOT NULL REFERENCES shows(slug),
    account TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('crew', 'lead')),
    PRIMARY KEY (show_slug, account)
  );
  CREATE TABLE revisions (
    id TEXT PRIMARY KEY,
    show_slug TEXT NOT NULL REFERENCES shows(slug),
    created_by TEXT NOT NULL,
    base_event INTEGER REFERENCES publication_events(id),
    published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1))
  );
  CREATE TABLE files (
    id TEXT PRIMARY KEY,
    revision_id TEXT NOT NULL REFERENCES revisions(id),
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('packet', 'support')),
    verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1)),
    UNIQUE (revision_id, name)
  );
  CREATE UNIQUE INDEX one_packet_per_revision ON files(revision_id) WHERE kind = 'packet';
  CREATE TABLE publication_events (
    id INTEGER PRIMARY KEY,
    show_slug TEXT NOT NULL REFERENCES shows(slug),
    revision_id TEXT NOT NULL REFERENCES revisions(id),
    publisher TEXT NOT NULL,
    note TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('publish', 'restore')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
`;

function fail(code, message) {
  throw new PacketError(code, message);
}

function storageKey(revisionId, fileId) {
  return `${revisionId}/${fileId}.pdf`;
}

export function createPacketStore() {
  const db = new DatabaseSync(':memory:', { enableForeignKeyConstraints: true });
  db.exec(schema);

  const get = (sql, ...values) => db.prepare(sql).get(...values);
  const run = (sql, ...values) => db.prepare(sql).run(...values);
  const all = (sql, ...values) => db.prepare(sql).all(...values);

  function transaction(work) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function authorize(show, account, requiredRole) {
    const membership = typeof account === 'string' &&
      get('SELECT role FROM memberships WHERE show_slug = ? AND account = ?', show, account);
    if (!membership || (requiredRole && membership.role !== requiredRole)) {
      fail('forbidden', 'This account cannot perform that action for this show.');
    }
  }

  function revisionFor(show, id, published) {
    const revision = get('SELECT * FROM revisions WHERE show_slug = ? AND id = ?', show, id);
    if (!revision || revision.published !== published) {
      fail('revision_unavailable', 'That revision is unavailable for this action.');
    }
    return revision;
  }

  function currentEvent(show) {
    return get('SELECT current_event FROM shows WHERE slug = ?', show).current_event;
  }

  function changeCurrent(show, account, id, expected, note, kind) {
    if (currentEvent(show) !== expected) {
      fail('revision_conflict', 'The current packet changed. Review it before publishing.');
    }
    const event = run(
      'INSERT INTO publication_events (show_slug, revision_id, publisher, note, kind) VALUES (?, ?, ?, ?, ?)',
      show, id, account, String(note ?? '').trim(), kind
    ).lastInsertRowid;
    run('UPDATE shows SET current_event = ? WHERE slug = ?', event, show);
    return event;
  }

  return {
    close() { db.close(); },

    createShow(show) {
      run('INSERT INTO shows (slug) VALUES (?)', show);
    },

    assign(show, account, role) {
      run(`INSERT INTO memberships VALUES (?, ?, ?)
           ON CONFLICT (show_slug, account) DO UPDATE SET role = excluded.role`, show, account, role);
    },

    revoke(show, account) {
      run('DELETE FROM memberships WHERE show_slug = ? AND account = ?', show, account);
    },

    createDraft(show, account) {
      return transaction(() => {
        authorize(show, account, 'lead');
        const id = randomUUID();
        run('INSERT INTO revisions (id, show_slug, created_by, base_event) VALUES (?, ?, ?, ?)',
          id, show, account, currentEvent(show));
        return id;
      });
    },

    reserveFile(show, account, revision, { name, kind }) {
      return transaction(() => {
        authorize(show, account, 'lead');
        revisionFor(show, revision, 0);
        if (typeof name !== 'string' || !name.trim() || name.length > 200 ||
            /[\\/\\\\\x00-\x1f]/.test(name) || !name.toLowerCase().endsWith('.pdf') ||
            !['packet', 'support'].includes(kind)) {
          fail('invalid_file', 'Choose a PDF with a valid filename and document type.');
        }
        const existing = get('SELECT id, kind, verified FROM files WHERE revision_id = ? AND name = ?',
          revision, name);
        if (existing) {
          if (existing.kind !== kind || existing.verified) {
            fail('file_conflict', 'That filename is already in use.');
          }
          return { id: existing.id, objectKey: storageKey(revision, existing.id) };
        }
        if (kind === 'packet' && get("SELECT id FROM files WHERE revision_id = ? AND kind = 'packet'", revision)) {
          fail('file_conflict', 'A revision can have one main packet.');
        }
        const id = randomUUID();
        run('INSERT INTO files (id, revision_id, name, kind) VALUES (?, ?, ?, ?)', id, revision, name, kind);
        return { id, objectKey: storageKey(revision, id) };
      });
    },

    recordVerifiedUpload(show, account, revision, file, { bytes, mediaType }) {
      transaction(() => {
        authorize(show, account, 'lead');
        revisionFor(show, revision, 0);
        if (mediaType !== 'application/pdf' || !Number.isSafeInteger(bytes) || bytes < 1 || bytes > MAX_PDF_BYTES) {
          fail('invalid_file', 'The stored artifact must be a PDF within the size limit.');
        }
        const result = run('UPDATE files SET verified = 1 WHERE id = ? AND revision_id = ?', file, revision);
        if (!result.changes) fail('file_unavailable', 'That file has no upload reservation.');
      });
    },

    publish(show, account, id, note) {
      return transaction(() => {
        authorize(show, account, 'lead');
        const revision = revisionFor(show, id, 0);
        const files = all('SELECT kind, verified FROM files WHERE revision_id = ?', id);
        if (!files.some(file => file.kind === 'packet') || files.some(file => !file.verified)) {
          fail('draft_incomplete', 'Verify the main packet and every attachment before publishing.');
        }
        const event = changeCurrent(show, account, id, revision.base_event, note, 'publish');
        run('UPDATE revisions SET published = 1 WHERE id = ?', id);
        return event;
      });
    },

    restore(show, account, id, expectedEvent, note) {
      return transaction(() => {
        authorize(show, account, 'lead');
        revisionFor(show, id, 1);
        return changeCurrent(show, account, id, expectedEvent, note, 'restore');
      });
    },

    currentPacket(show, account) {
      authorize(show, account);
      const event = get('SELECT * FROM publication_events WHERE id = ?', currentEvent(show));
      if (!event) return null;
      const files = all("SELECT id, name, kind FROM files WHERE revision_id = ? ORDER BY kind, name", event.revision_id);
      return {
        eventId: event.id,
        revisionId: event.revision_id,
        publishedAt: event.created_at,
        note: event.note,
        files: files.map(({ id, name, kind }) => ({ id, name, kind }))
      };
    },

    currentFileKey(show, account, file) {
      authorize(show, account);
      const match = get(`SELECT files.id, files.revision_id FROM files
        JOIN publication_events ON publication_events.revision_id = files.revision_id
        WHERE publication_events.id = ? AND files.id = ?`, currentEvent(show), file);
      if (!match) fail('file_unavailable', 'That file is not part of the current packet.');
      return storageKey(match.revision_id, match.id);
    },

    publicationHistory(show, account) {
      authorize(show, account, 'lead');
      return all('SELECT * FROM publication_events WHERE show_slug = ? ORDER BY id', show);
    }
  };
}
