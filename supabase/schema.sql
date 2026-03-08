create extension if not exists pgcrypto;

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  filename text not null,
  original_name text not null,
  mime_type text not null,
  size bigint not null check (size >= 0),
  width integer,
  height integer,
  resolution text,
  captured_at timestamptz,
  uploaded_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  storage_path text not null unique,
  tags text[] not null default '{}'::text[]
);

create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  cover_photo_id uuid references public.photos(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.album_photos (
  album_id uuid not null references public.albums(id) on delete cascade,
  photo_id uuid not null references public.photos(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (album_id, photo_id)
);

create index if not exists photos_user_uploaded_idx 
on public.photos (user_id, uploaded_at desc);

create index if not exists photos_user_captured_idx 
on public.photos (user_id, captured_at desc);

create index if not exists photos_tags_gin_idx 
on public.photos using gin (tags);

create index if not exists albums_user_created_idx 
on public.albums (user_id, created_at desc);

create index if not exists album_photos_user_created_idx 
on public.album_photos (user_id, created_at desc);

create index if not exists album_photos_photo_idx 
on public.album_photos (photo_id);

alter table public.photos enable row level security;
alter table public.albums enable row level security;
alter table public.album_photos enable row level security;

drop policy if exists "Users manage own photos" on public.photos;

create policy "Users manage own photos"
on public.photos
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own albums" on public.albums;

create policy "Users manage own albums"
on public.albums
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own album links" on public.album_photos;

create policy "Users manage own album links"
on public.album_photos
for all
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.albums a
    where a.id = album_id
      and a.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.photos p
    where p.id = photo_id
      and p.user_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "Users can read own photo objects" on storage.objects;

create policy "Users can read own photo objects"
on storage.objects
for select
using (
  bucket_id = 'photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can upload own photo objects" on storage.objects;

create policy "Users can upload own photo objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update own photo objects" on storage.objects;

create policy "Users can update own photo objects"
on storage.objects
for update
using (
  bucket_id = 'photos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own photo objects" on storage.objects;

create policy "Users can delete own photo objects"
on storage.objects
for delete
using (
  bucket_id = 'photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);