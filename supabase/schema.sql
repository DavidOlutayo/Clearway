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
