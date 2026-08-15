create table if not exists public.scope (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  sequence int not null default 0,
  utc_deleted timestamptz,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade
);

alter table public.scope enable row level security;

create policy "Users can manage their own scopes"
on public.scope
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.scope to authenticated;
