-- LinguaFlow V0.2
-- Có thể chạy kể cả khi bạn đã chạy schema V0.1.

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

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "preferences_all_own" on public.user_language_preferences;
drop policy if exists "vocabulary_all_own" on public.user_vocabulary;

create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "preferences_all_own"
on public.user_language_preferences for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "vocabulary_all_own"
on public.user_vocabulary for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Bổ sung profile cho tài khoản đã tồn tại trước khi trigger được tạo.
insert into public.profiles (id, display_name)
select id, coalesce(raw_user_meta_data ->> 'display_name', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;
