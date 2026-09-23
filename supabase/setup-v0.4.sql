-- LinguaFlow V0.4
-- Chạy sau setup-v0.3.sql. Có thể chạy lại an toàn.

alter table public.transcript_segments
add column if not exists tokens jsonb not null default '[]'::jsonb;

alter table public.media_items
add column if not exists ai_provider text;

alter table public.media_items
add column if not exists transcribed_at timestamptz;
