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
    await requireAuth(req);
    const { booking_id } = await req.json();

    if (!booking_id) {
      return new Response(JSON.stringify({ error: 'booking_id is required' }), { status: 400, headers: corsHeaders });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Get Booking
    const { data: booking, error: bError } = await supabaseClient
      .from('bookings')
      .select('booking_group_id, advance_paid, customer_phone, status')
      .eq('id', booking_id)
      .single();

    if (bError || !booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), { status: 404, headers: corsHeaders });
    }
    if (booking.status === 'cancelled') {
      return new Response(JSON.stringify({ error: 'Booking already cancelled' }), { status: 400, headers: corsHeaders });
    }

    // Since we assigned the full advance_paid to the FIRST row in the group, we just query it from this row.
    // However, if we cancel the group, we need to sum advance_paid for all rows just in case.
    
    let query = supabaseClient.from('bookings').select('id, advance_paid');
    if (booking.booking_group_id) {
      query = query.eq('booking_group_id', booking.booking_group_id);
    } else {
      query = query.eq('id', booking_id);
    }

    const { data: groupBookings } = await query;
    let totalAdvance = 0;
    const idsToCancel = [];
    if (groupBookings) {
      for (const b of groupBookings) {
        totalAdvance += (b.advance_paid || 0);
        idsToCancel.push(b.id);
      }
    }

    // 2. Cancel all in group
    const { error: cancelError } = await supabaseClient
      .from('bookings')
      .update({ status: 'cancelled' })
      .in('id', idsToCancel);

    if (cancelError) throw cancelError;

    // 3. Credit Customer if totalAdvance > 0
    if (totalAdvance > 0 && booking.customer_phone) {
      const { data: customer } = await supabaseClient
        .from('customers')
        .select('advance_balance')
        .eq('phone_number', booking.customer_phone)
        .single();
        
      if (customer) {
        await supabaseClient
          .from('customers')
          .update({ advance_balance: (customer.advance_balance || 0) + totalAdvance })
          .eq('phone_number', booking.customer_phone);
      }
    }

    return new Response(JSON.stringify({ success: true, credited: totalAdvance }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return handleAuthError(err, corsHeaders);
  }
});
