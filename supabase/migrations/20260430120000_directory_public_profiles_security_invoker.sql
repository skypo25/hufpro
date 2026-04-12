-- Öffentliche Profil-View muss mit Owner-Rechten auf directory_profiles lesen.
-- Ist security_invoker = true, wertet Postgres RLS/Berechtigungen als *Aufrufer* (z. B. anon) aus —
-- anon hat kein SELECT auf directory_profiles → View liefert 0 Zeilen trotz published + DE, Kontaktformular fehlt.

ALTER VIEW public.directory_public_profiles SET (security_invoker = false);
