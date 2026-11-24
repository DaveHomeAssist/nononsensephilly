create schema crew_private;
revoke all on schema crew_private from public, anon, authenticated;

create table crew_private.shows (
  slug text primary key,
  current_publication bigint
);
create table crew_private.members (
  show text not null references crew_private.shows,
  account uuid not null references auth.users on delete cascade,
  role text not null check (role in ('lead', 'crew')),
  primary key (show, account)
);
create table crew_private.revisions (
  id uuid primary key default gen_random_uuid(),
  show text not null references crew_private.shows,
  base_publication bigint,
  published boolean not null default false
);
create table crew_private.files (
  id uuid primary key default gen_random_uuid(),
  revision uuid not null references crew_private.revisions,
  name text not null,
  kind text not null check (kind in ('packet', 'support')),
  ready boolean not null default false,
  unique (revision, name)
);
create unique index crew_single_packet on crew_private.files(revision) where kind = 'packet';

create table crew_private.publications (
  id bigint generated always as identity primary key,
  show text not null references crew_private.shows,
  revision uuid not null references crew_private.revisions,
  actor uuid not null,
  note text not null,
  kind text not null check (kind in ('publish', 'restore')),
  published_at timestamptz not null default now()
);
alter table crew_private.shows add foreign key (current_publication) references crew_private.publications;
alter table crew_private.revisions add foreign key (base_publication) references crew_private.publications;

alter table crew_private.shows enable row level security;
alter table crew_private.members enable row level security;
alter table crew_private.revisions enable row level security;
alter table crew_private.files enable row level security;
alter table crew_private.publications enable row level security;
grant usage on schema crew_private to service_role;
grant select, insert, update, delete on all tables in schema crew_private to service_role;
grant usage on all sequences in schema crew_private to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('crew-packets', 'crew-packets', false, 52428800, array['application/pdf']);

-- The application verifies the user's Auth session before passing the account ID.
-- Only the server can call this function or read Storage objects in this bucket.
create function public.crew_packet_action(action text, show_slug text, account_id uuid, args jsonb default '{}')
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  member_role text;
  current_id bigint;
  revision_id uuid;
  file_id uuid;
  publication_id bigint;
  revision_row crew_private.revisions%rowtype;
  file_row crew_private.files%rowtype;
  filename text := args->>'name';
  file_kind text := args->>'kind';
  object_key text;
begin
  select role into member_role from crew_private.members where show = show_slug and account = account_id;
  if member_role is null or (action not in ('current','download') and member_role <> 'lead') then
    raise sqlstate 'PT403' using message = 'Show access denied';
  end if;

  if action in ('current','download','history') then
    select current_publication into current_id from crew_private.shows where slug = show_slug;
  else
    select current_publication into current_id from crew_private.shows where slug = show_slug for update;
  end if;

  case action
    when 'current' then
      return (
        select jsonb_build_object('eventId', p.id, 'revisionId', p.revision, 'publishedAt', p.published_at,
          'note', p.note, 'files', coalesce((
            select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'kind', f.kind) order by f.kind, f.name)
            from crew_private.files f where f.revision = p.revision and f.ready
          ), '[]'::jsonb))
        from crew_private.publications p where p.id = current_id
      );
    when 'download' then
      select f.* into file_row from crew_private.files f
      join crew_private.publications p on p.revision = f.revision
      where p.id = current_id and f.id = (args->>'file')::uuid and f.ready;
      if not found then raise sqlstate 'PT404' using message = 'Current file not found'; end if;
      return jsonb_build_object('key', file_row.revision || '/' || file_row.id || '.pdf', 'name', file_row.name);
    when 'history' then
      return (select coalesce(jsonb_agg(to_jsonb(p) order by p.id), '[]'::jsonb)
        from crew_private.publications p where p.show = show_slug);
    when 'draft' then
      insert into crew_private.revisions (show, base_publication) values (show_slug, current_id)
      returning id into revision_id;
      return jsonb_build_object('revisionId', revision_id);
    else
      null;
  end case;

  revision_id := (args->>'revision')::uuid;
  select * into revision_row from crew_private.revisions where id = revision_id and show = show_slug;
  if not found or revision_row.published <> (action = 'restore') then
    raise sqlstate 'PT404' using message = 'Revision unavailable';
  end if;

  case action
    when 'reserve' then
      if filename is null or char_length(filename) > 200
        or filename ~ '[[:cntrl:]/\\]' or filename !~* '^.+\.pdf$'
        or file_kind is null or file_kind not in ('packet','support') then
        raise sqlstate 'PT400' using message = 'Invalid PDF filename or document type';
      end if;
      select * into file_row from crew_private.files where revision = revision_id and name = filename;
      if found then
        if file_row.kind <> file_kind then
          raise sqlstate 'PT409' using message = 'Filename is already in use';
        end if;
        file_id := file_row.id;
      else
        if file_kind = 'packet' and exists (
          select 1 from crew_private.files where revision = revision_id and kind = 'packet'
        ) then raise sqlstate 'PT409' using message = 'The revision already has a main packet'; end if;
        insert into crew_private.files (revision, name, kind) values (revision_id, filename, file_kind)
        returning id into file_id;
      end if;
      return jsonb_build_object('fileId', file_id, 'key', revision_id || '/' || file_id || '.pdf');
    when 'ready' then
      file_id := (args->>'file')::uuid;
      object_key := revision_id || '/' || file_id || '.pdf';
      update crew_private.files set ready = true where revision = revision_id and id = file_id
        and exists (select 1 from storage.objects o where o.bucket_id = 'crew-packets' and o.name = object_key);
      if not found then raise sqlstate 'PT409' using message = 'Uploaded PDF is unavailable'; end if;
      return jsonb_build_object('fileId', file_id);
    when 'publish' then
      if current_id is distinct from revision_row.base_publication then
        raise sqlstate 'PT409' using message = 'The current packet changed. Review it before publishing.';
      end if;
      if not exists (select 1 from crew_private.files where revision = revision_id and kind = 'packet')
        or exists (select 1 from crew_private.files where revision = revision_id and not ready) then
        raise sqlstate 'PT409' using message = 'Upload the main packet and every attachment first';
      end if;
      update crew_private.revisions set published = true where id = revision_id;
    when 'restore' then
      if current_id is distinct from (args->>'expectedEvent')::bigint then
        raise sqlstate 'PT409' using message = 'The current packet changed. Review it before restoring.';
      end if;
    else raise sqlstate 'PT400' using message = 'Unknown action';
  end case;

  insert into crew_private.publications (show, revision, actor, note, kind)
  values (show_slug, revision_id, account_id, left(coalesce(args->>'note',''), 1000), action)
  returning id into publication_id;
  update crew_private.shows set current_publication = publication_id where slug = show_slug;
  return jsonb_build_object('eventId', publication_id);
end;
$$;

revoke all on function public.crew_packet_action(text,text,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.crew_packet_action(text,text,uuid,jsonb) to service_role;
