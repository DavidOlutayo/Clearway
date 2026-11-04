-- Clearway slice 1 schema: cases, documents, append-only events.
-- Run in Supabase SQL editor. Storage: create a private bucket named
-- "case-files" and upload originals under "<case_id>/<document_id>".

create table if not exists cases (
  id uuid primary key,
  note text,
  status text not null default 'intake',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key,
  case_id uuid not null references cases (id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null,
  sha256 text not null,
  extraction jsonb,
  created_at timestamptz not null default now(),
  unique (case_id, sha256)
);

-- Append-only: inserts only. No update/delete grants for the anon role.
create table if not exists events (
  id uuid primary key,
  case_id uuid not null references cases (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists events_case_created_idx on events (case_id, created_at);

-- Live demo rate limiting: one row per full run (each /process call).
-- Visitor identity is a browser cookie id plus the client IP from the
-- x-forwarded-for header. No login; ids are random and unguessable.
create table if not exists demo_runs (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  ip text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists demo_runs_visitor_created_idx on demo_runs (visitor_id, created_at);
create index if not exists demo_runs_ip_created_idx on demo_runs (ip, created_at);
create index if not exists demo_runs_created_idx on demo_runs (created_at);
