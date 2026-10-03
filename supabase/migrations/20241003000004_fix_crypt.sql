CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER FUNCTION verify_pin_rpc(text, inet) SET search_path = public, extensions;
