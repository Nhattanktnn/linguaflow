-- LinguaFlow 1.0 - ONE-TIME UPGRADE
-- Có thể chạy trên database đã dùng V0.2/V0.3/V0.4. Script cố gắng an toàn khi chạy lại.

create extension if not exists "pgcrypto";

-- Core profile tables (create if this is a fresh database)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  native_language text default 'vi',
  created_at timestamptz not null default now()
);

create table if not exists public.user_language_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  language_code text not null,
  proficiency_level text,
  goal text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(user_id, language_code)
);

-- Remove old zh/en-only constraint so language packs can expand.
alter table public.user_language_preferences drop constraint if exists user_language_preferences_language_code_check;

create table if not exists public.user_vocabulary (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  language_code text not null,
  term text not null,
  pronunciation text,
  meaning_vi text,
  source_type text default 'user',
  mastery smallint not null default 0 check (mastery between 0 and 100),
  next_review_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.user_vocabulary add column if not exists interval_days numeric not null default 0;
alter table public.user_vocabulary add column if not exists review_count integer not null default 0;
alter table public.user_vocabulary add column if not exists correct_count integer not null default 0;
alter table public.user_vocabulary add column if not exists last_reviewed_at timestamptz;
create unique index if not exists user_vocabulary_unique_term on public.user_vocabulary(user_id, language_code, term);
update public.user_vocabulary set next_review_at = coalesce(next_review_at, created_at, now()) where next_review_at is null;

-- Generic content table kept under the historical name media_items for backwards compatibility.
create table if not exists public.media_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  language_code text not null,
  title text not null,
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint not null default 0,
  media_type text not null,
  status text not null default 'uploaded',
  duration_seconds numeric,
  created_at timestamptz not null default now()
);
alter table public.media_items drop constraint if exists media_items_language_code_check;
alter table public.media_items drop constraint if exists media_items_media_type_check;
alter table public.media_items add constraint media_items_media_type_check check (media_type in ('audio','video','pdf','text'));
alter table public.media_items add column if not exists source_text text;
alter table public.media_items add column if not exists ai_provider text;
alter table public.media_items add column if not exists ai_model text;
alter table public.media_items add column if not exists transcribed_at timestamptz;

create table if not exists public.transcript_segments (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media_items(id) on delete cascade,
  segment_index integer not null,
  start_seconds numeric not null default 0,
  end_seconds numeric not null default 0,
  text text not null,
  pronunciation text,
  translation_vi text,
  tokens jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(media_id, segment_index)
);
alter table public.transcript_segments add column if not exists tokens jsonb not null default '[]'::jsonb;

create table if not exists public.vocabulary_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vocabulary_id uuid not null references public.user_vocabulary(id) on delete cascade,
  grade text not null check (grade in ('again','hard','good','easy')),
  mastery_after smallint,
  reviewed_at timestamptz not null default now()
);

create table if not exists public.saved_sentences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  language_code text not null,
  text text not null,
  pronunciation text,
  meaning_vi text,
  source_media_id uuid references public.media_items(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists saved_sentences_unique_text on public.saved_sentences(user_id, language_code, text);

create table if not exists public.course_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  language_code text not null,
  course_key text not null,
  progress_percent smallint not null default 0 check (progress_percent between 0 and 100),
  last_opened_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id, language_code, course_key)
);

create table if not exists public.practice_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  language_code text not null,
  practice_type text not null,
  prompt text,
  answer text,
  score numeric,
  feedback text,
  created_at timestamptz not null default now()
);

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  source_key text unique not null,
  publisher text,
  source_url text,
  source_type text not null default 'CURATED',
  license_note text,
  version text,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.profiles enable row level security;
alter table public.user_language_preferences enable row level security;
alter table public.user_vocabulary enable row level security;
alter table public.media_items enable row level security;
alter table public.transcript_segments enable row level security;
alter table public.vocabulary_reviews enable row level security;
alter table public.saved_sentences enable row level security;
alter table public.course_progress enable row level security;
alter table public.practice_attempts enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "preferences_all_own" on public.user_language_preferences;
create policy "preferences_all_own" on public.user_language_preferences for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "vocabulary_all_own" on public.user_vocabulary;
create policy "vocabulary_all_own" on public.user_vocabulary for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "media_items_all_own" on public.media_items;
create policy "media_items_all_own" on public.media_items for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "transcript_segments_all_own" on public.transcript_segments;
create policy "transcript_segments_all_own" on public.transcript_segments for all to authenticated
using (exists (select 1 from public.media_items m where m.id = transcript_segments.media_id and m.user_id = auth.uid()))
with check (exists (select 1 from public.media_items m where m.id = transcript_segments.media_id and m.user_id = auth.uid()));

drop policy if exists "reviews_all_own" on public.vocabulary_reviews;
create policy "reviews_all_own" on public.vocabulary_reviews for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "sentences_all_own" on public.saved_sentences;
create policy "sentences_all_own" on public.saved_sentences for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "course_progress_all_own" on public.course_progress;
create policy "course_progress_all_own" on public.course_progress for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "practice_attempts_all_own" on public.practice_attempts;
create policy "practice_attempts_all_own" on public.practice_attempts for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Profiles trigger
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
insert into public.profiles (id, display_name)
select id, coalesce(raw_user_meta_data ->> 'display_name', split_part(email, '@', 1)) from auth.users
on conflict (id) do nothing;

-- Storage: 50MB private content bucket
insert into storage.buckets (id, name, public, file_size_limit)
values ('media','media',false,52428800)
on conflict (id) do update set public=false,file_size_limit=52428800;

drop policy if exists "media_objects_select_own" on storage.objects;
drop policy if exists "media_objects_insert_own" on storage.objects;
drop policy if exists "media_objects_delete_own" on storage.objects;
create policy "media_objects_select_own" on storage.objects for select to authenticated using (bucket_id='media' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "media_objects_insert_own" on storage.objects for insert to authenticated with check (bucket_id='media' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "media_objects_delete_own" on storage.objects for delete to authenticated using (bucket_id='media' and (storage.foldername(name))[1]=auth.uid()::text);
