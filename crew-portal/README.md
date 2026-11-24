# Crew Portal Packet Lifecycle

The AfterJinx pilot uses Supabase Auth, transactional Postgres, and private PDF storage. The in-memory SQLite implementation remains a fast reference for packet lifecycle tests.

## Pilot flow

An admin provisions the show and assigns crew or lead roles. A lead opens a draft and adds records for verified files. Publishing atomically replaces the current packet once its files are ready. Crew request the current revision through one stable show slug. A lead can restore a previously published revision and leave a new record of the change.

The portal uses one public event slug to identify a show. Flyer Kit Studio remains a browser-local workspace for draft prompts and creative direction. For a later handoff, use that slug to look up explicitly approved public event fields. Access assignments, draft files, packet paths, and private production information stay on the portal server. The pilot introduces no Studio data imports, shared browser storage, cross-origin calls, or changes to the public event data.

## Supabase API

The Node 24 server uses email codes for pre-provisioned Supabase users. Create the Auth user and assign the user's ID to a show in `crew_private.members` through an administrative connection. Use role `lead` or `crew`. Keep signup disabled before inviting the real crew. Configure production SMTP and the Magic Link template so it contains the code shown in [the sample template](supabase/templates/magic-link.html).

Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and server-only `SUPABASE_SECRET_KEY` in the server environment. Supply a secret or legacy service-role key for the last variable. Apply the [migration](supabase/migrations/20261124225119_crew_portal.sql) to the intended Supabase project through its normal migration workflow. Start with Node 24.

```sh
cd crew-portal
npm ci
npm start
```

The server listens on loopback, using port 8080 by default. Connect it to a private HTTPS ingress for hosted use. Serve the public site independently.

| Method and path | Purpose |
| --- | --- |
| `POST /auth/code` | Request a code with JSON `email`. |
| `POST /auth/verify` | Exchange JSON `email` and `code` for an access token. |
| `GET /shows/{slug}/current` | Read the current revision, note, timestamp, and file IDs. |
| `POST /shows/{slug}/drafts` | Start a draft and capture the current publication as the base. |
| `PUT /shows/{slug}/drafts/{revision}/files?kind=packet&name=Packet.pdf` | Upload raw PDF bytes with `Content-Type: application/pdf`. Use `kind=support` for attachments. |
| `POST /shows/{slug}/drafts/{revision}/publish` | Publish the verified draft. Accepts JSON `note`. |
| `POST /shows/{slug}/drafts/{revision}/restore` | Restore a published revision. Accepts JSON `expectedEvent` and `note`. |
| `GET /shows/{slug}/files/{file}` | Download a file from the current publication. |
| `GET /shows/{slug}/history` | Read publication history as a lead. |

Use `Authorization: Bearer` with the access token on show routes. The API verifies the token with Supabase Auth and looks up current show membership before authorizing the packet operation. The bucket has no browser object grants. Handle downloads through the API, which never publishes object keys or signed URLs. It sends private responses with `no-store`.

The API validates readable PDFs and caps each file at 50 MiB. An interrupted upload can be retried from the start with the same file name and bytes. Stored files are immutable and confirmed before publication. In-memory SQLite remains the reference test model. The Supabase server is the runtime path.

## Verify on a disposable Supabase stack

Add the following to the test stack's Supabase CLI configuration before starting it. Mailpit captures the codes locally.

```toml
[auth.email.template.magic_link]
subject = "Your crew portal sign-in code"
content_path = "./supabase/templates/magic-link.html"
```

Apply the migration, then apply [test fixtures](test/setup.sql) only to the disposable database. Set `MAILPIT_URL` to that stack's localhost inbox and use the same server environment variables as above. The smoke test creates synthetic identities and real PDF bytes.

```sh
npm test
node test/supabase-smoke.mjs
```

The smoke test checks real sign-in, upload, publication, byte-matched crew downloads, retry handling, corrupt PDF rejection, competing publishes, restore, direct Storage denial, and revoked membership with an existing token. The phone-friendly views and real crew walkthrough remain separate acceptance work.
