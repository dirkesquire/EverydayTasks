-- Seeds a default 'Personal' scope the moment a user's email is confirmed, so new
-- accounts land with something in scopes.html. Runs as the function owner (bypasses
-- RLS), since auth.uid() isn't set outside of a request context.
create or replace function public.seed_personal_scope_on_confirm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  just_confirmed boolean;
begin
  -- OLD is unassigned on INSERT, so it can only be referenced inside the UPDATE branch.
  if tg_op = 'INSERT' then
    just_confirmed := new.email_confirmed_at is not null;
  else
    just_confirmed := old.email_confirmed_at is null and new.email_confirmed_at is not null;
  end if;

  if just_confirmed then
    insert into public.scope (name, is_active, sequence, user_id)
    select 'Personal', true, 0, new.id
    where not exists (
      select 1 from public.scope where user_id = new.id and name = 'Personal'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_confirmed on auth.users;

create trigger on_auth_user_email_confirmed
after insert or update of email_confirmed_at on auth.users
for each row
execute function public.seed_personal_scope_on_confirm();
