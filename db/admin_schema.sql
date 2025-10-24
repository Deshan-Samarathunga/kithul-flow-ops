-- Admin module schema
-- Contains core reference tables maintained through the Admin interface.

CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  profile_image TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS users_role_idx ON public.users (role);

CREATE TABLE IF NOT EXISTS public.collection_centers (
  id BIGSERIAL PRIMARY KEY,
  center_id TEXT UNIQUE NOT NULL,
  center_name TEXT NOT NULL,
  location TEXT NOT NULL,
  center_agent TEXT NOT NULL,
  contact_phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.users IS 'User accounts for the Kithul Flow Ops system.';
COMMENT ON TABLE public.collection_centers IS 'Collection centers where kithul products are gathered.';
