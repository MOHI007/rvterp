import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.2";
import { requireAuth, handleAuthError } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-session-token',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { profile_id, role } = await requireAuth(req);
    const { date, start_time, hours, phone, name, discount, advance, advanceMethod, advanceTrxId } = await req.json();

    if (!date || !start_time || !hours || !phone) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Get settings for price & validations
    const { data: settings } = await supabaseClient.from('settings').select('*').limit(1).maybeSingle();
    
    // Parse start_time to get slot prices
    const getSlotDetails = (timeStr: string) => {
      const [h, m] = timeStr.split(':');
      let hour = parseInt(h);
      
      const isNight = hour >= 20 || hour < 6;
      const isPrime = hour >= 16 && hour < 23; // 4pm to 11pm (23:00)
      
      let price = settings?.day_price || 400;
      if (isNight && settings?.night_price) price = settings.night_price;
      if (isPrime && settings?.prime_price) price = settings.prime_price;
      
      return { timeStr, price };
    };

    let totalBasePrice = 0;
    const slots = [];
    let currentHour = parseInt(start_time.split(':')[0]);
    let currentMin = start_time.split(':')[1];

    for (let i = 0; i < hours; i++) {
      let h = (currentHour + i) % 24;
      let timeStr = `${h.toString().padStart(2, '0')}:${currentMin}:00`;
      let nextH = (h + 1) % 24;
      let endTimeStr = `${nextH.toString().padStart(2, '0')}:${currentMin}:00`;
      
      const details = getSlotDetails(timeStr);
      totalBasePrice += details.price;
      slots.push({ startTime: timeStr, endTime: endTimeStr, price: details.price });
    }

    const maxDiscount = hours * (settings?.max_discount_allowed || 100);
    if (discount > maxDiscount) {
      return new Response(JSON.stringify({ error: `Discount exceeds max allowed (৳${maxDiscount})` }), { status: 400, headers: corsHeaders });
    }
    
    if (discount > totalBasePrice) {
      return new Response(JSON.stringify({ error: `Discount cannot exceed total base price` }), { status: 400, headers: corsHeaders });
    }

    if (settings?.force_advance_payment && advance <= 0) {
      return new Response(JSON.stringify({ error: 'Advance payment is required' }), { status: 400, headers: corsHeaders });
    }

    const netAmount = totalBasePrice - discount;
    const dueAmount = Math.max(0, netAmount - advance);

    // Transaction via RPC for atomic receipt counter? 
    // We can just use an RPC to get the sequence or do a quick upsert.
    // Deno doesn't have native tx for supabase-js, so we do it sequentially.
    
    // 2. Check for overlaps
    for (const slot of slots) {
      const { data: existing } = await supabaseClient
        .from('bookings')
        .select('id')
        .eq('date', date)
        .eq('start_time', slot.startTime)
        .neq('status', 'cancelled')
        .limit(1)
        .maybeSingle();
        
      if (existing) {
        return new Response(JSON.stringify({ error: 'Slot already booked' }), { status: 409, headers: corsHeaders });
      }
    }

    // 3. Upsert Customer
    const finalName = name?.trim() || 'অজানা গ্রাহক';
    const isFullyPaid = dueAmount === 0;
    
    const { data: customerData } = await supabaseClient.from('customers').select('total_matches').eq('phone_number', phone).limit(1).maybeSingle();
    let newMatchCount = customerData ? customerData.total_matches : 0;
    if (isFullyPaid) newMatchCount += 1;

    await supabaseClient.from('customers').upsert({
      phone_number: phone,
      name: finalName,
      total_matches: newMatchCount
    }, { onConflict: 'phone_number' });

    // 4. Receipt Counter
    const dateObj = new Date(date);
    const yy = dateObj.getFullYear().toString().slice(-2);
    const mm = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const dd = dateObj.getDate().toString().padStart(2, '0');
    
    const { data: counterData } = await supabaseClient.rpc('increment_receipt_counter', { p_date: date }).single();
    let sequence = '01';
    if (counterData) {
      sequence = counterData.toString().padStart(2, '0');
    } else {
      // Fallback if RPC fails or isn't created
      const { count } = await supabaseClient.from('bookings').select('id', { count: 'exact', head: true }).eq('date', date);
      sequence = ((count || 0) + 1).toString().padStart(2, '0');
    }
    const receiptId = `${yy}${mm}${dd}${sequence}`;

    const bookingGroupId = crypto.randomUUID();

    // 5. Insert Bookings
    const insertedBookings = [];
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      // For multi-hour, we apply the discount and advance to the first slot, or spread it.
      // Usually it's better to just set it on the group, but we have row-level pricing.
      // We will put the full price/discount/advance/due on the first slot to avoid math issues, 
      // or proportional. Let's just put the full totals on the first row for now, and 0 for rest.
      // Wait, if we operate on the group, all group rows might need to be summed.
      // Let's divide equally or assign to first. Let's assign full amounts to first slot, 0 to others, to keep SUM() working exactly.
      
      const { data: booking, error: bError } = await supabaseClient.from('bookings').insert({
        booking_group_id: bookingGroupId,
        receipt_id: receiptId,
        date: date,
        start_time: slot.startTime,
        end_time: slot.endTime, 
        customer_phone: phone,
        total_price: i === 0 ? totalBasePrice : 0,
        discount: i === 0 ? discount : 0,
        advance_paid: i === 0 ? advance : 0,
        due_amount: i === 0 ? dueAmount : 0,
        status: 'confirmed',
        booked_by_role: role || 'manager'
      }).select().single();

      if (bError) throw bError;
      insertedBookings.push(booking);
    }

    // 6. Insert Advance Payment
    if (advance > 0 && insertedBookings[0]) {
      await supabaseClient.from('payments').insert({
        booking_id: insertedBookings[0].id,
        method: advanceMethod,
        last_4_digits: advanceMethod !== 'Cash' ? advanceTrxId : null,
        amount: advance,
        type: 'Advance'
      });
    }

    return new Response(JSON.stringify({ success: true, booking_group_id: bookingGroupId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return handleAuthError(err, corsHeaders);
  }
});
