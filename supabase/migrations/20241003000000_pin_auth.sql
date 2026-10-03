-- enable pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- add new columns
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS pin_hash text;

-- backfill pin_hash safely
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='pin') THEN
    EXECUTE 'UPDATE profiles SET pin_hash = crypt(pin, gen_salt(''bf'')) WHERE pin IS NOT NULL';
  END IF;
END $$;

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

-- Create login_attempts table for rate limiting
CREATE TABLE IF NOT EXISTS login_attempts (
  ip inet PRIMARY KEY,
  attempts int DEFAULT 0,
  locked_until timestamptz
);

-- RPC for verifying PIN
CREATE OR REPLACE FUNCTION verify_pin_rpc(p_pin text, p_ip inet)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile record;
  v_token uuid;
  v_attempts int;
  v_locked_until timestamptz;
BEGIN
  -- Cleanup expired sessions
  DELETE FROM app_sessions WHERE expires_at < now();

  -- Check rate limit
  SELECT attempts, locked_until INTO v_attempts, v_locked_until FROM login_attempts WHERE ip = p_ip;
  IF v_locked_until > now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Too many attempts. Locked for 15 minutes.');
  END IF;

  -- Find the profile matching the PIN
  SELECT * INTO v_profile
  FROM profiles
  WHERE pin_hash = crypt(p_pin, pin_hash)
  LIMIT 1;

  IF NOT FOUND THEN
    -- Increment attempts
    INSERT INTO login_attempts (ip, attempts, locked_until)
    VALUES (p_ip, 1, NULL)
    ON CONFLICT (ip) DO UPDATE SET 
      attempts = login_attempts.attempts + 1,
      locked_until = CASE WHEN login_attempts.attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE NULL END;
    
    RETURN jsonb_build_object('success', false, 'error', 'Invalid PIN');
  END IF;

  -- Reset failed attempts on success
  UPDATE login_attempts SET attempts = 0, locked_until = NULL WHERE ip = p_ip;

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

-- Secure the RPC
REVOKE ALL ON FUNCTION verify_pin_rpc(text, inet) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION verify_pin_rpc(text, inet) TO service_role;
