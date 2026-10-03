-- Fix: column "trx_id" does not exist in payments — correct column is "last_4_digits"
-- Also removes non-existent "collected_by_role" from the insert.

CREATE OR REPLACE FUNCTION create_booking_txn(
  p_date date,
  p_slots jsonb,
  p_customer_phone text,
  p_customer_name text,
  p_advance_method text,
  p_advance_trx_id text,
  p_booked_by_role text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid := gen_random_uuid();
  v_receipt_id text;
  v_sequence int;
  v_due_amount numeric;
  v_is_fully_paid boolean;
  v_customer_matches int;
  v_slot jsonb;
  v_booking_id uuid;
  v_first_booking_id uuid;
  v_first_advance numeric := 0;
BEGIN
  -- Overlap check
  FOR v_slot IN SELECT * FROM jsonb_array_elements(p_slots) LOOP
    IF EXISTS (
      SELECT 1 FROM bookings 
      WHERE date = p_date 
      AND start_time = (v_slot->>'start_time')::time
      AND status <> 'cancelled'
    ) THEN
      RAISE EXCEPTION 'Slot % is already booked', v_slot->>'start_time';
    END IF;
  END LOOP;

  v_due_amount := (p_slots->0->>'due_amount')::numeric;
  v_first_advance := (p_slots->0->>'advance_paid')::numeric;
  v_is_fully_paid := v_due_amount <= 0;

  INSERT INTO customers (phone_number, name, total_matches)
  VALUES (p_customer_phone, p_customer_name, CASE WHEN v_is_fully_paid THEN 1 ELSE 0 END)
  ON CONFLICT (phone_number) DO UPDATE SET
    name = EXCLUDED.name,
    total_matches = customers.total_matches + CASE WHEN v_is_fully_paid THEN 1 ELSE 0 END
  RETURNING total_matches INTO v_customer_matches;

  INSERT INTO receipt_counters (business_date, last_n)
  VALUES (p_date, 1)
  ON CONFLICT (business_date) DO UPDATE SET 
    last_n = receipt_counters.last_n + 1
  RETURNING last_n INTO v_sequence;

  v_receipt_id := right(extract(year from p_date)::text, 2) || 
                  lpad(extract(month from p_date)::text, 2, '0') || 
                  lpad(extract(day from p_date)::text, 2, '0') || 
                  lpad(v_sequence::text, 2, '0');

  FOR v_slot IN SELECT * FROM jsonb_array_elements(p_slots) LOOP
    INSERT INTO bookings (
      booking_group_id, receipt_id, date, start_time, end_time, 
      customer_phone, total_price, discount, advance_paid, due_amount, status, booked_by_role
    ) VALUES (
      v_group_id, v_receipt_id, p_date,
      (v_slot->>'start_time')::time,
      (v_slot->>'end_time')::time,
      p_customer_phone,
      (v_slot->>'total_price')::numeric,
      (v_slot->>'discount')::numeric, 
      (v_slot->>'advance_paid')::numeric,
      (v_slot->>'due_amount')::numeric,
      'confirmed', p_booked_by_role
    ) RETURNING id INTO v_booking_id;

    IF v_first_booking_id IS NULL THEN
      v_first_booking_id := v_booking_id;
    END IF;
  END LOOP;

  -- Use correct column: last_4_digits (not trx_id)
  IF v_first_advance > 0 THEN
    INSERT INTO payments (booking_id, amount, method, type, last_4_digits)
    VALUES (v_first_booking_id, v_first_advance, p_advance_method, 'Advance', p_advance_trx_id);
  END IF;

  RETURN jsonb_build_object(
    'booking_group_id', v_group_id,
    'receipt_id', v_receipt_id,
    'success', true
  );
END;
$$;
REVOKE ALL ON FUNCTION create_booking_txn(date, jsonb, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_booking_txn(date, jsonb, text, text, text, text, text) TO service_role;
