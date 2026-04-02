-- Temporäre ZIP-Exports (Server lädt hoch, Nutzer lädt per signierter URL herunter).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'data-exports',
  'data-exports',
  false,
  524288000,
  ARRAY['application/zip', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;
