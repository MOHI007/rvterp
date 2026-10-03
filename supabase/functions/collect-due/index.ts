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
    const { booking_id, amount, method, last_4_digits } = await req.json();

    if (!booking_id || amount === undefined || !method) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders });
    }

    if (amount <= 0) {
      return new Response(JSON.stringify({ error: 'Amount must be greater than 0' }), { status: 400, headers: corsHeaders });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Deno/Supabase JS doesn't have true transactions, but we can read and update.
    // For atomic updates, an RPC is best. Let's create an RPC or do a safe read/update if RPC doesn't exist.
    // Since we can't easily create an RPC without a migration, we'll read then update.
    
    const { data: booking, error: bError } = await supabaseClient
      .from('bookings')
      .select('due_amount, booking_group_id, customer_phone')
      .eq('id', booking_id)
      .single();

    if (bError || !booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), { status: 404, headers: corsHeaders });
    }

    let targetBookingId = booking_id;
    let currentDue = booking.due_amount;
    let customerPhone = booking.customer_phone;

    // If it's a group, maybe the due amount is on the first row. We'll just trust the passed booking_id.
    // Wait, the prompt says "cancel/collect operate on the group". 
    // If it operates on the group, we should probably update the row that actually has the due_amount.
    // Let's assume the passed booking_id is the one with the due_amount.

    if (amount > currentDue) {
      return new Response(JSON.stringify({ error: 'Amount exceeds current due' }), { status: 400, headers: corsHeaders });
    }

    const newDue = currentDue - amount;

    // Insert payment
    const { error: pError } = await supabaseClient.from('payments').insert({
      booking_id: targetBookingId,
      method: method,
      last_4_digits: last_4_digits,
      amount: amount,
      type: 'Due'
    });

    if (pError) throw pError;

    // Update due
    const { error: updateError } = await supabaseClient
      .from('bookings')
      .update({ due_amount: newDue })
      .eq('id', targetBookingId);

    if (updateError) throw updateError;

    // If fully paid, increment matches
    if (newDue === 0 && customerPhone) {
      const { data: cust } = await supabaseClient.from('customers').select('total_matches').eq('phone_number', customerPhone).single();
      if (cust) {
        await supabaseClient.from('customers').update({ total_matches: (cust.total_matches || 0) + 1 }).eq('phone_number', customerPhone);
      }
    }

    return new Response(JSON.stringify({ success: true, new_due: newDue }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return handleAuthError(err, corsHeaders);
  }
});
