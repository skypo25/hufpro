-- Minimal admin audit log (server-side, service-role only)

CREATE TABLE IF NOT EXISTS public.admin_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),

  actor_user_id uuid NULL,
  target_user_id uuid NULL,

  action text NOT NULL,
  message text NULL,
  metadata jsonb NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_events_created_at
  ON public.admin_audit_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_events_target_user_id
  ON public.admin_audit_events(target_user_id);

COMMENT ON TABLE public.admin_audit_events IS 'Admin Audit Log. Zugriff nur über Service Role.';

ALTER TABLE public.admin_audit_events ENABLE ROW LEVEL SECURITY;
-- Keine Policies: nur Service Role.

