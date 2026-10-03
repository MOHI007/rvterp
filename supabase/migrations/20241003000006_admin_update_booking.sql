-- Admin update booking RPC
CREATE OR REPLACE FUNCTION admin_update_booking_txn(
  p_booking_group_id uuid,
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
  v_slot jsonb;
  v_first_booking_id uuid;
  v_first_advance numeric := 0;
  v_current_advance numeric := 0;
  v_advance_diff numeric := 0;
  v_index int := 0;
  v_due_amount numeric;
  v_is_fully_paid boolean;
  v_was_fully_paid boolean;
  v_customer_matches int;
BEGIN
  -- Find the primary booking (the first one created for this group)
  SELECT id INTO v_first_booking_id FROM bookings WHERE booking_group_id = p_booking_group_id ORDER BY start_time ASC LIMIT 1;
  IF v_first_booking_id IS NULL THEN
    -- Fallback to assuming p_booking_group_id is just the id if it was a legacy single booking
    SELECT id INTO v_first_booking_id FROM bookings WHERE id = p_booking_group_id LIMIT 1;
    IF v_first_booking_id IS NULL THEN
      RAISE EXCEPTION 'Booking not found';
    END IF;
  END IF;

  -- Overlap check (excluding current group)
  FOR v_slot IN SELECT * FROM jsonb_array_elements(p_slots) LOOP
    IF EXISTS (
      SELECT 1 FROM bookings 
      WHERE date = p_date 
      AND start_time = (v_slot->>'start_time') 
      AND status <> 'cancelled'
      AND (booking_group_id IS NULL OR booking_group_id <> p_booking_group_id)
      AND id <> p_booking_group_id
    ) THEN
      RAISE EXCEPTION 'Slot % is already booked', v_slot->>'start_time';
    END IF;
  END LOOP;

  -- Due amount check (get from the first slot)
  v_due_amount := (p_slots->0->>'due_amount')::numeric;
  v_first_advance := (p_slots->0->>'advance_paid')::numeric;
  v_is_fully_paid := v_due_amount <= 0;

  -- Customer Upsert
  INSERT INTO customers (phone_number, name, total_matches)
  VALUES (p_customer_phone, p_customer_name, 0)
  ON CONFLICT (phone_number) DO UPDATE SET
    name = EXCLUDED.name;

  -- Delete all bookings in the group EXCEPT the primary one
  DELETE FROM bookings WHERE (booking_group_id = p_booking_group_id OR id = p_booking_group_id) AND id <> v_first_booking_id;

  -- Update or Insert Bookings
  FOR v_slot IN SELECT * FROM jsonb_array_elements(p_slots) LOOP
    IF v_index = 0 THEN
      -- Update the primary booking
      UPDATE bookings SET
        date = p_date,
        start_time = v_slot->>'start_time',
        end_time = v_slot->>'end_time',
        customer_phone = p_customer_phone,
        total_price = (v_slot->>'total_price')::numeric,
        discount = (v_slot->>'discount')::numeric,
        advance_paid = (v_slot->>'advance_paid')::numeric,
        due_amount = (v_slot->>'due_amount')::numeric
      WHERE id = v_first_booking_id;
    ELSE
      -- Insert extra slots
      INSERT INTO bookings (
        booking_group_id, receipt_id, date, start_time, end_time, 
        customer_phone, total_price, discount, advance_paid, due_amount, status, booked_by_role
      )
      SELECT 
        p_booking_group_id, receipt_id, p_date, v_slot->>'start_time', v_slot->>'end_time',
        p_customer_phone, (v_slot->>'total_price')::numeric, (v_slot->>'discount')::numeric, 
        (v_slot->>'advance_paid')::numeric, (v_slot->>'due_amount')::numeric, 'confirmed', p_booked_by_role
      FROM bookings WHERE id = v_first_booking_id LIMIT 1;
    END IF;
    v_index := v_index + 1;
  END LOOP;

  -- Handle Payments sync for advance_paid
  SELECT COALESCE(SUM(amount), 0) INTO v_current_advance FROM payments WHERE booking_id = v_first_booking_id;
  v_advance_diff := v_first_advance - v_current_advance;

  IF v_advance_diff > 0 THEN
    -- Admin increased advance, insert the difference
    INSERT INTO payments (booking_id, method, last_4_digits, amount, type)
    VALUES (v_first_booking_id, p_advance_method, p_advance_trx_id, v_advance_diff, 'Advance');
  ELSIF v_advance_diff < 0 THEN
    -- Admin decreased advance, we insert a negative adjustment or update existing.
    -- Since we have amount >= 0 constraint, we can't insert negative.
    -- Let's just delete all payments and re-insert to ensure exact amount.
    -- Wait, deleting loses timestamp. We will UPDATE the most recent payment.
    -- If it's still negative, we update it to 0, and subtract from the next.
    -- Actually, to keep it simple, if they reduce it, we update the first payment we find.
    DECLARE
      v_pay record;
      v_rem numeric := ABS(v_advance_diff);
    BEGIN
      FOR v_pay IN SELECT * FROM payments WHERE booking_id = v_first_booking_id ORDER BY created_at DESC LOOP
        IF v_rem = 0 THEN EXIT; END IF;
        IF v_pay.amount <= v_rem THEN
          DELETE FROM payments WHERE id = v_pay.id;
          v_rem := v_rem - v_pay.amount;
        ELSE
          UPDATE payments SET amount = amount - v_rem WHERE id = v_pay.id;
          v_rem := 0;
        END IF;
      END LOOP;
    END;
  END IF;

  RETURN jsonb_build_object(
    'booking_group_id', p_booking_group_id,
    'success', true
  );
END;
$$;
REVOKE ALL ON FUNCTION admin_update_booking_txn FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_update_booking_txn TO service_role;
