create table if not exists public.analytics_snapshots (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists analytics_snapshots_updated_at_idx
  on public.analytics_snapshots (updated_at desc);
