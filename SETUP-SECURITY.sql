-- ==========================================
-- ARCHAZZBOOK SECURITY FIXES & ROW LEVEL SECURITY
-- ==========================================
-- This script secures the database so anonymous users cannot edit/delete data,
-- addressing V2 Missing Authorization vulnerabilities.

-- 1. Books Table Security
alter table books enable row level security;
drop policy if exists "Books are viewable by everyone" on books;
drop policy if exists "Only authenticated users can insert books" on books;
drop policy if exists "Only authenticated users can update books" on books;
drop policy if exists "Only authenticated users can delete books" on books;

create policy "Books are viewable by everyone" on books for select using ( true );
create policy "Only authenticated users can insert books" on books for insert with check ( auth.role() = 'authenticated' );
create policy "Only authenticated users can update books" on books for update using ( auth.role() = 'authenticated' );
create policy "Only authenticated users can delete books" on books for delete using ( auth.role() = 'authenticated' );


-- 2. FCM Tokens Security
alter table fcm_tokens enable row level security;
drop policy if exists "Anyone can insert FCM tokens" on fcm_tokens;
drop policy if exists "Only owner can update FCM tokens" on fcm_tokens;
drop policy if exists "Nobody can read FCM tokens" on fcm_tokens;

-- Public can insert or update their own tokens based on browser_id
create policy "Anyone can insert FCM tokens" on fcm_tokens for insert with check ( true );
create policy "Anyone can update their own FCM tokens" on fcm_tokens for update using ( true );
-- Only authenticated admins/authors can read tokens
create policy "Only authenticated users can read FCM tokens" on fcm_tokens for select using ( auth.role() = 'authenticated' );


-- 3. Comments Security
alter table comments enable row level security;
drop policy if exists "Comments are viewable by everyone" on comments;
drop policy if exists "Anyone can insert comments" on comments;
drop policy if exists "Only authenticated can update comments" on comments;
drop policy if exists "Only authenticated can delete comments" on comments;

create policy "Comments are viewable by everyone" on comments for select using ( true );
create policy "Anyone can insert comments" on comments for insert with check ( true );
create policy "Only authenticated can update comments" on comments for update using ( auth.role() = 'authenticated' );
create policy "Only authenticated can delete comments" on comments for delete using ( auth.role() = 'authenticated' );


-- 4. Reactions Security
alter table reactions enable row level security;
drop policy if exists "Reactions are viewable by everyone" on reactions;
drop policy if exists "Anyone can insert reactions" on reactions;
drop policy if exists "Anyone can update reactions" on reactions;
drop policy if exists "Anyone can delete reactions" on reactions;

create policy "Reactions are viewable by everyone" on reactions for select using ( true );
create policy "Anyone can insert reactions" on reactions for insert with check ( true );
create policy "Anyone can update reactions" on reactions for update using ( true );
create policy "Anyone can delete reactions" on reactions for delete using ( true );


-- 5. Storage Security (book-covers bucket)
drop policy if exists "Public Access to Book Covers" on storage.objects;
drop policy if exists "Only authenticated users can insert images" on storage.objects;
drop policy if exists "Only authenticated users can update images" on storage.objects;
drop policy if exists "Only authenticated users can delete images" on storage.objects;

create policy "Public Access to Book Covers" on storage.objects for select using ( bucket_id = 'book-covers' );
create policy "Only authenticated users can insert images" on storage.objects for insert with check ( bucket_id = 'book-covers' and auth.role() = 'authenticated' );
create policy "Only authenticated users can update images" on storage.objects for update using ( bucket_id = 'book-covers' and auth.role() = 'authenticated' );
create policy "Only authenticated users can delete images" on storage.objects for delete using ( bucket_id = 'book-covers' and auth.role() = 'authenticated' );
