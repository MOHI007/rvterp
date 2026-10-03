-- P2 RPCs for Atomicity

-- 1. create_booking_txn
CREATE OR REPLACE FUNCTION create_booking_txn(
  p_date date,
  p_slots jsonb, -- array of { start_time, end_time, total_price, discount, advance_paid, due_amount }
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
      AND start_time = (v_slot->>'start_time') 
      AND status <> 'cancelled'
    ) THEN
      RAISE EXCEPTION 'Slot % is already booked', v_slot->>'start_time';
    END IF;
  END LOOP;

  -- Due amount check (get from the first slot for customer matches)
  v_due_amount := (p_slots->0->>'due_amount')::numeric;
  v_first_advance := (p_slots->0->>'advance_paid')::numeric;
  v_is_fully_paid := v_due_amount <= 0;

  -- Customer Upsert
  INSERT INTO customers (phone_number, name, total_matches)
  VALUES (p_customer_phone, p_customer_name, CASE WHEN v_is_fully_paid THEN 1 ELSE 0 END)
  ON CONFLICT (phone_number) DO UPDATE SET
    name = EXCLUDED.name,
    total_matches = customers.total_matches + CASE WHEN v_is_fully_paid THEN 1 ELSE 0 END
  RETURNING total_matches INTO v_customer_matches;

  -- Receipt counter
  INSERT INTO receipt_counters (business_date, last_n)
  VALUES (p_date, 1)
  ON CONFLICT (business_date) DO UPDATE SET 
    last_n = receipt_counters.last_n + 1
  RETURNING last_n INTO v_sequence;

  v_receipt_id := right(extract(year from p_date)::text, 2) || 
                  lpad(extract(month from p_date)::text, 2, '0') || 
                  lpad(extract(day from p_date)::text, 2, '0') || 
                  lpad(v_sequence::text, 2, '0');

  -- Insert Bookings
  FOR v_slot IN SELECT * FROM jsonb_array_elements(p_slots) LOOP
    INSERT INTO bookings (
      booking_group_id, receipt_id, date, start_time, end_time, 
      customer_phone, total_price, discount, advance_paid, due_amount, status, booked_by_role
    ) VALUES (
      v_group_id, v_receipt_id, p_date, v_slot->>'start_time', v_slot->>'end_time',
      p_customer_phone, (v_slot->>'total_price')::numeric, (v_slot->>'discount')::numeric, 
      (v_slot->>'advance_paid')::numeric, (v_slot->>'due_amount')::numeric, 'confirmed', p_booked_by_role
    ) RETURNING id INTO v_booking_id;

    IF v_first_booking_id IS NULL THEN
      v_first_booking_id := v_booking_id;
    END IF;
  END LOOP;

  -- Insert Advance Payment if any
  IF v_first_advance > 0 THEN
    INSERT INTO payments (booking_id, method, last_4_digits, amount, type)
    VALUES (v_first_booking_id, p_advance_method, p_advance_trx_id, v_first_advance, 'Advance');
  END IF;

  RETURN jsonb_build_object(
    'booking_group_id', v_group_id,
    'receipt_id', v_receipt_id
  );
END;
$$;
REVOKE ALL ON FUNCTION create_booking_txn FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_booking_txn TO service_role;

-- 2. collect_due_txn
CREATE OR REPLACE FUNCTION collect_due_txn(
  p_booking_id uuid,
  p_amount numeric,
  p_method text,
  p_last_4_digits text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_due numeric;
  v_customer_phone text;
  v_group_id uuid;
BEGIN
  -- Lock row
  SELECT due_amount, customer_phone, booking_group_id 
  INTO v_due, v_customer_phone, v_group_id
  FROM bookings WHERE id = p_booking_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF p_amount > v_due THEN
    RAISE EXCEPTION 'Amount % exceeds current due %', p_amount, v_due;
  END IF;

  -- Insert payment
  INSERT INTO payments (booking_id, method, last_4_digits, amount, type)
  VALUES (p_booking_id, p_method, p_last_4_digits, p_amount, 'Due');

  -- Update due
  UPDATE bookings SET due_amount = due_amount - p_amount WHERE id = p_booking_id;

  -- Increment customer total_matches if fully paid
  IF (v_due - p_amount) <= 0 AND v_customer_phone IS NOT NULL THEN
    UPDATE customers SET total_matches = total_matches + 1 WHERE phone_number = v_customer_phone;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'new_due', (v_due - p_amount)
  );
END;
$$;
REVOKE ALL ON FUNCTION collect_due_txn FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION collect_due_txn TO service_role;

-- 3. cancel_booking_txn
CREATE OR REPLACE FUNCTION cancel_booking_txn(
  p_booking_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
  v_customer_phone text;
  v_total_advance numeric := 0;
  v_status text;
  v_row record;
BEGIN
  -- Get group_id and verify
  SELECT booking_group_id, customer_phone, status 
  INTO v_group_id, v_customer_phone, v_status
  FROM bookings WHERE id = p_booking_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_status = 'cancelled' THEN
    RAISE EXCEPTION 'Booking already cancelled';
  END IF;

  -- Lock all rows in group and sum advance
  IF v_group_id IS NOT NULL THEN
    FOR v_row IN SELECT id, advance_paid FROM bookings WHERE booking_group_id = v_group_id FOR UPDATE LOOP
      v_total_advance := v_total_advance + COALESCE(v_row.advance_paid, 0);
    END LOOP;
    UPDATE bookings SET status = 'cancelled' WHERE booking_group_id = v_group_id;
  ELSE
    SELECT advance_paid INTO v_total_advance FROM bookings WHERE id = p_booking_id FOR UPDATE;
    UPDATE bookings SET status = 'cancelled' WHERE id = p_booking_id;
  END IF;

  -- Credit advance balance
  IF v_total_advance > 0 AND v_customer_phone IS NOT NULL THEN
    UPDATE customers SET advance_balance = advance_balance + v_total_advance WHERE phone_number = v_customer_phone;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'credited', v_total_advance
  );
END;
$$;
REVOKE ALL ON FUNCTION cancel_booking_txn FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION cancel_booking_txn TO service_role;
