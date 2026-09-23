-- LinguaFlow V0.1 - schema nền tảng.
-- Chưa cần chạy ngay. Ở bước tiếp theo ChatGPT sẽ hướng dẫn chạy trong Supabase SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  native_language text default 'vi',
  created_at timestamptz not null default now()
);

create table if not exists public.user_language_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  language_code text not null check (language_code in ('zh', 'en')),
  proficiency_level text,
  goal text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(user_id, language_code)
);

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

alter table public.profiles enable row level security;
alter table public.user_language_preferences enable row level security;
alter table public.user_vocabulary enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "preferences_all_own" on public.user_language_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "vocabulary_all_own" on public.user_vocabulary for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
