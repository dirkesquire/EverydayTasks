create table if not exists public.task (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  due_date timestamptz,
  preparation_needed jsonb,
  reminders jsonb not null default '[]',
  rewards jsonb not null default '[]',
  consequences jsonb not null default '[]',
  notes text not null default '',
  scope_id uuid references public.scope(id) on delete set null,
  utc_done timestamptz,
  utc_created timestamptz not null default now(),
  utc_deleted timestamptz,
  reward_score int not null default 0,
  consequence_score int not null default 0,
  urgency_score int not null default 0,
  total_score int not null default 0,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade
);

alter table public.task enable row level security;

create policy "Users can manage their own tasks"
on public.task
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update, delete on public.task to authenticated;

create table if not exists public.loop (
  id uuid primary key default gen_random_uuid(),
  short_name text not null default '',
  notes text not null default '',
  scope_id uuid references public.scope(id) on delete set null,
  sequence int not null default 0,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade
);

alter table public.loop enable row level security;

create policy "Users can manage their own loops"
on public.loop
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update, delete on public.loop to authenticated;

create table if not exists public.loop_execution (
  id uuid primary key default gen_random_uuid(),
  loop_id uuid not null references public.loop(id) on delete cascade,
  utc_date timestamptz not null default now(),
  utc_start_time timestamptz,
  utc_duration_seconds numeric not null default 0,
  notes text not null default '',
  notes_for_next_loop text not null default '',
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade
);

alter table public.loop_execution enable row level security;

create policy "Users can manage their own loop executions"
on public.loop_execution
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update, delete on public.loop_execution to authenticated;
