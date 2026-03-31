-- Global SMTP config (for app emails like password reset + 2FA).
-- Service-role only.

CREATE TABLE IF NOT EXISTS public.system_smtp (
  id integer PRIMARY KEY DEFAULT 1,
  host text NOT NULL,
  port integer NOT NULL DEFAULT 587,
  secure boolean NOT NULL DEFAULT false,
  smtp_user text NOT NULL,
  password text NOT NULL,
  from_email text NULL,
  from_name text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

ALTER TABLE public.system_smtp ENABLE ROW LEVEL SECURITY;
-- No policies: service role only.

