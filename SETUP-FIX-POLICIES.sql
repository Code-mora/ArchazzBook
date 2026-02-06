-- Add policy to allow deletion of comments
-- This was missing, preventing users/authors from deleting comments
create policy "Anyone can delete comments" 
on comments 
for delete 
using ( true );

-- Just in case, grant delete permission explicitly to public/anon if not inherited (usually covered by policy but good to be safe)
grant delete on table comments to anon;
grant delete on table comments to authenticated;
grant delete on table comments to service_role;
