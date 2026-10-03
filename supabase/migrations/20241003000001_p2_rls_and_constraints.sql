-- P2: Enable RLS and setup constraints

-- 1. Drop existing policies (to ensure zero permissive policies remain)
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN ('profiles', 'customers', 'bookings', 'payments', 'expenses', 'settings', 'app_sessions', 'receipt_counters', 'login_attempts')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END
$$;

-- 2. Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- Create receipt_counters table if not exists before enabling RLS
CREATE TABLE IF NOT EXISTS receipt_counters (
    business_date date PRIMARY KEY,
    last_n int NOT NULL DEFAULT 0
);
ALTER TABLE receipt_counters ENABLE ROW LEVEL SECURITY;

-- The only table anon needs to read is settings.
CREATE POLICY "Anon can read settings" ON settings
  FOR SELECT
  TO anon
  USING (true);

-- 3. Add Constraints and Indexes
-- Add method column to expenses and set default
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS method text DEFAULT 'Cash';

-- Add booking_group_id to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_group_id uuid;

-- Replace UNIQUE(date, start_time) with partial unique index to allow overlapping cancelled slots
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_date_start_time_key;
DROP INDEX IF EXISTS bookings_date_start_time_idx;
CREATE UNIQUE INDEX bookings_date_start_time_idx ON bookings (date, start_time) WHERE status <> 'cancelled';

-- Add CHECK constraints for amounts
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_discount_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_discount_check CHECK (discount >= 0);

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_amount_check;
ALTER TABLE payments ADD CONSTRAINT payments_amount_check CHECK (amount >= 0);
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_amount_check;
ALTER TABLE expenses ADD CONSTRAINT expenses_amount_check CHECK (amount >= 0);
