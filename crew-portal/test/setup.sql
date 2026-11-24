-- Install only in a disposable test database.
create function public.crew_test_setup(show_slug text, lead uuid, crew uuid, outside_user uuid)
returns void
language sql
set search_path = ''
as $$
  insert into crew_private.shows (slug) values (show_slug), (show_slug || '-other');
  insert into crew_private.members (show, account, role) values
    (show_slug, lead, 'lead'), (show_slug, crew, 'crew'), (show_slug || '-other', outside_user, 'crew');
$$;
revoke all on function public.crew_test_setup(text,uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.crew_test_setup(text,uuid,uuid,uuid) to service_role;

create function public.crew_test_revoke(show_slug text, crew uuid)
returns void
language sql
set search_path = ''
as $$
  delete from crew_private.members where show = show_slug and account = crew;
$$;
revoke all on function public.crew_test_revoke(text,uuid) from public, anon, authenticated;
grant execute on function public.crew_test_revoke(text,uuid) to service_role;

notify pgrst, 'reload schema';
