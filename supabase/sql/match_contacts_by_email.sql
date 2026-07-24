-- Returns profiles whose auth email matches any of the supplied addresses.
-- SECURITY DEFINER so the function can read auth.users on the caller's behalf.
CREATE OR REPLACE FUNCTION public.match_contacts_by_email(emails text[])
RETURNS TABLE (
  id uuid,
  username text,
  full_name text,
  avatar_url text,
  is_private boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.username, p.full_name, p.avatar_url, p.is_private
  FROM profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE lower(u.email) = ANY(SELECT lower(e) FROM unnest(emails) AS e)
    AND p.id != auth.uid();
$$;
