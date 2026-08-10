-- ==========================================
-- ARCHAZZBOOK SECURITY HARDENING V2
-- ==========================================
-- Run this AFTER SETUP-SECURITY.sql.
--
-- Why this is needed: PostgreSQL combines RLS policies with OR. The permissive
-- policies created by the earlier setup scripts (SETUP-COMMENTS.sql,
-- SETUP-FIX-POLICIES.sql, SETUP-NOTIFICATIONS.sql, SETUP-REACTIONS.sql,
-- SETUP-UPDATE.sql) use different names, so they survived SETUP-SECURITY.sql and
-- still allow anonymous users to do everything those policies permitted:
--   * read every FCM push token in the database ("Anyone can read tokens")
--   * edit and delete anybody else's comments ("Anyone can update specific fields",
--     "Anyone can delete comments")
-- Dropping them by name makes the restrictive V1 policies effective.

-- 1. FCM tokens: anonymous users must not be able to enumerate push tokens
drop policy if exists "Anyone can read tokens" on fcm_tokens;
drop policy if exists "Anyone can register token" on fcm_tokens;
drop policy if exists "Anyone can update tokens" on fcm_tokens;

-- 2. Comments: only the authenticated author may edit/delete (moderation)
--    NOTE: anonymous readers can no longer edit or delete their own comments,
--    because an anonymous browser_id is client-supplied and can be spoofed.
drop policy if exists "Everyone can insert comments" on comments;
drop policy if exists "Anyone can update specific fields" on comments;
drop policy if exists "Anyone can delete comments" on comments;

revoke delete on table comments from anon;

-- 3. Author follows: keep reads limited to authenticated users so the
--    follower list cannot be scraped anonymously
drop policy if exists "Anyone can view follows" on author_follows;
create policy "Only authenticated users can view follows"
  on author_follows for select
  using ( auth.role() = 'authenticated' );

-- 4. Verify the remaining policies
-- select tablename, policyname, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
-- order by tablename, policyname;
