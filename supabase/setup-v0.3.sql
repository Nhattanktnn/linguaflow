-- LinguaFlow V0.3
-- Chạy sau setup-v0.2.sql. Script an toàn để chạy lại.

create table if not exists public.media_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  language_code text not null check (language_code in ('zh', 'en')),
  title text not null,
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint not null default 0,
  media_type text not null check (media_type in ('audio', 'video')),
  status text not null default 'uploaded',
  duration_seconds numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.transcript_segments (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media_items(id) on delete cascade,
  segment_index integer not null,
  start_seconds numeric not null default 0,
  end_seconds numeric not null default 0,
  text text not null,
  pronunciation text,
  translation_vi text,
  created_at timestamptz not null default now(),
  unique(media_id, segment_index)
);

create unique index if not exists user_vocabulary_unique_term
on public.user_vocabulary (user_id, language_code, term);

alter table public.media_items enable row level security;
alter table public.transcript_segments enable row level security;

drop policy if exists "media_items_all_own" on public.media_items;
create policy "media_items_all_own"
on public.media_items for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "transcript_segments_all_own" on public.transcript_segments;
create policy "transcript_segments_all_own"
on public.transcript_segments for all
to authenticated
using (
  exists (
    select 1 from public.media_items m
    where m.id = transcript_segments.media_id
      and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.media_items m
    where m.id = transcript_segments.media_id
      and m.user_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', false, 52428800)
on conflict (id) do update
set public = false,
    file_size_limit = 52428800;

drop policy if exists "media_objects_select_own" on storage.objects;
drop policy if exists "media_objects_insert_own" on storage.objects;
drop policy if exists "media_objects_delete_own" on storage.objects;

create policy "media_objects_select_own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "media_objects_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "media_objects_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
);
