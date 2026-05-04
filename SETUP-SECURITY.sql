-- ==========================================
-- ARCHAZZBOOK SECURITY FIXES
-- ==========================================
-- This script secures the database so anonymous users cannot edit/delete data.

-- 1. Books Table Security
alter table books enable row level security;

-- Drop any existing overly-permissive policies (just in case they exist)
drop policy if exists "Anyone can CREATE books" on books;
drop policy if exists "Anyone can UPDATE books" on books;
drop policy if exists "Anyone can DELETE books" on books;
drop policy if exists "Public reading" on books;
drop policy if exists "Anyone can READ books" on books;
drop policy if exists "Enable insert for authenticated users only" on books;
drop policy if exists "Enable read access for all users" on books;
drop policy if exists "Books are viewable by everyone" on books;
drop policy if exists "Only authenticated users can insert books" on books;
drop policy if exists "Only authenticated users can update books" on books;
drop policy if exists "Only authenticated users can delete books" on books;

-- Create secure policies for Books
-- Public can only READ
create policy "Books are viewable by everyone" 
on books for select using ( true );

-- ONLY Authenticated users (Author) can INSERT
create policy "Only authenticated users can insert books" 
on books for insert with check ( auth.role() = 'authenticated' );

-- ONLY Authenticated users (Author) can UPDATE
create policy "Only authenticated users can update books" 
on books for update using ( auth.role() = 'authenticated' );

-- ONLY Authenticated users (Author) can DELETE
create policy "Only authenticated users can delete books" 
on books for delete using ( auth.role() = 'authenticated' );

-- 2. Storage Security (book-covers bucket)
-- Assumes you have a bucket named 'book-covers'
-- Note: Storage policies might need to be run in the Supabase SQL editor directly 
-- or set via the Supabase Dashboard Storage policies UI.
-- The following applies to the storage.objects table.

drop policy if exists "Public Access to Book Covers" on storage.objects;
drop policy if exists "Only authenticated users can insert images" on storage.objects;
drop policy if exists "Only authenticated users can update images" on storage.objects;
drop policy if exists "Only authenticated users can delete images" on storage.objects;

-- Allow public to read images
create policy "Public Access to Book Covers" 
on storage.objects for select 
using ( bucket_id = 'book-covers' );

-- Allow only authenticated users to upload/update/delete images
create policy "Only authenticated users can insert images" 
on storage.objects for insert 
with check ( bucket_id = 'book-covers' and auth.role() = 'authenticated' );

create policy "Only authenticated users can update images" 
on storage.objects for update 
using ( bucket_id = 'book-covers' and auth.role() = 'authenticated' );

create policy "Only authenticated users can delete images" 
on storage.objects for delete 
using ( bucket_id = 'book-covers' and auth.role() = 'authenticated' );
