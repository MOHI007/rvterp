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
    if (role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
    }
    const { id: booking_group_id, date, start_time, hours, phone, name, discount: rawDiscount, advance: rawAdvance, advanceMethod, advanceTrxId } = await req.json();

    // Validation (R5)
    if (!booking_group_id || !date || !start_time || !hours || !phone) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders });
    }

    const discount = Number(rawDiscount) || 0;
    const advance = Number(rawAdvance) || 0;
    const numHours = parseInt(hours);

    if (discount < 0) throw new Error('Discount cannot be negative');
    if (advance < 0) throw new Error('Advance cannot be negative');
    if (numHours < 1 || numHours > 22) throw new Error('Hours must be between 1 and 22');
    if (advance > 0 && advanceMethod !== 'Cash' && (!advanceTrxId || advanceTrxId.length !== 4)) {
      throw new Error('bKash/Nagad require 4-char TrxID');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: settings } = await supabaseClient.from('settings').select('*').limit(1).maybeSingle();
    
    // Pricing replication (R1)
    const dayRate = settings?.dynamic_pricing_rules?.day_rate || 600;
    const nightRate = settings?.dynamic_pricing_rules?.night_rate || 1000;
    const nightStartHour = settings?.dynamic_pricing_rules?.night_start_hour || 18;
    
    const getSlotDetails = (timeStr: string) => {
      const [h, m] = timeStr.split(':');
      let hour = parseInt(h);
      
      const isPrime = hour >= nightStartHour || hour < 4;
      const price = isPrime ? nightRate : dayRate;
      
      return { timeStr, price };
    };

    let totalBasePrice = 0;
    const slots = [];
    let currentHour = parseInt(start_time.split(':')[0]);
    let currentMin = start_time.split(':')[1];

    for (let i = 0; i < numHours; i++) {
      let h = (currentHour + i) % 24;
      let timeStr = `${h.toString().padStart(2, '0')}:${currentMin}:00`;
      let nextH = (h + 1) % 24;
      let endTimeStr = `${nextH.toString().padStart(2, '0')}:${currentMin}:00`;
      
      const details = getSlotDetails(timeStr);
      totalBasePrice += details.price;
      
      slots.push({ 
        start_time: timeStr, 
        end_time: endTimeStr, 
        total_price: 0, 
        discount: 0, 
        advance_paid: 0, 
        due_amount: 0 
      });
    }

    const maxDiscount = numHours * (settings?.max_discount_allowed || 100);
    
    if (discount > totalBasePrice) {
      throw new Error('Discount cannot exceed the total price');
    }

    if (settings?.force_advance_payment && advance <= 0) {
      throw new Error('Advance payment is required');
    }

    const netAmount = totalBasePrice - discount;
    const dueAmount = Math.max(0, netAmount - advance);

    // Apply totals to the FIRST slot for group consistency
    slots[0].total_price = totalBasePrice;
    slots[0].discount = discount;
    slots[0].advance_paid = advance;
    slots[0].due_amount = dueAmount;

    // Call RPC
    const finalName = name?.trim() || 'অজানা গ্রাহক';
    const { data: result, error: rpcError } = await supabaseClient.rpc('admin_update_booking_txn', {
      p_booking_group_id: booking_group_id,
      p_date: date,
      p_slots: slots,
      p_customer_phone: phone,
      p_customer_name: finalName,
      p_advance_method: advanceMethod,
      p_advance_trx_id: advanceTrxId,
      p_booked_by_role: role || 'manager',
      p_profile_id: profile_id
    });

    if (rpcError) {
      throw new Error(rpcError.message || 'Transaction failed');
    }

    return new Response(JSON.stringify({ success: true, booking_group_id: result.booking_group_id, receipt_id: result.receipt_id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error("Booking Edge Function Error:", err);
    if (err.message?.includes('Unauthorized')) {
      return handleAuthError(err, corsHeaders);
    }
    return new Response(
      JSON.stringify({ success: false, error: err.message || "An unexpected error occurred" }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
