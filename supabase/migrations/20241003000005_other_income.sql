-- Other Income Table
CREATE TABLE IF NOT EXISTS other_income (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL CHECK (amount > 0),
  method text NOT NULL DEFAULT 'Cash' CHECK (method IN ('Cash','bKash','Nagad')),
  category text NOT NULL,
  note text,
  recorded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- RLS: Service Role Only
ALTER TABLE other_income ENABLE ROW LEVEL SECURITY;
-- No policies => Deny by default for anon/authenticated

-- Add income_categories to settings
ALTER TABLE settings ADD COLUMN IF NOT EXISTS income_categories text[] DEFAULT ARRAY['পুরাতন বল বিক্রি','জার্সি ভাড়া','পানি/খাবার','অন্যান্য'];

-- Audit Log Table (if not exists)
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at timestamptz DEFAULT now(),
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id text NOT NULL,
  old_data jsonb,
  new_data jsonb
);

-- RLS: Service Role Only
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
-- No policies => Deny by default
