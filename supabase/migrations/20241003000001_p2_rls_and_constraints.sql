-- P2: Enable RLS and setup constraints

-- 1. Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Deny all by default for anon and authenticated (if using normal JWT, but we are using Edge Functions with service_role).
-- The only table anon needs to read is settings.
CREATE POLICY "Anon can read settings" ON settings
  FOR SELECT
  TO anon
  USING (true);

-- Drop any existing permissive policies just in case
-- (Assuming there were none or they were permissive, the above implicitly denies all for everything else for anon)

-- 2. Add Constraints
-- Temporarily add UNIQUE(date, start_time) on bookings (until P3 reworks multi-hour)
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_date_start_time_key;
ALTER TABLE bookings ADD CONSTRAINT bookings_date_start_time_key UNIQUE(date, start_time);

-- Add CHECK constraints for amounts
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_discount_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_discount_check CHECK (discount >= 0);

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_amount_check;
ALTER TABLE payments ADD CONSTRAINT payments_amount_check CHECK (amount >= 0);

ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_amount_check;
ALTER TABLE expenses ADD CONSTRAINT expenses_amount_check CHECK (amount >= 0);

-- 3. Atomic receipt sequence
-- receipt_counters(business_date, last_n) table
CREATE TABLE IF NOT EXISTS receipt_counters (
    business_date date PRIMARY KEY,
    last_n int NOT NULL DEFAULT 0
);

-- Note: The logic for getting the next receipt ID will be handled in the Edge Function via UPDATE ... RETURNING.
