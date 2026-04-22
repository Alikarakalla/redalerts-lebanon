create table if not exists public.alerts (
  id uuid primary key,
  created_at timestamptz not null default timezone('utc', now()),
  timestamp timestamptz not null,
  type text not null,
  severity text not null,
  alert_level text,
  location_name text not null,
  lat double precision not null,
  lng double precision not null,
  description text,
  verified boolean not null default false,
  source_channel text,
  source_label text,
  resolved_location boolean not null default false,
  location_source text,
  reliability_score double precision,
  source_fingerprint text
);

create index if not exists alerts_timestamp_idx on public.alerts (timestamp desc);
create index if not exists alerts_type_idx on public.alerts (type);
create index if not exists alerts_severity_idx on public.alerts (severity);
create index if not exists alerts_location_name_idx on public.alerts (location_name);
create index if not exists alerts_source_channel_idx on public.alerts (source_channel);
create index if not exists alerts_source_fingerprint_idx on public.alerts (source_fingerprint);
