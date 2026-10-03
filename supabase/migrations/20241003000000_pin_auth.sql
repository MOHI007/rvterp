-- enable pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- add new columns
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS pin_hash text,
ADD COLUMN IF NOT EXISTS failed_attempts int DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_until timestamptz;

-- backfill pin_hash
UPDATE profiles 
SET pin_hash = crypt(pin, gen_salt('bf'))
WHERE pin IS NOT NULL;

-- drop pin column
ALTER TABLE profiles 
DROP COLUMN IF EXISTS pin;

-- Create app_sessions table
CREATE TABLE IF NOT EXISTS app_sessions (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- RPC for verifying PIN
CREATE OR REPLACE FUNCTION verify_pin_rpc(p_pin text)
RETURNS jsonb
SECURITY DEFINER
AS $$
DECLARE
  v_profile record;
  v_token uuid;
BEGIN
  -- Cleanup expired sessions
  DELETE FROM app_sessions WHERE expires_at < now();

  -- Find the profile matching the PIN
  SELECT * INTO v_profile
  FROM profiles
  WHERE pin_hash = crypt(p_pin, pin_hash)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid PIN');
  END IF;

  IF v_profile.locked_until > now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account locked', 'locked_until', v_profile.locked_until);
  END IF;

  -- Reset failed attempts on success
  UPDATE profiles SET failed_attempts = 0, locked_until = NULL WHERE id = v_profile.id;

  -- Create session (12h expiry)
  INSERT INTO app_sessions (profile_id, role, expires_at)
  VALUES (v_profile.id, v_profile.role, now() + interval '12 hours')
  RETURNING token INTO v_token;

  RETURN jsonb_build_object(
    'success', true,
    'token', v_token,
    'id', v_profile.id,
    'name', v_profile.name,
    'role', v_profile.role
  );
END;
$$ LANGUAGE plpgsql;
