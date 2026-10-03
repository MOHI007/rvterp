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
    const { booking_id, amount: rawAmount, method, last_4_digits } = await req.json();

    const amount = Number(rawAmount) || 0;

    if (!booking_id || amount <= 0 || !method) {
      return new Response(JSON.stringify({ error: 'Missing required fields or invalid amount' }), { status: 400, headers: corsHeaders });
    }
    
    if (method !== 'Cash' && (!last_4_digits || last_4_digits.length !== 4)) {
      return new Response(JSON.stringify({ error: 'bKash/Nagad require 4-char TrxID' }), { status: 400, headers: corsHeaders });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: result, error: rpcError } = await supabaseClient.rpc('collect_due_txn', {
      p_booking_id: booking_id,
      p_amount: amount,
      p_method: method,
      p_last_4_digits: method === 'Cash' ? null : last_4_digits
    });

    if (rpcError) {
      return new Response(JSON.stringify({ error: rpcError.message || 'Transaction failed' }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true, new_due: result.new_due }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return handleAuthError(err, corsHeaders);
  }
});
